# Behavior Simulator 使用指南

## 📁 文件说明

### ✅ 生产环境文件（正确使用）

| 文件 | 用途 | 说明 |
|-----|------|------|
| **behavior-simulator.py** | 主程序（生产版） | ✅ **使用此文件** - 连接生产服务器，批量API |
| **behavior-simulator.sh** | Shell包装器 | 提供start/stop/status命令 |
| **install-behavior-simulator.sh** | launchd安装脚本 | 配置开机自启动 |
| **uninstall-behavior-simulator.sh** | launchd卸载脚本 | 移除自启动服务 |

### ⚠️ 测试文件（仅本地开发）

| 文件 | 用途 | 说明 |
|-----|------|------|
| **behavior-simulator-test.py** | 测试版本 | ⚠️ 默认连接localhost:8080，仅用于本地测试 |
| **test-simulator.py** | API测试工具 | 快速验证API连接 |

---

## 🚀 快速开始

### 方式1: 直接运行（推荐）

```bash
# 设置环境变量（可选，已有默认值）
export API_BASE="https://promptly-v0-6-cloudtest-cursor-dev.onrender.com"

# 启动模拟器
cd backend/scripts
python3 behavior-simulator.py &

# 查看日志
tail -f ~/.promptly-behavior-simulator.log
```

### 方式2: 使用Shell脚本

```bash
cd backend/scripts
./behavior-simulator.sh start   # 启动
./behavior-simulator.sh stop    # 停止
./behavior-simulator.sh status  # 状态
./behavior-simulator.sh logs    # 查看日志
```

### 方式3: launchd服务（开机自启）

```bash
cd backend/scripts
./install-behavior-simulator.sh   # 安装服务

# 管理服务
launchctl list | grep promptly    # 查看状态
launchctl stop com.promptly.behavior.simulator    # 停止
launchctl start com.promptly.behavior.simulator   # 启动

# 卸载服务
./uninstall-behavior-simulator.sh
```

---

## 🔧 配置说明

### API配置（重要！）

**生产环境默认值**（已配置好）：
```python
API_BASE = "https://promptly-v0-6-cloudtest-cursor-dev.onrender.com"
API_ENDPOINT = "/api/analytics/dashboard/admin/generate-data"
```

**本地开发**（需要手动设置）：
```bash
export API_BASE="http://localhost:8080"
python3 behavior-simulator.py &
```

### 环境变量

| 变量 | 默认值 | 说明 |
|-----|--------|------|
| `API_BASE` | 生产URL | API服务器地址 |
| `ADMIN_API_KEY` | （空） | 管理员密钥（可选） |

---

## 📊 日志位置

| 日志类型 | 路径 |
|---------|------|
| 主日志 | `~/.promptly-behavior-simulator.log` |
| 标准输出 | `~/.promptly-behavior-simulator.out.log` |
| 错误输出 | `~/.promptly-behavior-simulator.err.log` |

---

## 🔍 查看日志

```bash
# 实时查看
tail -f ~/.promptly-behavior-simulator.log

# 查看最近50行
tail -50 ~/.promptly-behavior-simulator.log

# 搜索错误
grep "ERROR" ~/.promptly-behavior-simulator.log

# 查看今天的日志
grep "$(date +%Y-%m-%d)" ~/.promptly-behavior-simulator.log
```

---

## ✅ 验证运行状态

### 检查进程
```bash
ps aux | grep behavior-simulator.py | grep -v grep
```

### 检查日志（应该看到）
```bash
tail -10 ~/.promptly-behavior-simulator.log
```

期待输出：
```
[2026-01-31 12:25:12] [INFO] 🔄 Cycle #1 started
[2026-01-31 12:25:12] [INFO] 📈 Growth mode: 0/6000 users
[2026-01-31 12:25:12] [INFO] 📡 收到响应: HTTP 200
[2026-01-31 12:25:12] [INFO] ✅ API 成功: 4 用户, 5 会话
[2026-01-31 12:25:12] [INFO] ✅ Cycle #1 completed
[2026-01-31 12:25:12] [INFO] ⏰ Next cycle in 3h 41m
```

### 测试API连接
```bash
cd backend/scripts
python3 test-simulator.py
```

期待输出：
```
✅ API调用成功！
```

---

## ❌ 常见错误排查

### 问题1: 连接错误
```
[WARN] 🔌 连接错误，60秒后重试 (1/5)
```

**原因**：API_BASE配置错误或使用localhost

**解决**：
```bash
# 检查当前配置
ps aux | grep behavior-simulator.py | grep -v grep

# 如果看到 localhost:8080，说明配置错误
# 停止进程
pkill -f behavior-simulator.py

# 使用正确的环境变量重启
export API_BASE="https://promptly-v0-6-cloudtest-cursor-dev.onrender.com"
python3 behavior-simulator.py &
```

### 问题2: 进程不存在但launchd显示运行

```bash
# 卸载并重新安装
./uninstall-behavior-simulator.sh
./install-behavior-simulator.sh
```

### 问题3: 日志文件无内容

```bash
# 检查文件权限
ls -la ~/.promptly-behavior-simulator.log

# 手动创建（如果不存在）
touch ~/.promptly-behavior-simulator.log
```

---

## 🎯 工作原理

### API调用流程

```
Simulator → POST /api/analytics/dashboard/admin/generate-data
           Body: { users: 4, sessions: 5 }
           Header: X-Admin-Key (可选)
           
Backend → 创建随机用户和会话数据
       → 写入数据库
       → 返回: { ok: true, generated: {...} }
```

### 时间段概率模型

| 时段 | 时间 | 生成概率 |
|-----|------|----------|
| 上午 | 6:00-12:00 | 30% |
| 下午 | 12:00-18:00 | 40% |
| 晚上 | 18:00-24:00 | 20% |
| 夜间 | 0:00-6:00 | 10% |

### 批次配置

- **批次大小**：5-20个用户/次
- **会话比例**：1.2-1.8倍用户数
- **等待间隔**：30分钟 - 4小时（随机）

---

## 🆚 版本对比

| 特性 | v2（旧版本） | v3（当前版本） |
|-----|-------------|---------------|
| API端点 | ❌ /track/* (不存在) | ✅ /admin/generate-data |
| 调用方式 | ❌ 多次分散调用 | ✅ 单次批量调用 |
| 默认URL | ❌ localhost:8080 | ✅ 生产服务器 |
| 日志路径 | /tmp/ | ~/.promptly-* |
| 错误诊断 | 基础 | 详细堆栈跟踪 |

---

## 📝 关键提醒

1. ✅ **生产环境使用** `behavior-simulator.py`，不要用test版本
2. ✅ **默认配置已正确**，无需手动设置API_BASE（除非本地开发）
3. ✅ **日志统一位置**：`~/.promptly-behavior-simulator.log`
4. ⚠️ **测试版本** `behavior-simulator-test.py` 默认连接localhost
5. 🔧 **修改配置**：编辑 `install-behavior-simulator.sh` 中的 `API_BASE_URL` 变量

---

## 🔗 相关文档

- [修复报告](../../BEHAVIOR_SIMULATOR_FIX_REPORT.md)
- [Analytics Dashboard指南](../../ANALYTICS_DASHBOARD_GUIDE.md)
- [Backend API文档](../src/routes/analyticsDashboard.js)

---

**最后更新**: 2026-01-31  
**版本**: v3 (批量API版本)  
**状态**: ✅ 生产就绪
