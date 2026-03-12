/**
 * Best Prompt Pipeline - Real-time Visualization via SSE
 * 
 * This module implements:
 * - POST /api/pipeline/run - Execute full pipeline with SSE events
 * - GET /api/pipeline/stream/:runId - SSE stream for pipeline events
 * 
 * Pipeline Flow (v2.2 — single candidate, cost-optimized):
 * Spec Builder → Generation (1× fluent) → Critique → Refine → Evaluation → Outcome
 */

import { Router } from "express";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db, ensureUser } from "../lib/db.js";
import { chatText, chatJson, LlmDisabledError, AnthropicDisabledError } from "../lib/llmRouter.js";
import { getStageModel, getStageList, shouldRunStage, computeCompositeScore, EVALUATION_WEIGHTS, PIPELINE_STAGES, PIPELINE_CONFIG } from "../lib/modelConfig.js";
import { searchExemplars, formatExemplarBlock, harvestExemplar } from "../lib/exemplarService.js";
import { spendTokensForRun, getTokenStatus } from "../lib/tokenUsage.js";
import { FEATURES } from "../lib/subscriptionConfig.js";
import { checkPromptOptimizationLimit, recordUsage, canUseMode } from "../lib/planLimits.js";
// import { validatePromptInput } from "../lib/inputValidator.js";
import { detectAmbiguity } from "../lib/ambiguityDetector.js";
import { requireAuth } from "./auth.js";

export const pipelineRouter = Router();

// Store active SSE connections by runId
const activeStreams = new Map();
const streamAuth = new Map();

function issueStreamToken(runId, userId) {
  const token = nanoid(32);
  streamAuth.set(runId, {
    userId,
    token,
    expiresAt: Date.now() + 15 * 60 * 1000
  });
  return token;
}

function validateStreamToken(runId, token) {
  if (!token || typeof token !== "string") return false;
  const record = streamAuth.get(runId);
  if (!record) return false;
  if (record.expiresAt < Date.now()) {
    streamAuth.delete(runId);
    return false;
  }
  return record.token === token;
}

/**
 * GET /api/pipeline/health
 * Health check endpoint to verify pipeline routes are working
 */
pipelineRouter.get("/health", (req, res) => {
  console.log(`[pipeline] GET /health called - Pipeline routes are working!`);
  res.json({
    ok: true,
    message: "Pipeline routes are working",
    timestamp: new Date().toISOString(),
    routes: {
      "POST /api/pipeline/run": "Execute full pipeline with SSE events",
      "GET /api/pipeline/stream/:runId": "SSE stream for pipeline events",
      "GET /api/pipeline/health": "Health check (this endpoint)"
    },
    activeStreams: activeStreams.size
  });
});

function stripThinkBlocks(text) {
  if (!text || typeof text !== "string") return text;
  const stripped = text.replace(/<think>[\s\S]*?<\/think>\s*/gi, "").trim();
  // Fallback: if think-block removal consumed the entire response, extract inner content
  if (!stripped && text.trim()) {
    const thinkMatch = text.match(/<think>([\s\S]*?)<\/think>/i);
    if (thinkMatch) {
      console.warn("[stripThinkBlocks] Entire response was inside <think> tags — extracting inner content as fallback");
      return thinkMatch[1].trim();
    }
  }
  return stripped;
}

/**
 * Send SSE event to a specific stream
 */
function sendEvent(runId, event, data) {
  const stream = activeStreams.get(runId);
  if (stream) {
    try {
      stream.write(`event: ${event}\n`);
      stream.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (err) {
      console.error(`[pipeline] Failed to send event to ${runId}:`, err);
      activeStreams.delete(runId);
    }
  }
}

/**
 * GET /api/pipeline/stream/:runId
 * SSE endpoint for real-time pipeline events
 */
pipelineRouter.get("/stream/:runId", (req, res) => {
  const { runId } = req.params;
  const st = req.query?.st;
  if (!validateStreamToken(runId, st)) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering

  // Store the response stream
  activeStreams.set(runId, res);

  // Send initial connection event
  res.write(`event: connected\n`);
  res.write(`data: ${JSON.stringify({ runId, timestamp: new Date().toISOString() })}\n\n`);

  // Heartbeat to keep connection alive
  const pingInterval = setInterval(() => {
    if (activeStreams.has(runId)) {
      sendEvent(runId, "ping", { timestamp: new Date().toISOString() });
    } else {
      clearInterval(pingInterval);
    }
  }, 5000); // 每 5 秒发送一次 ping (必须)

  // Handle client disconnect
  req.on("close", () => {
    console.log(`[pipeline] Client disconnected from stream ${runId}`);
    clearInterval(pingInterval);
    activeStreams.delete(runId);
    res.end();
  });
});

/**
 * POST /api/pipeline/run
 * Execute full pipeline with real-time SSE events
 */
const PipelineRunRequestSchema = z.object({
  idea: z.string().min(1, "idea is required").max(10000, "Input must be under 10,000 characters"),
  attachments: z.array(z.object({
    name: z.string().max(255, "Filename too long"),
    type: z.string().max(100, "MIME type too long"),
    size: z.number().int().min(1).max(50 * 1024 * 1024, "Attachment too large (max 50MB)")
  })).max(10, "Too many attachments (max 10)").optional(),
  skipQuestions: z.boolean().optional(),
  model: z.string().optional(),
  clarificationsProvided: z.boolean().optional(),
});

pipelineRouter.post("/run", requireAuth, async (req, res) => {
  console.log(`[pipeline] POST /run received`);
  const userId = req.user.sub;
  ensureUser(userId);

  const parsed = PipelineRunRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    console.error(`[pipeline] Validation failed:`, parsed.error.flatten());
    return res.status(400).json({ ok: false, error: parsed.error.flatten() });
  }

  const { idea, attachments = [], skipQuestions = false, model: modeInput = null, clarificationsProvided = false } = parsed.data;
  const mode = modeInput || 'fast';
  
  // Check plan limits
  const limitCheck = checkPromptOptimizationLimit(userId, mode);
  if (!limitCheck.allowed) {
    return res.status(403).json({
      ok: false,
      error: limitCheck.reason,
      usage: limitCheck.usage,
      limit: limitCheck.limit
    });
  }
  
  console.log(`[pipeline] Starting pipeline - idea length: ${idea.length}, skipQuestions: ${skipQuestions}, mode: ${mode}`);

  // Generate a unique runId for this pipeline execution
  const runId = `run_${nanoid(16)}`;
  console.log(`[pipeline] Generated runId: ${runId}`);
  const streamToken = issueStreamToken(runId, userId);

  // Immediately return runId and SSE endpoint
  res.json({
    ok: true,
    runId,
    streamUrl: `/api/pipeline/stream/${runId}`,
    streamToken
  });

  // Execute pipeline asynchronously and send events
  // Note: recordUsage is now called inside executePipelineWithEvents on success
  executePipelineWithEvents(runId, userId, { idea, attachments, skipQuestions, modeInput, clarificationsProvided })
    .catch((err) => {
      console.error(`[pipeline] Pipeline execution failed for ${runId}:`, err);
      sendEvent(runId, "error", {
        stage: "pipeline",
        message: err.message || "Pipeline execution failed"
      });
      sendEvent(runId, "complete", { success: false });
    });
});

/**
 * Extract "pinned terms" from the user's raw input that must be preserved verbatim.
 * Covers: URLs, emails, file paths, quoted phrases, @mentions, #hashtags,
 * domain names, product/brand names (CamelCase / ALL_CAPS tokens).
 */
function extractPinnedTerms(text) {
  if (!text) return [];
  const found = new Set();

  // URLs (http/https/ftp/www)
  const urls = text.match(/https?:\/\/[^\s,"'\)\]>]+|www\.[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s,"'\)\]>]*/g) || [];
  urls.forEach(u => found.add(u));

  // Email addresses
  const emails = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [];
  emails.forEach(e => found.add(e));

  // Quoted phrases ("exact phrase" or '…')
  const quoted = text.match(/"([^"]{2,60})"|'([^']{2,60})'/g) || [];
  quoted.forEach(q => found.add(q));

  // File paths (Unix/Windows)
  const paths = text.match(/(?:\/[\w.\-]+){2,}|[A-Za-z]:\\[^\s]+/g) || [];
  paths.forEach(p => found.add(p));

  // @mentions, #hashtags
  const mentions = text.match(/[@#][\w\u4e00-\u9fa5]+/g) || [];
  mentions.forEach(m => found.add(m));

  // Domain-like tokens (example.com, sub.domain.io — not inside URLs already captured)
  const domains = text.match(/\b[a-zA-Z0-9-]{2,}\.[a-zA-Z]{2,6}(?:\/[^\s]*)?\b/g) || [];
  domains.forEach(d => {
    // Skip if already captured as part of a URL
    const alreadyCovered = [...found].some(f => f.includes(d));
    if (!alreadyCovered) found.add(d);
  });

  // Explicit model / product / brand names: CamelCase, ALL_CAPS, version strings like v1.2, GPT-4
  const brandNames = text.match(/\b(?:[A-Z][a-z]+[A-Z][a-zA-Z]*|[A-Z]{2,}(?:[_-][A-Z0-9]+)*|GPT-[0-9.]+|Claude-[0-9a-z.]+|v[0-9]+(?:\.[0-9]+)+)\b/g) || [];
  brandNames.forEach(b => found.add(b));

  return [...found].filter(t => t.length >= 3);
}

/**
 * Execute full pipeline and send SSE events
 * With timeout protection (default: 5 minutes)
 */
async function executePipelineWithEvents(runId, userId, { idea, attachments, skipQuestions, modeInput, clarificationsProvided = false }) {
  const PIPELINE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  const startTime = Date.now();
  
  // Resolve Policy based on mode (modeInput param holds the mode: fast, standard, premium)
  const mode = modeInput || 'fast';
  
  // Check mode restrictions for free plan (this is a backup check, main check is in /run endpoint)
  if (!canUseMode(userId, mode)) {
    sendEvent(runId, "error", {
      stage: "pipeline",
      message: 'Free plan only supports Standard and Fast modes. Please upgrade to use Deep or Ultra Thinking modes.'
    });
    sendEvent(runId, "complete", { success: false });
    return;
  }
  
  const pipelineConfig = PIPELINE_CONFIG[mode] || PIPELINE_CONFIG.fast;
  console.log(`[pipeline] [${runId}] Pipeline v2 mode=${mode}, stages=[${getStageList(mode).join(",")}]`);
  console.log(`[pipeline] [${runId}] Models: Spec=${getStageModel(mode, "specBuilder").model}, Gen=${getStageModel(mode, "generation").model}, Eval=${getStageModel(mode, "evaluation").model}`);
  
  // 1. Wait for client to connect (max 10 seconds)
  // This prevents the race condition where events are sent before the client connects
  const MAX_WAIT_ATTEMPTS = 20;
  const WAIT_INTERVAL_MS = 500;
  
  let clientConnected = false;
  for (let i = 0; i < MAX_WAIT_ATTEMPTS; i++) {
    if (activeStreams.has(runId)) {
      clientConnected = true;
      break;
    }
    await new Promise(resolve => setTimeout(resolve, WAIT_INTERVAL_MS));
  }

  if (!clientConnected) {
    console.warn(`[pipeline] [${runId}] Client did not connect within timeout, aborting execution.`);
    // Clean up if somehow it was added but not detected, though unlikely
    activeStreams.delete(runId);
    return;
  }

  // 2. Setup Keep-Alive Heartbeat
  // Prevents load balancers or browsers from dropping idle connections during long LLM calls
  const pingInterval = setInterval(() => {
    if (activeStreams.has(runId)) {
      sendEvent(runId, 'ping', { timestamp: new Date().toISOString() });
    } else {
      clearInterval(pingInterval);
    }
  }, 5000); // Send ping every 5 seconds (Critical for stability)
  
  const checkTimeout = () => {
    const elapsed = Date.now() - startTime;
    if (elapsed > PIPELINE_TIMEOUT_MS) {
      throw new Error(`Pipeline timeout after ${Math.round(elapsed / 1000)}s`);
    }
  };
  
  const now = new Date().toISOString();
  let specId = null;
  let sessionId = null;
  let candidateIds = [];
  
  // Token usage tracking
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  
  // Pipeline v2: Per-stage timing for observability
  const stageTiming = {};
  const stageTimer = (stageName) => {
    const t0 = Date.now();
    return () => { stageTiming[stageName] = Date.now() - t0; };
  };

  // Pipeline v2: Metrics tracking for observability
  const pipelineMetrics = {
    calls_total: {
      spec_builder: 0,
      generation: 0,
      critique: 0,
      refine: 0,
      evaluation: 0,
      outcome_runner: 0
    },
    retries_total: 0,
    generation_retries: 0,
  };

  try {
    // ============================================
    // Stage 0: Input Validation Gate (DISABLED FOR BOSS MODE)
    // ============================================
    // Rejects inputs that are not prompt optimization requests.
    // Runs before any LLM call. Fail-open on validator error.
    // ============================================
    /*
    sendEvent(runId, "stage-start", { stage: "validation", message: "Validating input..." });

    const validation = await validatePromptInput(idea);

    if (!validation.isValid) {
      console.warn(`[pipeline] [${runId}] Input rejected: ${validation.rejectReason}`);
      sendEvent(runId, "pipeline-rejected", {
        reason: validation.rejectReason,
        message: validation.rejectMessage,
        language: validation.language,
      });
      sendEvent(runId, "complete", { success: false, rejected: true });
      // Record rejected run for analytics
      try {
        db.prepare(`
          INSERT OR IGNORE INTO runs (id, spec_id, model, status, input_blocks, rejection_reason, created_at)
          VALUES (?, NULL, ?, 'rejected', ?, ?, datetime('now'))
        `).run(runId, `pipeline-v2/${mode}`, JSON.stringify({ idea: idea.substring(0, 500), mode }), validation.rejectReason);
      } catch (_) { }
      return;
    }

    sendEvent(runId, "stage-complete", { stage: "validation" });
    */

    // ============================================
    // Stage 0.5: Ambiguity Detection Gate (DISABLED FOR BOSS MODE)
    // ============================================
    // Asks the user for critical missing context BEFORE any generation.
    // Skipped when user has already provided clarifications on re-submission.
    // Fail-open: any error continues directly to Stage 1.
    // Quality mandate: never hallucinate missing context — always ask first.
    // ============================================
    /*
    if (!clarificationsProvided) {
      const ambiguity = await detectAmbiguity(idea);
      if (ambiguity.needsClarification) {
        console.log(`[pipeline] [${runId}] Ambiguity detected (score=${ambiguity.ambiguityScore.toFixed(2)}, lang=${ambiguity.language}) — requesting clarification`);
        sendEvent(runId, "pipeline-clarification-needed", {
          questions: ambiguity.questions,
          ambiguityScore: ambiguity.ambiguityScore,
          language: ambiguity.language ?? 'en',
        });
        sendEvent(runId, "complete", { success: false, needsClarification: true });
        return;
      }
    }
    */

    // ============================================
    // Stage 1: Direct Optimizer (Boss Mode)
    // ============================================
    // Replaces the old Spec -> Gen -> Critique -> Refine chain.
    // Single-pass optimization using the "Executive Directive Optimizer" prompt.
    // ============================================

    // Since we are skipping the Spec Builder, we need to create a placeholder Spec
    // because the 'candidate_prompts' table has a NOT NULL constraint on spec_id.
    
    // Generate a specId if we don't have one (which is always true in Boss Mode)
    if (!specId) {
      specId = `spec_${nanoid(12)}`;
      
      // Insert placeholder spec to satisfy DB constraints
      try {
        db.prepare(`
          INSERT INTO specs (
            id, owner_id, title, spec_json, 
            kind, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          specId,
          userId,
          "Direct Optimization (Boss Mode)",
          JSON.stringify({ mode: "boss_mode", task: idea }),
          "boss_mode",
          "completed",
          now,
          now
        );
      } catch (specErr) {
        console.warn(`[pipeline] Failed to create placeholder spec: ${specErr.message}`);
        // If this fails, the subsequent candidate insert will likely fail too, 
        // but we'll proceed to let the error bubble up if it must.
      }
    }
    
    // Model Selection (Updated for 2026 Models)
    const MODEL_MAP = {
      fast:     "claude-haiku-4-5",
      standard: "claude-haiku-4-5",
      premium:  "claude-sonnet-4-6",
    };
    const targetModel = MODEL_MAP[mode] || MODEL_MAP.fast;

    console.log(`[pipeline] [${runId}] Mode: ${mode} -> Model: ${targetModel}`);

    sendEvent(runId, "stage-start", {
      stage: "optimizing", // Unified stage for UI animation
      message: "Optimizing directive...",
      timestamp: new Date().toISOString()
    });

    // --- THE "BOSS MODE" PROMPT (REFINED FOR STRUCTURAL ORGANIZATION) ---
    const SYSTEM_PROMPT = `You are an Executive Project Manager and Structural Organizer.
Your goal is to restructure raw, messy user input into a clear, actionable execution plan.
You do NOT invent features. You do NOT explain your reasoning. You do NOT add fluff.

CORE RULES:
1. LANGUAGE MIRRORING: Output MUST be in the same language as the input (e.g., Chinese input -> Chinese output).
2. ZERO INVENTION: "If not said = does not exist = do not write". Do NOT add features, technologies, or steps the user did not explicitly request.
   EXCEPTION: If the user asks for a structural artifact (e.g., "Make a template", "Migrate logic") without providing content, you MUST list the creation of this artifact as a high-level requirement/task. Do NOT refuse to process.
3. TONE PRESERVATION: Capture imperative commands (e.g., "One-time delivery", "Do not miss anything") as strict requirements/constraints.
4. NO INTERACTION/QUESTIONS: 
   - You are a ONE-WAY processor. You cannot ask questions. 
   - Do NOT ask for source code, files, or clarifications.
   - If the user asks to "make a template" or "migrate logic" but provides no code, simply list "Create template" or "Migrate logic" as a detailed requirement in the output. 
   - NEVER output "I need more information" or "Please provide".
5. NON-EXECUTION ROLE: 
   - You are a PROMPT ORGANIZER, not an Execution AI.
   - You do NOT generate implementation code (no Python/JS/HTML blocks).
   - You do NOT execute tasks.
   - Your output is a CLEANED-UP REQUEST, not the RESULT of the request.
   - Example: Input "Write a migration script" -> Output "- Write a migration script" (Do NOT output the actual script).

OUTPUT FORMAT:
- Pure text list.
- Use simple indentation for hierarchy.
- NO Markdown syntax (no asterisks *, no hashes #, no dashes -).
- NO bolding or italics.
- Just clean, plain text.

EXAMPLE 1:
Input: "我们需要一次性全部搞定..."
Output:
"一次性完成以下所有内容：

实现内容：
OAuth 登录系统（GitHub + Google）
数据库使用 PostgreSQL

部署环境：
Render Starter（无休眠问题）
通过render blueprint来快捷部署。

要求：
遵循行业标准
一次性交付全部代码和配置，不分阶段
不要遗漏任何上述要求"

EXAMPLE 2:
Input: "整体再缩小！..."
Output:
"完成以下UI调整和优化：

视觉调整：
整体UI缩小（幅度需大）
滚动速度调慢，且上下滚动速度一致
鼠标光标：自定义鼠标，尾部跟随小特效（非尖部），Light mode无特效，Dark mode渐变色
修复Navigation Bar中Science栏目高低不平的问题
Light mode背景：低透明度、隐约可见的科技风方格纹路

性能优化：
替换Columbia Logo：使用优化后的SVG/PNG（<36x36 slot, <1.47MB）

要求：
保持轻量化（Lite），无额外渲染压力"`;

    // Build attachment context
    const sanitizeName = (n) => n.replace(/[^\w\-. ]/g, '_').substring(0, 100);
    const attachmentContext = attachments.length > 0
      ? `\n\n[ATTACHMENT_METADATA_START]\n${attachments.map(a => `- ${sanitizeName(a.name)} (${a.type}, ${a.size} bytes)`).join("\n")}\n[ATTACHMENT_METADATA_END]`
      : "";

    const userPrompt = `${idea}${attachmentContext}`;

    checkTimeout();
    
    // Fake progress events to drive frontend animation during generation
    sendEvent(runId, "stage-progress", {
      stage: "optimizing",
      step: "analyzing",
      message: "Analyzing intent...",
      details: { model: targetModel }
    });

    let content = "";
    let usage = { prompt_tokens: 0, completion_tokens: 0 };

    try {
      const { text, usage: chatUsage } = await chatText({
        system: SYSTEM_PROMPT,
        user: userPrompt,
        model: targetModel,
        provider: "anthropic", // Enforce Anthropic for Haiku/Sonnet
        maxRetries: 2
      });
      
      content = text;
      usage = chatUsage || usage;
      
      totalInputTokens += usage.prompt_tokens || 0;
      totalOutputTokens += usage.completion_tokens || 0;
      pipelineMetrics.calls_total.generation = 1;

    } catch (genErr) {
      console.error(`[pipeline] [${runId}] Generation failed:`, genErr);
      throw genErr;
    }

    sendEvent(runId, "stage-complete", {
      stage: "optimizing",
      message: "Optimization complete",
      result: { content } // Pass content directly for UI to render
    });

    // ============================================
    // Stage 5: Outcome (Simplified)
    // ============================================
    // No more complex scoring or candidate selection.
    // Just wrap the result.
    // ============================================
    
    const outcomeId = `outcome_${nanoid(12)}`;
    
    // Create a dummy candidate object for compatibility with DB and legacy UI parts if needed
    const candidateId = `cand_${nanoid(12)}`;
    const bestCandidate = {
      id: candidateId,
      agent: "DirectOptimizer",
      content: content,
      metrics: { compositeScore: 1.0 } // Fake score for compatibility
    };

    // Save candidate (optional, but good for record keeping)
    db.prepare(`
      INSERT INTO candidate_prompts (id, spec_id, session_id, agent, model, content, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      candidateId,
      specId || null, // Allow NULL if specId not created
      sessionId || null,
      "DirectOptimizer",
      targetModel,
      content,
      now
    );

    // Save outcome
    db.prepare(`
      INSERT INTO outcome_runs (id, spec_id, task, n, model, status, best_candidate_id, result_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      outcomeId,
      specId || null, // Allow NULL
      idea.substring(0, 500),
      1,
      targetModel,
      "completed",
      candidateId,
      JSON.stringify({
        pipelineVersion: "3.0-boss-mode",
        selectionMethod: "direct",
        bestCandidate: {
          id: candidateId,
          agent: "DirectOptimizer",
          content: content,
          metrics: { compositeScore: 1.0 }
        }
      }),
      now
    );

    sendEvent(runId, "stage-complete", {
      stage: "outcome",
      message: "Directive ready",
      result: {
        outcomeId,
        selectedCandidateId: candidateId,
        agent: "DirectOptimizer",
        compositeScore: 1.0,
        content: content
      }
    });

    // ... (Remainder of the function: history, token usage, cleanup) ...


    // Query historical runs for this user to build history and contributions
    // Note: outcome_runs doesn't have user_id, so we JOIN through specs table
    // For Boss Mode with NULL spec_id, we skip this join or handle it gracefully
    let historicalRuns = [];
    try {
      historicalRuns = db.prepare(`
        SELECT 
          or_data.result_json,
          or_data.created_at
        FROM outcome_runs or_data
        JOIN specs ON or_data.spec_id = specs.id
        WHERE specs.owner_id = ?
          AND or_data.status = 'completed'
        ORDER BY or_data.created_at DESC
        LIMIT 10
      `).all(userId);
    } catch (err) {
      console.warn(`[pipeline] Failed to fetch history (likely due to null spec_id in Boss Mode): ${err.message}`);
      // Fallback: empty history is fine for now
    }
    
    // Build history array (progress/composite scores from recent runs)
    const history = [];
    const contributions = [];
    
    historicalRuns.reverse().forEach((run, index) => {
      try {
        const resultData = JSON.parse(run.result_json || '{}');
        const compositeScore = resultData.bestCandidate?.metrics?.compositeScore;
        
        if (compositeScore !== undefined) {
          const progressValue = Math.round(compositeScore * 100);
          history.push(progressValue);
          
          // Calculate contribution (delta from previous run)
          if (index > 0) {
            const contribution = Math.abs(progressValue - history[index - 1]);
            contributions.push(contribution);
          } else {
            contributions.push(progressValue); // First run's contribution is its absolute value
          }
        }
      } catch (parseError) {
        console.warn(`[pipeline] Could not parse historical run data:`, parseError);
      }
    });
    
    // Add current run to history
    const currentProgress = Math.round(bestCandidate.metrics.compositeScore * 100);
    history.push(currentProgress);
    
    if (history.length > 1) {
      const lastContribution = Math.abs(currentProgress - history[history.length - 2]);
      contributions.push(lastContribution);
    } else {
      contributions.push(currentProgress);
    }
    
    // Ensure we have at least 3 data points for visualization (pad with current value if needed)
    while (history.length < 3) {
      history.unshift(currentProgress);
      contributions.unshift(0);
    }
    
    // ============================================
    // Token Usage Tracking and Spending
    // ============================================
    let tokenUsageResult = null;
    if (FEATURES.trackTokenUsage && totalInputTokens + totalOutputTokens > 0) {
      console.log(`[pipeline] [${runId}] Recording token usage: input=${totalInputTokens}, output=${totalOutputTokens}`);
      
      try {
        tokenUsageResult = spendTokensForRun({
          userId,
          runId,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
          options: {
            isPremium: mode === 'premium',
            isPipeline: true,
          },
        });
        
        console.log(`[pipeline] [${runId}] Token spend result: success=${tokenUsageResult.success}, credits=${tokenUsageResult.creditsSpent}`);
      } catch (tokenErr) {
        console.error(`[pipeline] [${runId}] Failed to record token usage:`, tokenErr);
      }
    }
    
    // ============================================
    // Pipeline v2: Metrics Summary
    // ============================================
    pipelineMetrics.calls_total.outcome_runner = 0; // No LLM call in outcome
    const metricsSummary = {
      runId,
      mode,
      pipelineVersion: 2,
      calls_total: pipelineMetrics.calls_total,
      retries_total: pipelineMetrics.retries_total,
      tokens: {
        input: totalInputTokens,
        output: totalOutputTokens,
        total: totalInputTokens + totalOutputTokens
      },
      stages_executed: getStageList(mode),
      stageTiming,  // per-stage duration in ms
      bestScore: bestCandidate.metrics?.compositeScore ?? null,
      bestAgent: bestCandidate.agent,
      bestSource: bestCandidate.agent.includes("_refined") ? "refined" : "original",
      candidateCount: candidateIds.length,
      durationMs: Date.now() - startTime,
    };
    console.log(`[pipeline] [${runId}] Pipeline v2 Metrics:`, JSON.stringify(metricsSummary, null, 2));

    // Persist run record to `runs` table for analytics dashboard
    try {
      db.prepare(`
        INSERT OR REPLACE INTO runs (id, spec_id, model, status, input_blocks, raw_output, completed_at, metrics_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?, ?)
      `).run(
        runId,
        specId || null,
        `pipeline-v2/${mode}`,
        "completed",
        JSON.stringify({ idea: idea.substring(0, 500), mode }),
        bestCandidate.content?.substring(0, 2000) || null,
        JSON.stringify(metricsSummary),
        now
      );
    } catch (runInsertErr) {
      console.warn(`[pipeline] [${runId}] Failed to persist run record: ${runInsertErr.message}`);
    }
    
    // Final completion event with historical data and token usage
    sendEvent(runId, "complete", {
      success: true,
      specId,
      outcomeId,
      bestCandidate: {
        id: bestCandidate.id,
        content: bestCandidate.content,
        agent: bestCandidate.agent,
        metrics: {
          ...bestCandidate.metrics,
          history: history,           // Historical progress values
          contributions: contributions // Change contributions per run
        }
      },
      tokenUsage: tokenUsageResult ? {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
        creditsSpent: tokenUsageResult.creditsSpent,
        creditsRemaining: tokenUsageResult.balances?.total || null,
      } : null
    });
    
    // 🔥 Record usage after successful pipeline completion
    console.log(`[pipeline] [${runId}] Recording usage for user ${userId}`);
    recordUsage(userId, 'prompt_optimization');
    console.log(`[pipeline] [${runId}] Usage recorded successfully`);

    // ── Auto-harvest: store high-scoring candidates in Exemplar Bank ──
    try {
      if (bestCandidate && bestCandidate.metrics && typeof bestCandidate.metrics.compositeScore === "number") {
        // Boss Mode uses placeholders for spec details since we skipped SpecBuilder
        const harvest = harvestExemplar({
          userId,
          specId,
          runId,
          candidateId: bestCandidate.id,
          mode,
          promptText: bestCandidate.content,
          taskDomain: "boss_mode",
          specSummary: idea.substring(0, 200),
          language: "en",
          metrics: bestCandidate.metrics,
        });
        if (harvest.harvested) {
          console.log(`[pipeline] [${runId}] Exemplar harvested: ${harvest.id} (agent=${bestCandidate.agent}, score=${bestCandidate.metrics.compositeScore})`);
        }
      }
    } catch (harvestErr) {
      // Non-critical — pipeline continues
      console.warn(`[pipeline] [${runId}] Exemplar harvest error: ${harvestErr.message}`);
    }

  } catch (err) {
    console.error(`[pipeline] ❌ Error in pipeline execution for ${runId}:`, err);
    console.error(`[pipeline] Error stack:`, err.stack);
    const errorMessage = err.message || "Pipeline execution failed";
    const isTimeout = errorMessage.includes("timeout");
    const isLlmDisabled = (err instanceof LlmDisabledError) || (err instanceof AnthropicDisabledError) || err.code === 'ANTHROPIC_DISABLED';
    const userMessage = isLlmDisabled
      ? "LLM features are currently disabled. Please check that the required API key (OPENAI_API_KEY or ANTHROPIC_API_KEY) is configured in the server environment."
      : errorMessage;

    // Persist failed run for analytics
    try {
      db.prepare(`
        INSERT OR IGNORE INTO runs (id, spec_id, model, status, input_blocks, completed_at, metrics_json, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'), ?, datetime('now'))
      `).run(
        runId,
        null,
        `pipeline-v2/${mode}`,
        isTimeout ? "timeout" : "failed",
        JSON.stringify({ idea: idea?.substring(0, 500), mode }),
        JSON.stringify({ error: errorMessage, durationMs: Date.now() - startTime })
      );
    } catch (_) { /* best-effort */ }
    
    // Send detailed error event
    sendEvent(runId, "error", {
      stage: "pipeline",
      message: userMessage,
      error: err.toString(),
      isTimeout,
      isLlmDisabled,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
    
    sendEvent(runId, "complete", { 
      success: false,
      error: userMessage,
      isTimeout,
      isLlmDisabled,
      runId
    });
    
    // Clean up stream connection
    activeStreams.delete(runId);
  } finally {
    // 3. Ensure Cleanup
    if (pingInterval) clearInterval(pingInterval);
    
    // Close the stream gracefully if it's still open
    const stream = activeStreams.get(runId);
    if (stream) {
      console.log(`[pipeline] [${runId}] Closing stream connection.`);
      stream.end();
      activeStreams.delete(runId);
    }
  }
}
