/**
 * inputValidator.js — Prompt Input Validation Module
 *
 * Standalone gate that runs BEFORE the pipeline.
 * Determines whether a raw user input is a legitimate prompt optimization request.
 *
 * A valid input MUST contain:
 *   1. ACTION INTENT  — what the user wants AI to do
 *   2. TASK OBJECT    — something concrete to act on
 *
 * This module is fully decoupled from pipeline logic.
 * Failure is always fail-open (never blocks the pipeline on error).
 */

import { chatJson } from "./llmRouter.js";

// ─── Config ───────────────────────────────────────────────────────────────────

const VALIDATOR_MODEL = {
  provider: "groq",
  model: "llama-3.1-8b-instant",
};

// ─── Rejection messages (≤ 20 words, same language as input) ─────────────────

const REJECT_MESSAGES = {
  en: "Promptly optimizes prompts. Tell me what you want AI to do — e.g. \"Write a cover letter for a software engineer role\".",
  zh: "Promptly 专注 Prompt 优化。请描述你想让 AI 做什么，例如「帮我写一封请假邮件给老板」。",
  mixed: "Promptly optimizes prompts / 专注 Prompt 优化。Describe a task for AI — e.g. \"Help me write an email to my professor asking for an extension\".",
};

// ─── Validator ────────────────────────────────────────────────────────────────

/**
 * @param {string} input
 * @returns {Promise<{ isValid: boolean, rejectReason: string|null, rejectMessage: string|null }>}
 */
export async function validatePromptInput(input) {
  if (!input || input.trim().length === 0) {
    return { isValid: false, rejectReason: "empty_input", rejectMessage: REJECT_MESSAGES.en };
  }

  try {
    const { data } = await chatJson({
      provider: VALIDATOR_MODEL.provider,
      model: VALIDATOR_MODEL.model,
      temperature: 0,
      system: `You are a classifier for a Prompt Optimization tool. Your job is to accept legitimate AI task requests and reject inputs that are NOT task requests at all.

═══════════════════════════════════════
GOLDEN RULE (override everything else)
═══════════════════════════════════════
If the input contains BOTH:
  (A) an explicit action verb: write, help me write, create, make, draft, explain,
      analyze, summarize, translate, review, generate, build, code, design, proofread...
  (B) a concrete task object: email, essay, code, letter, report, plan, message,
      prompt, function, presentation, outline, script, summary, reply...

→ it is ALWAYS VALID. No exceptions.
   Even if it contains emotional language, typos, or personal context — VALID.
   The user is asking AI to do something specific. That is exactly what this tool is for.

═══════════════════════════════════════
VALID — accept ALL of these
═══════════════════════════════════════
  "write a Python web scraper for e-commerce prices"
  "help me write an email to my professor, I'm feeling sick today and can't attend class"
  "help me write an email to professor Smith, I caught the flu and might miss class, sorry"
  "帮我写邮件给教授申请延期，语气要礼貌"
  "explain recursion with simple examples for beginners"
  "review my essay introduction for clarity and tone"
  "create a workout plan for a beginner with no equipment"
  "summarize this article into 3 bullet points"
  "draft an apology email to my client for the delay, I feel terrible about it"
  "help me write a cover letter, I'm really nervous about this job"
  "帮我写一下请假邮件，今天感冒了去不了课了，麻烦了"

═══════════════════════════════════════
INVALID — reject ONLY these patterns
═══════════════════════════════════════
Pure venting / emotion with NO task request:
  "完了我明天要presentation脑子一团浆糊"       → pure_emotion
  "这个人讲话太绕了我根本听不懂他说啥"         → pure_emotion
  "我朋友圈一刷就焦虑，根本停不下来"            → pure_emotion
  "9点 迟到 again 完蛋了"                       → pure_emotion

Scattered keywords — no verb, no sentence:
  "internship cs remote no sponsor maybe startup" → keyword_fragment
  "GPA 3.5 body better social life all together"  → keyword_fragment
  "coffee rain focus python deadline panic"        → keyword_fragment

No action intent — describes a situation, does not ask AI to do anything:
  "食堂全是垃圾吃的 我怎么减脂增肌"             → no_action_intent  [no concrete AI task]
  "想做一个很压抑很脏很工业的小游戏"             → no_action_intent  [vague wish, no task]

Abstract feeling / meta request:
  "我想要那种感觉，就是很稳，很强，不慌"         → abstract_feeling
  "让AI把我说不清楚的话变成我真正想说的话"       → product_idea

═══════════════════════════════════════
LANGUAGE DETECTION — critical accuracy
═══════════════════════════════════════
Detect the PRIMARY language of the input based on the ACTION VERB and main sentence structure:
  - Input has English verbs / English main clause → "en"  (even if it mentions Chinese names or has some Chinese words)
  - Input is primarily Chinese characters → "zh"
  - Genuinely mixed sentence structure → "mixed"
  - Other → "other"

IMPORTANT: An input like "help me write an email to professor Narasimhan, feeling sick today"
→ language = "en" (English verb + English sentence structure)

═══════════════════════════════════════
REJECTION MESSAGE RULES
═══════════════════════════════════════
When rejecting, write a "reject_message" that:
- MUST be written in the EXACT SAME LANGUAGE as the language field you detected
  (if language = "en" → write ONLY English; if "zh" → write ONLY Chinese)
- Quotes the specific part of THEIR input that caused rejection
- Explains in 1 sentence why it is not a task for AI
- Gives ONE concrete rewrite example
- Is friendly, not condescending

Example for language="zh": "你说的「明天presentation脑子一团浆糊」看起来是情绪宣泄，没有说明你希望AI具体做什么。可以改成：「帮我写一份5分钟presentation的开场白，主题是XX」。"
Example for language="en": "'internship cs remote no sponsor' are scattered keywords, not a task for AI. Try: 'Help me write a cold email to a startup for a remote CS internship'."

Output JSON only — no explanation, no markdown:
{
  "is_valid": true | false,
  "language": "en" | "zh" | "mixed" | "other",
  "reject_reason": null | "pure_emotion" | "keyword_fragment" | "no_action_intent" | "abstract_feeling" | "product_idea",
  "reject_message": null | "<specific explanation in the detected language only>"
}`,
      user: input.trim(),
    });

    if (data?.is_valid === true) {
      return { isValid: true, rejectReason: null, rejectMessage: null };
    }

    const lang = data?.language === "zh"
      ? "zh"
      : data?.language === "mixed"
      ? "mixed"
      : "en";

    // Prefer LLM-generated specific message; fall back to static template
    const rejectMessage = (data?.reject_message && data.reject_message.trim())
      ? data.reject_message.trim()
      : REJECT_MESSAGES[lang];

    return {
      isValid: false,
      rejectReason: data?.reject_reason ?? "no_action_intent",
      rejectMessage,
      language: lang,
    };

  } catch (err) {
    // Validator errors must never block the pipeline — fail open
    console.warn("[inputValidator] Validation error (fail-open):", err.message);
    return { isValid: true, rejectReason: null, rejectMessage: null };
  }
}
