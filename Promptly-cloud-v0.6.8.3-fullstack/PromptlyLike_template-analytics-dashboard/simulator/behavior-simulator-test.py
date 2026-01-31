#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
═══════════════════════════════════════════════════════════════════════════════════
Analytics Dashboard Behavior Simulator - Test Version
═══════════════════════════════════════════════════════════════════════════════════

简化版本，用于快速测试。固定运行2轮后退出。

使用方法:
    python behavior-simulator-test.py

═══════════════════════════════════════════════════════════════════════════════════
"""

import os
import sys
import json
import time
import random
import logging
from datetime import datetime
import urllib.request
import urllib.error

# ═══════════════════════════════════════════════════════════════════════════════
# 配置
# ═══════════════════════════════════════════════════════════════════════════════

API_BASE = os.environ.get('ANALYTICS_API_BASE', 'http://localhost:8080')
API_ENDPOINT = f'{API_BASE}/api/analytics/dashboard/admin/generate-data'
ADMIN_API_KEY = os.environ.get('ADMIN_API_KEY', '')

# 测试配置
TEST_ROUNDS = 2
TEST_INTERVAL = 5  # 秒
TEST_USERS_PER_ROUND = 3
TEST_SESSIONS_PER_ROUND = 5

# ═══════════════════════════════════════════════════════════════════════════════
# 日志
# ═══════════════════════════════════════════════════════════════════════════════

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger('test-simulator')

# ═══════════════════════════════════════════════════════════════════════════════
# 测试模拟器
# ═══════════════════════════════════════════════════════════════════════════════

def send_request(users: int, sessions: int) -> bool:
    """发送测试请求"""
    try:
        data = json.dumps({'users': users, 'sessions': sessions}).encode('utf-8')
        
        req = urllib.request.Request(
            API_ENDPOINT,
            data=data,
            headers={
                'Content-Type': 'application/json',
                'X-Admin-Key': ADMIN_API_KEY
            },
            method='POST'
        )
        
        with urllib.request.urlopen(req, timeout=30) as response:
            result = json.loads(response.read().decode('utf-8'))
            
            if result.get('ok'):
                logger.info(f"✓ Success: {users} users, {sessions} sessions")
                return True
            else:
                logger.error(f"API error: {result.get('error', 'Unknown')}")
                return False
                
    except urllib.error.HTTPError as e:
        logger.error(f"HTTP error {e.code}: {e.reason}")
        return False
    except urllib.error.URLError as e:
        logger.error(f"URL error: {e.reason}")
        return False
    except Exception as e:
        logger.error(f"Request failed: {e}")
        return False


def main():
    """主函数"""
    logger.info("═══════════════════════════════════════════════════════════════")
    logger.info(" Analytics Behavior Simulator - TEST MODE")
    logger.info("═══════════════════════════════════════════════════════════════")
    logger.info(f"API Endpoint: {API_ENDPOINT}")
    logger.info(f"Test Rounds: {TEST_ROUNDS}")
    logger.info(f"Interval: {TEST_INTERVAL} seconds")
    logger.info("═══════════════════════════════════════════════════════════════")
    
    success_count = 0
    
    for round_num in range(1, TEST_ROUNDS + 1):
        logger.info(f"═══ Round {round_num}/{TEST_ROUNDS} ═══")
        
        # 添加小随机波动
        users = TEST_USERS_PER_ROUND + random.randint(-1, 2)
        sessions = TEST_SESSIONS_PER_ROUND + random.randint(-1, 3)
        
        users = max(1, users)
        sessions = max(users, sessions)
        
        if send_request(users, sessions):
            success_count += 1
        
        if round_num < TEST_ROUNDS:
            logger.info(f"Waiting {TEST_INTERVAL} seconds...")
            time.sleep(TEST_INTERVAL)
    
    logger.info("═══════════════════════════════════════════════════════════════")
    logger.info(" Test Complete")
    logger.info("═══════════════════════════════════════════════════════════════")
    logger.info(f"Successful rounds: {success_count}/{TEST_ROUNDS}")
    
    if success_count == TEST_ROUNDS:
        logger.info("✓ All tests passed!")
        sys.exit(0)
    else:
        logger.warning("✗ Some tests failed")
        sys.exit(1)


if __name__ == '__main__':
    main()
