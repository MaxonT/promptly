# 🔍 使用量横幅显示问题 - 完整调试指南

## 📋 问题描述

用户使用了 Prompt Optimization 或 Question Wizard 功能后，页面顶部的横幅没有更新使用量统计，仍然显示：

```
🆓 Free Plan
🎯 0/8 prompts/day | 🧙 0/5 wizards/day | 🪙 0 tokens (50K daily free)
```

## 🎯 目标

确保使用量统计能够：
1. **实时记录**：后端正确记录每次使用
2. **准确查询**：API 返回正确的使用量数据
3. **即时显示**：前端正确更新横幅显示

---

## 🔎 第一步：获取你的 User ID

### 方法1：通过浏览器控制台（推荐）

1. 打开你的网站：`https://promptly-v0-6-cloudtest-1.onrender.com`
2. 确保你已经登录（使用 GitHub 或 Google）
3. 按 `F12` 或右键 → "检查" 打开开发者工具
4. 切换到 **Console（控制台）** 标签
5. 复制粘贴并运行以下代码：

```javascript
// 获取并解析 JWT token
const token = localStorage.getItem('promptly.token');
if (!token) {
  console.log('❌ 你还没有登录');
} else {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    console.log('✅ 你的 User ID:', payload.sub);
    console.log('📧 Email:', payload.email);
    console.log('⏰ Token 过期时间:', new Date(payload.exp * 1000).toLocaleString('zh-CN'));
    
    // 复制到剪贴板
    navigator.clipboard.writeText(payload.sub);
    console.log('✅ User ID 已复制到剪贴板！');
  } catch (err) {
    console.error('❌ Token 解析失败:', err);
  }
}
```

6. 记下你的 **User ID**（通常是类似 `github_123456` 或 `google_xxx` 的格式）

### 方法2：通过后端日志

1. 打开 Render Dashboard
2. 进入你的后端服务
3. 点击 **Logs** 标签
4. 搜索 `[planLimits]` 或你的 email
5. 找到类似这样的日志：
   ```
   [planLimits] Recording usage for user github_123456
   ```

---

## 🔎 第二步：运行诊断脚本

诊断脚本会检查：
- ✅ 用户是否存在于数据库
- ✅ plan_usage 表是否存在
- ✅ 今天有多少使用记录
- ✅ 最近的使用历史
- ✅ Token 余额
- ✅ API 会返回什么数据

### 本地运行（如果数据库在本地）

```bash
# 进入项目目录
cd backend

# 运行诊断脚本（替换 YOUR_USER_ID 为你的实际 User ID）
node ../debug-usage-banner.js YOUR_USER_ID
```

### 云端运行（Render 部署）

由于你的数据库在 Render 云端，需要：

**选项 A：下载数据库文件到本地**

1. 进入 Render Dashboard → 你的后端服务
2. 点击 **Shell** 标签
3. 运行命令查看数据库文件位置：
   ```bash
   ls -la ./data/
   ```
4. 使用 Render 的文件下载功能或通过 Shell 命令导出数据库
5. 下载到本地后，运行诊断脚本：
   ```bash
   SQLITE_PATH=./下载的数据库.db node debug-usage-banner.js YOUR_USER_ID
   ```

**选项 B：直接在 Render Shell 中运行**

1. 进入 Render Dashboard → 后端服务 → **Shell**
2. 创建诊断脚本（复制 debug-usage-banner.js 内容）
3. 运行：
   ```bash
   node debug-usage-banner.js YOUR_USER_ID
   ```

---

## 🔎 第三步：检查后端日志

### 在 Render 查看实时日志

1. 打开 Render Dashboard → 后端服务 → **Logs**
2. 保持日志页面打开
3. 在前端网站使用一次 **Prompt Optimization** 功能
4. 立即回到日志页面，搜索以下关键词：

#### 期望看到的日志（✅ 正常情况）

```
[pipeline] POST /run received
[pipeline] Starting pipeline - idea length: XXX
[planLimits] Daily usage for user YOUR_USER_ID, feature prompt_optimization, date 2026-01-26: 0
[planLimits] Recording usage for user YOUR_USER_ID, feature: prompt_optimization, date: 2026-01-26
[planLimits] ✅ Usage recorded successfully
```

#### 如果没有看到这些日志

可能的原因：

**原因1：Pipeline 没有成功完成**
- 搜索是否有错误日志：`[pipeline] Pipeline execution failed`
- 检查是否有其他错误信息

**原因2：recordUsage() 没有被调用**
- 检查代码是否被正确部署
- 确认 `backend/src/routes/pipeline.js` 第 168 行是否有：
  ```javascript
  recordUsage(userId, 'prompt_optimization');
  ```

**原因3：数据库写入失败**
- 搜索：`[planLimits] ❌ Failed to record usage`
- 如果找到，查看具体的错误信息

---

## 🔎 第四步：检查前端行为

### 在浏览器控制台查看

1. 打开网站并登录
2. 按 `F12` 打开开发者工具
3. 切换到 **Console** 标签
4. 使用一次 Prompt Optimization 功能
5. 查看控制台日志

#### 期望看到的日志（✅ 正常情况）

```
[Plan Banner] Token found: true
[Plan Banner] API response status: 200
[Plan Banner] API response data: {ok: true, plan: 'free', usage: {promptOptimization: 1, ...}}
[Plan Banner] ✅ Showing FREE plan info: 1/8 prompts, 0/5 wizards, tokens: 50K
```

#### 检查 Network 面板

1. 切换到 **Network（网络）** 标签
2. 使用功能后，找到 `/api/billing/status` 请求
3. 点击这个请求，查看 **Response（响应）** 标签
4. 检查返回的数据：

```json
{
  "ok": true,
  "plan": "free",
  "usage": {
    "promptOptimization": 1,  // ⬅️ 这个值应该增加
    "questionWizard": 0
  },
  "limits": {
    "promptOptimization": {
      "daily": 8
    },
    "questionWizard": {
      "daily": 5
    }
  }
}
```

5. 如果 `usage.promptOptimization` 还是 `0`，说明**后端没有正确记录使用量**

---

## 🔎 第五步：手动测试 API

使用 `curl` 命令直接测试 API：

```bash
# 替换 YOUR_TOKEN 为你的实际 JWT token（从浏览器 localStorage 获取）
curl -X GET \
  'https://promptly-v0-6-cloudtest-cursor-dev.onrender.com/api/billing/status' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Accept: application/json'
```

查看返回的数据，特别关注 `usage` 字段。

---

## 🛠️ 常见问题和解决方案

### 问题1：后端日志显示记录成功，但 API 返回 usage 为 0

**可能原因：**
- User ID 不匹配（记录时的 userId 和查询时的 userId 不同）
- 日期计算有问题（记录的 date 和查询的 date 不匹配）

**解决方法：**
1. 在后端 `planLimits.js` 的 `getDailyUsage` 函数中添加更详细的日志
2. 比对 `recordUsage` 和 `getDailyUsage` 使用的 userId 和 date

### 问题2：前端没有调用 refreshPlanBanner

**可能原因：**
- Pipeline 完成事件没有触发
- window.refreshPlanBanner 函数没有定义

**解决方法：**
1. 在浏览器控制台手动调用：
   ```javascript
   window.refreshPlanBanner();
   ```
2. 如果能正常更新，说明是事件触发的问题
3. 检查 `frontend/index.html` 第 2930 行附近的代码

### 问题3：横幅更新有延迟

**可能原因：**
- 浏览器缓存
- SSE 事件延迟

**解决方法：**
1. 使用功能后，手动刷新页面（F5）
2. 检查横幅是否更新
3. 如果刷新后更新了，说明是实时刷新的问题

### 问题4：plan_usage 表不存在

**解决方法：**
```bash
cd backend
npm run migrate
```

---

## 📊 完整诊断流程图

```
1. 用户使用功能
   ↓
2. 前端发送请求到 /api/pipeline/run
   ↓
3. 后端执行 pipeline
   ↓
4. Pipeline 成功完成
   ↓
5. 调用 recordUsage(userId, 'prompt_optimization') ← 检查点A
   ↓
6. 写入 plan_usage 表 ← 检查点B
   ↓
7. 前端接收 complete 事件
   ↓
8. 调用 window.refreshPlanBanner() ← 检查点C
   ↓
9. 前端请求 /api/billing/status
   ↓
10. 后端调用 getDailyUsage() ← 检查点D
   ↓
11. 查询 plan_usage 表 ← 检查点E
   ↓
12. 返回使用量数据给前端
   ↓
13. 前端更新横幅显示 ← 检查点F
```

**在每个检查点添加日志，找出哪一步出了问题！**

---

## 🎯 快速排查清单

- [ ] **Step 1**: 获取你的 User ID
- [ ] **Step 2**: 运行诊断脚本 `debug-usage-banner.js`
- [ ] **Step 3**: 检查后端日志中是否有 `[planLimits] Recording usage`
- [ ] **Step 4**: 检查后端日志中是否有 `[planLimits] ✅ Usage recorded successfully`
- [ ] **Step 5**: 在前端使用功能后，检查浏览器 Console 日志
- [ ] **Step 6**: 检查 Network 面板中 `/api/billing/status` 的响应数据
- [ ] **Step 7**: 确认响应中的 `usage.promptOptimization` 值是否正确
- [ ] **Step 8**: 如果 API 数据正确但页面没更新，手动调用 `window.refreshPlanBanner()`

---

## 📞 需要帮助？

如果按照上述步骤仍然无法解决问题，请提供以下信息：

1. **你的 User ID**（可以脱敏显示前几位）
2. **诊断脚本的输出结果**
3. **后端日志截图**（使用功能前后的日志）
4. **前端 Console 日志截图**
5. **Network 面板中 /api/billing/status 的响应数据**

---

## ✅ 验证修复

修复后，进行以下测试确认问题解决：

1. **登录网站**
2. **记下当前显示**：例如 `0/8 prompts/day`
3. **使用一次功能**（Prompt Optimization）
4. **刷新页面**（F5）
5. **确认横幅更新**：应该显示 `1/8 prompts/day`
6. **重复步骤3-5**：每次使用后数字都应该增加
7. **达到限制测试**：使用 8 次后，尝试第 9 次应该被拒绝

---

**祝调试顺利！🚀**
