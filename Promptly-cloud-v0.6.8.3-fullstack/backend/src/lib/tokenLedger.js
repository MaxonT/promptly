/**
 * Token Ledger Service
 * 
 * Handles all token-related operations:
 * - Granting tokens (trial, subscription, daily refresh, admin adjustment)
 * - Spending tokens (API usage)
 * - Balance queries
 * - Cache management
 * 
 * Reference: PRD Section 7 - Token Ledger & Backend Enforcement
 */

import { db } from "./db.js";
import {
  BUCKET_TYPES,
  TOKEN_SOURCES,
  TRIAL_BASE_TOKENS,
  TRIAL_DAILY_TOKENS,
  DAILY_CARRY_CAP_TOKENS,
  MONTHLY_PLAN_TOKENS,
  YEARLY_PLAN_TOKENS,
  PAID_DAILY_TOKENS,
  TRIAL_DAYS,
} from "./subscriptionConfig.js";

// =============================================
// Balance Queries
// =============================================

/**
 * Get user's token balances from ledger
 * Groups by bucket type and sums non-expired tokens
 */
export async function getTokenBalances(userId) {
  const now = new Date().toISOString();
  
  // Get balance for each bucket type
  const balances = {
    daily_free: 0,
    monthly: 0,
    trial_base: 0,
    total: 0,
  };
  
  // Sum all non-expired tokens per bucket
  const rows = await db.prepare(`
    SELECT bucket, SUM(tokens_change) as balance
    FROM token_ledger
    WHERE user_id = ?
      AND (expires_at IS NULL OR expires_at > ?)
    GROUP BY bucket
  `).all(userId, now);
  
  for (const row of rows) {
    if (balances.hasOwnProperty(row.bucket)) {
      balances[row.bucket] = Math.max(0, row.balance);
    }
  }
  
  balances.total = balances.daily_free + balances.monthly + balances.trial_base;
  
  return balances;
}

/**
 * Get cached token balances (fast read)
 * Falls back to ledger calculation if cache miss
 */
export async function getCachedBalances(userId) {
  const cached = await db.prepare(`
    SELECT * FROM token_balances_cache WHERE user_id = ?
  `).get(userId);
  
  if (cached) {
    return {
      daily_free: cached.daily_free_remaining,
      monthly: cached.monthly_remaining,
      trial_base: cached.trial_base_remaining,
      total: cached.total_remaining,
      updatedAt: cached.updated_at,
    };
  }
  
  // Cache miss - calculate from ledger and cache
  const balances = await getTokenBalances(userId);
  await updateBalanceCache(userId, balances);
  return balances;
}

/**
 * Update the balance cache for a user
 */
export async function updateBalanceCache(userId, balances) {
  const now = new Date().toISOString();
  
  await db.prepare(`
    INSERT INTO token_balances_cache 
      (user_id, daily_free_remaining, monthly_remaining, trial_base_remaining, total_remaining, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      daily_free_remaining = excluded.daily_free_remaining,
      monthly_remaining = excluded.monthly_remaining,
      trial_base_remaining = excluded.trial_base_remaining,
      total_remaining = excluded.total_remaining,
      updated_at = excluded.updated_at
  `).run(
    userId,
    balances.daily_free,
    balances.monthly,
    balances.trial_base,
    balances.total,
    now
  );
}

// =============================================
// Ledger Operations (Write)
// =============================================

/**
 * Add tokens to user's ledger
 */
export async function addTokens(userId, amount, bucket, source, description, expiryDays = null) {
  const now = new Date();
  const expiresAt = expiryDays 
    ? new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000).toISOString()
    : null;
    
  await db.prepare(`
    INSERT INTO token_ledger (user_id, tokens_change, bucket, source, description, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    amount,
    bucket,
    source,
    description,
    expiresAt,
    now.toISOString()
  );
  
  // Invalidate cache
  const balances = await getTokenBalances(userId);
  await updateBalanceCache(userId, balances);
  
  return balances;
}

/**
 * Spend tokens (deduct from ledger)
 * Follows waterfall logic: Daily -> Monthly -> Trial Base
 */
export async function spendTokens(userId, amount, description) {
  const balances = await getTokenBalances(userId);
  
  if (balances.total < amount) {
    throw new Error("Insufficient tokens");
  }
  
  let remaining = amount;
  const now = new Date().toISOString();
  
  // Waterfall order: daily_free -> monthly -> trial_base
  const buckets = ['daily_free', 'monthly', 'trial_base'];
  
  for (const bucket of buckets) {
    if (remaining <= 0) break;
    
    const available = balances[bucket];
    if (available > 0) {
      const deduct = Math.min(remaining, available);
      
      await db.prepare(`
        INSERT INTO token_ledger (user_id, tokens_change, bucket, source, description, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        -deduct,
        bucket,
        TOKEN_SOURCES.USAGE,
        description,
        now
      );
      
      remaining -= deduct;
    }
  }
  
  // Update cache
  const newBalances = await getTokenBalances(userId);
  await updateBalanceCache(userId, newBalances);
  
  return newBalances;
}

// =============================================
// Lifecycle Events
// =============================================

/**
 * Initialize tokens for new trial user
 */
export async function initializeTrial(userId) {
  // Grant base tokens (never expire during trial)
  await addTokens(
    userId,
    TRIAL_BASE_TOKENS,
    BUCKET_TYPES.TRIAL_BASE,
    TOKEN_SOURCES.TRIAL_START,
    "Trial base allowance",
    TRIAL_DAYS
  );
  
  // Grant first day's daily tokens
  await addTokens(
    userId,
    TRIAL_DAILY_TOKENS,
    BUCKET_TYPES.DAILY_FREE,
    TOKEN_SOURCES.DAILY_REFRESH,
    "Daily trial refresh",
    1 // Expires in 24h
  );
}

/**
 * Process daily token refresh (cron job)
 * - Expires old daily tokens (implicitly via expiry date)
 * - Grants new daily tokens
 * - Applies caps
 */
export async function refreshDailyTokens(userId, plan) {
  // 1. Calculate carry-over (if any logic needed, but expiration handles it)
  // For simplicity, we just grant new daily tokens. 
  // If we wanted to enforce a "hard cap" regardless of expiration, we'd check balance first.
  
  // Get current daily balance
  const balances = await getTokenBalances(userId);
  const currentDaily = balances.daily_free;
  
  // Calculate grant amount
  // If user has 15k and cap is 20k, we grant 20k? No, usually refresh resets or adds up to cap.
  // PRD says: "Daily Refresh: 20k (Trial) / 50k (Pro) - Use it or lose it"
  // This implies we grant X amount with 24h expiry.
  
  let dailyAmount = 0;
  if (plan === 'trial') dailyAmount = TRIAL_DAILY_TOKENS;
  else if (['monthly', 'yearly'].includes(plan)) dailyAmount = PAID_DAILY_TOKENS;
  else return; // Free tier (no trial) gets nothing? Or maybe a small amount? PRD says 0 for free.
  
  if (dailyAmount > 0) {
    await addTokens(
      userId,
      dailyAmount,
      BUCKET_TYPES.DAILY_FREE,
      TOKEN_SOURCES.DAILY_REFRESH,
      "Daily refresh",
      1 // Expires in 1 day
    );
  }
}

/**
 * Grant monthly/yearly plan tokens
 */
export async function grantSubscriptionTokens(userId, plan) {
  let amount = 0;
  if (plan === 'monthly') amount = MONTHLY_PLAN_TOKENS;
  if (plan === 'yearly') amount = YEARLY_PLAN_TOKENS;
  
  if (amount > 0) {
    await addTokens(
      userId,
      amount,
      BUCKET_TYPES.MONTHLY,
      TOKEN_SOURCES.SUBSCRIPTION_GRANT,
      `${plan} plan credits`,
      plan === 'monthly' ? 30 : 365
    );
  }
}

export const tokenLedger = {
  getTokenBalances,
  getCachedBalances,
  updateBalanceCache,
  addTokens,
  spendTokens,
  initializeTrial,
  refreshDailyTokens,
  grantSubscriptionTokens
};
