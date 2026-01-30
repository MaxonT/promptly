## Quick Orientation for AI Coding Agents

Promptly is a full-stack prompt optimization pipeline: static frontend + Express backend + SQLite/PostgreSQL. The core flow is: **Spec → Question → LLM Agents → Metrics → Outcome**.

### Architecture Overview
```
frontend/           Static HTML/JS/CSS (deploy to Vercel)
├── core.js         Main app logic, API calls via window.PROMPTLY_API_BASE
├── wizard.js       Question wizard flow
├── i18n/           Internationalization system (9 languages)
└── locales/*.json  Translation files

backend/src/
├── server.js       Express app with all route mounts
├── routes/         API endpoints: auth, specs, pipeline, billing, analytics
└── lib/
    ├── db.js           DB adapter (SQLite or PostgreSQL auto-detect)
    ├── llmRouter.js    LLM dispatch: openai/groq providers (SINGLE SOURCE OF TRUTH)
    ├── openaiClient.js OpenAI client + LlmDisabledError
    ├── runLogger.js    Run lifecycle: createRun → completeRunSuccess/Failure
    ├── evaluationEngine.js  Evaluator contract (score 0-100, verdict, summary)
    └── subscriptionConfig.js Token limits, trial config, pricing
```

### Key Entry Points
- `backend/src/server.js` — All routes: `/api/auth`, `/api/pipeline`, `/api/specs`, `/api/runs`, `/api/billing`
- `backend/src/routes/pipeline.js` — Core pipeline with SSE streaming (`/api/pipeline/run`, `/api/pipeline/stream/:runId`)
- `backend/src/lib/db.js` — Schema: `users`, `specs`, `runs`, `run_errors`, `evaluations`, `outcome_runs`

### Developer Workflows
```bash
# Backend dev (auto-runs migrations, watches changes)
cd backend && npm install && npm run dev

# Migrations only
cd backend && npm run migrate

# Self-test (targets running server)
SELFTEST_BASE_URL=http://localhost:8080 node backend/scripts/selftest.js

# Health check
curl http://localhost:8080/api/health
```

### Critical Patterns

**LLM Calls** — Always route through `llmRouter.js`, never call clients directly:
```javascript
import { chatJson, chatText, LlmDisabledError } from "../lib/llmRouter.js";
// Provider MUST be explicit: 'openai' or 'groq'
await chatJson({ system, user, model, provider: 'openai' });
```

**Run Lifecycle** — Always complete runs (success or failure):
```javascript
import { createRun, completeRunSuccess, completeRunFailure } from "../lib/runLogger.js";
const runId = createRun({ model, inputBlocks });
try {
  const result = await doWork();
  completeRunSuccess(runId, result);
} catch (err) {
  completeRunFailure(runId, "runtime_exception", err.message);
}
```

**DB Operations** — Synchronous `better-sqlite3`; JSON-stringify complex objects:
```javascript
import { db } from "../lib/db.js";
db.prepare("INSERT INTO specs (id, spec_json) VALUES (?, ?)").run(id, JSON.stringify(spec));
```

**ID Prefixes** — Use consistently: `run_`, `err_`, `outcome_`, `cand_`, `spec_`

### Environment Variables
Copy `backend/.env.example` to `.env`. Critical vars:
- `OPENAI_API_KEY` — Required for LLM features (missing = `LlmDisabledError`)
- `OPENAI_BASE_URL` — Custom endpoint (for proxies/Groq)
- `JWT_SECRET` — Required in production
- `CORS_ORIGIN` — Frontend domain (e.g., `https://your-app.vercel.app`)
- `SQLITE_PATH` — DB path (or `DATABASE_URL` for PostgreSQL)

### Adding New Features
1. **New API route**: Add to `backend/src/routes/`, mount in `server.js`
2. **New DB table**: Add migration in `backend/migrations/00X_*.js`
3. **New i18n keys**: Add to all `frontend/locales/*.json` files
4. **Schema validation**: Use `zod` (see `evaluationEngine.js` for patterns)

### Testing & Validation
- `npm run test` in backend runs `scripts/selftest.js`
- `test-deployment.sh <url>` for deployment verification
- `verify-integration.sh` checks frontend-backend connection 
