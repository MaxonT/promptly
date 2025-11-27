# Promptly 环境变量配置指南

## 📋 快速开始

### 1️⃣ 本地开发设置

#### 后端 (Backend)
```bash
cd backend
cp .env.example .env
# 编辑 .env 文件，至少设置这些必需变量：
# - OPENAI_API_KEY=your-actual-key
# - JWT_SECRET=your-secret-string
```

#### 前端 (Frontend)
```bash
cd frontend
cp .env.example .env.local
# 编辑 .env.local:
# - VITE_API_BASE=http://localhost:8080
```

---

## 🚀 生产环境部署

### Render (后端)

在 Render 项目的 Environment Variables 中添加：

| 变量名 | 值 | 必需 |
|--------|-----|------|
| `NODE_ENV` | `production` | ✅ |
| `JWT_SECRET` | `你的长随机字符串` | ✅ |
| `OPENAI_API_KEY` | `sk-proj-...` | ✅ |
| `SQLITE_PATH` | `./data/app.db` | ✅ |
| `CORS_ORIGIN` | `https://your-app.vercel.app` | 推荐 |
| `OPENAI_MODEL` | `gpt-4.1-mini` | 可选 |
| `LINK_BASE` | `https://your-app.onrender.com/share/` | 可选 |

### Vercel (前端)

在 Vercel 项目的 Settings → Environment Variables 中添加：

| 变量名 | 值 | 必需 |
|--------|-----|------|
| `VITE_API_BASE` | `https://your-app.onrender.com` | ✅ |

**重要**: 不要在 `VITE_API_BASE` 的 URL 后面添加斜杠！

---

## 📖 环境变量说明

### 后端必需变量

- **NODE_ENV**: 运行环境 (`development` / `production`)
- **JWT_SECRET**: JWT 令牌签名密钥（至少 32 字符）
- **OPENAI_API_KEY**: OpenAI API 密钥
- **SQLITE_PATH**: SQLite 数据库文件路径

### 后端可选变量

- **PORT**: 服务器端口（默认: 8080）
- **CORS_ORIGIN**: 允许的前端源（默认: `*`）
- **OPENAI_MODEL**: 默认 LLM 模型（默认: `gpt-4.1-mini`）
- **LINK_BASE**: 分享链接基础 URL
- **MAX_CANDIDATES**: Outcome Runner 最大候选数（默认: 8）

### 前端必需变量

- **VITE_API_BASE**: 后端 API 基础 URL

---

## ⚠️ 安全提示

1. **永远不要**将 `.env` 文件提交到 Git
2. `.env.example` 文件只包含示例值，可以安全提交
3. 在生产环境中使用强随机字符串作为 `JWT_SECRET`
4. 定期轮换你的 API 密钥

---

## 🔍 验证配置

### 检查后端健康状态
```bash
curl http://localhost:8080/api/health
# 应返回: {"ok":true,"status":"healthy",...}
```

### 检查后端设置
```bash
curl http://localhost:8080/api/settings
# 应返回配置信息，包括 llmEnabled 等
```

---

## 📝 故障排除

### 问题: "LLM features are disabled"
**解决**: 检查 `OPENAI_API_KEY` 是否正确设置

### 问题: CORS 错误
**解决**: 设置 `CORS_ORIGIN` 为你的前端 URL

### 问题: 前端无法连接后端
**解决**: 
1. 检查 `VITE_API_BASE` 是否正确
2. 确认后端 URL 没有尾部斜杠
3. 检查后端是否正常运行

---

## 📚 相关文档

- `backend/.env.example` - 后端环境变量模板
- `frontend/.env.example` - 前端环境变量模板
- `README.md` - 项目总体说明

