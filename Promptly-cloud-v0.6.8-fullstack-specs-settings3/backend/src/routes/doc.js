import { Router } from "express";
import { db } from "../lib/db.js";
import { nanoid } from "nanoid";
import { requireAuth } from "./auth.js";
import { z } from "zod";

export const docRouter = Router();
const DocSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(0),
});

docRouter.get("/", requireAuth, (req, res) => {
  const rows = db.prepare("SELECT * FROM docs WHERE owner_id = ? ORDER BY updated_at DESC")
    .all(req.user.sub);
  res.json({ ok: true, items: rows });
});

docRouter.post("/", requireAuth, (req, res) => {
  const parse = DocSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ ok: false, error: "Invalid body" });
  const id = nanoid(16);
  const now = new Date().toISOString();
  db.prepare("INSERT INTO docs (id,owner_id,title,content,version,updated_at) VALUES (?,?,?,?,?,?)")
    .run(id, req.user.sub, parse.data.title, parse.data.content, 1, now);
  const row = db.prepare("SELECT * FROM docs WHERE id = ?").get(id);
  res.status(201).json({ ok: true, item: row });
});

docRouter.put("/:id", requireAuth, (req, res) => {
  const id = req.params.id;
  const { title, content, baseVersion } = req.body || {};
  if (typeof baseVersion !== "number") {
    return res.status(400).json({ ok: false, error: "Missing baseVersion" });
  }
  const row = db.prepare("SELECT * FROM docs WHERE id = ? AND owner_id = ?").get(id, req.user.sub);
  if (!row) return res.status(404).json({ ok: false, error: "Not found" });

  if (row.version !== baseVersion) {
    const merged = mergeContent(row.content, content);
    const newVersion = row.version + 1;
    db.prepare("UPDATE docs SET title = ?, content = ?, version = ?, updated_at = ? WHERE id = ?")
      .run(title || row.title, merged, newVersion, new Date().toISOString(), id);
    const updated = db.prepare("SELECT * FROM docs WHERE id = ?").get(id);
    return res.status(409).json({ ok: false, conflict: true, item: updated });
  } else {
    const newVersion = row.version + 1;
    db.prepare("UPDATE docs SET title = ?, content = ?, version = ?, updated_at = ? WHERE id = ?")
      .run(title || row.title, content, newVersion, new Date().toISOString(), id);
    const updated = db.prepare("SELECT * FROM docs WHERE id = ?").get(id);
    return res.json({ ok: true, item: updated });
  }
});

docRouter.delete("/:id", requireAuth, (req, res) => {
  const id = req.params.id;
  db.prepare("DELETE FROM docs WHERE id = ? AND owner_id = ?").run(id, req.user.sub);
  res.json({ ok: true });
});

function mergeContent(base, incoming) {
  if (incoming === base) return base;
  return base + "\n\n----- MERGED SECTION (" + new Date().toISOString() + ") -----\n\n" + incoming;
}
