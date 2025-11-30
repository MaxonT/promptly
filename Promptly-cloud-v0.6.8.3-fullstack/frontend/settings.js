const API_BASE = (window.PROMPTLY_API_BASE && window.PROMPTLY_API_BASE.trim())
  || (window.location && window.location.origin && window.location.origin !== "null"
    ? window.location.origin
    : "http://localhost:8080");

(() => {
  const envSummaryEl = document.getElementById("envSummary");
  const modelListEl = document.getElementById("modelList");
  const featuresListEl = document.getElementById("featuresList");
  const rawSettingsEl = document.getElementById("rawSettings");
  const logEl = document.getElementById("settingsLog");
  const authStatusEl = document.getElementById("authStatus");
  const authMessageEl = document.getElementById("authMessage");
  const authFormsEl = document.getElementById("authForms");
  const loginForm = document.getElementById("loginForm");
  const registerForm = document.getElementById("registerForm");
  const logoutBtn = document.getElementById("logoutBtn");
  const TOKEN_KEY = "PROMPTLY_TOKEN";

  function log(line) {
    const ts = new Date().toISOString().slice(11, 19);
    logEl.textContent += `[${ts}] ${line}\n`;
    logEl.scrollTop = logEl.scrollHeight;
  }

  function setAuthMessage(message = "", isError = false) {
    if (!authMessageEl) return;
    authMessageEl.textContent = message;
    authMessageEl.style.color = isError ? "#f87171" : "var(--accent, #0ea5e9)";
  }

  function getToken() {
    return window.localStorage.getItem(TOKEN_KEY);
  }

  function saveToken(token) {
    if (!token) {
      window.localStorage.removeItem(TOKEN_KEY);
      return;
    }
    window.localStorage.setItem(TOKEN_KEY, token);
  }

  function updateAuthView(user) {
    if (!authStatusEl) return;
    if (user) {
      const tier = user.subscription?.tier || "free";
      const active = user.subscription?.isActive ? "active" : "inactive";
      authStatusEl.textContent = `Signed in as ${user.email} · Plan: ${tier} (${active})`;
      authFormsEl?.classList.add("hidden");
      logoutBtn?.classList.remove("hidden");
    } else {
      authStatusEl.textContent = "Not signed in.";
      authFormsEl?.classList.remove("hidden");
      logoutBtn?.classList.add("hidden");
    }
  }

  function authHeaders(extra = {}) {
    const headers = { ...extra };
    const token = getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    return headers;
  }

  async function fetchWithAuth(path, options = {}) {
    const headers = authHeaders(options.headers || {});
    return fetch(`${API_BASE}${path}`, { ...options, headers });
  }

  async function loadAccount() {
    if (!authStatusEl) return;
    const token = getToken();
    if (!token) {
      updateAuthView(null);
      return;
    }
    try {
      log("GET /api/auth/me ...");
      const res = await fetchWithAuth("/api/auth/me");
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Unable to load account");
      }
      updateAuthView(data.user);
      setAuthMessage("");
      log("Account loaded.");
    } catch (err) {
      console.error(err);
      saveToken(null);
      updateAuthView(null);
      setAuthMessage("Session expired. Please sign in again.", true);
      log("Account error: " + err.message);
    }
  }

  async function submitAuthForm(path, payload) {
    log(`POST ${path} ...`);
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      throw new Error(data.error || "Request failed");
    }
    return data;
  }

  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(loginForm);
    const payload = {
      email: (formData.get("loginEmail") || "").toString().trim(),
      password: formData.get("loginPassword")
    };
    try {
      const data = await submitAuthForm("/api/auth/login", payload);
      saveToken(data.token);
      updateAuthView(data.user);
      setAuthMessage("Signed in successfully.");
      loginForm.reset();
    } catch (err) {
      console.error(err);
      setAuthMessage(err.message, true);
    }
  });

  registerForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(registerForm);
    const payload = {
      email: (formData.get("registerEmail") || "").toString().trim(),
      password: formData.get("registerPassword")
    };
    try {
      const data = await submitAuthForm("/api/auth/register", payload);
      saveToken(data.token);
      updateAuthView(data.user);
      setAuthMessage("Account created and signed in.");
      registerForm.reset();
    } catch (err) {
      console.error(err);
      setAuthMessage(err.message, true);
    }
  });

  logoutBtn?.addEventListener("click", async () => {
    try {
      await fetchWithAuth("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.warn("Logout request failed", err);
    }
    saveToken(null);
    updateAuthView(null);
    setAuthMessage("Signed out.");
  });

  async function loadSettings() {
    try {
      log("GET /api/settings ...");
      const res = await fetch(`${API_BASE}/api/settings`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        log("Settings error: HTTP " + res.status + " " + JSON.stringify(data));
        envSummaryEl.textContent =
          "Failed to load settings. See log for details.";
        return;
      }
      const s = data.settings || {};
      const env = s.env || "unknown";
      const llmEnabled = s.llmEnabled ? "enabled" : "disabled";

      envSummaryEl.textContent = `Environment: ${env} · LLM: ${llmEnabled}`;

      modelListEl.innerHTML = "";
      const modelDisplayName = "Promptly Refined LLM Model";
      const rows = [
        ["Default model", modelDisplayName],
        ["Outcome model", s.outcomeModel ? modelDisplayName : "(uses default)"],
        ["Max candidates", String(s.maxCandidates ?? 8)]
      ];
      for (const [label, value] of rows) {
        const dt = document.createElement("dt");
        dt.textContent = label;
        const dd = document.createElement("dd");
        dd.textContent = value;
        modelListEl.appendChild(dt);
        modelListEl.appendChild(dd);
      }

      featuresListEl.innerHTML = "";
      const features = s.features || {};
      const featureIcons = {
        questionWizard: "🧙",
        promptEnhancer: "✨",
        outcomeRunner: "🎯"
      };
      const featureLabels = {
        questionWizard: "Question Wizard",
        promptEnhancer: "Prompt Enhancer",
        outcomeRunner: "Outcome Runner"
      };
      Object.keys(features).forEach((key) => {
        const li = document.createElement("li");
        const isOn = features[key];
        
        const iconSpan = document.createElement("span");
        iconSpan.className = "feature-icon";
        iconSpan.textContent = featureIcons[key] || "⚡";
        
        const nameSpan = document.createElement("span");
        nameSpan.className = "feature-name";
        nameSpan.textContent = featureLabels[key] || key;
        
        const statusSpan = document.createElement("span");
        statusSpan.className = `feature-status ${isOn ? "on" : "off"}`;
        statusSpan.textContent = isOn ? "Active" : "Inactive";
        
        li.appendChild(iconSpan);
        li.appendChild(nameSpan);
        li.appendChild(statusSpan);
        featuresListEl.appendChild(li);
      });

      rawSettingsEl.textContent = JSON.stringify(s, null, 2);
      log("Settings loaded.");
    } catch (err) {
      console.error(err);
      envSummaryEl.textContent = "Error loading settings.";
      log("Settings error: " + err.message);
    }
  }

  loadSettings();
  loadAccount();
})();