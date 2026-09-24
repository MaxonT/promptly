import { z } from "zod";
import { chatJson } from "./openaiClient.js";

const EnhancedPromptSchema = z.object({
  original: z.string(),
  enhanced: z.string(),
  notes: z.string().optional()
});

const ScoredPromptSchema = z.object({
  prompt: z.string(),
  score: z.number().min(0).max(10),
  dimensions: z.record(z.number()).optional(),
  suggestions: z.array(z.string()).optional()
});

const ValidationIssueSchema = z.object({
  level: z.enum(["info", "warning", "error"]),
  message: z.string(),
  hint: z.string().optional()
});

const ValidationResultSchema = z.object({
  ok: z.boolean(),
  issues: z.array(ValidationIssueSchema)
});

/**
 * Enhance prompt structure: clarify roles, goals, constraints, steps.
 */
export async function enhanceStructure({ prompt }) {
  const system = [
    "You are a world-class prompt engineer.",
    "Your job is to rewrite user prompts into a clear, structured format.",
    "Preserve the original intent, but make it easier for an LLM to follow.",
    "Return strictly JSON with keys: original, enhanced, notes."
  ].join(" ");
  const user = JSON.stringify({ prompt, mode: "structure" });
  const raw = await chatJson({ system, user });
  const parsed = EnhancedPromptSchema.parse(raw);
  return parsed;
}

/**
 * Enhance prompt style & tone: make it concise, explicit, and neutral.
 */
export async function enhanceStyle({ prompt }) {
  const system = [
    "You are a world-class prompt editor.",
    "Rewrite user prompts to be concise, explicit, and neutral in tone.",
    "Do not change the task itself, only the wording and tone.",
    "Return strictly JSON with keys: original, enhanced, notes."
  ].join(" ");
  const user = JSON.stringify({ prompt, mode: "style" });
  const raw = await chatJson({ system, user });
  const parsed = EnhancedPromptSchema.parse(raw);
  return parsed;
}

/**
 * Simplify prompt: keep intent, remove redundancy & ambiguity.
 */
export async function simplifyPrompt({ prompt }) {
  const system = [
    "You simplify prompts while preserving intent.",
    "Remove redundancy, contradictions, and vague wording.",
    "Return strictly JSON with keys: original, enhanced, notes."
  ].join(" ");
  const user = JSON.stringify({ prompt, mode: "simplify" });
  const raw = await chatJson({ system, user });
  const parsed = EnhancedPromptSchema.parse(raw);
  return parsed;
}

/**
 * Validate prompt: surface potential issues before sending to a model.
 */
export async function validatePrompt({ prompt }) {
  const system = [
    "You are a prompt safety and quality validator.",
    "Read the user's prompt and identify potential issues:",
    "ambiguity, missing constraints, conflicting instructions, unsafe or disallowed content.",
    "Return strictly JSON with keys: ok (boolean), issues (array)."
  ].join(" ");
  const user = JSON.stringify({ prompt, mode: "validate" });
  const raw = await chatJson({ system, user });
  const parsed = ValidationResultSchema.parse(raw);
  return parsed;
}

/**
 * Score prompt quality along key dimensions.
 */
export async function scorePrompt({ prompt }) {
  const system = [
    "You are a strict grader of prompt quality.",
    "Score prompts from 0–10 on overall quality.",
    "Higher score = clearer goal, better constraints, good structure, realistic expectations.",
    "Also provide per-dimension scores if useful, e.g. clarity, structure, safety, specificity.",
    "Return strictly JSON with keys: prompt, score, dimensions, suggestions."
  ].join(" ");
  const user = JSON.stringify({ prompt, mode: "score" });
  const raw = await chatJson({ system, user });
  const parsed = ScoredPromptSchema.parse(raw);
  return parsed;
}