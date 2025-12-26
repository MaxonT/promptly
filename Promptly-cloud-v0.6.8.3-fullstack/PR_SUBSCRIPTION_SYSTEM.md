# PR: Promptly Subscriptions v2 (Stripe) + Token-Based Credits + 14-Day Trial

## 📋 Summary

This PR implements a comprehensive subscription and billing system for Promptly, featuring:
- **Stripe Integration**: Checkout Sessions, Billing Portal, and Webhook handling
- **Token-Based Billing**: Credits = Tokens model with deterministic spend order
- **14-Day Trial**: Base tokens + daily drip with anti-abuse controls
- **Server-Side Enforcement**: Token checking and tracking on all LLM calls

## 🎯 Implementation Scope

Based on PRD — Promptly Subscriptions v2 (Stripe) + Token-Based Credits + 14-Day Trial (Safety #1)

### Core Features Implemented

1. **Subscription Management**
   - Free tier with 50K daily tokens
   - Pro tier at $9/month or $84/year with 1M monthly tokens
   - 14-day trial with 200K base + 20K daily tokens

2. **Token System**
   - Bucket-based token storage (daily_free, monthly, trial_base)
   - Deterministic spend order: trial_base → monthly → daily_free
   - Atomic transactions for token operations
   - Premium mode multiplier (1.5x cost)

3. **Stripe Integration**
   - Checkout Sessions for subscription purchase
   - Billing Portal for self-service management
   - Webhook handling with idempotency protection
   - Event processing for all subscription lifecycle events

4. **Trial Anti-Abuse**
   - Risk scoring system
   - Disposable email detection
   - IP rate limiting
   - Device fingerprinting

## 📁 Files Changed

### Backend - New Files

| File | Purpose |
|------|---------|
| `backend/migrations/001_subscriptions.js` | Database schema for subscription system |
| `backend/src/lib/subscriptionConfig.js` | Configuration constants and helpers |
| `backend/src/lib/tokenLedger.js` | Token balance management |
| `backend/src/lib/stripeService.js` | Stripe API interactions |
| `backend/src/lib/trialAntiAbuse.js` | Anti-abuse controls |
| `backend/src/lib/tokenUsage.js` | Runtime token enforcement |
| `backend/src/lib/dailyRefreshJob.js` | Daily token refresh cron |
| `backend/src/routes/billing.js` | Billing API endpoints |

### Backend - Modified Files

| File | Changes |
|------|---------|
| `backend/src/server.js` | Added billing routes, Stripe webhook, daily scheduler |
| `backend/src/routes/pipeline.js` | Added token usage tracking for all LLM calls |
| `backend/.env.example` | Added Stripe and subscription config variables |

### Frontend - New Files

| File | Purpose |
|------|---------|
| `frontend/subscription.html` | Pricing/subscription page |
| `frontend/subscription.css` | Subscription page styles |
| `frontend/subscription.js` | Subscription page logic |
| `frontend/account.html` | User account page |
| `frontend/account.css` | Account page styles |
| `frontend/account.js` | Account page logic |
| `frontend/checkout-success.html` | Stripe checkout success page |
| `frontend/checkout-cancel.html` | Stripe checkout cancel page |

### Frontend - Modified Files

| File | Changes |
|------|---------|
| `frontend/index.html` | Added Subscription/Account nav links |
| `frontend/wizard.html` | Added Subscription/Account nav links |
| `frontend/settings.html` | Added Subscription/Account nav links |
| `frontend/privacy.html` | Added Subscription/Account nav links |
| `frontend/terms.html` | Added Subscription/Account nav links |
| `frontend/cookies.html` | Added Subscription/Account nav links |

## 🗄️ Database Schema

### New Tables

```sql
-- Stripe customer mapping
stripe_customers (
  user_id TEXT PRIMARY KEY,
  stripe_customer_id TEXT UNIQUE,
  created_at TEXT
)

-- Subscription records
subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT,
  plan TEXT,
  price_id TEXT,
  current_period_start TEXT,
  current_period_end TEXT,
  cancel_at_period_end INTEGER,
  trial_start TEXT,
  trial_end TEXT,
  canceled_at TEXT,
  created_at TEXT,
  updated_at TEXT
)

-- Token ledger (atomic balance tracking)
token_ledger (
  id INTEGER PRIMARY KEY,
  user_id TEXT,
  bucket TEXT,
  change INTEGER,
  balance_after INTEGER,
  reason TEXT,
  run_id TEXT,
  created_at TEXT
)

-- Token balances cache (for fast lookups)
token_balances_cache (
  user_id TEXT,
  bucket TEXT,
  balance INTEGER,
  updated_at TEXT,
  PRIMARY KEY (user_id, bucket)
)

-- Stripe event deduplication
stripe_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT,
  processed_at TEXT
)

-- Trial abuse tracking
trial_abuse_checks (
  id INTEGER PRIMARY KEY,
  user_id TEXT,
  ip_address TEXT,
  fingerprint TEXT,
  email_domain TEXT,
  risk_score INTEGER,
  risk_factors TEXT,
  passed INTEGER,
  created_at TEXT
)

-- IP rate limiting
ip_rate_limits (
  ip_address TEXT PRIMARY KEY,
  request_count INTEGER,
  first_request_at TEXT,
  last_request_at TEXT
)
```

### Modified Tables

```sql
-- Added to users table
ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN trial_used INTEGER DEFAULT 0;

-- Added to runs table
ALTER TABLE runs ADD COLUMN input_tokens INTEGER;
ALTER TABLE runs ADD COLUMN output_tokens INTEGER;
ALTER TABLE runs ADD COLUMN credits_spent INTEGER;
ALTER TABLE runs ADD COLUMN multiplier REAL;
```

## 🔌 API Endpoints

### Billing Routes (`/api/billing`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/plans` | Get available subscription plans |
| GET | `/status` | Get user's subscription and token status |
| POST | `/checkout-session` | Create Stripe Checkout session |
| POST | `/portal-session` | Create Stripe Billing Portal session |
| POST | `/start-trial` | Start 14-day free trial |
| POST | `/stripe/webhook` | Handle Stripe webhook events |
| GET | `/token-history` | Get user's token usage history |

### Response Examples

**GET /api/billing/status**
```json
{
  "subscription": {
    "status": "active",
    "plan": "pro",
    "periodEnd": "2025-02-01T00:00:00Z",
    "cancelAtPeriodEnd": false,
    "trialEnd": null,
    "trialDaysRemaining": null
  },
  "tokens": {
    "total": 850000,
    "daily_free": 50000,
    "monthly": 800000,
    "trial_base": 0
  },
  "user": {
    "email": "user@example.com",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

## ⚙️ Environment Variables

Add to `.env`:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_MONTHLY=price_xxx
STRIPE_PRICE_YEARLY=price_xxx

# Optional Stripe URLs
STRIPE_SUCCESS_URL=https://your-domain.com/checkout-success.html
STRIPE_CANCEL_URL=https://your-domain.com/checkout-cancel.html

# Optional: Token configuration (defaults provided)
FREE_DAILY_TOKENS=50000
PRO_MONTHLY_TOKENS=1000000
TRIAL_BASE_TOKENS=200000
TRIAL_DAILY_TOKENS=20000
```

## 🧪 Testing

### Manual Testing Checklist

- [ ] Free tier token allocation works
- [ ] Pro subscription checkout flow
- [ ] Billing portal access
- [ ] Trial start with risk assessment
- [ ] Token spending on pipeline runs
- [ ] Daily token refresh
- [ ] Webhook event processing

### Test Stripe Locally

1. Install Stripe CLI: `brew install stripe/stripe-cli/stripe`
2. Login: `stripe login`
3. Forward webhooks: `stripe listen --forward-to localhost:8080/api/billing/stripe/webhook`
4. Copy webhook secret to `.env`

## 🚀 Deployment Notes

1. **Database Migration**: Run `npm run migrate` to create new tables
2. **Stripe Setup**: 
   - Create products and prices in Stripe Dashboard
   - Set up webhook endpoint pointing to `/api/billing/stripe/webhook`
   - Configure webhook events: `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_*`
3. **Environment**: Ensure all Stripe variables are set
4. **Cron Job**: Daily refresh job starts automatically with server

## 🔒 Security Considerations

- Webhook signature verification required
- Idempotent event processing
- Rate limiting on trial starts
- No sensitive data in client responses
- JWT authentication on all billing endpoints

## 📝 Known Limitations

1. Trial anti-abuse is best-effort (sophisticated actors may bypass)
2. Token tracking adds slight latency to LLM calls
3. Webhook processing is synchronous (consider queue for scale)

## 🔄 Future Improvements

- [ ] Add email verification flow
- [ ] Implement usage alerts (80%, 100% thresholds)
- [ ] Add team/organization billing
- [ ] Implement metered billing option
- [ ] Add promotional codes support

---

## Checklist

- [x] Database migrations created
- [x] Backend services implemented
- [x] API routes created
- [x] Frontend pages built
- [x] Navigation updated
- [x] Pipeline token tracking added
- [x] Environment variables documented
- [ ] Unit tests added
- [ ] Integration tests added
- [ ] Production Stripe keys configured
