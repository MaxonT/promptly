# Promptly Analytics - 数据同步管理指南

## 📋 快速命令参考

```bash
cd /Users/yangming/Desktop/Github/Promptly-v0.6-CloudTest/Promptly-cloud-v0.6.8.3-fullstack/backend

# ═══════════════════════════════════════════════════════════
# 🌟 推荐使用统一管理脚本
# ═══════════════════════════════════════════════════════════

./scripts/manage.sh status      # 📊 查看系统状态
./scripts/manage.sh sync        # 🔄 执行完整同步
./scripts/manage.sh sync-check  # 🔍 仅检查差异
./scripts/manage.sh simulator   # ▶️  启动模拟器
./scripts/manage.sh stop        # ⏹️  停止模拟器
./scripts/manage.sh logs        # 📝 查看日志
./scripts/manage.sh help        # ❓ 帮助信息

# ═══════════════════════════════════════════════════════════
# 📌 常用原始命令（备用）
# ═══════════════════════════════════════════════════════════

# 查看模拟器进程
ps aux | grep behavior-simulator.py | grep -v grep

# 实时查看日志
tail -f ~/.promptly-behavior-simulator.log

# 查看最近50行日志
tail -50 ~/.promptly-behavior-simulator.log

# 搜索错误
grep "ERROR" ~/.promptly-behavior-simulator.log

# 查看今天的日志
grep "$(date +%Y-%m-%d)" ~/.promptly-behavior-simulator.log

# 手动执行 Python 同步脚本
python3 scripts/full-sync.py --check-only  # 只检查
python3 scripts/full-sync.py --force       # 强制同步
python3 scripts/full-sync.py               # 交互式同步

# 验证本地数据库
python3 scripts/test-dual-sync.py
```

---

## 🏗️ 系统架构说明

### 数据流向

```
┌─────────────────────┐
│  behavior-simulator │
│    (Python 脚本)    │
└──────────┬──────────┘
           │ 同时写入
           ▼
    ┌──────┴──────┐
    │             │
    ▼             ▼
┌───────┐   ┌─────────┐
│ 本地   │   │  云端    │
│SQLite │   │PostgreSQL│
└───────┘   └─────────┘
    │             ▲
    │             │
    └─────────────┘
      手动同步 (full-sync.py)
```

### 重要文件位置

| 文件 | 路径 | 用途 |
|------|------|------|
| 本地数据库 | `backend/data/app.db` | SQLite 主数据库 |
| 模拟器脚本 | `backend/scripts/behavior-simulator.py` | 用户行为模拟 |
| 同步脚本 | `backend/scripts/full-sync.py` | 全量数据同步 |
| 管理脚本 | `backend/scripts/manage.sh` | 统一管理入口 |
| 模拟器日志 | `~/.promptly-behavior-simulator.log` | 运行日志 |
| 待同步队列 | `~/.promptly-pending-sync.json` | 失败重试队列 |

---

## 🔧 常见问题处理

### 1. 部署后数据丢失？

部署时 Render 可能重置数据库。执行以下步骤恢复：

```bash
cd backend

# 1. 停止模拟器
./scripts/manage.sh stop

# 2. 检查差异
./scripts/manage.sh status

# 3. 执行同步（本地 → 云端）
./scripts/manage.sh sync

# 4. 重启模拟器
./scripts/manage.sh simulator
```

### 2. 数据不一致（云端多于本地）？

这可能是因为某些写入只成功了云端。**以本地为准**：

```bash
# 部署最新代码后执行
./scripts/manage.sh sync
```

### 3. 模拟器没有运行？

```bash
# 检查进程
ps aux | grep behavior-simulator.py

# 启动
./scripts/manage.sh simulator

# 查看日志排查问题
./scripts/manage.sh logs
```

### 4. 云端API不可用？

```bash
# 检查健康状态
curl https://promptly-v0-6-cloudtest-cursor-dev.onrender.com/api/health

# 如果返回错误，可能需要等待 Render 冷启动
# 一般需要 30-60 秒
```

---

## 📊 数据库表结构

```sql
-- 用户表
analytics_users (id, source, timezone, country, device_type, browser, created_at, ...)

-- 会话表
analytics_sessions (id, user_id, session_start, duration_seconds, page_views, ...)

-- 行为表
analytics_behavior (id, user_id, session_id, clicks, scrolls, engagement_score, ...)

-- 每日统计
analytics_daily (date, unique_users, new_users, total_sessions, cumulative_users, ...)
```

---

## ⚠️ 重要提醒

1. **以本地为准**：本地 SQLite 是唯一数据源，云端是备份
2. **同步时机**：部署后必须同步，日常可选
3. **停止模拟器**：同步前建议停止模拟器避免数据竞争
4. **日志检查**：定期检查日志确认模拟器正常运行

---

## 🔄 自动化设置（可选）

### Launchd 自动启动（macOS）

已配置文件：`backend/scripts/com.promptly.behavior.simulator.plist`

```bash
# 安装
./scripts/install-behavior-simulator.sh

# 卸载
./scripts/uninstall-behavior-simulator.sh
```

---

*最后更新：2026-02-03*
