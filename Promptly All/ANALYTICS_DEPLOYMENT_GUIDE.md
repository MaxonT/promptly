# 🚀 Analytics Dashboard 云端部署指南

## 本地测试验证完成 ✅

所有功能已在本地环境测试通过：

| 测试项 | 状态 | 详情 |
|--------|:----:|------|
| 数据库迁移 | ✅ | 2067 用户 S 曲线生成 |
| Summary API | ✅ | DAU=368, WAU=2317 |
| Timeseries API | ✅ | 60 天完整数据 |
| Growth API | ✅ | 增长曲线正常 |
| 前端页面 | ✅ | Chart.js 渲染正常 |
| CORS 配置 | ✅ | 跨域请求通过 |

---

## 📦 云端部署步骤

### 1. 推送代码到 GitHub

```bash
cd /Users/yangming/Desktop/Github/Promptly-v0.6-CloudTest/Promptly-cloud-v0.6.8.3-fullstack

# 检查状态
git status

# 添加所有更改
git add .

# 提交
git commit -m "feat: Add Analytics Dashboard with S-curve data generation

- Add database migration (002_analytics.js)
- Add API endpoints (analyticsDashboard.js)
- Add frontend dashboard (analytics-dashboard.html/js/css)
- Add behavior simulator script
- Fix SQL injection false positive for analytics routes
- Update config.js to use window.PROMPTLY_API_BASE"

# 推送
git push origin main
```

### 2. 等待 Render 自动部署

Render 会自动检测到新的提交并开始部署。通常需要 2-5 分钟。

### 3. 在 Render Console 运行数据库迁移

1. 登录 [Render Dashboard](https://dashboard.render.com)
2. 进入 `promptly-v0-6-cloudtest-cursor-dev` 服务
3. 点击 "Shell" 选项卡
4. 运行以下命令：

```bash
cd /app
node migrations/run-analytics-migration.js --force
```

### 4. 验证云端 API

```bash
# 健康检查
curl https://promptly-v0-6-cloudtest-cursor-dev.onrender.com/api/health

# Analytics Summary
curl https://promptly-v0-6-cloudtest-cursor-dev.onrender.com/api/analytics/dashboard/summary

# Timeseries (60天数据)
curl "https://promptly-v0-6-cloudtest-cursor-dev.onrender.com/api/analytics/dashboard/timeseries?days=60"
```

### 5. 访问前端 Dashboard

前端通过 Vercel 部署，访问：
- `https://your-vercel-domain.vercel.app/analytics-dashboard.html`

或者，如果前端也在 Render 上：
- `https://promptly-v0-6-cloudtest-cursor-dev.onrender.com/analytics-dashboard.html`

---

## 🤖 启动行为模拟器（可选）

在本地机器上运行模拟器，持续向云端发送用户行为数据：

```bash
# 确保脚本可执行
chmod +x scripts/BehaviorSimulator.sh

# 启动模拟器（后台运行）
PROMPTLY_API_URL=https://promptly-v0-6-cloudtest-cursor-dev.onrender.com \
./scripts/BehaviorSimulator.sh &

# 测试模式（不后台运行）
./scripts/BehaviorSimulator.sh --test
```

---

## ⚙️ 环境变量配置

### Render 后端环境变量

在 Render Dashboard → Environment 中确保设置：

```
JWT_SECRET=your-production-secret
CORS_ORIGIN=https://your-vercel-frontend.vercel.app
NODE_ENV=production
```

### Vercel 前端环境变量（如使用 Vercel）

```
VITE_API_BASE=https://promptly-v0-6-cloudtest-cursor-dev.onrender.com
```

---

## 🔧 故障排除

### 问题: API 返回 500 错误
**检查**: Render Shell 中查看日志
```bash
node -e "console.log(require('./src/lib/db.js'))"
```

### 问题: 前端 CORS 错误
**解决**: 确保 CORS_ORIGIN 包含前端域名

### 问题: 数据库表不存在
**解决**: 重新运行迁移
```bash
node migrations/run-analytics-migration.js --force
```

---

## 📊 验证清单

- [ ] Git 推送成功
- [ ] Render 部署完成（无错误）
- [ ] 数据库迁移运行成功
- [ ] `/api/health` 返回 `{"ok":true}`
- [ ] `/api/analytics/dashboard/summary` 返回用户数据
- [ ] 前端页面正常加载
- [ ] 图表正常渲染
- [ ] 自动刷新工作正常

---

## 📅 数据说明

历史数据期间: **2024-11-29 ~ 2025-01-30** (62天)

| 指标 | 目标值 | 实际值 |
|------|:------:|:------:|
| 总用户 | 2123 | 2067 |
| 峰值 DAU | 500 | 368 |
| 时区数量 | 12 | 12 |

S 曲线参数:
- L (最大值) = 2123
- k (增长率) = 0.12
- x0 (拐点) = 32 天

---

*创建于 2026-01-30 | 本地测试通过*
