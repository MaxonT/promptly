# Promptly Cloud 完整部署指南

本指南将帮助你将 Promptly 全栈应用部署到云端（Render + Vercel）。

## 架构概览

- **后端**: 部署到 Render（或其他 Node.js 托管平台）
- **前端**: 部署到 Vercel（或 Netlify、Cloudflare Pages 等）
- **数据库**: SQLite（包含在后端部署中）

---

## 第一步：部署后端到 Render

### 1.1 准备工作

1. 注册 [Render](https://render.com) 账号
2. 准备你的 OpenAI API Key

### 1.2 创建 Web Service

1. 在 Render Dashboard，点击 **New +** → **Web Service**
2. 连接你的 GitHub 仓库或直接上传代码
3. 配置如下：

   - **Name**: `promptly-backend`（或自定义名称）
   - **Region**: 选择离你最近的区域
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node src/server.js`
   - **Plan**: 选择 Free 或 Starter

### 1.3 设置环境变量

在 Render 的 Environment 页面添加：

```
OPENAI_API_KEY=your-openai-api-key-here
CORS_ORIGIN=*
NODE_ENV=production
PORT=8080
```

**重要**: 部署前端后，将 `CORS_ORIGIN` 改为你的前端 URL（例如 `https://your-app.vercel.app`）

### 1.4 部署并测试

1. 点击 **Create Web Service**
2. 等待部署完成（首次约 2-5 分钟）
3. 记下你的后端 URL（例如：`https://promptly-backend-abc123.onrender.com`）
4. 测试健康检查端点：
   ```
   https://your-backend-url.onrender.com/api/health
   ```
   应该返回：`{"ok":true,"status":"healthy","time":"..."}`

---

## 第二步：配置前端

### 2.1 更新 API 配置

1. 打开 `frontend/config.js`
2. 找到这一行：
   ```javascript
   // window.PROMPTLY_API_BASE = "https://your-backend.onrender.com";
   ```
3. 取消注释并替换为你的实际后端 URL：
   ```javascript
   window.PROMPTLY_API_BASE = "https://promptly-backend-abc123.onrender.com";
   ```

### 2.2 验证配置

在本地测试（可选）：
```bash
cd frontend
# 用任何静态服务器运行，例如：
npx serve .
# 或
python3 -m http.server 8000
```

打开浏览器开发者工具控制台，应该看到：
```
[Promptly] API Base configured: https://promptly-backend-abc123.onrender.com
```

---

## 第三步：部署前端到 Vercel

### 3.1 准备工作

1. 注册 [Vercel](https://vercel.com) 账号
2. 安装 Vercel CLI（可选）：
   ```bash
   npm install -g vercel
   ```

### 3.2 方法 A: 通过 Web UI 部署

1. 访问 [Vercel Dashboard](https://vercel.com/dashboard)
2. 点击 **Add New...** → **Project**
3. 导入你的 GitHub 仓库或直接上传 `frontend` 文件夹
4. 配置：
   - **Framework Preset**: Other
   - **Root Directory**: `frontend`
   - **Build Command**: （留空）
   - **Output Directory**: `.`（当前目录）
5. 点击 **Deploy**

### 3.3 方法 B: 通过 CLI 部署

```bash
cd frontend
vercel
# 按提示操作：
# - Set up and deploy? Yes
# - Which scope? 选择你的账户
# - Link to existing project? No
# - Project name? promptly-frontend
# - In which directory is your code located? ./
```

### 3.4 获取前端 URL

部署完成后，Vercel 会提供一个 URL，例如：
```
https://promptly-frontend-abc123.vercel.app
```

---

## 第四步：配置 CORS

### 4.1 更新后端 CORS 设置

1. 回到 Render Dashboard
2. 进入你的 Web Service → Environment
3. 更新 `CORS_ORIGIN` 环境变量：
   ```
   CORS_ORIGIN=https://promptly-frontend-abc123.vercel.app
   ```
4. 保存后，服务会自动重新部署

### 4.2 验证 CORS

在浏览器中访问你的前端 URL，打开开发者工具：
- **Console 标签**: 检查是否有 CORS 错误
- **Network 标签**: 查看 API 请求是否成功

---

## 第五步：测试完整流程

### 5.1 测试清单

访问你的前端 URL 并测试：

- [ ] 首页加载正常
- [ ] 打开浏览器控制台，确认 API Base 配置正确
- [ ] 点击 "Question Wizard"
- [ ] 输入项目描述并提交
- [ ] 确认问题列表成功加载（无 404 错误）
- [ ] 回答几个问题并提交
- [ ] 查看生成的 Spec 和 Prompt

### 5.2 调试工具

如果遇到问题：

1. **检查后端健康状态**:
   ```
   https://your-backend.onrender.com/api/health
   ```

2. **检查前端 API 配置**:
   打开浏览器控制台，输入：
   ```javascript
   window.PROMPTLY_API_BASE
   ```

3. **查看网络请求**:
   - 打开浏览器开发者工具 → Network 标签
   - 筛选 Fetch/XHR 请求
   - 检查请求 URL 和响应状态

4. **查看后端日志**:
   - Render Dashboard → 你的服务 → Logs

---

## 常见问题解决

### 问题 1: 404 Not Found

**症状**: 
```
Failed to start session: HTTP 404 The page could not be found
```

**解决方案**:
1. 确认 `config.js` 中的 URL 正确（不要有尾部斜杠）
2. 确认后端已成功部署并运行
3. 测试后端健康检查端点
4. 清除浏览器缓存并刷新

### 问题 2: CORS 错误

**症状**:
```
Access to fetch has been blocked by CORS policy
```

**解决方案**:
1. 在 Render 中设置 `CORS_ORIGIN` 为你的前端 URL
2. 重新部署后端
3. 或临时设置为 `*` 进行测试（生产环境不推荐）

### 问题 3: 后端响应慢或超时

**症状**: Render Free 计划的服务在闲置后会休眠

**解决方案**:
1. 首次请求会需要 30-60 秒唤醒服务
2. 升级到 Starter 计划避免休眠
3. 或使用定时任务保持服务活跃

### 问题 4: 环境变量未生效

**症状**: OpenAI API 调用失败

**解决方案**:
1. 确认在 Render 中正确设置了 `OPENAI_API_KEY`
2. 检查服务日志确认环境变量已加载
3. 重新部署服务

---

## 生产环境优化建议

### 安全性

1. **CORS 配置**: 使用具体的前端 URL，而不是 `*`
2. **API Key 保护**: 确保 OpenAI API Key 只在后端使用，不要暴露给前端
3. **HTTPS**: Render 和 Vercel 默认提供 HTTPS

### 性能

1. **CDN**: Vercel 自动使用全球 CDN
2. **缓存**: 为静态资源添加缓存头
3. **数据库**: 考虑迁移到 PostgreSQL（对于生产环境）

### 监控

1. **日志**: 使用 Render 的日志功能监控后端错误
2. **分析**: 在 Vercel 中启用 Analytics
3. **告警**: 设置健康检查和告警通知

---

## 自定义域名（可选）

### Vercel 前端

1. 在 Vercel Dashboard → Settings → Domains
2. 添加你的域名（例如 `app.yourdomain.com`）
3. 按照指示配置 DNS

### Render 后端

1. 在 Render Dashboard → Settings → Custom Domain
2. 添加你的域名（例如 `api.yourdomain.com`）
3. 配置 DNS CNAME 记录
4. 更新前端 `config.js` 中的 API URL

---

## 需要帮助？

如果遇到部署问题：

1. 检查 Render 后端日志
2. 查看浏览器控制台错误信息
3. 确认所有环境变量设置正确
4. 联系支持：ming.t.yang@vanderbilt.edu

---

## 部署成功清单

- [ ] 后端部署到 Render 并运行正常
- [ ] 后端健康检查端点返回成功
- [ ] 前端 `config.js` 配置正确
- [ ] 前端部署到 Vercel
- [ ] CORS 配置正确
- [ ] 完整功能测试通过
- [ ] （可选）配置自定义域名

恭喜！你的 Promptly 应用已成功部署到云端！🎉

