import { chatJson as chatJsonOpenAI, chatText as chatTextOpenAI, LlmDisabledError, getResolvedDefaultModel, isLlmEnabled } from "./openaiClient.js";
import { chatJsonGroq, chatTextGroq } from "./groqClient.js";

export { LlmDisabledError, getResolvedDefaultModel, isLlmEnabled };

/**
 * Route LLM calls to the appropriate provider
 * 
 * This is the SINGLE SOURCE OF TRUTH for provider dispatching.
 * No client should know about other clients.
 */

/**
 * Standardized JSON Chat Completion
 */
export async function chatJson({ system, user, model, promptlyModelId, provider, apiKey, maxTokens, temperature }) {
  if (!provider) {
    throw new Error(`[llmRouter] ❌ Contract Violation: 'provider' MUST be explicitly set. Received: ${provider}`);
  }
  if (provider === 'groq') {
    return chatJsonGroq({
      system,
      user,
      model,
      apiKey,
      maxTokens,
      temperature
    });
  } else {
    // Default to OpenAI
    return chatJsonOpenAI({
      system,
      user,
      model,
      promptlyModelId,
      apiKey,
      maxTokens,
      temperature
    });
  }
}

/**
 * Standardized Text Chat Completion
 */
export async function chatText({ system, user, model, promptlyModelId, provider, temperature, forceRewritePrompt, minSimilarity, maxRetries }) {
  if (!provider) {
    throw new Error(`[llmRouter] ❌ Contract Violation: 'provider' MUST be explicitly set. Received: ${provider}`);
  }
  if (provider === 'groq') {
    return chatTextGroq({
      system,
      user,
      model,
      temperature,
      minSimilarity,
      maxRetries
    });
  } else {
    // Default to OpenAI
    return chatTextOpenAI({
      system,
      user,
      model,
      promptlyModelId,
      temperature,
      forceRewritePrompt,
      minSimilarity,
      maxRetries
    });
  }
}
