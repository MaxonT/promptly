import { Router } from "express";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "../lib/db.js";
import { buildEvaluationMetrics } from "../lib/metricsEngine.js";

export const outcomeRunsRouter = Router();

const OutcomeRunRequestSchema = z.object({
  task: z.string().trim().min(1),
  input: z.string().optional(),
  style: z.string().optional(),
  constraints: z.string().optional(),
  n: z.number().int().min(1).max(8).optional(),
  tests: z.record(z.any()).optional(),
  model: z.string().optional(),
  // Layer 2 fields (Blueprint sync)
  blueprintInstructions: z.string().optional(),
  blueprintExamples: z.string().optional(),
  blueprintConstraints: z.string().optional(),
  // Layer 3 fields (Expert lab)
  posNegDataset: z.string().optional(),
  schemaTemplate: z.string().optional(),
  optimizationKnobs: z.string().optional()
});

outcomeRunsRouter.post("/", (req, res) => {
  const parsed = OutcomeRunRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: parsed.error.flatten() });
  }

  const { 
    task, 
    input, 
    style, 
    constraints, 
    tests, 
    model,
    // Layer 2 fields
    blueprintInstructions,
    blueprintExamples,
    blueprintConstraints,
    // Layer 3 fields
    posNegDataset,
    schemaTemplate,
    optimizationKnobs
  } = parsed.data;
  const n = parsed.data.n ?? 4;
  const now = new Date().toISOString();
  const outcomeRunId = `outcome_run_${nanoid(12)}`;

  // Build prompt content incorporating all Layer 2/3 inputs
  const buildPromptContent = () => {
    const parts = [task];
    
    if (input) parts.push(`\nContext: ${input}`);
    if (style) parts.push(`\nStyle: ${style}`);
    if (constraints) parts.push(`\nConstraints: ${constraints}`);
    
    // Layer 2: Blueprint sync fields
    if (blueprintInstructions) {
      parts.push(`\n\n[Blueprint Instructions]\n${blueprintInstructions}`);
    }
    if (blueprintExamples) {
      parts.push(`\n\n[Blueprint Examples]\n${blueprintExamples}`);
    }
    if (blueprintConstraints) {
      parts.push(`\n\n[Blueprint Constraints]\n${blueprintConstraints}`);
    }
    
    // Layer 3: Expert lab fields
    if (posNegDataset) {
      parts.push(`\n\n[POS/NEG Dataset]\n${posNegDataset}`);
    }
    if (schemaTemplate) {
      parts.push(`\n\n[Schema Template]\n${schemaTemplate}`);
    }
    if (optimizationKnobs) {
      parts.push(`\n\n[Optimization Knobs]\n${optimizationKnobs}`);
    }
    
    return parts.join("");
  };

  // Build simple deterministic candidates
  const candidates = Array.from({ length: n }).map((_, idx) => {
    const llmScore = 7 + (idx * 0.25);
    const testsResult = { passed: true, issues: [] };
    return {
      id: `cand_${nanoid(10)}`,
      content: buildPromptContent(),
      llmScore,
      finalScore: llmScore,
      tests: testsResult
    };
  });

  // Pick the first candidate as best (scores are deterministic)
  const best = candidates.reduce((acc, cand) => {
    return cand.finalScore > acc.finalScore ? cand : acc;
  }, candidates[0]);

  // Calculate metrics using metricsEngine
  // For now, we use simulated test stats since this is a simplified implementation
  // In a full implementation, these would come from actual test runs
  const simulatedTestStats = {
    correct_count: Math.floor(n * 0.85), // 85% accuracy
    total_cases: n,
    tp: Math.floor(n * 0.8),
    fp: Math.floor(n * 0.1),
    fn: Math.floor(n * 0.1),
    passed_constraints: Math.floor(n * 0.9),
    total_constraints: n
  };

  const simulatedUsage = {
    prompt_tokens: n * 150, // Estimated tokens per candidate
    completion_tokens: n * 350,
    total_tokens: n * 500
  };

  const targets = {
    accuracy: 1.0,
    f1: 1.0,
    passRate: 1.0,
    idealTokenCost: 512
  };

  const evaluationMetrics = buildEvaluationMetrics({
    testStats: simulatedTestStats,
    usage: simulatedUsage,
    targets: targets
  });

  try {
    // Store all Layer 2/3 fields in request_json for full traceability
    const fullRequestData = {
      ...parsed.data,
      n,
      layer2: {
        blueprintInstructions: blueprintInstructions || null,
        blueprintExamples: blueprintExamples || null,
        blueprintConstraints: blueprintConstraints || null
      },
      layer3: {
        posNegDataset: posNegDataset || null,
        schemaTemplate: schemaTemplate || null,
        optimizationKnobs: optimizationKnobs || null
      }
    };

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
      JSON.stringify(fullRequestData),
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
      best: {
        ...best,
        metrics: {
          accuracy: evaluationMetrics.accuracy,
          f1: evaluationMetrics.f1,
          passRate: evaluationMetrics.passRate,
          tokenCost: evaluationMetrics.tokenCost,
          progress: evaluationMetrics.progress
        }
      },
      candidates,
      metrics: evaluationMetrics
    }
  });
});
