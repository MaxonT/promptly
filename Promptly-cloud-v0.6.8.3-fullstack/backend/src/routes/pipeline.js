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
  console.log(`[pipeline] POST /run received`);
  const userId = getUserId(req);
  ensureUser(userId);

  const parsed = PipelineRunRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    console.error(`[pipeline] Validation failed:`, parsed.error.flatten());
    return res.status(400).json({ ok: false, error: parsed.error.flatten() });
  }

  const { idea, attachments = [], skipQuestions = false, model = null } = parsed.data;
  console.log(`[pipeline] Starting pipeline - idea length: ${idea.length}, skipQuestions: ${skipQuestions}, model: ${model || 'default'}`);

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
 * With timeout protection (default: 5 minutes)
 */
async function executePipelineWithEvents(runId, userId, { idea, attachments, skipQuestions, model }) {
  const PIPELINE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  const startTime = Date.now();
  
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
      details: { model: model || "default", ideaLength: idea.length }
    });

    checkTimeout(); // Check timeout before LLM call
    console.log(`[pipeline] [${runId}] Stage 1: Calling Spec Builder LLM...`);
    const { data: rawSpecData } = await chatJson({
      system: specSystem,
      user: specUserPrompt
    });
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
    if (!skipQuestions) {
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
        const { data: qData } = await chatJson({
          system: questionSystem,
          user: `Generate Q${currentStep} for:\n${qaContext}`
        });
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

    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      
      checkTimeout(); // Check timeout before each agent
      
      sendEvent(runId, "stage-progress", {
        stage: "agents",
        step: `generating-${agent.name}`,
        message: `Generating candidate with ${agent.name} agent...`,
        details: { agent: agent.name, progress: `${i + 1}/${agents.length}` }
      });

      console.log(`[pipeline] [${runId}] Stage 3: Generating candidate with ${agent.name} agent...`);
      // Enable similarity check with retry (lowered threshold for better change detection)
      const { text: content, similarity } = await chatText({
        system: agent.systemPrompt,
        user: `Generate optimized prompt. The output MUST be substantially different from the spec. Transform and enhance it:\n\n${baseContext}`,
        minSimilarity: 0.75,  // Retry if similarity >= 0.75 (lowered from 0.85)
        maxRetries: 2  // Increased from 1 to 2 retries
      });
      
      // Log similarity for debugging
      console.log(`[pipeline] [${runId}] Stage 3: ${agent.name} completed - similarity: ${similarity.toFixed(3)}, length: ${content.length}`);
      if (similarity > 0.7) {
        console.warn(`[pipeline] [${runId}] ⚠️ ${agent.name} output similarity is high: ${similarity.toFixed(3)}`);
      }

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
      
      checkTimeout(); // Check timeout before each scoring
      
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
    
    // Final completion event with historical data
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
      }
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
  }
}

