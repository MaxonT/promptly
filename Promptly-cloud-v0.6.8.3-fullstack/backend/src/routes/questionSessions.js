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
import { LlmDisabledError } from "../lib/openaiClient.js";
import { goBack, skipQuestion } from "../lib/questionNavigator.js";

export const questionSessionRouter = Router();

const PROJECT_DESCRIPTION_REQUIRED_MESSAGE = "Project description is required.";

const MODE_PROFILES = {
  fast: {
    id: "fast",
    label: "Fast",
    hierarchy: "A+",
    chainLength: 2,
    maxSteps: 3,
    timeoutMs: 15000,
    description: "Quick response, minimal reasoning"
  },
  deep: {
    id: "deep",
    label: "Deep Thinking",
    hierarchy: "S",
    chainLength: 4,
    maxSteps: 6,
    timeoutMs: 25000,
    description: "Balanced depth and speed"
  },
  ultra: {
    id: "ultra",
    label: "Ultra Thinking",
    hierarchy: "S+",
    chainLength: 6,
    maxSteps: 8,
    timeoutMs: 40000,
    description: "Maximum depth, slowest response"
  }
};

const MODEL_IDS = [
  "promptly-mini",
  "promptly",
  "promptly-plus",
  "promptly-pro",
  "promptly-pro-max",
  "promptly-code-mini",
  "promptly-code",
  "promptly-code-plus",
  "promptly-code-pro",
  "promptly-code-pro-max"
];

const MODEL_TARGETS = {
  "promptly-mini": "gpt-4o-mini",
  promptly: "gpt-4o",
  "promptly-plus": "gpt-4o",
  "promptly-pro": "gpt-4o",
  "promptly-pro-max": "gpt-4o",
  "promptly-code-mini": "gpt-4o-mini",
  "promptly-code": "gpt-4o-mini",
  "promptly-code-plus": "gpt-4o",
  "promptly-code-pro": "gpt-4o",
  "promptly-code-pro-max": "gpt-4o"
};

const CreateSessionSchema = z.object({
  initial_description: z
    .string()
    .trim()
    .min(1, { message: PROJECT_DESCRIPTION_REQUIRED_MESSAGE }),
  kind: z.string().min(1).max(64).optional(),
  mode: z.enum(["fast", "deep", "ultra"]).optional(),
  model: z.enum(MODEL_IDS).optional()
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
  model: z.enum(MODEL_IDS).optional()
});

const ModelOnlySchema = z.object({
  model: z.enum(MODEL_IDS).optional()
});

const RUNNING_STATUSES = ["active", "ready_to_finalize"];

function getUserId(req) {
  if (req.user && req.user.sub) return req.user.sub;
  return "demo-user";
}

function resolveModeProfile(mode) {
  return MODE_PROFILES[mode] || MODE_PROFILES.deep;
}

function resolveModelChoice(modelId) {
  const fallback = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const selected = MODEL_IDS.includes(modelId) ? modelId : "promptly";
  return { id: selected, targetModel: MODEL_TARGETS[selected] || fallback };
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
  const { initial_description, kind, mode, model } = parsed.data;
  const modeProfile = resolveModeProfile(mode);
  const modelChoice = resolveModelChoice(model);
  const userId = getUserId(req);
  
  // Ensure the user exists before creating a session
  ensureUser(userId);
  
  const now = new Date().toISOString();
  const sessionId = `sess_${nanoid(16)}`;

  db.prepare(
    `INSERT INTO question_sessions
     (id, owner_id, initial_description, kind, mode, model, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(sessionId, userId, initial_description, kind || null, modeProfile.id, modelChoice.id, "active", now, now);

  try {
    const broadQuestions = await runWithTimeout(
      generateBroadQuestions({
        initialDescription: initial_description,
        kind: kind || null,
        modeProfile,
        model: modelChoice.targetModel
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
        model: modelChoice.targetModel
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
      const qid = q.id || `q_${nanoid(12)}`;
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

    const firstBatch = choiceQuestions.slice(0, 5).map((q) => ({
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
      mode_profile: modeProfile,
      questions: firstBatch
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
        `SELECT id, owner_id, kind, status, mode, model, created_at, updated_at
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
        `SELECT id, owner_id, kind, status, mode, model, created_at, updated_at
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
      `SELECT id, owner_id, kind, status, initial_description, mode, model, created_at, updated_at
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
      initial_description: session.initial_description,
      initialDescription: session.initial_description,
      created_at: session.created_at,
      updated_at: session.updated_at
    }
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
      model: modelChoice.targetModel
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

  const oldQuestion = db
    .prepare("SELECT * FROM question_questions WHERE id = ? AND session_id = ?")
    .get(questionId, sessionId);
  if (!oldQuestion) {
    return res.status(404).json({ ok: false, error: "Question not found" });
  }

  try {
    // Use LLM to generate a new variation of this question
    const broadQuestions = await generateBroadQuestions({
      initialDescription: session.initial_description,
      kind: session.kind || null,
      model: modelChoice.targetModel
    });
    const choiceQuestions = await generateChoiceQuestions({
      initialDescription: session.initial_description,
      kind: session.kind || null,
      broadQuestions,
      model: modelChoice.targetModel
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
