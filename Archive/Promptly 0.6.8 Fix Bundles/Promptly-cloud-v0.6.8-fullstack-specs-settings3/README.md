# Promptly Cloud v0.6.0

Production‑ready skeleton built on your existing frontend (kept intact). This repo ships with:
- **frontend/**: your uploaded UI, unchanged
- **backend/**: Node/Express + SQLite (better‑sqlite3), JWT auth, sharing, merge/conflict handling, validation (zod)
- **others/**: OpenAPI spec, CI stub, health & QA checklists

## Quick Start

### Backend
```bash
cd backend
cp .env.example .env
npm install
npm run migrate
npm start
```
Check: `curl http://localhost:8080/api/health`

### Frontend
Deploy `frontend/` to Vercel. Set env `VITE_API_BASE` to the backend URL.

## API
- `POST /api/auth/login` → `{ token }`
- `GET /api/docs` (Bearer token)
- `POST /api/docs`
- `PUT /api/docs/:id` with `baseVersion`
- `DELETE /api/docs/:id`
- `POST /api/share/:docId`
- `GET /api/share/resolve/:token`

See `others/openapi.yaml`.

## Ten Health Checks
1. `npm run health`
2. `/api/health` returns ok
3. JWT secret set
4. CORS origin set
5. SQLite file created
6. Login returns token
7. Docs list works
8. Conflict path (409) works
9. Share/resolve works
10. Frontend→Backend requests succeed

## Deployment
- **Render** (backend): build `npm install && npm run migrate`; start `npm start`; env: `JWT_SECRET`, `CORS_ORIGIN`, `SQLITE_PATH=/var/data/app.db`, `LINK_BASE`.
- **Vercel** (frontend): env `VITE_API_BASE`.

License: MIT
