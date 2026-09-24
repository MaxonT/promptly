# Analytics Dashboard 集成指南

本指南详细说明如何将 Analytics Dashboard 模板集成到您的现有项目中。

## 目录

1. [准备工作](#准备工作)
2. [后端集成](#后端集成)
3. [前端集成](#前端集成)
4. [数据库设置](#数据库设置)
5. [模拟器配置](#模拟器配置)
6. [验证测试](#验证测试)

---

## 准备工作

### 系统要求

- **Node.js**: 16.x 或更高版本
- **Python**: 3.8+ (用于行为模拟器)
- **SQLite**: 3.x
- **npm/yarn**: 最新版本

### 依赖包

```bash
# 必需的 npm 包
npm install better-sqlite3 express
```

---

## 后端集成

### 步骤 1: 复制文件

将后端文件复制到您的项目:

```bash
# 复制路由模块
cp template-analytics-dashboard/backend/routes/analyticsDashboard.js \
   your-project/src/routes/

# 复制辅助函数库
cp template-analytics-dashboard/backend/lib/analyticsHelper.js \
   your-project/src/lib/

# 复制迁移文件
cp template-analytics-dashboard/backend/migrations/002_analytics.js \
   your-project/migrations/
```

### 步骤 2: 在主服务器中挂载路由

```javascript
// server.js 或 app.js

import express from 'express';
import { analyticsDashboardRouter, setDatabase } from './routes/analyticsDashboard.js';
import Database from 'better-sqlite3';

const app = express();

// 初始化数据库
const db = new Database(process.env.SQLITE_PATH || './data/app.db');
db.pragma('journal_mode = WAL');

// 注入数据库到 analytics 路由
setDatabase(db);

// 挂载路由
app.use('/api/analytics/dashboard', analyticsDashboardRouter);

// 启动服务器
app.listen(8080, () => {
  console.log('Server running on http://localhost:8080');
});
```

### 步骤 3: 配置中间件

确保以下中间件已配置:

```javascript
import express from 'express';
import cors from 'cors';

const app = express();

// JSON 解析
app.use(express.json());

// CORS (根据需要配置)
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Key']
}));
```

---

## 前端集成

### 选项 A: 独立页面

直接复制前端文件:

```bash
# 复制所有前端文件
cp template-analytics-dashboard/frontend/* your-project/public/
```

然后访问 `/analytics-dashboard.html`。

### 选项 B: 嵌入现有页面

1. **添加 CSS**:

```html
<link rel="stylesheet" href="/css/analytics-dashboard.css">
```

2. **添加 HTML 容器**:

```html
<div id="analytics-dashboard-container">
  <!-- Dashboard 内容将在此渲染 -->
</div>
```

3. **引入 JavaScript**:

```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>
<script src="/js/analytics-dashboard.js"></script>
<script>
  // 配置 API 基础地址
  window.ANALYTICS_API_BASE = 'http://your-api.example.com';
  
  // 初始化仪表盘
  document.addEventListener('DOMContentLoaded', function() {
    AnalyticsDashboard.init({
      container: '#analytics-dashboard-container',
      refreshInterval: 60000
    });
  });
</script>
```

### 选项 C: React/Vue 组件包装

如果您使用 React:

```jsx
// AnalyticsDashboard.jsx
import { useEffect, useRef } from 'react';
import './analytics-dashboard.css';

export function AnalyticsDashboard({ apiBase }) {
  const containerRef = useRef(null);
  
  useEffect(() => {
    // 加载 Chart.js
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js';
    script.onload = () => {
      window.ANALYTICS_API_BASE = apiBase;
      // 初始化逻辑
      initDashboard(containerRef.current);
    };
    document.body.appendChild(script);
    
    return () => {
      document.body.removeChild(script);
    };
  }, [apiBase]);
  
  return <div ref={containerRef} className="analytics-dashboard" />;
}
```

---

## 数据库设置

### 运行迁移

```bash
# 设置数据库路径
export SQLITE_PATH=./data/analytics.db

# 运行迁移
node migrations/002_analytics.js
```

迁移将:
1. 创建 4 个表: `analytics_users`, `analytics_sessions`, `analytics_behavior`, `analytics_daily`
2. 创建必要的索引
3. 生成 90 天的历史数据

### 自定义 S-曲线参数

编辑迁移文件中的配置:

```javascript
const S_CURVE_CONFIG = {
  targetUsers: 2000,       // 目标用户数
  growthRate: 0.08,        // 增长率 (k)
  inflectionPoint: 40,     // 拐点天数 (x₀)
  projectStartDate: null,  // 自动设置
  dataEndDate: null        // 自动设置
};
```

### 使用现有数据库

如果您的项目已有数据库:

```javascript
import { setDatabase } from './routes/analyticsDashboard.js';

// 使用现有的数据库连接
setDatabase(yourExistingDbConnection);
```

---

## 模拟器配置

### 基本使用

```bash
cd simulator

# 测试运行 (2轮)
python3 behavior-simulator-test.py

# 正式运行
python3 behavior-simulator.py --rounds 100 --interval 60
```

### 作为后台服务运行 (macOS)

```bash
# 安装服务
./install-service.sh http://your-api.example.com

# 查看状态
launchctl list | grep behavior-simulator

# 查看日志
tail -f /tmp/analytics-simulator.log

# 卸载服务
./uninstall-service.sh
```

### 自定义配置

创建配置文件:

```json
{
  "rounds": -1,
  "interval_seconds": 60,
  "base_users_per_hour": 5,
  "max_users_per_hour": 20,
  "sessions_per_user_ratio": 2.0
}
```

使用:

```bash
python3 behavior-simulator.py --config my-config.json
```

---

## 验证测试

### 1. 检查 API 健康状态

```bash
curl http://localhost:8080/api/analytics/dashboard/health
```

预期响应:

```json
{
  "ok": true,
  "status": "healthy",
  "database": "connected",
  "tablesExist": true
}
```

### 2. 获取摘要数据

```bash
curl http://localhost:8080/api/analytics/dashboard/summary
```

### 3. 测试时间序列

```bash
curl "http://localhost:8080/api/analytics/dashboard/timeseries?days=7"
```

### 4. 测试追踪端点

```bash
# 追踪用户
curl -X POST http://localhost:8080/api/analytics/dashboard/track/user \
  -H "Content-Type: application/json" \
  -d '{"userId": "test_user_001", "source": "direct"}'

# 追踪会话
curl -X POST http://localhost:8080/api/analytics/dashboard/track/session-start \
  -H "Content-Type: application/json" \
  -d '{"userId": "test_user_001", "sessionId": "session_001"}'
```

### 5. 运行完整测试套件

```bash
./tests/test-integration.sh
```

---

## 常见集成模式

### 模式 1: 完全独立

Analytics Dashboard 作为独立子系统:

```
your-app/
├── src/
│   ├── routes/
│   │   ├── analyticsDashboard.js  # 独立路由
│   │   └── ... (其他路由)
│   └── ...
├── public/
│   ├── analytics-dashboard.html   # 独立页面
│   └── ...
└── data/
    └── analytics.db               # 独立数据库
```

### 模式 2: 集成到现有用户系统

将 analytics 与现有用户系统关联:

```javascript
// 在用户注册时追踪
app.post('/api/users/register', async (req, res) => {
  // 创建用户...
  const user = await createUser(req.body);
  
  // 追踪到 analytics
  await fetch('/api/analytics/dashboard/track/user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userId: user.id,
      source: req.body.referrer || 'direct'
    })
  });
  
  res.json({ ok: true, user });
});
```

### 模式 3: 微服务架构

Analytics 作为独立服务:

```
                    ┌──────────────────┐
                    │  Analytics API   │
                    │  (Port 8081)     │
                    └────────┬─────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   Main App    │    │   Frontend    │    │   Simulator   │
│   (Port 8080) │    │   (Static)    │    │   (Python)    │
└───────────────┘    └───────────────┘    └───────────────┘
```

---

## 下一步

- 阅读 [API 参考](API_REFERENCE.md) 了解所有端点详情
- 查看 [定制指南](CUSTOMIZATION_GUIDE.md) 自定义外观
- 参考 [部署指南](DEPLOYMENT_GUIDE.md) 进行生产部署
