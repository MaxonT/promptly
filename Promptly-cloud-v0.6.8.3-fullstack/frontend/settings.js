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
  const refreshAccount = () => loadAccount();

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
      await refreshAccount();
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
      await refreshAccount();
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
      const modelItems = [
        { icon: "🤖", label: "Default Model", value: modelDisplayName, badge: "Primary", desc: "Main generation model that produces the actual responses." },
        { icon: "🎯", label: "Outcome Model", value: s.outcomeModel ? modelDisplayName : "Promptly Refined Judge", badge: "Optimized", desc: "Judging model that scores candidates and picks the best one." },
        { icon: "📊", label: "Max Candidates", value: String(s.maxCandidates ?? 8), badge: "Optimized", desc: "Generates up to 8 candidate answers per run and selects the best." }
      ];
      for (const item of modelItems) {
        const div = document.createElement("div");
        div.className = "model-item";
        
        const iconSpan = document.createElement("span");
        iconSpan.className = "model-icon";
        iconSpan.textContent = item.icon;
        
        const detailsDiv = document.createElement("div");
        detailsDiv.className = "model-details";
        
        const headerDiv = document.createElement("div");
        headerDiv.className = "model-header";
        
        const labelSpan = document.createElement("span");
        labelSpan.className = "model-label";
        labelSpan.textContent = item.label + ": ";
        
        const valueSpan = document.createElement("span");
        valueSpan.className = "model-value";
        valueSpan.textContent = item.value;
        
        headerDiv.appendChild(labelSpan);
        headerDiv.appendChild(valueSpan);
        
        const descSpan = document.createElement("div");
        descSpan.className = "model-desc";
        descSpan.textContent = item.desc;
        
        detailsDiv.appendChild(headerDiv);
        detailsDiv.appendChild(descSpan);
        div.appendChild(iconSpan);
        div.appendChild(detailsDiv);
        
        if (item.badge) {
          const badgeSpan = document.createElement("span");
          badgeSpan.className = "model-badge";
          badgeSpan.textContent = item.badge;
          div.appendChild(badgeSpan);
        }
        
        modelListEl.appendChild(div);
      }

      featuresListEl.innerHTML = "";
      const features = s.features || {};
      const featureIcons = {
        questionWizard: "🧙",
        promptEnhancer: "✨",
        outcomeRunner: "🎯",
        uniqueLLMAlgorithm: "🚀"
      };
      const featureLabels = {
        questionWizard: "Question Wizard",
        promptEnhancer: "Prompt Enhancer",
        outcomeRunner: "Outcome Runner",
        uniqueLLMAlgorithm: "Promptly Unique LLMs Prompt Algorithm"
      };
      const featureDescs = {
        questionWizard: "Smart clarifying questions",
        promptEnhancer: "AI-powered optimization",
        outcomeRunner: "Best result selection",
        uniqueLLMAlgorithm: "Our proprietary algorithm power"
      };
      
      // Add our special algorithm feature (always on)
      const allFeatures = { ...features, uniqueLLMAlgorithm: true };
      
      Object.keys(allFeatures).forEach((key) => {
        const li = document.createElement("li");
        const isOn = allFeatures[key];
        
        const iconSpan = document.createElement("span");
        iconSpan.className = "feature-icon";
        iconSpan.textContent = featureIcons[key] || "⚡";
        
        const contentDiv = document.createElement("div");
        contentDiv.style.flex = "1";
        
        const nameSpan = document.createElement("span");
        nameSpan.className = "feature-name";
        nameSpan.textContent = featureLabels[key] || key;
        
        const descSpan = document.createElement("div");
        descSpan.className = "feature-desc";
        descSpan.textContent = featureDescs[key] || "";
        
        contentDiv.appendChild(nameSpan);
        contentDiv.appendChild(descSpan);
        
        const statusSpan = document.createElement("span");
        statusSpan.className = `feature-status ${isOn ? "on" : "off"}`;
        statusSpan.textContent = isOn ? "Active" : "Inactive";
        
        li.appendChild(iconSpan);
        li.appendChild(contentDiv);
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