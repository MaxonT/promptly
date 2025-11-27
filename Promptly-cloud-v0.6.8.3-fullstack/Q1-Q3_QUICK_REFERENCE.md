# Q1-Q3 快速参考指南

## 📚 功能概览

### Q1: Snapshot / Restore (快照与恢复)
保存和恢复完整的问答会话状态

### Q2: Back / Skip (返回与跳过)
灵活控制问答流程,返回修改或跳过问题

### Q3: Regenerate (重新生成)
使用 LLM 重新生成更好的问题

---

## 🚀 快速使用

### 保存快照
```bash
curl -X POST http://localhost:8080/api/question-sessions/{sessionId}/snapshot
```

### 恢复快照
```bash
curl http://localhost:8080/api/question-sessions/{sessionId}/snapshot/latest
```

### 返回上一题
```bash
curl -X POST http://localhost:8080/api/question-sessions/{sessionId}/answer \
  -H "Content-Type: application/json" \
  -d '{"answers": [{"question_id": "any", "value": null}], "control": "back"}'
```

### 跳过当前问题
```bash
curl -X POST http://localhost:8080/api/question-sessions/{sessionId}/answer \
  -H "Content-Type: application/json" \
  -d '{"answers": [{"question_id": "{qid}", "value": null}], "control": "skip"}'
```

### 重新生成问题
```bash
curl -X POST http://localhost:8080/api/question-sessions/{sessionId}/questions/{questionId}/regenerate
```

---

## 📊 API 端点总览

| 功能 | 方法 | 路径 | 说明 |
|------|------|------|------|
| 保存快照 | POST | `/api/question-sessions/:id/snapshot` | 保存当前会话状态 |
| 恢复快照 | GET | `/api/question-sessions/:id/snapshot/latest` | 获取最新快照 |
| 返回/跳过 | POST | `/api/question-sessions/:id/answer` | control: "back" 或 "skip" |
| 重新生成 | POST | `/api/question-sessions/:id/questions/:qid/regenerate` | 生成新问题 |

---

## 🗄️ 数据库表

### question_snapshots
- `id` - 快照ID
- `session_id` - 会话ID
- `snapshot_json` - 完整状态(JSON)
- `created_at` - 创建时间

### question_actions
- `id` - 操作ID
- `session_id` - 会话ID
- `action` - 操作类型(back/skip/regenerate)
- `payload` - 操作数据
- `created_at` - 创建时间

---

## 🎨 UI 控制

### 按钮位置
- **Restore last session** - 在项目描述区域
- **← Back** - 在问题列表下方
- **Skip →** - 在问题列表下方
- **💾 Save snapshot** - 在问题列表下方
- **🔄 Regenerate** - 在每个问题卡片上

### 使用流程
1. 开始新会话
2. 回答问题
3. 随时保存快照
4. 使用 Back/Skip 灵活控制
5. 不满意的问题点击 Regenerate
6. 刷新页面后可恢复

---

## 🧪 测试命令

### 运行简化测试(无需 LLM)
```bash
cd backend
./test_q1_q3_simple.sh
```

### 运行完整测试(需要 OPENAI_API_KEY)
```bash
cd backend
./test_q1_q3_apis.sh
```

### 查看数据库记录
```bash
cd backend
sqlite3 data/app.db "SELECT * FROM question_snapshots LIMIT 5;"
sqlite3 data/app.db "SELECT * FROM question_actions LIMIT 5;"
```

---

## 📝 响应示例

### 保存快照成功
```json
{
  "ok": true,
  "snapshot_id": "snap_VR7IwqBauXU2",
  "message": "Snapshot saved"
}
```

### 跳过问题成功
```json
{
  "ok": true,
  "done": false,
  "questions": [
    {
      "id": "q_test_2",
      "type": "yes_no",
      "content": "Next question?"
    }
  ],
  "message": "Question skipped"
}
```

### 重新生成成功
```json
{
  "ok": true,
  "question": {
    "id": "q_new_123",
    "type": "short_text",
    "content": "New question content",
    "replaces": "q_old_456",
    "origin": "regenerated"
  },
  "message": "Question regenerated successfully"
}
```

---

## 🔧 辅助函数

### questionNavigator.js
```javascript
// 获取会话进度
getSessionProgress(sessionId)

// 返回上一题
goBack(sessionId)

// 跳过问题
skipQuestion(sessionId, questionId)

// 获取未回答问题
getUnansweredQuestions(sessionId, startIndex, limit)
```

---

## ✅ 检查清单

- ✅ 数据库表已创建
- ✅ 后端 API 全部实现
- ✅ 前端 UI 按钮已添加
- ✅ 前端 JavaScript 函数已实现
- ✅ CSS 样式已添加
- ✅ 测试脚本已创建
- ✅ 功能测试通过
- ✅ 无破坏现有功能

---

## 🎯 状态

**实现**: ✅ 完成  
**测试**: ✅ 通过  
**文档**: ✅ 完整  
**生产就绪**: ✅ 是

---

**相关文档**: 
- `Q1-Q3_IMPLEMENTATION_SUMMARY.md` - 完整实现文档
- `backend/test_q1_q3_simple.sh` - 测试脚本

