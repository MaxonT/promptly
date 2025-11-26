
(function(){
  const THEME_KEY="promptly.theme", LANG_KEY="promptly.lang", CONSENT_KEY="promptly.consent";
  const prefersDark=window.matchMedia("(prefers-color-scheme: dark)");
  const translations={
    en:{nav_home:"Dashboard",nav_privacy:"Privacy",nav_terms:"Terms",nav_cookies:"Cookies",appearance:"System",auto:"System",light:"Light",dark:"Dark",language:"English",
        hero_title:"Promptly — Prompt Optimizer Studio",hero_subtitle:"Visualization-first workflow. See every gain, every cost, every version.",
        task_label:"Task",examples_label:"Examples (optional)",best_prompt:"Best Prompt",run_btn:"Run Optimization",
        kpi_accuracy:"Accuracy",kpi_f1:"F1",kpi_pass:"Pass Rate",kpi_cost:"Token Cost",kpi_prog:"Progress %",
        growth_chart:"Growth Over Iterations",contrib_chart:"Change Contribution",pass_pie:"Pass vs Fail (%)",gauge:"Progress Meter (%)",
        versions:"Prompt Versions",footer_rights:"No trackers. Preferences saved only after consent.",footer_contact:"Support",
        consent_text:"We use cookies to improve your experience and remember preferences.",consent_btn:"Accept",
        placeholder_task:"e.g., Classify sentiment of a sentence; output POS or NEG only.",
        placeholder_examples:"POS || I love this!\nNEG || This is terrible."},
    zh:{nav_home:"仪表盘",nav_privacy:"隐私政策",nav_terms:"服务条款",nav_cookies:"Cookie 政策",appearance:"系统",auto:"系统",light:"浅色",dark:"深色",language:"中文",
        hero_title:"Promptly — 提示优化工作室",hero_subtitle:"可视化优先：每次提升、每分成本、每个版本都一目了然。",
        task_label:"任务",examples_label:"示例（可选）",best_prompt:"最佳 Prompt",run_btn:"运行优化",
        kpi_accuracy:"准确率",kpi_f1:"F1",kpi_pass:"通过率",kpi_cost:"Token 成本",kpi_prog:"进度 %",
        growth_chart:"迭代增长曲线",contrib_chart:"改动贡献",pass_pie:"通过 vs 失败（%）",gauge:"进度仪表（%）",
        versions:"Prompt 版本",footer_rights:"无追踪；仅在同意后保存偏好。",footer_contact:"支持",
        consent_text:"我们使用 Cookie 改善体验并记住偏好。",consent_btn:"同意",
        placeholder_task:"例如：判断句子情感，仅输出 POS 或 NEG。",
        placeholder_examples:"POS || I love this!\nNEG || This is terrible."},
    es:{language:"Español"},fr:{language:"Français"},ja:{language:"日本語"},ko:{language:"한국어"},ar:{language:"العربية"},pt:{language:"Português"},hi:{language:"हिन्दी"}
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
  // Optimizer sim
  const state={iters:0,accuracy:0.62,f1:0.58,pass:0.55,cost:0,progress:0.0,history:[]};
  function rand(n=1){return Math.random()*n}
  function step(){state.iters++;const dAcc=(0.5+rand(1))*0.01,dF1=(0.4+rand(1))*0.01,dPass=(0.3+rand(1))*0.01,tokens=300+Math.floor(rand(500));
    state.accuracy=Math.min(0.98,state.accuracy+dAcc);state.f1=Math.min(0.97,state.f1+dF1);state.pass=Math.min(0.99,state.pass+dPass);
    state.cost+=tokens;state.progress=Math.min(1,state.progress+0.06+rand(0.06));const v="v"+String(state.iters).padStart(3,"0");const p=`[${v}] Use role+steps+checks. Tighten constraints. Cite fail-cases.`;state.history.unshift({ver:v,prompt:p,dAcc:dAcc*100});}
  function fmtPct(x){return (x*100).toFixed(1)+"%"} function fmtNum(x){return new Intl.NumberFormat().format(x)}
  function rKPIs(){document.getElementById("valAcc").textContent=fmtPct(state.accuracy);document.getElementById("valF1").textContent=fmtPct(state.f1);
    document.getElementById("valPass").textContent=fmtPct(state.pass);document.getElementById("valCost").textContent=fmtNum(state.cost);
    document.getElementById("valProg").textContent=fmtPct(state.progress);const d=state.history[0]?.dAcc||0;const k=document.getElementById("kAcc");
    k.classList.remove("up","down");k.classList.add(d>=0?"up":"down");document.getElementById("deltaAcc").textContent=(d>=0?"+":"")+d.toFixed(2)+"%";}
  function rCharts(){const g=document.getElementById("lineGrowth"),b=document.getElementById("barContrib"),p=document.getElementById("piePass"),ga=document.getElementById("gaugeProg");
    const seq=state.history.slice().reverse().map(h=>h.dAcc).reduce((acc,v)=>{acc.push((acc[acc.length-1]||state.accuracy*100-(v||0))+v);return acc},[]).map(x=>x||state.accuracy*100);
    drawLine(g, seq.length?seq:[state.accuracy*100]); drawBars(b, state.history.slice(0,8).map(h=>h.dAcc)); const pass=Math.round(state.pass*100),fail=100-pass; drawPie(p,[pass,fail]); drawGauge(ga,state.progress);}
  function rVersions(){const list=document.getElementById("verList");list.innerHTML="";state.history.forEach(h=>{const li=document.createElement("div");li.className="item";
      li.innerHTML=`<div><div><b>${h.ver}</b> <span class="badge">ΔAcc</span> <span class="delta-badge ${h.dAcc>=0?"delta-pos":"delta-neg"}">${(h.dAcc>=0?"+":"")+h.dAcc.toFixed(2)}%</span></div>
      <div style="color:var(--muted);font-size:12px;margin-top:4px">${h.prompt}</div></div>
      <button class="btn" onclick='document.getElementById("bestPrompt").value=${JSON.stringify(h.prompt)}'>Apply</button>`;list.appendChild(li);});}
  function onRun(){step();rKPIs();rCharts();rVersions();document.getElementById("bestPrompt").value=state.history[0].prompt;}
  document.addEventListener("DOMContentLoaded",()=>{ // init
    // header
    const themeSel=document.getElementById("themeSelect"), langSel=document.getElementById("langSelect");
    if(langSel){langSel.innerHTML=LANG_OPTIONS.map(([v,t])=>`<option value="${v}">${t}</option>`).join("");const saved=localStorage.getItem(LANG_KEY)||"en";langSel.value=saved;i18nApply(saved);langSel.addEventListener("change",()=>{const v=langSel.value;localStorage.setItem(LANG_KEY,v);i18nApply(v);});}
    if(themeSel){const saved=localStorage.getItem(THEME_KEY)||"auto";themeSel.value=saved;applyTheme(saved);themeSel.addEventListener("change",()=>{const v=themeSel.value;localStorage.setItem(THEME_KEY,v);applyTheme(v)});prefersDark.addEventListener("change",()=>{if((localStorage.getItem(THEME_KEY)||"auto")==="auto")applyTheme("auto")});}
    consentBanner();
    const run=document.getElementById("runBtn"); if(run) run.addEventListener("click", onRun);
    rKPIs(); rCharts(); rVersions();
    const ro=new ResizeObserver(()=>rCharts()); ["lineGrowth","barContrib","piePass","gaugeProg"].forEach(id=>{const c=document.getElementById(id); if(c) ro.observe(c);});
  });
})();
