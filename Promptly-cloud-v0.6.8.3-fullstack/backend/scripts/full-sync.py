#!/usr/bin/env python3
"""
Promptly Analytics - 完整数据同步工具 v2
========================================

🎯 用途: 解决本地与云端数据不一致的问题

📊 同步策略:
   1. 获取本地和云端的完整数据统计
   2. 比较差异
   3. 将本地完整数据强制同步到云端 (全量覆盖)
   4. 验证同步结果

⚠️  注意事项:
   - 此脚本以本地数据为准，会覆盖云端
   - 部署后数据库会被重置，需要运行此脚本恢复
   - 运行前确保 behavior-simulator.py 已停止

使用方式:
   cd backend && python3 scripts/full-sync.py
   
   # 仅检查（不执行同步）
   cd backend && python3 scripts/full-sync.py --check-only
   
   # 强制同步（不询问）
   cd backend && python3 scripts/full-sync.py --force
"""

import sqlite3
import requests
import json
import sys
import os
from datetime import datetime

# ============ 配置 ============
CONFIG = {
    "LOCAL_DB": os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "data", "app.db"
    ),
    "CLOUD_URL": os.environ.get(
        "CLOUD_URL", 
        "https://promptly-v0-6-cloudtest-cursor-dev.onrender.com"
    ),
    "BATCH_SIZE": 200,  # 每批发送的记录数
    "TIMEOUT": 60,      # 请求超时时间
}

# 颜色输出
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    CYAN = '\033[96m'
    BOLD = '\033[1m'
    END = '\033[0m'

def c(text, color):
    return f"{color}{text}{Colors.END}"

def log_header(text):
    print(f"\n{c('═' * 60, Colors.CYAN)}")
    print(f"{c(text.center(60), Colors.BOLD + Colors.CYAN)}")
    print(f"{c('═' * 60, Colors.CYAN)}")

def log_section(text):
    print(f"\n{c('▸ ' + text, Colors.BOLD)}")

def log_success(text):
    print(f"  {c('✓', Colors.GREEN)} {text}")

def log_warning(text):
    print(f"  {c('⚠', Colors.YELLOW)} {text}")

def log_error(text):
    print(f"  {c('✗', Colors.RED)} {text}")

def log_info(text):
    print(f"  • {text}")


def get_local_stats():
    """获取本地数据库统计"""
    try:
        conn = sqlite3.connect(CONFIG["LOCAL_DB"])
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        stats = {}
        
        # 用户数
        cursor.execute("SELECT COUNT(*) as count FROM analytics_users")
        stats["users"] = cursor.fetchone()["count"]
        
        # 会话数
        cursor.execute("SELECT COUNT(*) as count FROM analytics_sessions")
        stats["sessions"] = cursor.fetchone()["count"]
        
        # 每日统计数
        cursor.execute("SELECT COUNT(*) as count FROM analytics_daily")
        stats["daily_records"] = cursor.fetchone()["count"]
        
        # 最新累计用户
        cursor.execute("""
            SELECT date, cumulative_users, unique_users, new_users, total_sessions
            FROM analytics_daily ORDER BY date DESC LIMIT 1
        """)
        latest = cursor.fetchone()
        if latest:
            stats["latest_date"] = latest["date"]
            stats["cumulative_users"] = latest["cumulative_users"]
            stats["today_users"] = latest["unique_users"]
            stats["today_sessions"] = latest["total_sessions"]
        
        conn.close()
        return stats
    
    except Exception as e:
        log_error(f"本地数据库连接失败: {e}")
        return None


def get_cloud_stats():
    """获取云端数据统计"""
    try:
        url = f"{CONFIG['CLOUD_URL']}/api/analytics/dashboard/admin/realtime-count"
        response = requests.get(url, timeout=15)
        
        if response.status_code != 200:
            log_error(f"云端API返回 {response.status_code}")
            return None
        
        data = response.json()
        if not data.get("ok"):
            log_error(f"云端API错误: {data.get('error')}")
            return None
        
        realtime = data.get("realtime", {})
        latest = data.get("latestDaily", {})
        
        return {
            "users": realtime.get("analytics_users", 0),
            "sessions": realtime.get("analytics_sessions", 0),
            "daily_records": realtime.get("analytics_daily_records", 0),
            "latest_date": latest.get("date"),
            "cumulative_users": latest.get("cumulative_users", 0),
            "today_users": latest.get("unique_users", 0),
            "today_sessions": latest.get("total_sessions", 0),
        }
    
    except Exception as e:
        log_error(f"云端连接失败: {e}")
        return None


def export_local_data():
    """导出本地数据库的所有analytics数据"""
    try:
        conn = sqlite3.connect(CONFIG["LOCAL_DB"])
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        data = {}
        
        # 导出用户
        cursor.execute("SELECT * FROM analytics_users")
        data["users"] = [dict(row) for row in cursor.fetchall()]
        
        # 导出会话
        cursor.execute("SELECT * FROM analytics_sessions")
        data["sessions"] = [dict(row) for row in cursor.fetchall()]
        
        # 导出行为数据（如果存在）
        try:
            cursor.execute("SELECT * FROM analytics_behavior")
            data["behavior"] = [dict(row) for row in cursor.fetchall()]
        except:
            data["behavior"] = []
        
        # 导出每日统计
        cursor.execute("SELECT * FROM analytics_daily")
        data["daily"] = [dict(row) for row in cursor.fetchall()]
        
        conn.close()
        return data
    
    except Exception as e:
        log_error(f"导出本地数据失败: {e}")
        return None


def send_batch_to_cloud(payload, batch_type=""):
    """发送一批数据到云端"""
    try:
        url = f"{CONFIG['CLOUD_URL']}/api/admin/sync-data?_skip_validation=true"
        
        response = requests.post(
            url,
            json=payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {os.environ.get('SYNC_TOKEN', '')}",
                "X-Skip-Validation": "true"
            },
            timeout=CONFIG["TIMEOUT"]
        )
        
        if response.status_code != 200:
            log_error(f"{batch_type} 同步失败: HTTP {response.status_code}")
            return False
        
        result = response.json()
        if not result.get("ok"):
            log_error(f"{batch_type} 同步失败: {result.get('error')}")
            return False
        
        return True
    
    except Exception as e:
        log_error(f"{batch_type} 同步异常: {e}")
        return False


def clear_cloud_data():
    """清空云端数据（准备全量同步）"""
    try:
        url = f"{CONFIG['CLOUD_URL']}/api/admin/clear-analytics"
        response = requests.post(url, timeout=30, headers={
            "Authorization": f"Bearer {os.environ.get('SYNC_TOKEN', '')}"
        })
        
        if response.status_code == 200:
            result = response.json()
            if result.get("ok"):
                log_success("云端数据已清空")
                return True
            else:
                log_warning(f"清空返回错误: {result.get('error')}")
                return False
        elif response.status_code == 404:
            log_warning("清空端点未部署，将使用增量覆盖模式")
            log_info("建议: 部署最新代码后重新运行此脚本")
            return False  # 返回 False 表示使用增量模式
        else:
            log_warning(f"清空云端数据失败: HTTP {response.status_code}")
            return False
    except Exception as e:
        log_warning(f"清空请求失败: {e}")
        return False


def sync_to_cloud(data):
    """
    分批同步数据到云端
    
    使用 INSERT OR REPLACE 策略，相同 ID 会被覆盖
    """
    batch_size = CONFIG["BATCH_SIZE"]
    success = True
    
    # 同步用户数据
    users = data.get("users", [])
    if users:
        log_info(f"同步 {len(users)} 条用户记录...")
        for i in range(0, len(users), batch_size):
            batch = users[i:i + batch_size]
            if not send_batch_to_cloud({"analytics": {"users": batch}}, "用户"):
                success = False
            progress = min(i + batch_size, len(users))
            print(f"      [{progress}/{len(users)}]", end="\r")
        print()
    
    # 同步会话数据
    sessions = data.get("sessions", [])
    if sessions:
        log_info(f"同步 {len(sessions)} 条会话记录...")
        for i in range(0, len(sessions), batch_size):
            batch = sessions[i:i + batch_size]
            if not send_batch_to_cloud({"analytics": {"sessions": batch}}, "会话"):
                success = False
            progress = min(i + batch_size, len(sessions))
            print(f"      [{progress}/{len(sessions)}]", end="\r")
        print()
    
    # 同步行为数据
    behavior = data.get("behavior", [])
    if behavior:
        log_info(f"同步 {len(behavior)} 条行为记录...")
        for i in range(0, len(behavior), batch_size):
            batch = behavior[i:i + batch_size]
            if not send_batch_to_cloud({"analytics": {"behavior": batch}}, "行为"):
                success = False
    
    # 同步每日统计
    daily = data.get("daily", [])
    if daily:
        log_info(f"同步 {len(daily)} 条每日统计...")
        if not send_batch_to_cloud({"analytics": {"daily": daily}}, "每日统计"):
            success = False
    
    return success


def main():
    args = sys.argv[1:]
    check_only = "--check-only" in args
    force = "--force" in args
    
    log_header("Promptly Analytics 完整数据同步工具")
    
    print(f"\n📍 本地数据库: {CONFIG['LOCAL_DB']}")
    print(f"☁️  云端服务器: {CONFIG['CLOUD_URL']}")
    print(f"📅 执行时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    # ============ 步骤 1: 获取本地统计 ============
    log_section("步骤 1/4: 检查本地数据")
    
    local_stats = get_local_stats()
    if not local_stats:
        log_error("无法获取本地数据统计")
        return 1
    
    log_success(f"用户数: {local_stats['users']}")
    log_success(f"会话数: {local_stats['sessions']}")
    log_success(f"每日统计: {local_stats['daily_records']} 天")
    if local_stats.get("latest_date"):
        log_info(f"最新日期: {local_stats['latest_date']} (累计 {local_stats.get('cumulative_users', 0)} 用户)")
    
    # ============ 步骤 2: 获取云端统计 ============
    log_section("步骤 2/4: 检查云端数据")
    
    cloud_stats = get_cloud_stats()
    if not cloud_stats:
        log_warning("无法获取云端数据统计（可能服务器正在启动）")
        if check_only:
            return 1
    else:
        log_success(f"用户数: {cloud_stats['users']}")
        log_success(f"会话数: {cloud_stats['sessions']}")
        log_success(f"每日统计: {cloud_stats['daily_records']} 天")
        if cloud_stats.get("latest_date"):
            log_info(f"最新日期: {cloud_stats['latest_date']} (累计 {cloud_stats.get('cumulative_users', 0)} 用户)")
    
    # ============ 步骤 3: 比较差异 ============
    log_section("步骤 3/4: 分析数据差异")
    
    if cloud_stats:
        user_diff = local_stats["users"] - cloud_stats["users"]
        session_diff = local_stats["sessions"] - cloud_stats["sessions"]
        
        print(f"\n  {'指标':<12} {'本地':<10} {'云端':<10} {'差异':<10}")
        print(f"  {'-'*44}")
        print(f"  {'用户数':<10} {local_stats['users']:<10} {cloud_stats['users']:<10} {user_diff:+}")
        print(f"  {'会话数':<10} {local_stats['sessions']:<10} {cloud_stats['sessions']:<10} {session_diff:+}")
        print(f"  {'每日统计':<10} {local_stats['daily_records']:<10} {cloud_stats['daily_records']:<10}")
        
        if user_diff == 0 and session_diff == 0:
            log_success("\n数据完全一致! 无需同步。")
            return 0
        elif user_diff > 0 or session_diff > 0:
            log_warning(f"\n本地数据较多 - 建议同步到云端")
        else:
            log_warning(f"\n云端数据较多 - 可能存在重复数据")
    else:
        log_warning("无法比较（云端不可用），将尝试全量同步")
    
    if check_only:
        print(f"\n{c('仅检查模式，不执行同步', Colors.YELLOW)}")
        return 0
    
    # ============ 确认同步 ============
    if not force:
        print(f"\n{c('⚠️  即将执行全量同步 (本地 → 云端)', Colors.YELLOW)}")
        print("   这将覆盖云端所有数据，以本地数据为准")
        confirm = input("   确认执行？(y/N): ").strip().lower()
        if confirm != 'y':
            print("已取消同步")
            return 0
    
    # ============ 步骤 4: 执行同步 ============
    log_section("步骤 4/4: 执行全量同步")
    
    log_info("导出本地数据...")
    data = export_local_data()
    if not data:
        log_error("导出本地数据失败")
        return 1
    
    log_success(f"导出完成: {len(data['users'])} 用户, {len(data['sessions'])} 会话")
    
    log_info("清空云端旧数据...")
    clear_cloud_data()
    
    log_info("开始同步...")
    start_time = datetime.now()
    
    if sync_to_cloud(data):
        elapsed = (datetime.now() - start_time).total_seconds()
        log_success(f"同步完成! 耗时 {elapsed:.1f} 秒")
    else:
        log_error("同步过程中出现错误")
    
    # ============ 验证结果 ============
    log_section("验证同步结果")
    
    cloud_stats_after = get_cloud_stats()
    if cloud_stats_after:
        log_success(f"云端用户: {cloud_stats_after['users']}")
        log_success(f"云端会话: {cloud_stats_after['sessions']}")
        
        if cloud_stats_after['users'] >= local_stats['users']:
            log_success("✨ 数据同步验证通过!")
        else:
            log_warning("云端数据少于本地，可能部分同步失败")
    else:
        log_warning("无法验证云端数据")
    
    print(f"\n{c('═' * 60, Colors.CYAN)}")
    print(f"{c('同步完成'.center(60), Colors.BOLD + Colors.GREEN)}")
    print(f"{c('═' * 60, Colors.CYAN)}\n")
    
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n已取消")
        sys.exit(1)
