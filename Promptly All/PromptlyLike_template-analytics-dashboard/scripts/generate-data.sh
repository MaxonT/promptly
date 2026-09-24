#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Analytics Dashboard Data Generation Script
# ═══════════════════════════════════════════════════════════════════════════════
#
# 生成 S-curve 模式的历史数据
#
# 功能:
#   - 生成基于 S-curve 的用户增长数据
#   - 模拟真实的用户行为分布
#   - 支持多种增长场景
#
# 用法:
#   ./generate-data.sh [options]
#
# 选项:
#   --days DAYS       生成的天数 (默认: 90)
#   --target USERS    目标用户数 (默认: 1000)
#   --scenario TYPE   增长场景: rapid|steady|slow|viral (默认: steady)
#   --api-base URL    API 地址 (默认: http://localhost:8080)
#   --dry-run         只显示将生成的数据
#   --help            显示帮助
#
# ═══════════════════════════════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_DIR/../backend"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 默认参数
DAYS=90
TARGET_USERS=1000
SCENARIO="steady"
API_BASE="http://localhost:8080"
DRY_RUN=false

# 解析参数
while [[ $# -gt 0 ]]; do
    case $1 in
        --days)
            DAYS="$2"
            shift 2
            ;;
        --target)
            TARGET_USERS="$2"
            shift 2
            ;;
        --scenario)
            SCENARIO="$2"
            shift 2
            ;;
        --api-base)
            API_BASE="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --help)
            echo "用法: ./generate-data.sh [options]"
            echo ""
            echo "选项:"
            echo "  --days DAYS       生成的天数 (默认: 90)"
            echo "  --target USERS    目标用户数 (默认: 1000)"
            echo "  --scenario TYPE   增长场景 (默认: steady)"
            echo "  --api-base URL    API 地址 (默认: http://localhost:8080)"
            echo "  --dry-run         只显示将生成的数据"
            echo "  --help            显示帮助"
            echo ""
            echo "增长场景:"
            echo "  rapid   - 快速增长 (k=0.15)"
            echo "  steady  - 稳定增长 (k=0.08)"
            echo "  slow    - 缓慢增长 (k=0.05)"
            echo "  viral   - 病毒式增长 (k=0.20)"
            exit 0
            ;;
        *)
            echo -e "${RED}未知选项: $1${NC}"
            exit 1
            ;;
    esac
done

echo ""
echo "╔═══════════════════════════════════════════════════════════════════════════════╗"
echo "║              Analytics Data Generator                                         ║"
echo "╚═══════════════════════════════════════════════════════════════════════════════╝"
echo ""

# 显示配置
echo "Configuration:"
echo "  • Days: $DAYS"
echo "  • Target Users: $TARGET_USERS"
echo "  • Scenario: $SCENARIO"
echo "  • API Base: $API_BASE"
echo ""

# 根据场景设置 k 值
case $SCENARIO in
    rapid)
        K_VALUE=0.15
        ;;
    steady)
        K_VALUE=0.08
        ;;
    slow)
        K_VALUE=0.05
        ;;
    viral)
        K_VALUE=0.20
        ;;
    *)
        echo -e "${RED}Unknown scenario: $SCENARIO${NC}"
        exit 1
        ;;
esac

# 计算拐点（50% 处）
X0=$((DAYS / 2))

echo "S-curve parameters:"
echo "  • L (target): $TARGET_USERS"
echo "  • k (growth rate): $K_VALUE"
echo "  • x0 (inflection): Day $X0"
echo ""

# Dry run
if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}DRY RUN - Showing sample data:${NC}"
    echo ""
    
    # 使用 Python 计算示例数据
    python3 << EOF
import math

L = $TARGET_USERS
k = $K_VALUE
x0 = $X0
days = $DAYS

print(f"{'Day':<6} {'Total Users':<14} {'New Users':<12} {'Growth %'}")
print("-" * 45)

prev_users = 0
for day in range(1, days + 1, days // 10):  # 每10%显示一次
    total = L / (1 + math.exp(-k * (day - x0)))
    new_users = total - prev_users
    growth_pct = (new_users / max(prev_users, 1)) * 100 if day > 1 else 0
    print(f"{day:<6} {int(total):<14} {int(new_users):<12} {growth_pct:.1f}%")
    prev_users = total

print()
print(f"Final day {days}: {int(L / (1 + math.exp(-k * (days - x0))))} users")
EOF
    
    exit 0
fi

# 检查 API 是否可用
echo -e "${BLUE}→${NC} Checking API availability..."
if ! curl -s --max-time 5 "$API_BASE/api/analytics/dashboard/health" > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠${NC} API not available at $API_BASE"
    echo ""
    echo "Trying direct database generation..."
    
    # 直接通过 Node.js 生成数据
    if [ -f "$PROJECT_DIR/backend/migrations/002_analytics.js" ]; then
        echo -e "${BLUE}→${NC} Running migration with data generation..."
        
        cd "$BACKEND_DIR"
        
        # 创建临时脚本
        TEMP_SCRIPT=$(mktemp)
        cat > "$TEMP_SCRIPT" << EOFNODE
const path = require('path');
const Database = require('better-sqlite3');

const dbPath = process.env.SQLITE_PATH || path.join(__dirname, 'data', 'promptly.db');
const db = new Database(dbPath);

const L = $TARGET_USERS;
const k = $K_VALUE;
const x0 = $X0;
const days = $DAYS;

// S-curve function
function sCurve(x) {
    return L / (1 + Math.exp(-k * (x - x0)));
}

// Generate data
const now = new Date();
let totalUsers = 0;

console.log('Generating S-curve data...');

for (let day = 0; day < days; day++) {
    const date = new Date(now);
    date.setDate(date.getDate() - (days - day));
    const dateStr = date.toISOString().split('T')[0];
    
    const targetTotal = Math.floor(sCurve(day + 1));
    const newUsers = Math.max(0, targetTotal - totalUsers);
    totalUsers = targetTotal;
    
    // Insert daily record
    try {
        db.prepare(\`
            INSERT OR REPLACE INTO analytics_daily 
            (date, total_users, new_users, active_users, total_sessions, page_views)
            VALUES (?, ?, ?, ?, ?, ?)
        \`).run(
            dateStr,
            totalUsers,
            newUsers,
            Math.floor(totalUsers * 0.3),
            Math.floor(totalUsers * 0.5),
            Math.floor(totalUsers * 2)
        );
    } catch (e) {
        // Table might not exist
    }
    
    if ((day + 1) % 10 === 0) {
        console.log(\`  Day \${day + 1}: \${totalUsers} total users\`);
    }
}

console.log(\`\\nGenerated \${days} days of data\`);
console.log(\`Final total: \${totalUsers} users\`);

db.close();
EOFNODE
        
        node "$TEMP_SCRIPT" 2>/dev/null || echo -e "${YELLOW}Direct generation requires database setup${NC}"
        rm -f "$TEMP_SCRIPT"
    fi
    
    exit 0
fi

echo -e "${GREEN}✓${NC} API available"
echo ""

# 通过 API 生成数据
echo -e "${BLUE}→${NC} Generating data via API..."

RESPONSE=$(curl -s -X POST "$API_BASE/api/analytics/dashboard/admin/generate-data" \
    -H "Content-Type: application/json" \
    -d "{
        \"days\": $DAYS,
        \"targetUsers\": $TARGET_USERS,
        \"growthRate\": $K_VALUE,
        \"scenario\": \"$SCENARIO\"
    }")

# 检查响应
if echo "$RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✓${NC} Data generation successful"
    echo ""
    echo "Generated data:"
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
else
    echo -e "${RED}✗${NC} Data generation failed"
    echo "$RESPONSE"
    exit 1
fi

echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""
echo "Data generation complete! View your dashboard at:"
echo -e "  ${CYAN}$API_BASE/analytics-dashboard.html${NC}"
echo ""
