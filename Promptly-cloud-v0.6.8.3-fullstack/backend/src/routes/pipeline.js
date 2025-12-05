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
import { chatText, chatJson, LlmDisabledError } from "../lib/openaiClient.js";

export const pipelineRouter = Router();

// Store active SSE connections by runId
const activeStreams = new Map();

// Helper to get user ID from request
function getUserId(req) {
  if (req.user && req.user.sub) return req.user.sub;
  return "demo-user";
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

  // Handle client disconnect
  req.on("close", () => {
    console.log(`[pipeline] Client disconnected from stream ${runId}`);
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
  const userId = getUserId(req);
  ensureUser(userId);

  const parsed = PipelineRunRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: parsed.error.flatten() });
  }

  const { idea, attachments = [], skipQuestions = false, model = null } = parsed.data;

  // Generate a unique runId for this pipeline execution
  const runId = `run_${nanoid(16)}`;

  // Immediately return runId and SSE endpoint
  res.json({
    ok: true,
    runId,
    streamUrl: `/api/pipeline/stream/${runId}`
  });

  // Execute pipeline asynchronously and send events
  executePipelineWithEvents(runId, userId, { idea, attachments, skipQuestions, model })
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
 */
async function executePipelineWithEvents(runId, userId, { idea, attachments, skipQuestions, model }) {
  const now = new Date().toISOString();
  let specId = null;
  let sessionId = null;
  let candidateIds = [];

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

    // Build system prompt for Spec Builder
    const specSystem = `You are a Spec Builder agent in Promptly's Best Prompt Pipeline.

CRITICAL REQUIREMENT: You MUST extract and structure information from the raw idea. NEVER return just the raw idea as userGoal or return empty/minimal fields.

MANDATORY REQUIREMENTS:
1. ALWAYS extract the core goal and rephrase it clearly and specifically
2. ALWAYS infer target audience even if not explicitly mentioned
3. ALWAYS identify constraints and requirements from context
4. ALWAYS determine tone, format, and domain based on the idea
5. NEVER return the raw idea unchanged - you MUST structure it

Your task is to analyze a raw user idea and extract/infer structured information to create a comprehensive specification.

OUTPUT FORMAT:
Return ONLY valid JSON matching this structure:
{
  "userGoal": "string - The main goal or objective (MUST be clear and specific, not just the raw idea)",
  "audience": "string | null - Target users/audience (infer from context if not mentioned)",
  "constraints": ["string"] - Array of constraints or requirements (identify from idea),
  "tone": "string | null - Desired tone (e.g., professional, casual, formal)",
  "format": "string | null - Output format requirements",
  "domain": "string | null - Domain/context (e.g., coding, writing, analysis)",
  "examples": ["string"] - Array of examples or references mentioned
}`;

    // Build attachment context
    const attachmentContext = attachments.length > 0
      ? `\n\n[ATTACHMENT_METADATA_START]\n${attachments.map(a => `- ${a.name} (${a.type}, ${a.size} bytes)`).join("\n")}\n[ATTACHMENT_METADATA_END]`
      : "";

    const specUserPrompt = `Raw Idea:
${idea}${attachmentContext}

IMPORTANT: You MUST extract and structure information from this raw idea. DO NOT simply return the raw idea as userGoal.`;

    sendEvent(runId, "stage-progress", {
      stage: "spec",
      step: "llm-call",
      message: "Calling LLM to generate structured spec...",
      details: { model: model || "default" }
    });

    const { data: specData } = await chatJson({
      system: specSystem,
      user: specUserPrompt
    });

    sendEvent(runId, "stage-progress", {
      stage: "spec",
      step: "saving",
      message: "Saving structured spec to database...",
      details: { fields: Object.keys(specData || {}) }
    });

    // Save spec to database
    specId = `spec_${nanoid(12)}`;
    db.prepare(`
      INSERT INTO specs (id, owner_id, raw_idea, spec_json, completeness_score, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      specId,
      userId,
      idea,
      JSON.stringify(specData),
      0,
      now,
      now
    );

    sendEvent(runId, "stage-complete", {
      stage: "spec",
      message: "Spec Builder completed successfully",
      result: { specId, ...specData }
    });

    // ============================================
    // Stage 2: Question Engine (if not skipped)
    // ============================================
    if (!skipQuestions) {
      sendEvent(runId, "stage-start", {
        stage: "question",
        message: "Starting Question Engine...",
        timestamp: new Date().toISOString()
      });

      // For simplicity, generate 1-3 questions
      const questionSystem = `You are a clarifying question engine in Promptly's Best Prompt Pipeline.
Your role is to ask high-leverage clarifying questions to remove ambiguity.

REQUIREMENTS:
1. Ask ONE high-leverage clarifying question at a time
2. Maximum of 3 steps (Q1, Q2, Q3)
3. Stop early if incremental value is low (shouldStop = true)

Return ONLY valid JSON:
{
  "question": "string",
  "shouldStop": false,
  "estimatedCompleteness": 0.8
}`;

      sendEvent(runId, "stage-progress", {
        stage: "question",
        step: "analyzing",
        message: "Analyzing spec for gaps...",
        details: { specId }
      });

      // For demo, we'll generate one question
      const { data: qData } = await chatJson({
        system: questionSystem,
        user: `Given this spec, generate the first clarifying question:\n${JSON.stringify(specData, null, 2)}`
      });

      if (qData && !qData.shouldStop) {
        sessionId = `session_${nanoid(12)}`;
        
        sendEvent(runId, "stage-progress", {
          stage: "question",
          step: "question-generated",
          message: "Question generated",
          details: { question: qData.question, step: 1 }
        });

        // In a real implementation, this would loop Q1-Q3
        // For now, we'll mark as complete after first question
        sendEvent(runId, "stage-complete", {
          stage: "question",
          message: "Question Engine completed",
          result: { sessionId, question: qData.question, step: 1 }
        });

        // Update completeness score
        const completenessScore = qData.estimatedCompleteness || 0.8;
        db.prepare("UPDATE specs SET completeness_score = ? WHERE id = ?")
          .run(completenessScore, specId);
      } else {
        sendEvent(runId, "stage-complete", {
          stage: "question",
          message: "Question Engine skipped (spec is complete enough)",
          result: { skipped: true }
        });
      }
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

    const agents = [
      {
        name: "architect",
        systemPrompt: `You are the Architect agent in Promptly's Best Prompt Pipeline.
CRITICAL REQUIREMENT: You MUST generate a complete, well-structured prompt based on the specification. NEVER return the specification text itself or a simple paraphrase.
Your role is to design the structure and logical flow of prompts.
Return ONLY the enhanced prompt text.`
      },
      {
        name: "editor",
        systemPrompt: `You are the Editor agent in Promptly's Best Prompt Pipeline.
CRITICAL REQUIREMENT: You MUST polish and enhance the language. NEVER return the input unchanged.
Your role is to polish language, improve readability, and enhance clarity while preserving all original intent.
Return ONLY the enhanced prompt text.`
      },
      {
        name: "judge",
        systemPrompt: `You are the Judge agent in Promptly's Best Prompt Pipeline.
CRITICAL REQUIREMENT: You MUST add safety constraints and guardrails. NEVER return the input unchanged.
Your role is to add safety constraints, guardrails, edge case handling, and risk mitigation.
Return ONLY the enhanced prompt text.`
      }
    ];

    const baseContext = `Specification:
${JSON.stringify(specData, null, 2)}`;

    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      
      sendEvent(runId, "stage-progress", {
        stage: "agents",
        step: `generating-${agent.name}`,
        message: `Generating candidate with ${agent.name} agent...`,
        details: { agent: agent.name, progress: `${i + 1}/${agents.length}` }
      });

      const { text: content } = await chatText({
        system: agent.systemPrompt,
        user: `Given this specification, generate an optimized prompt:\n\n${baseContext}`
      });

      const candidateId = `candidate_${nanoid(12)}`;
      candidateIds.push(candidateId);

      db.prepare(`
        INSERT INTO candidate_prompts (id, spec_id, session_id, agent, model, content, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        candidateId,
        specId,
        sessionId,
        agent.name,
        model || "gpt-4o-mini",
        content,
        now
      );

      sendEvent(runId, "stage-progress", {
        stage: "agents",
        step: `completed-${agent.name}`,
        message: `${agent.name} agent completed`,
        details: { candidateId, agent: agent.name, contentLength: content.length }
      });
    }

    sendEvent(runId, "stage-complete", {
      stage: "agents",
      message: `Generated ${candidateIds.length} candidate prompts`,
      result: { candidateIds, count: candidateIds.length }
    });

    // ============================================
    // Stage 4: Metrics & Scoring
    // ============================================
    sendEvent(runId, "stage-start", {
      stage: "metrics",
      message: "Starting Metrics & Scoring...",
      timestamp: new Date().toISOString()
    });

    for (let i = 0; i < candidateIds.length; i++) {
      const candidateId = candidateIds[i];
      
      sendEvent(runId, "stage-progress", {
        stage: "metrics",
        step: `scoring-${candidateId}`,
        message: `Scoring candidate ${i + 1}/${candidateIds.length}...`,
        details: { candidateId, progress: `${i + 1}/${candidateIds.length}` }
      });

      const candidate = db.prepare("SELECT * FROM candidate_prompts WHERE id = ?").get(candidateId);
      
      const metricsSystem = `You are a Metrics Evaluator in Promptly's Best Prompt Pipeline.
Evaluate a candidate prompt and provide scores across multiple dimensions.

Return ONLY valid JSON:
{
  "clarity": 0.85,
  "coherence": 0.90,
  "styleMatch": 0.80,
  "safety": 0.95,
  "risk": 0.10
}`;

      const { data: metricsData } = await chatJson({
        system: metricsSystem,
        user: `Evaluate this candidate prompt:\n\n${candidate.content}\n\nSpec:\n${JSON.stringify(specData, null, 2)}`
      });

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
    }

    sendEvent(runId, "stage-complete", {
      stage: "metrics",
      message: `Scored ${candidateIds.length} candidates`,
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

    const bestCandidate = sortedCandidates[0];
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
      model || "gpt-4o-mini",
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

    // Final completion event
    sendEvent(runId, "complete", {
      success: true,
      specId,
      outcomeId,
      bestCandidate: {
        id: bestCandidate.id,
        content: bestCandidate.content,
        agent: bestCandidate.agent,
        metrics: bestCandidate.metrics
      }
    });

  } catch (err) {
    console.error(`[pipeline] Error in pipeline execution:`, err);
    sendEvent(runId, "error", {
      stage: "pipeline",
      message: err.message || "Pipeline execution failed",
      error: err.toString()
    });
    sendEvent(runId, "complete", { success: false });
  }
}

