# Token Hardening Implementation Summary

**Status**: ✅ Implementation Complete  
**Date**: 2024  
**Goal**: 在不破坏现有功能的前提下，让 3-agent best-of-N 流程更可控、更可观测、更省 token

---

## 📋 实施总结

### Phase 1: Safe Changes（已完成）

#### ✅ 1. Pipeline Metrics 汇总日志（可观测性增强）

**改动文件**: `backend/src/routes/pipeline.js`

**实现内容**:
- 添加 `pipelineMetrics` 对象追踪所有关键metrics
- 在每个阶段追踪调用次数、重试次数、QE轮数等
- 在pipeline结束时输出完整的metrics汇总JSON

**关键Metrics**:
```javascript
{
  calls_total: {
    spec_builder: 1,
    question_engine: 2,      // 实际执行的轮数
    generation: 3,            // agent调用次数
    scoring: 3,               // candidate评分次数
    outcome_runner: 0         // 无LLM调用
  },
  retries_total: 0,           // 总重试次数
  qe_rounds: 2,               // QE实际轮数
  generation_retries: 0,      // generation相似度重试次数
  score_calls: 3,
  tokens_estimated: {
    input: 12000,
    output: 2000,
    total: 14000
  },
  feature_flags: {
    QE_STRICT_MAX_ROUNDS: true,
    SCORING_SPEC_MINIFY: false
  }
}
```

**日志输出位置**: Pipeline执行结束时，输出到console：
```
[pipeline] [runId] 🔍 Token Hardening Metrics Summary: {...}
```

---

#### ✅ 2. 修正QE循环"配置2跑3"的不一致Bug

**改动文件**: 
- `backend/src/routes/pipeline.js`
- `backend/src/lib/modePolicies.js`

**实现内容**:
- **Premium模式**: 在`modePolicies.js`中添加`max_rounds: 3`配置（之前硬编码）
- **Standard模式**: 修复循环逻辑，使用`policy.questionEngine.max_rounds`而非硬编码3
- **Feature Flag**: 使用`QE_STRICT_MAX_ROUNDS`环境变量控制（默认true，可通过`QE_STRICT_MAX_ROUNDS=false`禁用）

**关键代码**:
```javascript
// Token Hardening: Use policy.max_rounds instead of hardcoded 3
const useStrictQERounds = process.env.QE_STRICT_MAX_ROUNDS !== 'false';
const maxQERounds = useStrictQERounds 
  ? (policy.questionEngine?.max_rounds ?? 3)  // Use policy config (Standard=2, Premium=3)
  : 3; // Fallback to 3 if feature flag disabled (old behavior)

while (currentStep < maxQERounds && !shouldStop) {
  // ...
}
```

**预期收益**: 
- Standard模式：实际token节省 ~900 tokens（少跑1轮QE）
- Premium模式：配置化，不再硬编码

---

#### ✅ 3. Groq similarity=0 防护（文档化+防御性代码）

**改动文件**:
- `backend/src/lib/groqClient.js`
- `backend/src/lib/llmRouter.js`

**实现内容**:
- 在`groqClient.js`中添加明确日志，说明similarity=0时跳过similarity gate
- 在`llmRouter.js`中添加注释，说明Groq的similarity保护机制

**关键代码**:
```javascript
// Token Hardening: Groq returns similarity=0, which will skip similarity gate
// When similarity=0 and minSimilarity > 0, retry gate will be skipped (0 < threshold).
// This prevents unnecessary retries for Groq provider.
if (minSimilarity && maxRetries && maxRetries > 0) {
  console.log(`[promptly] ⚠️ Token Hardening: Similarity check disabled for Groq (returns 0). minSimilarity=${minSimilarity}, maxRetries=${maxRetries} - retry gate will be skipped.`);
}

return {
  // ...
  similarity: 0 // Token Hardening: Explicitly return 0 to skip similarity gate (0 < any threshold)
};
```

**预期收益**: 代码更清晰，避免未来误用，确保Groq不会触发无意义重试

---

### Phase 2: Feature Flag + Scoring优化（已完成）

#### ✅ 4. Feature Flag系统

**环境变量**:
- `QE_STRICT_MAX_ROUNDS`: 控制QE循环是否使用policy配置（默认true）
- `SCORING_SPEC_MINIFY`: 控制scoring阶段是否使用裁剪版spec（默认false，需要手动开启）

**回滚策略**:
```bash
# 禁用QE严格轮数限制（恢复旧行为）
QE_STRICT_MAX_ROUNDS=false

# 启用spec裁剪（节省token）
SCORING_SPEC_MINIFY=true

# 禁用所有token hardening特性
QE_STRICT_MAX_ROUNDS=false
SCORING_SPEC_MINIFY=false
```

---

#### ✅ 5. Scoring Spec裁剪优化

**改动文件**: `backend/src/routes/pipeline.js`

**实现内容**:
- 当`SCORING_SPEC_MINIFY=true`时，scoring阶段使用裁剪版spec
- 仅保留评分必需字段：`userGoal`, `tone`, `format`, `audience`
- 移除：`examples`, `constraints`细节, `domain`（如果不需要）

**关键代码**:
```javascript
const useSpecMinify = process.env.SCORING_SPEC_MINIFY === 'true';
let scoringSpec;
if (useSpecMinify) {
  scoringSpec = {
    userGoal: specData.userGoal,
    tone: specData.tone,
    format: specData.format,
    audience: specData.audience
  };
  console.log(`[pipeline] [${runId}] Scoring spec minified: ${originalLength} -> ${minifiedLength} chars`);
} else {
  scoringSpec = specData;
}
```

**预期收益**: 
- 假设spec JSON约500 tokens，裁剪后约200 tokens
- 节省: (500-200) × 3 = **900 tokens**（3个candidates）

---

## 🎯 验收标准验证

### ✅ 1. 最坏调用次数被硬上限限制

- **Generation**: 3 agents × 3 calls = 9 calls（理论），但Groq实际3 calls（similarity=0不重试）✅
- **QE**: Standard模式最多2 calls（修复后）✅，Premium最多3 calls ✅
- **Scoring**: 3 calls（固定）✅

### ✅ 2. Groq similarity=0不再触发无意义重试

- 已在保护中（0 < 0.75），已添加明确日志/文档 ✅
- 添加防护代码，确保similarity=0时跳过gate ✅

### ✅ 3. QE循环严格遵守配置max_rounds

- Standard模式配置2，实际最多跑2轮（修复off-by-one）✅
- Premium模式配置max_rounds=3（不再硬编码）✅

### ✅ 4. Scoring输入不再重复传输巨量spec（可选，feature flag控制）

- 实现spec裁剪（仅保留评分必需字段）✅
- 使用feature flag控制（`SCORING_SPEC_MINIFY=true`）✅

### ✅ 5. 新增Metrics可被打印/记录

- `calls_total`: 各阶段调用次数 ✅
- `retries_total`: 总重试次数 ✅
- `qe_rounds`: QE实际轮数 ✅
- `score_calls`: Scoring调用次数 ✅
- `tokens_estimated`: input/output/total ✅

---

## 📊 预期Token节省

### Standard模式（QE修复后）

**修复前**:
- QE: 3轮 × ~800 tokens = 2400 tokens
- Scoring: 3 × 1500 tokens = 4500 tokens（spec重复）
- **总计**: ~15k tokens

**修复后（QE严格2轮）**:
- QE: 2轮 × ~800 tokens = 1600 tokens（节省800 tokens）
- Scoring: 3 × 1500 tokens = 4500 tokens
- **总计**: ~14.2k tokens（节省~800 tokens）

**修复后（QE严格2轮 + Spec裁剪）**:
- QE: 2轮 × ~800 tokens = 1600 tokens
- Scoring: 3 × 1200 tokens = 3600 tokens（spec裁剪后，节省900 tokens）
- **总计**: ~13.3k tokens（总共节省~1700 tokens，约11%）

---

## 🚀 如何验证

### 1. 验证QE循环修复

```bash
# 设置环境变量
export QE_STRICT_MAX_ROUNDS=true  # 默认值

# 运行Standard模式pipeline
curl -X POST http://localhost:8080/api/pipeline/run \
  -H "Content-Type: application/json" \
  -d '{"idea": "test", "mode": "standard"}'

# 检查日志，应该看到：
# [pipeline] [runId] QE Loop: max_rounds=2 (from policy: 2, feature flag: true)
# [pipeline] [runId] 🔍 Token Hardening Metrics Summary: {
#   "qe_rounds": 2,  // ✅ 必须是2，不能是3
#   ...
# }
```

### 2. 验证Groq similarity防护

```bash
# 运行pipeline（使用Groq provider）
# 检查日志，应该看到：
# [promptly] ⚠️ Token Hardening: Similarity check disabled for Groq (returns 0). minSimilarity=0.75, maxRetries=2 - retry gate will be skipped.
# 验证generation阶段无重试（日志中无"retrying"消息）
```

### 3. 验证Spec裁剪

```bash
# 设置环境变量
export SCORING_SPEC_MINIFY=true

# 运行pipeline
# 检查日志，应该看到：
# [pipeline] [runId] Scoring spec minified: 1234 -> 456 chars
# 验证scoring阶段的user prompt，spec JSON应该被裁剪
```

### 4. 验证Metrics汇总

```bash
# 运行pipeline后，检查日志末尾，应该看到完整的metrics汇总：
# [pipeline] [runId] 🔍 Token Hardening Metrics Summary: {
#   "calls_total": {
#     "spec_builder": 1,
#     "question_engine": 2,
#     "generation": 3,
#     "scoring": 3,
#     "outcome_runner": 0
#   },
#   "qe_rounds": 2,
#   "tokens_estimated": {
#     "input": 12000,
#     "output": 2000,
#     "total": 14000
#   },
#   ...
# }
```

---

## 🔄 回滚策略

### 完全回滚（恢复旧行为）

```bash
# .env 或环境变量
QE_STRICT_MAX_ROUNDS=false  # 禁用QE严格轮数限制
SCORING_SPEC_MINIFY=false   # 禁用spec裁剪
```

### 部分回滚

```bash
# 只禁用spec裁剪，保留QE修复
QE_STRICT_MAX_ROUNDS=true
SCORING_SPEC_MINIFY=false
```

---

## 📝 关键日志样例

### QE循环修复日志
```
[pipeline] [run_abc123] QE Loop: max_rounds=2 (from policy: 2, feature flag: true)
[pipeline] [run_abc123] Stage 2: Q1 generated, shouldStop: false
[pipeline] [run_abc123] Stage 2: Q2 generated, shouldStop: false
[pipeline] [run_abc123] 🔍 Token Hardening Metrics Summary: {
  "qe_rounds": 2,  // ✅ 确认是2轮
  ...
}
```

### Groq similarity防护日志
```
[promptly] 🚀 Starting Groq call - Model: llama-3.1-8b-instant (Text Mode)
[promptly] ⚠️ Token Hardening: Similarity check disabled for Groq (returns 0). minSimilarity=0.75, maxRetries=2 - retry gate will be skipped.
[promptly] ✅ Groq call succeeded - Duration: 1234ms, Response: 567 chars, Tokens: 234
```

### Spec裁剪日志
```
[pipeline] [run_abc123] Scoring spec minified: 1234 -> 456 chars
[pipeline] [run_abc123] 🔍 Token Hardening Metrics Summary: {
  "feature_flags": {
    "SCORING_SPEC_MINIFY": true
  },
  ...
}
```

---

## ⚠️ 风险点

1. **Spec裁剪可能影响评分质量**: 
   - 缓解: 使用feature flag控制，默认关闭，需要手动开启
   - 回滚: 设置`SCORING_SPEC_MINIFY=false`

2. **QE严格max_rounds可能导致某些场景下spec不够完整**:
   - 缓解: Standard模式2轮通常足够，Premium模式保持3轮
   - 回滚: 设置`QE_STRICT_MAX_ROUNDS=false`

---

## ✅ 完成状态

- ✅ Phase 1: Safe Changes（全部完成）
- ✅ Phase 2: Feature Flag + Scoring优化（全部完成）
- ✅ 所有改动都使用feature flag控制，可随时回滚
- ✅ 添加完整的metrics追踪和日志
- ✅ 无linter错误

**下一步**: 部署到dev环境，开启`SCORING_SPEC_MINIFY=true`进行小流量测试，验证评分质量不受影响。

