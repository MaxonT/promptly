#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Analytics Behavior Simulator - Shell Wrapper
# ═══════════════════════════════════════════════════════════════════════════════
# 
# 便捷脚本，用于运行行为模拟器
#
# 用法:
#   ./run-simulator.sh              # 默认运行（无限循环）
#   ./run-simulator.sh --test       # 测试模式（2轮）
#   ./run-simulator.sh --rounds 10  # 指定轮数
#   ./run-simulator.sh --dry-run    # 仅模拟
#   ./run-simulator.sh --help       # 显示帮助
#
# ═══════════════════════════════════════════════════════════════════════════════

# 脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 默认配置
PYTHON_CMD="python3"
SIMULATOR_SCRIPT="$SCRIPT_DIR/behavior-simulator.py"
TEST_SCRIPT="$SCRIPT_DIR/behavior-simulator-test.py"

# ═══════════════════════════════════════════════════════════════════════════════
# 帮助信息
# ═══════════════════════════════════════════════════════════════════════════════

show_help() {
    echo "╔═══════════════════════════════════════════════════════════════════════════════╗"
    echo "║                 Analytics Behavior Simulator                                  ║"
    echo "╚═══════════════════════════════════════════════════════════════════════════════╝"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --test, -t          Run in test mode (2 rounds only)"
    echo "  --rounds N, -r N    Number of rounds (-1 for unlimited)"
    echo "  --interval N, -i N  Seconds between rounds (default: 60)"
    echo "  --dry-run, -d       Simulate without sending requests"
    echo "  --verbose, -v       Enable verbose logging"
    echo "  --help, -h          Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  ANALYTICS_API_BASE  API base URL (default: http://localhost:8080)"
    echo "  ADMIN_API_KEY       Admin API key for authentication"
    echo ""
    echo "Examples:"
    echo "  $0                           # Run unlimited"
    echo "  $0 --test                    # Quick test (2 rounds)"
    echo "  $0 --rounds 10 --interval 30 # 10 rounds, 30s interval"
    echo "  $0 --dry-run --verbose       # Verbose dry-run"
    echo ""
}

# ═══════════════════════════════════════════════════════════════════════════════
# 检查依赖
# ═══════════════════════════════════════════════════════════════════════════════

check_dependencies() {
    # 检查 Python
    if ! command -v $PYTHON_CMD &> /dev/null; then
        echo "Error: Python 3 not found. Please install Python 3.8+"
        exit 1
    fi
    
    # 检查 Python 版本
    PYTHON_VERSION=$($PYTHON_CMD -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
    MAJOR=$(echo $PYTHON_VERSION | cut -d. -f1)
    MINOR=$(echo $PYTHON_VERSION | cut -d. -f2)
    
    if [ "$MAJOR" -lt 3 ] || ([ "$MAJOR" -eq 3 ] && [ "$MINOR" -lt 8 ]); then
        echo "Error: Python 3.8+ required, found $PYTHON_VERSION"
        exit 1
    fi
    
    echo "✓ Python $PYTHON_VERSION found"
    
    # 检查模拟器脚本
    if [ ! -f "$SIMULATOR_SCRIPT" ]; then
        echo "Error: Simulator script not found: $SIMULATOR_SCRIPT"
        exit 1
    fi
    
    echo "✓ Simulator script found"
}

# ═══════════════════════════════════════════════════════════════════════════════
# 主逻辑
# ═══════════════════════════════════════════════════════════════════════════════

# 解析参数
TEST_MODE=false
ARGS=()

while [[ $# -gt 0 ]]; do
    case $1 in
        --test|-t)
            TEST_MODE=true
            shift
            ;;
        --help|-h)
            show_help
            exit 0
            ;;
        *)
            ARGS+=("$1")
            shift
            ;;
    esac
done

# 检查依赖
check_dependencies

echo ""
echo "╔═══════════════════════════════════════════════════════════════════════════════╗"
echo "║                 Starting Behavior Simulator                                   ║"
echo "╚═══════════════════════════════════════════════════════════════════════════════╝"
echo ""

# 运行
if [ "$TEST_MODE" = true ]; then
    echo "Running in TEST mode..."
    echo ""
    $PYTHON_CMD "$TEST_SCRIPT"
else
    echo "Running simulator..."
    echo "Press Ctrl+C to stop"
    echo ""
    $PYTHON_CMD "$SIMULATOR_SCRIPT" "${ARGS[@]}"
fi

EXIT_CODE=$?

echo ""
echo "Simulator exited with code: $EXIT_CODE"
exit $EXIT_CODE
