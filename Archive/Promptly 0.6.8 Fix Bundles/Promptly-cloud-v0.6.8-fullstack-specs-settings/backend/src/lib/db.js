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
  content TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  CONSTRAINT fk_owner FOREIGN KEY (owner_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS shares (
  id TEXT PRIMARY KEY,
  doc_id TEXT NOT NULL,
  token TEXT NOT NULL,
  mode TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT,
  CONSTRAINT fk_doc FOREIGN KEY (doc_id) REFERENCES docs(id)
);
`);
