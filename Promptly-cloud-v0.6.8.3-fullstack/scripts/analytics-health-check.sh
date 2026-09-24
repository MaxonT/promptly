#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════════
# 🏥 Analytics Dashboard Health Check
# ═══════════════════════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKEND_URL="${PROMPTLY_API_URL:-http://localhost:8080}"

echo "═══════════════════════════════════════════════════════════════"
echo "🏥 Promptly Analytics Dashboard - Health Check"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Check backend health
echo "🔍 检查后端服务..."
health_response=$(curl -s --max-time 10 "${BACKEND_URL}/api/health" 2>/dev/null)
if echo "$health_response" | grep -q '"ok":true'; then
    echo "✅ 后端服务: 正常"
else
    echo "❌ 后端服务: 异常"
    echo "   响应: $health_response"
fi

# Check analytics dashboard API
echo ""
echo "🔍 检查 Analytics Dashboard API..."
analytics_response=$(curl -s --max-time 10 "${BACKEND_URL}/api/analytics/dashboard/summary" 2>/dev/null)
if echo "$analytics_response" | grep -q '"ok":true'; then
    echo "✅ Analytics API: 正常"
    
    # Parse and display key metrics
    if command -v python3 &> /dev/null; then
        echo ""
        echo "📊 当前指标:"
        total_users=$(echo "$analytics_response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('users', {}).get('total', 0))" 2>/dev/null)
        dau=$(echo "$analytics_response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('activity', {}).get('dau', 0))" 2>/dev/null)
        wau=$(echo "$analytics_response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('activity', {}).get('wau', 0))" 2>/dev/null)
        mau=$(echo "$analytics_response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('activity', {}).get('mau', 0))" 2>/dev/null)
        
        echo "   👥 总用户数: $total_users"
        echo "   📅 日活 (DAU): $dau"
        echo "   📈 周活 (WAU): $wau"
        echo "   📊 月活 (MAU): $mau"
    fi
else
    echo "❌ Analytics API: 异常"
    echo "   响应: $analytics_response"
fi

# Check timeseries API
echo ""
echo "🔍 检查 Timeseries API..."
timeseries_response=$(curl -s --max-time 10 "${BACKEND_URL}/api/analytics/dashboard/timeseries?days=7" 2>/dev/null)
if echo "$timeseries_response" | grep -q '"ok":true'; then
    echo "✅ Timeseries API: 正常"
    
    if command -v python3 &> /dev/null; then
        data_count=$(echo "$timeseries_response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data', [])))" 2>/dev/null)
        echo "   📈 数据点数量: $data_count"
    fi
else
    echo "❌ Timeseries API: 异常"
fi

# Check simulator log
echo ""
echo "🔍 检查模拟器日志..."
LOG_FILE="${PROJECT_ROOT}/logs/behavior-simulator.log"
if [ -f "$LOG_FILE" ]; then
    echo "✅ 日志文件存在: $LOG_FILE"
    echo "   📄 最近活动:"
    tail -5 "$LOG_FILE" 2>/dev/null | while read line; do
        echo "      $line"
    done
else
    echo "⚠️  日志文件不存在 (模拟器可能未运行)"
fi

# Check if simulator is running
echo ""
echo "🔍 检查模拟器进程..."
simulator_pid=$(pgrep -f "BehaviorSimulator.sh" 2>/dev/null)
if [ -n "$simulator_pid" ]; then
    echo "✅ 模拟器正在运行 (PID: $simulator_pid)"
else
    echo "⚠️  模拟器未运行"
    echo "   启动命令: nohup ${SCRIPT_DIR}/BehaviorSimulator.sh > /dev/null 2>&1 &"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "🏁 健康检查完成"
echo "═══════════════════════════════════════════════════════════════"
