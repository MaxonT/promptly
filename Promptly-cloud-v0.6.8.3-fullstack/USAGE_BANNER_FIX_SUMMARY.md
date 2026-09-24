# 🔧 使用量横幅修复 - 完整摘要

## 📋 问题描述

**症状：** 用户使用 Prompt Optimization 功能后，页面顶部的横幅仍然显示 `0/8 prompts/day`，没有更新使用量统计。

**影响：** 
- 用户无法看到自己的实际使用情况
- 可能导致用户困惑，不知道是否还有剩余次数
- 影响付费转化，因为用户看不到免费额度的消耗

---

## 🔍 根本原因分析

### 技术原因

在 `backend/src/routes/pipeline.js` 中：

```javascript
// ❌ 原代码（有问题）
executePipelineWithEvents(runId, userId, { idea, attachments, skipQuestions, modeInput })
  .then(() => {
    // 这里的 recordUsage 可能不会被执行
    recordUsage(userId, 'prompt_optimization');
  })
  .catch((err) => {
    // 错误处理
  });
```

**问题点：**

1. `executePipelineWithEvents` 函数内部有 `try-catch`，捕获了所有错误
2. 即使 pipeline 成功完成，函数也没有明确地 `return` 或 `resolve` promise
3. 导致外部的 `.then()` 回调可能不会被执行
4. 因此 `recordUsage()` 没有被调用

### 数据流问题

```
用户使用功能
  ↓
Pipeline 执行
  ↓
executePipelineWithEvents 内部 try-catch 捕获所有
  ↓
发送 complete 事件
  ↓
函数结束（没有明确 return）
  ↓
❌ 外部 .then() 不执行
  ↓
❌ recordUsage() 不被调用
  ↓
❌ plan_usage 表没有记录
  ↓
❌ /api/billing/status 返回 usage = 0
  ↓
❌ 前端横幅显示 0/8
```

---

## ✅ 解决方案

### 修复策略

**将 `recordUsage()` 移到函数内部的成功路径中**，确保在 pipeline 成功完成时立即记录。

### 修改内容

#### 文件：`backend/src/routes/pipeline.js`

**修改位置 1：** 第 1039 行（在发送 complete 事件后）

```javascript
// 添加以下代码
// 🔥 Record usage after successful pipeline completion
console.log(`[pipeline] [${runId}] Recording usage for user ${userId}`);
recordUsage(userId, 'prompt_optimization');
console.log(`[pipeline] [${runId}] Usage recorded successfully`);
```

**修改位置 2：** 第 165-169 行（移除外部的 .then()）

```javascript
// ❌ 删除这段
.then(() => {
  recordUsage(userId, 'prompt_optimization');
})

// ✅ 改为
// Note: recordUsage is now called inside executePipelineWithEvents on success
```

### 修复后的数据流

```
用户使用功能
  ↓
Pipeline 执行
  ↓
executePipelineWithEvents 内部 try 成功
  ↓
发送 complete 事件
  ↓
✅ 立即调用 recordUsage()
  ↓
✅ 写入 plan_usage 表
  ↓
前端收到 complete 事件
  ↓
前端调用 refreshPlanBanner()
  ↓
调用 /api/billing/status
  ↓
后端调用 getDailyUsage()
  ↓
✅ 返回正确的使用量（如：1）
  ✅ 前端横幅显示 1/8
```

---

## 📦 完整的修复包

### 修改的文件

1. **backend/src/routes/pipeline.js** - 修复 recordUsage 调用位置

### 新增的文件

2. **debug-usage-banner.js** - 诊断脚本，用于排查问题
3. **DEBUG_USAGE_BANNER.md** - 完整的调试指南
4. **FIX_USAGE_BANNER_DEPLOYMENT.md** - 部署和测试指南
5. **quick-check.js** - 快速健康检查脚本
6. **USAGE_BANNER_FIX_SUMMARY.md** - 本文件，修复摘要

---

## 🚀 部署步骤（快速版）

### 1. 本地测试（可选）

```bash
# 运行快速检查
node quick-check.js

# 如果有问题，运行诊断
node debug-usage-banner.js YOUR_USER_ID
```

### 2. 提交代码

```bash
git add backend/src/routes/pipeline.js
git add debug-usage-banner.js DEBUG_USAGE_BANNER.md
git add FIX_USAGE_BANNER_DEPLOYMENT.md quick-check.js
git add USAGE_BANNER_FIX_SUMMARY.md

git commit -m "fix: 修复使用量统计不更新的问题

- 将 recordUsage() 移到 pipeline 成功路径中
- 添加详细的调试日志
- 添加诊断和测试工具

问题：用户使用功能后，横幅仍显示 0/8 prompts/day
原因：recordUsage() 在错误的 promise 链位置，可能不被执行
修复：移到 executePipelineWithEvents 内部成功路径中"

git push origin cursor-dev
```

### 3. 等待部署

- Render 会自动检测变更并重新部署（约 2-3 分钟）

### 4. 快速验证

```bash
# 方法 1：使用功能后刷新页面，查看横幅是否更新

# 方法 2：查看 Render 日志
# 搜索：[planLimits] Recording usage
# 应该看到：[planLimits] ✅ Usage recorded successfully

# 方法 3：测试 API
curl -X GET \
  'https://promptly-v0-6-cloudtest-cursor-dev.onrender.com/api/billing/status' \
  -H "Authorization: Bearer YOUR_TOKEN"
# 检查 usage.promptOptimization 是否递增
```

---

## 🧪 测试清单

部署后，按顺序测试：

### ✅ 基础测试

- [ ] 后端成功部署到 Render
- [ ] 后端服务正常运行（检查 Render Dashboard）
- [ ] 数据库连接正常（运行 `quick-check.js`）

### ✅ 功能测试

- [ ] 登录到前端网站
- [ ] 查看当前横幅显示（记录数字，如：0/8）
- [ ] 使用一次 Prompt Optimization
- [ ] 刷新页面（F5）
- [ ] 确认横幅更新（应该变成 1/8）

### ✅ 后端日志测试

- [ ] 打开 Render Logs
- [ ] 使用功能时，查看日志
- [ ] 确认看到：`[pipeline] Recording usage for user`
- [ ] 确认看到：`[planLimits] ✅ Usage recorded successfully`

### ✅ API 测试

- [ ] 打开浏览器开发者工具 → Network
- [ ] 刷新页面
- [ ] 找到 `/api/billing/status` 请求
- [ ] 确认响应中 `usage.promptOptimization` 值正确

### ✅ 限制测试

- [ ] 连续使用 8 次功能
- [ ] 每次刷新确认计数递增（1/8, 2/8, ..., 8/8）
- [ ] 尝试第 9 次使用
- [ ] 确认被拒绝，提示"Daily limit reached"

---

## 📊 预期结果

### 正常工作的标志

#### 1. 后端日志

```
[pipeline] POST /run received
[pipeline] Starting pipeline - idea length: 123, skipQuestions: false, mode: fast
[pipeline] Generated runId: run_abc123xyz
...
[pipeline] [run_abc123xyz] Recording usage for user github_123456
[planLimits] Recording usage for user github_123456, feature: prompt_optimization, date: 2026-01-26
[planLimits] ✅ Usage recorded successfully
[pipeline] [run_abc123xyz] Usage recorded successfully
```

#### 2. 前端横幅

```
使用前：🎯 0/8 prompts/day | 🧙 0/5 wizards/day | 🪙 50K tokens (50K daily free)
使用后：🎯 1/8 prompts/day | 🧙 0/5 wizards/day | 🪙 49.8K tokens (50K daily free)
再用后：🎯 2/8 prompts/day | 🧙 0/5 wizards/day | 🪙 49.6K tokens (50K daily free)
```

#### 3. API 响应

```json
{
  "ok": true,
  "plan": "free",
  "usage": {
    "promptOptimization": 1,  // ⬅️ 递增
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

#### 4. 浏览器 Console

```
[Plan Banner] Token found: true
[Plan Banner] API response status: 200
[Plan Banner] API response data: {ok: true, plan: "free", usage: {...}}
[Plan Banner] ✅ Showing FREE plan info: 1/8 prompts, 0/5 wizards, tokens: 50K
```

---

## 🔧 故障排除

### 问题：后端日志没有 recordUsage

**排查：**
1. 检查部署是否成功
2. 确认代码变更已部署：在 Render Shell 运行 `grep "Recording usage for user" backend/src/routes/pipeline.js`
3. 检查 pipeline 是否有其他错误

**解决：**
- 重新部署后端
- 检查 Render 部署日志

### 问题：有日志但 API 返回 0

**排查：**
```bash
# 运行诊断脚本
node debug-usage-banner.js YOUR_USER_ID

# 或直接查询数据库
sqlite3 data/app-v0-7.db "SELECT * FROM plan_usage WHERE user_id='YOUR_USER_ID' ORDER BY created_at DESC LIMIT 5"
```

**可能原因：**
- User ID 不匹配
- 日期计算问题
- 数据库查询问题

### 问题：API 正确但横幅不更新

**排查：**
1. 打开浏览器 Console
2. 手动调用：`window.refreshPlanBanner()`
3. 查看是否有 JavaScript 错误

**可能原因：**
- 浏览器缓存
- JavaScript 错误
- refreshPlanBanner 没有被调用

**解决：**
- 清除浏览器缓存（Ctrl + Shift + Delete）
- 硬刷新（Ctrl + F5）

---

## 📚 相关文档

- **DEBUG_USAGE_BANNER.md** - 详细的调试指南，包括如何获取 User ID、查看日志等
- **FIX_USAGE_BANNER_DEPLOYMENT.md** - 完整的部署和测试步骤
- **debug-usage-banner.js** - 诊断脚本，用于检查数据库和使用记录
- **quick-check.js** - 快速健康检查，验证系统配置

---

## 🎯 成功标准

### 用户体验目标

1. **透明性**：用户能清楚看到自己使用了多少次免费额度
2. **实时性**：使用功能后刷新页面，立即看到更新
3. **准确性**：显示的数字与实际使用情况完全一致
4. **友好性**：达到限制时有清晰的提示和升级引导

### 技术指标

- ✅ recordUsage 调用成功率 = 100%
- ✅ API 返回准确率 = 100%
- ✅ 前端显示延迟 < 1 秒（刷新后）
- ✅ 限制执行准确率 = 100%

---

## 🚀 下一步优化（可选）

### 短期优化

1. **自动刷新**：使用功能后自动刷新横幅，无需手动刷新页面
2. **动画效果**：数字变化时添加平滑的动画过渡
3. **进度条**：用可视化的进度条显示使用情况

### 长期优化

1. **WebSocket 实时更新**：使用 WebSocket 推送使用量变化
2. **本地缓存**：在 localStorage 缓存使用量，减少 API 调用
3. **预测提示**：接近限制时提前提示用户
4. **使用分析**：记录用户使用模式，优化免费额度分配

---

## 📞 支持

如果按照本文档操作后仍有问题：

1. **运行诊断**：`node debug-usage-banner.js YOUR_USER_ID`
2. **查看日志**：Render Dashboard → 后端服务 → Logs
3. **检查前端**：浏览器 F12 → Console / Network
4. **提供信息**：
   - User ID（可脱敏）
   - 诊断脚本输出
   - 后端日志截图
   - 前端 Console 日志
   - /api/billing/status 响应数据

---

## 📈 监控建议

部署后持续监控（建议至少一周）：

### 每日检查

- [ ] 查看 Render 日志，确认 recordUsage 正常工作
- [ ] 抽查几个用户的使用记录
- [ ] 监控是否有异常的使用模式

### 每周检查

- [ ] 统计 plan_usage 表的记录数量
- [ ] 分析用户使用分布
- [ ] 检查是否有用户反馈显示问题

### SQL 查询示例

```sql
-- 今天的总使用次数
SELECT COUNT(*) FROM plan_usage WHERE date = '2026-01-26';

-- 各功能的使用分布
SELECT feature_type, COUNT(*) as count 
FROM plan_usage 
WHERE date = '2026-01-26'
GROUP BY feature_type;

-- 最活跃的用户
SELECT user_id, COUNT(*) as count
FROM plan_usage
WHERE date = '2026-01-26'
GROUP BY user_id
ORDER BY count DESC
LIMIT 10;

-- 达到限制的用户
SELECT user_id, COUNT(*) as count
FROM plan_usage
WHERE date = '2026-01-26' AND feature_type = 'prompt_optimization'
GROUP BY user_id
HAVING count >= 8;
```

---

## ✅ 验收标准

修复被认为成功当且仅当：

1. ✅ 所有测试清单项目都通过
2. ✅ 连续 3 天没有用户报告显示问题
3. ✅ 数据库记录与实际使用量 100% 匹配
4. ✅ 免费用户达到限制后被正确阻止
5. ✅ 付费用户显示正确的无限额度

---

**修复日期：** 2026-01-26  
**版本：** v0.6.8.3  
**状态：** ✅ 已修复，待部署验证

---

**祝部署顺利！如有问题请参考详细文档或联系支持。🚀**
