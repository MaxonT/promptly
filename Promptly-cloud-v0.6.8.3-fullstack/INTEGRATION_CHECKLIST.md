# Promptly 集成检查清单

## 1. 前端集成检查
- [x] 所有 HTML 文件引用 `config.js`
- [x] 所有 JS 文件使用 `window.PROMPTLY_API_BASE`
- [x] `frontend/vercel.json` 配置了 `npm run build`
- [x] `frontend/package.json` 提供 `npm run build`
- [x] `frontend/.gitignore` 包含 `config.js`
- [x] `frontend/build.js` 可执行并采用环境变量

## 2. 后端集成检查
- [x] 所有路由文件（auth, doc, share, etc.）已导入
- [x] 所有路由在 `backend/src/server.js` 正确注册
- [x] 根路径处理器 (`GET /`) 存在
- [x] `/api/health` 和 `/api/pipeline/health` 可用
- [x] `/api/pipeline/run` + SSE 路由正常
- [x] 请求日志中间件在 `server.js` 启用

## 3. 环境变量配置
- [ ] Render：`OPENAI_API_KEY`, `JWT_SECRET`, `CORS_ORIGIN`
- [x] Vercel：`VITE_API_BASE`

## 4. 文档完整性
- [x] 部署指南引用正确的 URL
- [ ] README 包含快速开始链接
- [x] 所有文档路径有效

## 5. 其他
- [x] `test-deployment.sh` 可用于验证

