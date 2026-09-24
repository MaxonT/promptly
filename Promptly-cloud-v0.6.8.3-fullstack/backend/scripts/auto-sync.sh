#!/bin/bash
# ============================================
# Promptly 自动数据同步脚本
# ============================================
# 功能: 从本地 SQLite 同步 analytics 数据到云端
# 运行间隔: 每 3 小时 (通过 launchd 配置)
# ============================================

set -e

# 配置
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
BACKEND_DIR="$PROJECT_ROOT/backend"
LOG_DIR="$PROJECT_ROOT/logs"
LOG_FILE="$LOG_DIR/auto-sync.log"
CLOUD_URL="https://promptly-v0-6-cloudtest-cursor-dev.onrender.com"

# 创建日志目录
mkdir -p "$LOG_DIR"

# 日志函数
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# 开始同步
log "════════════════════════════════════════"
log "🚀 开始自动数据同步..."
log "📍 项目路径: $PROJECT_ROOT"
log "☁️  云端URL: $CLOUD_URL"

# 检查后端服务健康状态
log "🔍 检查云端服务状态..."
HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" "$CLOUD_URL/api/health" 2>/dev/null || echo "000")

if [ "$HEALTH_CHECK" != "200" ]; then
  log "❌ 云端服务不可用 (HTTP $HEALTH_CHECK)，跳过同步"
  exit 1
fi

log "✅ 云端服务正常"

# 切换到backend目录执行同步
cd "$BACKEND_DIR"

# 检查本地数据库是否存在
if [ ! -f "data/app.db" ]; then
  log "❌ 本地数据库不存在: data/app.db"
  exit 1
fi

# 执行同步脚本
log "📤 执行数据同步..."
if node scripts/sync-to-cloud.js "$CLOUD_URL" >> "$LOG_FILE" 2>&1; then
  log "✅ 数据同步完成!"
else
  log "❌ 数据同步失败"
  exit 1
fi

log "════════════════════════════════════════"
log ""
