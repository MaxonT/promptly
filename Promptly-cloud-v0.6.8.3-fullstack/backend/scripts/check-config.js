import "../src/lib/env.js";
import { getMissingPipelineKeys } from "../src/lib/modelConfig.js";
const modeIndex = process.argv.indexOf("--mode");
const mode = modeIndex >= 0 ? process.argv[modeIndex + 1] : "fast";
if (!["fast", "standard", "premium"].includes(mode)) throw new Error("Use --mode fast|standard|premium");
const requiredKeys = ["ANTHROPIC_API_KEY"];

const missing = [];
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) missing.push("JWT_SECRET (generate at least 32 characters)");
const placeholders = /^(sk-ant-api03-xxxxx|sk-proj-your|gsk_your|change-this|your-secret)/;
for (const key of requiredKeys) {
  if (!process.env[key] || placeholders.test(process.env[key])) missing.push(key);
}
if (missing.length) {
  console.error(`Missing/invalid configuration: ${missing.join(", ")}`);
  process.exitCode = 1;
} else console.log("Configuration present. This checks no credential values and makes no provider calls.");
