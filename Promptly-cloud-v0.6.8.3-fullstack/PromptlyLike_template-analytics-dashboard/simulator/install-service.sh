#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Analytics Behavior Simulator - macOS Service Installer
# ═══════════════════════════════════════════════════════════════════════════════
#
# 将行为模拟器安装为 macOS 后台服务 (launchd agent)
#
# 用法:
#   ./install-service.sh [API_BASE]
#
# 示例:
#   ./install-service.sh                           # 使用默认 localhost:8080
#   ./install-service.sh https://api.example.com   # 使用自定义 API 地址
#
# ═══════════════════════════════════════════════════════════════════════════════

set -e

# 配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_NAME="com.analytics.behavior-simulator"
PLIST_TEMPLATE="$SCRIPT_DIR/com.analytics.behavior-simulator.plist"
PLIST_DEST="$HOME/Library/LaunchAgents/$SERVICE_NAME.plist"
LOG_DIR="/tmp"

# API 基础地址
API_BASE="${1:-http://localhost:8080}"

# Python 路径
PYTHON_PATH=$(which python3 2>/dev/null || echo "/usr/bin/python3")

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo "╔═══════════════════════════════════════════════════════════════════════════════╗"
echo "║           Analytics Behavior Simulator - Service Installer                    ║"
echo "╚═══════════════════════════════════════════════════════════════════════════════╝"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# 检查
# ═══════════════════════════════════════════════════════════════════════════════

echo "Checking prerequisites..."

# 检查是否为 macOS
if [[ "$(uname)" != "Darwin" ]]; then
    echo -e "${RED}Error: This script is for macOS only${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} macOS detected"

# 检查 Python
if [ ! -x "$PYTHON_PATH" ]; then
    echo -e "${RED}Error: Python 3 not found at $PYTHON_PATH${NC}"
    exit 1
fi
PYTHON_VERSION=$($PYTHON_PATH --version 2>&1 | cut -d' ' -f2)
echo -e "${GREEN}✓${NC} Python $PYTHON_VERSION found"

# 检查模拟器脚本
SIMULATOR_SCRIPT="$SCRIPT_DIR/behavior-simulator.py"
if [ ! -f "$SIMULATOR_SCRIPT" ]; then
    echo -e "${RED}Error: Simulator script not found: $SIMULATOR_SCRIPT${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} Simulator script found"

# 检查模板
if [ ! -f "$PLIST_TEMPLATE" ]; then
    echo -e "${RED}Error: plist template not found: $PLIST_TEMPLATE${NC}"
    exit 1
fi
echo -e "${GREEN}✓${NC} plist template found"

# ═══════════════════════════════════════════════════════════════════════════════
# 停止现有服务
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo "Checking for existing service..."

if launchctl list | grep -q "$SERVICE_NAME"; then
    echo -e "${YELLOW}Stopping existing service...${NC}"
    launchctl unload "$PLIST_DEST" 2>/dev/null || true
    sleep 1
    echo -e "${GREEN}✓${NC} Existing service stopped"
else
    echo "No existing service found"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 创建 LaunchAgents 目录
# ═══════════════════════════════════════════════════════════════════════════════

if [ ! -d "$HOME/Library/LaunchAgents" ]; then
    mkdir -p "$HOME/Library/LaunchAgents"
    echo -e "${GREEN}✓${NC} Created LaunchAgents directory"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 生成 plist 文件
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo "Generating plist file..."

# 读取模板并替换占位符
sed \
    -e "s|{{PROJECT_PATH}}|$SCRIPT_DIR|g" \
    -e "s|/usr/bin/python3|$PYTHON_PATH|g" \
    -e "s|http://localhost:8080|$API_BASE|g" \
    "$PLIST_TEMPLATE" > "$PLIST_DEST"

chmod 644 "$PLIST_DEST"
echo -e "${GREEN}✓${NC} plist file created: $PLIST_DEST"

# ═══════════════════════════════════════════════════════════════════════════════
# 加载服务
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo "Loading service..."

launchctl load "$PLIST_DEST"

sleep 2

# 验证
if launchctl list | grep -q "$SERVICE_NAME"; then
    echo -e "${GREEN}✓${NC} Service loaded successfully"
else
    echo -e "${RED}✗${NC} Service failed to load"
    exit 1
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 完成
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo "╔═══════════════════════════════════════════════════════════════════════════════╗"
echo "║                        Installation Complete!                                 ║"
echo "╚═══════════════════════════════════════════════════════════════════════════════╝"
echo ""
echo "Configuration:"
echo "  Service Name: $SERVICE_NAME"
echo "  API Base:     $API_BASE"
echo "  Script:       $SIMULATOR_SCRIPT"
echo "  plist:        $PLIST_DEST"
echo ""
echo "Log files:"
echo "  stdout: $LOG_DIR/analytics-simulator.log"
echo "  stderr: $LOG_DIR/analytics-simulator-error.log"
echo ""
echo "Commands:"
echo "  Check status: launchctl list | grep $SERVICE_NAME"
echo "  View logs:    tail -f $LOG_DIR/analytics-simulator.log"
echo "  Stop:         launchctl unload $PLIST_DEST"
echo "  Start:        launchctl load $PLIST_DEST"
echo "  Uninstall:    ./uninstall-service.sh"
echo ""
