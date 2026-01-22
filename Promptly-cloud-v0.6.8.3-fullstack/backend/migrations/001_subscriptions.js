/**
 * Migration 001: Subscriptions & Token Ledger Schema
 * 
 * This migration adds all the tables required for:
 * - Stripe customer management
 * - Subscription tracking
 * - Token-based billing (ledger)
 * - Webhook idempotency
 * - Trial anti-abuse controls
 * 
 * Run with: node migrations/001_subscriptions.js
 */

import sqlite3 from "sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.SQLITE_PATH || "./data/app.db";
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new sqlite3.Database(DB_PATH);

function exec(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

(async () => {
  try {
    console.log("[migration-001] Starting subscriptions schema migration...");

    // =============================================
    // 1. Stripe Customers Table
    // =============================================
    await exec(`
    CREATE TABLE IF NOT EXISTS stripe_customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL UNIQUE,
      stripe_customer_id TEXT NOT NULL UNIQUE,
      email TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      CONSTRAINT fk_stripe_user FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_stripe_customers_user ON stripe_customers(user_id);
    CREATE INDEX IF NOT EXISTS idx_stripe_customers_stripe ON stripe_customers(stripe_customer_id);
    `);
    console.log("[migration-001] ✓ stripe_customers table created");

    // =============================================
    // 2. Subscriptions Table
    // =============================================
    await exec(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      stripe_subscription_id TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      current_period_start TEXT,
      current_period_end TEXT,
      cancel_at_period_end INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      CONSTRAINT fk_sub_user FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe ON subscriptions(stripe_subscription_id);
    `);
    console.log("[migration-001] ✓ subscriptions table created");

    // =============================================
    // 3. Token Ledger Table (Credits/Debits)
    // =============================================
    await exec(`
    CREATE TABLE IF NOT EXISTS token_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      amount INTEGER NOT NULL, -- Positive for credit, negative for debit
      type TEXT NOT NULL, -- 'purchase', 'subscription_grant', 'usage', 'bonus', 'refund'
      description TEXT,
      metadata TEXT, -- JSON
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      CONSTRAINT fk_ledger_user FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_token_ledger_user ON token_ledger(user_id);
    `);
    console.log("[migration-001] ✓ token_ledger table created");

    // =============================================
    // 4. Token Balances Cache (Snapshot)
    // =============================================
    await exec(`
    CREATE TABLE IF NOT EXISTS token_balances_cache (
      user_id TEXT PRIMARY KEY,
      balance INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      CONSTRAINT fk_balance_user FOREIGN KEY (user_id) REFERENCES users(id)
    );
    `);
    console.log("[migration-001] ✓ token_balances_cache table created");

    // =============================================
    // 5. Stripe Events (Idempotency)
    // =============================================
    await exec(`
    CREATE TABLE IF NOT EXISTS stripe_events (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    `);
    console.log("[migration-001] ✓ stripe_events table created");

    // =============================================
    // 6. Trial Abuse Prevention
    // =============================================
    await exec(`
    CREATE TABLE IF NOT EXISTS trial_abuse_checks (
      fingerprint TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    `);
    console.log("[migration-001] ✓ trial_abuse_checks table created");

    // =============================================
    // 7. IP Rate Limiting
    // =============================================
    await exec(`
    CREATE TABLE IF NOT EXISTS ip_rate_limits (
      ip TEXT PRIMARY KEY,
      count INTEGER DEFAULT 1,
      first_seen TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen TEXT NOT NULL DEFAULT (datetime('now'))
    );
    `);
    console.log("[migration-001] ✓ ip_rate_limits table created");

    console.log("[migration-001] ✅ Migration completed successfully!");
  } catch (err) {
    console.error("[migration-001] ❌ Migration failed:", err);
    process.exit(1);
  } finally {
    db.close();
  }
})();
