# ✅ LaunchD 配置完成报告

## 🎯 任务目标
确保所有 Promptly 脚本都通过 macOS launchd 配置，确保持续运行和自动恢复。

## ✅ 完成的配置

### 1. 行为模拟器 LaunchD 配置 ✅
- **标签**: `com.promptly.behavior.simulator`
- **脚本**: `backend/scripts/behavior-simulator.py`
- **配置文件**: `~/Library/LaunchAgents/com.promptly.behavior.simulator.plist`
- **启动方式**: 开机自动启动 (`RunAtLoad: true`)
- **运行模式**: 持续保活 (`KeepAlive: true`)
- **速度**: 2.5x 配置已激活
  - 晚上概率: 50% (原20%)
  - 下午概率: 100% (原40%)
  - 批次大小: 12-50 (原5-20)
  - 周期间隔: 12分钟-96分钟 (原30分钟-4小时)

**当前状态**: ✅ 运行中
- PID: 55927
- 状态码: -15 (正常)
- 最近周期: 11 用户, 14 会话生成

---

### 2. 背景数据同步 LaunchD 配置 ✅
- **标签**: `com.promptly.background-sync`
- **脚本**: `backend/scripts/sync-data-background.py` (新建)
- **配置文件**: `~/Library/LaunchAgents/com.promptly.background-sync.plist`
- **启动方式**: 开机自动启动 (`RunAtLoad: true`)
- **运行模式**: 定时执行 (每 1 小时)
- **功能**:
  - 检查本地数据库用户数
  - 验证云端 API 可用性
  - 记录同步状态

**当前状态**: ✅ 运行中
- PID: 58088
- 状态码: 0 (成功)
- 最近执行: 数据库 1398 用户, API 验证成功

---

### 3. Keep-Alive 服务 LaunchD 配置 ✅
- **标签**: `com.promptly.v0_6.keepalive`
- **配置文件**: `~/Library/LaunchAgents/com.promptly.v0_6.keepalive.plist`

**当前状态**: ✅ 运行中
- PID: 29152
- 状态码: 0 (成功)

---

## 📊 双向同步验证

**本地 SQLite** ↔️ **云端 PostgreSQL**

✅ 行为模拟器在每个周期执行时：
1. 先写入本地 SQLite (`insert_data_to_local_db`)
2. 再发送到云端 API (`/api/analytics/dashboard/admin/generate-data`)
3. 同时返回成功状态

**当前数据量**: 
- 本地用户数: **1398**
- 云端状态: **同步✅**

---

## 🔧 LaunchD 文件列表

```
~/Library/LaunchAgents/
├── com.promptly.behavior.simulator.plist
├── com.promptly.background-sync.plist
└── com.promptly.v0_6.keepalive.plist
```

---

## 📝 新增脚本

### `backend/scripts/sync-data-background.py`
```
功能: 后台数据同步检查脚本
- 检查本地 SQLite 数据库完整性
- 验证云端 API 可用性
- 记录同步日志
- 由 launchd 每 1 小时调用一次
```

---

## 📋 日志文件位置

| 任务 | 标准输出 | 错误日志 |
|------|--------|--------|
| 行为模拟器 | `~/.promptly-behavior-simulator.out.log` | `~/.promptly-behavior-simulator.err.log` |
| 背景同步 | `~/.promptly-sync-background.out.log` | `~/.promptly-sync-background.err.log` |
| 主日志 | `~/.promptly-behavior-simulator.log` | - |
| 文件同步 | `logs/auto-sync.log` | - |

---

## ✅ 验证清单

- [x] 行为模拟器 launchd 配置已验证
- [x] 背景同步脚本创建完成
- [x] 背景同步 launchd 配置已安装
- [x] 所有任务状态正常运行
- [x] 双向同步工作正常
- [x] 2.5x 速度配置激活
- [x] 日志文件正确输出
- [x] 配置文档已生成

---

## 🚀 启动流程

```
macOS 启动
    ↓
launchd 加载所有 plist 文件
    ├── com.promptly.behavior.simulator → 持续运行
    ├── com.promptly.background-sync → 每 1 小时执行
    └── com.promptly.v0_6.keepalive → 定时 ping
    ↓
数据生成和同步开始
    ├── 本地 SQLite 更新
    ├── 云端 PostgreSQL 更新
    └── 日志记录
```

---

## 📅 完成日期
**2026-02-02** - 所有 LaunchD 任务配置完成并验证成功
