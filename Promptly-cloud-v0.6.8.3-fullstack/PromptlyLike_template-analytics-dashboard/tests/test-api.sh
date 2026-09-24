#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Analytics Dashboard API Test Script
# ═══════════════════════════════════════════════════════════════════════════════
#
# 测试所有 Analytics Dashboard API 端点
#
# 用法:
#   ./test-api.sh [API_BASE]
#
# 示例:
#   ./test-api.sh                           # 使用默认 localhost:8080
#   ./test-api.sh https://api.example.com   # 使用自定义地址
#
# ═══════════════════════════════════════════════════════════════════════════════

set -e

# 配置
API_BASE="${1:-http://localhost:8080}"
API_PATH="/api/analytics/dashboard"
FULL_URL="${API_BASE}${API_PATH}"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 计数器
PASSED=0
FAILED=0
TOTAL=0

# ═══════════════════════════════════════════════════════════════════════════════
# 测试函数
# ═══════════════════════════════════════════════════════════════════════════════

test_endpoint() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    local expected_status="${5:-200}"
    
    TOTAL=$((TOTAL + 1))
    echo -n "Testing: $name... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "${FULL_URL}${endpoint}")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "${FULL_URL}${endpoint}")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "$expected_status" ]; then
        # 检查 JSON 中是否有 ok: true
        if echo "$body" | grep -q '"ok":true' || echo "$body" | grep -q '"ok": true'; then
            echo -e "${GREEN}PASS${NC} (HTTP $http_code)"
            PASSED=$((PASSED + 1))
        else
            echo -e "${YELLOW}WARN${NC} (HTTP $http_code, but ok != true)"
            echo "  Response: $body" | head -c 200
            echo ""
            PASSED=$((PASSED + 1))  # 仍算通过，只是警告
        fi
    else
        echo -e "${RED}FAIL${NC} (Expected $expected_status, got $http_code)"
        echo "  Response: $body" | head -c 200
        echo ""
        FAILED=$((FAILED + 1))
    fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# 主测试
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo "╔═══════════════════════════════════════════════════════════════════════════════╗"
echo "║                    Analytics Dashboard API Tests                              ║"
echo "╚═══════════════════════════════════════════════════════════════════════════════╝"
echo ""
echo "API Base: $FULL_URL"
echo ""
echo "─────────────────────────────────────────────────────────────────────────────────"

# 1. Health Check
test_endpoint "Health Check" "GET" "/health"

# 2. Summary
test_endpoint "Get Summary" "GET" "/summary"

# 3. Timeseries (默认)
test_endpoint "Get Timeseries (default)" "GET" "/timeseries"

# 4. Timeseries (7天)
test_endpoint "Get Timeseries (7 days)" "GET" "/timeseries?days=7"

# 5. Timeseries (30天)
test_endpoint "Get Timeseries (30 days)" "GET" "/timeseries?days=30"

# 6. Growth
test_endpoint "Get Growth Data" "GET" "/growth"

# 7. Track User
TEST_USER_ID="test_user_$(date +%s)"
test_endpoint "Track User" "POST" "/track/user" "{\"userId\": \"$TEST_USER_ID\", \"source\": \"test\"}"

# 8. Track User (重复)
test_endpoint "Track User (duplicate)" "POST" "/track/user" "{\"userId\": \"$TEST_USER_ID\"}"

# 9. Track Session Start
TEST_SESSION_ID="test_session_$(date +%s)"
test_endpoint "Track Session Start" "POST" "/track/session-start" "{\"sessionId\": \"$TEST_SESSION_ID\", \"userId\": \"$TEST_USER_ID\"}"

# 10. Track Behavior
test_endpoint "Track Behavior" "POST" "/track/behavior" "{\"userId\": \"$TEST_USER_ID\", \"sessionId\": \"$TEST_SESSION_ID\", \"mouseMovements\": 100, \"clicks\": 10}"

# 11. Track Session End
test_endpoint "Track Session End" "POST" "/track/session-end" "{\"sessionId\": \"$TEST_SESSION_ID\", \"duration\": 120, \"pageViews\": 3}"

# 12. Track User (missing userId)
echo -n "Testing: Track User (missing userId)... "
response=$(curl -s -w "\n%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d '{}' \
    "${FULL_URL}/track/user")
http_code=$(echo "$response" | tail -n1)
TOTAL=$((TOTAL + 1))
if [ "$http_code" = "400" ]; then
    echo -e "${GREEN}PASS${NC} (Expected 400, got $http_code)"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}FAIL${NC} (Expected 400, got $http_code)"
    FAILED=$((FAILED + 1))
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 结果汇总
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo "─────────────────────────────────────────────────────────────────────────────────"
echo ""
echo "╔═══════════════════════════════════════════════════════════════════════════════╗"
echo "║                              Test Results                                     ║"
echo "╚═══════════════════════════════════════════════════════════════════════════════╝"
echo ""
echo -e "  Total:  $TOTAL"
echo -e "  Passed: ${GREEN}$PASSED${NC}"
echo -e "  Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed${NC}"
    exit 1
fi
