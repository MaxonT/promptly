# Analytics Dashboard 数据来源说明

## 📊 数据架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                    Analytics Dashboard                          │
├─────────────────────────────────────────────────────────────────┤
│  前端: analytics-dashboard.html + analytics-dashboard.js        │
│  后端: /api/analytics/dashboard/* (analyticsDashboard.js)       │
│  数据库: SQLite (./data/app.db)                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 🗄️ 数据表结构

### 1. `analytics_users` - 用户表
```sql
- id: 用户唯一标识 (au_YYYYMMDD_XXXX)
- source: 来源渠道 (organic/direct/social/referral/email)
- timezone: 用户时区
- country: 国家
- device_type: 设备类型
- browser: 浏览器
- created_at: 注册时间
- last_active_at: 最后活跃时间
```

### 2. `analytics_sessions` - 会话表
```sql
- id: 会话ID (as_YYYYMMDD_XXXX)
- user_id: 关联用户
- session_start: 会话开始时间
- session_end: 会话结束时间
- duration_seconds: 持续时长
- page_views: 页面浏览数
- device_type: 设备类型
- browser: 浏览器
```

### 3. `analytics_behavior` - 行为表
```sql
- user_id: 用户ID
- session_id: 会话ID
- mouse_movements: 鼠标移动次数
- scrolls: 滚动次数
- clicks: 点击次数
- typing_events: 输入事件数
- engagement_score: 参与度分数
```

### 4. `analytics_daily` - 日汇总表
```sql
- date: 日期
- unique_users: 当日活跃用户数
- new_users: 新增用户数
- returning_users: 回访用户数
- total_sessions: 总会话数
- total_page_views: 总页面浏览
- avg_session_duration: 平均会话时长
- bounce_rate: 跳出率
- cumulative_users: 累计用户数
```

## 📈 数据生成算法

### S-curve (Logistic Growth) 增长模型
```
f(day) = L / (1 + e^(-k*(day-x0)))

参数:
- L = 2123 (目标用户数)
- k = 0.12 (增长速率)
- x0 = 32 (中点天数)
```

### 时间范围
- **开始日期**: 2024-11-29
- **结束日期**: 2025-01-30
- **总天数**: 62天

## 🔢 关键指标计算逻辑

### DAU (Daily Active Users)
```sql
SELECT COUNT(DISTINCT user_id) FROM analytics_sessions
WHERE date(session_start) = '最新日期'
```

### WAU (Weekly Active Users)
```sql
SELECT COUNT(DISTINCT user_id) FROM analytics_sessions
WHERE date(session_start) > date('最新日期', '-7 days')
```

### MAU (Monthly Active Users)
```sql
SELECT COUNT(DISTINCT user_id) FROM analytics_sessions
WHERE date(session_start) > date('最新日期', '-30 days')
```

### DAU/MAU 粘性比率
```javascript
dauMauRatio = (DAU / MAU) * 100
```

## ✅ 业务逻辑验证

正确的数据应满足以下约束：
```
DAU ≤ WAU ≤ MAU ≤ Total Users
```

### 当前数据验证 (2025-01-30)
| 指标 | 值 | 验证 |
|-----|-----|------|
| Total Users | 2067 | ✅ |
| DAU | 321 | ✅ |
| WAU | 339 | ✅ DAU ≤ WAU |
| MAU | 344 | ✅ WAU ≤ MAU |
| DAU/MAU | 93.3% | ✅ 高粘性 |

## 🌍 时区分布 (Top 12)

1. America/New_York (18%)
2. America/Los_Angeles (15%)
3. Europe/London (12%)
4. America/Chicago (10%)
5. Europe/Paris (8%)
6. Asia/Shanghai (8%)
7. Europe/Berlin (6%)
8. Asia/Tokyo (6%)
9. Asia/Singapore (5%)
10. Australia/Sydney (4%)
11. Asia/Mumbai (4%)
12. America/Toronto (4%)

## 🔄 数据更新机制

### 历史数据
- 由 migration `002_analytics.js` 一次性生成
- 使用 S-curve 算法模拟真实增长模式

### 实时数据
- 通过 `POST /api/analytics/track/*` 端点接收
- 支持用户注册、会话开始/结束、行为记录
- 支持模拟器批量生成测试数据

## 📝 API 端点

| 端点 | 方法 | 说明 |
|-----|------|------|
| `/api/analytics/dashboard/summary` | GET | 获取仪表板汇总数据 |
| `/api/analytics/dashboard/timeseries` | GET | 获取时间序列数据 |
| `/api/analytics/track/user` | POST | 跟踪新用户注册 |
| `/api/analytics/track/session-start` | POST | 跟踪会话开始 |
| `/api/analytics/track/session-end` | POST | 跟踪会话结束 |
| `/api/analytics/track/behavior` | POST | 跟踪用户行为 |

## 🚀 本地开发

### 启动后端
```bash
cd backend
CORS_ORIGIN="http://localhost:3000" JWT_SECRET=test-secret-for-development node src/server.js
```

### 启动前端
```bash
cd frontend
python3 -m http.server 3000
```

### 访问仪表板
```
http://localhost:3000/analytics-dashboard.html
```

---
*文档更新时间: 2025-01-30*
