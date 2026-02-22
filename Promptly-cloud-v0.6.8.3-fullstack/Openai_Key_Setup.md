# 🔑 OpenAI API Key 设置指南

## 🚨 当前错误

你看到这个错误：
```
HTTP 502: Invalid OpenAI API Key
```

或后端日志显示：
```
status: 401
code: 'invalid_api_key'
message: 'Incorrect API key provided'
```

## ✅ 解决方案（5 分钟）

### 步骤 1: 获取有效的 OpenAI API Key

#### 选项 A: 使用现有 API Key

1. 登录 [OpenAI Platform](https://platform.openai.com/api-keys)
2. 找到你的 API Key 列表
3. 如果有现有的 key，点击 **Copy** 复制

#### 选项 B: 创建新的 API Key

1. 登录 [OpenAI Platform](https://platform.openai.com/api-keys)
2. 点击 **+ Create new secret key**
3. 给 key 起个名字（例如："Promptly Production"）
4. 点击 **Create secret key**
5. **立即复制并保存**（只会显示一次！）

格式应该类似：`sk-proj-...` 或 `sk-...`

#### 选项 C: 检查账户余额

即使 key 有效，也需要有余额才能使用：

1. 访问 [Billing Overview](https://platform.openai.com/account/billing/overview)
2. 检查是否有可用余额
3. 如果没有，点击 **Add payment method** 充值（推荐 $10）

---

### 步骤 2: 在 Render 中设置 API Key

1. 登录 [Render Dashboard](https://dashboard.render.com/)

2. 进入你的服务：`promptly-v0-6-cloudtest`

3. 点击左侧 **Environment** 标签

4. 找到 `OPENAI_API_KEY` 变量

5. 点击右侧的 **Edit** 按钮（铅笔图标）

6. 粘贴你的新 API Key

7. 点击 **Save Changes**

---

### 步骤 3: 等待自动重新部署

- Render 会自动检测环境变量更改
- 服务会重新部署（约 1-2 分钟）
- 在 **Logs** 标签可以看到部署进度

---

### 步骤 4: 验证修复

#### 测试 1: 检查后端日志

部署完成后，在 Render Logs 应该看到：
```
[promptly] Demo user ensured
[promptly] backend listening on :10000
Your service is live 🎉
```

**不应该再有** 401 或 `invalid_api_key` 错误。

#### 测试 2: 手动测试 API

```bash
curl -X POST https://promptly-v0-6-cloudtest.onrender.com/api/question-sessions \
  -H "Content-Type: application/json" \
  -d '{"initial_description":"创建一个待办事项应用","kind":"coding"}'
```

成功的响应应该包含：
```json
{
  "ok": true,
  "session_id": "sess_...",
  "questions": [...]
}
```

#### 测试 3: 前端测试

1. 访问：https://promptly-v0-6-cloud-test.vercel.app/test-connection.html
2. 所有 4 项测试应该通过 ✓
3. 特别是 "创建测试会话" 应该成功

#### 测试 4: Question Wizard

1. 访问：https://promptly-v0-6-cloud-test.vercel.app/
2. 点击 **Start Question Wizard**
3. 输入："创建一个在线记事本，支持 Markdown"
4. 点击开始
5. 应该看到 5 个问题！🎉

---

## 🔍 验证 API Key 有效性

### 方法 1: 使用 curl 测试

```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer YOUR_API_KEY_HERE"
```

**成功**：返回模型列表
**失败**：返回 401 或 403 错误

### 方法 2: 在 Render 中测试

1. 进入 Render Dashboard → 你的服务
2. 点击右上角 **Shell**
3. 在 Shell 中运行：
   ```bash
   echo $OPENAI_API_KEY
   ```
4. 确认显示的是完整的 API Key（以 `sk-` 开头）

---

## ❓ 常见问题

### Q: 我没有 OpenAI 账户

**A:** 注册流程：
1. 访问 [OpenAI Signup](https://platform.openai.com/signup)
2. 使用邮箱或 Google/Microsoft 账户注册
3. 验证邮箱
4. 添加支付方式（需要信用卡）
5. 充值至少 $5（推荐 $10）

### Q: API Key 正确但还是报错

**可能原因**：
1. **账户余额不足** → 充值
2. **Key 被禁用** → 创建新的 key
3. **速率限制** → 等待几分钟或升级计划
4. **账户被封禁** → 联系 OpenAI 支持

### Q: 使用 API 会花多少钱？

**估算**（使用 GPT-4.1-mini）：
- 每次 Question Session：约 $0.01 - $0.05
- 100 次使用：约 $1 - $5
- $10 余额可以支持几百次使用

查看实时价格：[OpenAI Pricing](https://openai.com/pricing)

### Q: 可以使用免费的替代品吗？

目前代码使用 OpenAI API，但可以修改为支持：
- **Azure OpenAI**（企业级）
- **本地模型**（Ollama + Llama）
- **其他 API**（Anthropic Claude、Google Gemini）

需要修改 `backend/src/lib/openaiClient.js`

### Q: 如何查看 API 使用量？

1. 访问 [Usage Dashboard](https://platform.openai.com/usage)
2. 查看每日/每月使用量
3. 设置使用限额：[Limits](https://platform.openai.com/account/limits)

---

## 🛡️ 安全最佳实践

### ✅ 应该做：

1. **在环境变量中设置 API Key**（而不是代码中）
2. **定期轮换 API Key**（每 30-90 天）
3. **为不同项目使用不同的 Key**
4. **设置使用限额**（避免意外超支）
5. **监控使用情况**

### ❌ 不应该做：

1. **不要** 把 API Key 提交到 Git
2. **不要** 在前端代码中暴露 API Key
3. **不要** 与他人分享 API Key
4. **不要** 在公开的地方（论坛、聊天）粘贴 API Key
5. **不要** 使用已泄露的 Key（立即撤销）

---

## 📝 完整的环境变量清单

在 Render 中应该设置这些环境变量：

```bash
# 必需
OPENAI_API_KEY=sk-proj-your-actual-key-here

# 推荐
CORS_ORIGIN=https://promptly-v0-6-cloud-test.vercel.app
NODE_ENV=production

# 可选
OPENAI_MODEL=gpt-4.1-mini
PORT=10000
```

---

## 🆘 仍然有问题？

### 检查清单

- [ ] OpenAI 账户有余额
- [ ] API Key 格式正确（以 `sk-` 开头）
- [ ] API Key 在 OpenAI 平台显示为 Active
- [ ] Render 环境变量已更新
- [ ] Render 服务已重新部署
- [ ] 后端日志无 401 错误
- [ ] 手动 API 测试成功

### 获取帮助

如果全部检查后仍有问题：

1. **查看 Render 日志**（复制完整错误）
2. **测试 API Key**（使用上面的 curl 命令）
3. **检查 OpenAI 状态**：https://status.openai.com/
4. **联系支持**：PromptlyGuli@gmail.com

提供以下信息：
- Render 后端 URL
- 完整的错误日志
- API Key 测试结果（不要包含实际的 key！）

---

## ✨ 成功标志

设置成功后，你应该看到：

✅ Render 日志显示服务正常启动  
✅ 无 401 或 API Key 错误  
✅ Question Wizard 能生成问题列表  
✅ 测试页面所有检查通过  
✅ 可以完整走完问卷流程  

---

**现在去获取你的 OpenAI API Key 并设置到 Render 吧！** 🚀

设置完成后告诉我，我会帮你验证！

