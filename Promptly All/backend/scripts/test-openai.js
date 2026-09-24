#!/usr/bin/env node

/**
 * OpenAI API Key 诊断工具
 * 运行此脚本来验证 OpenAI API Key 是否正确配置
 */

import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

console.log("=".repeat(60));
console.log("OpenAI API Key 诊断工具");
console.log("=".repeat(60));
console.log();

// 1. 检查环境变量
console.log("📋 1. 检查环境变量");
console.log("-".repeat(60));

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error("❌ 错误：OPENAI_API_KEY 环境变量未设置！");
  console.log();
  console.log("解决方案：");
  console.log("  1. 检查 .env 文件是否存在");
  console.log("  2. 确认 .env 文件中有 OPENAI_API_KEY=sk-...");
  console.log("  3. 在 Render 中检查环境变量设置");
  process.exit(1);
}

// 检查格式
console.log("✅ OPENAI_API_KEY 已设置");
console.log(`   长度: ${apiKey.length} 字符`);
console.log(`   前缀: ${apiKey.substring(0, 7)}...`);
console.log(`   后缀: ...${apiKey.substring(apiKey.length - 4)}`);

// 检查常见问题
const issues = [];

if (apiKey.includes(" ")) {
  issues.push("⚠️  警告：API Key 中包含空格");
}

if (apiKey.includes("\n") || apiKey.includes("\r")) {
  issues.push("⚠️  警告：API Key 中包含换行符");
}

if (!apiKey.startsWith("sk-")) {
  issues.push("⚠️  警告：API Key 不是以 'sk-' 开头（可能不是有效格式）");
}

if (apiKey.length < 40) {
  issues.push("⚠️  警告：API Key 长度异常短（可能不完整）");
}

if (issues.length > 0) {
  console.log();
  console.log("发现问题：");
  issues.forEach(issue => console.log(`  ${issue}`));
}

console.log();

// 2. 测试 API 连接
console.log("🔌 2. 测试 OpenAI API 连接");
console.log("-".repeat(60));

const client = new OpenAI({ apiKey });

try {
  console.log("正在测试：列出可用模型...");
  const models = await client.models.list();
  console.log("✅ 连接成功！API Key 有效。");
  console.log(`   找到 ${models.data.length} 个可用模型`);
  
  // 检查常用模型
  const modelIds = models.data.map(m => m.id);
  const targetModel = process.env.OPENAI_MODEL || "gpt-4o-mini";
  
  if (modelIds.includes(targetModel)) {
    console.log(`   ✅ 目标模型 '${targetModel}' 可用`);
  } else {
    console.log(`   ⚠️  目标模型 '${targetModel}' 未找到`);
    console.log(`   前 5 个可用模型：`);
    modelIds.slice(0, 5).forEach(id => console.log(`      - ${id}`));
  }
} catch (error) {
  console.error("❌ API 连接失败！");
  console.log();
  console.log("错误详情：");
  console.log(`   状态码: ${error.status || 'N/A'}`);
  console.log(`   错误类型: ${error.type || 'N/A'}`);
  console.log(`   错误代码: ${error.code || 'N/A'}`);
  console.log(`   错误消息: ${error.message || 'N/A'}`);
  console.log();
  
  // 根据错误类型提供建议
  if (error.status === 401) {
    console.log("💡 可能的原因：");
    console.log("   1. API Key 格式错误或不完整");
    console.log("   2. API Key 已被撤销或禁用");
    console.log("   3. API Key 中有多余的空格或特殊字符");
    console.log();
    console.log("解决方案：");
    console.log("   1. 在 OpenAI Platform 重新生成一个新的 API Key");
    console.log("   2. 确保复制时没有包含空格或换行");
    console.log("   3. 在 Render 中直接粘贴，不要手动输入");
  } else if (error.status === 429) {
    console.log("💡 速率限制错误：");
    console.log("   你的 API 请求过于频繁，请等待几分钟后重试");
  } else if (error.status === 403) {
    console.log("💡 权限错误：");
    console.log("   1. 检查账户余额是否充足");
    console.log("   2. 访问 https://platform.openai.com/account/billing");
  } else {
    console.log("💡 其他错误：");
    console.log("   检查网络连接或访问 https://status.openai.com/");
  }
  
  process.exit(1);
}

console.log();

// 3. 测试聊天完成
console.log("💬 3. 测试聊天完成（Chat Completion）");
console.log("-".repeat(60));

try {
  const targetModel = process.env.OPENAI_MODEL || "gpt-4o-mini";
  console.log(`正在测试模型：${targetModel}`);
  
  const completion = await client.chat.completions.create({
    model: targetModel,
    messages: [{ role: "user", content: "Say 'test success' in JSON format" }],
    response_format: { type: "json_object" },
    max_tokens: 50
  });
  
  console.log("✅ 聊天完成测试成功！");
  console.log(`   模型: ${completion.model}`);
  console.log(`   响应: ${completion.choices[0].message.content}`);
  console.log(`   使用 Tokens: ${completion.usage.total_tokens}`);
} catch (error) {
  console.error("❌ 聊天完成测试失败！");
  console.log();
  console.log("错误详情：");
  console.log(`   ${error.message}`);
  console.log();
  
  if (error.code === "model_not_found") {
    console.log("💡 模型不存在或无权访问");
    console.log(`   尝试使用默认模型：gpt-3.5-turbo 或 gpt-4-turbo-preview`);
  } else if (error.code === "insufficient_quota") {
    console.log("💡 配额不足：");
    console.log("   你的账户余额不足，请访问：");
    console.log("   https://platform.openai.com/account/billing");
  }
  
  process.exit(1);
}

console.log();
console.log("=".repeat(60));
console.log("✅ 所有测试通过！OpenAI API 配置正确。");
console.log("=".repeat(60));
console.log();
console.log("如果在 Render 上仍然遇到问题，请：");
console.log("  1. 确认在 Render 中设置了正确的环境变量");
console.log("  2. 触发手动重新部署（Manual Deploy）");
console.log("  3. 检查 Render 日志中的完整错误信息");
console.log();

