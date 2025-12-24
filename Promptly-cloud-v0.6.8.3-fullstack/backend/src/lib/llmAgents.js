import { z } from "zod";
import { chatJson } from "./llmRouter.js";
import { createRun, completeRunSuccess, completeRunFailure } from "./runLogger.js";
import { buildRunMetrics } from "./metricsEngine.js";

/**
 * Language mapping for LLM instructions
 */
const LANGUAGE_MAP = {
  'en': 'English',
  'zh-CN': 'Simplified Chinese (简体中文)',
  'es': 'Spanish (Español)',
  'fr': 'French (Français)',
  'ja': 'Japanese (日本語)',
  'ar': 'Arabic (العربية)',
  'ko': 'Korean (한국어)',
  'pt': 'Portuguese (Português)',
  'hi': 'Hindi (हिन्दी)'
};

/**
 * Generate language instruction for LLM system prompt
 * @param {string} language - Language code (e.g., 'zh-CN', 'es')
 * @returns {string} - Language instruction for system prompt
 */
function getLanguageInstruction(language) {
  if (!language || language === 'en') {
    return ""; // No special instruction for English (default)
  }
  
  const languageName = LANGUAGE_MAP[language] || 'English';
  return `🌍 CRITICAL LANGUAGE REQUIREMENT - HIGHEST PRIORITY 🌍
YOU MUST GENERATE ALL OUTPUT CONTENT IN ${languageName}.
This is MANDATORY and OVERRIDES any examples shown below.

REQUIRED LANGUAGE FOR:
- All text fields in the spec (project_goal, objectives, requirements, target_users, etc.)
- The explanation field
- Any descriptions, labels, or user-facing text
- ALL natural language content

EXCEPTIONS (keep in English):
- Technical terms: React, API, database, Node.js, PostgreSQL, JWT, etc.
- Code syntax and technical stack names
- Technical abbreviations: CRUD, HTTP, REST, etc.

⚠️ IMPORTANT: The JSON format examples below are for STRUCTURE ONLY.
DO NOT copy the language from the examples - use ${languageName} instead!`;
}

const BroadQuestionSchema = z.object({
  id: z.string().optional(),
  axis: z.string(),
  question: z.string(),
  rationale: z.string().optional()
});

const AgentAOutputSchema = z.object({
  broad_questions: z.array(BroadQuestionSchema).min(3)
});

const OptionSchema = z.object({
  id: z.string().optional(),
  label: z.string(),
  value: z.string(),
  is_other: z.boolean().optional()
});

const DepthLevelSchema = z.object({
  label: z.string(),
  options: z.array(OptionSchema)
});

const ChoiceQuestionSchema = z.object({
  id: z.string().optional(),
  type: z.enum(["single_choice", "multi_choice", "yes_no"]),
  content: z.string(),
  depth_enabled: z.boolean(),
  // For regular questions (depth_enabled: false)
  options: z.array(OptionSchema).optional(),
  // For depth-enabled questions (depth_enabled: true)
  depth_question: z.string().optional(),
  depth_levels: z.object({
    instant: DepthLevelSchema,
    standard: DepthLevelSchema,
    deep: DepthLevelSchema
  }).optional()
});

const AgentBOutputSchema = z.object({
  choice_questions: z.array(ChoiceQuestionSchema).min(3)
});

const AgentCOutputSchema = z.object({
  intent: z.record(z.any()).nullish(),  // Allow null, undefined, or object
  spec: z.record(z.any()),
  explanation: z.string()
});

export async function generateBroadQuestions({ initialDescription, kind, modeProfile = null, model = null, language = 'en' }) {
  const system = [
    "You are Agent A in Promptly's Question Engine.",
    "Goal: from a fuzzy project idea, propose 8-12 broad clarification axes.",
    "IMPORTANT: Return ONLY valid JSON, no other text.",
    "",
    getLanguageInstruction(language),
    language && language !== 'en' ? "" : "",
    modeProfile
      ? `Runtime mode: ${modeProfile.label} (${modeProfile.hierarchy}). Use about ${modeProfile.chainLength} chained thoughts, and cap at ${modeProfile.maxSteps} reasoning steps to honor this profile. Prioritize ${modeProfile.description.toLowerCase()}.`
      : "",
    "Required JSON format (structure only - content MUST be in the required language):",
    "{",
    '  "broad_questions": [',
    '    {',
    '      "id": "axis_1",',
    '      "axis": "Target Users",',
    '      "question": "Who are the primary users of this project?",',
    '      "rationale": "Understanding the target audience helps define features and UX"',
    '    },',
    '    {',
    '      "id": "axis_2",',
    '      "axis": "Platform",',
    '      "question": "What platform(s) will this project run on?",',
    '      "rationale": "Determines technology stack and deployment strategy"',
    '    }',
    '  ]',
    "}",
    "",
    "⚠️ CRITICAL LANGUAGE REQUIREMENT:",
    "The JSON structure above is for FORMAT ONLY. You MUST generate ALL text content (axis names, questions, rationale) in the language specified at the top of this prompt.",
    "Do NOT use English for the actual content - use the required language for all natural language fields.",
    "",
    "RULES:",
    "1. Every question MUST have 'axis', 'question' fields (required).",
    "2. 'id' and 'rationale' are optional but recommended.",
    "3. Cover diverse dimensions: users, platform, data, features, constraints, security, performance, etc.",
    "4. Generate 8-12 questions.",
    "5. Keep questions broad and exploratory.",
    "6. ⚠️ MOST IMPORTANT: All text content MUST be in the required language, NOT English!"
  ].join("\n");
  const user = JSON.stringify({
    initial_description: initialDescription,
    kind: kind || null,
    mode_profile: modeProfile
  });

  const usedModel = model || process.env.OPENAI_MODEL || "qwen-2.5-72b-instruct";
  const runId = createRun({
    model: usedModel,
    inputBlocks: { agent: "A", initial_description: initialDescription, kind, mode: modeProfile?.id }
  });

  let raw;
  let parsed;
  let retryCount = 0;
  const MAX_RETRIES = 2;
  
  // Retry loop for stability
  while (retryCount <= MAX_RETRIES) {
    try {
      const start = Date.now();
      const response = await chatJson({ system, user, model: usedModel });
      raw = response.data;
      const runMetrics = buildRunMetrics({
        latencyMs: Date.now() - start,
        usage: response.usage,
        modeProfile
      });

      // Auto-fix: Clean and normalize the response
      if (raw && raw.broad_questions && Array.isArray(raw.broad_questions)) {
        raw.broad_questions = raw.broad_questions.map(q => ({
          id: q.id ? q.id.toString().trim() : undefined,
          axis: q.axis ? q.axis.toString().trim() : '',
          question: q.question ? q.question.toString().trim() : '',
          rationale: q.rationale ? q.rationale.toString().trim() : undefined
        }));
      }
      
      completeRunSuccess(runId, raw, { metrics: runMetrics });
      parsed = AgentAOutputSchema.parse(raw);
      break; // Success, exit retry loop
    } catch (err) {
      retryCount++;
      console.warn(`[promptly] Agent A attempt ${retryCount}/${MAX_RETRIES + 1} failed:`, err.message);
      
      if (retryCount > MAX_RETRIES) {
        console.error("[promptly] generateBroadQuestions failed after retries");
        console.error("Error:", err.message);
        if (err.name === 'ZodError' && raw) {
          console.error("Validation errors:", JSON.stringify(err.errors, null, 2));
          console.error("Raw LLM response:", JSON.stringify(raw, null, 2));
        }
        completeRunFailure(runId, "runtime_exception", err.message || err.toString(), "system");
        throw err;
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  if (!parsed) {
    throw new Error("Failed to generate broad questions after retries");
  }
  
  console.log(`[promptly] Agent A generated ${parsed.broad_questions.length} questions successfully`);
  return parsed.broad_questions.map((q, index) => ({
    id: q.id || `axis_${index + 1}`,
    axis: q.axis,
    question: q.question,
    rationale: q.rationale || ""
  }));
}

// Helper: Clean and normalize option data
function cleanOption(opt) {
  if (typeof opt === 'string') {
    // Convert string to proper option object
    return {
      label: opt.trim(),
      value: opt.toLowerCase().replace(/\s+/g, '_').trim()
    };
  }
  if (typeof opt === 'object' && opt !== null) {
    return {
      label: (opt.label || opt.value || '').toString().trim(),
      value: (opt.value || opt.label || '').toString().trim(),
      is_other: opt.is_other === true
    };
  }
  return null;
}

// Helper: Clean and validate options array
function cleanOptionsArray(options) {
  if (!Array.isArray(options)) return [];
  
  const cleaned = options
    .map(cleanOption)
    .filter(opt => opt !== null && opt.label && opt.value);
  
  // Ensure "Other" option exists
  const hasOther = cleaned.some(opt => opt.is_other === true);
  if (!hasOther) {
    cleaned.push({
      label: "Other (please specify)",
      value: "other",
      is_other: true
    });
  }
  
  return cleaned;
}

export async function generateChoiceQuestions({ initialDescription, kind, broadQuestions, modeProfile = null, model = null, language = 'en', inferenceConfig = null }) {
  const system = [
    "You are Agent B in Promptly's Question Engine.",
    "Goal: convert broad axes into concrete, user-friendly questions with depth levels.",
    "IMPORTANT: Return ONLY valid JSON, no other text.",
    "",
    getLanguageInstruction(language),
    language && language !== 'en' ? "" : "",
    modeProfile
      ? `Runtime mode: ${modeProfile.label} (${modeProfile.hierarchy}). Use about ${modeProfile.chainLength} chained thoughts and no more than ${modeProfile.maxSteps} planning hops to balance speed/quality as described: ${modeProfile.description}.`
      : "",
    "⚠️ CRITICAL RULES - MUST FOLLOW:",
    "1. EVERY question MUST provide multiple-choice options (3-6 options minimum) ⚠️",
    "2. NO questions without options - this will cause errors! ⚠️",
    "3. ALWAYS include an 'Other (please specify)' option with 'is_other': true ⚠️",
    "4. If depth_enabled is false: 'options' array is REQUIRED",
    "5. If depth_enabled is true: all 3 depth levels MUST have options arrays",
    "",
    "CORE PRINCIPLES:",
    "- Make professional/technical questions accessible with depth levels",
    "",
    "DEPTH SYSTEM:",
    "For complex/professional topics, offer 3 depth levels:",
    "- ⚡ Instant (Beginner/Quick): Simple, straightforward options",
    "- 🔍 Standard (Intermediate): More nuanced options for general users",
    "- 🧠 Deep Thinking (Advanced): Detailed options for experts",
    "",
    "Required JSON format (structure only - content MUST be in the required language):",
    "{",
    '  "choice_questions": [',
    '    {',
    '      "id": "q1",',
    '      "type": "single_choice",',
    '      "content": "What is the primary platform for your project?",',
    '      "depth_enabled": false,',
    '      "options": [',
    '        {"label": "Web Application", "value": "web"},',
    '        {"label": "Mobile App (iOS/Android)", "value": "mobile"},',
    '        {"label": "Desktop Application", "value": "desktop"},',
    '        {"label": "Cross-platform (Multiple)", "value": "cross_platform"},',
    '        {"label": "Other (please specify)", "value": "other", "is_other": true}',
    '      ]',
    '    },',
    '    {',
    '      "id": "q2",',
    '      "type": "single_choice",',
    '      "content": "What monetization strategy do you plan to use?",',
    '      "depth_enabled": true,',
    '      "depth_question": "Choose your answer depth:",',
    '      "depth_levels": {',
    '        "instant": {',
    '          "label": "⚡ Instant (Simple & Quick)",',
    '          "options": [',
    '            {"label": "Free to use", "value": "free"},',
    '            {"label": "One-time purchase", "value": "paid"},',
    '            {"label": "Subscription", "value": "subscription"},',
    '            {"label": "Advertising", "value": "ads"},',
    '            {"label": "Other (please specify)", "value": "other", "is_other": true}',
    '          ]',
    '        },',
    '        "standard": {',
    '          "label": "🔍 Standard (Balanced)",',
    '          "options": [',
    '            {"label": "Free + Optional paid features", "value": "freemium"},',
'            {"label": "One-time purchase + DLC/expansions", "value": "paid_dlc"},',
    '            {"label": "Monthly/yearly subscription", "value": "subscription"},',
    '            {"label": "Ads + Option to remove ads", "value": "ads_removable"},',
    '            {"label": "Other (please specify)", "value": "other", "is_other": true}',
    '          ]',
    '        },',
    '        "deep": {',
    '          "label": "🧠 Deep Thinking (Advanced)",',
    '          "options": [',
    '            {"label": "Microtransactions (cosmetics, QoL)", "value": "microtransactions"},',
    '            {"label": "SaaS model with tiered pricing", "value": "saas_tiered"},',
    '            {"label": "Hybrid (IAP + Subscription + Ads)", "value": "hybrid"},',
    '            {"label": "Marketplace/transaction fees", "value": "marketplace"},',
    '            {"label": "Usage-based pricing", "value": "usage_based"},',
    '            {"label": "Other (please specify)", "value": "other", "is_other": true}',
    '          ]',
    '        }',
    '      }',
    '    },',
    '    {',
    '      "id": "q3",',
    '      "type": "multi_choice",',
    '      "content": "Which key features are essential? (Select all that apply)",',
    '      "depth_enabled": false,',
    '      "options": [',
    '        {"label": "User authentication & profiles", "value": "auth"},',
    '        {"label": "Real-time updates/notifications", "value": "realtime"},',
    '        {"label": "Data export/import", "value": "data_portability"},',
    '        {"label": "Team collaboration", "value": "collaboration"},',
    '        {"label": "Analytics/reporting", "value": "analytics"},',
    '        {"label": "Other (please specify)", "value": "other", "is_other": true}',
    '      ]',
    '    }',
    '  ]',
    "}",
    "",
    "⚠️ CRITICAL LANGUAGE REQUIREMENT:",
    "The JSON structure and examples above are for FORMAT ONLY. You MUST generate ALL text content (questions, labels, depth level names) in the language specified at the top of this prompt.",
    "Do NOT use English for the actual content - use the required language for all natural language fields.",
    "",
    "RULES:",
    "1. Every question MUST have: 'id', 'type', 'content', 'depth_enabled' (all required).",
    "2. ⚠️ CRITICAL: If depth_enabled is false, 'options' array is MANDATORY (3-6 options + 'Other').",
    "3. ⚠️ CRITICAL: If depth_enabled is true, ALL 3 depth levels MUST have options arrays.",
    "4. depth_levels must have 'instant', 'standard', 'deep' keys, each with 'label' and 'options'.",
    "5. Each option list must have 3-6 options + mandatory 'Other' option.",
    "6. 'Other' option format: {\"label\": \"Other (please specify)\", \"value\": \"other\", \"is_other\": true}.",
    "7. ⚠️ NEVER generate a question without options - system will reject it!",
    "8. Use depth_enabled for: monetization, technical architecture, user segments, compliance, scaling.",
    "9. Use regular options for: platform choice, basic yes/no, feature selection.",
    "10. Question types: 'single_choice' (pick one), 'multi_choice' (pick many).",
    "11. Generate 5-8 diverse questions. About 30-40% should be depth_enabled.",
    "12. Make options specific, actionable, and mutually exclusive.",
    "13. Use simple, clear language in question content.",
    "14. ⚠️ VALIDATE: Before returning, ensure EVERY question has options!"
  ].join("\n");
  const user = JSON.stringify({
    initial_description: initialDescription,
    kind: kind || null,
    broad_questions: broadQuestions,
    mode_profile: modeProfile
  });

  // Strict Inference Policy Application
  let usedModel = model || process.env.OPENAI_MODEL || "qwen-2.5-72b-instruct";
  let provider = 'openai';
  let apiKey = undefined;
  let maxTokens = undefined;
  let temperature = undefined;

  if (inferenceConfig) {
    usedModel = inferenceConfig.model;
    provider = inferenceConfig.provider;
    // Inject API Key based on policy
    if (inferenceConfig.envKey && process.env[inferenceConfig.envKey]) {
      apiKey = process.env[inferenceConfig.envKey];
    }
    maxTokens = inferenceConfig.maxTokens;
    temperature = inferenceConfig.temperature;
    console.log(`[promptly] 🔒 Applied Strict Inference Config for Agent B: ${provider}/${usedModel}`);
  }

  const runId = createRun({
    model: usedModel,
    inputBlocks: { agent: "B", initial_description: initialDescription, kind, broad_questions: broadQuestions, mode: modeProfile?.id }
  });

  let raw;
  let parsed;
  let retryCount = 0;
  const MAX_RETRIES = 2;
  
  // Retry loop for stability
  while (retryCount <= MAX_RETRIES) {
    try {
      const start = Date.now();
      const response = await chatJson({ 
        system, 
        user, 
        model: usedModel,
        provider,
        apiKey,
        maxTokens,
        temperature
      });
      raw = response.data;
      const runMetrics = buildRunMetrics({
        latencyMs: Date.now() - start,
        usage: response.usage,
        modeProfile
      });
      
      // Auto-fix: Clean and normalize the response
      if (raw && raw.choice_questions && Array.isArray(raw.choice_questions)) {
        raw.choice_questions = raw.choice_questions.map(q => {
          // Clean content field
          if (q.content) {
            q.content = q.content.toString().trim();
          }
          
          // Clean regular options
          if (q.options && Array.isArray(q.options)) {
            q.options = cleanOptionsArray(q.options);
          }
          
          // Clean depth level options
          if (q.depth_levels) {
            ['instant', 'standard', 'deep'].forEach(level => {
              if (q.depth_levels[level] && q.depth_levels[level].options) {
                q.depth_levels[level].options = cleanOptionsArray(q.depth_levels[level].options);
              }
            });
          }
          
          return q;
        });
      }
      
      completeRunSuccess(runId, raw, { metrics: runMetrics });
      parsed = AgentBOutputSchema.parse(raw);
      break; // Success, exit retry loop
    } catch (err) {
      retryCount++;
      console.warn(`[promptly] Agent B attempt ${retryCount}/${MAX_RETRIES + 1} failed:`, err.message);
      
      if (retryCount > MAX_RETRIES) {
        // All retries exhausted
        console.error("[promptly] generateChoiceQuestions failed after retries");
        console.error("Error:", err.message);
        if (err.name === 'ZodError' && raw) {
          console.error("Validation errors:", JSON.stringify(err.errors, null, 2));
          console.error("Raw LLM response:", JSON.stringify(raw, null, 2));
        }
        completeRunFailure(runId, "runtime_exception", err.message || err.toString(), "system");
        throw err;
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  if (!parsed) {
    throw new Error("Failed to generate choice questions after retries");
  }

  try {
    // Post-validation: ENFORCE that every question has options (enhanced stability)
    const validatedQuestions = parsed.choice_questions.map((q, index) => {
      const qid = q.id || `q_${index + 1}`;
      
      // Clean and trim content
      if (q.content) {
        q.content = q.content.toString().trim();
      }
      
      // Additional format fixes
      if (!q.content || q.content.length === 0) {
        q.content = `Question ${index + 1}`;
        console.warn(`[promptly] Question ${qid} has empty content, using fallback`);
      }
      
      // Check if question has valid options
      const hasValidOptions = q.depth_enabled 
        ? (q.depth_levels?.instant?.options?.length >= 3 &&
           q.depth_levels?.standard?.options?.length >= 3 &&
           q.depth_levels?.deep?.options?.length >= 3)
        : (q.options && q.options.length >= 3);
      
      if (!hasValidOptions) {
        console.warn(`[promptly] Question ${qid} has insufficient options! Adding enhanced defaults.`);
        
        // Add contextual default options based on question content and type
        if (q.depth_enabled) {
          // For depth-enabled questions, add contextual depth levels
          q.depth_question = q.depth_question || "Choose your answer depth:";
          
          // Try to infer better defaults from question content
          const contentLower = q.content.toLowerCase();
          let baseOptions;
          
          if (contentLower.includes('platform') || contentLower.includes('device')) {
            baseOptions = {
              instant: ["Web", "Mobile", "Desktop"],
              standard: ["Responsive web app", "Native mobile (iOS/Android)", "Desktop application"],
              deep: ["Progressive web app (PWA)", "Hybrid mobile (React Native/Flutter)", "Cross-platform desktop (Electron)"]
            };
          } else if (contentLower.includes('user') || contentLower.includes('audience')) {
            baseOptions = {
              instant: ["General public", "Professionals", "Students"],
              standard: ["Consumers (18-35)", "Business professionals", "Academic researchers"],
              deep: ["Early adopters in tech", "Enterprise decision-makers", "Subject matter experts"]
            };
          } else if (contentLower.includes('feature') || contentLower.includes('function')) {
            baseOptions = {
              instant: ["Basic features", "Standard features", "Advanced features"],
              standard: ["Core functionality only", "Standard feature set", "Extended capabilities"],
              deep: ["MVP feature set", "Full-featured product", "Enterprise-grade suite"]
            };
          } else {
            // Generic fallback
            baseOptions = {
              instant: ["Simple approach", "Standard approach", "Advanced approach"],
              standard: ["Minimal implementation", "Balanced implementation", "Comprehensive implementation"],
              deep: ["Basic architecture", "Scalable architecture", "Enterprise-grade architecture"]
            };
          }
          
          q.depth_levels = {
            instant: {
              label: "⚡ Instant (Simple & Quick)",
              options: baseOptions.instant.map((label, i) => ({
                label,
                value: `instant_${i + 1}`
              })).concat([{label: "Other (please specify)", value: "other", is_other: true}])
            },
            standard: {
              label: "🔍 Standard (Balanced)",
              options: baseOptions.standard.map((label, i) => ({
                label,
                value: `standard_${i + 1}`
              })).concat([{label: "Other (please specify)", value: "other", is_other: true}])
            },
            deep: {
              label: "🧠 Deep Thinking (Advanced)",
              options: baseOptions.deep.map((label, i) => ({
                label,
                value: `deep_${i + 1}`
              })).concat([{label: "Other (please specify)", value: "other", is_other: true}])
            }
          };
        } else {
          // For regular questions, infer better defaults from content
          const contentLower = q.content.toLowerCase();
          
          if (contentLower.includes('how many') || contentLower.includes('size') || contentLower.includes('scale')) {
            q.options = [
              {label: "Small (1-10)", value: "small"},
              {label: "Medium (10-100)", value: "medium"},
              {label: "Large (100+)", value: "large"},
              {label: "Other (please specify)", value: "other", is_other: true}
            ];
          } else if (contentLower.includes('when') || contentLower.includes('timeline') || contentLower.includes('deadline')) {
            q.options = [
              {label: "ASAP (within 1 month)", value: "asap"},
              {label: "Short-term (1-3 months)", value: "short"},
              {label: "Medium-term (3-6 months)", value: "medium"},
              {label: "Long-term (6+ months)", value: "long"},
              {label: "Other (please specify)", value: "other", is_other: true}
            ];
          } else if (q.type === 'yes_no') {
            // Yes/No doesn't need options, skip
          } else {
            // Generic meaningful defaults
            q.options = [
              {label: "Yes", value: "yes"},
              {label: "No", value: "no"},
              {label: "Not sure / Need to decide", value: "undecided"},
              {label: "Other (please specify)", value: "other", is_other: true}
            ];
          }
        }
      }
      
      // Ensure "Other" option exists in all option arrays
      if (!q.depth_enabled && q.options && Array.isArray(q.options)) {
        const hasOther = q.options.some(opt => opt.is_other === true);
        if (!hasOther) {
          q.options.push({
            label: "Other (please specify)", 
            value: "other", 
            is_other: true
          });
        }
        // Filter out any invalid options
        q.options = q.options.filter(opt => opt && opt.label && opt.value);
      }
      
      // Ensure depth level options are clean
      if (q.depth_enabled && q.depth_levels) {
        ['instant', 'standard', 'deep'].forEach(level => {
          if (q.depth_levels[level] && q.depth_levels[level].options) {
            const opts = q.depth_levels[level].options;
            // Ensure "Other" exists
            const hasOther = opts.some(opt => opt.is_other === true);
            if (!hasOther) {
              opts.push({
                label: "Other (please specify)",
                value: "other",
                is_other: true
              });
            }
            // Filter out invalid options
            q.depth_levels[level].options = opts.filter(opt => opt && opt.label && opt.value);
          }
        });
      }
      
      return {
        id: qid,
        type: q.type,
        content: q.content,
        depth_enabled: q.depth_enabled,
        options: q.options || null,
        depth_question: q.depth_question || null,
        depth_levels: q.depth_levels || null
      };
    });
    
    console.log(`[promptly] Agent B generated ${validatedQuestions.length} questions successfully`);
    return validatedQuestions;
  } catch (err) {
    // This should not be reached due to retry loop, but keep as final safety net
    console.error("[promptly] generateChoiceQuestions fatal error");
    console.error("Error:", err.message);
    completeRunFailure(runId, "runtime_exception", err.message || err.toString(), "system");
    throw err;
  }
}

export async function generateRawSpec({ initialDescription, kind, qaPairs, modeProfile = null, model = null, language = 'en' }) {
  const system = [
    "You are Agent C in Promptly's Question Engine.",
    "You receive all questions and answers from a wizard.",
    "Your job: synthesize them into a structured specification.",
    "IMPORTANT: Return ONLY valid JSON, no other text.",
    "",
    getLanguageInstruction(language),
    language && language !== 'en' ? "" : "",  // Add blank line if language instruction exists
    "CRITICAL: The spec you generate must include:",
    "- All information from the initial description",
    "- All answers provided by the user in the wizard",
    "- The project kind/type if specified",
    "- Any constraints, requirements, or preferences mentioned",
    "",
    modeProfile
      ? `Runtime mode: ${modeProfile.label} (${modeProfile.hierarchy}). Use about ${modeProfile.chainLength} reasoning chains but cap at ${modeProfile.maxSteps} steps to match the desired depth: ${modeProfile.description}.`
      : "",
    "Required JSON format (structure only - content language MUST match the language requirement above):",
    "{",
    '  "spec": {',
    '    "project_goal": "<describe the main goal>",',
    '    "objectives": ["<objective 1>", "<objective 2>"],',
    '    "target_users": "<describe target users>",',
    '    "platform": "<platform description>",',
    '    "key_features": ["<feature 1>", "<feature 2>"],',
    '    "technical_stack": "<tech stack description>",',
    '    "constraints": ["<constraint 1>", "<constraint 2>"],',
    '    "data_model": "<data model description>",',
    '    "security": "<security description>",',
    '    "ui_ux": "<ui/ux description>"',
    '  },',
    '  "explanation": "<explanation in the required language>"',
    "}",
    "",
    "RULES:",
    "1. 'spec' field is REQUIRED and must be an object with relevant project details.",
    "2. 'explanation' field is REQUIRED and should summarize your reasoning.",
    "3. 'intent' field is OPTIONAL - omit it or set to null if not needed.",
    "4. Include keys like: project_goal, objectives, target_users, platform, key_features, technical_stack, constraints, etc.",
    "5. Be specific and actionable based on the Q&A responses.",
    "6. Structure the spec logically for a developer to implement.",
    "7. REMEMBER: All natural language content MUST be in the language specified at the top of this prompt!"
  ].join("\n");
  // Build comprehensive input for spec generation
  const userInput = {
    initial_description: initialDescription,
    kind: kind || null,
    qa_pairs: qaPairs,
    mode_profile: modeProfile ? {
      id: modeProfile.id,
      label: modeProfile.label,
      hierarchy: modeProfile.hierarchy
    } : null,
    model: model || null,
    // Include summary of answered questions for context
    answered_questions_count: qaPairs.filter(qa => qa.answer !== null).length,
    total_questions_count: qaPairs.length
  };
  
  const user = JSON.stringify(userInput);

  const usedModel = model || process.env.OPENAI_MODEL || "qwen-2.5-72b-instruct";
  const runId = createRun({
    model: usedModel,
    inputBlocks: { agent: "C", initial_description: initialDescription, kind, qa_pairs: qaPairs, mode: modeProfile?.id }
  });

  let raw;
  let parsed;
  let retryCount = 0;
  const MAX_RETRIES = 2;
  
  // Retry loop for stability
  while (retryCount <= MAX_RETRIES) {
    try {
      const start = Date.now();
      const response = await chatJson({ system, user, model: usedModel });
      raw = response.data;
      const runMetrics = buildRunMetrics({
        latencyMs: Date.now() - start,
        usage: response.usage,
        modeProfile
      });

      // Auto-fix: Clean and normalize the response
      if (raw) {
        // Ensure spec exists
        if (!raw.spec || typeof raw.spec !== 'object') {
          raw.spec = {};
        }
        
        // Ensure explanation exists
        if (!raw.explanation || typeof raw.explanation !== 'string') {
          raw.explanation = "Generated specification based on user requirements.";
        } else {
          raw.explanation = raw.explanation.trim();
        }
        
        // Clean intent field (can be null, undefined, or object)
        if (raw.intent === undefined) {
          delete raw.intent;
        }
        
        // CRITICAL FIX: Ensure all spec fields have meaningful defaults
        const spec = raw.spec;
        
        // Project goal - use initial description as fallback
        if (!spec.project_goal || typeof spec.project_goal !== 'string' || spec.project_goal.trim() === '') {
          spec.project_goal = initialDescription || "Build a comprehensive project based on user requirements";
        }
        
        // Objectives - ensure it's an array with at least one objective
        if (!Array.isArray(spec.objectives) || spec.objectives.length === 0) {
          spec.objectives = ["Define clear project objectives", "Implement core functionality", "Ensure quality and usability"];
        } else {
          // Filter out empty objectives
          spec.objectives = spec.objectives.filter(obj => obj && typeof obj === 'string' && obj.trim() !== '');
          if (spec.objectives.length === 0) {
            spec.objectives = ["Define clear project objectives", "Implement core functionality", "Ensure quality and usability"];
          }
        }
        
        // Target users - provide meaningful default
        if (!spec.target_users || typeof spec.target_users !== 'string' || spec.target_users.trim() === '') {
          spec.target_users = "General users seeking a well-designed solution";
        }
        
        // Platform - provide reasonable default
        if (!spec.platform || typeof spec.platform !== 'string' || spec.platform.trim() === '') {
          spec.platform = "Web application with responsive design";
        }
        
        // Key features - ensure it's an array with meaningful defaults
        if (!Array.isArray(spec.key_features) || spec.key_features.length === 0) {
          spec.key_features = ["User-friendly interface", "Core functionality implementation", "Quality assurance and testing"];
        } else {
          // Filter out empty features
          spec.key_features = spec.key_features.filter(feature => feature && typeof feature === 'string' && feature.trim() !== '');
          if (spec.key_features.length === 0) {
            spec.key_features = ["User-friendly interface", "Core functionality implementation", "Quality assurance and testing"];
          }
        }
        
        // Technical stack - provide sensible default
        if (!spec.technical_stack || typeof spec.technical_stack !== 'string' || spec.technical_stack.trim() === '') {
          spec.technical_stack = "Modern web technologies with industry best practices";
        }
        
        // Constraints - ensure it's an array
        if (!Array.isArray(spec.constraints)) {
          spec.constraints = [];
        } else {
          // Filter out empty constraints
          spec.constraints = spec.constraints.filter(constraint => constraint && typeof constraint === 'string' && constraint.trim() !== '');
        }
        
        // Data model - provide basic default
        if (!spec.data_model || typeof spec.data_model !== 'string' || spec.data_model.trim() === '') {
          spec.data_model = "Standard data structures appropriate for the project scope";
        }
        
        // Security - provide basic default
        if (!spec.security || typeof spec.security !== 'string' || spec.security.trim() === '') {
          spec.security = "Industry standard security practices and data protection";
        }
        
        // UI/UX - provide meaningful default
        if (!spec.ui_ux || typeof spec.ui_ux !== 'string' || spec.ui_ux.trim() === '') {
          spec.ui_ux = "Clean, intuitive, and user-friendly interface design";
        }
      }
      
      completeRunSuccess(runId, raw, { metrics: runMetrics });
      parsed = AgentCOutputSchema.parse(raw);
      
      // QUALITY SENTINEL: Fail fast if spec is low quality
      try {
        validateSpecQuality(parsed);
      } catch (qualityErr) {
        console.warn(`[promptly] ⚠️ Spec quality check failed: ${qualityErr.message}`);
        throw qualityErr; // Re-throw to trigger retry or failure
      }

      break; // Success, exit retry loop
    } catch (err) {
      retryCount++;
      console.warn(`[promptly] Agent C attempt ${retryCount}/${MAX_RETRIES + 1} failed:`, err.message);
      
      if (retryCount > MAX_RETRIES) {
        console.error("[promptly] generateRawSpec failed after retries");
        console.error("Error:", err.message);
        if (err.name === 'ZodError' && raw) {
          console.error("Validation errors:", JSON.stringify(err.errors, null, 2));
          console.error("Raw LLM response:", JSON.stringify(raw, null, 2));
        }
        completeRunFailure(runId, "runtime_exception", err.message || err.toString(), "system");
        throw err;
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  if (!parsed) {
    throw new Error("Failed to generate spec after retries");
  }
  
  console.log(`[promptly] Agent C generated spec successfully`);
  return parsed;
}
