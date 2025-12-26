# Subscription V2 Quick Reference

## 🎯 一句话总结

将订阅流程从"硬跳转假订阅"升级为"状态机驱动的验证闭环"，支持Auth Modal内联登录、幂等性保护、轮询验证和Analytics追踪。

---

## 📁 核心文件速查

| 文件 | 作用 | 关键API/导出 |
|------|------|-------------|
| **`frontend/lib/subscriptionStateMachine.js`** | 状态机FSM | `SubscriptionStateMachine`, `SubscriptionState` enum, `transitionTo()` |
| **`frontend/lib/analytics.js`** | 事件追踪 | `track(event, properties)`, `EVENTS` 常量 |
| **`frontend/subscription.js`** | 订阅页面主逻辑 | 集成状态机、Auth Modal、幂等性创建会话 |
| **`frontend/checkout-success.html`** | 支付确认页 | 轮询验证 `startVerification()` |
| **`backend/src/routes/billing.js`** | 计费API | `POST /checkout-session` (幂等), `GET /verify-session/:sessionId` |
| **`backend/src/routes/analytics.js`** | 分析API | `POST /track`, `GET /funnel` |
| **`backend/src/lib/errorInjector.js`** | 测试注入 | `shouldInjectError()`, `injectDelay()` |

---

## 🔀 状态机流程图

```
                        [用户点击Subscribe]
                               ↓
                          IDLE (初始)
                               ↓
                    CHECK_AUTH (检查登录)
                     ↙              ↘
            未登录                   已登录
              ↓                        ↓
      AUTH_MODAL                CREATING_CHECKOUT
   (内联登录/注册)            (创建Stripe会话+幂等)
              ↓                        ↓
       登录成功 → CREATING_CHECKOUT    ↓
                               ↓
                    CHECKOUT_REDIRECT
                   (重定向到Stripe)
                               ↓
                       [用户支付]
                               ↓
         返回 checkout-success.html?session_id=xxx
                               ↓
                    CONFIRMING_PAYMENT
              (轮询 /verify-session 验证)
                               ↓
                    ┌──────────┼──────────┐
                    ↓          ↓          ↓
              completed    pending    expired
                    ↓          ↓          ↓
               ACTIVATED    继续轮询    ERROR
              (显示成功)   (最多30次)  (显示错误)
```

---

## 🛠️ API Endpoints

### 新增

| Method | Endpoint | 功能 | 重要参数 |
|--------|----------|------|---------|
| `GET` | `/api/billing/verify-session/:sessionId` | 验证Checkout会话状态 | sessionId (URL参数) |
| `POST` | `/api/analytics/track` | 记录事件 | `{ event, userId, sessionId, properties }` |
| `GET` | `/api/analytics/funnel` | 获取转化漏斗指标 | 无 |

### 修改

| Endpoint | 新增功能 |
|----------|---------|
| `POST /api/billing/checkout-session` | • 幂等性保护 (1小时窗口)<br>• 接受 `idempotencyKey` 参数<br>• 保存到 `checkout_sessions` 表<br>• 错误注入支持 |

---

## 📊 Analytics Events (20+)

### 页面浏览
- `PAGE_VIEW_SUBSCRIPTION`

### Auth流程
- `AUTH_MODAL_OPENED`, `AUTH_MODAL_CLOSED`
- `AUTH_TAB_SWITCHED` (login/register)
- `AUTH_LOGIN_ATTEMPTED`, `AUTH_LOGIN_SUCCESS`, `AUTH_LOGIN_FAILED`
- `AUTH_REGISTER_ATTEMPTED`, `AUTH_REGISTER_SUCCESS`, `AUTH_REGISTER_FAILED`

### Checkout流程
- `SUBSCRIBE_CLICKED`
- `CHECKOUT_SESSION_CREATING`, `CHECKOUT_SESSION_CREATED`, `CHECKOUT_SESSION_FAILED`
- `CHECKOUT_FLOW_RECOVERED`
- `CHECKOUT_CANCELED`

### 支付验证
- `CHECKOUT_SUCCESS_LOADED`
- `CHECKOUT_SUCCESS_VERIFIED`
- `CHECKOUT_SUCCESS_ERROR`

### 其他
- `PRICING_TOGGLE_CLICKED`
- `TRIAL_START_CLICKED`, `TRIAL_STARTED`, `TRIAL_START_FAILED`
- `BILLING_PORTAL_OPENED`
- `STATE_CHANGE` (状态机每次转换)

---

## 🗄️ Database Schema

### `checkout_sessions` (新增)
```sql
CREATE TABLE checkout_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  stripe_session_id TEXT NOT NULL UNIQUE,  -- Stripe返回的session_id
  session_url TEXT NOT NULL,               -- Stripe Checkout URL
  plan TEXT NOT NULL,                      -- 'monthly' | 'yearly'
  status TEXT DEFAULT 'pending',           -- 'pending' | 'completed' | 'expired'
  idempotency_key TEXT,                    -- 幂等性密钥
  created_at TEXT NOT NULL,
  completed_at TEXT
);
```

### `analytics_events` (新增)
```sql
CREATE TABLE analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event TEXT NOT NULL,
  user_id TEXT,
  session_id TEXT,
  properties TEXT,  -- JSON字符串
  created_at TEXT NOT NULL
);
```

---

## 🧪 测试场景速查

### 1. 未登录用户订阅
```
访问subscription.html → 点击Subscribe 
→ Auth Modal弹出 → 填写注册表单 
→ 注册成功 → Modal自动关闭 
→ 自动创建Checkout → 跳转Stripe
```

### 2. 已登录用户订阅
```
访问subscription.html → 点击Subscribe 
→ 直接创建Checkout → 跳转Stripe
```

### 3. 幂等性测试
```
创建会话A → 不跳转Stripe → 再次点击Subscribe 
→ 应返回相同session_id (reused: true)
```

### 4. 验证轮询
```
完成Stripe支付 → 返回checkout-success.html 
→ 显示Spinner+进度条 → 每2秒调用verify-session 
→ payment_status=paid → 显示Success+Confetti
```

### 5. 中断恢复
```
创建会话 → 刷新页面 
→ Console日志 "Recovering interrupted flow" 
→ 状态机从sessionStorage恢复
```

### 6. 错误注入
```bash
export ENABLE_ERROR_INJECTION=true
npm run dev
# 30%概率checkout失败、20%概率验证失败
```

---

## 🐛 常见问题排查

### Q1: Auth Modal不显示
**检查:**
- `subscription.html` 是否包含 `<div id="authModal">`
- `subscription.css` 是否包含 `.auth-modal` 样式
- Browser Console是否有JS错误

### Q2: 验证一直Pending
**检查:**
- Stripe Webhook是否正常 (查看 `stripe_events` 表)
- `/api/billing/verify-session/:sessionId` 返回什么状态
- Stripe Dashboard中session的payment_status

### Q3: Analytics事件不记录
**检查:**
- `analytics_events` 表是否存在 (运行migration)
- `/api/analytics/track` 是否返回200
- Browser Network面板是否有CORS错误

### Q4: 幂等性不生效
**检查:**
- `checkout_sessions` 表是否有记录
- `idempotencyKey` 格式: `checkout_{userId}_{plan}_{hourTimestamp}`
- 是否在1小时窗口内 (`created_at > datetime('now', '-1 hour')`)

### Q5: checkout-success页面白屏
**检查:**
- URL是否包含 `?session_id=xxx`
- Browser Console是否有 "No session ID provided" 错误
- `localStorage.getItem('promptly.token')` 是否存在

---

## 🚀 快速启动

```bash
# 1. 运行迁移
cd backend
node migrations/002_checkout_sessions.js up

# 2. 启动后端
npm run dev

# 3. 访问前端
open http://localhost:8080/subscription.html

# 4. 测试订阅流程
# - 点击Subscribe按钮
# - 观察Auth Modal弹出
# - 完成登录/注册
# - 自动跳转Stripe

# 5. 查看Analytics
sqlite3 data/promptly.db "SELECT * FROM analytics_events ORDER BY created_at DESC LIMIT 10;"
```

---

## 📦 版本要求

- Node.js >= 18
- SQLite3 (better-sqlite3)
- Stripe API >= 2023-10-16
- Modern Browser (支持 `sendBeacon`, `sessionStorage`)

---

## 🔗 相关文档

- **完整实现报告:** `SUBSCRIPTION_V2_MVP_IMPLEMENTATION.md`
- **工程规范原文:** (Opus 4.5 Super Engineer Prompt)
- **Stripe API文档:** https://docs.stripe.com/api/checkout/sessions
- **原始订阅PRD:** `PRD — Promptly Subscriptions v2`

---

## 📞 Support

遇到问题？检查这些文件的Console输出：
- Frontend: Browser DevTools Console
- Backend: Terminal stdout (`npm run dev`)
- Database: `sqlite3 data/promptly.db`

---

**Version:** 0.6.11.0 | **Last Updated:** 2025-01-XX
