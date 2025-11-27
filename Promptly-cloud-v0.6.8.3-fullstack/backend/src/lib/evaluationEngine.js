import { z } from "zod";
import { chatJson } from "./openaiClient.js";
import { createRun, completeRunSuccess, completeRunFailure } from "./runLogger.js";

/**
 * Zod schema for Evaluator agent output
 * More flexible to handle various LLM output formats
 */
const IssueSchema = z.object({
  category: z.string().optional(),
  severity: z.string().optional(), // More flexible - accept any string
  description: z.string().optional(),
  issue: z.string().optional(), // Alternative field name
  type: z.string().optional() // Alternative field name
}).passthrough(); // Allow additional fields

const SuggestionSchema = z.object({
  category: z.string().optional(),
  recommendation: z.string().optional(),
  suggestion: z.string().optional(), // Alternative field name
  impact: z.string().optional()
}).passthrough(); // Allow additional fields

const EvaluatorOutputSchema = z.object({
  score: z.number().min(0).max(100),
  verdict: z.string(), // More flexible - accept any string
  summary: z.string(),
  issues: z.array(z.any()).optional(), // More flexible
  suggestions: z.array(z.any()).optional(), // More flexible
  strengths: z.array(z.string()).optional(),
  weaknesses: z.array(z.string()).optional()
}).passthrough(); // Allow additional fields

/**
 * Evaluates a compiled prompt against its spec
 * @param {Object} options
 * @param {Object} options.spec - The spec object
 * @param {Object} options.compiledPrompt - The compiled prompt object with blocks array
 * @param {string} [options.model] - Model to use for evaluation (defaults to env var)
 * @returns {Promise<{score: number, verdict: string, summary: string, details: string, runId: string}>}
 */
export async function evaluatePrompt({ spec, compiledPrompt, model }) {
  const system = [
    "You are the Evaluator agent in Promptly's prompt evaluation system.",
    "Your goal: analyze a compiled prompt against its original spec to assess quality, completeness, and correctness.",
    "Consider:",
    "- Completeness: Does the prompt cover all requirements from the spec?",
    "- Clarity: Are instructions clear and unambiguous?",
    "- Structure: Is the prompt well-organized and logical?",
    "- Determinism: Does the prompt guide toward deterministic outputs?",
    "- Missing elements: Are there gaps or omissions?",
    "- Potential issues: Could this prompt lead to errors or misinterpretation?",
    "",
    "Return JSON with:",
    "- score (0-100): Overall quality score",
    "- verdict ('pass', 'fail', or 'needs_work'): Overall assessment",
    "- summary (string): Brief evaluation summary",
    "- issues (array, optional): List of problems found, each with category, severity, description",
    "- suggestions (array, optional): List of improvement recommendations",
    "- strengths (array, optional): What the prompt does well",
    "- weaknesses (array, optional): What could be improved",
    "",
    "Do not output anything except JSON."
  ].join(" ");

  const user = JSON.stringify({
    spec: spec,
    compiled_prompt_blocks: compiledPrompt.blocks || compiledPrompt,
    evaluation_criteria: {
      completeness: "All spec requirements covered",
      clarity: "Instructions are clear and unambiguous",
      structure: "Well-organized and logical flow",
      determinism: "Guides toward consistent outputs",
      error_prevention: "Minimizes potential errors"
    }
  });

  const evalModel = model || process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const runId = createRun({
    model: evalModel,
    inputBlocks: {
      agent: "EVALUATOR",
      spec_title: spec.title || "Untitled",
      prompt_blocks_count: (compiledPrompt.blocks || []).length
    }
  });

  try {
    const raw = await chatJson({ system, user, model: evalModel });
    completeRunSuccess(runId, raw);

    const parsed = EvaluatorOutputSchema.parse(raw);

    // Normalize the output
    const details = {
      issues: parsed.issues || [],
      suggestions: parsed.suggestions || [],
      strengths: parsed.strengths || [],
      weaknesses: parsed.weaknesses || []
    };

    return {
      score: parsed.score,
      verdict: parsed.verdict,
      summary: parsed.summary,
      details: JSON.stringify(details),
      runId
    };
  } catch (err) {
    completeRunFailure(runId, "runtime_exception", err.message || err.toString(), "system");
    throw err;
  }
}

