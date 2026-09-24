# Promptly

**Idiomas / Languages:** [English](README.md) · [中文](README.zh-CN.md) · [Español](README.es.md) · [Français](README.fr.md) · [日本語](README.ja.md) · [العربية](README.ar.md) · [한국어](README.ko.md) · [Português](README.pt.md) · [हिन्दी](README.hi.md)

Estudio de optimización de prompts con IA: convierte un objetivo impreciso en un prompt más claro mediante Spec → Questions → Candidates → Metrics → Outcome.

¿No quieres configurar una API key? Usa el producto alojado: **[https://promptly.solutions/](https://promptly.solutions/)**  
(también enlazado en Releases)

**El código principal del producto está en `cursor-dev`.**  
`main` es la rama pública de entrada / documentación. El trabajo diario de la app está en `cursor-dev`.

Árbol ejecutable actual: [`Promptly-cloud-v0.6.8.3-fullstack/`](Promptly-cloud-v0.6.8.3-fullstack/)

---

## Nube vs autoalojado

| Ruta | Cuándo usarla |
|------|----------------|
| **Nube** — [promptly.solutions](https://promptly.solutions/) | Probar el producto sin configurar `OPENAI_API_KEY` / OAuth / despliegue |
| **Local / autoalojado** | Desarrollar, personalizar o ejecutar tu propio backend con tus claves |

---

## Inicio rápido (local)

Trabaja dentro de la carpeta fullstack:

```bash
cd Promptly-cloud-v0.6.8.3-fullstack
```

### 1. Backend

```bash
cd backend
cp .env.example .env
# configura al menos: JWT_SECRET + OPENAI_API_KEY
npm install
npm run dev                  # http://localhost:8080 (migraciones al iniciar)
```

Variables mínimas para funciones de IA:

| Variable | Propósito |
|----------|-----------|
| `JWT_SECRET` | Firma JWT (obligatoria en producción; cadena larga aleatoria) |
| `OPENAI_API_KEY` | Acceso a OpenAI — sin ella, LLM / pipeline están desactivados |
| `OPENAI_MODEL` | Opcional (por defecto en el ejemplo: `gpt-4.1-mini`) |
| `CORS_ORIGIN` | Orígenes de frontend permitidos (separados por comas) |
| `SQLITE_PATH` | BD local (por defecto `./data/app.db`) |
| `DATABASE_URL` | Activa PostgreSQL en lugar de SQLite |
| `GROQ_API_KEY` | Ruta opcional Groq para algunos perfiles |
| `FRONTEND_URL` | Base de redirección Stripe / OAuth |
| `GOOGLE_*` / `GITHUB_*` | OAuth (opcional) |
| `STRIPE_*` / `SUBSCRIPTIONS_ENABLED` | Facturación (opcional) |

Lista completa: [`backend/.env.example`](Promptly-cloud-v0.6.8.3-fullstack/backend/.env.example)

### 2. Frontend

```bash
cd frontend
VITE_API_BASE=http://localhost:8080 npm run build
python3 -m http.server 4173
```

Abre `http://localhost:4173/index.html`.  
Las páginas leen `window.PROMPTLY_API_BASE` desde `config.js` (generado por `npm run build`).

### 3. Comprobaciones rápidas

```bash
cd backend && npm run health
curl http://localhost:8080/api/health
```

---

## Qué puedes hacer

| Función | Qué hace |
|---------|----------|
| Inicio / optimizar | Ejecuta el pipeline multi-etapa con progreso en vivo |
| Brainstormer (wizard) | Preguntas guiadas para afinar la intención |
| Specs | Extracción / revisión de specs a partir de metas y respuestas |
| Enhancer | Itera y refina prompts existentes |
| Outcome | Compara candidatos con métricas / ejecuciones outcome |
| Result | Vista de resultado compartible |
| Auth | Email/contraseña + OAuth Google / GitHub |
| Límites de uso | Banner diario / límites del plan |
| Suscripciones | Checkout Stripe (activado por env) |
| Analytics | Superficies de analytics de admin |
| i18n | Nueve locales con selector de idioma |

---

## Stack técnico

| Capa | Elección |
|------|----------|
| Frontend | HTML / CSS / JS estático (`config.js` inyecta la base de la API) |
| Backend | Node.js ESM + Express |
| Base de datos | SQLite local; PostgreSQL si hay `DATABASE_URL` |
| Auth | JWT + bcrypt; OAuth Google / GitHub |
| IA | OpenAI (principal); Groq opcional vía `GROQ_API_KEY` |
| Facturación | Stripe (opcional) |
| Despliegue | Render (API) + Vercel o host estático (frontend) |

---

## Arquitectura (breve)

```
Navegador (frontend estático)
    │  fetch + Bearer JWT
    ▼
Express /api/*  (auth, oauth, pipeline, specs, questions, enhance, outcome, billing, analytics…)
    │
    ├─► SQLite o PostgreSQL
    ├─► OpenAI / Groq (Spec → Questions → Agents → Metrics → Outcome)
    └─► Stripe (opcional)
```

Flujo principal: `/api/pipeline/*` (`run`, `health`, `stream/:runId`).

---

## Páginas principales

| Ruta | Propósito |
|------|-----------|
| `frontend/index.html` | Landing / optimizar |
| `frontend/wizard.html` | Brainstormer |
| `frontend/specs.html` | Specs |
| `frontend/enhancer.html` | Enhancer |
| `frontend/outcome.html` | Outcome / métricas |
| `frontend/result.html` | Vista de resultado |
| `frontend/settings.html` | Cuenta / ajustes |
| `frontend/subscription.html` | Planes y facturación |
| `frontend/account.html` | Panel de cuenta |

README anidado (más detalle de despliegue):  
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

## Ramas y layout

| Elemento | Rol |
|----------|-----|
| `cursor-dev` | **Desarrollo activo** — fuente de verdad del producto |
| `main` | README / docs de entrada pública |
| `Promptly-cloud-v0.6.8.3-fullstack/` | Snapshot fullstack actual en `main` |
| Carpetas `Promptly-cloud-v0.6.*` anteriores | Snapshots históricos |
| `milestones/` | Artefactos de hitos |
| `Promptly 0.6.8 Fix Bundles/` | Archivo de paquetes de corrección |

---

## Licencia

Los docs del paquete anidado indican MIT. Trata `.env` y las API keys como secretos — nunca los subas al repo.
