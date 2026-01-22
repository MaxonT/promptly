/**
 * Migration 003: Create stripe_events table for webhook idempotency
 * 
 * Purpose: Track processed Stripe webhook events to prevent duplicate processing
 * Features:
 * - Event deduplication
 * - Status tracking (pending, processed, failed)
 * - Error logging
 * - Payload retention for debugging
 */

import sqlite3 from "sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = process.env.SQLITE_PATH || path.join(__dirname, "../data/promptly.db");

// Helper to promisify exec
function exec(db, sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// Helper to promisify get
function get(db, sql) {
  return new Promise((resolve, reject) => {
    db.get(sql, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

export async function up(db) {
  console.log("[migration 003] Creating stripe_events table...");

  // FIX: Check for legacy schema from Migration 001 and upgrade if needed
  try {
    const tableInfo = await get(db, "SELECT sql FROM sqlite_master WHERE type='table' AND name='stripe_events'");
    if (tableInfo && tableInfo.sql && !tableInfo.sql.includes('status')) {
      console.log("[migration 003] ⚠️ Detected legacy stripe_events table (missing 'status'). Dropping to recreate...");
      await exec(db, "DROP TABLE stripe_events");
    }
  } catch (err) {
    console.warn("[migration 003] Schema check warning:", err);
  }
  
  await exec(db, `
    CREATE TABLE IF NOT EXISTS stripe_events (
      event_id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      status TEXT DEFAULT 'pending',  -- pending | processed | failed
      error TEXT,
      payload TEXT,  -- JSON of event data object
      created_at TEXT NOT NULL,
      processed_at TEXT,
      retry_count INTEGER DEFAULT 0
    );
    
    CREATE INDEX IF NOT EXISTS idx_stripe_events_type ON stripe_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_stripe_events_status ON stripe_events(status);
    CREATE INDEX IF NOT EXISTS idx_stripe_events_created ON stripe_events(created_at);
  `);
  
  console.log("[migration 003] ✅ Migration completed successfully");
}

export async function down(db) {
  console.log("[migration 003] Rolling back...");
  
  await exec(db, `
    DROP TABLE IF EXISTS stripe_events;
  `);
  
  console.log("[migration 003] ✅ Rollback completed");
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  
  if (!command || !["up", "down"].includes(command)) {
    console.error("Usage: node 003_stripe_events.js [up|down]");
    process.exit(1);
  }
  
  const db = new sqlite3.Database(dbPath);
  
  (async () => {
    try {
      if (command === "up") {
        await up(db);
      } else {
        await down(db);
      }
    } catch (err) {
      console.error("Migration failed:", err);
      process.exit(1);
    } finally {
      db.close();
    }
  })();
}
