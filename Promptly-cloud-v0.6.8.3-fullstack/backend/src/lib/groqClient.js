import Groq from "groq-sdk";

export let groqClient = null;
const apiKey = process.env.GROQ_API_KEY || "";
let baseURL = process.env.GROQ_BASE_URL;

// Fix: Groq SDK automatically appends /openai/v1, so we must strip it if the user provided the full path
if (baseURL) {
  if (baseURL.endsWith('/openai/v1')) {
    baseURL = baseURL.slice(0, -'/openai/v1'.length);
  }
  // Remove trailing slash if present
  if (baseURL.endsWith('/')) {
    baseURL = baseURL.slice(0, -1);
  }
}

if (apiKey) {
  groqClient = new Groq({
    apiKey,
    baseURL
  });
  console.log(`[promptly] ✅ Groq client initialized successfully`);
  console.log(`[promptly] Groq Base URL: ${baseURL}`);
} else {
  console.warn("[promptly] ⚠️  GROQ_API_KEY is not set; Groq features are disabled.");
}

export class GroqDisabledError extends Error {
  constructor(message = "Groq features are disabled") {
    super(message);
    this.name = "GroqDisabledError";
    this.code = "GROQ_DISABLED";
  }
}

/**
 * Chat completion that returns JSON via Groq
 */
export async function chatJsonGroq({ system, user, model, apiKey: overrideKey, maxTokens, temperature }) {
  let client = groqClient;
  
  if (overrideKey) {
    client = new Groq({ apiKey: overrideKey, baseURL });
  }
  
  if (!client) {
    console.error("[promptly] ❌ Groq call blocked: Groq client not initialized (GROQ_API_KEY not set)");
    throw new GroqDisabledError();
  }
  
  console.log(`[promptly] 🚀 Starting Groq call - Model: ${model}`);
  
  try {
    const completionParams = {
      model: model,
      temperature: temperature || 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system || "" },
        { role: "user", content: user }
      ]
    };
    
    if (maxTokens) {
      completionParams.max_tokens = maxTokens;
    }
    
    const startTime = Date.now();
    const completion = await client.chat.completions.create(completionParams);
    const duration = Date.now() - startTime;
    
    const content = completion.choices?.[0]?.message?.content || "{}";
    const tokensUsed = completion.usage?.total_tokens || 0;
    
    console.log(`[promptly] ✅ Groq call succeeded - Duration: ${duration}ms, Response: ${content.length} chars, Tokens: ${tokensUsed}`);
    
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      console.error(`[promptly] ⚠️  Groq JSON parse failed:`, parseError.message);
      parsed = {};
    }
    
    return {
      data: parsed,
      usage: completion.usage || {},
      model: model,
      completionId: completion.id || null
    };
  } catch (error) {
    console.error(`[promptly] ❌ Groq call failed:`, error.message);
    throw error;
  }
}

/**
 * Chat completion that returns Text via Groq (Standardized with chatText interface)
 */
export async function chatTextGroq({ system, user, model, apiKey: overrideKey, temperature, minSimilarity, maxRetries }) {
  let client = groqClient;
  
  if (overrideKey) {
    client = new Groq({ apiKey: overrideKey, baseURL });
  }
  
  if (!client) {
    console.error("[promptly] ❌ Groq call blocked: Groq client not initialized (GROQ_API_KEY not set)");
    throw new GroqDisabledError();
  }
  
  console.log(`[promptly] 🚀 Starting Groq call - Model: ${model} (Text Mode)`);
  
  try {
    const completionParams = {
      model: model,
      temperature: temperature || 0.3,
      messages: [
        { role: "system", content: system || "" },
        { role: "user", content: user }
      ]
    };
    
    const startTime = Date.now();
    const completion = await client.chat.completions.create(completionParams);
    const duration = Date.now() - startTime;
    
    const content = completion.choices?.[0]?.message?.content || "";
    const tokensUsed = completion.usage?.total_tokens || 0;
    
    console.log(`[promptly] ✅ Groq call succeeded - Duration: ${duration}ms, Response: ${content.length} chars, Tokens: ${tokensUsed}`);
    
    // Similarity check is NOT implemented here yet as it depends on shared logic. 
    // For now, we return standard structure.
    
    return {
      text: content,
      usage: completion.usage || {},
      model: model,
      completionId: completion.id || null,
      similarity: 0 // Placeholder
    };
  } catch (error) {
    console.error(`[promptly] ❌ Groq call failed:`, error.message);
    throw error;
  }
}
