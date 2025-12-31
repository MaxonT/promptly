# Outcome Runner 快速参考

## 📦 核心函数

### `runOutcomeCheck`

```javascript
import { runOutcomeCheck } from './backend/src/lib/outcomeRunner.js';

const result = await runOutcomeCheck({
  runId: 'run_abc123',           // 必需
  outcomeSpecId: 'spec_xyz789',  // 必需
  modelOverride: 'gpt-4-turbo'   // 可选
});
```

---

## 🔄 工作流程

```
1. Load run (runs 表)
   ↓
2. Load spec (specs 表，作为评估标准)
   ↓
3. Build LLM prompt
   ↓
4. Call LLM Outcome Judge
   ↓
5. Parse JSON with Zod
   ↓
6. Insert outcome_runs
   ↓
7. Insert outcome_candidates (metrics)
   ↓
8. Return result
```

---

## 📊 输入输出

### 输入
```javascript
{
  runId: "run_xxx",           // 从 runs 表
  outcomeSpecId: "spec_xxx",  // 从 specs 表
  modelOverride: "gpt-4"      // 可选
}
```

### 输出（成功）
```javascript
{
  ok: true,
  outcomeRun: {
    id: "outcome_run_xxx",
    runId: "run_xxx",
    outcomeSpecId: "spec_xxx",
    status: "success",
    score: 8.5,               // 0-10
    verdict: "pass",          // pass | fail | needs_work
    summary: "...",
    createdAt: "2025-11-27T..."
  },
  metrics: [
    {
      id: "cand_xxx",
      name: "accuracy",
      score: 9.0,
      passed: true,
      details: "..."
    }
  ]
}
```

### 输出（失败）
```javascript
{
  ok: false,
  error: {
    message: "...",
    code: "LLM_DISABLED"  // 可选
  }
}
```

---

## 🗄️ 数据库写入

### outcome_runs 表
```sql
INSERT INTO outcome_runs (
  id,                -- outcome_run_xxx
  spec_id,           -- outcomeSpecId
  run_id,            -- runId
  task,              -- spec.title
  status,            -- "success"
  model,             -- LLM model
  request_json,      -- 完整请求
  result_json,       -- 完整结果
  created_at,        -- ISO timestamp
  ...
)
```

### outcome_candidates 表
```sql
-- 为每个 metric 创建记录
INSERT INTO outcome_candidates (
  id,                -- cand_xxx
  outcome_run_id,    -- outcome_run_xxx
  candidate_index,   -- 0, 1, 2, ...
  content,           -- metric.name
  llm_score,         -- metric.score
  final_score,       -- metric.score
  tests_passed,      -- 1 or 0
  tests_json,        -- JSON.stringify(metric)
  created_at         -- ISO timestamp
)
```

---

## 🤖 LLM 提示结构

### System
```
You are the Outcome Judge agent...
Return JSON with:
- score (0-10)
- verdict ("pass" | "fail" | "needs_work")
- summary (string)
- metrics (array, optional)
```

### User
```json
{
  "run": {
    "id": "run_xxx",
    "input": {...},
    "output": {...}
  },
  "outcome_criteria": {
    "spec": {...}
  }
}
```

### LLM 响应
```json
{
  "score": 8.5,
  "verdict": "pass",
  "summary": "...",
  "metrics": [
    {
      "name": "accuracy",
      "score": 9.0,
      "passed": true,
      "details": "..."
    }
  ]
}
```

---

## 🔍 错误代码

| 错误 | 原因 | 处理 |
|------|------|------|
| Run not found | runId 不存在 | 检查 runId |
| Outcome spec not found | outcomeSpecId 不存在 | 检查 specId |
| Failed to parse spec JSON | spec_json 格式错误 | 检查数据库 |
| LLM_DISABLED | OPENAI_API_KEY 未设置 | 设置环境变量 |
| Outcome check failed | LLM 调用失败 | 检查网络/配额 |
| Failed to insert | 数据库错误 | 检查 schema |

---

## 🧪 测试

### 单元测试（示例）
```javascript
// 测试成功场景
const result = await runOutcomeCheck({
  runId: 'test_run_1',
  outcomeSpecId: 'test_spec_1'
});
expect(result.ok).toBe(true);
expect(result.outcomeRun.verdict).toBe('pass');

// 测试失败场景：run 不存在
const result2 = await runOutcomeCheck({
  runId: 'nonexistent',
  outcomeSpecId: 'test_spec_1'
});
expect(result2.ok).toBe(false);
expect(result2.error.message).toContain('Run not found');
```

---

## 🔗 相关文件

- `backend/src/lib/outcomeRunner.js` - 核心实现
- `OUTCOME_DB_SCHEMA.md` - 数据库 schema
- `O1_OUTCOME_RUNNER_SUMMARY.md` - 详细总结

---

## 🚀 使用示例

### 在路由中使用（后续）
```javascript
// backend/src/routes/outcome.js
import { runOutcomeCheck } from '../lib/outcomeRunner.js';

router.post('/api/outcome-checks', async (req, res) => {
  const { runId, outcomeSpecId, model } = req.body;
  
  const result = await runOutcomeCheck({
    runId,
    outcomeSpecId,
    modelOverride: model
  });
  
  return res.json(result);
});
```

### 在脚本中使用
```javascript
import { runOutcomeCheck } from './backend/src/lib/outcomeRunner.js';

// 评估一个运行结果
const result = await runOutcomeCheck({
  runId: 'run_abc123',
  outcomeSpecId: 'spec_xyz789'
});

if (result.ok) {
  console.log(`✅ Verdict: ${result.outcomeRun.verdict}`);
  console.log(`📊 Score: ${result.outcomeRun.score}/10`);
  console.log(`📝 Summary: ${result.outcomeRun.summary}`);
  
  if (result.metrics?.length > 0) {
    console.log('\n📈 Metrics:');
    result.metrics.forEach(m => {
      console.log(`  - ${m.name}: ${m.score}/10 (${m.passed ? '✅' : '❌'})`);
    });
  }
} else {
  console.error(`❌ Error: ${result.error.message}`);
}
```

---

**快速参考完成！** 🚀
