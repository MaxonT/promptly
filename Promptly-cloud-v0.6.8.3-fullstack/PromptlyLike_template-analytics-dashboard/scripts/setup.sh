#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Analytics Dashboard Setup Script
# ═══════════════════════════════════════════════════════════════════════════════
#
# 一键初始化 analytics dashboard 模板
#
# 功能:
#   - 检查依赖
#   - 安装 npm 包
#   - 安装 Python 依赖（可选）
#   - 初始化配置文件
#   - 运行数据库迁移
#   - 生成初始数据
#
# 用法:
#   ./setup.sh [options]
#
# 选项:
#   --no-data      跳过数据生成
#   --no-python    跳过 Python 配置
#   --force        强制重新设置
#   --help         显示帮助
#
# ═══════════════════════════════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_DIR/../backend"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 默认选项
SKIP_DATA=false
SKIP_PYTHON=false
FORCE=false

# 解析参数
while [[ $# -gt 0 ]]; do
    case $1 in
        --no-data)
            SKIP_DATA=true
            shift
            ;;
        --no-python)
            SKIP_PYTHON=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --help)
            echo "用法: ./setup.sh [options]"
            echo ""
            echo "选项:"
            echo "  --no-data      跳过数据生成"
            echo "  --no-python    跳过 Python 配置"
            echo "  --force        强制重新设置"
            echo "  --help         显示帮助"
            exit 0
            ;;
        *)
            echo -e "${RED}未知选项: $1${NC}"
            exit 1
            ;;
    esac
done

# ═══════════════════════════════════════════════════════════════════════════════
# 工具函数
# ═══════════════════════════════════════════════════════════════════════════════

print_header() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════════════${NC}"
    echo ""
}

print_step() {
    echo -e "${BLUE}→${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

check_command() {
    if command -v "$1" &> /dev/null; then
        print_success "$1 found: $(command -v "$1")"
        return 0
    else
        print_error "$1 not found"
        return 1
    fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# Main Setup
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo "╔═══════════════════════════════════════════════════════════════════════════════╗"
echo "║           Analytics Dashboard Template Setup                                  ║"
echo "╚═══════════════════════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${BLUE}ℹ${NC} Project: $PROJECT_DIR"
echo -e "${BLUE}ℹ${NC} Backend: $BACKEND_DIR"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# Step 1: 检查依赖
# ═══════════════════════════════════════════════════════════════════════════════

print_header "Step 1: Checking Dependencies"

DEPS_OK=true

# Node.js
print_step "Checking Node.js..."
if check_command node; then
    NODE_VERSION=$(node --version | cut -d'v' -f2)
    MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1)
    if [ "$MAJOR_VERSION" -lt 16 ]; then
        print_warning "Node.js version $NODE_VERSION is below recommended 16.x"
    fi
else
    DEPS_OK=false
fi

# npm
print_step "Checking npm..."
check_command npm || DEPS_OK=false

# Python (可选)
if [ "$SKIP_PYTHON" = false ]; then
    print_step "Checking Python..."
    if check_command python3; then
        PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
    fi
fi

# 检查结果
if [ "$DEPS_OK" = false ]; then
    print_error "Required dependencies are missing!"
    echo ""
    echo "Please install:"
    echo "  - Node.js 16+ (https://nodejs.org/)"
    echo "  - npm (comes with Node.js)"
    exit 1
fi

# ═══════════════════════════════════════════════════════════════════════════════
# Step 2: 初始化配置
# ═══════════════════════════════════════════════════════════════════════════════

print_header "Step 2: Initializing Configuration"

# 复制后端配置
print_step "Setting up backend configuration..."
if [ ! -f "$PROJECT_DIR/config/backend-config.json" ] || [ "$FORCE" = true ]; then
    cp "$PROJECT_DIR/config/backend-config.example.json" "$PROJECT_DIR/config/backend-config.json"
    print_success "Created backend-config.json"
else
    print_warning "backend-config.json already exists (use --force to overwrite)"
fi

# 复制环境变量
print_step "Setting up environment variables..."
if [ ! -f "$BACKEND_DIR/.env" ] || [ "$FORCE" = true ]; then
    if [ -f "$PROJECT_DIR/config/.env.example" ]; then
        cp "$PROJECT_DIR/config/.env.example" "$BACKEND_DIR/.env"
        print_success "Created .env file"
    else
        print_warning ".env.example not found"
    fi
else
    print_warning ".env already exists (use --force to overwrite)"
fi

# 复制模拟器配置
if [ "$SKIP_PYTHON" = false ]; then
    print_step "Setting up simulator configuration..."
    if [ ! -f "$PROJECT_DIR/simulator/simulator-config.json" ] || [ "$FORCE" = true ]; then
        cp "$PROJECT_DIR/simulator/simulator-config.example.json" "$PROJECT_DIR/simulator/simulator-config.json"
        print_success "Created simulator-config.json"
    else
        print_warning "simulator-config.json already exists (use --force to overwrite)"
    fi
fi

# ═══════════════════════════════════════════════════════════════════════════════
# Step 3: 安装依赖
# ═══════════════════════════════════════════════════════════════════════════════

print_header "Step 3: Installing Dependencies"

# 后端 npm 依赖
print_step "Installing backend npm packages..."
if [ -f "$BACKEND_DIR/package.json" ]; then
    cd "$BACKEND_DIR"
    npm install
    print_success "Backend dependencies installed"
else
    print_warning "Backend package.json not found"
fi

# Python 依赖
if [ "$SKIP_PYTHON" = false ]; then
    print_step "Setting up Python environment..."
    
    # 检查 requests 模块
    if python3 -c "import requests" 2>/dev/null; then
        print_success "Python requests module available"
    else
        print_step "Installing Python requests module..."
        pip3 install requests --user
        print_success "Python requests installed"
    fi
fi

# ═══════════════════════════════════════════════════════════════════════════════
# Step 4: 数据库迁移
# ═══════════════════════════════════════════════════════════════════════════════

print_header "Step 4: Running Database Migrations"

print_step "Running analytics migrations..."
bash "$SCRIPT_DIR/migrate.sh"

# ═══════════════════════════════════════════════════════════════════════════════
# Step 5: 生成初始数据
# ═══════════════════════════════════════════════════════════════════════════════

if [ "$SKIP_DATA" = false ]; then
    print_header "Step 5: Generating Initial Data"
    
    print_step "Generating S-curve historical data..."
    bash "$SCRIPT_DIR/generate-data.sh"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# Step 6: 设置脚本权限
# ═══════════════════════════════════════════════════════════════════════════════

print_header "Step 6: Setting Permissions"

print_step "Making scripts executable..."
chmod +x "$PROJECT_DIR/scripts/"*.sh 2>/dev/null || true
chmod +x "$PROJECT_DIR/simulator/"*.sh 2>/dev/null || true
chmod +x "$PROJECT_DIR/tests/"*.sh 2>/dev/null || true
print_success "Script permissions set"

# ═══════════════════════════════════════════════════════════════════════════════
# 完成
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                        Setup Complete! ✓                                      ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Next steps:"
echo ""
echo "  1. Start the backend server:"
echo -e "     ${CYAN}cd $BACKEND_DIR && npm run dev${NC}"
echo ""
echo "  2. Open the dashboard in browser:"
echo -e "     ${CYAN}http://localhost:8080/analytics-dashboard.html${NC}"
echo ""
echo "  3. (Optional) Start the behavior simulator:"
echo -e "     ${CYAN}cd $PROJECT_DIR/simulator && ./run-simulator.sh${NC}"
echo ""
echo "  4. Run tests to verify everything works:"
echo -e "     ${CYAN}cd $PROJECT_DIR/tests && ./test-integration.sh${NC}"
echo ""
