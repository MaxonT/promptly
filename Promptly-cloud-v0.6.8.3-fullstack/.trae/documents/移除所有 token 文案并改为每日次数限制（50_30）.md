## 1 句复述

* 把所有用户可见的“token”字样彻底移除，并把订阅与账户里展示/执行的用量规则改成：每天 50 次 Prompt 优化、每天 30 次问题向导（按月/按年同一口径），同时全程保留 “No credit card required”。

* Free plan保持8次prompts optimziation, 5次question wizards per day!

## 输入 / 输出

* 输入：现有前端页面（订阅页/首页 banner/账户页/设置页）、现有后端订阅与限制接口。

* 输出：一份可直接给设计与开发落地的“文案+UI 字段规范”，以及一份“前后端改动清单（具体文件落点）”。

## 成功判据（验收标准）

* UI 文案：前端所有用户可见区域搜索不到 `token/tokens`。

* 订阅页：月付/年付都明确显示“每天 50 次 Prompt 优化 + 每天 30 次问题向导”，不再出现任何 token 相关描述。

* 账户/设置页：不再出现“Token Balance / Tokens Remaining”等字样；改为展示当天已用/上限，并说明每日重置。

* 后端：对 `monthly/yearly/trial` 计划强制执行 50/30 的每日次数限制；`billing/status` 返回的 limits 与实际限制一致；缺失入口也会被限制（尤其是问题向导的 next 步骤）。

* 体验承诺：所有相关位置都包含 “No credit card required”。

## 非目标（刻意不做）

* 不重构 LLM 计费/内部 token 账本逻辑（只保证 UI 不再展示 token 概念）。

* 不改无关页面与样式布局（仅替换文案与必要的展示字段）。

## Assumption

* “移除 token”指用户可见文案与 UI 字段，不要求彻底删除后端内部 token 账本（否则会牵涉到 LLM 计费与数据库结构大改）。

* “Question‑wizard sessions”以“创建会话”与“推进 next 步骤”都计入每日次数（避免绕过限制）。

***

# 规范稿（Copy + UI Spec，可直接实现）

## A 全局规则

* 禁止出现：token / tokens / token credits / token balance / token cost / daily tokens / base tokens / rollover tokens 等任何相关概念。

* 统一用语：

  * Prompt optimizations → “Prompt 优化”

  * Question‑wizard sessions → “问题向导”

  * Limit → “每日上限/每日可用次数”

  * Reset → “每日（UTC 00:00）重置”

* 必须保留承诺：所有涉及注册/试用/订阅决策的区域都要出现 “No credit card required”。

## B 订阅页（Subscription）

### B1 顶部状态条（替换 “Tokens Remaining”）

* 标题：`Usage limits` / 中文：`用量上限`

* 右侧摘要（示例）：

  * 英文：`50 prompt optimizations/day · 30 question‑wizard sessions/day`

  * 中文：`每天 50 次 Prompt 优化 · 每天 30 次问题向导`

### B2 试用 Banner（替换 “200K base ... + 20K daily ...”）

* 标题：`Start your 14‑day free trial`

* 副标题：`No credit card required. Full access to all features.`

* 补充一行（可选）：`Daily limits reset at UTC 00:00.` / 中文：`每日 UTC 00:00 重置。`

### B3 套餐卡片（Monthly / Annual）

* 保留：`Full access to all features`、`Priority support`、`Cancel anytime`、`Save $…/year` 等（不含 token 的条目）。

* 替换 token 条目为：

  * 英文：`50 prompt optimizations per day`、`30 question‑wizard sessions per day`

  * 中文：`每天 50 次 Prompt 优化`、`每天 30 次问题向导`

### B4 解释区（替换 “Understanding Token Credits”）

* 新标题：`Daily usage limits` / 中文：`每日用量说明`

* 3 张说明卡（示例文案）：

  1. `What counts as a Prompt optimization?` → `Each time you run an optimization counts as 1.`
  2. `What counts as a Question‑wizard session?` → `Starting or continuing a wizard flow counts toward the daily limit.`
  3. `When do limits reset?` → `Limits reset daily at UTC 00:00.`

## C 首页（Index）

### C1 KPI/提示（替换 “Token Cost”）

* 英文：`Estimated cost` 或 `Estimated usage`（避免出现 token）

* Tooltip：不要出现 “tokens used per request”，改为：`Average model usage per request (estimate).`

### C2 Plan Banner（替换 `${tokensFormatted} tokens ...`）

* Free/未订阅：

  * `No credit card required. Try all features.`

  * `Daily limits: 50 prompt optimizations · 30 question‑wizard sessions`

* 已订阅（月/年）：

  * `Daily limits: 50 prompt optimizations · 30 question‑wizard sessions`

## D 账户页 / 设置页（Account / Settings）

### D1 替换 “Token Balance” 卡片为 “Usage limits”

* 展示字段：

  * `Prompt optimizations today: X / 50`

  * `Question‑wizard today: Y / 30`

  * `Resets daily at UTC 00:00`

* 不再展示 “Daily Free / Monthly Allocation / Total Available / Trial Tokens” 等 token 相关字段。

## E 超限提示（前后端一致）

* Prompt 优化超限：`Daily limit reached: 50 Prompt optimizations per day.`

* 问题向导超限：`Daily limit reached: 30 Question‑wizard sessions per day.`

***

# 工程落地计划（只列改动点，不执行）

## 1) 前端需要改的地方（已定位到文件）

* 订阅页：替换所有 token 文案与 UI 区块

  * [subscription.html](file:///Users/yangming/Desktop/Github/Promptly-v0.6-CloudTest/Promptly-cloud-v0.6.8.3-fullstack/frontend/subscription.html)

  * [subscription.js](file:///Users/yangming/Desktop/Github/Promptly-v0.6-CloudTest/Promptly-cloud-v0.6.8.3-fullstack/frontend/subscription.js)

  * [subscription.css](file:///Users/yangming/Desktop/Github/Promptly-v0.6-CloudTest/Promptly-cloud-v0.6.8.3-fullstack/frontend/subscription.css)（只在必须隐藏/替换解释区时动，尽量不改样式结构）

* 首页 banner + KPI：替换 token 相关文案与模板

  * [index.html](file:///Users/yangming/Desktop/Github/Promptly-v0.6-CloudTest/Promptly-cloud-v0.6.8.3-fullstack/frontend/index.html)

* 账户页与设置页：替换 Token Balance 文案/字段

  * [account.html](file:///Users/yangming/Desktop/Github/Promptly-v0.6-CloudTest/Promptly-cloud-v0.6.8.3-fullstack/frontend/account.html)

  * [settings.html](file:///Users/yangming/Desktop/Github/Promptly-v0.6-CloudTest/Promptly-cloud-v0.6.8.3-fullstack/frontend/settings.html)

* i18n：集中移除 token 相关 key，新增 usage limits 相关 key

  * [en.json](file:///Users/yangming/Desktop/Github/Promptly-v0.6-CloudTest/Promptly-cloud-v0.6.8.3-fullstack/frontend/locales/en.json)

  * [zh-CN.json](file:///Users/yangming/Desktop/Github/Promptly-v0.6-CloudTest/Promptly-cloud-v0.6.8.3-fullstack/frontend/locales/zh-CN.json)

## 2) 后端需要改的地方（已定位到文件）

* 强制每日次数限制：把 `monthly/yearly/trial` 从 “无限制” 改为 50/30

  * [planLimits.js](file:///Users/yangming/Desktop/Github/Promptly-v0.6-CloudTest/Promptly-cloud-v0.6.8.3-fullstack/backend/src/lib/planLimits.js)

* 状态接口口径：`GET /api/billing/status` 的 `limits` 由“付费= null(无限)”改为返回 50/30，且与实际执行一致

  * [billing.js](file:///Users/yangming/Desktop/Github/Promptly-v0.6-CloudTest/Promptly-cloud-v0.6.8.3-fullstack/backend/src/routes/billing.js)

* 防绕过：问题向导的 `POST /api/question-sessions/next` 目前可能缺少 check/record，需要补齐

  * [questionSessions.js](file:///Users/yangming/Desktop/Github/Promptly-v0.6-CloudTest/Promptly-cloud-v0.6.8.3-fullstack/backend/src/routes/questionSessions.js)

* 订阅计划对外展示：`GET /api/billing/plans` 当前返回的 plan 字段含 token 相关信息；计划改为增加“每日次数字段”并让前端只展示这些

  * [subscriptionConfig.js](file:///Users/yangming/Desktop/Github/Promptly-v0.6-CloudTest/Promptly-cloud-v0.6.8.3-fullstack/backend/src/lib/subscriptionConfig.js)

## 3) 最快证伪的测试（Spec→Tests）

* 文案扫描：全仓（至少前端）搜索 `token|tokens` 结果为 0（用户可见区域）。

* 接口验证：登录后调用 `GET /api/billing/status`，月/年计划的 `limits` 明确返回 50/30。

* 行为验证：

  * 连续触发 Prompt 优化 51 次 → 第 51 次被拒绝，并返回“每日上限”提示。

  * 连续触发问题向导 31 次（含 next）→ 第 31 次被拒绝。

* UI 验证：订阅页/账户页/首页 banner 不再出现任何 token 字样，且 “No credit card required” 在相关区块可见。

***

# 风险点（只点出会先坏哪里）

* 前端目前依赖 `billing/status.tokens` 去渲染 “Tokens Remaining”；如果后端直接删字段会引发 JS 报错。计划是：先不删后端字段，只让前端不再展示 token。

如果你确认这份计划，我会按上述落点开始逐个文件改动并跑一遍扫描与接口/行为验证。
