/**
 * debug_gates.mjs — Stage 0 + Stage 0.5 smoke test
 * Run: node --env-file=.env scripts/debug_gates.mjs
 */

import { validatePromptInput } from "../src/lib/inputValidator.js";
import { detectAmbiguity } from "../src/lib/ambiguityDetector.js";

const PASS = "✅";
const FAIL = "❌";
const WARN = "⚠️ ";

// ── Test cases ────────────────────────────────────────────────────────────────

const VALIDATOR_CASES = [
  // Should be INVALID (rejected)
  { input: "完了我明天要presentation脑子一团浆糊",        expectValid: false, label: "ZH pure emotion" },
  { input: "internship cs remote no sponsor maybe startup", expectValid: false, label: "EN keyword fragment" },
  { input: "9点 迟到 again 完蛋了",                       expectValid: false, label: "ZH pure emotion 2" },
  { input: "food coffee deadline panic python gpa",         expectValid: false, label: "EN noisy fragment" },
  // Should be VALID (pass through)
  { input: "write a Python web scraper for e-commerce prices",                     expectValid: true, label: "EN valid — scraper" },
  { input: "帮我写邮件给教授申请延期，语气要礼貌",                                  expectValid: true, label: "ZH valid — email" },
  { input: "explain recursion with simple examples for beginners",                 expectValid: true, label: "EN valid — tutorial" },
  { input: "help me write a cold email to a startup for a remote CS internship",   expectValid: true, label: "EN valid — cold email" },
];

const AMBIGUITY_CASES = [
  // Should trigger clarification
  { input: "write a cover letter",                         expectClarify: true,  label: "EN vague — cover letter" },
  { input: "帮我写一份presentation",                        expectClarify: true,  label: "ZH vague — presentation" },
  { input: "帮我写邮件",                                    expectClarify: true,  label: "ZH vague — email no details" },
  { input: "帮我写一份5分钟presentation的开场白，主题是XX",  expectClarify: true,  label: "ZH placeholder XX" },
  // Should NOT trigger clarification
  { input: "explain recursion with simple examples for beginners",                         expectClarify: false, label: "EN clear — recursion" },
  { input: "帮我写一份5分钟presentation的开场白，主题是AI在医疗领域的应用，听众是投资者",  expectClarify: false, label: "ZH full context" },
  { input: "write a Python function to parse CSV files with error handling",              expectClarify: false, label: "EN technical — CSV" },
  { input: "help me write a cold email to a startup for a remote CS internship",         expectClarify: false, label: "EN clear — cold email" },
];

// ── Runner ────────────────────────────────────────────────────────────────────

async function runValidatorTests() {
  console.log("\n════════════════════════════════════════");
  console.log("  STAGE 0: Input Validator");
  console.log("════════════════════════════════════════\n");

  let passed = 0;
  let failed = 0;

  for (const tc of VALIDATOR_CASES) {
    let result;
    try {
      result = await validatePromptInput(tc.input);
    } catch (err) {
      console.log(`${FAIL} [ERROR]  ${tc.label}\n         ${err.message}\n`);
      failed++;
      continue;
    }

    const gotValid = result.isValid;
    const ok = gotValid === tc.expectValid;
    const icon = ok ? PASS : FAIL;
    const expectStr = tc.expectValid ? "VALID  " : "INVALID";
    const gotStr    = gotValid        ? "VALID  " : "INVALID";

    if (ok) {
      passed++;
      console.log(`${icon} [${expectStr}→${gotStr}]  ${tc.label}`);
      if (!gotValid) {
        console.log(`         reason: ${result.rejectReason} | lang: ${result.language}`);
        console.log(`         msg: ${result.rejectMessage?.substring(0, 120)}`);
      }
    } else {
      failed++;
      console.log(`${icon} [EXPECTED ${expectStr} GOT ${gotStr}]  ${tc.label}`);
      console.log(`         reason: ${result.rejectReason} | lang: ${result.language}`);
      console.log(`         msg: ${result.rejectMessage?.substring(0, 120)}`);
    }
    console.log();
  }

  console.log(`  Result: ${passed} passed, ${failed} failed\n`);
  return { passed, failed };
}

async function runAmbiguityTests() {
  console.log("════════════════════════════════════════");
  console.log("  STAGE 0.5: Ambiguity Detector");
  console.log("════════════════════════════════════════\n");

  let passed = 0;
  let failed = 0;

  for (const tc of AMBIGUITY_CASES) {
    let result;
    try {
      result = await detectAmbiguity(tc.input);
    } catch (err) {
      console.log(`${FAIL} [ERROR]  ${tc.label}\n         ${err.message}\n`);
      failed++;
      continue;
    }

    const gotClarify = result.needsClarification;
    const ok = gotClarify === tc.expectClarify;
    const icon = ok ? PASS : FAIL;
    const expectStr = tc.expectClarify ? "ASK   " : "PASS  ";
    const gotStr    = gotClarify        ? "ASK   " : "PASS  ";

    if (ok) {
      passed++;
      console.log(`${icon} [${expectStr}→${gotStr}]  ${tc.label}  (score=${result.ambiguityScore?.toFixed(2)})`);
      if (gotClarify) {
        result.questions.forEach(q => console.log(`           Q: ${q.question}`));
      }
    } else {
      failed++;
      console.log(`${icon} [EXPECTED ${expectStr} GOT ${gotStr}]  ${tc.label}  (score=${result.ambiguityScore?.toFixed(2)})`);
      if (gotClarify) {
        result.questions.forEach(q => console.log(`           Q: ${q.question}`));
      } else {
        console.log(`           (No questions — passed through)`);
      }
    }
    console.log();
  }

  console.log(`  Result: ${passed} passed, ${failed} failed\n`);
  return { passed, failed };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n  Promptly Gate Debug — Stage 0 + Stage 0.5");
  console.log("  " + new Date().toISOString());

  const v = await runValidatorTests();
  const a = await runAmbiguityTests();

  const total = v.passed + a.passed;
  const totalFailed = v.failed + a.failed;

  console.log("════════════════════════════════════════");
  console.log(`  TOTAL: ${total} passed, ${totalFailed} failed`);
  console.log("════════════════════════════════════════\n");

  process.exit(totalFailed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
