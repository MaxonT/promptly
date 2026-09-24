# Promptly v0.6.8.1 – Patch Summary (API_BASE / Env Alignment)

## 1. Unified API_BASE configuration (frontend)

Updated the API base URL selection logic in the following frontend files:

- `frontend/wizard.js`  
- `frontend/specs.js`  
- `frontend/settings.js`  
- `frontend/outcome.js`  

### Before

```js
const API_BASE = window.PROMPTLY_API_BASE || "https://promptly-v0-6-cloudtest.onrender.com";
```

This meant:

- If `window.PROMPTLY_API_BASE` was not defined on the page,  
- The frontend would always call the old `promptly-v0-6-cloudtest.onrender.com` backend,  
- Even when deployed to a new Render service or running locally.

### After

```js
const API_BASE = (window.PROMPTLY_API_BASE && window.PROMPTLY_API_BASE.trim())
  || (window.location && window.location.origin && window.location.origin !== "null"
    ? window.location.origin
    : "http://localhost:8080");
```

Behavior:

1. If the page defines `window.PROMPTLY_API_BASE` (for example via an inline script on Vercel),
   that value is used as the backend base URL.  
2. Otherwise, it falls back to `window.location.origin` (same-origin backend).  
3. As a final dev fallback, it uses `http://localhost:8080` so that a local static server can talk
   to a local Node backend without extra config.

This change makes the frontend follow the deployment spec idea:
> Backend base URL should come from environment / injection, not be hard-coded to a single Render URL.

## 2. No other behavior changes

- No backend files were modified.  
- No HTML, CSS, or UI text was changed.  
- All existing routes and Question Wizard logic remain exactly the same; only the way
  they discover the backend base URL has changed.

## 3. Impact

- You can now deploy multiple backend environments (dev / staging / prod) and simply
  inject `window.PROMPTLY_API_BASE` on each Vercel environment without touching the code.  
- Local development is more robust: if you open the HTML from a static server, it will
  default to hitting `http://localhost:8080` instead of an outdated Render URL.  
- This patch is fully backward compatible for any setup that was already injecting
  `window.PROMPTLY_API_BASE` explicitly.
