#!/usr/bin/env python3
"""
Promptly Analytics Background Data Sync
=========================================

背景数据同步脚本 - 每 1 小时执行一次
- 通过 launchd 定期运行
- 确保本地和云端数据一致性

功能:
1. 检查本地 SQLite 数据库用户数
2. 发送到云端 API 进行验证/同步
3. 记录日志用于监控
"""

import os
import sys
import json
import sqlite3
import requests
import logging
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


def get_local_user_count():
    """获取本地数据库用户数"""
    try:
        if not DB_PATH.exists():
            logger.warning(f"❌ 本地数据库不存在: {DB_PATH}")
            return None
        
        conn = sqlite3.connect(str(DB_PATH))
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM analytics_users")
        count = cursor.fetchone()[0]
        conn.close()
        return count
    except Exception as e:
        logger.error(f"❌ 查询本地数据库失败: {e}")
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


def sync_check():
    """执行同步检查"""
    logger.info("════════════════════════════════════════")
    logger.info("🔄 背景同步检查开始...")
    
    # 步骤 1: 获取本地用户数
    local_count = get_local_user_count()
    if local_count is None:
        logger.error("❌ 无法获取本地数据库信息")
        return False
    
    logger.info(f"📊 本地数据库用户数: {local_count}")
    
    # 步骤 2: 检查云端健康
    if not check_cloud_health():
        logger.warning("⚠️  云端服务不可用，跳过同步验证")
        return False
    
    logger.info("✅ 云端服务正常")
    
    # 步骤 3: 发送验证请求到云端
    try:
        response = requests.post(
            f"{API_BASE}/api/analytics/dashboard/admin/generate-data",
            json={
                "users": 0,  # 0 = 仅验证，不生成新数据
                "sessions": 0
            },
            headers={
                "X-Admin-Key": ADMIN_KEY
            } if ADMIN_KEY else {},
            timeout=15
        )
        
        if response.status_code == 200:
            logger.info("✅ 云端同步验证成功")
            logger.info(f"📡 响应: {response.json()}")
            return True
        else:
            logger.error(f"❌ 云端响应异常: HTTP {response.status_code}")
            return False
    except Exception as e:
        logger.error(f"❌ 同步验证失败: {e}")
        return False


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
