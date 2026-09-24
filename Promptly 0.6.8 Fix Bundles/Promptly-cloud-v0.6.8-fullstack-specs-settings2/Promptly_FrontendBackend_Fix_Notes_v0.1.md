# Promptly CloudTest – Frontend/Backend Fix Notes

## What went wrong
- The `Promptly-cloud-v0.6.4-fullstack-wizarddbfix.zip` archive contains a `frontend 2/` folder that only has:
  - index.html, privacy.html, terms.html, cookies.html, core.js, style.css, etc.
- It does **not** include settings.html/specs.html/wizard.html/outcome.html.
- If this archive is used as the Vercel project, opening /settings.html will return 404.

## Correct separation

- **Backend (Render):**
  - Use the `backend/` folder from `Promptly-cloud-v0.6.4-fullstack-wizarddbfix.zip`.
  - Ensure `SQLITE_PATH=./data/app-v0-7.db` is set.
  - Start command should run `backend/src/server.js`.

- **Frontend (Vercel):**
  - Use the `frontend/` folder from `frontend-api-base-fixed-v2.zip`.
  - This folder contains:
    - index.html
    - settings.html
    - specs.html
    - wizard.html
    - outcome.html
    - enhancer.html
    - *.js / *.css / assets
  - These files already call the Render backend via API_BASE.

## Test checklist

1. Open backend health:
   - https://<render-domain>/api/health

2. Open frontend pages:
   - https://<vercel-domain>/settings.html
   - https://<vercel-domain>/specs.html
   - https://<vercel-domain>/wizard.html
   - https://<vercel-domain>/outcome.html
