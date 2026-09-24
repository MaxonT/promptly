#!/bin/bash
# Promptly v0.6 Keep-Alive Monitor (Python/Launchd version)

LOG_FILE="$HOME/.promptly-v0_6-keepalive.out.log"
ERR_FILE="$HOME/.promptly-v0_6-keepalive.err.log"
PLIST_LABEL="com.promptly.v0_6.keepalive"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Promptly Keep-Alive 系统状态监控"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "当前时间: $(date '+%Y-%m-%d %H:%M:%S')"

# 1. 检查 Launchd 服务稳定性
echo -e "\n[1/3] Launchd 注册状态:"
STATUS=$(launchctl list | grep "$PLIST_LABEL")
if [ -n "$STATUS" ]; then
    echo "✅ 服务已注册 (Label: $PLIST_LABEL)"
    echo "详细信息: $STATUS"
else
    echo "❌ 错误: 服务未在 launchctl 中找到。"
fi

# 2. 检查 Python 进程是否实际存活
echo -e "\n[2/3] 实时进程状态:"
PID=$(pgrep -f "keep-alive.py")
if [ -n "$PID" ]; then
    echo "✅ Python 进程正在运行 (PID: $PID)"
else
    echo "❌ 警告: 进程未运行 (可能是正在休眠间隔或已崩溃)"
fi

# 3. 输出最近日志
echo -e "\n[3/3] 最近 10 条日志 (标准输出):"
if [ -f "$LOG_FILE" ]; then
    tail -n 10 "$LOG_FILE"
else
    echo "❌ 找不到日志文件: $LOG_FILE"
fi

if [ -s "$ERR_FILE" ]; then
    echo -e "\n⚠️  错误日志内容 (如果有):"
    cat "$ERR_FILE"
fi

echo -e "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
