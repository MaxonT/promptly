# Promptly "Boss Mode" 重构计划：全栈极简与测试驱动

## 1. 核心宗旨 (Core Manifesto)
响应用户对“绝对整理、绝对0生成、结果导向”的强烈需求，我们将采用 **测试驱动 (TDD)** 的方式，利用提供的 API Key 先在沙盒中打磨出完美的 Prompt，然后重构后端，并大幅简化前端展示。

**目标**：
1.  **绝对整理**: 只整理用户输入，绝不脑补。
2.  **结果导向**: 输出像老板的指令（Objective, Requirements, Deliverables）。
3.  **全模式统一**: Fast/Standard/Premium 共享同一极简架构。
4.  **体验连续性**: 保留 Pipeline 动画和 Log 实时展示，但简化结果呈现（删除冗余 Metrics/Charts）。

---

## 2. 详细测试用例 (Detailed Test Cases)

我们将使用以下 5 个用例进行严格测试。**特别是 Case 1，必须包含所有 UI 细节**。

### Case 1: Complex UI & Frontend Tweak (The "Pixel Perfect" Test)
**INPUT**:
> 整体再缩小！幅度大一点！滚动的速度慢一点！除此之外，上下滚动速度要一致！再除此之外，我们的鼠标cursor有点太花哨了，我要的是鼠标的尾部的小小的特效跟踪，不是鼠标的尖部的跟踪！除此之外，我要的是我们customed的鼠标，并且要分light/dark mode不同的鼠标dark mode可以变成渐变色的鼠标，light mode就不加任何东西。再除此之外，我们Science那个栏目，在navigation bar这里怎么有点高低不平啊？还有！light mode模式下我们的学术风格上，我想要来点定制的背景贴图（但是要计量透明一点，不透明度要低），有点隐隐约约的纹路，最好有点科技风格，比如特别小的方格式背景！还有，我们一定要记住，我们尽可能要lite轻量不能让用户电脑有渲染压力！还有“Replace oversized Columbia logo asset
>
> The trust marquee now loads assets/university-logos/columbia-university.svg for every landing-page visit, but that file is ~1.47 MB while it is rendered inside a 36×36 logo slot, so this single entry adds a large, unnecessary transfer to first-load performance (especially on mobile/slow networks) with no visible benefit. Please swap this to an optimized SVG/PNG variant before shipping the marquee.”

**SUCCESS CRITERIA**:
-   **Scroll**: Slower speed, consistent up/down speed.
-   **Cursor**:
    -   Trail effect at tail (not tip).
    -   Custom cursor assets.
    -   Dark mode: Gradient color.
    -   Light mode: No extra effects.
-   **Nav Bar**: Fix uneven alignment for "Science" item.
-   **Background (Light Mode)**:
    -   Custom texture (tech style, small grid).
    -   Low opacity (subtle).
-   **Performance**: Lite/lightweight, no rendering pressure.
-   **Asset Optimization**: Replace ~1.47MB Columbia logo with optimized SVG/PNG for 36x36 slot.
-   **Format**: Organized list, no "Introduction" or "Conclusion".

### Case 2: The Blueprint Test (Regression Guard)
**INPUT**:
> 我们需要一次性全部搞定，通过blueprint来快捷部署！我们可以制作OAuth登陆系统OAuth登陆（Github+Google），然后用postgre来当作数据库，我买了render starter所以不需要担心休眠问题。来执行吧，记住我所说的东西！我需要你按照行业标准来！

**SUCCESS CRITERIA**:
-   **Blueprint**: Term preserved.
-   **Tech Stack**: OAuth (Github+Google), Postgres (or PostgreSQL), Render Starter.
-   **Constraint**: "One-shot delivery" (一次性搞定).
-   **NO Invention**: No React, No Express, No JWT unless implied by standard OAuth (but better not to mention if not asked).

### Case 3: Short English Prompt
**INPUT**:
> Write me a Python script that scrapes Amazon product prices daily.

**SUCCESS CRITERIA**:
-   **Keywords**: Python, Scrape, Amazon, Product Prices, Daily.
-   **NO Invention**: No specific libraries (BeautifulSoup/Selenium) unless necessary for "Amazon" (but better to leave open).
-   **Length**: Very short (1-4 lines).

### Case 4: Detailed Prompt (Resignation Letter)
**INPUT**:
> Help me write a formal resignation letter to my manager John at TechCorp. I've been there 3 years. Keep it professional, express gratitude, and mention my last day is April 15th. No more than 200 words.

**SUCCESS CRITERIA**:
-   **Details**: John, TechCorp, 3 years, April 15th, <200 words.
-   **Tone**: Professional, grateful.
-   **NO Invention**: No career advice, no exit interview tips.

### Case 5: Vague/Directional Input
**INPUT**:
> 帮我写邮件

**SUCCESS CRITERIA**:
-   **Output**: Extremely short.
-   **Content**: "Write an email." (or asking for details).
-   **NO Invention**: Do NOT generate a template with placeholders like [Recipient Name].

---

## 3. 测试与迭代流程 (Testing & Iteration Process)

### 步骤 1: 准备测试脚本 `test_boss_mode.js`
-   使用 `anthropic` SDK。
-   配置 `ANTHROPIC_API_KEY` (使用用户提供的 key)。
-   定义 Initial System Prompt (Boss Mode v1)。

### 步骤 2: 执行迭代 (The Loop)
1.  **Run**: 执行脚本，跑通所有 5 个 Case。
2.  **Evaluate**: 对照 Success Criteria 逐项检查。
3.  **Refine Prompt**:
    -   针对 Case 1 强化 UI 细节提取。
    -   针对 Case 3/5 强化极简原则。
4.  **Repeat**: 直到 5 个 Case 全部完美通过。

---

## 4. 后端实施 (Backend Implementation)

### 步骤 3: 后端重构 (Backend Refactoring)
一旦 Prompt 锁定：
1.  **修改 `backend/src/routes/pipeline.js`**:
    -   **保留**: `sendEvent` (SSE), `stream` 逻辑 (为了动画和 Log)。
    -   **删除**: `Spec Builder`, `Critique`, `Refine`, `Evaluation` 逻辑。
    -   **实现**: `DirectOptimizer` (单次调用)，并在调用过程中发送伪造的 `stage-progress` 事件，以驱动前端动画。
        -   *Trick*: 发送 `stage: "optimizing"`，前端显示 "Optimizing Prompt..." 动画。
2.  **适配模式 (Model Configuration)**:
    -   `fast` -> **claude-3-haiku-20240307** (Haiku 4.5/Current).
    -   `standard` -> **claude-3-haiku-20240307** (Haiku 4.5/Current).
    -   `premium` -> **claude-3-5-sonnet-20240620** (Sonnet 4.6/Latest).
    *(注：因 Haiku 4.5/Sonnet 4.6 尚未正式发布，我们将使用当前可用的最新对应版本 Haiku/Sonnet 3.5，并在代码注释中标注为 Future Upgrade Path)*
3.  **清理**:
    -   删除 `test_boss_mode.js`。
    -   **彻底删除代码中的 API Key**。

---

## 5. 前端实施 (Frontend Implementation)

### 步骤 4: 前端清理与重构
1.  **Result View (结果页)**:
    -   **删除**: 5 个 Metrics 仪表盘 (Completeness, Clarity 等)。
    -   **删除**: 4 个 Radar Charts (雷达图)。
    -   **删除**: Glossary (术语表)。
    -   **保留**: 最终 Prompt 文本框 (Markdown 渲染)。
    -   **保留**: Pipeline 进度动画 (但阶段会变少，可能只有 "Analyzing" -> "Optimizing" -> "Done")。
    -   **保留**: Log Console (实时日志)。
2.  **User Guide**:
    -   **重写**: 从 "如何看懂复杂的 Spec" 变为 "如何使用 Boss Mode 下达指令"。
    -   强调：你只管说“要什么”，我们帮你整理“清晰的指令”。

---

## 6. 交付物 (Deliverables)
1.  **最终的 System Prompt**: 经过实战验证的“老板模式”提示词。
2.  **重构后的后端**: `pipeline.js` (极简、支持 SSE 动画)。
3.  **重构后的前端**: 干净、清爽、无冗余图表。
4.  **测试报告**: 包含 5 个 Case 的最终生成结果。
