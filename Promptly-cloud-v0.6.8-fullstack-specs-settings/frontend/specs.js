const API_BASE = window.PROMPTLY_API_BASE || "https://promptly-v0-6-cloudtest.onrender.com";

(() => {
  const listEl = document.getElementById("specsList");
  const emptyEl = document.getElementById("specsEmpty");
  const logEl = document.getElementById("specsLog");
  const refreshBtn = document.getElementById("refreshSpecsBtn");
  const specMetaEl = document.getElementById("specMeta");
  const specJsonEl = document.getElementById("specJson");
  const compiledPromptEl = document.getElementById("compiledPrompt");
  const compileBtn = document.getElementById("compileSpecBtn");

  const newTitleEl = document.getElementById("newSpecTitle");
  const newJsonEl = document.getElementById("newSpecJson");
  const createBtn = document.getElementById("createSpecBtn");
  const createErrorEl = document.getElementById("createSpecError");

  let currentId = null;

  function log(line) {
    const ts = new Date().toISOString().slice(11, 19);
    logEl.textContent += `[${ts}] ${line}\n`;
    logEl.scrollTop = logEl.scrollHeight;
  }

  function selectSpec(id) {
    currentId = id;
    compileBtn.disabled = !id;
    for (const el of listEl.querySelectorAll(".specs-item")) {
      el.classList.toggle("specs-item--active", el.dataset.id === id);
    }
    if (id) {
      loadSpecDetail(id);
    } else {
      specMetaEl.textContent = "";
      specJsonEl.textContent = "";
      compiledPromptEl.textContent = "";
    }
  }

  async function loadSpecs() {
    try {
      log("GET /api/specs ...");
      const res = await fetch(`${API_BASE}/api/specs`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data) {
        log(`Specs list error: HTTP ${res.status}`);
        return;
      }
      const arr = data.items || data.specs || data.rows || [];
      listEl.innerHTML = "";
      if (!Array.isArray(arr) || arr.length === 0) {
        emptyEl.classList.remove("hidden");
        return;
      }
      emptyEl.classList.add("hidden");
      for (const row of arr) {
        const item = document.createElement("div");
        item.className = "specs-item";
        const id = row.id || row.spec_id || row.uuid;
        item.dataset.id = id;
        const title = row.title || "(untitled spec)";
        const created =
          row.created_at || row.createdAt || row.timestamp || "unknown time";
        item.innerHTML = `
          <div class="specs-item-title">${title}</div>
          <div class="specs-item-meta">${id} · ${created}</div>
        `;
        item.addEventListener("click", () => selectSpec(id));
        listEl.appendChild(item);
      }
    } catch (err) {
      console.error(err);
      log("Specs list error: " + err.message);
    }
  }

  async function loadSpecDetail(id) {
    if (!id) return;
    try {
      log(`GET /api/specs/${id} ...`);
      const res = await fetch(`${API_BASE}/api/specs/${encodeURIComponent(id)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data) {
        log(`Spec detail error: HTTP ${res.status}`);
        specMetaEl.textContent = "Failed to load spec.";
        return;
      }
      const row = data.spec || data.item || data.row || data;
      const title = row.title || "(untitled spec)";
      const created =
        row.created_at || row.createdAt || row.timestamp || "unknown time";
      specMetaEl.textContent = `${title} · ${id} · created ${created}`;
      try {
        const specObj =
          row.spec ||
          row.spec_json && JSON.parse(row.spec_json) ||
          row.body ||
          row;
        specJsonEl.textContent = JSON.stringify(specObj, null, 2);
      } catch {
        specJsonEl.textContent = JSON.stringify(row, null, 2);
      }
      compiledPromptEl.textContent = "";
    } catch (err) {
      console.error(err);
      log("Spec detail error: " + err.message);
    }
  }

  async function compileCurrentSpec() {
    if (!currentId) return;
    try {
      log(`POST /api/specs/${currentId}/compile ...`);
      const res = await fetch(`${API_BASE}/api/specs/${encodeURIComponent(currentId)}/compile`, {
        method: "POST"
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data) {
        log(`Compile error: HTTP ${res.status}`);
        compiledPromptEl.textContent = "Compile failed.";
        return;
      }
      const compiled = data.compiled_prompt || data.prompt || data.result || data;
      if (compiled.blocks) {
        compiledPromptEl.textContent = JSON.stringify(compiled.blocks, null, 2);
      } else {
        compiledPromptEl.textContent = JSON.stringify(compiled, null, 2);
      }
    } catch (err) {
      console.error(err);
      log("Compile error: " + err.message);
      compiledPromptEl.textContent = "Compile error: " + err.message;
    }
  }

  async function createSpec() {
    createErrorEl.textContent = "";
    createErrorEl.classList.add("hidden");
    const title = (newTitleEl.value || "").trim();
    if (!title) {
      createErrorEl.textContent = "Title is required.";
      createErrorEl.classList.remove("hidden");
      return;
    }
    let specObj = {};
    const raw = (newJsonEl.value || "").trim();
    if (raw) {
      try {
        specObj = JSON.parse(raw);
      } catch (err) {
        createErrorEl.textContent = "Spec JSON is invalid.";
        createErrorEl.classList.remove("hidden");
        return;
      }
    }
    try {
      log("POST /api/specs ...");
      const res = await fetch(`${API_BASE}/api/specs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, spec: specObj })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        log(
          "Create spec failed: HTTP " +
            res.status +
            " " +
            JSON.stringify(data)
        );
        createErrorEl.textContent = "Create spec failed. See log.";
        createErrorEl.classList.remove("hidden");
        return;
      }
      log("Spec created.");
      newTitleEl.value = "";
      newJsonEl.value = "";
      await loadSpecs();
    } catch (err) {
      console.error(err);
      log("Create spec error: " + err.message);
      createErrorEl.textContent = "Create spec error. See log.";
      createErrorEl.classList.remove("hidden");
    }
  }

  refreshBtn?.addEventListener("click", loadSpecs);
  compileBtn?.addEventListener("click", compileCurrentSpec);
  createBtn?.addEventListener("click", createSpec);

  log("Specs Manager loaded. Fetching specs ...");
  loadSpecs();
})();