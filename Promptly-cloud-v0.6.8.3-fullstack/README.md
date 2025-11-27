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
Deploy `frontend/` to Vercel/Netlify. Edit `frontend/config.js` with your backend URL.
See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) or [UPDATE_CONFIG.md](UPDATE_CONFIG.md) for details.

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

### Quick Deploy (3 minutes)
1. **Backend to Render**: Set env vars: `OPENAI_API_KEY`, `CORS_ORIGIN=*`, `NODE_ENV=production`
2. **Update Frontend Config**: Edit `frontend/config.js` with your Render backend URL
3. **Frontend to Vercel**: Deploy `frontend/` folder
4. **Update CORS**: Change `CORS_ORIGIN` in Render to your Vercel URL

📖 **详细指南**:
- [完整部署指南](DEPLOYMENT_GUIDE.md) - 包含 Render + Vercel 详细步骤
- [快速修复 404 错误](UPDATE_CONFIG.md) - 如果遇到连接问题
- [连接测试页面](frontend/test-connection.html) - 自动验证配置

### Environment Variables
- **Render (Backend)**: `OPENAI_API_KEY`, `CORS_ORIGIN`, `NODE_ENV`, `PORT` (optional)
- **Vercel (Frontend)**: 直接编辑 `frontend/config.js`（无需环境变量）

License: MIT
