/**
 * modelConfig.js — Unified Model Configuration (Pipeline v2.2)
 *
 * Single source of truth for all LLM model selections across the application.
 *
 * Key design decisions:
 *   1. Generation uses Anthropic Claude for maximum quality.
 *   2. Critique & Evaluation use Groq (cross-model, avoids self-evaluation bias).
 *   3. Fast mode skips Critique/Refine for speed.
 *   4. Single fluent candidate — no multi-version generation.
 *   5. Non-pipeline routes share a single default.
 */

// ─── Pipeline Stage Constants ───────────────────────────────────────────────

export const PIPELINE_STAGES = Object.freeze({
  SPEC_BUILDER: "specBuilder",
  GENERATION:   "generation",
  CRITIQUE:     "critique",
  REFINE:       "refine",
  EVALUATION:   "evaluation",
  OUTCOME:      "outcome",
});

// ─── Stage Execution Order ──────────────────────────────────────────────────
// Fast mode skips critique/refine to stay within cost budget.

const STAGE_ORDER = Object.freeze({
  fast:     ["specBuilder", "generation", "evaluation", "outcome"],
  standard: ["specBuilder", "generation", "critique", "refine", "evaluation", "outcome"],
  premium:  ["specBuilder", "generation", "critique", "refine", "evaluation", "outcome"],
});

// ─── Pipeline Configuration ─────────────────────────────────────────────────

export const PIPELINE_CONFIG = Object.freeze({

  // 🟢 FAST — Quick results, lowest cost, skip critique/refine
  //   Uses Groq fast models throughout for speed.
  fast: {
    id: "fast",
    name: "Fast",
    description: "Quick optimization with default assumptions. No clarification, no critique cycle.",
    stages: {
      specBuilder: {
        provider: "groq",
        model: "llama-3.1-8b-instant",
        max_tokens: 600,
      },
      generation: {
        provider: "groq",
        model: "llama-3.1-8b-instant",
        candidates: 1,   // single fluent
        max_tokens: 2000,
      },
      // critique / refine — NOT executed in fast mode
      evaluation: {
        provider: "groq",
        model: "llama-3.1-8b-instant",
        temperature: 0,
        max_tokens: 300,
      },
      outcome: {
        provider: null,
        model: null,       // pure sort, no LLM
      },
    },
  },

  // 🔵 STANDARD — Primary product mode with full critique-refine cycle
  //   Generation & Refine use Claude Haiku 4.5 for quality.
  //   Critique & Evaluation use Groq 70b for fast cross-model judging.
  standard: {
    id: "standard",
    name: "Standard",
    description: "Strong synthesis with Claude generation, critique-refine cycle, and cross-model evaluation.",
    stages: {
      specBuilder: {
        provider: "groq",
        model: "llama-3.3-70b-versatile",
        max_tokens: 600,
      },
      generation: {
        provider: "anthropic",
        model: "claude-haiku-4-5-20251001",
        candidates: 1,
        max_tokens: 2000,
      },
      critique: {
        provider: "groq",
        model: "llama-3.3-70b-versatile",  // Cross-model: different reviewer
        max_tokens: 400,
      },
      refine: {
        provider: "anthropic",
        model: "claude-haiku-4-5-20251001", // Same as generation (refines own work)
        max_tokens: 2000,
      },
      evaluation: {
        provider: "groq",
        model: "llama-3.3-70b-versatile",  // Cross-model: independent judge
        temperature: 0,
        max_tokens: 300,
      },
      outcome: {
        provider: null,
        model: null,
      },
    },
  },

  // 🟣 PREMIUM — Maximum quality, strongest models, full pipeline
  //   Generation & Refine use Claude Haiku 4.5 for top quality.
  //   Spec uses Groq qwen3-32b, Critique/Eval use Groq 70b.
  premium: {
    id: "premium",
    name: "Premium",
    description: "Maximum quality with Claude generation, full critique-refine cycle, and cross-model evaluation.",
    stages: {
      specBuilder: {
        provider: "groq",
        model: "qwen/qwen3-32b",
        max_tokens: 600,
      },
      generation: {
        provider: "anthropic",
        model: "claude-haiku-4-5-20251001",
        candidates: 1,
        max_tokens: 2000,
      },
      critique: {
        provider: "groq",
        model: "llama-3.3-70b-versatile",  // Cross-model: different perspective
        max_tokens: 400,
      },
      refine: {
        provider: "anthropic",
        model: "claude-haiku-4-5-20251001", // Same as generation
        max_tokens: 2000,
      },
      evaluation: {
        provider: "groq",
        model: "llama-3.3-70b-versatile",  // Cross-model: independent judge
        temperature: 0,
        max_tokens: 300,
      },
      outcome: {
        provider: null,
        model: null,
      },
    },
  },
});

// ─── 8-Dimensional Weighted Evaluation ──────────────────────────────────────
// Weights sum to 1.0. Adjustable per product iteration.

export const EVALUATION_WEIGHTS = Object.freeze({
  completeness: 0.20,  // Covers all spec requirements
  clarity:      0.20,  // Clear, unambiguous language
  specificity:  0.15,  // Concrete, not generic
  structure:    0.12,  // Good formatting, sections, hierarchy
  coherence:    0.10,  // Logical flow and internal consistency
  creativity:   0.05,  // Novel framing, smart approaches
  safety:       0.10,  // Safe from misuse, no harmful patterns
  efficiency:   0.08,  // Concise, no redundancy, good token economy
});

// ─── Non-Pipeline Default ───────────────────────────────────────────────────
// Used by enhance.js, specs.js, prompts.js, questionSessions.js, evaluationEngine.js
// Replaces the scattered hardcoded `provider: 'openai'`.

export const NON_PIPELINE_DEFAULT = Object.freeze({
  provider: "groq",
  model: "llama-3.3-70b-versatile",
});

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Get model configuration for a specific pipeline stage.
 *
 * @param {string} mode   – "fast" | "standard" | "premium"
 * @param {string} stage  – One of PIPELINE_STAGES values
 * @returns {{ provider: string|null, model: string|null, [k: string]: any }}
 */
export function getStageModel(mode, stage) {
  const config = PIPELINE_CONFIG[mode] || PIPELINE_CONFIG.fast;
  const stageConfig = config.stages[stage];
  if (!stageConfig) {
    console.warn(
      `[modelConfig] Unknown stage "${stage}" for mode "${mode}". Falling back to specBuilder.`
    );
    return config.stages.specBuilder;
  }
  return stageConfig;
}

/**
 * Get the ordered list of stages that should execute for a given mode.
 *
 * @param {string} mode – "fast" | "standard" | "premium"
 * @returns {string[]}
 */
export function getStageList(mode) {
  return STAGE_ORDER[mode] || STAGE_ORDER.fast;
}

/**
 * Check whether a specific stage should run in the given mode.
 *
 * @param {string} mode  – "fast" | "standard" | "premium"
 * @param {string} stage – Pipeline stage name
 * @returns {boolean}
 */
export function shouldRunStage(mode, stage) {
  return getStageList(mode).includes(stage);
}

/**
 * Compute weighted composite score from an 8-dimension metrics object.
 *
 * @param {{ [dimension: string]: number }} metrics – Values between 0 and 1
 * @returns {number} Weighted composite score (0–1)
 */
export function computeCompositeScore(metrics) {
  let score = 0;
  let weightSum = 0;

  for (const [dim, weight] of Object.entries(EVALUATION_WEIGHTS)) {
    const value = metrics[dim];
    if (typeof value === "number" && !Number.isNaN(value)) {
      score += value * weight;
      weightSum += weight;
    }
  }

  // Normalise in case some dimensions were missing
  return weightSum > 0 ? score / weightSum : 0;
}

// ─── Backward Compatibility ─────────────────────────────────────────────────
// Thin wrapper so unchanged code in pipeline.js can keep using the old
// `getModePolicy(mode)` shape during the incremental migration.
// TODO: Remove after Step 10 completes migration.

export function getModePolicy(modeId) {
  const cfg = PIPELINE_CONFIG[modeId] || PIPELINE_CONFIG.fast;
  const s = cfg.stages;

  return {
    id: cfg.id,
    name: cfg.name,
    description: cfg.description,

    // Old Stage 1
    specBuilder: { ...s.specBuilder },

    // Old Stage 2 (QE) — kept for compat but disabled everywhere
    questionEngine: {
      enabled: modeId !== "fast",
      provider: s.specBuilder.provider,
      model: s.specBuilder.model,
      max_rounds: modeId === "premium" ? 3 : 2,
      clarity_threshold: modeId === "premium" ? 0.85 : 0.75,
    },

    // Old Stage 3
    generation: {
      provider: s.generation.provider,
      model: s.generation.model,
      count: s.generation.candidates || 2,
    },

    // Old Stage 4
    scoring: {
      provider: s.evaluation.provider,
      model: s.evaluation.model,
      temperature: s.evaluation.temperature ?? 0,
    },

    // Old Stage 5
    outcomeRunner: {
      provider: s.outcome.provider,
      model: s.outcome.model,
    },
  };
}
