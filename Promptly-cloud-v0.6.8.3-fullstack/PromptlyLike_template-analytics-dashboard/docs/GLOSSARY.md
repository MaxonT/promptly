# 📖 Analytics Dashboard 指标词典 (Metrics Glossary)

> **模板版本**: 2.0.0  
> **适用范围**: 通用 SaaS / 内容平台 / 社区 / 电商  
> **维护者**: Your Team

本文档定义了 Analytics Dashboard 中所有指标的 **业务含义、计算公式、数据来源、健康基准**，是团队理解和使用仪表盘的唯一权威参考。

---

## 📊 目录

1. [核心活跃度指标](#1-核心活跃度指标-core-activity-metrics)
2. [增长指标](#2-增长指标-growth-metrics)
3. [行为质量指标](#3-行为质量指标-behavior-quality-metrics)
4. [参与度指标](#4-参与度指标-engagement-metrics)
5. [地理分布指标](#5-地理分布指标-geographic-metrics)
6. [事件与数据源映射](#6-事件与数据源映射)
7. [行业基准参考](#7-行业基准参考)

---

## 1. 核心活跃度指标 (Core Activity Metrics)

### 1.1 DAU (Daily Active Users) 日活跃用户

| 属性 | 值 |
|------|-----|
| **定义** | 在统计日内至少产生一次有效交互的唯一用户数 |
| **计算公式** | `COUNT(DISTINCT user_id) WHERE activity_date = today` |
| **数据源** | `analytics_sessions.user_id` |
| **统计周期** | 每日 00:00-23:59 (UTC 或配置时区) |
| **更新频率** | 实时 / 每5分钟 |

**什么算"有效交互"？**
- ✅ 开始一个会话 (session_start)
- ✅ 浏览页面 (page_view)
- ✅ 点击、滚动等行为事件
- ❌ 纯粹的静态资源请求
- ❌ Bot / 爬虫流量 (需过滤)

**健康基准**:
| 产品阶段 | 期望 DAU |
|---------|---------|
| 早期 (MVP) | 50-500 |
| 成长期 | 500-5,000 |
| 成熟期 | 5,000-50,000+ |

---

### 1.2 WAU (Weekly Active Users) 周活跃用户

| 属性 | 值 |
|------|-----|
| **定义** | 过去7天内至少产生一次有效交互的唯一用户数 |
| **计算公式** | `COUNT(DISTINCT user_id) WHERE activity_date >= today - 7 days` |
| **数据源** | `analytics_sessions.user_id` |
| **统计周期** | 滚动7天窗口 |

**关键洞察**:
- WAU/DAU 比值通常在 3-5 之间
- 如果 WAU ≈ DAU，说明几乎每个用户每天都来 (高粘性)
- 如果 WAU >> DAU * 7，说明有大量一次性用户

---

### 1.3 MAU (Monthly Active Users) 月活跃用户

| 属性 | 值 |
|------|-----|
| **定义** | 过去30天内至少产生一次有效交互的唯一用户数 |
| **计算公式** | `COUNT(DISTINCT user_id) WHERE activity_date >= today - 30 days` |
| **数据源** | `analytics_sessions.user_id` |
| **统计周期** | 滚动30天窗口 |

---

### 1.4 Stickiness (粘性) ⭐ 核心指标

| 属性 | 值 |
|------|-----|
| **定义** | 用户使用产品的频繁程度，衡量产品对用户的吸引力 |
| **计算公式** | `(DAU / MAU) × 100%` |
| **数据源** | 由 DAU 和 MAU 派生计算 |
| **单位** | 百分比 (%) |
| **精度** | 保留2位小数 |

**为什么重要**:
- Stickiness 是 **产品-市场契合度 (PMF)** 最重要的单一指标
- 高粘性 = 用户形成习惯 = 低流失风险 = 高 LTV

**健康基准**:
| Stickiness | 评价 | 典型产品 |
|------------|------|---------|
| < 5% | 🔴 危险 | 低频工具、一次性服务 |
| 5-10% | 🟡 一般 | 内容平台、资讯类 |
| 10-20% | 🟢 良好 | B2B SaaS、生产力工具 |
| 20-30% | 🟢 优秀 | 社交媒体、通讯工具 |
| > 30% | ⭐ 卓越 | 核心通讯 (WhatsApp, Slack) |

**计算示例**:
```
DAU = 100, MAU = 1200
Stickiness = (100/1200) × 100% = 8.33%
解读: 平均每个月活用户每月使用约 2.5 次
```

---

## 2. 增长指标 (Growth Metrics)

### 2.1 Total Users (总用户数)

| 属性 | 值 |
|------|-----|
| **定义** | 平台注册/识别的用户总数 (历史累计) |
| **计算公式** | `COUNT(*) FROM analytics_users` |
| **数据源** | `analytics_users` 表 |
| **更新频率** | 实时 |

---

### 2.2 New Users (新用户数)

| 属性 | 值 |
|------|-----|
| **定义** | 在指定时间窗口内首次被识别的用户数 |
| **变体** | `newLast24h`, `newLast7d`, `newLast30d` |
| **计算公式** | `COUNT(*) WHERE created_at > time_threshold` |
| **数据源** | `analytics_users.created_at` |

**业务价值**:
- 反映拉新效率
- 结合渠道数据可追踪 CAC

---

### 2.3 Growth Velocity (增长速率)

| 属性 | 值 |
|------|-----|
| **定义** | 用户/会话的每日增量变化 |
| **计算公式** | 时间序列图表: `users[date] - users[date-1]` |
| **数据源** | `analytics_daily` 表 |
| **展示方式** | 折线图 (支持 1h/6h/12h/30d 粒度) |

---

### 2.4 Cumulative Users (累计用户)

| 属性 | 值 |
|------|-----|
| **定义** | 按时间累加的用户总数曲线 |
| **计算公式** | `SUM(new_users) OVER (ORDER BY date)` |
| **数据源** | `analytics_daily.new_users` |
| **展示方式** | 面积图 (支持 7d/14d/30d/all 范围) |

---

## 3. 行为质量指标 (Behavior Quality Metrics)

### 3.1 Bounce Rate (跳出率) ⭐ 核心指标

| 属性 | 值 |
|------|-----|
| **定义** | 只浏览一个页面就离开的会话占比 |
| **计算公式** | `COUNT(sessions WHERE page_views <= 1) / COUNT(sessions) × 100%` |
| **数据源** | `analytics_sessions.page_views` |
| **精度** | 保留2位小数 |

**健康基准**:
| 页面类型 | 正常跳出率 |
|---------|-----------|
| 落地页 | 40-60% |
| 内容页 | 30-50% |
| 产品页 | 20-40% |
| 结账页 | 10-25% |

**注意事项**:
- 单页应用 (SPA) 需特殊处理，否则会虚高
- 需排除技术性跳出 (错误页、重定向)

---

### 3.2 Session Duration (会话时长)

| 属性 | 值 |
|------|-----|
| **定义** | 用户单次访问的持续时间 |
| **计算公式** | `session_end - session_start` |
| **数据源** | `analytics_sessions` |
| **单位** | 秒 / 分钟 |

---

### 3.3 Pages per Session (单次会话页面数)

| 属性 | 值 |
|------|-----|
| **定义** | 平均每个会话浏览的页面数 |
| **计算公式** | `AVG(page_views)` |
| **数据源** | `analytics_sessions.page_views` |

---

## 4. 参与度指标 (Engagement Metrics)

### 4.1 Mouse Movements (鼠标移动)

| 属性 | 值 |
|------|-----|
| **定义** | 会话期间鼠标移动事件的平均次数 |
| **计算公式** | `AVG(mouse_movements)` |
| **数据源** | `analytics_behavior.mouse_movements` |
| **意义** | 反映用户浏览意图 (vs 仅打开页面) |

### 4.2 Scroll Events (滚动事件)

| 属性 | 值 |
|------|-----|
| **定义** | 会话期间页面滚动事件的平均次数 |
| **计算公式** | `AVG(scroll_events)` |
| **数据源** | `analytics_behavior.scroll_events` |
| **意义** | 反映内容消费深度 |

### 4.3 Clicks (点击事件)

| 属性 | 值 |
|------|-----|
| **定义** | 会话期间点击事件的平均次数 |
| **计算公式** | `AVG(click_events)` |
| **数据源** | `analytics_behavior.click_events` |
| **意义** | 反映交互频率 |

### 4.4 Typing Events (输入事件)

| 属性 | 值 |
|------|-----|
| **定义** | 会话期间键盘输入事件的平均次数 |
| **计算公式** | `AVG(typing_events)` |
| **数据源** | `analytics_behavior.typing_events` |
| **意义** | 反映主动参与度 (搜索、表单填写等) |

---

## 5. 地理分布指标 (Geographic Metrics)

### 5.1 Timezone Distribution (时区分布)

| 属性 | 值 |
|------|-----|
| **定义** | 用户按时区分组的分布 |
| **计算公式** | `GROUP BY timezone ORDER BY count DESC` |
| **数据源** | `analytics_users.timezone` 或 `analytics_behavior.timezone` |
| **展示方式** | 柱状图 / 表格 (Top 12) |

**业务价值**:
- 确定核心市场区域
- 优化推送/营销时间
- 规划客服覆盖

---

## 6. 事件与数据源映射

### 6.1 数据表结构

```
┌─────────────────────────────────────────────────────────────────┐
│                        analytics_users                          │
├─────────────────────────────────────────────────────────────────┤
│ user_id (PK) │ created_at │ timezone │ device │ browser │ ...  │
└──────────────┴────────────┴──────────┴────────┴─────────┴──────┘
                                │
                                │ 1:N
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                       analytics_sessions                        │
├─────────────────────────────────────────────────────────────────┤
│ session_id │ user_id │ session_start │ session_end │ page_views │
└────────────┴─────────┴───────────────┴─────────────┴────────────┘
                                │
                                │ 1:1
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                       analytics_behavior                        │
├─────────────────────────────────────────────────────────────────┤
│ session_id │ mouse_movements │ scroll_events │ click_events │..│
└────────────┴─────────────────┴───────────────┴──────────────┴──┘

┌─────────────────────────────────────────────────────────────────┐
│                        analytics_daily                          │
├─────────────────────────────────────────────────────────────────┤
│ date (PK) │ unique_users │ total_sessions │ new_users │ ...    │
└───────────┴──────────────┴────────────────┴───────────┴────────┘
```

### 6.2 指标 → 数据源映射

| 指标 | 主数据源 | 备用数据源 | 计算复杂度 |
|------|---------|-----------|-----------|
| DAU | analytics_sessions | analytics_daily | ⭐ 简单 |
| WAU | analytics_sessions | - | ⭐⭐ 中等 |
| MAU | analytics_sessions | - | ⭐⭐ 中等 |
| Stickiness | 派生 (DAU/MAU) | - | ⭐ 简单 |
| Bounce Rate | analytics_sessions | analytics_daily | ⭐⭐ 中等 |
| Total Users | analytics_users | - | ⭐ 简单 |
| Engagement | analytics_behavior | - | ⭐⭐ 中等 |
| Timezone | analytics_users/behavior | - | ⭐ 简单 |

### 6.3 事件追踪端点

| 事件类型 | API 端点 | 触发时机 |
|---------|---------|---------|
| 用户识别 | `POST /track/user` | 首次访问或登录 |
| 会话开始 | `POST /track/session-start` | 页面加载 |
| 会话结束 | `POST /track/session-end` | 页面关闭 / 超时 |
| 行为数据 | `POST /track/behavior` | 定期上报 (每30秒) |

---

## 7. 行业基准参考

### 7.1 SaaS B2B 产品

| 指标 | 差 | 一般 | 良好 | 优秀 |
|------|---|-----|-----|-----|
| DAU/MAU | <5% | 5-10% | 10-20% | >20% |
| Bounce Rate | >60% | 40-60% | 25-40% | <25% |
| Session Duration | <1min | 1-3min | 3-10min | >10min |
| Pages/Session | <2 | 2-4 | 4-8 | >8 |

### 7.2 内容/媒体平台

| 指标 | 差 | 一般 | 良好 | 优秀 |
|------|---|-----|-----|-----|
| DAU/MAU | <10% | 10-15% | 15-25% | >25% |
| Bounce Rate | >70% | 50-70% | 35-50% | <35% |
| Session Duration | <30s | 30s-2min | 2-5min | >5min |

### 7.3 电商平台

| 指标 | 差 | 一般 | 良好 | 优秀 |
|------|---|-----|-----|-----|
| DAU/MAU | <3% | 3-8% | 8-15% | >15% |
| Bounce Rate | >65% | 45-65% | 30-45% | <30% |
| Pages/Session | <3 | 3-5 | 5-10 | >10 |

---

## 📝 附录

### A. 常见问题

**Q: DAU 和 登录用户数 有什么区别？**
A: DAU 包括所有有交互的用户（通过 session 识别），不一定要登录。如果你的产品需要登录，两者可能接近。

**Q: 为什么我的 Stickiness 很低？**
A: 常见原因：
1. 产品使用频率天然较低（如税务软件）
2. 用户获取渠道质量差
3. 核心功能价值不够
4. 竞品更好

**Q: Bounce Rate 突然飙升怎么办？**
A: 检查：
1. 是否有技术问题（加载慢、错误）
2. 是否有流量来源变化（低质量渠道）
3. 是否有 UI/UX 变更
4. 是否是季节性/事件性波动

### B. 术语对照表

| 英文 | 中文 | 缩写 |
|-----|------|-----|
| Daily Active Users | 日活跃用户 | DAU |
| Weekly Active Users | 周活跃用户 | WAU |
| Monthly Active Users | 月活跃用户 | MAU |
| Stickiness | 粘性 | - |
| Bounce Rate | 跳出率 | BR |
| Session | 会话 | - |
| Page View | 页面浏览 | PV |
| Unique Visitor | 独立访客 | UV |

---

> 📌 **维护说明**: 本文档应随产品迭代同步更新。任何指标定义的变更必须通知所有相关团队。
