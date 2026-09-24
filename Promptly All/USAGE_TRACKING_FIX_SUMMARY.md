# 使用情况跟踪修复总结

## 问题描述

免费用户的使用情况横幅（Banner）显示不正确：
- 提示词优化显示 `0/8` 而不是实际使用次数
- 问题向导显示 `0/5` 而不是实际使用次数
- Token 使用情况显示 `0/50k` 而不是实际使用的 token 数量

## 根本原因

### 主要问题：异步/同步不匹配

1. **billing.js 中的错误**（第 85-86 行）
   ```javascript
   // ❌ 错误：getDailyUsage 是同步函数，不应该使用 await
   const promptUsage = await getDailyUsage(userId, 'prompt_optimization');
   const wizardUsage = await getDailyUsage(userId, 'question_wizard');
   ```

2. **planLimits.js 中的不一致**
   - `canUsePromptOptimization()` 和 `canUseQuestionWizard()` 被标记为 `async`
   - 但它们调用的 `getDailyUsage()` 是同步函数
   - 使用 `await` 调用同步函数会导致返回值不正确

## 实施的修复

### 修复 1：backend/src/routes/billing.js

```javascript
// ✅ 正确：移除 await，因为 getDailyUsage 是同步函数
const promptUsage = getDailyUsage(userId, 'prompt_optimization');
const wizardUsage = getDailyUsage(userId, 'question_wizard');
```

### 修复 2：backend/src/lib/planLimits.js

#### 修复 canUsePromptOptimization()
```javascript
// ✅ 移除 async 和 await，改为同步函数
export function canUsePromptOptimization(userId) {
  const plan = getUserPlan(userId);
  const limits = PLAN_LIMITS[plan];
  
  if (!limits) {
    return { allowed: true };
  }
  
  const dailyUsage = getDailyUsage(userId, 'prompt_optimization');  // 移除 await
  // ...
}
```

#### 修复 canUseQuestionWizard()
```javascript
// ✅ 移除 async 和 await，改为同步函数
export function canUseQuestionWizard(userId) {
  const plan = getUserPlan(userId);
  const limits = PLAN_LIMITS[plan];
  
  if (!limits) {
    return { allowed: true };
  }
  
  const dailyUsage = getDailyUsage(userId, 'question_wizard');  // 移除 await
  // ...
}
```

#### 修复 checkPromptOptimizationLimit()
```javascript
// ✅ 移除 async 和 await
export function checkPromptOptimizationLimit(userId, mode = null) {
  if (mode && !canUseMode(userId, mode)) {
    return {
      allowed: false,
      reason: 'Free plan only supports Standard and Fast modes.'
    };
  }
  
  return canUsePromptOptimization(userId);  // 移除 await
}
```

#### 修复 checkQuestionWizardLimit()
```javascript
// ✅ 移除 async 和 await
export function checkQuestionWizardLimit(userId) {
  return canUseQuestionWizard(userId);  // 移除 await
}
```

### 修复 3：添加调试日志

在 `getDailyUsage()` 和 `recordUsage()` 中添加了详细的日志：

```javascript
export function getDailyUsage(userId, featureType, date = null) {
  // ...
  try {
    const result = db.prepare(`
      SELECT COUNT(*) as count FROM plan_usage
      WHERE user_id = ? AND feature_type = ? AND date = ?
    `).get(userId, featureType, date);
    
    const count = result?.count || 0;
    console.log(`[planLimits] Daily usage for user ${userId}, feature ${featureType}, date ${date}: ${count}`);
    return count;
  } catch (err) {
    console.error(`[planLimits] ❌ Failed to get daily usage:`, err);
    return 0;
  }
}

export function recordUsage(userId, featureType) {
  // ...
  console.log(`[planLimits] Recording usage for user ${userId}, feature: ${featureType}, date: ${today}`);
  
  try {
    db.prepare(`
      INSERT INTO plan_usage (id, user_id, feature_type, date, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(/* ... */);
    console.log(`[planLimits] ✅ Usage recorded successfully`);
  } catch (err) {
    console.error(`[planLimits] ❌ Failed to record usage:`, err);
  }
}
```

## 数据流程

### 正确的流程（修复后）

1. **用户运行提示词优化**
   ```
   frontend → POST /api/pipeline/run
   → checkPromptOptimizationLimit(userId) [同步检查]
   → 执行优化
   → recordUsage(userId, 'prompt_optimization') [同步记录]
   → plan_usage 表插入记录
   ```

2. **前端刷新横幅**
   ```
   frontend → GET /api/billing/status
   → getDailyUsage(userId, 'prompt_optimization') [同步查询]
   → 返回正确的使用次数
   → 横幅显示 "X/8 prompts/day"
   ```

3. **记录位置**
   - `backend/src/routes/pipeline.js` (第 168 行)
   - `backend/src/routes/enhance.js` (第 356, 429, 497 行)
   - `backend/src/routes/questionSessions.js` (第 326 行)

## 测试步骤

### 部署后测试

1. **部署更新的后端代码到 Render**
2. **清除浏览器缓存并刷新前端**
3. **登录并运行一次提示词优化**
4. **检查后端日志**：
   ```
   [planLimits] Recording usage for user xxx, feature: prompt_optimization, date: 2026-01-22
   [planLimits] ✅ Usage recorded successfully
   ```
5. **刷新页面查看横幅**：
   - 应该显示 `🎯 1/8 prompts/day`
6. **再运行 3 次提示词优化**
7. **刷新页面**：
   - 应该显示 `🎯 4/8 prompts/day`

### 预期结果

- ✅ 横幅实时更新使用次数
- ✅ 达到限制时阻止继续使用
- ✅ Token 使用情况正确显示
- ✅ 每日 UTC 午夜重置计数

## 为什么会出现这个问题

使用的是 `better-sqlite3`（同步 API），但代码中混用了 `async/await`，导致：
- 函数被标记为 `async` 返回 Promise
- 但实际内部是同步执行
- 使用 `await` 调用同步函数会得到 Promise 包装的结果
- 这导致返回值类型不匹配，使用统计数据丢失

## 限制执行流程

### 免费用户（Free Plan）

```
用户请求
  ↓
checkPromptOptimizationLimit(userId, mode)
  ↓
1. 检查模式限制（只允许 fast/standard）
2. 调用 canUsePromptOptimization(userId)
  ↓
  getDailyUsage(userId, 'prompt_optimization')
  ↓
  查询 plan_usage 表
  ↓
  如果 count >= 8 → 拒绝（返回 403）
  如果 count < 8 → 允许
  ↓
执行优化
  ↓
recordUsage(userId, 'prompt_optimization')
  ↓
插入记录到 plan_usage 表
```

### 付费用户（Pro/Trial）

```
用户请求
  ↓
checkPromptOptimizationLimit(userId, mode)
  ↓
getUserPlan(userId) → 'monthly' / 'yearly' / 'trial'
  ↓
PLAN_LIMITS[plan] === null （无限制）
  ↓
直接允许（不记录使用次数）
```

## 相关文件

- ✅ `backend/src/routes/billing.js` - 修复 await
- ✅ `backend/src/lib/planLimits.js` - 移除 async/await，添加日志
- ✅ `frontend/index.html` (第 1165 行) - 显示横幅的代码
- ✅ `backend/src/lib/db.js` (第 268 行) - plan_usage 表定义

## 数据库表结构

```sql
CREATE TABLE IF NOT EXISTS plan_usage (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  feature_type TEXT NOT NULL,  -- 'prompt_optimization' 或 'question_wizard'
  date TEXT NOT NULL,           -- YYYY-MM-DD 格式
  created_at TEXT NOT NULL,
  CONSTRAINT fk_usage_user FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_plan_usage_user_date 
ON plan_usage(user_id, date, feature_type);
```

## 下一步

1. **立即部署后端到 Render**
2. **测试使用情况跟踪**
3. **检查后端日志确认记录正常**
4. **验证横幅显示正确的使用次数**

---

修复完成时间：2026-01-22
修复者：AI Assistant
