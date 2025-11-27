import { Router } from "express";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "../lib/db.js";
import { generateBroadQuestions, generateChoiceQuestions, generateRawSpec } from "../lib/llmAgents.js";
import { compileSpecToPrompt } from "../lib/specCompiler.js";
import { LlmDisabledError } from "../lib/openaiClient.js";
import { goBack, skipQuestion } from "../lib/questionNavigator.js";

export const questionSessionRouter = Router();

const CreateSessionSchema = z.object({
  initial_description: z.string().min(1),
  kind: z.string().min(1).max(64).optional()
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
  control: z.enum(["back", "skip"]).optional()
});

function getUserId(req) {
  if (req.user && req.user.sub) return req.user.sub;
  return "demo-user";
}

questionSessionRouter.post("/", async (req, res) => {
  const parsed = CreateSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: parsed.error.flatten() });
  }
  const { initial_description, kind } = parsed.data;
  const userId = getUserId(req);
  const now = new Date().toISOString();
  const sessionId = `sess_${nanoid(16)}`;

  db.prepare(
    `INSERT INTO question_sessions
     (id, owner_id, initial_description, kind, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(sessionId, userId, initial_description, kind || null, "active", now, now);

  try {
    const broadQuestions = await generateBroadQuestions({
      initialDescription: initial_description,
      kind: kind || null
    });
    const choiceQuestions = await generateChoiceQuestions({
      initialDescription: initial_description,
      kind: kind || null,
      broadQuestions
    });

    const insertQuestion = db.prepare(
      `INSERT INTO question_questions
       (id, session_id, type, content, options_json, order_index)
       VALUES (?, ?, ?, ?, ?, ?)`
    );

    choiceQuestions.forEach((q, index) => {
      const qid = q.id || `q_${nanoid(12)}`;
      insertQuestion.run(
        qid,
        sessionId,
        q.type,
        q.content,
        q.options ? JSON.stringify(q.options) : null,
        index
      );
      q.id = qid;
    });

    const firstBatch = choiceQuestions.slice(0, 5).map((q) => ({
      id: q.id,
      type: q.type,
      content: q.content,
      options: q.options || null
    }));

    return res.json({ ok: true, session_id: sessionId, questions: firstBatch });
  } catch (err) {
    console.error("[promptly] question session init failed", err);
    db.prepare(
      "UPDATE question_sessions SET status = ?, updated_at = ? WHERE id = ?"
    ).run("error", new Date().toISOString(), sessionId);
    if (err instanceof LlmDisabledError || err.code === "LLM_DISABLED") {
      return res.status(503).json({ ok: false, error: "LLM disabled" });
    }
    return res.status(502).json({ ok: false, error: "Question engine failed" });
  }
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
    const nextBatch = remaining.slice(0, 5).map((q) => ({
      id: q.id,
      type: q.type,
      content: q.content,
      options: q.options_json ? JSON.parse(q.options_json) : null
    }));
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
    return {
      id: q.id,
      type: q.type,
      content: q.content,
      options: q.options_json ? JSON.parse(q.options_json) : null,
      answer: a ? JSON.parse(a.answer_json) : null
    };
  });

  try {
    const result = await generateRawSpec({
      initialDescription: session.initial_description,
      kind: session.kind,
      qaPairs
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
      kind: session.kind || null
    });
    const choiceQuestions = await generateChoiceQuestions({
      initialDescription: session.initial_description,
      kind: session.kind || null,
      broadQuestions
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
