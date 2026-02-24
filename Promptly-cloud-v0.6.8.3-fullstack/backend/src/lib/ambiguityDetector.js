/**
 * ambiguityDetector.js — Input Ambiguity Detection Module
 *
 * Detects whether a user's prompt optimization request lacks CRITICAL CONTEXT
 * that would cause hallucination or produce a generic, off-target output.
 *
 * Runs AFTER input validation (Stage 0), BEFORE Spec Builder (Stage 1).
 * Fail-open: any error returns needsClarification=false (pipeline continues).
 *
 * Quality mandate: we ask BEFORE generating, never guess.
 */

import { chatJson } from "./llmRouter.js";

const DETECTOR_MODEL = {
  provider: "groq",
  model: "llama-3.1-8b-instant",
};

/**
 * @param {string} input
 * @returns {Promise<{
 *   needsClarification: boolean,
 *   ambiguityScore: number,
 *   questions: Array<{ id: string, question: string }>
 * }>}
 */
export async function detectAmbiguity(input) {
  if (!input || input.trim().length === 0) {
    return { needsClarification: false, ambiguityScore: 0, questions: [] };
  }

  try {
    const { data } = await chatJson({
      provider: DETECTOR_MODEL.provider,
      model: DETECTOR_MODEL.model,
      temperature: 0,
      system: `You are a context-completeness checker for a Prompt Optimization tool.

Your job: decide if the user's input has ENOUGH CONTEXT to produce a high-quality
optimized prompt without hallucinating missing details — or if critical context
is missing that would cause the output to be generic, wrong, or off-target.

═══════════════════════════════════════
WHEN TO ASK (needs_clarification = true)
═══════════════════════════════════════
1. Input contains explicit placeholders: "XX", "XXX", "某某", "[topic]", "某个话题"
2. The core subject/topic of the task is completely unspecified
   e.g. "write a cover letter" → for what job? what company? → MUST ask
3. The task is so broad that 10 different users would produce 10 completely
   different and equally valid prompts with no shared direction
4. Audience or recipient would change the output direction DRASTICALLY
   and is not mentioned at all
5. Key context fields are missing (CRITICAL FIELDS):
   - What is the concrete topic/subject/goal?
   - Who is the audience or recipient?
   - What's the primary context/domain (e.g., "tech", "academic", "business")?
   - If missing — ASK, even if a vague hint exists

═══════════════════════════════════════
WHEN NOT TO ASK (needs_clarification = false)
═══════════════════════════════════════
- BOTH subject AND audience/context are explicitly stated
  e.g. "write a cover letter for a Software Engineer role at AWS" → specific job, company
       "explain quantum computing to high school students" → clear audience level
- Technical task with FULL constraints stated
  e.g. "parse CSV with error handling in Python 3.9" → language, format, constraints clear
- The input is already detailed and complete (>80 words with specifics)
- Missing details are ONLY stylistic preferences (tone, color, exact word choice)
  NOT structural requirements (topic, audience, domain)

REMEMBER: When in doubt → ASK. We optimize for QUALITY, not convenience.
If asking could prevent hallucination, ALWAYS ask.

═══════════════════════════════════════
QUESTION RULES (when asking)
═══════════════════════════════════════
- Write questions in the SAME LANGUAGE as the user's input
- Maximum 3 questions — only the questions with HIGHEST IMPACT on quality
- Each question must be SPECIFIC: reference the actual words/context from their input
- Questions must be quick to answer — avoid open-ended essay prompts
- If a placeholder is detected ("XX", "[X]"), ALWAYS ask for the actual value
- Do NOT ask about things that are stylistic preferences (font, color, exact wording)

AMBIGUITY SCORE GUIDANCE:
  0.0–0.55 → clear enough, don't ask
  0.56–0.74 → ask ONLY if a critical structural field (topic/audience) is missing
  0.75–1.0 → definitely ask

═══════════════════════════════════════
EXAMPLES
═══════════════════════════════════════
needs_clarification = TRUE:
  "帮我写一份presentation" → topic? audience? goal? (3 major unknowns)
  "write a cover letter" → job title? company? (topic is completely missing)
  "帮我写邮件" → recipient? purpose? (two critical unknowns)
  "explain this concept to my team" → what concept? what team background?
  "帮我写一份5分钟presentation的开场白，主题是XX" → placeholder: what is the actual topic?

needs_clarification = FALSE:
  "帮我写一份5分钟presentation的开场白，主题是AI在医疗领域的应用，听众是投资者"
  "write a Python function to parse CSV files with error handling"
  "帮我写一封请假邮件给老板，语气正式，请假3天"
  "explain recursion with simple examples for beginners"
  "help me write a cold email to a startup for a remote CS internship"
  "写一篇关于气候变化的高中英语作文，500字左右"

Detect the primary language of the user's input: "en", "zh", or "mixed".

Output JSON only — no explanation, no markdown:
{
  "needs_clarification": true | false,
  "ambiguity_score": 0.0-1.0,
  "language": "en" | "zh" | "mixed",
  "questions": [
    { "id": "short_snake_case_id", "question": "specific question referencing user's actual words" }
  ]
}

If needs_clarification is false, questions MUST be an empty array [].`,
      user: input.trim(),
    });

    if (!data?.needs_clarification) {
      return { needsClarification: false, ambiguityScore: data?.ambiguity_score ?? 0, questions: [] };
    }

    const questions = (data.questions ?? [])
      .filter(q => q?.id && q?.question && typeof q.question === "string")
      .slice(0, 3);

    // Guard: if LLM said needs_clarification but returned no valid questions,
    // generate default fallback questions instead of silently passing
    if (questions.length === 0) {
      const lang = data?.language === "zh" ? "zh" : "en";
      const defaultQuestions = lang === "zh" 
        ? [
            { id: "subject", question: "请具体说明你的任务主题或目标是什么？" },
            { id: "audience", question: "这个 prompt 是给谁用的？（目标受众或使用者）" },
            { id: "context", question: "任务背景或领域是什么？（如：技术、学术、商业等）" }
          ]
        : [
            { id: "subject", question: "What is the specific topic or goal of your task?" },
            { id: "audience", question: "Who will use this prompt? (target audience or users)" },
            { id: "context", question: "What is the domain or context? (e.g., tech, academic, business)" }
          ];
      return {
        needsClarification: true,
        ambiguityScore: data.ambiguity_score ?? 0.7,
        questions: defaultQuestions,
      };
    }

    return {
      needsClarification: true,
      ambiguityScore: data.ambiguity_score ?? 0.7,
      questions,
    };

  } catch (err) {
    // Ambiguity check errors must NEVER block the pipeline — fail open
    console.warn("[ambiguityDetector] Detection error (fail-open):", err.message);
    return { needsClarification: false, ambiguityScore: 0, questions: [] };
  }
}
