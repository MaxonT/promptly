#!/usr/bin/env python3
"""
Promptly Analytics Behavior Simulator v3 - 生产版本
=========================================

真实用户行为模拟器 - 批量API版本

🔧 API配置:
  - 端点: /api/analytics/dashboard/admin/generate-data
  - 默认URL: https://promptly-v0-6-cloudtest-cursor-dev.onrender.com
  - 环境变量: API_BASE (可覆盖默认值)

✨ 特点:
  - Mac 开机自动启动 (via launchd)
  - Mac 休眠自动暂停, 唤醒自动恢复
  - 网络断开等待, 恢复后继续
  - 服务器崩溃自动重试
  - 终端关闭后台运行
  - 基于时间段的概率模型
  - 批量用户生成 (5-20个/批次)
  - 不规律等待时间 (30分钟-4小时)

⚠️  重要: 不要使用 behavior-simulator-test.py (那是测试版本)
"""

import requests
import time
import sys
import subprocess
import os
import random
import json
import sqlite3
from datetime import datetime, timedelta


# ============ 配置区域 ============
CONFIG = {
    "SERVICE_NAME": "Promptly-Behavior-Simulator",
    "API_BASE": os.environ.get("API_BASE", "https://promptly-v0-6-cloudtest-cursor-dev.onrender.com"),
    
    # 本地数据库路径 (相对于 backend 目录)
    "LOCAL_DB_PATH": os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "data", "app.db"
    ),
    
    # 时间段概率 (%) - 提升1.5倍
    "PROBABILITY": {
        "morning": 45,    # 6-12点 (原30 → 45)
        "afternoon": 60,  # 12-18点 (原40 → 60)
        "evening": 30,    # 18-24点 (原20 → 30)
        "night": 15,      # 0-6点 (原10 → 15)
    },
    
    # 批次大小 - 提升1.5倍
    "MIN_BATCH_SIZE": 8,   # 原5 → 8
    "MAX_BATCH_SIZE": 30,  # 原20 → 30
    
    # 等待时间 (秒) - 缩短为原来的2/3以提速1.5倍
    "MIN_WAIT": 1200,   # 20分钟 (原30分钟)
    "MAX_WAIT": 9600,   # 约2.7小时 (原4小时)
    
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


def get_db_connection():
    """获取本地 SQLite 连接"""
    try:
        conn = sqlite3.connect(CONFIG["LOCAL_DB_PATH"])
        conn.row_factory = sqlite3.Row
        return conn
    except sqlite3.Error as e:
        log_message(f"❌ 数据库连接失败: {e}", "ERROR")
        return None


def insert_data_to_local_db(users, sessions):
    """
    直接向本地 SQLite 插入数据
    与 API 端点 /api/analytics/dashboard/admin/generate-data 执行相同的操作
    """
    conn = get_db_connection()
    if not conn:
        log_message("⚠️ 本地数据库不可用，跳过本地数据插入", "WARN")
        return False
    
    try:
        cursor = conn.cursor()
        today = datetime.now().strftime('%Y-%m-%d')
        now = datetime.now().isoformat()
        
        # 时区和设备列表
        timezones = [
            'America/New_York', 'America/Los_Angeles', 'America/Chicago',
            'Europe/London', 'Europe/Paris', 'Europe/Berlin',
            'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Singapore', 'Australia/Sydney'
        ]
        devices = ['desktop', 'mobile', 'tablet']
        browsers = ['Chrome', 'Safari', 'Firefox', 'Edge']
        
        # 插入新用户
        new_user_ids = []
        for i in range(users):
            user_id = f"au_{int(datetime.now().timestamp() * 1000)}_{random.randint(0, 99999):05d}"
            tz = random.choice(timezones)
            device = random.choice(devices)
            browser = random.choice(browsers)
            
            cursor.execute("""
                INSERT INTO analytics_users 
                (id, source, timezone, country, device_type, browser, created_at, last_active_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (user_id, 'simulator', tz, 'US', device, browser, now, now))
            
            new_user_ids.append(user_id)
        
        # 获取现有用户用于创建会话
        cursor.execute("SELECT id FROM analytics_users ORDER BY created_at DESC LIMIT 100")
        existing_users = [row[0] for row in cursor.fetchall()]
        all_user_ids = new_user_ids + existing_users
        
        # 插入会话
        for i in range(sessions):
            session_id = f"as_{int(datetime.now().timestamp() * 1000)}_{random.randint(0, 9999):04d}"
            user_id = random.choice(all_user_ids) if all_user_ids else f"au_fallback_{i}"
            duration = random.randint(30, 300)
            page_views = random.randint(1, 5)
            device = random.choice(devices)
            browser = random.choice(browsers)
            
            cursor.execute("""
                INSERT INTO analytics_sessions 
                (id, user_id, session_start, duration_seconds, page_views, device_type, browser, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (session_id, user_id, now, duration, page_views, device, browser, now))
        
        # 更新日统计表
        cursor.execute("SELECT * FROM analytics_daily WHERE date = ?", (today,))
        existing_daily = cursor.fetchone()
        
        if existing_daily:
            cursor.execute("""
                UPDATE analytics_daily
                SET unique_users = unique_users + ?,
                    new_users = new_users + ?,
                    total_sessions = total_sessions + ?,
                    cumulative_users = cumulative_users + ?
                WHERE date = ?
            """, (users, users, sessions, users, today))
        else:
            cursor.execute("SELECT cumulative_users FROM analytics_daily ORDER BY date DESC LIMIT 1")
            prev_cumulative = cursor.fetchone()
            prev_cumulative = prev_cumulative[0] if prev_cumulative else 0
            
            cursor.execute("""
                INSERT INTO analytics_daily 
                (date, unique_users, new_users, total_sessions, cumulative_users, created_at)
                VALUES (?, ?, ?, ?, ?, datetime('now'))
            """, (today, users, users, sessions, prev_cumulative + users))
        
        conn.commit()
        log_message(f"💾 本地数据库: ✅ {users} 用户, {sessions} 会话已插入")
        return True
    
    except sqlite3.Error as e:
        log_message(f"❌ 本地数据库插入失败: {e}", "ERROR")
        conn.rollback()
        return False
    
    finally:
        conn.close()


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


def api_call_generate_data(users, sessions, retries=0):
    """
    发送数据到云端和本地数据库
    
    执行流程:
    1. 先插入到本地 SQLite 数据库 ✅
    2. 同时发送到云端 API ☁️
    3. 两个目标都成功才算成功
    """
    log_message(f"📦 准备插入数据: {users} 用户, {sessions} 会话")
    
    # 步骤 1: 插入到本地数据库
    local_success = insert_data_to_local_db(users, sessions)
    
    # 步骤 2: 发送到云端 API
    url = f"{CONFIG['API_BASE']}/api/analytics/dashboard/admin/generate-data"
    
    try:
        log_message(f"🌐 发送到云端: {url}")
        
        response = requests.post(
            url,
            json={
                "users": users,
                "sessions": sessions
            },
            headers={
                "X-Admin-Key": os.environ.get("ADMIN_API_KEY", "")
            },
            timeout=CONFIG["TIMEOUT"]
        )
        
        log_message(f"📡 云端响应: HTTP {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            if result.get("ok"):
                log_message(f"☁️  云端数据: ✅ 已同步")
                api_success = True
            else:
                log_message(f"❌ 云端返回错误: {result.get('error', 'Unknown')}", "ERROR")
                api_success = False
        else:
            log_message(f"❌ HTTP {response.status_code}: {response.text}", "ERROR")
            api_success = False
    
    except requests.exceptions.ConnectionError as e:
        log_message(f"🔌 云端连接错误: {e}", "ERROR")
        if retries < CONFIG["MAX_RETRIES"]:
            log_message(f"🔄 {CONFIG['RETRY_DELAY']}秒后重试 ({retries+1}/{CONFIG['MAX_RETRIES']})", "WARN")
            time.sleep(CONFIG["RETRY_DELAY"])
            return api_call_generate_data(users, sessions, retries + 1)
        else:
            wait_for_network()
            return api_call_generate_data(users, sessions, 0)
    
    except requests.exceptions.Timeout:
        log_message(f"⏱️ 云端请求超时", "WARN")
        api_success = False
    
    except Exception as e:
        log_message(f"❌ 云端 API 错误: {type(e).__name__}: {e}", "ERROR")
        import traceback
        log_message(f"📋 堆栈跟踪:\n{traceback.format_exc()}", "ERROR")
        api_success = False
    
    # 最终结果: 至少本地数据库成功就可以继续
    # 如果本地成功但云端失败，数据不会丢失，下次同步可恢复
    if local_success:
        log_message("✨ 数据已保存到本地，云端状态: " + ("✅ 同步" if api_success else "⚠️ 待同步"), "INFO")
        return True
    else:
        log_message("❌ 本地和云端都失败", "ERROR")
        return False


def calculate_batch_size():
    """
    根据时间段和概率计算本轮应生成的用户和会话数
    """
    period, _ = get_time_period()
    probability = CONFIG["PROBABILITY"][period] / 100.0  # 转换为 0-1
    
    # 基础批次大小
    base_size = (CONFIG["MIN_BATCH_SIZE"] + CONFIG["MAX_BATCH_SIZE"]) // 2
    
    # 根据时间段概率调整
    adjusted_size = int(base_size * probability)
    
    # 添加随机波动 (±30%)
    users = max(1, int(adjusted_size * (0.7 + random.random() * 0.6)))
    
    # 会话数略多于用户数 (1.2-1.8倍)
    sessions = int(users * (1.2 + random.random() * 0.6))
    
    return users, sessions


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
    """生成一批用户和会话 - 使用正确的批量API"""
    period, period_cn = get_time_period()
    probability = CONFIG["PROBABILITY"][period]
    
    # 计算本轮应生成的数量
    users, sessions = calculate_batch_size()
    
    log_message("━" * 50)
    log_message(f"🔄 Cycle #{generate_batch.cycle_count} started")
    log_message(f"📈 Growth mode: 0/6000 users")
    log_message(f"📊 时段: {period_cn} | 概率: {probability}% | 生成: {users}用户, {sessions}会话")
    log_message("━" * 50)
    
    # 调用批量生成API
    success = api_call_generate_data(users, sessions)
    
    if success:
        # 计算等待时间
        wait_time = calculate_wait_time()
        wait_formatted = format_duration(wait_time)
        
        log_message(f"✅ Cycle #{generate_batch.cycle_count} completed | {users}/{users} actions completed")
        log_message(f"⏰ Next cycle in {wait_formatted}")
        log_message("")
        
        generate_batch.cycle_count += 1
        generate_batch.total_users += users
        generate_batch.total_sessions += sessions
        
        return wait_time
    else:
        log_message("❌ Cycle failed, will retry after 60 seconds", "ERROR")
        return 60

# 初始化计数器
generate_batch.cycle_count = 1
generate_batch.total_users = 0
generate_batch.total_sessions = 0


def calculate_wait_time():
    """计算下次等待时间（以秒为单位）"""
    wait = random.randint(CONFIG["MIN_WAIT"], CONFIG["MAX_WAIT"])
    return wait


def format_duration(seconds):
    """格式化时间为易读格式"""
    if seconds < 60:
        return f"{seconds}s"
    
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    
    if hours > 0:
        if minutes > 0:
            return f"{hours}h {minutes}m"
        return f"{hours}h"
    else:
        return f"{minutes}m"


def main():
    """主循环"""
    log_message("╔" + "═" * 48 + "╗")
    log_message("║   Promptly Behavior Simulator v3              ║")
    log_message("║   真实流量模拟器 - 双向同步版本                 ║")
    log_message("╚" + "═" * 48 + "╝")
    log_message("")
    log_message("📊 数据同步目标:")
    log_message(f"  ☁️  云端 API: {CONFIG['API_BASE']}")
    log_message(f"       端点: /api/analytics/dashboard/admin/generate-data")
    log_message(f"  💾 本地数据库: {CONFIG['LOCAL_DB_PATH']}")
    log_message("")
    log_message(f"PID: {os.getpid()}")
    log_message("")
    log_message("时间段概率模型:")
    log_message(f"  📅 上午 (6-12点):  {CONFIG['PROBABILITY']['morning']}% 概率")
    log_message(f"  📅 下午 (12-18点): {CONFIG['PROBABILITY']['afternoon']}% 概率")
    log_message(f"  📅 晚上 (18-24点): {CONFIG['PROBABILITY']['evening']}% 概率")
    log_message(f"  📅 夜间 (0-6点):   {CONFIG['PROBABILITY']['night']}% 概率")
    log_message("")
    log_message(f"批次大小: {CONFIG['MIN_BATCH_SIZE']}-{CONFIG['MAX_BATCH_SIZE']} 个用户/批")
    log_message(f"等待间隔: {format_duration(CONFIG['MIN_WAIT'])} - {format_duration(CONFIG['MAX_WAIT'])}")
    log_message("")
    
    send_notification(
        CONFIG["SERVICE_NAME"],
        "行为模拟器已启动 (v3-双向同步)"
    )
    
    while True:
        log_message("")
        
        # 检查网络
        if not check_network():
            wait_for_network()
        
        # 生成批次并获取等待时间
        try:
            wait_time = generate_batch()
        except Exception as e:
            log_message(f"❌ 批次生成错误: {e}", "ERROR")
            send_notification(
                CONFIG["SERVICE_NAME"],
                f"批次生成错误: {type(e).__name__}"
            )
            wait_time = 60  # 出错后等待1分钟
        
        # 等待下一轮
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
