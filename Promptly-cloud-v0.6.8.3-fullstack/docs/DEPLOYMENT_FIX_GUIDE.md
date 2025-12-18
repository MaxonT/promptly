# Pipeline API 修复部署指南

## 问题诊断

根据测试结果，发现以下问题：

1. **后端路由返回 404**：虽然后端日志显示路由已注册，但外部访问 `/api/pipeline/run` 和 `/api/pipeline/health` 都返回 404
2. **前端调用旧 API**：浏览器 Console 显示 "Calling Outcome Runner API"，说明加载的是旧版本前端代码

## 已实施的修复

### 后端修复（backend/src/）

1. **添加详细的路由注册日志** (`server.js`)
   - 每个路由注册时都会打印日志
   - 添加了请求日志中间件，记录所有进入后端的请求
   - 格式：`[promptly] ← METHOD PATH` 和 `[promptly] → METHOD PATH STATUS (duration)`

2. **增强 Pipeline 路由日志** (`routes/pipeline.js`)
   - `/health` 端点现在会打印日志：`[pipeline] GET /health called - Pipeline routes are working!`
   - 添加了时间戳到响应中

### 前端修复（frontend/index.html）

1. **添加版本标识**
   - 在页面加载时打印：`[Promptly] Frontend version: 2024-12-06-pipeline-fix`
   - 明确声明：`[Promptly] This frontend WILL call /api/pipeline/run (NOT /api/outcome-runs)`

2. **增强 API 调用日志**
   - 在调用 Pipeline API 前打印完整的 URL
   - 在 API 失败时打印详细的错误信息（状态码、响应体）

3. **添加 Cache-Busting Meta 标签**
   ```html
   <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
   <meta http-equiv="Pragma" content="no-cache" />
   <meta http-equiv="Expires" content="0" />
   <meta name="version" content="2024-12-06-pipeline-fix" />
   ```

## 部署步骤

### 1. 提交代码到 Git

```bash
cd /Users/yangming/Desktop/Github/Promptly-v0.6-CloudTest/Promptly-cloud-v0.6.8.3-fullstack

git add backend/src/server.js
git add backend/src/routes/pipeline.js
git add frontend/index.html
git add docs/DEPLOYMENT_FIX_GUIDE.md

git commit -m "fix: 修复 Pipeline API 404 和前端缓存问题

- 添加详细的路由注册和请求日志到后端
- 在前端添加版本标识和 cache-busting
- 增强 API 调用的错误日志"

git push origin main
```

### 2. 触发 Render 重新部署

Render 应该会自动检测到 Git 推送并重新部署。如果没有：

1. 登录 Render Dashboard: https://dashboard.render.com/
2. 找到你的服务（应该叫 `promptly-v0-6-cloudtest` 或类似名称）
3. 点击 "Manual Deploy" → "Deploy latest commit"

### 3. 等待部署完成

- 后端部署：通常需要 2-5 分钟
- 前端部署：通常需要 1-3 分钟

### 4. 清除浏览器缓存

**重要**：必须强制刷新浏览器才能加载新的前端代码！

- **Chrome/Edge**: `Cmd+Shift+R` (Mac) 或 `Ctrl+Shift+R` (Windows/Linux)
- **Firefox**: `Cmd+Shift+R` (Mac) 或 `Ctrl+F5` (Windows/Linux)
- **Safari**: `Cmd+Option+R`

或者：
- 打开 DevTools (F12)
- 右键点击刷新按钮
- 选择 "清空缓存并硬性重新加载"

## 测试步骤

### 测试 1: 验证后端路由

```bash
# 测试健康检查端点
curl -v https://promptly-v0-6-cloudtest.onrender.com/api/pipeline/health

# 预期结果：
# HTTP/2 200
# {"ok":true,"message":"Pipeline routes are working","timestamp":"...","routes":{...},"activeStreams":0}
```

### 测试 2: 验证 Pipeline API

```bash
# 测试 Pipeline 启动
curl -X POST https://promptly-v0-6-cloudtest.onrender.com/api/pipeline/run \
  -H "Content-Type: application/json" \
  -d '{"idea": "测试 Pipeline", "skipQuestions": true}'

# 预期结果：
# HTTP/2 200
# {"runId":"...","streamUrl":"/api/pipeline/stream/..."}
```

### 测试 3: 检查后端日志

在 Render Dashboard 中查看后端日志，应该看到：

```
[promptly] 🔧 Registering API routes...
[promptly]   ✓ /api/auth
[promptly]   ✓ /api/docs
...
[promptly]   ✓ /api/pipeline (health, run, stream)
[promptly] ✅ All API routes registered successfully!
[promptly] 📋 Pipeline routes:
[promptly]    GET  /api/pipeline/health
[promptly]    POST /api/pipeline/run
[promptly]    GET  /api/pipeline/stream/:runId
[promptly] backend listening on :10000
```

当你访问 `/api/pipeline/health` 时，应该看到：

```
[promptly] ← GET /api/pipeline/health
[pipeline] GET /health called - Pipeline routes are working!
[promptly] → GET /api/pipeline/health 200 (5ms)
```

### 测试 4: 检查前端版本

1. 打开浏览器 DevTools (F12)
2. 切换到 Console 标签页
3. 刷新页面（记得用 Cmd+Shift+R 强制刷新）
4. 应该看到：

```
[Promptly] Frontend version: 2024-12-06-pipeline-fix
[Promptly] This frontend WILL call /api/pipeline/run (NOT /api/outcome-runs)
[Promptly] Pipeline animation script loaded!
...
```

### 测试 5: 端到端测试

1. 在前端页面输入任务描述
2. 点击 "Run Optimization" 按钮
3. 查看 Console，应该看到：

```
[Promptly] Run Optimization button clicked!
[Promptly] ✅ Calling Pipeline API: https://promptly-v0-6-cloudtest.onrender.com/api/pipeline/run
[Promptly] ✅ Frontend version: 2024-12-06-pipeline-fix
[Promptly] ✅ Request data: {idea: "...", model: "..."}
[Promptly] ✅ Pipeline API响应: {runId: "...", streamUrl: "..."}
[Promptly] ✅ Pipeline已启动, runId: ...
[Promptly] SSE connection opened
```

## 故障排查

### 如果仍然返回 404

1. **检查 Render 部署状态**
   - 确认部署成功（显示绿色的 "Live"）
   - 检查部署日志中是否有错误

2. **检查后端日志**
   - 查看是否有路由注册日志
   - 查看是否有请求到达后端

3. **检查路由注册**
   - 确认 `pipelineRouter` 正确导出
   - 确认 `server.js` 中正确导入并注册

### 如果前端仍显示旧版本

1. **完全清除浏览器缓存**
   - 打开浏览器设置
   - 找到 "清除浏览数据"
   - 选择 "缓存的图像和文件"
   - 时间范围选择 "全部"
   - 清除

2. **使用隐身/无痕模式**
   - 打开新的隐身窗口
   - 访问网站
   - 检查 Console 中的版本号

3. **检查 Network 标签页**
   - 打开 DevTools → Network
   - 刷新页面
   - 检查 `index.html` 的响应头
   - 确认 `Cache-Control` 是 `no-cache`

## 预期的完整日志流

### 后端日志（部署成功后）

```
[promptly] 🔧 Registering API routes...
[promptly]   ✓ /api/auth
[promptly]   ✓ /api/docs
[promptly]   ✓ /api/share
[promptly]   ✓ /api/specs
[promptly]   ✓ /api/question-sessions
[promptly]   ✓ /api/runs
[promptly]   ✓ /api/outcome-runs
[promptly]   ✓ /api/enhance
[promptly]   ✓ /api/prompts
[promptly]   ✓ /api/pipeline (health, run, stream)
[promptly] ✅ All API routes registered successfully!
[promptly] 📋 Pipeline routes:
[promptly]    GET  /api/pipeline/health
[promptly]    POST /api/pipeline/run
[promptly]    GET  /api/pipeline/stream/:runId
[promptly] backend listening on :10000
```

### 前端 Console（页面加载后）

```
[Promptly] Frontend version: 2024-12-06-pipeline-fix
[Promptly] This frontend WILL call /api/pipeline/run (NOT /api/outcome-runs)
[Promptly] Pipeline animation script loaded!
[Promptly] DOM still loading, waiting for DOMContentLoaded...
[Promptly] DOMContentLoaded fired - Initializing pipeline animation and Run Optimization button...
[Promptly] Run Optimization button found, attaching event listener...
[Promptly] Pipeline animation initialization complete!
```

### 前端 Console（点击按钮后）

```
[Promptly] Run Optimization button clicked!
[Promptly] ✅ Calling Pipeline API: https://promptly-v0-6-cloudtest.onrender.com/api/pipeline/run
[Promptly] ✅ Frontend version: 2024-12-06-pipeline-fix
[Promptly] ✅ Request data: {idea: "测试任务", model: "promptly-mini"}
[Promptly] ✅ Pipeline API响应: {runId: "abc123", streamUrl: "/api/pipeline/stream/abc123"}
[Promptly] ✅ Pipeline已启动, runId: abc123
[Promptly] SSE connection opened
[pipeline] Event: connected {runId: "abc123", timestamp: "..."}
[pipeline] Event: stage-start {stage: "spec", message: "Starting Spec Builder..."}
...
```

### 后端日志（Pipeline 请求时）

```
[promptly] ← POST /api/pipeline/run
[pipeline] POST /run received
[pipeline] Starting pipeline - idea length: 8, skipQuestions: true, model: promptly-mini
[pipeline] Spec Builder: Starting...
[pipeline] Spec Builder: Calling LLM...
[pipeline] Spec Builder: Completed
[pipeline] Question Engine: Skipped (skipQuestions=true)
[pipeline] LLM Agents: Starting...
[pipeline] LLM Agents: Architect agent...
[pipeline] LLM Agents: Editor agent...
[pipeline] LLM Agents: Judge agent...
[pipeline] LLM Agents: Completed
[pipeline] Metrics & Scoring: Starting...
[pipeline] Metrics & Scoring: Completed
[pipeline] Outcome Runner: Starting...
[pipeline] Outcome Runner: Completed
[pipeline] Pipeline complete: 3 candidates, best: architect
[promptly] → POST /api/pipeline/run 200 (2543ms)
```

## 联系支持

如果问题仍然存在，请提供：

1. 后端部署日志的截图（包括路由注册部分）
2. 浏览器 Console 的截图（包括版本号和 API 调用）
3. `curl` 测试的完整输出
4. Render Dashboard 中的部署状态截图

