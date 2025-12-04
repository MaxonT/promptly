/**
 * Metrics Engine Test Suite
 * 
 * Tests for all metric calculations in metricsEngine.js:
 * - computeAccuracy: correct / total
 * - computePrecision: TP / (TP + FP)
 * - computeRecall: TP / (TP + FN)
 * - computeF1: 2 × (P × R) / (P + R)
 * - computePassRate: passed / total
 * - computeTokenCost: prompt_tokens + completion_tokens
 * - computeProgress: weighted average of normalized metrics
 * 
 * Run with: node src/lib/__tests__/metricsEngine.test.js
 */

import {
  computeAccuracy,
  computePrecision,
  computeRecall,
  computeF1,
  computePassRate,
  computeTokenCost,
  computeProgress,
  buildEvaluationMetrics,
  buildRunMetrics,
  buildOutcomeMetrics
} from '../metricsEngine.js';

// Simple test framework
let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    testsPassed++;
    console.log(`  ✅ ${message}`);
  } else {
    testsFailed++;
    console.log(`  ❌ ${message}`);
  }
}

function assertClose(actual, expected, tolerance, message) {
  const diff = Math.abs(actual - expected);
  if (diff <= tolerance) {
    testsPassed++;
    console.log(`  ✅ ${message} (${actual} ≈ ${expected})`);
  } else {
    testsFailed++;
    console.log(`  ❌ ${message} (got ${actual}, expected ${expected}, diff ${diff})`);
  }
}

function assertNull(value, message) {
  if (value === null) {
    testsPassed++;
    console.log(`  ✅ ${message} (null)`);
  } else {
    testsFailed++;
    console.log(`  ❌ ${message} (got ${value}, expected null)`);
  }
}

function describe(suiteName, fn) {
  console.log(`\n📋 ${suiteName}`);
  fn();
}

// ============================================
// TEST SUITE
// ============================================

describe('computeAccuracy', () => {
  // Formula: correct / total
  
  // Normal cases
  assert(
    computeAccuracy({ correct_count: 8, total_cases: 10 }) === 0.8,
    'Returns 0.8 for 8/10 correct'
  );
  
  assert(
    computeAccuracy({ correct_count: 10, total_cases: 10 }) === 1.0,
    'Returns 1.0 for 10/10 correct (perfect)'
  );
  
  assert(
    computeAccuracy({ correct_count: 0, total_cases: 10 }) === 0,
    'Returns 0 for 0/10 correct'
  );
  
  // Edge cases
  assertNull(
    computeAccuracy({ correct_count: 5, total_cases: 0 }),
    'Returns null when total_cases is 0 (division by zero)'
  );
  
  assertNull(
    computeAccuracy(null),
    'Returns null for null input'
  );
  
  assertNull(
    computeAccuracy(undefined),
    'Returns null for undefined input'
  );
  
  assertNull(
    computeAccuracy({}),
    'Returns null for empty object'
  );
});

describe('computePrecision', () => {
  // Formula: TP / (TP + FP)
  
  assert(
    computePrecision({ tp: 8, fp: 2 }) === 0.8,
    'Returns 0.8 for TP=8, FP=2'
  );
  
  assert(
    computePrecision({ tp: 10, fp: 0 }) === 1.0,
    'Returns 1.0 for perfect precision (no FP)'
  );
  
  assertNull(
    computePrecision({ tp: 0, fp: 0 }),
    'Returns null when both TP and FP are 0 (division by zero)'
  );
  
  assertNull(
    computePrecision(null),
    'Returns null for null input'
  );
});

describe('computeRecall', () => {
  // Formula: TP / (TP + FN)
  
  assert(
    computeRecall({ tp: 8, fn: 2 }) === 0.8,
    'Returns 0.8 for TP=8, FN=2'
  );
  
  assert(
    computeRecall({ tp: 10, fn: 0 }) === 1.0,
    'Returns 1.0 for perfect recall (no FN)'
  );
  
  assertNull(
    computeRecall({ tp: 0, fn: 0 }),
    'Returns null when both TP and FN are 0 (division by zero)'
  );
  
  assertNull(
    computeRecall(null),
    'Returns null for null input'
  );
});

describe('computeF1', () => {
  // Formula: 2 × (P × R) / (P + R)
  
  // With precision and recall provided
  assertClose(
    computeF1({ precision: 0.8, recall: 0.8 }),
    0.8,
    0.001,
    'Returns 0.8 when P=R=0.8'
  );
  
  assertClose(
    computeF1({ precision: 1.0, recall: 1.0 }),
    1.0,
    0.001,
    'Returns 1.0 when P=R=1.0 (perfect)'
  );
  
  assertClose(
    computeF1({ precision: 0.9, recall: 0.6 }),
    0.72,
    0.001,
    'Returns 0.72 for P=0.9, R=0.6'
  );
  
  // With testStats only (calculates precision/recall internally)
  assertClose(
    computeF1({ testStats: { tp: 8, fp: 2, fn: 2 } }),
    0.8,
    0.001,
    'Calculates F1=0.8 from testStats (TP=8, FP=2, FN=2)'
  );
  
  // Edge cases
  assertNull(
    computeF1({ precision: 0, recall: 0 }),
    'Returns null when P=R=0 (division by zero)'
  );
  
  assertNull(
    computeF1({ precision: null, recall: null }),
    'Returns null when both P and R are null'
  );
});

describe('computePassRate', () => {
  // Formula: passed / total
  
  assert(
    computePassRate({ passed_constraints: 9, total_constraints: 10 }) === 0.9,
    'Returns 0.9 for 9/10 passed constraints'
  );
  
  assert(
    computePassRate({ passed_cases: 9, total_cases: 10 }) === 0.9,
    'Returns 0.9 for 9/10 passed cases (alternative field names)'
  );
  
  assert(
    computePassRate({ passed_constraints: 10, total_constraints: 10 }) === 1.0,
    'Returns 1.0 for perfect pass rate'
  );
  
  assertNull(
    computePassRate({ passed_constraints: 5, total_constraints: 0 }),
    'Returns null when total is 0 (division by zero)'
  );
  
  assertNull(
    computePassRate(null),
    'Returns null for null input'
  );
});

describe('computeTokenCost', () => {
  // Formula: prompt_tokens + completion_tokens (or total_tokens)
  
  assert(
    computeTokenCost({ prompt_tokens: 100, completion_tokens: 200 }) === 300,
    'Returns 300 for 100 + 200 tokens'
  );
  
  assert(
    computeTokenCost({ total_tokens: 500 }) === 500,
    'Returns 500 when total_tokens is provided directly'
  );
  
  assert(
    computeTokenCost({ promptTokens: 100, completionTokens: 200 }) === 300,
    'Handles camelCase field names'
  );
  
  assertNull(
    computeTokenCost(null),
    'Returns null for null input'
  );
  
  assertNull(
    computeTokenCost({}),
    'Returns null for empty object with no tokens'
  );
});

describe('computeProgress', () => {
  // Formula: avg(acc/target, f1/target, pass/target, idealCost/cost) × 100
  
  // Perfect scores should give 100%
  assertClose(
    computeProgress({
      accuracy: 1.0,
      f1: 1.0,
      passRate: 1.0,
      tokenCost: 512,
      targets: { accuracy: 1, f1: 1, passRate: 1, idealTokenCost: 512 }
    }),
    100,
    0.1,
    'Returns 100% for perfect scores'
  );
  
  // 80% across all metrics
  assertClose(
    computeProgress({
      accuracy: 0.8,
      f1: 0.8,
      passRate: 0.8,
      tokenCost: 640, // 512/640 = 0.8
      targets: { accuracy: 1, f1: 1, passRate: 1, idealTokenCost: 512 }
    }),
    80,
    1,
    'Returns ~80% for 80% across all metrics'
  );
  
  // With missing metrics (should average only available ones)
  const partialProgress = computeProgress({
    accuracy: 0.8,
    f1: null,
    passRate: 0.8,
    tokenCost: null
  });
  assertClose(
    partialProgress,
    80,
    1,
    'Averages only available metrics when some are null'
  );
  
  // All null returns null
  assertNull(
    computeProgress({
      accuracy: null,
      f1: null,
      passRate: null,
      tokenCost: null
    }),
    'Returns null when all metrics are null'
  );
});

describe('buildEvaluationMetrics', () => {
  const testStats = {
    correct_count: 8,
    total_cases: 10,
    tp: 7,
    fp: 1,
    fn: 2,
    passed_constraints: 9,
    total_constraints: 10
  };
  
  const usage = {
    prompt_tokens: 100,
    completion_tokens: 200
  };
  
  const metrics = buildEvaluationMetrics({ testStats, usage });
  
  assertClose(metrics.accuracy, 0.8, 0.001, 'Calculates accuracy correctly');
  assertClose(metrics.precision, 0.875, 0.001, 'Calculates precision correctly');
  assertClose(metrics.recall, 0.778, 0.01, 'Calculates recall correctly');
  assert(metrics.f1 !== null, 'Calculates F1 score');
  assertClose(metrics.passRate, 0.9, 0.001, 'Calculates pass rate correctly');
  assert(metrics.tokenCost === 300, 'Calculates token cost correctly');
  assert(metrics.progress !== null, 'Calculates progress');
  assert(metrics.testStats === testStats, 'Includes original testStats');
  assert(metrics.tokenUsage === usage, 'Includes original usage');
});

describe('buildRunMetrics', () => {
  const usage = { prompt_tokens: 100, completion_tokens: 50 };
  const modeProfile = { id: 'deep', chainLength: 4, maxSteps: 6 };
  
  const metrics = buildRunMetrics({ latencyMs: 1500, usage, modeProfile });
  
  assert(metrics.latencyMs === 1500, 'Includes latencyMs');
  assert(metrics.tokensIn === 100, 'Extracts prompt tokens');
  assert(metrics.tokensOut === 50, 'Extracts completion tokens');
  assertClose(metrics.tokenEfficiency, 0.5, 0.001, 'Calculates token efficiency');
  assert(metrics.mode === 'deep', 'Includes mode from profile');
  assert(metrics.chainLength === 4, 'Includes chainLength from profile');
  assert(metrics.maxSteps === 6, 'Includes maxSteps from profile');
});

describe('buildOutcomeMetrics', () => {
  const metrics = [
    { name: 'clarity', score: 8, passed: true },
    { name: 'accuracy', score: 7, passed: true },
    { name: 'tone', score: 6, passed: false }
  ];
  
  const outcome = buildOutcomeMetrics({ outcomeScore: 7.5, metrics });
  
  assertClose(outcome.overallScore, 0.75, 0.001, 'Normalizes overall score to 0-1');
  assertClose(outcome.averageMetricScore, 7, 0.001, 'Calculates average metric score');
  assertClose(outcome.successProbability, 0.667, 0.01, 'Calculates success probability (2/3 passed)');
  assertClose(outcome.riskScore, 0.333, 0.01, 'Calculates risk score (1 - success probability)');
  assert(outcome.metrics === metrics, 'Includes original metrics array');
});

// ============================================
// SUMMARY
// ============================================

console.log('\n' + '='.repeat(50));
console.log(`📊 Test Results: ${testsPassed} passed, ${testsFailed} failed`);
console.log('='.repeat(50));

if (testsFailed > 0) {
  process.exit(1);
} else {
  console.log('\n✅ All metrics engine tests passed!\n');
  process.exit(0);
}
