const API_BASE = (window.PROMPTLY_API_BASE && window.PROMPTLY_API_BASE.trim())
  || (window.location && window.location.origin && window.location.origin !== "null"
    ? window.location.origin
    : "http://localhost:8080");

(() => {
  // DOM Elements
  const resultLoading = document.getElementById("resultLoading");
  const resultError = document.getElementById("resultError");
  const resultErrorMessage = document.getElementById("resultErrorMessage");
  const resultContent = document.getElementById("resultContent");
  const specOutput = document.getElementById("specOutput");
  const specRawView = document.getElementById("specRawView");
  const specHumanView = document.getElementById("specHumanView");
  const specHumanContent = document.getElementById("specHumanContent");
  const promptBlocksContainer = document.getElementById("promptBlocksContainer");
  const explanationList = document.getElementById("explanationList");
  const explanationFull = document.getElementById("explanationFull");
  const explanationFullText = document.getElementById("explanationFullText");
  const explanationBrief = document.getElementById("explanationBrief");
  const copyNotification = document.getElementById("copyNotification");
  const downloadModal = document.getElementById("downloadModal");
  
  // State
  let currentSpec = null;
  let currentPrompt = null;
  let currentSpecId = null;

  // Get spec ID from URL
  const params = new URLSearchParams(window.location.search || "");
  currentSpecId = params.get("specId");

  // ============================================
  // Main Load Function
  // ============================================
  async function loadResult() {
    if (!currentSpecId) {
      showError("Missing specId in URL. Example: result.html?specId=spec_xxx");
      return;
    }

    try {
      // Load spec
      const specRes = await fetch(`${API_BASE}/api/specs/${encodeURIComponent(currentSpecId)}`);
      if (!specRes.ok) {
        const txt = await specRes.text();
        throw new Error(`Failed to load spec: HTTP ${specRes.status} ${txt}`);
      }
      const specData = await specRes.json();
      currentSpec = specData.spec || specData;

      // Compile prompt blocks
      try {
        const cpRes = await fetch(`${API_BASE}/api/specs/${encodeURIComponent(currentSpecId)}/compile`, {
          method: "POST"
        });
        if (cpRes.ok) {
          const cpData = await cpRes.json();
          currentPrompt = cpData.compiled_prompt || null;
        }
      } catch (err) {
        console.error("[promptly] failed to compile prompt from spec", err);
      }

      // Render all sections
      renderSpec();
      renderPromptBlocks();
      renderExplanation();
      renderMetadata();
      renderSidebar();

      // Hide loading, show content
      resultLoading.classList.add("hidden");
      resultContent.classList.remove("hidden");
    } catch (err) {
      console.error(err);
      showError(err.message || "Failed to load result.");
    }
  }

  // ============================================
  // Render Functions
  // ============================================

  function renderSpec() {
    // Raw JSON view
    const jsonStr = JSON.stringify(currentSpec, null, 2);
    specOutput.textContent = jsonStr;
    applySyntaxHighlighting(specOutput);

    // Human-readable view
    specHumanContent.innerHTML = "";
    const fields = [
      { label: "Project Goal", key: "project_goal" },
      { label: "Target Users", key: "target_users" },
      { label: "Platform", key: "platform" },
      { label: "Key Features", key: "key_features" },
      { label: "Technical Stack", key: "technical_stack" }
    ];

    fields.forEach(({ label, key }) => {
      const value = currentSpec[key];
      if (value !== undefined && value !== null) {
        const item = document.createElement("div");
        item.className = "result-human-item";
        
        const labelEl = document.createElement("div");
        labelEl.className = "result-human-label";
        labelEl.textContent = label;
        
        const valueEl = document.createElement("div");
        valueEl.className = "result-human-value";
        
        if (Array.isArray(value)) {
          valueEl.innerHTML = value.map(v => `• ${v}`).join("<br>");
        } else if (typeof value === "object") {
          valueEl.textContent = JSON.stringify(value, null, 2);
        } else {
          valueEl.textContent = value;
        }
        
        item.appendChild(labelEl);
        item.appendChild(valueEl);
        specHumanContent.appendChild(item);
      }
    });
  }

  function renderPromptBlocks() {
    promptBlocksContainer.innerHTML = "";
    
    if (!currentPrompt || !Array.isArray(currentPrompt.blocks) || currentPrompt.blocks.length === 0) {
      promptBlocksContainer.innerHTML = '<p style="color: rgba(148,163,184,0.8); padding: 1rem;">No compiled prompt blocks available.</p>';
      document.getElementById("promptBlockCount").textContent = "0 blocks";
      return;
    }

    document.getElementById("promptBlockCount").textContent = `${currentPrompt.blocks.length} blocks`;

    currentPrompt.blocks.forEach((block, index) => {
      const blockEl = document.createElement("div");
      blockEl.className = "result-prompt-block";
      blockEl.dataset.blockIndex = index;

      const header = document.createElement("div");
      header.className = "result-prompt-block-header";
      header.onclick = () => togglePromptBlock(index);

      const title = document.createElement("div");
      title.className = "result-prompt-block-title";

      const role = document.createElement("span");
      role.className = `result-prompt-block-role result-prompt-block-role--${block.role || 'user'}`;
      role.textContent = block.role || "user";

      const label = document.createElement("span");
      label.textContent = block.label || `Block ${index + 1}`;

      title.appendChild(role);
      title.appendChild(label);

      const actions = document.createElement("div");
      actions.className = "result-prompt-block-actions";

      const copyBtn = document.createElement("button");
      copyBtn.className = "result-icon-btn";
      copyBtn.innerHTML = '<span>📋</span>';
      copyBtn.title = "Copy block";
      copyBtn.onclick = (e) => {
        e.stopPropagation();
        copyToClipboard(block.content, blockEl);
      };

      const collapseBtn = document.createElement("button");
      collapseBtn.className = "result-icon-btn result-collapse-btn";
      collapseBtn.innerHTML = '<span class="result-collapse-icon">▼</span>';

      actions.appendChild(copyBtn);
      actions.appendChild(collapseBtn);

      header.appendChild(title);
      header.appendChild(actions);

      const body = document.createElement("div");
      body.className = "result-prompt-block-body";
      body.textContent = block.content || "";

      blockEl.appendChild(header);
      blockEl.appendChild(body);
      promptBlocksContainer.appendChild(blockEl);
    });
  }

  function renderExplanation() {
    if (!currentPrompt || !currentPrompt.explanation) {
      explanationBrief.innerHTML = '<p style="color: rgba(148,163,184,0.8);">No explanation available.</p>';
      document.getElementById("toggleExplanationBtn").style.display = "none";
      return;
    }

    const explanation = currentPrompt.explanation;
    explanationFullText.textContent = explanation;

    // Extract bullet points (first 3 sentences or split by periods)
    const sentences = explanation.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const bulletPoints = sentences.slice(0, 3).map(s => s.trim());

    explanationList.innerHTML = "";
    bulletPoints.forEach(point => {
      const li = document.createElement("li");
      li.textContent = point;
      explanationList.appendChild(li);
    });

    // Show toggle button if there's more content
    if (sentences.length > 3 || explanation.length > 300) {
      document.getElementById("toggleExplanationBtn").style.display = "block";
    } else {
      document.getElementById("toggleExplanationBtn").style.display = "none";
    }
  }

  function renderMetadata() {
    document.getElementById("metaSpecId").textContent = currentSpecId || "-";
    
    const createdAt = currentSpec.created_at || new Date().toISOString();
    const date = new Date(createdAt);
    document.getElementById("metaCreatedAt").textContent = date.toLocaleString();
    
    const projectType = currentSpec.kind || currentSpec.type || "General";
    document.getElementById("metaProjectType").textContent = projectType;
  }

  function renderSidebar() {
    const blockCount = (currentPrompt && currentPrompt.blocks) ? currentPrompt.blocks.length : 0;
    document.getElementById("sidebarBlockCount").textContent = blockCount;
    
    const projectType = currentSpec.kind || currentSpec.type || "General";
    document.getElementById("sidebarProjectType").textContent = projectType;
    
    const createdAt = currentSpec.created_at || new Date().toISOString();
    const date = new Date(createdAt);
    const timeAgo = getTimeAgo(date);
    document.getElementById("sidebarCreatedAt").textContent = timeAgo;
  }

  // ============================================
  // Utility Functions
  // ============================================

  function showError(message) {
    resultLoading.classList.add("hidden");
    resultError.classList.remove("hidden");
    resultErrorMessage.textContent = message;
  }

  function applySyntaxHighlighting(element) {
    // Basic syntax highlighting for JSON
    let html = element.textContent;
    html = html.replace(/"([^"]+)":/g, '<span class="key">"$1":</span>');
    html = html.replace(/: "([^"]*)"/g, ': <span class="string">"$1"</span>');
    html = html.replace(/: (\d+\.?\d*)/g, ': <span class="number">$1</span>');
    html = html.replace(/: (true|false)/g, ': <span class="boolean">$1</span>');
    html = html.replace(/: null/g, ': <span class="null">null</span>');
    element.innerHTML = html;
  }

  function copyToClipboard(text, flashElement) {
    navigator.clipboard.writeText(text).then(() => {
      showCopyNotification();
      if (flashElement) {
        flashElement.classList.add("copy-flash");
        setTimeout(() => flashElement.classList.remove("copy-flash"), 400);
      }
    }).catch(err => {
      console.error("Failed to copy:", err);
    });
  }

  function showCopyNotification() {
    copyNotification.classList.remove("hidden");
    setTimeout(() => {
      copyNotification.classList.add("hidden");
    }, 2000);
  }

  function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  }

  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function generateMarkdown() {
    let md = `# Project Specification\n\n`;
    md += `**Generated:** ${new Date().toLocaleString()}\n\n`;
    md += `## High-Level Spec\n\n`;
    md += `\`\`\`json\n${JSON.stringify(currentSpec, null, 2)}\n\`\`\`\n\n`;
    
    if (currentPrompt && currentPrompt.blocks) {
      md += `## Compiled Prompt Blocks\n\n`;
      currentPrompt.blocks.forEach((block, i) => {
        md += `### Block ${i + 1}: ${block.role || 'user'} - ${block.label || ''}\n\n`;
        md += `\`\`\`\n${block.content}\n\`\`\`\n\n`;
      });
    }
    
    if (currentPrompt && currentPrompt.explanation) {
      md += `## Explanation\n\n${currentPrompt.explanation}\n\n`;
    }
    
    return md;
  }

  function generateText() {
    let text = `PROJECT SPECIFICATION\n${"=".repeat(60)}\n\n`;
    text += `Generated: ${new Date().toLocaleString()}\n\n`;
    text += `HIGH-LEVEL SPEC\n${"-".repeat(60)}\n`;
    text += JSON.stringify(currentSpec, null, 2) + "\n\n";
    
    if (currentPrompt && currentPrompt.blocks) {
      text += `COMPILED PROMPT BLOCKS\n${"-".repeat(60)}\n\n`;
      currentPrompt.blocks.forEach((block, i) => {
        text += `Block ${i + 1}: [${block.role || 'user'}] ${block.label || ''}\n`;
        text += `${block.content}\n\n`;
      });
    }
    
    if (currentPrompt && currentPrompt.explanation) {
      text += `EXPLANATION\n${"-".repeat(60)}\n${currentPrompt.explanation}\n\n`;
    }
    
    return text;
  }

  // ============================================
  // Event Handlers
  // ============================================

  // Collapsible sections
  document.querySelectorAll("[data-collapsible]").forEach(header => {
    header.addEventListener("click", (e) => {
      if (e.target.closest(".result-icon-btn:not(.result-collapse-btn)")) return;
      
      const targetId = header.dataset.collapsible;
      const body = document.querySelector(`[data-collapsible-target="${targetId}"]`);
      
      if (body) {
        body.classList.toggle("result-card-body--collapsed");
        header.setAttribute("aria-expanded", !body.classList.contains("result-card-body--collapsed"));
      }
    });
  });

  // Toggle spec view (Raw/Human)
  document.querySelectorAll(".result-view-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      const view = tab.dataset.view;
      
      document.querySelectorAll(".result-view-tab").forEach(t => {
        t.classList.remove("result-view-tab--active");
      });
      tab.classList.add("result-view-tab--active");
      
      if (view === "raw") {
        specRawView.classList.remove("hidden");
        specHumanView.classList.add("hidden");
      } else {
        specRawView.classList.add("hidden");
        specHumanView.classList.remove("hidden");
      }
    });
  });

  // Copy spec
  document.getElementById("copySpecBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    const jsonStr = JSON.stringify(currentSpec, null, 2);
    copyToClipboard(jsonStr, document.querySelector(".result-card[data-card-index='0']"));
  });

  // Copy all prompts
  document.getElementById("copyAllPromptsBtn").addEventListener("click", (e) => {
    e.stopPropagation();
    if (!currentPrompt || !currentPrompt.blocks) return;
    
    const allText = currentPrompt.blocks
      .map(b => `[${b.role} · ${b.label || ""}]\n${b.content}`)
      .join("\n\n");
    copyToClipboard(allText, document.querySelector(".result-card[data-card-index='1']"));
  });

  // Toggle prompt block
  function togglePromptBlock(index) {
    const block = document.querySelector(`.result-prompt-block[data-block-index="${index}"]`);
    if (!block) return;
    
    const body = block.querySelector(".result-prompt-block-body");
    body.classList.toggle("result-prompt-block-body--collapsed");
  }

  // Toggle explanation detail
  let explanationExpanded = false;
  document.getElementById("toggleExplanationBtn").addEventListener("click", () => {
    explanationExpanded = !explanationExpanded;
    
    if (explanationExpanded) {
      explanationBrief.classList.add("hidden");
      explanationFull.classList.remove("hidden");
      document.getElementById("toggleExplanationBtn").textContent = "Show less";
    } else {
      explanationBrief.classList.remove("hidden");
      explanationFull.classList.add("hidden");
      document.getElementById("toggleExplanationBtn").textContent = "Show more details";
    }
  });

  // Download button
  document.getElementById("downloadBtn").addEventListener("click", () => {
    downloadModal.classList.remove("hidden");
  });

  document.getElementById("closeDownloadModal").addEventListener("click", () => {
    downloadModal.classList.add("hidden");
  });

  document.querySelector(".result-modal-overlay").addEventListener("click", () => {
    downloadModal.classList.add("hidden");
  });

  // Download options
  document.querySelectorAll(".result-download-option").forEach(option => {
    option.addEventListener("click", () => {
      const format = option.dataset.format;
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      
      if (format === "json") {
        const jsonStr = JSON.stringify({ spec: currentSpec, compiled_prompt: currentPrompt }, null, 2);
        downloadFile(jsonStr, `spec-${currentSpecId}-${timestamp}.json`, "application/json");
      } else if (format === "markdown") {
        const md = generateMarkdown();
        downloadFile(md, `spec-${currentSpecId}-${timestamp}.md`, "text/markdown");
      } else if (format === "text") {
        const text = generateText();
        downloadFile(text, `spec-${currentSpecId}-${timestamp}.txt`, "text/plain");
      }
      
      downloadModal.classList.add("hidden");
      showCopyNotification();
    });
  });

  // Export buttons in sidebar
  document.getElementById("exportJsonBtn").addEventListener("click", () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const jsonStr = JSON.stringify({ spec: currentSpec, compiled_prompt: currentPrompt }, null, 2);
    downloadFile(jsonStr, `spec-${currentSpecId}-${timestamp}.json`, "application/json");
    showCopyNotification();
  });

  document.getElementById("exportMarkdownBtn").addEventListener("click", () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const md = generateMarkdown();
    downloadFile(md, `spec-${currentSpecId}-${timestamp}.md`, "text/markdown");
    showCopyNotification();
  });

  document.getElementById("exportTextBtn").addEventListener("click", () => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const text = generateText();
    downloadFile(text, `spec-${currentSpecId}-${timestamp}.txt`, "text/plain");
    showCopyNotification();
  });

  // Share button (copy URL)
  document.getElementById("shareBtn").addEventListener("click", () => {
    const url = window.location.href;
    copyToClipboard(url);
  });

  // Initialize
  loadResult();
})();
