#!/bin/bash
#
# Promptly Behavior Simulator - 安装脚本
# =====================================
# 
# 此脚本将行为模拟器安装为 macOS launchd 服务
# 
# 功能:
#   - Mac 开机自动启动
#   - 休眠/唤醒自动暂停/恢复
#   - 网络断开等待，恢复后继续
#   - 崩溃后自动重启
#   - 终端关闭后台运行
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLIST_NAME="com.promptly.behavior.simulator.plist"
PLIST_SOURCE="$SCRIPT_DIR/$PLIST_NAME"
PLIST_DEST="$HOME/Library/LaunchAgents/$PLIST_NAME"
SIMULATOR_SCRIPT="$SCRIPT_DIR/behavior-simulator.py"

echo "╔════════════════════════════════════════════════╗"
echo "║   Promptly Behavior Simulator 安装程序         ║"
echo "╚════════════════════════════════════════════════╝"
echo ""

# 检查 Python 版本
if ! command -v python3 &> /dev/null; then
    echo "❌ 错误: 未找到 python3"
    exit 1
fi

PYTHON_PATH=$(which python3)
echo "✅ Python: $PYTHON_PATH"

# 检查模拟器脚本是否存在
if [ ! -f "$SIMULATOR_SCRIPT" ]; then
    echo "❌ 错误: 模拟器脚本不存在: $SIMULATOR_SCRIPT"
    exit 1
fi
echo "✅ 模拟器脚本: $SIMULATOR_SCRIPT"

# 检查 requests 库
if ! python3 -c "import requests" &> /dev/null; then
    echo "📦 安装 requests 库..."
    pip3 install requests
fi
echo "✅ Python requests 库已安装"

# 停止现有服务 (如果运行中)
if launchctl list | grep -q "com.promptly.behavior.simulator"; then
    echo "⏹️  停止现有服务..."
    launchctl unload "$PLIST_DEST" 2>/dev/null || true
fi

# 创建 LaunchAgents 目录 (如果不存在)
mkdir -p "$HOME/Library/LaunchAgents"

# 生成 plist 文件 (使用当前路径)
cat > "$PLIST_DEST" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.promptly.behavior.simulator</string>

  <key>ProgramArguments</key>
  <array>
    <string>$PYTHON_PATH</string>
    <string>$SIMULATOR_SCRIPT</string>
  </array>

  <key>RunAtLoad</key>
  <true/>

  <key>KeepAlive</key>
  <true/>

  <key>WorkingDirectory</key>
  <string>$SCRIPT_DIR</string>

  <key>StandardOutPath</key>
  <string>$HOME/.promptly-behavior-simulator.out.log</string>
  
  <key>StandardErrorPath</key>
  <string>$HOME/.promptly-behavior-simulator.err.log</string>

  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/Library/Frameworks/Python.framework/Versions/3.13/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>API_BASE</key>
    <string>http://localhost:8080</string>
  </dict>
</dict>
</plist>
EOF

echo "✅ plist 已生成: $PLIST_DEST"

# 加载服务
echo "🚀 启动服务..."
launchctl load "$PLIST_DEST"

# 检查服务状态
sleep 2
if launchctl list | grep -q "com.promptly.behavior.simulator"; then
    echo ""
    echo "════════════════════════════════════════════════════"
    echo "✅ 安装成功! 行为模拟器现在作为后台服务运行"
    echo "════════════════════════════════════════════════════"
    echo ""
    echo "📋 常用命令:"
    echo "   查看状态: launchctl list | grep behavior"
    echo "   停止服务: launchctl unload $PLIST_DEST"
    echo "   启动服务: launchctl load $PLIST_DEST"
    echo "   查看日志: tail -f ~/.promptly-behavior-simulator.out.log"
    echo "   卸载服务: $SCRIPT_DIR/uninstall-behavior-simulator.sh"
    echo ""
else
    echo "❌ 服务启动失败，请检查日志:"
    echo "   cat ~/.promptly-behavior-simulator.err.log"
fi
