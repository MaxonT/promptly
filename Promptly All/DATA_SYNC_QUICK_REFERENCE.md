# Promptly Analytics 数据同步指南

## 📊 架构说明

```
本地开发环境                          云端生产环境
┌────────────────┐                  ┌────────────────┐
│  app.db        │  ─── 同步 ───▶   │  Backend API   │
│  (SQLite)      │                  │  (cursor-dev)  │
│                │                  └────────────────┘
│  1382 users    │                         ▲
│  2527 sessions │                         │ API
│  65 daily      │                         │
└────────────────┘                  ┌────────────────┐
                                    │  Frontend      │
                                    │  (cloudtest-1) │
                                    └────────────────┘
```

## 🔗 URL 配置

| 服务 | URL |
|------|-----|
| Frontend (静态站点) | https://promptly-v0-6-cloudtest-1.onrender.com |
| Backend (API) | https://promptly-v0-6-cloudtest-cursor-dev.onrender.com |
| Dashboard | https://promptly-v0-6-cloudtest-1.onrender.com/analytics-dashboard.html |

## 📤 手动同步

```bash
# 方式 1: 使用快捷脚本
cd backend && ./scripts/sync-now.sh

# 方式 2: 直接运行 Node.js 脚本
cd backend && node scripts/sync-to-cloud.js https://promptly-v0-6-cloudtest-cursor-dev.onrender.com
```

## ⏰ 自动同步配置

已配置 cron job，每 3 小时自动同步一次：

```cron
0 */3 * * * /path/to/backend/scripts/sync-now.sh
```

### 管理命令

```bash
# 查看 cron 任务
crontab -l

# 查看同步日志
tail -f logs/cron-sync.log
tail -f logs/sync.log

# 手动触发同步
./backend/scripts/sync-now.sh

# 移除自动同步
crontab -l | grep -v "promptly.*sync" | crontab -
```

## 🔍 验证数据

```bash
# 检查云端健康状态
curl https://promptly-v0-6-cloudtest-cursor-dev.onrender.com/api/health

# 检查数据统计
curl https://promptly-v0-6-cloudtest-cursor-dev.onrender.com/api/analytics/dashboard/summary

# 检查本地数据量
sqlite3 backend/data/app.db "SELECT 'users:', COUNT(*) FROM analytics_users;"
```

## ⚠️ 重要提示

1. **Render 部署会清空 SQLite**: 每次重新部署云端后端，数据库会被重置，需要重新同步
2. **本地数据库是 Source of Truth**: 始终从本地同步到云端
3. **数据是增量覆盖**: 同步会 INSERT OR REPLACE，不会删除云端多余数据

## 🚨 紧急恢复

如果云端数据丢失：

```bash
# 1. 确认本地数据完整
sqlite3 backend/data/app.db "SELECT COUNT(*) FROM analytics_users;"

# 2. 检查云端服务状态
curl https://promptly-v0-6-cloudtest-cursor-dev.onrender.com/api/health

# 3. 执行同步
cd backend && node scripts/sync-to-cloud.js https://promptly-v0-6-cloudtest-cursor-dev.onrender.com

# 4. 验证恢复
curl https://promptly-v0-6-cloudtest-cursor-dev.onrender.com/api/analytics/dashboard/summary
```

---
*最后更新: 2026-01-31*
