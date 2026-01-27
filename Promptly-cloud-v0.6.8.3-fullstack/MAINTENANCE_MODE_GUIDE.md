# 🔧 维护模式使用指南

## 📋 概述

当你需要进行系统维护、升级或修复时，可以启用维护模式，让所有用户看到友好的维护页面，而不是错误信息或半残的功能。

---

## 🎯 三种启用方式

### 方式 1：仅前端维护模式 ⚡（最快，1分钟）

**适用场景：** 前端部署、更新静态资源

**步骤：**

1. 修改 `frontend/config.js`：
   ```javascript
   window.PROMPTLY_MAINTENANCE_MODE = true;  // 改为 true
   ```

2. 提交并部署：
   ```bash
   git add frontend/config.js
   git commit -m "启用维护模式"
   git push
   ```

3. 等待前端自动部署（Render 约 2-3 分钟）

✅ **效果：** 所有访问前端的用户都会看到维护页面  
❌ **后端：** 仍然可以接收 API 请求（如果有直接调用）

---

### 方式 2：前端 + 后端维护模式 🏆（推荐，5分钟）

**适用场景：** 全面维护、数据库升级、后端重大更新

**步骤：**

#### A. 启用前端维护模式

```bash
# 1. 修改 frontend/config.js
window.PROMPTLY_MAINTENANCE_MODE = true;

# 2. 提交部署
git add frontend/config.js
git commit -m "启用维护模式"
git push
```

#### B. 启用后端维护模式

在 Render Dashboard 中：

1. 进入**后端服务** → **Environment**
2. 添加环境变量：
   ```
   MAINTENANCE_MODE = true
   ```
3. 点击 **Save Changes**
4. 后端会自动重启（约 1-2 分钟）

✅ **效果：** 
- 前端显示维护页面
- 后端所有 API 返回 503 错误
- 健康检查仍然可用（用于监控）

---

### 方式 3：仅后端维护模式 🔧（适用于前端正常，后端维护）

**适用场景：** 数据库维护、后端修复，前端不受影响

**步骤：**

在 Render Dashboard → 后端服务 → Environment：
```
MAINTENANCE_MODE = true
```

✅ **效果：** 后端 API 返回 503，前端会显示错误提示

---

## 🎨 自定义维护页面

### 修改预计恢复时间

编辑 `frontend/maintenance.html` 第 118 行：

```html
<span>预计恢复时间：<strong id="estimatedTime">约 2 小时后</strong></span>
```

改为你需要的时间，例如：
- `约 30 分钟后`
- `2026年1月27日 10:00`
- `今晚 8 点前`

### 修改维护原因

编辑第 99-102 行：

```html
<p class="subtitle">
  为了给您提供更好的服务体验，我们正在进行必要的系统维护和优化。<br>
  感谢您的耐心等待。
</p>
```

可以改为：
- `我们正在升级数据库以提升性能...`
- `正在修复一个影响用户体验的问题...`
- `正在部署新功能，即将为您带来更好的体验...`

### 修改联系方式

编辑第 122 行：

```html
<span>有问题？联系我们：<strong>support@promptly.com</strong></span>
```

改为你的实际联系邮箱。

---

## ✅ 解除维护模式

### 前端

修改 `frontend/config.js`：
```javascript
window.PROMPTLY_MAINTENANCE_MODE = false;  // 改回 false
```

提交并部署：
```bash
git add frontend/config.js
git commit -m "解除维护模式"
git push
```

### 后端

在 Render Dashboard 中：
1. 进入后端服务 → **Environment**
2. **删除** `MAINTENANCE_MODE` 环境变量
3. 或将其改为 `false`
4. 点击 **Save Changes**

---

## 🔍 验证维护模式

### 验证前端

访问你的网站：
- ✅ 应该看到维护页面
- ✅ 页面应该美观、清晰
- ✅ 信息应该准确

### 验证后端

访问健康检查：
```bash
curl https://your-backend.onrender.com/api/health
```

应该返回：
```json
{
  "ok": false,
  "status": "maintenance",
  "time": "2026-01-27T...",
  "maintenance": true
}
```

或查看维护状态：
```bash
curl https://your-backend.onrender.com/api/maintenance/status
```

应该返回：
```json
{
  "ok": true,
  "maintenance": {
    "enabled": true,
    "message": "系统正在维护中",
    "estimatedEnd": "2026-01-27T12:00:00.000Z"
  }
}
```

---

## 🚨 紧急恢复

如果发现维护模式有问题，需要紧急恢复：

### 快速回滚

```bash
# 1. 回滚前端
git revert HEAD
git push

# 2. 删除后端环境变量
# 在 Render Dashboard 中删除 MAINTENANCE_MODE
```

### 或者使用 Git 回退

```bash
git log --oneline  # 找到之前的 commit
git reset --hard <commit-hash>
git push --force origin cursor-dev
```

⚠️ **注意：** `--force` 会覆盖远程仓库，谨慎使用！

---

## 📊 维护模式最佳实践

### 1. 提前通知

在启用维护模式前：
- 📧 发送邮件通知用户
- 🐦 在社交媒体发布公告
- 📢 在网站显示横幅提醒

### 2. 选择合适时间

- 🌙 选择用户活跃度低的时间（如凌晨）
- 📅 避开周末和节假日
- ⏰ 预留充足的时间缓冲

### 3. 监控和沟通

- 📊 持续监控部署状态
- 💬 准备好回复用户询问
- ⏱️ 如果超时，及时更新预计时间

### 4. 测试恢复

维护完成后：
- ✅ 先在测试环境验证
- ✅ 逐步解除维护模式
- ✅ 监控错误日志和用户反馈

---

## 🎯 常见场景

### 场景 1：数据库升级（约 1 小时）

```bash
# 1. 启用前端和后端维护模式
# 2. 备份数据库
# 3. 运行迁移脚本
# 4. 验证数据完整性
# 5. 解除维护模式
# 6. 监控系统状态
```

### 场景 2：紧急 Bug 修复（约 30 分钟）

```bash
# 1. 仅启用后端维护模式（前端仍可访问）
# 2. 修复 Bug 并测试
# 3. 部署到生产环境
# 4. 解除维护模式
```

### 场景 3：前端重大更新（约 10 分钟）

```bash
# 1. 仅启用前端维护模式
# 2. 部署新版本前端
# 3. 验证功能正常
# 4. 解除维护模式
```

---

## 💡 高级功能

### 自动恢复检测

维护页面已内置自动检测功能（每 60 秒检查一次）：

```javascript
// 在 maintenance.html 中
setInterval(() => {
  fetch('/api/health')
    .then(res => {
      if (res.ok) {
        // 后端恢复了，自动刷新页面
        window.location.reload();
      }
    })
    .catch(() => {
      // 仍在维护中
    });
}, 60000);
```

用户无需手动刷新，系统恢复后会自动跳转。

### 白名单 IP（管理员访问）

如果需要在维护期间允许特定 IP 访问，修改 `backend/src/middleware/maintenance.js`：

```javascript
export function maintenanceMode(req, res, next) {
  const isMaintenanceMode = process.env.MAINTENANCE_MODE === 'true';
  
  // 管理员 IP 白名单
  const adminIPs = ['123.45.67.89', '98.76.54.32'];
  const clientIP = req.ip || req.connection.remoteAddress;
  
  if (isMaintenanceMode && !adminIPs.includes(clientIP)) {
    return res.status(503).json({...});
  }
  
  next();
}
```

---

## 📞 需要帮助？

如果遇到问题：

1. 检查 Render Dashboard 的部署日志
2. 检查环境变量是否正确设置
3. 验证 Git 提交是否成功
4. 查看浏览器控制台是否有错误

---

**记住：维护模式是为了保护用户体验，不要让用户看到半残的功能或令人困惑的错误。** 🎯
