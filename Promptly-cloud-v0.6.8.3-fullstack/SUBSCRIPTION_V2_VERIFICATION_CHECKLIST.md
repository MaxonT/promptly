# Subscription V2 MVP Verification Checklist

## ✅ Pre-Deployment Verification

### 🔧 Backend Services

- [x] **Database Migration**
  ```bash
  cd backend
  node migrations/002_checkout_sessions.js up
  # Should show: "✅ Migration completed successfully"
  ```

- [x] **Table Creation**
  ```bash
  sqlite3 data/promptly.db "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('checkout_sessions', 'analytics_events');"
  # Should output: checkout_sessions, analytics_events
  ```

- [x] **Analytics Router Registration**
  - Check: `backend/src/server.js` contains `import analyticsRouter from "./routes/analytics.js"`
  - Check: `app.use("/api/analytics", analyticsRouter)` exists

- [x] **Billing Route Enhancements**
  - Check: `billing.js` has `GET /verify-session/:sessionId` endpoint
  - Check: `POST /checkout-session` has idempotency logic

- [x] **Stripe Service Addition**
  - Check: `stripeService.js` exports `getCheckoutSession(sessionId)` function

### 🎨 Frontend Files

- [x] **State Machine Module**
  - File exists: `frontend/lib/subscriptionStateMachine.js`
  - Exports: `SubscriptionStateMachine`, `SubscriptionState`

- [x] **Analytics Module**
  - File exists: `frontend/lib/analytics.js`
  - Exports: `track`, `EVENTS`

- [x] **Auth Modal HTML**
  - Check: `subscription.html` contains `<div id="authModal">`
  - Check: Login/Register forms present

- [x] **Auth Modal Styles**
  - Check: `subscription.css` contains `.auth-modal` class
  - Check: `.checkout-stepper` styles present

- [x] **Subscription.js Rewrite**
  - Check: Imports `subscriptionStateMachine.js` and `analytics.js`
  - Check: Contains `showAuthModal()` function
  - Check: Contains `recoverInterruptedFlow()` function

- [x] **Checkout Success Rewrite**
  - Check: `checkout-success.html` imports `analytics.js`
  - Check: Contains `startVerification()` function
  - Check: Has polling logic (every 2s, max 30 retries)

---

## 🧪 Functional Testing

### Test 1: Unauthenticated User Flow

**Steps:**
1. Open `http://localhost:8080/subscription.html` (logged out)
2. Click "Subscribe" button on Monthly or Yearly plan
3. **Expected:** Auth Modal appears with "Sign In Required" title
4. Switch to "Create Account" tab
5. Fill email/password → Submit
6. **Expected:** Modal closes, loading overlay appears
7. **Expected:** Redirect to Stripe Checkout URL

**Verification:**
- [ ] Auth Modal displays correctly
- [ ] Login/Register tabs work
- [ ] Registration successful
- [ ] Automatic checkout session creation
- [ ] Redirect to Stripe

**Analytics Events to Check:**
```sql
SELECT event FROM analytics_events 
WHERE event IN ('AUTH_MODAL_OPENED', 'AUTH_REGISTER_SUCCESS', 'CHECKOUT_SESSION_CREATED')
ORDER BY created_at DESC LIMIT 5;
```

---

### Test 2: Authenticated User Flow

**Steps:**
1. Log in to app first (use existing account)
2. Open `http://localhost:8080/subscription.html`
3. Click "Subscribe" button
4. **Expected:** No Auth Modal, direct checkout session creation
5. **Expected:** Redirect to Stripe immediately

**Verification:**
- [ ] No Auth Modal shown
- [ ] Direct redirect to Stripe
- [ ] Console shows: `[subscription] State: CHECK_AUTH → CREATING_CHECKOUT`

**Analytics Events:**
```sql
SELECT event FROM analytics_events 
WHERE event IN ('SUBSCRIBE_CLICKED', 'CHECKOUT_SESSION_CREATED')
ORDER BY created_at DESC LIMIT 2;
```

---

### Test 3: Idempotency Protection

**Steps:**
1. Log in
2. Open Browser DevTools Network tab
3. Click "Subscribe Monthly"
4. **Cancel** before Stripe redirect (stop page load)
5. Immediately click "Subscribe Monthly" again
6. Check Network tab request/response

**Expected Response:**
```json
{
  "ok": true,
  "sessionId": "cs_test_...",
  "url": "https://checkout.stripe.com/...",
  "reused": true  // <-- This indicates idempotency worked
}
```

**Database Verification:**
```sql
SELECT COUNT(*) as session_count, stripe_session_id 
FROM checkout_sessions 
WHERE user_id = 'YOUR_USER_ID' AND plan = 'monthly'
GROUP BY stripe_session_id;
-- Should show: session_count = 1 (not 2)
```

**Verification:**
- [ ] Second request returns same session_id
- [ ] `reused: true` in response
- [ ] Only one DB record created

---

### Test 4: Checkout Success Verification

**Setup:**
1. Complete Stripe test payment (use card `4242 4242 4242 4242`)
2. Stripe redirects to `checkout-success.html?session_id=cs_test_xxx`

**Expected Behavior:**
1. Page loads with "Processing Your Subscription" title
2. Progress bar animates (20% → 90%)
3. Status text: "Confirming your subscription..."
4. **After 2-6 seconds:** Progress bar hits 100%
5. Title changes to "Welcome to Promptly Pro!"
6. Success icon (🎉) appears
7. Confetti animation plays
8. Subscription details display
9. "Start Creating" button becomes enabled

**Verification:**
- [ ] Polling starts immediately
- [ ] Progress bar animates smoothly
- [ ] Success state displayed correctly
- [ ] Confetti appears
- [ ] Buttons enabled

**Console Logs to Check:**
```javascript
[subscription] State: CONFIRMING_PAYMENT
EVENTS.CHECKOUT_SUCCESS_LOADED logged
EVENTS.CHECKOUT_SUCCESS_VERIFIED logged after verification
```

**Network Requests:**
```
GET /api/billing/verify-session/cs_test_xxx  (repeated 2-5 times)
Status: 200
Response: { "ok": true, "status": "completed", "subscriptionStatus": "trialing" }
```

---

### Test 5: Session Recovery

**Steps:**
1. Log in
2. Click "Subscribe Monthly"
3. Before Stripe redirect completes, **refresh the page** (F5)
4. **Expected:** Console shows "Recovering interrupted flow"
5. **Expected:** State machine resumes from saved state

**Verification:**
- [ ] Console log: `[subscription] Recovering interrupted flow`
- [ ] Analytics event: `CHECKOUT_FLOW_RECOVERED`
- [ ] State machine doesn't restart from IDLE

**sessionStorage Check:**
```javascript
// In Browser DevTools Console:
JSON.parse(sessionStorage.getItem('subscription_pending'))
// Should output: { plan: "monthly", sessionId: "cs_test_...", timestamp: 1234567890 }
```

---

### Test 6: Verification Timeout

**Setup:**
1. Complete Stripe payment
2. **Before webhook processes**, simulate long delay:
   - Stop backend server
   - Wait 30+ seconds on checkout-success.html
   - Restart backend

**Expected:**
- Progress bar stuck at ~90%
- After 30 retries (60 seconds):
  - Error message: "Verification timed out. Your payment may still be processing..."
  - Suggestion: "Please check your account in a few minutes"
  - "View Account" button enabled

**Verification:**
- [ ] Timeout message displayed
- [ ] Max 30 API calls made
- [ ] Analytics event: `CHECKOUT_SUCCESS_ERROR` with `error: "timeout"`

---

### Test 7: Analytics Funnel API

**API Request:**
```bash
curl http://localhost:8080/api/analytics/funnel | jq
```

**Expected Response:**
```json
{
  "authModalOpens": 5,
  "authSuccess": 4,
  "checkoutAttempts": 4,
  "checkoutCreated": 3,
  "verificationSuccess": 2,
  "conversionRate": 0.40
}
```

**Verification:**
- [ ] API returns JSON
- [ ] All metrics are numbers
- [ ] conversionRate is between 0 and 1

---

### Test 8: Error Injection (Optional)

**Enable Error Injection:**
```bash
export ENABLE_ERROR_INJECTION=true
cd backend && npm run dev
```

**Test Scenario A: Checkout Creation Failure**
1. Click "Subscribe" multiple times (30% chance of failure)
2. **Expected:** Some requests show toast: "Failed to start checkout"
3. **Expected:** State machine transitions to ERROR state

**Test Scenario B: Verification Delay**
1. Complete Stripe payment
2. checkout-success.html polling will be delayed 1-3 seconds per request
3. **Expected:** Verification takes longer but eventually succeeds

**Verification:**
- [ ] Error toast displays
- [ ] State machine handles ERROR state gracefully
- [ ] Analytics tracks errors: `CHECKOUT_SESSION_FAILED`

---

## 📊 Database Integrity Checks

### Check 1: Checkout Sessions Table

```sql
-- Should have records with all columns populated
SELECT 
  id, 
  user_id, 
  stripe_session_id, 
  plan, 
  status, 
  idempotency_key, 
  created_at, 
  completed_at
FROM checkout_sessions
ORDER BY created_at DESC
LIMIT 5;
```

**Expected:**
- `status` should be 'pending' or 'completed'
- `idempotency_key` should follow pattern: `checkout_{userId}_{plan}_{timestamp}`
- `completed_at` should be NULL for pending, NOT NULL for completed

### Check 2: Analytics Events Table

```sql
-- Should have recent events
SELECT 
  event, 
  user_id, 
  session_id, 
  properties, 
  created_at
FROM analytics_events
ORDER BY created_at DESC
LIMIT 20;
```

**Expected:**
- Events like `PAGE_VIEW_SUBSCRIPTION`, `SUBSCRIBE_CLICKED`, `AUTH_MODAL_OPENED`
- `user_id` should be valid user IDs
- `properties` should be valid JSON (or NULL)
- `created_at` should be recent timestamps

### Check 3: Indexes Created

```sql
-- Verify indexes exist
SELECT name, tbl_name, sql 
FROM sqlite_master 
WHERE type='index' AND (
  tbl_name='checkout_sessions' OR 
  tbl_name='analytics_events'
);
```

**Expected Indexes:**
- `idx_checkout_sessions_user`
- `idx_checkout_sessions_stripe`
- `idx_checkout_sessions_status`
- `idx_analytics_events_event`
- `idx_analytics_events_user`
- `idx_analytics_events_created`

---

## 🐛 Common Issues & Fixes

### Issue 1: Auth Modal Not Appearing
**Symptoms:** Click Subscribe → Nothing happens

**Debug:**
```javascript
// Browser Console
console.log(document.getElementById('authModal'));  // Should not be null
console.log(window.SubscriptionStateMachine);      // Should be defined
```

**Fix:**
- Check `subscription.html` has `<div id="authModal">` before closing `</body>`
- Check `subscription.js` imports are correct
- Clear browser cache

---

### Issue 2: Verification Stuck on Pending
**Symptoms:** checkout-success.html shows "Confirming..." forever

**Debug:**
```bash
# Check Stripe webhook
curl http://localhost:8080/api/billing/status \
  -H "Authorization: Bearer YOUR_TOKEN"

# Check database
sqlite3 data/promptly.db "SELECT * FROM users WHERE email='test@example.com';"
# Look for subscription_status column
```

**Fix:**
- Ensure Stripe webhook is configured (or use Stripe CLI for local testing)
- Check backend logs for webhook processing errors
- Manually trigger webhook: `stripe trigger checkout.session.completed`

---

### Issue 3: Analytics Events Not Recorded
**Symptoms:** `analytics_events` table is empty

**Debug:**
```bash
# Check analytics API
curl -X POST http://localhost:8080/api/analytics/track \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"event":"TEST_EVENT","properties":{}}'
```

**Fix:**
- Check `server.js` has `app.use("/api/analytics", analyticsRouter)`
- Check CORS settings allow POST to `/api/analytics/track`
- Check browser Network tab for failed requests

---

### Issue 4: Idempotency Not Working
**Symptoms:** Multiple sessions created for same plan

**Debug:**
```sql
SELECT * FROM checkout_sessions 
WHERE user_id='USER_ID' AND plan='monthly'
ORDER BY created_at DESC;
```

**Fix:**
- Check `idempotencyKey` is being sent in request body
- Check 1-hour window calculation: `created_at > datetime('now', '-1 hour')`
- Clear old pending sessions: `DELETE FROM checkout_sessions WHERE status='pending' AND created_at < datetime('now', '-1 hour');`

---

## 🚀 Production Readiness Checklist

### Environment Variables
- [ ] `STRIPE_SECRET_KEY` set
- [ ] `STRIPE_WEBHOOK_SECRET` set
- [ ] `JWT_SECRET` set (for auth)
- [ ] `CORS_ORIGIN` configured
- [ ] `ENABLE_ERROR_INJECTION` is `false` or unset

### Frontend
- [ ] `PROMPTLY_API_BASE` points to production backend
- [ ] All `console.log` statements reviewed (consider removing sensitive data)
- [ ] Minify/bundle JS files (optional)

### Backend
- [ ] Database backups configured
- [ ] Log rotation setup
- [ ] Rate limiting on `/api/billing/checkout-session`
- [ ] Analytics events archival strategy (>7 days)

### Monitoring
- [ ] Set up alerts for `CHECKOUT_SESSION_FAILED` events
- [ ] Monitor conversion funnel daily
- [ ] Track checkout session abandonment rate

---

## 📝 Final Sign-Off

### Developer Checklist
- [ ] All files committed to git
- [ ] Migration script tested on clean database
- [ ] Documentation reviewed
- [ ] Test script passes: `./backend/scripts/test-subscription-v2.sh`
- [ ] Manual testing completed (all 8 test scenarios)

### QA Checklist
- [ ] Happy path (authenticated user) ✅
- [ ] Happy path (unauthenticated user) ✅
- [ ] Idempotency protection ✅
- [ ] Session recovery ✅
- [ ] Verification polling ✅
- [ ] Timeout handling ✅
- [ ] Error states ✅
- [ ] Analytics tracking ✅

### Product Owner Checklist
- [ ] User flow is intuitive
- [ ] Loading states are clear
- [ ] Error messages are helpful
- [ ] Success celebration is delightful (confetti!)
- [ ] No data loss on page refresh

---

**Approved by:** ___________________  
**Date:** ___________________  
**Version:** 0.6.11.0
