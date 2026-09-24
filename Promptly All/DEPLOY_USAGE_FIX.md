# 部署使用情况跟踪修复

## 🚀 快速部署步骤

### 1. 提交代码到 Git

```bash
git add backend/src/routes/billing.js
git add backend/src/lib/planLimits.js
git add USAGE_TRACKING_FIX_SUMMARY.md
git commit -m "fix: 修复免费用户使用情况跟踪显示问题

- 移除 billing.js 中 getDailyUsage 的 await
- 将 planLimits.js 中所有函数改为同步
- 添加详细的调试日志
- 修复横幅显示 0/8 prompts 的问题"
git push
```

### 2. Render 会自动重新部署后端

等待 2-3 分钟，Render 会自动检测到代码变更并重新部署。

### 3. 测试步骤

#### 步骤 A：登录并查看初始状态
1. 打开你的前端网站
2. 登录（使用 GitHub 或 Google）
3. 查看页面顶部的横幅，应该显示当前使用情况

#### 步骤 B：运行一次提示词优化
1. 在主页输入一个提示词
2. 点击"优化"按钮
3. 等待优化完成

#### 步骤 C：检查后端日志
1. 打开 Render Dashboard → 你的后端服务 → Logs
2. 查找以下日志：
   ```
   [planLimits] Recording usage for user xxx, feature: prompt_optimization, date: 2026-01-22
   [planLimits] ✅ Usage recorded successfully
   ```

#### 步骤 D：刷新页面验证横幅
1. 刷新前端页面（F5）
2. 查看横幅，应该显示：
   ```
   🆓 Free Plan
   🎯 1/8 prompts/day | 🧙 0/5 wizards/day | 🪙 XXX tokens (50K daily free)
   ```

#### 步骤 E：测试限制执行
1. 再运行 7 次提示词优化（总共 8 次）
2. 刷新页面，应该显示 `8/8 prompts/day`
3. 尝试运行第 9 次
4. 应该被拒绝，提示达到每日限制

## 🔍 验证检查清单

- [ ] 后端成功部署到 Render
- [ ] 后端日志显示 `[planLimits] Recording usage`
- [ ] 后端日志显示 `[planLimits] ✅ Usage recorded successfully`
- [ ] 横幅显示正确的使用次数（不是 0/8）
- [ ] 每次使用后刷新，计数增加
- [ ] 达到限制后被正确阻止
- [ ] 问题向导也正确跟踪（0-5 次）

## 🐛 如果仍然显示 0/8

### 检查 1：确认后端部署成功
```bash
curl https://你的后端URL/api/health
# 应该返回 {"ok":true,"status":"healthy"}
```

### 检查 2：查看后端日志
在 Render Dashboard 中查找：
- 是否有 `[planLimits] Recording usage` 日志？
- 是否有任何错误信息？

### 检查 3：确认用户 ID
在浏览器控制台运行：
```javascript
console.log(localStorage.getItem('promptly.token'));
```
确保你是登录状态，不是 demo-user。

### 检查 4：手动查询数据库
如果你有数据库访问权限，运行：
```sql
SELECT * FROM plan_usage ORDER BY created_at DESC LIMIT 10;
```

## 📊 预期行为

### 免费用户
- 每天最多 8 次提示词优化
- 每天最多 5 次问题向导
- 50K 免费 token（每日刷新）
- 只能使用 Standard 和 Fast 模式

### 付费用户
- 无限次提示词优化
- 无限次问题向导
- 1M token/月 + 50K 免费 token/天
- 可使用所有模式（包括 Deep, Ultra）

## 🎉 成功标志

当你看到以下情况，说明修复成功：

1. **横幅实时更新**
   ```
   🎯 1/8 prompts/day  ← 从 0 变为 1
   ```

2. **后端日志正常**
   ```
   [planLimits] Daily usage for user xxx: 1
   [planLimits] Recording usage for user xxx
   [planLimits] ✅ Usage recorded successfully
   ```

3. **限制正常执行**
   - 第 9 次尝试被拒绝
   - 返回 403 错误和友好提示

4. **第二天自动重置**
   - UTC 午夜后，计数器重置为 0/8

---

需要帮助？查看详细技术文档：`USAGE_TRACKING_FIX_SUMMARY.md`
