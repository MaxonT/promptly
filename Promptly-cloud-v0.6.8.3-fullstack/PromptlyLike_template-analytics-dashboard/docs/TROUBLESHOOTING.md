# Analytics Dashboard 故障排除

常见问题及解决方案。

## 目录

1. [安装问题](#安装问题)
2. [数据库问题](#数据库问题)
3. [API 问题](#api-问题)
4. [前端问题](#前端问题)
5. [模拟器问题](#模拟器问题)
6. [性能问题](#性能问题)
7. [诊断工具](#诊断工具)

---

## 安装问题

### better-sqlite3 编译失败

**症状:**
```
npm ERR! gyp ERR! build error
```

**解决方案:**

```bash
# macOS
xcode-select --install

# Ubuntu/Debian
sudo apt-get install build-essential python3

# 清理并重试
rm -rf node_modules package-lock.json
npm install
```

### Python 版本不兼容

**症状:**
```
SyntaxError: f-string expression part cannot include a backslash
```

**解决方案:**
```bash
# 检查 Python 版本
python3 --version

# 安装 Python 3.8+
# macOS
brew install python@3.10

# Ubuntu
sudo apt install python3.10
```

### 端口被占用

**症状:**
```
Error: listen EADDRINUSE: address already in use :::8080
```

**解决方案:**
```bash
# 查找占用端口的进程
lsof -i :8080

# 终止进程
kill -9 <PID>

# 或使用不同端口
PORT=3000 npm start
```

---

## 数据库问题

### 表不存在

**症状:**
```json
{"ok": true, "users": {"total": 0}}
```

**解决方案:**
```bash
# 运行迁移
node backend/migrations/002_analytics.js

# 验证表
sqlite3 data/analytics.db ".tables"
```

### 数据库锁定

**症状:**
```
SQLITE_BUSY: database is locked
```

**解决方案:**
```bash
# 检查是否有多个进程访问
lsof data/analytics.db

# 启用 WAL 模式
sqlite3 data/analytics.db "PRAGMA journal_mode=WAL;"

# 增加超时
db.pragma('busy_timeout = 5000');
```

### 数据库损坏

**症状:**
```
SQLITE_CORRUPT: database disk image is malformed
```

**解决方案:**
```bash
# 尝试恢复
sqlite3 data/analytics.db ".recover" | sqlite3 data/analytics_recovered.db

# 验证恢复的数据库
sqlite3 data/analytics_recovered.db "PRAGMA integrity_check;"

# 如果恢复成功，替换原文件
mv data/analytics.db data/analytics.db.corrupt
mv data/analytics_recovered.db data/analytics.db
```

### 迁移数据异常

**症状:**
- 数据全为0
- S曲线看起来不正确

**解决方案:**
```bash
# 删除并重新生成
rm data/analytics.db
node backend/migrations/002_analytics.js

# 或调整 S-曲线参数
# 编辑 migrations/002_analytics.js 中的 S_CURVE_CONFIG
```

---

## API 问题

### 数据库未初始化错误

**症状:**
```json
{"ok": false, "error": "Analytics database not initialized. Call setDatabase() first."}
```

**解决方案:**

确保在 server.js 中正确调用 setDatabase:

```javascript
import { analyticsDashboardRouter, setDatabase } from './routes/analyticsDashboard.js';
import Database from 'better-sqlite3';

const db = new Database('./data/analytics.db');
setDatabase(db);  // 必须在挂载路由前调用

app.use('/api/analytics/dashboard', analyticsDashboardRouter);
```

### CORS 错误

**症状:**
```
Access to fetch at 'http://...' from origin 'http://...' has been blocked by CORS policy
```

**解决方案:**

```javascript
import cors from 'cors';

app.use(cors({
  origin: ['http://localhost:3000', 'https://your-domain.com'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'X-Admin-Key']
}));
```

### 401 Unauthorized (管理端点)

**症状:**
```json
{"ok": false, "error": "Unauthorized"}
```

**解决方案:**

```bash
# 确保设置了 ADMIN_API_KEY 环境变量
export ADMIN_API_KEY=your-key

# 请求时包含头
curl -H "X-Admin-Key: your-key" -X POST http://localhost:8080/api/analytics/dashboard/admin/generate-data
```

### 500 Internal Server Error

**症状:**
```json
{"ok": false, "error": "Failed to get analytics summary"}
```

**排查步骤:**

```bash
# 查看服务器日志
pm2 logs analytics-api
# 或
journalctl -u analytics-api -f

# 常见原因:
# 1. 数据库文件不存在
# 2. 数据库目录无写权限
# 3. SQL 语法错误 (自定义查询)
```

---

## 前端问题

### 图表不显示

**症状:**
- 页面加载但图表区域为空
- Console 显示 Chart.js 错误

**解决方案:**

```html
<!-- 确保 Chart.js 已加载 -->
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>

<!-- 检查 canvas 元素 -->
<canvas id="users-chart"></canvas>
```

```javascript
// 确保 DOM 已加载
document.addEventListener('DOMContentLoaded', function() {
  initCharts();
});

// 检查 Chart 是否可用
if (typeof Chart === 'undefined') {
  console.error('Chart.js not loaded!');
}
```

### API 数据获取失败

**症状:**
- 数据卡片显示 0 或 NaN
- Console 显示 fetch 错误

**解决方案:**

```javascript
// 检查 API 基础地址
console.log('API Base:', ANALYTICS_CONFIG.API_BASE);

// 确保配置正确
window.ANALYTICS_API_BASE = ''; // 相对路径
// 或
window.ANALYTICS_API_BASE = 'http://localhost:8080';
```

### 粒子动画卡顿

**症状:**
- 页面滚动卡顿
- CPU 使用率高

**解决方案:**

```javascript
// 减少粒子数量
ANALYTICS_CONFIG.particles.count = 30;

// 或禁用粒子
ANALYTICS_CONFIG.particles.enabled = false;
```

```css
/* 禁用粒子动画 */
#particles-js {
  display: none;
}
```

### 样式不正确 / 布局错乱

**症状:**
- Glassmorphism 效果不显示
- 布局不对齐

**解决方案:**

```html
<!-- 确保 CSS 已加载 -->
<link rel="stylesheet" href="analytics-dashboard.css">

<!-- 检查 viewport 设置 -->
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

---

## 模拟器问题

### 连接被拒绝

**症状:**
```
URL error: [Errno 61] Connection refused
```

**解决方案:**

```bash
# 确保 API 服务正在运行
curl http://localhost:8080/api/analytics/dashboard/health

# 检查 API 地址配置
export ANALYTICS_API_BASE=http://localhost:8080
```

### 请求超时

**症状:**
```
URL error: timed out
```

**解决方案:**

```python
# 增加超时时间
with urllib.request.urlopen(req, timeout=60) as response:
    ...

# 或检查网络连接
ping localhost
```

### launchd 服务未启动

**症状:**
```bash
$ launchctl list | grep behavior
# 无输出
```

**解决方案:**

```bash
# 检查 plist 文件
cat ~/Library/LaunchAgents/com.analytics.behavior-simulator.plist

# 检查路径是否正确
# 查看系统日志
log show --predicate 'subsystem == "com.apple.launchd"' --last 1h | grep behavior

# 重新安装
./uninstall-service.sh
./install-service.sh http://localhost:8080
```

### 模拟器生成数据但仪表盘不更新

**排查步骤:**

```bash
# 1. 检查模拟器输出
tail -f /tmp/analytics-simulator.log

# 2. 直接查询数据库
sqlite3 data/analytics.db "SELECT COUNT(*) FROM analytics_users;"

# 3. 检查今日数据
sqlite3 data/analytics.db "SELECT * FROM analytics_daily ORDER BY date DESC LIMIT 5;"

# 4. 如果数据存在但前端不显示，检查 API 响应
curl http://localhost:8080/api/analytics/dashboard/summary | jq
```

---

## 性能问题

### API 响应慢

**诊断:**

```bash
# 测量响应时间
time curl http://localhost:8080/api/analytics/dashboard/summary

# 检查数据库大小
ls -lh data/analytics.db
```

**优化:**

```sql
-- 添加缺失的索引
CREATE INDEX IF NOT EXISTS idx_daily_date ON analytics_daily(date);
CREATE INDEX IF NOT EXISTS idx_users_created ON analytics_users(created_at);

-- 分析表
ANALYZE analytics_users;
ANALYZE analytics_sessions;
ANALYZE analytics_daily;
```

### 内存使用过高

**诊断:**

```bash
# Node.js 进程内存
ps aux | grep node

# 数据库缓存
sqlite3 data/analytics.db "PRAGMA cache_size;"
```

**优化:**

```javascript
// 限制数据库缓存
db.pragma('cache_size = 1000');  // 约 4MB

// 增加 Node.js 内存限制 (如需要)
node --max-old-space-size=512 server.js
```

### 数据库文件过大

**解决方案:**

```bash
# 清理旧数据 (保留90天)
sqlite3 data/analytics.db "DELETE FROM analytics_sessions WHERE date(session_start) < date('now', '-90 days');"
sqlite3 data/analytics.db "DELETE FROM analytics_behavior WHERE date(recorded_at) < date('now', '-90 days');"

# 压缩数据库
sqlite3 data/analytics.db "VACUUM;"
```

---

## 诊断工具

### 健康检查脚本

```bash
#!/bin/bash
# diagnose.sh

echo "=== Analytics Dashboard Diagnostics ==="
echo ""

# 检查 Node.js
echo "1. Node.js version:"
node --version

# 检查 Python
echo ""
echo "2. Python version:"
python3 --version

# 检查数据库
echo ""
echo "3. Database status:"
if [ -f "data/analytics.db" ]; then
    echo "   Size: $(ls -lh data/analytics.db | awk '{print $5}')"
    echo "   Tables: $(sqlite3 data/analytics.db '.tables')"
    echo "   Users: $(sqlite3 data/analytics.db 'SELECT COUNT(*) FROM analytics_users;')"
    echo "   Days of data: $(sqlite3 data/analytics.db 'SELECT COUNT(*) FROM analytics_daily;')"
else
    echo "   Database not found!"
fi

# 检查 API
echo ""
echo "4. API health:"
API_RESPONSE=$(curl -s http://localhost:8080/api/analytics/dashboard/health)
echo "   $API_RESPONSE"

# 检查端口
echo ""
echo "5. Port 8080 status:"
lsof -i :8080 | head -3

# 检查模拟器
echo ""
echo "6. Simulator service:"
launchctl list | grep behavior-simulator || echo "   Not running as launchd service"

echo ""
echo "=== Diagnostics Complete ==="
```

### 日志分析

```bash
# 查看最近的错误
grep -i error /tmp/analytics-simulator.log | tail -20

# 统计请求成功率
grep -c "Success" /tmp/analytics-simulator.log
grep -c "error" /tmp/analytics-simulator.log
```

### 数据库查询调试

```bash
# 交互式 SQLite shell
sqlite3 data/analytics.db

# 有用的查询
.headers on
.mode column

-- 最近的用户
SELECT * FROM analytics_users ORDER BY created_at DESC LIMIT 10;

-- 每日统计趋势
SELECT date, unique_users, new_users, total_sessions FROM analytics_daily ORDER BY date DESC LIMIT 14;

-- 检查数据一致性
SELECT 
    (SELECT COUNT(*) FROM analytics_users) as total_users,
    (SELECT MAX(cumulative_users) FROM analytics_daily) as cumulative_daily;
```

---

## 获取帮助

如果以上方案都无法解决问题:

1. **检查日志** - 服务器日志通常包含详细错误信息
2. **简化问题** - 尝试用最简配置重现问题
3. **查看 GitHub Issues** - 可能已有类似问题
4. **提交 Issue** - 包含完整的错误信息和复现步骤

提交 Issue 时请包含:
- 操作系统和版本
- Node.js / Python 版本
- 完整的错误日志
- 复现步骤
