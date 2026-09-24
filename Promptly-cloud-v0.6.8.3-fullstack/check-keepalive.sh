#!/bin/bash

# Monitor keep-alive log

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Render 服务保活状态监控"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

LOG_FILE="$HOME/.promptly-keepalive.log"

if [ ! -f "$LOG_FILE" ]; then
    echo "❌ 日志文件不存在：$LOG_FILE"
    echo "请先运行 ./keep-alive.sh"
    exit 1
fi

echo "📊 最近 10 条日志："
echo ""
tail -10 "$LOG_FILE"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✓ 统计信息："
echo ""

TOTAL=$(wc -l < "$LOG_FILE")
SUCCESS=$(grep -c "✓" "$LOG_FILE")
FAILED=$(grep -c "✗" "$LOG_FILE")

echo "  总记录数：$TOTAL"
echo "  成功：$SUCCESS ✓"
echo "  失败：$FAILED ✗"

if [ "$FAILED" -gt 0 ]; then
    echo ""
    echo "❌ 失败的 ping："
    grep "✗" "$LOG_FILE"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔄 Cron 状态："
echo ""

if crontab -l 2>/dev/null | grep -q "keep-alive.sh"; then
    echo "✓ Cron 任务已激活"
    echo ""
    echo "定时规则："
    crontab -l 2>/dev/null | grep "keep-alive.sh"
else
    echo "❌ Cron 任务未找到"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "提示：要实时跟随日志，请使用 --follow 或 -f 参数"
echo ""
if [ "$1" = "--follow" ] || [ "$1" = "-f" ]; then
    tail -f "$LOG_FILE"
else
    echo "最近 10 条日志已展示，脚本已退出。"
    echo "要实时查看日志运行：tail -f \"$LOG_FILE\" 或 ./check-keepalive.sh --follow"
fi
