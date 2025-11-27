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

const ChoiceQuestionSchema = z.object({
  id: z.string().optional(),
  type: z.enum(["single_choice", "multi_choice", "yes_no", "short_text"]),
  content: z.string(),
  options: z.array(OptionSchema).optional()
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
    "Goal: convert broad axes into concrete, user-friendly questions.",
    "IMPORTANT: Return ONLY valid JSON, no other text.",
    "",
    "Required JSON format example:",
    "{",
    '  "choice_questions": [',
    '    {',
    '      "id": "q1",',
    '      "type": "single_choice",',
    '      "content": "What is the primary platform for your project?",',
    '      "options": [',
    '        {"label": "Web Application", "value": "web"},',
    '        {"label": "Mobile App (iOS/Android)", "value": "mobile"},',
    '        {"label": "Desktop Application", "value": "desktop"}',
    '      ]',
    '    },',
    '    {',
    '      "id": "q2",',
    '      "type": "yes_no",',
    '      "content": "Do you need user authentication?",',
    '      "options": [',
    '        {"label": "Yes", "value": "yes"},',
    '        {"label": "No", "value": "no"}',
    '      ]',
    '    },',
    '    {',
    '      "id": "q3",',
    '      "type": "short_text",',
    '      "content": "Briefly describe your target users"',
    '    }',
    '  ]',
    "}",
    "",
    "RULES:",
    "1. Every question MUST have 'id', 'type', and 'content' fields (all required).",
    "2. Question types: 'single_choice', 'multi_choice', 'yes_no', 'short_text'.",
    "3. For 'single_choice', 'multi_choice', 'yes_no': options MUST be an array of objects with 'label' and 'value'.",
    "4. For 'short_text': omit options field or set to null.",
    "5. Generate 5-8 diverse questions covering different aspects.",
    "6. Keep questions clear, concise, and actionable."
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
      options: q.options || null
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
