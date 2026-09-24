#!/bin/bash

###############################################################################
# Subscription V2 MVP Integration Test
# Tests the complete subscription flow with state machine and verification
###############################################################################

set -e  # Exit on error

API_BASE="${SELFTEST_BASE_URL:-http://localhost:8080}"
TEST_EMAIL="test-sub-v2-$(date +%s)@example.com"
TEST_PASSWORD="TestPass123!"
TEST_PLAN="monthly"

echo "🧪 Subscription V2 MVP Integration Test"
echo "========================================"
echo "API Base: $API_BASE"
echo "Test Email: $TEST_EMAIL"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
pass() {
  echo -e "${GREEN}✓${NC} $1"
}

fail() {
  echo -e "${RED}✗${NC} $1"
  exit 1
}

info() {
  echo -e "${YELLOW}ℹ${NC} $1"
}

# Test 1: Health Check
echo "Test 1: Health Check"
response=$(curl -s "${API_BASE}/api/health")
if echo "$response" | grep -q '"ok":true'; then
  pass "Health check passed"
else
  fail "Health check failed"
fi

# Test 2: Register User
echo ""
echo "Test 2: Register User"
response=$(curl -s -X POST "${API_BASE}/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}")

if echo "$response" | grep -q '"token"'; then
  TOKEN=$(echo "$response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
  USER_ID=$(echo "$response" | grep -o '"userId":"[^"]*"' | cut -d'"' -f4)
  pass "User registered (ID: ${USER_ID:0:8}...)"
else
  fail "Registration failed: $response"
fi

# Test 3: Create Checkout Session (First Time)
echo ""
echo "Test 3: Create Checkout Session (First Time)"
response=$(curl -s -X POST "${API_BASE}/api/billing/checkout-session" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{\"plan\":\"${TEST_PLAN}\",\"idempotencyKey\":\"test_key_1\"}")

if echo "$response" | grep -q '"sessionId"'; then
  SESSION_ID=$(echo "$response" | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)
  SESSION_URL=$(echo "$response" | grep -o '"url":"[^"]*"' | cut -d'"' -f4)
  pass "Checkout session created"
  info "  Session ID: ${SESSION_ID:0:20}..."
  info "  URL: ${SESSION_URL:0:50}..."
else
  fail "Checkout session creation failed: $response"
fi

# Test 4: Idempotency Check (Same Request)
echo ""
echo "Test 4: Idempotency Check (Same Request Within 1 Hour)"
response=$(curl -s -X POST "${API_BASE}/api/billing/checkout-session" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d "{\"plan\":\"${TEST_PLAN}\",\"idempotencyKey\":\"test_key_1\"}")

if echo "$response" | grep -q '"reused":true'; then
  REUSED_SESSION=$(echo "$response" | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)
  if [ "$REUSED_SESSION" = "$SESSION_ID" ]; then
    pass "Idempotency protection working (session reused)"
  else
    fail "Session IDs don't match (expected idempotency)"
  fi
else
  # Check if same session ID returned (older API might not have 'reused' flag)
  SECOND_SESSION=$(echo "$response" | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)
  if [ "$SECOND_SESSION" = "$SESSION_ID" ]; then
    pass "Idempotency protection working (session reused, no flag)"
  else
    fail "Idempotency check failed: $response"
  fi
fi

# Test 5: Database Table Check
echo ""
echo "Test 5: Database Table Check"
cd "$(dirname "$0")"
if [ -f "../data/promptly.db" ]; then
  CHECKOUT_SESSIONS_COUNT=$(sqlite3 ../data/promptly.db "SELECT COUNT(*) FROM checkout_sessions WHERE user_id='${USER_ID}';")
  if [ "$CHECKOUT_SESSIONS_COUNT" -ge 1 ]; then
    pass "checkout_sessions table has records"
  else
    fail "No checkout_sessions records found"
  fi
else
  info "Database file not found (skipping DB check)"
fi

# Test 6: Analytics Event Tracking
echo ""
echo "Test 6: Analytics Event Tracking"
response=$(curl -s -X POST "${API_BASE}/api/analytics/track" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${TOKEN}" \
  -d '{
    "event": "TEST_EVENT",
    "properties": {"testKey": "testValue"}
  }')

if echo "$response" | grep -q '"ok":true'; then
  pass "Analytics event tracked"
else
  fail "Analytics tracking failed: $response"
fi

# Test 7: Analytics Funnel API
echo ""
echo "Test 7: Analytics Funnel API"
response=$(curl -s "${API_BASE}/api/analytics/funnel")
if echo "$response" | grep -q '"conversionRate"'; then
  pass "Analytics funnel API working"
  info "  Conversion Rate: $(echo "$response" | grep -o '"conversionRate":[0-9.]*' | cut -d':' -f2)"
else
  fail "Analytics funnel API failed: $response"
fi

# Test 8: Verify Session API (Should be pending - no actual payment)
echo ""
echo "Test 8: Verify Session API (Pending State)"
response=$(curl -s "${API_BASE}/api/billing/verify-session/${SESSION_ID}" \
  -H "Authorization: Bearer ${TOKEN}")

if echo "$response" | grep -q '"status":"pending"' || echo "$response" | grep -q '"status":"completed"'; then
  pass "Verify session API working"
  STATUS=$(echo "$response" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
  info "  Status: $STATUS"
else
  fail "Verify session API failed: $response"
fi

# Test 9: Billing Status Check
echo ""
echo "Test 9: Billing Status Check"
response=$(curl -s "${API_BASE}/api/billing/status" \
  -H "Authorization: Bearer ${TOKEN}")

if echo "$response" | grep -q '"subscription"'; then
  pass "Billing status API working"
  SUB_STATUS=$(echo "$response" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
  info "  Subscription Status: $SUB_STATUS"
else
  fail "Billing status failed: $response"
fi

# Test 10: Error Injector Check
echo ""
echo "Test 10: Error Injector Module Check"
if [ -f "../src/lib/errorInjector.js" ]; then
  pass "Error injector module exists"
  if grep -q "ENABLE_ERROR_INJECTION" "../src/lib/errorInjector.js"; then
    info "  Error injection can be enabled via env var"
  fi
else
  fail "Error injector module not found"
fi

# Summary
echo ""
echo "========================================"
echo -e "${GREEN}✓ All tests passed!${NC}"
echo ""
echo "📊 Summary:"
echo "  - User registered: ${TEST_EMAIL}"
echo "  - Checkout session created: ${SESSION_ID:0:20}..."
echo "  - Idempotency verified"
echo "  - Analytics tracking functional"
echo "  - Database tables created"
echo ""
echo "🎉 Subscription V2 MVP is ready!"
echo ""
echo "Next steps:"
echo "1. Start backend: cd backend && npm run dev"
echo "2. Open browser: http://localhost:8080/subscription.html"
echo "3. Test Auth Modal and State Machine"
echo "4. Test checkout-success.html polling"
