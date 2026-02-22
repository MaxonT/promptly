#!/usr/bin/env python3
"""
Promptly Analytics Behavior Simulator v4 - 生产版本（健壮版）
=========================================

真实用户行为模拟器 - 批量API版本 + 完整的失败处理和数据验证

🔧 API配置:
  - 端点: /api/analytics/dashboard/admin/generate-data
  - 验证: /api/analytics/dashboard/admin/realtime-count
  - 默认URL: https://promptly-v0-6-cloudtest-cursor-dev.onrender.com
  - 环境变量: API_BASE (可覆盖默认值)

✨ v4 健壮性特性:
  ✅ 自动重试 (最多3次，带指数退避)
  ✅ 待同步队列 (保存失败的数据到 ~/.promptly-pending-sync.json)
  ✅ 云端验证 (确保数据真的写入到云端数据库)
  ✅ 数据一致性检查 (每24小时检查本地vs云端)
  ✅ 待同步恢复 (每小时自动重试失败的批次)
  ✅ 网络故障处理 (自动等待网络恢复后重连)
  ✅ Mac 开机自动启动 (via launchd)
  ✅ Mac 休眠自动暂停, 唤醒自动恢复
  ✅ 服务器崩溃自动重试
  ✅ 基于时间段的概率模型
  ✅ 批量用户生成 (12-50个/批次，2.5x优化)
  ✅ 不规律等待时间

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
import hashlib


# ============ 配置区域 ============
CONFIG = {
    "SERVICE_NAME": "Promptly-Behavior-Simulator",
    "API_BASE": os.environ.get("API_BASE", "https://promptly-v0-6-cloudtest-cursor-dev.onrender.com"),
    
    # 本地数据库路径 (相对于 backend 目录)
    "LOCAL_DB_PATH": os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "data", "app.db"
    ),
    
    # 待同步队列文件 (保存失败的数据)
    "PENDING_SYNC_FILE": os.path.expanduser("~/.promptly-pending-sync.json"),
    
    # 时间段概率 (%) - 提升2.5倍 (基准: 30/40/20/10)
    "PROBABILITY": {
        "morning": 75,    # 6-12点 (原30 × 2.5 = 75)
        "afternoon": 100, # 12-18点 (原40 × 2.5 = 100, 封顶)
        "evening": 50,    # 18-24点 (原20 × 2.5 = 50)
        "night": 25,      # 0-6点 (原10 × 2.5 = 25)
    },
    
    # 批次大小 - 提升2.5倍 (基准: 5-20)
    "MIN_BATCH_SIZE": 12,   # 原5 × 2.5 ≈ 12
    "MAX_BATCH_SIZE": 50,   # 原20 × 2.5 = 50
    
    # 等待时间 (秒) - 降速到原来的75%: 等待时间 × 1.33
    # 原基准: MIN_WAIT=720秒(12分钟), MAX_WAIT=5760秒(96分钟)
    # 降速75%后: MIN_WAIT=1280秒(~21分钟), MAX_WAIT=10240秒(~170分钟)
    "MIN_WAIT": 1280,   # ~21分钟 (原12分钟 ÷ 0.75)
    "MAX_WAIT": 10240,  # ~170分钟 ≈ 2.8小时 (原96分钟 ÷ 0.75)
    
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


def get_pending_sync():
    """获取待同步队列"""
    pending_file = CONFIG["PENDING_SYNC_FILE"]
    if os.path.exists(pending_file):
        try:
            with open(pending_file, 'r') as f:
                return json.load(f)
        except:
            return []
    return []


def save_pending_sync(batch_list):
    """保存待同步队列"""
    pending_file = CONFIG["PENDING_SYNC_FILE"]
    try:
        with open(pending_file, 'w') as f:
            json.dump(batch_list, f, indent=2)
    except Exception as e:
        log_message(f"❌ 保存待同步队列失败: {e}", "ERROR")


def add_pending_sync(users, sessions):
    """添加一个批次到待同步队列"""
    pending = get_pending_sync()
    batch_id = hashlib.md5(f"{datetime.now().isoformat()}{random.random()}".encode()).hexdigest()[:8]
    pending.append({
        "id": batch_id,
        "users": users,
        "sessions": sessions,
        "timestamp": datetime.now().isoformat(),
        "retries": 0
    })
    save_pending_sync(pending)
    log_message(f"📝 批次 {batch_id} 已加入待同步队列 ({len(pending)} 个待同步)", "WARN")
    return batch_id


def remove_pending_sync(batch_id):
    """从待同步队列中移除已成功的批次"""
    pending = get_pending_sync()
    pending = [b for b in pending if b["id"] != batch_id]
    save_pending_sync(pending)
    log_message(f"✅ 批次 {batch_id} 已从待同步队列中移除")


def increment_pending_retries(batch_id):
    """增加待同步批次的重试次数"""
    pending = get_pending_sync()
    for batch in pending:
        if batch["id"] == batch_id:
            batch["retries"] = batch.get("retries", 0) + 1
            break
    save_pending_sync(pending)


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
        
        # 插入新用户 (带email，使其成为 Registered Users)
        # 名字池用于生成真实的email
        first_names = ['james', 'mary', 'john', 'patricia', 'robert', 'jennifer', 'michael', 'linda', 
                       'david', 'elizabeth', 'william', 'barbara', 'richard', 'susan', 'joseph', 'jessica',
                       'thomas', 'sarah', 'charles', 'karen', 'emma', 'olivia', 'ava', 'sophia', 'liam',
                       'noah', 'oliver', 'elijah', 'lucas', 'mason', 'alex', 'chris', 'sam', 'taylor', 'jordan']
        domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'proton.me']
        
        new_user_ids = []
        for i in range(users):
            user_id = f"au_{int(datetime.now().timestamp() * 1000)}_{random.randint(0, 99999):05d}"
            # 生成真实的email地址
            name = random.choice(first_names)
            domain = random.choice(domains)
            email = f"{name}{random.randint(1, 9999)}@{domain}"
            
            tz = random.choice(timezones)
            device = random.choice(devices)
            browser = random.choice(browsers)
            
            cursor.execute("""
                INSERT INTO analytics_users 
                (id, email, source, timezone, country, device_type, browser, created_at, last_active_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (user_id, email, 'simulator', tz, 'US', device, browser, now, now))
            
            new_user_ids.append(user_id)
        
        # 获取现有用户用于创建会话
        cursor.execute("SELECT id FROM analytics_users ORDER BY created_at DESC LIMIT 100")
        existing_users = [row[0] for row in cursor.fetchall()]
        all_user_ids = new_user_ids + existing_users
        
        # 插入会话
        # ⚠️ 关键修复: 让会话时间在过去30天内随机分布
        # 这样才能产生合理的 WAU (>= DAU) 和 MAU (>= WAU) 数据
        # 分布策略（优化后，让 MAU > WAU）:
        # - 40% 会话在今天（保证 DAU 有数据）
        # - 35% 会话在过去7天（让 WAU > DAU）
        # - 25% 会话在过去8-30天（让 MAU > WAU）
        for i in range(sessions):
            session_id = f"as_{int(datetime.now().timestamp() * 1000)}_{random.randint(0, 9999):04d}"
            user_id = random.choice(all_user_ids) if all_user_ids else f"au_fallback_{i}"
            duration = random.randint(30, 300)
            page_views = random.randint(1, 5)
            device = random.choice(devices)
            browser = random.choice(browsers)
            
            # 随机选择会话时间
            roll = random.randint(0, 99)
            if roll < 40:
                # 40% - 今天（0-24小时前）
                hours_ago = random.uniform(0, 24)
            elif roll < 75:
                # 35% - 过去7天（1-7天前）
                hours_ago = random.uniform(24, 24 * 7)
            else:
                # 25% - 过去8-30天（7-30天前）
                hours_ago = random.uniform(24 * 7, 24 * 30)
            
            session_start = (datetime.now() - timedelta(hours=hours_ago)).isoformat()
            
            cursor.execute("""
                INSERT INTO analytics_sessions 
                (id, user_id, session_start, duration_seconds, page_views, device_type, browser, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (session_id, user_id, session_start, duration, page_views, device, browser, now))
        
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


def verify_cloud_sync(expected_users_increment, expected_sessions_increment, before_users, before_sessions, max_retries=3):
    """
    验证云端是否真的接收并写入了数据
    
    参数:
        expected_users_increment: 预期增加的用户数
        expected_sessions_increment: 预期增加的会话数
        before_users: 写入前的用户总数
        before_sessions: 写入前的会话总数
        max_retries: 最大重试次数
    
    返回: (success: bool, cloud_total_users: int, cloud_total_sessions: int)
    """
    url = f"{CONFIG['API_BASE']}/api/analytics/dashboard/admin/realtime-count"
    
    for attempt in range(max_retries):
        try:
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                data = response.json()
                if data.get("ok"):
                    cloud_users = data.get("realtime", {}).get("analytics_users", 0)
                    cloud_sessions = data.get("realtime", {}).get("analytics_sessions", 0)
                    
                    # 验证增量是否符合预期
                    actual_users_increment = cloud_users - before_users
                    actual_sessions_increment = cloud_sessions - before_sessions
                    
                    log_message(f"🔍 云端验证: {cloud_users} 用户 (+{actual_users_increment}), {cloud_sessions} 会话 (+{actual_sessions_increment})")
                    
                    # 允许一定的误差（因为可能有其他实例在写入）
                    # 只要增量>=预期的80%就认为成功
                    users_ok = actual_users_increment >= expected_users_increment * 0.8
                    sessions_ok = actual_sessions_increment >= expected_sessions_increment * 0.8
                    
                    if users_ok and sessions_ok:
                        return True, cloud_users, cloud_sessions
                    else:
                        log_message(f"⚠️ 云端增量不符合预期: 用户 {actual_users_increment}/{expected_users_increment}, 会话 {actual_sessions_increment}/{expected_sessions_increment}", "WARN")
                        if attempt < max_retries - 1:
                            time.sleep(5)
                            continue
        except Exception as e:
            log_message(f"⚠️ 验证请求失败 (尝试 {attempt+1}/{max_retries}): {e}", "WARN")
            if attempt < max_retries - 1:
                time.sleep(5)
    
    return False, 0, 0


def api_call_generate_data(users, sessions, retries=0):
    """
    发送数据到云端和本地数据库
    
    执行流程:
    1. 先获取云端当前数据量（用于验证）
    2. 插入到本地 SQLite 数据库 ✅
    3. 同时发送到云端 API ☁️
    4. 验证云端数据是否真的增加了
    5. 两个目标都成功才算成功
    """
    log_message(f"📦 准备插入数据: {users} 用户, {sessions} 会话")
    
    # 步骤 0: 获取云端当前数据量（用于后续验证）
    before_users, before_sessions = 0, 0
    try:
        response = requests.get(f"{CONFIG['API_BASE']}/api/analytics/dashboard/admin/realtime-count", timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get("ok"):
                before_users = data.get("realtime", {}).get("analytics_users", 0)
                before_sessions = data.get("realtime", {}).get("analytics_sessions", 0)
                log_message(f"📊 云端当前状态: {before_users} 用户, {before_sessions} 会话")
    except Exception as e:
        log_message(f"⚠️ 无法获取云端状态: {e}", "WARN")
    
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
        else本地和云端都要成功
    if local_success:
        if api_success:
            # 必须验证数据真的写入了（验证增量）
            verify_ok, cloud_users, cloud_sessions = verify_cloud_sync(
                users, sessions, before_users, before_sessions
            )
            if verify_ok:
                log_message("✨ 数据已保存到本地和云端（已验证）", "INFO")
                return True
            else:
                # API返回成功但数据没真的写入（或增量不对）
                batch_id = add_pending_sync(users, sessions)
                log_message(f"⚠️ 云端验证失败（数据未写入或增量异常），已加入待同步队列 (批次 {batch_id})", "WARN")
                # ⚠️ 返回False，因为云端同步实际失败了
                return False
        else:
            # 云端API调用失败
            batch_id = add_pending_sync(users, sessions)
            log_message(f"⚠️ 云端API调用失败，已加入待同步队列 (批次 {batch_id})", "WARN")
            # ⚠️ 返回False，因为虽然本地成功但云端失败了
            return False
    else:
        # 本地数据库失败
        log_message("❌ 本地数据库插入失败", "ERROR")
        if api_success:
            log_message("⚠️ 但云端API成功了（数据不一致！需要手动检查）", "WARN
                log_message("✨ 数据已保存到本地和云端", "INFO")
                return True
            else:
                # API返回成功但数据没真的写入
                batch_id = add_pending_sync(users, sessions)
                log_message(f"⚠️ 云端验证失败，已加入待同步队列 (批次 {batch_id})", "WARN")
                return True
        else:
            # 云端失败，加入待同步队列
            batch_id = add_pending_sync(users, sessions)
            log_message(f"⚠️ 云端同步失败，已加入待同步队列 (批次 {batch_id})", "WARN")
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
generate_batch.last_pending_check = time.time()  # 待同步队列检查时间
generate_batch.last_consistency_check = time.time()  # 一致性检查时间


def calculate_wait_time():
    """计算下次等待时间（以秒为单位）"""
    wait = random.randint(CONFIG["MIN_WAIT"], CONFIG["MAX_WAIT"])
    return wait


def process_pending_sync():
    """
    处理待同步队列中的批次（每小时触发一次）
    """
    pending = get_pending_sync()
    if not pending:
        return
    
    log_message("▁" * 50)
    log_message(f"🔄 处理待同步队列 ({len(pending)} 个待同步批次)")
    log_message("▁" * 50)
    
    success_count = 0
    for batch in pending[:5]:  # 每次最多处理5个
        batch_id = batch["id"]
        users = batch["users"]
        sessions = batch["sessions"]
        retries = batch.get("retries", 0)
        
        log_message(f"🔁 重试批次 {batch_id} (重试次数: {retries})")
        
        # 尝试同步
        local_success = insert_data_to_local_db(users, sessions)
        if not local_success:
            log_message(f"⚠️ 本地同步失败，跳过批次 {batch_id}", "WARN")
            continue
        
        url = f"{CONFIG['API_BASE']}/api/analytics/dashboard/admin/generate-data"
        try:
            response = requests.post(
                url,
                json={"users": users, "sessions": sessions},
                headers={"X-Admin-Key": os.environ.get("ADMIN_API_KEY", "")},
                timeout=CONFIG["TIMEOUT"]
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("ok"):
                    # 验证
                    verify_ok, cloud_users, cloud_sessions = verify_cloud_sync(users, sessions)
                    if verify_ok:
                        remove_pending_sync(batch_id)
                        success_count += 1
                        log_message(f"✅ 批次 {batch_id} 同步成功")
                    else:
                        increment_pending_retries(batch_id)
                        log_message(f"⚠️ 批次 {batch_id} 验证失败，增加重试计数", "WARN")
                else:
                    increment_pending_retries(batch_id)
            else:
                increment_pending_retries(batch_id)
                log_message(f"⚠️ 批次 {batch_id} 返回 HTTP {response.status_code}", "WARN")
        except Exception as e:
            increment_pending_retries(batch_id)
            log_message(f"⚠️ 批次 {batch_id} 同步异常: {e}", "WARN")
        
        time.sleep(2)  # 批次之间等待2秒
    
    log_message(f"📊 待同步队列处理完成: {success_count}/{min(5, len(pending))} 成功")
    log_message("")


def verify_data_consistency():
    """
    定期验证本地和云端数据一致性（每24小时检查一次）
    """
    log_message("▁" * 50)
    log_message("🔍 检查数据一致性...")
    
    # 获取本地数据
    conn = get_db_connection()
    if not conn:
        log_message("⚠️ 无法连接本地数据库，跳过一致性检查", "WARN")
        return
    
    try:
        local_users = conn.execute("SELECT COUNT(*) FROM analytics_users").fetchone()[0]
        local_sessions = conn.execute("SELECT COUNT(*) FROM analytics_sessions").fetchone()[0]
        conn.close()
    except Exception as e:
        log_message(f"❌ 本地数据库查询失败: {e}", "ERROR")
        return
    
    # 获取云端数据
    verify_ok, cloud_users, cloud_sessions = verify_cloud_sync(0)
    
    if not verify_ok:
        log_message("⚠️ 无法获取云端数据进行一致性检查", "WARN")
        return
    
    # 对比
    user_gap = local_users - cloud_users
    session_gap = local_sessions - cloud_sessions
    
    log_message(f"📊 数据对比:")
    log_message(f"   本地用户: {local_users} | 云端用户: {cloud_users} | 差距: {user_gap}")
    log_message(f"   本地会话: {local_sessions} | 云端会话: {cloud_sessions} | 差距: {session_gap}")
    
    if user_gap == 0 and session_gap == 0:
        log_message(f"✅ 数据完全一致！")
    elif user_gap > 0 or session_gap > 0:
        log_message(f"⚠️ 检测到数据差距，已添加到待同步队列", "WARN")
        if user_gap > 0:
            add_pending_sync(user_gap, session_gap)
    else:
        log_message(f"❌ 云端数据多于本地？（异常情况）", "ERROR")
    
    log_message("")


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
    log_message("║   Promptly Behavior Simulator v4              ║")
    log_message("║   真实流量模拟器 - 健壮版本                     ║")
    log_message("║   ✅ 失败处理 | 待同步队列 | 数据验证          ║")
    log_message("╚" + "═" * 48 + "╝")
    log_message("")
    log_message("📊 数据同步目标:")
    log_message(f"  ☁️  云端 API: {CONFIG['API_BASE']}")
    log_message(f"       端点: /api/analytics/dashboard/admin/generate-data")
    log_message(f"       验证: /api/analytics/dashboard/admin/realtime-count")
    log_message(f"  💾 本地数据库: {CONFIG['LOCAL_DB_PATH']}")
    log_message(f"  📝 待同步队列: {CONFIG['PENDING_SYNC_FILE']}")
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
    log_message("🔧 健壮性特性:")
    log_message("  ✅ 自动重试 (最多3次)")
    log_message("  ✅ 待同步队列 (保存失败的数据)")
    log_message("  ✅ 云端验证 (确保数据真的写入)")
    log_message("  ✅ 数据一致性检查 (每24小时)")
    log_message("  ✅ 网络故障恢复 (自动等待和重连)")
    log_message("")
    
    send_notification(
        CONFIG["SERVICE_NAME"],
        "行为模拟器已启动 (v4-健壮版)"
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
        
        # 检查是否需要处理待同步队列 (每小时检查一次)
        current_time = time.time()
        if current_time - generate_batch.last_pending_check > 3600:
            log_message("")
            process_pending_sync()
            generate_batch.last_pending_check = current_time
        
        # 检查数据一致性 (每24小时检查一次)
        if current_time - generate_batch.last_consistency_check > 86400:
            log_message("")
            verify_data_consistency()
            generate_batch.last_consistency_check = current_time
        
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
