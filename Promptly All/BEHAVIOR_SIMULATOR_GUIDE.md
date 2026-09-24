# Promptly 行为模拟器 v2 使用指南

## 功能概述

行为模拟器是一个用于生成模拟用户行为数据的 Python 工具，专门设计用于测试和演示 Analytics Dashboard。

### 核心特性

1. **时间段概率模型** - 根据真实用户行为模式生成数据：
   - 上午 (6:00-12:00): 30% 概率
   - 下午 (12:00-18:00): 40% 概率
   - 晚上 (18:00-24:00): 20% 概率
   - 夜间 (0:00-6:00): 10% 概率

2. **批量用户生成** - 每批随机 5-20 个用户

3. **不规则等待时间** - 30分钟 - 4小时的随机间隔

4. **Mac 原生集成**：
   - 开机自动启动 (launchd)
   - 休眠/唤醒自动暂停/恢复
   - 网络断开等待，恢复后继续
   - 崩溃后自动重启
   - 终端关闭后台运行

## 文件说明

```
backend/scripts/
├── behavior-simulator.py          # 主模拟器 (生产版本)
├── behavior-simulator-test.py     # 测试版本 (短等待时间)
├── install-behavior-simulator.sh  # 安装脚本
├── uninstall-behavior-simulator.sh # 卸载脚本
└── com.promptly.behavior.simulator.plist # launchd 配置
```

## 快速开始

### 1. 手动运行测试

```bash
cd backend/scripts

# 测试版本 (运行2轮，每轮10-20秒间隔)
python3 behavior-simulator-test.py

# 生产版本 (真实时间间隔)
python3 behavior-simulator.py
```

### 2. 安装为后台服务

```bash
cd backend/scripts
./install-behavior-simulator.sh
```

安装后服务将：
- 开机自动启动
- 后台持续运行
- 自动处理网络/休眠等情况

### 3. 服务管理命令

```bash
# 查看服务状态
launchctl list | grep behavior

# 停止服务
launchctl unload ~/Library/LaunchAgents/com.promptly.behavior.simulator.plist

# 启动服务
launchctl load ~/Library/LaunchAgents/com.promptly.behavior.simulator.plist

# 查看实时日志
tail -f ~/.promptly-behavior-simulator.out.log

# 卸载服务
./uninstall-behavior-simulator.sh
```

## 配置选项

编辑 `behavior-simulator.py` 中的 CONFIG：

```python
CONFIG = {
    "API_BASE": "http://localhost:8080",  # API 地址
    
    # 时间段概率 (%)
    "PROBABILITY": {
        "morning": 30,    # 6:00-12:00
        "afternoon": 40,  # 12:00-18:00
        "evening": 20,    # 18:00-24:00
        "night": 10,      # 0:00-6:00
    },
    
    # 批次大小
    "MIN_BATCH_SIZE": 5,
    "MAX_BATCH_SIZE": 20,
    
    # 等待时间 (秒)
    "MIN_WAIT": 1800,   # 30分钟
    "MAX_WAIT": 14400,  # 4小时
    
    # 用户类型分布 (%)
    "USER_TYPES": {
        "engaged": 30,   # 深度用户
        "casual": 50,    # 普通用户
        "bouncer": 20,   # 跳出用户
    },
    
    "NEW_USER_RATIO": 60,  # 新用户比例
}
```

## 用户类型行为

| 类型 | 会话时长 | 页面浏览 | 鼠标移动 | 点击 | 滚动 |
|------|---------|---------|---------|------|------|
| engaged | 3-13分钟 | 5-15页 | 150-450 | 10-40 | 20-70 |
| casual | 1-5分钟 | 2-7页 | 50-200 | 3-15 | 5-25 |
| bouncer | 5-35秒 | 1页 | 10-50 | 0-3 | 0-5 |

## API 端点

模拟器调用以下 track API：

- `POST /api/analytics/dashboard/track/user` - 创建新用户
- `POST /api/analytics/dashboard/track/session-start` - 开始会话
- `POST /api/analytics/dashboard/track/session-end` - 结束会话
- `POST /api/analytics/dashboard/track/behavior` - 记录行为

## 故障排除

### 服务未启动
```bash
# 检查日志
cat ~/.promptly-behavior-simulator.err.log

# 常见问题：后端未运行
curl http://localhost:8080/api/health
```

### 网络断开后不恢复
模拟器会自动检测网络状态，每30秒检查一次。如需手动重启：
```bash
launchctl unload ~/Library/LaunchAgents/com.promptly.behavior.simulator.plist
launchctl load ~/Library/LaunchAgents/com.promptly.behavior.simulator.plist
```

### 日志位置
- stdout: `~/.promptly-behavior-simulator.out.log`
- stderr: `~/.promptly-behavior-simulator.err.log`
- 应用日志: `~/.promptly-behavior-simulator.log`

## 依赖

- Python 3.9+
- requests 库: `pip3 install requests`
