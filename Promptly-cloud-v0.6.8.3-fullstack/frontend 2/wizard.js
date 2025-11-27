const API_BASE = (window.PROMPTLY_API_BASE && window.PROMPTLY_API_BASE.trim())
  || (window.location && window.location.origin && window.location.origin !== "null"
    ? window.location.origin
    : "http://localhost:8080");

(() => {
  const ideaInput = document.getElementById("ideaInput");
  const kindSelect = document.getElementById("kindSelect");
  const startBtn = document.getElementById("startWizardBtn");
  const restoreSnapshotBtn = document.getElementById("restoreSnapshotBtn");
  const ideaError = document.getElementById("ideaError");

  const qaEmptyState = document.getElementById("qaEmptyState");
  const questionsContainer = document.getElementById("questionsContainer");
  const nextBatchBtn = document.getElementById("nextBatchBtn");
  const finalizeBtn = document.getElementById("finalizeBtn");
  const backBtn = document.getElementById("backBtn");
  const skipBtn = document.getElementById("skipBtn");
  const saveSnapshotBtn = document.getElementById("saveSnapshotBtn");

  const resultEmptyState = document.getElementById("resultEmptyState");
  const resultContainer = document.getElementById("resultContainer");
  const specOutput = document.getElementById("specOutput");
  const promptOutput = document.getElementById("promptOutput");
  const explanationOutput = document.getElementById("explanationOutput");

  const logOutput = document.getElementById("logOutput");

  let currentSessionId = null;
  let currentQuestions = [];
  let currentSpecId = null;
  const resultPageLink = document.getElementById("resultPageLink");

  const urlParams = new URLSearchParams(window.location.search || "");
  const prefillIdea = urlParams.get("idea");
  const prefillKind = urlParams.get("kind");

  const currentAnswers = new Map();

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
    backBtn.classList.add("hidden");
    skipBtn.classList.add("hidden");
    saveSnapshotBtn.classList.add("hidden");
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

      // Add regenerate button for each question
      const regenerateBtn = document.createElement("button");
      regenerateBtn.type = "button";
      regenerateBtn.className = "wizard-button-mini";
      regenerateBtn.textContent = "🔄 Regenerate";
      regenerateBtn.style.marginTop = "8px";
      regenerateBtn.addEventListener("click", () => regenerateQuestion(q.id));
      card.appendChild(regenerateBtn);

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
    backBtn.classList.remove("hidden");
    skipBtn.classList.remove("hidden");
    saveSnapshotBtn.classList.remove("hidden");
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
          kind
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
        body: JSON.stringify({ answers: answersPayload })
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
        method: "POST"
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

  // Q1: Save snapshot
  async function saveSnapshot() {
    if (!currentSessionId) return;
    try {
      log("Saving session snapshot...");
      const res = await fetch(`${API_BASE}/api/question-sessions/${encodeURIComponent(currentSessionId)}/snapshot`, {
        method: "POST"
      });
      if (!res.ok) {
        const txt = await res.text();
        log(`Failed to save snapshot: HTTP ${res.status} ${txt}`);
        return;
      }
      const data = await res.json();
      log(`Snapshot saved: ${data.snapshot_id}`);
      // Show restore button for future use
      if (restoreSnapshotBtn) {
        restoreSnapshotBtn.classList.remove("hidden");
      }
    } catch (err) {
      console.error(err);
      log("Error while saving snapshot: " + err.message);
    }
  }

  // Q1: Restore snapshot
  async function restoreSnapshot() {
    if (!currentSessionId) {
      log("No active session to restore");
      return;
    }
    try {
      log("Restoring latest snapshot...");
      const res = await fetch(`${API_BASE}/api/question-sessions/${encodeURIComponent(currentSessionId)}/snapshot/latest`);
      if (!res.ok) {
        const txt = await res.text();
        log(`Failed to restore snapshot: HTTP ${res.status} ${txt}`);
        return;
      }
      const data = await res.json();
      if (!data.ok || !data.snapshot) {
        log(data.message || "No snapshot available");
        return;
      }
      log(`Snapshot restored from ${data.created_at}`);
      // Render questions from snapshot
      const snapshotQuestions = data.snapshot.questions || [];
      const answeredIds = new Set((data.snapshot.answers || []).map(a => a.question_id));
      const unanswered = snapshotQuestions.filter(q => !answeredIds.has(q.id)).slice(0, 5);
      renderQuestions(unanswered.map(q => ({
        id: q.id,
        type: q.type,
        content: q.content,
        options: q.options_json ? JSON.parse(q.options_json) : null
      })));
    } catch (err) {
      console.error(err);
      log("Error while restoring snapshot: " + err.message);
    }
  }

  // Q2: Go back to previous question
  async function goBack() {
    if (!currentSessionId) return;
    try {
      log("Going back to previous question...");
      const res = await fetch(`${API_BASE}/api/question-sessions/${encodeURIComponent(currentSessionId)}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          answers: [{ question_id: "dummy", value: null }],
          control: "back"
        })
      });
      if (!res.ok) {
        const txt = await res.text();
        log(`Failed to go back: HTTP ${res.status} ${txt}`);
        return;
      }
      const data = await res.json();
      if (data.questions && data.questions.length > 0) {
        renderQuestions(data.questions);
        log(data.message || "Moved to previous question");
      } else {
        log("No previous question available");
      }
    } catch (err) {
      console.error(err);
      log("Error while going back: " + err.message);
    }
  }

  // Q2: Skip current question
  async function skipCurrent() {
    if (!currentSessionId || currentQuestions.length === 0) return;
    const firstQuestionId = currentQuestions[0].id;
    try {
      log("Skipping current question...");
      const res = await fetch(`${API_BASE}/api/question-sessions/${encodeURIComponent(currentSessionId)}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: [{ question_id: firstQuestionId, value: null }],
          control: "skip"
        })
      });
      if (!res.ok) {
        const txt = await res.text();
        log(`Failed to skip: HTTP ${res.status} ${txt}`);
        return;
      }
      const data = await res.json();
      log(data.message || "Question skipped");
      if (data.done) {
        renderQuestions([]);
        nextBatchBtn.classList.add("hidden");
      } else {
        renderQuestions(data.questions || []);
      }
    } catch (err) {
      console.error(err);
      log("Error while skipping: " + err.message);
    }
  }

  // Q3: Regenerate a specific question
  async function regenerateQuestion(questionId) {
    if (!currentSessionId) return;
    try {
      log(`Regenerating question ${questionId}...`);
      const res = await fetch(
        `${API_BASE}/api/question-sessions/${encodeURIComponent(currentSessionId)}/questions/${encodeURIComponent(questionId)}/regenerate`,
        { method: "POST" }
      );
      if (!res.ok) {
        const txt = await res.text();
        log(`Failed to regenerate: HTTP ${res.status} ${txt}`);
        return;
      }
      const data = await res.json();
      log(data.message || "Question regenerated");
      
      // Replace the old question with the new one in the current list
      const index = currentQuestions.findIndex(q => q.id === questionId);
      if (index !== -1) {
        currentQuestions[index] = data.question;
        renderQuestions(currentQuestions);
      }
    } catch (err) {
      console.error(err);
      log("Error while regenerating question: " + err.message);
    }
  }

  startBtn?.addEventListener("click", startWizard);
  nextBatchBtn?.addEventListener("click", submitBatch);
  finalizeBtn?.addEventListener("click", finalizeSession);
  backBtn?.addEventListener("click", goBack);
  skipBtn?.addEventListener("click", skipCurrent);
  saveSnapshotBtn?.addEventListener("click", saveSnapshot);
  restoreSnapshotBtn?.addEventListener("click", restoreSnapshot);

  log("Wizard page loaded. Describe your idea on the left to begin.");
})();