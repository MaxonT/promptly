# 🚀 Keep-Alive 最终版本 - 统一日志格式 + 自动恢复

## ✅ 最新改进

### 1️⃣ **统一清晰的日志格式**

所有日志现在采用统一格式：
```
[时间戳] [状态符号] [详细信息]
```

**示例：**
```
[2026-01-29 11:02:28] ⚠️  Service initialized - Keep-alive started
[2026-01-29 11:02:28] ✅ Ping OK - Status: 200 (251ms)
[2026-01-29 11:02:34] ✅ Ping OK - Status: 200 (314ms)
[2026-01-29 11:02:35] ✅ Ping OK - Status: 200 (282ms)
[2026-01-29 12:40:28] 🔌 Connection Error
[2026-01-29 12:45:30] ✅ Ping OK - Status: 200 (1421ms)
```

**状态符号说明：**
- `✅` = Ping 成功（显示 HTTP 状态码和响应时间）
- `🔌` = 连接错误（网络问题）
- `⏳` = 重试中（失败后自动重试）
- `⚠️` = 警告或初始化信息

### 2️⃣ **自动恢复机制**

已配置 launchd 支持以下自动恢复：

#### A. 电脑唤醒后自动启动
```
<key>RunAtLoad</key>
<true/>
```
- 当电脑启动或从睡眠中唤醒时，服务自动启动
- 无需手动干预

#### B. 任务崩溃自动重启
```
<key>KeepAlive</key>
<true/>
<key>ThrottleInterval</key>
<integer>5</integer>
```
- 如果脚本因任何原因崩溃，launchd 会在 5 秒内重启
- 确保服务持续运行

---

## 📊 日志查看命令

现在所有日志都采用统一格式，查看时会很清晰：

```bash
# 查看完整日志（统一格式）
cat ~/.promptly-keepalive.log

# 查看最近 5 条（每条都很清晰）
tail -5 ~/.promptly-keepalive.log

# 实时跟随日志（按 Ctrl+C 退出）
tail -f ~/.promptly-keepalive.log
```

**示例输出：**
```
[2026-01-29 11:02:28] ⚠️  Service initialized - Keep-alive started
[2026-01-29 11:02:28] ✅ Ping OK - Status: 200 (251ms)
[2026-01-29 11:02:34] ✅ Ping OK - Status: 200 (314ms)
```

---

## 🔄 电脑睡眠和唤醒场景

### 场景 1：电脑进入睡眠
- Launchd 服务继续运行（macOS 特性）
- 定时器暂停（不消耗 CPU）

### 场景 2：电脑唤醒
- Launchd 立即恢复
- `RunAtLoad=true` 确保服务启动
- Keep-alive 立即开始工作

### 场景 3：脚本崩溃
- Launchd 检测到崩溃
- 5 秒内自动重启脚本
- 日志记录：`🔌 Connection Error`

---

## 🔍 监控和诊断

### 快速检查
```bash
# 查看 Launchd 服务状态
launchctl list | grep promptly

# 查看最新日志
tail -1 ~/.promptly-keepalive.log
```

### 完整诊断
```bash
# 使用监控脚本（显示 Launchd/Cron 状态 + 日志）
./monitor-keepalive.sh

# 实时监控（带日志跟随）
./monitor-keepalive.sh --follow
```

---

## 🛠 故障排查

### 日志完全停止更新
```bash
# 1. 检查 Launchd 状态
launchctl list | grep promptly

# 2. 看日志
tail ~/.promptly-keepalive.log

# 3. 如果看到 "🔌 Connection Error"
   -> 网络问题，脚本会自动重试

# 4. 如果服务完全停止
   -> 重新加载：
   launchctl unload ~/Library/LaunchAgents/com.promptly.keepalive.plist
   launchctl load ~/Library/LaunchAgents/com.promptly.keepalive.plist
```

---

## 📝 日志格式规范

所有日志遵循以下格式：

```
[YYYY-MM-DD HH:MM:SS] [STATUS_ICON] [MESSAGE]
```

**消息内容：**
- ✅ 成功：`Ping OK - Status: 200 (XXXms)`
- 🔌 错误：`Connection Error`
- ⏳ 重试：`Attempt N failed - [Error Type], retrying in 2s...`
- ⚠️ 初始化：`Service initialized - Keep-alive started`

---

## ✨ 保证事项

✅ **日志统一清晰** — 每条日志格式一致  
✅ **自动恢复** — 电脑唤醒后自动启动  
✅ **故障诊断** — 清晰的错误提示  
✅ **持续运行** — 脚本崩溃自动重启  
✅ **定时执行** — 每 10 分钟执行一次（电脑活跃时）

---

## 🚀 总结

你的 Keep-Alive 系统现在有：
1. **清晰统一的日志** — 一眼就能看出发生了什么
2. **自动恢复机制** — 无需手动干预
3. **完整的诊断工具** — 出问题时可以快速定位

现在可以放心使用了！如果有任何问题，日志会清晰地显示。
