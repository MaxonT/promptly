import { Router } from "express";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "../lib/db.js";
import { classifyError } from "../lib/errorClassifier.js";
import { generateRepairPlan } from "../lib/repairEngine.js";
import { runOutcomeCheck } from "../lib/outcomeRunner.js";

export const runsRouter = Router();

const CreateRunSchema = z.object({
  spec_id: z.string().optional(),
  spec_version: z.string().optional(),
  model: z.string().min(1),
  input_blocks: z.any()
});

const CreateErrorSchema = z.object({
  error_type: z.string().optional(),
  details: z.string(),
  detected_by: z.string().optional()
});

const OutcomeRunRequestSchema = z.object({
  outcome_spec_id: z.string().min(1),
  model: z.string().min(1).optional()
});

// POST /api/runs - Create a new run
runsRouter.post("/", (req, res) => {
  const parsed = CreateRunSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: parsed.error.flatten() });
  }

  const { spec_id, spec_version, model, input_blocks } = parsed.data;
  const runId = `run_${nanoid(16)}`;
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO runs 
     (id, spec_id, spec_version, model, status, input_blocks, created_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    runId,
    spec_id || null,
    spec_version || null,
    model,
    "pending",
    JSON.stringify(input_blocks),
    now
  );

  const run = db.prepare("SELECT * FROM runs WHERE id = ?").get(runId);

  return res.json({ ok: true, run });
});

// GET /api/runs/:id - Get a specific run
runsRouter.get("/:id", (req, res) => {
  const { id } = req.params;
  const run = db.prepare("SELECT * FROM runs WHERE id = ?").get(id);

  if (!run) {
    return res.status(404).json({ ok: false, error: "Run not found" });
  }

  return res.json({ ok: true, run });
});

// GET /api/runs - List all runs (with optional filters)
runsRouter.get("/", (req, res) => {
  const { spec_id, status, limit = "50" } = req.query;
  
  let query = "SELECT * FROM runs WHERE 1=1";
  const params = [];

  if (spec_id) {
    query += " AND spec_id = ?";
    params.push(spec_id);
  }

  if (status) {
    query += " AND status = ?";
    params.push(status);
  }

  query += " ORDER BY created_at DESC LIMIT ?";
  params.push(parseInt(limit, 10));

  const runs = db.prepare(query).all(...params);

  return res.json({ ok: true, runs });
});

// POST /api/runs/:id/errors - Add an error to a run
runsRouter.post("/:id/errors", (req, res) => {
  const { id } = req.params;
  const parsed = CreateErrorSchema.safeParse(req.body);
  
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: parsed.error.flatten() });
  }

  const run = db.prepare("SELECT * FROM runs WHERE id = ?").get(id);
  if (!run) {
    return res.status(404).json({ ok: false, error: "Run not found" });
  }

  let { error_type, details, detected_by } = parsed.data;

  // If error_type is not provided, try to classify it
  if (!error_type) {
    const rawOutput = run.raw_output || "";
    const classification = classifyError(rawOutput, details);
    error_type = classification.error_type;
  }

  const errorId = `err_${nanoid(16)}`;
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO run_errors 
     (id, run_id, error_type, details, detected_by, created_at) 
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    errorId,
    id,
    error_type,
    details,
    detected_by || "user",
    now
  );

  // Update run status to failed if not already
  if (run.status !== "failed") {
    db.prepare("UPDATE runs SET status = ? WHERE id = ?").run("failed", id);
  }

  const error = db.prepare("SELECT * FROM run_errors WHERE id = ?").get(errorId);

  return res.json({ ok: true, error });
});

// GET /api/runs/:id/errors - Get all errors for a run
runsRouter.get("/:id/errors", (req, res) => {
  const { id } = req.params;
  
  const run = db.prepare("SELECT * FROM runs WHERE id = ?").get(id);
  if (!run) {
    return res.status(404).json({ ok: false, error: "Run not found" });
  }

  const errors = db
    .prepare("SELECT * FROM run_errors WHERE run_id = ? ORDER BY created_at ASC")
    .all(id);

  return res.json({ ok: true, errors });
});

// POST /api/runs/:id/repair - Generate a repair plan
runsRouter.post("/:id/repair", async (req, res) => {
  const { id } = req.params;

  const run = db.prepare("SELECT * FROM runs WHERE id = ?").get(id);
  if (!run) {
    return res.status(404).json({ ok: false, error: "Run not found" });
  }

  const errors = db
    .prepare("SELECT * FROM run_errors WHERE run_id = ? ORDER BY created_at ASC")
    .all(id);

  // Try to load related spec and compiled prompt if spec_id is available
  let spec = null;
  let compiledPrompt = null;

  if (run.spec_id) {
    const specRow = db.prepare("SELECT * FROM specs WHERE id = ?").get(run.spec_id);
    if (specRow) {
      try {
        spec = JSON.parse(specRow.spec_json);
      } catch (e) {
        // Ignore parse errors
      }
    }

    const cpRow = db
      .prepare("SELECT * FROM compiled_prompts WHERE spec_id = ? ORDER BY created_at DESC LIMIT 1")
      .get(run.spec_id);
    if (cpRow) {
      try {
        compiledPrompt = {
          blocks: JSON.parse(cpRow.compiled_json),
          explanation: cpRow.explanation
        };
      } catch (e) {
        // Ignore parse errors
      }
    }
  }

  try {
    const repair = await generateRepairPlan({
      spec,
      compiledPrompt,
      run,
      errors
    });

    return res.json({ ok: true, repair });
  } catch (err) {
    console.error("[promptly] repair plan generation failed", err);
    return res.status(500).json({ ok: false, error: "Repair plan generation failed" });
  }
});

// POST /api/runs/:id/outcomes - Trigger an outcome evaluation for a run
runsRouter.post("/:id/outcomes", async (req, res) => {
  const { id } = req.params;

  // 1) Validate body
  const parsed = OutcomeRunRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      ok: false,
      error: "Invalid request body",
      details: parsed.error.flatten()
    });
  }

  const { outcome_spec_id, model } = parsed.data;

  // 2) Ensure run exists
  const run = db.prepare("SELECT * FROM runs WHERE id = ?").get(id);
  if (!run) {
    return res.status(404).json({ ok: false, error: "Run not found" });
  }

  try {
    // 3) Call Outcome Runner
    const result = await runOutcomeCheck({
      runId: id,
      outcomeSpecId: outcome_spec_id,
      modelOverride: model
    });

    if (!result.ok) {
      return res.status(500).json({
        ok: false,
        error: result.error?.message || "Outcome check failed"
      });
    }

    return res.status(201).json({
      ok: true,
      outcome_run: result.outcomeRun,
      metrics: result.metrics ?? []
    });
  } catch (err) {
    console.error("[promptly] outcome check failed", err);
    return res.status(500).json({ ok: false, error: "Outcome check failed" });
  }
});

