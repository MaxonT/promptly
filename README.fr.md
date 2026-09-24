# Promptly

**Langues / Languages:** [English](README.md) · [中文](README.zh-CN.md) · [Español](README.es.md) · [Français](README.fr.md) · [日本語](README.ja.md) · [العربية](README.ar.md) · [한국어](README.ko.md) · [Português](README.pt.md) · [हिन्दी](README.hi.md)

Studio d’optimisation de prompts par IA : transformez un objectif flou en un prompt plus clair via Spec → Questions → Candidates → Metrics → Outcome.

Vous ne voulez pas configurer de clé API ? Utilisez le produit hébergé : **[https://promptly.solutions/](https://promptly.solutions/)**  
(également indiqué dans les Releases)

**Le code produit principal est sur `cursor-dev`.**  
`main` est la branche publique d’entrée / documentation. Le travail quotidien se fait sur `cursor-dev`.

Arborescence exécutable actuelle : [`Promptly-cloud-v0.6.8.3-fullstack/`](Promptly-cloud-v0.6.8.3-fullstack/)

---

## Cloud vs auto-hébergement

| Chemin | Quand l’utiliser |
|--------|------------------|
| **Cloud** — [promptly.solutions](https://promptly.solutions/) | Essayer le produit sans configurer `OPENAI_API_KEY` / OAuth / déploiement |
| **Local / auto-hébergé** | Développer, personnaliser, ou faire tourner votre backend avec vos clés |

---

## Démarrage rapide (local)

Travaillez dans le dossier fullstack :

```bash
cd Promptly-cloud-v0.6.8.3-fullstack
```

### 1. Backend

```bash
cd backend
cp .env.example .env
# définir au minimum : JWT_SECRET + OPENAI_API_KEY
npm install
npm run dev                  # http://localhost:8080 (migrations au démarrage)
```

Variables minimales pour l’IA :

| Variable | Rôle |
|----------|------|
| `JWT_SECRET` | Signature JWT (obligatoire en production ; longue chaîne aléatoire) |
| `OPENAI_API_KEY` | Accès OpenAI — sans elle, LLM / pipeline sont désactivés |
| `OPENAI_MODEL` | Optionnel (défaut dans l’exemple : `gpt-4.1-mini`) |
| `CORS_ORIGIN` | Origines frontend autorisées (séparées par des virgules) |
| `SQLITE_PATH` | BD locale (défaut `./data/app.db`) |
| `DATABASE_URL` | Active PostgreSQL à la place de SQLite |
| `GROQ_API_KEY` | Chemin Groq optionnel pour certains profils |
| `FRONTEND_URL` | Base de redirection Stripe / OAuth |
| `GOOGLE_*` / `GITHUB_*` | OAuth (optionnel) |
| `STRIPE_*` / `SUBSCRIPTIONS_ENABLED` | Facturation (optionnel) |

Liste complète : [`backend/.env.example`](Promptly-cloud-v0.6.8.3-fullstack/backend/.env.example)

### 2. Frontend

```bash
cd frontend
VITE_API_BASE=http://localhost:8080 npm run build
python3 -m http.server 4173
```

Ouvrez `http://localhost:4173/index.html`.  
Les pages lisent `window.PROMPTLY_API_BASE` depuis `config.js` (généré par `npm run build`).

### 3. Vérifications rapides

```bash
cd backend && npm run health
curl http://localhost:8080/api/health
```

---

## Ce que vous pouvez faire

| Fonction | Description |
|----------|-------------|
| Accueil / optimiser | Pipeline multi-étapes avec progression en direct |
| Brainstormer (wizard) | Q&R guidées pour clarifier l’intention |
| Specs | Extraction / revue de specs à partir des objectifs et réponses |
| Enhancer | Itérer et affiner des prompts existants |
| Outcome | Comparer des candidats avec métriques / runs outcome |
| Result | Vue de résultat partageable |
| Auth | Email/mot de passe + OAuth Google / GitHub |
| Limites d’usage | Bannière quotidienne / limites du plan |
| Abonnements | Checkout Stripe (activé via env) |
| Analytics | Surfaces analytics admin |
| i18n | Neuf locales avec sélecteur de langue |

---

## Stack technique

| Couche | Choix |
|--------|-------|
| Frontend | HTML / CSS / JS statique (`config.js` injecte la base API) |
| Backend | Node.js ESM + Express |
| Base de données | SQLite en local ; PostgreSQL si `DATABASE_URL` |
| Auth | JWT + bcrypt ; OAuth Google / GitHub |
| IA | OpenAI (principal) ; Groq optionnel via `GROQ_API_KEY` |
| Facturation | Stripe (optionnel) |
| Déploiement | Render (API) + Vercel ou hébergeur statique (frontend) |

---

## Architecture (court)

```
Navigateur (frontend statique)
    │  fetch + Bearer JWT
    ▼
Express /api/*  (auth, oauth, pipeline, specs, questions, enhance, outcome, billing, analytics…)
    │
    ├─► SQLite ou PostgreSQL
    ├─► OpenAI / Groq (Spec → Questions → Agents → Metrics → Outcome)
    └─► Stripe (optionnel)
```

Flux principal : `/api/pipeline/*` (`run`, `health`, `stream/:runId`).

---

## Pages principales

| Chemin | Rôle |
|--------|------|
| `frontend/index.html` | Landing / optimiser |
| `frontend/wizard.html` | Brainstormer |
| `frontend/specs.html` | Specs |
| `frontend/enhancer.html` | Enhancer |
| `frontend/outcome.html` | Outcome / métriques |
| `frontend/result.html` | Vue résultat |
| `frontend/settings.html` | Compte / réglages |
| `frontend/subscription.html` | Plans & facturation |
| `frontend/account.html` | Panneau compte |

README imbriqué (plus de détail déploiement) :  
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

## Branches & layout

| Élément | Rôle |
|---------|------|
| `cursor-dev` | **Développement actif** — source de vérité produit |
| `main` | README / docs d’entrée publiques |
| `Promptly-cloud-v0.6.8.3-fullstack/` | Snapshot fullstack actuel sur `main` |
| Anciens dossiers `Promptly-cloud-v0.6.*` | Snapshots historiques |
| `milestones/` | Artefacts de jalons |
| `Promptly 0.6.8 Fix Bundles/` | Archive des correctifs |

---

## Licence

Les docs du package imbriqué indiquent MIT. Traitez `.env` et les clés API comme secrets — ne les committez jamais.
