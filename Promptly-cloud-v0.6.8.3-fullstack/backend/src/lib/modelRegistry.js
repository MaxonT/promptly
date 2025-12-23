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
  ANTHROPIC: 'anthropic' // Future support
};

/**
 * Complete model registry with all configurations
 */
export const MODEL_REGISTRY = {
  'promptly-mini': {
    id: 'promptly-mini',
    provider: MODEL_PROVIDERS.OPENAI,
    model: 'qwen-2.5-7b',
    _futureModel: 'qwen-2.5-7b',
    tier: MODEL_TIERS.MINI,
    category: MODEL_CATEGORIES.GENERAL,
    label: 'Promptly Mini',
    description: 'Fast and efficient for simple tasks',
    costMultiplier: 1,
    speedMultiplier: 1.5,
    maxTokens: 4096,
    supportsJson: true,
    systemPromptSuffix: null
  },

  'promptly-v0-mini': {
    id: 'promptly-v0-mini',
    provider: MODEL_PROVIDERS.OPENAI,
    model: 'qwen-2.5-7b-instruct',
    _futureModel: 'qwen-2.5-7b-instruct',
    tier: MODEL_TIERS.MINI,
    category: MODEL_CATEGORIES.GENERAL,
    label: 'Promptly v0 mini',
    description: 'Fast and efficient for simple tasks',
    costMultiplier: 1,
    speedMultiplier: 1.5,
    maxTokens: 4096,
    supportsJson: true,
    systemPromptSuffix: null
  },

  'promptly': {
    id: 'promptly',
    provider: MODEL_PROVIDERS.OPENAI,
    model: 'qwen-2.5-72b-instruct',
    _futureModel: 'qwen-2.5-72b-instruct',
    tier: MODEL_TIERS.STANDARD,
    category: MODEL_CATEGORIES.GENERAL,
    label: 'Promptly',
    description: 'Balanced performance for most tasks',
    costMultiplier: 3,
    speedMultiplier: 1,
    maxTokens: 8192,
    supportsJson: true,
    systemPromptSuffix: null
  },

  'promptly-v0': {
    id: 'promptly-v0',
    provider: MODEL_PROVIDERS.OPENAI,
    model: 'qwen-2.5-72b-instruct',
    _futureModel: 'qwen-2.5-72b-instruct',
    tier: MODEL_TIERS.STANDARD,
    category: MODEL_CATEGORIES.GENERAL,
    label: 'Promptly v0',
    description: 'Balanced performance for most tasks',
    costMultiplier: 3,
    speedMultiplier: 1,
    maxTokens: 8192,
    supportsJson: true,
    systemPromptSuffix: null
  },

  'promptly-v0-max': {
    id: 'promptly-v0-max',
    provider: MODEL_PROVIDERS.OPENAI,
    model: 'llama-3.3-70b-versatile',
    _futureModel: 'llama-3.3-70b-versatile',
    tier: MODEL_TIERS.PRO_MAX,
    category: MODEL_CATEGORIES.GENERAL,
    label: 'Promptly v0 Max',
    description: 'Advanced reasoning for complex tasks',
    costMultiplier: 5,
    speedMultiplier: 0.7,
    maxTokens: 8192,
    supportsJson: true,
    systemPromptSuffix: null
  },

  'promptly-plus': {
    id: 'promptly-plus',
    provider: MODEL_PROVIDERS.OPENAI,
    model: 'qwen-2.5-32b',
    _futureModel: 'qwen-2.5-32b',
    tier: MODEL_TIERS.PLUS,
    category: MODEL_CATEGORIES.GENERAL,
    label: 'Promptly Plus',
    description: 'Enhanced reasoning and creativity',
    costMultiplier: 5,
    speedMultiplier: 0.8,
    maxTokens: 8192,
    supportsJson: true,
    systemPromptSuffix: null
  },

  'promptly-pro': {
    id: 'promptly-pro',
    provider: MODEL_PROVIDERS.OPENAI,
    model: 'qwen-2.5-32b',
    _futureModel: 'qwen-2.5-32b',
    tier: MODEL_TIERS.PRO,
    category: MODEL_CATEGORIES.GENERAL,
    label: 'Promptly Pro',
    description: 'Advanced capabilities for complex tasks',
    costMultiplier: 8,
    speedMultiplier: 0.7,
    maxTokens: 16384,
    supportsJson: true,
    systemPromptSuffix: null
  },

  'promptly-pro-max': {
    id: 'promptly-pro-max',
    provider: MODEL_PROVIDERS.OPENAI,
    model: 'llama-3.3-70b-versatile',
    _futureModel: 'llama-3.3-70b-versatile',
    tier: MODEL_TIERS.PRO_MAX,
    category: MODEL_CATEGORIES.GENERAL,
    label: 'Promptly Pro Max',
    description: 'Maximum capability for the most demanding tasks',
    costMultiplier: 10,
    speedMultiplier: 0.6,
    maxTokens: 8192,
    supportsJson: true,
    systemPromptSuffix: null
  },

  'promptly-code-mini': {
    id: 'promptly-code-mini',
    provider: MODEL_PROVIDERS.OPENAI,
    model: 'qwen-2.5-coder-32b',
    _futureModel: 'qwen-2.5-coder-32b',
    tier: MODEL_TIERS.MINI,
    category: MODEL_CATEGORIES.CODE,
    label: 'Promptly Code Mini',
    description: 'Quick code assistance and snippets',
    costMultiplier: 1,
    speedMultiplier: 1.5,
    maxTokens: 4096,
    supportsJson: true,
    systemPromptSuffix: 'You are an expert code-focused AI assistant. Prioritize code quality, best practices, and clear explanations.'
  },

  'promptly-code': {
    id: 'promptly-code',
    provider: MODEL_PROVIDERS.OPENAI,
    model: 'qwen-2.5-coder-32b',
    _futureModel: 'qwen-2.5-coder-32b',
    tier: MODEL_TIERS.STANDARD,
    category: MODEL_CATEGORIES.CODE,
    label: 'Promptly Code',
    description: 'Reliable code generation and review',
    costMultiplier: 2,
    speedMultiplier: 1.2,
    maxTokens: 8192,
    supportsJson: true,
    systemPromptSuffix: 'You are an expert code-focused AI assistant. Prioritize code quality, best practices, and clear explanations.'
  },

  'promptly-code-plus': {
    id: 'promptly-code-plus',
    provider: MODEL_PROVIDERS.OPENAI,
    model: 'qwen-2.5-coder-32b',
    _futureModel: 'qwen-2.5-coder-32b',
    tier: MODEL_TIERS.PLUS,
    category: MODEL_CATEGORIES.CODE,
    label: 'Promptly Code Plus',
    description: 'Enhanced code understanding and architecture',
    costMultiplier: 5,
    speedMultiplier: 0.9,
    maxTokens: 16384,
    supportsJson: true,
    systemPromptSuffix: 'You are an expert code-focused AI assistant. Prioritize code quality, best practices, architecture patterns, and maintainability.'
  },

  'promptly-code-pro': {
    id: 'promptly-code-pro',
    provider: MODEL_PROVIDERS.OPENAI,
    model: 'qwen-2.5-coder-32b',
    _futureModel: 'qwen-2.5-coder-32b',
    tier: MODEL_TIERS.PRO,
    category: MODEL_CATEGORIES.CODE,
    label: 'Promptly Code Pro',
    description: 'Professional-grade code assistance',
    costMultiplier: 8,
    speedMultiplier: 0.7,
    maxTokens: 32768,
    supportsJson: true,
    systemPromptSuffix: 'You are an expert senior software engineer AI assistant. Prioritize production-ready code, security, performance, and comprehensive documentation.'
  },

  'promptly-code-pro-max': {
    id: 'promptly-code-pro-max',
    provider: MODEL_PROVIDERS.OPENAI,
    model: 'qwen-2.5-coder-32b',
    _futureModel: 'qwen-2.5-coder-32b',
    tier: MODEL_TIERS.PRO_MAX,
    category: MODEL_CATEGORIES.CODE,
    label: 'Promptly Code Pro Max',
    description: 'Ultimate code generation for enterprise applications',
    costMultiplier: 10,
    speedMultiplier: 0.6,
    maxTokens: 32768,
    supportsJson: true,
    systemPromptSuffix: 'You are an expert principal engineer AI assistant. Prioritize enterprise-grade code, scalability, security, comprehensive testing, and architectural excellence.'
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
    return process.env.OPENAI_MODEL || 'gpt-4o-mini';
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
