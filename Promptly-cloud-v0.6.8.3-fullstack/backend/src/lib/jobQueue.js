/**
 * Job Queue Service for Question Generation
 * Provides async background processing for long-running LLM operations
 */

import { nanoid } from "nanoid";
import { db } from "./db.js";
import {
  generateBroadQuestions,
  generateChoiceQuestions
} from "./llmAgents.js";

// In-memory job storage
const jobs = new Map();

// Job statuses
const JobStatus = {
  PENDING: "pending",
  GENERATING: "generating",
  READY: "ready",
  ERROR: "error"
};

// Configuration constants
const MAX_RETRIES = 2;
const GENERATION_TIMEOUT_MS = 60000; // 60 seconds
const JOB_CLEANUP_RETENTION_MS = 30 * 60 * 1000; // 30 minutes
const JOB_CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Create a new question generation job
 * @param {string} sessionId - The question session ID
 * @param {object} params - Parameters for question generation
 * @returns {object} - Job info including jobId
 */
export function createQuestionJob(sessionId, params) {
  const jobId = `job_${nanoid(12)}`;
  const job = {
    id: jobId,
    sessionId,
    params,
    status: JobStatus.PENDING,
    retries: 0,
    result: null,
    error: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    progress: {
      step: "initializing",
      message: "Preparing question generation..."
    }
  };
  
  jobs.set(jobId, job);
  
  // Start processing in the background (non-blocking)
  processJob(jobId).catch((err) => {
    console.error(`[jobQueue] Unhandled error in job ${jobId}:`, err);
  });
  
  return { jobId, status: job.status };
}

/**
 * Get job status
 * @param {string} jobId - The job ID
 * @returns {object|null} - Job status info or null if not found
 */
export function getJobStatus(jobId) {
  const job = jobs.get(jobId);
  if (!job) return null;
  
  return {
    id: job.id,
    sessionId: job.sessionId,
    status: job.status,
    progress: job.progress,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt
  };
}

/**
 * Get job by session ID
 * @param {string} sessionId - The session ID
 * @returns {object|null} - Job info or null if not found
 */
export function getJobBySessionId(sessionId) {
  for (const job of jobs.values()) {
    if (job.sessionId === sessionId) {
      return {
        id: job.id,
        sessionId: job.sessionId,
        status: job.status,
        progress: job.progress,
        error: job.error,
        result: job.result,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt
      };
    }
  }
  return null;
}

/**
 * Process a job in the background
 * @param {string} jobId - The job ID to process
 */
async function processJob(jobId) {
  const job = jobs.get(jobId);
  if (!job) return;
  
  try {
    job.status = JobStatus.GENERATING;
    job.progress = {
      step: "broad_questions",
      message: "Generating initial question topics..."
    };
    job.updatedAt = new Date().toISOString();
    
    const { initialDescription, kind, modeProfile, model } = job.params;
    
    // Generate broad questions with timeout
    let broadQuestions;
    try {
      broadQuestions = await runWithTimeout(
        generateBroadQuestions({
          initialDescription,
          kind,
          modeProfile,
          model
        }),
        GENERATION_TIMEOUT_MS,
        "generate broad questions"
      );
    } catch (err) {
      // Retry logic
      if (job.retries < MAX_RETRIES) {
        job.retries++;
        job.progress = {
          step: "retrying",
          message: `Retrying broad questions (attempt ${job.retries + 1}/${MAX_RETRIES + 1})...`
        };
        job.updatedAt = new Date().toISOString();
        
        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return processJob(jobId);
      }
      throw err;
    }
    
    job.progress = {
      step: "choice_questions",
      message: "Creating detailed choice questions..."
    };
    job.updatedAt = new Date().toISOString();
    
    // Generate choice questions with timeout
    let choiceQuestions;
    try {
      choiceQuestions = await runWithTimeout(
        generateChoiceQuestions({
          initialDescription,
          kind,
          broadQuestions,
          modeProfile,
          model
        }),
        GENERATION_TIMEOUT_MS,
        "generate choice questions"
      );
    } catch (err) {
      // Retry logic
      if (job.retries < MAX_RETRIES) {
        job.retries++;
        job.progress = {
          step: "retrying",
          message: `Retrying choice questions (attempt ${job.retries + 1}/${MAX_RETRIES + 1})...`
        };
        job.updatedAt = new Date().toISOString();
        
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return processJob(jobId);
      }
      throw err;
    }
    
    // Store questions in database
    job.progress = {
      step: "saving",
      message: "Saving questions to database..."
    };
    job.updatedAt = new Date().toISOString();
    
    const insertQuestion = db.prepare(
      `INSERT INTO question_questions
       (id, session_id, type, content, options_json, order_index)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    
    choiceQuestions.forEach((q, index) => {
      const qid = q.id || `q_${nanoid(12)}`;
      const questionData = {
        depth_enabled: q.depth_enabled,
        options: q.options || null,
        depth_question: q.depth_question || null,
        depth_levels: q.depth_levels || null
      };
      insertQuestion.run(
        qid,
        job.sessionId,
        q.type,
        q.content,
        JSON.stringify(questionData),
        index
      );
      q.id = qid;
    });
    
    // Update session status
    db.prepare(
      "UPDATE question_sessions SET status = ?, updated_at = ? WHERE id = ?"
    ).run("active", new Date().toISOString(), job.sessionId);
    
    // Store result
    job.result = {
      questions: choiceQuestions.slice(0, 5).map((q) => ({
        id: q.id,
        type: q.type,
        content: q.content,
        depth_enabled: q.depth_enabled,
        options: q.options || null,
        depth_question: q.depth_question || null,
        depth_levels: q.depth_levels || null
      })),
      totalCount: choiceQuestions.length
    };
    
    job.status = JobStatus.READY;
    job.progress = {
      step: "complete",
      message: "Questions generated successfully!"
    };
    job.updatedAt = new Date().toISOString();
    
    console.log(`[jobQueue] Job ${jobId} completed successfully with ${choiceQuestions.length} questions`);
    
  } catch (err) {
    console.error(`[jobQueue] Job ${jobId} failed:`, err);
    
    job.status = JobStatus.ERROR;
    job.error = err.message || "Unknown error";
    job.progress = {
      step: "error",
      message: `Failed: ${err.message || "Unknown error"}`
    };
    job.updatedAt = new Date().toISOString();
    
    // Update session status to error
    db.prepare(
      "UPDATE question_sessions SET status = ?, updated_at = ? WHERE id = ?"
    ).run("error", new Date().toISOString(), job.sessionId);
  }
}

/**
 * Run a promise with a timeout
 * @param {Promise} promise - The promise to run
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} label - Label for error messages
 * @returns {Promise} - The result or throws on timeout
 */
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

/**
 * Clean up old completed jobs (runs periodically)
 * Keeps jobs for the configured retention period after completion
 */
export function cleanupOldJobs() {
  const cutoffTime = new Date(Date.now() - JOB_CLEANUP_RETENTION_MS).toISOString();
  
  for (const [jobId, job] of jobs.entries()) {
    if (
      (job.status === JobStatus.READY || job.status === JobStatus.ERROR) &&
      job.updatedAt < cutoffTime
    ) {
      jobs.delete(jobId);
    }
  }
}

// Clean up old jobs at configured interval
setInterval(cleanupOldJobs, JOB_CLEANUP_INTERVAL_MS);

export { JobStatus };
