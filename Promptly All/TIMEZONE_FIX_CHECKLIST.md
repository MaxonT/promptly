# ✅ 时区用量刷新修复 - 完整检查清单

## 实现清单

### 代码修改 ✅
- [x] **backend/src/lib/dailyRefreshJob.js** - 完全重写
  - [x] 添加 `normalizeTimeZone` 和 `getLocalDateKey` 导入
  - [x] 修改 `getActiveUsers()` 以获取用户时区
  - [x] 新增 `shouldRefreshUserToday()` 函数
  - [x] 新增 `markUserRefreshedToday()` 函数
  - [x] 重写 `refreshUserTokens()` 逻辑
  - [x] 重写 `runDailyRefresh()` 为时区感知
  - [x] 重写 `shouldRunRefresh()` 为始终返回 true
  - [x] 重写 `startScheduler()` 说明
  - [x] 重写 `forceRefresh()` 清除所有追踪记录

### 数据库模式 ✅
- [x] **backend/src/lib/db.js** (SQLite)
  - [x] 添加 `user_daily_refresh_tracker` 表定义
  - [x] 添加索引 `idx_refresh_tracker_updated`

- [x] **backend/src/lib/db-pg.js** (PostgreSQL)
  - [x] 添加 `user_daily_refresh_tracker` 表定义
  - [x] 添加索引 `idx_refresh_tracker_updated`

- [x] **users 表已有时区列**
  - [x] `timezone TEXT DEFAULT 'UTC'`
  - [x] `timezone_updated_at TEXT`

### 迁移脚本 ✅
- [x] **backend/migrations/002_timezone_refresh.js** (新建)
  - [x] 创建 `user_daily_refresh_tracker` 表
  - [x] 创建必要索引
  - [x] 已成功运行

### 文档 ✅
- [x] **TIMEZONE_USAGE_REFRESH_FIX.md** - 技术文档
- [x] **TIMEZONE_REFRESH_IMPLEMENTATION_SUMMARY.md** - 实现总结

## 功能验证 ✅

### 数据库表
```
✓ users 表 - 包含 timezone 列 (默认: 'UTC')
✓ subscriptions 表 - 追踪用户订阅
✓ token_ledger 表 - 记录用量
✓ user_daily_refresh_tracker 表 - 追踪最后刷新日期（本地）
```

### 时区计算
```
✓ UTC          → 2026-02-03
✓ America/NY   → 2026-02-03
✓ Asia/Tokyo   → 2026-02-04 (✓ 与其他不同!)
✓ America/LA   → 2026-02-03
```

### 刷新逻辑
```
✓ 每小时运行一次检查
✓ 对每个用户计算其本地日期
✓ 比较与记录的最后刷新日期
✓ 如果日期不同 → 刷新用量
✓ 更新追踪表记录新日期
```

### 向后兼容
```
✓ 现有用户默认时区为 'UTC'
✓ 现有用量记录不受影响
✓ 现有的 token_ledger 继续工作
✓ 现有的订阅系统不变
```

## 部署说明

### 前置条件
1. 当前代码版本：v0.6.10.x 或更新
2. 数据库：SQLite 或 PostgreSQL

### 部署步骤
```bash
# 1. 拉取最新代码
git pull

# 2. 运行迁移脚本
cd backend
node migrations/002_timezone_refresh.js

# 3. 重启后端服务
npm run start
# 或
npm run dev
```

### 验证部署
```bash
# 检查表是否存在
sqlite3 data/app.db "SELECT name FROM sqlite_master WHERE type='table' AND name='user_daily_refresh_tracker';"

# 应输出: user_daily_refresh_tracker

# 测试刷新逻辑
node -e "import('./src/lib/dailyRefreshJob.js').then(m => console.log(m.runDailyRefresh()))"
```

## 监控指标

### 日志观察
```
[dailyRefresh] Starting daily token refresh (checking all users' local timezones)...
[dailyRefresh] User ABC refreshed for local date 2026-02-03 (timezone: America/New_York)
[dailyRefresh] User XYZ skipped - already refreshed for 2026-02-04
[dailyRefresh] Completed: 15 refreshed, 8 skipped, 0 failed
```

### 数据库查询
```sql
-- 查看用户及其时区
SELECT id, email, timezone FROM users LIMIT 10;

-- 查看最后刷新记录
SELECT * FROM user_daily_refresh_tracker ORDER BY updated_at DESC LIMIT 10;

-- 查看不同时区的用户数
SELECT timezone, COUNT(*) as user_count FROM users GROUP BY timezone;
```

## 已知限制和注意事项

1. **初始状态**
   - 新用户默认时区为 'UTC'
   - 用户可以通过设置界面更改时区

2. **时区更改**
   - 当用户更改时区时，系统在下次刷新时使用新时区
   - 不会立即重置用量

3. **性能**
   - 每小时运行一次，对 1000+ 用户影响可忽略
   - 查询已优化，使用了索引

4. **时区支持**
   - 仅支持 IANA 标准时区（如 'America/New_York'）
   - 无效时区会回退到 'UTC'

## 故障排查

### 问题：用户未在预期时间刷新
**解决方案**：
1. 检查用户的 `timezone` 值：`SELECT timezone FROM users WHERE id = 'USER_ID'`
2. 确认时区有效（IANA 格式）
3. 检查 `user_daily_refresh_tracker` 表中的记录是否存在

### 问题：迁移脚本失败
**解决方案**：
```bash
# 检查表是否已存在
sqlite3 data/app.db ".tables" | grep user_daily_refresh_tracker

# 如果表已存在但有问题，可以删除（谨慎操作）
sqlite3 data/app.db "DROP TABLE IF EXISTS user_daily_refresh_tracker;"
node migrations/002_timezone_refresh.js
```

### 问题：时区日期计算错误
**解决方案**：
1. 验证系统时区设置正确
2. 检查 timezone.js 中的 `getLocalDateKey()` 函数
3. 测试特定时区：
```bash
node -e "
import('./src/lib/timezone.js').then(({getLocalDateKey, normalizeTimeZone}) => {
  const tz = normalizeTimeZone('Asia/Tokyo');
  console.log(getLocalDateKey(tz));
})
"
```

## 版本信息

- **修复版本**: v0.6.11.1
- **修复日期**: 2026-02-03
- **状态**: ✅ 完成且验证通过

## 相关文档

- [TIMEZONE_USAGE_REFRESH_FIX.md](./TIMEZONE_USAGE_REFRESH_FIX.md) - 技术实现详情
- [TIMEZONE_REFRESH_IMPLEMENTATION_SUMMARY.md](./TIMEZONE_REFRESH_IMPLEMENTATION_SUMMARY.md) - 中英文实现总结

