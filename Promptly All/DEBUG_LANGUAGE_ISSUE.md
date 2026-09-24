# 🐛 调试：生成的 Prompt 还是英文

**问题**: 在简体中文界面下，生成的 prompt 仍然是英文的

---

## ⚠️ 最可能的原因：后端服务未重启

**✅ 解决方法**：
```bash
# 1. 停止当前后端服务（Ctrl+C 或 kill 进程）
# 2. 重新启动后端
cd backend
npm start
```

**重要**：Node.js 不会自动重新加载代码文件，必须手动重启服务才能使修改生效！

---

## 🔍 完整排查步骤

### 步骤1: 检查前端是否传递了 language 参数

1. 打开浏览器
2. 按 F12 打开开发者工具
3. 切换到 **Network** 标签
4. 在前端界面选择 **简体中文**
5. 启动 Question Wizard 并完成到 Finalize
6. 在 Network 中找到 `POST /api/question-sessions/.../finalize` 请求
7. 点击查看 **Request Payload**

**✅ 应该看到**：
```json
{
  "model": "promptly",
  "language": "zh-CN"  ← 这个字段必须存在
}
```

**❌ 如果没有看到 language 字段**：
- 前端可能没有正确更新
- 清除浏览器缓存后重试（Ctrl+Shift+R 或 Cmd+Shift+R）

---

### 步骤2: 检查后端是否接收到 language 参数

查看后端控制台日志，应该看到：

**✅ 正确的日志**：
```bash
[promptly] Finalizing session sess_xxx with language: zh-CN
```

**❌ 如果看到**：
```bash
[promptly] Finalizing session sess_xxx with language: en
```
说明后端收到的是英文参数。

**❌ 如果完全没有这行日志**：
说明后端代码没有生效，需要重启服务！

---

### 步骤3: 验证后端代码是否正确

检查后端文件是否包含我们的修改：

```bash
# 检查 llmAgents.js
grep -n "language = 'en'" backend/src/lib/llmAgents.js

# 应该看到类似：
# 609:export async function generateRawSpec({ initialDescription, kind, qaPairs, modeProfile = null, model = null, language = 'en' }) {

# 检查 questionSessions.js
grep -n "userLanguage" backend/src/routes/questionSessions.js

# 应该看到类似：
# 611:  const userLanguage = parsedModel.data.language || session.language || 'en';
```

**❌ 如果没有找到这些代码**：
- 文件可能没有保存
- 重新应用修改

---

### 步骤4: 检查 LLM System Prompt（高级调试）

如果前面都正确，但还是生成英文，需要检查 LLM 是否收到语言指令。

**临时添加调试代码**：

在 `backend/src/lib/llmAgents.js` 的 `generateRawSpec` 函数中添加：

```javascript
export async function generateRawSpec({ initialDescription, kind, qaPairs, modeProfile = null, model = null, language = 'en' }) {
  const system = [
    "You are Agent C in Promptly's Question Engine.",
    // ...
    getLanguageInstruction(language),
    // ...
  ].join("\n");
  
  // 添加这行临时调试代码
  console.log('[DEBUG] Language:', language);
  console.log('[DEBUG] Language instruction:', getLanguageInstruction(language));
  console.log('[DEBUG] System prompt (first 500 chars):', system.substring(0, 500));
  
  // ... 其余代码
}
```

重启后端，再次测试，查看日志输出。

**✅ 应该看到**：
```bash
[DEBUG] Language: zh-CN
[DEBUG] Language instruction: LANGUAGE REQUIREMENT: Generate ALL output content in Simplified Chinese (简体中文)...
```

**❌ 如果看到**：
```bash
[DEBUG] Language: en
[DEBUG] Language instruction: 
```
说明 language 参数没有正确传递到这个函数。

---

## 🛠️ 常见问题和解决方案

### 问题1: 后端服务没有重启

**症状**：
- 前端传递了 `language: "zh-CN"`
- 后端日志没有显示 "with language: zh-CN"
- 代码文件已修改，但行为没变

**解决**：
```bash
# 停止后端（Ctrl+C）
# 重新启动
cd backend
npm start
```

---

### 问题2: 前端缓存未清除

**症状**：
- 前端代码已更新
- 但 Network 中看不到 language 参数

**解决**：
- Chrome/Edge: Ctrl+Shift+R (Windows) 或 Cmd+Shift+R (Mac)
- Firefox: Ctrl+F5 (Windows) 或 Cmd+Shift+R (Mac)
- 或者：DevTools → Network → Disable cache (checkbox)

---

### 问题3: 浏览器选择的语言没有保存

**症状**：
- 切换到中文界面
- 但前端仍然传递 `language: "en"`

**排查**：
在浏览器 Console 中运行：
```javascript
console.log('Current language:', window.i18nManager.currentLang);
console.log('Stored language:', localStorage.getItem('promptly-language'));
```

**应该看到**：
```
Current language: zh-CN
Stored language: zh-CN
```

**如果不对**：
```javascript
// 手动设置
localStorage.setItem('promptly-language', 'zh-CN');
window.location.reload();
```

---

### 问题4: LLM 不遵循语言指令

**症状**：
- 所有前面步骤都正确
- 后端日志显示 "with language: zh-CN"
- 但生成的还是英文

**原因**：
- LLM 有时可能不完全遵循指令
- 可能需要调整语言指令的表述

**解决**：
修改 `backend/src/lib/llmAgents.js` 中的 `getLanguageInstruction` 函数，使语言要求更强：

```javascript
function getLanguageInstruction(language) {
  if (!language || language === 'en') {
    return "";
  }
  
  const languageName = LANGUAGE_MAP[language] || 'English';
  return `CRITICAL LANGUAGE REQUIREMENT: 
You MUST generate ALL output content in ${languageName}. 
This is MANDATORY and NON-NEGOTIABLE. This includes:
- All text fields in the spec (project_goal, objectives, requirements, etc.)
- The explanation field
- Any descriptions, labels, or user-facing text

Keep ONLY technical terms (like "React", "API", "database", "Node.js") in English.
ALL other natural language MUST be in ${languageName}.

DO NOT use English for natural language content.`;
}
```

---

## ✅ 快速检查清单

运行这个快速检查：

```bash
# 1. 检查后端代码是否包含修改
echo "=== Checking llmAgents.js ==="
grep -c "language = 'en'" backend/src/lib/llmAgents.js
# 应该输出: 1

echo "=== Checking questionSessions.js ==="
grep -c "userLanguage" backend/src/routes/questionSessions.js
# 应该输出: 2 或更多

# 2. 检查后端服务是否在运行
echo "=== Checking backend process ==="
ps aux | grep "node.*server.js" | grep -v grep
# 应该显示正在运行的 Node 进程

# 3. 重启后端
echo "=== Restarting backend ==="
# 停止后端 (Ctrl+C)
cd backend && npm start
```

---

## 📊 调试流程图

```
用户选择中文界面
    ↓
[检查] localStorage 和 i18nManager
    ↓ YES (zh-CN)
前端发送请求 (language: "zh-CN")
    ↓
[检查] Network → Request Payload
    ↓ YES (包含 language)
后端接收请求
    ↓
[检查] 后端代码是否包含 userLanguage
    ↓ YES
[检查] 后端服务是否重启
    ↓ YES
后端日志输出 "with language: zh-CN"
    ↓
[检查] 日志中是否看到这行
    ↓ YES
调用 generateRawSpec({ language: "zh-CN" })
    ↓
[检查] getLanguageInstruction() 是否返回中文指令
    ↓ YES
LLM 生成中文内容
    ↓
[检查] 生成的 spec 是否为中文
    ↓ YES
✅ 成功！
    ↓ NO (任何一步)
❌ 在该步骤排查问题
```

---

## 🎯 最快的解决方法（90%的情况）

```bash
# 1. 确保代码已保存（Cmd+S / Ctrl+S）
# 2. 停止后端服务
# 在后端终端按 Ctrl+C

# 3. 重新启动后端
cd backend
npm start

# 4. 清除浏览器缓存并重新加载前端
# 在浏览器按 Cmd+Shift+R (Mac) 或 Ctrl+Shift+R (Windows)

# 5. 重新测试
```

---

**创建时间**: 2025-12-17  
**用于版本**: v0.6.10.4  
**优先级**: P0（紧急）

