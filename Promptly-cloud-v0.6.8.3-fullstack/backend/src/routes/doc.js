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

// Cache prepared statements for better performance
const stmtCache = {
  listByOwner: db.prepare("SELECT * FROM docs WHERE owner_id = ? ORDER BY updated_at DESC"),
  insertDoc: db.prepare("INSERT INTO docs (id,owner_id,title,content,version,created_at,updated_at) VALUES (?,?,?,?,?,?,?)"),
  getById: db.prepare("SELECT * FROM docs WHERE id = ?"),
  getByIdAndOwner: db.prepare("SELECT * FROM docs WHERE id = ? AND owner_id = ?"),
  updateDoc: db.prepare("UPDATE docs SET title = ?, content = ?, version = ?, updated_at = ? WHERE id = ?"),
  deleteByIdAndOwner: db.prepare("DELETE FROM docs WHERE id = ? AND owner_id = ?")
};

docRouter.get("/", requireAuth, (req, res) => {
  const rows = stmtCache.listByOwner.all(req.user.sub);
  res.json({ ok: true, items: rows });
});

docRouter.post("/", requireAuth, (req, res) => {
  const parse = DocSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ ok: false, error: "Invalid body" });
  const id = nanoid(16);
  const now = new Date().toISOString();
  stmtCache.insertDoc.run(id, req.user.sub, parse.data.title, parse.data.content, 1, now, now);
  const row = stmtCache.getById.get(id);
  res.status(201).json({ ok: true, item: row });
});

docRouter.put("/:id", requireAuth, (req, res) => {
  const id = req.params.id;
  const { title, content, baseVersion } = req.body || {};
  if (typeof baseVersion !== "number") {
    return res.status(400).json({ ok: false, error: "Missing baseVersion" });
  }
  const row = stmtCache.getByIdAndOwner.get(id, req.user.sub);
  if (!row) return res.status(404).json({ ok: false, error: "Not found" });

  const now = new Date().toISOString();
  const newVersion = row.version + 1;
  const newTitle = title || row.title;
  
  if (row.version !== baseVersion) {
    const merged = mergeContent(row.content, content);
    stmtCache.updateDoc.run(newTitle, merged, newVersion, now, id);
    const updated = stmtCache.getById.get(id);
    return res.status(409).json({ ok: false, conflict: true, item: updated });
  } else {
    stmtCache.updateDoc.run(newTitle, content, newVersion, now, id);
    const updated = stmtCache.getById.get(id);
    return res.json({ ok: true, item: updated });
  }
});

docRouter.delete("/:id", requireAuth, (req, res) => {
  const id = req.params.id;
  stmtCache.deleteByIdAndOwner.run(id, req.user.sub);
  res.json({ ok: true });
});

function mergeContent(base, incoming) {
  if (incoming === base) return base;
  return base + "\n\n----- MERGED SECTION (" + new Date().toISOString() + ") -----\n\n" + incoming;
}
