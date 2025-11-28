import { nanoid } from "nanoid";
import { db } from "./db.js";

/**
 * Question navigation helper for Back/Skip controls
 */

// Cache prepared statements for better performance
const stmtCache = {
  getQuestions: db.prepare("SELECT * FROM question_questions WHERE session_id = ? ORDER BY order_index ASC"),
  getAnswered: db.prepare("SELECT DISTINCT question_id FROM question_answers WHERE session_id = ?"),
  getSkipped: db.prepare("SELECT payload as question_id FROM question_actions WHERE session_id = ? AND action = 'skip'"),
  deleteAnswer: db.prepare("DELETE FROM question_answers WHERE session_id = ? AND question_id = ?"),
  insertAction: db.prepare("INSERT INTO question_actions (id, session_id, action, payload, created_at) VALUES (?, ?, ?, ?, ?)")
};

/**
 * Parse question options JSON once and cache the result
 * Uses WeakMap for memoization to avoid repeated parsing
 * @param {Object} q - Question object with options_json field
 * @returns {Object|null} Parsed options or null
 */
const parsedOptionsCache = new WeakMap();
function parseQuestionOptions(q) {
  if (!q.options_json) return null;
  
  // Check cache first
  if (parsedOptionsCache.has(q)) {
    return parsedOptionsCache.get(q);
  }
  
  try {
    const parsed = JSON.parse(q.options_json);
    parsedOptionsCache.set(q, parsed);
    return parsed;
  } catch {
    parsedOptionsCache.set(q, null);
    return null;
  }
}

/**
 * Get the current progress of a session
 * @param {string} sessionId
 * @returns {{ questions: Array, answered: Set, skipped: Set, currentIndex: number }}
 */
export function getSessionProgress(sessionId) {
  const questions = stmtCache.getQuestions.all(sessionId);

  const answeredRows = stmtCache.getAnswered.all(sessionId);
  const answered = new Set(answeredRows.map((r) => r.question_id));

  let skippedRows = [];
  try {
    skippedRows = stmtCache.getSkipped.all(sessionId);
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
      stmtCache.deleteAnswer.run(sessionId, q.id);
      
      // Return questions from targetIndex onwards (up to 5)
      // Parse options once per question
      const batch = questions.slice(targetIndex, targetIndex + 5).map((q) => ({
        id: q.id,
        type: q.type,
        content: q.content,
        options: parseQuestionOptions(q)
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
  stmtCache.insertAction.run(`act_${nanoid(12)}`, sessionId, "skip", questionId, now);

  // Find next unanswered, non-skipped questions
  const remaining = [];
  for (let i = qIndex + 1; i < questions.length; i++) {
    const q = questions[i];
    if (!answered.has(q.id) && !skipped.has(q.id) && q.id !== questionId) {
      remaining.push({
        id: q.id,
        type: q.type,
        content: q.content,
        options: parseQuestionOptions(q)
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
        options: parseQuestionOptions(q)
      });
    }
  }
  
  return unanswered;
}

