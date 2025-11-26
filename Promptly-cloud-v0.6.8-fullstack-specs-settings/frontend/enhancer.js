(() => {
  const rawPromptEl = document.getElementById("rawPrompt");
  const modeSelect = document.getElementById("modeSelect");
  const runEnhanceBtn = document.getElementById("runEnhanceBtn");
  const inputError = document.getElementById("inputError");

  const enhancedPromptEl = document.getElementById("enhancedPrompt");
  const copyEnhancedBtn = document.getElementById("copyEnhancedBtn");
  const runScoreBtn = document.getElementById("runScoreBtn");
  const runValidateBtn = document.getElementById("runValidateBtn");
  const scoreResultEl = document.getElementById("scoreResult");
  const validationResultEl = document.getElementById("validationResult");
  const logEl = document.getElementById("enhancerLog");

  function log(line) {
    const ts = new Date().toISOString().slice(11, 19);
    logEl.textContent += `[${ts}] ${line}\n`;
    logEl.scrollTop = logEl.scrollHeight;
  }

  function getPrompt() {
    return (rawPromptEl.value || "").trim();
  }

  function showError(msg) {
    inputError.textContent = msg;
    inputError.classList.remove("hidden");
  }

  function clearError() {
    inputError.textContent = "";
    inputError.classList.add("hidden");
  }

  async function callEnhancer(path) {
    const prompt = getPrompt();
    if (!prompt) {
      showError("Please paste a prompt first.");
      return null;
    }
    clearError();
    try {
      log(`POST ${path} ...`);
      const res = await fetch(`/api/enhance${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        log(`Enhancer error on ${path}: HTTP ${res.status} ${JSON.stringify(data)}`);
        return null;
      }
      log(`Enhancer OK on ${path}`);
      return data.result;
    } catch (err) {
      console.error(err);
      log(`Network error on ${path}: ${err.message}`);
      return null;
    }
  }

  async function onRunEnhance() {
    const mode = modeSelect.value || "structure";
    let path = "/structure";
    if (mode === "style") path = "/style";
    if (mode === "simplify") path = "/simplify";

    const result = await callEnhancer(path);
    if (!result) return;
    enhancedPromptEl.textContent = result.enhanced || "";
    scoreResultEl.classList.add("hidden");
    validationResultEl.classList.add("hidden");
  }

  async function onRunScore() {
    const prompt = enhancedPromptEl.textContent.trim() || getPrompt();
    if (!prompt) {
      showError("No prompt to score. Enhance first or paste a prompt.");
      return;
    }
    rawPromptEl.value = prompt;
    clearError();
    try {
      log("POST /score ...");
      const res = await fetch("/api/enhance/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        log(`Score error: HTTP ${res.status} ${JSON.stringify(data)}`);
        return;
      }
      const result = data.result;
      const dims = result.dimensions || {};
      const dimLines = Object.keys(dims)
        .map((k) => `- ${k}: ${dims[k].toFixed ? dims[k].toFixed(1) : dims[k]}`)
        .join("\n");
      const suggestions = (result.suggestions || []).map((s) => `• ${s}`).join("\n");
      scoreResultEl.innerText = [
        `Score: ${result.score.toFixed ? result.score.toFixed(1) : result.score} / 10`,
        dimLines && "\nDimensions:\n" + dimLines,
        suggestions && "\nSuggestions:\n" + suggestions
      ].filter(Boolean).join("\n");
      scoreResultEl.classList.remove("hidden");
    } catch (err) {
      console.error(err);
      log("Score network error: " + err.message);
    }
  }

  async function onRunValidate() {
    const prompt = enhancedPromptEl.textContent.trim() || getPrompt();
    if (!prompt) {
      showError("No prompt to validate. Enhance first or paste a prompt.");
      return;
    }
    rawPromptEl.value = prompt;
    clearError();
    try {
      log("POST /validate ...");
      const res = await fetch("/api/enhance/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        log(`Validate error: HTTP ${res.status} ${JSON.stringify(data)}`);
        return;
      }
      const result = data.result;
      const issues = result.issues || [];
      if (!issues.length) {
        validationResultEl.innerText = "No issues found. Prompt looks good.";
      } else {
        const items = issues.map((iss) => {
          const prefix = iss.level === "error" ? "[!]" :
                        iss.level === "warning" ? "[~]" : "[i]";
          const hint = iss.hint ? ` (hint: ${iss.hint})` : "";
          return `${prefix} ${iss.message}${hint}`;
        }).join("\n");
        validationResultEl.innerText = items;
      }
      validationResultEl.classList.remove("hidden");
    } catch (err) {
      console.error(err);
      log("Validate network error: " + err.message);
    }
  }

  function onCopyEnhanced() {
    const txt = enhancedPromptEl.textContent || "";
    if (!txt.trim()) return;
    navigator.clipboard?.writeText(txt).then(
      () => log("Enhanced prompt copied to clipboard."),
      () => log("Failed to copy to clipboard.")
    );
  }

  runEnhanceBtn?.addEventListener("click", onRunEnhance);
  runScoreBtn?.addEventListener("click", onRunScore);
  runValidateBtn?.addEventListener("click", onRunValidate);
  copyEnhancedBtn?.addEventListener("click", onCopyEnhanced);

  log("Prompt Enhancer loaded. Paste a prompt to get started.");
})();