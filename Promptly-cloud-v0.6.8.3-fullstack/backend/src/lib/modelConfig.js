/**
 * Model Configuration
 * 
 * Centralized configuration for supported LLM models.
 * Used across the application for model selection, validation, and display.
 */

// List of supported models with metadata
export const SUPPORTED_MODELS = [
  { 
    id: "gpt-4o-mini", 
    name: "GPT-4o Mini", 
    description: "Fast and cost-effective" 
  },
  { 
    id: "gpt-4o", 
    name: "GPT-4o", 
    description: "Balanced performance" 
  },
  { 
    id: "gpt-4-turbo", 
    name: "GPT-4 Turbo", 
    description: "High quality reasoning" 
  },
  { 
    id: "gpt-3.5-turbo", 
    name: "GPT-3.5 Turbo", 
    description: "Legacy model, fastest" 
  }
];

// List of just model IDs for validation
export const SUPPORTED_MODEL_IDS = SUPPORTED_MODELS.map(m => m.id);

// Default model
export const DEFAULT_MODEL = "gpt-4o-mini";

/**
 * Check if a model ID is supported
 * @param {string} modelId - The model ID to check
 * @returns {boolean} - True if the model is supported
 */
export function isModelSupported(modelId) {
  return SUPPORTED_MODEL_IDS.includes(modelId);
}

/**
 * Resolve the model to use based on input and environment
 * @param {string|null} requestedModel - The model requested by the user
 * @returns {string} - The resolved model ID
 */
export function resolveModel(requestedModel) {
  // If a model is provided and it's in the supported list, use it
  if (requestedModel && isModelSupported(requestedModel)) {
    return requestedModel;
  }
  // Otherwise, fall back to environment variable or default
  return process.env.OPENAI_MODEL || process.env.OPENAI_DEFAULT_MODEL || DEFAULT_MODEL;
}
