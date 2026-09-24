# 🎯 Promptly 自动同步 - 快速参考卡

## ✅ 配置完成状态

```
✅ LaunchD 任务运行中
✅ 同步间隔: 600秒 (每10分钟)
✅ 智能同步脚本已部署
✅ 差异阈值: 5条记录
```

---

## 🔄 工作机制

**每 10 分钟自动执行**:

1. 检查云端服务健康状态
2. 对比本地和云端数据统计
3. 如果 `本地 - 云端 >= 5`，自动执行完整同步
4. 记录所有操作到日志文件

---

## 📋 常用命令

### 查看系统状态
```bash
cd backend
./scripts/manage.sh status
```

### 手动触发同步
```bash
cd backend
./scripts/manage.sh sync
```

### 查看自动同步日志
```bash
# 实时查看
tail -f ~/Desktop/Github/Promptly-v0.6-CloudTest/Promptly-cloud-v0.6.8.3-fullstack/logs/sync-background.log

# 最近30行
tail -30 ~/.promptly-sync-background.out.log
```

### 检查 LaunchD 任务
```bash
launchctl list | grep promptly
```

### 手动运行同步检查
```bash
cd backend
python3 scripts/sync-data-background.py
```

---

## 🛠️ 调整配置

### 更改同步频率

编辑: `~/Library/LaunchAgents/com.promptly.background-sync.plist`

```xml
<!-- 5分钟 -->
<integer>300</integer>

<!-- 10分钟 (当前) -->
<integer>600</integer>

<!-- 15分钟 -->
<integer>900</integer>
```

重新加载:
```bash
launchctl unload ~/Library/LaunchAgents/com.promptly.background-sync.plist
launchctl load ~/Library/LaunchAgents/com.promptly.background-sync.plist
```

### 更改同步阈值

编辑: `backend/scripts/sync-data-background.py`

第 29 行:
```python
SYNC_THRESHOLD = 5  # 改为其他值
```

---

## 📊 当前数据状态

- **本地**: 1878 用户, 3286 会话
- **云端**: 1917 用户, 3624 会话
- **差异**: 云端较多（行为模拟器一直在写入）

---

## ⚠️ 重要说明

1. **同步方向**: 本地 → 云端（以本地为准）
2. **触发条件**: 本地比云端多 >= 5 条
3. **云端较多时**: 记录警告，不自动同步
4. **部署后**: 最多等待10分钟，自动检测并同步

---

## 🎉 完成！

系统现在会：
- ✅ 每10分钟自动检查
- ✅ 智能判断是否需要同步
- ✅ 自动执行数据同步
- ✅ 完整日志记录

**无需手动干预，系统自动维护数据一致性！** 🚀
