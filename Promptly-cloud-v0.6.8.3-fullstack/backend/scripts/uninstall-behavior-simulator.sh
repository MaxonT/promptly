#!/bin/bash
#
# Promptly Behavior Simulator - 卸载脚本
# =====================================
# 
# 此脚本卸载行为模拟器 launchd 服务
#

PLIST_NAME="com.promptly.behavior.simulator.plist"
PLIST_DEST="$HOME/Library/LaunchAgents/$PLIST_NAME"

echo "╔════════════════════════════════════════════════╗"
echo "║   Promptly Behavior Simulator 卸载程序         ║"
echo "╚════════════════════════════════════════════════╝"
echo ""

# 停止并卸载服务
if launchctl list | grep -q "com.promptly.behavior.simulator"; then
    echo "⏹️  停止服务..."
    launchctl unload "$PLIST_DEST" 2>/dev/null || true
    echo "✅ 服务已停止"
else
    echo "ℹ️  服务未运行"
fi

# 删除 plist 文件
if [ -f "$PLIST_DEST" ]; then
    rm "$PLIST_DEST"
    echo "✅ plist 文件已删除: $PLIST_DEST"
else
    echo "ℹ️  plist 文件不存在"
fi

echo ""
echo "════════════════════════════════════════════════════"
echo "✅ 卸载完成!"
echo "════════════════════════════════════════════════════"
echo ""
echo "日志文件保留在:"
echo "   ~/.promptly-behavior-simulator.out.log"
echo "   ~/.promptly-behavior-simulator.err.log"
echo ""
echo "如需删除日志，请运行:"
echo "   rm ~/.promptly-behavior-simulator.*.log"
