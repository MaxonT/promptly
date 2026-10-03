// For a separate API host, generate this file with VITE_API_BASE=... npm run build.
window.PROMPTLY_API_BASE = window.PROMPTLY_API_BASE ||
  (["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? `${window.location.protocol}//${window.location.hostname}:8080`
    : window.location.origin);
window.PROMPTLY_MAINTENANCE_MODE = false;
