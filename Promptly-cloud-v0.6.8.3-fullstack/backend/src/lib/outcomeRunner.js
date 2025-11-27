import { z } from "zod";
import { nanoid } from "nanoid";
import { db } from "./db.js";
import { chatJson, LlmDisabledError } from "./openaiClient.js";
import { createRun, completeRunSuccess, completeRunFailure } from "./runLogger.js";

/**
 * Zod schema for Outcome Judge agent output
 * The LLM evaluates whether a run's output meets the outcome criteria
 */
const OutcomeMetricSchema = z.object({
  name: z.string(),
  score: z.number().min(0).max(10).optional(),
  passed: z.boolean().optional(),
  details: z.string().optional()
}).passthrough();

const OutcomeResultSchema = z.object({
  score: z.number().min(0).max(10), // Overall score 0-10
  verdict: z.enum(["pass", "fail", "needs_work"]),
  summary: z.string(),
  metrics: z.array(OutcomeMetricSchema).optional(),
  details: z.any().optional()
}).passthrough();

/**
 * Load a run from the database
 * @param {string} runId - The run ID
 * @returns {Object|null} The run record
 */
function loadRun(runId) {
  return db.prepare(
    `SELECT * FROM runs WHERE id = ?`
  ).get(runId);
}

/**
 * Load a spec from the database (used as outcome criteria)
 * @param {string} specId - The spec ID
 * @returns {Object|null} The spec record
 */
function loadSpec(specId) {
  return db.prepare(
    `SELECT * FROM specs WHERE id = ?`
  ).get(specId);
}

/**
 * Build the LLM prompt for outcome evaluation
 * @param {Object} run - The run record
 * @param {Object} spec - The spec record (parsed)
 * @returns {Object} { system, user }
 */
function buildOutcomePrompt(run, spec) {
  const system = [
    "You are the Outcome Judge agent in Promptly's outcome evaluation system.",
    "Your goal: evaluate whether a run's output successfully meets the defined outcome criteria.",
    "Consider:",
    "- Correctness: Does the output match the expected result?",
    "- Completeness: Are all required elements present?",
    "- Quality: Is the output well-formed and useful?",
    "- Compliance: Does it adhere to any constraints or requirements?",
    "",
    "Return JSON with:",
    "- score (0-10): Overall outcome quality score",
    "- verdict ('pass', 'fail', or 'needs_work'): Final judgment",
    "- summary (string): Brief explanation of the outcome",
    "- metrics (array, optional): Per-metric evaluations with name, score, passed, details",
    "- details (any, optional): Additional context or data",
    "",
    "Do not output anything except JSON."
  ].join(" ");

  // Parse raw_output if it's a JSON string
  let parsedOutput;
  try {
    parsedOutput = typeof run.raw_output === 'string' 
      ? JSON.parse(run.raw_output) 
      : run.raw_output;
  } catch {
    parsedOutput = run.raw_output;
  }

  // Parse input_blocks if it's a JSON string
  let parsedInput;
  try {
    parsedInput = typeof run.input_blocks === 'string'
      ? JSON.parse(run.input_blocks)
      : run.input_blocks;
  } catch {
    parsedInput = run.input_blocks;
  }

  const user = JSON.stringify({
    run: {
      id: run.id,
      status: run.status,
      model: run.model,
      input: parsedInput,
      output: parsedOutput
    },
    outcome_criteria: {
      spec: spec,
      requirements: "Evaluate if the output satisfies the spec requirements"
    }
  });

  return { system, user };
}

/**
 * Run an outcome check on an existing run
 * 
 * This function evaluates whether a run's output meets specified outcome criteria.
 * It loads the run and spec from the database, calls an LLM "Outcome Judge" agent,
 * parses the result, and stores it in the outcome_runs table.
 * 
 * @param {Object} options
 * @param {string} options.runId - ID of the run to evaluate
 * @param {string} options.outcomeSpecId - ID of the spec defining outcome criteria (typically a spec_id)
 * @param {string} [options.modelOverride] - Optional model to use instead of default
 * @returns {Promise<Object>} Result object with ok, outcomeRun, and optional metrics
 */
export async function runOutcomeCheck({ runId, outcomeSpecId, modelOverride }) {
  // 1. Load context from database
  const run = loadRun(runId);
  if (!run) {
    return {
      ok: false,
      error: { message: `Run not found: ${runId}` }
    };
  }

  const specRecord = loadSpec(outcomeSpecId);
  if (!specRecord) {
    return {
      ok: false,
      error: { message: `Outcome spec not found: ${outcomeSpecId}` }
    };
  }

  // Parse spec_json
  let spec;
  try {
    spec = typeof specRecord.spec_json === 'string'
      ? JSON.parse(specRecord.spec_json)
      : specRecord.spec_json;
  } catch (err) {
    return {
      ok: false,
      error: { message: `Failed to parse spec JSON: ${err.message}` }
    };
  }

  // 2. Build LLM prompt
  const { system, user } = buildOutcomePrompt(run, spec);

  // 3. Determine model to use
  const model = modelOverride 
    || process.env.OUTCOME_MODEL 
    || process.env.OPENAI_MODEL 
    || "gpt-4.1-mini";

  // 4. Create a run log for this outcome check
  const judgeRunId = createRun({
    specId: outcomeSpecId,
    model: model,
    inputBlocks: {
      agent: "OUTCOME_JUDGE",
      evaluated_run_id: runId,
      outcome_spec_id: outcomeSpecId
    }
  });

  let outcomeResult;
  try {
    // 5. Call LLM Outcome Judge
    const rawResponse = await chatJson({ system, user, model });
    completeRunSuccess(judgeRunId, rawResponse);

    // 6. Parse and validate with Zod
    outcomeResult = OutcomeResultSchema.parse(rawResponse);
  } catch (err) {
    completeRunFailure(judgeRunId, "runtime_exception", err.message || err.toString(), "system");
    
    // If LLM is disabled, return specific error
    if (err instanceof LlmDisabledError || err.code === "LLM_DISABLED") {
      return {
        ok: false,
        error: { message: "LLM features are disabled", code: "LLM_DISABLED" }
      };
    }

    return {
      ok: false,
      error: { message: `Outcome check failed: ${err.message}` }
    };
  }

  // 7. Insert outcome_runs record
  const outcomeRunId = `outcome_run_${nanoid(12)}`;
  const now = new Date().toISOString();

  // Build details JSON including metrics
  const detailsObj = {
    metrics: outcomeResult.metrics || [],
    raw_llm_output: outcomeResult,
    ...outcomeResult.details
  };

  try {
    db.prepare(
      `INSERT INTO outcome_runs 
       (id, spec_id, run_id, task, status, model, best_candidate_id, request_json, result_json, created_at, input, style, constraints, n)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      outcomeRunId,
      outcomeSpecId,
      runId,
      spec.title || "Outcome evaluation",
      "success",
      model,
      null, // best_candidate_id (N/A for simple outcome check)
      JSON.stringify({ system, user }),
      JSON.stringify({
        score: outcomeResult.score,
        verdict: outcomeResult.verdict,
        summary: outcomeResult.summary,
        details: detailsObj
      }),
      now,
      null, // input
      null, // style
      null, // constraints
      0     // n (not generating candidates in this function)
    );
  } catch (dbErr) {
    return {
      ok: false,
      error: { message: `Failed to insert outcome_runs record: ${dbErr.message}` }
    };
  }

  // 8. Optionally insert per-metric records into outcome_candidates
  // (We can treat each metric as a "candidate" with metric-specific scores)
  const metrics = outcomeResult.metrics || [];
  const candidateIds = [];

  for (let i = 0; i < metrics.length; i++) {
    const metric = metrics[i];
    const candidateId = `cand_${nanoid(12)}`;
    candidateIds.push(candidateId);

    try {
      db.prepare(
        `INSERT INTO outcome_candidates
         (id, outcome_run_id, candidate_index, content, llm_score, final_score, tests_passed, tests_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        candidateId,
        outcomeRunId,
        i,
        metric.name, // Use metric name as content
        metric.score || null,
        metric.score || null,
        metric.passed === true ? 1 : (metric.passed === false ? 0 : null),
        JSON.stringify(metric),
        now
      );
    } catch (candErr) {
      console.warn(`[outcomeRunner] Failed to insert metric candidate: ${candErr.message}`);
      // Continue even if candidate insert fails
    }
  }

  // 9. Return normalized result
  return {
    ok: true,
    outcomeRun: {
      id: outcomeRunId,
      runId,
      outcomeSpecId,
      status: "success",
      score: outcomeResult.score,
      verdict: outcomeResult.verdict,
      summary: outcomeResult.summary,
      createdAt: now
    },
    metrics: metrics.map((m, idx) => ({
      id: candidateIds[idx],
      name: m.name,
      score: m.score,
      passed: m.passed,
      details: m.details
    }))
  };
}

