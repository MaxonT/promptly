# Promptly LaunchD 任务配置总结

## 📋 当前活跃的 LaunchD 任务

### 1. ✅ 行为模拟器 (Behavior Simulator)
**标签**: `com.promptly.behavior.simulator`

**功能**:
- 持续生成模拟用户行为数据
- **双向同步**: 同时写入本地 SQLite 和云端 API
- 2.5x 速度配置 (原值 × 2.5)
- 启用 `KeepAlive` - 持续运行

**配置文件**: `~/Library/LaunchAgents/com.promptly.behavior.simulator.plist`

**脚本**: `backend/scripts/behavior-simulator.py`

**状态**: ✅ 运行中 (PID: 55927, 状态: -15)

**运行周期**: 12分钟-96分钟 (根据时段和概率)

**日志文件**:
- 标准输出: `~/.promptly-behavior-simulator.out.log`
- 错误日志: `~/.promptly-behavior-simulator.err.log`
- 主日志: `~/.promptly-behavior-simulator.log`

---

### 2. ✅ 背景数据同步 (Background Sync)
**标签**: `com.promptly.background-sync`

**功能**:
- 每小时检查一次数据同步状态
- 验证本地数据库完整性
- 确保云端 API 可用性
- 非持续运行 (定时执行)

**配置文件**: `~/Library/LaunchAgents/com.promptly.background-sync.plist`

**脚本**: `backend/scripts/sync-data-background.py`

**状态**: ✅ 运行中 (PID: 58088, 状态: 0)

**运行周期**: 每 3600 秒 (1 小时) 执行一次

**日志文件**:
- 标准输出: `~/.promptly-sync-background.out.log`
- 错误日志: `~/.promptly-sync-background.err.log`

---

### 3. ✅ Keep-Alive 服务
**标签**: `com.promptly.v0_6.keepalive`

**功能**:
- 定期向云端服务发送 ping 请求
- 防止 Render 免费计划应用休眠

**配置文件**: `~/Library/LaunchAgents/com.promptly.v0_6.keepalive.plist`

**状态**: ✅ 运行中 (PID: 29152, 状态: 0)

---

## 🔧 管理命令

### 查看所有 Promptly 任务状态
```bash
launchctl list | grep promptly
```

### 查看特定任务详情
```bash
launchctl list com.promptly.behavior.simulator
launchctl list com.promptly.background-sync
```

### 重启行为模拟器（应用新配置）
```bash
launchctl stop com.promptly.behavior.simulator
launchctl start com.promptly.behavior.simulator
```

### 重启背景同步任务
```bash
launchctl stop com.promptly.background-sync
launchctl start com.promptly.background-sync
```

### 手动触发背景同步（测试）
```bash
launchctl start com.promptly.background-sync
```

### 查看日志
```bash
# 行为模拟器
tail -f ~/.promptly-behavior-simulator.log

# 背景同步
tail -f ~/.promptly-sync-background.out.log
cat ~/.promptly-sync-background.err.log
```

### 完全卸载任务
```bash
launchctl unload ~/Library/LaunchAgents/com.promptly.behavior.simulator.plist
launchctl unload ~/Library/LaunchAgents/com.promptly.background-sync.plist
launchctl unload ~/Library/LaunchAgents/com.promptly.v0_6.keepalive.plist
```

### 完全重新安装
```bash
# 卸载所有任务
launchctl unload ~/Library/LaunchAgents/com.promptly*.plist

# 重新加载
launchctl load ~/Library/LaunchAgents/com.promptly.behavior.simulator.plist
launchctl load ~/Library/LaunchAgents/com.promptly.background-sync.plist
launchctl load ~/Library/LaunchAgents/com.promptly.v0_6.keepalive.plist
```

---

## 📊 数据流向

```
行为模拟器 (behavior-simulator.py)
    ├── 生成随机用户和会话数据
    ├── 写入 本地 SQLite (backend/data/app.db)
    │   └── 1398 用户 (当前)
    └── 发送到云端 API
        └── /api/analytics/dashboard/admin/generate-data
            └── 更新 PostgreSQL (Render)

背景同步 (sync-data-background.py)
    ├── 每 1 小时执行
    ├── 检查本地数据库用户数
    ├── 验证云端 API 可用性
    └── 记录日志
```

---

## 🚀 启动流程

1. **macOS 启动时** → launchd 加载所有 plist 文件
2. **行为模拟器启动** → 开始生成数据（双向同步）
3. **背景同步启动** → 执行首次检查
4. **Keep-Alive 启动** → 定期 ping 云端

---

## ⚠️ 故障排查

### 问题: 任务不运行
**解决**:
```bash
# 重新加载
launchctl load ~/Library/LaunchAgents/com.promptly.behavior.simulator.plist

# 检查是否已加载
launchctl list | grep promptly

# 查看错误日志
cat ~/.promptly-behavior-simulator.err.log
```

### 问题: 权限错误 (Operation not permitted)
**原因**: macOS 完全磁盘访问限制
**解决**: 系统偏好设置 → 安全与隐私 → 完全磁盘访问 → 添加 Terminal/iTerm

### 问题: Python 找不到
**解决**: 确保 `ProgramArguments` 中的 Python 路径正确
```bash
which python3
/Library/Frameworks/Python.framework/Versions/3.13/bin/python3 --version
```

---

## 📝 最后更新
- **日期**: 2026-02-02
- **版本**: v0.6.9.0
- **状态**: ✅ 所有任务正常运行
