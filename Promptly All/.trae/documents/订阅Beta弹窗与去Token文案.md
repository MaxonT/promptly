## 目标
- 去掉当前顶部 Beta Banner（用户觉得丑且像 warning）。
- 改为：用户点击 “Subscribe” 或 “Start Free Trial” 时，弹出一个轻量弹窗说明「Beta 版本，订阅/试用暂不可用，敬请期待」。
- 修复并加强 Beta 小角标：必须出现在左上角 Logo 的 “P” 图标旁（更像角标/贴纸），用户能明显看到。
- 删除前端所有面向用户的 “token/tokens/prompt_tokens/completion_tokens” 概念，统一改为“次数/用量/估算成本”等更友好的描述；你指出的 trial 文案要改成 counts。
- 顺手修复截图里 `subscription.usage_limits_value` 显示成 key 的问题（i18n 未命中时回退到英文拼接）。

## 需要修改的点（基于现状）
- 订阅页现在用 `GET /api/billing/plans` 可拿到 `subscriptionsAvailable`（Stripe 未配置时为 false）。
- 目前订阅页：按钮被“锁定 + toast + 顶部 Banner”。要改为“无 Banner + 点击弹窗”。
- Beta badge 现在是动态注入并作为行内元素追加到 logo 末尾，可能因为样式/布局/对比度导致用户没注意到；你想要的是贴在 P 图标旁的角标。

## 具体实施步骤

### 1) 订阅页：移除顶部 Beta Banner
- 删除 [subscription.html](file:///Users/yangming/Desktop/Github/Promptly-v0.6-CloudTest/Promptly-cloud-v0.6.8.3-fullstack/frontend/subscription.html) 中 `#betaBanner` 区块。
- 删除 [subscription.css](file:///Users/yangming/Desktop/Github/Promptly-v0.6-CloudTest/Promptly-cloud-v0.6.8.3-fullstack/frontend/subscription.css) 中 `.beta-banner*` 相关样式。

### 2) 新增 Beta 弹窗（只在点击时出现）
- 在 [subscription.html](file:///Users/yangming/Desktop/Github/Promptly-v0.6-CloudTest/Promptly-cloud-v0.6.8.3-fullstack/frontend/subscription.html) 新增一个 `#betaModal`（结构参考现有 auth modal：遮罩 + 内容卡片 + 关闭按钮 + 一个“OK/知道了”按钮）。
- 在 [subscription.css](file:///Users/yangming/Desktop/Github/Promptly-v0.6-CloudTest/Promptly-cloud-v0.6.8.3-fullstack/frontend/subscription.css) 增加极简样式：不警告色，不用⚠️；浅色背景/边框、字号小。
- 在 [subscription.js](file:///Users/yangming/Desktop/Github/Promptly-v0.6-CloudTest/Promptly-cloud-v0.6.8.3-fullstack/frontend/subscription.js) 中：
  - 订阅按钮点击：如果 `subscriptionsAvailable === false`，直接 `showBetaModal()` 并 return（不走登录/checkout）。
  - Start Trial 点击：同样逻辑。
  - 删除/取消“锁定按钮 + scroll 解锁 + 5 秒淡出”等逻辑。

### 3) Beta badge：改成贴在左上角 P 图标旁的角标，并确保可见
- 调整 [betaBadge.js](file:///Users/yangming/Desktop/Github/Promptly-v0.6-CloudTest/Promptly-cloud-v0.6.8.3-fullstack/frontend/lib/betaBadge.js)：
  - 不再把 badge 当普通行内标签插在最后；改为把 logo 图标（img）包一层相对定位容器，然后把 badge 绝对定位到图标右上角（高度约为 logo 高度的 30%）。
- 调整 [style.css](file:///Users/yangming/Desktop/Github/Promptly-v0.6-CloudTest/Promptly-cloud-v0.6.8.3-fullstack/frontend/style.css)：
  - `.beta-badge` 改为角标样式（更小、更高对比度、带轻微边框）；
  - 桌面端贴在 icon 右上，移动端仍能不挤压布局。
- 保留“全站加载”的方式：继续从 [config.js](file:///Users/yangming/Desktop/Github/Promptly-v0.6-CloudTest/Promptly-cloud-v0.6.8.3-fullstack/frontend/config.js) 注入 betaBadge 脚本，但会把角标的可见性做强（即使背景较暗也看得见）。

### 4) 删除所有用户可见的 token 概念（统一换成 counts/usage）
- 重点修复你指出的 trial 文案：把“200K base tokens + 20K daily tokens”改成“次数/每日额度”表达。
  - 更新 `subscription.trial_description`（en/zh-CN）为：
    - EN：`No credit card required. Full access + daily usage limits included.`
    - ZH：`无需信用卡。完整功能开放，并含每日用量上限。`
- 全局替换用户可见的 token 相关文案（不改后端内部计费/ledger逻辑）：
  - `tokenCost/tokenCostDesc/token/tokenDesc/prompt_tokens/completion_tokens` 这些 i18n 文案改为“Estimated cost / Estimated usage”等不提 token 的说法。
  - 至少覆盖 en/zh-CN；其他语言文件按同样口径同步（避免切换语言又出现 token）。

### 5) 修复订阅页 i18n key 直接显示的问题
- 在 [subscription.js](file:///Users/yangming/Desktop/Github/Promptly-v0.6-CloudTest/Promptly-cloud-v0.6.8.3-fullstack/frontend/subscription.js) 里：
  - `window.i18n.t(...)` 如果返回值等于 key（例如 `subscription.usage_limits_value`），则回退到拼接字符串 `${promptDaily} ... · ${wizardDaily} ...`，避免用户看到 key。

## 验收方式
- 未配置 Stripe：点击 Subscribe / Start Free Trial 会弹 Beta 弹窗；页面上不再出现顶部 Banner；按钮本身不需要灰掉也不会“无反应”。
- 左上角 Logo（P 图标）旁明确可见 Beta 角标。
- 任意页面不再出现 “token/tokens/prompt_tokens/completion_tokens” 文案。
- 订阅页不再出现 `subscription.usage_limits_value` 这种 key 直接显示。

我先按以上步骤落地（涉及 subscription.html/subscription.js/subscription.css、betaBadge.js、style.css、locales/*.json、i18n/config.js 可选用于清缓存），完成后给你截图/关键链接定位。