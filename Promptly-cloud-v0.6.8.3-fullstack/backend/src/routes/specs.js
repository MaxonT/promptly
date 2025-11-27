import { Router } from "express";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "../lib/db.js";
import { compileSpecToPrompt } from "../lib/specCompiler.js";
import { evaluatePrompt } from "../lib/evaluationEngine.js";
import { LlmDisabledError } from "../lib/openaiClient.js";

export const specsRouter = Router();

const CreateSpecSchema = z.object({
  title: z.string().min(1),
  kind: z.string().optional(),
  summary: z.string().optional(),
  tech_stack: z.object({
    frontend: z.string().optional(),
    backend: z.string().optional(),
    frameworks: z.array(z.string()).optional()
  }).optional(),
  pages: z.array(z.object({
    route: z.string(),
    purpose: z.string().optional(),
    components: z.array(z.string()).optional()
  })).optional(),
  data_model: z.array(z.object({
    entity: z.string(),
    fields: z.array(z.any()).optional()
  })).optional(),
  constraints: z.record(z.any()).optional(),
  status: z.enum(["draft", "compiled", "archived"]).optional(),
  spec: z.record(z.any())
});

function requireOwner(row, userId) {
  if (!row) return false;
  if (row.owner_id && row.owner_id !== userId) return false;
  return true;
}

// NOTE: real auth middleware should populate req.user; for demo we fallback to a demo id.
function getUserId(req) {
  if (req.user && req.user.sub) return req.user.sub;
  return "demo-user";
}

// Helper to safely parse JSON fields
function safeParseJSON(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

// S2: Enhanced spec listing with filters and pagination
specsRouter.get("/", (req, res) => {
  try {
    const userId = getUserId(req);
    
    // Parse and validate query parameters
    const {
      owner_id,
      project_id,
      status,
      kind,
      q
    } = req.query;
    
    // Parse pagination params
    let limit = parseInt(req.query.limit || "20", 10);
    let offset = parseInt(req.query.offset || "0", 10);
    
    // Validate and clamp pagination
    if (isNaN(limit) || limit < 1) limit = 20;
    if (limit > 100) limit = 100;
    if (isNaN(offset) || offset < 0) offset = 0;
    
    // Build dynamic WHERE clause
    const conditions = ["owner_id = ?"];
    const params = [userId];
    
    if (owner_id) {
      conditions[0] = "owner_id = ?";
      params[0] = owner_id;
    }
    
    if (project_id) {
      conditions.push("project_id = ?");
      params.push(project_id);
    }
    
    if (status) {
      conditions.push("status = ?");
      params.push(status);
    }
    
    if (kind) {
      conditions.push("kind = ?");
      params.push(kind);
    }
    
    if (q && q.trim()) {
      conditions.push("(title LIKE ? OR summary LIKE ?)");
      const searchTerm = `%${q.trim()}%`;
      params.push(searchTerm, searchTerm);
    }
    
    const whereClause = conditions.join(" AND ");
    
    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM specs WHERE ${whereClause}`;
    const countResult = db.prepare(countQuery).get(...params);
    const total = countResult ? countResult.count : 0;
    
    // Build main query
    const query = `
      SELECT
        id,
        owner_id,
        project_id,
        kind,
        title,
        summary,
        tech_stack,
        pages,
        data_model,
        constraints,
        status,
        version,
        created_at,
        updated_at
      FROM specs
      WHERE ${whereClause}
      ORDER BY updated_at DESC
      LIMIT ?
      OFFSET ?
    `;
    
    params.push(limit, offset);
    const rows = db.prepare(query).all(...params);
    
    // Map rows to structured spec objects with parsed JSON
    const items = rows.map((row) => ({
      id: row.id,
      owner_id: row.owner_id,
      project_id: row.project_id,
      kind: row.kind,
      title: row.title,
      summary: row.summary,
      status: row.status,
      version: row.version,
      tech_stack: safeParseJSON(row.tech_stack) || {},
      pages: safeParseJSON(row.pages) || [],
      data_model: safeParseJSON(row.data_model) || [],
      constraints: safeParseJSON(row.constraints),
      created_at: row.created_at,
      updated_at: row.updated_at
    }));
    
    return res.json({
      ok: true,
      items,
      pagination: {
        limit,
        offset,
        total
      }
    });
  } catch (err) {
    console.error("[promptly] spec list query failed", err);
    return res.status(500).json({ ok: false, error: "Failed to list specs" });
  }
});

specsRouter.post("/", (req, res) => {
  const userId = getUserId(req);
  const parsed = CreateSpecSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: parsed.error.flatten() });
  }
  const { title, kind, summary, tech_stack, pages, data_model, constraints, status, spec } = parsed.data;
  const now = new Date().toISOString();
  const id = `spec_${nanoid(12)}`;
  db.prepare(`
    INSERT INTO specs (id, owner_id, kind, title, summary, tech_stack, pages, data_model, constraints, spec_json, status, version, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    userId,
    kind || null,
    title,
    summary || null,
    tech_stack ? JSON.stringify(tech_stack) : null,
    pages ? JSON.stringify(pages) : null,
    data_model ? JSON.stringify(data_model) : null,
    constraints ? JSON.stringify(constraints) : null,
    JSON.stringify(spec),
    status || "draft",
    1,
    now,
    now
  );
  res.json({ ok: true, id });
});

specsRouter.get("/:id", (req, res) => {
  const userId = getUserId(req);
  const row = db.prepare("SELECT * FROM specs WHERE id = ?").get(req.params.id);
  if (!requireOwner(row, userId)) {
    return res.status(404).json({ ok: false, error: "Not found" });
  }
  
  // Parse structured JSON fields
  const tech_stack = row.tech_stack ? JSON.parse(row.tech_stack) : null;
  const pages = row.pages ? JSON.parse(row.pages) : [];
  const data_model = row.data_model ? JSON.parse(row.data_model) : [];
  const constraints = row.constraints ? JSON.parse(row.constraints) : null;
  
  res.json({
    ok: true,
    id: row.id,
    kind: row.kind,
    title: row.title,
    summary: row.summary,
    tech_stack,
    pages,
    data_model,
    constraints,
    status: row.status,
    version: row.version,
    spec: JSON.parse(row.spec_json),
    created_at: row.created_at,
    updated_at: row.updated_at
  });
});

specsRouter.patch("/:id", (req, res) => {
  const userId = getUserId(req);
  const parsed = CreateSpecSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: parsed.error.flatten() });
  }
  const { title, kind, summary, tech_stack, pages, data_model, constraints, status, spec } = parsed.data;
  const row = db.prepare("SELECT * FROM specs WHERE id = ?").get(req.params.id);
  if (!requireOwner(row, userId)) {
    return res.status(404).json({ ok: false, error: "Not found" });
  }
  const now = new Date().toISOString();
  const version = row.version + 1;
  db.prepare(`
    UPDATE specs
    SET title = ?, kind = ?, summary = ?, tech_stack = ?, pages = ?, data_model = ?, constraints = ?, spec_json = ?, status = ?, version = ?, updated_at = ?
    WHERE id = ?
  `).run(
    title,
    kind || row.kind,
    summary || row.summary,
    tech_stack ? JSON.stringify(tech_stack) : row.tech_stack,
    pages ? JSON.stringify(pages) : row.pages,
    data_model ? JSON.stringify(data_model) : row.data_model,
    constraints ? JSON.stringify(constraints) : row.constraints,
    JSON.stringify(spec),
    status || row.status,
    version,
    now,
    req.params.id
  );
  res.json({ ok: true, version });
});

specsRouter.post("/:id/compile", (req, res) => {
  const userId = getUserId(req);
  const row = db.prepare("SELECT * FROM specs WHERE id = ?").get(req.params.id);
  if (!requireOwner(row, userId)) {
    return res.status(404).json({ ok: false, error: "Not found" });
  }
  const spec = JSON.parse(row.spec_json);
  const compiled = compileSpecToPrompt(spec);
  const now = new Date().toISOString();
  const cpId = `cp_${nanoid(12)}`;
  db.prepare(`
    INSERT INTO compiled_prompts (id, spec_id, compiled_json, explanation, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(cpId, row.id, JSON.stringify(compiled.blocks), compiled.explanation, now);
  res.json({
    ok: true,
    id: cpId,
    compiled_prompt: compiled
  });
});

// POST /api/specs/:id/evaluate - Evaluate an existing compiled prompt
specsRouter.post("/:id/evaluate", async (req, res) => {
  const userId = getUserId(req);
  const row = db.prepare("SELECT * FROM specs WHERE id = ?").get(req.params.id);
  if (!requireOwner(row, userId)) {
    return res.status(404).json({ ok: false, error: "Not found" });
  }

  try {
    const spec = JSON.parse(row.spec_json);
    
    // Get the most recent compiled prompt for this spec, or compile it now
    let cpRow = db
      .prepare("SELECT * FROM compiled_prompts WHERE spec_id = ? ORDER BY created_at DESC LIMIT 1")
      .get(req.params.id);
    
    let compiledPrompt;
    let cpId;
    
    if (cpRow) {
      // Use existing compiled prompt
      cpId = cpRow.id;
      compiledPrompt = {
        blocks: JSON.parse(cpRow.compiled_json),
        explanation: cpRow.explanation
      };
    } else {
      // Compile the prompt on-the-fly (but don't save it)
      compiledPrompt = compileSpecToPrompt(spec);
      const now = new Date().toISOString();
      cpId = `cp_${nanoid(12)}`;
      db.prepare(`
        INSERT INTO compiled_prompts (id, spec_id, compiled_json, explanation, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(cpId, row.id, JSON.stringify(compiledPrompt.blocks), compiledPrompt.explanation, now);
    }

    // Evaluate the prompt
    const model = req.body.model || process.env.OPENAI_MODEL || "gpt-4.1-mini";
    const evaluation = await evaluatePrompt({ spec, compiledPrompt, model });

    // Store evaluation
    const now = new Date().toISOString();
    const evalId = `eval_${nanoid(12)}`;
    db.prepare(`
      INSERT INTO evaluations 
      (id, spec_id, compiled_prompt_id, run_id, model, score, verdict, summary, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      evalId,
      row.id,
      cpId,
      evaluation.runId || null,
      model,
      evaluation.score,
      evaluation.verdict,
      evaluation.summary,
      evaluation.details,
      now
    );

    res.json({
      ok: true,
      evaluation: {
        id: evalId,
        spec_id: row.id,
        compiled_prompt_id: cpId,
        run_id: evaluation.runId,
        model,
        score: evaluation.score,
        verdict: evaluation.verdict,
        summary: evaluation.summary,
        details: JSON.parse(evaluation.details),
        created_at: now
      }
    });
  } catch (err) {
    console.error("[promptly] evaluation failed", err);
    if (err instanceof LlmDisabledError || err.code === "LLM_DISABLED") {
      return res.status(503).json({ ok: false, error: "LLM disabled" });
    }
    return res.status(502).json({ ok: false, error: "Evaluation failed" });
  }
});

// POST /api/specs/:id/compile-and-evaluate - Compile and evaluate in one call
specsRouter.post("/:id/compile-and-evaluate", async (req, res) => {
  const userId = getUserId(req);
  const row = db.prepare("SELECT * FROM specs WHERE id = ?").get(req.params.id);
  if (!requireOwner(row, userId)) {
    return res.status(404).json({ ok: false, error: "Not found" });
  }

  try {
    const spec = JSON.parse(row.spec_json);
    
    // Compile the prompt
    const compiled = compileSpecToPrompt(spec);
    const now = new Date().toISOString();
    const cpId = `cp_${nanoid(12)}`;
    db.prepare(`
      INSERT INTO compiled_prompts (id, spec_id, compiled_json, explanation, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(cpId, row.id, JSON.stringify(compiled.blocks), compiled.explanation, now);

    // Evaluate the compiled prompt
    const model = req.body.model || process.env.OPENAI_MODEL || "gpt-4.1-mini";
    const evaluation = await evaluatePrompt({ spec, compiledPrompt: compiled, model });

    // Store evaluation
    const evalId = `eval_${nanoid(12)}`;
    const evalNow = new Date().toISOString();
    db.prepare(`
      INSERT INTO evaluations 
      (id, spec_id, compiled_prompt_id, run_id, model, score, verdict, summary, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      evalId,
      row.id,
      cpId,
      evaluation.runId || null,
      model,
      evaluation.score,
      evaluation.verdict,
      evaluation.summary,
      evaluation.details,
      evalNow
    );

    res.json({
      ok: true,
      compiled_prompt: {
        id: cpId,
        blocks: compiled.blocks,
        explanation: compiled.explanation
      },
      evaluation: {
        id: evalId,
        spec_id: row.id,
        compiled_prompt_id: cpId,
        run_id: evaluation.runId,
        model,
        score: evaluation.score,
        verdict: evaluation.verdict,
        summary: evaluation.summary,
        details: JSON.parse(evaluation.details),
        created_at: evalNow
      }
    });
  } catch (err) {
    console.error("[promptly] compile-and-evaluate failed", err);
    if (err instanceof LlmDisabledError || err.code === "LLM_DISABLED") {
      return res.status(503).json({ ok: false, error: "LLM disabled" });
    }
    return res.status(502).json({ ok: false, error: "Compile and evaluate failed" });
  }
});

// GET /api/specs/:id/evaluations - List all evaluations for a spec
specsRouter.get("/:id/evaluations", (req, res) => {
  const userId = getUserId(req);
  const row = db.prepare("SELECT * FROM specs WHERE id = ?").get(req.params.id);
  if (!requireOwner(row, userId)) {
    return res.status(404).json({ ok: false, error: "Not found" });
  }

  const evaluations = db
    .prepare(`
      SELECT 
        e.*,
        cp.explanation as compiled_prompt_explanation
      FROM evaluations e
      LEFT JOIN compiled_prompts cp ON e.compiled_prompt_id = cp.id
      WHERE e.spec_id = ?
      ORDER BY e.created_at DESC
    `)
    .all(req.params.id);

  const formattedEvaluations = evaluations.map(ev => ({
    id: ev.id,
    spec_id: ev.spec_id,
    compiled_prompt_id: ev.compiled_prompt_id,
    run_id: ev.run_id,
    model: ev.model,
    score: ev.score,
    verdict: ev.verdict,
    summary: ev.summary,
    details: ev.details ? JSON.parse(ev.details) : null,
    created_at: ev.created_at
  }));

  res.json({
    ok: true,
    evaluations: formattedEvaluations
  });
});
