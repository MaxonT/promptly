(() => {
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

  let currentSessionId = null;
  let currentQuestions = [];
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
      const res = await fetch("/api/question-sessions", {
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
      const res = await fetch(`/api/question-sessions/${encodeURIComponent(currentSessionId)}/answer`, {
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
      const res = await fetch(`/api/question-sessions/${encodeURIComponent(currentSessionId)}/finalize`, {
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