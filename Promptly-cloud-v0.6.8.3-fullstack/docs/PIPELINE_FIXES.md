# Pipeline 修复总结

## 修复时间
2025-12-05

## 问题诊断

### 问题 1: API 路由不存在
- **症状**: `Cannot POST /api/pipeline/run` 错误
- **原因**: 可能是部署问题或路由未正确注册

### 问题 2: 输出 unchanged（输出不变）
- **症状**: 第二次运行后，Pipeline 运行太快，输出与输入相同
- **原因**: 
  - 相似度阈值太高（0.85）
  - System prompts 不够强制要求改变
  - 重试机制不够强

---

## 修复内容

### 1. 修复 unchanged 输出问题

#### 1.1 降低相似度阈值
**文件**: `backend/src/lib/openaiClient.js`

- **修改前**: `DEFAULT_MIN_CHANGE_SIMILARITY = 0.85`
- **修改后**: `DEFAULT_MIN_CHANGE_SIMILARITY = 0.75`
- **影响**: 更容易检测到未改变的输出，触发重试

#### 1.2 增加重试次数
**文件**: `backend/src/lib/openaiClient.js`

- **修改前**: `DEFAULT_MAX_RETRIES = 1`
- **修改后**: `DEFAULT_MAX_RETRIES = 2`
- **影响**: 更多重试机会，确保输出被改变

#### 1.3 增强重试时的温度
**文件**: `backend/src/lib/openaiClient.js`

- **修改前**: `Math.max(appliedTemperature, 0.35)`
- **修改后**: `Math.max(appliedTemperature + 0.15, 0.4)`
- **影响**: 重试时使用更高的温度，增加输出的随机性和变化

#### 1.4 增强 Force Rewrite Prompt
**文件**: `backend/src/lib/openaiClient.js`

- **修改前**: 简单的提示
- **修改后**: 更强的强制性提示，明确要求"substantially different"

### 2. 增强 System Prompts

#### 2.1 Spec Builder Prompt
**文件**: `backend/src/routes/pipeline.js`

- 添加了详细的 CRITICAL REQUIREMENTS
- 明确要求 rephrase 和 expand
- 要求转换模糊想法为具体规范

#### 2.2 LLM Agents Prompts
**文件**: `backend/src/routes/pipeline.js`

- **Architect Agent**: 
  - 明确要求添加结构、标题、变量
  - 要求 step-by-step 指令
- **Editor Agent**: 
  - 明确要求改进句子结构、清晰度、词汇选择
  - 要求显著改进
- **Judge Agent**: 
  - 明确要求添加安全约束、护栏、边缘情况处理
  - 要求显著的安全增强

#### 2.3 Question Engine Prompt
**文件**: `backend/src/routes/pipeline.js`

- 添加了详细的 REQUIREMENTS
- 要求问题必须是 specific 和 actionable
- 明确停止条件

#### 2.4 Metrics Evaluator Prompt
**文件**: `backend/src/routes/pipeline.js`

- 添加了详细的 SCORING CRITERIA
- 明确每个指标的评分标准

### 3. 增强错误处理和日志

#### 3.1 Pipeline 路由日志
**文件**: `backend/src/server.js`

- 添加了路由注册确认日志
- 显示可用的 pipeline 路由

#### 3.2 Pipeline 执行日志
**文件**: `backend/src/routes/pipeline.js`

- 添加了详细的执行日志
- 每个阶段都有开始/完成的日志
- 包含 runId 追踪
- 相似度检查结果日志

#### 3.3 错误处理增强
**文件**: `backend/src/routes/pipeline.js`

- 更详细的错误信息
- 包含错误堆栈（开发环境）
- 清理 SSE 连接

#### 3.4 添加健康检查端点
**文件**: `backend/src/routes/pipeline.js`

- 新增 `GET /api/pipeline/health` 端点
- 用于验证路由是否正常工作
- 显示活跃的 SSE 连接数

### 4. Pipeline 执行优化

#### 4.1 降低 Agent 相似度阈值
**文件**: `backend/src/routes/pipeline.js`

- **修改前**: `minSimilarity: 0.85, maxRetries: 1`
- **修改后**: `minSimilarity: 0.75, maxRetries: 2`
- **影响**: 更容易检测到未改变的输出，并触发重试

#### 4.2 增强 User Prompt
**文件**: `backend/src/routes/pipeline.js`

- 在用户提示中明确要求"substantially different"
- 强调"Transform and enhance"

---

## 测试建议

### 1. 验证路由
```bash
# 健康检查
curl https://your-backend-url.onrender.com/api/pipeline/health

# 应该返回:
{
  "ok": true,
  "message": "Pipeline routes are working",
  "routes": {...},
  "activeStreams": 0
}
```

### 2. 测试 Pipeline
```bash
# 启动 Pipeline
curl -X POST https://your-backend-url.onrender.com/api/pipeline/run \
  -H "Content-Type: application/json" \
  -d '{
    "idea": "写一个函数判断字符串是否是回文",
    "skipQuestions": true
  }'
```

### 3. 监控日志
- 检查后端日志中的 `[pipeline]` 标记
- 查看相似度分数
- 确认重试是否触发

---

## 预期改进

1. **输出质量**: 
   - 相似度阈值降低后，更容易检测到未改变的输出
   - 重试机制确保输出被真正改变

2. **错误处理**: 
   - 更详细的日志便于调试
   - 更好的错误信息帮助定位问题

3. **可观测性**: 
   - 每个阶段都有明确的日志
   - 健康检查端点可以快速验证路由

---

## 部署注意事项

1. **确保后端重启**: 修改代码后需要重启后端服务
2. **检查环境变量**: 确保 `OPENAI_API_KEY` 已设置
3. **监控日志**: 部署后检查日志确认路由注册成功
4. **测试健康检查**: 使用 `/api/pipeline/health` 端点验证

---

## 后续优化建议

1. **进一步降低相似度阈值**: 如果仍有问题，可以尝试 0.70 或更低
2. **增加重试次数**: 如果 2 次不够，可以增加到 3 次
3. **调整温度**: 可以尝试更高的初始温度（如 0.3）
4. **添加缓存检测**: 确保每次运行都生成新的输出，不重复使用缓存

