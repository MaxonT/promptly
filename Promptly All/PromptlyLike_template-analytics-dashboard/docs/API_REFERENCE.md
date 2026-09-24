# Analytics Dashboard API 参考

完整的 API 端点文档。

## 基础信息

- **基础 URL**: `/api/analytics/dashboard`
- **内容类型**: `application/json`
- **认证**: 追踪端点无需认证，管理端点需要 `X-Admin-Key` 头

---

## 端点概览

| 端点 | 方法 | 说明 | 认证 |
|------|------|------|------|
| `/health` | GET | 健康检查 | 否 |
| `/summary` | GET | 仪表盘摘要 | 否 |
| `/timeseries` | GET | 时间序列数据 | 否 |
| `/growth` | GET | 增长数据 | 否 |
| `/track/user` | POST | 追踪用户 | 否 |
| `/track/session-start` | POST | 追踪会话开始 | 否 |
| `/track/session-end` | POST | 追踪会话结束 | 否 |
| `/track/behavior` | POST | 追踪行为 | 否 |
| `/admin/generate-data` | POST | 生成数据 | 是 |

---

## GET /health

健康检查端点。

### 请求

```bash
curl http://localhost:8080/api/analytics/dashboard/health
```

### 响应

```json
{
  "ok": true,
  "status": "healthy",
  "database": "connected",
  "tablesExist": true,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 响应字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `ok` | boolean | 请求是否成功 |
| `status` | string | 服务状态: `healthy` 或 `unhealthy` |
| `database` | string | 数据库连接状态 |
| `tablesExist` | boolean | analytics 表是否存在 |
| `timestamp` | string | 响应时间戳 |

---

## GET /summary

获取仪表盘摘要数据，包含用户统计、活跃度指标、时区分布等。

### 请求

```bash
curl http://localhost:8080/api/analytics/dashboard/summary
```

### 响应

```json
{
  "ok": true,
  "users": {
    "total": 1523,
    "newLast24h": 45,
    "newLast7d": 312,
    "newLast30d": 890
  },
  "today": {
    "activeUsers": 234,
    "sessions": 456,
    "pageViews": 1289
  },
  "activity": {
    "dau": 234,
    "wau": 856,
    "mau": 1523,
    "dau_mau_ratio": 15.4
  },
  "behavior": {
    "bounceRate": "23.5",
    "avgReturnFrequency": "3.2"
  },
  "timezones": [
    { "timezone": "America/New_York", "count": 234, "uniqueEvents": 234 },
    { "timezone": "Europe/London", "count": 189, "uniqueEvents": 189 }
  ],
  "engagement": {
    "avgMouseMovements": "156.3",
    "avgScrolls": "24.7",
    "avgClicks": "12.8",
    "avgTypingEvents": "45.2"
  },
  "goals": {
    "totalUsers": 5000,
    "dailyActiveUsers": 500
  },
  "meta": {
    "dataAsOf": "2024-01-15",
    "latestUserActivity": "2024-01-15T10:25:00.000Z"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 响应字段详解

#### users

| 字段 | 类型 | 说明 |
|------|------|------|
| `total` | number | 总用户数 |
| `newLast24h` | number | 最近24小时新用户 |
| `newLast7d` | number | 最近7天新用户 |
| `newLast30d` | number | 最近30天新用户 |

#### activity

| 字段 | 类型 | 说明 |
|------|------|------|
| `dau` | number | 日活跃用户 (Daily Active Users) |
| `wau` | number | 周活跃用户 (Weekly Active Users) |
| `mau` | number | 月活跃用户 (Monthly Active Users) |
| `dau_mau_ratio` | number | DAU/MAU 比率 (粘性指标，0-100) |

#### behavior

| 字段 | 类型 | 说明 |
|------|------|------|
| `bounceRate` | string | 跳出率 (%) |
| `avgReturnFrequency` | string | 平均回访频率 (天) |

#### timezones

数组，按用户数量降序排列的时区分布。

| 字段 | 类型 | 说明 |
|------|------|------|
| `timezone` | string | 时区名称 (IANA) |
| `count` | number | 用户数 |
| `uniqueEvents` | number | 唯一事件数 |

---

## GET /timeseries

获取时间序列数据，用于图表展示。

### 请求

```bash
# 默认获取14天数据
curl http://localhost:8080/api/analytics/dashboard/timeseries

# 指定天数
curl "http://localhost:8080/api/analytics/dashboard/timeseries?days=30"
```

### 参数

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `days` | number | 14 | 获取天数 (1-365) |

### 响应

```json
{
  "ok": true,
  "data": [
    {
      "date": "2024-01-01",
      "users": 45,
      "sessions": 89,
      "newUsers": 12,
      "cumulativeUsers": 1234,
      "bounceRate": 0.23,
      "label": "Jan 1",
      "timestamp": "2024-01-01"
    },
    {
      "date": "2024-01-02",
      "users": 52,
      "sessions": 98,
      "newUsers": 15,
      "cumulativeUsers": 1249,
      "bounceRate": 0.21,
      "label": "Jan 2",
      "timestamp": "2024-01-02"
    }
  ],
  "meta": {
    "latestDate": "2024-01-15",
    "days": 14,
    "recordCount": 14
  }
}
```

### data 数组字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `date` | string | 日期 (YYYY-MM-DD) |
| `users` | number | 当日活跃用户数 |
| `sessions` | number | 当日会话数 |
| `newUsers` | number | 当日新用户数 |
| `cumulativeUsers` | number | 累计用户数 |
| `bounceRate` | number | 当日跳出率 (0-1) |
| `label` | string | 显示标签 (如 "Jan 15") |
| `timestamp` | string | 时间戳 |

---

## GET /growth

获取用户增长数据。

### 请求

```bash
curl http://localhost:8080/api/analytics/dashboard/growth
```

### 响应

```json
{
  "ok": true,
  "daily": [
    { "date": "2024-01-01", "new_users": 12, "cumulative_users": 1234 },
    { "date": "2024-01-02", "new_users": 15, "cumulative_users": 1249 }
  ],
  "weekly": [
    { "week": "2024-W01", "newUsers": 89, "cumulativeUsers": 1300 },
    { "week": "2024-W02", "newUsers": 112, "cumulativeUsers": 1412 }
  ]
}
```

---

## POST /track/user

追踪新用户注册。

### 请求

```bash
curl -X POST http://localhost:8080/api/analytics/dashboard/track/user \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_abc123",
    "source": "google",
    "timezone": "America/New_York",
    "deviceType": "desktop",
    "browser": "Chrome"
  }'
```

### 请求体

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `userId` | string | ✅ | 用户唯一ID |
| `source` | string | 否 | 来源 (默认: "direct") |
| `timezone` | string | 否 | 时区 (默认: "UTC") |
| `deviceType` | string | 否 | 设备类型 (默认: "desktop") |
| `browser` | string | 否 | 浏览器 (默认: "Chrome") |

### 响应

```json
{
  "ok": true,
  "userId": "user_abc123"
}
```

如果用户已存在:

```json
{
  "ok": true,
  "message": "user already exists"
}
```

---

## POST /track/session-start

追踪会话开始。

### 请求

```bash
curl -X POST http://localhost:8080/api/analytics/dashboard/track/session-start \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_abc123",
    "sessionId": "session_xyz789",
    "deviceType": "mobile",
    "browser": "Safari"
  }'
```

### 请求体

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `sessionId` | string | ✅ | 会话唯一ID |
| `userId` | string | 否 | 用户ID (默认: "anonymous") |
| `deviceType` | string | 否 | 设备类型 |
| `browser` | string | 否 | 浏览器 |

### 响应

```json
{
  "ok": true,
  "sessionId": "session_xyz789"
}
```

---

## POST /track/session-end

追踪会话结束。

### 请求

```bash
curl -X POST http://localhost:8080/api/analytics/dashboard/track/session-end \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "session_xyz789",
    "duration": 180,
    "pageViews": 5
  }'
```

### 请求体

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `sessionId` | string | ✅ | 会话ID |
| `duration` | number | 否 | 会话时长 (秒) |
| `pageViews` | number | 否 | 页面浏览数 |

### 响应

```json
{
  "ok": true,
  "sessionId": "session_xyz789"
}
```

---

## POST /track/behavior

追踪用户行为数据。

### 请求

```bash
curl -X POST http://localhost:8080/api/analytics/dashboard/track/behavior \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_abc123",
    "sessionId": "session_xyz789",
    "mouseMovements": 150,
    "scrolls": 25,
    "clicks": 12,
    "typingEvents": 45
  }'
```

### 请求体

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `userId` | string | 否 | 用户ID |
| `sessionId` | string | 否 | 会话ID |
| `mouseMovements` | number | 否 | 鼠标移动次数 |
| `scrolls` | number | 否 | 滚动次数 |
| `clicks` | number | 否 | 点击次数 |
| `typingEvents` | number | 否 | 打字事件数 |

### 响应

```json
{
  "ok": true
}
```

---

## POST /admin/generate-data

管理员端点：生成模拟数据。主要供行为模拟器使用。

### 认证

需要 `X-Admin-Key` 头:

```bash
curl -X POST http://localhost:8080/api/analytics/dashboard/admin/generate-data \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: your-admin-api-key" \
  -d '{"users": 5, "sessions": 10}'
```

### 请求体

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `users` | number | 否 | 要生成的新用户数 |
| `sessions` | number | 否 | 要生成的新会话数 |

### 响应

```json
{
  "ok": true,
  "generated": {
    "users": 5,
    "sessions": 10
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### 错误响应

未授权:

```json
{
  "ok": false,
  "error": "Unauthorized"
}
```

---

## 错误处理

### 通用错误格式

```json
{
  "ok": false,
  "error": "Error message"
}
```

### HTTP 状态码

| 状态码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未授权 (管理端点) |
| 500 | 服务器内部错误 |

### 常见错误

```json
// 缺少必填字段
{
  "ok": false,
  "error": "userId required"
}

// 数据库未初始化
{
  "ok": false,
  "error": "Analytics database not initialized. Call setDatabase() first."
}
```

---

## SDK 使用示例

### JavaScript

```javascript
class AnalyticsClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }
  
  async trackUser(userId, options = {}) {
    const response = await fetch(`${this.baseUrl}/track/user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...options })
    });
    return response.json();
  }
  
  async trackSessionStart(sessionId, userId) {
    const response = await fetch(`${this.baseUrl}/track/session-start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, userId })
    });
    return response.json();
  }
  
  async getSummary() {
    const response = await fetch(`${this.baseUrl}/summary`);
    return response.json();
  }
}

// 使用
const analytics = new AnalyticsClient('/api/analytics/dashboard');
await analytics.trackUser('user_123', { source: 'google' });
```

### Python

```python
import requests

class AnalyticsClient:
    def __init__(self, base_url):
        self.base_url = base_url
    
    def track_user(self, user_id, **kwargs):
        response = requests.post(
            f"{self.base_url}/track/user",
            json={"userId": user_id, **kwargs}
        )
        return response.json()
    
    def get_summary(self):
        response = requests.get(f"{self.base_url}/summary")
        return response.json()

# 使用
analytics = AnalyticsClient("http://localhost:8080/api/analytics/dashboard")
analytics.track_user("user_123", source="google")
```

---

## Rate Limiting

默认无限流。如需启用，在服务器配置中设置:

```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 60 * 1000,  // 1分钟
  max: 100              // 最多100请求
});

app.use('/api/analytics/dashboard', limiter, analyticsDashboardRouter);
```
