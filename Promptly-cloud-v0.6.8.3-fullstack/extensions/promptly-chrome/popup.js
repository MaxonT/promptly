const MESSAGE_TYPES = {
  AUTH_SYNC_REQUEST: "AUTH_SYNC_REQUEST",
  AUTH_GET: "AUTH_GET",
  AUTH_CLEAR: "AUTH_CLEAR",
  OPTIMIZE_START: "OPTIMIZE_START",
  OPTIMIZE_RESULT: "OPTIMIZE_RESULT",
  HISTORY_GET: "HISTORY_GET",
  HISTORY_SAVE: "HISTORY_SAVE",
  HISTORY_DELETE: "HISTORY_DELETE",
  HISTORY_CLEAR: "HISTORY_CLEAR"
};

const API_BASES = [
  "https://promptly.solutions",
  "https://promptly-v0-6-cloudtest-cursor-dev.onrender.com"
];

const ui = {
  authStatus: document.getElementById("authStatus"),
  runtimeStatus: document.getElementById("runtimeStatus"),
  connectBtn: document.getElementById("connectBtn"),
  modelSelect: document.getElementById("modelSelect"),
  inputPrompt: document.getElementById("inputPrompt"),
  optimizeBtn: document.getElementById("optimizeBtn"),
  copyBtn: document.getElementById("copyBtn"),
  saveBtn: document.getElementById("saveBtn"),
  outputPrompt: document.getElementById("outputPrompt"),
  clearHistoryBtn: document.getElementById("clearHistoryBtn"),
  historyList: document.getElementById("historyList")
};

let authToken = null;
let currentResult = null;

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response || {});
    });
  });
}

function setStatus(text, kind = "") {
  ui.runtimeStatus.textContent = text || "";
  ui.runtimeStatus.className = kind ? `status ${kind}` : "status";
}

function setBusy(isBusy) {
  ui.optimizeBtn.disabled = isBusy;
  ui.connectBtn.disabled = isBusy;
  ui.modelSelect.disabled = isBusy;
  ui.inputPrompt.disabled = isBusy;
}

function truncateText(input, max = 78) {
  if (typeof input !== "string") return "";
  return input.length > max ? `${input.slice(0, max - 1)}…` : input;
}

function formatDate(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

async function loadAuthState() {
  const response = await sendMessage({ type: MESSAGE_TYPES.AUTH_GET });
  if (response.ok && response.token) {
    authToken = response.token;
    ui.authStatus.textContent = `Connected · Synced ${formatDate(response.syncedAt)}`;
    ui.authStatus.className = "status ok";
  } else {
    authToken = null;
    ui.authStatus.textContent = "Account not connected";
    ui.authStatus.className = "status";
  }
}

async function syncAuthToken() {
  setStatus("Syncing Promptly account...");
  const response = await sendMessage({ type: MESSAGE_TYPES.AUTH_SYNC_REQUEST });
  if (!response.ok || !response.token) {
    throw new Error(response.error || "Could not sync token from Promptly tab.");
  }

  authToken = response.token;
  ui.authStatus.textContent = `Connected · Synced ${formatDate(response.syncedAt)}`;
  ui.authStatus.className = "status ok";
  setStatus("Promptly account connected.", "ok");
}

async function validateToken(apiBase, token) {
  const res = await fetch(`${apiBase}/api/auth/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (res.status === 401) return false;
  return res.ok;
}

async function resolveApiBase(token) {
  for (const base of API_BASES) {
    try {
      const valid = await validateToken(base, token);
      if (valid) return base;
    } catch {
      // Continue trying next base
    }
  }
  throw new Error("Token invalid or backend unreachable. Reconnect account and retry.");
}

function makeStreamUrl(apiBase, streamUrl, streamToken) {
  const basePath = streamUrl.startsWith("http") ? streamUrl : `${apiBase}${streamUrl}`;
  const joiner = basePath.includes("?") ? "&" : "?";
  return `${basePath}${joiner}st=${encodeURIComponent(streamToken || "")}`;
}

async function runPipelineOptimization(apiBase, token, idea, model) {
  const runResponse = await fetch(`${apiBase}/api/pipeline/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      idea,
      attachments: [],
      skipQuestions: false,
      model,
      clarificationsProvided: false
    })
  });

  if (!runResponse.ok) {
    const errorBody = await runResponse.text().catch(() => "");
    throw new Error(errorBody || `Pipeline start failed (${runResponse.status}).`);
  }

  const runData = await runResponse.json();
  if (!runData?.ok || !runData?.runId || !runData?.streamUrl) {
    throw new Error("Pipeline run response is incomplete.");
  }

  const streamUrl = makeStreamUrl(apiBase, runData.streamUrl, runData.streamToken);

  return new Promise((resolve, reject) => {
    let settled = false;
    let streamError = null;
    const es = new EventSource(streamUrl);

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Optimization timed out. Please retry."));
    }, 180000);

    function cleanup() {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      es.close();
    }

    function rejectWith(message) {
      cleanup();
      reject(new Error(message));
    }

    es.addEventListener("error", (event) => {
      // Backend custom error event (JSON payload)
      if (!event?.data) return;
      try {
        const payload = JSON.parse(event.data);
        if (payload?.message) {
          streamError = payload.message;
        }
      } catch {
        // ignore parsing errors for custom stream event payloads
      }
    });

    es.addEventListener("pipeline-rejected", (event) => {
      try {
        const payload = JSON.parse(event.data);
        rejectWith(payload?.message || "Request rejected by input validator.");
      } catch {
        rejectWith("Request rejected by input validator.");
      }
    });

    es.addEventListener("pipeline-clarification-needed", () => {
      rejectWith("This prompt needs clarification. Use Promptly web app Brainstormer to answer Q1-Q3 first.");
    });

    es.addEventListener("complete", (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload?.success && payload?.bestCandidate?.content) {
          cleanup();
          resolve({
            runId: runData.runId,
            output: payload.bestCandidate.content
          });
          return;
        }

        if (payload?.rejected) {
          rejectWith(payload?.message || "Request was rejected.");
          return;
        }

        rejectWith(streamError || "Pipeline completed without a usable result.");
      } catch {
        rejectWith("Failed to parse final pipeline result.");
      }
    });

    es.onerror = () => {
      if (settled) return;
      rejectWith(streamError || "Pipeline stream disconnected.");
    };
  });
}

async function loadHistory() {
  const response = await sendMessage({ type: MESSAGE_TYPES.HISTORY_GET });
  return response.ok && Array.isArray(response.items) ? response.items : [];
}

function renderHistoryItem(item) {
  const row = document.createElement("article");
  row.className = "history-item";
  row.dataset.id = item.id;

  const createdLabel = formatDate(item.createdAt);
  const outputExists = typeof item.output === "string" && item.output.trim().length > 0;

  row.innerHTML = `
    <div class="history-head">
      <strong>${item.model || "fast"}</strong>
      <span class="history-meta">${createdLabel}</span>
    </div>
    <div class="history-input">${truncateText(item.input || "")}</div>
    <div class="history-actions">
      <button data-action="rerun" class="secondary">Re-run</button>
      <button data-action="copy-input" class="secondary">Copy Input</button>
      <button data-action="copy-output" class="secondary" ${outputExists ? "" : "disabled"}>Copy Output</button>
      <button data-action="delete" class="warn">Delete</button>
    </div>
  `;

  return row;
}

async function renderHistory() {
  const items = await loadHistory();
  ui.historyList.innerHTML = "";

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No history yet.";
    ui.historyList.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const item of items) {
    fragment.appendChild(renderHistoryItem(item));
  }
  ui.historyList.appendChild(fragment);
}

async function copyText(text) {
  if (!text) throw new Error("Nothing to copy.");
  await navigator.clipboard.writeText(text);
}

async function handleOptimize() {
  const idea = (ui.inputPrompt.value || "").trim();
  const model = ui.modelSelect.value || "fast";

  if (!idea) {
    setStatus("Please enter a prompt first.", "error");
    ui.inputPrompt.focus();
    return;
  }

  if (!authToken) {
    setStatus("Connect Promptly account before optimizing.", "error");
    return;
  }

  setBusy(true);
  ui.outputPrompt.value = "";
  ui.copyBtn.disabled = true;
  ui.saveBtn.disabled = true;
  setStatus("Validating session...");

  try {
    const apiBase = await resolveApiBase(authToken);
    await sendMessage({ type: MESSAGE_TYPES.OPTIMIZE_START, payload: { idea, model } });

    setStatus("Running Promptly pipeline...");
    const result = await runPipelineOptimization(apiBase, authToken, idea, model);

    currentResult = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      input: idea,
      output: result.output,
      model,
      runId: result.runId
    };

    ui.outputPrompt.value = result.output;
    ui.copyBtn.disabled = false;
    ui.saveBtn.disabled = false;
    setStatus("Optimization complete.", "ok");

    await sendMessage({
      type: MESSAGE_TYPES.OPTIMIZE_RESULT,
      payload: { ok: true, runId: result.runId }
    });
  } catch (error) {
    currentResult = null;
    ui.outputPrompt.value = "";
    setStatus(error?.message || "Optimization failed.", "error");

    await sendMessage({
      type: MESSAGE_TYPES.OPTIMIZE_RESULT,
      payload: { ok: false, runId: "" }
    }).catch(() => {});
  } finally {
    setBusy(false);
  }
}

async function handleSave() {
  if (!currentResult?.output) {
    setStatus("No optimization result to save.", "error");
    return;
  }

  const response = await sendMessage({
    type: MESSAGE_TYPES.HISTORY_SAVE,
    payload: currentResult
  });

  if (!response.ok) {
    setStatus(response.error || "Failed to save history.", "error");
    return;
  }

  setStatus("Saved to history.", "ok");
  await renderHistory();
}

async function handleHistoryAction(event) {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) return;

  const action = target.dataset.action;
  if (!action) return;

  const historyItem = target.closest(".history-item");
  const itemId = historyItem?.dataset.id;
  if (!itemId) return;

  const items = await loadHistory();
  const item = items.find((entry) => entry.id === itemId);
  if (!item) return;

  if (action === "rerun") {
    ui.inputPrompt.value = item.input || "";
    ui.outputPrompt.value = item.output || "";
    ui.modelSelect.value = item.model || "fast";
    currentResult = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      input: item.input || "",
      output: item.output || "",
      model: item.model || "fast",
      runId: item.runId || ""
    };
    ui.copyBtn.disabled = !item.output;
    ui.saveBtn.disabled = !item.output;
    setStatus("History entry loaded.", "ok");
    return;
  }

  if (action === "copy-input") {
    try {
      await copyText(item.input || "");
      setStatus("Input copied.", "ok");
    } catch (error) {
      setStatus(error.message || "Copy failed.", "error");
    }
    return;
  }

  if (action === "copy-output") {
    try {
      await copyText(item.output || "");
      setStatus("Output copied.", "ok");
    } catch (error) {
      setStatus(error.message || "Copy failed.", "error");
    }
    return;
  }

  if (action === "delete") {
    await sendMessage({
      type: MESSAGE_TYPES.HISTORY_DELETE,
      payload: { id: itemId }
    });
    await renderHistory();
    setStatus("History entry deleted.", "ok");
  }
}

async function init() {
  await loadAuthState();
  await renderHistory();

  ui.connectBtn.addEventListener("click", async () => {
    try {
      await syncAuthToken();
    } catch (error) {
      setStatus(error?.message || "Failed to connect account.", "error");
    }
  });

  ui.optimizeBtn.addEventListener("click", handleOptimize);

  ui.copyBtn.addEventListener("click", async () => {
    try {
      await copyText(ui.outputPrompt.value);
      setStatus("Optimized prompt copied.", "ok");
    } catch (error) {
      setStatus(error.message || "Copy failed.", "error");
    }
  });

  ui.saveBtn.addEventListener("click", async () => {
    try {
      await handleSave();
    } catch (error) {
      setStatus(error?.message || "Save failed.", "error");
    }
  });

  ui.clearHistoryBtn.addEventListener("click", async () => {
    await sendMessage({ type: MESSAGE_TYPES.HISTORY_CLEAR });
    await renderHistory();
    setStatus("History cleared.", "ok");
  });

  ui.historyList.addEventListener("click", (event) => {
    handleHistoryAction(event).catch((error) => {
      setStatus(error?.message || "History action failed.", "error");
    });
  });
}

init().catch((error) => {
  setStatus(error?.message || "Extension failed to initialize.", "error");
});
