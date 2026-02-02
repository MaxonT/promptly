## 需求总结
- 订阅功能目前未接 Stripe：用户进入 Subscription 页面时要明确看到“订阅暂不可用（Beta）/敬请期待”的提示，避免“点了没反应”。
- 在 Logo 旁边显示一个更小的 Beta badge（尽量小、低侵入）。
- 订阅按钮的交互：提示必须先出现；按钮默认不可用；用户滚动越过提示或点“Learn more”后，才允许进入下一步（但 Stripe 未配置时仍保持不可订阅）。
- 保持简洁、可访问（aria-label）、移动端适配。

## 现状确认（为什么现在会像“没反应”）
- 后端在 Stripe 未配置时会对 `POST /api/billing/checkout-session` 返回 503，并带 `error: "Stripe not configured"`（[billing.js](file:///Users/yangming/Desktop/Github/Promptly-v0.6-CloudTest/Promptly-cloud-v0.6.8.3-fullstack/backend/src/routes/billing.js#L171-L179)）。
- 前端订阅页会捕获错误并 toast，但因为页面没有“预提示/显眼状态”，用户仍可能觉得按钮无效或不理解原因（[subscription.js](file:///Users/yangming/Desktop/Github/Promptly-v0.6-CloudTest/Promptly-cloud-v0.6.8.3-fullstack/frontend/subscription.js#L473-L541)）。

## 核心文案（≤12词/尽量短）
- {messageText}（中文建议）：`⚠️ Beta中：订阅暂不可用，敬请期待！`
- {messageText}（英文备选）：`⚠️ Beta: subscriptions not ready. Stay tuned!`
- {badgeEmoji}：`β` 或 `BETA`（更小更干净，也符合“尽量写小一点”）

## 实现方案（会改哪些地方）

### 1）后端：暴露“Stripe 是否配置”给前端（让页面可在点击前就判断）
- 在 `GET /api/billing/plans` 的返回体新增字段：
  - `stripeConfigured: boolean`（由 `isStripeConfigured()` 得到）
  - 可选：`subscriptionsAvailable: FEATURES.subscriptionsEnabled && stripeConfigured`
- 这样 subscription 页面无需等用户点按钮才知道不可用。

### 2）前端：Subscription 页面顶部 Beta Banner（非阻塞）
- 在 [subscription.html](file:///Users/yangming/Desktop/Github/Promptly-v0.6-CloudTest/Promptly-cloud-v0.6.8.3-fullstack/frontend/subscription.html) 的 Hero 或 Status/Trial banner 之后，插入一个小 Banner 区块：
  - 显示 {messageText}
  - 右侧提供 `Learn more`（可折叠详情或跳到 FAQ 锚点）
  - aria：`role="status"` / `aria-live="polite"`

### 3）前端：订阅按钮禁用与解锁规则
- 在 [subscription.js](file:///Users/yangming/Desktop/Github/Promptly-v0.6-CloudTest/Promptly-cloud-v0.6.8.3-fullstack/frontend/subscription.js) 初始化时：
  1. 先请求 `GET /api/billing/plans` 获取 `stripeConfigured` / `subscriptionsAvailable`
  2. 若不可用：
     - 所有 `.subscribe-btn[data-plan="monthly"|"yearly"]` 默认 `disabled`
     - 按钮文案可改为 `Coming soon`（或保持 Subscribe，但点击时 toast）
     - 任何点击都 toast：`⚠️ Beta中：订阅暂不可用，敬请期待！`
  3. 若未来可用：
     - 仍先保持 disabled
     - 当用户“滚动超过 banner”或点 `Learn more` 后，才 enable（满足你的交互要求）

### 4）Banner 自动淡出（满足 5 秒 fade）
- 监听 scroll：当用户滚动越过 banner 的底部后触发一次 `fade-out` class
- 5 秒后将 banner `display:none` 或 `height:0`（不遮挡 UI）

### 5）Logo 旁 Beta badge（更小）
- 做一个小的通用注入脚本（例如新增 `frontend/lib/betaBadge.js`）：
  - 自动查找 `.nav-logo`（subscription/account 等）与 `.brand-logo`（index/terms/privacy/cookies/settings 等）
  - 在 logo 旁追加一个 `span.beta-badge`，并带 aria-label：`Beta version – subscription disabled`
- 样式规则：
  - badge 高度约为 logo 高度的 ~30%（用 `font-size: 0.65em` 或基于容器缩放）
  - 桌面端在 logo 右侧；移动端换行或放到 logo 下方

### 6）i18n（可选但推荐）
- 为 Banner 文案与 Badge 文案加 i18n key（en/zh-CN），避免硬编码。

## 验收清单
- 进入 subscription 页面：Banner 立即可见，且不遮挡内容。
- Stripe 未配置时：月付/年付按钮明确不可用（disabled + 文案/提示），点击也会弹出“Beta中/敬请期待”。
- Stripe 配置后：用户滚动越过 banner 或点 Learn more 后按钮才可点。
- Logo 旁始终有小 Beta badge（尺寸小、低干扰、移动端不挤压）。

如果你确认这个方案，我会按上述步骤依次落地（后端 plans 增字段 → 前端 banner+按钮 gating → 通用 beta badge 注入+样式 → i18n/移动端细节 → 页面回归）。