import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { nanoid } from "nanoid";
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
import { billingRouter, stripeWebhookRouter } from "./routes/billing.js";
import { analyticsRouter } from "./routes/analytics.js";
import { analyticsDashboardRouter } from "./routes/analyticsDashboard.js";
import { adminRouter } from "./routes/admin.js";
import { oauthRouter } from "./routes/oauth.js";
import { dailyRefreshJob } from "./lib/dailyRefreshJob.js";
import dailyCompensationJob from "./lib/dailyCompensationJob.js";
import { FEATURES } from "./lib/subscriptionConfig.js";

dotenv.config();
const app = express();

// Trust proxy when running behind Render/Heroku reverse proxy
// This is needed to get correct client IP from X-Forwarded-For header
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', true);
}

const rawCorsOrigin = process.env.CORS_ORIGIN || "*";
const CORS_ORIGIN = rawCorsOrigin.includes(",") 
  ? rawCorsOrigin.split(",").map(o => o.trim()) 
  : rawCorsOrigin;
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(helmet());

// Stripe webhook needs raw body for signature verification
// Must be before express.json() middleware
app.use("/api/stripe/webhook", express.raw({ type: "application/json" }));
app.use("/api/stripe", stripeWebhookRouter);

app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

// Rate limiting for API endpoints (防止暴力攻击和滥用)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 200, // 每个 IP 最多 200 个请求
  message: { ok: false, error: "Too many requests, please try again later." },
  standardHeaders: true, // 返回 RateLimit-* headers
  legacyHeaders: false, // 禁用 X-RateLimit-* headers
  skip: (req) => {
    // 健康检查和 webhook 不限制
    return req.path === '/api/health' || req.path.startsWith('/api/stripe/webhook');
  }
});

// 更严格的限制用于认证端点 (防止暴力破解)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 分钟
  max: 10, // 每个 IP 最多 10 次认证尝试
  message: { ok: false, error: "Too many authentication attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true // 成功的请求不计数
});

// 应用 rate limiting
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/', apiLimiter);

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

app.use("/api/billing", billingRouter);
console.log(`[promptly]   ✓ /api/billing`);
console.log(`[promptly]   ✓ /api/stripe/webhook`);

app.use("/api/analytics", analyticsRouter);
console.log(`[promptly]   ✓ /api/analytics`);

app.use("/api/analytics/dashboard", analyticsDashboardRouter);
console.log(`[promptly]   ✓ /api/analytics/dashboard`);

app.use("/api/admin", adminRouter);
console.log(`[promptly]   ✓ /api/admin (sync-data)`);

app.use("/api/auth/oauth", oauthRouter);
console.log(`[promptly]   ✓ /api/auth/oauth`);

app.use("/api/pipeline", pipelineRouter);
console.log(`[promptly]   ✓ /api/pipeline (health, run, stream)`);

console.log(`[promptly] ✅ All API routes registered successfully!`);
console.log(`[promptly] 📋 Pipeline routes:`);
console.log(`[promptly]    GET  /api/pipeline/health`);
console.log(`[promptly]    POST /api/pipeline/run`);
console.log(`[promptly]    GET  /api/pipeline/stream/:runId`);
console.log(`[promptly] 💳 Billing routes:`);
console.log(`[promptly]    GET  /api/billing/plans`);
console.log(`[promptly]    GET  /api/billing/status`);
console.log(`[promptly]    POST /api/billing/checkout-session`);
console.log(`[promptly]    POST /api/billing/portal-session`);
console.log(`[promptly]    POST /api/billing/start-trial`);
console.log(`[promptly]    POST /api/stripe/webhook`);

// Start daily refresh scheduler if subscriptions are enabled
if (FEATURES.subscriptionsEnabled) {
  dailyRefreshJob.startScheduler();
  console.log(`[promptly] 🔄 Daily token refresh scheduler started`);
  
  // Start daily compensation job (runs at 2:00 AM)
  dailyCompensationJob.scheduleDailyJob("02:00");
  console.log(`[promptly] 🔧 Daily compensation job scheduled`);
}

// Root path handler - useful for checking if backend is alive
app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "Promptly Backend API",
    version: "0.6.9.0",
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
      billing: {
        plans: "GET /api/billing/plans",
        status: "GET /api/billing/status",
        checkoutSession: "POST /api/billing/checkout-session",
        portalSession: "POST /api/billing/portal-session",
        startTrial: "POST /api/billing/start-trial",
        webhook: "POST /api/stripe/webhook"
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

// =============================================
// Problem A1: Stale Pending Run Cleanup
// 清理悬挂的 pending runs（服务崩溃/重启遗留）
// =============================================

function cleanupStalePendingRuns() {
  const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 分钟
  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS).toISOString();
  const now = new Date().toISOString();

  try {
    const staleRuns = db.prepare(
      `SELECT id FROM runs WHERE status = 'pending' AND created_at < ?`
    ).all(cutoff);

    if (staleRuns.length === 0) return;

    const markFailed = db.transaction(() => {
      for (const run of staleRuns) {
        db.prepare(
          `UPDATE runs SET status = 'failed', completed_at = ? WHERE id = ?`
        ).run(now, run.id);

        db.prepare(
          `INSERT INTO run_errors (id, run_id, error_type, details, detected_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).run(
          `err_${nanoid(16)}`,
          run.id,
          'stale_pending',
          'Run exceeded 30-minute pending timeout; likely caused by server restart or crash.',
          'cleanup_job',
          now
        );
      }
    });

    markFailed();
    console.log(`[promptly] 🧹 Cleanup: marked ${staleRuns.length} stale pending run(s) as failed`);
  } catch (err) {
    // 清理失败不应阻断服务启动
    console.error('[promptly] ⚠️ Stale run cleanup failed (non-fatal):', err.message);
  }
}

// 启动时立即清理一次
cleanupStalePendingRuns();

// 之后每小时定期清理
setInterval(cleanupStalePendingRuns, 60 * 60 * 1000).unref();

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`[promptly] backend listening on :${PORT}`);
  console.log(`[promptly] 🚀 Backend is ready!`);
  console.log(`[promptly] 📍 Visit root path (/) for available endpoints`);
});
