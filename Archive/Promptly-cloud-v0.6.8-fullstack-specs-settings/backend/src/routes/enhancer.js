import { Router } from "express";
import { z } from "zod";
import { LlmDisabledError } from "../lib/openaiClient.js";
import {
  enhanceStructure,
  enhanceStyle,
  simplifyPrompt,
  validatePrompt,
  scorePrompt
} from "../lib/promptEnhancer.js";

export const enhancerRouter = Router();

const BaseSchema = z.object({
  prompt: z.string().min(1, "prompt is required")
});

async function handleEnhance(req, res, fn) {
  try {
    const body = BaseSchema.parse(req.body || {});
    const result = await fn({ prompt: body.prompt });
    res.json({ ok: true, result });
  } catch (err) {
    if (err instanceof LlmDisabledError) {
      res.status(503).json({ ok: false, error: "LLM_DISABLED" });
      return;
    }
    if (err.name === "ZodError") {
      res.status(400).json({ ok: false, error: "BAD_REQUEST", details: err.errors });
      return;
    }
    console.error("[promptly] enhancer error", err);
    res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
}

enhancerRouter.post("/structure", (req, res) =>
  handleEnhance(req, res, enhanceStructure)
);

enhancerRouter.post("/style", (req, res) =>
  handleEnhance(req, res, enhanceStyle)
);

enhancerRouter.post("/simplify", (req, res) =>
  handleEnhance(req, res, simplifyPrompt)
);

enhancerRouter.post("/validate", async (req, res) => {
  try {
    const body = BaseSchema.parse(req.body || {});
    const result = await validatePrompt({ prompt: body.prompt });
    res.json({ ok: true, result });
  } catch (err) {
    if (err instanceof LlmDisabledError) {
      res.status(503).json({ ok: false, error: "LLM_DISABLED" });
      return;
    }
    if (err.name === "ZodError") {
      res.status(400).json({ ok: false, error: "BAD_REQUEST", details: err.errors });
      return;
    }
    console.error("[promptly] enhancer validate error", err);
    res.status(500).json({ ok: false, error: "INTERNAL_ERROR" });
  }
});

enhancerRouter.post("/score", (req, res) =>
  handleEnhance(req, res, scorePrompt)
);