import { Router } from "express";
import { db } from "../lib/db.js";
import { nanoid } from "nanoid";
import { requireAuth } from "./auth.js";

export const shareRouter = Router();

// Cache prepared statements for better performance
const stmtCache = {
  getDocByOwner: db.prepare("SELECT * FROM docs WHERE id = ? AND owner_id = ?"),
  insertShare: db.prepare("INSERT INTO shares (id,doc_id,token,mode,created_at,expires_at) VALUES (?,?,?,?,?,?)"),
  getShareByToken: db.prepare("SELECT * FROM shares WHERE token = ?"),
  getDocById: db.prepare("SELECT id,title,content,version,updated_at FROM docs WHERE id = ?")
};

shareRouter.post("/:docId", requireAuth, (req, res) => {
  const { docId } = req.params;
  const { mode = "view", expiresAt = null } = req.body || {};
  const doc = stmtCache.getDocByOwner.get(docId, req.user.sub);
  if (!doc) return res.status(404).json({ ok: false, error: "Not found" });
  const id = nanoid(12);
  const token = nanoid(24);
  stmtCache.insertShare.run(id, docId, token, mode, new Date().toISOString(), expiresAt);
  const url = (process.env.LINK_BASE || "http://localhost:8080/share/") + token;
  res.json({ ok: true, url, token, mode, id });
});

shareRouter.get("/resolve/:token", (req, res) => {
  const { token } = req.params;
  const s = stmtCache.getShareByToken.get(token);
  if (!s) return res.status(404).json({ ok: false, error: "Invalid" });
  const doc = stmtCache.getDocById.get(s.doc_id);
  res.json({ ok: true, mode: s.mode, doc });
});
