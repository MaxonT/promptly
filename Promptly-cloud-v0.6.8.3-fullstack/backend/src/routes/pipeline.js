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
import { getModePolicy } from "../lib/modePolicies.js";
import { spendTokensForRun, getTokenStatus } from "../lib/tokenUsage.js";
import { FEATURES } from "../lib/subscriptionConfig.js";

export const pipelineRouter = Router();

// Store active SSE connections by runId
const activeStreams = new Map();

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

// Helper to get user ID from request
function getUserId(req) {
  if (req.user && req.user.sub) return req.user.sub;
  return "demo-user";
}

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

pipelineRouter.post("/run", async (req, res) => {
  console.log(`[pipeline] POST /run received`);
  const userId = getUserId(req);
  ensureUser(userId);

  const parsed = PipelineRunRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    console.error(`[pipeline] Validation failed:`, parsed.error.flatten());
    return res.status(400).json({ ok: false, error: parsed.error.flatten() });
  }

  const { idea, attachments = [], skipQuestions = false, model: modeInput = null } = parsed.data;
  console.log(`[pipeline] Starting pipeline - idea length: ${idea.length}, skipQuestions: ${skipQuestions}, mode: ${modeInput || 'default (fast)'}`);

  // Generate a unique runId for this pipeline execution
  const runId = `run_${nanoid(16)}`;
  console.log(`[pipeline] Generated runId: ${runId}`);

  // Immediately return runId and SSE endpoint
  res.json({
    ok: true,
    runId,
    streamUrl: `/api/pipeline/stream/${runId}`
  });

  // Execute pipeline asynchronously and send events
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
  const policy = getModePolicy(mode);
  console.log(`[pipeline] [${runId}] Executing with policy: ${policy.name} (${policy.id})`);
  console.log(`[pipeline] [${runId}] Policy Details: Spec=${policy.specBuilder.model}, QEngine=${policy.questionEngine.enabled}, Gen=${policy.generation.model}`);
  
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

  try {
    // ============================================
    // Stage 1: Spec Builder
    // ============================================
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

    // Enhanced: Strong system prompt to ensure transformation
    const specSystem = `Extract structured spec from raw idea.

CRITICAL REQUIREMENTS:
1. userGoal MUST be rephrased and expanded, NEVER copied verbatim
2. Infer missing details: audience, constraints, tone, format, domain, examples
3. Transform vague ideas into concrete, actionable specifications
4. If input is very specific, expand it with additional context

OUTPUT FORMAT:
JSON only: {"userGoal": "rephrased and expanded", "audience": "string|null", "constraints": ["string"], "tone": "string|null", "format": "string|null", "domain": "string|null", "examples": ["string"]}

REQUIREMENT: userGoal must differ substantially from input. If too similar, append "> needs more change".`;

    // Build attachment context
    const attachmentContext = attachments.length > 0
      ? `\n\n[ATTACHMENT_METADATA_START]\n${attachments.map(a => `- ${a.name} (${a.type}, ${a.size} bytes)`).join("\n")}\n[ATTACHMENT_METADATA_END]`
      : "";

    // Concise user prompt - key instruction right before content
    const specUserPrompt = `Extract structured spec. userGoal MUST be rephrased:

${idea}${attachmentContext}`;

    sendEvent(runId, "stage-progress", {
      stage: "spec",
      step: "llm-call",
      message: "Calling LLM to generate structured spec...",
      details: { model: policy.specBuilder.model, provider: policy.specBuilder.provider, ideaLength: idea.length }
    });

    checkTimeout(); // Check timeout before LLM call
    console.log(`[pipeline] [${runId}] Stage 1: Calling Spec Builder LLM (${policy.specBuilder.provider}/${policy.specBuilder.model})...`);
    const { data: rawSpecData, usage: specUsage } = await chatJson({
      system: specSystem,
      user: specUserPrompt,
      model: policy.specBuilder.model,
      provider: policy.specBuilder.provider
    });
    
    // Track token usage for spec builder
    if (specUsage) {
      totalInputTokens += specUsage.prompt_tokens || 0;
      totalOutputTokens += specUsage.completion_tokens || 0;
    }
    
    const specData = rawSpecData || {};
    console.log(`[pipeline] [${runId}] Stage 1: Spec Builder completed, extracted ${Object.keys(specData).length} fields`);

    sendEvent(runId, "stage-progress", {
      stage: "spec",
      step: "saving",
      message: "Saving structured spec to database...",
      details: { fields: Object.keys(specData || {}) }
    });

    const normalizedSpec = {
      userGoal: (specData.userGoal || idea).trim(),
      audience: specData.audience || null,
      constraints: Array.isArray(specData.constraints) ? specData.constraints.filter(Boolean) : [],
      tone: specData.tone || null,
      format: specData.format || null,
      domain: specData.domain || null,
      examples: Array.isArray(specData.examples) ? specData.examples.filter(Boolean) : []
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

    // ============================================
    // Stage 2: Question Engine (Q1-Q3 Loop)
    // ============================================
    // Check policy enablement AND user skip preference
    const shouldRunQuestions = !skipQuestions && policy.questionEngine.enabled;
    
    if (shouldRunQuestions) {
      sendEvent(runId, "stage-start", {
        stage: "question",
        message: "Starting Question Engine (Q1-Q3)...",
        timestamp: new Date().toISOString()
      });

      // Enhanced: Question engine prompt with stronger requirements
      const questionSystem = `You are a Question Engine. Ask ONE high-value clarifying question to improve spec completeness.

REQUIREMENTS:
- Ask a specific, actionable question (not generic)
- Focus on missing critical information
- Stop if spec is already complete enough (estimatedCompleteness >= 0.9)
- Maximum 3 questions (Q1-Q3)

OUTPUT FORMAT (JSON only):
{"question": "specific clarifying question", "shouldStop": false, "estimatedCompleteness": 0.8, "missingFields": ["field1", "field2"]}

CRITICAL: Question must be specific and valuable. If too generic, append "> needs more change".`;

      sessionId = `session_${nanoid(12)}`;
      const questionsAsked = [];
      const answers = [];
      let currentStep = 0;
      let shouldStop = false;
      let finalCompletenessScore = 0.0;

      // Q1-Q3 Loop: Ask up to 3 questions sequentially
      while (currentStep < 3 && !shouldStop) {
        checkTimeout(); // Check timeout before each question
        
        currentStep++;
        sendEvent(runId, "stage-progress", {
          stage: "question",
          step: `q${currentStep}-analyzing`,
          message: `Analyzing spec for Q${currentStep}...`,
          details: { specId, step: currentStep, previousQuestions: questionsAsked.length }
        });

        // Build context with previous Q&A
        let qaContext = `Specification:\n${JSON.stringify(specData, null, 2)}`;
        if (questionsAsked.length > 0) {
          qaContext += "\n\nPrevious Questions & Answers:";
          for (let i = 0; i < questionsAsked.length; i++) {
            qaContext += `\nQ${i + 1}: ${questionsAsked[i]}`;
            if (answers[i]) {
              qaContext += `\nA${i + 1}: ${answers[i]}`;
            }
          }
        }

        // Generate next question
        console.log(`[pipeline] [${runId}] Stage 2: Generating Q${currentStep}...`);
        const { data: qData, usage: qUsage } = await chatJson({
          system: questionSystem,
          user: `Generate Q${currentStep} for:\n${qaContext}`,
          model: policy.questionEngine.model,
          provider: policy.questionEngine.provider
        });
        
        // Track token usage for question engine
        if (qUsage) {
          totalInputTokens += qUsage.prompt_tokens || 0;
          totalOutputTokens += qUsage.completion_tokens || 0;
        }
        
        console.log(`[pipeline] [${runId}] Stage 2: Q${currentStep} generated, shouldStop: ${qData?.shouldStop || false}`);

        if (!qData || qData.shouldStop) {
          shouldStop = true;
          finalCompletenessScore = qData?.estimatedCompleteness || Math.min(0.9, 0.5 + currentStep * 0.15);
          sendEvent(runId, "stage-progress", {
            stage: "question",
            step: `q${currentStep}-stopped`,
            message: `Q${currentStep} stopped early (spec complete enough)`,
            details: { step: currentStep, completenessScore: finalCompletenessScore }
          });
          break;
        }

        const question = qData.question || "";
        const missingFields = Array.isArray(qData.missingFields) ? qData.missingFields : [];
        questionsAsked.push(question);
        // For pipeline mode, we simulate answers (in real wizard, user would answer)
        // Here we'll use empty answers and let the spec proceed
        answers.push(""); // Empty answer for pipeline mode

        sendEvent(runId, "stage-progress", {
          stage: "question",
          step: `q${currentStep}-generated`,
          message: `Q${currentStep} generated`,
          details: { 
            question, 
            step: currentStep, 
            missingFields,
            estimatedCompleteness: qData.estimatedCompleteness || 0.0
          }
        });

        // Update completeness score after each question
        finalCompletenessScore = qData.estimatedCompleteness || Math.min(0.95, 0.5 + currentStep * 0.15);
        db.prepare("UPDATE specs SET completeness_score = ? WHERE id = ?")
          .run(finalCompletenessScore, specId);

        // Small delay between questions
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Save question session to database
      const sessionDescription = normalizedSpec.userGoal || idea;
      const sessionNow = new Date().toISOString();
      db.prepare(`
        INSERT INTO question_sessions (id, owner_id, spec_id, initial_description, step, is_complete, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        sessionId,
        userId,
        specId,
        sessionDescription,
        currentStep,
        shouldStop ? 1 : 0,
        "completed",
        sessionNow,
        sessionNow
      );

      sendEvent(runId, "stage-complete", {
        stage: "question",
        message: `Question Engine completed (${currentStep} questions asked)`,
        result: { 
          sessionId, 
          questionsAsked, 
          step: currentStep, 
          completenessScore: finalCompletenessScore,
          stoppedEarly: shouldStop
        }
      });
    } else {
      sendEvent(runId, "stage-skipped", {
        stage: "question",
        message: "Question Engine skipped by user request"
      });
    }

    // ============================================
    // Stage 3: LLM Agents - Candidate Generation
    // ============================================
    sendEvent(runId, "stage-start", {
      stage: "agents",
      message: "Starting Multi-Agent Candidate Generation...",
      timestamp: new Date().toISOString()
    });

      // Enhanced: Strong agent prompts to ensure transformation
      const agents = [
        {
          name: "architect",
          systemPrompt: `You are an Architect agent. Transform the specification into a complete, structured prompt.

REQUIREMENTS:
- Add clear sections with headings (##)
- Include variables/placeholders for dynamic content
- Structure instructions step-by-step
- Add explicit formatting rules
- Output MUST be substantially different from the input spec

CRITICAL: If output mirrors input, append "> needs more change" to signal insufficient transformation.`
        },
        {
          name: "editor",
          systemPrompt: `You are an Editor agent. Polish and enhance the prompt language.

REQUIREMENTS:
- Improve sentence structure and flow
- Enhance clarity and precision
- Refine word choices for impact
- Optimize readability
- Output MUST be substantially improved from input

CRITICAL: If output is too similar to input, append "> needs more change" to signal insufficient enhancement.`
        },
        {
          name: "judge",
          systemPrompt: `You are a Judge agent. Add safety, robustness, and edge case handling.

REQUIREMENTS:
- Add explicit safety constraints
- Include guardrails for misuse
- Handle edge cases and error scenarios
- Add validation rules
- Output MUST include substantial safety enhancements

CRITICAL: If output lacks safety improvements, append "> needs more change" to signal insufficient additions.`
        }
      ];

    const baseContext = `Specification:
${JSON.stringify(specData, null, 2)}`;

    // Serial execution to guarantee stability
    console.log(`[pipeline] [${runId}] Stage 3: Generating candidates with ${agents.length} agents sequentially...`);
    const failures = [];

    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      try {
        checkTimeout();

        sendEvent(runId, "stage-progress", {
          stage: "agents",
          step: `generating-${agent.name}`,
          message: `Generating candidate with ${agent.name} agent...`,
          details: { agent: agent.name, progress: `${i + 1}/${agents.length}` }
        });

        console.log(`[pipeline] [${runId}] Stage 3: Generating candidate with ${agent.name} agent...`);
        // Enable similarity check with retry (lowered threshold for better change detection)
        const { text: contentRaw, similarity, usage: agentUsage } = await chatText({
          system: agent.systemPrompt,
          user: `Generate optimized prompt. The output MUST be substantially different from the spec. Transform and enhance it:\n\n${baseContext}`,
          model: policy.generation.model, // Pass the policy model
          provider: policy.generation.provider, // Pass the policy provider
          minSimilarity: 0.75,
          maxRetries: 2
        });
        
        // Track token usage for agent generation
        if (agentUsage) {
          totalInputTokens += agentUsage.prompt_tokens || 0;
          totalOutputTokens += agentUsage.completion_tokens || 0;
        }

        const content = stripThinkBlocks(contentRaw);

        // Log similarity for debugging
        console.log(`[pipeline] [${runId}] Stage 3: ${agent.name} completed - similarity: ${similarity.toFixed(3)}, length: ${content.length}`);
        if (similarity > 0.7) {
          console.warn(`[pipeline] [${runId}] ⚠️ ${agent.name} output similarity is high: ${similarity.toFixed(3)}`);
        }

        const candidateId = `candidate_${nanoid(12)}`;

        db.prepare(`
          INSERT INTO candidate_prompts (id, spec_id, session_id, agent, model, content, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          candidateId,
          specId,
          sessionId,
          agent.name,
          policy.generation.model, // Log correct model from policy
          content,
          now
        );

        sendEvent(runId, "stage-progress", {
          stage: "agents",
          step: `completed-${agent.name}`,
          message: `${agent.name} agent completed`,
          details: { candidateId, agent: agent.name, contentLength: content.length }
        });

        candidateIds.push(candidateId);
        
        // Small delay between agents to ensure system stability
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (err) {
        console.error(`[pipeline] [${runId}] Agent ${agent.name} failed:`, err);
        failures.push({ agent: agent.name, error: err.message });
        // Continue to next agent even if one fails
      }
    }

    if (candidateIds.length === 0) {
      throw new Error(`All ${agents.length} agents failed to generate candidates. Check logs for details.`);
    }

    sendEvent(runId, "stage-complete", {
      stage: "agents",
      message: `Generated ${candidateIds.length} candidate prompts (${failures.length} failed)`,
      result: { candidateIds, count: candidateIds.length, failures: failures.length }
    });

    // ============================================
    // Stage 4: Metrics & Scoring
    // ============================================
    sendEvent(runId, "stage-start", {
      stage: "metrics",
      message: "Starting Metrics & Scoring in parallel...",
      timestamp: new Date().toISOString()
    });

    const scoringPromises = candidateIds.map(async (candidateId, i) => {
      try {
        checkTimeout();
        
        sendEvent(runId, "stage-progress", {
          stage: "metrics",
          step: `scoring-${candidateId}`,
          message: `Scoring candidate ${i + 1}/${candidateIds.length}...`,
          details: { candidateId, progress: `${i + 1}/${candidateIds.length}` }
        });

        const candidate = db.prepare("SELECT * FROM candidate_prompts WHERE id = ?").get(candidateId);
        
        // Enhanced: Metrics evaluator prompt with detailed criteria
        const metricsSystem = `Evaluate the candidate prompt and provide scores (0-1 scale).

SCORING CRITERIA:
- clarity: How clear and understandable is the prompt? (0-1)
- coherence: How well does it flow and make logical sense? (0-1)
- styleMatch: How well does it match the specified style/tone? (0-1)
- safety: How safe is it from misuse/abuse? (0-1, higher = safer)
- risk: What is the risk level? (0-1, higher = more risky)

OUTPUT FORMAT (JSON only):
{"clarity": 0.85, "coherence": 0.90, "styleMatch": 0.80, "safety": 0.95, "risk": 0.10}

Provide honest, objective scores based on the criteria.`;

        const { data: metricsData, usage: metricsUsage } = await chatJson({
          system: metricsSystem,
          user: `Evaluate this candidate prompt:\n\n${candidate.content}\n\nSpec:\n${JSON.stringify(specData, null, 2)}`,
          model: policy.scoring.model,
          provider: policy.scoring.provider,
          temperature: policy.scoring.temperature
        });
        
        // Track token usage for metrics evaluation
        if (metricsUsage) {
          totalInputTokens += metricsUsage.prompt_tokens || 0;
          totalOutputTokens += metricsUsage.completion_tokens || 0;
        }

        // Estimate token cost (simplified)
        const tokenCost = Math.ceil(candidate.content.length / 4);
        const normalizedToken = Math.min(1, 1000 / tokenCost);
        
        const compositeScore = (
          metricsData.clarity +
          metricsData.coherence +
          metricsData.styleMatch +
          metricsData.safety +
          (1 - metricsData.risk) +
          normalizedToken
        ) / 6;

        const metricsJson = JSON.stringify({
          ...metricsData,
          tokenCost,
          compositeScore
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
          details: { candidateId, compositeScore: compositeScore.toFixed(3), metrics: metricsData }
        });
      } catch (err) {
        console.error(`[pipeline] [${runId}] Failed to score candidate ${candidateId}:`, err);
        // Don't throw, just let this candidate be unscored (will be filtered out in selection)
      }
    });

    await Promise.all(scoringPromises);

    sendEvent(runId, "stage-complete", {
      stage: "metrics",
      message: `Scoring completed`,
      result: { candidateIds, count: candidateIds.length }
    });

    // ============================================
    // Stage 5: Outcome Runner
    // ============================================
    sendEvent(runId, "stage-start", {
      stage: "outcome",
      message: "Starting Outcome Runner...",
      timestamp: new Date().toISOString()
    });

    sendEvent(runId, "stage-progress", {
      stage: "outcome",
      step: "selecting",
      message: "Selecting best candidate...",
      details: { candidateCount: candidateIds.length }
    });

    // Load all candidates with metrics
    const candidates = candidateIds.map(id => {
      const row = db.prepare("SELECT * FROM candidate_prompts WHERE id = ?").get(id);
      return {
        ...row,
        metrics: row.metrics_json ? JSON.parse(row.metrics_json) : null
      };
    });

    // Select best candidate by composite score
    const sortedCandidates = candidates
      .filter(c => c.metrics)
      .sort((a, b) => {
        const scoreA = a.metrics.compositeScore;
        const scoreB = b.metrics.compositeScore;
        if (Math.abs(scoreA - scoreB) < 0.001) {
          // Tie-breaker: prefer higher safety, lower token cost
          if (a.metrics.safety !== b.metrics.safety) {
            return b.metrics.safety - a.metrics.safety;
          }
          return a.metrics.tokenCost - b.metrics.tokenCost;
        }
        return scoreB - scoreA;
      });

    const bestCandidate = sortedCandidates[0] || (candidates.length > 0 ? {
      ...candidates[0],
      metrics: {
        compositeScore: 0.1, // Low score to indicate fallback
        clarity: 0.5,
        coherence: 0.5,
        styleMatch: 0.5,
        safety: 0.5,
        risk: 0.5,
        tokenCost: 0
      }
    } : null);

    if (!bestCandidate) {
      throw new Error("No candidates available for selection (all agents failed or no output generated).");
    }

    // Optional: Add Fast Mode specific flags
    if (mode === 'fast') {
      bestCandidate.metrics = {
        ...bestCandidate.metrics,
        assumptions_used: true,
        confidence: "low"
      };
    }

    const outcomeId = `outcome_${nanoid(12)}`;

    // Store outcome in outcome_runs table (matching actual schema)
    db.prepare(`
      INSERT INTO outcome_runs (id, spec_id, task, n, model, status, best_candidate_id, result_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      outcomeId,
      specId,
      idea.substring(0, 500), // Use first 500 chars of idea as task
      candidateIds.length,
      policy.outcomeRunner.model || "sorting-only", // No LLM call, only sorting by composite score
      "completed",
      bestCandidate.id,
      JSON.stringify({
        reasoning: `Selected ${bestCandidate.agent} candidate with compositeScore = ${bestCandidate.metrics.compositeScore.toFixed(3)}`,
        bestCandidate: {
          id: bestCandidate.id,
          agent: bestCandidate.agent,
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
        compositeScore: bestCandidate.metrics.compositeScore,
        content: bestCandidate.content
      }
    });

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

  } catch (err) {
    console.error(`[pipeline] ❌ Error in pipeline execution for ${runId}:`, err);
    console.error(`[pipeline] Error stack:`, err.stack);
    const errorMessage = err.message || "Pipeline execution failed";
    const isTimeout = errorMessage.includes("timeout");
    
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

