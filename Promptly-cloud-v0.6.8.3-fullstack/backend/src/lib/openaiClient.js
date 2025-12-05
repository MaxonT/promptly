import OpenAI from "openai";
import { resolveModelName, getSystemPromptSuffix, buildSystemPrompt } from "./modelRegistry.js";

const apiKey = process.env.OPENAI_API_KEY || "";

// Resolve the configured default model (prefers OPENAI_DEFAULT_MODEL but
// also supports legacy OPENAI_MODEL).
const DEFAULT_MODEL = process.env.OPENAI_DEFAULT_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";

let client = null;

if (apiKey) {
  client = new OpenAI({ apiKey });
  console.log(`[promptly] ✅ OpenAI client initialized successfully`);
  console.log(`[promptly] Default model: ${DEFAULT_MODEL}`);
  const maskedKey = apiKey.length > 11 
    ? `${apiKey.substring(0, 7)}...${apiKey.substring(apiKey.length - 4)}` 
    : "***";
  console.log(`[promptly] API Key: ${maskedKey} (masked)`);
} else {
  console.warn("[promptly] ⚠️  OPENAI_API_KEY is not set; LLM features are disabled.");
  console.warn("[promptly] ⚠️  All enhancement endpoints will return 503 errors.");
}

export class LlmDisabledError extends Error {
  constructor(message = "LLM features are disabled") {
    super(message);
    this.name = "LlmDisabledError";
    this.code = "LLM_DISABLED";
  }
}

const DEFAULT_TEMPERATURE = 0.2;

/**
 * Resolve the actual OpenAI model name from a Promptly model ID
 * @param {string} model - The model ID (e.g., 'promptly-mini' or 'gpt-4o-mini')
 * @returns {string} The resolved OpenAI model name
 */
function resolveModel(model) {
  // If model looks like a Promptly model ID, resolve it via registry
  if (model && model.startsWith('promptly')) {
    return resolveModelName(model);
  }
  // Otherwise use as-is (already an OpenAI model name)
  return model || DEFAULT_MODEL;
}

export function getResolvedDefaultModel() {
  return resolveModel(DEFAULT_MODEL);
}

export function isLlmEnabled() {
  return !!client;
}

/**
 * Chat completion that returns JSON
 * @param {Object} options
 * @param {string} options.system - System prompt
 * @param {string} options.user - User message
 * @param {string} options.model - OpenAI model name OR Promptly model ID
 * @param {string} [options.promptlyModelId] - Optional Promptly model ID for system prompt enhancement
 */
export async function chatJson({ system, user, model, promptlyModelId }) {
  if (!client) {
    console.error("[promptly] ❌ LLM call blocked: OpenAI client not initialized (OPENAI_API_KEY not set)");
    throw new LlmDisabledError();
  }
  
  // Resolve model and potentially enhance system prompt
  const usedModel = resolveModel(model);
  console.log(`[promptly] 🚀 Starting LLM call - Model: ${usedModel}, Type: chatJson`);
  console.log(`[promptly] System prompt length: ${system?.length || 0} chars`);
  console.log(`[promptly] User prompt length: ${user?.length || 0} chars`);
  
  let enhancedSystem = system;
  
  // If a Promptly model ID is provided, apply system prompt suffix if applicable
  if (promptlyModelId) {
    const suffix = getSystemPromptSuffix(promptlyModelId);
    if (suffix) {
      enhancedSystem = buildSystemPrompt(system, promptlyModelId);
    }
  }
  
  const startTime = Date.now();
  try {
    console.log(`[promptly] 📡 Calling OpenAI API: client.chat.completions.create() with JSON format`);
    const completion = await client.chat.completions.create({
      model: usedModel,
      temperature: DEFAULT_TEMPERATURE,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: enhancedSystem },
        { role: "user", content: user }
      ]
    });
    
    const duration = Date.now() - startTime;
    const content = completion.choices?.[0]?.message?.content || "{}";
    const tokensUsed = completion.usage?.total_tokens || 0;
    
    console.log(`[promptly] ✅ LLM call succeeded - Duration: ${duration}ms, Response: ${content.length} chars, Tokens: ${tokensUsed}`);
    console.log(`[promptly] Completion ID: ${completion.id || 'N/A'}`);
    
    let parsed;
    try {
      parsed = JSON.parse(content);
      console.log(`[promptly] ✅ JSON parsed successfully`);
    } catch (parseError) {
      console.error(`[promptly] ⚠️  JSON parse failed:`, parseError.message);
      console.error(`[promptly] Raw content:`, content.substring(0, 200));
      parsed = {};
    }
    
    return {
      data: parsed,
      usage: completion.usage || {},
      model: usedModel,
      completionId: completion.id || null
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[promptly] ❌ LLM call failed after ${duration}ms:`, error.message);
    console.error(`[promptly] Error type: ${error.constructor.name}`);
    if (error.response) {
      console.error(`[promptly] Error response status: ${error.response?.status}`);
      console.error(`[promptly] Error response data:`, error.response?.data);
    }
    throw error;
  }
}

/**
 * Text completion
 * Similar to chatJson but returns plain text instead of JSON
 * @param {Object} options
 * @param {string} options.system - System prompt
 * @param {string} options.user - User message
 * @param {string} options.model - OpenAI model name OR Promptly model ID
 * @param {string} [options.promptlyModelId] - Optional Promptly model ID for system prompt enhancement
 */
export async function chatText({ system, user, model, promptlyModelId }) {
  if (!client) {
    console.error("[promptly] ❌ LLM call blocked: OpenAI client not initialized (OPENAI_API_KEY not set)");
    throw new LlmDisabledError();
  }
  
  // Resolve model and potentially enhance system prompt
  const usedModel = resolveModel(model);
  console.log(`[promptly] 🚀 Starting LLM call - Model: ${usedModel}, Type: chatText`);
  console.log(`[promptly] System prompt length: ${system?.length || 0} chars`);
  console.log(`[promptly] User prompt length: ${user?.length || 0} chars`);
  
  let enhancedSystem = system;
  
  // If a Promptly model ID is provided, apply system prompt suffix if applicable
  if (promptlyModelId) {
    const suffix = getSystemPromptSuffix(promptlyModelId);
    if (suffix) {
      enhancedSystem = buildSystemPrompt(system, promptlyModelId);
    }
  }
  
  const startTime = Date.now();
  try {
    console.log(`[promptly] 📡 Calling OpenAI API: client.chat.completions.create()`);
    const completion = await client.chat.completions.create({
      model: usedModel,
      temperature: DEFAULT_TEMPERATURE,
      messages: [
        { role: "system", content: enhancedSystem },
        { role: "user", content: user }
      ]
    });
    
    const duration = Date.now() - startTime;
    const responseLength = completion.choices?.[0]?.message?.content?.length || 0;
    const tokensUsed = completion.usage?.total_tokens || 0;
    
    console.log(`[promptly] ✅ LLM call succeeded - Duration: ${duration}ms, Response: ${responseLength} chars, Tokens: ${tokensUsed}`);
    console.log(`[promptly] Completion ID: ${completion.id || 'N/A'}`);
    
    return {
      text: completion.choices?.[0]?.message?.content || "",
      usage: completion.usage || {},
      model: usedModel,
      completionId: completion.id || null
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[promptly] ❌ LLM call failed after ${duration}ms:`, error.message);
    console.error(`[promptly] Error type: ${error.constructor.name}`);
    if (error.response) {
      console.error(`[promptly] Error response status: ${error.response?.status}`);
      console.error(`[promptly] Error response data:`, error.response?.data);
    }
    throw error;
  }
}
