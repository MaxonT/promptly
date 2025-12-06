# Promptly 快速部署指南 ⚡

## 📋 前提条件

- Git 仓库（已有）
- [Render](https://render.com/) 账号
- [Vercel](https://vercel.com/) 账号
- OpenAI API Key

---

## 🚀 5 分钟快速部署

### 步骤 1: 提交代码 (1 分钟)

```bash
cd /Users/yangming/Desktop/Github/Promptly-v0.6-CloudTest/Promptly-cloud-v0.6.8.3-fullstack

git add .
git commit -m "fix: 添加环境变量支持和部署配置"
git push origin main
```

### 步骤 2: 部署后端到 Render (2 分钟)

1. **创建 Web Service**
   - 访问 https://dashboard.render.com/
   - 点击 "New +" → "Web Service"
   - 选择你的 Git 仓库

2. **配置服务**
   ```
   Name: promptly-backend
   Region: 选择离你最近的
   Branch: main
   Root Directory: backend
   Runtime: Node
   Build Command: npm install
   Start Command: npm start
   ```

3. **设置环境变量**
   ```
   NODE_ENV = production
   OPENAI_API_KEY = sk-your-key-here
   JWT_SECRET = your-random-secret-string
   CORS_ORIGIN = *
   ```

4. **部署并记下 URL**
   - 点击 "Create Web Service"
   - 等待部署完成
   - 复制 URL：`https://your-backend.onrender.com`

### 步骤 3: 测试后端 (30 秒)

```bash
# 替换为你的后端 URL
curl https://your-backend.onrender.com/api/health

# 应该返回: {"ok":true,"status":"healthy",...}
```

### 步骤 4: 部署前端到 Vercel (1.5 分钟)

1. **导入项目**
   - 访问 https://vercel.com/new
   - 选择你的 Git 仓库
   - 点击 "Import"

2. **配置项目**
   ```
   Framework Preset: Other
   Root Directory: frontend
   Build Command: npm run build
   Output Directory: .
   Install Command: npm install
   ```

3. **设置环境变量**
   ```
   VITE_API_BASE = https://your-backend.onrender.com
   ```
   （使用步骤 2 中的后端 URL）

4. **部署**
   - 点击 "Deploy"
   - 等待完成
   - 复制 URL：`https://your-frontend.vercel.app`

### 步骤 5: 验证 (30 秒)

1. **访问前端 URL**
2. **打开 DevTools (F12) → Console**
3. **强制刷新 (Cmd+Shift+R)**
4. **检查日志**:
   ```
   ✅ [Promptly] API Base configured: https://your-backend.onrender.com
   ✅ [Promptly] Config generated at: ...
   ```

5. **测试功能**:
   - 输入任务："写一个 Python 函数计算斐波那契数列"
   - 点击 "Run Optimization"
   - 查看 Console 和 Network，确认请求成功

---

## ✅ 完成！

你的 Promptly 已经部署好了：
- 🌐 **前端**: `https://your-frontend.vercel.app`
- ⚙️ **后端**: `https://your-backend.onrender.com`

---

## 🔧 常见问题

### Q: 前端无法连接到后端（CORS 错误）

**A**: 更新后端 CORS 配置
1. Render Dashboard → 你的服务 → Environment
2. 更新 `CORS_ORIGIN` = `https://your-frontend.vercel.app`
3. 等待重新部署

### Q: 前端显示旧的 API URL

**A**: 清除浏览器缓存
- 使用 `Cmd + Shift + R` 强制刷新
- 或使用隐身模式

### Q: 后端返回 404

**A**: 检查后端日志
1. Render Dashboard → 你的服务 → Logs
2. 确认看到：`[promptly] ✅ All API routes registered successfully!`
3. 如果没有，检查 Root Directory 是否设置为 `backend`

### Q: 需要更改后端 URL

**A**: 只需更新环境变量
1. Vercel Dashboard → 你的项目 → Settings → Environment Variables
2. 更新 `VITE_API_BASE`
3. Deployments → Redeploy
4. **无需修改代码！**

---

## 📚 详细文档

需要更多信息？查看：
- [完整部署指南](docs/DEPLOYMENT_COMPLETE_GUIDE.md)
- [修复总结](DEPLOYMENT_FIXES_SUMMARY.md)
- [测试脚本](test-deployment.sh)

---

**祝部署顺利！** 🎉

