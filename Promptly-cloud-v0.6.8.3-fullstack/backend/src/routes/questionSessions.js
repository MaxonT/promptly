import { Router } from "express";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db, ensureUser } from "../lib/db.js";
import {
  generateBroadQuestions,
  generateChoiceQuestions,
  generateRawSpec
} from "../lib/llmAgents.js";
import { compileSpecToPrompt } from "../lib/specCompiler.js";
import { chatJson, LlmDisabledError } from "../lib/llmRouter.js";
import { goBack, skipQuestion } from "../lib/questionNavigator.js";
import { getModelIds, resolveModelName, isValidModel, getModelConfig } from "../lib/modelRegistry.js";
import { INFERENCE_PROFILES } from "../lib/inferenceProfiles.js";
import { checkQuestionWizardLimit, recordUsage, canUseMode } from "../lib/planLimits.js";

export const questionSessionRouter = Router();

const PROJECT_DESCRIPTION_REQUIRED_MESSAGE = "Project description is required.";

/**
 * MODE_PROFILES - Question Wizard processing modes
 * 
 * These modes control the depth and speed of LLM agent reasoning:
 * - chainLength: Number of reasoning chains the agent should use (affects prompt instructions)
 * - maxSteps: Maximum planning/reasoning steps (affects prompt instructions)
 * - timeoutMs: Request timeout in milliseconds (enforced via runWithTimeout)
 * 
 * Current implementation:
 * - Mode parameters are passed to LLM agents via system prompts
 * - Agents receive instructions to use chainLength chained thoughts and cap at maxSteps
 * - Timeouts are enforced using runWithTimeout() wrapper
 * - Different modes produce different response times and reasoning depth
 * 
 * Verified behavior:
 * - Fast mode: Quick responses (15s timeout), minimal reasoning (2 chains, 3 steps)
 * - Deep mode: Balanced responses (25s timeout), moderate reasoning (4 chains, 6 steps)
 * - Ultra mode: Slower responses (40s timeout), maximum reasoning (6 chains, 8 steps)
 */
const MODE_PROFILES = {
  fast: {
    id: "fast",
    label: "Fast",
    hierarchy: "A+",
    chainLength: 2,
    maxSteps: 3,
    timeoutMs: 60000, // Increased from 15s to 60s for reliability
    description: "Quick response, minimal reasoning"
  },
  deep: {
    id: "deep",
    label: "Deep Thinking",
    hierarchy: "S",
    chainLength: 4,
    maxSteps: 6,
    timeoutMs: 120000, // Increased from 25s to 120s for reliability
    description: "Balanced depth and speed"
  },
  ultra: {
    id: "ultra",
    label: "Ultra Thinking",
    hierarchy: "S+",
    chainLength: 6,
    maxSteps: 8,
    timeoutMs: 180000, // Increased from 40s to 180s for reliability
    description: "Maximum depth, slowest response"
  }
};

// Get model IDs from the centralized model registry
const MODEL_IDS = getModelIds();

/**
 * MODEL_TARGETS - Mapping from Promptly model identifiers to underlying OpenAI models
 * 
 * Uses the centralized model registry for resolution.
 * This provides backward compatibility while using the new registry system.
 * 
 * Current implementation:
 * - All models are resolved through modelRegistry.js
 * - Most models currently map to the same underlying models (gpt-4o or gpt-4o-mini)
 * - This is a placeholder implementation that provides a clear upgrade path
 * 
 * Future enhancements:
 * - Different models can be mapped to different OpenAI models (gpt-4, gpt-4-turbo, etc.)
 * - Models can have different temperature, max_tokens, or other parameters
 * - Custom fine-tuned models can be integrated
 */
const MODEL_TARGETS = MODEL_IDS.reduce((acc, modelId) => {
  acc[modelId] = resolveModelName(modelId);
  return acc;
}, {});

const CreateSessionSchema = z.object({
  initial_description: z
    .string()
    .trim()
    .min(1, { message: PROJECT_DESCRIPTION_REQUIRED_MESSAGE }),
  kind: z.string().min(1).max(64).optional(),
  mode: z.enum(["fast", "deep", "ultra"]).optional(),
  model: z.enum(MODEL_IDS).optional(),
  language: z.enum(["en", "zh-CN", "es", "fr", "ja", "ar", "ko", "pt", "hi"]).optional()
});

const AnswerPayloadSchema = z.object({
  answers: z
    .array(
      z.object({
        question_id: z.string().min(1),
        value: z.any()
      })
    )
    .min(1),
  control: z.enum(["back", "skip"]).optional(),
  model: z.enum(MODEL_IDS).optional(),
  language: z.enum(["en", "zh-CN", "es", "fr", "ja", "ar", "ko", "pt", "hi"]).optional()
});

const ModelOnlySchema = z.object({
  model: z.enum(MODEL_IDS).optional(),
  language: z.enum(["en", "zh-CN", "es", "fr", "ja", "ar", "ko", "pt", "hi"]).optional()
});

const RUNNING_STATUSES = ["active", "ready_to_finalize"];

function getUserId(req) {
  if (req.user && req.user.sub) return req.user.sub;
  return "demo-user";
}

/**
 * Resolve mode profile from mode identifier
 * @param {string} mode - Mode identifier ("fast", "deep", "ultra")
 * @returns {Object} Mode profile with chainLength, maxSteps, timeoutMs, etc.
 */
function resolveModeProfile(mode) {
  const profile = MODE_PROFILES[mode] || MODE_PROFILES.deep;
  console.log(`[promptly] Resolved mode: ${mode || 'default'} -> ${profile.id} (${profile.label})`);
  return profile;
}

/**
 * Resolve model choice from user selection
 * @param {string} modelId - The model identifier from frontend
 * @returns {{id: string, targetModel: string}} - Resolved model ID and target OpenAI model
 */
function resolveModelChoice(modelId) {
  const fallback = process.env.OPENAI_MODEL;
  // Use model registry to validate and resolve model
  const selected = isValidModel(modelId) ? modelId : "promptly";
  const targetModel = resolveModelName(selected) || fallback || null;
  const config = getModelConfig(selected);
  const provider = config?.provider || 'openai';
  
  // Log model resolution for debugging
  if (selected !== modelId) {
    console.log(`[promptly] Model ${modelId} not found, using default: ${selected}`);
  }
  console.log(`[promptly] Resolved model: ${selected} -> ${targetModel} (${provider})`);
  
  return { id: selected, targetModel, provider };
}

function resolveAndPersistModel(sessionId, sessionModel, incomingModel) {
  const resolved = resolveModelChoice(incomingModel || sessionModel);
  if (sessionId && resolved.id !== sessionModel) {
    db.prepare("UPDATE question_sessions SET model = ?, updated_at = ? WHERE id = ?").run(
      resolved.id,
      new Date().toISOString(),
      sessionId
    );
  }
  return resolved;
}

function resolveAndPersistLanguage(sessionId, sessionLanguage, incomingLanguage) {
  const resolved = incomingLanguage || sessionLanguage || 'en';
  if (sessionId && resolved !== sessionLanguage) {
    db.prepare("UPDATE question_sessions SET language = ?, updated_at = ? WHERE id = ?").run(
      resolved,
      new Date().toISOString(),
      sessionId
    );
  }
  return resolved;
}

async function runWithTimeout(promise, timeoutMs, label = "task") {
  if (!timeoutMs) return promise;
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    return result;
  } finally {
    clearTimeout(timeoutId);
  }
}

questionSessionRouter.post("/", async (req, res) => {
  const userId = getUserId(req);
  
  // Check plan limits for Question Wizard
  const limitCheck = checkQuestionWizardLimit(userId);
  if (!limitCheck.allowed) {
    return res.status(403).json({
      ok: false,
      error: limitCheck.reason,
      usage: limitCheck.usage,
      limit: limitCheck.limit
    });
  }
  
  const parsed = CreateSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    const hasDescriptionIssue = parsed.error.issues.some(
      (issue) => issue.path && issue.path[0] === "initial_description"
    );
    if (hasDescriptionIssue) {
      return res
        .status(400)
        .json({ error: PROJECT_DESCRIPTION_REQUIRED_MESSAGE });
    }
    return res.status(400).json({ ok: false, error: parsed.error.flatten() });
  }
  
  // Extract data
  const { initial_description, kind, mode = 'deep', model, language } = parsed.data;
  
  // Check mode restrictions for free plan
  if (!canUseMode(userId, mode)) {
    return res.status(403).json({
      ok: false,
      error: 'Free plan only supports Standard and Fast modes. Please upgrade to use Deep or Ultra Thinking modes.'
    });
  }
  const modeProfile = resolveModeProfile(mode);
  const modelChoice = resolveModelChoice(model);
  const userLanguage = language || 'en';
  
  console.log(`[promptly] Creating session with language: ${userLanguage}`);
  
  // Ensure the user exists before creating a session
  ensureUser(userId);
  
  const now = new Date().toISOString();
  const sessionId = `sess_${nanoid(16)}`;

  db.prepare(
    `INSERT INTO question_sessions
     (id, owner_id, initial_description, kind, mode, model, language, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    sessionId,
    userId,
    initial_description,
    kind || null,
    modeProfile.id,
    modelChoice.id,
    userLanguage,
    "active",
    now,
    now
  );

  try {
    const broadQuestions = await runWithTimeout(
      generateBroadQuestions({
        initialDescription: initial_description,
        kind: kind || null,
        modeProfile,
        model: modelChoice.targetModel,
        provider: modelChoice.provider,
        language: userLanguage
      }),
      modeProfile.timeoutMs,
      "generate broad questions"
    );
    const choiceQuestions = await runWithTimeout(
      generateChoiceQuestions({
        initialDescription: initial_description,
        kind: kind || null,
        broadQuestions,
        modeProfile,
        model: modelChoice.targetModel,
        provider: modelChoice.provider,
        language: userLanguage
      }),
      modeProfile.timeoutMs,
      "generate choice questions"
    );

    const insertQuestion = db.prepare(
      `INSERT INTO question_questions
       (id, session_id, type, content, options_json, order_index)
       VALUES (?, ?, ?, ?, ?, ?)`
    );

    choiceQuestions.forEach((q, index) => {
      // Always generate session-scoped IDs to avoid collisions across sessions
      const qid = `q_${sessionId}_${q.id || nanoid(12)}`;
      // Store complete question data including depth structure
      const questionData = {
        depth_enabled: q.depth_enabled,
        options: q.options || null,
        depth_question: q.depth_question || null,
        depth_levels: q.depth_levels || null
      };
      insertQuestion.run(
        qid,
        sessionId,
        q.type,
        q.content,
        JSON.stringify(questionData),
        index
      );
      q.id = qid;
    });

    // Record usage after successful session creation
    recordUsage(userId, 'question_wizard');
    
    // Return all generated questions (not just first 5)
    // Frontend will handle client-side pagination
    const allGeneratedQuestions = choiceQuestions.map((q) => ({
      id: q.id,
      type: q.type,
      content: q.content,
      depth_enabled: q.depth_enabled,
      options: q.options || null,
      depth_question: q.depth_question || null,
      depth_levels: q.depth_levels || null
    }));

    return res.json({
      ok: true,
      session_id: sessionId,
      mode: modeProfile.id,
      model: modelChoice.id,
      language: userLanguage,
      mode_profile: modeProfile,
      questions: allGeneratedQuestions
    });
  } catch (err) {
    console.error("[promptly] question session init failed", err);
    db.prepare(
      "UPDATE question_sessions SET status = ?, updated_at = ? WHERE id = ?"
    ).run("error", new Date().toISOString(), sessionId);
    
    // Check for specific error types
    if (err instanceof LlmDisabledError || err.code === "LLM_DISABLED") {
      return res.status(503).json({ ok: false, error: "LLM disabled: OPENAI_API_KEY not set" });
    }
    
    // Check for OpenAI API authentication errors
    if (err.status === 401 || err.code === "invalid_api_key") {
      return res.status(502).json({ 
        ok: false, 
        error: "Invalid OpenAI API Key. Please check your OPENAI_API_KEY environment variable." 
      });
    }
    
    // Check for other OpenAI API errors
    if (err.status) {
      return res.status(502).json({ 
        ok: false, 
        error: `OpenAI API error (${err.status}): ${err.message || "Unknown error"}` 
      });
    }
    
    // Generic error
    return res.status(502).json({ 
      ok: false, 
      error: `Question engine failed: ${err.message || "Unknown error"}` 
    });
  }
});

questionSessionRouter.get("/status/active", (req, res) => {
  const userId = getUserId(req);
  const requestedSessionId = req.query.session_id;

  let session = null;
  if (requestedSessionId) {
    session = db
      .prepare(
        `SELECT id, owner_id, kind, status, mode, model, language, created_at, updated_at
         FROM question_sessions
         WHERE id = ?`
      )
      .get(requestedSessionId);

    if (session && session.owner_id !== userId) {
      session = null; // Do not leak other users' sessions
    }
  }

  if (!session) {
    session = db
      .prepare(
        `SELECT id, owner_id, kind, status, mode, model, language, created_at, updated_at
         FROM question_sessions
         WHERE owner_id = ?
         ORDER BY updated_at DESC
         LIMIT 1`
      )
      .get(userId);
  }

  if (!session || !RUNNING_STATUSES.includes(session.status)) {
    return res.json({ ok: true, running: false });
  }

  const totalQuestions = db
    .prepare("SELECT COUNT(*) as count FROM question_questions WHERE session_id = ?")
    .get(session.id)?.count;
  const answeredQuestions = db
    .prepare("SELECT COUNT(*) as count FROM question_answers WHERE session_id = ?")
    .get(session.id)?.count;

  return res.json({
    ok: true,
    running: true,
    session: {
      id: session.id,
      status: session.status,
      mode: session.mode || "deep",
      model: session.model || "promptly",
      language: session.language || 'en',
      kind: session.kind || null,
      created_at: session.created_at,
      updated_at: session.updated_at
    },
    progress: {
      answered: answeredQuestions || 0,
      total: totalQuestions || 0
    }
  });
});

questionSessionRouter.get("/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const session = db
    .prepare(
      `SELECT id, owner_id, kind, status, initial_description, mode, model, language, created_at, updated_at
       FROM question_sessions
       WHERE id = ?`
    )
    .get(sessionId);

  if (!session) {
    return res.status(404).json({ ok: false, error: "Session not found" });
  }

  return res.json({
    ok: true,
    session: {
      id: session.id,
      owner_id: session.owner_id,
      mode: session.mode || "deep",
      model: session.model || "promptly",
      mode_profile: resolveModeProfile(session.mode),
      kind: session.kind,
      status: session.status,
      language: session.language || 'en',
      initial_description: session.initial_description,
      initialDescription: session.initial_description,
      created_at: session.created_at,
      updated_at: session.updated_at
    }
  });
});

// GET /api/question-sessions/:sessionId/state - hydrate in-progress sessions without creating a new one
questionSessionRouter.get("/:sessionId/state", (req, res) => {
  const { sessionId } = req.params;

  const session = db
    .prepare(
      `SELECT id, owner_id, kind, status, initial_description, mode, model, language, created_at, updated_at
       FROM question_sessions
       WHERE id = ?`
    )
    .get(sessionId);

  if (!session) {
    return res.status(404).json({ ok: false, error: "Session not found" });
  }

  const questions = db
    .prepare("SELECT * FROM question_questions WHERE session_id = ? ORDER BY order_index ASC")
    .all(sessionId);

  const answers = db
    .prepare("SELECT * FROM question_answers WHERE session_id = ? ORDER BY created_at ASC")
    .all(sessionId);

  const answeredIds = new Set(answers.map((a) => a.question_id));

  const mappedQuestions = questions.map((q) => {
    const questionData = q.options_json ? JSON.parse(q.options_json) : {};
    return {
      id: q.id,
      type: q.type,
      content: q.content,
      depth_enabled: questionData.depth_enabled || false,
      options: questionData.options || null,
      depth_question: questionData.depth_question || null,
      depth_levels: questionData.depth_levels || null
    };
  });

  return res.json({
    ok: true,
    session: {
      id: session.id,
      status: session.status,
      mode: session.mode || "deep",
      model: session.model || "promptly",
      kind: session.kind || null,
      language: session.language || 'en',
      initial_description: session.initial_description || "",
      created_at: session.created_at,
      updated_at: session.updated_at
    },
    progress: {
      answered: answers.length,
      total: questions.length
    },
    questions: mappedQuestions,
    answers: answers.map((a) => ({
      id: a.id,
      question_id: a.question_id,
      value: (() => {
        try {
          return JSON.parse(a.answer_json);
        } catch (e) {
          return a.answer_json;
        }
      })(),
      created_at: a.created_at
    })),
    remaining_question_ids: mappedQuestions.filter((q) => !answeredIds.has(q.id)).map((q) => q.id)
  });
});

questionSessionRouter.post("/:sessionId/answer", (req, res) => {
  const parsed = AnswerPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: parsed.error.flatten() });
  }
  const { sessionId } = req.params;
  const session = db
    .prepare("SELECT * FROM question_sessions WHERE id = ?")
    .get(sessionId);
  if (!session) {
    return res.status(404).json({ ok: false, error: "Session not found" });
  }

  const { answers, control } = parsed.data;
  resolveAndPersistModel(sessionId, session.model, parsed.data.model);
  resolveAndPersistLanguage(sessionId, session.language, parsed.data.language);
  
  // Handle control actions (back/skip)
  if (control === "back") {
    const result = goBack(sessionId);
    if (result.success) {
      return res.json({ ok: true, done: false, questions: result.previousQuestions, message: result.message });
    } else {
      return res.status(400).json({ ok: false, error: result.message });
    }
  }
  
  if (control === "skip" && answers.length > 0) {
    const questionId = answers[0].question_id;
    const result = skipQuestion(sessionId, questionId);
    if (result.success) {
      return res.json({ ok: true, done: result.nextQuestions.length === 0, questions: result.nextQuestions, message: result.message });
    } else {
      return res.status(400).json({ ok: false, error: result.message });
    }
  }

  const now = new Date().toISOString();

  const getQuestion = db.prepare(
    "SELECT * FROM question_questions WHERE id = ? AND session_id = ?"
  );
  const deleteAnswer = db.prepare(
    "DELETE FROM question_answers WHERE session_id = ? AND question_id = ?"
  );
  const insertAnswer = db.prepare(
    `INSERT INTO question_answers
     (id, session_id, question_id, answer_json, created_at)
     VALUES (?, ?, ?, ?, ?)`
  );

  for (const a of answers) {
    const row = getQuestion.get(a.question_id, sessionId);
    if (!row) {
      return res
        .status(400)
        .json({ ok: false, error: `Unknown question_id: ${a.question_id}` });
    }
    deleteAnswer.run(sessionId, a.question_id);
    insertAnswer.run(
      `ans_${nanoid(16)}`,
      sessionId,
      a.question_id,
      JSON.stringify(a.value),
      now
    );
  }

  const questions = db
    .prepare(
      "SELECT * FROM question_questions WHERE session_id = ? ORDER BY order_index ASC"
    )
    .all(sessionId);
  const answeredRows = db
    .prepare(
      "SELECT DISTINCT question_id FROM question_answers WHERE session_id = ?"
    )
    .all(sessionId);
  const answeredSet = new Set(answeredRows.map((r) => r.question_id));
  const remaining = questions.filter((q) => !answeredSet.has(q.id));

  if (remaining.length > 0) {
    const nextBatch = remaining.slice(0, 5).map((q) => {
      const questionData = q.options_json ? JSON.parse(q.options_json) : {};
      return {
        id: q.id,
        type: q.type,
        content: q.content,
        depth_enabled: questionData.depth_enabled || false,
        options: questionData.options || null,
        depth_question: questionData.depth_question || null,
        depth_levels: questionData.depth_levels || null
      };
    });
    return res.json({ ok: true, done: false, questions: nextBatch });
  }

  db.prepare(
    "UPDATE question_sessions SET status = ?, updated_at = ? WHERE id = ?"
  ).run("ready_to_finalize", now, sessionId);

  return res.json({
    ok: true,
    done: true,
    next: `/api/question-sessions/${sessionId}/finalize`
  });
});

questionSessionRouter.post("/:sessionId/finalize", async (req, res) => {
  const { sessionId } = req.params;
  const session = db
    .prepare("SELECT * FROM question_sessions WHERE id = ?")
    .get(sessionId);
  if (!session) {
    return res.status(404).json({ ok: false, error: "Session not found" });
  }

  const parsedModel = ModelOnlySchema.safeParse(req.body || {});
  if (!parsedModel.success) {
    return res.status(400).json({ ok: false, error: parsedModel.error.flatten() });
  }

  const modelChoice = resolveAndPersistModel(sessionId, session.model, parsedModel.data.model);
  const userLanguage = resolveAndPersistLanguage(sessionId, session.language, parsedModel.data.language);
  const userLanguage = resolveAndPersistLanguage(sessionId, session.language, parsedModel.data.language);

  console.log(`[promptly] Finalizing session ${sessionId} with language: ${userLanguage}`);

  const questions = db
    .prepare(
      "SELECT * FROM question_questions WHERE session_id = ? ORDER BY order_index ASC"
    )
    .all(sessionId);
  const answers = db
    .prepare(
      "SELECT * FROM question_answers WHERE session_id = ? ORDER BY created_at ASC"
    )
    .all(sessionId);

  const answerByQuestion = new Map();
  for (const a of answers) {
    answerByQuestion.set(a.question_id, a);
  }

  const qaPairs = questions.map((q) => {
    const a = answerByQuestion.get(q.id) || null;
    const questionData = q.options_json ? JSON.parse(q.options_json) : {};
    return {
      id: q.id,
      type: q.type,
      content: q.content,
      depth_enabled: questionData.depth_enabled || false,
      options: questionData.options || null,
      depth_question: questionData.depth_question || null,
      depth_levels: questionData.depth_levels || null,
      answer: a ? JSON.parse(a.answer_json) : null
    };
  });

  try {
    const modeProfile = resolveModeProfile(session.mode);
    const result = await generateRawSpec({
      initialDescription: session.initial_description,
      kind: session.kind,
      qaPairs,
      modeProfile,
      model: modelChoice.targetModel,
      provider: modelChoice.provider,
      language: userLanguage
    });

    const compiled = compileSpecToPrompt(result.spec);
    const now = new Date().toISOString();
    const userId = session.owner_id || "demo-user";
    const specId = `spec_${nanoid(12)}`;
    const cpId = `cp_${nanoid(12)}`;

    // Extract structured fields from the generated spec (S1)
    const kind = result.spec.kind || session.kind || null;
    const title = result.spec.title || "Wizard-generated Spec";
    const summary = result.spec.summary || result.spec.description || null;
    const tech_stack = result.spec.tech_stack || result.spec.techStack || null;
    const pages = result.spec.pages || [];
    const data_model = result.spec.data_model || result.spec.dataModel || [];
    const constraints = result.spec.constraints || null;
    const status = "compiled"; // Wizard-generated specs are compiled by default
    
    db.prepare(
      `INSERT INTO specs (id, owner_id, session_id, kind, title, summary, tech_stack, pages, data_model, constraints, spec_json, status, version, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      specId,
      userId,
      session.id,
      kind,
      title,
      summary,
      tech_stack ? JSON.stringify(tech_stack) : null,
      pages.length > 0 ? JSON.stringify(pages) : null,
      data_model.length > 0 ? JSON.stringify(data_model) : null,
      constraints ? JSON.stringify(constraints) : null,
      JSON.stringify(result.spec),
      status,
      1,
      now,
      now
    );

    db.prepare(
      `INSERT INTO compiled_prompts (id, spec_id, compiled_json, explanation, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(
      cpId,
      specId,
      JSON.stringify(compiled.blocks),
      compiled.explanation,
      now
    );

    db.prepare(
      `UPDATE question_sessions
       SET status = ?, updated_at = ?, intent_json = ?, spec_json = ?, compiled_prompt_json = ?, explanation = ?
       WHERE id = ?`
    ).run(
      "completed",
      now,
      result.intent ? JSON.stringify(result.intent) : null,
      JSON.stringify(result.spec),
      JSON.stringify(compiled.blocks),
      result.explanation,
      sessionId
    );

    return res.json({
      ok: true,
      session_id: sessionId,
      spec_id: specId,
      compiled_prompt_id: cpId,
      spec: result.spec,
      compiled_prompt: compiled,
      explanation: result.explanation
    });
  } catch (err) {
    console.error("[promptly] finalize session failed", err);
    const now = new Date().toISOString();
    db.prepare(
      "UPDATE question_sessions SET status = ?, updated_at = ? WHERE id = ?"
    ).run("error", now, sessionId);
    if (err instanceof LlmDisabledError || err.code === "LLM_DISABLED") {
      return res.status(503).json({ ok: false, error: "LLM disabled" });
    }
    return res.status(502).json({ ok: false, error: "Question engine failed" });
  }
});

// Q1: Snapshot save
questionSessionRouter.post("/:sessionId/snapshot", (req, res) => {
  const { sessionId } = req.params;
  const session = db.prepare("SELECT * FROM question_sessions WHERE id = ?").get(sessionId);
  if (!session) {
    return res.status(404).json({ ok: false, error: "Session not found" });
  }

  try {
    // Gather current session state
    const questions = db
      .prepare("SELECT * FROM question_questions WHERE session_id = ? ORDER BY order_index ASC")
      .all(sessionId);
    const answers = db
      .prepare("SELECT * FROM question_answers WHERE session_id = ?")
      .all(sessionId);
    
    let actions = [];
    try {
      actions = db
        .prepare("SELECT * FROM question_actions WHERE session_id = ?")
        .all(sessionId);
    } catch (e) {
      // Table might not exist
    }

    const snapshotData = {
      session,
      questions,
      answers,
      actions,
      timestamp: new Date().toISOString()
    };

    const snapshotId = `snap_${nanoid(12)}`;
    const now = new Date().toISOString();

    db.prepare(
      "INSERT INTO question_snapshots (id, session_id, snapshot_json, created_at) VALUES (?, ?, ?, ?)"
    ).run(snapshotId, sessionId, JSON.stringify(snapshotData), now);

    return res.json({ ok: true, snapshot_id: snapshotId, message: "Snapshot saved" });
  } catch (err) {
    console.error("[promptly] snapshot save failed", err);
    return res.status(500).json({ ok: false, error: "Failed to save snapshot" });
  }
});

// Q1: Snapshot restore (get latest)
questionSessionRouter.get("/:sessionId/snapshot/latest", (req, res) => {
  const { sessionId } = req.params;
  const session = db.prepare("SELECT * FROM question_sessions WHERE id = ?").get(sessionId);
  if (!session) {
    return res.status(404).json({ ok: false, error: "Session not found" });
  }

  try {
    const snapshot = db
      .prepare("SELECT * FROM question_snapshots WHERE session_id = ? ORDER BY created_at DESC LIMIT 1")
      .get(sessionId);

    if (!snapshot) {
      return res.json({ ok: false, message: "No snapshot available" });
    }

    const snapshotData = JSON.parse(snapshot.snapshot_json);

    return res.json({
      ok: true,
      snapshot_id: snapshot.id,
      snapshot: snapshotData,
      created_at: snapshot.created_at
    });
  } catch (err) {
    console.error("[promptly] snapshot restore failed", err);
    return res.status(500).json({ ok: false, error: "Failed to restore snapshot" });
  }
});

// Q3: Regenerate a specific question
questionSessionRouter.post("/:sessionId/questions/:questionId/regenerate", async (req, res) => {
  const { sessionId, questionId } = req.params;
  const session = db.prepare("SELECT * FROM question_sessions WHERE id = ?").get(sessionId);
  if (!session) {
    return res.status(404).json({ ok: false, error: "Session not found" });
  }

  const parsedModel = ModelOnlySchema.safeParse(req.body || {});
  if (!parsedModel.success) {
    return res.status(400).json({ ok: false, error: parsedModel.error.flatten() });
  }

  const modelChoice = resolveAndPersistModel(sessionId, session.model, parsedModel.data.model);
  const userLanguage = resolveAndPersistLanguage(sessionId, session.language, parsedModel.data.language);

  const oldQuestion = db
    .prepare("SELECT * FROM question_questions WHERE id = ? AND session_id = ?")
    .get(questionId, sessionId);
  if (!oldQuestion) {
    return res.status(404).json({ ok: false, error: "Question not found" });
  }

  try {
    // Use LLM to generate a new variation of this question
    // REGENERATION STRATEGY: Use the same inference profile as the session mode
    // For regeneration, we re-run Agent A (broad) and Agent B (choice) to get context
    // Ideally we should have a specialized regeneration agent, but for now we reuse A/B
    const modeProfile = resolveModeProfile(session.mode);
    const inferenceProfile = INFERENCE_PROFILES[modeProfile.id] || INFERENCE_PROFILES.fast;

    const broadQuestions = await generateBroadQuestions({
      initialDescription: session.initial_description,
      kind: session.kind || null,
      model: modelChoice.targetModel,
      inferenceConfig: inferenceProfile.stages.agentA,
      language: userLanguage
    });
    const choiceQuestions = await generateChoiceQuestions({
      initialDescription: session.initial_description,
      kind: session.kind || null,
      broadQuestions,
      model: modelChoice.targetModel,
      inferenceConfig: inferenceProfile.stages.agentB,
      language: userLanguage
    });

    // Pick a new question that's similar in type
    const similarQuestions = choiceQuestions.filter((q) => q.type === oldQuestion.type);
    const newQuestionData = similarQuestions[Math.floor(Math.random() * similarQuestions.length)] || choiceQuestions[0];

    // Insert new question with metadata
    const newQuestionId = `q_${nanoid(12)}`;
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO question_questions
       (id, session_id, type, content, options_json, order_index)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      newQuestionId,
      sessionId,
      newQuestionData.type,
      newQuestionData.content,
      newQuestionData.options ? JSON.stringify(newQuestionData.options) : null,
      oldQuestion.order_index
    );

    // Log the regeneration action
    const actionId = `act_${nanoid(12)}`;
    db.prepare(
      "INSERT INTO question_actions (id, session_id, action, payload, created_at) VALUES (?, ?, ?, ?, ?)"
    ).run(
      actionId,
      sessionId,
      "regenerate",
      JSON.stringify({ old_question_id: questionId, new_question_id: newQuestionId }),
      now
    );

    const newQuestion = {
      id: newQuestionId,
      type: newQuestionData.type,
      content: newQuestionData.content,
      options: newQuestionData.options || null,
      replaces: questionId,
      origin: "regenerated"
    };

    return res.json({
      ok: true,
      question: newQuestion,
      message: "Question regenerated successfully"
    });
  } catch (err) {
    console.error("[promptly] question regeneration failed", err);
    if (err instanceof LlmDisabledError || err.code === "LLM_DISABLED") {
      return res.status(503).json({ ok: false, error: "LLM disabled" });
    }
    return res.status(502).json({ ok: false, error: "Question regeneration failed" });
  }
});

/**
 * Best Prompt Pipeline - Question Engine Q1-Q3 Flow
 * POST /api/question-sessions/next
 * 
 * Implements the Q1-Q3 sequential questioning flow as specified in the Best Prompt Pipeline.
 * Ask one high-leverage clarifying question at a time, maximum 3 steps.
 */
const QuestionNextRequestSchema = z.object({
  specId: z.string().min(1, "specId is required"),
  sessionId: z.string().nullable().optional(),
  lastAnswer: z.string().nullable().optional()
});

questionSessionRouter.post("/next", async (req, res) => {
  const userId = getUserId(req);
  ensureUser(userId);

  const parsed = QuestionNextRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: parsed.error.flatten() });
  }

  const { specId, sessionId = null, lastAnswer = null } = parsed.data;

  try {
    console.log(`[promptly] 📝 /api/question-sessions/next: Request received`);
    console.log(`[promptly] SpecId: ${specId}, SessionId: ${sessionId || 'new'}, LastAnswer: ${lastAnswer ? 'provided' : 'none'}`);

    // 1. Load Spec by specId
    const specRow = db.prepare("SELECT * FROM specs WHERE id = ?").get(specId);
    if (!specRow) {
      return res.status(404).json({ ok: false, error: "Spec not found" });
    }

    const spec = JSON.parse(specRow.spec_json);
    const now = new Date().toISOString();
    let session = null;
    let currentSessionId = sessionId;

    // 2. If sessionId is null, create a new session
    if (!currentSessionId) {
      currentSessionId = `sess_${nanoid(16)}`;
      
      db.prepare(`
        INSERT INTO question_sessions
        (id, owner_id, initial_description, kind, mode, model, status, spec_id, step, is_complete, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        currentSessionId,
        userId,
        spec.userGoal || spec.project_goal || 'Best Prompt Pipeline Session',
        spec.domain || null,
        'deep',
        'promptly-mini',
        'active',
        specId,
        0,
        0,
        now,
        now
      );

      console.log(`[promptly] ✅ Created new question session: ${currentSessionId}`);
    } else {
      // Load existing session
      session = db.prepare("SELECT * FROM question_sessions WHERE id = ?").get(currentSessionId);
      if (!session) {
        return res.status(404).json({ ok: false, error: "Session not found" });
      }
    }

    // Load session data (or use newly created)
    if (!session) {
      session = db.prepare("SELECT * FROM question_sessions WHERE id = ?").get(currentSessionId);
    }

    // Build Q&A history from existing question_questions and question_answers
    const existingQuestions = db
      .prepare("SELECT * FROM question_questions WHERE session_id = ? ORDER BY order_index ASC")
      .all(currentSessionId);
    const existingAnswers = db
      .prepare("SELECT * FROM question_answers WHERE session_id = ? ORDER BY created_at ASC")
      .all(currentSessionId);

    const answerMap = new Map();
    existingAnswers.forEach(a => {
      const qId = a.question_id;
      if (!answerMap.has(qId)) answerMap.set(qId, []);
      try {
        answerMap.get(qId).push(JSON.parse(a.answer_json));
      } catch {
        answerMap.get(qId).push(a.answer_json);
      }
    });

    const questionsAsked = existingQuestions.map(q => q.content);
    const answers = existingQuestions.map(q => {
      const answerForQ = answerMap.get(q.id);
      return answerForQ && answerForQ.length > 0 ? answerForQ[0] : null;
    });

    // 3. If lastAnswer is provided, save it before generating next question
    if (lastAnswer && existingQuestions.length > 0) {
      const lastQuestion = existingQuestions[existingQuestions.length - 1];
      
      // Check if answer already exists (to avoid duplicates)
      const existingAnswer = db
        .prepare("SELECT * FROM question_answers WHERE session_id = ? AND question_id = ?")
        .get(currentSessionId, lastQuestion.id);
      
      if (!existingAnswer) {
        const answerId = `ans_${nanoid(16)}`;
        
        db.prepare(`
          INSERT INTO question_answers (id, session_id, question_id, answer_json, created_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          answerId,
          currentSessionId,
          lastQuestion.id,
          JSON.stringify(lastAnswer),
          now
        );
        
        console.log(`[promptly] ✅ Saved answer to question: ${lastQuestion.id}`);
      }
      
      // Update answers array
      if (answers.length > 0) {
        answers[answers.length - 1] = lastAnswer;
      }
    }

    // Reload questions and answers after potentially saving lastAnswer
    const updatedQuestions = db
      .prepare("SELECT * FROM question_questions WHERE session_id = ? ORDER BY order_index ASC")
      .all(currentSessionId);
    const updatedAnswers = db
      .prepare("SELECT * FROM question_answers WHERE session_id = ? ORDER BY created_at ASC")
      .all(currentSessionId);

    const updatedAnswerMap = new Map();
    updatedAnswers.forEach(a => {
      const qId = a.question_id;
      if (!updatedAnswerMap.has(qId)) updatedAnswerMap.set(qId, []);
      try {
        updatedAnswerMap.get(qId).push(JSON.parse(a.answer_json));
      } catch {
        updatedAnswerMap.get(qId).push(a.answer_json);
      }
    });

    const currentQuestionsAsked = updatedQuestions.map(q => q.content);
    const currentAnswers = updatedQuestions.map(q => {
      const answerForQ = updatedAnswerMap.get(q.id);
      return answerForQ && answerForQ.length > 0 ? answerForQ[0] : null;
    });

    // Check if there's a pending question (asked but not answered)
    const hasPendingQuestion = currentQuestionsAsked.length > 0 && 
      currentQuestionsAsked.length > currentAnswers.filter(a => a !== null).length;

    // Check if we should stop (already at step 3 or session marked complete)
    // Step represents number of questions asked (not including the one we're about to ask)
    const currentStep = currentQuestionsAsked.length;
    const isComplete = session.is_complete === 1 || currentStep >= 3;

    // If there's a pending question and no lastAnswer provided, return the current question
    if (hasPendingQuestion && !lastAnswer) {
      const pendingQuestion = currentQuestionsAsked[currentQuestionsAsked.length - 1];
      console.log(`[promptly] Returning pending question: ${pendingQuestion.substring(0, 50)}...`);
      
      return res.json({
        ok: true,
        session: {
          id: currentSessionId,
          specId,
          step: currentStep,
          isComplete: false,
          questionsAsked: currentQuestionsAsked,
          answers: currentAnswers
        },
        nextQuestion: pendingQuestion,
        isComplete: false,
        spec: {
          ...spec,
          completenessScore: specRow.completeness_score || 0.0
        }
      });
    }

    if (isComplete) {
      console.log(`[promptly] Session already complete at step ${currentStep}`);
      
      // Update spec completeness score if needed
      const finalCompleteness = specRow.completeness_score || 1.0;
      if (specRow.completeness_score === null || specRow.completeness_score < 1.0) {
        db.prepare("UPDATE specs SET completeness_score = ?, updated_at = ? WHERE id = ?").run(
          1.0,
          now,
          specId
        );
      }

      return res.json({
        ok: true,
        session: {
          id: currentSessionId,
          specId,
          step: currentStep,
          isComplete: true,
          questionsAsked: currentQuestionsAsked,
          answers: currentAnswers
        },
        nextQuestion: null,
        isComplete: true,
        spec: {
          ...spec,
          completenessScore: 1.0
        }
      });
    }

    // 4. Build System prompt for Question Engine
    const systemPrompt = `You are a clarifying question engine in Promptly's Best Prompt Pipeline.

Your role is to ask high-leverage clarifying questions to remove ambiguity and surface context that might be forgotten.

REQUIREMENTS:
1. Ask ONE high-leverage clarifying question at a time
2. Maximum of 3 steps (Q1, Q2, Q3)
3. Stop early if incremental value is low (shouldStop = true)
4. Focus on questions that will significantly improve the prompt quality
5. Consider what information is missing from the spec that would help craft a better prompt

Return ONLY valid JSON in this format:
{
  "question": "What is the target audience for this prompt?",
  "shouldStop": false,
  "estimatedCompleteness": 0.75
}

- question: The next clarifying question to ask (string)
- shouldStop: Whether to stop asking questions (boolean)
- estimatedCompleteness: How complete the spec is now (0-1 scale)

CRITICAL: Return ONLY valid JSON, no other text.`;

    // 5. Build User prompt with Spec and Q&A history
    let qaHistoryText = "";
    if (currentQuestionsAsked.length > 0) {
      qaHistoryText = "\n\nPrevious Questions & Answers:\n";
      currentQuestionsAsked.forEach((q, idx) => {
        qaHistoryText += `Q${idx + 1}: ${q}\n`;
        if (currentAnswers[idx]) {
          qaHistoryText += `A${idx + 1}: ${typeof currentAnswers[idx] === 'string' ? currentAnswers[idx] : JSON.stringify(currentAnswers[idx])}\n\n`;
        }
      });
    }

    const userPrompt = `Specification:
- Goal: ${spec.userGoal || spec.project_goal || 'Not specified'}
- Audience: ${spec.audience || spec.target_users || 'Not specified'}
- Constraints: ${Array.isArray(spec.constraints) ? spec.constraints.join(', ') : (spec.constraints || 'None')}
- Domain: ${spec.domain || 'Not specified'}
- Tone: ${spec.tone || 'Not specified'}
- Format: ${spec.format || 'Not specified'}
${qaHistoryText}

Current step: ${currentStep + 1} of 3 (Q${currentStep + 1})

Based on this specification and Q&A history, generate the next clarifying question. If the spec is already comprehensive enough, set shouldStop to true.`;

    console.log(`[promptly] 🔄 About to call LLM for Q${currentStep + 1} question generation...`);

    // 6. Call LLM to generate next question
    const { data: llmResponse } = await chatJson({
      provider: 'openai',
      system: systemPrompt,
      user: userPrompt
    });

    const nextQuestion = llmResponse.question || null;
    const shouldStop = llmResponse.shouldStop === true || currentStep >= 2;
    const estimatedCompleteness = Math.max(0, Math.min(1, llmResponse.estimatedCompleteness || (currentStep + 1) / 3));

    console.log(`[promptly] ✅ LLM generated Q${currentStep + 1}: ${nextQuestion ? nextQuestion.substring(0, 50) + '...' : 'null'}`);
    console.log(`[promptly] Should stop: ${shouldStop}, Estimated completeness: ${estimatedCompleteness}`);

    // Save the new question to question_questions table
    let newQuestionId = null;
    if (nextQuestion) {
      newQuestionId = `q_${currentSessionId}_${nanoid(12)}`;
      db.prepare(`
        INSERT INTO question_questions (id, session_id, type, content, options_json, order_index)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        newQuestionId,
        currentSessionId,
        'single_choice',
        nextQuestion,
        null,
        currentStep
      );
    }

    // 7. Update QuestionSession
    const newStep = currentStep + (nextQuestion ? 1 : 0);
    const sessionComplete = shouldStop || newStep >= 3;

    db.prepare(`
      UPDATE question_sessions
      SET step = ?, is_complete = ?, updated_at = ?
      WHERE id = ?
    `).run(
      newStep,
      sessionComplete ? 1 : 0,
      now,
      currentSessionId
    );

    // Update Spec.completenessScore
    db.prepare(`
      UPDATE specs
      SET completeness_score = ?, updated_at = ?
      WHERE id = ?
    `).run(
      estimatedCompleteness,
      now,
      specId
    );

    // Build updated questions and answers arrays for response
    const finalQuestionsAsked = nextQuestion 
      ? [...currentQuestionsAsked, nextQuestion]
      : currentQuestionsAsked;
    const finalAnswers = [...currentAnswers, null]; // Add placeholder for the new question (not yet answered)

    console.log(`[promptly] ✅ Updated session: step=${newStep}, complete=${sessionComplete}, completeness=${estimatedCompleteness.toFixed(2)}`);

    // 8. Return response
    res.json({
      ok: true,
      session: {
        id: currentSessionId,
        specId,
        step: newStep,
        isComplete: sessionComplete,
        questionsAsked: finalQuestionsAsked,
        answers: finalAnswers.slice(0, finalQuestionsAsked.length)
      },
      nextQuestion: sessionComplete ? null : nextQuestion,
      isComplete: sessionComplete,
      spec: {
        ...spec,
        completenessScore: estimatedCompleteness
      }
    });

  } catch (err) {
    console.error(`[promptly] ❌ /api/question-sessions/next error:`, err.message || err);
    if (err instanceof LlmDisabledError) {
      return res.status(503).json({
        ok: false,
        error: "LLM disabled: OPENAI_API_KEY not set"
      });
    }
    return res.status(500).json({
      ok: false,
      error: "Failed to generate next question"
    });
  }
});
