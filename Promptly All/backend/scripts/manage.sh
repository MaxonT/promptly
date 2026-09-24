#!/bin/bash
# ================================================================
# Promptly Analytics - 统一管理脚本
# ================================================================
# 
# 用法: ./manage.sh <command>
#
# 命令:
#   status      - 显示系统状态（本地/云端数据对比）
#   sync        - 执行完整同步（本地 → 云端）
#   sync-check  - 仅检查差异，不执行同步
#   simulator   - 启动行为模拟器
#   stop        - 停止行为模拟器
#   logs        - 查看模拟器日志
#   help        - 显示帮助信息
#
# ================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
CLOUD_URL="https://promptly-v0-6-cloudtest-cursor-dev.onrender.com"
DB_PATH="$BACKEND_DIR/data/app.db"
LOG_FILE="$HOME/.promptly-behavior-simulator.log"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

print_header() {
  echo ""
  echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
  echo -e "${BOLD}${CYAN}  $1${NC}"
  echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
}

print_success() {
  echo -e "  ${GREEN}✓${NC} $1"
}

print_warning() {
  echo -e "  ${YELLOW}⚠${NC} $1"
}

print_error() {
  echo -e "  ${RED}✗${NC} $1"
}

print_info() {
  echo -e "  • $1"
}

# ============ 命令实现 ============

cmd_status() {
  print_header "Promptly Analytics 系统状态"
  
  echo ""
  echo -e "${BOLD}📍 本地数据库${NC}"
  
  if [ ! -f "$DB_PATH" ]; then
    print_error "数据库文件不存在: $DB_PATH"
    return 1
  fi
  
  LOCAL_USERS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM analytics_users" 2>/dev/null || echo "0")
  LOCAL_SESSIONS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM analytics_sessions" 2>/dev/null || echo "0")
  LOCAL_DAILY=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM analytics_daily" 2>/dev/null || echo "0")
  
  print_success "用户数: $LOCAL_USERS"
  print_success "会话数: $LOCAL_SESSIONS"
  print_success "每日统计: $LOCAL_DAILY 天"
  
  echo ""
  echo -e "${BOLD}☁️  云端服务器${NC}"
  print_info "URL: $CLOUD_URL"
  
  CLOUD_DATA=$(curl -s "$CLOUD_URL/api/analytics/dashboard/admin/realtime-count" 2>/dev/null)
  
  if [ -z "$CLOUD_DATA" ] || echo "$CLOUD_DATA" | grep -q "error"; then
    print_warning "云端不可用或返回错误"
  else
    CLOUD_USERS=$(echo "$CLOUD_DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('realtime',{}).get('analytics_users',0))" 2>/dev/null || echo "0")
    CLOUD_SESSIONS=$(echo "$CLOUD_DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('realtime',{}).get('analytics_sessions',0))" 2>/dev/null || echo "0")
    
    print_success "用户数: $CLOUD_USERS"
    print_success "会话数: $CLOUD_SESSIONS"
    
    # 计算差异
    USER_DIFF=$((LOCAL_USERS - CLOUD_USERS))
    SESSION_DIFF=$((LOCAL_SESSIONS - CLOUD_SESSIONS))
    
    echo ""
    echo -e "${BOLD}📊 数据对比${NC}"
    echo ""
    printf "  %-12s %-10s %-10s %-10s\n" "指标" "本地" "云端" "差异"
    echo "  ────────────────────────────────────────────"
    printf "  %-10s %-10s %-10s %+d\n" "用户数" "$LOCAL_USERS" "$CLOUD_USERS" "$USER_DIFF"
    printf "  %-10s %-10s %-10s %+d\n" "会话数" "$LOCAL_SESSIONS" "$CLOUD_SESSIONS" "$SESSION_DIFF"
    
    if [ "$USER_DIFF" -eq 0 ] && [ "$SESSION_DIFF" -eq 0 ]; then
      echo ""
      print_success "数据完全一致!"
    elif [ "$USER_DIFF" -gt 0 ] || [ "$SESSION_DIFF" -gt 0 ]; then
      echo ""
      print_warning "本地数据较多，建议运行: ./manage.sh sync"
    else
      echo ""
      print_warning "云端数据较多（可能存在重复）"
    fi
  fi
  
  echo ""
  echo -e "${BOLD}🔄 行为模拟器${NC}"
  
  SIMULATOR_PID=$(pgrep -f "behavior-simulator.py" 2>/dev/null || echo "")
  if [ -n "$SIMULATOR_PID" ]; then
    print_success "运行中 (PID: $SIMULATOR_PID)"
    
    # 显示最近日志
    if [ -f "$LOG_FILE" ]; then
      LAST_LOG=$(tail -1 "$LOG_FILE" 2>/dev/null || echo "")
      if [ -n "$LAST_LOG" ]; then
        print_info "最近日志: $(echo "$LAST_LOG" | cut -c1-60)..."
      fi
    fi
  else
    print_warning "未运行"
  fi
  
  echo ""
}

cmd_sync() {
  print_header "执行完整同步"
  
  # 检查模拟器是否运行
  SIMULATOR_PID=$(pgrep -f "behavior-simulator.py" 2>/dev/null || echo "")
  if [ -n "$SIMULATOR_PID" ]; then
    print_warning "行为模拟器正在运行 (PID: $SIMULATOR_PID)"
    print_info "建议先停止模拟器: ./manage.sh stop"
    read -p "  是否继续同步？(y/N): " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
      echo "已取消"
      return 0
    fi
  fi
  
  # 执行同步
  cd "$BACKEND_DIR"
  python3 scripts/full-sync.py --force
}

cmd_sync_check() {
  print_header "检查数据差异"
  cd "$BACKEND_DIR"
  python3 scripts/full-sync.py --check-only
}

cmd_simulator() {
  print_header "启动行为模拟器"
  
  # 检查是否已运行
  SIMULATOR_PID=$(pgrep -f "behavior-simulator.py" 2>/dev/null || echo "")
  if [ -n "$SIMULATOR_PID" ]; then
    print_error "模拟器已在运行 (PID: $SIMULATOR_PID)"
    print_info "如需重启，请先运行: ./manage.sh stop"
    return 1
  fi
  
  print_info "启动模拟器..."
  cd "$BACKEND_DIR"
  nohup python3 scripts/behavior-simulator.py > /dev/null 2>&1 &
  
  sleep 2
  
  NEW_PID=$(pgrep -f "behavior-simulator.py" 2>/dev/null || echo "")
  if [ -n "$NEW_PID" ]; then
    print_success "模拟器已启动 (PID: $NEW_PID)"
    print_info "查看日志: ./manage.sh logs"
  else
    print_error "启动失败，请检查日志"
  fi
}

cmd_stop() {
  print_header "停止行为模拟器"
  
  SIMULATOR_PID=$(pgrep -f "behavior-simulator.py" 2>/dev/null || echo "")
  if [ -z "$SIMULATOR_PID" ]; then
    print_warning "模拟器未运行"
    return 0
  fi
  
  print_info "停止进程 PID: $SIMULATOR_PID"
  kill "$SIMULATOR_PID" 2>/dev/null || true
  
  sleep 1
  
  # 检查是否停止
  if pgrep -f "behavior-simulator.py" > /dev/null 2>&1; then
    print_warning "正常停止失败，强制终止..."
    pkill -9 -f "behavior-simulator.py" 2>/dev/null || true
  fi
  
  print_success "模拟器已停止"
}

cmd_logs() {
  print_header "行为模拟器日志"
  
  if [ ! -f "$LOG_FILE" ]; then
    print_error "日志文件不存在: $LOG_FILE"
    return 1
  fi
  
  print_info "日志文件: $LOG_FILE"
  print_info "按 Ctrl+C 退出"
  echo ""
  
  tail -f "$LOG_FILE"
}

cmd_help() {
  cat << 'EOF'

Promptly Analytics - 管理命令参考
================================

  ./manage.sh status      📊 显示系统状态（本地/云端数据对比）
  ./manage.sh sync        🔄 执行完整同步（本地 → 云端）
  ./manage.sh sync-check  🔍 仅检查差异，不执行同步
  ./manage.sh simulator   ▶️  启动行为模拟器
  ./manage.sh stop        ⏹️  停止行为模拟器
  ./manage.sh logs        📝 实时查看模拟器日志
  ./manage.sh help        ❓ 显示帮助信息

常见工作流程:
------------

1. 检查状态:
   ./manage.sh status

2. 部署后恢复数据:
   ./manage.sh stop        # 先停止模拟器
   ./manage.sh sync        # 同步本地数据到云端
   ./manage.sh simulator   # 重启模拟器

3. 日常监控:
   ./manage.sh status      # 检查数据一致性
   ./manage.sh logs        # 查看模拟器运行情况

EOF
}

# ============ 主入口 ============

case "${1:-help}" in
  status)
    cmd_status
    ;;
  sync)
    cmd_sync
    ;;
  sync-check)
    cmd_sync_check
    ;;
  simulator|start)
    cmd_simulator
    ;;
  stop)
    cmd_stop
    ;;
  logs)
    cmd_logs
    ;;
  help|--help|-h)
    cmd_help
    ;;
  *)
    print_error "未知命令: $1"
    cmd_help
    exit 1
    ;;
esac
