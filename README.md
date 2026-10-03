# Promptly: run and reuse the pipeline

The runnable public snapshot is on **main**, under `Promptly-cloud-v0.6.8.3-fullstack/`.
`cursor-dev` remains an ongoing development branch. Older version folders are historical
snapshots; start with the current fullstack folder.

## Quick start (Node.js 22)

```bash
git clone https://github.com/MaxonT/promptly.git
cd promptly/Promptly-cloud-v0.6.8.3-fullstack/backend
cp .env.example .env
openssl rand -hex 32
```

Paste the generated value into `JWT_SECRET` in `.env`. Add your own Anthropic key for
the current direct-optimizer pipeline (all modes).

```bash
npm ci
npm run check:config -- --mode fast
npm start
```

In another terminal, from `Promptly-cloud-v0.6.8.3-fullstack/frontend/`:

```bash
npm run build
python3 -m http.server 4173
```

Open http://localhost:4173/index.html and create an email/password account.
The frontend defaults to your backend on port 8080. Local defaults disable payment,
trials and token metering. Ordinary daily plan/mode limits still apply.

From `backend/`, verify the running app:

```bash
npm run health
npm test
npm run check:config -- --mode standard
```

Config checks inspect presence only; they never print secrets or make paid API calls.
`npm test` checks config and a running backend, not AI output quality.
`backend/.env` takes precedence over the fullstack root `.env`; externally supplied
environment variables take precedence over both. Start backend commands from `backend/`.

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
on the backend. Docker uses Node 22 and excludes `.env`, logs and local databases.
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
