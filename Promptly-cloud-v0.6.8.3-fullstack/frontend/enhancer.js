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
  const llmStatusEl = document.getElementById("llmStatus");

  /**
   * ATTACHMENT FEATURE
   * Global state to track selected attachments
   */
  let attachments = [];
  const attachBtn = document.getElementById("attachBtn");
  const fileInput = document.getElementById("fileInput");
  const attachmentList = document.getElementById("attachmentList");

  function log(line) {
    const ts = new Date().toISOString().slice(11, 19);
    logEl.textContent += `[${ts}] ${line}\n`;
    logEl.scrollTop = logEl.scrollHeight;
  }

  function setLlmStatus(message, level = "ok") {
    if (!llmStatusEl) return;
    llmStatusEl.textContent = message;
    llmStatusEl.classList.remove("hidden", "enhancer-status--ok", "enhancer-status--warning", "enhancer-status--error");
    llmStatusEl.classList.add(`enhancer-status--${level}`);
  }

  function t(key, options = {}) {
    // Use centralized i18nManager for consistency
    if (!window.i18nManager || !window.i18nManager.instance) {
      console.warn(`[enhancer.js] i18nManager not ready for key: ${key}`);
      // Return a friendly fallback instead of the full key
      return key.split('.').pop();
    }
    
    const result = window.i18nManager.instance.t(key, options);
    
    // Validate translation succeeded (check if i18next returned the key itself)
    if (!result || result === key) {
      console.warn(`[enhancer.js] Translation not found for key: ${key}`);
      // Return the last part of the key as a friendly fallback
      return key.split('.').pop();
    }
    
    return result;
  }

  function disableLlmActions() {
    [runEnhanceBtn, runScoreBtn, runValidateBtn, attachBtn].forEach((btn) => {
      if (btn) btn.disabled = true;
    });
  }

  async function checkLlmStatus() {
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(`Settings unavailable (HTTP ${res.status})`);
      }

      const enabled = !!data.settings?.llmEnabled;
      const model = data.settings?.defaultModel || "gpt-4o-mini";
      if (!enabled) {
        setLlmStatus(t("enhancer.statusLlmDisabled"), "error");
        disableLlmActions();
        log("LLM disabled: set OPENAI_API_KEY on backend");
      } else {
        setLlmStatus(t("enhancer.statusLlmOnline", { model }), "ok");
      }
    } catch (err) {
      setLlmStatus(t("enhancer.statusLlmUnavailable"), "warning");
      log(`Failed to load settings: ${err.message}`);
    }
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

  /**
   * ATTACHMENT FEATURE
   * Call enhancer API with prompt and optional attachments
   * Current: Sends attachments as JSON with base64 dataURL
   * Future: Can switch to multipart/form-data for larger files
   */
  async function callEnhancer(path) {
    const prompt = getPrompt();
    if (!prompt) {
      showError(t("enhancer.errorNoPrompt"));
      return null;
    }
    clearError();
    try {
      log(`POST ${path} ${attachments.length > 0 ? `(with ${attachments.length} attachment${attachments.length > 1 ? 's' : ''})` : ''}...`);
      
      // Build request body with attachments
      const body = {
        prompt,
        attachments: attachments.map(att => ({
          name: att.name,
          size: att.size,
          type: att.type,
          dataURL: att.dataURL
        }))
      };
      
      const res = await fetch(`/api/enhance${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        const errorMsg = data?.error || `HTTP ${res.status}`;
        log(`Enhancer error on ${path}: ${errorMsg}`);
        showError(`Enhancer unavailable: ${errorMsg}`);
        if (res.status === 503 && errorMsg.toLowerCase().includes("llm")) {
          setLlmStatus(errorMsg, "error");
          disableLlmActions();
        }
        return null;
      }
      log(`Enhancer OK on ${path}`);
      if (data.result?.modelUsed) {
        log(`LLM model in use: ${data.result.modelUsed} (completion ${data.result.completionId || 'n/a'})`);
      }

      // Clear attachments after successful request
      clearAttachments();
      
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
      showError(t("enhancer.errorNoPromptToScore"));
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
      showError(t("enhancer.errorNoPromptToValidate"));
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
        validationResultEl.innerText = t("enhancer.validationNoIssues");
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
      () => {
        log("Enhanced prompt copied to clipboard.");
        const originalText = copyEnhancedBtn.textContent;
        copyEnhancedBtn.textContent = t("enhancer.copied", { defaultValue: "Copied!" });
        copyEnhancedBtn.classList.add("copied");
        setTimeout(() => {
          copyEnhancedBtn.textContent = originalText;
          copyEnhancedBtn.classList.remove("copied");
        }, 2000);
      },
      () => log("Failed to copy to clipboard.")
    );
  }

  /**
   * ATTACHMENT FEATURE
   * Utility functions for attachment management
   */
  
  // Get icon based on MIME type
  function getFileIcon(type) {
    if (type.startsWith('image/')) return '🖼️';
    if (type.startsWith('video/')) return '🎬';
    if (type.startsWith('audio/')) return '🎵';
    if (type.includes('pdf')) return '📄';
    if (type.includes('text')) return '📝';
    if (type.includes('zip') || type.includes('compressed')) return '📦';
    return '📎';
  }

  // Format file size for display
  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  // Render attachment list
  function renderAttachments() {
    if (!attachmentList) return;
    
    if (attachments.length === 0) {
      attachmentList.innerHTML = '';
      return;
    }

    // 安全地清空容器
    while (attachmentList.firstChild) {
      attachmentList.removeChild(attachmentList.firstChild);
    }

    const removeTitle = t("enhancer.removeAttachment");
    
    // 安全地创建附件列表元素，防止XSS
    attachments.forEach((att, index) => {
      const item = document.createElement('div');
      item.className = 'attachment-item';
      item.dataset.index = index;
      
      const icon = document.createElement('span');
      icon.className = 'attachment-icon';
      icon.textContent = getFileIcon(att.type);
      
      const info = document.createElement('div');
      info.className = 'attachment-info';
      
      const name = document.createElement('div');
      name.className = 'attachment-name';
      name.textContent = att.name;
      name.title = att.name;
      
      const size = document.createElement('div');
      size.className = 'attachment-size';
      size.textContent = formatSize(att.size);
      
      const removeBtn = document.createElement('button');
      removeBtn.className = 'attachment-remove';
      removeBtn.dataset.index = index;
      removeBtn.title = removeTitle;
      removeBtn.textContent = '×';
      
      // 添加事件监听器
      removeBtn.addEventListener('click', (e) => {
        const index = parseInt(e.target.getAttribute('data-index'), 10);
        removeAttachment(index);
      });
      
      info.appendChild(name);
      info.appendChild(size);
      item.appendChild(icon);
      item.appendChild(info);
      item.appendChild(removeBtn);
      attachmentList.appendChild(item);
    });

    log(`${attachments.length} file(s) attached`);
  }

  // Add attachment
  function addAttachment(file) {
    // Warn for large files (>10MB)
    if (file.size > 10 * 1024 * 1024) {
      const confirmLarge = confirm(
        t("enhancer.confirmLargeFile", { fileName: file.name, fileSize: formatSize(file.size) })
      );
      if (!confirmLarge) return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      attachments.push({
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        dataURL: e.target.result
      });
      renderAttachments();
    };
    reader.onerror = () => {
      log(`Error reading file: ${file.name}`);
      showError(`Failed to read file: ${file.name}`);
    };
    reader.readAsDataURL(file);
  }

  // Remove attachment
  function removeAttachment(index) {
    if (index >= 0 && index < attachments.length) {
      const removed = attachments.splice(index, 1)[0];
      log(`Removed: ${removed.name}`);
      renderAttachments();
    }
  }

  // Clear all attachments
  function clearAttachments() {
    attachments = [];
    renderAttachments();
  }

  // Handle file selection
  function onFileSelect(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    log(`Selected ${files.length} file(s)`);
    files.forEach(file => addAttachment(file));

    // Reset file input so same file can be selected again
    if (fileInput) fileInput.value = '';
  }

  /**
   * ATTACHMENT FEATURE
   * Event listeners
   */
  attachBtn?.addEventListener('click', () => {
    fileInput?.click();
  });
  fileInput?.addEventListener('change', onFileSelect);

  // Standard event listeners
  runEnhanceBtn?.addEventListener("click", onRunEnhance);
  runScoreBtn?.addEventListener("click", onRunScore);
  runValidateBtn?.addEventListener("click", onRunValidate);
  copyEnhancedBtn?.addEventListener("click", onCopyEnhanced);

  checkLlmStatus();
  
  // Wait for i18n to be ready before logging
  if (window.i18n) {
    log(t("enhancer.logLoaded"));
  } else {
    // Fallback if i18n not ready yet
    window.addEventListener('i18nReady', () => {
      log(t("enhancer.logLoaded"));
    });
  log("Prompt Enhancer loaded. Paste a prompt to get started.");
  }
})();