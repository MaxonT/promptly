# Promptly 完整部署指南

## 概述

- **前端**: Vercel (静态网站)
- **后端**: Render (Node.js Web Service)
- **配置**: 使用环境变量 (不在代码中硬编码)

## 🎯 部署架构

```
用户浏览器
    ↓
Vercel 前端 (https://promptly-xxx.vercel.app)
    ↓ (API 请求)
Render 后端 (https://promptly-xxx.onrender.com)
    ↓
OpenAI API
```

---

## 📦 第一步：部署后端到 Render

### 1.1 准备 Git 仓库

```bash
cd /Users/yangming/Desktop/Github/Promptly-v0.6-CloudTest/Promptly-cloud-v0.6.8.3-fullstack

# 提交所有更改
git add .
git commit -m "feat: 添加环境变量支持和完整的后端路由"
git push origin main
```

### 1.2 在 Render 创建 Web Service

1. 登录 [Render Dashboard](https://dashboard.render.com/)
2. 点击 "New +" → "Web Service"
3. 连接你的 Git 仓库
4. 配置如下：

**Basic Settings:**
- **Name**: `promptly-v0-6-cloudtest-cursor-dev` (或你喜欢的名字)
- **Region**: 选择离你最近的区域
- **Branch**: `main`
- **Root Directory**: `backend`
- **Runtime**: `Node`

**Build & Deploy:**
- **Build Command**: `npm install`
- **Start Command**: `npm start`

### 1.3 设置环境变量

在 "Environment" 部分，添加以下环境变量：

| Key | Value | 说明 |
|-----|-------|------|
| `NODE_ENV` | `production` | 生产环境标识 |
| `OPENAI_API_KEY` | `sk-...` | 你的 OpenAI API 密钥 |
| `JWT_SECRET` | `your-random-secret-string` | JWT 签名密钥 (随机字符串) |
| `CORS_ORIGIN` | `*` | CORS 允许的源（测试用 `*`，生产用具体域名） |

**注意**：
- `PORT` 会自动由 Render 设置（通常是 10000）
- 不需要手动设置 `PORT`

### 1.4 部署并验证

1. 点击 "Create Web Service"
2. 等待部署完成（约 2-5 分钟）
3. 记下你的后端 URL（例如：`https://promptly-v0-6-cloudtest-cursor-dev.onrender.com`）

**测试后端：**

```bash
# 测试根路径（应该返回 JSON，显示所有可用端点）
curl https://promptly-v0-6-cloudtest-cursor-dev.onrender.com/

# 测试健康检查
curl https://promptly-v0-6-cloudtest-cursor-dev.onrender.com/api/health

# 测试 Pipeline 健康检查
curl https://promptly-v0-6-cloudtest-cursor-dev.onrender.com/api/pipeline/health

# 测试 Pipeline API
curl -X POST https://promptly-v0-6-cloudtest-cursor-dev.onrender.com/api/pipeline/run \
  -H "Content-Type: application/json" \
  -d '{"idea": "测试", "skipQuestions": true}'
```

**预期结果：**
- 根路径：返回 JSON，包含 `"status": "running"` 和所有可用端点
- `/api/health`：返回 `{"ok": true, "status": "healthy", ...}`
- `/api/pipeline/health`：返回 `{"ok": true, "message": "Pipeline routes are working", ...}`
- `/api/pipeline/run`：返回 `{"runId": "...", "streamUrl": "..."}`

---

## 🌐 第二步：部署前端到 Vercel

### 2.1 准备前端代码

前端代码已经配置好了环境变量支持！

**关键文件：**
- `frontend/package.json` - 定义构建脚本
- `frontend/build.js` - 构建脚本，从环境变量生成 config.js
- `frontend/vercel.json` - Vercel 配置
- `frontend/.gitignore` - 忽略 config.js（不提交到 Git）

### 2.2 在 Vercel 创建项目

#### 方法 A：通过 Vercel Dashboard（推荐）

1. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
2. 点击 "Add New..." → "Project"
3. 导入你的 Git 仓库
4. 配置如下：

**Project Settings:**
- **Framework Preset**: `Other` (纯静态 HTML)
- **Root Directory**: `frontend`
- **Build Command**: `npm run build`
- **Output Directory**: `.` (当前目录)
- **Install Command**: `npm install`

**Environment Variables:**

添加以下环境变量（在 "Configure Project" 页面）：

| Key | Value |
|-----|-------|
| `VITE_API_BASE` | `https://promptly-v0-6-cloudtest-cursor-dev.onrender.com` |

**重要**：
- 确保没有尾部斜杠 `/`
- 使用你在步骤 1.3 中记录的后端 URL

5. 点击 "Deploy"

#### 方法 B：通过 Vercel CLI

```bash
cd frontend

# 安装 Vercel CLI（如果还没有）
npm install -g vercel

# 登录
vercel login

# 部署
vercel --prod

# 按提示操作，设置环境变量
```

### 2.3 设置生产环境变量

如果通过 CLI 部署，需要在 Dashboard 中添加环境变量：

1. 进入你的项目 → Settings → Environment Variables
2. 添加：
   - **Key**: `VITE_API_BASE`
   - **Value**: `https://promptly-v0-6-cloudtest-cursor-dev.onrender.com`
   - **Environment**: 选择 `Production`, `Preview`, `Development`（全选）

3. 重新部署：
   - Deployments → 最新部署 → "..." → "Redeploy"

### 2.4 验证前端部署

1. 访问你的 Vercel URL（例如：`https://promptly-xxx.vercel.app`）
2. 打开浏览器 DevTools（F12）→ Console
3. 应该看到：

```
[Promptly] API Base configured: https://promptly-v0-6-cloudtest-cursor-dev.onrender.com
[Promptly] Config generated at: 2024-12-06T...
[Promptly] Frontend version: 2024-12-06-pipeline-fix
```

4. 输入任务，点击 "Run Optimization"
5. 检查 Console 和 Network 标签页，确认请求发送到正确的后端 URL

---

## 🔧 第三步：更新后端 CORS 配置（生产环境）

现在你知道了前端的 Vercel URL，更新后端的 CORS 配置：

1. 登录 Render Dashboard
2. 进入你的后端服务 → Environment
3. 更新 `CORS_ORIGIN` 环境变量：
   - **旧值**: `*`
   - **新值**: `https://promptly-xxx.vercel.app`（你的 Vercel URL）

4. 保存并等待后端重新部署

**注意**：如果你有多个前端域名（例如 preview 环境），可以用逗号分隔：
```
https://promptly-xxx.vercel.app,https://promptly-preview.vercel.app
```

---

## 🧪 第四步：端到端测试

### 测试清单

- [ ] **后端根路径**：访问 `https://promptly-xxx.onrender.com/`，应该看到 JSON 响应
- [ ] **后端健康检查**：`curl https://promptly-xxx.onrender.com/api/health`
- [ ] **Pipeline 健康检查**：`curl https://promptly-xxx.onrender.com/api/pipeline/health`
- [ ] **前端加载**：访问 Vercel URL，页面正常显示
- [ ] **前端 Console**：看到正确的 API Base 配置
- [ ] **Pipeline 测试**：在前端输入任务，点击 "Run Optimization"
- [ ] **Network 请求**：检查请求发送到后端，返回 200
- [ ] **SSE 连接**：检查 SSE 事件流正常工作
- [ ] **最终结果**：Best Prompt 区域显示生成的 prompt

### 测试脚本

```bash
# 设置变量
BACKEND_URL="https://promptly-v0-6-cloudtest-cursor-dev.onrender.com"
FRONTEND_URL="https://promptly-xxx.vercel.app"

echo "========================================="
echo "Promptly 部署测试"
echo "========================================="
echo ""

echo "1. 测试后端根路径..."
curl -s "$BACKEND_URL/" | head -5
echo ""

echo "2. 测试后端健康检查..."
curl -s "$BACKEND_URL/api/health"
echo ""

echo "3. 测试 Pipeline 健康检查..."
curl -s "$BACKEND_URL/api/pipeline/health"
echo ""

echo "4. 测试 Pipeline API..."
curl -s -X POST "$BACKEND_URL/api/pipeline/run" \
  -H "Content-Type: application/json" \
  -d '{"idea": "写一个 Python 函数计算斐波那契数列", "skipQuestions": true}' \
  | head -3
echo ""

echo "========================================="
echo "✅ 所有测试完成！"
echo "========================================="
echo ""
echo "前端地址: $FRONTEND_URL"
echo "后端地址: $BACKEND_URL"
echo ""
echo "请在浏览器中打开前端地址进行端到端测试。"
```

---

## 🔄 未来更新流程

### 当你需要更改后端 URL 时

**不需要修改代码！** 只需要：

1. **Vercel Dashboard** → 你的项目 → Settings → Environment Variables
2. 更新 `VITE_API_BASE` 的值
3. Deployments → 最新部署 → "Redeploy"

### 当你需要更新代码时

**后端更新：**

```bash
cd /path/to/project
git add backend/
git commit -m "更新后端代码"
git push origin main
# Render 会自动重新部署
```

**前端更新：**

```bash
cd /path/to/project
git add frontend/
git commit -m "更新前端代码"
git push origin main
# Vercel 会自动重新部署
```

---

## 🐛 故障排查

### 问题 1: 前端无法连接到后端（404/CORS 错误）

**检查清单：**

1. **验证前端 API 配置**：
   - 打开浏览器 Console
   - 输入：`window.PROMPTLY_API_BASE`
   - 确认 URL 正确且没有尾部斜杠

2. **验证后端运行**：
   ```bash
   curl https://your-backend.onrender.com/api/health
   ```
   应该返回 200

3. **检查 CORS 配置**：
   - Render Dashboard → 你的服务 → Environment
   - 确认 `CORS_ORIGIN` 包含你的前端 URL

4. **强制刷新前端**：
   - `Cmd + Shift + R` (Mac) 或 `Ctrl + Shift + R` (Windows)
   - 或使用隐身模式

### 问题 2: 前端显示旧的 API URL

**原因**：浏览器缓存了旧的 `config.js`

**解决方案：**

1. 清除浏览器缓存
2. 或在 Vercel 重新部署后，访问 `https://your-site.vercel.app/config.js?t=123` (添加随机参数)
3. 检查 `vercel.json` 中的 Cache-Control 配置（已设置为 `max-age=0`）

### 问题 3: Render 后端返回 404

**可能原因：**

1. **路由未注册**：
   - 检查 Render 日志，确认看到：`[promptly] ✅ All API routes registered successfully!`
   - 如果没有，可能是部署失败

2. **Root Directory 配置错误**：
   - Render Dashboard → Settings → Build & Deploy
   - 确认 Root Directory = `backend`

3. **Start Command 错误**：
   - 应该是 `npm start`
   - 不是 `node server.js`（缺少路径）

### 问题 4: Environment 变量不生效

**Vercel:**
- 修改环境变量后，**必须重新部署**
- Settings → Environment Variables → 修改 → Save → Deployments → Redeploy

**Render:**
- 修改环境变量后，Render 会自动重新部署
- 等待 2-3 分钟

---

## 📚 相关文档

- [Vercel 环境变量文档](https://vercel.com/docs/concepts/projects/environment-variables)
- [Render 环境变量文档](https://render.com/docs/environment-variables)
- [Express CORS 配置](https://expressjs.com/en/resources/middleware/cors.html)

---

## ✅ 快速检查表

部署前：
- [ ] 后端代码已提交到 Git
- [ ] 前端代码已提交到 Git（config.js 已加入 .gitignore）
- [ ] 已准备好 OpenAI API Key

Render 后端：
- [ ] Web Service 已创建
- [ ] Root Directory = `backend`
- [ ] 环境变量已设置（OPENAI_API_KEY, JWT_SECRET, CORS_ORIGIN）
- [ ] 部署成功，日志显示 "backend listening on :10000"
- [ ] 测试 `/api/health` 返回 200

Vercel 前端：
- [ ] 项目已创建
- [ ] Root Directory = `frontend`
- [ ] Build Command = `npm run build`
- [ ] 环境变量 VITE_API_BASE 已设置
- [ ] 部署成功
- [ ] Console 显示正确的 API Base URL
- [ ] Network 请求发送到后端

CORS 配置：
- [ ] Render 的 CORS_ORIGIN 已设置为 Vercel URL
- [ ] 前端可以成功调用后端 API

---

**完成！🎉 你的 Promptly 应该可以正常工作了！**

如有问题，检查：
1. Render 后端日志
2. Vercel 部署日志
3. 浏览器 Console 和 Network 标签页

