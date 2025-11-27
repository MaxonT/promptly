import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { db } from "./lib/db.js";
import { authRouter } from "./routes/auth.js";
import { docRouter } from "./routes/doc.js";
import { shareRouter } from "./routes/share.js";
import { specsRouter } from "./routes/specs.js";
import { questionSessionRouter } from "./routes/questionSessions.js";
import { runsRouter } from "./routes/runs.js";

dotenv.config();
const app = express();

const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(helmet());
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

// basic health check
app.get("/api/health", (req, res) => {
  res.json({ ok: true, status: "healthy", time: new Date().toISOString() });
});

// settings endpoint used by settings.html
app.get("/api/settings", (req, res) => {
  const env = process.env.NODE_ENV || "development";
  const llmEnabled = !!process.env.OPENAI_API_KEY;
  const defaultModel = process.env.OPENAI_DEFAULT_MODEL || "gpt-4.1-mini";
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

app.use("/api/auth", authRouter);
app.use("/api/docs", docRouter);
app.use("/api/share", shareRouter);
app.use("/api/specs", specsRouter);
app.use("/api/question-sessions", questionSessionRouter);
app.use("/api/runs", runsRouter);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`[promptly] backend listening on :${PORT}`);
});
