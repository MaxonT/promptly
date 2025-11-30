# Promptly 附件功能设计文档

## 📋 概述

本文档描述为 Promptly 的主要聊天/playground 输入添加附件支持的完整实现方案。

## 🎯 目标

1. **前端体验**：用户可以在 enhancer 页面附加图片、视频和通用文件
2. **后端兼容性**：向前兼容的附件处理，便于未来扩展到真正的多模态LLM
3. **保持向后兼容**：纯文本请求继续正常工作

## 📐 数据结构设计

### 附件对象结构

```json
{
  "name": "screenshot.png",
  "size": 123456,
  "type": "image/png",
  "dataURL": "data:image/png;base64,iVBORw0KGgoAAAA...",
  "storageKey": null
}
```

**字段说明**：
- `name`: 文件名（用于显示）
- `size`: 文件大小（字节）
- `type`: MIME类型
- `dataURL`: Base64 data URL（用于预览和传输）
- `storageKey`: 未来云存储键（当前为null）

### API请求结构

#### 选项1：JSON with embedded attachments（当前实现）

```json
{
  "prompt": "这是用户输入的文本",
  "attachments": [
    {
      "name": "screenshot.png",
      "size": 123456,
      "type": "image/png",
      "dataURL": "data:image/png;base64,..."
    }
  ]
}
```

**优点**：
- 与现有JSON API一致
- 易于调试和日志记录
- 不需要multipart解析库

**缺点**：
- Base64编码增加约33%大小
- 大文件可能超过JSON payload限制

#### 选项2：multipart/form-data（未来扩展）

```
POST /api/enhance/structure
Content-Type: multipart/form-data

------WebKitFormBoundary...
Content-Disposition: form-data; name="prompt"

这是用户输入的文本
------WebKitFormBoundary...
Content-Disposition: form-data; name="file0"; filename="screenshot.png"
Content-Type: image/png

[binary data]
------WebKitFormBoundary...
```

**优点**：
- 处理大文件效率高
- 标准文件上传方式

**缺点**：
- 需要额外的multipart解析库（如multer）
- 需要临时文件存储

**当前选择**：使用选项1（JSON），代码结构支持未来切换到选项2

## 🎨 前端实现

### UI组件

1. **附件按钮**（enhancer.html）
   ```html
   <button id="attachBtn" class="enhancer-button-attach">
     📎 Attach
   </button>
   <input type="file" id="fileInput" multiple accept="*/*" hidden />
   ```

2. **附件预览列表**
   ```html
   <div id="attachmentList" class="attachment-list">
     <!-- 动态生成的附件项 -->
     <div class="attachment-item">
       <span class="attachment-icon">📷</span>
       <div class="attachment-info">
         <div class="attachment-name">screenshot.png</div>
         <div class="attachment-size">120.5 KB</div>
       </div>
       <button class="attachment-remove">×</button>
     </div>
   </div>
   ```

### 前端状态管理（enhancer.js）

```javascript
let attachments = []; // 当前选中的附件数组

// 添加附件
function addAttachment(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    attachments.push({
      name: file.name,
      size: file.size,
      type: file.type,
      dataURL: e.target.result
    });
    renderAttachments();
  };
  reader.readAsDataURL(file);
}

// 移除附件
function removeAttachment(index) {
  attachments.splice(index, 1);
  renderAttachments();
}

// 发送请求时包含附件
async function callEnhancer(path) {
  const body = {
    prompt: getPrompt(),
    attachments: attachments
  };
  // ... fetch调用
}
```

## 🔧 后端实现

### 新建路由文件：backend/src/routes/enhance.js

```javascript
import express from "express";
import { chatText } from "../lib/openaiClient.js";

const enhanceRouter = express.Router();

// POST /api/enhance/structure - 结构化增强
enhanceRouter.post("/structure", async (req, res) => {
  try {
    const { prompt, attachments = [] } = req.body;
    
    // 构建增强的prompt
    let enhancedPrompt = prompt;
    
    // 如果有附件，添加引用
    if (attachments.length > 0) {
      const attachmentRefs = attachments.map((att, i) => 
        `[Attachment ${i + 1}: ${att.type} "${att.name}" (${formatSize(att.size)})]`
      ).join('\n');
      enhancedPrompt += '\n\nAttachments:\n' + attachmentRefs;
    }
    
    // 调用LLM（当前不传递图片内容，仅文本引用）
    const result = await enhancePromptStructure(enhancedPrompt);
    
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export { enhanceRouter };
```

### 附件处理逻辑

```javascript
/**
 * 处理附件并生成LLM可理解的上下文
 * 
 * @param {Array} attachments - 附件数组
 * @returns {string} - 附件的文本描述
 * 
 * 未来扩展点：
 * - 对于图片：使用GPT-4V进行视觉分析
 * - 对于PDF/文档：提取文本内容
 * - 对于视频：提取关键帧
 */
function buildAttachmentContext(attachments) {
  if (!attachments || attachments.length === 0) {
    return "";
  }
  
  const descriptions = attachments.map((att, i) => {
    const category = getAttachmentCategory(att.type);
    return `Attachment ${i + 1}: [${category}] ${att.name} (${formatSize(att.size)})`;
  });
  
  return "\n\nAttached files (not yet processed):\n" + descriptions.join("\n");
}

function getAttachmentCategory(mimeType) {
  if (mimeType.startsWith('image/')) return 'IMAGE';
  if (mimeType.startsWith('video/')) return 'VIDEO';
  if (mimeType.startsWith('audio/')) return 'AUDIO';
  if (mimeType.includes('pdf')) return 'PDF';
  if (mimeType.includes('text')) return 'TEXT';
  return 'FILE';
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
```

## 🔄 请求/响应流程

### 完整流程图

```
User Input (text + files)
    ↓
[前端] enhancer.js
    ├─ 验证文件类型和大小
    ├─ 转换为Base64 dataURL
    ├─ 渲染预览列表
    └─ 点击"Enhance"
        ↓
    构建JSON请求体
    {
      prompt: "...",
      attachments: [...]
    }
        ↓
POST /api/enhance/structure
        ↓
[后端] enhance.js
    ├─ 解析prompt和attachments
    ├─ 生成附件文本描述
    ├─ 构建增强的prompt
    └─ 调用LLM（当前仅文本）
        ↓
    返回增强结果
    {
      ok: true,
      result: { enhanced: "..." }
    }
        ↓
[前端] 显示增强后的prompt
    └─ 清空附件列表
```

## 🚀 未来扩展路径

### Phase 1: 当前实现（✓）
- ✅ 基础附件UI
- ✅ 文件选择和预览
- ✅ JSON传输
- ✅ 后端接收和记录

### Phase 2: 文本提取
- [ ] PDF文本提取
- [ ] 图片OCR（识别文字）
- [ ] 文档格式解析

### Phase 3: 多模态LLM
- [ ] GPT-4V图片分析
- [ ] Claude视觉能力
- [ ] 视频帧分析

### Phase 4: 云存储
- [ ] S3/云存储集成
- [ ] 附件URL引用
- [ ] 大文件分块上传

## 📝 代码注释规范

所有附件相关代码包含以下注释：

```javascript
/**
 * ATTACHMENT FEATURE
 * 
 * Purpose: [功能说明]
 * Current: [当前实现]
 * Future: [未来扩展方向]
 */
```

## 🧪 测试计划

### 前端测试
1. ✓ 选择单个文件
2. ✓ 选择多个文件
3. ✓ 移除附件
4. ✓ 发送带附件的请求
5. ✓ 发送纯文本（无附件）请求
6. ✓ 大文件警告（>10MB）

### 后端测试
1. ✓ 接收纯文本请求
2. ✓ 接收带附件的请求
3. ✓ 附件元数据记录
4. ✓ 错误处理

## 📊 技术限制

当前实现的限制：

1. **文件大小**：建议 < 10MB（Base64传输）
2. **文件类型**：无限制，但只生成文本描述
3. **并发上传**：无限制（内存中处理）
4. **持久化**：当前不保存文件内容

## 🔐 安全考虑

1. **文件类型验证**：前端初步过滤
2. **大小限制**：防止内存溢出
3. **Base64验证**：后端验证dataURL格式
4. **恶意文件**：当前不解析文件内容，降低风险

## 📚 相关文件

### 修改的文件
- `frontend/enhancer.html` - 添加附件UI
- `frontend/enhancer.css` - 附件样式
- `frontend/enhancer.js` - 附件处理逻辑
- `backend/src/server.js` - 挂载enhance路由
- `backend/src/routes/enhance.js` - 新建路由处理器

### 新增的文件
- `ATTACHMENT_FEATURE_DESIGN.md` - 本文档
- `backend/src/lib/attachmentHelper.js` - 附件工具函数（可选）

---

**版本**: 1.0
**日期**: 2025-11-30
**作者**: AI Assistant

