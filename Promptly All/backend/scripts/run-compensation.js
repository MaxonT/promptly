#!/usr/bin/env node

/**
 * Manual Daily Compensation Runner
 * 
 * Run this script manually to check and fix pending checkout sessions
 * 
 * Usage:
 *   node scripts/run-compensation.js
 *   node scripts/run-compensation.js --retry-webhooks
 */

import dailyCompensationJob from "../src/lib/dailyCompensationJob.js";

const args = process.argv.slice(2);
const retryWebhooks = args.includes("--retry-webhooks");

console.log("=".repeat(60));
console.log("  Manual Daily Compensation Job");
console.log("=".repeat(60));
console.log("");

async function main() {
  try {
    // Run compensation
    console.log("🔍 Running checkout session compensation...\n");
    const compensationResult = await dailyCompensationJob.runDailyCompensation();
    
    console.log("\n📊 Compensation Results:");
    console.log(`  - Sessions checked: ${compensationResult.processed}`);
    console.log(`  - Sessions updated: ${compensationResult.updated}`);
    console.log(`  - Errors: ${compensationResult.errors}`);
    console.log(`  - Duration: ${(compensationResult.duration / 1000).toFixed(2)}s`);
    
    // Retry webhooks if requested
    if (retryWebhooks) {
      console.log("\n🔁 Retrying failed webhook events...\n");
      const retryResult = await dailyCompensationJob.retryFailedWebhookEvents();
      
      console.log("\n📊 Retry Results:");
      console.log(`  - Events retried: ${retryResult.retried}`);
      console.log(`  - Events succeeded: ${retryResult.succeeded}`);
    }
    
    console.log("\n✅ Job completed successfully!");
    process.exit(0);
    
  } catch (err) {
    console.error("\n❌ Job failed:", err.message);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
