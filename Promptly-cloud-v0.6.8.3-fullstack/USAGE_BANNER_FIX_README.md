# 使用量横幅修复 - 快速开始指南

## 👋 欢迎

这个修复包解决了"用户使用功能后，横幅使用量统计不更新"的问题。

---

## 🚀 快速开始（3 步搞定）

### 第 1 步：运行快速检查

```bash
node quick-check.js
```

这会检查你的系统是否准备好部署。

### 第 2 步：部署到 Render

```bash
git add -A
git commit -m "fix: 修复使用量统计不更新的问题"
git push origin cursor-dev
```

Render 会自动部署（等待 2-3 分钟）。

### 第 3 步：验证修复

1. 登录你的网站
2. 使用一次 Prompt Optimization
3. 刷新页面（F5）
4. 查看横幅：应该显示 `1/8 prompts/day` ✅

**如果没有更新，继续往下看。**

---

## 📚 文档导航

### 😊 我只想快速部署

**阅读：** `FIX_USAGE_BANNER_DEPLOYMENT.md`

这个文档包含：
- 完整的部署步骤
- 测试清单
- 验证方法

大约需要 **10 分钟**。

---

### 🔍 我想了解问题的原因

**阅读：** `USAGE_BANNER_FIX_SUMMARY.md`

这个文档包含：
- 问题根本原因分析
- 修复方案详解
- 完整的验收标准
- 长期监控建议

大约需要 **15 分钟**。

---

### 🐛 部署后仍然有问题

**阅读：** `DEBUG_USAGE_BANNER.md`

这个文档包含：
- 如何获取 User ID
- 完整的调试流程
- 常见问题解决方案
- 诊断工具使用方法

大约需要 **20 分钟**。

---

### 🛠️ 我想深入诊断数据库

**运行：** 

```bash
# 首先获取你的 User ID（见 DEBUG_USAGE_BANNER.md）
# 然后运行诊断脚本
node debug-usage-banner.js YOUR_USER_ID
```

这个脚本会：
- ✅ 检查用户是否存在
- ✅ 检查 plan_usage 表
- ✅ 显示今天的使用记录
- ✅ 显示最近的使用历史
- ✅ 模拟 API 返回的数据
- ✅ 提供诊断建议

---

## 📁 文件说明

### 修改的代码文件

- **backend/src/routes/pipeline.js** - 修复了 recordUsage 调用位置 ⚠️ 核心修复

### 新增的文档文件

- **USAGE_BANNER_FIX_SUMMARY.md** - 完整的修复摘要（推荐先读这个）
- **FIX_USAGE_BANNER_DEPLOYMENT.md** - 部署和测试指南
- **DEBUG_USAGE_BANNER.md** - 详细的调试指南
- **USAGE_BANNER_FIX_README.md** - 本文件

### 新增的工具脚本

- **quick-check.js** - 快速健康检查
- **debug-usage-banner.js** - 深度诊断脚本

---

## ⏱️ 时间预估

### 最快路径（如果一切顺利）

1. 运行 `quick-check.js` - **1 分钟**
2. Git commit & push - **2 分钟**
3. 等待 Render 部署 - **2-3 分钟**
4. 快速验证 - **2 分钟**

**总计：约 8 分钟** ⚡

### 完整路径（包括理解和测试）

1. 阅读 `USAGE_BANNER_FIX_SUMMARY.md` - **15 分钟**
2. 运行 `quick-check.js` - **2 分钟**
3. 部署到 Render - **5 分钟**
4. 完整测试所有场景 - **15 分钟**
5. 阅读监控建议 - **5 分钟**

**总计：约 40 分钟** 📖

### 出问题时的路径（需要调试）

1. 尝试快速部署 - **10 分钟**
2. 发现仍有问题 - **5 分钟**
3. 阅读 `DEBUG_USAGE_BANNER.md` - **20 分钟**
4. 运行 `debug-usage-banner.js` - **5 分钟**
5. 根据诊断结果修复 - **10-30 分钟**
6. 重新部署和验证 - **10 分钟**

**总计：约 60-80 分钟** 🔧

---

## 🎯 成功标志

### 你会知道修复成功了，当你看到：

#### ✅ 在后端日志中（Render Logs）

```
[pipeline] Recording usage for user github_123456
[planLimits] ✅ Usage recorded successfully
```

#### ✅ 在前端横幅上

```
使用前：🎯 0/8 prompts/day
使用后：🎯 1/8 prompts/day  ← 这个数字变了！
```

#### ✅ 在浏览器 Console 中

```
[Plan Banner] ✅ Showing FREE plan info: 1/8 prompts, 0/5 wizards
```

#### ✅ 在 Network 面板中

```json
{
  "usage": {
    "promptOptimization": 1  ← 这个数字增加了！
  }
}
```

---

## 🆘 需要帮助？

### 场景 1：快速检查失败

→ 阅读 `quick-check.js` 的输出，按照提示修复

### 场景 2：部署后横幅仍显示 0/8

→ 阅读 `DEBUG_USAGE_BANNER.md`  
→ 运行 `node debug-usage-banner.js YOUR_USER_ID`  
→ 查看诊断结果

### 场景 3：后端日志没有 recordUsage

→ 检查 Render 部署状态  
→ 确认代码已正确部署  
→ 查看 `FIX_USAGE_BANNER_DEPLOYMENT.md` 的故障排除部分

### 场景 4：API 返回正确但前端不更新

→ 清除浏览器缓存  
→ 硬刷新（Ctrl + F5）  
→ 检查浏览器 Console 是否有 JavaScript 错误

---

## 📞 联系支持

如果尝试了所有方法仍无法解决，请提供：

1. **User ID**（可脱敏显示前几位）
2. **quick-check.js 的输出**
3. **debug-usage-banner.js 的输出**
4. **Render 后端日志截图**（使用功能前后）
5. **浏览器 Console 日志截图**
6. **/api/billing/status 的响应数据**（Network 面板）

---

## 🎉 额外奖励

修复完成后，你的系统将具备：

- ✨ 实时的使用量统计
- 🎯 准确的免费额度跟踪
- 🛡️ 可靠的限制执行
- 📊 完整的使用记录（用于分析）
- 🔍 强大的调试工具（debug-usage-banner.js）
- 📚 详细的文档（方便未来维护）

---

## 📝 备注

- 所有脚本都需要在项目根目录运行
- 确保 `backend/package.json` 中有 `better-sqlite3` 依赖
- 数据库路径默认是 `./data/app-v0-7.db`，可通过 `SQLITE_PATH` 环境变量修改
- 时区使用 UTC，确保服务器时区设置正确

---

**开始修复吧！祝你好运！🚀**

有问题随时查看相关文档，每个文档都有详细的步骤说明。
