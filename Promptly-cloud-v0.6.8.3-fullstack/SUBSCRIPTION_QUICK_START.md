# Subscription System Implementation Summary v0.6.9.0

## Quick Start

### 1. Run Migrations
```bash
cd backend
npm run migrate
```

### 2. Set Environment Variables
Copy from `.env.example` and set your Stripe keys:
```bash
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_MONTHLY=price_xxx
STRIPE_PRICE_YEARLY=price_xxx
```

### 3. Test Webhooks Locally
```bash
stripe listen --forward-to localhost:8080/api/billing/stripe/webhook
```

### 4. Start Server
```bash
npm run dev
```

## Files Created

### Backend Libraries
- `src/lib/subscriptionConfig.js` - Configuration
- `src/lib/tokenLedger.js` - Token management
- `src/lib/stripeService.js` - Stripe integration  
- `src/lib/trialAntiAbuse.js` - Anti-fraud
- `src/lib/tokenUsage.js` - Enforcement
- `src/lib/dailyRefreshJob.js` - Cron job

### Backend Routes
- `src/routes/billing.js` - Billing API

### Frontend Pages
- `subscription.html/css/js` - Pricing page
- `account.html/css/js` - Account management
- `checkout-success.html` - Success page
- `checkout-cancel.html` - Cancel page

## API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/billing/plans` | GET | No | Get plans |
| `/api/billing/status` | GET | Yes | Get status |
| `/api/billing/checkout-session` | POST | Yes | Create checkout |
| `/api/billing/portal-session` | POST | Yes | Open portal |
| `/api/billing/start-trial` | POST | Yes | Start trial |
| `/api/billing/token-history` | GET | Yes | Get history |
| `/api/billing/stripe/webhook` | POST | No | Webhook |

## Token Allocation

| Tier | Daily | Monthly | Trial Base |
|------|-------|---------|------------|
| Free | 50K | - | - |
| Pro | 50K | 1M | - |
| Trial | 20K/day | - | 200K |

## Spend Order

1. `trial_base` (if available)
2. `monthly` (if subscribed)
3. `daily_free` (always refreshed)

## Version

Server version: `0.6.9.0`
