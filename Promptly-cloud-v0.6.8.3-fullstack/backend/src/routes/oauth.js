/**
 * OAuth Routes
 * Handles Google and GitHub OAuth authentication using PKCE flow
 */

import { Router } from "express";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { db } from "../lib/db.js";
import { nanoid } from "nanoid";

export const oauthRouter = Router();

// OAuth Configuration
const TOKEN_SECRET = process.env.JWT_SECRET || "dev";
const TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

const OAUTH_REDIRECT_URI = process.env.OAUTH_REDIRECT_URI || 
  `${process.env.CORS_ORIGIN || "http://localhost:8080"}/api/auth/oauth/callback`;

// In-memory store for code_verifier (in production, use Redis or database)
const codeVerifierStore = new Map();

// =============================================
// Helper Functions
// =============================================

function base64URLEncode(str) {
  return str.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest();
}

function generateCodeVerifier() {
  return base64URLEncode(crypto.randomBytes(32));
}

function generateCodeChallenge(verifier) {
  return base64URLEncode(sha256(Buffer.from(verifier)));
}

function createAuthToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email },
    TOKEN_SECRET,
    { expiresIn: TOKEN_EXPIRES_IN }
  );
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

function normalizeEmail(email = "") {
  return email.trim().toLowerCase();
}

async function findOrCreateUser(email, provider, providerId) {
  const normalizedEmail = normalizeEmail(email);
  
  // First, try to find existing user by email
  let user = db.prepare("SELECT * FROM users WHERE email = ?").get(normalizedEmail);
  
  if (user) {
    // Check if OAuth provider is already linked
    const oauthLink = db.prepare(
      "SELECT * FROM user_oauth WHERE user_id = ? AND provider = ?"
    ).get(user.id, provider);
    
    if (!oauthLink) {
      // Link OAuth provider to existing user
      db.prepare(
        "INSERT INTO user_oauth (user_id, provider, provider_id, created_at) VALUES (?, ?, ?, ?)"
      ).run(user.id, provider, providerId, new Date().toISOString());
    }
    
    return user;
  }
  
  // Create new user
  const userId = nanoid(16);
  const now = new Date().toISOString();
  
  db.prepare(`
    INSERT INTO users (id, email, subscription_tier, subscription_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, normalizedEmail, "free", 1, now, now);
  
  // Link OAuth provider
  db.prepare(
    "INSERT INTO user_oauth (user_id, provider, provider_id, created_at) VALUES (?, ?, ?, ?)"
  ).run(userId, provider, providerId, now);
  
  return db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
}

// =============================================
// OAuth Authorization Routes
// =============================================

/**
 * GET /api/auth/oauth/:provider/authorize
 * Initiates OAuth flow by generating authorization URL with PKCE
 */
oauthRouter.get("/:provider/authorize", (req, res) => {
  const { provider } = req.params;
  
  if (provider !== 'google' && provider !== 'github') {
    return res.status(400).json({ ok: false, error: "Invalid provider" });
  }

  // Generate PKCE code verifier and challenge
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  
  // Store code_verifier (with expiration in 10 minutes)
  const state = nanoid(32);
  codeVerifierStore.set(state, {
    codeVerifier,
    provider,
    expiresAt: Date.now() + 10 * 60 * 1000
  });
  
  // Clean up expired entries
  for (const [key, value] of codeVerifierStore.entries()) {
    if (value.expiresAt < Date.now()) {
      codeVerifierStore.delete(key);
    }
  }

  let authUrl;
  
  if (provider === 'google') {
    if (!GOOGLE_CLIENT_ID) {
      return res.status(500).json({ ok: false, error: "Google OAuth not configured" });
    }
    
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: OAUTH_REDIRECT_URI,
      response_type: 'code',
      scope: 'openid email profile',
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });
    
    authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  } else if (provider === 'github') {
    if (!GITHUB_CLIENT_ID) {
      return res.status(500).json({ ok: false, error: "GitHub OAuth not configured" });
    }
    
    const params = new URLSearchParams({
      client_id: GITHUB_CLIENT_ID,
      redirect_uri: OAUTH_REDIRECT_URI,
      scope: 'user:email',
      state: state,
      allow_signup: 'true'
    });
    
    authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  res.json({
    ok: true,
    authUrl,
    state
  });
});

/**
 * GET /api/auth/oauth/callback
 * Handles OAuth callback and exchanges code for token
 */
oauthRouter.get("/callback", async (req, res) => {
  const { code, state, error } = req.query;
  
  if (error) {
    return res.redirect(`/?oauth_error=${encodeURIComponent(error)}`);
  }
  
  if (!code || !state) {
    return res.redirect(`/?oauth_error=${encodeURIComponent('Missing code or state')}`);
  }

  // Retrieve code_verifier from store
  const stored = codeVerifierStore.get(state);
  if (!stored || stored.expiresAt < Date.now()) {
    codeVerifierStore.delete(state);
    return res.redirect(`/?oauth_error=${encodeURIComponent('Invalid or expired state')}`);
  }
  
  const { codeVerifier, provider } = stored;
  codeVerifierStore.delete(state);

  try {
    let userInfo;
    
    if (provider === 'google') {
      // Exchange code for access token
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: OAUTH_REDIRECT_URI,
          code_verifier: codeVerifier
        })
      });
      
      const tokenData = await tokenResponse.json();
      if (!tokenResponse.ok) {
        throw new Error(tokenData.error || 'Failed to exchange code for token');
      }
      
      // Get user info from Google
      const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
      });
      
      const googleUser = await userResponse.json();
      userInfo = {
        email: googleUser.email,
        providerId: googleUser.id,
        name: googleUser.name
      };
    } else if (provider === 'github') {
      // Exchange code for access token
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          code: code
        })
      });
      
      const tokenData = await tokenResponse.json();
      if (tokenData.error) {
        throw new Error(tokenData.error_description || 'Failed to exchange code for token');
      }
      
      // Get user info from GitHub
      const userResponse = await fetch('https://api.github.com/user', {
        headers: { 'Authorization': `token ${tokenData.access_token}` }
      });
      
      const githubUser = await userResponse.json();
      
      // Get user email (may need to fetch from emails endpoint)
      let email = githubUser.email;
      if (!email) {
        const emailsResponse = await fetch('https://api.github.com/user/emails', {
          headers: { 'Authorization': `token ${tokenData.access_token}` }
        });
        const emails = await emailsResponse.json();
        const primaryEmail = emails.find(e => e.primary) || emails[0];
        email = primaryEmail?.email;
      }
      
      userInfo = {
        email: email,
        providerId: githubUser.id.toString(),
        name: githubUser.name || githubUser.login
      };
    }
    
    if (!userInfo || !userInfo.email) {
      throw new Error('Failed to retrieve user information');
    }
    
    // Find or create user
    const userRow = await findOrCreateUser(userInfo.email, provider, userInfo.providerId);
    const user = buildUserPayload(userRow);
    const token = createAuthToken(user);
    
    // Redirect to frontend with token
    const frontendUrl = new URL(OAUTH_REDIRECT_URI.replace('/api/auth/oauth/callback', ''));
    frontendUrl.searchParams.set('oauth_token', token);
    frontendUrl.searchParams.set('oauth_success', 'true');
    
    return res.redirect(frontendUrl.toString());
  } catch (err) {
    console.error('[oauth] Callback error:', err);
    return res.redirect(`/?oauth_error=${encodeURIComponent(err.message || 'OAuth authentication failed')}`);
  }
});

