# 📊 Promptly Analytics Dashboard

> **生产就绪的三件套：数据迁移 + 前端仪表盘 + 行为模拟器**

## 🎯 概览

| 组件 | 位置 | 功能 |
|:----:|:-----|:-----|
| 📈 | `frontend/analytics-dashboard.html` | 前端仪表盘页面 |
| 🔌 | `backend/src/routes/analyticsDashboard.js` | API 端点 |
| 🗄️ | `backend/migrations/002_analytics.js` | 数据库迁移 & S-曲线数据生成 |
| 🤖 | `scripts/BehaviorSimulator.sh` | 24/7 行为模拟器 |

---

## 🚀 快速启动 (5分钟)

### Step 1: 运行数据库迁移

```bash
cd backend
node migrations/run-analytics-migration.js
```

这将:
- 创建 analytics 相关数据表
- 使用 S-曲线算法生成 2024-11-29 至 2025-01-30 的历史数据
- 初始化 2123 个用户的增长数据

### Step 2: 启动后端服务

```bash
cd backend
npm run dev
```

### Step 3: 访问 Dashboard

打开浏览器访问: `http://localhost:5173/analytics-dashboard.html`

或在 VS Code 中:
1. 安装 Live Server 扩展
2. 右键 `frontend/analytics-dashboard.html` → "Open with Live Server"

---

## 📊 数据规范参数

| 参数 | 值 | 说明 |
|------|:---:|------|
| 项目开始日期 | 2024-11-29 | 数据起始点 |
| 数据截止日期 | 2025-01-30 | 历史数据终点 |
| 目标用户数 | 2123 | S-曲线最终值 |
| 目标 DAU | 350 | 日活用户目标 |
| S-曲线 k | 0.12 | 增长率（较慢自然增长） |
| S-曲线 x0 | 32 | 拐点位置（第32天） |

---

## 🔌 API 端点

### GET `/api/analytics/dashboard/summary`
返回仪表盘摘要数据（用户数、DAU/WAU/MAU、时区分布等）

### GET `/api/analytics/dashboard/timeseries?days=14`
返回时间序列数据用于图表

### POST `/api/analytics/dashboard/admin/generate-data`
管理员端点：生成模拟数据（供 BehaviorSimulator 使用）

```json
{
  "users": 5,
  "sessions": 10
}
```

---

## 🤖 行为模拟器

### 测试模式
```bash
chmod +x scripts/BehaviorSimulator.sh
./scripts/BehaviorSimulator.sh --test
```

### 正式运行（24/7）
```bash
# 前台运行（可见日志）
./scripts/BehaviorSimulator.sh

# 后台运行
nohup ./scripts/BehaviorSimulator.sh > /dev/null 2>&1 &
```

### 环境变量
```bash
export PROMPTLY_API_URL=http://localhost:8080   # 后端地址
export ADMIN_API_KEY=your-secret-key            # 可选：管理员密钥
```

### 健康检查
```bash
./scripts/analytics-health-check.sh
```

---

## 📁 文件结构

```
Promptly-cloud-v0.6.8.3-fullstack/
├── backend/
│   ├── migrations/
│   │   ├── 002_analytics.js           # 数据库迁移 + S-曲线生成
│   │   └── run-analytics-migration.js # 迁移运行脚本
│   └── src/routes/
│       └── analyticsDashboard.js      # API 端点
├── frontend/
│   ├── analytics-dashboard.html       # 仪表盘页面
│   ├── analytics-dashboard.js         # 仪表盘逻辑
│   └── analytics-dashboard.css        # 仪表盘样式
├── scripts/
│   ├── BehaviorSimulator.sh           # 行为模拟器
│   └── analytics-health-check.sh      # 健康检查脚本
└── ANALYTICS_DASHBOARD_GUIDE.md       # 本文档
```

---

## 🎨 自定义配置

### 修改目标指标

编辑 `backend/src/routes/analyticsDashboard.js`:

```javascript
const CONFIG = {
  goals: {
    totalUsers: 5000,      // 修改目标用户数
    dailyActiveUsers: 500, // 修改目标 DAU
  }
};
```

### 修改 S-曲线参数

编辑 `backend/migrations/002_analytics.js`:

```javascript
const CONFIG = {
  projectStartDate: '2024-11-29',  // 开始日期
  dataEndDate: '2025-01-30',       // 结束日期
  targetUsers: 2123,               // 目标用户
  targetDAU: 350,                  // 目标 DAU
  sGrowthK: 0.12,                  // 增长率
  sGrowthX0: 32,                   // 拐点位置
};
```

### 修改品牌颜色

编辑 `frontend/analytics-dashboard.css`:

```css
.goal-bar-users {
  background: linear-gradient(90deg, #your-color-1, #your-color-2);
}
```

---

## 🐛 常见问题

### Q: Dashboard 显示空白数据？
**A:** 确保已运行迁移脚本:
```bash
cd backend && node migrations/run-analytics-migration.js
```

### Q: 模拟器报 "Network connection failed"？
**A:** 检查后端服务是否运行:
```bash
curl http://localhost:8080/api/health
```

### Q: 如何重置数据？
**A:** 运行 rollback 然后重新迁移:
```bash
cd backend
node migrations/run-analytics-migration.js down
node migrations/run-analytics-migration.js
```

---

## 📊 Dashboard 指标说明

| 指标 | 英文 | 说明 |
|------|------|------|
| 日活 | DAU | Daily Active Users - 今日活跃用户 |
| 周活 | WAU | Weekly Active Users - 7天累计活跃 |
| 月活 | MAU | Monthly Active Users - 30天累计活跃 |
| 粘性 | Stickiness | DAU/MAU 比率 - 用户粘性指标 |
| 跳出率 | Bounce Rate | 只访问一页就离开的比例 |
| 回访频率 | Return Frequency | 用户平均回访间隔天数 |

---

*Analytics Dashboard v1.0.0 | 基于 MeetMesh Engine 模板*
