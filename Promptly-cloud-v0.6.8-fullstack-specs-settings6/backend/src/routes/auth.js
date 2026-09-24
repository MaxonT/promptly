import { Router } from "express";
import jwt from "jsonwebtoken";
import { db } from "../lib/db.js";
import { nanoid } from "nanoid";

export const authRouter = Router();

authRouter.post("/login", (req, res) => {
  const { email } = req.body || {};
  if (!email || typeof email !== "string")
    return res.status(400).json({ ok: false, error: "Invalid email" });
  const id = ensureUser(email);
  const token = jwt.sign({ sub: id, email }, process.env.JWT_SECRET || "dev", {
    expiresIn: "7d",
  });
  res.json({ ok: true, token });
});

function ensureUser(email) {
  const q = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (q?.id) return q.id;
  const id = nanoid(16);
  db.prepare("INSERT INTO users (id,email,created_at) VALUES (?,?,?)").run(
    id,
    email,
    new Date().toISOString()
  );
  return id;
}

export function requireAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ ok: false, error: "Missing token" });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "dev");
    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).json({ ok: false, error: "Invalid token" });
  }
}
