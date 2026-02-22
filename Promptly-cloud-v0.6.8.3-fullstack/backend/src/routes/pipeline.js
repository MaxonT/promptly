/**
 * Best Prompt Pipeline - Real-time Visualization via SSE
 * 
 * This module implements:
 * - POST /api/pipeline/run - Execute full pipeline with SSE events
 * - GET /api/pipeline/stream/:runId - SSE stream for pipeline events
 * 
 * Pipeline Flow with Real-time Events:
 * Spec Builder → Question Engine → LLM Agents → Metrics & Scoring → Outcome Runner
 */

import { Router } from "express";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db, ensureUser } from "../lib/db.js";
import { chatText, chatJson, LlmDisabledError } from "../lib/llmRouter.js";
import { getStageModel, getStageList, shouldRunStage, computeCompositeScore, EVALUATION_WEIGHTS, PIPELINE_STAGES, PIPELINE_CONFIG } from "../lib/modelConfig.js";
import { searchExemplars, formatExemplarBlock, harvestExemplar } from "../lib/exemplarService.js";
import { spendTokensForRun, getTokenStatus } from "../lib/tokenUsage.js";
import { FEATURES } from "../lib/subscriptionConfig.js";
import { checkPromptOptimizationLimit, recordUsage, canUseMode } from "../lib/planLimits.js";
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
  return text.replace(/<think>[\s\S]*?<\/think>\s*/gi, "").trim();
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
  idea: z.string().min(1, "idea is required"),
  attachments: z.array(z.object({
    name: z.string(),
    type: z.string(),
    size: z.number()
  })).optional(),
  skipQuestions: z.boolean().optional(),
  model: z.string().optional()
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

  const { idea, attachments = [], skipQuestions = false, model: modeInput = null } = parsed.data;
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
  executePipelineWithEvents(runId, userId, { idea, attachments, skipQuestions, modeInput })
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
 * Execute full pipeline and send SSE events
 * With timeout protection (default: 5 minutes)
 */
async function executePipelineWithEvents(runId, userId, { idea, attachments, skipQuestions, modeInput }) {
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
    // Stage 1: Spec Builder
    // ============================================
    const endSpecTimer = stageTimer("specBuilder");
    sendEvent(runId, "stage-start", {
      stage: "spec",
      message: "Starting Spec Builder...",
      timestamp: new Date().toISOString()
    });

    sendEvent(runId, "stage-progress", {
      stage: "spec",
      step: "extracting",
      message: "Extracting structured information from raw idea...",
      details: { ideaLength: idea.length, attachmentsCount: attachments.length }
    });

    // Pipeline v2: Enhanced 13-field spec extraction (incl. task_type for meta-prompt injection)
    const specSystem = `You are a prompt-engineering analyst. Given a raw idea, extract a comprehensive specification that will guide high-quality prompt generation.

RULES:
1. userGoal MUST be rephrased and expanded — NEVER copy verbatim.
2. Infer every field you can from context. Leave null only if truly unknowable.
3. Transform vague ideas into concrete, actionable specifications.
4. Think about edge cases, anti-patterns, and success criteria proactively.
5. task_type MUST be one of: coding, writing, analysis, brainstorming, translation, extraction, summarization, instruction, creative, other.

OUTPUT (JSON only, no markdown):
{
  "userGoal":           "string — rephrased, expanded core objective",
  "task_type":          "string — one of: coding|writing|analysis|brainstorming|translation|extraction|summarization|instruction|creative|other",
  "audience":           "string|null — who uses the prompt output",
  "domain":             "string|null — subject area / industry",
  "tone":               "string|null — communication style (professional, casual, technical…)",
  "format":             "string|null — expected output format (markdown, JSON, list, prose…)",
  "constraints":        ["string"] — hard requirements or limitations",
  "examples":           ["string"] — illustrative input/output pairs",
  "successCriteria":    ["string"] — measurable indicators the prompt works well",
  "antiPatterns":       ["string"] — things to explicitly avoid",
  "contextAssumptions": "string|null — what input/context the prompt will receive",
  "outputExpectations": "string|null — detailed output structure or length expectations",
  "edgeCases":          ["string"] — boundary conditions the prompt should handle"
}`;

    // Build attachment context
    const attachmentContext = attachments.length > 0
      ? `\n\n[ATTACHMENT_METADATA_START]\n${attachments.map(a => `- ${a.name} (${a.type}, ${a.size} bytes)`).join("\n")}\n[ATTACHMENT_METADATA_END]`
      : "";

    // Concise user prompt with clear instruction
    const specUserPrompt = `Analyze and extract a full 13-field spec (including task_type). Rephrase the goal — do NOT copy verbatim:

${idea}${attachmentContext}`;

    const specModel = getStageModel(mode, "specBuilder");

    sendEvent(runId, "stage-progress", {
      stage: "spec",
      step: "llm-call",
      message: "Calling LLM to generate structured spec...",
      details: { model: specModel.model, provider: specModel.provider, ideaLength: idea.length }
    });

    checkTimeout(); // Check timeout before LLM call
    console.log(`[pipeline] [${runId}] Stage 1: Calling Spec Builder LLM (${specModel.provider}/${specModel.model})...`);

    let specData = {};
    let specBuilderDegraded = false;

    try {
      const { data: rawSpecData, usage: specUsage } = await chatJson({
        system: specSystem,
        user: specUserPrompt,
        model: specModel.model,
        provider: specModel.provider
      });
      
      // Track token usage for spec builder
      if (specUsage) {
        totalInputTokens += specUsage.prompt_tokens || 0;
        totalOutputTokens += specUsage.completion_tokens || 0;
      }
      
      // Token Hardening: Track spec builder call
      pipelineMetrics.calls_total.spec_builder = 1;
      
      specData = rawSpecData || {};
      console.log(`[pipeline] [${runId}] Stage 1: Spec Builder completed, extracted ${Object.keys(specData).length} fields`);
    } catch (specErr) {
      // Graceful degradation: use raw idea as minimal spec
      console.warn(`[pipeline] [${runId}] Stage 1: Spec Builder LLM failed — degrading to raw input. Error: ${specErr.message}`);
      specBuilderDegraded = true;
      specData = { userGoal: idea };
      sendEvent(runId, "stage-warning", {
        stage: "spec",
        message: "Spec Builder LLM failed — using raw input as fallback spec",
        details: { error: specErr.message }
      });
    }

    sendEvent(runId, "stage-progress", {
      stage: "spec",
      step: "saving",
      message: "Saving structured spec to database...",
      details: { fields: Object.keys(specData || {}) }
    });

    const VALID_TASK_TYPES = ["coding", "writing", "analysis", "brainstorming", "translation", "extraction", "summarization", "instruction", "creative", "other"];
    const normalizedSpec = {
      userGoal:           (specData.userGoal || idea).trim(),
      task_type:          VALID_TASK_TYPES.includes(specData.task_type) ? specData.task_type : "other",
      audience:           specData.audience || null,
      domain:             specData.domain || null,
      tone:               specData.tone || null,
      format:             specData.format || null,
      constraints:        Array.isArray(specData.constraints) ? specData.constraints.filter(Boolean) : [],
      examples:           Array.isArray(specData.examples) ? specData.examples.filter(Boolean) : [],
      successCriteria:    Array.isArray(specData.successCriteria) ? specData.successCriteria.filter(Boolean) : [],
      antiPatterns:       Array.isArray(specData.antiPatterns) ? specData.antiPatterns.filter(Boolean) : [],
      contextAssumptions: specData.contextAssumptions || null,
      outputExpectations: specData.outputExpectations || null,
      edgeCases:          Array.isArray(specData.edgeCases) ? specData.edgeCases.filter(Boolean) : [],
    };

    const rawTitle = normalizedSpec.userGoal || idea;
    const truncatedTitle = rawTitle.length > 120 ? `${rawTitle.substring(0, 117)}...` : rawTitle;
    const title = truncatedTitle || "Promptly Spec";
    const summary = normalizedSpec.userGoal;

    // Save spec to database
    specId = `spec_${nanoid(12)}`;
      db.prepare(`
      INSERT INTO specs (id, owner_id, raw_idea, title, summary, spec_json, completeness_score, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      specId,
      userId,
      idea,
      title,
      summary,
      JSON.stringify(normalizedSpec),
      0,
      now,
      now
    );

    sendEvent(runId, "stage-complete", {
      stage: "spec",
      message: "Spec Builder completed successfully",
      result: { specId, title, summary, ...normalizedSpec }
    });
    endSpecTimer();

    // ============================================
    // Stage 2: Question Engine — REMOVED in Pipeline v2
    // ============================================
    // The old QE asked up to 3 questions and pushed empty-string answers,
    // consuming LLM tokens without improving spec quality.
    // Pipeline v2 relies on the enhanced 12-field Spec Builder instead.
    // The Question Wizard (llmAgents.js) remains available as a separate
    // interactive flow outside the pipeline.
    sendEvent(runId, "stage-skipped", {
      stage: "question",
      message: "Question Engine removed in Pipeline v2 (spec completeness handled by enhanced Spec Builder)",
    });

    // ============================================
    // Stage 3: Candidate Generation (Pipeline v2 — 2 differentiated candidates)
    // ============================================
    const endGenTimer = stageTimer("generation");
    sendEvent(runId, "stage-start", {
      stage: "agents",
      message: "Starting Differentiated Candidate Generation...",
      timestamp: new Date().toISOString()
    });

    const genModel = getStageModel(mode, "generation");

    // ── Exemplar Bank: retrieve few-shot references ──
    let exemplarBlock = "";
    let exemplarsFound = 0;
    try {
      const exemplars = searchExemplars({
        userId,
        keywords: normalizedSpec.userGoal,
        taskDomain: normalizedSpec.domain || null,
        topK: 3,
        minScore: 75,
      });
      exemplarsFound = exemplars.length;
      if (exemplars.length > 0) {
        exemplarBlock = formatExemplarBlock(exemplars);
        console.log(`[pipeline] [${runId}] Exemplar Bank: injecting ${exemplars.length} exemplar(s) as few-shot context`);
        sendEvent(runId, "stage-progress", {
          stage: "agents",
          step: "exemplars-loaded",
          message: `Found ${exemplars.length} high-quality exemplar(s) for reference`,
        });
      }
    } catch (exErr) {
      // Non-critical — pipeline continues without exemplars
      console.warn(`[pipeline] [${runId}] Exemplar search skipped: ${exErr.message}`);
    }

    // Two candidates with fundamentally different generation strategies
    const generators = [
      {
        name: "structured",
        systemPrompt: `You are a Structured Prompt Engineer. Transform a specification into a well-organized, hierarchical prompt.

YOUR STYLE:
- Use clear section headers (## Role, ## Task, ## Rules, ## Output Format)
- Number instructions and sub-steps explicitly
- Include {{placeholders}} for all dynamic inputs
- Add explicit constraints, guardrails, and edge-case handling
- Provide a deterministic output schema (JSON, table, or template)
- Prioritize precision and reproducibility over elegance

OUTPUT: The complete prompt text only. No commentary, no explanation.`
      },
      {
        name: "fluent",
        systemPrompt: `You are a Fluent Prompt Engineer. Transform a specification into a natural, expressive prompt.

YOUR STYLE:
- Write in flowing, conversational prose — no bullet lists or numbered steps
- Embed instructions naturally within context-setting paragraphs
- Use vivid examples and analogies to convey intent
- Guide the AI through narrative rather than rigid structure
- Prioritize clarity through context, not through formatting
- Make the prompt feel like expert instructions from a mentor

OUTPUT: The complete prompt text only. No commentary, no explanation.`
      },
    ];

    // Build rich spec context for generation
    const specContext = `=== SPECIFICATION ===
Goal: ${normalizedSpec.userGoal}
Task Type: ${normalizedSpec.task_type}
${normalizedSpec.audience ? `Audience: ${normalizedSpec.audience}` : ""}
${normalizedSpec.domain ? `Domain: ${normalizedSpec.domain}` : ""}
${normalizedSpec.tone ? `Tone: ${normalizedSpec.tone}` : ""}
${normalizedSpec.format ? `Output Format: ${normalizedSpec.format}` : ""}
${normalizedSpec.constraints.length > 0 ? `Constraints:\n${normalizedSpec.constraints.map(c => `  - ${c}`).join("\n")}` : ""}
${normalizedSpec.successCriteria.length > 0 ? `Success Criteria:\n${normalizedSpec.successCriteria.map(c => `  - ${c}`).join("\n")}` : ""}
${normalizedSpec.antiPatterns.length > 0 ? `Anti-Patterns (avoid):\n${normalizedSpec.antiPatterns.map(c => `  - ${c}`).join("\n")}` : ""}
${normalizedSpec.contextAssumptions ? `Context/Input: ${normalizedSpec.contextAssumptions}` : ""}
${normalizedSpec.outputExpectations ? `Output Expectations: ${normalizedSpec.outputExpectations}` : ""}
${normalizedSpec.edgeCases.length > 0 ? `Edge Cases:\n${normalizedSpec.edgeCases.map(c => `  - ${c}`).join("\n")}` : ""}
${normalizedSpec.examples.length > 0 ? `Examples:\n${normalizedSpec.examples.map(e => `  - ${e}`).join("\n")}` : ""}`;

    // ── Task-type Meta-Prompt: condition generation style on task ──
    const TASK_TYPE_HINTS = {
      coding: "Include code fences with language tags, variable {{placeholders}}, and explicit input/output specifications. Mention error handling and edge cases.",
      writing: "Focus on tone guidance, audience awareness, word-count expectations, and stylistic examples.",
      analysis: "Emphasize structured reasoning steps, data source requirements, comparison criteria, and conclusion format.",
      brainstorming: "Encourage divergent thinking, quantity targets, categorization of ideas, and evaluation criteria.",
      translation: "Specify source/target languages, formality level, domain terminology, and handling of untranslatable terms.",
      extraction: "Define input format, extraction schema, handling of missing fields, and output structure.",
      summarization: "Specify compression ratio, key-point retention, format (bullet/prose), and what to omit.",
      instruction: "Use numbered steps, prerequisite listing, expected outcomes per step, and troubleshooting notes.",
      creative: "Encourage originality, provide genre/style anchors, set creative constraints, and define success aesthetically.",
      other: "",
    };
    const taskTypeHint = TASK_TYPE_HINTS[normalizedSpec.task_type] || "";

    console.log(`[pipeline] [${runId}] Stage 3: Generating ${generators.length} differentiated candidates (${genModel.provider}/${genModel.model})...`);
    const failures = [];

    for (let i = 0; i < generators.length; i++) {
      const gen = generators[i];
      try {
        checkTimeout();

        sendEvent(runId, "stage-progress", {
          stage: "agents",
          step: `generating-${gen.name}`,
          message: `Generating ${gen.name} candidate...`,
          details: { agent: gen.name, progress: `${i + 1}/${generators.length}` }
        });

        console.log(`[pipeline] [${runId}] Stage 3: Generating ${gen.name} candidate...`);
        const genUserPrompt = `Transform this specification into a complete, production-ready prompt.${taskTypeHint ? `\n\nTASK-TYPE GUIDANCE (${normalizedSpec.task_type}):\n${taskTypeHint}` : ""}\n\n${specContext}${exemplarBlock}`;
        const { text: contentRaw, similarity, usage: agentUsage } = await chatText({
          system: gen.systemPrompt,
          user: genUserPrompt,
          model: genModel.model,
          provider: genModel.provider,
          minSimilarity: 0.75,
          maxRetries: 2
        });

        if (agentUsage) {
          totalInputTokens += agentUsage.prompt_tokens || 0;
          totalOutputTokens += agentUsage.completion_tokens || 0;
        }

        pipelineMetrics.calls_total.generation++;

        const content = stripThinkBlocks(contentRaw);
        console.log(`[pipeline] [${runId}] Stage 3: ${gen.name} completed — similarity: ${similarity?.toFixed(3) ?? "N/A"}, length: ${content.length}`);

        const candidateId = `cand_${nanoid(12)}`;

        db.prepare(`
          INSERT INTO candidate_prompts (id, spec_id, session_id, agent, model, content, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          candidateId,
          specId,
          sessionId,
          gen.name,
          genModel.model,
          content,
          now
        );

        sendEvent(runId, "stage-progress", {
          stage: "agents",
          step: `completed-${gen.name}`,
          message: `${gen.name} candidate generated`,
          details: { candidateId, agent: gen.name, contentLength: content.length }
        });

        candidateIds.push(candidateId);

        // Brief pause between candidates for system stability
        if (i < generators.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (err) {
        console.error(`[pipeline] [${runId}] Generator ${gen.name} failed:`, err);
        failures.push({ agent: gen.name, error: err.message });
      }
    }

    if (candidateIds.length === 0) {
      throw new Error(`All generators failed to produce candidates. Errors: ${failures.map(f => f.error).join("; ")}`);
    }

    sendEvent(runId, "stage-complete", {
      stage: "agents",
      message: `Generated ${candidateIds.length} candidate prompts (${failures.length} failed)`,
      result: { candidateIds, count: candidateIds.length, failures: failures.length }
    });
    endGenTimer();

    // ============================================
    // Stage 3b: Critique (Pipeline v2 — cross-model review)
    // Skipped in fast mode for cost savings.
    // Uses a DIFFERENT model than generation to avoid self-evaluation bias.
    // ============================================
    if (shouldRunStage(mode, "critique")) {
      const critiqueModel = getStageModel(mode, "critique");
      const endCritiqueTimer = stageTimer("critique");

      sendEvent(runId, "stage-start", {
        stage: "critique",
        message: "Starting cross-model Critique...",
        timestamp: new Date().toISOString()
      });

      const critiqueSystem = `You are an expert Prompt Critic. You receive a candidate prompt and its specification, then produce a structured 8-dimensional critique.

EVALUATE against ALL 8 dimensions (score each 0.0–1.0):
1. COMPLETENESS (weight 0.20) — Does it address every requirement in the spec?
2. CLARITY (weight 0.20) — Is the language clear and unambiguous?
3. SPECIFICITY (weight 0.15) — Is it concrete enough, or too generic / vague?
4. STRUCTURE (weight 0.12) — Is it well-organized with good hierarchy?
5. COHERENCE (weight 0.10) — Does it flow logically and maintain internal consistency?
6. CREATIVITY (weight 0.05) — Does it use novel framing or smart approaches?
7. SAFETY (weight 0.10) — Does it handle edge cases and prevent misuse?
8. EFFICIENCY (weight 0.08) — Is it concise without losing important detail?

VERDICT RULES:
- "pass" → ALL dimensions ≥ 0.8 and no critical weaknesses
- "refine" → Some dimensions below 0.8, or actionable improvements exist
- "fail" → Multiple dimensions below 0.5 or fundamental problems

OUTPUT (JSON only):
{
  "scores": {
    "completeness": 0.0, "clarity": 0.0, "specificity": 0.0, "structure": 0.0,
    "coherence": 0.0, "creativity": 0.0, "safety": 0.0, "efficiency": 0.0
  },
  "verdict": "pass|refine|fail",
  "strengths": ["string — what works well"],
  "weaknesses": ["string — specific problems found"],
  "suggestions": ["string — actionable improvement instructions"],
  "overallAssessment": "string — one-paragraph summary",
  "critiqueScore": 0.0-1.0
}

Be ruthlessly honest. Generic praise is not helpful. Differentiate scores — avoid "everything is 0.8".`;

      for (let i = 0; i < candidateIds.length; i++) {
        const candidateId = candidateIds[i];
        try {
          checkTimeout();

          const candidate = db.prepare("SELECT * FROM candidate_prompts WHERE id = ?").get(candidateId);

          sendEvent(runId, "stage-progress", {
            stage: "critique",
            step: `critiquing-${candidate.agent}`,
            message: `Critiquing ${candidate.agent} candidate...`,
            details: { candidateId, agent: candidate.agent, progress: `${i + 1}/${candidateIds.length}` }
          });

          console.log(`[pipeline] [${runId}] Critique: reviewing ${candidate.agent} candidate with ${critiqueModel.provider}/${critiqueModel.model}...`);

          const { data: critiqueData, usage: critiqueUsage } = await chatJson({
            system: critiqueSystem,
            user: `Critique this candidate prompt:\n\n---CANDIDATE---\n${candidate.content}\n---END---\n\n---SPECIFICATION---\n${specContext}\n---END---`,
            model: critiqueModel.model,
            provider: critiqueModel.provider,
          });

          if (critiqueUsage) {
            totalInputTokens += critiqueUsage.prompt_tokens || 0;
            totalOutputTokens += critiqueUsage.completion_tokens || 0;
          }
          pipelineMetrics.calls_total.critique++;

          // Store critique as JSON in metrics_json (will be overwritten later by evaluation scores)
          // We store it temporarily so the Refine stage can read it
          db.prepare("UPDATE candidate_prompts SET metrics_json = ? WHERE id = ?")
            .run(JSON.stringify({ critique: critiqueData }), candidateId);

          sendEvent(runId, "stage-progress", {
            stage: "critique",
            step: `critiqued-${candidate.agent}`,
            message: `${candidate.agent} critique complete (verdict: ${critiqueData?.verdict ?? "unknown"})`,
            details: {
              candidateId,
              verdict: critiqueData?.verdict ?? null,
              critiqueScore: critiqueData?.critiqueScore ?? null,
              scores: critiqueData?.scores ?? null,
              weaknessCount: critiqueData?.weaknesses?.length ?? 0,
              suggestionCount: critiqueData?.suggestions?.length ?? 0,
            }
          });

          // Brief pause between critiques
          if (i < candidateIds.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        } catch (err) {
          console.error(`[pipeline] [${runId}] Critique failed for candidate ${candidateId}:`, err);
          // Non-fatal: candidate proceeds to refine without critique
        }
      }

      sendEvent(runId, "stage-complete", {
        stage: "critique",
        message: `Critique completed for ${candidateIds.length} candidates`,
        result: { candidateIds }
      });
      endCritiqueTimer();

      // ============================================
      // Stage 3c: Refine (Pipeline v2 — improve based on critique)
      // Uses the SAME model as generation (the author refines its own work).
      // Only refines candidates whose critique verdict != 'pass'.
      // ============================================
      const refineModel = getStageModel(mode, "refine");
      const endRefineTimer = stageTimer("refine");

      sendEvent(runId, "stage-start", {
        stage: "refine",
        message: "Starting Refinement based on critique...",
        timestamp: new Date().toISOString()
      });

      const refineSystem = `You are a Prompt Refiner. You receive a candidate prompt plus a structured critique, and produce an improved version.

RULES:
1. Address EVERY weakness and suggestion from the critique.
2. Preserve the candidate's strengths and original style.
3. Do NOT add content that contradicts the specification.
4. The refined version must be noticeably better than the original.
5. Output ONLY the refined prompt text — no commentary.`;

      // Refine each candidate — ONLY if critique verdict != 'pass'
      const refinedCandidateIds = [];

      for (let i = 0; i < candidateIds.length; i++) {
        const candidateId = candidateIds[i];
        try {
          checkTimeout();

          const candidate = db.prepare("SELECT * FROM candidate_prompts WHERE id = ?").get(candidateId);
          const critiqueJson = candidate.metrics_json ? JSON.parse(candidate.metrics_json) : {};
          const critique = critiqueJson.critique || {};

          // ── Verdict Gate: skip refine if critique passed ──
          if (critique.verdict === "pass") {
            console.log(`[pipeline] [${runId}] Refine: skipping ${candidate.agent} — critique verdict is 'pass'`);
            sendEvent(runId, "stage-progress", {
              stage: "refine",
              step: `skipped-${candidate.agent}`,
              message: `${candidate.agent} already passed critique — no refinement needed`,
              details: { candidateId, agent: candidate.agent, verdict: "pass" }
            });
            continue;
          }

          sendEvent(runId, "stage-progress", {
            stage: "refine",
            step: `refining-${candidate.agent}`,
            message: `Refining ${candidate.agent} candidate (verdict: ${critique.verdict || "unknown"})...`,
            details: { candidateId, agent: candidate.agent, progress: `${i + 1}/${candidateIds.length}`, verdict: critique.verdict }
          });

          console.log(`[pipeline] [${runId}] Refine: improving ${candidate.agent} candidate (verdict=${critique.verdict})...`);

          const critiqueContext = critique.weaknesses?.length
            ? `\n\n---CRITIQUE---\nVerdict: ${critique.verdict}\nWeaknesses:\n${critique.weaknesses.map(w => `  - ${w}`).join("\n")}\n\nSuggestions:\n${(critique.suggestions || []).map(s => `  - ${s}`).join("\n")}${critique.scores ? `\n\nScores: ${JSON.stringify(critique.scores)}` : ""}\n---END---`
            : "";

          const { text: refinedRaw, usage: refineUsage } = await chatText({
            system: refineSystem,
            user: `Refine this prompt based on the critique:\n\n---ORIGINAL---\n${candidate.content}\n---END---${critiqueContext}\n\n---SPECIFICATION---\n${specContext}\n---END---`,
            model: refineModel.model,
            provider: refineModel.provider,
          });

          if (refineUsage) {
            totalInputTokens += refineUsage.prompt_tokens || 0;
            totalOutputTokens += refineUsage.completion_tokens || 0;
          }
          pipelineMetrics.calls_total.refine++;

          const refinedContent = stripThinkBlocks(refinedRaw);

          // Create a new "refined" candidate row linked to the original
          const refinedId = `cand_${nanoid(12)}`;
          db.prepare(`
            INSERT INTO candidate_prompts (id, spec_id, session_id, agent, model, content, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(
            refinedId,
            specId,
            sessionId,
            `${candidate.agent}_refined`,
            refineModel.model,
            refinedContent,
            now
          );

          refinedCandidateIds.push(refinedId);

          sendEvent(runId, "stage-progress", {
            stage: "refine",
            step: `refined-${candidate.agent}`,
            message: `${candidate.agent} candidate refined`,
            details: {
              originalId: candidateId,
              refinedId,
              originalLength: candidate.content.length,
              refinedLength: refinedContent.length,
            }
          });

          if (i < candidateIds.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        } catch (err) {
          console.error(`[pipeline] [${runId}] Refine failed for candidate ${candidateId}:`, err);
          // Non-fatal: original candidate proceeds to evaluation unrefined
        }
      }

      // Add refined candidates to the pool for evaluation
      candidateIds.push(...refinedCandidateIds);

      sendEvent(runId, "stage-complete", {
        stage: "refine",
        message: `Refinement completed — ${refinedCandidateIds.length} refined candidates added (${candidateIds.length} total in pool)`,
        result: { refinedCandidateIds, totalCandidates: candidateIds.length }
      });
      endRefineTimer();

    } else {
      // Fast mode: skip critique & refine
      sendEvent(runId, "stage-skipped", {
        stage: "critique",
        message: "Critique skipped (fast mode)"
      });
      sendEvent(runId, "stage-skipped", {
        stage: "refine",
        message: "Refine skipped (fast mode)"
      });
    }

    // ============================================
    // Stage 4: 8-Dimensional Weighted Evaluation (Pipeline v2)
    // Uses cross-model evaluator (different from generation model).
    // ============================================
    const endEvalTimer = stageTimer("evaluation");
    const evalModel = getStageModel(mode, "evaluation");

    sendEvent(runId, "stage-start", {
      stage: "metrics",
      message: `Evaluating ${candidateIds.length} candidates across 8 dimensions...`,
      timestamp: new Date().toISOString()
    });

    // Build dimension descriptions from EVALUATION_WEIGHTS for the prompt
    const dimensionDescriptions = Object.entries(EVALUATION_WEIGHTS)
      .map(([dim, w]) => {
        const desc = {
          completeness: "Covers all spec requirements",
          clarity:      "Clear and unambiguous language",
          specificity:  "Concrete and detailed, not generic",
          structure:    "Well-organized, good hierarchy",
          coherence:    "Logical flow, internally consistent",
          creativity:   "Novel framing, smart approaches",
          safety:       "Safe from misuse, handles edge cases",
          efficiency:   "Concise, no redundancy",
        }[dim] || dim;
        return `- ${dim} (weight ${w}): ${desc}`;
      })
      .join("\n");

    const evalSystem = `You are an expert Prompt Evaluator. Score each dimension 0.0–1.0 with honest, differentiated scores.

DIMENSIONS (with weights):
${dimensionDescriptions}

RULES:
1. Compare the candidate prompt AGAINST the specification — not against some imaginary ideal.
2. Be ruthlessly honest. Avoid "everything is 0.85" syndrome.
3. If a dimension is clearly weak, score it below 0.5.
4. If a dimension is genuinely excellent, score it above 0.9.

OUTPUT (JSON only):
{"completeness":0.0,"clarity":0.0,"specificity":0.0,"structure":0.0,"coherence":0.0,"creativity":0.0,"safety":0.0,"efficiency":0.0}`;

    let evalFailures = 0;
    const evaluationPromises = candidateIds.map(async (candidateId, i) => {
      try {
        checkTimeout();

        sendEvent(runId, "stage-progress", {
          stage: "metrics",
          step: `scoring-${candidateId}`,
          message: `Evaluating candidate ${i + 1}/${candidateIds.length}...`,
          details: { candidateId, progress: `${i + 1}/${candidateIds.length}` }
        });

        const candidate = db.prepare("SELECT * FROM candidate_prompts WHERE id = ?").get(candidateId);

        const { data: evalData, usage: evalUsage } = await chatJson({
          system: evalSystem,
          user: `Evaluate this candidate prompt against the specification.\n\n---CANDIDATE---\n${candidate.content}\n---END---\n\n---SPECIFICATION---\n${specContext}\n---END---`,
          model: evalModel.model,
          provider: evalModel.provider,
          temperature: evalModel.temperature ?? 0,
        });

        if (evalUsage) {
          totalInputTokens += evalUsage.prompt_tokens || 0;
          totalOutputTokens += evalUsage.completion_tokens || 0;
        }
        pipelineMetrics.calls_total.evaluation++;

        // Compute weighted composite score using the centralized function
        const composite = computeCompositeScore(evalData);

        const metricsJson = JSON.stringify({
          ...evalData,
          compositeScore: composite,
          weights: EVALUATION_WEIGHTS,
        });

        db.prepare(`
          UPDATE candidate_prompts
          SET metrics_json = ?
          WHERE id = ?
        `).run(metricsJson, candidateId);

        sendEvent(runId, "stage-progress", {
          stage: "metrics",
          step: `scored-${candidateId}`,
          message: `Candidate ${i + 1} scored`,
          details: { candidateId, compositeScore: composite.toFixed(3), metrics: evalData }
        });
      } catch (err) {
        evalFailures++;
        console.error(`[pipeline] [${runId}] Failed to evaluate candidate ${candidateId}:`, err);
        sendEvent(runId, "stage-progress", {
          stage: "metrics",
          step: `eval-failed-${candidateId}`,
          message: `Evaluation failed for candidate ${i + 1} — will use fallback score`,
          details: { candidateId, error: err.message }
        });
      }
    });

    await Promise.all(evaluationPromises);

    if (evalFailures > 0 && evalFailures < candidateIds.length) {
      sendEvent(runId, "stage-warning", {
        stage: "metrics",
        message: `${evalFailures}/${candidateIds.length} evaluations failed — proceeding with available scores`,
      });
    } else if (evalFailures === candidateIds.length) {
      console.warn(`[pipeline] [${runId}] ALL evaluations failed — outcome will use fallback scoring`);
      sendEvent(runId, "stage-warning", {
        stage: "metrics",
        message: "All evaluations failed — using fallback scoring for outcome selection",
      });
    }

    sendEvent(runId, "stage-complete", {
      stage: "metrics",
      message: `Evaluation completed: ${candidateIds.length - evalFailures}/${candidateIds.length} scored successfully`,
      result: { candidateIds, count: candidateIds.length, failures: evalFailures }
    });
    endEvalTimer();

    // ============================================
    // Stage 4b: Pairwise Comparison (standard/premium only)
    // Head-to-head comparison of top-2 candidates for robust ranking.
    // ============================================
    let pairwiseResult = null;
    if (mode !== "fast" && candidateIds.length >= 2) {
      try {
        checkTimeout();

        // Pre-sort to find top-2 by composite score
        const preSorted = candidateIds
          .map(id => {
            const row = db.prepare("SELECT * FROM candidate_prompts WHERE id = ?").get(id);
            const m = row.metrics_json ? JSON.parse(row.metrics_json) : null;
            return { id: row.id, agent: row.agent, content: row.content, compositeScore: m?.compositeScore ?? 0 };
          })
          .sort((a, b) => b.compositeScore - a.compositeScore);

        const top2 = preSorted.slice(0, 2);

        sendEvent(runId, "stage-progress", {
          stage: "metrics",
          step: "pairwise-comparison",
          message: `Pairwise comparing top-2: ${top2[0].agent} vs ${top2[1].agent}...`,
        });

        console.log(`[pipeline] [${runId}] Pairwise: ${top2[0].agent} (${top2[0].compositeScore.toFixed(3)}) vs ${top2[1].agent} (${top2[1].compositeScore.toFixed(3)})`);

        const pairwiseSystem = `You are an expert Prompt Judge. Compare two candidate prompts against a specification and determine which is better overall.

RULES:
1. Consider ALL quality dimensions: completeness, clarity, specificity, structure, coherence, creativity, safety, efficiency.
2. Focus on which prompt would perform better in REAL usage, not which looks nicer.
3. If they are very close, you may declare a tie.

OUTPUT (JSON only):
{
  "winner": "A" | "B" | "tie",
  "reasoning": "string — 2-3 sentence explanation of why",
  "confidenceScore": 0.0-1.0
}`;

        const { data: pairData, usage: pairUsage } = await chatJson({
          system: pairwiseSystem,
          user: `Compare these two prompts against the specification.\n\n---CANDIDATE A (${top2[0].agent})---\n${top2[0].content}\n---END A---\n\n---CANDIDATE B (${top2[1].agent})---\n${top2[1].content}\n---END B---\n\n---SPECIFICATION---\n${specContext}\n---END---`,
          model: evalModel.model,
          provider: evalModel.provider,
          temperature: 0,
        });

        if (pairUsage) {
          totalInputTokens += pairUsage.prompt_tokens || 0;
          totalOutputTokens += pairUsage.completion_tokens || 0;
        }
        pipelineMetrics.calls_total.evaluation++;

        pairwiseResult = {
          candidateA: top2[0].id,
          candidateB: top2[1].id,
          winner: pairData?.winner || "tie",
          reasoning: pairData?.reasoning || "",
          confidenceScore: pairData?.confidenceScore ?? 0.5,
        };

        console.log(`[pipeline] [${runId}] Pairwise result: winner=${pairwiseResult.winner}, confidence=${pairwiseResult.confidenceScore}`);
        sendEvent(runId, "stage-progress", {
          stage: "metrics",
          step: "pairwise-result",
          message: `Pairwise winner: ${pairwiseResult.winner === "A" ? top2[0].agent : pairwiseResult.winner === "B" ? top2[1].agent : "tie"}`,
          details: pairwiseResult,
        });
      } catch (pairErr) {
        console.warn(`[pipeline] [${runId}] Pairwise comparison failed — falling back to composite scores: ${pairErr.message}`);
        // Non-fatal: composite scores are sufficient
      }
    }

    // ============================================
    // Stage 5: Outcome — Select best candidate (Pipeline v2)
    // ============================================
    const endOutcomeTimer = stageTimer("outcome");
    sendEvent(runId, "stage-start", {
      stage: "outcome",
      message: "Selecting best candidate...",
      timestamp: new Date().toISOString()
    });

    // Load all candidates with parsed metrics
    const candidates = candidateIds.map(id => {
      const row = db.prepare("SELECT * FROM candidate_prompts WHERE id = ?").get(id);
      return {
        ...row,
        metrics: row.metrics_json ? JSON.parse(row.metrics_json) : null
      };
    });

    // Sort by compositeScore, tie-break by completeness → clarity → safety (plan spec)
    const sortedCandidates = candidates
      .filter(c => c.metrics && typeof c.metrics.compositeScore === "number")
      .sort((a, b) => {
        const diff = b.metrics.compositeScore - a.metrics.compositeScore;
        if (Math.abs(diff) > 0.001) return diff;
        // Tie-breaker 1: completeness
        const compDiff = (b.metrics.completeness ?? 0) - (a.metrics.completeness ?? 0);
        if (Math.abs(compDiff) > 0.001) return compDiff;
        // Tie-breaker 2: clarity
        const clarDiff = (b.metrics.clarity ?? 0) - (a.metrics.clarity ?? 0);
        if (Math.abs(clarDiff) > 0.001) return clarDiff;
        // Tie-breaker 3: safety
        return (b.metrics.safety ?? 0) - (a.metrics.safety ?? 0);
      });

    // If pairwise comparison produced a clear winner and confidence is high,
    // promote that candidate to first position
    if (pairwiseResult && pairwiseResult.winner !== "tie" && pairwiseResult.confidenceScore >= 0.7) {
      const winnerId = pairwiseResult.winner === "A" ? pairwiseResult.candidateA : pairwiseResult.candidateB;
      const winnerIdx = sortedCandidates.findIndex(c => c.id === winnerId);
      if (winnerIdx > 0) {
        console.log(`[pipeline] [${runId}] Pairwise override: promoting ${sortedCandidates[winnerIdx].agent} from rank ${winnerIdx + 1} to #1`);
        const [winner] = sortedCandidates.splice(winnerIdx, 1);
        sortedCandidates.unshift(winner);
      }
    }

    // Prefer refined candidates; fallback to originals
    const bestCandidate = sortedCandidates[0] || (candidates.length > 0 ? {
      ...candidates[0],
      metrics: { compositeScore: 0.1 }
    } : null);

    if (!bestCandidate) {
      throw new Error("No candidates available for selection.");
    }

    if (mode === "fast") {
      bestCandidate.metrics = {
        ...bestCandidate.metrics,
        assumptions_used: true,
        confidence: "low"
      };
    }

    const outcomeId = `outcome_${nanoid(12)}`;

    // Build ranking summary for result_json
    const ranking = sortedCandidates.slice(0, 6).map((c, idx) => ({
      rank: idx + 1,
      id: c.id,
      agent: c.agent,
      compositeScore: c.metrics.compositeScore,
    }));

    db.prepare(`
      INSERT INTO outcome_runs (id, spec_id, task, n, model, status, best_candidate_id, result_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      outcomeId,
      specId,
      idea.substring(0, 500),
      candidateIds.length,
      "composite-sort-v2",
      "completed",
      bestCandidate.id,
      JSON.stringify({
        pipelineVersion: 2,
        selectionMethod: pairwiseResult ? "pairwise+composite" : "composite-sort",
        reasoning: `Selected ${bestCandidate.agent} (composite ${bestCandidate.metrics.compositeScore.toFixed(3)})${pairwiseResult ? ` | Pairwise: ${pairwiseResult.reasoning}` : ""}`,
        pairwise: pairwiseResult || null,
        ranking,
        bestCandidate: {
          id: bestCandidate.id,
          agent: bestCandidate.agent,
          source: bestCandidate.agent.includes("_refined") ? "refined" : "original",
          metrics: bestCandidate.metrics
        }
      }),
      now
    );

    sendEvent(runId, "stage-complete", {
      stage: "outcome",
      message: "Best candidate selected",
      result: {
        outcomeId,
        selectedCandidateId: bestCandidate.id,
        agent: bestCandidate.agent,
        source: bestCandidate.agent.includes("_refined") ? "refined" : "original",
        compositeScore: bestCandidate.metrics.compositeScore,
        content: bestCandidate.content
      }
    });
    endOutcomeTimer();

    // Query historical runs for this user to build history and contributions
    // Note: outcome_runs doesn't have user_id, so we JOIN through specs table
    const historicalRuns = db.prepare(`
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
      evalFailures,
      pairwise: pairwiseResult ? {
        winner: pairwiseResult.winner,
        confidence: pairwiseResult.confidenceScore,
      } : null,
      specBuilderDegraded,
      exemplars_found: exemplarsFound,
      critique_verdicts: candidateIds.map(cId => {
        const c = candidateStore.get(cId);
        return { agent: c?.agent, verdict: c?.critique?.verdict ?? null };
      }),
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
        specId,
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
      for (const c of sortedCandidates) {
        if (!c.metrics || typeof c.metrics.compositeScore !== "number") continue;
        const harvest = harvestExemplar({
          userId,
          specId,
          runId,
          candidateId: c.id,
          mode,
          promptText: c.content,
          taskDomain: normalizedSpec.domain || null,
          specSummary: normalizedSpec.userGoal?.substring(0, 200) || null,
          language: normalizedSpec.language || "en",
          metrics: c.metrics,
        });
        if (harvest.harvested) {
          console.log(`[pipeline] [${runId}] Exemplar harvested: ${harvest.id} (agent=${c.agent}, score=${c.metrics.compositeScore})`);
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
      message: errorMessage,
      error: err.toString(),
      isTimeout,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
    
    sendEvent(runId, "complete", { 
      success: false,
      error: errorMessage,
      isTimeout,
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
