# Metrics Design Documentation

**Version:** v0.6.8.3  
**Last Updated:** 2025-12-04

---

## Overview

The Promptly Metrics Engine provides standardized calculations for evaluating prompt optimization performance. All metrics are computed in `backend/src/lib/metricsEngine.js`.

---

## Core Metrics

### Accuracy

**Formula:** `correct_count / total_cases`

Measures the proportion of correct predictions.

```javascript
computeAccuracy({ correct_count: 8, total_cases: 10 }) // → 0.8
```

| Input | Output |
|-------|--------|
| 8/10 correct | 0.8 (80%) |
| 10/10 correct | 1.0 (100%) |
| 0/10 correct | 0.0 (0%) |
| Division by zero | null |

### Precision

**Formula:** `TP / (TP + FP)`

Measures the proportion of true positives among all positive predictions.

```javascript
computePrecision({ tp: 8, fp: 2 }) // → 0.8
```

| TP | FP | Output |
|----|-----|--------|
| 8 | 2 | 0.8 |
| 10 | 0 | 1.0 |
| 0 | 0 | null |

### Recall

**Formula:** `TP / (TP + FN)`

Measures the proportion of actual positives that were correctly identified.

```javascript
computeRecall({ tp: 8, fn: 2 }) // → 0.8
```

| TP | FN | Output |
|----|----|--------|
| 8 | 2 | 0.8 |
| 10 | 0 | 1.0 |
| 0 | 0 | null |

### F1 Score

**Formula:** `2 × (Precision × Recall) / (Precision + Recall)`

Harmonic mean of precision and recall. Balances both metrics.

```javascript
computeF1({ precision: 0.9, recall: 0.6 }) // → 0.72
computeF1({ testStats: { tp: 8, fp: 2, fn: 2 } }) // → 0.8
```

| Precision | Recall | F1 |
|-----------|--------|-----|
| 0.8 | 0.8 | 0.8 |
| 0.9 | 0.6 | 0.72 |
| 1.0 | 1.0 | 1.0 |
| 0.0 | 0.0 | null |

### Pass Rate

**Formula:** `passed_constraints / total_constraints` (or `passed_cases / total_cases`)

Measures the proportion of test cases or constraints that passed.

```javascript
computePassRate({ passed_constraints: 9, total_constraints: 10 }) // → 0.9
```

### Token Cost

**Formula:** `prompt_tokens + completion_tokens` (or `total_tokens`)

Total tokens consumed by the LLM call.

```javascript
computeTokenCost({ prompt_tokens: 100, completion_tokens: 200 }) // → 300
computeTokenCost({ total_tokens: 500 }) // → 500
```

Supports both snake_case and camelCase field names.

### Progress

**Formula:** `avg(accuracy/target, f1/target, passRate/target, idealCost/cost) × 100`

Weighted average progress toward optimization targets.

```javascript
computeProgress({
  accuracy: 0.8,
  f1: 0.8,
  passRate: 0.8,
  tokenCost: 640,
  targets: {
    accuracy: 1.0,
    f1: 1.0,
    passRate: 1.0,
    idealTokenCost: 512
  }
}) // → 80%
```

**Behavior:**
- Only averages metrics that have values (skips nulls)
- Returns 0-100 scale
- Token factor: `min(1, idealCost / actualCost)`

---

## Default Targets

```javascript
const DEFAULT_TARGETS = {
  accuracy: 1,      // 100% accuracy
  f1: 1,            // Perfect F1
  passRate: 1,      // 100% pass rate
  idealTokenCost: 512  // Baseline token budget
};
```

---

## Composite Metrics

### buildEvaluationMetrics

Computes all evaluation metrics from test stats and token usage.

```javascript
const metrics = buildEvaluationMetrics({
  testStats: {
    correct_count: 8,
    total_cases: 10,
    tp: 7,
    fp: 1,
    fn: 2,
    passed_constraints: 9,
    total_constraints: 10
  },
  usage: {
    prompt_tokens: 100,
    completion_tokens: 200
  },
  targets: { ... }
});
```

Returns:
```javascript
{
  accuracy: 0.8,
  precision: 0.875,
  recall: 0.778,
  f1: 0.824,
  passRate: 0.9,
  tokenCost: 300,
  progress: 78.5,
  testStats: {...},
  tokenUsage: {...}
}
```

### buildRunMetrics

Computes metrics for a single LLM run.

```javascript
const metrics = buildRunMetrics({
  latencyMs: 1500,
  usage: { prompt_tokens: 100, completion_tokens: 50 },
  modeProfile: { id: 'deep', chainLength: 4, maxSteps: 6 }
});
```

Returns:
```javascript
{
  latencyMs: 1500,
  tokensIn: 100,
  tokensOut: 50,
  tokenEfficiency: 0.5,
  mode: 'deep',
  chainLength: 4,
  maxSteps: 6
}
```

### buildOutcomeMetrics

Computes metrics from outcome evaluation results.

```javascript
const metrics = buildOutcomeMetrics({
  outcomeScore: 7.5,
  metrics: [
    { name: 'clarity', score: 8, passed: true },
    { name: 'accuracy', score: 7, passed: true },
    { name: 'tone', score: 6, passed: false }
  ]
});
```

Returns:
```javascript
{
  overallScore: 0.75,        // Normalized 0-1
  averageMetricScore: 7,     // Mean of individual scores
  successProbability: 0.667, // Proportion passed
  riskScore: 0.333,          // 1 - successProbability
  metrics: [...]
}
```

---

## Edge Case Handling

All metric functions handle edge cases gracefully:

| Condition | Result |
|-----------|--------|
| Null input | Returns `null` |
| Undefined input | Returns `null` |
| Empty object | Returns `null` |
| Division by zero | Returns `null` |
| Missing fields | Returns `null` |
| Partial data | Computes with available data |

This allows downstream code to handle missing signals gracefully.

---

## Frontend Display

Metrics are displayed in the dashboard:

| Element ID | Metric | Format |
|------------|--------|--------|
| `#valAcc` | Accuracy | Percentage |
| `#valF1` | F1 Score | Decimal (2 places) |
| `#valPass` | Pass Rate | Percentage |
| `#valCost` | Token Cost | Number (formatted) |
| `#valProg` | Progress | Percentage |

```javascript
function renderMetrics(metrics) {
  valAcc.textContent = formatPercent(metrics.accuracy);
  valF1.textContent = metrics.f1?.toFixed(2) || "—";
  valPass.textContent = formatPercent(metrics.pass_rate);
  valCost.textContent = formatNumber(metrics.token_cost);
  valProg.textContent = formatPercent(metrics.progress_pct / 100);
}
```

---

## Visualization

### Charts

Metrics are visualized in four charts:

1. **Line Chart (`#lineGrowth`)**: Progress over iterations
2. **Bar Chart (`#barContrib`)**: Change contribution
3. **Pie Chart (`#piePass`)**: Pass vs Fail distribution
4. **Gauge (`#gaugeProg`)**: Overall progress meter

### Color Coding

```css
--ok: #22c55e   /* Green - Pass/Success */
--err: #ef4444  /* Red - Fail/Error */
--accent: #06b6d4  /* Cyan - Progress/Active */
```

---

## Testing

Run metric tests:
```bash
cd backend
node src/lib/__tests__/metricsEngine.test.js
```

Test coverage:
- 56 tests covering all formulas
- Edge cases (zeros, nulls, empty data)
- Composite metric functions
- Input normalization

---

## API Response Format

Metrics in API responses:

```json
{
  "result": {
    "metrics": {
      "accuracy": 0.85,
      "precision": 0.9,
      "recall": 0.8,
      "f1": 0.847,
      "passRate": 0.92,
      "tokenCost": 450,
      "progress": 84.5
    }
  }
}
```

---

## Performance Considerations

- All calculations are O(1) or O(n) where n is number of metrics
- No external dependencies for calculations
- Safe division helpers prevent errors
- Null propagation prevents cascading failures
