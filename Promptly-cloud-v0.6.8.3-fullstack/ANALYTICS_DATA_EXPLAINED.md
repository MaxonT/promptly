# 📊 Promptly Analytics Dashboard 完整指标指南

> **为什么这些数据重要？每个指标背后的含义是什么？数据从哪里来？会不会更新？**

---

## 🎯 核心指标卡片（Stat Cards）

---

### **1️⃣ Total Users（总用户数）**

- **显示值**: 1,368
- **含义**: 平台上注册的所有用户的累积总数
- **数据来源**:
  ```sql
  SELECT COUNT(*) as total FROM analytics_users
  ```
- **作用**: 反映平台的整体用户规模
- **为什么重要**: 投资人和利益相关者最关心的核心数字，代表产品的市场渗透率
- **🔄 是否随模拟器更新**: 
  - ✅ **是的**！行为模拟器每次运行时会创建新用户（通过 `POST /api/analytics/dashboard/generate`），新用户会被插入 `analytics_users` 表
  - 当前状态：历史数据（2024-11-29 ~ 2025-01-30）由 Migration 生成，当前数据由模拟器持续生成

---

### **2️⃣ New Users (24h/7d/30d)（新增用户）**

- **显示值**: 例如 "8 (24h)", "8 (7d)", "8 (30d)"
- **含义**: 在特定时间窗口内新注册的用户数量
- **数据来源**:
  ```sql
  -- 24小时内新用户
  SELECT COUNT(*) FROM analytics_users
  WHERE created_at > datetime(?, '-1 day')
  
  -- 7天内新用户  
  SELECT COUNT(*) FROM analytics_users
  WHERE created_at > datetime(?, '-7 days')
  
  -- 30天内新用户
  SELECT COUNT(*) FROM analytics_users
  WHERE created_at > datetime(?, '-30 days')
  ```
- **作用**: 衡量产品的增长速度和获客能力
- **为什么重要**: 如果只看总数 1368，无法判断产品是否还在增长。这个指标证明产品在持续获取新用户
- **🔄 是否随模拟器更新**: 
  - ✅ **是的**！每当模拟器创建新用户，这些计数会自动更新
  - ⚠️ **当前问题**: 由于历史数据在 2025-01-30，当前日期是 2026-01-30，有约1年的空白期，所以 7d/30d 的数字可能较小

---

### **3️⃣ DAU（Daily Active Users - 日活跃用户）**

- **显示值**: 8
- **含义**: 今天有活动（创建会话）的独立用户数
- **数据来源**:
  ```sql
  -- 方法1: 从 sessions 表计算
  SELECT COUNT(DISTINCT user_id) as dau
  FROM analytics_sessions
  WHERE date(session_start) = ?  -- 最近日期
  
  -- 方法2: 从 daily 表直接读取
  SELECT unique_users FROM analytics_daily
  WHERE date = ?  -- 最近日期
  
  -- 最终取两者较大值
  const dau = Math.max(dauFromSessions, dauFromDaily);
  ```
- **作用**: 产品的日常使用热度，最能反映产品是否被真正使用
- **为什么重要**: 
  - DAU 是互联网产品最核心的健康指标
  - 如果 DAU 持续下降，说明用户在流失
  - 如果 DAU 稳定或增长，说明产品有粘性
- **🔄 是否随模拟器更新**: 
  - ✅ **是的**！模拟器每次运行会：
    1. 创建新的 `analytics_sessions` 记录
    2. 更新 `analytics_daily` 表的当天数据
  - 这个数字会随着模拟器运行实时变化

---

### **4️⃣ WAU（Weekly Active Users - 周活跃用户）**

- **显示值**: ~50（估算）
- **含义**: 过去7天内有活动的独立用户数
- **数据来源**:
  ```sql
  SELECT COUNT(DISTINCT user_id) as wau
  FROM analytics_sessions
  WHERE date(session_start) > date(?, '-7 days')
  ```
  如果 session 数据稀疏，使用估算:
  ```javascript
  // WAU ≈ 日均活跃用户 × 2.5（考虑有些用户多天回访）
  const estimatedWau = Math.round(avgDailyUsers * 2.5);
  ```
- **作用**: 衡量产品的短期用户粘性
- **为什么重要**: WAU 与 DAU 的比值可以看出用户的回访频率
- **🔄 是否随模拟器更新**: 
  - ✅ **是的**！只要模拟器持续运行，7天内会有新的 session 数据累积

---

### **5️⃣ MAU（Monthly Active Users - 月活跃用户）**

- **显示值**: ~150（估算）
- **含义**: 过去30天内有活动的独立用户数
- **数据来源**:
  ```sql
  SELECT COUNT(DISTINCT user_id) as mau
  FROM analytics_sessions
  WHERE date(session_start) > date(?, '-30 days')
  ```
  如果 session 数据稀疏，使用估算:
  ```javascript
  // MAU ≈ WAU × 3（一个月约4周，考虑重复）
  const estimatedMau = Math.round(estimatedWau * 3);
  ```
- **作用**: 衡量产品的长期用户基础
- **为什么重要**: MAU 是投资人最关注的指标之一，代表产品的"真实"用户规模
- **🔄 是否随模拟器更新**: 
  - ✅ **是的**！30天内的累积 session 数据会影响这个值

---

### **6️⃣ 🎯 Stickiness（用户粘性 = DAU/MAU）**

- **显示值**: ~5.3%（目标范围 5-15%）
- **含义**: 每100个月活用户中，平均有多少人每天都回来使用
- **计算公式**:
  ```javascript
  const dauMauRatio = (dau / mau) * 100;
  // 例如: (8 / 150) * 100 = 5.3%
  ```
- **数据来源**: 由 DAU 和 MAU 计算得出
- **作用**: 这是产品健康度的「金标准」指标
- **对标解读**:
  | Stickiness | 评价 | 产品状态 |
  |------------|------|----------|
  | < 5% | ❌ 很差 | 用户几乎不回来，产品可能有重大问题 |
  | 5-10% | ⚠️ 需改进 | 普通水平，有提升空间 |
  | 10-20% | ✅ 良好 | 健康的 SaaS 产品 |
  | 20-30% | 🎉 优秀 | 高粘性产品 |
  | > 30% | 🚀 卓越 | 类似社交/工具类高频产品 |
  
  **行业基准**:
  - Facebook: ~50%
  - Slack: ~30%
  - 普通 SaaS: 10-20%
  - Promptly 目标: 10-15%

- **为什么重要**: 
  - 高粘性 = 用户形成习惯，产品有长期价值
  - 低粘性 = 用户试用后离开，需要改进留存策略
- **🔄 是否随模拟器更新**: 
  - ✅ **是的**！因为 DAU 和 MAU 都会随模拟器更新，所以 Stickiness 也会动态变化
  - 如果模拟器持续运行，Stickiness 会逐渐趋于真实值

---

### **7️⃣ Bounce Rate（跳出率）**

- **显示值**: 12.5%
- **含义**: 只访问一个页面就离开的用户占比
- **数据来源**:
  ```sql
  SELECT AVG(bounce_rate) as avg
  FROM analytics_daily
  WHERE date > date(?, '-7 days')
  ```
  存储格式: 0.125 表示 12.5%，代码会自动转换:
  ```javascript
  if (avgBounceRate > 1) avgBounceRate = avgBounceRate / 100;
  const displayBounceRate = (avgBounceRate * 100).toFixed(1);
  ```
- **作用**: 衡量着陆页的质量和用户兴趣
- **对标解读**:
  | Bounce Rate | 评价 | 含义 |
  |-------------|------|------|
  | < 20% | 🎉 优秀 | 用户深入探索产品 |
  | 20-40% | ✅ 良好 | 正常水平 |
  | 40-60% | ⚠️ 需关注 | 可能有 UX 问题 |
  | > 60% | ❌ 问题 | 页面内容或体验有重大问题 |
- **为什么重要**: 
  - 高跳出率可能表示: 页面加载慢、内容不相关、UX 设计差
  - 低跳出率说明: 用户找到了需要的内容并继续探索
- **🔄 是否随模拟器更新**: 
  - ⚠️ **部分更新**。当前 bounce_rate 存储在 `analytics_daily` 表中，由 Migration 生成
  - 🔧 **可以增强**: 模拟器可以在生成 daily 数据时更新 bounce_rate 字段

---

### **8️⃣ Return Frequency（回访频率）**

- **显示值**: 3.5 天
- **含义**: 用户平均多少天回来使用一次
- **数据来源**:
  ```javascript
  // 当前是固定值，因为 analytics_behavior 表有 return_frequency_days 字段
  avgReturnFrequency: (3.5).toFixed(1)
  ```
  理想情况下应该从数据库计算:
  ```sql
  SELECT AVG(return_frequency_days) FROM analytics_behavior
  WHERE recorded_at > datetime(?, '-7 days')
  ```
- **作用**: 衡量用户的回访习惯
- **对标解读**:
  | 回访频率 | 评价 | 产品类型 |
  |----------|------|----------|
  | < 1天 | 🚀 超高频 | 社交/通讯类 |
  | 1-3天 | 🎉 高频 | 日常工具类 |
  | 3-7天 | ✅ 周活跃 | 工作类 SaaS |
  | 7-14天 | ⚠️ 双周用户 | 偶尔使用 |
  | > 14天 | ❌ 流失风险 | 需要召回策略 |
- **🔄 是否随模拟器更新**: 
  - ⚠️ **当前未更新**（固定值 3.5）
  - 🔧 **可以增强**: 让模拟器更新 `analytics_behavior.return_frequency_days`，然后从数据库动态计算

---

## 📈 图表数据

---

### **9️⃣ Growth Chart（用户活动增长图）**

**蓝线 - Daily Users（每日活跃用户）**
- **含义**: 每天有多少独立用户活跃
- **数据来源**:
  ```sql
  SELECT date, unique_users as users
  FROM analytics_daily
  ORDER BY date ASC
  ```
- **显示范围**: 根据时间筛选器（7d/14d/30d/全部）

**紫线 - Sessions（会话数）**
- **含义**: 每天创建了多少个访问会话
- **数据来源**:
  ```sql
  SELECT date, total_sessions as sessions
  FROM analytics_daily
  ORDER BY date ASC
  ```
- **为什么有两条线**: 
  - Users 显示「有多少人」在使用
  - Sessions 显示「使用了多少次」
  - 如果 Sessions >> Users，说明每个用户多次访问（高参与度）

- **🔄 是否随模拟器更新**: 
  - ✅ **是的**！模拟器每次运行会更新 `analytics_daily` 表
  - 图表数据通过 `GET /api/analytics/dashboard/timeseries?period=all` 获取

---

### **🔟 Cumulative Users Chart（累计用户增长图）**

- **含义**: 随时间累积的总用户数（S-curve 增长曲线）
- **数据来源**:
  ```sql
  SELECT date, cumulative_users as cumulativeUsers
  FROM analytics_daily
  ORDER BY date ASC
  ```
- **显示样式**: 一条从左下到右上的增长曲线
- **S-curve 解释**:
  ```
  用户增长曲线 (S-curve):
  
       1400 ─┼─────────────────────────────●─ 平台期(成熟)
             │                           ●
       1200 ─┼                        ●
             │                     ●
       1000 ─┼                  ●───────────── 快速增长期
             │                ●
        800 ─┼             ●
             │           ●
        600 ─┼        ●
             │      ●
        400 ─┼    ●
             │  ●─────────────────────────── 慢启动期
        200 ─┼●
             │
           0 ─┼──┬──┬──┬──┬──┬──┬──┬──┬──┬──
              Nov Dec Jan
               29  15  30
  ```
- **为什么重要**: 
  - 陡峭上升 = 产品在快速增长
  - 趋于平缓 = 接近市场饱和或需要新增长点
  - 下降 = 用户流失超过获取
- **🔄 是否随模拟器更新**: 
  - ✅ **是的**！`cumulative_users` 字段会随着新用户创建而增加

---

## 💼 参与度指标（Engagement Metrics）

这些指标来自用户会话中的行为数据，存储在 `analytics_behavior` 表中。

---

### **1️⃣1️⃣ Avg. Mouse Movements（平均鼠标移动）**

- **显示值**: 148.0 次/会话
- **含义**: 用户平均每个会话移动鼠标多少次
- **数据来源**:
  ```sql
  SELECT AVG(mouse_movements) as avgMouse
  FROM analytics_behavior
  WHERE recorded_at > datetime(?, '-7 days')
  ```
- **作用**: 高鼠标移动 = 用户在认真浏览页面，寻找信息
- **对标**:
  | 移动次数 | 评价 | 用户行为 |
  |----------|------|----------|
  | < 50 | 低 | 用户直接就知道要做什么 |
  | 50-150 | 中 | 正常使用，在页面上探索 |
  | > 150 | 高 | 用户在仔细查看所有内容 |
- **🔄 是否随模拟器更新**: 
  - ✅ **是的**！模拟器创建的 behavior 记录包含 mouse_movements 字段
  - 当前值来自历史数据生成时的随机范围

---

### **1️⃣2️⃣ Avg. Scrolls（平均滚动次数）**

- **显示值**: 19.3 次/会话
- **含义**: 用户平均每个会话滚动页面多少次
- **数据来源**:
  ```sql
  SELECT AVG(scrolls) as avgScrolls
  FROM analytics_behavior
  WHERE recorded_at > datetime(?, '-7 days')
  ```
- **作用**: 显示页面内容是否足够吸引用户往下看
- **对标**:
  | 滚动次数 | 评价 | 含义 |
  |----------|------|------|
  | < 5 | 低 | 页面很短或用户不感兴趣 |
  | 5-20 | 中 | 用户在看页面上的不同内容 |
  | > 20 | 高 | 用户在仔细查看大量信息 |
- **🔄 是否随模拟器更新**: 
  - ✅ **是的**！behavior 记录的 scrolls 字段会随新数据变化

---

### **1️⃣3️⃣ Avg. Clicks（平均点击次数）**

- **显示值**: 10.6 次/会话
- **含义**: 用户平均每个会话点击多少次（按钮、链接等）
- **数据来源**:
  ```sql
  SELECT AVG(clicks) as avgClicks
  FROM analytics_behavior
  WHERE recorded_at > datetime(?, '-7 days')
  ```
- **作用**: 点击数越多，说明用户在与界面互动
- **对标**:
  | 点击次数 | 评价 | 用户行为 |
  |----------|------|----------|
  | < 3 | 低 | 用户可能只是浏览没有操作 |
  | 3-15 | 中 | 用户在进行基本操作 |
  | > 15 | 高 | 用户在做多个操作或反复调整 |
- **🔄 是否随模拟器更新**: 
  - ✅ **是的**！

---

### **1️⃣4️⃣ Avg. Typing Events（平均输入事件）**

- **显示值**: 43.1 次/会话
- **含义**: 用户平均每个会话有多少次键盘输入
- **数据来源**:
  ```sql
  SELECT AVG(typing_events) as avgTyping
  FROM analytics_behavior
  WHERE recorded_at > datetime(?, '-7 days')
  ```
- **作用**: 高输入事件数说明用户在创建或编辑内容
- **对标**:
  | 输入次数 | 评价 | 用户行为 |
  |----------|------|----------|
  | < 10 | 低 | 用户只是浏览或选择现有选项 |
  | 10-50 | 中 | 用户在创建/编辑 prompts |
  | > 50 | 高 | 用户在大量输入内容 |
- **🔄 是否随模拟器更新**: 
  - ✅ **是的**！

---

## 🌍 地域分布（Timezone Distribution）

---

### **1️⃣5️⃣ Timezone Chart（时区分布）**

- **显示值**: 按时区分组的用户数量
- **当前 Top 5**:
  | 时区 | 用户数 | 占比 |
  |------|--------|------|
  | America/New_York | 230 | 17% |
  | America/Los_Angeles | 199 | 15% |
  | Europe/London | 162 | 12% |
  | America/Chicago | 141 | 10% |
  | Europe/Paris | 122 | 9% |

- **数据来源**:
  ```sql
  SELECT 
    timezone,
    COUNT(*) as count,
    COUNT(DISTINCT id) as uniqueEvents
  FROM analytics_users
  WHERE timezone IS NOT NULL
  GROUP BY timezone
  ORDER BY count DESC
  LIMIT 12
  ```
- **作用**: 
  - 了解用户地理分布
  - 优化服务器部署位置
  - 规划客服时间
  - 制定本地化策略
- **🔄 是否随模拟器更新**: 
  - ✅ **是的**！新用户会有 timezone 字段，分布会随着用户增长变化

---

## 🔗 数据流总结

```
┌─────────────────────────────────────────────────────────────────┐
│                    数据生成层                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   📅 Migration (历史数据)          🤖 行为模拟器 (实时数据)      │
│   ┌─────────────────────┐         ┌─────────────────────┐      │
│   │ 002_analytics.js    │         │ behavior-simulator  │      │
│   │ 生成 S-curve 数据    │         │ 每5分钟运行一次      │      │
│   │ 2024-11-29 ~        │         │ 生成当天数据         │      │
│   │ 2025-01-30          │         │                     │      │
│   └─────────┬───────────┘         └──────────┬──────────┘      │
│             │                                 │                 │
│             ▼                                 ▼                 │
│   ┌─────────────────────────────────────────────────────┐      │
│   │                 SQLite 数据库                        │      │
│   │                 ./data/app.db                       │      │
│   │  ┌──────────────┬──────────────┬──────────────┐    │      │
│   │  │analytics_    │analytics_    │analytics_    │    │      │
│   │  │users         │sessions      │behavior      │    │      │
│   │  │(1,368条)     │(2,513条)     │(2,513条)     │    │      │
│   │  └──────────────┴──────────────┴──────────────┘    │      │
│   │  ┌──────────────────────────────────────────┐      │      │
│   │  │         analytics_daily (64天)           │      │      │
│   │  │  日汇总数据: unique_users, sessions,     │      │      │
│   │  │  cumulative_users, bounce_rate 等        │      │      │
│   │  └──────────────────────────────────────────┘      │      │
│   └─────────────────────────────────────────────────────┘      │
│                              │                                  │
└──────────────────────────────┼──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API 层 (后端)                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   GET /api/analytics/dashboard/summary                          │
│   ├── COUNT(*) FROM analytics_users           → Total Users     │
│   ├── COUNT(DISTINCT user_id) FROM sessions   → DAU/WAU/MAU     │
│   ├── AVG(bounce_rate) FROM daily             → Bounce Rate     │
│   ├── AVG(mouse_movements) FROM behavior      → Engagement      │
│   └── GROUP BY timezone FROM users            → Timezone Dist   │
│                                                                 │
│   GET /api/analytics/dashboard/timeseries?period=all            │
│   └── SELECT date, unique_users, total_sessions, cumulative_users│
│       FROM analytics_daily ORDER BY date                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    前端展示层                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   📊 analytics-dashboard.html                                   │
│   ├── Stat Cards: Total Users, DAU, WAU, MAU, Stickiness       │
│   ├── Growth Chart: 每日活跃用户 + 会话数                       │
│   ├── Cumulative Chart: S-curve 累计用户                        │
│   ├── Engagement Cards: Mouse, Scrolls, Clicks, Typing         │
│   └── Timezone Distribution: 时区分布                           │
│                                                                 │
│   🔄 自动刷新: 页面加载时 fetchSummary() + fetchTimeseries()    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 💡 关键理解点

### **1. 为什么有"历史数据"和"当前数据"两种来源？**

| 数据来源 | 时间范围 | 目的 |
|----------|----------|------|
| Migration 历史数据 | 2024-11-29 ~ 2025-01-30 | 展示产品"已经运行一段时间"的样子，有完整的增长曲线 |
| 行为模拟器 | 2026-01-30 (当前) | 模拟"活跃产品"的实时数据生成 |

### **2. 为什么某些指标是"估算"的？**

由于历史数据和当前数据之间有约1年的空白期，直接从 sessions 表计算 WAU/MAU 可能得到很小的值。为了展示合理的 Stickiness，我们使用了基于历史 `analytics_daily` 数据的估算：

```javascript
// WAU ≈ 日均活跃用户 × 2.5
const estimatedWau = Math.round(avgDailyUsers * 2.5);
// MAU ≈ WAU × 3
const estimatedMau = Math.round(estimatedWau * 3);
```

### **3. 哪些指标会随模拟器更新？**

| 指标 | 是否更新 | 说明 |
|------|----------|------|
| Total Users | ✅ 是 | 模拟器创建新用户 |
| New Users (24h/7d/30d) | ✅ 是 | 基于 created_at 动态计算 |
| DAU | ✅ 是 | 基于当天 sessions 计算 |
| WAU/MAU | ✅ 是 | 基于近期 sessions 计算 |
| Stickiness | ✅ 是 | DAU/MAU 派生 |
| Bounce Rate | ⚠️ 部分 | 需要模拟器更新 daily 表 |
| Return Frequency | ❌ 否 | 当前固定值 3.5 |
| Engagement (鼠标/滚动/点击/输入) | ✅ 是 | 从 behavior 表动态计算 |
| Growth Chart | ✅ 是 | 从 daily 表获取 |
| Cumulative Chart | ✅ 是 | cumulative_users 递增 |
| Timezone Dist | ✅ 是 | 新用户有 timezone |

---

## 🔧 如何让所有指标随模拟器更新？

### **需要增强的地方：**

1. **Bounce Rate**
   ```javascript
   // 在模拟器中，更新 analytics_daily 时同时更新 bounce_rate
   const bounceRate = 0.10 + Math.random() * 0.15; // 10-25% 之间
   db.prepare(`UPDATE analytics_daily SET bounce_rate = ? WHERE date = ?`)
     .run(bounceRate, today);
   ```

2. **Return Frequency**
   ```javascript
   // 在后端，从 behavior 表动态计算而不是固定值
   const avgReturn = db.prepare(`
     SELECT AVG(return_frequency_days) FROM analytics_behavior
     WHERE recorded_at > datetime(?, '-7 days')
   `).get(mostRecentDate)?.avg || 3.5;
   ```

3. **持续同步**
   ```bash
   # 在 Render 部署后自动运行
   node scripts/sync-to-cloud.js $BACKEND_URL
   ```

---

## 📊 数据质量检查清单

| 检查项 | 预期值 | 当前状态 |
|--------|--------|----------|
| Total Users | > 1000 | ✅ 1,368 |
| Daily 数据天数 | > 60 | ✅ 64天 |
| Behavior 记录数 | > 2000 | ✅ 2,513 |
| Session 记录数 | > 2000 | ✅ 2,513 |
| Stickiness | 5-15% | ✅ ~5-8% |
| Bounce Rate | 10-30% | ✅ 12.5% |
| 时区覆盖 | > 10个 | ✅ 12个 |

---

*文档版本: 2.0*  
*最后更新: 2026-01-30*  
*Git 提交已保护*

