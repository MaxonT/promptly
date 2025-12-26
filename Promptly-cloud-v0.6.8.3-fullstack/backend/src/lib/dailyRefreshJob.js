/**
 * Daily Token Refresh Job
 * 
 * Cron job to refresh daily tokens for all active users.
 * Runs at UTC 00:00 daily.
 * 
 * Reference: PRD Section 14 - Daily Refresh Job Definition
 */

import { db } from "./db.js";
import { tokenLedger } from "./tokenLedger.js";
import { stripeService } from "./stripeService.js";
import {
  DAILY_REFRESH_HOUR_UTC,
  SUBSCRIPTION_STATUS,
} from "./subscriptionConfig.js";

// Track last run to prevent duplicate runs
let lastRunDate = null;

/**
 * Get all users who need daily token refresh
 */
function getActiveUsers() {
  // Get users with active subscriptions or active trials
  const users = db.prepare(`
    SELECT DISTINCT u.id, u.email, s.status, s.plan
    FROM users u
    LEFT JOIN subscriptions s ON u.id = s.user_id
    WHERE s.status IN ('active', 'trialing')
    ORDER BY u.id
  `).all();
  
  return users;
}

/**
 * Refresh tokens for a single user
 */
function refreshUserTokens(user) {
  try {
    const isPaid = user.status === SUBSCRIPTION_STATUS.ACTIVE;
    const result = tokenLedger.refreshDailyTokens(user.id, isPaid);
    
    return {
      userId: user.id,
      success: true,
      newTotal: result.total,
    };
  } catch (err) {
    console.error(`[dailyRefresh] Error refreshing tokens for user ${user.id}:`, err);
    return {
      userId: user.id,
      success: false,
      error: err.message,
    };
  }
}

/**
 * Run the daily refresh job
 */
export function runDailyRefresh() {
  const today = new Date().toISOString().split("T")[0];
  
  // Prevent duplicate runs on same day
  if (lastRunDate === today) {
    console.log("[dailyRefresh] Already ran today, skipping");
    return { skipped: true, date: today };
  }
  
  console.log("[dailyRefresh] Starting daily token refresh...");
  
  const users = getActiveUsers();
  const results = {
    date: today,
    totalUsers: users.length,
    successful: 0,
    failed: 0,
    errors: [],
  };
  
  for (const user of users) {
    const result = refreshUserTokens(user);
    
    if (result.success) {
      results.successful++;
    } else {
      results.failed++;
      results.errors.push({
        userId: result.userId,
        error: result.error,
      });
    }
  }
  
  lastRunDate = today;
  
  console.log(`[dailyRefresh] Completed: ${results.successful} successful, ${results.failed} failed`);
  
  return results;
}

/**
 * Check if it's time to run the daily refresh
 */
export function shouldRunRefresh() {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const today = now.toISOString().split("T")[0];
  
  // Run at configured hour and only once per day
  return utcHour === DAILY_REFRESH_HOUR_UTC && lastRunDate !== today;
}

/**
 * Start the refresh scheduler (check every hour)
 */
let schedulerInterval = null;

export function startScheduler() {
  if (schedulerInterval) {
    console.log("[dailyRefresh] Scheduler already running");
    return;
  }
  
  console.log(`[dailyRefresh] Starting scheduler (runs at UTC ${DAILY_REFRESH_HOUR_UTC}:00)`);
  
  // Check immediately on start
  if (shouldRunRefresh()) {
    runDailyRefresh();
  }
  
  // Check every hour
  schedulerInterval = setInterval(() => {
    if (shouldRunRefresh()) {
      runDailyRefresh();
    }
  }, 60 * 60 * 1000); // 1 hour
}

export function stopScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("[dailyRefresh] Scheduler stopped");
  }
}

/**
 * Manual trigger for testing/admin
 */
export function forceRefresh() {
  lastRunDate = null; // Reset to allow immediate run
  return runDailyRefresh();
}

// =============================================
// Period End Processing
// =============================================

/**
 * Process subscription period ends
 * Called daily to handle:
 * - Expired trials
 * - Subscription renewals (token clearing)
 */
export function processPeriodEnds() {
  const now = new Date().toISOString();
  
  // Find trials that have expired
  const expiredTrials = db.prepare(`
    SELECT user_id FROM subscriptions
    WHERE status = 'trialing'
      AND trial_end IS NOT NULL
      AND trial_end < ?
  `).all(now);
  
  for (const trial of expiredTrials) {
    try {
      // Expire trial tokens
      tokenLedger.expireTrialTokens(trial.user_id);
      
      // Update status (Stripe webhook should handle this, but backup)
      db.prepare(`
        UPDATE subscriptions 
        SET status = 'canceled', updated_at = datetime('now')
        WHERE user_id = ? AND status = 'trialing'
      `).run(trial.user_id);
      
      console.log(`[periodEnd] Expired trial for user ${trial.user_id}`);
    } catch (err) {
      console.error(`[periodEnd] Error expiring trial for user ${trial.user_id}:`, err);
    }
  }
  
  // Find subscriptions at period end (for no-rollover clearing)
  // This is mainly handled by Stripe webhooks, but this is a safety net
  const periodEnds = db.prepare(`
    SELECT user_id, plan FROM subscriptions
    WHERE status = 'active'
      AND period_end IS NOT NULL
      AND period_end < ?
      AND period_end > datetime(?, '-1 day')
  `).all(now, now);
  
  for (const sub of periodEnds) {
    try {
      // Clear old tokens (new tokens will be granted by webhook on payment)
      tokenLedger.clearMonthlyTokens(sub.user_id, "Period end - awaiting renewal");
      console.log(`[periodEnd] Cleared tokens for user ${sub.user_id} at period end`);
    } catch (err) {
      console.error(`[periodEnd] Error clearing tokens for user ${sub.user_id}:`, err);
    }
  }
  
  return {
    expiredTrials: expiredTrials.length,
    periodEnds: periodEnds.length,
  };
}

// =============================================
// Exports
// =============================================

export const dailyRefreshJob = {
  runDailyRefresh,
  shouldRunRefresh,
  startScheduler,
  stopScheduler,
  forceRefresh,
  processPeriodEnds,
};

export default dailyRefreshJob;
