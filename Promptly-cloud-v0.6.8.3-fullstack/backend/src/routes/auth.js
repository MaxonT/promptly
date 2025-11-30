import { Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { db } from "../lib/db.js";
import { nanoid } from "nanoid";

export const authRouter = Router();

const TOKEN_SECRET = process.env.JWT_SECRET || "dev";
const TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
const PASSWORD_MIN_LENGTH = 8;
// Dummy hash used for constant-time comparison when user is not found (prevents timing attacks)
const DUMMY_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

function normalizeEmail(email = "") {
  return email.trim().toLowerCase();
}

function buildUserPayload(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    subscription: {
      tier: row.subscription_tier || "free",
      isActive: !!row.subscription_active
    }
  };
}

function createAuthToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email },
    TOKEN_SECRET,
    { expiresIn: TOKEN_EXPIRES_IN }
  );
}

function sendAuthResponse(res, row) {
  const user = buildUserPayload(row);
  const token = createAuthToken(user);
  return res.json({ ok: true, token, user });
}

authRouter.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || typeof email !== "string") {
      return res.status(400).json({ ok: false, error: "Email is required" });
    }
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail.includes("@")) {
      return res.status(400).json({ ok: false, error: "Email is invalid" });
    }
    if (!password || typeof password !== "string" || password.length < PASSWORD_MIN_LENGTH) {
      return res.status(400).json({
        ok: false,
        error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`
      });
    }

    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(normalizedEmail);
    if (existing) {
      return res.status(409).json({ ok: false, error: "Email already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = nanoid(16);
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO users (id, email, password_hash, subscription_tier, subscription_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, normalizedEmail, passwordHash, "free", 1, now, now);

    const row = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    return sendAuthResponse(res, row);
  } catch (err) {
    console.error("[promptly] register error", err);
    return res.status(500).json({ ok: false, error: "Registration failed" });
  }
});

authRouter.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || typeof email !== "string") {
      return res.status(400).json({ ok: false, error: "Email is required" });
    }
    if (!password || typeof password !== "string") {
      return res.status(400).json({ ok: false, error: "Password is required" });
    }

    const normalizedEmail = normalizeEmail(email);
    const row = db.prepare("SELECT * FROM users WHERE email = ?").get(normalizedEmail);
    
    // Always perform bcrypt.compare() to prevent timing attacks
    // Use dummy hash when user not found to ensure constant-time comparison
    const hashToCompare = row?.password_hash || DUMMY_HASH;
    const valid = await bcrypt.compare(password, hashToCompare);
    
    // Combine conditions to avoid short-circuit evaluation that could leak timing info
    const userExists = !!row;
    const credentialsValid = userExists && valid;
    
    if (!credentialsValid) {
      return res.status(401).json({ ok: false, error: "Invalid credentials" });
    }

    return sendAuthResponse(res, row);
  } catch (err) {
    console.error("[promptly] login error", err);
    return res.status(500).json({ ok: false, error: "Login failed" });
  }
});

authRouter.post("/logout", requireAuth, (_req, res) => {
  // Stateless JWT logout handled on client by discarding token.
  return res.json({ ok: true });
});

authRouter.get("/me", requireAuth, (req, res) => {
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.sub);
  if (!row) {
    return res.status(404).json({ ok: false, error: "User not found" });
  }
  return res.json({
    ok: true,
    user: buildUserPayload(row)
  });
});

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ ok: false, error: "Missing token" });
  }
  try {
    const payload = jwt.verify(token, TOKEN_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, error: "Invalid token" });
  }
}
