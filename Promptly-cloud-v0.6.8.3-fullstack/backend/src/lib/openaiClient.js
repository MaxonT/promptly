import OpenAI from "openai";
import { resolveModelName, getSystemPromptSuffix, buildSystemPrompt } from "./modelRegistry.js";

const apiKey = process.env.OPENAI_API_KEY || "";
const baseURL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const SAFE_FALLBACK_MODEL = "llama-3.3-70b";

// Resolve the configured default model (prefers OPENAI_DEFAULT_MODEL but
// also supports legacy OPENAI_MODEL).
const DEFAULT_MODEL = process.env.OPENAI_DEFAULT_MODEL || process.env.OPENAI_MODEL || "qwen-2.5-72b-instruct";
let client = null;

if (apiKey) {
  client = new OpenAI({ 
    apiKey,
    baseURL
  });
  console.log(`[promptly] ✅ OpenAI client initialized successfully`);
  console.log(`[promptly] Base URL: ${baseURL}`);
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
const DEFAULT_MAX_RETRIES = 2; // Increased from 1 to 2 for better change detection
const DEFAULT_MIN_CHANGE_SIMILARITY = 0.75; // Lowered from 0.85 to 0.75 to catch more unchanged outputs
const DEFAULT_FORCE_REWRITE_PROMPT =
  "CRITICAL: Your output MUST be substantially different from the input. Rewrite, restructure, and enhance. Do NOT simply copy or rephrase. If output is too similar, append '> needs more change'.";

function levenshteinDistance(a, b) {
  const matrix = Array.from({ length: b.length + 1 }, () =>
    new Array(a.length + 1).fill(0)
  );
  for (let i = 0; i <= b.length; i++) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = b[i - 1] === a[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[b.length][a.length];
}

function normalizedSimilarity(a = "", b = "") {
  const maxLen = Math.max(a.length, b.length, 1);
  const distance = levenshteinDistance(a, b);
  return 1 - distance / maxLen;
}

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
    let completion;
    try {
      completion = await client.chat.completions.create({
        model: usedModel,
        temperature: DEFAULT_TEMPERATURE,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: enhancedSystem },
          { role: "user", content: user }
        ]
      });
    } catch (apiError) {
      if ((apiError.status === 400 || apiError.status === 409) && apiError.message.includes("decommissioned")) {
        console.warn(`[promptly] ⚠️ Model ${usedModel} is decommissioned (Status: ${apiError.status}). Falling back to ${SAFE_FALLBACK_MODEL}`);
        completion = await client.chat.completions.create({
          model: SAFE_FALLBACK_MODEL,
          temperature: DEFAULT_TEMPERATURE,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: enhancedSystem },
            { role: "user", content: user }
          ]
        });
      } else {
        throw apiError;
      }
    }
    
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
    // Global fallback for ANY error if we're not already using the safe model
    if (usedModel !== SAFE_FALLBACK_MODEL) {
      console.warn(`[promptly] ⚠️ LLM call failed with model ${usedModel} (Status: ${error.status || 'unknown'}). Falling back to ${SAFE_FALLBACK_MODEL}`);
      console.warn(`[promptly] ⚠️ Original error: ${error.message}`);
      
      // Recursive call with safe fallback model
      return chatJson({
        system,
        user, // Use the correct variable 'user' instead of 'baseUser'
        model: SAFE_FALLBACK_MODEL,
        promptlyModelId
      });
    }

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

async function executeChatText(
  {
    system,
    model,
    promptlyModelId,
    baseUser,
    temperature,
    forceRewritePrompt,
    minSimilarity,
    maxRetries
  },
  attempt
) {
  if (!client) {
    console.error("[promptly] ❌ LLM call blocked: OpenAI client not initialized (OPENAI_API_KEY not set)");
    throw new LlmDisabledError();
  }
  
  const usedModel = resolveModel(model);
  console.log(`[promptly] 🚀 Starting LLM call - Model: ${usedModel}, Type: chatText, Attempt: ${attempt + 1}`);
  console.log(`[promptly] System prompt length: ${system?.length || 0} chars`);
  console.log(`[promptly] Base user prompt length: ${baseUser?.length || 0} chars`);

  let enhancedSystem = system;
  if (promptlyModelId) {
    const suffix = getSystemPromptSuffix(promptlyModelId);
    if (suffix) {
      enhancedSystem = buildSystemPrompt(system, promptlyModelId);
    }
  }
  
  const appliedTemperature = temperature ?? DEFAULT_TEMPERATURE;
  const promptSuffix = attempt > 0 ? `\n\n${forceRewritePrompt || DEFAULT_FORCE_REWRITE_PROMPT}` : "";
  const userContent = `${baseUser}${promptSuffix}`;

  const startTime = Date.now();
  try {
    let completion;
    try {
      completion = await client.chat.completions.create({
        model: usedModel,
        temperature: appliedTemperature,
        messages: [
          { role: "system", content: enhancedSystem },
          { role: "user", content: userContent }
        ]
      });
    } catch (apiError) {
      if ((apiError.status === 400 || apiError.status === 409) && apiError.message.includes("decommissioned")) {
        console.warn(`[promptly] ⚠️ Model ${usedModel} is decommissioned (Status: ${apiError.status}). Falling back to ${SAFE_FALLBACK_MODEL}`);
        completion = await client.chat.completions.create({
          model: SAFE_FALLBACK_MODEL,
          temperature: appliedTemperature,
          messages: [
            { role: "system", content: enhancedSystem },
            { role: "user", content: userContent }
          ]
        });
      } else {
        throw apiError;
      }
    }

    const duration = Date.now() - startTime;
    const responseText = completion.choices?.[0]?.message?.content || "";
    const tokensUsed = completion.usage?.total_tokens || 0;

    console.log(
      `[promptly] ✅ LLM call succeeded - Duration: ${duration}ms, Response: ${responseText.length} chars, Tokens: ${tokensUsed}`
    );
    console.log(`[promptly] Completion ID: ${completion.id || "N/A"}`);

    const similarity = normalizedSimilarity(baseUser, responseText);
    console.log(`[promptly] Similarity score vs user prompt: ${similarity.toFixed(3)}`);

    const threshold = minSimilarity ?? DEFAULT_MIN_CHANGE_SIMILARITY;
    const retryLimit = typeof maxRetries === "number" ? maxRetries : DEFAULT_MAX_RETRIES;

    if (similarity >= threshold && attempt < retryLimit) {
      console.warn(`[promptly] 🚩 Output too similar (${similarity.toFixed(3)} >= ${threshold}); retrying with stronger rewrite instruction (attempt ${attempt + 1}/${retryLimit + 1})`);
      // Increase temperature more aggressively on retry
      const retryTemperature = Math.max(appliedTemperature + 0.15, 0.4);
      console.log(`[promptly] Retry with temperature: ${retryTemperature}`);
      return executeChatText(
        {
          system,
          model,
          promptlyModelId,
          baseUser,
          temperature: retryTemperature,
          forceRewritePrompt,
          minSimilarity,
          maxRetries
        },
        attempt + 1
      );
    }
    
    // Log final similarity if still high
    if (similarity >= threshold) {
      console.warn(`[promptly] ⚠️ Final output similarity still high (${similarity.toFixed(3)}), but retry limit reached`);
    }

    return {
      text: responseText,
      usage: completion.usage || {},
      model: usedModel,
      completionId: completion.id || null,
      similarity
    };
  } catch (error) {
    // Global fallback for ANY error if we're not already using the safe model
    if (usedModel !== SAFE_FALLBACK_MODEL) {
      console.warn(`[promptly] ⚠️ LLM call failed with model ${usedModel} (Status: ${error.status || 'unknown'}). Falling back to ${SAFE_FALLBACK_MODEL}`);
      console.warn(`[promptly] ⚠️ Original error: ${error.message}`);
      
      // Recursive call with safe fallback model
      return executeChatText(
        {
          system,
          model: SAFE_FALLBACK_MODEL,
          promptlyModelId,
          baseUser,
          temperature: appliedTemperature, // Use original temperature
          forceRewritePrompt,
          minSimilarity,
          maxRetries
        },
        attempt // Keep attempt count
      );
    }

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

export async function chatText({
  system,
  user,
  model,
  promptlyModelId,
  temperature,
  forceRewritePrompt,
  minSimilarity,
  maxRetries
}) {
  return executeChatText(
    {
      system,
      model,
      promptlyModelId,
      baseUser: user,
      temperature,
      forceRewritePrompt,
      minSimilarity,
      maxRetries
    },
    0
  );
}
