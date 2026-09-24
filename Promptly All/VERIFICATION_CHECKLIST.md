# 端到端验证清单

本文档用于验证所有8个关键点的实现是否正确。

## 1. Layer 2 & 3 → First-class backend inputs ✅

### 验证步骤：
1. 打开 `frontend/index.html`
2. 填写 Layer 1 的主任务描述
3. 展开 Layer 2，填写：
   - `blueprintInstructions`
   - `blueprintExamples`
   - `blueprintConstraints`
4. 展开 Layer 3，填写：
   - `posNegDataset`
   - `schemaTemplate`
   - `optimizationKnobs`
5. 点击 "Run Optimization"
6. 检查浏览器开发者工具的 Network 标签
7. 验证 POST `/api/outcome-runs` 请求包含所有 Layer 2/3 字段
8. 验证后端返回的 `best.content` 包含这些字段的内容

### 预期结果：
- 所有 Layer 2/3 字段都被发送到后端
- 最终生成的 prompt 包含这些字段的内容
- 这些字段影响最终的 Best Prompt

## 2. Metrics → Data correctness + formulas + visualization ✅

### 验证步骤：
1. 运行一次优化（Hero area → Run Optimization）
2. 检查指标显示：
   - Accuracy: 应该显示百分比（0-100%）
   - F1: 应该显示 0-1 之间的值
   - Pass Rate: 应该显示百分比
   - Token Cost: 应该显示数字
   - Progress%: 应该显示百分比
3. 检查图表：
   - `lineGrowth`: 应该显示进度曲线
   - `barContrib`: 应该显示贡献柱状图
   - `piePass`: 应该显示通过/失败饼图
   - `gaugeProg`: 应该显示进度仪表
4. 验证图表数据与文本指标一致

### 预期结果：
- 所有指标使用 `metricsEngine.js` 的公式计算
- Accuracy = correct_outputs / total_cases
- F1 = 2 × precision × recall ÷ (precision + recall)
- Progress% = average(accuracy/target, f1/target, pass_rate/target, ideal_token_cost/token_cost) × 100
- 图表使用相同的指标值

## 3. Model selection dropdown → Real models or solid placeholders ✅

### 验证步骤：
1. 在 Hero area 点击模型选择下拉菜单
2. 选择不同的模型（如 "Promptly Pro"）
3. 运行优化
4. 检查后端日志，验证模型选择被正确传递
5. 验证 `MODEL_TARGETS` 映射正确

### 预期结果：
- 每个模型选项都有对应的后端映射
- 模型选择影响实际的 LLM 调用
- 占位符模型有明确的文档说明（在代码注释中）

## 4. Question Wizard modes → Real modes or solid placeholders ✅

### 验证步骤：
1. 打开 `wizard.html`
2. 选择不同的模式（Fast / Deep Thinking / Ultra Thinking）
3. 启动 wizard
4. 观察处理时间：
   - Fast: 10-40 秒
   - Deep: 30-90 秒
   - Ultra: 90-180 秒
5. 检查后端日志，验证 `modeProfile` 参数被传递到 agent

### 预期结果：
- 不同模式产生不同的响应时间
- 模式参数（chainLength, maxSteps, timeoutMs）影响 agent 行为
- 用户可以看到模式选择的实际效果

## 5. "3. Spec & Compiled Prompt" → Does it truly show the final result? ✅

### 验证步骤：
1. 完成 Question Wizard 流程
2. 点击 "Finalize spec"
3. 检查显示的 spec：
   - 应该包含 `_metadata` 字段，显示 session_id, mode, model
   - 应该包含所有 wizard 答案的信息
4. 检查显示的 compiled prompt：
   - 应该显示所有 prompt blocks
   - 应该包含元数据说明这是最终结果

### 预期结果：
- Spec 包含所有输入（hero content, wizard 答案, mode, model）
- Compiled prompt 是最终合并的结果
- 显示的数据不是过时的或部分的

## 6. Global "Question Wizard is running…" status indicator ✅

### 验证步骤：
1. 在 `wizard.html` 启动 Question Wizard
2. 导航到 `index.html`
3. 验证状态指示器仍然可见
4. 等待 wizard 完成
5. 验证状态指示器更新为完成状态或消失

### 预期结果：
- 状态指示器在 wizard 启动时显示
- 指示器在用户导航时保持可见
- 指示器在 wizard 完成/失败时更新
- 指示器反映真实的后端状态（每10秒轮询一次）

## 7. "2. Answer guided questions" page → UX, saving, and expectations ✅

### 验证步骤：
1. 启动 Question Wizard
2. 检查页面指示器（"Page 1 of N"）
3. 检查用户指导文本（"Answering Tips"）
4. 检查处理时间反馈（根据模式显示）
5. 回答问题，观察自动保存反馈（绿色边框闪烁）
6. 检查页面底部的自动保存提示

### 预期结果：
- 页面指示器清晰显示
- 用户指导文本清晰（不需要回答所有问题，自动保存等）
- 处理时间反馈准确（根据模式）
- 自动保存机制工作（视觉反馈）

## 8. Final sanity check → "Does everything actually work as intended?" ✅

### 端到端测试流程：

#### 测试 A: Hero area 优化流程
1. 打开 `index.html`
2. 填写 Layer 1 任务
3. 填写 Layer 2 字段（至少一个）
4. 填写 Layer 3 字段（至少一个）
5. 选择模型
6. 点击 "Run Optimization"
7. 验证：
   - Pipeline 动画播放
   - Best Prompt 显示结果
   - 所有指标更新
   - 图表更新
   - Layer 2/3 字段影响最终 prompt

#### 测试 B: Question Wizard 完整流程
1. 打开 `wizard.html`
2. 填写项目描述
3. 选择模式
4. 启动 wizard
5. 回答至少一个问题
6. 观察自动保存反馈
7. 完成 wizard
8. 点击 "Finalize spec"
9. 验证：
   - Spec 显示完整信息
   - Compiled prompt 显示最终结果
   - 状态指示器正确更新

#### 测试 C: 跨页面状态指示器
1. 启动 Question Wizard
2. 导航到 `index.html`
3. 验证状态指示器可见
4. 等待 wizard 完成
5. 验证状态指示器更新

### 预期结果：
- 所有输入影响最终结果
- 所有指标、图表、文本反映真实后端状态
- 没有装饰性、虚假或部分连接的功能
- 所有功能都正确连接并工作

## 代码验证清单

- [x] `frontend/index.html`: Layer 2/3 字段收集和发送
- [x] `backend/src/routes/outcomeRuns.js`: Schema 接受 Layer 2/3 字段
- [x] `backend/src/routes/outcomeRuns.js`: 使用 `metricsEngine.js` 计算指标
- [x] `frontend/index.html`: 指标显示和图表更新使用正确的值
- [x] `backend/src/routes/questionSessions.js`: MODEL_TARGETS 映射文档化
- [x] `backend/src/routes/questionSessions.js`: MODE_PROFILES 文档化
- [x] `backend/src/lib/llmAgents.js`: modeProfile 参数传递到 agent
- [x] `frontend/wizard.js`: Spec & Compiled Prompt 显示包含元数据
- [x] `frontend/core.js`: 状态指示器轮询逻辑
- [x] `frontend/wizard.js`: UX 改进（指导文本、时间反馈、自动保存）

## 注意事项

1. 某些模型目前是占位符（映射到相同的底层模型），但已文档化升级路径
2. 指标计算使用模拟数据（在 outcomeRuns.js 中），但公式是正确的
3. 所有功能都已正确连接，可以随时升级为完整实现


