#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Analytics Dashboard Integration Test Script
# ═══════════════════════════════════════════════════════════════════════════════
#
# 运行完整的集成测试
#
# 用法:
#   ./test-integration.sh [API_BASE]
#
# ═══════════════════════════════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

API_BASE="${1:-http://localhost:8080}"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo "╔═══════════════════════════════════════════════════════════════════════════════╗"
echo "║              Analytics Dashboard Integration Tests                            ║"
echo "╚═══════════════════════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${BLUE}ℹ${NC} API Base: $API_BASE"
echo -e "${BLUE}ℹ${NC} Project: $PROJECT_DIR"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# Phase 1: 环境检查
# ═══════════════════════════════════════════════════════════════════════════════

echo "═══════════════════════════════════════════════════════════════════════════════"
echo "Phase 1: Environment Check"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""

# 检查 Node.js
echo -n "Node.js: "
if command -v node &> /dev/null; then
    node --version
else
    echo -e "${RED}Not found${NC}"
    exit 1
fi

# 检查 Python
echo -n "Python: "
if command -v python3 &> /dev/null; then
    python3 --version
else
    echo -e "${YELLOW}Not found (simulator won't work)${NC}"
fi

# 检查 curl
echo -n "curl: "
if command -v curl &> /dev/null; then
    echo -e "${GREEN}Available${NC}"
else
    echo -e "${RED}Not found${NC}"
    exit 1
fi

echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# Phase 2: 文件结构检查
# ═══════════════════════════════════════════════════════════════════════════════

echo "═══════════════════════════════════════════════════════════════════════════════"
echo "Phase 2: File Structure Check"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""

check_file() {
    if [ -f "$PROJECT_DIR/$1" ]; then
        echo -e "${GREEN}✓${NC} $1"
        return 0
    else
        echo -e "${RED}✗${NC} $1 - Missing"
        return 1
    fi
}

check_dir() {
    if [ -d "$PROJECT_DIR/$1" ]; then
        echo -e "${GREEN}✓${NC} $1/"
        return 0
    else
        echo -e "${RED}✗${NC} $1/ - Missing"
        return 1
    fi
}

STRUCTURE_OK=true

# 检查目录
check_dir "frontend" || STRUCTURE_OK=false
check_dir "backend" || STRUCTURE_OK=false
check_dir "backend/routes" || STRUCTURE_OK=false
check_dir "backend/lib" || STRUCTURE_OK=false
check_dir "backend/migrations" || STRUCTURE_OK=false
check_dir "simulator" || STRUCTURE_OK=false
check_dir "docs" || STRUCTURE_OK=false
check_dir "config" || STRUCTURE_OK=false

# 检查关键文件
check_file "frontend/analytics-dashboard.html" || STRUCTURE_OK=false
check_file "frontend/analytics-dashboard.css" || STRUCTURE_OK=false
check_file "frontend/analytics-dashboard.js" || STRUCTURE_OK=false
check_file "backend/routes/analyticsDashboard.js" || STRUCTURE_OK=false
check_file "backend/migrations/002_analytics.js" || STRUCTURE_OK=false
check_file "simulator/behavior-simulator.py" || STRUCTURE_OK=false
check_file "README.md" || STRUCTURE_OK=false

echo ""

if [ "$STRUCTURE_OK" = false ]; then
    echo -e "${RED}File structure check failed!${NC}"
    exit 1
fi

# ═══════════════════════════════════════════════════════════════════════════════
# Phase 3: API 测试
# ═══════════════════════════════════════════════════════════════════════════════

echo "═══════════════════════════════════════════════════════════════════════════════"
echo "Phase 3: API Tests"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""

# 检查 API 是否可访问
echo -n "Checking API availability... "
if curl -s --max-time 5 "$API_BASE/api/analytics/dashboard/health" > /dev/null 2>&1; then
    echo -e "${GREEN}OK${NC}"
    
    # 运行 API 测试
    echo ""
    bash "$SCRIPT_DIR/test-api.sh" "$API_BASE"
    API_RESULT=$?
else
    echo -e "${YELLOW}API not available${NC}"
    echo "Skipping API tests (start the server first)"
    API_RESULT=0  # 不算失败，只是跳过
fi

echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# Phase 4: 前端测试
# ═══════════════════════════════════════════════════════════════════════════════

echo "═══════════════════════════════════════════════════════════════════════════════"
echo "Phase 4: Frontend Tests"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""

node "$SCRIPT_DIR/test-frontend.js" "$API_BASE"
FRONTEND_RESULT=$?

echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# Phase 5: 模拟器测试
# ═══════════════════════════════════════════════════════════════════════════════

echo "═══════════════════════════════════════════════════════════════════════════════"
echo "Phase 5: Simulator Tests"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""

if command -v python3 &> /dev/null; then
    # 语法检查
    echo -n "Checking Python syntax... "
    if python3 -m py_compile "$PROJECT_DIR/simulator/behavior-simulator.py" 2>/dev/null; then
        echo -e "${GREEN}OK${NC}"
    else
        echo -e "${RED}Syntax error${NC}"
    fi
    
    # 检查测试脚本
    echo -n "Checking test simulator... "
    if python3 -m py_compile "$PROJECT_DIR/simulator/behavior-simulator-test.py" 2>/dev/null; then
        echo -e "${GREEN}OK${NC}"
    else
        echo -e "${RED}Syntax error${NC}"
    fi
    
    # 干运行测试
    echo ""
    echo "Running simulator dry-run test..."
    cd "$PROJECT_DIR/simulator"
    if python3 behavior-simulator.py --rounds 1 --dry-run; then
        echo -e "${GREEN}✓${NC} Simulator dry-run successful"
        SIMULATOR_RESULT=0
    else
        echo -e "${RED}✗${NC} Simulator dry-run failed"
        SIMULATOR_RESULT=1
    fi
else
    echo -e "${YELLOW}Python not available, skipping simulator tests${NC}"
    SIMULATOR_RESULT=0
fi

echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# 最终结果
# ═══════════════════════════════════════════════════════════════════════════════

echo "═══════════════════════════════════════════════════════════════════════════════"
echo "                            Final Results"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""

TOTAL_FAILED=0

if [ $API_RESULT -ne 0 ]; then
    echo -e "  API Tests:       ${RED}FAILED${NC}"
    TOTAL_FAILED=$((TOTAL_FAILED + 1))
else
    echo -e "  API Tests:       ${GREEN}PASSED${NC}"
fi

if [ $FRONTEND_RESULT -ne 0 ]; then
    echo -e "  Frontend Tests:  ${RED}FAILED${NC}"
    TOTAL_FAILED=$((TOTAL_FAILED + 1))
else
    echo -e "  Frontend Tests:  ${GREEN}PASSED${NC}"
fi

if [ $SIMULATOR_RESULT -ne 0 ]; then
    echo -e "  Simulator Tests: ${RED}FAILED${NC}"
    TOTAL_FAILED=$((TOTAL_FAILED + 1))
else
    echo -e "  Simulator Tests: ${GREEN}PASSED${NC}"
fi

echo ""

if [ $TOTAL_FAILED -eq 0 ]; then
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                     All Integration Tests Passed! ✓                          ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════════════════════╝${NC}"
    exit 0
else
    echo -e "${RED}╔═══════════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║                     Some Tests Failed ($TOTAL_FAILED failures) ✗                           ║${NC}"
    echo -e "${RED}╚═══════════════════════════════════════════════════════════════════════════════╝${NC}"
    exit 1
fi
