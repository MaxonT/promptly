#!/usr/bin/env python3
"""
Promptly Analytics Background Data Sync
=========================================

背景数据同步脚本 - 每 10 分钟执行一次
- 通过 launchd 定期运行
- 检测本地与云端数据差异
- 自动执行同步（如有需要）

功能:
1. 检查本地 SQLite 数据库统计
2. 检查云端 PostgreSQL 数据库统计
3. 如果差异超过阈值，自动同步
4. 记录详细日志
"""

import os
import sys
import json
import sqlite3
import requests
import logging
import subprocess
from datetime import datetime
from pathlib import Path

# ============ 配置 ============
PROJECT_ROOT = Path(__file__).parent.parent.parent
BACKEND_DIR = PROJECT_ROOT / "backend"
DB_PATH = BACKEND_DIR / "data" / "app.db"
LOG_DIR = PROJECT_ROOT / "logs"
LOG_FILE = LOG_DIR / "sync-background.log"
API_BASE = os.environ.get("API_BASE", "https://promptly-v0-6-cloudtest-cursor-dev.onrender.com")
ADMIN_KEY = os.environ.get("ADMIN_API_KEY", "")

# 同步阈值：差异超过此值时自动同步
SYNC_THRESHOLD = 5  # 如果本地比云端多 5 条以上记录，触发同步

# 创建日志目录
LOG_DIR.mkdir(parents=True, exist_ok=True)

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE, encoding='utf-8'),
        logging.StreamHandler(sys.stdout)
    ],
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


def get_local_stats():
    """获取本地数据库统计"""
    try:
        if not DB_PATH.exists():
            logger.warning(f"❌ 本地数据库不存在: {DB_PATH}")
            return None
        
        conn = sqlite3.connect(str(DB_PATH))
        cursor = conn.cursor()
        
        stats = {}
        
        # 用户数
        cursor.execute("SELECT COUNT(*) FROM analytics_users")
        stats["users"] = cursor.fetchone()[0]
        
        # 会话数
        cursor.execute("SELECT COUNT(*) FROM analytics_sessions")
        stats["sessions"] = cursor.fetchone()[0]
        
        # 每日统计
        cursor.execute("SELECT COUNT(*) FROM analytics_daily")
        stats["daily"] = cursor.fetchone()[0]
        
        conn.close()
        return stats
    except Exception as e:
        logger.error(f"❌ 查询本地数据库失败: {e}")
        return None


def get_cloud_stats():
    """获取云端数据库统计"""
    try:
        response = requests.get(
            f"{API_BASE}/api/analytics/dashboard/admin/realtime-count",
            headers={"X-Admin-Key": ADMIN_KEY} if ADMIN_KEY else {},
            timeout=15
        )
        
        if response.status_code != 200:
            logger.warning(f"⚠️  云端API返回异常状态: {response.status_code}")
            return None
        
        data = response.json()
        realtime = data.get("realtime", {})
        
        return {
            "users": realtime.get("analytics_users", 0),
            "sessions": realtime.get("analytics_sessions", 0),
            "daily": realtime.get("analytics_daily", 0)
        }
    except Exception as e:
        logger.warning(f"⚠️  云端统计查询失败: {e}")
        return None


def check_cloud_health():
    """检查云端服务健康状态"""
    try:
        response = requests.get(
            f"{API_BASE}/api/health",
            timeout=10
        )
        return response.status_code == 200
    except Exception as e:
        logger.warning(f"⚠️  云端服务检查失败: {e}")
        return False


def execute_full_sync():
    """执行完整数据同步（调用 full-sync.py）"""
    try:
        logger.info("🔄 开始执行完整数据同步...")
        
        # 调用 full-sync.py --force
        script_path = BACKEND_DIR / "scripts" / "full-sync.py"
        
        if not script_path.exists():
            logger.error(f"❌ 同步脚本不存在: {script_path}")
            return False
        
        result = subprocess.run(
            [sys.executable, str(script_path), "--force"],
            cwd=str(BACKEND_DIR),
            capture_output=True,
            text=True,
            timeout=300  # 5 分钟超时
        )
        
        if result.returncode == 0:
            logger.info("✅ 完整数据同步成功")
            # 记录同步输出（最后10行）
            output_lines = result.stdout.strip().split('\n')
            for line in output_lines[-10:]:
                logger.info(f"   {line}")
            return True
        else:
            logger.error(f"❌ 数据同步失败 (返回码: {result.returncode})")
            logger.error(f"   错误输出: {result.stderr[:500]}")
            return False
            
    except subprocess.TimeoutExpired:
        logger.error("❌ 数据同步超时（超过5分钟）")
        return False
    except Exception as e:
        logger.error(f"❌ 执行同步失败: {e}")
        return False


def sync_check():
    """执行同步检查与自动同步"""
    logger.info("════════════════════════════════════════")
    logger.info("🔄 背景同步检查开始...")
    
    # 步骤 1: 检查云端健康
    if not check_cloud_health():
        logger.warning("⚠️  云端服务不可用，跳过本次检查")
        return False
    
    logger.info("✅ 云端服务正常")
    
    # 步骤 2: 获取本地统计
    local_stats = get_local_stats()
    if local_stats is None:
        logger.error("❌ 无法获取本地数据库信息")
        return False
    
    logger.info(f"📊 本地数据: 用户={local_stats['users']}, 会话={local_stats['sessions']}, 每日={local_stats['daily']}")
    
    # 步骤 3: 获取云端统计
    cloud_stats = get_cloud_stats()
    if cloud_stats is None:
        logger.warning("⚠️  无法获取云端统计，跳过同步决策")
        return False
    
    logger.info(f"☁️  云端数据: 用户={cloud_stats['users']}, 会话={cloud_stats['sessions']}, 每日={cloud_stats['daily']}")
    
    # 步骤 4: 计算差异
    user_diff = local_stats["users"] - cloud_stats["users"]
    session_diff = local_stats["sessions"] - cloud_stats["sessions"]
    
    logger.info(f"📈 差异: 用户差{user_diff:+d}, 会话差{session_diff:+d}")
    
    # 步骤 5: 判断是否需要同步
    # 只有当本地比云端多时才同步（以本地为准）
    if user_diff >= SYNC_THRESHOLD or session_diff >= SYNC_THRESHOLD:
        logger.warning(f"⚠️  检测到本地数据比云端多（超过阈值 {SYNC_THRESHOLD}），触发自动同步")
        
        # 执行同步
        sync_success = execute_full_sync()
        
        if sync_success:
            logger.info("✨ 自动同步完成")
            return True
        else:
            logger.error("❌ 自动同步失败")
            return False
    elif user_diff < -SYNC_THRESHOLD or session_diff < -SYNC_THRESHOLD:
        logger.warning(f"⚠️  云端数据比本地多 (用户差{user_diff}, 会话差{session_diff})")
        logger.warning("   这可能是因为：")
        logger.warning("   1. 重新部署后数据库重置，但行为模拟器仍在运行")
        logger.warning("   2. 云端存在重复数据")
        logger.warning("   建议手动执行: cd backend && ./scripts/manage.sh status")
        return True
    else:
        if user_diff == 0 and session_diff == 0:
            logger.info("✅ 数据完全一致，无需同步")
        else:
            logger.info(f"✅ 差异在可接受范围内（<{SYNC_THRESHOLD}），无需同步")
        return True


def main():
    """主函数"""
    try:
        success = sync_check()
        logger.info("════════════════════════════════════════")
        
        if success:
            logger.info("✨ 同步检查完成")
            return 0
        else:
            logger.warning("⚠️  同步检查部分失败")
            return 1
    except Exception as e:
        logger.error(f"💥 脚本执行异常: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return 1


if __name__ == "__main__":
    sys.exit(main())
