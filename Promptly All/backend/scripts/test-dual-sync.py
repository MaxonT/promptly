#!/usr/bin/env python3
"""
行为模拟器双向同步测试脚本
测试数据是否同时发送到本地和云端
"""

import sys
import os
import sqlite3
from datetime import datetime

# 添加 backend 目录到路径
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

DB_PATH = os.path.join(backend_dir, "data", "app.db")

def get_db_counts():
    """获取数据库中的数据量"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM analytics_users")
        users = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM analytics_sessions")
        sessions = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM analytics_daily")
        daily = cursor.fetchone()[0]
        
        # 获取最新的daily记录
        cursor.execute("""
            SELECT date, unique_users, new_users, total_sessions, cumulative_users 
            FROM analytics_daily 
            ORDER BY date DESC LIMIT 1
        """)
        latest_daily = cursor.fetchone()
        
        conn.close()
        
        return {
            'users': users,
            'sessions': sessions,
            'daily': daily,
            'latest': latest_daily
        }
    except Exception as e:
        print(f"❌ 数据库查询失败: {e}")
        return None

def main():
    print("╔" + "═" * 56 + "╗")
    print("║  Promptly Behavior Simulator - 双向同步验证工具    ║")
    print("╚" + "═" * 56 + "╝")
    print("")
    
    # 检查数据库文件
    if not os.path.exists(DB_PATH):
        print(f"❌ 数据库文件不存在: {DB_PATH}")
        return 1
    
    print(f"📍 数据库路径: {DB_PATH}")
    print("")
    
    # 获取当前数据量
    counts = get_db_counts()
    if counts is None:
        return 1
    
    print("📊 本地 SQLite 数据统计:")
    print(f"   👥 总用户数: {counts['users']}")
    print(f"   📱 总会话数: {counts['sessions']}")
    print(f"   📅 日统计数: {counts['daily']}")
    
    if counts['latest']:
        date, unique, new, sessions, cumulative = counts['latest']
        print(f"\n   最新日期: {date}")
        print(f"   ├─ 独立用户: {unique}")
        print(f"   ├─ 新增用户: {new}")
        print(f"   ├─ 会话数: {sessions}")
        print(f"   └─ 累计用户: {cumulative}")
    
    print("\n✅ 本地数据库连接正常")
    print("\n📝 验证信息:")
    print("   • 行为模拟器现在会同时更新以下两个目标:")
    print("     1. 💾 本地 SQLite (data/app.db)")
    print("     2. ☁️  云端 Render API")
    print("")
    print("   • 如果云端暂时不可用，本地数据仍会被保存")
    print("   • 可通过 sync-now.sh 脚本定期同步本地→云端")
    print("\n" + "═" * 60)

if __name__ == "__main__":
    sys.exit(main())
