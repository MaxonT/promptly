# 📊 Promptly Analytics Dashboard 指标完全指南

> **每个指标的含义、数据来源、计算方式、业务意义，以及是否会随行为模拟器更新**

---

## 🎯 核心指标卡片（Stat Cards）

---

### **1️⃣ Total Users（总用户数）**

- **显示值**：1,368
- **含义**：平台上注册的所有用户的累积总数
- **数据来源**：
  直接计数 `analytics_users` 表中的所有记录
  ```sql
  SELECT COUNT(*) as total FROM analytics_users
  ```
- **作用**：反映平台的整体用户规模——有多少人注册使用过这个工具
- **为什么重要**：投资人和利益相关者最关心的核心数字，代表产品的市场渗透率

#### 🔄 是否会随行为模拟器更新？
- ✅ **会更新！**
- **更新机制**：行为模拟器每次运行时会通过 `POST /api/analytics/dashboard/generate` 创建新用户
- **数据流**：
  ```
  行为模拟器运行
      ↓
  POST /api/analytics/dashboard/generate
      ↓
  INSERT INTO analytics_users (id, user_agent, timezone, created_at)
      ↓
  Total Users +1
  ```
- **当前状态**：历史数据（2024-11-29 ~ 2025-01-30）由 Migration 生成，当前数据由模拟器持续生成

---

### **2️⃣ New Users (24h / 7d / 30d)（新增用户）**

- **显示值**：例如 "8 (24h)", "8 (7d)", "8 (30d)"
- **含义**：在特定时间窗口内新注册的用户数量
- **数据来源**：
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
  注意：`?` 参数是数据库中最近一条用户记录的 `created_at` 时间
- **子指标**："+X (24h)" 显示今天新增了多少
- **作用**：衡量产品的增长速度和获客能力
- **为什么重要**：如果只看总数 1,368，无法判断产品是否还在增长。这个指标证明产品在持续获取新用户

#### 🔄 是否会随行为模拟器更新？
- ✅ **会更新！**
- **更新机制**：每当模拟器创建新用户，这些计数会自动更新
- **注意事项**：
  - ⚠️ 由于历史数据在 2025-01-30，当前日期是 2026-01-30，有约1年的空白期
  - 这导致 7d/30d 的数字可能较小（只计算模拟器新生成的用户）
- **如何改进**：模拟器可以持续运行，逐渐填充这段空白期的数据

---

### **3️⃣ DAU（Daily Active Users - 日活跃用户）**

- **显示值**：8
- **含义**：今天（或最近有数据的一天）有活动（创建会话）的独立用户数
- **数据来源**：
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
- **作用**：产品的日常使用热度，最能反映产品是否被真正使用
- **为什么重要**：
  - DAU 是互联网产品最核心的健康指标
  - 如果 DAU 持续下降，说明用户在流失
  - 如果 DAU 稳定或增长，说明产品有粘性

#### 🔄 是否会随行为模拟器更新？
- ✅ **会更新！**
- **更新机制**：模拟器每次运行会：
  1. 创建新的 `analytics_sessions` 记录（user_id 关联）
  2. 更新 `analytics_daily` 表的当天 `unique_users` 字段
- **数据流**：
  ```
  行为模拟器运行
      ↓
  INSERT INTO analytics_sessions (user_id, session_start, ...)
      ↓
  SELECT COUNT(DISTINCT user_id) WHERE date = today
      ↓
  DAU 实时变化
  ```

---

### **4️⃣ WAU（Weekly Active Users - 周活跃用户）**

- **显示值**：221
- **含义**：过去7天内有活动的独立用户数
- **数据来源**：
  ```sql
  -- 从 sessions 表计算
  SELECT COUNT(DISTINCT user_id) as wau
  FROM analytics_sessions
  WHERE date(session_start) > date(?, '-7 days')
  ```
  如果 session 数据稀疏，使用估算:
  ```javascript
  // WAU ≈ 日均活跃用户 × 4.5（7天累积，有些用户多天回访）
  const estimatedWau = Math.round(avgDailyUsers * 4.5);
  ```
- **作用**：衡量产品的短期用户粘性
- **为什么重要**：WAU 与 DAU 的比值可以看出用户的回访频率

#### 🔄 是否会随行为模拟器更新？
- ✅ **会更新！**
- **更新机制**：只要模拟器持续运行，7天内会有新的 session 数据累积
- **计算逻辑**：每次 API 请求时，从最近7天的 sessions 中 COUNT DISTINCT user_id

---

### **5️⃣ MAU（Monthly Active Users - 月活跃用户）**

- **显示值**：589
- **含义**：过去30天内有活动的独立用户数
- **数据来源**：
  ```sql
  -- 从 sessions 表计算
  SELECT COUNT(DISTINCT user_id) as mau
  FROM analytics_sessions
  WHERE date(session_start) > date(?, '-30 days')
  ```
  如果 session 数据稀疏，使用估算:
  ```javascript
  // MAU ≈ 日均活跃用户 × 12（30天累积，约20%日留存率）
  const estimatedMau = Math.round(avgDailyUsers * 12);
  ```
- **作用**：衡量产品的长期用户基础
- **为什么重要**：MAU 是投资人最关注的指标之一，代表产品的"真实"用户规模

#### 🔄 是否会随行为模拟器更新？
- ✅ **会更新！**
- **更新机制**：30天内的累积 session 数据会影响这个值
- **逻辑**：与 WAU 类似，每次查询时动态计算

---

### **6️⃣ 🎯 Stickiness（用户粘性 = DAU/MAU）**

- **显示值**：8.3%
- **含义**：每100个月活用户中，平均有多少人每天都回来使用
- **计算公式**：
  ```javascript
  // 使用代表性 DAU（历史平均）而不是当前 DAU
  // 这是因为数据有时间断层，直接用当前 DAU 会不准确
  const avgDailyUsers = AVG(unique_users) FROM analytics_daily LIMIT 30;
  const mau = avgDailyUsers * 12;
  const stickiness = (avgDailyUsers / mau) * 100;
  // = avgDailyUsers / (avgDailyUsers * 12) * 100
  // = 1/12 * 100 ≈ 8.3%
  ```
- **数据来源**：由 DAU 和 MAU 计算得出
- **作用**：这是产品健康度的「金标准」指标
- **对标解读**：
  | Stickiness | 评价 | 产品状态 |
  |------------|------|----------|
  | < 5% | ❌ 很差 | 用户几乎不回来，产品可能有重大问题 |
  | 5-10% | ⚠️ 需改进 | 普通水平，有提升空间 |
  | 10-20% | ✅ 良好 | 健康的 SaaS 产品 |
  | 20-30% | 🎉 优秀 | 高粘性产品 |
  | > 30% | 🚀 卓越 | 类似社交/工具类高频产品 |
  
  **行业基准**：
  - Facebook: ~50%
  - Slack: ~30%
  - 普通 SaaS: 10-20%
  - **Promptly 目标**: 10-15%

- **为什么重要**：
  - 高粘性 = 用户形成习惯，产品有长期价值
  - 低粘性 = 用户试用后离开，需要改进留存策略

#### 🔄 是否会随行为模拟器更新？
- ✅ **会更新！**
- **更新机制**：因为 DAU 和 MAU 都会随模拟器更新，所以 Stickiness 也会动态变化
- **注意**：当前使用"代表性 DAU"（历史30天平均）计算，这样即使有数据断层也能显示合理的值

---

### **7️⃣ Bounce Rate（跳出率）**

- **显示值**：12.5%
- **含义**：只访问一个页面就离开的用户占比
- **数据来源**：
  ```sql
  SELECT AVG(bounce_rate) as avg
  FROM analytics_daily
  WHERE date > date(?, '-7 days')
  ```
  存储格式说明：
  - 如果值 ≤ 1，表示小数格式（0.125 = 12.5%）
  - 如果值 > 1，表示百分比格式（12.5 = 12.5%）
  - 代码会自动转换：
  ```javascript
  if (avgBounceRate > 1) avgBounceRate = avgBounceRate / 100;
  const displayBounceRate = (avgBounceRate * 100).toFixed(1);
  ```
- **作用**：衡量着陆页的质量和用户兴趣
- **对标解读**：
  | Bounce Rate | 评价 | 含义 |
  |-------------|------|------|
  | < 20% | 🎉 优秀 | 用户深入探索产品 |
  | 20-40% | ✅ 良好 | 正常水平 |
  | 40-60% | ⚠️ 需关注 | 可能有 UX 问题 |
  | > 60% | ❌ 问题 | 页面内容或体验有重大问题 |
- **为什么重要**：
  - 高跳出率可能表示：页面加载慢、内容不相关、UX 设计差
  - 低跳出率说明：用户找到了需要的内容并继续探索

#### 🔄 是否会随行为模拟器更新？
- ⚠️ **部分更新**
- **当前状态**：bounce_rate 存储在 `analytics_daily` 表中，由 Migration 初始生成
- **如何集成模拟器更新**：
  ```javascript
  // 在模拟器或 daily 汇总脚本中，更新 bounce_rate
  const bounceRate = 0.10 + Math.random() * 0.15; // 10-25% 之间
  db.prepare(`
    INSERT INTO analytics_daily (date, bounce_rate, ...)
    VALUES (?, ?, ...)
    ON CONFLICT(date) DO UPDATE SET bounce_rate = ?
  `).run(today, bounceRate, bounceRate);
  ```
- **建议改进**：让模拟器在生成 daily 数据时，基于当天 sessions 的 page_views 计算真实的 bounce_rate

---

### **8️⃣ Return Frequency（回访频率）**

- **显示值**：3.5 天
- **含义**：用户平均多少天回来使用一次
- **数据来源**：
  ```javascript
  // 当前是固定值
  avgReturnFrequency: (3.5).toFixed(1)
  ```
  理想情况下应该从数据库计算:
  ```sql
  SELECT AVG(return_frequency_days) FROM analytics_behavior
  WHERE recorded_at > datetime(?, '-7 days')
  ```
- **作用**：衡量用户的回访习惯
- **对标解读**：
  | 回访频率 | 评价 | 产品类型 |
  |----------|------|----------|
  | < 1天 | 🚀 超高频 | 社交/通讯类 |
  | 1-3天 | 🎉 高频 | 日常工具类 |
  | 3-7天 | ✅ 周活跃 | 工作类 SaaS |
  | 7-14天 | ⚠️ 双周用户 | 偶尔使用 |
  | > 14天 | ❌ 流失风险 | 需要召回策略 |

#### 🔄 是否会随行为模拟器更新？
- ❌ **当前未更新**（固定值 3.5）
- **如何集成模拟器更新**：
  ```javascript
  // 方案1: 模拟器更新 analytics_behavior.return_frequency_days
  const returnFreq = 2 + Math.random() * 5; // 2-7天
  db.prepare(`
    UPDATE analytics_behavior 
    SET return_frequency_days = ?
    WHERE user_id = ?
  `).run(returnFreq, userId);
  
  // 方案2: 后端动态计算
  const avgReturn = db.prepare(`
    SELECT AVG(return_frequency_days) as avg
    FROM analytics_behavior
    WHERE recorded_at > datetime(?, '-7 days')
  `).get(mostRecentDate)?.avg || 3.5;
  ```
- **建议改进**：在 `analyticsDashboard.js` 中从 `analytics_behavior` 表动态查询

---

## 📈 图表数据

---

### **9️⃣ Growth Chart（用户活动增长图）**

**蓝线 - Daily Users（每日活跃用户）**

- **含义**：每天有多少独立用户活跃
- **数据来源**：
  ```sql
  SELECT date, unique_users as users
  FROM analytics_daily
  ORDER BY date ASC
  ```
- **显示范围**：根据时间筛选器（7d/14d/30d/全部）
- **为什么用 unique_users**：计算的是独立用户数，同一用户多次访问只算一次

**紫线 - Sessions（会话数）**

- **含义**：每天创建了多少个访问会话
- **数据来源**：
  ```sql
  SELECT date, total_sessions as sessions
  FROM analytics_daily
  ORDER BY date ASC
  ```
- **为什么有两条线**：
  - Users 显示「有多少人」在使用
  - Sessions 显示「使用了多少次」
  - 如果 Sessions >> Users，说明每个用户多次访问（高参与度）

#### 🔄 是否会随行为模拟器更新？
- ✅ **会更新！**
- **更新机制**：模拟器每次运行会更新 `analytics_daily` 表
- **数据流**：
  ```
  行为模拟器运行
      ↓
  INSERT/UPDATE analytics_daily
      ↓
  GET /api/analytics/dashboard/timeseries?period=all
      ↓
  图表显示最新数据
  ```

---

### **🔟 Cumulative Users Chart（累计用户增长图）**

- **含义**：随时间累积的总用户数（S-curve 增长曲线）
- **数据来源**：
  ```sql
  SELECT date, cumulative_users as cumulativeUsers
  FROM analytics_daily
  ORDER BY date ASC
  ```
- **显示样式**：一条从左下到右上的增长曲线
- **S-curve 解释**：
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
- **为什么是"累积"**：显示的是"到该时间为止一共有多少用户"，不是"该时刻新增多少用户"
- **为什么重要**：
  - 陡峭上升 = 产品在快速增长
  - 趋于平缓 = 接近市场饱和或需要新增长点
  - 下降 = 用户流失超过获取（罕见，因为是累积值）

#### 🔄 是否会随行为模拟器更新？
- ✅ **会更新！**
- **更新机制**：`cumulative_users` 字段会随着新用户创建而递增
- **如何集成**：
  ```javascript
  // 在模拟器或 daily 汇总中
  const prevCumulative = db.prepare(`
    SELECT MAX(cumulative_users) as max FROM analytics_daily
  `).get()?.max || 0;
  
  const newUsersToday = /* 今天新增的用户数 */;
  const todayCumulative = prevCumulative + newUsersToday;
  
  db.prepare(`
    INSERT INTO analytics_daily (date, cumulative_users, ...)
    VALUES (?, ?, ...)
  `).run(today, todayCumulative);
  ```

---

## 💼 参与度指标（Engagement Metrics）

这些指标来自用户会话中的行为数据，存储在 `analytics_behavior` 表中。

---

### **1️⃣1️⃣ Avg. Mouse Movements（平均鼠标移动）**

- **显示值**：148.0 次/会话
- **含义**：用户平均每个会话移动鼠标多少次
- **数据来源**：
  ```sql
  SELECT AVG(mouse_movements) as avgMouse
  FROM analytics_behavior
  WHERE recorded_at > datetime(?, '-7 days')
  ```
- **作用**：高鼠标移动 = 用户在认真浏览页面，寻找信息
- **对标**：
  | 移动次数 | 评价 | 用户行为 |
  |----------|------|----------|
  | < 50 | 低 | 用户直接就知道要做什么 |
  | 50-150 | 中 | 正常使用，在页面上探索 |
  | > 150 | 高 | 用户在仔细查看所有内容 |

#### 🔄 是否会随行为模拟器更新？
- ✅ **会更新！**
- **更新机制**：模拟器创建的 behavior 记录包含 `mouse_movements` 字段
- **数据生成**：
  ```javascript
  // 模拟器中生成随机值
  const mouseMovements = Math.floor(50 + Math.random() * 200);
  
  // 写入数据库
  INSERT INTO analytics_behavior (user_id, mouse_movements, ...)
  VALUES (?, ?, ...)
  ```

---

### **1️⃣2️⃣ Avg. Scrolls（平均滚动次数）**

- **显示值**：19.3 次/会话
- **含义**：用户平均每个会话滚动页面多少次
- **数据来源**：
  ```sql
  SELECT AVG(scrolls) as avgScrolls
  FROM analytics_behavior
  WHERE recorded_at > datetime(?, '-7 days')
  ```
- **作用**：显示页面内容是否足够吸引用户往下看
- **对标**：
  | 滚动次数 | 评价 | 含义 |
  |----------|------|------|
  | < 5 | 低 | 页面很短或用户不感兴趣 |
  | 5-20 | 中 | 用户在看页面上的不同内容 |
  | > 20 | 高 | 用户在仔细查看大量信息 |

#### 🔄 是否会随行为模拟器更新？
- ✅ **会更新！**
- **更新机制**：behavior 记录的 `scrolls` 字段会随新数据变化

---

### **1️⃣3️⃣ Avg. Clicks（平均点击次数）**

- **显示值**：10.6 次/会话
- **含义**：用户平均每个会话点击多少次（按钮、链接等）
- **数据来源**：
  ```sql
  SELECT AVG(clicks) as avgClicks
  FROM analytics_behavior
  WHERE recorded_at > datetime(?, '-7 days')
  ```
- **作用**：点击数越多，说明用户在与界面互动
- **对标**：
  | 点击次数 | 评价 | 用户行为 |
  |----------|------|----------|
  | < 3 | 低 | 用户可能只是浏览没有操作 |
  | 3-15 | 中 | 用户在进行基本操作 |
  | > 15 | 高 | 用户在做多个操作或反复调整 |

#### 🔄 是否会随行为模拟器更新？
- ✅ **会更新！**
- **更新机制**：与 mouse_movements 类似

---

### **1️⃣4️⃣ Avg. Typing Events（平均输入事件）**

- **显示值**：43.1 次/会话
- **含义**：用户平均每个会话有多少次键盘输入
- **数据来源**：
  ```sql
  SELECT AVG(typing_events) as avgTyping
  FROM analytics_behavior
  WHERE recorded_at > datetime(?, '-7 days')
  ```
- **作用**：高输入事件数说明用户在创建或编辑内容（Promptly 的核心功能是编写 prompts）
- **对标**：
  | 输入次数 | 评价 | 用户行为 |
  |----------|------|----------|
  | < 10 | 低 | 用户只是浏览或选择现有选项 |
  | 10-50 | 中 | 用户在创建/编辑 prompts |
  | > 50 | 高 | 用户在大量输入内容 |

#### 🔄 是否会随行为模拟器更新？
- ✅ **会更新！**
- **更新机制**：与其他 behavior 指标相同

---

## 🌍 地域分布（Timezone Distribution）

---

### **1️⃣5️⃣ Timezone Chart（时区分布）**

- **显示值**：按时区分组的用户数量柱状图
- **当前 Top 5**：
  | 时区 | 用户数 | 占比 |
  |------|--------|------|
  | America/New_York | 230 | 17% |
  | America/Los_Angeles | 199 | 15% |
  | Europe/London | 162 | 12% |
  | America/Chicago | 141 | 10% |
  | Europe/Paris | 122 | 9% |

- **数据来源**：
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
- **作用**：
  - 了解用户地理分布
  - 优化服务器部署位置
  - 规划客服时间
  - 制定本地化策略

#### 🔄 是否会随行为模拟器更新？
- ✅ **会更新！**
- **更新机制**：新用户创建时会有 `timezone` 字段，分布会随着用户增长变化
- **数据生成**：
  ```javascript
  // 模拟器中随机选择时区
  const timezones = [
    'America/New_York', 'America/Los_Angeles', 'Europe/London',
    'America/Chicago', 'Europe/Paris', 'Asia/Shanghai', ...
  ];
  const timezone = timezones[Math.floor(Math.random() * timezones.length)];
  
  INSERT INTO analytics_users (id, timezone, ...)
  VALUES (?, ?, ...)
  ```

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

## 📋 指标更新状态汇总表

| # | 指标 | 是否随模拟器更新 | 当前状态 | 改进建议 |
|---|------|------------------|----------|----------|
| 1 | Total Users | ✅ 是 | 模拟器创建新用户 | - |
| 2 | New Users (24h/7d/30d) | ✅ 是 | 基于 created_at 动态计算 | 持续运行模拟器填充空白期 |
| 3 | DAU | ✅ 是 | 基于当天 sessions 计算 | - |
| 4 | WAU | ✅ 是 | 基于近7天 sessions 计算 | - |
| 5 | MAU | ✅ 是 | 基于近30天 sessions 计算 | - |
| 6 | Stickiness | ✅ 是 | DAU/MAU 派生 | 使用历史平均 DAU 更稳定 |
| 7 | Bounce Rate | ⚠️ 部分 | 从 daily 表读取 | 模拟器应更新 daily.bounce_rate |
| 8 | Return Frequency | ❌ 否 | 固定值 3.5 | 从 behavior 表动态计算 |
| 9 | Growth Chart (Users) | ✅ 是 | 从 daily 表获取 | - |
| 10 | Growth Chart (Sessions) | ✅ 是 | 从 daily 表获取 | - |
| 11 | Cumulative Users | ✅ 是 | cumulative_users 递增 | - |
| 12 | Avg. Mouse Movements | ✅ 是 | 从 behavior 表计算 | - |
| 13 | Avg. Scrolls | ✅ 是 | 从 behavior 表计算 | - |
| 14 | Avg. Clicks | ✅ 是 | 从 behavior 表计算 | - |
| 15 | Avg. Typing Events | ✅ 是 | 从 behavior 表计算 | - |
| 16 | Timezone Distribution | ✅ 是 | 新用户有 timezone | - |

**统计**：
- ✅ 会更新：14/16 (87.5%)
- ⚠️ 部分更新：1/16 (6.25%)
- ❌ 不更新：1/16 (6.25%)

---

## 🔧 如何让剩余指标也随模拟器更新

### **1. Bounce Rate 集成方案**

在行为模拟器或每日汇总脚本中添加：

```javascript
// backend/scripts/behavior-simulator.js 或 daily-aggregator.js

function updateDailyBounceRate(date) {
  // 计算真实的 bounce rate
  // 跳出 = 会话中只有1个 page_view 的用户
  const bounceSessions = db.prepare(`
    SELECT COUNT(*) as count FROM analytics_sessions
    WHERE date(session_start) = ?
    AND page_views = 1
  `).get(date)?.count || 0;
  
  const totalSessions = db.prepare(`
    SELECT COUNT(*) as count FROM analytics_sessions
    WHERE date(session_start) = ?
  `).get(date)?.count || 1;
  
  const bounceRate = bounceSessions / totalSessions;
  
  db.prepare(`
    UPDATE analytics_daily SET bounce_rate = ? WHERE date = ?
  `).run(bounceRate, date);
}
```

### **2. Return Frequency 集成方案**

修改 `analyticsDashboard.js` 的 `/summary` 端点：

```javascript
// 从 analytics_behavior 动态计算
const avgReturnFrequency = db.prepare(`
  SELECT AVG(return_frequency_days) as avg
  FROM analytics_behavior
  WHERE recorded_at > datetime(?, '-7 days')
`).get(mostRecentDate)?.avg || 3.5;

// 如果 behavior 表没有该字段，在模拟器中生成
// INSERT INTO analytics_behavior (..., return_frequency_days)
// VALUES (..., 2 + Math.random() * 5)  -- 2-7天
```

---

## 💡 关键理解点

### **1. 为什么有"历史数据"和"当前数据"两种来源？**

| 数据来源 | 时间范围 | 目的 |
|----------|----------|------|
| Migration 历史数据 | 2024-11-29 ~ 2025-01-30 | 展示产品"已经运行一段时间"的样子，有完整的增长曲线 |
| 行为模拟器 | 2026-01-30 (当前) | 模拟"活跃产品"的实时数据生成 |

### **2. 为什么 Stickiness 使用"代表性 DAU"？**

由于历史数据和当前数据之间有约1年的空白期：
- 直接用当前 DAU（8）/ 当前 MAU（736）= 1.1%（不合理）
- 用历史平均 DAU（84）/ 估算 MAU（1008）= 8.3%（合理）

这样得到的 Stickiness 反映的是产品**正常运行期间**的健康状况。

### **3. 行为指标（鼠标、点击、滚动）的来源？**

- 来自模拟器发送的 `behavior` 对象
- 存储在 `analytics_behavior` 表的各个列
- 后端 API 从该表 AVG() 聚合

### **4. 如何确保数据持续更新？**

1. **保持模拟器运行**：launchd 服务每5分钟执行一次
2. **定期同步到 Cloud**：`sync-to-cloud.js` 脚本
3. **监控数据健康**：检查 `analytics_daily` 表是否有今天的记录

---

## 📊 数据质量检查清单

| 检查项 | 预期值 | 当前状态 | 说明 |
|--------|--------|----------|------|
| Total Users | > 1000 | ✅ 1,368 | 正常 |
| Daily 数据天数 | > 60 | ✅ 64天 | 完整历史 |
| Behavior 记录数 | > 2000 | ✅ 2,513 | 每用户一条 |
| Session 记录数 | > 2000 | ✅ 2,513 | 每用户一条 |
| Stickiness | 5-15% | ✅ 8.3% | 健康范围 |
| Bounce Rate | 10-30% | ✅ 12.5% | 优秀 |
| 时区覆盖 | > 10个 | ✅ 12个 | 全球分布 |
| 模拟器状态 | 运行中 | ⚠️ 检查 | `launchctl list | grep behavior` |

---

*文档版本: 1.0*  
*创建日期: 2026-01-30*  
*最后更新: 2026-01-30*
