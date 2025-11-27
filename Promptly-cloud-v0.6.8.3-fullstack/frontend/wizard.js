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

  const ideaPanel = document.querySelector(".wizard-panel--idea");
  const qaPanel = document.querySelector(".wizard-panel--qa");
  
  const progressIndicator = document.getElementById("progressIndicator");
  const progressBar = document.getElementById("progressBar");
  const progressText = document.getElementById("progressText");
  const progressDots = document.getElementById("progressDots");
  
  const stepDescribe = document.getElementById("step-describe");
  const stepQuestions = document.getElementById("step-questions");
  const stepFinalize = document.getElementById("step-finalize");
  const stepConnectors = document.querySelectorAll(".wizard-stepper-connector");

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
  let allQuestions = []; // Store ALL questions with sequential numbering
  let currentPageIndex = 0; // Current page (0-based)
  const PAGE_SIZE = 5; // Questions per page
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
  
  // Loading overlay helpers (FIX 2)
  let loadingOverlay = null;
  
  function showLoadingInQuestionPanel(message = "Loading...") {
    if (loadingOverlay) return; // Already showing
    
    loadingOverlay = document.createElement("div");
    loadingOverlay.className = "wizard-loading-overlay";
    loadingOverlay.innerHTML = `
      <div class="wizard-loading-spinner"></div>
      <div class="wizard-loading-text">${message}</div>
    `;
    
    // Insert into question panel
    if (qaPanel) {
      qaPanel.style.position = "relative";
      qaPanel.appendChild(loadingOverlay);
    }
  }
  
  function hideLoadingInQuestionPanel() {
    if (loadingOverlay && loadingOverlay.parentNode) {
      loadingOverlay.remove();
      loadingOverlay = null;
    }
  }
  
  // Update wizard stepper (top-level progress)
  function updateWizardStepper(currentStep) {
    const steps = [stepDescribe, stepQuestions, stepFinalize];
    const stepNames = ['describe', 'questions', 'finalize'];
    const currentIndex = stepNames.indexOf(currentStep);
    
    steps.forEach((step, index) => {
      if (!step) return;
      
      // Remove all state classes
      step.classList.remove('wizard-stepper-step--active', 'wizard-stepper-step--completed');
      
      if (index < currentIndex) {
        // Completed steps
        step.classList.add('wizard-stepper-step--completed');
      } else if (index === currentIndex) {
        // Current active step
        step.classList.add('wizard-stepper-step--active');
      }
    });
    
    // Update connectors
    stepConnectors.forEach((connector, index) => {
      if (index < currentIndex) {
        connector.classList.add('wizard-stepper-connector--completed');
      } else {
        connector.classList.remove('wizard-stepper-connector--completed');
      }
    });
  }

  function clearQuestions() {
    questionsContainer.innerHTML = "";
    allQuestions = [];
    currentPageIndex = 0;
    currentAnswers.clear();
    qaEmptyState.classList.remove("hidden");
    questionsContainer.classList.add("hidden");
    nextBatchBtn.classList.add("hidden");
    finalizeBtn.classList.add("hidden");
    backBtn.classList.add("hidden");
    skipBtn.classList.add("hidden");
    saveSnapshotBtn.classList.add("hidden");
    progressIndicator?.classList.add("hidden");
  }
  
  // Add questions to the global list (with sequential numbering)
  function addQuestions(newQuestions) {
    const startIndex = allQuestions.length;
    newQuestions.forEach((q, idx) => {
      allQuestions.push({
        ...q,
        questionNumber: startIndex + idx + 1 // 1-based numbering
      });
    });
  }
  
  // Get current page of questions
  function getCurrentPageQuestions() {
    const startIdx = currentPageIndex * PAGE_SIZE;
    const endIdx = startIdx + PAGE_SIZE;
    return allQuestions.slice(startIdx, endIdx);
  }
  
  // Get total number of pages
  function getTotalPages() {
    return Math.ceil(allQuestions.length / PAGE_SIZE);
  }
  
  // Update progress indicator
  function updateProgressIndicator() {
    if (!progressIndicator || allQuestions.length === 0) return;
    
    const totalPages = getTotalPages();
    const totalQuestions = allQuestions.length;
    const startQuestion = currentPageIndex * PAGE_SIZE + 1;
    const endQuestion = Math.min((currentPageIndex + 1) * PAGE_SIZE, totalQuestions);
    
    // Show progress indicator
    progressIndicator.classList.remove("hidden");
    
    // Update progress text
    if (progressText) {
      progressText.textContent = `Questions ${startQuestion}–${endQuestion} of ${totalQuestions}`;
    }
    
    // Update progress bar width
    if (progressBar) {
      const progress = ((currentPageIndex + 1) / totalPages) * 100;
      progressBar.style.width = `${progress}%`;
    }
    
    // Update progress dots
    if (progressDots) {
      const dots = [];
      for (let i = 0; i < totalPages; i++) {
        if (i === currentPageIndex) {
          dots.push('●'); // Filled dot for current page
        } else if (i < currentPageIndex) {
          dots.push('●'); // Filled dot for completed pages
        } else {
          dots.push('○'); // Empty dot for future pages
        }
      }
      progressDots.textContent = dots.join('');
      
      // Hide dots if too many pages (more than 10)
      if (totalPages > 10) {
        progressDots.style.display = 'none';
      } else {
        progressDots.style.display = 'inline';
      }
    }
  }
  
  // Update pagination button states
  function updatePaginationButtons() {
    const totalPages = getTotalPages();
    
    // Back button
    if (totalPages <= 1 || currentPageIndex === 0) {
      backBtn.disabled = true;
    } else {
      backBtn.disabled = false;
    }
    
    // Update Back button text (find the text span, not the icon)
    const backTextSpan = backBtn.querySelector("span:not(.wizard-button-icon)");
    if (backTextSpan) {
      if (totalPages > 1 && currentPageIndex > 0) {
        backTextSpan.textContent = `Back (${currentPageIndex}/${totalPages})`;
      } else {
        backTextSpan.textContent = "Back";
      }
    }
    
    // Update Next button text
    const nextTextSpan = nextBatchBtn.querySelector("span:not(.wizard-button-icon)");
    if (nextTextSpan) {
      if (totalPages <= 1 || currentPageIndex >= totalPages - 1) {
        nextTextSpan.textContent = "Submit & Continue";
      } else {
        nextTextSpan.textContent = `Next (Page ${currentPageIndex + 2}/${totalPages})`;
      }
    }
    
    // Update progress indicator
    updateProgressIndicator();
  }

  // Render current page of questions
  function renderCurrentPage() {
    questionsContainer.innerHTML = "";
    
    if (allQuestions.length === 0) {
      qaEmptyState.classList.remove("hidden");
      questionsContainer.classList.add("hidden");
      nextBatchBtn.classList.add("hidden");
      backBtn.classList.add("hidden");
      return;
    }
    
    qaEmptyState.classList.add("hidden");
    questionsContainer.classList.remove("hidden");
    nextBatchBtn.classList.remove("hidden");
    backBtn.classList.remove("hidden");
    finalizeBtn.classList.remove("hidden");
    saveSnapshotBtn.classList.remove("hidden");
    
    // Add page indicator (FIX 6)
    const pageIndicator = document.createElement("div");
    pageIndicator.className = "wizard-page-indicator";
    const totalPages = getTotalPages();
    const startQ = currentPageIndex * PAGE_SIZE + 1;
    const endQ = Math.min((currentPageIndex + 1) * PAGE_SIZE, allQuestions.length);
    pageIndicator.innerHTML = `
      <span>Page <span class="wizard-page-indicator-number">${currentPageIndex + 1}</span> of ${totalPages}</span>
      <span style="color:rgba(148,163,184,0.5);">•</span>
      <span>Questions ${startQ}–${endQ} of ${allQuestions.length}</span>
    `;
    questionsContainer.appendChild(pageIndicator);
    
    const pageQuestions = getCurrentPageQuestions();
    
    pageQuestions.forEach((q, idx) => {
      const card = document.createElement("div");
      card.className = "wizard-question-card";
      // Stagger animation: 0ms, 80ms, 160ms, 240ms, 320ms
      card.style.animationDelay = `${idx * 80}ms`;
      
      // Question number (fixed, permanent)
      const numberDiv = document.createElement("div");
      numberDiv.className = "wizard-question-number";
      numberDiv.textContent = `Question ${q.questionNumber}`;

      const typeSpan = document.createElement("div");
      typeSpan.className = "wizard-question-type";
      const typeLabels = {
        "single_choice": "Single Choice (Pick one)",
        "multi_choice": "Multiple Choice (Pick any)",
        "yes_no": "Yes/No",
        "short_text": "Short Text"
      };
      typeSpan.textContent = typeLabels[q.type] || q.type || "question";

      const textDiv = document.createElement("div");
      textDiv.className = "wizard-question-text";
      textDiv.textContent = q.content || "";

      card.appendChild(numberDiv);
      card.appendChild(typeSpan);
      card.appendChild(textDiv);

      // Add regenerate button for each question (FIX 3)
      const regenerateBtn = document.createElement("button");
      regenerateBtn.type = "button";
      regenerateBtn.className = "wizard-regenerate-icon";
      regenerateBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
        </svg>
        <span>Regenerate</span>
      `;
      regenerateBtn.style.marginTop = "8px";
      regenerateBtn.addEventListener("click", () => regenerateQuestion(q.id, card));
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

        // FIX 5: Handle missing options
        if (options.length === 0) {
          const missingDiv = document.createElement("div");
          missingDiv.className = "wizard-missing-options";
          missingDiv.innerHTML = `
            <span class="wizard-missing-options-icon">⚠️</span>
            <span>No options available. Click "Regenerate" to try again.</span>
          `;
          card.appendChild(missingDiv);
          questionsContainer.appendChild(card);
          return; // Skip this question
        }

        const existing = currentAnswers.get(q.id);
        const selected = new Set(
          Array.isArray(existing) ? existing : existing ? [existing] : []
        );

        const pills = [];
        let otherInputContainer = null;

        options.forEach((opt) => {
          const pill = document.createElement("button");
          pill.type = "button";
          pill.className = isMulti ? "wizard-pill wizard-pill--multi" : "wizard-pill";
          pill.textContent = opt.label || opt.value || "";
          pill.setAttribute("data-value", opt.value);

          // FIX 4: Check if this is "Other" option
          const isOther = opt.is_other === true || (opt.label && opt.label.toLowerCase().includes("other"));

          function updateSelection() {
            if (isMulti) {
              // Multi-choice: toggle selection
              if (selected.has(opt.value)) {
                selected.delete(opt.value);
                pill.classList.remove("is-selected");
                // Hide other input if unselecting "Other"
                if (isOther && otherInputContainer) {
                  otherInputContainer.remove();
                  otherInputContainer = null;
                }
              } else {
                selected.add(opt.value);
                pill.classList.add("is-selected");
                // Show other input if selecting "Other"
                if (isOther && !otherInputContainer) {
                  showOtherInput();
                }
              }
              currentAnswers.set(q.id, Array.from(selected));
            } else {
              // Single-choice: deselect all others, select this one
              selected.clear();
              selected.add(opt.value);
              currentAnswers.set(q.id, opt.value);
              
              // Update all pills in this row
              pills.forEach(p => p.classList.remove("is-selected"));
              pill.classList.add("is-selected");
              
              // Handle "Other" input field
              if (isOther) {
                if (!otherInputContainer) {
                  showOtherInput();
                }
              } else {
                // Remove other input if switching to different option
                if (otherInputContainer) {
                  otherInputContainer.remove();
                  otherInputContainer = null;
                }
              }
            }
          }

          function showOtherInput() {
            if (otherInputContainer) return; // Already showing
            
            otherInputContainer = document.createElement("div");
            otherInputContainer.className = "wizard-other-input-container";
            
            const input = document.createElement("input");
            input.type = "text";
            input.className = "wizard-other-input";
            input.placeholder = "Please specify...";
            input.addEventListener("input", () => {
              // Store custom text with the answer
              const customValue = `${opt.value}:${input.value}`;
              if (isMulti) {
                selected.delete(opt.value);
                selected.add(customValue);
                currentAnswers.set(q.id, Array.from(selected));
              } else {
                currentAnswers.set(q.id, customValue);
              }
            });
            
            otherInputContainer.appendChild(input);
            card.appendChild(otherInputContainer);
            
            // Auto-focus
            setTimeout(() => input.focus(), 100);
          }

          pill.addEventListener("click", updateSelection);

          if (isMulti ? selected.has(opt.value) : currentAnswers.get(q.id) === opt.value) {
            pill.classList.add("is-selected");
            if (isOther) {
              setTimeout(() => showOtherInput(), 100);
            }
          }

          pills.push(pill);
          row.appendChild(pill);
        });

        card.appendChild(row);
      }

      questionsContainer.appendChild(card);
    });

    // Update pagination buttons
    updatePaginationButtons();
    
    // Show all buttons
    skipBtn.classList.remove("hidden");
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

    // Start transition animation
    ideaPanel?.classList.add("is-starting");
    startBtn.disabled = true;
    startBtn.textContent = "Starting...";
    
    // Wait for fade-out animation before starting API call
    await new Promise(resolve => setTimeout(resolve, 300));

    try {
      log("Starting new question session...");
      
      // Show loading overlay in question panel
      showLoadingInQuestionPanel("Preparing questions...");
      
      qaPanel?.classList.add("is-appearing");
      
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
        // Revert animations on error
        ideaPanel?.classList.remove("is-starting");
        qaPanel?.classList.remove("is-appearing");
        startBtn.disabled = false;
        startBtn.textContent = "Start wizard";
        return;
      }
      const data = await res.json();
      currentSessionId = data.session_id;
      log(`Session created: ${currentSessionId}`);
      
      // Hide loading overlay
      hideLoadingInQuestionPanel();
      
      // Add questions and render first page
      addQuestions(data.questions || []);
      currentPageIndex = 0;
      renderCurrentPage();
      log(`Loaded ${allQuestions.length} questions (showing page 1/${getTotalPages()})`);
      
      // Update wizard stepper to Questions step
      updateWizardStepper('questions');
      
      // Keep button disabled after successful start
      startBtn.textContent = "Session started";
    } catch (err) {
      console.error(err);
      log("Error while starting wizard: " + err.message);
      // Revert animations on error
      ideaPanel?.classList.remove("is-starting");
      qaPanel?.classList.remove("is-appearing");
      startBtn.disabled = false;
      startBtn.textContent = "Start wizard";
    }
  }

  // Handle Next button: move to next page or submit answers
  async function handleNext() {
    if (!currentSessionId || allQuestions.length === 0) return;
    
    const totalPages = getTotalPages();
    
    // If not on last page, just move to next page (client-side pagination)
    if (currentPageIndex < totalPages - 1) {
      // Play slide-out-left animation
      questionsContainer.classList.add('wizard-questions--slide-out-left');
      
      // Wait for animation to complete
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Update page
      currentPageIndex++;
      
      // Remove animation class and add slide-in-right
      questionsContainer.classList.remove('wizard-questions--slide-out-left');
      questionsContainer.classList.add('wizard-questions--slide-in-right');
      
      // Render new content
      renderCurrentPage();
      log(`Moved to page ${currentPageIndex + 1}/${totalPages}`);
      
      // Clean up animation class after it completes
      setTimeout(() => {
        questionsContainer.classList.remove('wizard-questions--slide-in-right');
      }, 250);
      
      return;
    }
    
    // On last page: submit all answers to backend
    const answersPayload = allQuestions.map((q) => ({
      question_id: q.id,
      value: currentAnswers.get(q.id) ?? null
    }));

    try {
      log("Submitting all answers...");
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
        clearQuestions();
      } else if (data.questions && data.questions.length > 0) {
        // More questions arrived from backend
        log(`Received ${data.questions.length} new questions from backend.`);
        clearQuestions();
        addQuestions(data.questions);
        currentPageIndex = 0;
        renderCurrentPage();
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
      
      // Update wizard stepper to Finalize step
      updateWizardStepper('finalize');
      
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
      
      // Disable button during save
      const originalText = saveSnapshotBtn.textContent;
      saveSnapshotBtn.disabled = true;
      saveSnapshotBtn.textContent = "💾 Saving...";
      
      const res = await fetch(`${API_BASE}/api/question-sessions/${encodeURIComponent(currentSessionId)}/snapshot`, {
        method: "POST"
      });
      if (!res.ok) {
        const txt = await res.text();
        log(`Failed to save snapshot: HTTP ${res.status} ${txt}`);
        saveSnapshotBtn.disabled = false;
        saveSnapshotBtn.textContent = originalText;
        return;
      }
      const data = await res.json();
      log(`Snapshot saved: ${data.snapshot_id}`);
      
      // Gentle success feedback
      showSnapshotSuccess();
      
      // Show restore button for future use
      if (restoreSnapshotBtn) {
        restoreSnapshotBtn.classList.remove("hidden");
      }
      
      // Re-enable button
      saveSnapshotBtn.disabled = false;
      saveSnapshotBtn.textContent = originalText;
    } catch (err) {
      console.error(err);
      log("Error while saving snapshot: " + err.message);
      saveSnapshotBtn.disabled = false;
      saveSnapshotBtn.textContent = "💾 Save snapshot";
    }
  }
  
  // Gentle success feedback for snapshot save
  function showSnapshotSuccess() {
    if (!saveSnapshotBtn) return;
    
    // Add success state to button
    saveSnapshotBtn.classList.add("snapshot-saved");
    
    // Create gentle tooltip
    const tooltip = document.createElement("div");
    tooltip.className = "wizard-snapshot-tooltip";
    tooltip.textContent = "✓ Saved";
    
    // Position relative to button
    const btnParent = saveSnapshotBtn.parentElement;
    if (btnParent) {
      btnParent.style.position = "relative";
      btnParent.appendChild(tooltip);
      
      // Auto-remove after animation
      setTimeout(() => {
        tooltip.remove();
        saveSnapshotBtn.classList.remove("snapshot-saved");
      }, 1200);
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
      const unanswered = snapshotQuestions.filter(q => !answeredIds.has(q.id));
      
      clearQuestions();
      addQuestions(unanswered.map(q => ({
        id: q.id,
        type: q.type,
        content: q.content,
        options: q.options_json ? JSON.parse(q.options_json) : null
      })));
      currentPageIndex = 0;
      renderCurrentPage();
    } catch (err) {
      console.error(err);
      log("Error while restoring snapshot: " + err.message);
    }
  }

  // Go back to previous page
  async function goBack() {
    if (currentPageIndex > 0) {
      // Play slide-out-right animation
      questionsContainer.classList.add('wizard-questions--slide-out-right');
      
      // Wait for animation to complete
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Update page
      currentPageIndex--;
      
      // Remove animation class and add slide-in-left
      questionsContainer.classList.remove('wizard-questions--slide-out-right');
      questionsContainer.classList.add('wizard-questions--slide-in-left');
      
      // Render new content
      renderCurrentPage();
      log(`Moved to page ${currentPageIndex + 1}/${getTotalPages()}`);
      
      // Clean up animation class after it completes
      setTimeout(() => {
        questionsContainer.classList.remove('wizard-questions--slide-in-left');
      }, 250);
      } else {
      log("Already on first page");
    }
  }

  // Q2: Skip current page of questions
  async function skipCurrent() {
    if (!currentSessionId || allQuestions.length === 0) return;
    const pageQuestions = getCurrentPageQuestions();
    if (pageQuestions.length === 0) return;
    const firstQuestionId = pageQuestions[0].id;
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
        clearQuestions();
      } else if (data.questions && data.questions.length > 0) {
        clearQuestions();
        addQuestions(data.questions);
        currentPageIndex = 0;
        renderCurrentPage();
      }
    } catch (err) {
      console.error(err);
      log("Error while skipping: " + err.message);
    }
  }

  // Q3: Regenerate a specific question
  async function regenerateQuestion(questionId, cardElement) {
    if (!currentSessionId) return;
    
    let loadingOverlay = null;
    
    try {
      log(`Regenerating question ${questionId}...`);
      
      // FIX: Create stable loading overlay
      if (cardElement) {
        // Add regenerating class
        cardElement.classList.add("is-regenerating");
        
        // Create loading overlay DOM element (stable positioning)
        loadingOverlay = document.createElement("div");
        loadingOverlay.className = "wizard-regenerating-overlay";
        
        const spinner = document.createElement("div");
        spinner.className = "wizard-regenerating-spinner";
        
        loadingOverlay.appendChild(spinner);
        cardElement.appendChild(loadingOverlay);
      }
      
      const res = await fetch(
        `${API_BASE}/api/question-sessions/${encodeURIComponent(currentSessionId)}/questions/${encodeURIComponent(questionId)}/regenerate`,
        { method: "POST" }
      );
      if (!res.ok) {
        const txt = await res.text();
        log(`Failed to regenerate: HTTP ${res.status} ${txt}`);
        if (cardElement) {
          cardElement.classList.remove("is-regenerating");
          if (loadingOverlay) loadingOverlay.remove();
        }
        return;
      }
      const data = await res.json();
      log(data.message || "Question regenerated");
      
      // Replace the old question with the new one in allQuestions (preserve question number)
      const index = allQuestions.findIndex(q => q.id === questionId);
      if (index !== -1) {
        const oldQuestionNumber = allQuestions[index].questionNumber;
        allQuestions[index] = {
          ...data.question,
          questionNumber: oldQuestionNumber
        };
        
        // Wait a moment before re-rendering for smooth transition
        await new Promise(resolve => setTimeout(resolve, 300));
        renderCurrentPage();
      }
    } catch (err) {
      console.error(err);
      log("Error while regenerating question: " + err.message);
      if (cardElement) {
        cardElement.classList.remove("is-regenerating");
        if (loadingOverlay) loadingOverlay.remove();
      }
    }
  }

  // Input focus animations
  ideaInput?.addEventListener("focus", () => {
    ideaPanel?.classList.add("is-focused");
  });
  
  ideaInput?.addEventListener("blur", () => {
    ideaPanel?.classList.remove("is-focused");
  });
  
  kindSelect?.addEventListener("focus", () => {
    ideaPanel?.classList.add("is-focused");
  });
  
  kindSelect?.addEventListener("blur", () => {
    ideaPanel?.classList.remove("is-focused");
  });

  startBtn?.addEventListener("click", startWizard);
  nextBatchBtn?.addEventListener("click", handleNext);
  finalizeBtn?.addEventListener("click", finalizeSession);
  backBtn?.addEventListener("click", goBack);
  skipBtn?.addEventListener("click", skipCurrent);
  saveSnapshotBtn?.addEventListener("click", saveSnapshot);
  restoreSnapshotBtn?.addEventListener("click", restoreSnapshot);

  // Initialize wizard stepper to Describe step
  updateWizardStepper('describe');

  log("Wizard page loaded. Describe your idea on the left to begin.");
})();

// Global theme support (consistent with dashboard)
(function initThemeSupport() {
  // Apply theme based on system preference or saved preference
  function applyTheme(theme) {
    const themeValue = (theme || '').toLowerCase();
    if (themeValue === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else if (themeValue === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      // Auto/system mode
      document.documentElement.removeAttribute('data-theme');
      // Follow system preference
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
        document.documentElement.setAttribute('data-theme', 'light');
      }
    }
  }

  // Initialize theme from localStorage or system
  const savedTheme = localStorage.getItem('promptly-theme') || 'auto';
  applyTheme(savedTheme);

  // Listen for system theme changes
  if (window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: light)');
    mediaQuery.addEventListener('change', () => {
      const currentTheme = localStorage.getItem('promptly-theme') || 'auto';
      if (currentTheme === 'auto') {
        applyTheme('auto');
      }
    });
  }
})();