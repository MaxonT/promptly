# Promptly: run and reuse the pipeline

The runnable public snapshot is on **main**, under `Promptly-cloud-v0.6.8.3-fullstack/`.
`cursor-dev` remains an ongoing development branch. Older version folders are historical
snapshots; start with the current fullstack folder.

## Start your own copy

```bash
git clone https://github.com/MaxonT/promptly.git
cd promptly/Promptly-cloud-v0.6.8.3-fullstack
node scripts/setup-local.mjs
docker compose up --build
```

Open http://localhost:4173/index.html and register with email/password. Setup creates
`backend/.env` with a random login signing key. It preserves existing configuration,
uses owner-only file permissions and never prints the key. Add your own
`ANTHROPIC_API_KEY` to this file for real optimization. The app can start without it;
the optimization endpoint clearly reports the missing key instead of producing real output.

Docker with Compose runs the backend, static frontend and a fresh SQLite database.
The frontend uses a same-origin local API proxy. Its container-specific config does not
change the maintained hosted frontend config. The web port is bound to localhost.
The named `app-data` volume retains accounts and saved prompts across restarts.
Stop with Ctrl+C or `docker compose down`; restart with `docker compose up --build`.
`docker compose down -v` deletes that local database. To change the local web port,
use `WEB_PORT=4174 docker compose up --build`.

Node.js 22 is used by the setup helper. If you only have Docker, run this instead of
`node scripts/setup-local.mjs`:

```bash
docker run --rm -v "$PWD:/workspace" -w /workspace node:22-alpine node scripts/setup-local.mjs
```

### Native Node route (without Docker)

Use Node 22 and run the same setup helper first. From the current fullstack folder:

```bash
cd backend
npm ci
npm run check:config
npm start
```

In another terminal, from `Promptly-cloud-v0.6.8.3-fullstack/frontend/`:

```bash
npm run build
python3 -m http.server 4173
```

The frontend defaults to your backend on port 8080. Local defaults disable payment,
trials and token metering. Ordinary daily plan/mode limits still apply.
From `backend/`, `npm run health` checks the running server;
`npm run check:config -- --mode fast` checks required AI configuration.
Config checks inspect presence only; they never print secrets or make paid API calls.
`backend/.env` takes precedence over the fullstack root `.env`; externally supplied
environment variables take precedence over both. Start backend commands from `backend/`.
Compose fixes local database/payment/CORS defaults; keys still come from `backend/.env`.
The localhost Compose setup is not a production HTTPS/domain configuration.

## Provider requirements

| Flow | Your credentials |
|------|------------------|
| Current pipeline, all modes | `ANTHROPIC_API_KEY` |
| Optional Groq-backed wizard / legacy flows | `GROQ_API_KEY` |
| Standalone/legacy OpenAI routes | `OPENAI_API_KEY`, only if you use those routes |
| Login/session signing | Your own generated `JWT_SECRET`, at least 32 characters |
| Google/GitHub login | Your own OAuth app credentials, optional |
| Payments | Your own Stripe account/price/webhook credentials, optional |

Your provider account pays for API calls. Open-source code does not include access
to the maintainer's paid APIs, database or hosted user accounts. The default configuration
uses a fresh SQLite database; no maintainer database is needed.

## What can be inherited

[`backend/src/routes/pipeline.js`](Promptly-cloud-v0.6.8.3-fullstack/backend/src/routes/pipeline.js)
currently runs:

**User input + attachment metadata → Anthropic direct optimizer → stored result + SSE events.**
Fast/Standard use Haiku 4.5; Premium uses Sonnet 4.6. It restructures a request while
preserving the user's intent. It does not execute the requested task. Attachment metadata
is passed; this endpoint does not upload the actual attachment contents.

The old multi-stage configuration (Spec → Generation → Critique → Refine → Evaluation)
is retained in the source, but it is not executed by the current `/api/pipeline/run`.
Compatibility result scores/progress events are not an independent quality benchmark.

- [`modelConfig.js`](Promptly-cloud-v0.6.8.3-fullstack/backend/src/lib/modelConfig.js): current direct-optimizer model map and retained legacy stage configuration.
- [`llmRouter.js`](Promptly-cloud-v0.6.8.3-fullstack/backend/src/lib/llmRouter.js): provider routing, retries and timeouts.
- [`pipeline.js`](Promptly-cloud-v0.6.8.3-fullstack/backend/src/routes/pipeline.js): intent-preserving system prompt, persistence and SSE contract.
- Other modules such as the ambiguity detector/exemplar service remain available to developers; their presence does not mean the current main flow runs those stages.

This is an application to fork and adapt, not a standalone SDK. The pipeline uses
authenticated users, database records, plan limits and SSE events. To extract it,
replace those application dependencies with your own persistence/auth/event interfaces.

### Use the local API

Log in with your local account to obtain a JWT, then set it in your shell as `TOKEN`:

```bash
curl -X POST http://localhost:8080/api/pipeline/run   -H "Authorization: Bearer $TOKEN"   -H "Content-Type: application/json"   -d '{"idea":"Write a concise welcome email for new library members","model":"fast","skipQuestions":true}'
```

Use the returned run/stream token with `/api/pipeline/stream/:runId?st=...` to
consume progress events. See the frontend for the full request/SSE contract.
Missing required provider keys return HTTP 503 with their variable names before a run starts.

## Self-host deployment

Generate frontend config for your own API:

```bash
VITE_API_BASE=https://your-api.example npm run build
```

Set backend `CORS_ORIGIN`, `FRONTEND_URL` and `FRONTEND_URLS` to your frontend
origin(s), plus a strong JWT secret and the keys for your chosen mode. Keep secrets
on the backend. Docker uses Node 22, runs the backend as an unprivileged user and excludes `.env`, logs and local databases.
SQLite is the verified local setup. PostgreSQL code exists, but some older routes
and migration scripts still assume SQLite; treat PostgreSQL deployment as requiring
a separate compatibility review. Historical deploy guides are reference material.

## License and historical files

MIT; see [LICENSE](LICENSE). Third-party code retains its original notices.
Old version directories remain for reference. The current runnable snapshot excludes
tracked local database files and monitoring logs. Removal from a current tree does not
remove old Git history. Credential presence checks are not a full historical secret scan.

## 中文

`main` 现在包含可运行的公开版本；从 `Promptly-cloud-v0.6.8.3-fullstack/` 开始。
Node 22 + SQLite + 邮箱密码登录即可搭建基础应用。自己生成 `JWT_SECRET`；
当前主入口的全部模式填 Anthropic 密钥；Groq/OpenAI 用于可选的其他流程。支付和社交登录可选。
源码可以修改和复用，AI 调用使用你自己的账号和额度。

## Admin sync and coupons

Admin write endpoints are disabled without your own `SYNC_TOKEN` and require that token in the Authorization header. Public sample coupon codes are no longer seeded and are disabled on startup; existing redeemed subscriptions are retained. Operators create their own private promotion codes separately.

## Packages and Docker, plainly

`package.json` lists dependencies and command shortcuts. `npm ci` installs the versions
recorded in `package-lock.json`. These are private application packages; no npm library
is being published. The supported way to inherit the app is to fork this repository.

Docker packages the runtime, dependencies and source into an image; Compose starts
the frontend/backend and mounts a separate volume for saved data. Secrets are supplied
at runtime from your own configuration. The local setup does not publish images or
create cloud services. `npm run setup:local`, `npm run docker:up` and `npm run docker:down`
are shortcuts in the current fullstack folder; setup itself needs no npm install.

中文快捷方式：进入当前 fullstack 文件夹，运行 `node scripts/setup-local.mjs`，再运行
`docker compose up --build`，打开 http://localhost:4173。密钥由脚本生成，Anthropic API key
自己填写。Docker 包含运行环境、依赖和源码；密钥和用户数据库留在使用者自己的环境里。
