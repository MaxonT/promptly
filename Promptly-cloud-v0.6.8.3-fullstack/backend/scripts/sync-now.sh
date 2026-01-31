#!/bin/bash
# ============================================
# Promptly Analytics - 一次性同步脚本
# ============================================
# 使用方式: ./sync-now.sh
# 
# 此脚本用于手动触发数据同步
# 或通过 cron 设置自动同步
# ============================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="$BACKEND_DIR/../logs/sync.log"
CLOUD_URL="https://promptly-v0-6-cloudtest-cursor-dev.onrender.com"

# 确保日志目录存在
mkdir -p "$(dirname "$LOG_FILE")"

# 日志函数
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "══════════════════════════════════════"
log "🚀 Promptly 数据同步"
log "══════════════════════════════════════"

# 检查云端健康状态
log "🔍 检查云端状态..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$CLOUD_URL/api/health" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" != "200" ]; then
  log "❌ 云端不可用 (HTTP $HTTP_CODE)"
  exit 1
fi
log "✅ 云端正常"

# 检查 Node.js
if ! command -v node &> /dev/null; then
  # 尝试常见的 Node.js 路径
  if [ -f "/opt/homebrew/bin/node" ]; then
    export PATH="/opt/homebrew/bin:$PATH"
  elif [ -f "$HOME/.nvm/versions/node/v22.14.0/bin/node" ]; then
    export PATH="$HOME/.nvm/versions/node/v22.14.0/bin:$PATH"
  else
    log "❌ Node.js 未找到"
    exit 1
  fi
fi

# 执行同步
cd "$BACKEND_DIR"
log "📤 开始同步..."

if node scripts/sync-to-cloud.js "$CLOUD_URL" >> "$LOG_FILE" 2>&1; then
  log "✅ 同步成功!"
else
  log "❌ 同步失败"
  exit 1
fi

log "══════════════════════════════════════"
