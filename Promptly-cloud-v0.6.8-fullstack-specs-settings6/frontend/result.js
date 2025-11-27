const API_BASE = (window.PROMPTLY_API_BASE && window.PROMPTLY_API_BASE.trim())
  || (window.location && window.location.origin && window.location.origin !== "null"
    ? window.location.origin
    : "http://localhost:8080");

(() => {
  const specOutput = document.getElementById("specOutput");
  const promptOutput = document.getElementById("promptOutput");
  const explanationOutput = document.getElementById("explanationOutput");
  const resultEmptyState = document.getElementById("resultEmptyState");
  const resultContainer = document.getElementById("resultContainer");
  const resultError = document.getElementById("resultError");
  const resultErrorMessage = document.getElementById("resultErrorMessage");

  const params = new URLSearchParams(window.location.search || "");
  const specId = params.get("specId");

  async function loadResult() {
    if (!specId) {
      resultEmptyState.classList.add("hidden");
      resultError.classList.remove("hidden");
      resultErrorMessage.textContent = "Missing specId in URL. Example: result.html?specId=spec_xxx";
      return;
    }

    try {
      // 1) Load spec
      const specRes = await fetch(`${API_BASE}/api/specs/${encodeURIComponent(specId)}`);
      if (!specRes.ok) {
        const txt = await specRes.text();
        throw new Error(`Failed to load spec: HTTP ${specRes.status} ${txt}`);
      }
      const specData = await specRes.json();
      const spec = specData.spec || specData;
      specOutput.textContent = JSON.stringify(spec, null, 2);

      // 2) Compile prompt blocks from this spec
      let compiled = null;
      try {
        const cpRes = await fetch(`${API_BASE}/api/specs/${encodeURIComponent(specId)}/compile`, {
          method: "POST"
        });
        if (cpRes.ok) {
          const cpData = await cpRes.json();
          compiled = cpData.compiled_prompt || null;
        }
      } catch (err) {
        console.error("[promptly] failed to compile prompt from spec", err);
      }

      if (compiled && Array.isArray(compiled.blocks)) {
        const blocksText = compiled.blocks
          .map((b) => `[${b.role} · ${b.label || ""}]
${b.content}
`)
          .join("\n");
        promptOutput.textContent = blocksText;
        explanationOutput.textContent = compiled.explanation || "";
      } else {
        promptOutput.textContent = "(no compiled prompt blocks returned)";
        explanationOutput.textContent = "";
      }

      resultEmptyState.classList.add("hidden");
      resultContainer.classList.remove("hidden");
    } catch (err) {
      console.error(err);
      resultEmptyState.classList.add("hidden");
      resultError.classList.remove("hidden");
      resultErrorMessage.textContent = err.message || "Failed to load result.";
    }
  }

  loadResult();
})();
