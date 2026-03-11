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
6. AMBIGUOUS TECHNICAL TERMS: A key word in the input has MULTIPLE VALID
   interpretations in context, and choosing the wrong one would lead the
   entire output in a fundamentally different direction.
   e.g. "blueprint" → Flask Blueprint? Render Blueprint (deploy config)? Generic template?
        "controller" → MVC controller? Game controller? Hardware controller?
        "pipeline" → CI/CD pipeline? Data pipeline? ML pipeline?
        "container" → Docker container? UI container? IoC container?
   If a term is central to the task AND has ≥2 plausible meanings in context, ASK.
   If context makes the meaning unambiguous (e.g. "Flask blueprint"), do NOT ask.
7. FRAMEWORK/TOOL NOT SPECIFIED: The user describes a technical task but never
   explicitly names the framework, language, or tool to use — and the choice
   would fundamentally change the output.
   e.g. "build an OAuth login system" → which framework? (Flask, Django, Express, etc.)
        "deploy via blueprint" → which blueprint system? (Flask, Render, Azure, etc.)
   If the user explicitly names a tool ("use Django"), do NOT ask.

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
  "通过blueprint来部署OAuth系统" → "blueprint" means what? Flask Blueprint? Render Blueprint? generic template?
  "build a login system with containers" → Docker? or UI layout containers?
  "set up a pipeline for my app" → CI/CD? data pipeline? ML pipeline?

needs_clarification = FALSE:
  "帮我写一份5分钟presentation的开场白，主题是AI在医疗领域的应用，听众是投资者"
  "write a Python function to parse CSV files with error handling"
  "帮我写一封请假邮件给老板，语气正式，请假3天"
  "explain recursion with simple examples for beginners"
  "help me write a cold email to a startup for a remote CS internship"
  "写一篇关于气候变化的高中英语作文，500字左右"
  "help me write an email to professor Smith, I'm sick today and can't make it to class"
  "help me write an absence email to my professor, caught a flu and might miss class today"
  "用Flask Blueprint来组织OAuth登录系统" → "Flask Blueprint" is explicit, no ambiguity
  "parse CSV with error handling in Python 3.9" → language, format, constraints clear

Detect the primary language of the user's input: "en", "zh", or "mixed".

Output JSON only — no explanation, no markdown:
{
  "needs_clarification": true | false,
  "ambiguity_score": 0.0-1.0,
  "language": "en" | "zh" | "mixed",
  "questions": [
    {
      "id": "short_snake_case_id",
      "question": "specific question referencing user's actual words",
      "options": [
        { "label": "Option A", "value": "option_a" },
        { "label": "Option B", "value": "option_b" },
        { "label": "Option C", "value": "option_c" },
        { "label": "Option D", "value": "option_d" }
      ]
    }
  ]
}

RULES FOR OPTIONS:
- Generate 3-5 options that are DIRECTLY RELEVANT to the user's specific input and context
- Options must be short labels (2-6 words max)
- ALWAYS include a final "Other" option: {"label": "Other / 其他", "value": "other"} for English+mixed, or {"label": "其他", "value": "other"} for Chinese
- For Chinese inputs, write option labels in Chinese
- Options should cover the most likely answers for that user's specific situation

If needs_clarification is false, questions MUST be an empty array [].`,
      user: input.trim(),
    });

    if (!data?.needs_clarification) {
      return { needsClarification: false, ambiguityScore: data?.ambiguity_score ?? 0, language: data?.language ?? 'en', questions: [] };
    }

    const questions = (data.questions ?? [])
      .filter(q => q?.id && q?.question && typeof q.question === "string")
      .map(q => ({
        id: q.id,
        question: q.question,
        options: Array.isArray(q.options) && q.options.length > 0 ? q.options : null,
      }))
      .slice(0, 3);

    // Guard: if LLM said needs_clarification but returned no valid questions,
    // generate default fallback questions instead of silently passing
    const lang = data?.language === "zh" ? "zh" : "en";
    if (questions.length === 0) {
      const defaultQuestions = lang === "zh" 
        ? [
            { id: "subject", question: "请具体说明你的任务主题或目标是什么？",
              options: [{label:"技术/编程",value:"tech"},{label:"商业/职场",value:"business"},{label:"教育/学术",value:"edu"},{label:"创意/写作",value:"creative"},{label:"其他",value:"other"}] },
            { id: "audience", question: "这个 Prompt 是给谁用的？",
              options: [{label:"我自己",value:"self"},{label:"学生/学员",value:"student"},{label:"团队/同事",value:"team"},{label:"客户/用户",value:"customer"},{label:"其他",value:"other"}] },
            { id: "context", question: "任务背景或领域是什么？",
              options: [{label:"技术/开发",value:"tech"},{label:"学术/研究",value:"academic"},{label:"商业/营销",value:"business"},{label:"教育/培训",value:"education"},{label:"其他",value:"other"}] }
          ]
        : [
            { id: "subject", question: "What is the specific topic or goal of your task?",
              options: [{label:"Tech / Coding",value:"tech"},{label:"Business / Work",value:"business"},{label:"Education / Study",value:"edu"},{label:"Creative / Writing",value:"creative"},{label:"Other",value:"other"}] },
            { id: "audience", question: "Who will use this prompt?",
              options: [{label:"Myself",value:"self"},{label:"Students",value:"student"},{label:"Team / Colleagues",value:"team"},{label:"Customers / Users",value:"customer"},{label:"Other",value:"other"}] },
            { id: "context", question: "What is the domain or context?",
              options: [{label:"Software / Tech",value:"tech"},{label:"Academic / Research",value:"academic"},{label:"Business / Marketing",value:"business"},{label:"Education / Training",value:"education"},{label:"Other",value:"other"}] }
          ];
      return {
        needsClarification: true,
        ambiguityScore: data.ambiguity_score ?? 0.7,
        language: lang,
        questions: defaultQuestions,
      };
    }

    return {
      needsClarification: true,
      ambiguityScore: data.ambiguity_score ?? 0.7,
      language: lang,
      questions,
    };

  } catch (err) {
    // Ambiguity check errors must NEVER block the pipeline — fail open
    console.warn("[ambiguityDetector] Detection error (fail-open):", err.message);
    return { needsClarification: false, ambiguityScore: 0, language: 'en', questions: [] };
  }
}
