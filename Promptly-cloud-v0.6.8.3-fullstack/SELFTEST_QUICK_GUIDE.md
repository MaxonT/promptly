# Self-Test 快速指南

## 🚀 快速使用

### 基本命令
```bash
cd backend
node scripts/selftest.js
```

---

## 📋 检查项目

### ✅ 环境变量
- `NODE_ENV` - 运行环境
- `JWT_SECRET` - JWT 密钥 ⚠️ Critical
- `OPENAI_API_KEY` - OpenAI 密钥 ⚠️ Critical

### ✅ 文件存在
- `package.json`
- `src/server.js`
- `.env.example`

### ✅ 健康端点
- `/api/health` 可访问
- 返回 `{"ok":true,"status":"healthy"}`

---

## 🔧 配置选项

```bash
# 自定义后端 URL
SELFTEST_BASE_URL=https://your-app.onrender.com node scripts/selftest.js

# 自定义超时
SELFTEST_TIMEOUT=10000 node scripts/selftest.js
```

---

## 📊 输出解释

### 符号说明
- ✅ 绿色: 检查通过
- ❌ 红色: 检查失败
- ⚠️ 黄色: 警告
- ℹ️ 青色: 信息

### 退出码
- `0`: 所有检查通过
- `1`: 有检查失败

---

## 🛠️ 常见问题

### 问题: "Cannot connect to http://localhost:8080"
**解决**: 确保后端服务器正在运行
```bash
npm start  # 在另一个终端
```

### 问题: "JWT_SECRET: Not set"
**解决**: 创建 .env 文件并设置
```bash
cp .env.example .env
# 编辑 .env，设置 JWT_SECRET
```

### 问题: "OPENAI_API_KEY: Not set"
**解决**: 在 .env 中添加 OpenAI API key
```bash
OPENAI_API_KEY=sk-proj-your-key-here
```

---

## 💡 使用场景

### 本地开发
```bash
# 开发前验证配置
node scripts/selftest.js
```

### CI/CD
```bash
# 部署前自动检查
npm run selftest  # 如果在 package.json 中配置
```

### 生产验证
```bash
# 验证 Render 部署
SELFTEST_BASE_URL=https://your-app.onrender.com node scripts/selftest.js
```

---

## 📝 示例输出

```
============================================================
🚀 Promptly Backend Self-Test
============================================================

📋 Checking Required Environment Variables...
✅ NODE_ENV: Set (Node environment)
✅ JWT_SECRET: Set (JWT signing secret)
✅ OPENAI_API_KEY: Set (OpenAI API key)

📁 Checking File System...
✅ package.json: Found
✅ src/server.js: Found
✅ .env.example: Found

🏥 Checking Health Endpoint...
✅ Health check passed (71ms)

============================================================
📊 Self-Test Summary
============================================================

Total checks: 7
Passed: 7
Failed: 0
Pass rate: 100%

============================================================

✅ All checks passed! Backend is ready.
```

---

**更多信息**: 查看 `D3_SELFTEST_SUMMARY.md`
