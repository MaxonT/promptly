import { Router } from "express";
import { OutcomeRequestSchema, runOutcomeGeneration } from "../lib/outcomeEngine.js";
import { LlmDisabledError } from "../lib/openaiClient.js";

export const outcomeRouter = Router();

outcomeRouter.post("/", async (req, res) => {
  try {
    const body = OutcomeRequestSchema.parse(req.body || {});
    const result = await runOutcomeGeneration(body);
    res.json({ ok: true, result });
  } catch (err) {
    if (err.name === "ZodError") {
      res.status(400).json({ ok: false, error: "BAD_REQUEST", details: err.errors });
      return;
    }
    if (err instanceof LlmDisabledError) {
      res.status(503).json({ ok: false, error: "LLM_DISABLED" });
      return;
    }
    console.error("[promptly] outcome-run error", err);
    res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});