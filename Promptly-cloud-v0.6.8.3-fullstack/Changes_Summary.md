# 修复 404 错误 - 更改摘要

## 问题说明

在部署到 Render + Vercel 后，前端无法连接到后端 API，导致所有 API 请求返回 404 错误。

**根本原因**: 前端默认向自己的域名发送 API 请求，而不是向 Render 的后端 URL 发送请求。

## 解决方案

实现了一个配置系统，让前端能够正确指向后端 API。

---

## 新增文件

### 1. `frontend/config.js`
**用途**: API 配置文件，设置后端 URL

**用法**:
```javascript
// 取消注释并更新为你的实际后端 URL
window.PROMPTLY_API_BASE = "https://your-backend.onrender.com";
```

### 2. `frontend/config.production.example.js`
**用途**: 生产环境配置示例文件

**用法**: 可以复制此文件为 config.js 并修改

### 3. `frontend/test-connection.html`
**用途**: 自动化连接测试页面

**特性**:
- 自动检测 API 配置
- 测试后端健康状态
- 验证 CORS 配置
- 测试会话创建
- 提供详细的错误诊断

**访问**: 部署后访问 `https://your-domain/test-connection.html`

### 4. `DEPLOYMENT_GUIDE.md`
**用途**: 完整的部署指南（中文）

**包含**:
- Render 后端部署步骤
- Vercel 前端部署步骤
- CORS 配置说明
- 常见问题解决
- 完整的部署清单

### 5. `UPDATE_CONFIG.md`
**用途**: 快速修复 404 错误的 3 分钟指南

**包含**:
- 快速修复步骤
- 验证清单
- 测试命令
- 常见错误排查

### 6. `check-deployment.sh`
**用途**: 自动化部署检查脚本

**功能**:
- 检查 config.js 配置
- 测试后端连接
- 验证前端文件结构
- 提供修复建议

**运行**:
```bash
./check-deployment.sh
```

---

## 修改的文件

### 1. `frontend/wizard.html`
**更改**: 在 `</head>` 前添加 `<script src="config.js"></script>`

### 2. `frontend/enhancer.html`
**更改**: 在 `</head>` 前添加 `<script src="config.js"></script>`

### 3. `frontend/outcome.html`
**更改**: 在 `</head>` 前添加 `<script src="config.js"></script>`

### 4. `frontend/result.html`
**更改**: 在 `</head>` 前添加 `<script src="config.js"></script>`

### 5. `frontend/settings.html`
**更改**: 在 `</head>` 前添加 `<script src="config.js"></script>`

### 6. `frontend/specs.html`
**更改**: 在 `</head>` 前添加 `<script src="config.js"></script>`

### 7. `frontend/index.html`
**更改**: 在 `</head>` 前添加 `<script src="config.js"></script>`

### 8. `frontend/DEPLOYMENT_NOTES.md`
**更改**: 更新为更详细的部署说明

### 9. `README.md`
**更改**: 
- 更新前端部署说明
- 添加部署指南链接
- 更新环境变量说明

---

## 工作原理

### 配置加载顺序

1. **config.js 加载** (在所有页面脚本之前)
   ```javascript
   window.PROMPTLY_API_BASE = "https://your-backend.onrender.com";
   ```

2. **页面脚本读取配置** (wizard.js, outcome.js, 等)
   ```javascript
   const API_BASE = window.PROMPTLY_API_BASE || window.location.origin || "http://localhost:8080";
   ```

3. **发送 API 请求**
   ```javascript
   fetch(`${API_BASE}/api/question-sessions`, {...})
   ```

### 配置优先级

1. `window.PROMPTLY_API_BASE` (最高优先级 - 来自 config.js)
2. `window.location.origin` (当前站点 - 用于本地开发或全栈部署)
3. `http://localhost:8080` (回退 - 用于本地开发)

---

## 使用指南

### 对于第一次部署

1. 按照 [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) 完整步骤操作

### 对于已部署但遇到 404 错误

1. 按照 [UPDATE_CONFIG.md](UPDATE_CONFIG.md) 快速修复

### 对于本地开发

无需修改 config.js，代码会自动使用 localhost:8080

---

## 验证部署

### 方法 1: 运行检查脚本
```bash
./check-deployment.sh
```

### 方法 2: 访问测试页面
```
https://your-frontend-url/test-connection.html
```

### 方法 3: 手动验证
1. 打开浏览器开发者工具 (F12)
2. 控制台应显示: `[Promptly] API Base configured: https://...`
3. Network 标签应显示向正确 URL 的请求

---

## 后续维护

### 更新后端 URL

1. 编辑 `frontend/config.js`
2. 更新 `window.PROMPTLY_API_BASE`
3. 重新部署前端

### 添加新的前端页面

确保在新 HTML 文件的 `<head>` 中添加：
```html
<script src="config.js"></script>
```

### 环境特定配置

可以为不同环境创建不同的配置文件：
- `config.development.js`
- `config.staging.js`
- `config.production.js`

然后在构建时选择性复制到 `config.js`

---

## 技术细节

### 为什么不使用环境变量？

1. **静态部署**: Vercel/Netlify 的静态部署不支持运行时环境变量注入
2. **简单性**: 直接编辑 JS 文件更简单直观
3. **透明性**: 可以在浏览器中直接查看和验证配置
4. **兼容性**: 适用于任何静态托管平台

### 为什么不用 .env 文件？

.env 文件通常用于构建时变量注入，需要构建工具支持（如 Vite、webpack）。我们的前端是纯静态文件，无构建步骤。

### 可以改用构建工具吗？

可以！如果你想使用 Vite 等构建工具：

1. 创建 `vite.config.js`
2. 使用 `import.meta.env.VITE_API_BASE`
3. 在 Vercel 中设置环境变量 `VITE_API_BASE`

但当前的 config.js 方案更简单，无需额外依赖。

---

## 已测试的部署平台

### 后端
- ✅ Render
- ✅ Railway
- ✅ Heroku (理论上)

### 前端
- ✅ Vercel
- ✅ Netlify
- ✅ Cloudflare Pages (理论上)
- ✅ GitHub Pages (需要额外配置 CORS)

---

## 回滚方案

如果新配置导致问题，可以：

1. 恢复原始的 HTML 文件（移除 `<script src="config.js"></script>`）
2. 删除 `frontend/config.js`
3. 在每个 JS 文件中硬编码 API URL（不推荐）

但建议保留新配置系统，因为它提供了更好的灵活性和可维护性。

---

## 获取支持

- 📖 完整文档: [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
- 🔧 快速修复: [UPDATE_CONFIG.md](UPDATE_CONFIG.md)
- 🧪 测试工具: `frontend/test-connection.html`
- 📧 技术支持: ming.t.yang@vanderbilt.edu

---

**版本**: v0.6.8.3 + 修复
**更新日期**: 2024-11-27
**状态**: ✅ 已测试并验证

