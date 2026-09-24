#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════════
# 🤖 Promptly Analytics Behavior Simulator
# ═══════════════════════════════════════════════════════════════════════════════
# 
# 功能: 24/7 自动用户行为模拟器，生成真实的用户活动数据
# 特点: 时间分布、自动恢复、S曲线增长、日志记录
#
# 使用方法:
#   1. chmod +x BehaviorSimulator.sh
#   2. ./BehaviorSimulator.sh          # 正式运行
#   3. ./BehaviorSimulator.sh --test   # 测试模式
#
# ═══════════════════════════════════════════════════════════════════════════════

# ╔═══════════════════════════════════════════════════════════════════════════════╗
# ║ 🔧 配置区域                                                                    ║
# ╚═══════════════════════════════════════════════════════════════════════════════╝

# 项目基本配置
PROJECT_NAME="Promptly"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOG_FILE="${PROJECT_ROOT}/logs/behavior-simulator.log"

# 后端 URL (可通过环境变量覆盖)
BACKEND_URL="${PROMPTLY_API_URL:-https://promptly-v0-6-cloudtest-cursor-dev.onrender.com}"

# 本地开发模式
if [ -f "${PROJECT_ROOT}/backend/.env" ]; then
    # 检测是否为本地开发
    LOCAL_PORT=$(grep -E '^PORT=' "${PROJECT_ROOT}/backend/.env" 2>/dev/null | head -n 1 | cut -d'=' -f2)
    if [ -n "$LOCAL_PORT" ] && [ "$BACKEND_URL" = "https://your-promptly-backend.onrender.com" ]; then
        BACKEND_URL="http://localhost:${LOCAL_PORT:-8080}"
        echo "🏠 检测到本地开发环境, 使用: $BACKEND_URL"
    fi
fi

# API 认证 (如果需要)
ADMIN_KEY="${ADMIN_API_KEY:-}"
if [ -z "$ADMIN_KEY" ] && [ -f "${PROJECT_ROOT}/backend/.env" ]; then
    ADMIN_KEY=$(grep -E '^ADMIN_API_KEY=' "${PROJECT_ROOT}/backend/.env" 2>/dev/null | head -n 1 | cut -d'=' -f2- | tr -d '"')
fi

# 增长目标
TARGET_USERS=5000        # 目标用户数
TARGET_DAU=500           # 目标日活

# 网络配置
MAX_RETRIES=5
NETWORK_CHECK_INTERVAL=60  # 网络检查间隔（秒）

# ╔═══════════════════════════════════════════════════════════════════════════════╗
# ║ 📝 日志函数                                                                    ║
# ╚═══════════════════════════════════════════════════════════════════════════════╝

# 确保日志目录存在
mkdir -p "$(dirname "$LOG_FILE")"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ❌ ERROR: $1" | tee -a "$LOG_FILE" >&2
}

log_success() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ✅ $1" | tee -a "$LOG_FILE"
}

# ╔═══════════════════════════════════════════════════════════════════════════════╗
# ║ 🌐 网络检查函数                                                                ║
# ╚═══════════════════════════════════════════════════════════════════════════════╝

check_network() {
    local auth_header=""
    if [ -n "$ADMIN_KEY" ]; then
        auth_header="-H X-Admin-Key:$ADMIN_KEY"
    fi

    local status_code
    status_code=$(curl -s --max-time 10 -o /dev/null -w "%{http_code}" $auth_header "${BACKEND_URL}/api/analytics/dashboard/summary" 2>/dev/null)
    
    if [ "$status_code" = "200" ]; then
        return 0
    else
        return 1
    fi
}

wait_for_network() {
    local retry_count=0
    log "⚠️  网络连接失败，等待恢复..."
    
    while [ $retry_count -lt $MAX_RETRIES ]; do
        sleep $NETWORK_CHECK_INTERVAL
        
        if check_network; then
            log_success "网络已恢复"
            return 0
        fi
        
        retry_count=$((retry_count + 1))
        log "⏳ 重试 $retry_count/$MAX_RETRIES..."
    done
    
    log_error "网络连接失败，将在下个周期重试"
    return 1
}

# ╔═══════════════════════════════════════════════════════════════════════════════╗
# ║ ⏰ 时间分布函数 - 模拟真实用户活动模式                                           ║
# ╚═══════════════════════════════════════════════════════════════════════════════╝

# 时间分布: 上午 30%, 下午 40%, 晚上 20%, 夜间 10%
get_random_delay() {
    local random=$((RANDOM % 100))
    local delay
    
    if [[ $random -lt 30 ]]; then
        # 上午: 30% - 相对活跃
        delay=$((3600 + RANDOM % 7200))   # 1hr - 3hr
    elif [[ $random -lt 70 ]]; then
        # 下午: 40% - 高峰期
        delay=$((1800 + RANDOM % 3600))   # 30min - 1.5hr
    elif [[ $random -lt 90 ]]; then
        # 晚上: 20% - 逐渐减少
        delay=$((7200 + RANDOM % 7200))   # 2hr - 4hr
    else
        # 夜间: 10% - 休眠期
        delay=$((14400 + RANDOM % 14400)) # 4hr - 8hr
    fi
    
    echo $delay
}

# ╔═══════════════════════════════════════════════════════════════════════════════╗
# ║ 📊 获取当前统计数据                                                            ║
# ╚═══════════════════════════════════════════════════════════════════════════════╝

get_current_metrics() {
    local auth_header=""
    if [ -n "$ADMIN_KEY" ]; then
        auth_header="-H X-Admin-Key:$ADMIN_KEY"
    fi
    
    curl -s --max-time 15 $auth_header "${BACKEND_URL}/api/analytics/dashboard/summary" 2>/dev/null
}

# ╔═══════════════════════════════════════════════════════════════════════════════╗
# ║ 🎲 生成随机活动参数                                                            ║
# ╚═══════════════════════════════════════════════════════════════════════════════╝

generate_random_activity() {
    local roll=$((RANDOM % 100))
    local user_increment=0
    
    # 获取当前用户数
    local metrics
    metrics=$(get_current_metrics)
    local current_users
    
    # 使用 Python 解析 JSON
    if command -v python3 &> /dev/null; then
        current_users=$(echo "$metrics" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('users', {}).get('total', 0))" 2>/dev/null || echo 0)
    else
        # 简单的 grep 解析
        current_users=$(echo "$metrics" | grep -o '"total":[0-9]*' | head -1 | cut -d':' -f2 || echo 0)
    fi
    
    if [ "$current_users" -lt "$TARGET_USERS" ]; then
        # 还没达标，适度增长
        if [[ $roll -lt 60 ]]; then
            user_increment=$((1 + RANDOM % 3))      # 60%: 1-3 用户
        elif [[ $roll -lt 90 ]]; then
            user_increment=$((3 + RANDOM % 5))      # 30%: 3-7 用户
        else
            user_increment=$((5 + RANDOM % 10))     # 10%: 5-14 用户
        fi
    else
        # 已达标，转入稳健模式
        if [[ $roll -lt 90 ]]; then
            user_increment=0                        # 90%: 只模拟活动
        else
            user_increment=$((1 + RANDOM % 2))      # 10%: 增加 1-2 用户
        fi
    fi
    
    # 返回: sessions:days:user_increment
    local sessions=$((2 + RANDOM % 6))
    echo "${sessions}:1:${user_increment}"
}

# ╔═══════════════════════════════════════════════════════════════════════════════╗
# ║ 🚀 模拟用户行为                                                                ║
# ╚═══════════════════════════════════════════════════════════════════════════════╝

simulate_behavior() {
    local activity_params=$1
    IFS=':' read -r sessions days user_increment <<< "$activity_params"
    
    log "📊 本次活动参数: sessions=$sessions, new_users=$user_increment"
    
    # 构建认证 header
    local auth_header=""
    if [ -n "$ADMIN_KEY" ]; then
        auth_header="-H X-Admin-Key:$ADMIN_KEY"
    fi
    
    # 调用数据生成 API
    local response
    response=$(curl -s --max-time 30 -X POST $auth_header \
        -H "Content-Type: application/json" \
        -d "{\"users\": $user_increment, \"sessions\": $sessions}" \
        "${BACKEND_URL}/api/analytics/dashboard/admin/generate-data" 2>/dev/null)
    
    if [ $? -eq 0 ] && echo "$response" | grep -q '"ok":true'; then
        log_success "数据生成成功: +$user_increment users, +$sessions sessions"
    else
        log_error "数据生成失败: $response"
    fi
}

# ╔═══════════════════════════════════════════════════════════════════════════════╗
# ║ 🎮 主循环                                                                      ║
# ╚═══════════════════════════════════════════════════════════════════════════════╝

main() {
    log "════════════════════════════════════════════════════════════"
    log "🚀 ${PROJECT_NAME} 行为模拟器 - 已启动"
    log "════════════════════════════════════════════════════════════"
    log "📝 日志文件: $LOG_FILE"
    log "🌐 目标服务器: $BACKEND_URL"
    log "🎯 目标指标: ${TARGET_USERS}+ 用户, ${TARGET_DAU}+ DAU"
    log "🔄 自动恢复: 已启用"
    log "⏰ 运行模式: 持续运行（时间分布：上午30% 下午40% 晚上20% 夜间10%）"
    log "════════════════════════════════════════════════════════════"
    
    # 初始网络检查
    if ! check_network; then
        wait_for_network || {
            log_error "初始网络连接失败，请检查配置"
            log "💡 提示: 确保后端服务运行中，或设置 PROMPTLY_API_URL 环境变量"
            exit 1
        }
    fi
    log_success "网络连接正常"
    
    local iteration=0
    local consecutive_failures=0
    local MAX_CONSECUTIVE_FAILURES=3
    
    while true; do
        iteration=$((iteration + 1))
        log ""
        log "════════════════════════════════════════════════════════════"
        log "🔄 第 $iteration 次迭代开始"
        log "════════════════════════════════════════════════════════════"
        
        # 步骤1: 检查网络
        log "🔍 步骤1/4: 检查网络连接..."
        if ! check_network; then
            if ! wait_for_network; then
                consecutive_failures=$((consecutive_failures + 1))
                if [ $consecutive_failures -ge $MAX_CONSECUTIVE_FAILURES ]; then
                    log "⚠️  连续失败 $consecutive_failures 次，休眠5分钟后重试"
                    sleep 300
                    consecutive_failures=0
                fi
                continue
            fi
        fi
        log_success "网络连接正常"
        consecutive_failures=0
        
        # 步骤2: 计算延迟
        log "⏰ 步骤2/4: 计算下次活动时间..."
        local delay
        delay=$(get_random_delay)
        local hours=$((delay / 3600))
        local minutes=$(((delay % 3600) / 60))
        log "⏳ 等待时长: ${hours}小时 ${minutes}分钟"
        
        # 步骤3: 生成活动参数
        log "🎲 步骤3/4: 生成活动参数..."
        local activity_params
        activity_params=$(generate_random_activity)
        
        # 步骤4: 执行模拟
        log "🚀 步骤4/4: 执行行为模拟..."
        simulate_behavior "$activity_params"
        
        # 等待下一轮
        log ""
        log "💤 等待 ${hours}小时 ${minutes}分钟 后开始下一轮..."
        sleep "$delay"
    done
}

# ╔═══════════════════════════════════════════════════════════════════════════════╗
# ║ 🧪 测试模式                                                                    ║
# ╚═══════════════════════════════════════════════════════════════════════════════╝

if [ "$1" = "--test" ]; then
    log "🧪 测试模式启动..."
    log "🌐 目标服务器: $BACKEND_URL"
    
    # 测试网络
    log "测试网络连接..."
    if check_network; then
        log_success "网络连接成功"
    else
        log_error "网络连接失败"
        log "💡 提示: 确保后端服务运行中"
        log "   本地开发: cd backend && npm run dev"
        log "   或设置: export PROMPTLY_API_URL=http://localhost:8080"
        exit 1
    fi
    
    # 测试获取指标
    log "测试获取指标..."
    metrics=$(get_current_metrics)
    if [ -n "$metrics" ] && echo "$metrics" | grep -q '"ok":true'; then
        log_success "指标获取成功:"
        if command -v python3 &> /dev/null; then
            echo "$metrics" | python3 -m json.tool 2>/dev/null || echo "$metrics"
        else
            echo "$metrics"
        fi
    else
        log_error "指标获取失败"
        echo "$metrics"
    fi
    
    log_success "测试完成"
    exit 0
fi

# ╔═══════════════════════════════════════════════════════════════════════════════╗
# ║ 📋 帮助信息                                                                    ║
# ╚═══════════════════════════════════════════════════════════════════════════════╝

if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo "
🤖 Promptly Analytics Behavior Simulator
═══════════════════════════════════════════════════════════════

使用方法:
  ./BehaviorSimulator.sh          # 正式运行 (24/7 模拟)
  ./BehaviorSimulator.sh --test   # 测试模式
  ./BehaviorSimulator.sh --help   # 显示帮助

环境变量:
  PROMPTLY_API_URL   后端 API 地址 (默认: https://your-promptly-backend.onrender.com)
  ADMIN_API_KEY      管理员 API 密钥 (可选)

示例:
  # 本地开发
  export PROMPTLY_API_URL=http://localhost:8080
  ./BehaviorSimulator.sh --test

  # 生产环境
  export PROMPTLY_API_URL=https://api.promptly.app
  export ADMIN_API_KEY=your-secret-key
  nohup ./BehaviorSimulator.sh > /dev/null 2>&1 &
"
    exit 0
fi

# 启动主循环
main
