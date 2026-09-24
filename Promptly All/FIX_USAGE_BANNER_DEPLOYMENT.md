# 🔧 使用量横幅修复 - 部署指南

## 📋 问题总结

用户使用 Prompt Optimization 功能后，横幅没有更新使用量统计。

### 根本原因

在 `backend/src/routes/pipeline.js` 中，`recordUsage()` 函数被放在 promise 的 `.then()` 回调中，但由于 `executePipelineWithEvents` 函数内部捕获了所有错误，导致外部的 `.then()` 可能不会被正确执行。

### 修复方案

将 `recordUsage()` 调用移到 `executePipelineWithEvents` 函数内部的成功路径中，确保在 pipeline 成功完成时立即记录使用量。

---

## 🔨 修复内容

### 修改文件：`backend/src/routes/pipeline.js`

#### 修改 1：在成功完成时记录使用量

在第 1039 行（发送 complete 事件后）添加：

```javascript
// 🔥 Record usage after successful pipeline completion
console.log(`[pipeline] [${runId}] Recording usage for user ${userId}`);
recordUsage(userId, 'prompt_optimization');
console.log(`[pipeline] [${runId}] Usage recorded successfully`);
```

#### 修改 2：移除外部的 .then() 回调

从第 165-169 行移除冗余的 recordUsage 调用。

---

## 🚀 部署步骤

### Step 1: 提交代码到 Git

```bash
cd /Users/yangming/Desktop/Github/Promptly-v0.6-CloudTest/Promptly-cloud-v0.6.8.3-fullstack

# 查看更改
git status
git diff backend/src/routes/pipeline.js

# 添加文件
git add backend/src/routes/pipeline.js
git add debug-usage-banner.js
git add DEBUG_USAGE_BANNER.md
git add FIX_USAGE_BANNER_DEPLOYMENT.md

# 提交
git commit -m "fix: 修复使用量统计不更新的问题

将 recordUsage() 调用移到 pipeline 执行成功路径中，确保：
- Pipeline 成功完成时立即记录使用量
- 添加详细的调试日志
- 修复 promise 链导致的记录失败问题

相关文件：
- backend/src/routes/pipeline.js: 修复 recordUsage 调用位置
- debug-usage-banner.js: 添加诊断脚本
- DEBUG_USAGE_BANNER.md: 添加完整调试指南"

# 推送到远程
git push origin cursor-dev
```

### Step 2: 等待 Render 自动部署

1. Render 会自动检测到代码变更
2. 等待 2-3 分钟，后端会自动重新部署
3. 在 Render Dashboard 中查看部署状态

### Step 3: 验证部署成功

在 Render Dashboard → 后端服务 → Logs 中查找：

```
Deployment successful
Server is running on port 10000
[promptly] Plan limits module loaded
```

---

## 🧪 测试步骤

### 测试前准备

1. 获取你的 User ID（按照 `DEBUG_USAGE_BANNER.md` 中的方法）
2. 打开浏览器开发者工具（F12）
3. 确保你已登录

### 测试 1：验证后端记录

#### 步骤：

1. 打开 Render Dashboard → 后端服务 → **Logs**
2. 在前端使用一次 Prompt Optimization
3. 在日志中搜索：`[pipeline]` 和 `[planLimits]`

#### 期望日志：

```
[pipeline] POST /run received
[pipeline] Starting pipeline - idea length: XXX
[pipeline] Generated runId: run_xxxxx
[planLimits] Daily usage for user YOUR_USER_ID, feature prompt_optimization, date 2026-01-26: 0
[pipeline] ... (各种 stage-complete 事件)
[pipeline] [run_xxxxx] Recording usage for user YOUR_USER_ID
[planLimits] Recording usage for user YOUR_USER_ID, feature: prompt_optimization, date: 2026-01-26
[planLimits] ✅ Usage recorded successfully
[pipeline] [run_xxxxx] Usage recorded successfully
```

#### 如果没有看到这些日志：

- 检查是否有错误日志
- 运行诊断脚本：`node debug-usage-banner.js YOUR_USER_ID`

### 测试 2：验证前端显示

#### 步骤：

1. 打开网站：`https://promptly-v0-6-cloudtest-1.onrender.com`
2. 确保已登录
3. 查看当前横幅显示（例如：`0/8 prompts/day`）
4. 使用一次 Prompt Optimization
5. 等待完成
6. **刷新页面**（F5）
7. 查看横幅是否更新（应该显示：`1/8 prompts/day`）

#### 期望结果：

```
第一次：🎯 0/8 prompts/day
使用后：🎯 1/8 prompts/day  ✅
第二次：🎯 2/8 prompts/day  ✅
第三次：🎯 3/8 prompts/day  ✅
...
第八次：🎯 8/8 prompts/day  ✅
第九次：❌ 被拒绝，提示达到每日限制  ✅
```

#### 浏览器控制台日志：

```
[Plan Banner] Token found: true
[Plan Banner] API response status: 200
[Plan Banner] API response data: {ok: true, plan: 'free', usage: {promptOptimization: 1, ...}}
[Plan Banner] ✅ Showing FREE plan info: 1/8 prompts, 0/5 wizards, tokens: 50K
```

### 测试 3：验证 API 返回数据

#### 步骤：

1. 打开浏览器开发者工具（F12）
2. 切换到 **Network（网络）** 标签
3. 使用功能后刷新页面
4. 找到 `/api/billing/status` 请求
5. 查看 **Response** 标签

#### 期望响应：

```json
{
  "ok": true,
  "plan": "free",
  "usage": {
    "promptOptimization": 1,  // ⬅️ 应该递增
    "questionWizard": 0
  },
  "limits": {
    "promptOptimization": {
      "daily": 8
    },
    "questionWizard": {
      "daily": 5
    }
  },
  "tokens": {
    "total": 50000,
    "totalFormatted": "50K"
  }
}
```

### 测试 4：限制执行测试

#### 步骤：

1. 连续使用 8 次 Prompt Optimization
2. 每次使用后刷新页面，确认计数递增
3. 达到 8 次后，尝试第 9 次
4. 应该收到错误提示

#### 期望行为：

第 9 次使用时：
- 返回 **403 Forbidden** 错误
- 错误消息：`"Daily limit reached. Free plan allows 8 prompt optimizations per day."`
- 前端显示错误提示

---

## 🔍 调试工具

### 1. 诊断脚本

如果测试失败，运行诊断脚本：

```bash
# 本地（如果数据库在本地）
node debug-usage-banner.js YOUR_USER_ID

# 云端（通过 Render Shell）
# 在 Render Dashboard → Shell 中运行
node debug-usage-banner.js YOUR_USER_ID
```

### 2. 手动查询数据库

如果有数据库访问权限：

```sql
-- 查看用户信息
SELECT * FROM users WHERE id = 'YOUR_USER_ID';

-- 查看今天的使用记录
SELECT * FROM plan_usage 
WHERE user_id = 'YOUR_USER_ID' 
  AND date = '2026-01-26'
ORDER BY created_at DESC;

-- 查看所有使用记录
SELECT * FROM plan_usage 
WHERE user_id = 'YOUR_USER_ID'
ORDER BY created_at DESC
LIMIT 20;
```

### 3. 手动测试 API

```bash
# 获取 token（从浏览器 localStorage）
TOKEN="your_jwt_token_here"

# 测试 billing status API
curl -X GET \
  'https://promptly-v0-6-cloudtest-cursor-dev.onrender.com/api/billing/status' \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Accept: application/json' | jq
```

---

## ✅ 验证清单

部署后，确认以下所有项都通过：

- [ ] **后端部署成功**：Render 显示部署成功，服务正常运行
- [ ] **日志正常**：后端日志中有 `[planLimits] Recording usage` 和 `✅ Usage recorded successfully`
- [ ] **API 返回正确**：`/api/billing/status` 返回正确的使用量数据
- [ ] **横幅显示正确**：使用功能后刷新页面，横幅显示递增的使用次数
- [ ] **限制执行正确**：达到 8 次后，第 9 次被正确拒绝
- [ ] **错误提示友好**：用户看到清晰的错误提示，引导升级
- [ ] **第二天重置**：UTC 午夜后，计数器自动重置为 0/8

---

## 🐛 如果仍然有问题

### 场景 1：后端日志没有 recordUsage

**可能原因：**
- Pipeline 执行失败，没有到达成功路径
- 代码没有正确部署

**解决方法：**
1. 检查 Render 部署日志，确认新代码已部署
2. 在 Render Shell 中运行 `cat backend/src/routes/pipeline.js | grep "Recording usage"`
3. 检查 pipeline 是否有其他错误

### 场景 2：有 recordUsage 日志，但 API 返回 0

**可能原因：**
- User ID 不匹配
- 日期计算问题
- 数据库查询问题

**解决方法：**
1. 运行诊断脚本
2. 比对日志中的 userId 和你实际的 userId
3. 检查数据库中是否有记录

### 场景 3：API 正确但横幅不更新

**可能原因：**
- 前端缓存
- JavaScript 错误
- refreshPlanBanner 没有被调用

**解决方法：**
1. 清除浏览器缓存（Ctrl + Shift + Delete）
2. 检查浏览器 Console 是否有错误
3. 手动调用 `window.refreshPlanBanner()`

---

## 📊 监控建议

部署后持续监控：

1. **每小时检查日志**：确保 recordUsage 正常工作
2. **查看数据库增长**：`SELECT COUNT(*) FROM plan_usage WHERE date = '2026-01-26'`
3. **用户反馈**：收集用户关于使用量显示的反馈

---

## 🎉 成功标志

当你看到以下情况，说明修复成功：

### 1. 后端日志正常

```
[pipeline] [run_xxxxx] Recording usage for user github_123456
[planLimits] Recording usage for user github_123456, feature: prompt_optimization
[planLimits] ✅ Usage recorded successfully
[pipeline] [run_xxxxx] Usage recorded successfully
```

### 2. 横幅实时更新

```
使用前：🎯 0/8 prompts/day
使用后：🎯 1/8 prompts/day  ← 刷新后立即显示
```

### 3. 限制正确执行

```
第 8 次：✅ 成功
第 9 次：❌ 被拒绝，提示"Daily limit reached"
```

### 4. 用户体验流畅

- 用户能清楚看到自己的使用情况
- 达到限制时有友好的提示
- 引导用户升级到付费计划

---

**祝部署成功！🚀**

如果遇到任何问题，请参考 `DEBUG_USAGE_BANNER.md` 获取详细的调试指南。
