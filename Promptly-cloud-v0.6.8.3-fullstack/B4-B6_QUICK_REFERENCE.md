# B4-B6 快速参考指南

## 📚 新增功能概览

### 1️⃣ 评估存储 (B4)
- **表名**: `evaluations`
- **位置**: `backend/src/lib/db.js`
- **字段**: id, spec_id, compiled_prompt_id, run_id, model, score, verdict, summary, details, created_at

### 2️⃣ 评估引擎 (B5)
- **文件**: `backend/src/lib/evaluationEngine.js`
- **函数**: `evaluatePrompt({ spec, compiledPrompt, model })`
- **功能**: 使用 LLM 评估编译后的提示词质量

### 3️⃣ 评估 APIs (B6)
- **POST /api/specs/:id/evaluate** - 评估现有规范
- **POST /api/specs/:id/compile-and-evaluate** - 一键编译并评估
- **GET /api/specs/:id/evaluations** - 查看评估历史

---

## 🚀 快速使用

### 评估现有规范
```bash
curl -X POST http://localhost:8080/api/specs/{spec_id}/evaluate \
  -H "Content-Type: application/json"
```

### 一键编译并评估
```bash
curl -X POST http://localhost:8080/api/specs/{spec_id}/compile-and-evaluate \
  -H "Content-Type: application/json"
```

### 查看评估历史
```bash
curl http://localhost:8080/api/specs/{spec_id}/evaluations
```

---

## 📊 评估结果示例

```json
{
  "ok": true,
  "evaluation": {
    "id": "eval_xxx",
    "spec_id": "spec_xxx",
    "score": 95,
    "verdict": "pass",
    "summary": "The compiled prompt comprehensively covers...",
    "details": {
      "issues": [],
      "suggestions": [],
      "strengths": ["Clear structure", "Complete coverage"],
      "weaknesses": []
    }
  }
}
```

---

## 🔍 数据库查询

### 查看所有评估
```sql
SELECT id, spec_id, score, verdict, created_at 
FROM evaluations 
ORDER BY created_at DESC;
```

### 查看高分评估
```sql
SELECT * FROM evaluations WHERE score >= 90;
```

### 查看失败的评估
```sql
SELECT * FROM evaluations WHERE verdict = 'fail';
```

---

## ✅ 实现验证

所有 TODO 已完成:
- ✅ B4: evaluations 表已创建
- ✅ B5: evaluatePrompt() 函数已实现
- ✅ B6: 3 个 API 端点已实现并测试
- ✅ 与现有系统完美集成
- ✅ 无破坏性变更

---

## 📁 相关文件

- `backend/src/lib/db.js` - 数据库 schema
- `backend/src/lib/evaluationEngine.js` - 评估引擎
- `backend/src/routes/specs.js` - API 端点
- `backend/test_evaluation_apis.sh` - 测试脚本
- `B4-B6_IMPLEMENTATION_SUMMARY.md` - 完整文档

---

## 🎯 测试结果

- ✅ 2 个评估记录已创建
- ✅ 平均评分: 95/100
- ✅ 判定: pass
- ✅ LLM 集成正常工作
- ✅ 数据库外键约束正常

---

**状态**: ✅ 生产就绪  
**测试**: ✅ 全部通过  
**文档**: ✅ 完整

