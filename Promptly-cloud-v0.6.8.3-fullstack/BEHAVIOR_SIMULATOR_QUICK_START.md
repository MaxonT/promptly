# 行为模拟器双向同步 - 快速开始

## 🚀 你需要知道的

行为模拟器已升级！现在**数据同时发送到两个地方**：

```
行为模拟器 → 本地 SQLite ✅
         └→ 云端 API    ☁️
```

## 📝 修改说明

### 改动了什么？

✅ **修改了**: `backend/scripts/behavior-simulator.py`
- 新增本地数据库写入功能
- 云端发送逻辑保持**完全不变**
- 如果云端不可用，本地数据仍会保存

✅ **新增了**:
- `backend/scripts/test-dual-sync.py` - 验证脚本
- `BEHAVIOR_SIMULATOR_DUAL_SYNC.md` - 详细文档

### 没有改动什么？

❌ **保持不变**:
- 云端 API 地址 (仍发送到 Render)
- API 调用频率
- 数据生成算法
- 其他所有脚本

## 🧪 验证工作

```bash
# 1. 查看数据库状态
cd backend && python3 scripts/test-dual-sync.py

# 2. 查看日志（运行中）
tail -f ~/.promptly-behavior-simulator.log

# 3. 直接查询数据库
sqlite3 backend/data/app.db "SELECT COUNT(*) FROM analytics_users;"
```

## ⚙️ 启动模拟器

### 如果已经在运行

什么都不用做，重启后会自动使用新版本：

```bash
# 停止旧版本
launchctl stop com.promptly.behavior.simulator

# 重启（自动使用新代码）
launchctl start com.promptly.behavior.simulator
```

### 手动启动

```bash
cd backend && python3 scripts/behavior-simulator.py
```

## 📊 数据流向

| 目标 | 地址 | 保证 |
|------|------|------|
| 本地 | `backend/data/app.db` | 本地写入成功则数据不丢失 ✅ |
| 云端 | Render API | 会自动重试 + 后续可通过 sync 恢复 ✅ |

## 🔄 数据同步

如果云端数据丢失（如Render重新部署）：

```bash
# 手动恢复
cd backend && node scripts/sync-now.sh

# 或等待自动同步（cron job 每3小时）
```

## 📚 完整文档

详见: [BEHAVIOR_SIMULATOR_DUAL_SYNC.md](BEHAVIOR_SIMULATOR_DUAL_SYNC.md)

---

**TL;DR**: 行为模拟器现在更可靠了，数据有双重保险！💪

