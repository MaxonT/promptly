import OpenAI from "openai";
import { resolveModelName, getSystemPromptSuffix, buildSystemPrompt } from "./modelRegistry.js";

const apiKey = process.env.OPENAI_API_KEY || "";

let client = null;

if (apiKey) {
  client = new OpenAI({ apiKey });
} else {
  console.warn("[promptly] OPENAI_API_KEY is not set; LLM features are disabled.");
}

export class LlmDisabledError extends Error {
  constructor(message = "LLM features are disabled") {
    super(message);
    this.name = "LlmDisabledError";
    this.code = "LLM_DISABLED";
  }
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
  return model || process.env.OPENAI_MODEL || "gpt-4o-mini";
}

export async function chatJson({ system, user, model, promptlyModelId }) {
  if (!client) {
    throw new LlmDisabledError();
  }
  
  // Resolve model and potentially enhance system prompt
  const usedModel = resolveModel(model);
  let enhancedSystem = system;
  
  // If a Promptly model ID is provided, apply system prompt suffix if applicable
  if (promptlyModelId) {
    const suffix = getSystemPromptSuffix(promptlyModelId);
    if (suffix) {
      enhancedSystem = buildSystemPrompt(system, promptlyModelId);
    }
  }
  
  const completion = await client.chat.completions.create({
    model: usedModel,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: enhancedSystem },
      { role: "user", content: user }
    ]
  });
  const content = completion.choices?.[0]?.message?.content || "{}";
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = {};
  }
  return {
    data: parsed,
    usage: completion.usage || {}
  };
}

/**
 * ATTACHMENT FEATURE - Text completion
 * Similar to chatJson but returns plain text instead of JSON
 */
export async function chatText({ system, user, model, promptlyModelId }) {
  if (!client) {
    throw new LlmDisabledError();
  }
  
  // Resolve model and potentially enhance system prompt
  const usedModel = resolveModel(model);
  let enhancedSystem = system;
  
  // If a Promptly model ID is provided, apply system prompt suffix if applicable
  if (promptlyModelId) {
    const suffix = getSystemPromptSuffix(promptlyModelId);
    if (suffix) {
      enhancedSystem = buildSystemPrompt(system, promptlyModelId);
    }
  }
  
  const completion = await client.chat.completions.create({
    model: usedModel,
    messages: [
      { role: "system", content: enhancedSystem },
      { role: "user", content: user }
    ]
  });
  return {
    text: completion.choices?.[0]?.message?.content || "",
    usage: completion.usage || {}
  };
}
