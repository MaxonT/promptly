import { z } from "zod";
import { chatJson } from "./openaiClient.js";

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
  intent: z.record(z.any()).optional(),
  spec: z.record(z.any()),
  explanation: z.string()
});

export async function generateBroadQuestions({ initialDescription, kind }) {
  const system = [
    "You are Agent A in Promptly's Question Engine.",
    "Goal: from a fuzzy project idea, propose 8–15 broad clarification axes.",
    "Each axis should cover an important dimension such as user, platform, data, flows, constraints, risks.",
    "Return JSON with a 'broad_questions' array.",
    "Do not output anything except JSON."
  ].join(" ");
  const user = JSON.stringify({
    initial_description: initialDescription,
    kind: kind || null
  });
  const raw = await chatJson({ system, user });
  const parsed = AgentAOutputSchema.parse(raw);
  return parsed.broad_questions.map((q, index) => ({
    id: q.id || `axis_${index + 1}`,
    axis: q.axis,
    question: q.question,
    rationale: q.rationale || ""
  }));
}

export async function generateChoiceQuestions({ initialDescription, kind, broadQuestions }) {
  const system = [
    "You are Agent B in Promptly's Question Engine.",
    "Goal: convert Agent A's broad axes into concrete, user-friendly questions.",
    "Use types: 'single_choice', 'multi_choice', 'yes_no', 'short_text'.",
    "Each choice question may have an 'options' array for choice types.",
    "Return JSON with a 'choice_questions' array.",
    "Do not output anything except JSON."
  ].join(" ");
  const user = JSON.stringify({
    initial_description: initialDescription,
    kind: kind || null,
    broad_questions: broadQuestions
  });
  const raw = await chatJson({ system, user });
  const parsed = AgentBOutputSchema.parse(raw);
  return parsed.choice_questions.map((q, index) => ({
    id: q.id || `q_${index + 1}`,
    type: q.type,
    content: q.content,
    options: q.options || null
  }));
}

export async function generateRawSpec({ initialDescription, kind, qaPairs }) {
  const system = [
    "You are Agent C in Promptly's Question Engine.",
    "You receive all questions and answers from a wizard.",
    "You must build a structured high-level Spec JSON with keys such as:",
    "project_goal, objectives, actors, flows, requirements, constraints, data, evaluation_criteria, ui_ux.",
    "Return JSON with keys: intent (optional), spec, explanation.",
    "Do not output anything except JSON."
  ].join(" ");
  const user = JSON.stringify({
    initial_description: initialDescription,
    kind: kind || null,
    qa_pairs: qaPairs
  });
  const raw = await chatJson({ system, user });
  const parsed = AgentCOutputSchema.parse(raw);
  return parsed;
}
