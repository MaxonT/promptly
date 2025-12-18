# Promptly Cloud v0.6.10.6 🚀

[![CI Status](https://github.com/your-username/promptly-cloud/workflows/ci/badge.svg)](https://github.com/your-username/promptly-cloud/actions)
[![Version](https://img.shields.io/badge/version-v0.6.10.6-blue.svg)](VERSION.txt)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Promptly 提供一整套 Prompt 优化流水线：前端负责收集目标并展示多阶段可视化，后端负责 Spec → Question → Agents → Metrics → Outcome 的完整运行。

## 🌍 多语言支持 (9种语言)

✅ 中文 (zh-CN) | ✅ English (en) | ✅ Español (es) | ✅ Français (fr) | ✅ 日本語 (ja) | ✅ العربية (ar) | ✅ 한국어 (ko) | ✅ Português (pt) | ✅ हिन्दी (hi)

## ⚡ 快速开始

### 🚀 一键部署

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/your-username/promptly-cloud)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/promptly-cloud/tree/main/frontend)

### 📋 5分钟部署指南

1. **部署后端**：[查看详细指南](docs/DEPLOYMENT_COMPLETE_GUIDE.md)
2. **部署前端**：[Vercel部署指南](QUICK_START_DEPLOYMENT.md)
3. **验证集成**：运行 `./verify-integration.sh`

## 目录概览

- `frontend/`: 静态 UI（已经集成 `config.js` 构建）
- `backend/`: Node/Express + SQLite，包含 Spec、Question、Candidate、Outcome 模块
- `docs/`: 架构与部署文档集合（包括本次部署流程）
- `test-deployment.sh` / `verify-integration.sh`: 自动化测试脚本
- `INTEGRATION_CHECKLIST.md`: 集成校验清单

## 快速验证

1. **调用脚本**：`./test-deployment.sh https://promptly-v0-6-cloudtest-cursor-dev.onrender.com`
2. **集成确认**：`./verify-integration.sh`（需要 `jq`，用于校验版本、引用、环境变量）
3. **文档参考**：`QUICK_START_DEPLOYMENT.md` 说明 5 分钟部署流程

## 部署架构

1. **Render (Backend)**  
   - 将 `backend/` 部署为 Web Service  
   - 环境变量：`OPENAI_API_KEY`, `JWT_SECRET`, `CORS_ORIGIN` (指向 Vercel 域), `NODE_ENV=production`  
   - 入口：`npm start`，暴露 `/api/health`, `/api/pipeline/*`, `/`（返回可用端点）

2. **Vercel (Frontend)**  
   - `frontend/` 添加 `package.json` + `build.js`  
   - 构建流程：`npm run build` → `build.js` 使用 `VITE_API_BASE` 生成 `config.js`  
   - 页面通过 `config.js` 注入 `window.PROMPTLY_API_BASE`，其他脚本直接从该变量读 API 基地址

3. **环境变量**  
   - Render: `OPENAI_API_KEY`, `JWT_SECRET`, `CORS_ORIGIN=https://your-frontend.vercel.app`  
   - Vercel: `VITE_API_BASE=https://promptly-v0-6-cloudtest-cursor-dev.onrender.com`

## 前端集成点

- 所有 HTML = `<script src="config.js"></script>`，看：[index.html](frontend/index.html)、[wizard.html](frontend/wizard.html)、[enhancer.html](frontend/enhancer.html)、[specs.html](frontend/specs.html)、[outcome.html](frontend/outcome.html)
- `index.html` 中 `fetch(`${window.PROMPTLY_API_BASE}/api/pipeline/run`)`（确保实时与后台同步）
- `vercel.json` 控制缓存（`config.js` 设置 `Cache-Control: max-age=0`），防止旧配置残留
- `.gitignore` 新增 `/frontend/config.js` 防止提交生成文件

## 后端集成点

- `backend/src/server.js` 引入所有路由：`auth`, `doc`, `share`, `specs`, `questionSessions`, `runs`, `outcomeRuns`, `enhance`, `prompts`, `pipeline`
- Pipeline 路由提供 `/api/pipeline/run`, `/api/pipeline/health`, `/api/pipeline/stream/:runId`
- 根路径 `/` 返回 JSON，列出所有关键端点
- 请求日志中间件记录每次进出

## 文档与指南

- [docs/DEPLOYMENT_COMPLETE_GUIDE.md](docs/DEPLOYMENT_COMPLETE_GUIDE.md) - 详细部署及调试流程  
- [QUICK_START_DEPLOYMENT.md](QUICK_START_DEPLOYMENT.md) - 5 分钟快速部署指南  
- [DEPLOYMENT_FIXES_SUMMARY.md](DEPLOYMENT_FIXES_SUMMARY.md) - 本次关键修复记录  
- [INTEGRATION_CHECKLIST.md](INTEGRATION_CHECKLIST.md) - 集成验证清单  
- [verify-integration.sh](verify-integration.sh) & [test-deployment.sh](test-deployment.sh) - 自动化验证脚本

## 运行和测试

1. `npm run health`（Backend）  
2. `curl https://your-backend.onrender.com/api/health`  
3. 打开前端，查看 Console & Network，确保请求命中 Render 路径  
4. 触发 Run Optimization，确保 pipeline event log 显示五个阶段  

## 许可证
MIT
