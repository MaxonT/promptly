# 行为模拟器双向同步 - 配置指南

## 🎯 功能概述

行为模拟器现已升级为**双向同步模式**，数据会同时发送到：

1. **💾 本地 SQLite 数据库** (`backend/data/app.db`)
2. **☁️ 云端 Render API** (`https://promptly-v0-6-cloudtest-cursor-dev.onrender.com`)

## 📊 数据流程

```
┌─────────────────────────────────┐
│  Behavior Simulator v3          │
│  (behavior-simulator.py)        │
└────────────┬────────────────────┘
             │
      ┌──────┴──────┐
      │             │
      ▼             ▼
┌──────────────┐  ┌──────────────┐
│   本地 DB    │  │  云端 API    │
│  app.db      │  │ Render.com   │
└──────────────┘  └──────────────┘
      │             │
      └──────┬──────┘
             │
        ✅ 数据保存
```

## 🔧 修改清单

### 1. behavior-simulator.py 更新

#### 新增导入
```python
import sqlite3  # SQLite 数据库连接
```

#### 新增配置项
```python
# 本地数据库路径 (相对于 backend 目录)
"LOCAL_DB_PATH": os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "data", "app.db"
)
```

#### 新增函数

**`get_db_connection()`**
- 连接本地 SQLite 数据库
- 失败时返回 None 并记录错误

**`insert_data_to_local_db(users, sessions)`**
- 直接向本地数据库插入数据
- 执行与云端 API 端点相同的操作：
  - 插入新用户
  - 插入会话记录
  - 更新日统计表 (analytics_daily)
- 返回布尔值表示成功/失败

#### 修改的函数

**`api_call_generate_data(users, sessions)`**
- 改为**两步流程**：
  1. 先插入到本地 SQLite ✅
  2. 再发送到云端 API ☁️
- 如果本地成功，即使云端失败也继续
- 云端失败时，数据不会丢失，后续可通过同步脚本恢复

### 2. 日志输出增强

启动时会显示：
```
📊 数据同步目标:
  ☁️  云端 API: https://promptly-v0-6-cloudtest-cursor-dev.onrender.com
  💾 本地数据库: /path/to/backend/data/app.db
```

执行时的日志示例：
```
📦 准备插入数据: 5 用户, 12 会话
💾 本地数据库: ✅ 5 用户, 12 会话已插入
🌐 发送到云端: https://...
📡 云端响应: HTTP 200
☁️  云端数据: ✅ 已同步
✨ 数据已保存到本地，云端状态: ✅ 同步
```

## ⚙️ 工作机制

### 正常流程（云端可用）
```
生成数据 → 本地插入 ✅ → 云端上传 ✅ → 完成
```

### 云端不可用时
```
生成数据 → 本地插入 ✅ → 云端上传 ❌ → 
  等待恢复 → 重试上传 ✅ → 完成
```

### 灾难恢复
如果云端数据丢失（如 Render 重新部署）：
```bash
# 手动同步本地→云端
cd backend && node scripts/sync-now.sh

# 或通过 cron job 自动同步（每3小时）
# 已配置，无需手动操作
```

## 🧪 验证方法

### 方式 1: 查看日志
```bash
tail -f ~/.promptly-behavior-simulator.log
```

### 方式 2: 运行验证脚本
```bash
cd backend && python3 scripts/test-dual-sync.py
```

输出示例：
```
📊 本地 SQLite 数据统计:
   👥 总用户数: 1382
   📱 总会话数: 2527
   📅 日统计数: 65
✅ 本地数据库连接正常
```

### 方式 3: 直接查询数据库
```bash
# 查看用户数
sqlite3 backend/data/app.db "SELECT COUNT(*) FROM analytics_users;"

# 查看最新日统计
sqlite3 backend/data/app.db \
  "SELECT date, unique_users FROM analytics_daily ORDER BY date DESC LIMIT 1;"
```

## 📋 配置项说明

| 配置 | 说明 | 默认值 |
|------|------|--------|
| `API_BASE` | 云端 API 地址 | 环境变量或 `https://promptly-v0-6-cloudtest-cursor-dev.onrender.com` |
| `LOCAL_DB_PATH` | 本地数据库路径 | `backend/data/app.db` |
| `TIMEOUT` | API 请求超时 (秒) | 15 |
| `MAX_RETRIES` | 最大重试次数 | 5 |
| `RETRY_DELAY` | 重试间隔 (秒) | 60 |

## 🚀 启动方式

### 直接运行
```bash
cd backend && python3 scripts/behavior-simulator.py
```

### 后台运行 (macOS)
```bash
# 已配置 launchd 服务
launchctl start com.promptly.behavior.simulator
```

### 查看服务状态
```bash
launchctl list | grep behavior
```

## ⚠️ 注意事项

1. **本地数据优先**: 如果本地插入成功但云端失败，数据不会丢失
2. **数据一致性**: 本地和云端的数据插入逻辑完全相同
3. **网络恢复**: 云端连接失败时会自动重试，最多 5 次
4. **定期同步**: 可通过 `sync-now.sh` 脚本定期同步本地→云端（已配置 cron job，每 3 小时）

## 🔄 数据同步策略

| 场景 | 行为 |
|------|------|
| 云端可用 | 本地 + 云端同时更新 ✅ |
| 云端暂时断开 | 本地更新 + 重试云端 + 后续同步 ✅ |
| Render 重新部署 | 自动通过 cron job 恢复数据 ✅ |
| 本地数据库损坏 | ⚠️ 无法恢复（需备份） |

---

*最后更新: 2026-01-31*
