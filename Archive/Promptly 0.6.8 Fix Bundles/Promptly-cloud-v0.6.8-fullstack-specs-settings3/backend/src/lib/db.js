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

-- Prompt spec storage
CREATE TABLE IF NOT EXISTS specs (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  title TEXT NOT NULL,
  spec_json TEXT NOT NULL,
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
`);
