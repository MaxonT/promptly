
/**
 * Migration 004: Create plan_usage table
 * 
 * Purpose: Track usage of features (prompt optimization, wizard) for plan limits.
 */

import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.SQLITE_PATH || "./data/app.db";
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

console.log("[migration-004] Starting plan_usage schema migration...");

db.exec(`
  CREATE TABLE IF NOT EXISTS plan_usage (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    feature_type TEXT NOT NULL, -- 'prompt_optimization', 'question_wizard'
    date TEXT NOT NULL,         -- YYYY-MM-DD
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    
    CONSTRAINT fk_usage_user FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_plan_usage_lookup ON plan_usage(user_id, feature_type, date);
`);

console.log("[migration-004] ✅ plan_usage table created");

db.close();
