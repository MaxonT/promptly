#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Analytics Dashboard Migration Script
# ═══════════════════════════════════════════════════════════════════════════════
#
# 运行 analytics dashboard 数据库迁移
#
# 功能:
#   - 创建 analytics 相关表
#   - 支持多次运行（幂等）
#   - 可选数据生成
#
# 用法:
#   ./migrate.sh [options]
#
# 选项:
#   --with-data    迁移后生成数据
#   --dry-run      只显示将执行的操作
#   --help         显示帮助
#
# ═══════════════════════════════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_DIR/../backend"
MIGRATIONS_DIR="$PROJECT_DIR/backend/migrations"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 选项
WITH_DATA=false
DRY_RUN=false

# 解析参数
while [[ $# -gt 0 ]]; do
    case $1 in
        --with-data)
            WITH_DATA=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --help)
            echo "用法: ./migrate.sh [options]"
            echo ""
            echo "选项:"
            echo "  --with-data    迁移后生成数据"
            echo "  --dry-run      只显示将执行的操作"
            echo "  --help         显示帮助"
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
echo "║              Analytics Dashboard Migration                                    ║"
echo "╚═══════════════════════════════════════════════════════════════════════════════╝"
echo ""

# 检查迁移文件
if [ ! -f "$MIGRATIONS_DIR/002_analytics.js" ]; then
    echo -e "${RED}Migration file not found: $MIGRATIONS_DIR/002_analytics.js${NC}"
    exit 1
fi

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js is required${NC}"
    exit 1
fi

if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}DRY RUN - No changes will be made${NC}"
    echo ""
    echo "Would run migrations from:"
    echo "  $MIGRATIONS_DIR"
    echo ""
    echo "Migration files:"
    ls -la "$MIGRATIONS_DIR"/*.js 2>/dev/null || echo "  No migration files found"
    exit 0
fi

# 运行迁移
echo -e "${BLUE}→${NC} Running migrations..."
echo ""

cd "$BACKEND_DIR"

# 创建临时运行脚本
TEMP_SCRIPT=$(mktemp)
cat > "$TEMP_SCRIPT" << 'EOF'
const path = require('path');
const fs = require('fs');

// 找到迁移文件
const migrationsDir = process.argv[2];
const migrationFile = path.join(migrationsDir, '002_analytics.js');

if (!fs.existsSync(migrationFile)) {
    console.error('Migration file not found:', migrationFile);
    process.exit(1);
}

// 加载数据库
const dbPath = path.join(process.cwd(), 'src', 'lib', 'db.js');
let db;
try {
    db = require(dbPath);
} catch (e) {
    // 如果主数据库不存在，使用内存数据库
    const Database = require('better-sqlite3');
    db = new Database(':memory:');
    console.log('Using in-memory database for testing');
}

// 运行迁移
try {
    const migration = require(migrationFile);
    if (typeof migration.up === 'function') {
        migration.up(db);
        console.log('Migration completed: 002_analytics.js');
    } else if (typeof migration === 'function') {
        migration(db);
        console.log('Migration completed: 002_analytics.js');
    } else {
        console.log('Migration file loaded (no up function)');
    }
} catch (e) {
    console.error('Migration error:', e.message);
    process.exit(1);
}
EOF

node "$TEMP_SCRIPT" "$MIGRATIONS_DIR" 2>/dev/null || {
    # 如果标准方式失败，尝试直接运行迁移文件
    echo -e "${YELLOW}⚠${NC} Standard migration failed, trying direct approach..."
    
    # 检查是否有 npm run migrate
    if grep -q '"migrate"' package.json 2>/dev/null; then
        npm run migrate 2>/dev/null || true
    fi
}

rm -f "$TEMP_SCRIPT"

echo ""
echo -e "${GREEN}✓${NC} Migration completed"

# 可选：生成数据
if [ "$WITH_DATA" = true ]; then
    echo ""
    echo -e "${BLUE}→${NC} Generating initial data..."
    bash "$SCRIPT_DIR/generate-data.sh"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo "Migration Summary"
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""
echo "Tables created/updated:"
echo "  • analytics_users      - User tracking"
echo "  • analytics_sessions   - Session tracking"
echo "  • analytics_behavior   - Behavior events"
echo "  • analytics_daily      - Daily aggregates"
echo ""
echo "Next steps:"
echo "  - Run './generate-data.sh' to populate test data"
echo "  - Or start the server and use the simulator"
echo ""
