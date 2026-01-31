#!/bin/bash
# ===========================================
# Promptly Analytics Behavior Simulator v2
# ===========================================
# 
# 更真实的用户行为模拟器
# 
# 特点:
#   - 基于时间段的概率模型 (上午30%, 下午40%, 晚上20%, 夜间10%)
#   - 批量用户生成 (5-20个用户/批次)
#   - 不规律等待时间 (30分钟-4小时)
#   - 模拟真实流量模式
#
# 使用方法:
#   启动: ./behavior-simulator.sh start
#   停止: ./behavior-simulator.sh stop  
#   状态: ./behavior-simulator.sh status
#   日志: ./behavior-simulator.sh logs
#
# ===========================================

API_BASE="${API_BASE:-http://localhost:8080}"
LOG_FILE="/tmp/promptly-behavior-simulator.log"
PID_FILE="/tmp/promptly-behavior-simulator.pid"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# ===========================================
# 时间段概率模型
# ===========================================

# 获取当前时段和概率
get_time_period_info() {
    local hour=$(date +%H | sed 's/^0//')  # 去掉前导0
    
    if [ $hour -ge 6 ] && [ $hour -lt 12 ]; then
        echo "morning 30 上午"
    elif [ $hour -ge 12 ] && [ $hour -lt 18 ]; then
        echo "afternoon 40 下午"
    elif [ $hour -ge 18 ] && [ $hour -lt 24 ]; then
        echo "evening 20 晚上"
    else
        echo "night 10 夜间"
    fi
}

# 根据概率决定是否生成
should_generate() {
    local probability=$1
    local roll=$((RANDOM % 100))
    [ $roll -lt $probability ]
}

# ===========================================
# 随机数据生成器
# ===========================================

random_user_id() {
    echo "au_$(date +%Y%m%d)_$(printf '%05d' $((RANDOM % 100000)))"
}

random_session_id() {
    echo "as_$(date +%Y%m%d%H%M%S)_$(printf '%04d' $((RANDOM % 10000)))"
}

random_timezone() {
    local tzs=("America/New_York" "America/Los_Angeles" "America/Chicago" "Europe/London" "Europe/Paris" "Europe/Berlin" "Asia/Shanghai" "Asia/Tokyo" "Asia/Singapore" "Australia/Sydney")
    echo "${tzs[$((RANDOM % ${#tzs[@]}))]}"
}

random_device() {
    # 更真实的设备分布: 60% desktop, 35% mobile, 5% tablet
    local roll=$((RANDOM % 100))
    if [ $roll -lt 60 ]; then
        echo "desktop"
    elif [ $roll -lt 95 ]; then
        echo "mobile"
    else
        echo "tablet"
    fi
}

random_browser() {
    # 更真实的浏览器分布: Chrome 65%, Safari 20%, Firefox 10%, Edge 5%
    local roll=$((RANDOM % 100))
    if [ $roll -lt 65 ]; then
        echo "Chrome"
    elif [ $roll -lt 85 ]; then
        echo "Safari"
    elif [ $roll -lt 95 ]; then
        echo "Firefox"
    else
        echo "Edge"
    fi
}

random_source() {
    # 流量来源分布: organic 40%, direct 30%, social 15%, referral 10%, email 5%
    local roll=$((RANDOM % 100))
    if [ $roll -lt 40 ]; then
        echo "organic"
    elif [ $roll -lt 70 ]; then
        echo "direct"
    elif [ $roll -lt 85 ]; then
        echo "social"
    elif [ $roll -lt 95 ]; then
        echo "referral"
    else
        echo "email"
    fi
}

# 随机用户类型 (影响行为模式)
random_user_type() {
    # 用户类型: engaged 30%, casual 50%, bouncer 20%
    local roll=$((RANDOM % 100))
    if [ $roll -lt 30 ]; then
        echo "engaged"
    elif [ $roll -lt 80 ]; then
        echo "casual"
    else
        echo "bouncer"
    fi
}

# ===========================================
# API 调用
# ===========================================

simulate_new_user() {
    local user_id=$(random_user_id)
    local timezone=$(random_timezone)
    local device=$(random_device)
    local browser=$(random_browser)
    local source=$(random_source)
    
    curl -s -X POST "$API_BASE/api/analytics/track/user" \
        -H "Content-Type: application/json" \
        -d "{
            \"userId\": \"$user_id\",
            \"source\": \"$source\",
            \"timezone\": \"$timezone\",
            \"deviceType\": \"$device\",
            \"browser\": \"$browser\"
        }" > /dev/null 2>&1
    
    echo "$user_id"
}

simulate_session() {
    local user_id="$1"
    local user_type="$2"
    local session_id=$(random_session_id)
    local device=$(random_device)
    local browser=$(random_browser)
    
    # 根据用户类型调整行为
    local duration page_views mouse_moves scrolls clicks typing
    
    case $user_type in
        engaged)
            duration=$((180 + RANDOM % 600))    # 3-13分钟
            page_views=$((5 + RANDOM % 10))     # 5-15页
            mouse_moves=$((150 + RANDOM % 300)) # 活跃鼠标
            scrolls=$((20 + RANDOM % 50))
            clicks=$((10 + RANDOM % 30))
            typing=$((50 + RANDOM % 150))
            ;;
        casual)
            duration=$((60 + RANDOM % 240))     # 1-5分钟
            page_views=$((2 + RANDOM % 5))      # 2-7页
            mouse_moves=$((50 + RANDOM % 150))
            scrolls=$((5 + RANDOM % 20))
            clicks=$((3 + RANDOM % 12))
            typing=$((10 + RANDOM % 50))
            ;;
        bouncer)
            duration=$((5 + RANDOM % 30))       # 5-35秒
            page_views=1                         # 只看1页
            mouse_moves=$((10 + RANDOM % 40))
            scrolls=$((0 + RANDOM % 5))
            clicks=$((0 + RANDOM % 3))
            typing=$((0 + RANDOM % 5))
            ;;
    esac
    
    # 开始会话
    curl -s -X POST "$API_BASE/api/analytics/track/session-start" \
        -H "Content-Type: application/json" \
        -d "{
            \"userId\": \"$user_id\",
            \"sessionId\": \"$session_id\",
            \"deviceType\": \"$device\",
            \"browser\": \"$browser\"
        }" > /dev/null 2>&1
    
    # 记录行为
    curl -s -X POST "$API_BASE/api/analytics/track/behavior" \
        -H "Content-Type: application/json" \
        -d "{
            \"userId\": \"$user_id\",
            \"sessionId\": \"$session_id\",
            \"mouseMovements\": $mouse_moves,
            \"scrolls\": $scrolls,
            \"clicks\": $clicks,
            \"typingEvents\": $typing
        }" > /dev/null 2>&1
    
    # 结束会话
    curl -s -X POST "$API_BASE/api/analytics/track/session-end" \
        -H "Content-Type: application/json" \
        -d "{
            \"sessionId\": \"$session_id\",
            \"duration\": $duration,
            \"pageViews\": $page_views
        }" > /dev/null 2>&1
    
    echo "$session_id|$user_type|${duration}s|${page_views}pages"
}

# ===========================================
# 批量生成逻辑
# ===========================================

generate_user_batch() {
    local batch_size=$1
    local period_name=$2
    
    log "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    log "${GREEN}📊 开始生成批次 | 时段: $period_name | 用户数: $batch_size${NC}"
    log "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    local new_users=0
    local returning_users=0
    local total_sessions=0
    
    for ((i=1; i<=batch_size; i++)); do
        # 60% 新用户, 40% 返回用户
        local is_new=$((RANDOM % 100 < 60))
        local user_type=$(random_user_type)
        local user_id
        
        if [ $is_new -eq 1 ]; then
            user_id=$(simulate_new_user)
            ((new_users++))
            log "  ${GREEN}+ 新用户 #$i: $user_id ($user_type)${NC}"
        else
            # 模拟返回用户 (使用已有格式的ID)
            user_id="au_$(date +%Y%m%d)_$(printf '%05d' $((RANDOM % 1000)))"
            ((returning_users++))
            log "  ${YELLOW}↩ 返回用户 #$i: $user_id ($user_type)${NC}"
        fi
        
        # 生成会话
        local session_info=$(simulate_session "$user_id" "$user_type")
        ((total_sessions++))
        log "    ${BLUE}└─ 会话: $session_info${NC}"
        
        # 用户之间有小间隔 (1-5秒)，模拟真实到达
        sleep $((1 + RANDOM % 5))
    done
    
    log "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    log "${GREEN}✓ 批次完成 | 新用户: $new_users | 返回: $returning_users | 会话: $total_sessions${NC}"
    log "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# 计算下次等待时间 (30分钟 - 4小时)
calculate_wait_time() {
    # 30分钟 = 1800秒, 4小时 = 14400秒
    local min_wait=1800
    local max_wait=14400
    local range=$((max_wait - min_wait))
    echo $((min_wait + RANDOM % range))
}

# 格式化时间
format_duration() {
    local seconds=$1
    local hours=$((seconds / 3600))
    local minutes=$(((seconds % 3600) / 60))
    
    if [ $hours -gt 0 ]; then
        echo "${hours}小时${minutes}分钟"
    else
        echo "${minutes}分钟"
    fi
}

# ===========================================
# 主循环
# ===========================================

main_loop() {
    log "${GREEN}╔══════════════════════════════════════════╗${NC}"
    log "${GREEN}║   Promptly Behavior Simulator v2         ║${NC}"
    log "${GREEN}║   真实流量模拟器                          ║${NC}"
    log "${GREEN}╚══════════════════════════════════════════╝${NC}"
    log ""
    log "API Base: $API_BASE"
    log "PID: $$"
    log ""
    log "时间段概率模型:"
    log "  📅 上午 (6-12点):  30% 概率"
    log "  📅 下午 (12-18点): 40% 概率"
    log "  📅 晚上 (18-24点): 20% 概率"
    log "  📅 夜间 (0-6点):   10% 概率"
    log ""
    log "每批生成: 5-20 个用户"
    log "等待间隔: 30分钟 - 4小时"
    log ""
    
    echo $$ > "$PID_FILE"
    
    while true; do
        # 获取当前时段信息
        local period_info=$(get_time_period_info)
        local period_name=$(echo $period_info | cut -d' ' -f1)
        local probability=$(echo $period_info | cut -d' ' -f2)
        local period_cn=$(echo $period_info | cut -d' ' -f3)
        
        log ""
        log "🕐 当前时段: $period_cn ($period_name) | 生成概率: $probability%"
        
        # 根据概率决定是否生成
        if should_generate $probability; then
            # 随机生成 5-20 个用户
            local batch_size=$((5 + RANDOM % 16))
            generate_user_batch $batch_size "$period_cn"
        else
            log "${YELLOW}⏸ 本轮跳过生成 (概率未命中)${NC}"
        fi
        
        # 计算下次等待时间
        local wait_time=$(calculate_wait_time)
        local wait_formatted=$(format_duration $wait_time)
        local next_time=$(date -v+${wait_time}S '+%Y-%m-%d %H:%M:%S' 2>/dev/null || date -d "+${wait_time} seconds" '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo "N/A")
        
        log ""
        log "💤 等待 $wait_formatted 后继续..."
        log "⏰ 下次运行: $next_time"
        log ""
        
        sleep $wait_time
    done
}

# ===========================================
# 命令处理
# ===========================================

start() {
    if [ -f "$PID_FILE" ] && kill -0 $(cat "$PID_FILE") 2>/dev/null; then
        echo -e "${YELLOW}模拟器已在运行 (PID: $(cat $PID_FILE))${NC}"
        return 1
    fi
    
    echo -e "${GREEN}启动真实行为模拟器 v2...${NC}"
    nohup bash "$0" run >> "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
    echo -e "${GREEN}已启动 PID: $!${NC}"
    echo "日志文件: $LOG_FILE"
    echo ""
    echo "时间段概率模型:"
    echo "  📅 上午 (6-12点):  30% 概率生成"
    echo "  📅 下午 (12-18点): 40% 概率生成"
    echo "  📅 晚上 (18-24点): 20% 概率生成"
    echo "  📅 夜间 (0-6点):   10% 概率生成"
    echo ""
    echo "每批生成 5-20 个用户，间隔 30分钟-4小时"
}

stop() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if kill -0 $pid 2>/dev/null; then
            kill $pid
            rm -f "$PID_FILE"
            echo -e "${GREEN}模拟器已停止 (PID: $pid)${NC}"
        else
            echo -e "${YELLOW}进程未运行${NC}"
            rm -f "$PID_FILE"
        fi
    else
        echo -e "${YELLOW}未找到PID文件${NC}"
    fi
}

status() {
    echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║   Promptly Behavior Simulator v2         ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}"
    echo ""
    
    if [ -f "$PID_FILE" ] && kill -0 $(cat "$PID_FILE") 2>/dev/null; then
        echo -e "状态: ${GREEN}● 运行中${NC}"
        echo -e "PID: $(cat $PID_FILE)"
    else
        echo -e "状态: ${RED}○ 已停止${NC}"
    fi
    
    echo ""
    echo "API: $API_BASE"
    echo "日志: $LOG_FILE"
    
    # 当前时段
    local period_info=$(get_time_period_info)
    local period_cn=$(echo $period_info | cut -d' ' -f3)
    local probability=$(echo $period_info | cut -d' ' -f2)
    echo ""
    echo "当前时段: $period_cn (生成概率: $probability%)"
    
    if [ -f "$LOG_FILE" ]; then
        echo ""
        echo "最近日志:"
        echo "────────────────────────────────────"
        tail -10 "$LOG_FILE"
    fi
}

logs() {
    if [ -f "$LOG_FILE" ]; then
        tail -f "$LOG_FILE"
    else
        echo "未找到日志文件"
    fi
}

case "${1:-status}" in
    start)
        start
        ;;
    stop)
        stop
        ;;
    status)
        status
        ;;
    logs)
        logs
        ;;
    run)
        main_loop
        ;;
    *)
        echo "用法: $0 {start|stop|status|logs}"
        exit 1
        ;;
esac
