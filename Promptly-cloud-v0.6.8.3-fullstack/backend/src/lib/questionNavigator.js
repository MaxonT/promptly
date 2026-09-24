import { nanoid } from "nanoid";
import { db } from "./db.js";

/**
 * Question navigation helper for Back/Skip controls
 */

/**
 * Get the current progress of a session
 * @param {string} sessionId
 * @returns {{ questions: Array, answered: Set, skipped: Set, currentIndex: number }}
 */
export function getSessionProgress(sessionId) {
  const questions = db
    .prepare("SELECT * FROM question_questions WHERE session_id = ? ORDER BY order_index ASC")
    .all(sessionId);

  const answeredRows = db
    .prepare("SELECT DISTINCT question_id FROM question_answers WHERE session_id = ?")
    .all(sessionId);
  const answered = new Set(answeredRows.map((r) => r.question_id));

  let skippedRows = [];
  try {
    skippedRows = db
      .prepare("SELECT payload as question_id FROM question_actions WHERE session_id = ? AND action = 'skip'")
      .all(sessionId);
  } catch (err) {
    // Table might not exist yet or query error
    skippedRows = [];
  }
  const skipped = new Set(skippedRows.map((r) => r.question_id));

  // Find current index: first unanswered, non-skipped question
  let currentIndex = 0;
  for (let i = 0; i < questions.length; i++) {
    if (!answered.has(questions[i].id) && !skipped.has(questions[i].id)) {
      currentIndex = i;
      break;
    }
    if (i === questions.length - 1) {
      currentIndex = questions.length; // All done
    }
  }

  return { questions, answered, skipped, currentIndex };
}

/**
 * Go back to the previous question
 * @param {string} sessionId
 * @returns {{ success: boolean, previousQuestions: Array, message?: string }}
 */
export function goBack(sessionId) {
  const { questions, answered, skipped, currentIndex } = getSessionProgress(sessionId);

  if (currentIndex === 0) {
    return {
      success: false,
      message: "Already at the first question",
      previousQuestions: []
    };
  }

  // Find the previous unanswered or answerable question
  let targetIndex = currentIndex - 1;
  while (targetIndex >= 0) {
    const q = questions[targetIndex];
    if (!skipped.has(q.id)) {
      // Remove answer if it exists, so user can re-answer
      db.prepare("DELETE FROM question_answers WHERE session_id = ? AND question_id = ?")
        .run(sessionId, q.id);
      
      // Return questions from targetIndex onwards (up to 5)
      const batch = questions.slice(targetIndex, targetIndex + 5).map((q) => ({
        id: q.id,
        type: q.type,
        content: q.content,
        options: q.options_json ? JSON.parse(q.options_json) : null
      }));

      return {
        success: true,
        previousQuestions: batch,
        message: `Moved back to question ${targetIndex + 1}`
      };
    }
    targetIndex--;
  }

  return {
    success: false,
    message: "No previous question available",
    previousQuestions: []
  };
}

/**
 * Skip the current question
 * @param {string} sessionId
 * @param {string} questionId
 * @returns {{ success: boolean, nextQuestions: Array, message?: string }}
 */
export function skipQuestion(sessionId, questionId) {
  const { questions, answered, skipped } = getSessionProgress(sessionId);

  // Find the question
  const qIndex = questions.findIndex((q) => q.id === questionId);
  if (qIndex === -1) {
    return {
      success: false,
      message: "Question not found",
      nextQuestions: []
    };
  }

  if (answered.has(questionId)) {
    return {
      success: false,
      message: "Question already answered",
      nextQuestions: []
    };
  }

  // Mark as skipped
  const now = new Date().toISOString();
  db.prepare(
    "INSERT INTO question_actions (id, session_id, action, payload, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(`act_${nanoid(12)}`, sessionId, "skip", questionId, now);

  // Find next unanswered, non-skipped questions
  const remaining = [];
  for (let i = qIndex + 1; i < questions.length; i++) {
    const q = questions[i];
    if (!answered.has(q.id) && !skipped.has(q.id) && q.id !== questionId) {
      remaining.push({
        id: q.id,
        type: q.type,
        content: q.content,
        options: q.options_json ? JSON.parse(q.options_json) : null
      });
    }
    if (remaining.length >= 5) break;
  }

  return {
    success: true,
    nextQuestions: remaining,
    message: `Question skipped`
  };
}

/**
 * Get unanswered questions starting from a specific index
 * @param {string} sessionId
 * @param {number} startIndex
 * @param {number} limit
 * @returns {Array}
 */
export function getUnansweredQuestions(sessionId, startIndex = 0, limit = 5) {
  const { questions, answered, skipped } = getSessionProgress(sessionId);
  
  const unanswered = [];
  for (let i = startIndex; i < questions.length && unanswered.length < limit; i++) {
    const q = questions[i];
    if (!answered.has(q.id) && !skipped.has(q.id)) {
      unanswered.push({
        id: q.id,
        type: q.type,
        content: q.content,
        options: q.options_json ? JSON.parse(q.options_json) : null
      });
    }
  }
  
  return unanswered;
}

