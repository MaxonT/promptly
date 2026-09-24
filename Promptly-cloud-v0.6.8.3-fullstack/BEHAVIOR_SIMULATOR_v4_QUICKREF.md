# 🚀 Behavior Simulator v4 - 快速参考卡

## 版本信息
- **当前版本**：v4 (健壮版本)
- **升级日期**：2026-02-02
- **改进点**：失败处理 + 同步验证 + 自动恢复 + 一致性检查

## ⚡ 快速开始

### 启动模拟器
```bash
# 通过 LaunchD（开机自启）
launchctl load ~/Library/LaunchAgents/com.promptly.behavior-simulator.plist

# 或直接运行
/opt/homebrew/bin/python3 backend/scripts/behavior-simulator.py
```

### 查看日志
```bash
# 实时日志
tail -f ~/.promptly-behavior-simulator.log

# 查看v4特定日志
tail -f ~/.promptly-behavior-simulator.log | grep "v4\|验证\|待同步\|一致性"
```

### 检查状态
```bash
# 模拟器是否在运行
pgrep -f "behavior-simulator.py" && echo "✅ 运行中" || echo "❌ 未运行"

# 待同步队列大小
jq 'length' ~/.promptly-pending-sync.json 2>/dev/null || echo "队列为空"

# 云端数据统计
curl -s https://promptly-v0-6-cloudtest-cursor-dev.onrender.com/api/analytics/dashboard/admin/realtime-count | jq '.realtime'
```

## 📊 核心功能一览

| 功能 | 说明 | 频率 |
|------|------|------|
| **数据生成** | 生成用户和会话 | 连续 |
| **本地同步** | 写入SQLite | 每批次 |
| **云端同步** | API调用 | 每批次 (3次重试) |
| **云端验证** | 验证数据真的写入 | 每批次 |
| **队列处理** | 处理失败的批次 | 每1小时 |
| **一致性检查** | 本地 vs 云端对比 | 每24小时 |

## 🔍 关键文件位置

```
行为模拟器脚本:
  /backend/scripts/behavior-simulator.py

待同步队列:
  ~/.promptly-pending-sync.json

运行日志:
  ~/.promptly-behavior-simulator.log

本地数据库:
  /backend/data/app.db

LaunchD配置:
  ~/Library/LaunchAgents/com.promptly.behavior-simulator.plist

升级文档:
  /BEHAVIOR_SIMULATOR_v4_UPGRADE.md
  /BEHAVIOR_SIMULATOR_v4_FINAL_REPORT.md
```

## 🎯 重要指标

### 日志关键词
- ✅ `✨ 数据已保存到本地和云端` - 同步成功
- ⚠️ `已加入待同步队列` - 需要稍后恢复
- 🔄 `处理待同步队列` - 正在恢复失败数据
- 🔍 `检查数据一致性` - 正在检查本地vs云端
- 📝 `从待同步队列中移除` - 批次恢复成功

### 性能指标
- 单批次耗时：~1-2秒
- 云端验证耗时：~1秒（3次重试内）
- 队列处理耗时：~10-30秒（最多5个批次）
- 一致性检查耗时：~5秒

## 🛠️ 常见操作

### 1. 重启模拟器
```bash
# 停止
launchctl unload ~/Library/LaunchAgents/com.promptly.behavior-simulator.plist

# 启动
launchctl load ~/Library/LaunchAgents/com.promptly.behavior-simulator.plist

# 或直接 kill
pkill -f "behavior-simulator.py"
```

### 2. 查看待同步队列
```bash
# 查看队列内容
cat ~/.promptly-pending-sync.json | jq '.'

# 统计待同步批次
cat ~/.promptly-pending-sync.json | jq 'length'

# 查看最高重试次数
cat ~/.promptly-pending-sync.json | jq 'max_by(.retries) | .retries'

# 清空队列（谨慎！）
rm ~/.promptly-pending-sync.json
```

### 3. 手动触发处理
```bash
# 编辑行为模拟器以立即处理待同步
# 或等待下一个1小时的自动处理周期
```

### 4. 检查数据一致性
```bash
# 查看本地数据
sqlite3 backend/data/app.db "SELECT COUNT(*) FROM analytics_users;"

# 查看云端数据
curl -s https://api-url/admin/realtime-count | jq '.realtime.analytics_users'

# 对比
echo "本地: $(sqlite3 backend/data/app.db 'SELECT COUNT(*) FROM analytics_users;')"
echo "云端: $(curl -s https://api-url/admin/realtime-count | jq '.realtime.analytics_users')"
```

## ⚠️ 故障排除

### 问题：模拟器不启动
**症状**：日志中有 `ModuleNotFoundError: requests`

**解决**：
```bash
/opt/homebrew/bin/python3 -m pip install requests --break-system-packages
```

### 问题：待同步队列堆积
**症状**：队列中批次越来越多，不清空

**排查**：
1. 检查云端 API 是否可用
2. 检查网络连接
3. 查看日志中的错误信息
4. 运行：`curl https://api-url/admin/realtime-count`

### 问题：数据一致性检查发现差距
**症状**：本地比云端多或少用户/会话

**处理**：
1. 检查待同步队列（可能还在处理中）
2. 等待下一个队列处理周期（1小时）
3. 如果差距很大，运行补同脚本：
   ```bash
   node backend/scripts/fix-sync-gap-unique.js
   ```

## 📈 监控 Dashboard

### 实时监控命令
```bash
# 完整监控（需要安装 watch）
watch -n 5 'echo "=== 模拟器状态 ==="; \
  pgrep -f "behavior-simulator" && echo "✅ 运行中" || echo "❌ 已停止"; \
  echo ""; echo "=== 待同步队列 ==="; \
  jq "length" ~/.promptly-pending-sync.json 2>/dev/null || echo "队列为空"; \
  echo ""; echo "=== 云端数据 ==="; \
  curl -s https://api-url/admin/realtime-count | jq ".realtime | {users: .analytics_users, sessions: .analytics_sessions}"'
```

### 简单监控脚本
```bash
#!/bin/bash
echo "[$(date)]"
echo "模拟器: $(pgrep -f behavior-simulator.py > /dev/null && echo ✅ 或 ❌)"
echo "待同步: $(jq 'length' ~/.promptly-pending-sync.json 2>/dev/null || echo '空')"
curl -s https://api-url/admin/realtime-count | jq '.realtime'
```

## 📚 更多信息

详细升级文档：[BEHAVIOR_SIMULATOR_v4_UPGRADE.md](./BEHAVIOR_SIMULATOR_v4_UPGRADE.md)

完整执行报告：[BEHAVIOR_SIMULATOR_v4_FINAL_REPORT.md](./BEHAVIOR_SIMULATOR_v4_FINAL_REPORT.md)

## 🆘 获取帮助

### 检查日志
```bash
# 查看最近50行
tail -50 ~/.promptly-behavior-simulator.log

# 查看最近错误
grep ERROR ~/.promptly-behavior-simulator.log | tail -20

# 查看v4特定的操作
grep -E "v4|健壮|验证|待同步|一致性" ~/.promptly-behavior-simulator.log | tail -30
```

### 关键日志位置
- 启动信息：日志开头的 `╔══╗` 分隔符之间
- 数据同步：搜索 `📦 准备插入数据`
- 云端验证：搜索 `🔍 云端验证`
- 队列处理：搜索 `🔄 处理待同步队列`
- 一致性检查：搜索 `🔍 检查数据一致性`

---

**v4 版本已就绪！行为模拟器现已达到生产级别的健壮性。** ✅

更新于：2026-02-02
版本：v4.0
