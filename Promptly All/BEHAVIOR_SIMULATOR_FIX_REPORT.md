# 行为模拟器连接错误修复报告

## 问题诊断

### 问题现象
```
[2026-01-31 12:03:27] [WARN] 🔌 连接错误，60秒后重试 (3/5)
[2026-01-31 12:04:27] [WARN] 🔌 连接错误，60秒后重试 (4/5)
[2026-01-31 12:05:27] [WARN] 🔌 连接错误，60秒后重试 (5/5)
```

模拟器持续连接失败，而template项目的模拟器运行正常。

### 根本原因

**问题1**: 错误的API端点
- **失败的模拟器** (`backend/scripts/behavior-simulator.py`) 调用：
  - `/api/analytics/dashboard/track/user`
  - `/api/analytics/dashboard/track/session-start`
  - `/api/analytics/dashboard/track/behavior`
  - `/api/analytics/dashboard/track/session-end`
  
- **成功的模拟器** (`template/simulator/behavior-simulator.py`) 调用：
  - `/api/analytics/dashboard/admin/generate-data` ✅
  
- **后端实际支持的端点**：
  - ✅ `/api/analytics/dashboard/admin/generate-data` (批量生成端点)
  - ❌ `/api/analytics/dashboard/track/*` (不存在)

**问题2**: 错误的默认URL配置
- `behavior-simulator.sh` 脚本使用默认值 `http://localhost:8080`
- Python脚本虽然有正确的默认值，但被shell脚本的环境变量覆盖

## 修复方案

### 1. 重构API调用逻辑 ✅

将分散的多次API调用（track/user, track/session-start等）改为单次批量API调用：

**修改前**:
```python
def simulate_new_user():
    api_call("/api/analytics/dashboard/track/user", data)
    
def simulate_session(user_id, user_type):
    api_call("/api/analytics/dashboard/track/session-start", data)
    api_call("/api/analytics/dashboard/track/behavior", data)
    api_call("/api/analytics/dashboard/track/session-end", data)
```

**修改后**:
```python
def api_call_generate_data(users, sessions, retries=0):
    url = f"{CONFIG['API_BASE']}/api/analytics/dashboard/admin/generate-data"
    response = requests.post(
        url,
        json={"users": users, "sessions": sessions},
        headers={"X-Admin-Key": os.environ.get("ADMIN_API_KEY", "")},
        timeout=CONFIG["TIMEOUT"]
    )
```

### 2. 修正默认URL配置 ✅

**behavior-simulator.sh** (行23):
```bash
# 修改前
API_BASE="${API_BASE:-http://localhost:8080}"

# 修改后
API_BASE="${API_BASE:-https://promptly-v0-6-cloudtest-cursor-dev.onrender.com}"
```

### 3. 统一日志文件路径 ✅

```bash
# 修改前
LOG_FILE="/tmp/promptly-behavior-simulator.log"

# 修改后
LOG_FILE="$HOME/.promptly-behavior-simulator.log"
```

### 4. 增强错误日志 ✅

添加详细的调试信息以便问题诊断：
```python
log_message(f"🌐 发送请求: {url}")
log_message(f"📦 数据: users={users}, sessions={sessions}")
log_message(f"📡 收到响应: HTTP {response.status_code}")
```

## 验证结果

### 修复后的日志输出
```
[2026-01-31 12:25:11] [INFO] API Base: https://promptly-v0-6-cloudtest-cursor-dev.onrender.com
[2026-01-31 12:25:12] [INFO] 🔄 Cycle #1 started
[2026-01-31 12:25:12] [INFO] 📈 Growth mode: 0/6000 users
[2026-01-31 12:25:12] [INFO] 📊 时段: 下午 | 概率: 40% | 生成: 4用户, 5会话
[2026-01-31 12:25:12] [INFO] 🌐 发送请求: https://...
[2026-01-31 12:25:12] [INFO] 📦 数据: users=4, sessions=5
[2026-01-31 12:25:12] [INFO] 📡 收到响应: HTTP 200
[2026-01-31 12:25:12] [INFO] ✅ API 成功: 4 用户, 5 会话
[2026-01-31 12:25:12] [INFO] ✅ Cycle #1 completed | 4/4 actions completed
[2026-01-31 12:25:12] [INFO] ⏰ Next cycle in 3h 41m
```

### API端点测试
```bash
$ python3 test-simulator.py
测试目标: https://promptly-v0-6-cloudtest-cursor-dev.onrender.com/api/analytics/dashboard/admin/generate-data
状态码: 200
响应内容: {"ok":true,"generated":{"users":2,"sessions":3},"timestamp":"2026-01-31T18:21:51.012Z"}
✅ API调用成功！
```

## 启动命令

### 方式1: 使用Shell脚本（推荐）
```bash
cd backend/scripts
./behavior-simulator.sh
```

### 方式2: 直接运行Python
```bash
export API_BASE="https://promptly-v0-6-cloudtest-cursor-dev.onrender.com"
cd backend/scripts
python3 behavior-simulator.py &
```

### 方式3: launchd服务（持久化）
```bash
cd backend/scripts
./install-behavior-simulator.sh
```

## 文件修改清单

1. ✅ `backend/scripts/behavior-simulator.py` - 重构API调用逻辑
2. ✅ `backend/scripts/behavior-simulator.sh` - 修正默认URL和日志路径
3. ✅ `backend/scripts/test-simulator.py` - 新增API测试工具

## 总结

问题的根本原因是使用了不存在的API端点。修复通过：
1. 将API调用改为使用后端实际支持的批量生成端点
2. 修正配置文件中的默认URL
3. 增强日志输出便于问题诊断

现在模拟器与template版本使用相同的API架构，确保稳定运行。

---
**修复时间**: 2026-01-31 12:25
**版本**: behavior-simulator v3 (批量API版本)
**状态**: ✅ 已修复并验证
