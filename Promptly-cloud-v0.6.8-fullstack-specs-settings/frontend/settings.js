const API_BASE = window.PROMPTLY_API_BASE || "https://promptly-v0-6-cloudtest.onrender.com";

(() => {
  const envSummaryEl = document.getElementById("envSummary");
  const modelListEl = document.getElementById("modelList");
  const featuresListEl = document.getElementById("featuresList");
  const rawSettingsEl = document.getElementById("rawSettings");
  const logEl = document.getElementById("settingsLog");

  function log(line) {
    const ts = new Date().toISOString().slice(11, 19);
    logEl.textContent += `[${ts}] ${line}\n`;
    logEl.scrollTop = logEl.scrollHeight;
  }

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
      const rows = [
        ["Default model", s.defaultModel || "(not set)"],
        ["Outcome model", s.outcomeModel || "(fallback to default)"],
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
      Object.keys(features).forEach((key) => {
        const li = document.createElement("li");
        li.textContent = `${key}: ${features[key] ? "on" : "off"}`;
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
})();