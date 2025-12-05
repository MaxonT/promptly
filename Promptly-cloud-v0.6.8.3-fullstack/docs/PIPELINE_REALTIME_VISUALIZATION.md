# Pipeline 实时可视化系统

## 概述

这个系统实现了 **Best Prompt Pipeline** 的实时可视化，通过 Server-Sent Events (SSE) 将后端的五个处理阶段（Spec Builder → Question Engine → LLM Agents → Metrics & Scoring → Outcome Runner）实时展示给前端用户。

## 功能特性

### 🎯 真实反映后端处理

- **实时事件流**：通过 SSE 实时推送每个阶段的处理进度
- **详细日志**：每个阶段可以展开查看详细的处理日志（类似 reasoning trace）
- **可视化状态**：pipeline 节点根据实际进度动态更新状态

### 🎨 保持现有风格

- **霓虹/Glow 效果**：保持原有的视觉效果
- **展开功能**：每个节点可以展开查看详细信息
- **流畅动画**：状态切换和日志显示都有平滑动画

## 技术架构

### 后端实现

1. **SSE 端点** (`GET /api/pipeline/stream/:runId`)
   - 建立 Server-Sent Events 连接
   - 存储连接以便后续推送事件

2. **Pipeline 执行端点** (`POST /api/pipeline/run`)
   - 立即返回 `runId` 和 `streamUrl`
   - 异步执行完整 pipeline
   - 在关键步骤发送 SSE 事件

3. **事件类型**
   - `connected` - SSE 连接建立
   - `stage-start` - 阶段开始
   - `stage-progress` - 阶段进度更新
   - `stage-complete` - 阶段完成
   - `stage-skipped` - 阶段跳过
   - `error` - 错误发生
   - `complete` - Pipeline 完成

### 前端实现

1. **EventSource 客户端**
   - 连接到 SSE stream
   - 监听并处理各种事件类型
   - 自动重连（浏览器原生支持）

2. **UI 更新**
   - 根据事件更新 pipeline 节点状态
   - 实时添加日志条目到展开区域
   - 更新最佳 prompt 输出

3. **展开功能**
   - 每个节点有展开按钮（▾/▴）
   - 展开后显示详细日志
   - 日志自动滚动到最新条目

## 使用方式

### 后端 API

```bash
# 1. 启动 pipeline 执行
POST /api/pipeline/run
{
  "idea": "用户的原始想法",
  "attachments": [],
  "skipQuestions": false,
  "model": "gpt-4o-mini"
}

# 响应
{
  "ok": true,
  "runId": "run_xxxxx",
  "streamUrl": "/api/pipeline/stream/run_xxxxx"
}

# 2. 连接 SSE stream
GET /api/pipeline/stream/{runId}
# 返回 text/event-stream 格式的事件流
```

### 前端使用

```javascript
// 1. 启动 pipeline
const response = await fetch('/api/pipeline/run', {
  method: 'POST',
  body: JSON.stringify({ idea: '...' })
});
const { runId, streamUrl } = await response.json();

// 2. 连接 SSE
const eventSource = new EventSource(streamUrl);

eventSource.addEventListener('stage-start', (e) => {
  const data = JSON.parse(e.data);
  // 更新 UI
});

eventSource.addEventListener('complete', (e) => {
  eventSource.close();
});
```

## 事件数据格式

### stage-start
```json
{
  "stage": "spec|question|agents|metrics|outcome",
  "message": "阶段开始消息",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### stage-progress
```json
{
  "stage": "spec",
  "step": "extracting|llm-call|saving|...",
  "message": "进度消息",
  "details": {
    // 具体细节，根据步骤不同而变化
  }
}
```

### stage-complete
```json
{
  "stage": "spec",
  "message": "阶段完成消息",
  "result": {
    // 阶段结果数据
  }
}
```

### complete
```json
{
  "success": true,
  "specId": "...",
  "outcomeId": "...",
  "bestCandidate": {
    "id": "...",
    "content": "...",
    "agent": "architect|editor|judge",
    "metrics": { ... }
  }
}
```

## 文件结构

### 后端
- `backend/src/routes/pipeline.js` - Pipeline 执行和 SSE 端点
- `backend/src/server.js` - 注册 pipeline router

### 前端
- `frontend/index.html` - UI 和 JavaScript 逻辑
- `frontend/style.css` - 样式（包括展开区域和日志样式）

## 未来改进

1. **支持断线重连**：自动重连失败的 SSE 连接
2. **更详细的日志**：显示 LLM 调用的详细参数
3. **实时指标图表**：可视化 metrics 的变化
4. **候选 prompt 对比**：在 agents 阶段展示所有候选
5. **性能优化**：批量发送事件以减少网络开销

