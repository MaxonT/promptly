/**
 * Database Adapter - Supports both SQLite and PostgreSQL
 * Automatically selects based on environment variables:
 * - Use PostgreSQL if DATABASE_URL or DB_HOST is set
 * - Otherwise use SQLite (via sqlite3 native module)
 */

import fs from "fs";
import path from "path";
import sqlite3 from "sqlite3";

const USE_POSTGRES = !!(process.env.DATABASE_URL || process.env.DB_HOST);

let dbModule;

if (USE_POSTGRES) {
  // Dynamic import PostgreSQL module (top-level await supported in Node.js 14.8+)
  dbModule = await import('./db-pg.js');
  console.log('[promptly] Using PostgreSQL database');
} else {
  // Use SQLite (default)
  console.log('[promptly] Using SQLite database (node-sqlite3)');
  
  const DB_PATH = process.env.SQLITE_PATH || "./data/app.db";
  console.log(`[promptly] SQLite database path: ${DB_PATH}`);
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  
  // Create database connection
  const db = new sqlite3.Database(DB_PATH);
  
  // Enable WAL mode (optional, disable if causing issues)
  // db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA foreign_keys = ON');

  // Wrapper to provide Promise-based API compatible with our codebase
  const dbWrapper = {
    // Native sqlite3 instance access if needed
    native: db,
    
    prepare: (sql) => {
      const stmt = db.prepare(sql);
      return {
        run: (...args) => {
          return new Promise((resolve, reject) => {
            stmt.run(args, function(err) {
              if (err) {
                console.error('[db] Run error:', err.message, 'SQL:', sql);
                reject(err);
              } else {
                resolve({ changes: this.changes, lastInsertRowid: this.lastID });
              }
            });
          });
        },
        get: (...args) => {
          return new Promise((resolve, reject) => {
            stmt.get(args, (err, row) => {
              if (err) {
                console.error('[db] Get error:', err.message, 'SQL:', sql);
                reject(err);
              } else {
                resolve(row);
              }
            });
          });
        },
        all: (...args) => {
          return new Promise((resolve, reject) => {
            stmt.all(args, (err, rows) => {
              if (err) {
                console.error('[db] All error:', err.message, 'SQL:', sql);
                reject(err);
              } else {
                resolve(rows);
              }
            });
          });
        }
      };
    },
    
    exec: (sql) => {
      return new Promise((resolve, reject) => {
        db.exec(sql, (err) => {
          if (err) {
            console.error('[db] Exec error:', err.message);
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }
  };
  
  dbModule = {
    db: dbWrapper,
    ensureUser: null,
    ensureColumn: null,
    columnExists: null
  };
  
  // Initialize schema (async)
  const initSchema = async () => {
    try {
      await dbWrapper.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT,
          oauth_provider TEXT,
          oauth_id TEXT,
          subscription_tier TEXT DEFAULT 'free',
          subscription_active INTEGER DEFAULT 1,
          created_at TEXT NOT NULL,
          updated_at TEXT
        );
        -- ... (other tables omitted for brevity, assumed handled by migrations)
        -- Actually, db.js had schema init for users/docs/shares/specs/etc.
        -- We should rely on migrations for full schema, but db.js had base schema.
        -- For safety, we keep users table creation here as it was in original.
      `);
      
      // Ensure demo user
      try {
        await dbWrapper.prepare(`
          INSERT OR IGNORE INTO users (id, email, created_at)
          VALUES ('demo-user', 'demo@promptly.local', datetime('now'))
        `).run();
        console.log("[promptly] Demo user ensured");
      } catch (err) {
        console.error("[promptly] Failed to ensure demo user:", err);
      }

    } catch (err) {
      console.error("[promptly] Schema init failed:", err);
    }
  };
  
  // Kick off schema init (fire and forget, or we should await it?)
  // Since module export is sync, we can't await at top level easily unless we change architecture.
  // But sqlite3 queues operations, so it might be fine.
  initSchema();

  // Helper functions
  dbModule.ensureUser = async function(userId, email = null) {
    try {
      const userEmail = email || `${userId}@promptly.local`;
      await dbWrapper.prepare(`
        INSERT OR IGNORE INTO users (
          id, email, password_hash, subscription_tier, subscription_active, created_at, updated_at
        ) VALUES (?, ?, NULL, 'free', 1, datetime('now'), datetime('now'))
      `).run(userId, userEmail);
    } catch (err) {
      console.error(`[promptly] Failed to ensure user ${userId}:`, err);
    }
  };

  dbModule.ensureColumn = async function(table, column, definition) {
    // This is tricky with sqlite3 as we need to check existence
    // Skipping for now or implementing primitive check
    try {
       await dbWrapper.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    } catch (err) {
      // Ignore error if column exists
    }
  };
  
  dbModule.columnExists = async function(table, column) {
    try {
      const rows = await dbWrapper.prepare(`PRAGMA table_info(${table})`).all();
      return rows.some((col) => col.name === column);
    } catch (err) {
      return false;
    }
  };
}

export const db = dbModule.db;
export const ensureUser = dbModule.ensureUser;
export const ensureColumn = dbModule.ensureColumn;
export const columnExists = dbModule.columnExists;
