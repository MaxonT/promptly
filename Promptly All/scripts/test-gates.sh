#!/usr/bin/env bash
# ============================================================
# test-gates.sh — Stage 0 + Stage 0.5 End-to-End Gate Tester
#
# Usage:
#   ./scripts/test-gates.sh https://your-backend.onrender.com
#   ./scripts/test-gates.sh http://localhost:8080
#
# Tests:
#   Stage 0  — Input Validator  (reject invalid, pass valid)
#   Stage 0.5 — Ambiguity Detector (clarification panel trigger)
# ============================================================

BASE_URL="${1:-http://localhost:8080}"
PASS="✅"
FAIL="❌"
WARN="⚠️ "

echo ""
echo "  Promptly Gate E2E Test"
echo "  Target: $BASE_URL"
echo "  $(date)"
echo ""

# ── 1. Health check ──────────────────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Health Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
HEALTH=$(curl -sf --max-time 10 "$BASE_URL/api/health" 2>&1)
if echo "$HEALTH" | grep -q '"status"'; then
  echo "$PASS  Backend is UP"
  echo "    $HEALTH"
else
  echo "$FAIL  Backend not reachable at $BASE_URL"
  echo "    Response: $HEALTH"
  exit 1
fi
echo ""

# ── Helper: get auth token (guest/demo user via signup) ───────────────────────
get_token() {
  local TS=$(date +%s)
  local RESP=$(curl -sf --max-time 15 -X POST "$BASE_URL/api/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"debugtest${TS}@promptly-test.local\",\"password\":\"DebugTest123!\",\"name\":\"Debug Test\"}" 2>&1)
  echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))" 2>/dev/null
}

echo "  Getting auth token..."
TOKEN=$(get_token)
if [ -z "$TOKEN" ]; then
  echo "$WARN  Could not get auth token — will try unauthenticated (may get 401)"
  echo "       Note: Register endpoint may require email verification or be rate-limited."
else
  echo "$PASS  Auth token obtained (${#TOKEN} chars)"
fi
echo ""

# ── Trigger pipeline and capture SSE events ───────────────────────────────────
# Returns the SSE stream as text
run_pipeline() {
  local INPUT="$1"
  local EXTRA_FLAGS="${2:-}"
  local AUTH_HEADER=""
  [ -n "$TOKEN" ] && AUTH_HEADER="-H \"Authorization: Bearer $TOKEN\""

  BODY=$(printf '{"idea":"%s","skipQuestions":false,"clarificationsProvided":false}' "$INPUT")

  # First: /api/pipeline/run to get runId
  RUN_RESP=$(curl -sf --max-time 15 -X POST "$BASE_URL/api/pipeline/run" \
    -H "Content-Type: application/json" \
    ${TOKEN:+-H "Authorization: Bearer $TOKEN"} \
    -d "$BODY" 2>&1)

  RUN_ID=$(echo "$RUN_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('runId',''))" 2>/dev/null)

  if [ -z "$RUN_ID" ]; then
    echo "NO_RUN_ID: $RUN_RESP"
    return
  fi

  # Then stream events for max 30s
  curl -sf --max-time 30 \
    ${TOKEN:+-H "Authorization: Bearer $TOKEN"} \
    "$BASE_URL/api/pipeline/stream/$RUN_ID" 2>&1 | head -80
}

# ── Stage 0: Validator tests ──────────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  STAGE 0: Input Validator"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_rejected() {
  local DESC="$1"
  local INPUT="$2"
  echo ""
  echo "  TEST: $DESC"
  echo "  Input: \"$INPUT\""
  local STREAM=$(run_pipeline "$INPUT")
  if echo "$STREAM" | grep -q "pipeline-rejected"; then
    local MSG=$(echo "$STREAM" | grep "pipeline-rejected" | head -1)
    echo "  $PASS  REJECTED as expected"
    echo "  Event: $MSG"
  elif [ -z "$STREAM" ] || echo "$STREAM" | grep -q "NO_RUN_ID"; then
    echo "  $WARN  Could not get stream (auth issue?): $STREAM"
  else
    echo "  $FAIL  NOT rejected — passed through!"
    echo "  Stream snippet: $(echo "$STREAM" | head -5)"
  fi
}

check_passed() {
  local DESC="$1"
  local INPUT="$2"
  echo ""
  echo "  TEST: $DESC"
  echo "  Input: \"$INPUT\""
  local STREAM=$(run_pipeline "$INPUT")
  if echo "$STREAM" | grep -q "pipeline-rejected"; then
    echo "  $FAIL  REJECTED — should have passed!"
    echo "  Event: $(echo "$STREAM" | grep 'pipeline-rejected' | head -1)"
  elif echo "$STREAM" | grep -q "stage-complete.*validation\|pipeline-clarification-needed\|stage-start.*spec"; then
    echo "  $PASS  PASSED validation as expected"
  elif [ -z "$STREAM" ] || echo "$STREAM" | grep -q "NO_RUN_ID"; then
    echo "  $WARN  Could not get stream (auth issue?): $STREAM"
  else
    echo "  $WARN  Unexpected response:"
    echo "  $(echo "$STREAM" | head -5)"
  fi
}

check_rejected "ZH pure emotion"      "完了我明天要presentation脑子一团浆糊"
check_rejected "EN keyword fragment"  "internship cs remote no sponsor maybe startup"
check_rejected "EN noisy fragment"    "food coffee deadline panic python gpa"

check_passed "EN valid — scraper"     "write a Python web scraper for e-commerce prices"
check_passed "ZH valid — email"       "帮我写邮件给教授申请延期，语气要礼貌"

echo ""
echo ""

# ── Stage 0.5: Ambiguity tests ────────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  STAGE 0.5: Ambiguity Detector"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_clarify() {
  local DESC="$1"
  local INPUT="$2"
  echo ""
  echo "  TEST: $DESC"
  echo "  Input: \"$INPUT\""
  local STREAM=$(run_pipeline "$INPUT")
  if echo "$STREAM" | grep -q "pipeline-clarification-needed"; then
    local Q_COUNT=$(echo "$STREAM" | grep -o '"question"' | wc -l | tr -d ' ')
    echo "  $PASS  CLARIFICATION triggered ($Q_COUNT questions)"
    echo "$STREAM" | grep '"question"' | head -5 | sed 's/^/            /'
  elif echo "$STREAM" | grep -q "pipeline-rejected"; then
    echo "  $WARN  Was REJECTED by Stage 0 (not tested for ambiguity)"
  elif [ -z "$STREAM" ] || echo "$STREAM" | grep -q "NO_RUN_ID"; then
    echo "  $WARN  Could not get stream: $STREAM"
  else
    echo "  $FAIL  No clarification triggered — passed straight through!"
    echo "  Stream snippet: $(echo "$STREAM" | head -5)"
  fi
}

check_no_clarify() {
  local DESC="$1"
  local INPUT="$2"
  echo ""
  echo "  TEST: $DESC"
  echo "  Input: \"$INPUT\""
  local STREAM=$(run_pipeline "$INPUT")
  if echo "$STREAM" | grep -q "pipeline-clarification-needed"; then
    echo "  $FAIL  CLARIFICATION triggered — should have passed straight through!"
    echo "$STREAM" | grep '"question"' | head -3 | sed 's/^/            /'
  elif echo "$STREAM" | grep -q "pipeline-rejected"; then
    echo "  $WARN  Was REJECTED by Stage 0"
  elif echo "$STREAM" | grep -q "stage-start.*spec\|stage-complete.*validation"; then
    echo "  $PASS  Passed through to pipeline (no clarification) as expected"
  elif [ -z "$STREAM" ] || echo "$STREAM" | grep -q "NO_RUN_ID"; then
    echo "  $WARN  Could not get stream: $STREAM"
  else
    echo "  $WARN  Unexpected:"
    echo "  $(echo "$STREAM" | head -5)"
  fi
}

check_clarify    "EN vague — cover letter"       "write a cover letter"
check_clarify    "ZH vague — presentation"       "帮我写一份presentation"
check_clarify    "ZH vague — email"              "帮我写邮件"
check_clarify    "ZH placeholder XX"             "帮我写一份5分钟presentation的开场白，主题是XX"

check_no_clarify "EN clear — recursion"          "explain recursion with simple examples for beginners"
check_no_clarify "ZH full context"               "帮我写一份5分钟presentation的开场白，主题是AI在医疗领域的应用，听众是投资者"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Test run complete."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
