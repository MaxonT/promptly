import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { db } from "./lib/db.js";
import { authRouter } from "./routes/auth.js";
import { docRouter } from "./routes/doc.js";
import { shareRouter } from "./routes/share.js";

dotenv.config();
const app = express();

const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(helmet());
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

app.get("/api/health", (req, res) => {
  res.json({ ok: true, status: "healthy", time: new Date().toISOString() });
});

app.use("/api/auth", authRouter);
app.use("/api/docs", docRouter);
app.use("/api/share", shareRouter);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`[promptly] backend listening on :${PORT}`);
});
