#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Analytics Dashboard Health Check Script
# ═══════════════════════════════════════════════════════════════════════════════
#
# 快速检查 analytics dashboard 的健康状态
#
# 用法:
#   ./health-check.sh [API_BASE]
#
# ═══════════════════════════════════════════════════════════════════════════════

API_BASE="${1:-http://localhost:8080}"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "Analytics Dashboard Health Check"
echo "================================="
echo ""
echo "Target: $API_BASE"
echo ""

# 检查 API
echo -n "API Health: "
RESPONSE=$(curl -s --max-time 5 "$API_BASE/api/analytics/dashboard/health" 2>/dev/null)

if [ $? -eq 0 ] && echo "$RESPONSE" | grep -q "ok\|healthy\|success"; then
    echo -e "${GREEN}OK${NC}"
    echo "  Response: $RESPONSE"
else
    echo -e "${RED}FAILED${NC}"
    echo "  Unable to reach API or unhealthy response"
fi

# 检查数据库
echo ""
echo -n "Database: "
if echo "$RESPONSE" | grep -q "database"; then
    echo -e "${GREEN}Connected${NC}"
else
    echo -e "${YELLOW}Unknown${NC}"
fi

# 检查数据
echo ""
echo -n "Data Status: "
SUMMARY=$(curl -s --max-time 5 "$API_BASE/api/analytics/dashboard/summary" 2>/dev/null)

if [ $? -eq 0 ] && echo "$SUMMARY" | grep -q "totalUsers"; then
    USERS=$(echo "$SUMMARY" | grep -o '"totalUsers":[0-9]*' | cut -d':' -f2)
    echo -e "${GREEN}Available${NC} ($USERS users)"
else
    echo -e "${YELLOW}No data or API unavailable${NC}"
fi

echo ""
echo "================================="
echo ""
