/**
 * Model Registry - Centralized Model Configuration
 * 
 * Provides a single source of truth for all model configurations.
 * Maps frontend model names to provider model identifiers (OpenAI-compatible).
 * 
 * Features:
 * - Full metadata for each model (tier, category, cost, speed)
 * - Reserved slots for future models (_futureModel field)
 * - Provider abstraction ready for Anthropic/Claude
 * - System prompt customization per model
 * - Helper functions for model management
 */

/**
 * Model tiers for classification
 */
export const MODEL_TIERS = {
  MINI: 'mini',
  STANDARD: 'standard',
  PLUS: 'plus',
  PRO: 'pro',
  PRO_MAX: 'pro-max'
};

/**
 * Model categories
 */
export const MODEL_CATEGORIES = {
  GENERAL: 'general',
  CODE: 'code',
  CREATIVE: 'creative',
  ANALYSIS: 'analysis'
};

/**
 * Model providers
 */
export const MODEL_PROVIDERS = {
  OPENAI: 'openai',
  GROQ: 'groq',
  ANTHROPIC: 'anthropic' // Future support
};

/**
 * Complete model registry with all configurations
 */
export const MODEL_REGISTRY = {
  // --- Default Alias (Points to standard) ---
  'promptly': {
    id: 'standard',
    provider: MODEL_PROVIDERS.GROQ,
    model: 'llama-3.3-70b-versatile',
    _futureModel: 'llama-3.3-70b-versatile',
    tier: MODEL_TIERS.STANDARD,
    category: MODEL_CATEGORIES.GENERAL,
    label: 'Standard',
    description: 'Balanced quality & depth',
    costMultiplier: 3,
    speedMultiplier: 1,
    maxTokens: 8192,
    supportsJson: true,
    systemPromptSuffix: null
  },

  // --- Optimization Modes ---
  'fast': {
    id: 'fast',
    provider: MODEL_PROVIDERS.GROQ,
    model: 'llama-3.1-8b-instant',
    _futureModel: 'llama-3.1-8b-instant',
    tier: MODEL_TIERS.MINI,
    category: MODEL_CATEGORIES.GENERAL,
    label: 'Fast',
    description: 'Quick, low-cost, instant results',
    costMultiplier: 1,
    speedMultiplier: 1.5,
    maxTokens: 4096,
    supportsJson: true,
    systemPromptSuffix: null
  },

  'standard': {
    id: 'standard',
    provider: MODEL_PROVIDERS.GROQ,
    model: 'llama-3.3-70b-versatile',
    _futureModel: 'llama-3.3-70b-versatile',
    tier: MODEL_TIERS.STANDARD,
    category: MODEL_CATEGORIES.GENERAL,
    label: 'Standard',
    description: 'Balanced quality & depth',
    costMultiplier: 3,
    speedMultiplier: 1,
    maxTokens: 8192,
    supportsJson: true,
    systemPromptSuffix: null
  },
  'premium': {
    id: 'premium',
    provider: MODEL_PROVIDERS.OPENAI,
    model: 'gpt-4o',
    _futureModel: 'gpt-4o',
    tier: MODEL_TIERS.PRO_MAX,
    category: MODEL_CATEGORIES.GENERAL,
    label: 'Premium',
    description: 'Maximum quality, slower, best result',
    costMultiplier: 5,
    speedMultiplier: 0.7,
    maxTokens: 8192,
    supportsJson: true,
    systemPromptSuffix: null
  }
};

/**
 * Get all available model IDs
 * @returns {string[]} Array of model IDs
 */
export function getModelIds() {
  return Object.keys(MODEL_REGISTRY);
}

/**
 * Get complete model configuration
 * @param {string} modelId - The model ID (e.g., 'promptly-mini')
 * @returns {Object|null} Model configuration or null if not found
 */
export function getModelConfig(modelId) {
  return MODEL_REGISTRY[modelId] || null;
}

/**
 * Get the actual OpenAI model name for a Promptly model ID
 * @param {string} modelId - The Promptly model ID
 * @returns {string} The actual OpenAI model name
 */
export function resolveModelName(modelId) {
  const config = MODEL_REGISTRY[modelId];
  if (!config) {
    return process.env.OPENAI_MODEL || null;
  }
  return config.model;
}

/**
 * Check if a model is a placeholder (maps to different future model)
 * @param {string} modelId - The model ID
 * @returns {boolean} True if model has a different future model planned
 */
export function isPlaceholder(modelId) {
  const config = MODEL_REGISTRY[modelId];
  if (!config) return false;
  return config.model !== config._futureModel;
}

/**
 * Get the future upgrade path for a model
 * @param {string} modelId - The model ID
 * @returns {Object|null} Upgrade information or null
 */
export function getUpgradePath(modelId) {
  const config = MODEL_REGISTRY[modelId];
  if (!config || !isPlaceholder(modelId)) return null;

  return {
    currentModel: config.model,
    futureModel: config._futureModel,
    description: `${config.label} will upgrade from ${config.model} to ${config._futureModel}`
  };
}

/**
 * Get models by category
 * @param {string} category - The category (e.g., 'code', 'general')
 * @returns {Object[]} Array of model configurations
 */
export function getModelsByCategory(category) {
  return Object.values(MODEL_REGISTRY).filter(m => m.category === category);
}

/**
 * Get models by tier
 * @param {string} tier - The tier (e.g., 'mini', 'pro')
 * @returns {Object[]} Array of model configurations
 */
export function getModelsByTier(tier) {
  return Object.values(MODEL_REGISTRY).filter(m => m.tier === tier);
}

/**
 * Get system prompt suffix for a model
 * @param {string} modelId - The model ID
 * @returns {string|null} System prompt suffix or null
 */
export function getSystemPromptSuffix(modelId) {
  const config = MODEL_REGISTRY[modelId];
  return config?.systemPromptSuffix || null;
}

/**
 * Build complete system prompt with model-specific suffix
 * @param {string} basePrompt - The base system prompt
 * @param {string} modelId - The model ID
 * @returns {string} Complete system prompt
 */
export function buildSystemPrompt(basePrompt, modelId) {
  const suffix = getSystemPromptSuffix(modelId);
  if (!suffix) return basePrompt;
  return `${basePrompt}\n\n${suffix}`;
}

/**
 * Validate if a model ID is valid
 * @param {string} modelId - The model ID to validate
 * @returns {boolean} True if valid
 */
export function isValidModel(modelId) {
  return modelId in MODEL_REGISTRY;
}

/**
 * Get model display information for UI
 * @param {string} modelId - The model ID
 * @returns {Object} Display information
 */
export function getModelDisplayInfo(modelId) {
  const config = MODEL_REGISTRY[modelId];
  if (!config) {
    return {
      label: 'Unknown Model',
      description: 'Model not found',
      tier: 'unknown',
      category: 'unknown'
    };
  }

  return {
    label: config.label,
    description: config.description,
    tier: config.tier,
    category: config.category,
    costIndicator: '💰'.repeat(Math.min(5, Math.ceil(config.costMultiplier / 2))),
    speedIndicator: '⚡'.repeat(Math.min(5, Math.ceil(config.speedMultiplier * 2)))
  };
}

// Default export for convenience
export default {
  MODEL_REGISTRY,
  MODEL_TIERS,
  MODEL_CATEGORIES,
  MODEL_PROVIDERS,
  getModelIds,
  getModelConfig,
  resolveModelName,
  isPlaceholder,
  getUpgradePath,
  getModelsByCategory,
  getModelsByTier,
  getSystemPromptSuffix,
  buildSystemPrompt,
  isValidModel,
  getModelDisplayInfo
};
