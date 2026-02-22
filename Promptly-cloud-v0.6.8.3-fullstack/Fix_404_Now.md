# 🚨 快速修复 404 错误（3 分钟）

## 你看到这个错误吗？

```
Failed to start session: HTTP 404 The page could not be found
```

## 立即修复（3 步）

### 步骤 1: 获取后端 URL

登录 [Render Dashboard](https://dashboard.render.com/) → 找到你的服务 → 复制 URL

例如: `https://promptly-backend-abc123.onrender.com`

### 步骤 2: 更新配置文件

打开: `frontend/config.js`

找到第 10 行，取消注释并更新:

```javascript
// 从这样:
// window.PROMPTLY_API_BASE = "https://your-backend.onrender.com";

// 改成这样（使用你的实际 URL）:
window.PROMPTLY_API_BASE = "https://promptly-backend-abc123.onrender.com";
```

**重要**: 不要在 URL 末尾添加斜杠 `/`

### 步骤 3: 重新部署前端

#### Vercel:
```bash
cd frontend
vercel --prod
```

或者在 [Vercel Dashboard](https://vercel.com/dashboard) → 你的项目 → Redeploy

#### Netlify:
```bash
cd frontend
netlify deploy --prod
```

---

## ✅ 验证修复

访问: `https://your-frontend-url/test-connection.html`

应该看到所有测试通过 ✓

---

## 🔧 可选: 配置 CORS

如果还有错误，在 Render 设置环境变量:

```
CORS_ORIGIN=https://your-frontend-url.vercel.app
```

---

## 📖 需要详细说明？

- [完整部署指南](DEPLOYMENT_GUIDE.md) - 从零开始的完整步骤
- [详细修复指南](UPDATE_CONFIG.md) - 包含测试命令和调试
- [更改说明](CHANGES_SUMMARY.md) - 了解修复的技术细节

---

## 💡 快速测试命令

测试后端是否运行:
```bash
curl https://your-backend-url.onrender.com/api/health
```

应该返回:
```json
{"ok":true,"status":"healthy","time":"..."}
```

---

## 🆘 仍然有问题？

1. 清除浏览器缓存 (Ctrl+Shift+Del / Cmd+Shift+Del)
2. 强制刷新 (Ctrl+F5 / Cmd+Shift+R)
3. 查看浏览器控制台 (F12) 的错误信息
4. 运行检查脚本: `./check-deployment.sh`

联系: PromptlyGuli@gmail.com

---

**修复后你就可以正常使用 Question Wizard 了！** 🎉

