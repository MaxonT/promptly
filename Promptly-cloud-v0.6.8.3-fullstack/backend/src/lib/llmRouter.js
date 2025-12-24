import { chatJson as chatJsonOpenAI } from "./openaiClient.js";
import { chatJsonGroq } from "./groqClient.js";

/**
 * Route LLM calls to the appropriate provider
 */
export async function chatJson({ system, user, model, promptlyModelId, provider = 'openai', apiKey, maxTokens, temperature }) {
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
    // We pass extra params even if openaiClient might not use all of them yet (though we updated it to use them)
    // Note: openaiClient.js might need to be reverted to not handle 'groq' provider internally anymore
    return chatJsonOpenAI({
      system,
      user,
      model,
      promptlyModelId,
      provider: 'openai', // Force provider to openai
      apiKey,
      maxTokens,
      temperature
    });
  }
}
