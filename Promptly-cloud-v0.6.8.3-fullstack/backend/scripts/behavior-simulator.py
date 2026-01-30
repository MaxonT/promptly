#!/usr/bin/env python3
"""
Promptly Analytics Behavior Simulator v2
=========================================

真实用户行为模拟器 - 基于 keep-alive.py 架构

特点:
  - Mac 开机自动启动 (via launchd)
  - Mac 休眠自动暂停, 唤醒自动恢复
  - 网络断开等待, 恢复后继续
  - 服务器崩溃自动重试
  - 终端关闭后台运行
  - 基于时间段的概率模型
  - 批量用户生成 (5-20个/批次)
  - 不规律等待时间 (30分钟-4小时)
"""

import requests
import time
import sys
import subprocess
import os
import random
import json
from datetime import datetime, timedelta


# ============ 配置区域 ============
CONFIG = {
    "SERVICE_NAME": "Promptly-Behavior-Simulator",
    "API_BASE": os.environ.get("API_BASE", "https://promptly-v0-6-cloudtest-cursor-dev.onrender.com"),
    
    # 时间段概率 (%)
    "PROBABILITY": {
        "morning": 30,    # 6-12点
        "afternoon": 40,  # 12-18点
        "evening": 20,    # 18-24点
        "night": 10,      # 0-6点
    },
    
    # 批次大小
    "MIN_BATCH_SIZE": 5,
    "MAX_BATCH_SIZE": 20,
    
    # 等待时间 (秒)
    "MIN_WAIT": 1800,   # 30分钟
    "MAX_WAIT": 14400,  # 4小时
    
    # 用户类型分布 (%)
    "USER_TYPES": {
        "engaged": 30,
        "casual": 50,
        "bouncer": 20,
    },
    
    # 新用户比例 (%)
    "NEW_USER_RATIO": 60,
    
    # 网络配置
    "TIMEOUT": 15,
    "RETRY_DELAY": 60,  # 网络错误时的重试延迟
    "MAX_RETRIES": 5,
    
    # 通知
    "ENABLE_NOTIFICATIONS": True,
}
# ============ 配置区域结束 ============


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


def get_log_file():
    """生成日志文件路径"""
    return os.path.expanduser("~/.promptly-behavior-simulator.log")


def log_message(message, level="INFO"):
    """写入日志文件"""
    log_file = get_log_file()
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    log_line = f"[{timestamp}] [{level}] {message}"
    
    # 写入文件
    with open(log_file, 'a', encoding='utf-8') as f:
        f.write(log_line + "\n")
        f.flush()
    
    # 同时输出到终端 (如果有)
    print(log_line)


def send_notification(title, message):
    """发送 macOS 通知"""
    if not CONFIG["ENABLE_NOTIFICATIONS"]:
        return

    try:
        script = f'display notification "{message}" with title "{title}"'
        subprocess.run(['osascript', '-e', script], capture_output=True)
        log_message(f"📲 通知已发送: {title}")
    except Exception as e:
        log_message(f"⚠️ 通知发送失败: {e}", "WARN")


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


def should_generate():
    """根据时间段概率决定是否生成"""
    period, _ = get_time_period()
    probability = CONFIG["PROBABILITY"][period]
    return random.randint(0, 99) < probability


def random_user_id():
    """生成随机用户ID"""
    date_str = datetime.now().strftime('%Y%m%d')
    rand_num = random.randint(0, 99999)
    return f"au_{date_str}_{rand_num:05d}"


def random_session_id():
    """生成随机会话ID"""
    datetime_str = datetime.now().strftime('%Y%m%d%H%M%S')
    rand_num = random.randint(0, 9999)
    return f"as_{datetime_str}_{rand_num:04d}"


def check_network():
    """检查网络连接"""
    try:
        requests.get("https://www.google.com", timeout=5)
        return True
    except:
        try:
            requests.get("https://www.baidu.com", timeout=5)
            return True
        except:
            return False


def wait_for_network():
    """等待网络恢复"""
    log_message("🔌 网络断开，等待恢复...", "WARN")
    send_notification(
        CONFIG["SERVICE_NAME"],
        "网络断开，等待恢复..."
    )
    
    while not check_network():
        log_message("⏳ 网络仍不可用，60秒后重试...", "WARN")
        time.sleep(60)
    
    log_message("✅ 网络已恢复!", "INFO")
    send_notification(
        CONFIG["SERVICE_NAME"],
        "网络已恢复，继续运行"
    )


def api_call(endpoint, data, retries=0):
    """带重试的 API 调用"""
    url = f"{CONFIG['API_BASE']}{endpoint}"
    
    try:
        response = requests.post(
            url,
            json=data,
            timeout=CONFIG["TIMEOUT"]
        )
        return response.status_code == 200
    
    except requests.exceptions.ConnectionError:
        if retries < CONFIG["MAX_RETRIES"]:
            log_message(f"🔌 连接错误，{CONFIG['RETRY_DELAY']}秒后重试 ({retries+1}/{CONFIG['MAX_RETRIES']})", "WARN")
            time.sleep(CONFIG["RETRY_DELAY"])
            return api_call(endpoint, data, retries + 1)
        else:
            wait_for_network()
            return api_call(endpoint, data, 0)
    
    except requests.exceptions.Timeout:
        log_message(f"⏱️ 请求超时: {endpoint}", "WARN")
        return False
    
    except Exception as e:
        log_message(f"❌ API 错误: {e}", "ERROR")
        return False


def simulate_new_user():
    """模拟新用户注册"""
    user_id = random_user_id()
    data = {
        "userId": user_id,
        "source": weighted_choice(SOURCES),
        "timezone": random.choice(TIMEZONES),
        "deviceType": weighted_choice(DEVICES),
        "browser": weighted_choice(BROWSERS),
    }
    
    api_call("/api/analytics/dashboard/track/user", data)
    return user_id


def get_user_behavior(user_type):
    """根据用户类型生成行为数据"""
    if user_type == "engaged":
        return {
            "duration": random.randint(180, 780),     # 3-13分钟
            "page_views": random.randint(5, 15),
            "mouse_moves": random.randint(150, 450),
            "scrolls": random.randint(20, 70),
            "clicks": random.randint(10, 40),
            "typing": random.randint(50, 200),
        }
    elif user_type == "casual":
        return {
            "duration": random.randint(60, 300),      # 1-5分钟
            "page_views": random.randint(2, 7),
            "mouse_moves": random.randint(50, 200),
            "scrolls": random.randint(5, 25),
            "clicks": random.randint(3, 15),
            "typing": random.randint(10, 60),
        }
    else:  # bouncer
        return {
            "duration": random.randint(5, 35),        # 5-35秒
            "page_views": 1,
            "mouse_moves": random.randint(10, 50),
            "scrolls": random.randint(0, 5),
            "clicks": random.randint(0, 3),
            "typing": random.randint(0, 5),
        }


def simulate_session(user_id, user_type):
    """模拟用户会话"""
    session_id = random_session_id()
    behavior = get_user_behavior(user_type)
    
    # 开始会话
    api_call("/api/analytics/dashboard/track/session-start", {
        "userId": user_id,
        "sessionId": session_id,
        "deviceType": weighted_choice(DEVICES),
        "browser": weighted_choice(BROWSERS),
    })
    
    # 记录行为
    api_call("/api/analytics/dashboard/track/behavior", {
        "userId": user_id,
        "sessionId": session_id,
        "mouseMovements": behavior["mouse_moves"],
        "scrolls": behavior["scrolls"],
        "clicks": behavior["clicks"],
        "typingEvents": behavior["typing"],
    })
    
    # 结束会话
    api_call("/api/analytics/dashboard/track/session-end", {
        "sessionId": session_id,
        "duration": behavior["duration"],
        "pageViews": behavior["page_views"],
    })
    
    return session_id, behavior


def get_user_type():
    """随机获取用户类型"""
    roll = random.randint(0, 99)
    if roll < CONFIG["USER_TYPES"]["engaged"]:
        return "engaged"
    elif roll < CONFIG["USER_TYPES"]["engaged"] + CONFIG["USER_TYPES"]["casual"]:
        return "casual"
    else:
        return "bouncer"


def generate_batch():
    """生成一批用户"""
    batch_size = random.randint(CONFIG["MIN_BATCH_SIZE"], CONFIG["MAX_BATCH_SIZE"])
    period, period_cn = get_time_period()
    probability = CONFIG["PROBABILITY"][period]
    
    log_message("━" * 50)
    log_message(f"📊 开始生成批次 | 时段: {period_cn} | 用户数: {batch_size}")
    log_message("━" * 50)
    
    stats = {
        "new_users": 0,
        "returning_users": 0,
        "engaged": 0,
        "casual": 0,
        "bouncer": 0,
    }
    
    for i in range(1, batch_size + 1):
        # 决定是新用户还是返回用户
        is_new = random.randint(0, 99) < CONFIG["NEW_USER_RATIO"]
        user_type = get_user_type()
        
        if is_new:
            user_id = simulate_new_user()
            stats["new_users"] += 1
            user_label = f"+ 新用户 #{i}"
        else:
            # 返回用户
            date_str = datetime.now().strftime('%Y%m%d')
            user_id = f"au_{date_str}_{random.randint(0, 999):05d}"
            stats["returning_users"] += 1
            user_label = f"↩ 返回用户 #{i}"
        
        stats[user_type] += 1
        
        # 生成会话
        session_id, behavior = simulate_session(user_id, user_type)
        
        log_message(f"  {user_label}: {user_id} ({user_type})")
        log_message(f"    └─ 会话: {session_id} | {behavior['duration']}s | {behavior['page_views']}页")
        
        # 用户之间有小间隔
        time.sleep(random.randint(1, 5))
    
    log_message("━" * 50)
    log_message(f"✓ 批次完成 | 新用户: {stats['new_users']} | 返回: {stats['returning_users']}")
    log_message(f"  用户类型: engaged={stats['engaged']}, casual={stats['casual']}, bouncer={stats['bouncer']}")
    log_message("━" * 50)
    
    return stats


def calculate_wait_time():
    """计算下次等待时间"""
    wait = random.randint(CONFIG["MIN_WAIT"], CONFIG["MAX_WAIT"])
    return wait


def format_duration(seconds):
    """格式化时间"""
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    
    if hours > 0:
        return f"{hours}小时{minutes}分钟"
    else:
        return f"{minutes}分钟"


def main():
    """主循环"""
    log_message("╔" + "═" * 48 + "╗")
    log_message("║   Promptly Behavior Simulator v2              ║")
    log_message("║   真实流量模拟器                               ║")
    log_message("╚" + "═" * 48 + "╝")
    log_message("")
    log_message(f"API Base: {CONFIG['API_BASE']}")
    log_message(f"PID: {os.getpid()}")
    log_message("")
    log_message("时间段概率模型:")
    log_message(f"  📅 上午 (6-12点):  {CONFIG['PROBABILITY']['morning']}% 概率")
    log_message(f"  📅 下午 (12-18点): {CONFIG['PROBABILITY']['afternoon']}% 概率")
    log_message(f"  📅 晚上 (18-24点): {CONFIG['PROBABILITY']['evening']}% 概率")
    log_message(f"  📅 夜间 (0-6点):   {CONFIG['PROBABILITY']['night']}% 概率")
    log_message("")
    log_message(f"每批生成: {CONFIG['MIN_BATCH_SIZE']}-{CONFIG['MAX_BATCH_SIZE']} 个用户")
    log_message(f"等待间隔: {format_duration(CONFIG['MIN_WAIT'])} - {format_duration(CONFIG['MAX_WAIT'])}")
    log_message("")
    
    send_notification(
        CONFIG["SERVICE_NAME"],
        "行为模拟器已启动"
    )
    
    round_count = 0
    
    while True:
        round_count += 1
        period, period_cn = get_time_period()
        probability = CONFIG["PROBABILITY"][period]
        
        log_message("")
        log_message(f"🕐 第 {round_count} 轮 | 当前时段: {period_cn} | 生成概率: {probability}%")
        
        # 检查网络
        if not check_network():
            wait_for_network()
        
        # 根据概率决定是否生成
        if should_generate():
            try:
                generate_batch()
            except Exception as e:
                log_message(f"❌ 批次生成错误: {e}", "ERROR")
                send_notification(
                    CONFIG["SERVICE_NAME"],
                    f"批次生成错误: {type(e).__name__}"
                )
        else:
            log_message(f"⏸ 本轮跳过生成 (概率未命中: {random.randint(probability, 99)} >= {probability})")
        
        # 计算等待时间
        wait_time = calculate_wait_time()
        wait_formatted = format_duration(wait_time)
        next_time = (datetime.now() + timedelta(seconds=wait_time)).strftime('%Y-%m-%d %H:%M:%S')
        
        log_message("")
        log_message(f"💤 等待 {wait_formatted} 后继续...")
        log_message(f"⏰ 下次运行: {next_time}")
        log_message("")
        
        time.sleep(wait_time)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log_message("⛔ 模拟器被手动停止")
        send_notification(CONFIG["SERVICE_NAME"], "模拟器已停止")
        sys.exit(0)
    except Exception as e:
        log_message(f"💥 致命错误: {e}", "ERROR")
        send_notification(CONFIG["SERVICE_NAME"], f"致命错误: {type(e).__name__}")
        sys.exit(1)
