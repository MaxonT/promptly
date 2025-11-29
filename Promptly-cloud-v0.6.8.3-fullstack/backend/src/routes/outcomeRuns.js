import { Router } from "express";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "../lib/db.js";

export const outcomeRunsRouter = Router();

const OutcomeRunRequestSchema = z.object({
  task: z.string().trim().min(1),
  input: z.string().optional(),
  style: z.string().optional(),
  constraints: z.string().optional(),
  n: z.number().int().min(1).max(8).optional(),
  tests: z.record(z.any()).optional(),
  model: z.string().optional()
});

outcomeRunsRouter.post("/", (req, res) => {
  const parsed = OutcomeRunRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: parsed.error.flatten() });
  }

  const { task, input, style, constraints, tests, model } = parsed.data;
  const n = parsed.data.n ?? 4;
  const now = new Date().toISOString();
  const outcomeRunId = `outcome_run_${nanoid(12)}`;

  // Build simple deterministic candidates
  const candidates = Array.from({ length: n }).map((_, idx) => {
    const llmScore = 7 + (idx * 0.25);
    const testsResult = { passed: true, issues: [] };
    return {
      id: `cand_${nanoid(10)}`,
      content: [
        task,
        input ? `\nContext: ${input}` : "",
        style ? `\nStyle: ${style}` : "",
        constraints ? `\nConstraints: ${constraints}` : ""
      ].join(""),
      llmScore,
      finalScore: llmScore,
      tests: testsResult
    };
  });

  // Pick the first candidate as best (scores are deterministic)
  const best = candidates.reduce((acc, cand) => {
    return cand.finalScore > acc.finalScore ? cand : acc;
  }, candidates[0]);

  try {
    db.prepare(
      `INSERT INTO outcome_runs
       (id, spec_id, run_id, task, input, style, constraints, n, model, status, best_candidate_id, request_json, result_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      outcomeRunId,
      null,
      null,
      task,
      input || null,
      style || null,
      constraints || null,
      n,
      model || null,
      "success",
      best.id,
      JSON.stringify(parsed.data),
      JSON.stringify({ best, candidates }),
      now
    );

    const insertCandidate = db.prepare(
      `INSERT INTO outcome_candidates
       (id, outcome_run_id, candidate_index, content, llm_score, final_score, tests_passed, tests_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    candidates.forEach((cand, idx) => {
      insertCandidate.run(
        cand.id,
        outcomeRunId,
        idx,
        cand.content,
        cand.llmScore,
        cand.finalScore,
        cand.tests?.passed === false ? 0 : 1,
        cand.tests ? JSON.stringify(cand.tests) : null,
        now
      );
    });
  } catch (err) {
    console.error("[promptly] failed to insert outcome run", err);
    return res.status(500).json({ ok: false, error: "Failed to record outcome run" });
  }

  return res.status(201).json({
    ok: true,
    result: {
      request: { ...parsed.data, n },
      best,
      candidates
    }
  });
});
