#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Analytics Dashboard Data Reset Script
# ═══════════════════════════════════════════════════════════════════════════════
#
# 清除所有 analytics 数据（保留表结构）
#
# 功能:
#   - 清空所有 analytics 表
#   - 可选重新生成数据
#   - 支持选择性清除
#
# 用法:
#   ./reset-data.sh [options]
#
# 选项:
#   --regenerate   清除后重新生成数据
#   --table TABLE  只清除指定表
#   --confirm      跳过确认提示
#   --help         显示帮助
#
# ⚠️ 警告: 此操作不可逆！
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
NC='\033[0m'

# 选项
REGENERATE=false
TARGET_TABLE=""
SKIP_CONFIRM=false

# Analytics 表列表
ANALYTICS_TABLES=(
    "analytics_behavior"
    "analytics_sessions"
    "analytics_users"
    "analytics_daily"
)

# 解析参数
while [[ $# -gt 0 ]]; do
    case $1 in
        --regenerate)
            REGENERATE=true
            shift
            ;;
        --table)
            TARGET_TABLE="$2"
            shift 2
            ;;
        --confirm)
            SKIP_CONFIRM=true
            shift
            ;;
        --help)
            echo "用法: ./reset-data.sh [options]"
            echo ""
            echo "选项:"
            echo "  --regenerate   清除后重新生成数据"
            echo "  --table TABLE  只清除指定表"
            echo "  --confirm      跳过确认提示"
            echo "  --help         显示帮助"
            echo ""
            echo "可用表:"
            for t in "${ANALYTICS_TABLES[@]}"; do
                echo "  • $t"
            done
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
echo "║              Analytics Dashboard Data Reset                                   ║"
echo "╚═══════════════════════════════════════════════════════════════════════════════╝"
echo ""

# 确认操作
if [ "$SKIP_CONFIRM" = false ]; then
    echo -e "${YELLOW}⚠️  WARNING: This will permanently delete analytics data!${NC}"
    echo ""
    
    if [ -n "$TARGET_TABLE" ]; then
        echo "Will reset table: $TARGET_TABLE"
    else
        echo "Will reset ALL analytics tables:"
        for t in "${ANALYTICS_TABLES[@]}"; do
            echo "  • $t"
        done
    fi
    
    echo ""
    read -p "Are you sure? (type 'yes' to confirm): " confirm
    
    if [ "$confirm" != "yes" ]; then
        echo ""
        echo -e "${YELLOW}Aborted.${NC}"
        exit 0
    fi
fi

echo ""
echo -e "${BLUE}→${NC} Resetting data..."

# 检查数据库
SQLITE_PATH="${SQLITE_PATH:-$BACKEND_DIR/data/promptly.db}"

if [ ! -f "$SQLITE_PATH" ]; then
    echo -e "${YELLOW}Database not found: $SQLITE_PATH${NC}"
    echo "Nothing to reset."
    exit 0
fi

# 检查 sqlite3
if ! command -v sqlite3 &> /dev/null; then
    echo -e "${RED}sqlite3 is required${NC}"
    exit 1
fi

# 执行重置
reset_table() {
    local table=$1
    echo -n "  Resetting $table... "
    
    # 检查表是否存在
    exists=$(sqlite3 "$SQLITE_PATH" "SELECT name FROM sqlite_master WHERE type='table' AND name='$table';")
    
    if [ -n "$exists" ]; then
        # 获取行数
        count=$(sqlite3 "$SQLITE_PATH" "SELECT COUNT(*) FROM $table;")
        
        # 清空表
        sqlite3 "$SQLITE_PATH" "DELETE FROM $table;"
        
        echo -e "${GREEN}OK${NC} ($count rows deleted)"
    else
        echo -e "${YELLOW}Table not found${NC}"
    fi
}

if [ -n "$TARGET_TABLE" ]; then
    # 只重置指定表
    reset_table "$TARGET_TABLE"
else
    # 重置所有表（按依赖顺序）
    for table in "${ANALYTICS_TABLES[@]}"; do
        reset_table "$table"
    done
fi

echo ""
echo -e "${GREEN}✓${NC} Data reset complete"

# 可选：重新生成数据
if [ "$REGENERATE" = true ]; then
    echo ""
    echo -e "${BLUE}→${NC} Regenerating data..."
    bash "$SCRIPT_DIR/generate-data.sh"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""
echo "Data has been reset. Options:"
echo ""
echo "  1. Generate new test data:"
echo -e "     ${BLUE}./generate-data.sh${NC}"
echo ""
echo "  2. Start fresh with the simulator:"
echo -e "     ${BLUE}cd $PROJECT_DIR/simulator && ./run-simulator.sh${NC}"
echo ""
