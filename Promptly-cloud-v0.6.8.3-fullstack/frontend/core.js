
(function(){
  const THEME_KEY="promptly.theme", LANG_KEY="promptly.lang", CONSENT_KEY="promptly.consent";
  const prefersDark=window.matchMedia("(prefers-color-scheme: dark)");
  const translations={
    en:{nav_home:"Dashboard",nav_privacy:"Privacy",nav_terms:"Terms",nav_cookies:"Cookies",nav_account:"Account",appearance:"System",auto:"System",light:"Light",dark:"Dark",language:"English",
        hero_title:"Promptly — Prompt Optimizer Studio",hero_subtitle:"Visualization-first workflow. See every gain, every cost, every version.",
        task_label:"Task",examples_label:"Examples (optional)",best_prompt:"Best Prompt",run_btn:"Run Optimization",processing:"Processing...",success_message:"Best Prompt has been updated!",
        kpi_accuracy:"Accuracy",kpi_f1:"F1",kpi_pass:"Pass Rate",kpi_cost:"Token Cost",kpi_prog:"Progress %",
        growth_chart:"Growth Over Iterations",contrib_chart:"Change Contribution",pass_pie:"Pass vs Fail (%)",gauge:"Progress Meter (%)",
        versions:"Prompt Versions",footer_rights:"No trackers. Preferences saved only after consent.",footer_contact:"Support",
        consent_text:"We use cookies to improve your experience and remember preferences.",consent_btn:"Accept",
        placeholder_task:"e.g., Classify sentiment of a sentence; output POS or NEG only.",
        placeholder_examples:"POS || I love this!\nNEG || This is terrible."},
    zh:{nav_home:"仪表盘",nav_privacy:"隐私政策",nav_terms:"服务条款",nav_cookies:"Cookie 政策",nav_account:"账号",appearance:"系统",auto:"系统",light:"浅色",dark:"深色",language:"中文",
        hero_title:"Promptly — 提示优化工作室",hero_subtitle:"可视化优先：每次提升、每分成本、每个版本都一目了然。",
        task_label:"任务",examples_label:"示例（可选）",best_prompt:"最佳 Prompt",run_btn:"运行优化",processing:"处理中...",success_message:"最佳 Prompt 已更新！",
        kpi_accuracy:"准确率",kpi_f1:"F1",kpi_pass:"通过率",kpi_cost:"Token 成本",kpi_prog:"进度 %",
        growth_chart:"迭代增长曲线",contrib_chart:"改动贡献",pass_pie:"通过 vs 失败（%）",gauge:"进度仪表（%）",
        versions:"Prompt 版本",footer_rights:"无追踪；仅在同意后保存偏好。",footer_contact:"支持",
        consent_text:"我们使用 Cookie 改善体验并记住偏好。",consent_btn:"同意",
        placeholder_task:"例如：判断句子情感，仅输出 POS 或 NEG。",
        placeholder_examples:"POS || I love this!\nNEG || This is terrible."},
    es:{language:"Español",processing:"Procesando...",success_message:"¡El mejor Prompt ha sido actualizado!"},fr:{language:"Français",processing:"Traitement...",success_message:"Le meilleur Prompt a été mis à jour !"},ja:{language:"日本語",processing:"処理中...",success_message:"ベストプロンプトが更新されました！"},ko:{language:"한국어",processing:"처리 중...",success_message:"최적의 프롬프트가 업데이트되었습니다!"},ar:{language:"العربية",processing:"جاري المعالجة...",success_message:"تم تحديث أفضل Prompt!"},pt:{language:"Português",processing:"Processando...",success_message:"O melhor Prompt foi atualizado!"},hi:{language:"हिन्दी",processing:"प्रोसेसिंग...",success_message:"सर्वोत्तम प्रॉम्प्ट अपडेट हो गया!"}
  };
  const LANG_OPTIONS=[["en","English"],["zh","中文"],["es","Español"],["fr","Français"],["ja","日本語"],["ko","한국어"],["ar","العربية"],["pt","Português"],["hi","हिन्दी"]];
  function $(s){return document.querySelector(s)} function $all(s){return Array.from(document.querySelectorAll(s))}
  function applyTheme(theme){document.documentElement.setAttribute("data-theme", theme==="auto"?(prefersDark.matches?"dark":"light"):theme)}
  function i18nApply(lang){const d=translations[lang]||translations.en;$all("[data-i18n]").forEach(el=>{const k=el.getAttribute("data-i18n");if(d[k])el.textContent=d[k];});
    const task=$("#task"), ex=$("#examples"); if(task) task.placeholder=d.placeholder_task||task.placeholder; if(ex && d.placeholder_examples) ex.value=d.placeholder_examples;}
  function initHeader(){const langSel=$("#langSelect"); if(langSel && !langSel.dataset.bound){langSel.innerHTML=LANG_OPTIONS.map(([v,t])=>`<option value="${v}">${t}</option>`).join("");
    const saved=localStorage.getItem(LANG_KEY)||"en"; langSel.value=saved; i18nApply(saved); langSel.addEventListener("change",()=>{const v=langSel.value;localStorage.setItem(LANG_KEY,v);i18nApply(v)}); langSel.dataset.bound="1";}
    const themeSel=$("#themeSelect"); if(themeSel && !themeSel.dataset.bound){const saved=localStorage.getItem(THEME_KEY)||"auto"; themeSel.value=saved; applyTheme(saved);
      themeSel.addEventListener("change",()=>{const v=themeSel.value;localStorage.setItem(THEME_KEY,v);applyTheme(v)}); prefersDark.addEventListener("change",()=>{if((localStorage.getItem(THEME_KEY)||"auto")==="auto")applyTheme("auto")}); themeSel.dataset.bound="1";}}
  function consentBanner(){if(localStorage.getItem("promptly.consent"))return; const b=document.createElement("div"); b.className="banner";
    const d=translations[localStorage.getItem(LANG_KEY)||"en"]||translations.en; b.innerHTML=`<span data-i18n="consent_text">${d.consent_text}</span><button class="btn" id="consentBtn" data-i18n="consent_btn">${d.consent_btn}</button>`;
    document.body.appendChild(b); document.getElementById("consentBtn").addEventListener("click",()=>{localStorage.setItem("promptly.consent","1"); b.remove();});}
  // Canvas charts
  function drawLine(c,series,col="--accent"){const ctx=c.getContext("2d");const w=c.width=c.clientWidth,h=c.height=c.clientHeight;ctx.clearRect(0,0,w,h);
    const pad=24;const xs=series.map((_,i)=>pad+i*((w-2*pad)/Math.max(series.length-1,1)));const min=Math.min(...series,0),max=Math.max(...series,1);
    const ys=series.map(v=>h-pad-((v-min)/(max-min||1))*(h-2*pad)); ctx.lineWidth=2; ctx.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue(col)||"#06b6d4";
    ctx.beginPath(); xs.forEach((x,i)=>{const y=ys[i]; i?ctx.lineTo(x,y):ctx.moveTo(x,y)}); ctx.stroke();}
  function drawBars(c,series,col="--primary"){const ctx=c.getContext("2d");const w=c.width=c.clientWidth,h=c.height=c.clientHeight;ctx.clearRect(0,0,w,h);
    const pad=24;const bw=(w-2*pad)/series.length*0.7;const max=Math.max(...series,1);
    series.forEach((v,i)=>{const x=pad+i*((w-2*pad)/series.length)+((w-2*pad)/series.length-bw)/2;const bh=(v/max)*(h-2*pad);
      ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue(col)||"#7c3aed";ctx.fillRect(x,h-pad-bh,bw,bh);});}
  function drawPie(c,vals,cols=["--ok","--err"]){const ctx=c.getContext("2d");const w=c.width=c.clientWidth,h=c.height=c.clientHeight;ctx.clearRect(0,0,w,h);
    const r=Math.min(w,h)/2-10,cx=w/2,cy=h/2,sum=vals.reduce((a,b)=>a+b,0)||1;let a=-Math.PI/2;vals.forEach((v,i)=>{const col=getComputedStyle(document.documentElement).getPropertyValue(cols[i]||"--accent")||"#06b6d4";
      const seg=(v/sum)*Math.PI*2;ctx.beginPath();ctx.moveTo(cx,cy);ctx.fillStyle=col;ctx.arc(cx,cy,r,a,a+seg);ctx.closePath();ctx.fill();a+=seg;});}
  function drawGauge(c,p){const ctx=c.getContext("2d");const w=c.width=c.clientWidth,h=c.height=c.clientHeight;ctx.clearRect(0,0,w,h);
    const cx=w/2,cy=h*0.9,r=Math.min(w,h)*0.75,start=Math.PI,end=2*Math.PI;ctx.lineWidth=14;ctx.strokeStyle="#333a";ctx.beginPath();ctx.arc(cx,cy,r*0.5,start,end);ctx.stroke();
    ctx.strokeStyle=getComputedStyle(document.documentElement).getPropertyValue("--accent")||"#06b6d4";ctx.beginPath();ctx.arc(cx,cy,r*0.5,start,start+(end-start)*Math.max(0,Math.min(1,p)));ctx.stroke();
    ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue("--text")||"#eaf0fb";ctx.font="bold 24px Inter, system-ui";ctx.textAlign="center";ctx.fillText(Math.round(p*100)+"%",cx,cy-10);}
  const runIdParam = new URLSearchParams(window.location.search).get("runId");
  function getRunUrl() {
    return runIdParam ? `/api/runs/${runIdParam}` : "/api/runs/latest";
  }
  function formatPercent(value) {
    return value == null ? "—" : `${(value * 100).toFixed(1)}%`;
  }
  function formatNumber(value) {
    return value == null ? "—" : new Intl.NumberFormat().format(value);
  }
  function renderMetrics(metrics = {}) {
    const valAcc = document.getElementById("valAcc");
    const valF1 = document.getElementById("valF1");
    const valPass = document.getElementById("valPass");
    const valCost = document.getElementById("valCost");
    const valProg = document.getElementById("valProg");
    if (valAcc) valAcc.textContent = formatPercent(metrics.accuracy);
    if (valF1) valF1.textContent = metrics.f1 ? metrics.f1.toFixed(2) : "—";
    if (valPass) valPass.textContent = formatPercent(metrics.pass_rate ?? metrics.passRate);
    if (valCost) valCost.textContent = formatNumber(metrics.token_cost ?? metrics.tokenCost);
    if (valProg) valProg.textContent = formatPercent((metrics.progress_pct ?? metrics.progressPct) / 100);
    const delta = document.getElementById("deltaAcc");
    if (delta) delta.textContent = "";
    renderCharts(metrics);
  }
  function renderCharts(metrics = {}) {
    const progress = Math.max(0, Math.min(1, (metrics.progress_pct ?? metrics.progressPct ?? 0) / 100));
    const line = document.getElementById("lineGrowth");
    const bar = document.getElementById("barContrib");
    const pie = document.getElementById("piePass");
    const gauge = document.getElementById("gaugeProg");
    if (line) drawLine(line, [progress * 100, progress * 100, progress * 100]);
    if (bar) drawBars(bar, [progress * 100, progress * 100, progress * 100]);
    if (pie) drawPie(pie, [Math.round((metrics.pass_rate ?? metrics.passRate ?? 0) * 100), Math.round((1 - (metrics.pass_rate ?? metrics.passRate ?? 0)) * 100)]);
    if (gauge) drawGauge(gauge, progress);
  }
  async function fetchLatestRun() {
    try {
      const res = await fetch(getRunUrl());
      return await res.json();
    } catch (err) {
      console.error("[promptly] fetchLatestRun error", err);
      return null;
    }
  }
  function formatBestPrompt(rawOutput) {
    if (!rawOutput) return "";
    if (typeof rawOutput === "string") return rawOutput;
    try {
      return JSON.stringify(rawOutput, null, 2);
    } catch {
      return String(rawOutput);
    }
  }

  async function refreshMetrics() {
    const data = await fetchLatestRun();
    if (!data) {
      console.warn("[promptly] refreshMetrics: No data returned from fetchLatestRun()");
      return;
    }
    const run = data.run || null;
    if (!run) {
      console.warn("[promptly] refreshMetrics: No 'run' property in fetched data");
      return;
    }
    renderMetrics(run.metrics);
    const bestPromptEl = document.getElementById("bestPrompt");
    if (bestPromptEl) {
      bestPromptEl.value = formatBestPrompt(run.raw_output);
    }
  }
  // Expose refreshMetrics globally so other scripts can call it
  window.promptlyRefreshMetrics = refreshMetrics;
  // Expose function to get localized text for cross-script access
  window.promptlyGetText = function(key) {
    const lang = localStorage.getItem(LANG_KEY) || "en";
    const dict = translations[lang] || translations.en;
    return dict[key] || translations.en[key] || key;
  };

  document.addEventListener("DOMContentLoaded", () => {
    const themeSel = document.getElementById("themeSelect");
    const langSel = document.getElementById("langSelect");
    if (langSel) {
      langSel.innerHTML = LANG_OPTIONS.map(([v, t]) => `<option value="${v}">${t}</option>`).join("");
      const saved = localStorage.getItem(LANG_KEY) || "en";
      langSel.value = saved;
      i18nApply(saved);
      langSel.addEventListener("change", () => {
        const v = langSel.value;
        localStorage.setItem(LANG_KEY, v);
        i18nApply(v);
      });
    }
    if (themeSel) {
      const saved = localStorage.getItem(THEME_KEY) || "auto";
      themeSel.value = saved;
      applyTheme(saved);
      themeSel.addEventListener("change", () => {
        const v = themeSel.value;
        localStorage.setItem(THEME_KEY, v);
        applyTheme(v);
      });
      prefersDark.addEventListener("change", () => {
        if ((localStorage.getItem(THEME_KEY) || "auto") === "auto") {
          applyTheme("auto");
        }
      });
    }
    consentBanner();
    // Note: runBtn click handler is now in index.html to coordinate with animation
    refreshMetrics();
    const ro = new ResizeObserver(() => renderCharts());
    ["lineGrowth", "barContrib", "piePass", "gaugeProg"].forEach(id => {
      const c = document.getElementById(id);
      if (c) ro.observe(c);
    });
  });
})();
