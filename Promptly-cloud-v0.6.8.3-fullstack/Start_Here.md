# 🚀 Promptly Cloud - 从这里开始

## 📋 你需要什么？

选择适合你情况的指南：

---

### 🆘 我遇到 404 错误！

**症状**: 在 Vercel/Netlify 上部署后，Question Wizard 无法工作

**解决方案**: [快速修复 404 错误 (3 分钟)](FIX_404_NOW.md)

---

### 🌐 我想部署到云端

**情况**: 第一次部署 Promptly 到 Render + Vercel

**解决方案**: [完整部署指南](DEPLOYMENT_GUIDE.md)

包含：
- ✅ Render 后端部署
- ✅ Vercel 前端部署  
- ✅ CORS 配置
- ✅ 环境变量设置
- ✅ 测试验证

---

### 🔧 我需要更新配置

**情况**: 需要修改后端 URL 或重新配置

**解决方案**: [更新配置指南](UPDATE_CONFIG.md)

包含：
- ✅ 配置文件说明
- ✅ 重新部署步骤
- ✅ 验证清单
- ✅ 测试命令

---

### 💻 我想在本地开发

**快速启动**:

```bash
# 后端
cd backend
cp .env.example .env
# 编辑 .env 添加你的 OPENAI_API_KEY
npm install
npm run migrate
npm start

# 前端（新终端）
cd frontend
npx serve .
# 或
python3 -m http.server 8000
```

访问: http://localhost:8000

---

### 🧪 我想测试连接

**方法 1: 使用测试页面**

部署后访问: `https://your-domain/test-connection.html`

**方法 2: 运行检查脚本**

```bash
./check-deployment.sh
```

**方法 3: 手动测试**

```bash
# 测试后端健康
curl https://your-backend.onrender.com/api/health

# 测试创建会话
curl -X POST https://your-backend.onrender.com/api/question-sessions \
  -H "Content-Type: application/json" \
  -d '{"initial_description":"test","kind":"coding"}'
```

---

### 📚 我想了解技术细节

**更改说明**: [CHANGES_SUMMARY.md](CHANGES_SUMMARY.md)

包含：
- 问题根本原因
- 解决方案架构
- 新增/修改文件列表
- 工作原理详解
- 技术选型说明

---

## 🗂️ 文档索引

### 快速指南
- [FIX_404_NOW.md](FIX_404_NOW.md) - 3 分钟快速修复 404
- [START_HERE.md](START_HERE.md) - 本文件（导航索引）

### 详细指南
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - 完整部署教程
- [UPDATE_CONFIG.md](UPDATE_CONFIG.md) - 配置更新指南
- [CHANGES_SUMMARY.md](CHANGES_SUMMARY.md) - 技术更改详情

### 原有文档
- [README.md](README.md) - 项目概述
- [ENV_SETUP_GUIDE.md](ENV_SETUP_GUIDE.md) - 环境设置
- [frontend/DEPLOYMENT_NOTES.md](frontend/DEPLOYMENT_NOTES.md) - 前端部署说明

### 工具
- `check-deployment.sh` - 自动化检查脚本
- `frontend/test-connection.html` - 可视化测试页面
- `frontend/config.js` - API 配置文件

---

## 🎯 常见任务快速链接

### 第一次部署
1. [部署后端到 Render](DEPLOYMENT_GUIDE.md#第一步部署后端到-render)
2. [配置前端](DEPLOYMENT_GUIDE.md#第二步配置前端)
3. [部署前端到 Vercel](DEPLOYMENT_GUIDE.md#第三步部署前端到-vercel)
4. [配置 CORS](DEPLOYMENT_GUIDE.md#第四步配置-cors)
5. [测试](DEPLOYMENT_GUIDE.md#第五步测试完整流程)

### 修复 404 错误
1. [获取后端 URL](FIX_404_NOW.md#步骤-1-获取后端-url)
2. [更新配置](FIX_404_NOW.md#步骤-2-更新配置文件)
3. [重新部署](FIX_404_NOW.md#步骤-3-重新部署前端)
4. [验证](FIX_404_NOW.md#-验证修复)

### 本地开发
1. [启动后端](README.md#backend)
2. [启动前端](README.md#frontend)
3. 访问 http://localhost:8000

### 更新后端 URL
1. 编辑 `frontend/config.js`
2. 更新 `window.PROMPTLY_API_BASE`
3. 重新部署前端
4. 访问测试页面验证

---

## ❓ 常见问题

### Q: 为什么会出现 404 错误？
A: 前端默认向自己的域名发送 API 请求，而后端部署在不同的域名（Render）。需要配置 `config.js` 指向正确的后端 URL。

### Q: 什么是 CORS？为什么需要配置？
A: CORS（跨域资源共享）是浏览器安全机制。当前端和后端在不同域名时，需要在后端设置 `CORS_ORIGIN` 允许前端访问。

### Q: 我可以部署到其他平台吗？
A: 可以！后端可以部署到 Railway、Heroku 等任何支持 Node.js 的平台；前端可以部署到 Netlify、Cloudflare Pages 等任何静态托管平台。

### Q: 本地开发需要修改 config.js 吗？
A: 不需要。代码会自动检测运行环境，本地开发时会使用 `localhost:8080`。

### Q: 如何查看后端日志？
A: 在 Render Dashboard → 你的服务 → Logs 标签页。

### Q: 测试页面在哪里？
A: 部署后访问 `https://your-frontend-url/test-connection.html`

### Q: 检查脚本怎么运行？
A: 在项目根目录执行 `./check-deployment.sh`（需要先 `chmod +x check-deployment.sh`）

---

## 🆘 获取帮助

### 自助资源
1. 查看浏览器控制台 (F12) 的错误信息
2. 访问测试页面进行诊断
3. 运行检查脚本 `./check-deployment.sh`
4. 查看 Render 后端日志

### 联系支持
- 📧 Email: ming.t.yang@vanderbilt.edu
- 📝 提供信息：
  - 后端 URL
  - 前端 URL
  - 浏览器控制台错误
  - Render 日志相关部分

---

## ✅ 部署成功清单

完成部署后，确认以下项目：

- [ ] 后端部署到 Render 并运行正常
- [ ] 访问 `/api/health` 返回成功
- [ ] `frontend/config.js` 配置了正确的后端 URL
- [ ] 前端部署到 Vercel/Netlify
- [ ] 浏览器控制台显示正确的 API Base
- [ ] 访问测试页面，所有测试通过
- [ ] Question Wizard 功能正常工作
- [ ] Render 中配置了 `CORS_ORIGIN`
- [ ] （可选）配置了自定义域名

---

## 🎉 准备好了？

选择你的情况，点击相应的指南链接开始吧！

需要快速修复？→ [FIX_404_NOW.md](FIX_404_NOW.md)

第一次部署？→ [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)

本地开发？→ [README.md](README.md#quick-start)

祝你部署顺利！🚀

