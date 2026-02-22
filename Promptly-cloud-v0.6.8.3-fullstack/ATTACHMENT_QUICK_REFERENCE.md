# 📎 Promptly 附件功能 - 快速参考

## 🎯 一句话总结

在 Prompt Enhancer 页面点击 "📎 Attach files" 即可上传图片、视频、PDF等文件，增强您的提示词。

---

## ⚡ 快速开始（30秒）

1. 打开 `enhancer.html`
2. 输入提示词文本
3. 点击 **📎 Attach files** → 选择文件
4. 点击 **Enhance prompt**
5. 查看增强结果

---

## 📁 修改的文件

```
frontend/
├── enhancer.html   ← 添加附件UI
├── enhancer.css    ← 添加样式（80行）
└── enhancer.js     ← 添加附件逻辑（120行）

backend/
├── src/
│   ├── routes/
│   │   └── enhance.js      ← 新建路由（350行）
│   ├── lib/
│   │   └── openaiClient.js ← 添加chatText函数
│   └── server.js           ← 挂载enhance路由

文档/
├── ATTACHMENT_FEATURE_DESIGN.md          ← 设计文档
├── ATTACHMENT_IMPLEMENTATION_SUMMARY.md  ← 实现总结
├── ATTACHMENT_USER_GUIDE.md              ← 用户指南
├── ATTACHMENT_QUICK_REFERENCE.md         ← 本文档
└── test_attachment_feature.sh            ← 测试脚本
```

---

## 🔧 API端点

所有端点位于 `/api/enhance/`：

| 端点 | 功能 | 支持附件 |
|------|------|---------|
| `POST /structure` | 结构化增强 | ✅ |
| `POST /style` | 风格优化 | ✅ |
| `POST /simplify` | 简化精炼 | ✅ |
| `POST /score` | 质量评分 | ✅ |
| `POST /validate` | 问题检测 | ✅ |

---

## 📦 请求格式

### 纯文本（向后兼容）
```json
{
  "prompt": "用户输入的文本"
}
```

### 带附件（新功能）
```json
{
  "prompt": "用户输入的文本",
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

---

## 🎨 UI组件

### 附件按钮
```html
<button id="attachBtn">📎 Attach files</button>
```

### 附件列表
```
┌────────────────────────────┐
│ 🖼️ screenshot.png    [×]  │
│    120.5 KB                │
├────────────────────────────┤
│ 📄 notes.pdf         [×]  │
│    456.2 KB                │
└────────────────────────────┘
```

---

## 💻 测试命令

### 启动后端
```bash
cd backend
npm install
npm start
```

### 运行测试
```bash
chmod +x test_attachment_feature.sh
./test_attachment_feature.sh
```

### 手动测试
```bash
curl -X POST http://localhost:8080/api/enhance/structure \
  -H "Content-Type: application/json" \
  -d '{"prompt": "测试", "attachments": []}'
```

---

## 🚀 关键特性

✅ **多文件支持** - 同时选择多个文件  
✅ **类型识别** - 自动显示图标（🖼️📄🎬）  
✅ **大小格式化** - KB/MB自动转换  
✅ **实时预览** - 附件列表动态更新  
✅ **单独移除** - 每个文件独立删除  
✅ **向后兼容** - 纯文本请求照常工作  
✅ **日志记录** - 后端记录附件元数据  
✅ **错误处理** - 大文件警告和验证  

---

## 📊 当前限制

❌ 文件内容未解析（仅元数据）  
❌ 不支持GPT-4V视觉分析  
❌ Base64传输不适合大文件（>10MB）  
❌ 附件不持久化存储  

---

## 🔮 未来扩展

**Phase 2**: PDF文本提取 + 图片OCR  
**Phase 3**: GPT-4V视觉分析 + 视频摘要  
**Phase 4**: S3云存储 + 大文件支持  

---

## 🐛 快速故障排除

| 问题 | 解决方法 |
|------|---------|
| 点击"Attach"无反应 | 刷新页面（Ctrl+R） |
| 附件列表不显示 | 硬刷新（Ctrl+Shift+R） |
| 发送后报错 | 检查后端是否启动 |
| 大文件失败 | 压缩文件或调整后端限制 |

---

## 📚 文档索引

- **用户指南**: `ATTACHMENT_USER_GUIDE.md` - 详细使用说明
- **技术设计**: `ATTACHMENT_FEATURE_DESIGN.md` - 架构和设计
- **实现总结**: `ATTACHMENT_IMPLEMENTATION_SUMMARY.md` - 完整实现细节
- **快速参考**: 本文档 - 速查表

---

## 🧪 5分钟验证清单

- [ ] 前端：点击"Attach files"能选择文件
- [ ] 前端：选择的文件显示在列表中
- [ ] 前端：点击"×"能移除文件
- [ ] 前端：点击"Enhance"能发送请求
- [ ] 后端：`/api/health` 返回成功
- [ ] 后端：`/api/enhance/structure` 接受请求
- [ ] 后端：控制台显示附件日志
- [ ] 测试：运行 `./test_attachment_feature.sh` 全部通过

---

## 💡 使用示例

### 示例1：图片分析
```
提示词: "分析这张产品截图"
附件: screenshot.png
模式: Structure first
结果: 详细的结构化分析prompt
```

### 示例2：多文件上下文
```
提示词: "写产品发布公告"
附件: features.pdf, demo.mp4, logo.png
模式: Style & tone
结果: 专业的发布公告prompt
```

---

## 📞 获取帮助

- 📧 Email: PromptlyGuli@gmail.com
- 📖 完整文档: `ATTACHMENT_USER_GUIDE.md`
- 🧪 测试脚本: `test_attachment_feature.sh`

---

**版本**: 1.0 | **更新**: 2025-11-30 | **兼容**: Promptly v0.6.8.3+


