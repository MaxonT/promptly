# Promptly

**Idiomas / Languages:** [English](README.md) · [中文](README.zh-CN.md) · [Español](README.es.md) · [Français](README.fr.md) · [日本語](README.ja.md) · [العربية](README.ar.md) · [한국어](README.ko.md) · [Português](README.pt.md) · [हिन्दी](README.hi.md)

Estúdio de otimização de prompts com IA: transforme um objetivo vago em um prompt mais claro via Spec → Questions → Candidates → Metrics → Outcome.

Não quer configurar uma API key? Use o produto hospedado: **[https://promptly.solutions/](https://promptly.solutions/)**  
(também linkado em Releases)

**O código principal do produto fica em `cursor-dev`.**  
`main` é o branch público de entrada / documentação. O trabalho diário do app acontece em `cursor-dev`.

Árvore executável atual: [`Promptly-cloud-v0.6.8.3-fullstack/`](Promptly-cloud-v0.6.8.3-fullstack/)

---

## Nuvem vs self-host

| Caminho | Quando usar |
|---------|-------------|
| **Nuvem** — [promptly.solutions](https://promptly.solutions/) | Experimentar sem configurar `OPENAI_API_KEY` / OAuth / deploy |
| **Local / self-host** | Desenvolver, personalizar ou rodar seu backend com suas chaves |

---

## Início rápido (local)

Trabalhe dentro da pasta fullstack:

```bash
cd Promptly-cloud-v0.6.8.3-fullstack
```

### 1. Backend

```bash
cd backend
cp .env.example .env
# defina pelo menos: JWT_SECRET + OPENAI_API_KEY
npm install
npm run dev                  # http://localhost:8080 (migrações na inicialização)
```

Variáveis mínimas para recursos de IA:

| Variável | Propósito |
|----------|-----------|
| `JWT_SECRET` | Assinatura JWT (obrigatória em produção; string longa aleatória) |
| `OPENAI_API_KEY` | Acesso OpenAI — sem ela, LLM / pipeline ficam desativados |
| `OPENAI_MODEL` | Opcional (padrão no exemplo: `gpt-4.1-mini`) |
| `CORS_ORIGIN` | Origens de frontend permitidas (separadas por vírgula) |
| `SQLITE_PATH` | BD local (padrão `./data/app.db`) |
| `DATABASE_URL` | Ativa PostgreSQL em vez de SQLite |
| `GROQ_API_KEY` | Caminho Groq opcional para alguns perfis |
| `FRONTEND_URL` | Base de redirecionamento Stripe / OAuth |
| `GOOGLE_*` / `GITHUB_*` | OAuth (opcional) |
| `STRIPE_*` / `SUBSCRIPTIONS_ENABLED` | Cobrança (opcional) |

Lista completa: [`backend/.env.example`](Promptly-cloud-v0.6.8.3-fullstack/backend/.env.example)

### 2. Frontend

```bash
cd frontend
VITE_API_BASE=http://localhost:8080 npm run build
python3 -m http.server 4173
```

Abra `http://localhost:4173/index.html`.  
As páginas leem `window.PROMPTLY_API_BASE` de `config.js` (gerado por `npm run build`).

### 3. Verificações rápidas

```bash
cd backend && npm run health
curl http://localhost:8080/api/health
```

---

## O que você pode fazer

| Recurso | O que faz |
|---------|-----------|
| Início / otimizar | Pipeline multiestágio com progresso ao vivo |
| Brainstormer (wizard) | Q&A guiado para afiar a intenção |
| Specs | Extração / revisão de specs a partir de metas e respostas |
| Enhancer | Iterar e refinar prompts existentes |
| Outcome | Comparar candidatos com métricas / runs outcome |
| Result | Visão de resultado compartilhável |
| Auth | Email/senha + OAuth Google / GitHub |
| Limites de uso | Banner diário / limites do plano |
| Assinaturas | Checkout Stripe (ativado via env) |
| Analytics | Superfícies de analytics admin |
| i18n | Nove locales com seletor de idioma |

---

## Stack técnica

| Camada | Escolha |
|--------|---------|
| Frontend | HTML / CSS / JS estático (`config.js` injeta a base da API) |
| Backend | Node.js ESM + Express |
| Banco | SQLite local; PostgreSQL quando há `DATABASE_URL` |
| Auth | JWT + bcrypt; OAuth Google / GitHub |
| IA | OpenAI (principal); Groq opcional via `GROQ_API_KEY` |
| Cobrança | Stripe (opcional) |
| Deploy | Render (API) + Vercel ou host estático (frontend) |

---

## Arquitetura (curta)

```
Navegador (frontend estático)
    │  fetch + Bearer JWT
    ▼
Express /api/*  (auth, oauth, pipeline, specs, questions, enhance, outcome, billing, analytics…)
    │
    ├─► SQLite ou PostgreSQL
    ├─► OpenAI / Groq (Spec → Questions → Agents → Metrics → Outcome)
    └─► Stripe (opcional)
```

Fluxo principal: `/api/pipeline/*` (`run`, `health`, `stream/:runId`).

---

## Páginas principais

| Caminho | Propósito |
|---------|-----------|
| `frontend/index.html` | Landing / otimizar |
| `frontend/wizard.html` | Brainstormer |
| `frontend/specs.html` | Specs |
| `frontend/enhancer.html` | Enhancer |
| `frontend/outcome.html` | Outcome / métricas |
| `frontend/result.html` | Visão de resultado |
| `frontend/settings.html` | Conta / configurações |
| `frontend/subscription.html` | Planos e cobrança |
| `frontend/account.html` | Painel da conta |

README aninhado (mais detalhe de deploy):  
[`Promptly-cloud-v0.6.8.3-fullstack/README.md`](Promptly-cloud-v0.6.8.3-fullstack/README.md)

---

## Scripts

```bash
# Backend
cd Promptly-cloud-v0.6.8.3-fullstack/backend
npm run dev
npm start
npm run health
npm run migrate
npm test

# Frontend
cd Promptly-cloud-v0.6.8.3-fullstack/frontend
npm run build
```

---

## Branches e layout

| Item | Papel |
|------|-------|
| `cursor-dev` | **Desenvolvimento ativo** — fonte da verdade do produto |
| `main` | README / docs de entrada públicas |
| `Promptly-cloud-v0.6.8.3-fullstack/` | Snapshot fullstack atual em `main` |
| Pastas `Promptly-cloud-v0.6.*` antigas | Snapshots históricos |
| `milestones/` | Artefatos de marcos |
| `Promptly 0.6.8 Fix Bundles/` | Arquivo de pacotes de correção |

---

## Licença

Os docs do pacote aninhado indicam MIT. Trate `.env` e API keys como segredos — nunca faça commit deles.
