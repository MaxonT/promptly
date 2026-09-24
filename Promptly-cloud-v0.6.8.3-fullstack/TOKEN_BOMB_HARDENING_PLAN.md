# Promptly Token-Bomb Hardening Plan — Stage 1 (Planning)

**Status**: 📋 Planning Phase — Awaiting Tiger's Confirmation  
**Date**: 2024  
**Goal**: 在不破坏现有功能的前提下，让 3-agent best-of-N 流程更可控、更可观测、更省 token

---

## A) Token Bomb Map（Token 消耗炸弹地图）

### 当前最坏情况 Token 消耗估算

#### Stage 1: Spec Builder
- **LLM 调用次数**: 1次（固定）
- **输入组成**: `idea` (用户输入) + `attachments metadata` + system prompt
- **输出**: structured spec JSON
- **Token 估算**:
  - Input: ~500-2000 tokens（取决于idea长度和附件数量）
  - Output: ~200-500 tokens
  - **小计**: ~700-2500 tokens

#### Stage 2: Question Engine (Q1-Q3)
- **LLM 调用次数**: 
  - Fast模式: 0次（disabled）
  - Standard模式: **配置 max_rounds=2，但代码实际可能跑3次** ❌（需修复）
  - Premium模式: 最多3次
- **输入组成**: 
  - 每次循环: `完整spec JSON` + `累积的Q&A历史`（递增）
  - 第1轮: spec (~500 tokens)
  - 第2轮: spec + Q1 + A1 (~800 tokens)
  - 第3轮: spec + Q1+A1 + Q2+A2 (~1100 tokens)
- **输出**: question JSON
- **Token 估算（最坏情况，Standard模式实际跑3轮）**:
  - Input: 500 + 800 + 1100 = **2400 tokens**
  - Output: 3 × 100 = 300 tokens
  - **小计**: ~2700 tokens ❌

#### Stage 3: Generation (3 Agents)
- **LLM 调用次数**: 
  - 理论: 3 agents × 1次 = 3次
  - 最坏（相似度重试）: 3 agents × (1 + maxRetries=2) = **9次** ⚠️
  - **实际（Groq）**: similarity=0，不会触发重试 → **3次** ✅
- **输入组成**: 
  - 每次: `agent system prompt` + `完整spec JSON` + user prompt
  - 每次 ~1000-2000 tokens（spec + prompts）
- **输出**: candidate prompt text
- **Token 估算**:
  - Input: 3 × 1500 = **4500 tokens**（最坏9000，但Groq不会重试）
  - Output: 3 × 500 = **1500 tokens**
  - **小计**: ~6000 tokens（Groq实际）

#### Stage 4: Scoring (3 Candidates)
- **LLM 调用次数**: 3次（并行执行）
- **输入组成**: 
  - **每次**: `metrics system prompt` + `完整candidate content` + `完整spec JSON` ⚠️
  - 每个candidate: ~500-1000 tokens
  - 每个spec: ~500 tokens
  - **每次调用**: ~1500 tokens
  - **重复传输**: spec JSON被传输3次（浪费）❌
- **输出**: metrics JSON (~100 tokens)
- **Token 估算**:
  - Input: 3 × 1500 = **4500 tokens**（其中spec重复3次=1500浪费）
  - Output: 3 × 100 = **300 tokens**
  - **小计**: ~4800 tokens（其中~1500可优化）

#### Stage 5: Outcome Runner
- **LLM 调用次数**: 0次（已Groq-ified，只做排序）
- **Token**: 0 ✅

---

### 总Token消耗估算公式

```
Total_Tokens = 
  Spec_Builder [700-2500]
  + Question_Engine [0 (fast) | 2400 (standard配置2但实际3) | 2700 (premium)]
  + Generation [6000 (Groq实际) | 18000 (理论最坏，但Groq不会触发)]
  + Scoring [4800 (其中1500可优化)]
  = Fast: ~11.5k tokens
     Standard: ~13.9k tokens（实际，QE跑了3轮）
     Premium: ~15k tokens
```

**最坏情况（如果similarity重试被触发）**: ~28k tokens  
**实际情况（Groq，similarity=0不重试）**: ~12-15k tokens

---

## B) 改动清单

### ✅ Safe Changes（无需Tiger确认，可直接执行）

#### 1. Instrumentation/Observability（可观测性增强）

**改动点**:
- `backend/src/routes/pipeline.js`: 在pipeline执行结束时输出汇总metrics
- 每个LLM call添加tag: `stage`, `agent`, `provider`, `retry_count`

**实现方式**:
```javascript
// 在pipeline结束时输出
const pipelineMetrics = {
  runId,
  mode,
  calls_total: {
    spec_builder: 1,
    question_engine: qeRounds,
    generation: generationCalls,
    scoring: candidateIds.length,
    outcome_runner: 0
  },
  retries_total: retriesCount,
  qe_rounds: qeRounds,
  tokens_estimated: {
    input: totalInputTokens,
    output: totalOutputTokens,
    total: totalInputTokens + totalOutputTokens
  },
  // ... 其他metrics
};
console.log(`[pipeline] [${runId}] Token Metrics Summary:`, JSON.stringify(pipelineMetrics, null, 2));
```

**预期收益**: 可观测，无token节省，但能验证后续优化效果

---

#### 2. 修正QE循环"配置2跑3"的不一致

**问题**: 
- `backend/src/routes/pipeline.js:369`: `while (currentStep < 3 && !shouldStop)`
- `policy.questionEngine.max_rounds = 2`（Standard模式）
- 代码硬编码3，未使用policy配置

**改动**:
```javascript
// 修改前
const maxRounds = policy.questionEngine?.max_rounds ?? 3;
while (currentStep < maxRounds && !shouldStop) {
  // ...
}
```

**预期收益**: 
- Standard模式实际token节省: ~900 tokens（少跑1轮）
- 修复配置与实现不一致

---

#### 3. Groq similarity=0 的防爆保护

**问题**: 
- `backend/src/lib/groqClient.js:142`: 返回 `similarity: 0`（占位符）
- `backend/src/lib/openaiClient.js:319`: 如果similarity < threshold，不会重试
- 但代码逻辑上，如果传入`minSimilarity=0.75, maxRetries=2`，Groq返回0时，0 < 0.75，不会重试 ✅（实际上已经在保护了）

**改动（防御性增强）**:
- 在`chatTextGroq`中添加明确日志：`similarity check disabled for Groq (returns 0)`
- 或者在`llmRouter.js`中，如果provider=groq且similarity=0，明确跳过similarity gate

**预期收益**: 代码更清晰，避免未来误用，无实际token节省（已经不会重试）

---

#### 4. Spec JSON 去重传输的轻量方案（初步优化）

**问题**: 
- `backend/src/routes/pipeline.js:664`: `user: Evaluate this candidate prompt:\n\n${candidate.content}\n\nSpec:\n${JSON.stringify(specData, null, 2)}`
- spec JSON在3次scoring调用中重复传输

**改动（轻量方案，不改变语义）**:
- Option A: 在scoring阶段，对spec做最小化裁剪（仅保留评分必需字段）
  ```javascript
  const scoringSpec = {
    userGoal: specData.userGoal,
    tone: specData.tone,
    format: specData.format
    // 移除: examples, constraints细节（如果评分不需要）
  };
  ```
- Option B: 使用spec的stable hash，在日志中记录，但实际传输仍用完整spec（作为过渡）

**选择**: 先做Option A（裁剪），验证是否影响评分质量

**预期收益**: 
- 假设spec JSON约500 tokens，裁剪后约200 tokens
- 节省: (500-200) × 3 = **900 tokens**

---

### ⚠️ Needs Confirmation（必须Tiger确认后才能执行）

#### 1. 改默认参数（minSimilarity、maxRetries、QE max_rounds）

**选项**:
- `generation.maxRetries`: 从2改为1？（减少重试上限）
- `generation.minSimilarity`: 从0.75改为0.85？（提高阈值，减少重试触发）
- `questionEngine.max_rounds`: Standard模式保持2，但需要Tiger确认是否允许"严格2"（不允许跑3）

**影响**: 可能影响输出质量，需要权衡

---

#### 2. 增加强制Token Budget（硬上限）

**选项**:
- 如果QE输入tokens > 12k，截断Q&A历史（保留最近2轮）
- 如果scoring输入tokens > 8k，使用spec摘要而非全量

**影响**: 可能影响质量，需要Tiger确认是否可接受

---

#### 3. 改Pipeline结构（例如candidate数量）

**选项**: 无（不在本次scope内）

---

#### 4. 引入附件内容解析/摘要

**选项**: 无（不在本次scope内，未来风险）

---

#### 5. Feature Flag（推荐）

**选项**: 
- `TOKEN_HARDENING_ENABLED=true/false`
- `QE_STRICT_MAX_ROUNDS=true`（强制使用policy.max_rounds）
- `SCORING_SPEC_MINIFY=true`（使用裁剪版spec）

**影响**: 无（只是开关，可回滚）

---

## C) 验收标准（Definition of Done）

### 硬性要求

1. ✅ **最坏调用次数被硬上限限制**:
   - Generation: 3 agents × 3 calls = 9 calls（理论），但Groq实际3 calls（similarity=0不重试）
   - QE: Standard模式最多2 calls（修复后），Premium最多3 calls
   - Scoring: 3 calls（固定）

2. ✅ **Groq similarity=0不再触发无意义重试**:
   - 已在保护中（0 < 0.75），但需添加明确日志/文档
   - 添加防护代码，确保similarity=0时跳过gate

3. ✅ **QE循环严格遵守配置max_rounds**:
   - Standard模式配置2，实际最多跑2轮（修复off-by-one）
   - Premium模式配置无明确max_rounds，但循环上限为3（需确认是否改为可配置）

4. ✅ **Scoring输入不再重复传输巨量spec**:
   - 实现spec裁剪（仅保留评分必需字段）
   - 或使用spec摘要/引用（如果验证可行）

5. ✅ **新增Metrics可被打印/记录**:
   - `calls_total`: 各阶段调用次数
   - `retries_total`: 总重试次数
   - `qe_rounds`: QE实际轮数
   - `score_calls`: Scoring调用次数
   - `tokens_estimated`: input/output/total（真实token或估算）

### 验证步骤

1. **运行Standard模式pipeline**:
   ```bash
   # 发送请求，观察日志
   curl -X POST http://localhost:8080/api/pipeline/run \
     -H "Content-Type: application/json" \
     -d '{"idea": "test", "mode": "standard"}'
   ```

2. **检查日志输出**:
   ```
   [pipeline] [runId] Token Metrics Summary: {
     "calls_total": {
       "question_engine": 2,  // ✅ 必须是2，不能是3
       "generation": 3,        // ✅ 必须是3
       "scoring": 3            // ✅ 必须是3
     },
     "qe_rounds": 2,           // ✅ 必须是2
     "tokens_estimated": {
       "input": 12000,
       "output": 2000,
       "total": 14000
     }
   }
   ```

3. **验证Groq similarity保护**:
   - 检查日志中是否有: `[promptly] Similarity check skipped for Groq (returns 0)`
   - 验证generation阶段无重试（日志中无"retrying"消息）

4. **验证Spec裁剪**:
   - 检查scoring阶段的user prompt，spec JSON应该被裁剪（仅保留必需字段）
   - 对比裁剪前后token数量

---

## D) 回滚策略

### Feature Flag方式（推荐）

在`.env`中添加:
```bash
# Token Hardening Features
TOKEN_HARDENING_ENABLED=true
QE_STRICT_MAX_ROUNDS=true
SCORING_SPEC_MINIFY=true
```

代码中:
```javascript
const useStrictQERounds = process.env.QE_STRICT_MAX_ROUNDS === 'true';
const maxRounds = useStrictQERounds 
  ? (policy.questionEngine?.max_rounds ?? 3)
  : 3; // 旧行为
```

**回滚**: 设置 `QE_STRICT_MAX_ROUNDS=false`，立即恢复旧行为

---

## E) 需要Tiger确认的问题（请在计划末尾一次性回答）

### 1. Similarity Gate策略
**问题**: Groq上similarity=0时，选择哪个策略？
- [ ] A. 跳过similarity gate（当前实际行为，但需明确文档化）
- [ ] B. 实现similarity算法（工作量较大，需要额外开发）

**推荐**: A（当前已经不会重试，只需明确文档化）

---

### 2. Generation重试上限
**问题**: `generation.maxRetries`是否从2改为1？
- [ ] A. 保持2（当前值）
- [ ] B. 改为1（减少重试上限，节省token但可能影响质量）

**影响**: 如果改为1，最坏情况从9 calls降为6 calls（但Groq实际不会触发，所以无影响）

**推荐**: A（保持2，因为Groq不会触发，且保留OpenAI路径的灵活性）

---

### 3. QE max_rounds严格性
**问题**: Standard模式的`max_rounds=2`是否必须严格2轮（不允许跑3轮）？
- [ ] A. 是，严格2轮（修复代码bug）
- [ ] B. 保持当前行为（允许跑3轮，但配置显示2）

**推荐**: A（修复bug，配置应该与实现一致）

**额外问题**: Premium模式没有明确`max_rounds`，当前硬编码3。是否改为可配置？
- [ ] A. 保持硬编码3
- [ ] B. 添加`max_rounds: 3`到policy配置

---

### 4. Token Budget硬上限
**问题**: 是否要添加硬token budget cap（例如输入>12k tokens就截断历史）？
- [ ] A. 不添加（保持当前行为）
- [ ] B. 添加（需要定义截断策略）

**推荐**: A（本次不添加，先做其他优化，观察效果后再决定）

---

### 5. Scoring Spec优化策略
**问题**: Scoring阶段是否允许使用spec摘要/裁剪版来替代全量spec？
- [ ] A. 使用裁剪版spec（仅保留评分必需字段，如userGoal、tone、format）
- [ ] B. 保持全量spec（确保评分质量）

**推荐**: A（先实现裁剪版，验证评分质量不受影响）

---

### 6. Feature Flag
**问题**: 是否使用feature flag来控制这些改动？
- [ ] A. 是，使用feature flag（推荐，易于回滚）
- [ ] B. 否，直接改（改动较小，风险低）

**推荐**: A（使用feature flag，安全可控）

---

## F) 实施优先级

### Phase 1（Safe Changes，可立即执行）
1. Instrumentation/Observability
2. 修正QE循环不一致（修复bug）
3. Groq similarity防护（文档化+防御性代码）

### Phase 2（等待Tiger确认后执行）
4. Scoring Spec裁剪优化
5. Feature Flag实现

### Phase 3（未来考虑）
6. Token Budget硬上限（如果Phase 1-2效果不够）

---

## G) 风险点

1. **Spec裁剪可能影响评分质量**: 
   - 缓解: 先做小范围测试，对比裁剪前后评分差异
   - 回滚: feature flag关闭

2. **QE严格max_rounds可能导致某些场景下spec不够完整**:
   - 缓解: Standard模式2轮通常足够，Premium模式保持3轮
   - 回滚: feature flag关闭

3. **Groq similarity=0的防护代码可能影响未来实现相似度检查**:
   - 缓解: 使用feature flag，未来实现similarity时可调整
   - 回滚: feature flag关闭

---

**下一步**: 等待Tiger确认上述6个问题后，开始Phase 1实施。


