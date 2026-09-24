/**
 * exemplarService.js — Exemplar Bank CRUD + Search
 *
 * Responsible for:
 * 1. Ingesting high-scoring prompts from the pipeline (auto-harvest)
 * 2. Searching exemplars by keyword (FTS5) + quality score
 * 3. Returning top-K exemplars formatted for few-shot injection
 *
 * Usage:
 *   import { harvestExemplar, searchExemplars } from "../lib/exemplarService.js";
 */

import { nanoid } from "nanoid";
import { db } from "./db.js";

// ─── Configuration ──────────────────────────────────────────────────────────
const HARVEST_THRESHOLD = 80;   // Minimum composite score to auto-harvest
const DEFAULT_TOP_K     = 3;    // Default number of exemplars to return
const MAX_TOP_K         = 10;   // Hard ceiling

// ─── Harvest (Insert) ───────────────────────────────────────────────────────

/**
 * Attempt to store a high-scoring prompt as an exemplar.
 * Called by the pipeline after evaluation completes.
 *
 * @param {Object} opts
 * @param {string} opts.userId
 * @param {string} opts.specId
 * @param {string} opts.runId
 * @param {string} opts.candidateId
 * @param {string} opts.mode           - "fast" | "standard" | "premium"
 * @param {string} opts.promptText     - The actual prompt that scored well
 * @param {string} [opts.taskDomain]   - e.g. "copywriting", "code-review"
 * @param {string} [opts.specSummary]  - Brief summary of the original spec
 * @param {string} [opts.language]     - "en", "zh", etc.
 * @param {Object} opts.metrics        - { compositeScore, completeness, clarity, … }
 * @returns {{ harvested: boolean, id?: string, reason?: string }}
 */
export function harvestExemplar({
  userId,
  specId,
  runId,
  candidateId,
  mode = "standard",
  promptText,
  taskDomain = null,
  specSummary = null,
  language = "en",
  metrics = {},
}) {
  if (!promptText || typeof promptText !== "string" || promptText.trim().length < 20) {
    return { harvested: false, reason: "prompt_too_short" };
  }

  const score = metrics.compositeScore ?? 0;
  if (score < HARVEST_THRESHOLD) {
    return { harvested: false, reason: `score_below_threshold (${score} < ${HARVEST_THRESHOLD})` };
  }

  // Dedup: skip if we already have this candidate
  if (candidateId) {
    const existing = db
      .prepare("SELECT id FROM exemplar_bank WHERE candidate_id = ?")
      .get(candidateId);
    if (existing) {
      return { harvested: false, reason: "duplicate_candidate", id: existing.id };
    }
  }

  const id = `exm_${nanoid(12)}`;

  try {
    db.prepare(`
      INSERT INTO exemplar_bank
        (id, user_id, spec_id, run_id, candidate_id, mode,
         prompt_text, task_domain, spec_summary, language,
         composite_score, completeness, clarity, specificity,
         structure, coherence, creativity, safety, efficiency)
      VALUES (?, ?, ?, ?, ?, ?,
              ?, ?, ?, ?,
              ?, ?, ?, ?,
              ?, ?, ?, ?, ?)
    `).run(
      id, userId, specId, runId, candidateId, mode,
      promptText.trim(), taskDomain, specSummary, language,
      score,
      metrics.completeness ?? null,
      metrics.clarity ?? null,
      metrics.specificity ?? null,
      metrics.structure ?? null,
      metrics.coherence ?? null,
      metrics.creativity ?? null,
      metrics.safety ?? null,
      metrics.efficiency ?? null
    );

    console.log(`[exemplar] ✅ Harvested exemplar ${id} (score=${score})`);
    return { harvested: true, id };
  } catch (err) {
    console.error(`[exemplar] ❌ Failed to harvest: ${err.message}`);
    return { harvested: false, reason: err.message };
  }
}

// ─── Search ─────────────────────────────────────────────────────────────────

/**
 * Search exemplar bank for relevant few-shot examples.
 *
 * Strategy:
 * 1. If keywords provided → FTS5 match, ranked by composite_score
 * 2. If taskDomain provided → filter by domain, ranked by score
 * 3. Fallback → top-K by composite_score for user/global
 *
 * @param {Object} opts
 * @param {string} [opts.userId]       - Prefer user's own exemplars first
 * @param {string} [opts.keywords]     - FTS query string
 * @param {string} [opts.taskDomain]   - Filter by domain
 * @param {number} [opts.topK=3]       - Number of results
 * @param {number} [opts.minScore=70]  - Minimum composite_score
 * @returns {Array<{ id, promptText, compositeScore, specSummary, taskDomain }>}
 */
export function searchExemplars({
  userId = null,
  keywords = null,
  taskDomain = null,
  topK = DEFAULT_TOP_K,
  minScore = 70,
  createdAfter = null,
} = {}) {
  topK = Math.min(Math.max(1, topK), MAX_TOP_K);

  // ─── Path 1: FTS keyword search ────────────────────────────────────────
  if (keywords && keywords.trim().length > 0) {
    try {
      const ftsQuery = sanitizeFtsQuery(keywords);
      const rows = db.prepare(`
        SELECT e.id, e.prompt_text, e.composite_score, e.spec_summary, e.task_domain
        FROM exemplar_fts f
        JOIN exemplar_bank e ON e.id = f.id
        WHERE exemplar_fts MATCH ?
          AND e.composite_score >= ?
          ${createdAfter ? "AND e.created_at >= ?" : ""}
        ORDER BY
          CASE WHEN e.user_id = ? THEN 0 ELSE 1 END,
          e.composite_score DESC
        LIMIT ?
      `).all(ftsQuery, minScore, ...(createdAfter ? [createdAfter] : []), userId || "", topK);

      bumpUsageCount(rows.map(r => r.id));
      return formatResults(rows);
    } catch (ftsErr) {
      // FTS5 may not be available — fall through to domain/score search
      console.warn("[exemplar] FTS search failed, falling back:", ftsErr.message);
    }
  }

  // ─── Path 2: Domain filter ─────────────────────────────────────────────
  if (taskDomain) {
    const rows = db.prepare(`
      SELECT id, prompt_text, composite_score, spec_summary, task_domain
      FROM exemplar_bank
      WHERE task_domain = ?
        AND composite_score >= ?
        ${createdAfter ? "AND created_at >= ?" : ""}
      ORDER BY
        CASE WHEN user_id = ? THEN 0 ELSE 1 END,
        composite_score DESC
      LIMIT ?
    `).all(taskDomain, minScore, ...(createdAfter ? [createdAfter] : []), userId || "", topK);

    bumpUsageCount(rows.map(r => r.id));
    return formatResults(rows);
  }

  // ─── Path 3: Fallback — top by score ───────────────────────────────────
  const rows = db.prepare(`
    SELECT id, prompt_text, composite_score, spec_summary, task_domain
    FROM exemplar_bank
    WHERE composite_score >= ?
    ${createdAfter ? "AND created_at >= ?" : ""}
    ORDER BY
      CASE WHEN user_id = ? THEN 0 ELSE 1 END,
      composite_score DESC
    LIMIT ?
  `).all(minScore, ...(createdAfter ? [createdAfter] : []), userId || "", topK);

  bumpUsageCount(rows.map(r => r.id));
  return formatResults(rows);
}

// ─── Format for Injection ───────────────────────────────────────────────────

/**
 * Build a prompt-injection block from exemplars.
 * Used by the Generation stage to provide few-shot context.
 *
 * @param {Array} exemplars - Result of searchExemplars()
 * @returns {string} Formatted block or empty string
 */
export function formatExemplarBlock(exemplars) {
  if (!exemplars || exemplars.length === 0) return "";

  const lines = exemplars.map((ex, i) => {
    const domain = ex.taskDomain ? ` [${ex.taskDomain}]` : "";
    return `--- Exemplar ${i + 1}${domain} (score: ${ex.compositeScore}) ---\n${ex.promptText}`;
  });

  return `\n<high_quality_exemplars>\nThe following are high-scoring prompts from similar tasks. Use them as style/quality references, NOT as templates to copy.\n\n${lines.join("\n\n")}\n</high_quality_exemplars>\n`;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function sanitizeFtsQuery(raw) {
  // Convert natural language keywords into FTS5-safe query
  // Remove special chars, split into terms, join with OR
  const terms = raw
    .replace(/[^\w\s\u4e00-\u9fff]/g, " ")  // keep letters, digits, CJK
    .split(/\s+/)
    .filter(t => t.length > 1)
    .slice(0, 10);  // prevent huge queries
  return terms.join(" OR ");
}

function formatResults(rows) {
  return rows.map(r => ({
    id: r.id,
    promptText: r.prompt_text,
    compositeScore: r.composite_score,
    specSummary: r.spec_summary,
    taskDomain: r.task_domain,
  }));
}

function bumpUsageCount(ids) {
  if (!ids || ids.length === 0) return;
  try {
    const stmt = db.prepare("UPDATE exemplar_bank SET usage_count = usage_count + 1, updated_at = datetime('now') WHERE id = ?");
    const tx = db.transaction(() => {
      for (const id of ids) stmt.run(id);
    });
    tx();
  } catch (err) {
    // Non-critical — log and continue
    console.warn("[exemplar] Failed to bump usage_count:", err.message);
  }
}

export { HARVEST_THRESHOLD };
