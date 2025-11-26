# Promptly Cloud v0.6.8

Full‑stack Promptly Cloud environment built on your existing frontend. This bundle ships with:
- **frontend 2/**: your Promptly UI (kept structurally intact) plus extra playgrounds:
  - `index.html` – main app
  - `wizard.html` – Question Engine / spec wizard
  - `enhancer.html` – Prompt Enhancer
  - `outcome.html` – Outcome‑first runner (Best‑of‑N / Score / Argmax)
  - `specs.html` – Specs manager (list / inspect / compile)
  - `settings.html` – read‑only settings panel
- **backend/**: Node/Express + SQLite (better‑sqlite3), JWT auth, sharing, specs and compiled prompts, LLM agents (OpenAI), Best‑of‑N Outcome engine.
- **others/**: OpenAPI spec (`openapi.yaml`), deployment and QA notes.

## Quick Start

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run migrate
npm start
```

Minimum env:

- `OPENAI_API_KEY` – required for all LLM‑powered endpoints
- `OPENAI_MODEL` – default chat model (e.g. `gpt-4.1-mini`)
- optional:
  - `OUTCOME_MODEL` – model used by `/api/outcome-runs` (falls back to `OPENAI_MODEL`)
  - `CORS_ORIGIN`
  - `JWT_SECRET`
  - `SQLITE_PATH` (defaults to `./promptly.db`)

Health checks:

1. `GET /api/health` returns `200`
2. `GET /api/settings` returns `{ ok: true, settings: { ... } }`
3. `POST /api/auth/login` returns a JWT
4. `GET /api/docs` returns your docs list
5. `GET /api/specs` returns your stored specs
6. `POST /api/enhance/score` returns a scored prompt
7. `POST /api/question-sessions` starts a question wizard session
8. `POST /api/outcome-runs` returns candidates + best choice

### Frontend (static)

Serve **frontend 2/** as a static site (Vercel, Netlify, S3, nginx, etc).

Key entry points (all talk to the same backend):

- `/` – main Promptly app (unchanged layout)
- `/wizard.html` – Question Engine: turn fuzzy ideas into a structured spec
- `/enhancer.html` – Prompt Enhancer: clarity, structure, safety, tone, etc.
- `/outcome.html` – Outcome‑first runner: generate N candidates, score and pick the best
- `/specs.html` – Specs Manager UI: list specs, inspect JSON, compile to prompt
- `/settings.html` – shows read‑only server config from `/api/settings`

If hosting frontend separately from the backend, configure your host to proxy `/api/*`
to your backend URL (for example via Vercel `rewrites`).

## API Surface (high‑level)

Core docs & sharing (unchanged):

- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/docs`
- `POST /api/docs`
- `PUT /api/docs/{id}`
- `DELETE /api/docs/{id}`
- `POST /api/share/{docId}`
- `GET /api/share/resolve/{token}`

Prompt Enhancer:

- `POST /api/enhance/score` – score a prompt on multiple dimensions
- `POST /api/enhance/structure` – structural rewrite
- `POST /api/enhance/style` – style / tone adjustments
- `POST /api/enhance/simplify` – simpler / more direct version
- `POST /api/enhance/validate` – safety / constraints validation

Question Engine & Specs:

- `POST /api/question-sessions` – start a Q&A session for building a spec
- `GET /api/question-sessions/{id}` – fetch session state (where supported)
- `POST /api/question-sessions/{id}/answer` – answer next question
- `GET /api/specs` – list specs for the current user
- `POST /api/specs` – create a new spec `{ title, spec }`
- `GET /api/specs/{id}` – fetch a single spec
- `POST /api/specs/{id}/compile` – compile the spec into ordered prompt blocks

Outcome‑first Runner:

- `POST /api/outcome-runs`
  - body: `{ task, input?, style?, constraints?, n?, tests? }`
  - response: `{ request, candidates[], best, meta }`

Settings:

- `GET /api/settings` – read‑only view of environment‑level configuration (no secrets).

## Deployment

- **Render** (backend): build `npm install && npm run migrate`; env `OPENAI_API_KEY`, `OPENAI_MODEL`, `JWT_SECRET`, `CORS_ORIGIN`, `SQLITE_PATH=/var/data/app.db`, `OUTCOME_MODEL`, `LINK_BASE`.
- **Vercel** (frontend): serve `frontend 2/`; configure `rewrites` to proxy `/api/*` to your backend.

License: MIT