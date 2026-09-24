import { Router } from "express";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "../lib/db.js";
import { compileSpecToPrompt } from "../lib/specCompiler.js";

export const specsRouter = Router();

const CreateSpecSchema = z.object({
  title: z.string().min(1),
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

specsRouter.get("/", (req, res) => {
  const userId = getUserId(req);
  const rows = db
    .prepare("SELECT id, title, version, created_at, updated_at FROM specs WHERE owner_id = ? ORDER BY updated_at DESC")
    .all(userId);
  res.json({ ok: true, items: rows });
});

specsRouter.post("/", (req, res) => {
  const userId = getUserId(req);
  const parsed = CreateSpecSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: parsed.error.flatten() });
  }
  const { title, spec } = parsed.data;
  const now = new Date().toISOString();
  const id = `spec_${nanoid(12)}`;
  db.prepare(`
    INSERT INTO specs (id, owner_id, title, spec_json, version, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, title, JSON.stringify(spec), 1, now, now);
  res.json({ ok: true, id });
});

specsRouter.get("/:id", (req, res) => {
  const userId = getUserId(req);
  const row = db.prepare("SELECT * FROM specs WHERE id = ?").get(req.params.id);
  if (!requireOwner(row, userId)) {
    return res.status(404).json({ ok: false, error: "Not found" });
  }
  res.json({
    ok: true,
    id: row.id,
    title: row.title,
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
  const { title, spec } = parsed.data;
  const row = db.prepare("SELECT * FROM specs WHERE id = ?").get(req.params.id);
  if (!requireOwner(row, userId)) {
    return res.status(404).json({ ok: false, error: "Not found" });
  }
  const now = new Date().toISOString();
  const version = row.version + 1;
  db.prepare(`
    UPDATE specs
    SET title = ?, spec_json = ?, version = ?, updated_at = ?
    WHERE id = ?
  `).run(title, JSON.stringify(spec), version, now, req.params.id);
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
