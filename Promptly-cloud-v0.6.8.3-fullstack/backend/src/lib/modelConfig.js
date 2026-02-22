/**
 * modelConfig.js — Unified Model Configuration (Pipeline v2)
 *
 * Single source of truth for all LLM model selections across the application.
 * Replaces the old modePolicies.js with a cleaner, stage-aware design.
 *
 * Key design decisions:
 *   1. Critique & Evaluation use a DIFFERENT model than Generation
 *      to avoid self-evaluation bias.
 *   2. Fast mode skips Critique/Refine for speed.
 *   3. Generation produces exactly 2 candidates (structured + fluent)
 *      instead of 3 undifferentiated ones.
 *   4. Non-pipeline routes share a single default instead of
 *      hardcoding 'openai' everywhere.
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
  fast: {
    id: "fast",
    name: "Fast",
    description: "Quick optimization with default assumptions. No clarification, no critique cycle.",
    stages: {
      specBuilder: {
        provider: "groq",
        model: "llama-3.1-8b-instant",
      },
      generation: {
        provider: "groq",
        model: "llama-3.1-8b-instant",
        candidates: 2,   // structured + fluent
      },
      // critique / refine — NOT executed in fast mode
      evaluation: {
        provider: "groq",
        model: "llama-3.1-8b-instant",
        temperature: 0,
      },
      outcome: {
        provider: null,
        model: null,       // pure sort, no LLM
      },
    },
  },

  // 🔵 STANDARD — Primary product mode with full critique-refine cycle
  standard: {
    id: "standard",
    name: "Standard",
    description: "Strong synthesis with critique-refine cycle and cross-model evaluation.",
    stages: {
      specBuilder: {
        provider: "groq",
        model: "openai/gpt-oss-20b",
      },
      generation: {
        provider: "groq",
        model: "openai/gpt-oss-20b",
        candidates: 2,
      },
      critique: {
        provider: "groq",
        model: "llama-3.3-70b-versatile",  // Cross-model: stronger reviewer
      },
      refine: {
        provider: "groq",
        model: "openai/gpt-oss-20b",       // Same as generation (refines own work)
      },
      evaluation: {
        provider: "groq",
        model: "llama-3.3-70b-versatile",  // Cross-model: independent judge
        temperature: 0,
      },
      outcome: {
        provider: null,
        model: null,
      },
    },
  },

  // 🟣 PREMIUM — Maximum quality, strongest models, full pipeline
  premium: {
    id: "premium",
    name: "Premium",
    description: "Maximum quality with full critique-refine cycle and cross-model evaluation.",
    stages: {
      specBuilder: {
        provider: "groq",
        model: "qwen/qwen3-32b",
      },
      generation: {
        provider: "groq",
        model: "qwen/qwen3-32b",
        candidates: 2,
      },
      critique: {
        provider: "groq",
        model: "llama-3.3-70b-versatile",  // Cross-model: different perspective
      },
      refine: {
        provider: "groq",
        model: "qwen/qwen3-32b",           // Same as generation
      },
      evaluation: {
        provider: "groq",
        model: "llama-3.3-70b-versatile",  // Cross-model: independent judge
        temperature: 0,
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
  clarity:      0.15,  // Clear, unambiguous language
  specificity:  0.15,  // Concrete, not generic
  structure:    0.12,  // Good formatting, sections, hierarchy
  coherence:    0.10,  // Logical flow and internal consistency
  creativity:   0.08,  // Novel framing, smart approaches
  safety:       0.10,  // Safe from misuse, no harmful patterns
  efficiency:   0.10,  // Concise, no redundancy, good token economy
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
