import { z } from "zod";
import { chatJson, LlmDisabledError } from "./openaiClient.js";
import { scorePrompt, validatePrompt } from "./promptEnhancer.js";

const OutcomeTestsSchema = z.object({
  must_include: z.array(z.string()).optional(),
  must_not_include: z.array(z.string()).optional(),
  max_length: z.number().int().positive().optional()
});

export const OutcomeRequestSchema = z.object({
  task: z.string().min(1, "task is required"),
  input: z.string().optional(),
  style: z.string().optional(),
  constraints: z.string().optional(),
  n: z.number().int().min(2).max(8).default(4),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(64).max(4096).optional(),
  tests: OutcomeTestsSchema.optional()
});

const GeneratedCandidatesSchema = z.object({
  candidates: z.array(
    z.object({
      id: z.string(),
      content: z.string()
    })
  )
});

function applyTests(content, tests) {
  if (!tests) {
    return {
      passed: true,
      issues: [],
      penalty: 0
    };
  }
  const issues = [];
  let penalty = 0;
  const text = content.toLowerCase();

  if (tests.must_include) {
    for (const kw of tests.must_include) {
      if (!text.includes(kw.toLowerCase())) {
        issues.push(`Missing required phrase: "${kw}"`);
        penalty += 1.5;
      }
    }
  }

  if (tests.must_not_include) {
    for (const kw of tests.must_not_include) {
      if (text.includes(kw.toLowerCase())) {
        issues.push(`Contains forbidden phrase: "${kw}"`);
        penalty += 2.5;
      }
    }
  }

  if (tests.max_length != null) {
    const len = content.length;
    if (len > tests.max_length) {
      issues.push(
        `Too long: length ${len}, max allowed ${tests.max_length}`
      );
      penalty += 1.0;
    }
  }

  return {
    passed: issues.length === 0,
    issues,
    penalty
  };
}

/**
 * Outcome-first generation pipeline:
 * 1) Generate N candidates given a high-level task spec.
 * 2) Score each candidate with scorePrompt (quality dimensions).
 * 3) Apply simple objective tests (must / must_not / max_length).
 * 4) Combine into finalScore = modelScore - penalty, choose argmax.
 */
export async function runOutcomeGeneration(input) {
  const { task, input: userInput, style, constraints, n, temperature, maxTokens, tests } =
    OutcomeRequestSchema.parse(input);

  if (!process.env.OPENAI_API_KEY) {
    throw new LlmDisabledError();
  }

  const system = [
    "You are a careful generation engine for an AI assistant.",
    "Given a task description and optional extra fields, you must generate N high-quality candidates.",
    "Each candidate should be different but all must stay aligned with the task and constraints.",
    "Return strictly JSON with a `candidates` array containing {id, content} objects.",
    "Do NOT include any explanation outside JSON."
  ].join(" ");

  const user = JSON.stringify({
    task,
    input: userInput,
    style,
    constraints,
    n
  });

  const raw = await chatJson({
    system,
    user,
    model: process.env.OUTCOME_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini"
  });

  const { candidates } = GeneratedCandidatesSchema.parse(raw);

  const scored = [];
  for (const cand of candidates.slice(0, n)) {
    const baseScore = await scorePrompt({ prompt: cand.content });
    const testsResult = applyTests(cand.content, tests);
    const finalScore = Math.max(
      0,
      Math.min(10, (baseScore.score ?? 0) - testsResult.penalty)
    );

    scored.push({
      id: cand.id,
      content: cand.content,
      llmScore: baseScore.score ?? 0,
      dimensions: baseScore.dimensions || {},
      suggestions: baseScore.suggestions || [],
      tests: testsResult,
      finalScore
    });
  }

  if (!scored.length) {
    throw new Error("No candidates generated");
  }

  let best = scored[0];
  for (const cand of scored) {
    if (cand.finalScore > best.finalScore) {
      best = cand;
    }
  }

  return {
    request: {
      task,
      input: userInput,
      style,
      constraints,
      n,
      tests: tests || null
    },
    candidates: scored,
    best,
    meta: {
      scoringVersion: "v0.1",
      modelUsed: process.env.OUTCOME_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini"
    }
  };
}