# 🔴 Analytics Dashboard 数据不一致问题诊断报告

**日期**: 2026-02-19  
**问题**: 时间线停在1.29，用户数从4000+掉到2000+

---

## 📊 问题现状

### 本地数据库（SQLite）✅ 正常
```
- 总用户数: 4829
- analytics_daily 记录: 连续到 2026-02-19
- 最新数据: 2026-02-19 (6个新用户, 累计4819)
- 历史数据: 完整，从 2026-01-30 到现在
```

### 云端数据库（Render.com - PostgreSQL）❌ 异常
```json
{
  "analytics_users": 2468,
  "analytics_daily_records": 64,
  "latestDaily": {
    "date": "2026-02-19",
    "cumulative_users": 2468,
    "unique_users": 1108,  // ⚠️ 异常：单日1108用户
    "new_users": 1108
  }
}
```

**异常点：**
- ❌ 云端只有2468用户（本地有4829，差距2361）
- ❌ 2月19日显示新增1108用户（明显不正常）
- ❌ 数据看起来像被重置后重新生成的

---

## 🔍 根本原因

1. **双数据库架构问题**
   - 本地: SQLite (`backend/data/app.db`)
   - 云端: PostgreSQL (Render.com托管)
   - 两个数据库**完全独立**，没有自动同步机制

2. **behavior-simulator.py 的同步逻辑缺陷**
   ```python
   # 当前逻辑（有问题）：
   local_success = insert_data_to_local_db(users, sessions)  # ✅ 成功
   api_success = api_call_generate_data(users, sessions)     # ✅ API返回200
   # 但这不代表云端数据库真的写入了！
   ```

3. **云端数据库可能的问题**
   - Render.com免费版会在15分钟不活动后休眠
   - 休眠后重启可能导致数据丢失（如果使用临时存储）
   - 或者在某次部署/重启时数据库被清空

---

## ✅ 即时解决方案（推荐）

### 方案 A: 使用本地 Analytics Dashboard
本地数据是完整且最新的，可以立即查看：

```bash
# 1. 启动本地后端（如果还没启动）
cd backend
npm run dev

# 2. 在浏览器打开本地dashboard
open http://localhost:8080/analytics-dashboard.html
```

**优点：**
- ✅ 数据完整（4829用户）
- ✅ 时间线连续（到今天）
- ✅ 实时更新

**本地dashboard会显示你期望的4000+用户数据。**

---

### 方案 B: 修复云端数据库

如果你需要云端dashboard正常工作，有几个选项：

#### B1. 重新将本地数据推送到云端（简单但有限制）
```bash
# ⚠️ 注意：这会覆盖云端现有数据
cd backend
node scripts/sync-local-to-cloud.js
```

**限制：**
- 只适用于相同的数据库类型（SQLite → SQLite 或 PostgreSQL → PostgreSQL）
- 如果云端是PostgreSQL，需要特殊处理

#### B2. 修复behavior-simulator的云端同步逻辑（推荐长期方案）

**问题代码**（`behavior-simulator.py` 第520行左右）：
```python
# 当前逻辑判断错误
if local_success:
    if api_success:
        verify_ok, cloud_users, cloud_sessions = verify_cloud_sync(users, sessions)
        # ...
    else:
        # 即使云端失败，也返回True（导致数据不一致）
        add_pending_sync(users, sessions)
        return True  # ❌ 不应该返回True
else:
    log_message("❌ 本地和云端都失败", "ERROR")
    return False
```

**修复方案**：
1. 修改逻辑，确保云端真的写入数据
2. 增加更严格的验证机制
3. 如果云端失败，应该记录错误并重试

---

## 🔧 长期解决方案

### 1. 统一数据源
**选项 A**: 只使用云端数据库
```env
# backend/.env
DATABASE_URL=postgresql://user:pass@host/db
# 移除 SQLITE_PATH
```

**选项 B**: 只使用本地数据库
```env
# 删除 DATABASE_URL
SQLITE_PATH=./data/app.db
```

### 2. 实施真正的数据同步
如果需要保持双数据库，需要实现：
- 主从复制机制
- 定时同步任务
- 冲突解决策略

### 3. 修复behavior-simulator
```python
def api_call_generate_data(users, sessions, retries=0):
    # 修改为：两个数据库都成功才算成功
    local_success = insert_data_to_local_db(users, sessions)
    api_success = call_cloud_api(users, sessions)
    
    # 验证云端真的写入了
    if api_success:
        cloud_verify = verify_cloud_data_written(users, sessions)
        api_success = cloud_verify
    
    # 只有两者都成功才返回True
    if local_success and api_success:
        log_message("✨ 本地和云端都已同步")
        return True
    else:
        # 任何一个失败都应该报错
        log_message(f"❌ 同步失败: local={local_success}, cloud={api_success}", "ERROR")
        add_pending_sync(users, sessions)
        return False  # ⚠️ 应该返回False
```

---

## 📝 立即行动建议

1. **马上**：使用方案A，打开 `http://localhost:8080/analytics-dashboard.html` 查看本地数据

2. **短期**（今天）：
   - 检查云端数据库配置（是否是临时存储）
   - 考虑是否需要云端dashboard（本地已经有完整数据）

3. **长期**（本周）：
   - 决定使用单一数据源还是双数据库
   - 如果使用双数据库，实施真正的同步机制
   - 修复behavior-simulator的逻辑错误

---

## 🔍 验证步骤

### 检查本地数据库
```bash
cd backend
sqlite3 data/app.db "SELECT COUNT(*) FROM analytics_users"
# 应该看到: 4829

sqlite3 data/app.db "SELECT date, cumulative_users FROM analytics_daily ORDER BY date DESC LIMIT 5"
# 应该看到连续的日期到今天
```

### 检查云端数据库
```bash
curl https://promptly-v0-6-cloudtest-cursor-dev.onrender.com/api/analytics/dashboard/admin/realtime-count
# 会看到: 2468 用户（异常）
```

### 检查behavior-simulator状态
```bash
ps aux | grep behavior-simulator
# 应该看到进程在运行

tail -100 ~/.promptly-behavior-simulator.log
# 检查最近的同步日志
```

---

## ❓ FAQ

**Q: 为什么之前看到4000+，现在变成2000+？**  
A: 你之前可能看的是本地dashboard，现在看的是云端dashboard。云端数据库在某个时间点被重置了。

**Q: 1.29之后的数据去哪了？**  
A: 数据在本地数据库里（4829用户，完整历史），但云端数据库不完整。

**Q: behavior-simulator还在工作吗？**  
A: 是的，它在工作，并且成功写入本地数据库。但云端同步有问题。

**Q: 我应该使用哪个数据库？**  
A: 推荐使用本地SQLite（已有完整数据），或者统一迁移到云端PostgreSQL。

---

## 📞 如需帮助

如果需要进一步调查或修复，请提供：
1. Render.com的数据库配置（是临时还是持久存储）
2. `backend/.env` 的数据库配置（隐藏敏感信息）
3. 是否需要保留云端dashboard功能
