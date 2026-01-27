# Token Hardening Changelog

## 实施完成 ✅

根据Tiger的6项决策，已完成所有Token Hardening改动。

---

## 修改文件清单

### 1. `backend/src/lib/modePolicies.js`
- **改动**: Premium模式添加`max_rounds: 3`配置（之前硬编码）
- **影响**: 配置化，不再硬编码

### 2. `backend/src/routes/pipeline.js`
- **改动**: 
  1. 添加`pipelineMetrics`追踪对象
  2. 修正QE循环，使用`policy.questionEngine.max_rounds`而非硬编码3
  3. 添加Feature Flag支持（`QE_STRICT_MAX_ROUNDS`）
  4. 实现Scoring Spec裁剪（`SCORING_SPEC_MINIFY` feature flag控制）
  5. 在pipeline结束时输出完整的metrics汇总日志
- **影响**: QE循环修复、token节省、可观测性增强

### 3. `backend/src/lib/groqClient.js`
- **改动**: 添加Groq similarity=0的明确日志和文档
- **影响**: 代码更清晰，避免未来误用

### 4. `backend/src/lib/llmRouter.js`
- **改动**: 添加注释说明Groq的similarity保护机制
- **影响**: 文档化

---

## 环境变量（Feature Flags）

### `QE_STRICT_MAX_ROUNDS`
- **默认值**: `true`（如果未设置，则使用policy配置）
- **作用**: 控制QE循环是否使用policy配置的`max_rounds`
- **回滚**: 设置`QE_STRICT_MAX_ROUNDS=false`恢复旧行为（硬编码3轮）

### `SCORING_SPEC_MINIFY`
- **默认值**: `false`（默认关闭，需要手动开启）
- **作用**: 控制scoring阶段是否使用裁剪版spec
- **开启**: 设置`SCORING_SPEC_MINIFY=true`启用spec裁剪

---

## 预期Token节省

### Standard模式（QE修复后）

**修复前**:
- QE: 3轮 × ~800 tokens = 2400 tokens
- Scoring: 3 × 1500 tokens = 4500 tokens
- **总计**: ~15k tokens

**修复后（QE严格2轮）**:
- QE: 2轮 × ~800 tokens = 1600 tokens（**节省800 tokens**）
- Scoring: 3 × 1500 tokens = 4500 tokens
- **总计**: ~14.2k tokens（**节省~800 tokens，约5%**）

**修复后（QE严格2轮 + Spec裁剪）**:
- QE: 2轮 × ~800 tokens = 1600 tokens
- Scoring: 3 × 1200 tokens = 3600 tokens（spec裁剪后，**节省900 tokens**）
- **总计**: ~13.3k tokens（**总共节省~1700 tokens，约11%**）

---

## 验证步骤

### 1. 验证QE循环修复

```bash
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

### 2. 验证Metrics汇总

```bash
# 检查日志末尾，应该看到完整的metrics汇总
# [pipeline] [runId] 🔍 Token Hardening Metrics Summary: {...}
```

### 3. 验证Spec裁剪（可选）

```bash
# 设置环境变量
export SCORING_SPEC_MINIFY=true

# 运行pipeline，检查日志：
# [pipeline] [runId] Scoring spec minified: 1234 -> 456 chars
```

---

## 回滚策略

### 完全回滚（恢复旧行为）

```bash
# .env 或环境变量
QE_STRICT_MAX_ROUNDS=false
SCORING_SPEC_MINIFY=false
```

### 部分回滚

```bash
# 只禁用spec裁剪，保留QE修复
QE_STRICT_MAX_ROUNDS=true
SCORING_SPEC_MINIFY=false
```

---

## 关键日志样例

### QE循环修复
```
[pipeline] [run_abc123] QE Loop: max_rounds=2 (from policy: 2, feature flag: true)
[pipeline] [run_abc123] Stage 2: Q1 generated, shouldStop: false
[pipeline] [run_abc123] Stage 2: Q2 generated, shouldStop: false
[pipeline] [run_abc123] 🔍 Token Hardening Metrics Summary: {
  "qe_rounds": 2,  // ✅ 确认是2轮
  ...
}
```

### Groq similarity防护
```
[promptly] ⚠️ Token Hardening: Similarity check disabled for Groq (returns 0). minSimilarity=0.75, maxRetries=2 - retry gate will be skipped.
```

### Metrics汇总
```
[pipeline] [run_abc123] 🔍 Token Hardening Metrics Summary: {
  "runId": "run_abc123",
  "mode": "standard",
  "calls_total": {
    "spec_builder": 1,
    "question_engine": 2,
    "generation": 3,
    "scoring": 3,
    "outcome_runner": 0
  },
  "qe_rounds": 2,
  "tokens_estimated": {
    "input": 12000,
    "output": 2000,
    "total": 14000
  },
  "feature_flags": {
    "QE_STRICT_MAX_ROUNDS": true,
    "SCORING_SPEC_MINIFY": false
  }
}
```

---

## 下一步

1. ✅ 代码改动完成
2. ⏳ 部署到dev环境
3. ⏳ 开启`SCORING_SPEC_MINIFY=true`进行小流量测试
4. ⏳ 验证评分质量不受影响
5. ⏳ 监控metrics，确认token节省效果

---

## 注意事项

1. **Spec裁剪**: 默认关闭，需要手动开启。开启前建议先验证评分质量不受影响。
2. **QE循环**: 默认使用policy配置（Standard=2, Premium=3），可通过feature flag禁用。
3. **Metrics汇总**: 每次pipeline执行结束时都会输出，可用于监控和分析。


