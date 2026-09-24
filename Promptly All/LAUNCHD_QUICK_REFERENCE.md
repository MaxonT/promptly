# 🚀 Promptly LaunchD 快速参考

## 📊 当前系统状态

```
✅ com.promptly.behavior.simulator      (PID: 55927) - 持续运行
✅ com.promptly.background-sync         (PID: 58088) - 每 1 小时
✅ com.promptly.v0_6.keepalive          (PID: 29152) - 定期 ping

📈 本地数据库: 1398 用户
☁️  云端状态: 同步 ✅
```

---

## 🔧 最常用命令

### 查看所有任务
```bash
launchctl list | grep promptly
```

### 查看日志
```bash
# 行为模拟器主日志
tail -f ~/.promptly-behavior-simulator.log

# 背景同步日志
tail -f ~/.promptly-sync-background.out.log
```

### 重启行为模拟器（应用新配置）
```bash
launchctl stop com.promptly.behavior.simulator
launchctl start com.promptly.behavior.simulator
```

### 手动运行背景同步
```bash
launchctl start com.promptly.background-sync
```

---

## 📋 脚本位置

| 脚本 | 路径 |
|------|------|
| 行为模拟器 | `backend/scripts/behavior-simulator.py` |
| 背景同步 | `backend/scripts/sync-data-background.py` |
| LaunchD 配置 | `~/Library/LaunchAgents/com.promptly*.plist` |

---

## 🔄 数据流

```
行为模拟器 (每 12-96 分钟)
    ├─ 生成 12-50 个用户
    ├─ 写入 SQLite (本地)
    └─ 发送 API (云端)

背景同步 (每 1 小时)
    ├─ 检查本地数据库
    ├─ 验证云端 API
    └─ 记录日志
```

---

## ⚙️ 2.5x 速度配置

| 参数 | 值 |
|------|-----|
| 晚上概率 | 50% |
| 下午概率 | 100% |
| 批次大小 | 12-50 |
| 周期 | 12-96 分钟 |

---

## 💡 提示

- 所有脚本都在 macOS 启动时自动启动
- 断网自动重试，网络恢复后继续
- 日志保存在 `~/.promptly-*.log`
- 故障自动恢复（`KeepAlive: true` 用于行为模拟器）
