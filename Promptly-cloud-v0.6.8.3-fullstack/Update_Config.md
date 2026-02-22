# 快速修复 404 错误 - 配置指南

## 问题说明

你遇到的 404 错误是因为前端没有正确配置后端 API 地址。前端默认会向自己的域名发送请求，而不是向部署在 Render 的后端发送请求。

## 快速修复步骤（3 分钟）

### 步骤 1: 获取你的后端 URL

1. 登录 [Render Dashboard](https://dashboard.render.com/)
2. 找到你的后端服务
3. 复制顶部显示的 URL（例如：`https://promptly-backend-abc123.onrender.com`）

### 步骤 2: 更新前端配置

1. 打开文件：`frontend/config.js`

2. 找到这一行（第 10 行）：
   ```javascript
   // window.PROMPTLY_API_BASE = "https://your-backend.onrender.com";
   ```

3. 取消注释（删除 `//`）并替换为你的实际 URL：
   ```javascript
   window.PROMPTLY_API_BASE = "https://promptly-backend-abc123.onrender.com";
   ```

4. **重要**：不要在 URL 末尾加斜杠 `/`

### 步骤 3: 重新部署前端

#### 如果使用 Vercel:

方法 A - Web UI:
1. 访问 [Vercel Dashboard](https://vercel.com/dashboard)
2. 找到你的项目
3. 点击右上角的三个点 → **Redeploy**
4. 选择最新的部署 → 点击 **Redeploy**

方法 B - CLI:
```bash
cd frontend
vercel --prod
```

方法 C - Git 提交（如果连接了 GitHub）:
```bash
git add frontend/config.js
git commit -m "Fix: Update API base URL"
git push
```

#### 如果使用 Netlify:

方法 A - Web UI:
1. 访问 [Netlify Dashboard](https://app.netlify.com/)
2. 找到你的站点
3. 点击 **Deploys** → **Trigger deploy** → **Deploy site**

方法 B - CLI:
```bash
cd frontend
netlify deploy --prod
```

### 步骤 4: 测试连接

1. 等待部署完成（通常 1-2 分钟）
2. 访问你的前端 URL
3. 打开浏览器开发者工具（F12）→ Console 标签
4. 应该看到：
   ```
   [Promptly] API Base configured: https://your-backend-url.onrender.com
   ```

5. **推荐**：访问测试页面验证配置
   ```
   https://your-frontend-url.vercel.app/test-connection.html
   ```
   这个页面会自动运行所有连接测试并显示结果。

### 步骤 5: 配置 CORS（如果仍然有错误）

1. 回到 Render Dashboard
2. 打开你的后端服务
3. 进入 **Environment** 标签
4. 找到或添加 `CORS_ORIGIN` 变量：
   ```
   CORS_ORIGIN=https://your-frontend-url.vercel.app
   ```
5. 保存后服务会自动重新部署

---

## 验证清单

- [ ] 获取了后端 URL（从 Render Dashboard）
- [ ] 更新了 `frontend/config.js` 文件
- [ ] 重新部署了前端
- [ ] 在浏览器控制台确认 API Base 配置正确
- [ ] 访问测试页面确认所有测试通过
- [ ] （如需要）配置了 CORS

---

## 快速测试命令

### 测试后端是否运行：
```bash
curl https://your-backend-url.onrender.com/api/health
```

应该返回：
```json
{"ok":true,"status":"healthy","time":"2024-..."}
```

### 测试创建会话：
```bash
curl -X POST https://your-backend-url.onrender.com/api/question-sessions \
  -H "Content-Type: application/json" \
  -d '{"initial_description":"test","kind":"coding"}'
```

应该返回包含 `session_id` 和 `questions` 的 JSON 对象。

---

## 仍然有问题？

### 错误：还是 404

1. 清除浏览器缓存（Ctrl+Shift+Del 或 Cmd+Shift+Del）
2. 强制刷新页面（Ctrl+F5 或 Cmd+Shift+R）
3. 在隐私/无痕模式下测试
4. 确认 Vercel 部署确实使用了新的 `config.js` 文件

### 错误：CORS 错误

在浏览器控制台看到类似：
```
Access to fetch at '...' has been blocked by CORS policy
```

解决方案：
1. 在 Render 设置 `CORS_ORIGIN` 环境变量
2. 或临时设置为 `*` 进行测试（生产环境不推荐）

### 错误：500 Internal Server Error

可能是后端问题：
1. 检查 Render 后端日志（Dashboard → Logs）
2. 确认 `OPENAI_API_KEY` 已设置
3. 确认后端数据库已初始化

### 需要人工支持

如果上述步骤都无法解决问题，请发送以下信息：

1. 你的后端 URL
2. 你的前端 URL
3. `frontend/config.js` 的内容（隐藏敏感信息）
4. 浏览器控制台的完整错误信息
5. Render 后端日志的相关部分

联系方式：PromptlyGuli@gmail.com

---

## 完整示例

假设：
- 后端 URL: `https://promptly-abc.onrender.com`
- 前端 URL: `https://promptly-xyz.vercel.app`

### frontend/config.js:
```javascript
window.PROMPTLY_API_BASE = "https://promptly-abc.onrender.com";
console.log("[Promptly] API Base configured:", window.PROMPTLY_API_BASE);
```

### Render 环境变量:
```
OPENAI_API_KEY=sk-proj-...
CORS_ORIGIN=https://promptly-xyz.vercel.app
NODE_ENV=production
PORT=8080
```

### 测试访问:
1. 前端首页: `https://promptly-xyz.vercel.app`
2. 连接测试: `https://promptly-xyz.vercel.app/test-connection.html`
3. 后端健康: `https://promptly-abc.onrender.com/api/health`

---

**修复后，你应该能够正常使用 Question Wizard 功能！** 🎉

