import OpenAI from "openai";

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

export async function chatJson({ system, user, model }) {
  if (!client) {
    throw new LlmDisabledError();
  }
  const usedModel = model || process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const completion = await client.chat.completions.create({
    model: usedModel,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ]
  });
  const content = completion.choices?.[0]?.message?.content || "{}";
  return JSON.parse(content);
}
