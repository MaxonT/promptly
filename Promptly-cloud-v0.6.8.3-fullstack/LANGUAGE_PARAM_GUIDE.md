# 📝 语言参数传递指南 - Prompt 多语言支持

## 🎯 问题

当用户选择中文界面时，生成的 prompt 仍然是英文的，这对不懂英文的用户不友好。

## ✅ 前端解决方案（已实现）

### 改动内容

在 `frontend/wizard.js` 中，所有调用后端 API 的地方都添加了 `language` 参数：

#### 1. 创建 Session (第1017-1031行)
```javascript
// Get current language from i18n or localStorage
const currentLanguage = (window.i18nManager && window.i18nManager.currentLang) 
  || localStorage.getItem('promptly-language') 
  || 'en';

const res = await fetch(`${API_BASE}/api/question-sessions`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    initial_description: idea,
    kind,
    mode: currentMode,
    model: currentModel,
    language: currentLanguage  // ← 新增：用户语言偏好
  }),
  signal: startController.signal
});
```

#### 2. 提交答案 (第1204-1212行)
```javascript
const currentLanguage = (window.i18nManager && window.i18nManager.currentLang) 
  || localStorage.getItem('promptly-language') 
  || 'en';

const res = await fetch(`${API_BASE}/api/question-sessions/${sessionId}/answer`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ 
    answers: answersPayload, 
    model: currentModel,
    language: currentLanguage  // ← 新增
  })
});
```

#### 3. Finalize（生成最终 Prompt）(第1326-1335行)
```javascript
const currentLanguage = (window.i18nManager && window.i18nManager.currentLang) 
  || localStorage.getItem('promptly-language') 
  || 'en';

const res = await fetch(`${API_BASE}/api/question-sessions/${sessionId}/finalize`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ 
    model: currentModel,
    language: currentLanguage  // ← 新增：用于 prompt 生成
  })
});
```

---

## 🔧 后端需要做什么

### ⚠️ 重要说明

**这个改动不会破坏现有功能**！如果后端不处理 `language` 参数，系统仍然可以正常工作（默认生成英文 prompt）。

### 建议的后端实现

#### 1. API Endpoint 修改

在以下3个endpoint中接受 `language` 参数：

**A. POST `/api/question-sessions`**
```python
@app.route('/api/question-sessions', methods=['POST'])
def create_session():
    data = request.get_json()
    initial_description = data.get('initial_description')
    kind = data.get('kind')
    mode = data.get('mode')
    model = data.get('model')
    language = data.get('language', 'en')  # ← 新增，默认 'en'
    
    # ... 创建 session 时保存语言偏好 ...
```

**B. POST `/api/question-sessions/{id}/answer`**
```python
@app.route('/api/question-sessions/<session_id>/answer', methods=['POST'])
def submit_answer(session_id):
    data = request.get_json()
    answers = data.get('answers')
    model = data.get('model')
    language = data.get('language', 'en')  # ← 新增
    
    # ... 生成下一批问题时使用该语言 ...
```

**C. POST `/api/question-sessions/{id}/finalize`**
```python
@app.route('/api/question-sessions/<session_id>/finalize', methods=['POST'])
def finalize_session(session_id):
    data = request.get_json()
    model = data.get('model')
    language = data.get('language', 'en')  # ← 新增，最重要！
    
    # ... 生成 prompt 时使用该语言 ...
    # 例如：在 system prompt 中添加：
    # "Please generate the output in {language_name}."
```

#### 2. 语言映射表

建议在后端添加语言代码到语言名称的映射：

```python
LANGUAGE_MAP = {
    'en': 'English',
    'zh-CN': 'Simplified Chinese',
    'es': 'Spanish',
    'fr': 'French',
    'ja': 'Japanese',
    'ar': 'Arabic',
    'ko': 'Korean',
    'pt': 'Portuguese',
    'hi': 'Hindi'
}

def get_language_instruction(language_code):
    """生成语言指令供 LLM 使用"""
    language_name = LANGUAGE_MAP.get(language_code, 'English')
    
    if language_code == 'en':
        return ""  # 英文是默认的，不需要额外指令
    
    return f"\n\nIMPORTANT: Please generate all output content in {language_name}. " \
           f"Maintain the JSON structure but translate all text values to {language_name}."
```

#### 3. Finalize 中使用语言参数

在生成最终 prompt 时（最重要的部分）：

```python
def finalize_session(session_id):
    # ... 其他逻辑 ...
    
    language = data.get('language', 'en')
    language_instruction = get_language_instruction(language)
    
    # 构建 LLM prompt
    llm_prompt = f"""
    Based on the user's project description and Q&A answers, 
    generate a structured spec and compiled prompt.
    
    User's language preference: {LANGUAGE_MAP.get(language, 'English')}
    {language_instruction}
    
    Project: {initial_description}
    Answers: {answers}
    ...
    """
    
    # 调用 LLM
    response = call_llm(llm_prompt, model=model)
    
    # ... 返回结果 ...
```

---

## 📊 预期效果

### 用户选择中文界面时

**之前**:
```json
{
  "targetAudience": "individuals or businesses aspiring to establish a robust online presence",
  "requirements": [
    "must prioritize user-friendliness",
    "should be fully responsive on mobile devices"
  ]
}
```

**现在**:
```json
{
  "targetAudience": "希望建立强大在线存在的个人或企业",
  "requirements": [
    "必须优先考虑用户友好性",
    "应该在移动设备上完全响应"
  ]
}
```

---

## 🧪 测试步骤

### 前端测试
1. 切换到中文界面
2. 打开浏览器开发者工具 → Network 标签
3. 启动 wizard
4. 查看 POST 请求的 payload，确认包含 `"language": "zh-CN"`

### 后端测试
1. 接收到带 `language` 参数的请求
2. 使用该语言生成 prompt
3. 验证生成的内容是对应语言的

---

## 🔄 向后兼容性

✅ **完全兼容**

- 如果后端暂时不处理 `language` 参数，系统仍然正常工作
- 只是生成的 prompt 仍然是英文的
- 不会有任何报错或功能中断

---

## 📁 修改的文件

### 前端
- `frontend/wizard.js` - 3处API调用添加 `language` 参数

### 后端（需要实现）
- `backend/routes/question_sessions.py` (或类似文件)
  - POST `/api/question-sessions` - 接受并保存 language
  - POST `/api/question-sessions/{id}/answer` - 使用 language 生成问题
  - POST `/api/question-sessions/{id}/finalize` - **最重要**：使用 language 生成 prompt

---

## 💡 实现优先级

### P0 - 必须实现
- **Finalize endpoint**: 这是最重要的，直接影响最终 prompt 的语言

### P1 - 建议实现  
- **Create session**: 保存用户语言偏好，用于整个会话
- **Answer endpoint**: 生成的问题也应该是对应语言的（但目前问题已通过前端 i18n 显示）

### P2 - 可选优化
- 在 session 数据库中存储 language 字段
- 允许用户在会话中切换语言（罕见需求）

---

## ✅ 完成标志

当以下情况发生时，这个功能就完全实现了：

1. ✅ 前端传递 `language` 参数（已完成）
2. ⏳ 后端接受 `language` 参数
3. ⏳ 后端在生成 prompt 时使用该语言
4. ⏳ 用户看到的最终 prompt 是他们选择的语言

---

**前端状态**: ✅ 完成  
**后端状态**: ⏳ 待实现  
**影响**: 不影响现有功能，完全向后兼容  
**优先级**: P0（用户体验关键功能）

