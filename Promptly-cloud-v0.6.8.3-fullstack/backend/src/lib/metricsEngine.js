/**
 * ATTACHMENT FEATURE: Metrics engine for Accuracy/F1/PassRate/Token Cost/Progress
 *
 * This module encodes the formulas described in Promptly_Metrics_Internal_Design_v1.0.
 * Each function returns `null` when not enough data is available so downstream logic
 * can handle missing signals gracefully.
 */

const DEFAULT_TARGETS = {
  accuracy: 1,
  f1: 1,
  passRate: 1,
  idealTokenCost: 512 // baseline token budget when none provided
};

function isNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function safeDivide(numerator, denominator) {
  if (!isNumber(numerator) || !isNumber(denominator) || denominator === 0) {
    return null;
  }
  return numerator / denominator;
}

export function computeAccuracy(testStats) {
  if (!testStats) return null;
  return safeDivide(testStats.correct_count, testStats.total_cases);
}

export function computePrecision(testStats) {
  if (!testStats) return null;
  return safeDivide(testStats.tp, (testStats.tp ?? 0) + (testStats.fp ?? 0));
}

export function computeRecall(testStats) {
  if (!testStats) return null;
  return safeDivide(testStats.tp, (testStats.tp ?? 0) + (testStats.fn ?? 0));
}

export function computeF1({ precision, recall, testStats }) {
  const p = isNumber(precision) ? precision : computePrecision(testStats);
  const r = isNumber(recall) ? recall : computeRecall(testStats);
  if (!isNumber(p) || !isNumber(r) || (p + r) === 0) {
    return null;
  }
  return (2 * p * r) / (p + r);
}

export function computePassRate(testStats) {
  if (!testStats) return null;
  return safeDivide(testStats.passed_constraints ?? testStats.passed_cases, testStats.total_constraints ?? testStats.total_cases);
}

export function computeTokenCost(usage) {
  if (!usage) return null;
  const promptTokens = usage.prompt_tokens ?? usage.promptTokens ?? 0;
  const completionTokens = usage.completion_tokens ?? usage.completionTokens ?? 0;
  if (!promptTokens && !completionTokens && !usage.total_tokens) {
    return null;
  }
  if (isNumber(usage.total_tokens)) {
    return usage.total_tokens;
  }
  return (promptTokens || 0) + (completionTokens || 0);
}

export function computeProgress({ accuracy, f1, passRate, tokenCost, targets = {} }) {
  const mergedTargets = { ...DEFAULT_TARGETS, ...(targets || {}) };
  const accuracyFactor = isNumber(accuracy) ? accuracy / mergedTargets.accuracy : null;
  const f1Factor = isNumber(f1) ? f1 / mergedTargets.f1 : null;
  const passRateFactor = isNumber(passRate) ? passRate / mergedTargets.passRate : null;
  const tokenFactor = isNumber(tokenCost)
    ? Math.min(1, mergedTargets.idealTokenCost / tokenCost)
    : null;

  const factors = [accuracyFactor, f1Factor, passRateFactor, tokenFactor].filter(isNumber);
  if (!factors.length) return null;
  const rawProgress = factors.reduce((sum, val) => sum + val, 0) / factors.length;
  return Math.max(0, Math.min(100, rawProgress * 100));
}

export function buildEvaluationMetrics({ testStats = null, usage = null, targets = null }) {
  const accuracy = computeAccuracy(testStats);
  const precision = computePrecision(testStats);
  const recall = computeRecall(testStats);
  const f1 = computeF1({ precision, recall, testStats });
  const passRate = computePassRate(testStats);
  const tokenCost = computeTokenCost(usage);
  const progress = computeProgress({ accuracy, f1, passRate, tokenCost, targets });

  return {
    accuracy,
    precision,
    recall,
    f1,
    passRate,
    tokenCost,
    progress,
    testStats,
    tokenUsage: usage
  };
}

export function buildRunMetrics({ latencyMs = null, usage = null }) {
  const tokensIn = usage?.prompt_tokens ?? usage?.promptTokens ?? null;
  const tokensOut = usage?.completion_tokens ?? usage?.completionTokens ?? null;
  const tokenEfficiency = tokensIn && tokensOut ? tokensOut / tokensIn : null;
  return {
    latencyMs,
    tokensIn,
    tokensOut,
    tokenEfficiency
  };
}

export function buildOutcomeMetrics({ outcomeScore = null, metrics = [] }) {
  const normalizedScore = isNumber(outcomeScore) ? Math.min(1, outcomeScore / 10) : null;
  const scoredMetrics = metrics.filter(m => isNumber(m.score));
  const averageScore =
    scoredMetrics.length
      ? scoredMetrics.reduce((sum, m) => sum + m.score, 0) / scoredMetrics.length
      : null;
  const passed = metrics.filter(m => m.passed === true).length;
  const successProbability = metrics.length ? passed / metrics.length : null;
  const riskScore =
    isNumber(successProbability) ? Math.max(0, 1 - successProbability) : null;

  return {
    overallScore: normalizedScore,
    averageMetricScore: averageScore,
    successProbability,
    riskScore,
    metrics
  };
}


