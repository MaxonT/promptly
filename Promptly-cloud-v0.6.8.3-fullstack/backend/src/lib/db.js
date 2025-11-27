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
  created_at TEXT NOT NULL
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
`);
