# Free Plan 使用量追踪修复计划

## 1. 验证后端计数逻辑
- **目标**: 确保后端 API 正确记录使用量，并正确限制 Free Plan 用户。
- **任务**:
    - [x] 检查 `backend/src/routes/enhance.js` 中 `/structure`, `/style`, `/simplify` 等接口是否调用 `recordUsage`。
    - [ ] 检查 `backend/src/routes/pipeline.js` 中 pipeline 运行是否调用 `recordUsage` 和 `spendTokensForRun`。
    - [ ] 检查 `backend/src/routes/questionSessions.js` 中创建 wizard 会话是否调用 `recordUsage`。
    - [ ] 验证 `backend/src/lib/planLimits.js` 中 `recordUsage` 是否对非 `demo-user` 有效。

## 2. 修复前端状态刷新
- **目标**: 确保前端操作完成后，Banner 数据能实时更新。
- **任务**:
    - [ ] 修改 `frontend/enhancer.js`，在增强成功后调用 `window.refreshPlanBanner()`（如果存在）或重新获取状态。
    - [ ] 修改 `frontend/wizard.js`，在创建会话成功后刷新状态。
    - [ ] 确保 `frontend/core.js` (或 `index.html` 中的脚本) 在页面加载时正确获取状态，并处理 token 认证头。

## 3. 验证限制生效
- **目标**: 确保达到限制后，后端拒绝请求。
- **任务**:
    - [ ] 创建一个测试脚本，模拟多次调用 `/enhance/structure`，验证第 9 次调用是否被拒绝（Free Plan 限制 8 次）。
    - [ ] 验证 Banner 是否显示 `8/8`。

## 4. 执行修复
- **步骤**:
    1.  如果发现 API 漏加 `recordUsage`，补上。
    2.  在前端关键操作成功的回调中添加 Banner 刷新逻辑。
    3.  确保前端请求 `/api/billing/status` 时带上 `Authorization` header（如果需要）。

## 5. 最终验证
- **验证**: 运行测试脚本，确认数据库计数增加，且 API 返回正确的 usage 数据。
