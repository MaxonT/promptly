import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { db } from "./lib/db.js";
import { getResolvedDefaultModel, isLlmEnabled } from "./lib/llmRouter.js";
import { authRouter } from "./routes/auth.js";
import { docRouter } from "./routes/doc.js";
import { shareRouter } from "./routes/share.js";
import { specsRouter } from "./routes/specs.js";
import { questionSessionRouter } from "./routes/questionSessions.js";
import { runsRouter } from "./routes/runs.js";
import { outcomeRunsRouter } from "./routes/outcomeRuns.js";
import { enhanceRouter } from "./routes/enhance.js";
import { promptsRouter } from "./routes/prompts.js";
import { pipelineRouter } from "./routes/pipeline.js";

dotenv.config();
const app = express();

const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(helmet());
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

// Request logging middleware for debugging
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`[promptly] ← ${req.method} ${req.path}`);
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[promptly] → ${req.method} ${req.path} ${res.statusCode} (${duration}ms)`);
  });
  
  next();
});

// basic health check
app.get("/api/health", (req, res) => {
  res.json({ ok: true, status: "healthy", time: new Date().toISOString() });
});

// settings endpoint used by settings.html
app.get("/api/settings", (req, res) => {
  const env = process.env.NODE_ENV || "development";
  const llmEnabled = isLlmEnabled();
  const defaultModel = getResolvedDefaultModel();
  const outcomeModel = process.env.OUTCOME_MODEL || null;
  const maxCandidates = Number(process.env.MAX_CANDIDATES || 8);

  res.json({
    ok: true,
    settings: {
      env,
      llmEnabled,
      defaultModel,
      outcomeModel,
      maxCandidates,
      features: {
        questionWizard: true,
        promptEnhancer: true,
        outcomeRunner: true
      }
    }
  });
});

// Register all API routes
console.log(`[promptly] 🔧 Registering API routes...`);

app.use("/api/auth", authRouter);
console.log(`[promptly]   ✓ /api/auth`);

app.use("/api/docs", docRouter);
console.log(`[promptly]   ✓ /api/docs`);

app.use("/api/share", shareRouter);
console.log(`[promptly]   ✓ /api/share`);

app.use("/api/specs", specsRouter);
console.log(`[promptly]   ✓ /api/specs`);

app.use("/api/question-sessions", questionSessionRouter);
console.log(`[promptly]   ✓ /api/question-sessions`);

app.use("/api/runs", runsRouter);
console.log(`[promptly]   ✓ /api/runs`);

app.use("/api/outcome-runs", outcomeRunsRouter);
console.log(`[promptly]   ✓ /api/outcome-runs`);

app.use("/api/enhance", enhanceRouter);
console.log(`[promptly]   ✓ /api/enhance`);

app.use("/api/prompts", promptsRouter);
console.log(`[promptly]   ✓ /api/prompts`);

app.use("/api/pipeline", pipelineRouter);
console.log(`[promptly]   ✓ /api/pipeline (health, run, stream)`);

console.log(`[promptly] ✅ All API routes registered successfully!`);
console.log(`[promptly] 📋 Pipeline routes:`);
console.log(`[promptly]    GET  /api/pipeline/health`);
console.log(`[promptly]    POST /api/pipeline/run`);
console.log(`[promptly]    GET  /api/pipeline/stream/:runId`);

// Root path handler - useful for checking if backend is alive
app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "Promptly Backend API",
    version: "0.6.8.3",
    status: "running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "production",
    availableEndpoints: {
      health: {
        path: "/api/health",
        method: "GET",
        description: "Basic health check"
      },
      settings: {
        path: "/api/settings",
        method: "GET",
        description: "Get backend settings"
      },
      pipeline: {
        health: "/api/pipeline/health",
        run: "POST /api/pipeline/run",
        stream: "GET /api/pipeline/stream/:runId"
      },
      specs: "/api/specs",
      questionSessions: "/api/question-sessions",
      enhance: {
        structure: "POST /api/enhance/structure",
        style: "POST /api/enhance/style",
        simplify: "POST /api/enhance/simplify"
      },
      prompts: "/api/prompts",
      outcomeRuns: "/api/outcome-runs"
    },
    cors: {
      origin: process.env.CORS_ORIGIN || "*",
      note: "Set CORS_ORIGIN env var to restrict origins"
    },
    documentation: "https://github.com/your-repo/promptly"
  });
});

// Catch-all for unmatched API routes
app.use("/api/*", (req, res) => {
  res.status(404).json({
    ok: false,
    error: "API endpoint not found",
    path: req.path,
    method: req.method,
    availableEndpoints: "Visit root path (/) for available endpoints"
  });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`[promptly] backend listening on :${PORT}`);
  console.log(`[promptly] 🚀 Backend is ready!`);
  console.log(`[promptly] 📍 Visit root path (/) for available endpoints`);
});
