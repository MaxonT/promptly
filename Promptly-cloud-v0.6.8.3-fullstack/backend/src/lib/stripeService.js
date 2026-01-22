/**
 * Stripe Service
 * 
 * Handles all Stripe interactions:
 * - Checkout Session creation
 * - Billing Portal session creation
 * - Webhook processing with signature verification
 * - Customer management
 * 
 * Reference: PRD Section 6 - Stripe Integration Requirements
 */

import Stripe from "stripe";
import { db } from "./db.js";
import { tokenLedger } from "./tokenLedger.js";
import {
  STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET,
  STRIPE_PRICE_MONTHLY,
  STRIPE_PRICE_YEARLY,
  SUCCESS_URL,
  CANCEL_URL,
  ACCOUNT_URL,
  SUBSCRIPTION_STATUS,
  TRIAL_DAYS,
  getPlanByPriceId,
} from "./subscriptionConfig.js";

// Initialize Stripe client
let stripe = null;

if (STRIPE_SECRET_KEY) {
  stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: "2023-10-16",
  });
  console.log("[promptly] ✅ Stripe client initialized");
} else {
  console.warn("[promptly] ⚠️ STRIPE_SECRET_KEY not set - billing features disabled");
}

/**
 * Check if Stripe is enabled
 */
export function isStripeEnabled() {
  return !!stripe;
}

// =============================================
// Customer Management
// =============================================

/**
 * Get or create Stripe customer for a user
 */
export async function getOrCreateCustomer(userId, email) {
  if (!stripe) throw new Error("Stripe not configured");
  
  // Check if customer already exists
  const existing = await db.prepare(`
    SELECT stripe_customer_id FROM stripe_customers WHERE user_id = ?
  `).get(userId);
  
  if (existing) {
    return existing.stripe_customer_id;
  }
  
  // Create new Stripe customer
  const customer = await stripe.customers.create({
    email,
    metadata: {
      userId,
      source: "promptly",
    },
  });
  
  // Store mapping
  const now = new Date().toISOString();
  await db.prepare(`
    INSERT INTO stripe_customers (user_id, stripe_customer_id, email, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, customer.id, email, now, now);
  
  console.log(`[stripe] Created customer ${customer.id} for user ${userId}`);
  
  return customer.id;
}

/**
 * Get user ID from Stripe customer ID
 */
export async function getUserIdFromCustomer(stripeCustomerId) {
  const row = await db.prepare(`
    SELECT user_id FROM stripe_customers WHERE stripe_customer_id = ?
  `).get(stripeCustomerId);
  
  return row?.user_id || null;
}

// =============================================
// Checkout Session
// =============================================

/**
 * Create checkout session for subscription
 */
export async function createCheckoutSession({ userId, email, plan }) {
  if (!stripe) throw new Error("Stripe not configured");
  
  const customerId = await getOrCreateCustomer(userId, email);
  
  const priceId = plan === "yearly" ? STRIPE_PRICE_YEARLY : STRIPE_PRICE_MONTHLY;
  
  if (!priceId) throw new Error(`Price ID for plan ${plan} not configured`);
  
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: `${SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: CANCEL_URL,
    subscription_data: {
      metadata: {
        userId,
        plan,
      },
    },
    metadata: {
      userId,
      plan,
    },
  });
  
  return {
    sessionId: session.id,
    url: session.url,
  };
}

/**
 * Create checkout session for immediate paid subscription (no trial)
 * Used when user has already used their trial
 */
export async function createCheckoutSessionNoTrial({ userId, email, plan }) {
  return createCheckoutSession({ userId, email, plan });
}

// =============================================
// Billing Portal
// =============================================

/**
 * Create billing portal session
 */
export async function createPortalSession(userId) {
  if (!stripe) throw new Error("Stripe not configured");
  
  // Get customer ID
  const row = await db.prepare(`
    SELECT stripe_customer_id FROM stripe_customers WHERE user_id = ?
  `).get(userId);
  
  if (!row) throw new Error("No billing account found");
  
  const session = await stripe.billingPortal.sessions.create({
    customer: row.stripe_customer_id,
    return_url: ACCOUNT_URL,
  });
  
  return session.url;
}

// =============================================
// Webhook Processing
// =============================================

/**
 * Verify webhook signature
 */
export function verifyWebhook(payload, signature) {
  if (!stripe) throw new Error("Stripe not configured");
  return stripe.webhooks.constructEvent(payload, signature, STRIPE_WEBHOOK_SECRET);
}

/**
 * Process webhook event (Idempotent)
 */
export async function processWebhookEvent(event) {
  const eventId = event.id;
  const type = event.type;
  
  // Check if already processed
  const existing = await db.prepare(`
    SELECT status FROM stripe_events WHERE id = ?
  `).get(eventId);
  
  if (existing && existing.status === 'processed') {
    console.log(`[stripe] Event ${eventId} already processed`);
    return;
  }
  
  // Record event
  if (!existing) {
    await db.prepare(`
      INSERT INTO stripe_events (id, type, created_at)
      VALUES (?, ?, ?)
    `).run(eventId, type, new Date().toISOString());
  }
  
  try {
    // Handle event types
    switch (type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await handleSubscriptionUpdate(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object);
        break;
      default:
        // Ignore other events
        break;
    }
    
    // Mark processed
    await db.prepare(`
      UPDATE stripe_events SET status = 'processed' WHERE id = ?
    `).run(eventId);
    
  } catch (err) {
    console.error(`[stripe] Failed to process event ${eventId}:`, err);
    throw err;
  }
}

/**
 * Handle checkout.session.completed
 */
async function handleCheckoutCompleted(session) {
  const userId = session.metadata.userId;
  const plan = session.metadata.plan;
  const subscriptionId = session.subscription;
  
  console.log(`[stripe] Checkout completed for user ${userId}, plan ${plan}`);
  
  // Update checkout_sessions table if we tracked it
  await db.prepare(`
    UPDATE checkout_sessions 
    SET status = 'completed', stripe_subscription_id = ?, completed_at = datetime('now')
    WHERE stripe_session_id = ?
  `).run(subscriptionId, session.id);
}

/**
 * Handle subscription updates
 */
async function handleSubscriptionUpdate(subscription) {
  const customerId = subscription.customer;
  const userId = await getUserIdFromCustomer(customerId);
  
  if (!userId) {
    console.warn(`[stripe] Unknown customer ${customerId} in subscription update`);
    return;
  }
  
  const status = subscription.status;
  const planId = subscription.items.data[0].price.id;
  const plan = getPlanByPriceId(planId);
  
  const currentPeriodStart = new Date(subscription.current_period_start * 1000).toISOString();
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
  
  console.log(`[stripe] Subscription update for user ${userId}: ${status} (${plan})`);
  
  // Update local subscription state
  await db.prepare(`
    INSERT INTO subscriptions (
      user_id, stripe_subscription_id, status, plan_id, 
      current_period_start, current_period_end, cancel_at_period_end, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(stripe_subscription_id) DO UPDATE SET
      status = excluded.status,
      plan_id = excluded.plan_id,
      current_period_start = excluded.current_period_start,
      current_period_end = excluded.current_period_end,
      cancel_at_period_end = excluded.cancel_at_period_end,
      updated_at = excluded.updated_at
  `).run(
    userId,
    subscription.id,
    status,
    planId,
    currentPeriodStart,
    currentPeriodEnd,
    subscription.cancel_at_period_end ? 1 : 0
  );
  
  // Update user tier in users table
  let tier = 'free';
  if (status === 'active' || status === 'trialing') {
    tier = plan; // 'monthly' or 'yearly'
  }
  
  await db.prepare(`
    UPDATE users 
    SET subscription_tier = ?, subscription_active = ?
    WHERE id = ?
  `).run(tier, (status === 'active' || status === 'trialing') ? 1 : 0, userId);
}

/**
 * Handle invoice payment succeeded (Renewals)
 */
async function handleInvoicePaymentSucceeded(invoice) {
  const customerId = invoice.customer;
  const userId = await getUserIdFromCustomer(customerId);
  
  if (!userId || !invoice.subscription) return;
  
  const subscriptionId = invoice.subscription;
  
  if (!stripe) return;
  
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const planId = subscription.items.data[0].price.id;
  const plan = getPlanByPriceId(planId);
  
  if (invoice.billing_reason === 'subscription_create' || 
      invoice.billing_reason === 'subscription_cycle' ||
      invoice.billing_reason === 'subscription_update') {
        
    console.log(`[stripe] Invoice paid for user ${userId}, granting ${plan} tokens`);
    await tokenLedger.grantSubscriptionTokens(userId, plan);
  }
}

/**
 * Get subscription status from DB
 */
export async function getSubscriptionStatus(userId) {
  const sub = await db.prepare(`
    SELECT * FROM subscriptions 
    WHERE user_id = ? 
    ORDER BY created_at DESC LIMIT 1
  `).get(userId);
  
  if (!sub) {
    return { status: 'none', plan: 'free' };
  }
  
  return {
    status: sub.status,
    plan: getPlanByPriceId(sub.plan_id) || 'free',
    periodEnd: sub.current_period_end,
    trialEnd: null,
    cancelAtPeriodEnd: !!sub.cancel_at_period_end
  };
}

export const stripeService = {
  isStripeEnabled,
  getOrCreateCustomer,
  getUserIdFromCustomer,
  createCheckoutSession,
  createCheckoutSessionNoTrial,
  createPortalSession,
  verifyWebhook,
  processWebhookEvent,
  getSubscriptionStatus
};
