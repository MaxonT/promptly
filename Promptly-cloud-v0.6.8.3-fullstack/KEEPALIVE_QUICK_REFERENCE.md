# 🎯 Keep-Alive 快速参考卡片

## 📋 日志查看命令

```bash
# 查看完整日志（统一清晰格式）
cat ~/.promptly-keepalive.log

# 查看最近 5 条记录
tail -5 ~/.promptly-keepalive.log

# 实时跟随日志（按 Ctrl+C 退出）
tail -f ~/.promptly-keepalive.log
```

## 📊 日志格式（完全统一）

```
[时间戳] [状态符号] [详细信息]

例子：
[2026-01-29 11:02:28] ✅ Ping OK - Status: 200 (251ms)
[2026-01-29 12:40:28] 🔌 Connection Error
[2026-01-29 12:45:30] ⏳ Attempt 1 failed - Connection Error, retrying in 2s...
```

## ✨ 状态符号速查

| 符号 | 含义 | 说明 |
|------|------|------|
| ✅ | 成功 | Ping 成功，显示 HTTP 200 和响应时间(ms) |
| 🔌 | 网络错误 | 连接失败，会自动重试 |
| ⏳ | 重试中 | 失败后自动重试 |
| ⚠️ | 警告 | 初始化或其他信息 |

## 🔄 自动恢复

✅ **电脑唤醒后**：服务自动启动  
✅ **脚本崩溃**：5 秒内自动重启  
✅ **网络错误**：自动重试 3 次  

## 🛠 应急命令

### 重新启动服务
```bash
launchctl unload ~/Library/LaunchAgents/com.promptly.keepalive.plist
launchctl load ~/Library/LaunchAgents/com.promptly.keepalive.plist
```

### 检查服务是否运行
```bash
launchctl list | grep promptly
```

### 手动执行一次
```bash
~/Desktop/Github/Promptly-v0.6-CloudTest/Promptly-cloud-v0.6.8.3-fullstack/keep-alive.sh
```

## 📍 文件位置

| 文件 | 位置 |
|------|------|
| 脚本 | `~/Desktop/Github/Promptly-v0.6-CloudTest/Promptly-cloud-v0.6.8.3-fullstack/keep-alive.sh` |
| 日志 | `~/.promptly-keepalive.log` |
| Launchd 配置 | `~/Library/LaunchAgents/com.promptly.keepalive.plist` |

## ⏱ 执行频率

- **间隔**：每 10 分钟
- **时间点**：:00, :10, :20, :30, :40, :50

## 🎯 总结

✅ 日志格式统一清晰  
✅ 自动恢复机制完整  
✅ 故障时有清晰提示  
✅ 无需手动干预  

就这么简单！🚀
