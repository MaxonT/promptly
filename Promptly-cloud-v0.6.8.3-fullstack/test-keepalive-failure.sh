#!/bin/bash

# Test script to simulate keep-alive failure scenarios
# This validates retry and notification mechanisms

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Keep-Alive 失败场景测试"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

LOG_FILE="$HOME/.promptly-keepalive.log"

echo "1️⃣  测试 1：修改服务 URL 为错误地址，验证重试和失败通知"
echo ""
echo "创建临时测试脚本..."

# 创建临时测试脚本
TEST_SCRIPT=$(mktemp)
cat > "$TEST_SCRIPT" << 'EOF'
#!/bin/bash
SERVICE_URL="https://invalid-service-url-12345.onrender.com"
LOG_FILE="$HOME/.promptly-keepalive-test.log"
HEALTH_ENDPOINT="/api/health"
MAX_RETRIES=3
RETRY_DELAY=1
TIMEOUT=5

log_message() {
    local msg="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] $msg" >> "$LOG_FILE"
}

send_notification() {
    local title="$1"
    local message="$2"
    if command -v osascript &> /dev/null; then
        osascript -e "display notification \"$message\" with title \"Promptly Keep-Alive\""
    fi
}

ping_service() {
    local response=$(curl -s -o /dev/null -w "%{http_code}" -m "$TIMEOUT" "$SERVICE_URL$HEALTH_ENDPOINT" 2>/dev/null)
    echo "$response"
}

if [ ! -f "$LOG_FILE" ]; then
    touch "$LOG_FILE"
    log_message "🚀 测试：失败场景 (v1.1 with retry & notifications)"
fi

attempt=1
success=false

while [ $attempt -le $MAX_RETRIES ] && [ "$success" = "false" ]; do
    response=$(ping_service)
    
    if [ "$response" = "200" ]; then
        log_message "✓ Service pinged successfully on first attempt (HTTP 200)"
        success=true
    else
        if [ $attempt -lt $MAX_RETRIES ]; then
            log_message "⚠ Attempt $attempt failed (HTTP $response or timeout), retrying in ${RETRY_DELAY}s..."
            sleep "$RETRY_DELAY"
        else
            log_message "❌ ALL $MAX_RETRIES ATTEMPTS FAILED - 触发失败通知"
            send_notification "Ping Failed" "After $MAX_RETRIES attempts, service is not responding"
        fi
    fi
    
    attempt=$((attempt + 1))
done

exit 0
EOF

chmod +x "$TEST_SCRIPT"
echo "✓ 临时测试脚本已创建"
echo ""

echo "运行测试脚本（这将重试 3 次，每次间隔 1 秒）..."
echo ""

$TEST_SCRIPT

echo ""
echo "✓ 测试完成，查看日志："
echo ""
cat "$HOME/.promptly-keepalive-test.log"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "2️⃣  测试 2：验证正常的 keep-alive 日志"
echo ""
echo "最近 10 条成功的 ping 日志："
echo ""
tail -10 "$LOG_FILE"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ 测试完成！"
echo ""
echo "如果你看到上面的通知 (macOS)，说明失败通知机制正常"
echo "成功日志来自实际的 keep-alive 脚本"
echo ""
echo "清理临时文件..."
rm "$TEST_SCRIPT"
rm "$HOME/.promptly-keepalive-test.log" 2>/dev/null
echo "✓ 完成"
