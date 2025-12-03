const API_BASE = (window.PROMPTLY_API_BASE && window.PROMPTLY_API_BASE.trim())
  || (window.location && window.location.origin && window.location.origin !== "null"
    ? window.location.origin
    : "http://localhost:8080");

(() => {
  const MODEL_OPTIONS = [
    { value: "promptly-mini", label: "Promptly Mini" },
    { value: "promptly", label: "Promptly" },
    { value: "promptly-plus", label: "Promptly Plus" },
    { value: "promptly-pro", label: "Promptly Pro" },
    { value: "promptly-pro-max", label: "Promptly Pro Max" },
    { value: "promptly-code-mini", label: "Promptly Code Mini" },
    { value: "promptly-code", label: "Promptly Code" },
    { value: "promptly-code-plus", label: "Promptly Code Plus" },
    { value: "promptly-code-pro", label: "Promptly Code Pro" },
    { value: "promptly-code-pro-max", label: "Promptly Code Pro Max" }
  ];
  const MODEL_STORAGE_KEY = "promptlyWizardModel";

  const ideaInput = document.getElementById("ideaInput");
  const kindSelect = document.getElementById("kindSelect");
  const startBtn = document.getElementById("startWizardBtn");
  const ideaError = document.getElementById("ideaError");

  const qaEmptyState = document.getElementById("qaEmptyState");
  const questionsContainer = document.getElementById("questionsContainer");
  const nextBatchBtn = document.getElementById("nextBatchBtn");
  const finalizeBtn = document.getElementById("finalizeBtn");

  const resultEmptyState = document.getElementById("resultEmptyState");
  const resultContainer = document.getElementById("resultContainer");
  const specOutput = document.getElementById("specOutput");
  const promptOutput = document.getElementById("promptOutput");
  const explanationOutput = document.getElementById("explanationOutput");

  const logOutput = document.getElementById("logOutput");

  const modelToggle = document.getElementById("modelToggle");
  const modelOptions = document.getElementById("modelOptions");
  const modelSelectedLabel = document.getElementById("modelSelectedLabel");
  const modelShortcut = document.getElementById("modelShortcut");
  const modelShortcutLabel = document.getElementById("modelShortcutLabel");

  function getStoredModel() {
    const stored = sessionStorage.getItem(MODEL_STORAGE_KEY);
    if (stored && MODEL_OPTIONS.some((opt) => opt.value === stored)) {
      return stored;
    }
    return MODEL_OPTIONS[0].value;
  }

  let selectedModel = getStoredModel();

  let currentSessionId = null;
  let currentQuestions = [];
  let currentSpecId = null;
  const resultPageLink = document.getElementById("resultPageLink");

  const urlParams = new URLSearchParams(window.location.search || "");
  const prefillIdea = urlParams.get("idea");
  const prefillKind = urlParams.get("kind");

  const currentAnswers = new Map();

  function updateModelLabel() {
    const option = MODEL_OPTIONS.find((opt) => opt.value === selectedModel);
    if (!option) return;
    if (modelSelectedLabel) modelSelectedLabel.textContent = option.label;
    if (modelShortcutLabel) modelShortcutLabel.textContent = option.label;
  }

  function closeModelDropdown() {
    if (!modelOptions || !modelToggle) return;
    modelOptions.classList.add("hidden");
    modelToggle.setAttribute("aria-expanded", "false");
  }

  function openModelDropdown() {
    if (!modelOptions || !modelToggle) return;
    modelOptions.classList.remove("hidden");
    modelToggle.setAttribute("aria-expanded", "true");
  }

  function renderModelOptions() {
    if (!modelOptions) return;
    modelOptions.innerHTML = "";
    MODEL_OPTIONS.forEach((opt) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "wizard-model-option";
      btn.textContent = opt.label;
      btn.setAttribute("role", "option");
      btn.setAttribute("data-value", opt.value);
      if (opt.value === selectedModel) {
        btn.classList.add("is-selected");
        btn.setAttribute("aria-selected", "true");
      }
      btn.addEventListener("click", () => {
        selectedModel = opt.value;
        sessionStorage.setItem(MODEL_STORAGE_KEY, selectedModel);
        updateModelLabel();
        renderModelOptions();
        closeModelDropdown();
      });
      modelOptions.appendChild(btn);
    });
  }

  function toggleModelDropdown() {
    if (!modelOptions || !modelToggle) return;
    if (modelOptions.classList.contains("hidden")) {
      openModelDropdown();
    } else {
      closeModelDropdown();
    }
  }

  if (modelToggle) {
    modelToggle.addEventListener("click", (evt) => {
      evt.stopPropagation();
      toggleModelDropdown();
    });
  }

  if (modelShortcut) {
    modelShortcut.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      setTimeout(() => openModelDropdown(), 160);
    });
  }

  document.addEventListener("click", (evt) => {
    if (!modelOptions || modelOptions.classList.contains("hidden")) return;
    if (!modelOptions.contains(evt.target) && !modelToggle?.contains(evt.target)) {
      closeModelDropdown();
    }
  });

  document.addEventListener("keydown", (evt) => {
    if (evt.key === "Escape") {
      closeModelDropdown();
    }
  });

  updateModelLabel();
  renderModelOptions();

  function log(line) {
    const ts = new Date().toISOString().slice(11, 19);
    logOutput.textContent += `[${ts}] ${line}\n`;
    logOutput.scrollTop = logOutput.scrollHeight;
  }

  function clearQuestions() {
    questionsContainer.innerHTML = "";
    currentQuestions = [];
    currentAnswers.clear();
    qaEmptyState.classList.remove("hidden");
    questionsContainer.classList.add("hidden");
    nextBatchBtn.classList.add("hidden");
    finalizeBtn.classList.add("hidden");
  }

  function renderQuestions(questions) {
    currentQuestions = questions;
    questionsContainer.innerHTML = "";
    if (!questions || questions.length === 0) {
      qaEmptyState.classList.remove("hidden");
      questionsContainer.classList.add("hidden");
      return;
    }
    qaEmptyState.classList.add("hidden");
    questionsContainer.classList.remove("hidden");

    questions.forEach((q) => {
      const card = document.createElement("div");
      card.className = "wizard-question-card";

      const typeSpan = document.createElement("div");
      typeSpan.className = "wizard-question-type";
      typeSpan.textContent = q.type || "question";

      const textDiv = document.createElement("div");
      textDiv.className = "wizard-question-text";
      textDiv.textContent = q.content || "";

      card.appendChild(typeSpan);
      card.appendChild(textDiv);

      if (q.type === "short_text") {
        const input = document.createElement("input");
        input.className = "wizard-input-short";
        input.type = "text";
        input.placeholder = "Type your answer here";
        input.value = currentAnswers.get(q.id) ?? "";
        input.addEventListener("input", () => {
          currentAnswers.set(q.id, input.value);
        });
        card.appendChild(input);
      } else if (q.type === "yes_no") {
        const row = document.createElement("div");
        row.className = "wizard-choice-row";

        const yes = document.createElement("button");
        yes.type = "button";
        yes.className = "wizard-pill";
        yes.textContent = "Yes";

        const no = document.createElement("button");
        no.type = "button";
        no.className = "wizard-pill";
        no.textContent = "No";

        function update(selected) {
          currentAnswers.set(q.id, selected);
          yes.classList.toggle("is-selected", selected === true);
          no.classList.toggle("is-selected", selected === false);
        }

        yes.addEventListener("click", () => update(true));
        no.addEventListener("click", () => update(false));

        const existing = currentAnswers.get(q.id);
        if (existing === true || existing === false) {
          update(existing);
        }

        row.appendChild(yes);
        row.appendChild(no);
        card.appendChild(row);
      } else if (q.type === "single_choice" || q.type === "multi_choice") {
        const row = document.createElement("div");
        row.className = "wizard-choice-row";
        const options = q.options || [];
        const isMulti = q.type === "multi_choice";

        const existing = currentAnswers.get(q.id);
        const selected = new Set(
          Array.isArray(existing) ? existing : existing ? [existing] : []
        );

        options.forEach((opt) => {
          const pill = document.createElement("button");
          pill.type = "button";
          pill.className = "wizard-pill";
          pill.textContent = opt.label || opt.value || "";

          function updateSelection() {
            if (isMulti) {
              if (selected.has(opt.value)) {
                selected.delete(opt.value);
              } else {
                selected.add(opt.value);
              }
              currentAnswers.set(q.id, Array.from(selected));
            } else {
              selected.clear();
              selected.add(opt.value);
              currentAnswers.set(q.id, opt.value);
            }
            pill.classList.toggle(
              "is-selected",
              isMulti ? selected.has(opt.value) : currentAnswers.get(q.id) === opt.value
            );
          }

          pill.addEventListener("click", updateSelection);

          if (isMulti ? selected.has(opt.value) : currentAnswers.get(q.id) === opt.value) {
            pill.classList.add("is-selected");
          }

          row.appendChild(pill);
        });

        card.appendChild(row);
      }

      questionsContainer.appendChild(card);
    });

    nextBatchBtn.classList.remove("hidden");
    finalizeBtn.classList.remove("hidden");
  }

  async function startWizard() {
    const idea = (ideaInput.value || "").trim();
    const kind = kindSelect.value || undefined;
    if (!idea) {
      ideaError.textContent = "Please describe your project idea before starting.";
      ideaError.classList.remove("hidden");
      return;
    }
    ideaError.classList.add("hidden");
    clearQuestions();
    resultEmptyState.classList.remove("hidden");
    resultContainer.classList.add("hidden");
    specOutput.textContent = "";
    promptOutput.textContent = "";
    explanationOutput.textContent = "";

    try {
      log("Starting new question session...");
      const res = await fetch(`${API_BASE}/api/question-sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initial_description: idea,
          kind,
          model: selectedModel
        })
      });
      if (!res.ok) {
        const txt = await res.text();
        log(`Failed to start session: HTTP ${res.status} ${txt}`);
        return;
      }
      const data = await res.json();
      currentSessionId = data.session_id;
      log(`Session created: ${currentSessionId}`);
      renderQuestions(data.questions || []);
    } catch (err) {
      console.error(err);
      log("Error while starting wizard: " + err.message);
    }
  }

  async function submitBatch() {
    if (!currentSessionId || currentQuestions.length === 0) return;
    const answersPayload = currentQuestions.map((q) => ({
      question_id: q.id,
      value: currentAnswers.get(q.id) ?? null
    }));

    try {
      log("Submitting current batch of answers...");
      const res = await fetch(`${API_BASE}/api/question-sessions/${encodeURIComponent(currentSessionId)}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: answersPayload, model: selectedModel })
      });
      if (!res.ok) {
        const txt = await res.text();
        log(`Failed to submit answers: HTTP ${res.status} ${txt}`);
        return;
      }
      const data = await res.json();
      if (data.done) {
        log("All questions answered. You can now finalize the spec.");
        renderQuestions([]);
        nextBatchBtn.classList.add("hidden");
      } else {
        renderQuestions(data.questions || []);
        log(`Loaded next batch of ${data.questions?.length || 0} questions.`);
      }
    } catch (err) {
      console.error(err);
      log("Error while submitting answers: " + err.message);
    }
  }

  async function finalizeSession() {
    if (!currentSessionId) return;
    try {
      log("Finalizing session and generating spec + compiled prompt...");
      const res = await fetch(`${API_BASE}/api/question-sessions/${encodeURIComponent(currentSessionId)}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: selectedModel })
      });
      if (!res.ok) {
        const txt = await res.text();
        log(`Failed to finalize session: HTTP ${res.status} ${txt}`);
        return;
      }
      const data = await res.json();
      log("Finalize completed successfully.");
      resultEmptyState.classList.add("hidden");
      resultContainer.classList.remove("hidden");
      specOutput.textContent = JSON.stringify(data.spec, null, 2);
      if (data.compiled_prompt && data.compiled_prompt.blocks) {
        const blocksText = data.compiled_prompt.blocks
          .map((b) => `[${b.role} · ${b.label || ""}]\n${b.content}\n`)
          .join("\n");
        promptOutput.textContent = blocksText;
      } else {
        promptOutput.textContent = "(no compiled prompt blocks returned)";
      }
      explanationOutput.textContent = data.explanation || "(no explanation provided)";

      if (resultPageLink && data.spec_id) {
        currentSpecId = data.spec_id;
        const url = new URL("result.html", window.location.href);
        url.searchParams.set("specId", data.spec_id);
        resultPageLink.onclick = function(){
          window.location.href = url.toString();
        };
        resultPageLink.classList.remove("hidden");
      } else if (resultPageLink) {
        resultPageLink.classList.add("hidden");
      }
    } catch (err) {
      console.error(err);
      log("Error while finalizing session: " + err.message);
    }
  }

  startBtn?.addEventListener("click", startWizard);
  nextBatchBtn?.addEventListener("click", submitBatch);
  finalizeBtn?.addEventListener("click", finalizeSession);

  log("Wizard page loaded. Describe your idea on the left to begin.");
})();