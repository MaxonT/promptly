import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const DB_PATH = process.env.SQLITE_PATH || "./data/app.db";
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  subscription_tier TEXT DEFAULT 'free',
  subscription_active INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS docs (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT fk_docs_owner FOREIGN KEY (owner_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS shares (
  id TEXT PRIMARY KEY,
  doc_id TEXT NOT NULL,
  token TEXT NOT NULL,
  mode TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT,
  CONSTRAINT fk_shares_doc FOREIGN KEY (doc_id) REFERENCES docs(id)
);

-- Prompt spec storage (S1: Structured Spec Columns)
CREATE TABLE IF NOT EXISTS specs (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  project_id TEXT,
  session_id TEXT,
  kind TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  tech_stack TEXT,
  pages TEXT,
  data_model TEXT,
  constraints TEXT,
  spec_json TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT fk_specs_owner FOREIGN KEY (owner_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS compiled_prompts (
  id TEXT PRIMARY KEY,
  spec_id TEXT NOT NULL,
  compiled_json TEXT NOT NULL,
  explanation TEXT,
  created_at TEXT NOT NULL,
  CONSTRAINT fk_cp_spec FOREIGN KEY (spec_id) REFERENCES specs(id)
);

-- Question engine session state
CREATE TABLE IF NOT EXISTS question_sessions (
  id TEXT PRIMARY KEY,
  owner_id TEXT,
  initial_description TEXT NOT NULL,
  kind TEXT,
  mode TEXT DEFAULT 'deep',
  model TEXT DEFAULT 'promptly',
  status TEXT NOT NULL,
  intent_json TEXT,
  spec_json TEXT,
  compiled_prompt_json TEXT,
  explanation TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT fk_qs_owner FOREIGN KEY (owner_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS question_questions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  options_json TEXT,
  order_index INTEGER NOT NULL,
  CONSTRAINT fk_qq_session FOREIGN KEY (session_id) REFERENCES question_sessions(id)
);

CREATE TABLE IF NOT EXISTS question_answers (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  answer_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CONSTRAINT fk_qa_session FOREIGN KEY (session_id) REFERENCES question_sessions(id),
  CONSTRAINT fk_qa_question FOREIGN KEY (question_id) REFERENCES question_questions(id)
);

-- Iteration helper & error tracking (B1-B3)
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  spec_id TEXT,
  spec_version TEXT,
  model TEXT,
  status TEXT NOT NULL,
  input_blocks TEXT,
  raw_output TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS run_errors (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  error_type TEXT,
  details TEXT,
  detected_by TEXT,
  created_at TEXT NOT NULL,
  CONSTRAINT fk_re_run FOREIGN KEY (run_id) REFERENCES runs(id)
);

-- Prompt evaluation storage (B4-B6)
CREATE TABLE IF NOT EXISTS evaluations (
  id TEXT PRIMARY KEY,
  spec_id TEXT NOT NULL,
  compiled_prompt_id TEXT NOT NULL,
  run_id TEXT,
  model TEXT,
  score REAL,
  verdict TEXT,
  summary TEXT,
  details TEXT,
  created_at TEXT NOT NULL,
  CONSTRAINT fk_eval_spec FOREIGN KEY (spec_id) REFERENCES specs(id),
  CONSTRAINT fk_eval_cp FOREIGN KEY (compiled_prompt_id) REFERENCES compiled_prompts(id),
  CONSTRAINT fk_eval_run FOREIGN KEY (run_id) REFERENCES runs(id)
);

-- Question Engine advanced controls (Q1-Q3)
CREATE TABLE IF NOT EXISTS question_snapshots (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CONSTRAINT fk_snapshot_session FOREIGN KEY (session_id) REFERENCES question_sessions(id)
);

CREATE TABLE IF NOT EXISTS question_actions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  action TEXT NOT NULL,
  payload TEXT,
  created_at TEXT NOT NULL,
  CONSTRAINT fk_action_session FOREIGN KEY (session_id) REFERENCES question_sessions(id)
);

-- Outcome Runner (O1-O3)
CREATE TABLE IF NOT EXISTS outcome_runs (
  id TEXT PRIMARY KEY,
  spec_id TEXT,
  run_id TEXT,
  task TEXT NOT NULL,
  input TEXT,
  style TEXT,
  constraints TEXT,
  n INTEGER NOT NULL,
  model TEXT,
  status TEXT NOT NULL,
  best_candidate_id TEXT,
  request_json TEXT,
  result_json TEXT,
  created_at TEXT NOT NULL,
  CONSTRAINT fk_outcome_spec FOREIGN KEY (spec_id) REFERENCES specs(id),
  CONSTRAINT fk_outcome_run FOREIGN KEY (run_id) REFERENCES runs(id)
);

CREATE TABLE IF NOT EXISTS outcome_candidates (
  id TEXT PRIMARY KEY,
  outcome_run_id TEXT NOT NULL,
  candidate_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  llm_score REAL,
  final_score REAL,
  tests_passed INTEGER,
  tests_json TEXT,
  created_at TEXT NOT NULL,
  CONSTRAINT fk_cand_outcome FOREIGN KEY (outcome_run_id) REFERENCES outcome_runs(id)
);

-- Best Prompt Pipeline: Candidate Prompts (for Multi-Agent generation)
CREATE TABLE IF NOT EXISTS candidate_prompts (
  id TEXT PRIMARY KEY,
  spec_id TEXT NOT NULL,
  session_id TEXT,
  agent TEXT NOT NULL,
  model TEXT NOT NULL,
  content TEXT NOT NULL,
  
  -- Metrics (filled later by Metrics & Scoring)
  clarity REAL,
  coherence REAL,
  style_match REAL,
  safety REAL,
  token_cost INTEGER,
  risk REAL,
  pass_rate REAL,
  f1_score REAL,
  composite_score REAL,
  
  created_at TEXT NOT NULL,
  CONSTRAINT fk_cp_spec FOREIGN KEY (spec_id) REFERENCES specs(id),
  CONSTRAINT fk_cp_session FOREIGN KEY (session_id) REFERENCES question_sessions(id)
);
`);

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  const exists = columns.some((col) => col.name === column);
  if (!exists) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${definition}`).run();
  }
}

// Backfill newly added columns when upgrading existing databases
ensureColumn("question_sessions", "mode", "mode TEXT DEFAULT 'deep'");
ensureColumn("question_sessions", "model", "model TEXT DEFAULT 'promptly'");
ensureColumn("question_sessions", "step", "step INTEGER DEFAULT 0");
ensureColumn("question_sessions", "is_complete", "is_complete INTEGER DEFAULT 0");
ensureColumn("question_sessions", "spec_id", "spec_id TEXT");
ensureColumn("specs", "completeness_score", "completeness_score REAL DEFAULT 0.0");
ensureColumn("specs", "raw_idea", "raw_idea TEXT");
ensureColumn("candidate_prompts", "metrics_json", "metrics_json TEXT");

// Whitelists for allowed table and column names
const ALLOWED_TABLES = [
  "runs",
  "evaluations",
  "users"
];
const ALLOWED_COLUMNS = {
  runs: ["completed_at", "metrics_json"],
  evaluations: ["metrics_json"],
  users: ["password_hash", "subscription_tier", "subscription_active", "updated_at"]
};

function ensureColumnExists(table, column, definition) {
  if (!ALLOWED_TABLES.includes(table)) {
    throw new Error(`[promptly] Table name not allowed: ${table}`);
  }
  if (!ALLOWED_COLUMNS[table] || !ALLOWED_COLUMNS[table].includes(column)) {
    throw new Error(`[promptly] Column name not allowed for table ${table}: ${column}`);
  }
  // Optionally, add further validation for definition if desired
  try {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  } catch (err) {
    if (!/duplicate column name/i.test(err.message)) {
      console.error(`[promptly] Failed to add column ${column} to ${table}:`, err);
      throw err;
    }
  }
}

ensureColumnExists("runs", "completed_at", "TEXT");
ensureColumnExists("runs", "metrics_json", "TEXT");
ensureColumnExists("evaluations", "metrics_json", "TEXT");
ensureColumnExists("users", "password_hash", "TEXT");
ensureColumnExists("users", "subscription_tier", "TEXT DEFAULT 'free'");
ensureColumnExists("users", "subscription_active", "INTEGER DEFAULT 1");
ensureColumnExists("users", "updated_at", "TEXT");

// Ensure demo user exists (for question sessions without authentication)
// This runs every time the server starts
try {
  db.prepare(`
    INSERT OR IGNORE INTO users (id, email, created_at)
    VALUES ('demo-user', 'demo@promptly.local', datetime('now'))
  `).run();
  console.log("[promptly] Demo user ensured");
} catch (err) {
  console.error("[promptly] Failed to ensure demo user:", err);
}

/**
 * Ensure a user exists in the database
 * @param {string} userId - The user ID to ensure exists
 * @param {string} email - The user's email (optional, defaults to userId@promptly.local)
 */
export function ensureUser(userId, email = null) {
  try {
    const userEmail = email || `${userId}@promptly.local`;
    db.prepare(`
      INSERT OR IGNORE INTO users (
        id,
        email,
        password_hash,
        subscription_tier,
        subscription_active,
        created_at,
        updated_at
      )
      VALUES (?, ?, NULL, 'free', 1, datetime('now'), datetime('now'))
    `).run(userId, userEmail);
  } catch (err) {
    console.error(`[promptly] Failed to ensure user ${userId}:`, err);
  }
}
