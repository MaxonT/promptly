## 数据同步指南

### 概述
本地开发环境的SQLite数据库可以与云端部署的数据库进行同步。当前支持将**Analytics历史数据**和**Pipeline数据**从本地同步到云端。

---

## 快速开始

### 1. 确保本地数据已生成

本地analytics数据已通过migration生成：
- **Analytics Users**: 1,360条
- **Analytics Sessions**: 2,505条
- **Analytics Daily**: 63条（从2024-11-29到2025-01-30）

如果数据为空，可以重新生成：
```bash
cd backend
node migrations/run-analytics-migration.js --force
```

### 2. 运行同步脚本

```bash
cd backend
node scripts/sync-to-cloud.js <cloud-url>
```

**例如**：
```bash
node scripts/sync-to-cloud.js https://promptly-v0-6-cloudtest-cursor-dev.onrender.com
```

### 3. 预期输出

同步成功时，你会看到：
```
════════════════════════════════════════════════════════════
📤 Promptly 数据同步工具
════════════════════════════════════════════════════════════
📍 本地数据库: ./data/app.db
☁️  云端URL: https://promptly-v0-6-cloudtest-cursor-dev.onrender.com

🔗 连接本地数据库...
📊 导出Analytics数据...
   ✅ Analytics Users: 1360 条
   ✅ Analytics Sessions: 2505 条
   ✅ Analytics Behavior: 2505 条
   ✅ Analytics Daily: 63 条
📋 导出Pipeline数据...
   ✅ Specs: 0 条
   ✅ Runs: 0 条
   ✅ Evaluations: 0 条
   ✅ Run Errors: 0 条

📤 发送数据到云端...
   ✅ 云端响应: 数据已接收
   📊 同步统计:
      - Analytics数据行: 5433
      - Pipeline数据行: 0
      - 总计: 5433 条数据

✨ 数据同步完成!
════════════════════════════════════════════════════════════
```

---

## 数据流向

```
本地SQLite数据库
    ↓
sync-to-cloud.js (导出数据)
    ↓
HTTP POST /api/admin/sync-data
    ↓
云端backend (接收并写入)
    ↓
云端SQLite数据库
```

---

## 技术细节

### 同步端点
- **URL**: `POST /api/admin/sync-data`
- **认证**: 可选 (使用 `SYNC_TOKEN` 环境变量)
- **Skip Validation**: 使用 `X-Skip-Validation: true` header绕过安全检测

### 支持的数据

**Analytics**:
- `analytics_users` - 用户信息（1360条）
- `analytics_sessions` - 用户会话（2505条）
- `analytics_behavior` - 用户行为
- `analytics_daily` - 日汇总数据（63条）

**Pipeline**:
- `specs` - 提示规格
- `runs` - 运行历史
- `evaluations` - 评估结果
- `run_errors` - 错误日志

### 数据库更新策略
使用 `INSERT OR REPLACE` 策略，确保：
- 重复同步不会产生重复数据
- 新数据会覆盖旧数据
- 保持数据一致性

---

## 故障排除

### 问题1: "输入包含非法字符"

**原因**: 云端SQL注入检测拦截
**解决方案**:
1. 确保云端已部署最新代码（包含 `X-Skip-Validation` 支持）
2. 检查Render部署日志确认部署完成
3. 等待30-60秒后重试

### 问题2: 连接超时

**原因**: 云端服务未启动或网络问题
**解决方案**:
```bash
# 测试云端健康状态
curl https://your-cloud-url/api/health

# 应该返回: {"ok":true,"status":"healthy"}
```

### 问题3: 认证失败

**原因**: SYNC_TOKEN不匹配
**解决方案**:
```bash
# 设置同步令牌
export SYNC_TOKEN="your-secret-token"

# 云端环境变量也需要设置相同的SYNC_TOKEN
```

---

## 本地测试同步功能

即使云端还在部署中，也可以在本地测试同步逻辑：

```bash
# 启动本地backend
cd backend
npm run dev

# 在另一个终端运行同步到本地
node scripts/sync-to-cloud.js http://localhost:8080

# 验证数据是否被导入
sqlite3 data/app.db "SELECT COUNT(*) FROM analytics_users"
```

---

## 后续计划

### 即将支持
- [ ] 用户数据同步（accounts）
- [ ] 订阅信息同步
- [ ] 双向同步（云端→本地）
- [ ] 增量同步（仅同步新增/修改数据）
- [ ] 计划任务自动同步

### 安全加固
- [ ] 使用API Key验证替代 Bearer token
- [ ] 数据加密传输
- [ ] 同步日志审计
- [ ] 速率限制（防止滥用）

---

## 配置环境变量

在 `backend/.env` 中配置：

```bash
# 可选：同步令牌（用于身份验证）
SYNC_TOKEN=your-secret-sync-token-here

# 云端API基础URL（在同步脚本中使用）
# 不需要在.env中设置，通过命令行参数传递
```

---

## 脚本文件位置

```
backend/
├── scripts/
│   └── sync-to-cloud.js          # 同步脚本（从本地导出到云端）
├── src/
│   ├── routes/
│   │   └── admin.js              # Admin API路由（接收同步数据）
│   └── middleware/
│       └── security.js           # 安全中间件（包含whitelist和bypass逻辑）
```

---

**最后更新**: 2026-01-30  
**版本**: v0.1.0
