import { z } from "zod";
import { chatJson } from "./openaiClient.js";
import { createRun, completeRunSuccess, completeRunFailure } from "./runLogger.js";

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

export async function generateBroadQuestions({ initialDescription, kind }) {
  const system = [
    "You are Agent A in Promptly's Question Engine.",
    "Goal: from a fuzzy project idea, propose 8-12 broad clarification axes.",
    "IMPORTANT: Return ONLY valid JSON, no other text.",
    "",
    "Required JSON format example:",
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
    "RULES:",
    "1. Every question MUST have 'axis', 'question' fields (required).",
    "2. 'id' and 'rationale' are optional but recommended.",
    "3. Cover diverse dimensions: users, platform, data, features, constraints, security, performance, etc.",
    "4. Generate 8-12 questions.",
    "5. Keep questions broad and exploratory."
  ].join("\n");
  const user = JSON.stringify({
    initial_description: initialDescription,
    kind: kind || null
  });
  
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const runId = createRun({
    model,
    inputBlocks: { agent: "A", initial_description: initialDescription, kind }
  });

  let raw;
  try {
    raw = await chatJson({ system, user });
    completeRunSuccess(runId, raw);
    const parsed = AgentAOutputSchema.parse(raw);
    return parsed.broad_questions.map((q, index) => ({
      id: q.id || `axis_${index + 1}`,
      axis: q.axis,
      question: q.question,
      rationale: q.rationale || ""
    }));
  } catch (err) {
    console.error("[promptly] generateBroadQuestions failed");
    console.error("Error:", err.message);
    if (err.name === 'ZodError' && raw) {
      console.error("Validation errors:", JSON.stringify(err.errors, null, 2));
      console.error("Raw LLM response:", JSON.stringify(raw, null, 2));
    }
    completeRunFailure(runId, "runtime_exception", err.message || err.toString(), "system");
    throw err;
  }
}

export async function generateChoiceQuestions({ initialDescription, kind, broadQuestions }) {
  const system = [
    "You are Agent B in Promptly's Question Engine.",
    "Goal: convert broad axes into concrete, user-friendly questions with depth levels.",
    "IMPORTANT: Return ONLY valid JSON, no other text.",
    "",
    "CORE PRINCIPLES:",
    "1. EVERY question MUST provide multiple-choice options (3-6 options minimum)",
    "2. NO open-ended questions without choices",
    "3. ALWAYS include an 'Other' option for custom input",
    "4. Make professional/technical questions accessible with depth levels",
    "",
    "DEPTH SYSTEM:",
    "For complex/professional topics, offer 3 depth levels:",
    "- ⚡ Instant (Beginner/Quick): Simple, straightforward options",
    "- 🔍 Standard (Intermediate): More nuanced options for general users",
    "- 🧠 Deep Thinking (Advanced): Detailed options for experts",
    "",
    "Required JSON format example:",
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
    "RULES:",
    "1. Every question MUST have: 'id', 'type', 'content', 'depth_enabled' (all required).",
    "2. If depth_enabled is false: provide 'options' array (3-6 options + 'Other').",
    "3. If depth_enabled is true: provide 'depth_question' and 'depth_levels' object.",
    "4. depth_levels must have 'instant', 'standard', 'deep' keys, each with 'label' and 'options'.",
    "5. Each depth level must have 3-6 options + 'Other' option.",
    "6. 'Other' option must have 'is_other': true.",
    "7. Use depth_enabled for: monetization, technical architecture, user segments, compliance, scaling strategies.",
    "8. Use regular options for: platform choice, basic yes/no, feature selection.",
    "9. Question types: 'single_choice' (pick one), 'multi_choice' (pick many), 'yes_no' (special case).",
    "10. Generate 5-8 diverse questions. About 30-40% should be depth_enabled.",
    "11. Make options specific, actionable, and mutually exclusive.",
    "12. Use simple, clear language in question content."
  ].join("\n");
  const user = JSON.stringify({
    initial_description: initialDescription,
    kind: kind || null,
    broad_questions: broadQuestions
  });

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const runId = createRun({
    model,
    inputBlocks: { agent: "B", initial_description: initialDescription, kind, broad_questions: broadQuestions }
  });

  let raw;
  try {
    raw = await chatJson({ system, user });
    completeRunSuccess(runId, raw);
    const parsed = AgentBOutputSchema.parse(raw);
    return parsed.choice_questions.map((q, index) => ({
      id: q.id || `q_${index + 1}`,
      type: q.type,
      content: q.content,
      depth_enabled: q.depth_enabled,
      // For regular questions
      options: q.options || null,
      // For depth-enabled questions
      depth_question: q.depth_question || null,
      depth_levels: q.depth_levels || null
    }));
  } catch (err) {
    console.error("[promptly] generateChoiceQuestions failed");
    console.error("Error:", err.message);
    if (err.name === 'ZodError' && raw) {
      console.error("Validation errors:", JSON.stringify(err.errors, null, 2));
      console.error("Raw LLM response:", JSON.stringify(raw, null, 2));
    }
    completeRunFailure(runId, "runtime_exception", err.message || err.toString(), "system");
    throw err;
  }
}

export async function generateRawSpec({ initialDescription, kind, qaPairs }) {
  const system = [
    "You are Agent C in Promptly's Question Engine.",
    "You receive all questions and answers from a wizard.",
    "Your job: synthesize them into a structured specification.",
    "IMPORTANT: Return ONLY valid JSON, no other text.",
    "",
    "Required JSON format example:",
    "{",
    '  "spec": {',
    '    "project_goal": "Build a task management app for small teams",',
    '    "objectives": ["Enable task creation and assignment", "Track progress", "Send notifications"],',
    '    "target_users": "Small teams (5-20 people) in tech companies",',
    '    "platform": "Web application (responsive)",',
    '    "key_features": ["Task CRUD", "User authentication", "Real-time updates", "Email notifications"],',
    '    "technical_stack": "React frontend, Node.js backend, PostgreSQL database",',
    '    "constraints": ["Must work on mobile browsers", "Max 500ms response time"],',
    '    "data_model": "Users, Teams, Tasks, Comments",',
    '    "security": "JWT authentication, role-based access control",',
    '    "ui_ux": "Clean, minimal interface with drag-and-drop"',
    '  },',
    '  "explanation": "This spec synthesizes the user\'s requirements into a cohesive plan. The focus is on simplicity and team collaboration."',
    "}",
    "",
    "RULES:",
    "1. 'spec' field is REQUIRED and must be an object with relevant project details.",
    "2. 'explanation' field is REQUIRED and should summarize your reasoning.",
    "3. 'intent' field is OPTIONAL - omit it or set to null if not needed.",
    "4. Include keys like: project_goal, objectives, target_users, platform, key_features, technical_stack, constraints, etc.",
    "5. Be specific and actionable based on the Q&A responses.",
    "6. Structure the spec logically for a developer to implement."
  ].join("\n");
  const user = JSON.stringify({
    initial_description: initialDescription,
    kind: kind || null,
    qa_pairs: qaPairs
  });

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const runId = createRun({
    model,
    inputBlocks: { agent: "C", initial_description: initialDescription, kind, qa_pairs: qaPairs }
  });

  let raw;
  try {
    raw = await chatJson({ system, user });
    completeRunSuccess(runId, raw);
    const parsed = AgentCOutputSchema.parse(raw);
    return parsed;
  } catch (err) {
    console.error("[promptly] generateRawSpec failed");
    console.error("Error:", err.message);
    if (err.name === 'ZodError' && raw) {
      console.error("Validation errors:", JSON.stringify(err.errors, null, 2));
      console.error("Raw LLM response:", JSON.stringify(raw, null, 2));
    }
    completeRunFailure(runId, "runtime_exception", err.message || err.toString(), "system");
    throw err;
  }
}
