/**
 * Best Prompt Pipeline - Prompts Routes
 * 
 * This module implements the Best Prompt Pipeline endpoints:
 * - POST /api/prompts/generate-candidates - Multi-Agent Candidate Generation
 * - POST /api/prompts/score - Metrics & Scoring
 * - POST /api/prompts/select-best - Outcome Runner (Best-of-N Selection)
 * 
 * Pipeline Flow:
 * Spec Builder → Question Engine → LLM Agents → Metrics & Scoring → Outcome Runner
 */

import { Router } from "express";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db, ensureUser } from "../lib/db.js";
import { chatText, chatJson, LlmDisabledError } from "../lib/openaiClient.js";
import { getModelConfig, resolveModelName, isValidModel } from "../lib/modelRegistry.js";

export const promptsRouter = Router();

// Helper to get user ID from request
function getUserId(req) {
  if (req.user && req.user.sub) return req.user.sub;
  return "demo-user";
}

/**
 * POST /api/prompts/generate-candidates
 * 
 * Multi-Agent Candidate Generation
 * Generate multiple candidate prompts using different agents (architect, editor, judge)
 */
const GenerateCandidatesRequestSchema = z.object({
  specId: z.string().min(1, "specId is required"),
  sessionId: z.string().nullable().optional(),
  model: z.string().optional()
});

promptsRouter.post("/generate-candidates", async (req, res) => {
  const userId = getUserId(req);
  ensureUser(userId);

  const parsed = GenerateCandidatesRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: parsed.error.flatten() });
  }

  const { specId, sessionId = null, model = null } = parsed.data;

  try {
    console.log(`[promptly] 📝 /api/prompts/generate-candidates: Request received`);
    console.log(`[promptly] SpecId: ${specId}, SessionId: ${sessionId || 'none'}`);

    // Load spec
    const specRow = db.prepare("SELECT * FROM specs WHERE id = ?").get(specId);
    if (!specRow) {
      return res.status(404).json({ ok: false, error: "Spec not found" });
    }

    const spec = JSON.parse(specRow.spec_json);
    const resolvedModel = model && isValidModel(model) ? model : 'promptly-mini';
    const modelConfig = getModelConfig(resolvedModel);
    const usedModel = resolveModelName(resolvedModel);

    console.log(`[promptly] Using model: ${resolvedModel} -> ${usedModel}`);

    // Load Q&A history if sessionId provided
    let qaHistory = "";
    if (sessionId) {
      const questions = db
        .prepare("SELECT * FROM question_questions WHERE session_id = ? ORDER BY order_index ASC")
        .all(sessionId);
      const answers = db
        .prepare("SELECT * FROM question_answers WHERE session_id = ? ORDER BY created_at ASC")
        .all(sessionId);

      const answerMap = new Map();
      answers.forEach(a => {
        const qId = a.question_id;
        if (!answerMap.has(qId)) answerMap.set(qId, []);
        answerMap.get(qId).push(JSON.parse(a.answer_json));
      });

      if (questions.length > 0) {
        qaHistory = "\n\nQuestion & Answer History:\n";
        questions.forEach(q => {
          const answersForQ = answerMap.get(q.id) || [];
          qaHistory += `Q: ${q.content}\n`;
          if (answersForQ.length > 0) {
            qaHistory += `A: ${JSON.stringify(answersForQ)}\n\n`;
          }
        });
      }
    }

    // Build base context from spec
    const baseContext = `
Specification:
- Goal: ${spec.project_goal || spec.userGoal || 'Not specified'}
- Audience: ${spec.target_users || spec.audience || 'Not specified'}
- Constraints: ${Array.isArray(spec.constraints) ? spec.constraints.join(', ') : (spec.constraints || 'None')}
- Domain: ${spec.domain || 'Not specified'}
${qaHistory}
`;

    // Define agents and their system prompts
    const agents = [
      {
        name: "architect",
        systemPrompt: `You are the Architect agent in Promptly's Best Prompt Pipeline.

CRITICAL REQUIREMENT: You MUST generate a complete, well-structured prompt based on the specification. NEVER return the specification text itself or a simple paraphrase.

MANDATORY REQUIREMENTS:
1. ALWAYS create a full prompt with clear structure (sections, headings, instructions)
2. ALWAYS add explicit variables, placeholders, and output format specifications
3. ALWAYS organize the prompt with logical flow and step-by-step guidance
4. ALWAYS transform the spec into an actionable, executable prompt
5. NEVER return just the spec fields or a basic reformatting

Your role is to design the structure and logical flow of prompts.

FOCUS AREAS:
1. Clear structure with logical sections
2. Defined variables and placeholders
3. Explicit instructions and requirements
4. Organized flow that guides the LLM step-by-step
5. Structured output format specifications

OUTPUT:
Return ONLY the enhanced prompt text. Do not add explanations, comments, or meta-commentary.
Your output MUST be a complete, structured prompt that is significantly different from the input specification.`
      },
      {
        name: "editor",
        systemPrompt: `You are the Editor agent in Promptly's Best Prompt Pipeline.

CRITICAL REQUIREMENT: You MUST polish and enhance the language. NEVER return the input unchanged or with only minor word substitutions.

MANDATORY REQUIREMENTS:
1. ALWAYS improve sentence structure and word choice
2. ALWAYS enhance readability and flow
3. ALWAYS refine tone and style for professionalism
4. ALWAYS make meaningful language improvements
5. NEVER return the prompt unchanged - you MUST polish it

Your role is to polish language, improve readability, and enhance clarity while preserving all original intent.

FOCUS AREAS:
1. Clear, precise language
2. Professional tone and style
3. Improved readability and flow
4. Strong, actionable wording
5. Maintain all original requirements and semantics

OUTPUT:
Return ONLY the enhanced prompt text. Do not add explanations, comments, or meta-commentary.
Your output MUST be polished and improved compared to the input.`
      },
      {
        name: "judge",
        systemPrompt: `You are the Judge agent in Promptly's Best Prompt Pipeline.

CRITICAL REQUIREMENT: You MUST add safety constraints and guardrails. NEVER return the input unchanged - you MUST enhance it with safety measures.

MANDATORY REQUIREMENTS:
1. ALWAYS add explicit safety constraints and boundaries
2. ALWAYS include edge case handling instructions
3. ALWAYS add error prevention and risk mitigation guidance
4. ALWAYS enhance robustness and reliability
5. NEVER return the prompt unchanged - you MUST add safety features

Your role is to add safety constraints, guardrails, edge case handling, and risk mitigation.

FOCUS AREAS:
1. Safety constraints and boundaries
2. Edge case handling
3. Error prevention
4. Risk mitigation
5. Robustness and reliability

OUTPUT:
Return ONLY the enhanced prompt text. Do not add explanations, comments, or meta-commentary.
Your output MUST include safety enhancements that were not in the input.`
      }
    ];

    const candidates = [];
    const now = new Date().toISOString();

    // Generate candidates using each agent
    for (const agent of agents) {
      try {
        console.log(`[promptly] 🚀 Generating candidate with ${agent.name} agent...`);

        const { text: content, completionId } = await chatText({
          system: agent.systemPrompt,
          user: `Given this specification, generate a complete, optimized prompt:

${baseContext}

IMPORTANT: You MUST generate a new, complete prompt based on this specification. DO NOT simply repeat the specification fields or create a basic reformatting. Transform the specification into a fully structured, actionable prompt that an LLM can execute directly.

Generate a complete, optimized prompt that addresses the specification above.`
        });

        const candidateId = `cand_${nanoid(12)}`;

        // Save candidate to database
        db.prepare(`
          INSERT INTO candidate_prompts 
          (id, spec_id, session_id, agent, model, content, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(candidateId, specId, sessionId, agent.name, usedModel, content, now);

        candidates.push({
          id: candidateId,
          agent: agent.name,
          content,
          completionId
        });

        console.log(`[promptly] ✅ Generated candidate ${candidateId} with ${agent.name} agent`);
      } catch (err) {
        console.error(`[promptly] ❌ Failed to generate candidate with ${agent.name} agent:`, err.message);
        // Continue with other agents even if one fails
      }
    }

    if (candidates.length === 0) {
      return res.status(500).json({
        ok: false,
        error: "Failed to generate any candidates"
      });
    }

    console.log(`[promptly] ✅ Generated ${candidates.length} candidates successfully`);

    res.json({
      ok: true,
      candidates: candidates.map(c => ({
        id: c.id,
        agent: c.agent,
        content: c.content
      }))
    });

  } catch (err) {
    console.error(`[promptly] ❌ /api/prompts/generate-candidates error:`, err.message || err);
    if (err instanceof LlmDisabledError) {
      return res.status(503).json({
        ok: false,
        error: "LLM disabled: OPENAI_API_KEY not set"
      });
    }
    return res.status(500).json({
      ok: false,
      error: "Failed to generate candidates"
    });
  }
});

/**
 * POST /api/prompts/score
 * 
 * Metrics & Scoring
 * Score each candidate using multiple metrics (clarity, coherence, styleMatch, safety, risk, tokenCost)
 */
const ScoreRequestSchema = z.object({
  candidateIds: z.array(z.string()).min(1, "At least one candidateId is required")
});

promptsRouter.post("/score", async (req, res) => {
  const userId = getUserId(req);
  ensureUser(userId);

  const parsed = ScoreRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: parsed.error.flatten() });
  }

  const { candidateIds } = parsed.data;

  try {
    console.log(`[promptly] 📝 /api/prompts/score: Request received`);
    console.log(`[promptly] Scoring ${candidateIds.length} candidates`);

    const metricsResults = [];

    for (const candidateId of candidateIds) {
      // Load candidate
      const candidateRow = db.prepare("SELECT * FROM candidate_prompts WHERE id = ?").get(candidateId);
      if (!candidateRow) {
        console.warn(`[promptly] ⚠️  Candidate ${candidateId} not found, skipping`);
        continue;
      }

      // Load spec for context
      const specRow = db.prepare("SELECT * FROM specs WHERE id = ?").get(candidateRow.spec_id);
      if (!specRow) {
        console.warn(`[promptly] ⚠️  Spec ${candidateRow.spec_id} not found, skipping`);
        continue;
      }

      const spec = JSON.parse(specRow.spec_json);

      console.log(`[promptly] 🚀 Scoring candidate ${candidateId} (agent: ${candidateRow.agent})...`);

      // Estimate token cost (rough estimation: ~4 chars per token)
      const estimatedTokens = Math.ceil(candidateRow.content.length / 4);
      const idealTokenCost = 512; // From metricsEngine defaults
      const normalizedToken = Math.min(1, idealTokenCost / estimatedTokens);

      // Use LLM to score the candidate
      const systemPrompt = `You are a Metrics Evaluator in Promptly's Best Prompt Pipeline.

Your task is to evaluate a candidate prompt and provide scores across multiple dimensions.

EVALUATION CRITERIA:
1. clarity (0-1): How clear and easy to understand is the prompt?
2. coherence (0-1): How well-organized and logically structured is the prompt?
3. styleMatch (0-1): How well does the style match the specification requirements?
4. safety (0-1): How safe and appropriate is the prompt? (higher = safer)
5. risk (0-1): What is the risk level? (higher = higher risk)

Return ONLY valid JSON in this format:
{
  "clarity": 0.85,
  "coherence": 0.90,
  "styleMatch": 0.80,
  "safety": 0.95,
  "risk": 0.10
}

All scores should be between 0 and 1.`;

      const userPrompt = `Specification:
- Goal: ${spec.project_goal || spec.userGoal || 'Not specified'}
- Audience: ${spec.target_users || spec.audience || 'Not specified'}
- Constraints: ${Array.isArray(spec.constraints) ? spec.constraints.join(', ') : (spec.constraints || 'None')}
- Domain: ${spec.domain || 'Not specified'}

Candidate Prompt (Agent: ${candidateRow.agent}):
${candidateRow.content}

Please evaluate this candidate prompt and return the scores as JSON.`;

      try {
        const { data: scores } = await chatJson({
          system: systemPrompt,
          user: userPrompt
        });

        const clarity = Math.max(0, Math.min(1, scores.clarity || 0.5));
        const coherence = Math.max(0, Math.min(1, scores.coherence || 0.5));
        const styleMatch = Math.max(0, Math.min(1, scores.styleMatch || 0.5));
        const safety = Math.max(0, Math.min(1, scores.safety || 0.5));
        const risk = Math.max(0, Math.min(1, scores.risk || 0.5));

        // Compute composite score
        const compositeScore = (
          clarity +
          coherence +
          styleMatch +
          safety +
          (1 - risk) +
          normalizedToken
        ) / 6;

        // Update candidate with metrics
        db.prepare(`
          UPDATE candidate_prompts
          SET clarity = ?, coherence = ?, style_match = ?, safety = ?, risk = ?, 
              token_cost = ?, composite_score = ?
          WHERE id = ?
        `).run(
          clarity, coherence, styleMatch, safety, risk,
          estimatedTokens, compositeScore,
          candidateId
        );

        metricsResults.push({
          candidateId,
          metrics: {
            clarity,
            coherence,
            styleMatch,
            safety,
            risk,
            tokenCost: estimatedTokens,
            compositeScore
          }
        });

        console.log(`[promptly] ✅ Scored candidate ${candidateId}, compositeScore: ${compositeScore.toFixed(3)}`);
      } catch (scoreErr) {
        console.error(`[promptly] ❌ Failed to score candidate ${candidateId}:`, scoreErr.message);
        // Continue with other candidates
      }
    }

    res.json({
      ok: true,
      metrics: metricsResults
    });

  } catch (err) {
    console.error(`[promptly] ❌ /api/prompts/score error:`, err.message || err);
    if (err instanceof LlmDisabledError) {
      return res.status(503).json({
        ok: false,
        error: "LLM disabled: OPENAI_API_KEY not set"
      });
    }
    return res.status(500).json({
      ok: false,
      error: "Failed to score candidates"
    });
  }
});

/**
 * POST /api/prompts/select-best
 * 
 * Outcome Runner - Best-of-N Selection
 * Select the best candidate based on composite scores and apply Outcome-First rules
 */
const SelectBestRequestSchema = z.object({
  specId: z.string().min(1, "specId is required")
});

promptsRouter.post("/select-best", async (req, res) => {
  const userId = getUserId(req);
  ensureUser(userId);

  const parsed = SelectBestRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: parsed.error.flatten() });
  }

  const { specId } = parsed.data;

  try {
    console.log(`[promptly] 📝 /api/prompts/select-best: Request received`);
    console.log(`[promptly] SpecId: ${specId}`);

    // Load all candidates for this spec with metrics
    const candidates = db.prepare(`
      SELECT * FROM candidate_prompts
      WHERE spec_id = ? AND composite_score IS NOT NULL
      ORDER BY composite_score DESC
    `).all(specId);

    if (candidates.length === 0) {
      // No candidates with metrics yet, return error suggesting to score first
      return res.status(400).json({
        ok: false,
        error: "No candidates found with scores. Please call /api/prompts/score first."
      });
    }

    console.log(`[promptly] Found ${candidates.length} candidates with scores`);

    // Select best candidate (already sorted by composite_score DESC)
    let best = candidates[0];

    // In case of tie, prefer higher safety and lower token cost
    if (candidates.length > 1) {
      const topScore = best.composite_score;
      const tiedCandidates = candidates.filter(c => Math.abs(c.composite_score - topScore) < 0.001);

      if (tiedCandidates.length > 1) {
        // Sort by safety DESC, then token_cost ASC
        tiedCandidates.sort((a, b) => {
          if (Math.abs((a.safety || 0) - (b.safety || 0)) > 0.001) {
            return (b.safety || 0) - (a.safety || 0);
          }
          return (a.token_cost || 0) - (b.token_cost || 0);
        });
        best = tiedCandidates[0];
      }
    }

    console.log(`[promptly] ✅ Selected best candidate: ${best.id} (agent: ${best.agent}, score: ${best.composite_score})`);

    // Get runner-ups (all other candidates sorted by score)
    const runnerUps = candidates
      .filter(c => c.id !== best.id)
      .map(c => ({
        candidateId: c.id,
        compositeScore: c.composite_score,
        agent: c.agent
      }));

    // Create Outcome record (optional - could be stored in DB)
    const outcomeId = `outcome_${nanoid(12)}`;
    const reasoning = `Selected ${best.agent} candidate with highest compositeScore = ${best.composite_score.toFixed(3)}. ` +
      `Clarity: ${(best.clarity || 0).toFixed(2)}, Coherence: ${(best.coherence || 0).toFixed(2)}, ` +
      `Safety: ${(best.safety || 0).toFixed(2)}, Risk: ${(best.risk || 0).toFixed(2)}`;

    const result = {
      id: outcomeId,
      specId,
      selectedCandidateId: best.id,
      best: {
        id: best.id,
        content: best.content,
        agent: best.agent,
        metrics: {
          clarity: best.clarity,
          coherence: best.coherence,
          styleMatch: best.style_match,
          safety: best.safety,
          risk: best.risk,
          tokenCost: best.token_cost,
          compositeScore: best.composite_score
        }
      },
      runnerUps,
      reasoning
    };

    res.json({
      ok: true,
      outcome: result
    });

  } catch (err) {
    console.error(`[promptly] ❌ /api/prompts/select-best error:`, err.message || err);
    return res.status(500).json({
      ok: false,
      error: "Failed to select best candidate"
    });
  }
});


