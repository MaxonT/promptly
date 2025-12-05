import { Router } from "express";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "../lib/db.js";
import { buildEvaluationMetrics } from "../lib/metricsEngine.js";
import { isValidModel, getModelConfig, MODEL_REGISTRY } from "../lib/modelRegistry.js";

export const outcomeRunsRouter = Router();

/**
 * Field definitions for Layer 2/3 data
 * Used for logging and validation consistency
 */
const LAYER_FIELDS = {
  layer2: ['input', 'style', 'constraints', 'blueprintInstructions', 'blueprintExamples', 'blueprintConstraints'],
  layer3: ['posNegDataset', 'schemaTemplate', 'optimizationKnobs', 'dataset', 'schema', 'tests', 'temperature']
};

/**
 * Logging utility for Layer 2/3 data verification
 * @param {string} stage - Processing stage name
 * @param {Object} data - Data to log
 */
function logLayerData(stage, data) {
  const layer2Present = LAYER_FIELDS.layer2.filter(f => data[f]);
  const layer3Present = LAYER_FIELDS.layer3.filter(f => data[f]);
  
  console.log(`[outcomeRunner] ${stage}:`);
  console.log(`  - Task: ${data.task?.substring(0, 50)}${data.task?.length > 50 ? '...' : ''}`);
  console.log(`  - Model: ${data.model || 'default'}`);
  console.log(`  - Candidates (n): ${data.n || 4}`);
  console.log(`  - Layer 2 fields present: [${layer2Present.join(', ') || 'none'}]`);
  console.log(`  - Layer 3 fields present: [${layer3Present.join(', ') || 'none'}]`);
}

/**
 * OutcomeRun Request Schema with Layer 2/3 validation
 * 
 * Required fields:
 * - task: Main task description (Layer 1)
 * 
 * Optional Layer 1 fields:
 * - model: Which Promptly model to use
 * - n: Number of candidates to generate (1-8)
 * 
 * Optional Layer 2 fields (Blueprint sync):
 * - input: Additional context/instructions
 * - style: Style/demonstration examples
 * - constraints: Formatting rules, length limits
 * - blueprintInstructions: Detailed instructions blueprint
 * - blueprintExamples: Input/output pairs
 * - blueprintConstraints: Specific constraints
 * 
 * Optional Layer 3 fields (Expert lab):
 * - posNegDataset: Positive/negative examples
 * - schemaTemplate: Output structure requirements
 * - optimizationKnobs: Fine-tuning parameters
 * - dataset: Alternative name for POS/NEG data
 * - schema: Alternative name for schema template
 * - tests: Test configuration object
 * - temperature: LLM temperature setting (0-2)
 */
const OutcomeRunRequestSchema = z.object({
  // Layer 1 (required)
  task: z.string().trim().min(1, "Task description is required"),
  
  // Layer 1 (optional)
  model: z.string().optional(),
  n: z.number().int().min(1).max(8).optional(),
  examples: z.string().optional(),
  
  // Layer 2 fields (Blueprint sync)
  input: z.string().optional(),
  style: z.string().optional(),
  constraints: z.string().optional(),
  blueprintInstructions: z.string().optional(),
  blueprintExamples: z.string().optional(),
  blueprintConstraints: z.string().optional(),
  
  // Layer 3 fields (Expert lab)
  posNegDataset: z.string().optional(),
  schemaTemplate: z.string().optional(),
  optimizationKnobs: z.string().optional(),
  dataset: z.string().optional(),
  schema: z.string().optional(),
  tests: z.record(z.any()).optional(),
  temperature: z.number().min(0).max(2).optional(),
  
  // Metadata
  _meta: z.object({
    layer2Used: z.boolean().optional(),
    layer3Used: z.boolean().optional(),
    timestamp: z.string().optional(),
    version: z.string().optional()
  }).optional()
});

outcomeRunsRouter.post("/", (req, res) => {
  const parsed = OutcomeRunRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    console.log("[outcomeRunner] Validation failed:", parsed.error.flatten());
    return res.status(400).json({ ok: false, error: parsed.error.flatten() });
  }

  // Log incoming Layer 2/3 data for verification
  logLayerData("Request received", parsed.data);

  const { 
    task, 
    input, 
    style, 
    constraints, 
    tests, 
    model,
    examples,
    temperature,
    // Layer 2 fields
    blueprintInstructions,
    blueprintExamples,
    blueprintConstraints,
    // Layer 3 fields
    posNegDataset,
    schemaTemplate,
    optimizationKnobs,
    dataset,
    schema,
    // Metadata
    _meta
  } = parsed.data;
  const n = parsed.data.n ?? 4;
  const now = new Date().toISOString();
  const outcomeRunId = `outcome_run_${nanoid(12)}`;

  // Validate and resolve model
  const resolvedModel = model && isValidModel(model) ? model : 'promptly-mini';
  const modelConfig = getModelConfig(resolvedModel);
  
  console.log(`[outcomeRunner] Using model: ${resolvedModel} -> ${modelConfig?.model || 'gpt-4o-mini'}`);
  if (model && !isValidModel(model)) {
    console.log(`[outcomeRunner] Warning: Invalid model "${model}", using default "${resolvedModel}"`);
  }

  // Build prompt content incorporating all Layer 2/3 inputs
  const buildPromptContent = () => {
    const parts = [task];
    
    // Layer 1: Examples/context
    if (examples) parts.push(`\nExamples: ${examples}`);
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
    const posNegData = posNegDataset || dataset;
    const schemaData = schemaTemplate || schema;
    
    if (posNegData) {
      parts.push(`\n\n[POS/NEG Dataset]\n${posNegData}`);
    }
    if (schemaData) {
      parts.push(`\n\n[Schema Template]\n${schemaData}`);
    }
    if (optimizationKnobs) {
      parts.push(`\n\n[Optimization Knobs]\n${optimizationKnobs}`);
    }
    
    // Log that Layer 2/3 data is being used in prompt construction
    const hasLayer2 = blueprintInstructions || blueprintExamples || blueprintConstraints || input || style || constraints;
    const hasLayer3 = posNegData || schemaData || optimizationKnobs;
    
    if (hasLayer2 || hasLayer3) {
      console.log(`[outcomeRunner] Prompt includes: Layer2=${!!hasLayer2}, Layer3=${!!hasLayer3}`);
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
      resolvedModel,
      modelConfig: modelConfig ? {
        id: modelConfig.id,
        model: modelConfig.model,
        tier: modelConfig.tier,
        category: modelConfig.category
      } : null,
      layer2: {
        blueprintInstructions: blueprintInstructions || null,
        blueprintExamples: blueprintExamples || null,
        blueprintConstraints: blueprintConstraints || null,
        input: input || null,
        style: style || null,
        constraints: constraints || null
      },
      layer3: {
        posNegDataset: posNegDataset || dataset || null,
        schemaTemplate: schemaTemplate || schema || null,
        optimizationKnobs: optimizationKnobs || null,
        tests: tests || null,
        temperature: temperature || null
      },
      _meta: _meta || null
    };
    
    // Log final request data summary
    console.log(`[outcomeRunner] Storing outcome run: ${outcomeRunId}`);
    console.log(`  - Layer 2 used: ${!!_meta?.layer2Used || !!(input || style || constraints || blueprintInstructions)}`);
    console.log(`  - Layer 3 used: ${!!_meta?.layer3Used || !!(posNegDataset || dataset || schemaTemplate || schema)}`);

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
      resolvedModel,
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

// GET /api/outcome-runs/latest - return the most recent outcome run with best prompt content
outcomeRunsRouter.get("/latest", (req, res) => {
  const row = db
    .prepare("SELECT * FROM outcome_runs ORDER BY created_at DESC LIMIT 1")
    .get();

  if (!row) {
    return res.status(404).json({ ok: false, error: "No outcome runs found" });
  }

  let request = null;
  let result = null;

  try {
    request = row.request_json ? JSON.parse(row.request_json) : null;
  } catch (e) {
    console.warn("[outcomeRuns] Failed to parse request_json", e);
  }

  try {
    result = row.result_json ? JSON.parse(row.result_json) : null;
  } catch (e) {
    console.warn("[outcomeRuns] Failed to parse result_json", e);
  }

  const best = result?.best || null;
  const metrics = result?.metrics || best?.metrics || null;

  return res.json({
    ok: true,
    run: {
      ...row,
      request,
      result,
      metrics
    }
  });
});

/**
 * GET /api/outcome-runs/models/status
 * 
 * Returns list of all available models with their status:
 * - id: Promptly model identifier (e.g., 'promptly-mini')
 * - label: Human-readable label
 * - status: 'active' (real model) or 'placeholder' (maps to different future model)
 * - actualModel: The actual OpenAI model used
 * - futureModel: Planned upgrade model (if different)
 * - tier: Model tier (mini, standard, plus, pro, pro-max)
 * - category: Model category (general, code)
 * - description: Brief description
 * - costIndicator: Visual cost indicator
 * - speedIndicator: Visual speed indicator
 */
outcomeRunsRouter.get("/models/status", (req, res) => {
  const models = Object.values(MODEL_REGISTRY).map(config => ({
    id: config.id,
    label: config.label,
    status: config.model === config._futureModel ? 'active' : 'placeholder',
    actualModel: config.model,
    futureModel: config._futureModel,
    tier: config.tier,
    category: config.category,
    description: config.description,
    maxTokens: config.maxTokens,
    costMultiplier: config.costMultiplier,
    speedMultiplier: config.speedMultiplier,
    costIndicator: '💰'.repeat(Math.min(5, Math.ceil(config.costMultiplier / 2))),
    speedIndicator: '⚡'.repeat(Math.min(5, Math.ceil(config.speedMultiplier * 2))),
    supportsJson: config.supportsJson,
    hasSystemSuffix: !!config.systemPromptSuffix
  }));

  // Group by category for easier display
  const grouped = {
    general: models.filter(m => m.category === 'general'),
    code: models.filter(m => m.category === 'code')
  };

  return res.json({
    ok: true,
    models,
    grouped,
    meta: {
      totalModels: models.length,
      activeModels: models.filter(m => m.status === 'active').length,
      placeholderModels: models.filter(m => m.status === 'placeholder').length,
      categories: ['general', 'code'],
      tiers: ['mini', 'standard', 'plus', 'pro', 'pro-max']
    }
  });
});
