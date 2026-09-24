# 🛡️ Analytics System Backup & Recovery Guide

> **创建日期**: 2026-01-30  
> **版本**: v0.6.8.3  
> **状态**: ✅ 稳定运行

---

## 📦 当前系统状态快照

### 部署信息
| 组件 | URL | 状态 |
|------|-----|------|
| **Frontend** | https://promptly-v0-6-cloudtest-1.onrender.com | ✅ |
| **Backend** | https://promptly-v0-6-cloudtest-cursor-dev.onrender.com | ✅ |
| **数据库** | SQLite (WAL mode) @ `./data/app.db` | ✅ |

### 数据统计
| 数据类型 | 数量 | 时间范围 |
|---------|------|----------|
| **Users** | 1,368 | 2024-11-29 → 2026-01-30 |
| **Sessions** | 2,513 | 2024-11-29 → 2026-01-30 |
| **Behavior** | 2,513 | 2024-11-29 → 2026-01-30 |
| **Daily** | 64 days | 2024-11-29 → 2026-01-30 |

---

## 🔑 关键文件清单

### 后端核心文件
```
backend/
├── src/
│   ├── server.js                    # Express 主入口
│   ├── routes/
│   │   ├── analyticsDashboard.js    # ⭐ Analytics API 核心
│   │   └── admin.js                 # 数据同步 API
│   └── lib/
│       └── db.js                    # 数据库连接
├── scripts/
│   └── sync-to-cloud.js             # ⭐ 数据同步脚本
├── migrations/
│   └── 002_analytics.js             # Analytics 表结构 + 历史数据生成
└── data/
    └── app.db                       # ⭐ SQLite 数据库文件
```

### 前端核心文件
```
frontend/
├── analytics-dashboard.html         # Dashboard 页面
├── analytics-dashboard.js           # ⭐ Dashboard 逻辑
├── analytics-dashboard.css          # Dashboard 样式
└── config.js                        # API 配置 (自动检测环境)
```

---

## 🔄 恢复流程

### 场景 1: Render 部署后数据丢失

**原因**: Render 免费版没有持久化存储，每次部署会重置数据库

**恢复步骤**:
```bash
# 1. 进入后端目录
cd backend

# 2. 运行数据同步脚本
node scripts/sync-to-cloud.js https://promptly-v0-6-cloudtest-cursor-dev.onrender.com

# 3. 验证数据
curl "https://promptly-v0-6-cloudtest-cursor-dev.onrender.com/api/admin/debug-daily"
```

### 场景 2: 本地数据库损坏

**恢复步骤**:
```bash
# 1. 删除损坏的数据库
rm backend/data/app.db*

# 2. 重新运行迁移
cd backend && npm run migrate

# 3. 迁移会自动生成历史数据 (S-curve)
```

### 场景 3: 完全重建

```bash
# 1. 克隆仓库
git clone https://github.com/MaxonT/Promptly-v0.6-CloudTest.git
cd Promptly-v0.6-CloudTest/Promptly-cloud-v0.6.8.3-fullstack

# 2. 安装依赖
cd backend && npm install

# 3. 运行迁移 (自动生成历史数据)
npm run migrate

# 4. 启动本地服务验证
npm run dev

# 5. 同步到云端
node scripts/sync-to-cloud.js https://promptly-v0-6-cloudtest-cursor-dev.onrender.com
```

---

## 📊 数据库表结构

### analytics_users
```sql
CREATE TABLE analytics_users (
  id TEXT PRIMARY KEY,           -- 格式: au_YYYYMMDD_XXXX
  source TEXT DEFAULT 'organic', -- organic, referral, social, paid
  timezone TEXT DEFAULT 'UTC',   -- 用户时区
  country TEXT DEFAULT 'US',     -- 国家代码
  device_type TEXT,              -- desktop, mobile, tablet
  browser TEXT,                  -- chrome, firefox, safari, edge
  is_active INTEGER DEFAULT 1,   -- 1=活跃, 0=流失
  created_at TEXT NOT NULL,      -- 注册时间
  last_active_at TEXT,           -- 最后活跃时间
  metadata TEXT DEFAULT '{}'     -- JSON 扩展字段
);
```

### analytics_sessions
```sql
CREATE TABLE analytics_sessions (
  id TEXT PRIMARY KEY,           -- 格式: as_YYYYMMDD_XXXX
  user_id TEXT NOT NULL,         -- 关联 analytics_users.id
  session_start TEXT NOT NULL,   -- 会话开始时间
  session_end TEXT,              -- 会话结束时间
  duration_seconds INTEGER,      -- 会话时长(秒)
  page_views INTEGER DEFAULT 1,  -- 页面浏览数
  device_type TEXT,              -- 设备类型
  browser TEXT,                  -- 浏览器
  referrer TEXT,                 -- 来源
  created_at TEXT NOT NULL
);
```

### analytics_behavior
```sql
CREATE TABLE analytics_behavior (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  session_id TEXT,
  recorded_at TEXT NOT NULL,
  mouse_movements INTEGER DEFAULT 0,    -- 鼠标移动次数
  scrolls INTEGER DEFAULT 0,            -- 滚动次数
  clicks INTEGER DEFAULT 0,             -- 点击次数
  typing_events INTEGER DEFAULT 0,      -- 打字事件
  hover_time_ms INTEGER DEFAULT 0,      -- 悬停时间(毫秒)
  bounce_probability REAL DEFAULT 0.15, -- 跳出概率
  return_frequency_days REAL DEFAULT 3.5, -- 回访频率(天)
  engagement_score REAL DEFAULT 50.0    -- 参与度评分 (0-100)
);
```

### analytics_daily
```sql
CREATE TABLE analytics_daily (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT UNIQUE NOT NULL,     -- 日期 YYYY-MM-DD
  unique_users INTEGER,          -- 当日独立用户数
  new_users INTEGER,             -- 新用户数
  returning_users INTEGER,       -- 回访用户数
  total_sessions INTEGER,        -- 总会话数
  total_page_views INTEGER,      -- 总页面浏览
  avg_session_duration INTEGER,  -- 平均会话时长(秒)
  bounce_rate REAL,              -- 跳出率 (0-1)
  cumulative_users INTEGER,      -- 累计用户数
  created_at TEXT NOT NULL
);
```

---

## 🔗 API 端点文档

### GET /api/analytics/dashboard/summary
返回仪表板摘要数据

**响应示例**:
```json
{
  "ok": true,
  "users": { "total": 1368, "newLast24h": 8, "newLast7d": 8, "newLast30d": 8 },
  "today": { "activeUsers": 8, "sessions": 6, "pageViews": 22 },
  "activity": { "dau": 8, "wau": 280, "mau": 1200, "dau_mau_ratio": 0.7 },
  "behavior": { "bounceRate": "12.5", "avgReturnFrequency": "3.5" },
  "engagement": { "avgMouseMovements": "148.0", "avgScrolls": "19.3", ... },
  "timezones": [...],
  "meta": { "dataAsOf": "2026-01-30" }
}
```

### GET /api/analytics/dashboard/timeseries
返回时间序列数据用于图表

**参数**:
- `period=all` - 返回所有历史数据
- `days=N` - 返回最近 N 天数据

**响应示例**:
```json
{
  "ok": true,
  "data": [
    { "date": "2024-11-29", "users": 117, "sessions": 234, "cumulativeUsers": 117 },
    ...
  ],
  "meta": { "latestDate": "2026-01-30", "recordCount": 64 }
}
```

### POST /api/admin/sync-data
接收并存储同步数据

**请求体**:
```json
{
  "analytics": {
    "users": [...],
    "sessions": [...],
    "behavior": [...],
    "daily": [...]
  }
}
```

### GET /api/admin/debug-daily
调试端点，查看 daily 表内容

---

## ⚠️ 重要注意事项

### Render 持久化问题
- **问题**: Render 免费版每次部署会重置文件系统
- **解决**: 每次部署后运行 `sync-to-cloud.js`
- **建议**: 考虑升级到 Render 付费版或使用外部 PostgreSQL

### 数据时间跨度
- **历史数据**: 2024-11-29 → 2025-01-30 (由 migration 生成的 S-curve 模拟数据)
- **当前数据**: 2026-01-30 (行为模拟器实时生成)
- **空白期**: 2025-01-31 → 2026-01-29 (约1年无数据)

### Git 提交历史
关键提交:
- `efe077d` - fix: 修复图表显示和 bounceRate 计算问题
- `ee6b9d7` - fix: 修正 behavior 表结构和插入逻辑
- `d56685a` - feat: 完善行为数据同步功能
- `b3e15f1` - feat: timeseries API 支持 period=all

---

## 🆘 紧急联系

如果系统出现问题:
1. 首先检查 Render Dashboard 的部署日志
2. 运行 `curl https://promptly-v0-6-cloudtest-cursor-dev.onrender.com/api/health`
3. 按照上述恢复流程操作

---

*最后更新: 2026-01-30*
