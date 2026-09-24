# Analytics Dashboard 定制指南

本指南帮助您自定义 Analytics Dashboard 的外观和功能。

## 目录

1. [主题定制](#主题定制)
2. [指标定制](#指标定制)
3. [图表定制](#图表定制)
4. [S-曲线参数](#s-曲线参数)
5. [API 扩展](#api-扩展)
6. [高级定制](#高级定制)

---

## 主题定制

### CSS 变量

所有主题颜色都通过 CSS 变量定义，可在 `:root` 中修改:

```css
:root {
  /* 主色调 */
  --primary-color: #667eea;
  --secondary-color: #764ba2;
  --accent-color: #00d4ff;
  
  /* 背景渐变 */
  --bg-gradient-start: #0f0c29;
  --bg-gradient-middle: #302b63;
  --bg-gradient-end: #24243e;
  
  /* Glassmorphism 效果 */
  --glass-bg: rgba(255, 255, 255, 0.1);
  --glass-border: rgba(255, 255, 255, 0.2);
  --glass-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
  --glass-blur: 8px;
  
  /* 文字颜色 */
  --text-primary: rgba(255, 255, 255, 0.95);
  --text-secondary: rgba(255, 255, 255, 0.7);
  --text-muted: rgba(255, 255, 255, 0.5);
  
  /* 图表颜色 */
  --chart-line-users: #00d4ff;
  --chart-line-sessions: #667eea;
  --chart-fill-users: rgba(0, 212, 255, 0.2);
  --chart-fill-sessions: rgba(102, 126, 234, 0.2);
  
  /* 状态颜色 */
  --success-color: #00d4aa;
  --warning-color: #ffd700;
  --error-color: #ff6b6b;
}
```

### 预设主题

#### 深色主题 (默认)

```css
:root {
  --bg-gradient-start: #0f0c29;
  --bg-gradient-middle: #302b63;
  --bg-gradient-end: #24243e;
  --glass-bg: rgba(255, 255, 255, 0.1);
  --text-primary: rgba(255, 255, 255, 0.95);
}
```

#### 浅色主题

```css
:root {
  --bg-gradient-start: #f5f7fa;
  --bg-gradient-middle: #e4e7eb;
  --bg-gradient-end: #c3cfe2;
  --glass-bg: rgba(255, 255, 255, 0.7);
  --glass-border: rgba(200, 200, 200, 0.3);
  --text-primary: rgba(0, 0, 0, 0.85);
  --text-secondary: rgba(0, 0, 0, 0.65);
}
```

#### 霓虹主题

```css
:root {
  --primary-color: #ff00ff;
  --secondary-color: #00ffff;
  --accent-color: #ff0080;
  --bg-gradient-start: #000000;
  --bg-gradient-middle: #1a0a2e;
  --bg-gradient-end: #0a0a0a;
  --glass-bg: rgba(255, 0, 255, 0.1);
  --glass-border: rgba(0, 255, 255, 0.3);
}
```

### 粒子效果定制

在 `config.js` 中修改粒子配置:

```javascript
ANALYTICS_CONFIG.particles = {
  enabled: true,           // 是否启用
  count: 50,               // 粒子数量
  colors: [
    'rgba(255, 255, 255, 0.3)',
    'rgba(102, 126, 234, 0.3)',
    'rgba(0, 212, 255, 0.3)'
  ],
  sizeRange: [2, 6],       // 大小范围 [最小, 最大]
  speedRange: [0.5, 2],    // 速度范围
  floatRange: [10, 30]     // 浮动范围
};
```

禁用粒子效果:

```javascript
ANALYTICS_CONFIG.particles.enabled = false;
```

---

## 指标定制

### 修改目标值

在前端 `config.js`:

```javascript
ANALYTICS_CONFIG.goals = {
  totalUsers: 10000,       // 总用户目标
  dailyActiveUsers: 1000,  // DAU 目标
  monthlyActiveUsers: 5000 // MAU 目标 (可选)
};
```

在后端配置中同步:

```javascript
// analyticsDashboard.js
const CONFIG = {
  goals: {
    totalUsers: 10000,
    dailyActiveUsers: 1000
  }
};
```

### 添加自定义指标卡片

1. **添加 HTML**:

```html
<div class="metric-card">
  <div class="metric-icon">
    <span class="icon">💰</span>
  </div>
  <div class="metric-content">
    <div class="metric-value" id="revenue-value">$0</div>
    <div class="metric-label">Monthly Revenue</div>
    <div class="metric-change positive">
      <span class="arrow">↑</span>
      <span id="revenue-change">0%</span>
    </div>
  </div>
</div>
```

2. **添加 JavaScript 更新逻辑**:

```javascript
function updateRevenueCard(data) {
  const revenueEl = document.getElementById('revenue-value');
  const changeEl = document.getElementById('revenue-change');
  
  if (revenueEl && data.revenue) {
    revenueEl.textContent = formatCurrency(data.revenue);
    changeEl.textContent = `${data.revenueChange}%`;
  }
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(value);
}
```

### 隐藏特定指标

```css
/* 隐藏时区分布 */
.timezone-distribution {
  display: none;
}

/* 隐藏行为指标 */
.behavior-metrics {
  display: none;
}
```

---

## 图表定制

### 修改图表颜色

```javascript
// config.js
ANALYTICS_CONFIG.chartColors = {
  users: {
    line: '#00d4ff',
    fill: 'rgba(0, 212, 255, 0.2)'
  },
  sessions: {
    line: '#667eea',
    fill: 'rgba(102, 126, 234, 0.2)'
  },
  newUsers: {
    bar: '#764ba2'
  }
};
```

### 修改图表类型

```javascript
// analytics-dashboard.js 中的 initCharts 函数

// 将折线图改为柱状图
const userChart = new Chart(ctx, {
  type: 'bar',  // 改为 'bar'
  data: {...},
  options: {...}
});
```

### 添加新图表

```javascript
// 添加饼图显示设备分布
function createDeviceChart(data) {
  const ctx = document.getElementById('device-chart').getContext('2d');
  
  return new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Desktop', 'Mobile', 'Tablet'],
      datasets: [{
        data: [data.desktop, data.mobile, data.tablet],
        backgroundColor: [
          'rgba(102, 126, 234, 0.8)',
          'rgba(0, 212, 255, 0.8)',
          'rgba(118, 75, 162, 0.8)'
        ]
      }]
    },
    options: {
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: 'rgba(255, 255, 255, 0.8)' }
        }
      }
    }
  });
}
```

### 自定义时间范围选择器

```javascript
// 添加更多时间范围选项
const timeRanges = [
  { label: '7 Days', value: 7 },
  { label: '14 Days', value: 14 },
  { label: '30 Days', value: 30 },
  { label: '90 Days', value: 90 },   // 新增
  { label: 'All Time', value: 365 }  // 新增
];

// 在 HTML 中
<select id="time-range" class="time-selector">
  <option value="7">7 Days</option>
  <option value="14" selected>14 Days</option>
  <option value="30">30 Days</option>
  <option value="90">90 Days</option>
  <option value="365">All Time</option>
</select>
```

---

## S-曲线参数

### 理解参数

S-曲线公式: `f(x) = L / (1 + e^(-k(x - x₀)))`

| 参数 | 含义 | 典型范围 | 效果 |
|------|------|----------|------|
| L | 目标用户数 | 500-50000 | 最终渐近线 |
| k | 增长率 | 0.04-0.20 | 越大增长越陡峭 |
| x₀ | 拐点天数 | 20-120 | 达到50%用户的天数 |

### 预设场景

```javascript
// backend/migrations/002_analytics.js

// 场景1: 快速增长 (Product Hunt 首发)
const RAPID_GROWTH = {
  targetUsers: 5000,
  growthRate: 0.12,
  inflectionPoint: 30
};

// 场景2: 稳定增长 (企业SaaS)
const STEADY_GROWTH = {
  targetUsers: 2000,
  growthRate: 0.08,
  inflectionPoint: 45
};

// 场景3: 慢热型 (B2B产品)
const SLOW_GROWTH = {
  targetUsers: 1000,
  growthRate: 0.05,
  inflectionPoint: 60
};

// 场景4: 病毒式增长
const VIRAL_GROWTH = {
  targetUsers: 10000,
  growthRate: 0.18,
  inflectionPoint: 20
};
```

### 可视化参数效果

```javascript
// 计算不同参数的效果
function visualizeGrowth(L, k, x0, days) {
  const data = [];
  for (let x = 0; x <= days; x++) {
    const users = L / (1 + Math.exp(-k * (x - x0)));
    data.push({ day: x, users: Math.round(users) });
  }
  return data;
}

// 示例
console.log(visualizeGrowth(2000, 0.08, 40, 90));
```

---

## API 扩展

### 添加新端点

```javascript
// analyticsDashboard.js

// 添加设备统计端点
analyticsDashboardRouter.get("/devices", (req, res) => {
  const database = getDb();
  
  const devices = database.prepare(`
    SELECT device_type, COUNT(*) as count
    FROM analytics_users
    GROUP BY device_type
  `).all();
  
  res.json({ ok: true, devices });
});

// 添加来源统计端点
analyticsDashboardRouter.get("/sources", (req, res) => {
  const database = getDb();
  
  const sources = database.prepare(`
    SELECT source, COUNT(*) as count
    FROM analytics_users
    GROUP BY source
    ORDER BY count DESC
    LIMIT 10
  `).all();
  
  res.json({ ok: true, sources });
});
```

### 添加自定义追踪事件

```javascript
// 新的追踪端点
analyticsDashboardRouter.post("/track/custom-event", (req, res) => {
  const { userId, eventName, eventData } = req.body;
  
  // 存储到自定义事件表
  database.prepare(`
    INSERT INTO analytics_custom_events (user_id, event_name, event_data, created_at)
    VALUES (?, ?, ?, datetime('now'))
  `).run(userId, eventName, JSON.stringify(eventData));
  
  res.json({ ok: true });
});
```

### 添加导出功能

```javascript
// CSV 导出
analyticsDashboardRouter.get("/export/csv", (req, res) => {
  const { startDate, endDate } = req.query;
  
  const data = database.prepare(`
    SELECT * FROM analytics_daily
    WHERE date BETWEEN ? AND ?
    ORDER BY date
  `).all(startDate, endDate);
  
  // 生成 CSV
  const csv = convertToCSV(data);
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=analytics.csv');
  res.send(csv);
});

function convertToCSV(data) {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]).join(',');
  const rows = data.map(row => Object.values(row).join(','));
  return [headers, ...rows].join('\n');
}
```

---

## 高级定制

### 多租户支持

```javascript
// 添加租户ID支持
analyticsDashboardRouter.get("/summary", (req, res) => {
  const tenantId = req.headers['x-tenant-id'] || 'default';
  
  const users = database.prepare(`
    SELECT COUNT(*) as count FROM analytics_users
    WHERE tenant_id = ?
  `).get(tenantId);
  
  // ...
});
```

### 实时数据 (WebSocket)

```javascript
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8081 });

// 广播更新
function broadcastUpdate(data) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// 在追踪端点中触发
analyticsDashboardRouter.post("/track/user", (req, res) => {
  // ... 保存逻辑
  
  // 广播更新
  broadcastUpdate({ type: 'NEW_USER', userId: req.body.userId });
  
  res.json({ ok: true });
});
```

### 缓存层

```javascript
// 使用简单的内存缓存
const cache = new Map();
const CACHE_TTL = 60 * 1000; // 60秒

function getCached(key, fetchFn) {
  const cached = cache.get(key);
  
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return cached.data;
  }
  
  const data = fetchFn();
  cache.set(key, { data, time: Date.now() });
  return data;
}

// 在 summary 端点使用
analyticsDashboardRouter.get("/summary", (req, res) => {
  const data = getCached('summary', () => {
    // 获取数据库数据...
    return summaryData;
  });
  
  res.json(data);
});
```

### 国际化 (i18n)

```javascript
// 前端 i18n 支持
const translations = {
  en: {
    totalUsers: 'Total Users',
    dailyActive: 'Daily Active',
    weeklyActive: 'Weekly Active',
    bounceRate: 'Bounce Rate'
  },
  zh: {
    totalUsers: '总用户数',
    dailyActive: '日活跃',
    weeklyActive: '周活跃',
    bounceRate: '跳出率'
  }
};

function t(key, lang = 'en') {
  return translations[lang]?.[key] || key;
}

// 使用
document.getElementById('total-users-label').textContent = t('totalUsers', 'zh');
```

---

## 最佳实践

1. **不要直接修改模板文件** - 复制后再修改
2. **使用 CSS 变量** - 方便主题切换
3. **保持 API 兼容性** - 扩展而非修改现有端点
4. **添加单元测试** - 自定义功能需要测试覆盖
5. **文档化修改** - 记录所有自定义变更

---

## 下一步

- [部署指南](DEPLOYMENT_GUIDE.md) - 生产环境部署
- [故障排除](TROUBLESHOOTING.md) - 常见问题解决
