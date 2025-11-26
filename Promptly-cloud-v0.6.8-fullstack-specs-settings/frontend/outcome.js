const API_BASE = window.PROMPTLY_API_BASE || "https://promptly-v0-6-cloudtest.onrender.com";

(() => {
  const taskEl = document.getElementById("taskInput");
  const inputEl = document.getElementById("inputInput");
  const styleEl = document.getElementById("styleInput");
  const constraintsEl = document.getElementById("constraintsInput");
  const nEl = document.getElementById("nInput");
  const maxLenEl = document.getElementById("maxLengthInput");
  const mustIncludeEl = document.getElementById("mustIncludeInput");
  const mustNotIncludeEl = document.getElementById("mustNotIncludeInput");
  const runBtn = document.getElementById("runOutcomeBtn");
  const specErrorEl = document.getElementById("specError");

  const bestMetaEl = document.getElementById("bestScoreMeta");
  const bestContentEl = document.getElementById("bestContent");
  const candidatesListEl = document.getElementById("candidatesList");
  const logEl = document.getElementById("outcomeLog");

  function log(line) {
    const ts = new Date().toISOString().slice(11, 19);
    logEl.textContent += `[${ts}] ${line}\n`;
    logEl.scrollTop = logEl.scrollHeight;
  }

  function showError(msg) {
    specErrorEl.textContent = msg;
    specErrorEl.classList.remove("hidden");
  }

  function clearError() {
    specErrorEl.textContent = "";
    specErrorEl.classList.add("hidden");
  }

  function parseList(value) {
    return (value || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function buildRequest() {
    const task = (taskEl.value || "").trim();
    if (!task) {
      throw new Error("Task is required.");
    }
    const n = parseInt(nEl.value || "4", 10);
    const maxLen = maxLenEl.value ? parseInt(maxLenEl.value, 10) : null;

    const tests = {};
    const mustInclude = parseList(mustIncludeEl.value);
    const mustNotInclude = parseList(mustNotIncludeEl.value);
    if (mustInclude.length) tests.must_include = mustInclude;
    if (mustNotInclude.length) tests.must_not_include = mustNotInclude;
    if (!Number.isNaN(maxLen) && maxLen) tests.max_length = maxLen;

    return {
      task,
      input: (inputEl.value || "").trim() || undefined,
      style: (styleEl.value || "").trim() || undefined,
      constraints: (constraintsEl.value || "").trim() || undefined,
      n,
      tests: Object.keys(tests).length ? tests : undefined
    };
  }

  function renderResult(result) {
    const { best, candidates, request } = result;

    if (!best) {
      bestMetaEl.textContent = "No best candidate selected.";
      bestContentEl.textContent = "";
      candidatesListEl.innerHTML = "";
      return;
    }

    bestMetaEl.textContent = `Best candidate: ${best.id} · finalScore ${best.finalScore.toFixed(
      2
    )} / 10 (LLM score ${best.llmScore.toFixed(2)}), tests: ${
      best.tests?.passed ? "passed" : "issues"
    }`;
    bestContentEl.textContent = best.content || "";

    candidatesListEl.innerHTML = "";
    for (const cand of candidates) {
      const div = document.createElement("div");
      div.className = "outcome-candidate";

      const header = document.createElement("div");
      header.className = "outcome-candidate-header";
      const idSpan = document.createElement("span");
      idSpan.className = "outcome-candidate-id";
      idSpan.textContent = cand.id;
      const scoreSpan = document.createElement("span");
      scoreSpan.className = "outcome-candidate-score";
      scoreSpan.textContent = `final ${cand.finalScore.toFixed(
        2
      )} / 10 · llm ${cand.llmScore.toFixed(2)}`;
      header.appendChild(idSpan);
      header.appendChild(scoreSpan);

      const contentPre = document.createElement("pre");
      contentPre.textContent = cand.content || "";

      const testsDiv = document.createElement("div");
      testsDiv.className = "outcome-candidate-tests";
      if (cand.tests?.issues?.length) {
        testsDiv.textContent = "Tests: " + cand.tests.issues.join(" | ");
      } else {
        testsDiv.textContent = "Tests: passed";
      }

      div.appendChild(header);
      div.appendChild(contentPre);
      div.appendChild(testsDiv);
      candidatesListEl.appendChild(div);
    }

    log(
      `Outcome run finished. Task="${request.task.slice(0, 40)}..." · candidates=${candidates.length}`
    );
  }

  async function onRunOutcome() {
    clearError();
    bestMetaEl.textContent = "";
    bestContentEl.textContent = "";
    candidatesListEl.innerHTML = "";
    try {
      const body = buildRequest();
      log("POST /api/outcome-runs ...");
      const res = await fetch(`${API_BASE}/api/outcome-runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        log(
          `Outcome error: HTTP ${res.status} ${JSON.stringify(data)}`
        );
        showError("Outcome run failed. Check the log for details.");
        return;
      }
      renderResult(data.result);
    } catch (err) {
      console.error(err);
      showError(err.message || "Unknown error");
      log("Outcome run error: " + err.message);
    }
  }

  runBtn?.addEventListener("click", onRunOutcome);

  log("Outcome-first Runner loaded. Define your task and click run.");
})();