#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
═══════════════════════════════════════════════════════════════════════════════════
Analytics Dashboard Behavior Simulator - Template v1.0
═══════════════════════════════════════════════════════════════════════════════════

模拟真实用户行为，生成逼真的 Analytics 数据。

核心功能:
- 基于时间段的用户活动概率模型
- 工作日/周末差异化
- 逐渐增长的用户基数
- 会话和行为数据生成

使用方法:
    python behavior-simulator.py [--rounds N] [--interval SECONDS] [--dry-run]

参数:
    --rounds N          运行轮次 (默认: -1 表示无限)
    --interval SECONDS  轮次间隔秒数 (默认: 60)
    --dry-run           仅模拟，不发送请求
    --config FILE       配置文件路径

环境变量:
    ANALYTICS_API_BASE  API基础URL (默认: http://localhost:8080)
    ADMIN_API_KEY       管理员API密钥 (可选)

═══════════════════════════════════════════════════════════════════════════════════
"""

import os
import sys
import json
import time
import random
import argparse
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import urllib.request
import urllib.error

# ═══════════════════════════════════════════════════════════════════════════════
# 配置
# ═══════════════════════════════════════════════════════════════════════════════

# API 配置
API_BASE = os.environ.get('ANALYTICS_API_BASE', 'http://localhost:8080')
API_ENDPOINT = f'{API_BASE}/api/analytics/dashboard/admin/generate-data'
ADMIN_API_KEY = os.environ.get('ADMIN_API_KEY', '')

# 默认运行配置
DEFAULT_CONFIG = {
    # 运行参数
    'rounds': -1,              # -1 = 无限运行
    'interval_seconds': 60,    # 每轮间隔
    
    # 用户增长配置
    'base_users_per_hour': 2,           # 基础每小时新用户
    'max_users_per_hour': 10,           # 峰值每小时新用户
    'sessions_per_user_ratio': 1.5,     # 会话/用户比例
    
    # 时间段权重 (0-23小时, 值越大活动越多)
    'hourly_weights': {
        0: 0.1, 1: 0.05, 2: 0.02, 3: 0.02, 4: 0.02, 5: 0.05,
        6: 0.15, 7: 0.3, 8: 0.5, 9: 0.7, 10: 0.85, 11: 0.9,
        12: 0.75, 13: 0.8, 14: 0.9, 15: 0.95, 16: 1.0, 17: 0.9,
        18: 0.7, 19: 0.6, 20: 0.5, 21: 0.4, 22: 0.3, 23: 0.2
    },
    
    # 工作日vs周末权重
    'weekday_weight': 1.0,
    'weekend_weight': 0.6
}

# ═══════════════════════════════════════════════════════════════════════════════
# 日志配置
# ═══════════════════════════════════════════════════════════════════════════════

def setup_logging(verbose: bool = False) -> logging.Logger:
    """配置日志"""
    level = logging.DEBUG if verbose else logging.INFO
    
    formatter = logging.Formatter(
        '%(asctime)s [%(levelname)s] %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)
    
    logger = logging.getLogger('behavior-simulator')
    logger.setLevel(level)
    logger.addHandler(handler)
    
    return logger

logger = setup_logging()

# ═══════════════════════════════════════════════════════════════════════════════
# 核心模拟逻辑
# ═══════════════════════════════════════════════════════════════════════════════

class BehaviorSimulator:
    """用户行为模拟器"""
    
    def __init__(self, config: Dict = None):
        """
        初始化模拟器
        
        Args:
            config: 配置字典 (可选)
        """
        self.config = {**DEFAULT_CONFIG, **(config or {})}
        self.round_count = 0
        self.total_users_generated = 0
        self.total_sessions_generated = 0
        self.start_time = datetime.now()
        
    def calculate_activity_level(self) -> Tuple[float, str]:
        """
        根据当前时间计算活动级别
        
        Returns:
            (activity_level, reason) 元组
        """
        now = datetime.now()
        hour = now.hour
        day_of_week = now.weekday()  # 0=周一, 6=周日
        
        # 获取小时权重
        hourly_weight = self.config['hourly_weights'].get(hour, 0.5)
        
        # 应用工作日/周末权重
        is_weekend = day_of_week >= 5
        day_weight = self.config['weekend_weight'] if is_weekend else self.config['weekday_weight']
        
        # 最终活动级别
        activity_level = hourly_weight * day_weight
        
        # 添加随机波动 (±15%)
        activity_level *= (0.85 + random.random() * 0.30)
        
        reason = f"hour={hour}, {'weekend' if is_weekend else 'weekday'}, base_weight={hourly_weight:.2f}"
        
        return min(1.0, activity_level), reason
    
    def calculate_users_and_sessions(self) -> Tuple[int, int]:
        """
        计算本轮应生成的用户和会话数量
        
        Returns:
            (users, sessions) 元组
        """
        activity_level, reason = self.calculate_activity_level()
        
        # 计算用户数 (根据活动级别插值)
        base = self.config['base_users_per_hour']
        max_users = self.config['max_users_per_hour']
        
        # 每分钟用户数 (假设interval是60秒)
        users_per_minute = (base + (max_users - base) * activity_level) / 60
        
        # 乘以实际间隔
        interval_minutes = self.config['interval_seconds'] / 60
        expected_users = users_per_minute * interval_minutes
        
        # 泊松分布随机化
        actual_users = self._poisson(expected_users)
        
        # 计算会话数
        session_ratio = self.config['sessions_per_user_ratio']
        expected_sessions = max(actual_users, expected_users * session_ratio)
        actual_sessions = self._poisson(expected_sessions)
        
        logger.debug(f"Activity level: {activity_level:.2f} ({reason})")
        logger.debug(f"Expected: {expected_users:.2f} users, {expected_sessions:.2f} sessions")
        
        return actual_users, actual_sessions
    
    def _poisson(self, lam: float) -> int:
        """
        简单泊松随机数生成
        
        Args:
            lam: 期望值 (λ)
        
        Returns:
            泊松分布随机整数
        """
        if lam <= 0:
            return 0
            
        # 使用逆变换法
        L = pow(2.71828, -lam)
        k = 0
        p = 1.0
        
        while p > L:
            k += 1
            p *= random.random()
            
        return k - 1
    
    def send_request(self, users: int, sessions: int, dry_run: bool = False) -> bool:
        """
        发送API请求
        
        Args:
            users: 用户数量
            sessions: 会话数量
            dry_run: 是否仅模拟
        
        Returns:
            是否成功
        """
        if dry_run:
            logger.info(f"[DRY-RUN] Would generate: {users} users, {sessions} sessions")
            return True
            
        if users == 0 and sessions == 0:
            logger.debug("Nothing to generate this round")
            return True
            
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
                    self.total_users_generated += users
                    self.total_sessions_generated += sessions
                    logger.info(f"✓ Generated: {users} users, {sessions} sessions")
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
    
    def run_round(self, dry_run: bool = False) -> bool:
        """
        运行一轮模拟
        
        Args:
            dry_run: 是否仅模拟
        
        Returns:
            是否成功
        """
        self.round_count += 1
        users, sessions = self.calculate_users_and_sessions()
        
        logger.info(f"═══ Round {self.round_count} ═══")
        
        return self.send_request(users, sessions, dry_run)
    
    def run(self, rounds: int = -1, interval: int = 60, dry_run: bool = False):
        """
        运行模拟器
        
        Args:
            rounds: 运行轮次 (-1=无限)
            interval: 轮次间隔秒数
            dry_run: 是否仅模拟
        """
        logger.info("═══════════════════════════════════════════════════════════════")
        logger.info(" Analytics Behavior Simulator Started")
        logger.info("═══════════════════════════════════════════════════════════════")
        logger.info(f"API Endpoint: {API_ENDPOINT}")
        logger.info(f"Rounds: {'unlimited' if rounds < 0 else rounds}")
        logger.info(f"Interval: {interval} seconds")
        logger.info(f"Mode: {'DRY-RUN' if dry_run else 'LIVE'}")
        logger.info("═══════════════════════════════════════════════════════════════")
        
        try:
            while rounds < 0 or self.round_count < rounds:
                success = self.run_round(dry_run)
                
                if not success:
                    logger.warning("Round failed, will retry after interval")
                
                # 等待下一轮
                if rounds < 0 or self.round_count < rounds:
                    time.sleep(interval)
                    
        except KeyboardInterrupt:
            logger.info("\nShutting down gracefully...")
        finally:
            self.print_summary()
    
    def print_summary(self):
        """打印运行摘要"""
        elapsed = datetime.now() - self.start_time
        
        logger.info("═══════════════════════════════════════════════════════════════")
        logger.info(" Simulation Summary")
        logger.info("═══════════════════════════════════════════════════════════════")
        logger.info(f"Total Rounds:    {self.round_count}")
        logger.info(f"Users Generated: {self.total_users_generated}")
        logger.info(f"Sessions Generated: {self.total_sessions_generated}")
        logger.info(f"Runtime: {elapsed}")
        logger.info("═══════════════════════════════════════════════════════════════")

# ═══════════════════════════════════════════════════════════════════════════════
# 命令行接口
# ═══════════════════════════════════════════════════════════════════════════════

def parse_args():
    """解析命令行参数"""
    parser = argparse.ArgumentParser(
        description='Analytics Dashboard Behavior Simulator',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # 运行5轮测试
    python behavior-simulator.py --rounds 5
    
    # 无限运行，每30秒一轮
    python behavior-simulator.py --interval 30
    
    # 仅模拟，不发送请求
    python behavior-simulator.py --dry-run --rounds 3
    
    # 使用自定义配置文件
    python behavior-simulator.py --config my-config.json

Environment Variables:
    ANALYTICS_API_BASE  API base URL (default: http://localhost:8080)
    ADMIN_API_KEY       Admin API key for authentication
        """
    )
    
    parser.add_argument(
        '--rounds', '-r',
        type=int,
        default=-1,
        help='Number of rounds to run (-1 for unlimited, default: -1)'
    )
    
    parser.add_argument(
        '--interval', '-i',
        type=int,
        default=60,
        help='Seconds between rounds (default: 60)'
    )
    
    parser.add_argument(
        '--dry-run', '-d',
        action='store_true',
        help='Simulate without sending requests'
    )
    
    parser.add_argument(
        '--config', '-c',
        type=str,
        help='Path to configuration JSON file'
    )
    
    parser.add_argument(
        '--verbose', '-v',
        action='store_true',
        help='Enable verbose logging'
    )
    
    return parser.parse_args()


def load_config(config_path: Optional[str]) -> Dict:
    """加载配置文件"""
    if not config_path:
        return {}
        
    try:
        with open(config_path, 'r') as f:
            config = json.load(f)
            logger.info(f"Loaded config from: {config_path}")
            return config
    except FileNotFoundError:
        logger.warning(f"Config file not found: {config_path}")
        return {}
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in config file: {e}")
        return {}


def main():
    """主函数"""
    args = parse_args()
    
    # 设置日志级别
    if args.verbose:
        logger.setLevel(logging.DEBUG)
    
    # 加载配置
    config = load_config(args.config)
    
    # 创建模拟器
    simulator = BehaviorSimulator(config)
    
    # 运行
    simulator.run(
        rounds=args.rounds,
        interval=args.interval,
        dry_run=args.dry_run
    )


if __name__ == '__main__':
    main()
