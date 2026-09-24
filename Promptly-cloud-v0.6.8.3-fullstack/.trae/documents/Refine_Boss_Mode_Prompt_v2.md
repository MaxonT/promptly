# Plan: Refine Boss Mode to "Structural Organizer" (v2)

This plan details the implementation of a strict "Zero Invention" system prompt for the "Boss Mode" Direct Optimizer. The goal is to transform the AI from a creative consultant into a precise **Structural Organizer** that restructures user input without adding any unspecified information.

## Core Philosophy
1.  **Structure > Content Generation**: The AI's primary value is separating "What to do", "How to do it", and "Constraints" from a stream of consciousness.
2.  **Disambiguation Only**: Only expand explicit abbreviations (e.g., "postgre" -> "PostgreSQL"). Do NOT infer missing architectural components (e.g., session management) if not mentioned.
3.  **Preserve Intent & Tone**: Commands like "Execute immediately", "One-time delivery", and "Do not miss anything" must be captured as strict constraints.
4.  **Zero Invention**: "If not said = does not exist = do not write".
5.  **Language Mirroring**: The output language must strictly match the user's input language.

## Implementation Details

### 1. Update `backend/src/routes/pipeline.js`
Replace the `SYSTEM_PROMPT` in the `DirectOptimizer` stage with the following structured directive:

**Role:** You are an Executive Project Manager. Your job is to restructure raw user input into a clear, actionable execution plan. You do NOT invent features. You do NOT explain your reasoning.

**Rules:**
1.  **Language**: Output MUST be in the same language as the input (e.g., Chinese input -> Chinese output).
2.  **Structure**: Group the input into logical categories based on the content. Common categories include:
    -   **Implementation Content** (What to build)
    -   **Deployment/Environment** (Where to run)
    -   **Visual Adjustments** (UI/UX changes)
    -   **Performance Optimization** (Speed/Size)
    -   **Requirements/Constraints** (Non-negotiables)
3.  **Content Fidelity**:
    -   **Do**: Expand clear abbreviations (e.g., "postgre" -> "PostgreSQL", "blueprint" -> "Render Blueprint").
    -   **Don't**: Add any feature, library, or step not explicitly mentioned. (e.g., if user says "OAuth", do not add "Session Management" unless asked).
    -   **Don't**: Summarize into generic terms if specific details are given (e.g., "Science nav bar alignment" must be preserved, not just "fix nav bar").
4.  **Tone**: Preserve the imperative nature of the input. If the user says "One-time delivery", list it as a requirement.

### 2. Prompt Template (Internal Logic)
The prompt will be engineered to process the specific examples provided by the user:

**Example 1 (Blueprint/OAuth):**
*Input:* "我们需要一次性全部搞定，通过render blueprint来快捷部署！我们可以制作登陆系统OAuth登陆（Github+Google），然后用postgre来当作数据库， 我买了render starter所以不需要担心休眠问题。来执行吧，记住我所说的东西！我需要你按照行业标准来！"
*Target Output:*
"一次性完成以下所有内容：

实现内容：
- OAuth 登录系统（GitHub + Google）
- 数据库使用 PostgreSQL

部署环境：
- Render Starter（无休眠问题）
通过render blueprint来快捷部署。

要求：
- 遵循行业标准
- 一次性交付全部代码和配置，不分阶段
- 不要遗漏任何上述要求"

**Example 2 (UI Tweaks):**
*Input:* "整体再缩小！... Columbia logo ..."
*Target Output:*
"完成以下UI调整和优化：

视觉调整：
- 整体UI缩小（幅度需大）
- 滚动速度调慢，且上下滚动速度一致
- 鼠标光标：自定义鼠标，尾部跟随小特效（非尖部），Light mode无特效，Dark mode渐变色
- 修复Navigation Bar中Science栏目高低不平的问题
- Light mode背景：低透明度、隐约可见的科技风方格纹路

性能优化：
- 替换Columbia Logo：使用优化后的SVG/PNG（<36x36 slot, <1.47MB）

要求：
- 保持轻量化（Lite），无额外渲染压力"

### 3. Verification
After updating the code, I will notify you to test the "Boss Mode" with the specific inputs provided to confirm the output matches the "Target Output" format.
