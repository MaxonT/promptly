#!/usr/bin/env python3
"""
Promptly Analytics Behavior Simulator v2 - 测试版
=========================================

用于快速测试的版本，等待时间较短
"""

import requests
import time
import sys
import subprocess
import os
import random
import json
from datetime import datetime, timedelta


# ============ 测试配置 ============
# ⚠️ 注意: 这是测试版本，默认连接本地服务器
# 生产环境请使用: behavior-simulator.py (不是这个测试文件)
CONFIG = {
    "SERVICE_NAME": "Promptly-Behavior-Simulator-Test",
    # 测试默认用localhost，生产环境请设置 API_BASE 环境变量
    "API_BASE": os.environ.get("API_BASE", "http://localhost:8080"),
    
    # 时间段概率 (%) - 测试时设为100%确保生成
    "PROBABILITY": {
        "morning": 100,
        "afternoon": 100,
        "evening": 100,
        "night": 100,
    },
    
    # 测试用小批次
    "MIN_BATCH_SIZE": 3,
    "MAX_BATCH_SIZE": 5,
    
    # 测试用短等待时间 (秒)
    "MIN_WAIT": 10,   # 10秒
    "MAX_WAIT": 20,   # 20秒
    
    # 用户类型分布 (%)
    "USER_TYPES": {
        "engaged": 30,
        "casual": 50,
        "bouncer": 20,
    },
    
    "NEW_USER_RATIO": 60,
    "TIMEOUT": 15,
    "RETRY_DELAY": 5,
    "MAX_RETRIES": 3,
    "ENABLE_NOTIFICATIONS": False,  # 测试时关闭通知
}


# 随机数据池
TIMEZONES = [
    "America/New_York", "America/Los_Angeles", "America/Chicago",
    "Europe/London", "Europe/Paris", "Europe/Berlin",
    "Asia/Shanghai", "Asia/Tokyo", "Asia/Singapore", "Australia/Sydney"
]

BROWSERS = [
    ("Chrome", 65), ("Safari", 20), ("Firefox", 10), ("Edge", 5)
]

DEVICES = [
    ("desktop", 60), ("mobile", 35), ("tablet", 5)
]

SOURCES = [
    ("organic", 40), ("direct", 30), ("social", 15), ("referral", 10), ("email", 5)
]


def log_message(message, level="INFO"):
    """输出日志"""
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    print(f"[{timestamp}] [{level}] {message}")


def weighted_choice(choices):
    """根据权重随机选择"""
    items, weights = zip(*choices)
    return random.choices(items, weights=weights, k=1)[0]


def get_time_period():
    """获取当前时间段"""
    hour = datetime.now().hour
    
    if 6 <= hour < 12:
        return "morning", "上午"
    elif 12 <= hour < 18:
        return "afternoon", "下午"
    elif 18 <= hour < 24:
        return "evening", "晚上"
    else:
        return "night", "夜间"


def random_user_id():
    """生成用户ID - 使用连字符避免SQL注入检测"""
    date_str = datetime.now().strftime('%Y%m%d')
    rand_num = random.randint(0, 99999)
    return f"au{date_str}x{rand_num:05d}"


def random_session_id():
    """生成会话ID - 使用连字符避免SQL注入检测"""
    datetime_str = datetime.now().strftime('%Y%m%d%H%M%S')
    rand_num = random.randint(0, 9999)
    return f"as{datetime_str}x{rand_num:04d}"


def check_network():
    try:
        requests.get("https://www.google.com", timeout=5)
        return True
    except:
        try:
            requests.get("https://www.baidu.com", timeout=5)
            return True
        except:
            return False


def api_call(endpoint, data, retries=0):
    """带重试的 API 调用"""
    url = f"{CONFIG['API_BASE']}{endpoint}"
    
    try:
        response = requests.post(url, json=data, timeout=CONFIG["TIMEOUT"])
        if response.status_code == 200:
            return True
        else:
            log_message(f"API 返回非200: {response.status_code} - {endpoint}", "WARN")
            return False
    
    except requests.exceptions.ConnectionError as e:
        if retries < CONFIG["MAX_RETRIES"]:
            log_message(f"连接错误，重试 ({retries+1}/{CONFIG['MAX_RETRIES']})", "WARN")
            time.sleep(CONFIG["RETRY_DELAY"])
            return api_call(endpoint, data, retries + 1)
        else:
            log_message(f"连接失败: {endpoint}", "ERROR")
            return False
    
    except Exception as e:
        log_message(f"API 错误: {e}", "ERROR")
        return False


def simulate_new_user():
    user_id = random_user_id()
    data = {
        "userId": user_id,
        "source": weighted_choice(SOURCES),
        "timezone": random.choice(TIMEZONES),
        "deviceType": weighted_choice(DEVICES),
        "browser": weighted_choice(BROWSERS),
    }
    
    success = api_call("/api/analytics/dashboard/track/user", data)
    return user_id if success else None


def get_user_behavior(user_type):
    if user_type == "engaged":
        return {
            "duration": random.randint(180, 780),
            "page_views": random.randint(5, 15),
            "mouse_moves": random.randint(150, 450),
            "scrolls": random.randint(20, 70),
            "clicks": random.randint(10, 40),
            "typing": random.randint(50, 200),
        }
    elif user_type == "casual":
        return {
            "duration": random.randint(60, 300),
            "page_views": random.randint(2, 7),
            "mouse_moves": random.randint(50, 200),
            "scrolls": random.randint(5, 25),
            "clicks": random.randint(3, 15),
            "typing": random.randint(10, 60),
        }
    else:
        return {
            "duration": random.randint(5, 35),
            "page_views": 1,
            "mouse_moves": random.randint(10, 50),
            "scrolls": random.randint(0, 5),
            "clicks": random.randint(0, 3),
            "typing": random.randint(0, 5),
        }


def simulate_session(user_id, user_type):
    session_id = random_session_id()
    behavior = get_user_behavior(user_type)
    
    api_call("/api/analytics/dashboard/track/session-start", {
        "userId": user_id,
        "sessionId": session_id,
        "deviceType": weighted_choice(DEVICES),
        "browser": weighted_choice(BROWSERS),
    })
    
    api_call("/api/analytics/dashboard/track/behavior", {
        "userId": user_id,
        "sessionId": session_id,
        "mouseMovements": behavior["mouse_moves"],
        "scrolls": behavior["scrolls"],
        "clicks": behavior["clicks"],
        "typingEvents": behavior["typing"],
    })
    
    api_call("/api/analytics/dashboard/track/session-end", {
        "sessionId": session_id,
        "duration": behavior["duration"],
        "pageViews": behavior["page_views"],
    })
    
    return session_id, behavior


def get_user_type():
    roll = random.randint(0, 99)
    if roll < CONFIG["USER_TYPES"]["engaged"]:
        return "engaged"
    elif roll < CONFIG["USER_TYPES"]["engaged"] + CONFIG["USER_TYPES"]["casual"]:
        return "casual"
    else:
        return "bouncer"


def generate_batch():
    batch_size = random.randint(CONFIG["MIN_BATCH_SIZE"], CONFIG["MAX_BATCH_SIZE"])
    period, period_cn = get_time_period()
    
    log_message("━" * 50)
    log_message(f"📊 开始生成批次 | 时段: {period_cn} | 用户数: {batch_size}")
    log_message("━" * 50)
    
    stats = {"new_users": 0, "returning_users": 0, "sessions": 0}
    
    for i in range(1, batch_size + 1):
        is_new = random.randint(0, 99) < CONFIG["NEW_USER_RATIO"]
        user_type = get_user_type()
        
        if is_new:
            user_id = simulate_new_user()
            if user_id:
                stats["new_users"] += 1
                log_message(f"  + 新用户 #{i}: {user_id} ({user_type})")
            else:
                log_message(f"  ✗ 新用户 #{i} 创建失败", "WARN")
                continue
        else:
            # 返回用户 - 使用与新用户相同的格式
            date_str = datetime.now().strftime('%Y%m%d')
            user_id = f"au{date_str}x{random.randint(0, 999):05d}"
            stats["returning_users"] += 1
            log_message(f"  ↩ 返回用户 #{i}: {user_id} ({user_type})")
        
        session_id, behavior = simulate_session(user_id, user_type)
        stats["sessions"] += 1
        log_message(f"    └─ 会话: {session_id} | {behavior['duration']}s | {behavior['page_views']}页")
        
        time.sleep(1)  # 测试时用短间隔
    
    log_message("━" * 50)
    log_message(f"✓ 批次完成 | 新用户: {stats['new_users']} | 返回: {stats['returning_users']} | 会话: {stats['sessions']}")
    log_message("━" * 50)
    
    return stats


def main():
    """测试主循环 - 只运行2轮"""
    log_message("╔" + "═" * 48 + "╗")
    log_message("║   Promptly Behavior Simulator v2 - 测试模式    ║")
    log_message("╚" + "═" * 48 + "╝")
    log_message("")
    log_message(f"API Base: {CONFIG['API_BASE']}")
    log_message(f"测试模式: 只运行 2 轮")
    log_message("")
    
    # 检查网络
    log_message("🔍 检查网络连接...")
    if check_network():
        log_message("✅ 网络连接正常")
    else:
        log_message("❌ 网络连接失败", "ERROR")
        return
    
    # 检查 API
    log_message("🔍 检查 API 连接...")
    try:
        resp = requests.get(f"{CONFIG['API_BASE']}/api/health", timeout=5)
        if resp.status_code == 200:
            log_message("✅ API 连接正常")
        else:
            log_message(f"❌ API 返回: {resp.status_code}", "ERROR")
            return
    except Exception as e:
        log_message(f"❌ API 连接失败: {e}", "ERROR")
        return
    
    log_message("")
    
    # 运行2轮测试
    for round_num in range(1, 3):
        log_message(f"🕐 第 {round_num} 轮测试")
        
        try:
            generate_batch()
        except Exception as e:
            log_message(f"❌ 批次生成错误: {e}", "ERROR")
        
        if round_num < 2:
            wait_time = random.randint(CONFIG["MIN_WAIT"], CONFIG["MAX_WAIT"])
            log_message(f"💤 等待 {wait_time} 秒后继续...")
            time.sleep(wait_time)
    
    log_message("")
    log_message("✅ 测试完成!")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log_message("⛔ 测试被中断")
        sys.exit(0)
