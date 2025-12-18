# 🧪 后端多语言功能测试指南

**版本**: v0.6.10.4  
**测试目标**: 验证后端能够根据用户语言偏好生成对应语言的 prompt

---

## 📋 测试前准备

### 1. 确认代码已部署
```bash
# 检查后端文件是否包含最新修改
grep -n "language = 'en'" backend/src/lib/llmAgents.js
# 应该显示: export async function generateRawSpec({ ... language = 'en' })

grep -n "userLanguage" backend/src/routes/questionSessions.js
# 应该显示: const userLanguage = parsedModel.data.language || ...
```

### 2. 启动后端服务
```bash
cd backend
npm start
# 或
node src/server.js
```

### 3. 确认前端已更新到 v0.6.10.3+
前端应该在 `wizard.js` 中传递 `language` 参数。

---

## 🧪 测试场景

### 场景1: 英文 Prompt 生成（默认）

**步骤**：
1. 打开前端应用
2. **不选择语言**（保持默认）或选择 English
3. 启动 Question Wizard
4. 完成问答流程
5. 点击 Finalize

**预期结果**：
- 后端日志显示：`[promptly] Finalizing session ... with language: en`
- 生成的 prompt 为英文
- 示例：
  ```json
  {
    "spec": {
      "project_goal": "Build a task management app for small teams",
      "objectives": ["Enable task creation", "Track progress"]
    }
  }
  ```

---

### 场景2: 中文 Prompt 生成 ✨

**步骤**：
1. 打开前端应用
2. 点击右上角语言选择器，选择 **简体中文**
3. 启动 Question Wizard
4. 完成问答流程
5. 点击 Finalize

**预期结果**：
- 后端日志显示：`[promptly] Finalizing session ... with language: zh-CN`
- 生成的 prompt 为中文
- 示例：
  ```json
  {
    "spec": {
      "project_goal": "为小型团队构建任务管理应用",
      "objectives": ["实现任务创建和分配", "跟踪进度"]
    },
    "explanation": "该规范综合了用户的需求，重点关注简洁性和团队协作。"
  }
  ```
- 技术术语保持英文（如 React, API, PostgreSQL）

---

### 场景3: 西班牙语 Prompt 生成

**步骤**：
1. 选择 **Español** 语言
2. 启动并完成 Wizard
3. 点击 Finalize

**预期结果**：
- 后端日志显示：`[promptly] Finalizing session ... with language: es`
- 生成的 prompt 为西班牙语
- 示例：
  ```json
  {
    "spec": {
      "project_goal": "Construir una aplicación de gestión de tareas para equipos pequeños",
      "objectives": ["Permitir la creación de tareas", "Rastrear el progreso"]
    }
  }
  ```

---

### 场景4: 日语 Prompt 生成

**步骤**：
1. 选择 **日本語** 语言
2. 启动并完成 Wizard
3. 点击 Finalize

**预期结果**：
- 后端日志显示：`[promptly] Finalizing session ... with language: ja`
- 生成的 prompt 为日语
- 示例：
  ```json
  {
    "spec": {
      "project_goal": "小規模チーム向けのタスク管理アプリを構築する",
      "objectives": ["タスクの作成を可能にする", "進捗を追跡する"]
    }
  }
  ```

---

### 场景5: 阿拉伯语 Prompt 生成（RTL测试）

**步骤**：
1. 选择 **العربية** 语言
2. 启动并完成 Wizard
3. 点击 Finalize

**预期结果**：
- 后端日志显示：`[promptly] Finalizing session ... with language: ar`
- 生成的 prompt 为阿拉伯语
- 示例：
  ```json
  {
    "spec": {
      "project_goal": "بناء تطبيق لإدارة المهام للفرق الصغيرة",
      "objectives": ["تمكين إنشاء المهام", "تتبع التقدم"]
    }
  }
  ```

---

## 🔍 调试方法

### 1. 检查前端传递的参数

在浏览器 DevTools → Network 中：
```javascript
// 找到 POST /api/question-sessions/{id}/finalize 请求
// 查看 Request Payload:
{
  "model": "promptly",
  "language": "zh-CN"  // ← 确认这个字段存在
}
```

### 2. 检查后端日志

```bash
# 启动后端时查看日志
[promptly] Finalizing session sess_xxx with language: zh-CN
```

如果没有看到这行日志：
- 检查 `questionSessions.js` 是否包含 `console.log` 语句
- 确认代码已正确部署

### 3. 检查生成的 Spec

在后端代码中临时添加：
```javascript
// 在 finalize endpoint 中
console.log('[DEBUG] Generated spec:', JSON.stringify(result.spec, null, 2));
```

### 4. 检查 LLM System Prompt

在 `llmAgents.js` 的 `generateRawSpec` 中临时添加：
```javascript
console.log('[DEBUG] System prompt for language', language, ':\n', system);
```

应该看到类似：
```
[DEBUG] System prompt for language zh-CN :
You are Agent C in Promptly's Question Engine.
...
LANGUAGE REQUIREMENT: Generate ALL output content in Simplified Chinese (简体中文). This includes:
- All text fields in the spec (project_goal, objectives, requirements, etc.)
...
```

---

## ✅ 验收标准

### 必须通过的测试：
- [x] 英文生成正常（向后兼容）
- [ ] 中文生成正常且符合语言规范
- [ ] 至少1种其他语言生成正常
- [ ] 技术术语保持英文
- [ ] JSON 结构正确无误
- [ ] 后端日志显示正确的语言代码

### 质量检查：
- [ ] 生成的文本语法正确
- [ ] 表达自然、专业
- [ ] 没有中英文混杂（除技术术语外）
- [ ] 符合目标语言的表达习惯

---

## 🐛 常见问题排查

### 问题1: 生成的仍然是英文

**可能原因**：
1. 前端没有传递 `language` 参数
2. 后端没有正确读取参数
3. LLM 没有遵循语言指令

**排查步骤**：
```bash
# 1. 检查前端是否传递
# 在浏览器 DevTools → Network → 查看 Request Payload

# 2. 检查后端是否接收
# 查看后端日志是否有 "with language: zh-CN"

# 3. 检查 LLM prompt
# 临时添加 console.log 输出 system prompt
```

### 问题2: 生成的文本质量不佳

**可能原因**：
1. LLM 对某些语言支持较弱
2. 语言指令不够清晰

**解决方案**：
1. 调整 `getLanguageInstruction()` 函数
2. 添加更多示例
3. 尝试不同的 prompt 模板

### 问题3: 技术术语被翻译了

**示例**：
```json
// 错误：
"technical_stack": "反应前端，节点后端"

// 正确：
"technical_stack": "React前端，Node.js后端"
```

**解决方案**：
在语言指令中强调：
```javascript
Keep technical terms (like "React", "API", "database", "Node.js", "PostgreSQL") in English.
```

---

## 📊 测试结果记录表

| 语言 | 语言代码 | 测试状态 | Prompt 质量 | 备注 |
|------|---------|---------|------------|------|
| English | en | ⏳ 待测 | - | 默认语言 |
| 简体中文 | zh-CN | ⏳ 待测 | - | |
| Español | es | ⏳ 待测 | - | |
| Français | fr | ⏳ 待测 | - | |
| 日本語 | ja | ⏳ 待测 | - | |
| العربية | ar | ⏳ 待测 | - | RTL |
| 한국어 | ko | ⏳ 待测 | - | |
| Português | pt | ⏳ 待测 | - | |
| हिन्दी | hi | ⏳ 待测 | - | |

---

## 🚀 下一步

测试完成后：
1. 更新测试结果记录表
2. 记录发现的问题
3. 根据需要调整语言指令
4. 准备部署到生产环境

---

**创建日期**: 2025-12-17  
**测试版本**: v0.6.10.4  
**文档维护**: AI Assistant

