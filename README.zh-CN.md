# Promptly

**语言 / Languages:** [English](README.md) · [中文](README.zh-CN.md) · [Español](README.es.md) · [Français](README.fr.md) · [日本語](README.ja.md) · [العربية](README.ar.md) · [한국어](README.ko.md) · [Português](README.pt.md) · [हिन्दी](README.hi.md)

AI Prompt 优化工作室：把粗糙目标，通过 Spec → Questions → Candidates → Metrics → Outcome 收成更清晰的 Prompt。

不想自己配置 API Key？直接用云端产品：**[https://promptly.solutions/](https://promptly.solutions/)**  
（Release 里也包含该入口）

**核心业务代码在 `cursor-dev`。**  
`main` 是仓库公开入口 / 文档分支；日常开发与云端维护以 `cursor-dev` 为准。

当前可运行目录：[`Promptly-cloud-v0.6.8.3-fullstack/`](Promptly-cloud-v0.6.8.3-fullstack/)

---

## 云端 vs 自建

| 路径 | 适用场景 |
|------|----------|
| **云端** — [promptly.solutions](https://promptly.solutions/) | 不想配 `OPENAI_API_KEY` / OAuth / 部署时，直接用 |
| **本地 / 自建** | 开发、定制，或用自己的 Key 跑后端 |

---

## 本地快速开始

进入 fullstack 目录：

```bash
cd Promptly-cloud-v0.6.8.3-fullstack
```

### 1. 后端

```bash
cd backend
cp .env.example .env
# 至少配置：JWT_SECRET + OPENAI_API_KEY
npm install
npm run dev                  # http://localhost:8080（启动时跑迁移）
```

AI 功能最少需要：

| 变量 | 作用 |
|------|------|
| `JWT_SECRET` | JWT 签名（生产必填；用足够长的随机串） |
| `OPENAI_API_KEY` | OpenAI 访问 — 不配则 LLM / pipeline 不可用 |
| `OPENAI_MODEL` | 可选（示例默认 `gpt-4.1-mini`） |
| `CORS_ORIGIN` | 允许的前端源（逗号分隔） |
| `SQLITE_PATH` | 本地库路径（默认 `./data/app.db`） |
| `DATABASE_URL` | 设置后走 PostgreSQL |
| `GROQ_API_KEY` | 可选，部分推理配置走 Groq |
| `FRONTEND_URL` | Stripe / OAuth 回跳基址 |
| `GOOGLE_*` / `GITHUB_*` | OAuth（可选） |
| `STRIPE_*` / `SUBSCRIPTIONS_ENABLED` | 订阅（可选） |

完整列表见 [`backend/.env.example`](Promptly-cloud-v0.6.8.3-fullstack/backend/.env.example)

### 2. 前端

```bash
cd frontend
VITE_API_BASE=http://localhost:8080 npm run build
python3 -m http.server 4173
```

打开 `http://localhost:4173/index.html`。  
页面通过 `config.js` 里的 `window.PROMPTLY_API_BASE` 找后端。

### 3. 冒烟检查

```bash
cd backend && npm run health
curl http://localhost:8080/api/health
```

---

## 能做什么

| 功能 | 说明 |
|------|------|
| 首页 / 优化 | 多阶段 Prompt 流水线 + 实时进度 |
| Brainstormer（向导） | 生成前用问答收紧意图 |
| Specs | 从目标与回答抽取 / 查看 Spec |
| Enhancer | 迭代强化已有 Prompt |
| Outcome | 候选对比与指标 / Outcome 运行 |
| Result | 运行结果与分享视图 |
| 登录 | 邮箱密码 + Google / GitHub OAuth |
| 用量 | 每日用量横幅 / 套餐限额 |
| 订阅 | Stripe 结账（环境变量开关） |
| 分析看板 | 管理端分析 |
| 多语言 | 九种语言包 + 语言切换 |

---

## 技术栈

| 层 | 选择 |
|----|------|
| 前端 | 静态 HTML / CSS / JS（`config.js` 注入 API 基址） |
| 后端 | Node.js ESM + Express |
| 数据库 | 本地 SQLite；有 `DATABASE_URL` 时用 PostgreSQL |
| 鉴权 | JWT + bcrypt；Google / GitHub OAuth |
| AI | OpenAI（主）；可选 Groq（`GROQ_API_KEY`） |
| 计费 | Stripe（可选） |
| 部署 | Render（API）+ Vercel / 静态托管（前端） |

---

## 架构（简）

```
浏览器（静态前端）
    │  fetch + Bearer JWT
    ▼
Express /api/* （auth、oauth、pipeline、specs、questions、enhance、outcome、billing、analytics…）
    │
    ├─► SQLite 或 PostgreSQL
    ├─► OpenAI / Groq（Spec → Questions → Agents → Metrics → Outcome）
    └─► Stripe（可选）
```

核心优化接口：`/api/pipeline/*`（`run`、`health`、`stream/:runId`）。

---

## 主要页面

| 路径 | 用途 |
|------|------|
| `frontend/index.html` | 落地 / 优化 |
| `frontend/wizard.html` | Brainstormer |
| `frontend/specs.html` | Specs |
| `frontend/enhancer.html` | Enhancer |
| `frontend/outcome.html` | Outcome / 指标 |
| `frontend/result.html` | 结果页 |
| `frontend/settings.html` | 设置 |
| `frontend/subscription.html` | 套餐与计费 |
| `frontend/account.html` | 账户 |

更细的部署说明：  
[`Promptly-cloud-v0.6.8.3-fullstack/README.md`](Promptly-cloud-v0.6.8.3-fullstack/README.md)

---

## 脚本

```bash
# 后端
cd Promptly-cloud-v0.6.8.3-fullstack/backend
npm run dev
npm start
npm run health
npm run migrate
npm test

# 前端
cd Promptly-cloud-v0.6.8.3-fullstack/frontend
npm run build
```

---

## 分支与目录

| 项 | 角色 |
|----|------|
| `cursor-dev` | **活跃开发** — 部署与产品源码真相源 |
| `main` | 公开 README / 入口文档 |
| `Promptly-cloud-v0.6.8.3-fullstack/` | `main` 上当前 fullstack |
| 更早的 `Promptly-cloud-v0.6.*` | 历史快照 |
| `milestones/` | 里程碑 |
| `Promptly 0.6.8 Fix Bundles/` | 修复包归档 |

---

## 许可证

子项目文档标注 MIT。`.env` 与 API Key 视为私密，切勿提交。
