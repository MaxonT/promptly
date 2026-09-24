#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Analytics Behavior Simulator - macOS Service Uninstaller
# ═══════════════════════════════════════════════════════════════════════════════
#
# 卸载行为模拟器 macOS 后台服务
#
# 用法:
#   ./uninstall-service.sh
#
# ═══════════════════════════════════════════════════════════════════════════════

set -e

# 配置
SERVICE_NAME="com.analytics.behavior-simulator"
PLIST_PATH="$HOME/Library/LaunchAgents/$SERVICE_NAME.plist"
LOG_DIR="/tmp"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "╔═══════════════════════════════════════════════════════════════════════════════╗"
echo "║          Analytics Behavior Simulator - Service Uninstaller                   ║"
echo "╚═══════════════════════════════════════════════════════════════════════════════╝"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# 停止服务
# ═══════════════════════════════════════════════════════════════════════════════

echo "Checking for service..."

if launchctl list | grep -q "$SERVICE_NAME"; then
    echo -e "${YELLOW}Stopping service...${NC}"
    launchctl unload "$PLIST_PATH" 2>/dev/null || true
    sleep 1
    echo -e "${GREEN}✓${NC} Service stopped"
else
    echo "Service not running"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 删除 plist 文件
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo "Removing plist file..."

if [ -f "$PLIST_PATH" ]; then
    rm "$PLIST_PATH"
    echo -e "${GREEN}✓${NC} Removed: $PLIST_PATH"
else
    echo "plist file not found (already removed?)"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 可选: 删除日志文件
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
read -p "Remove log files? (y/N) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -f "$LOG_DIR/analytics-simulator.log" 2>/dev/null || true
    rm -f "$LOG_DIR/analytics-simulator-error.log" 2>/dev/null || true
    echo -e "${GREEN}✓${NC} Log files removed"
else
    echo "Log files kept at:"
    echo "  $LOG_DIR/analytics-simulator.log"
    echo "  $LOG_DIR/analytics-simulator-error.log"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# 完成
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo "╔═══════════════════════════════════════════════════════════════════════════════╗"
echo "║                         Uninstall Complete!                                   ║"
echo "╚═══════════════════════════════════════════════════════════════════════════════╝"
echo ""
echo "To reinstall, run: ./install-service.sh"
echo ""
