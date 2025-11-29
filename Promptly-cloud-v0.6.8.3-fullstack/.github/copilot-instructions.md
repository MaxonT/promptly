## Quick orientation for AI coding agents

This repo is a small full‑stack app: a static frontend and an Express backend that stores prompt specs, runs, and evaluations in SQLite. Use these notes to be productive immediately.

Key places to read first
- `backend/src/server.js` — API surface and mounted routers: `/api/auth`, `/api/docs`, `/api/share`, `/api/specs`, `/api/question-sessions`, `/api/runs` and `/api/settings`.
- `backend/src/lib/db.js` — canonical SQLite schema and important table names: `specs`, `compiled_prompts`, `runs`, `run_errors`, `evaluations`, `outcome_runs`, `outcome_candidates`.
- `backend/src/lib/openaiClient.js` — centralized LLM client. Note: when `OPENAI_API_KEY` is missing the code disables LLM features and throws `LlmDisabledError`.
- `backend/src/lib/evaluationEngine.js` — how evaluator prompts are composed and the expected JSON schema (score 0–100, verdict, summary, issues/suggestions). Use this as the canonical evaluator contract.
- `backend/src/lib/runLogger.js` — how runs are created and marked success/failure (`createRun`, `completeRunSuccess`, `completeRunFailure`). Run IDs and error IDs use prefixes like `run_` and `err_`.
- `frontend/config.js` — frontend's API base (set for production). For local dev ensure `PROMPTLY_API_BASE` points to `http://localhost:8080`.

Developer workflows & useful commands
- Backend development: cd `backend` then `npm install` and `npm run dev` (watches `src/server.js`).
- Run migrations: `npm run migrate` (runs `migrations/000_init.js`).
- Basic self-test: `npm run test` runs `scripts/selftest.js`. You can target a running backend: `SELFTEST_BASE_URL=http://localhost:8080 node scripts/selftest.js`.
- Health probe: `npm run health` -> `scripts/healthcheck.js` or call `/api/health`.
- Docker: `backend/Dockerfile` builds a production image; backend listens on port 8080.

Environment & runtime signals
- Required/relevant env vars found in code: `OPENAI_API_KEY`, `OPENAI_DEFAULT_MODEL` (or `OPENAI_MODEL` in some modules), `OUTCOME_MODEL`, `SQLITE_PATH`, `CORS_ORIGIN`, `JWT_SECRET`, `PORT`. See `backend/.env.example` for a starter.
- LLM feature gate: absence of `OPENAI_API_KEY` disables LLM code paths — handle `LlmDisabledError` in edits where applicable.

Project-specific conventions & patterns
- DB: uses synchronous `better-sqlite3` and stores complex objects as JSON strings (e.g., `input_blocks`, `raw_output`, `request_json`, `result_json`). Read/parse these when adding integrations.
- Runs lifecycle: create a run with `createRun(...)`, then always call `completeRunSuccess` or `completeRunFailure` so state and diagnostics are saved.
- LLM contract: `openaiClient.chatJson` expects the model to return JSON text (the code uses OpenAI response_format `json_object`). When changing prompts, ensure the model returns strictly JSON parseable strings.
- ID prefixes: `run_`, `err_`, `outcome_`, and `cand_`-style ids are used; keep these or follow existing patterns when writing helper utilities.

Integration points to watch
- Frontend <-> backend: static frontend calls API endpoints under `/api/*`. See `frontend/core.js` and `frontend/wizard.js` for usage patterns (how they send spec/compiled prompt data).
- LLM interactions: `backend/src/lib/openaiClient.js` and callers (`evaluationEngine.js`, outcome runner, other agents) — keep prompt text and parsing consistent.

When making changes, prefer small, testable edits
- Add unit-like self-checks by using `backend/scripts/selftest.js` or the `test_*.sh` quick scripts in the `backend` directory.
- If you change DB schema, add a migration under `backend/migrations/` and update `migrate` script usage.

Examples (copyable) — run locally
- Start backend dev server
  - cd backend && npm install && npm run dev
- Run migrations
  - cd backend && npm run migrate
- Run selftest against local server
  - SELFTEST_BASE_URL=http://localhost:8080 node backend/scripts/selftest.js

If anything is unclear or you'd like me to expand specific sections (API examples, prompt text locations, or a developer checklist), tell me which area and I will iterate. 
