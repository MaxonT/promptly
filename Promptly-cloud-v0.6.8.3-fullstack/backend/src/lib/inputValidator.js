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
      system: `You are a strict classifier for a Prompt Optimization tool.

RULE: A valid input MUST satisfy BOTH:
  1. ACTION INTENT — explicitly or strongly implies what the user wants AI to do
     (write, create, explain, analyze, summarize, translate, review, generate, help me with...)
  2. TASK OBJECT — something concrete to act on
     (email, code, essay, plan, explanation, outline, image prompt, function, report...)

VALID examples (accept these):
  "write a Python web scraper for e-commerce prices"
  "帮我写邮件给教授申请延期，语气要礼貌"
  "explain recursion with simple examples for beginners"
  "review my essay introduction for clarity and tone"
  "create a workout plan for a beginner with no equipment"
  "summarize this article into 3 bullet points"

INVALID examples (reject ALL of these):
  "完了我明天要presentation脑子一团浆糊"       → pure_emotion
  "这个人讲话太绕了我根本听不懂他说啥"         → pure_emotion
  "internship cs remote no sponsor maybe startup" → keyword_fragment
  "GPA 3.5 body better social life all together"  → keyword_fragment
  "coffee rain focus python deadline panic"        → keyword_fragment
  "食堂全是垃圾吃的 我怎么减脂增肌"             → no_action_intent
  "我朋友圈一刷就焦虑，根本停不下来"            → pure_emotion
  "need email prof 语气不要太卑微 but respectful ask extension"  → keyword_fragment
  "让AI把我说不清楚的话变成我真正想说的话"       → product_idea
  "想做一个很压抑很脏很工业的小游戏"             → no_action_intent
  "9点 迟到 again 完蛋了"                       → pure_emotion
  "我想要那种感觉，就是很稳，很强，不慌"         → abstract_feeling

Detect the primary language: "en", "zh", "mixed", or "other".

Output JSON only — no explanation, no markdown:
{
  "is_valid": true | false,
  "language": "en" | "zh" | "mixed" | "other",
  "reject_reason": null | "pure_emotion" | "keyword_fragment" | "no_action_intent" | "abstract_feeling" | "product_idea"
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

    return {
      isValid: false,
      rejectReason: data?.reject_reason ?? "no_action_intent",
      rejectMessage: REJECT_MESSAGES[lang],
    };

  } catch (err) {
    // Validator errors must never block the pipeline — fail open
    console.warn("[inputValidator] Validation error (fail-open):", err.message);
    return { isValid: true, rejectReason: null, rejectMessage: null };
  }
}
