#!/usr/bin/env node

/**
 * 测试修复的脚本
 * 验证多语言和空值问题是否已解决
 */

import { generateBroadQuestions, generateChoiceQuestions, generateRawSpec } from './backend/src/lib/llmAgents.js';

console.log("🧪 开始测试修复...\n");

// 测试1: 多语言支持
console.log("📋 测试1: 多语言支持");
console.log("-".repeat(50));

try {
  // 测试中文问题生成
  console.log("📝 生成中文问题...");
  const chineseQuestions = await generateBroadQuestions({
    initialDescription: "一个在线购物网站",
    kind: "web",
    modeProfile: null,
    model: "gpt-4o-mini",
    language: "zh-CN"
  });
  
  if (chineseQuestions && chineseQuestions.broad_questions && chineseQuestions.broad_questions.length > 0) {
    console.log("✅ 中文问题生成成功");
    console.log("第一个问题:", chineseQuestions.broad_questions[0].question);
    
    // 检查是否真的是中文
    const firstQuestion = chineseQuestions.broad_questions[0].question;
    if (/[\u4e00-\u9fff]/.test(firstQuestion)) {
      console.log("✅ 检测到中文内容");
    } else {
      console.log("⚠️  看起来还是英文");
    }
  } else {
    console.log("❌ 中文问题生成失败");
  }
  
} catch (error) {
  console.log("❌ 中文测试失败:", error.message);
}

console.log();

// 测试2: 空值修复
console.log("📋 测试2: 空值修复");
console.log("-".repeat(50));

try {
  console.log("📝 测试spec生成...");
  
  // 模拟一些问答数据
  const qaPairs = [
    { question: "项目目标是什么？", answer: "创建一个在线购物平台" },
    { question: "目标用户是谁？", answer: "18-45岁的消费者" },
    { question: "关键功能有哪些？", answer: "用户注册、商品浏览、购物车、支付" }
  ];
  
  const rawSpec = await generateRawSpec({
    qaPairs,
    initialDescription: "在线购物网站",
    kind: "web",
    modeProfile: null,
    model: "gpt-4o-mini",
    language: "zh-CN"
  });
  
  if (rawSpec && rawSpec.spec) {
    console.log("✅ Spec生成成功");
    
    const spec = rawSpec.spec;
    let hasEmptyFields = false;
    
    // 检查各个字段
    const fieldsToCheck = [
      'project_goal', 'objectives', 'target_users', 
      'platform', 'key_features', 'technical_stack'
    ];
    
    fieldsToCheck.forEach(field => {
      const value = spec[field];
      if (value === null || value === undefined || 
          (Array.isArray(value) && value.length === 0) ||
          (typeof value === 'string' && value.trim() === '')) {
        console.log(`❌ ${field} 字段为空`);
        hasEmptyFields = true;
      } else {
        console.log(`✅ ${field} 字段有值:`, 
          Array.isArray(value) ? `${value.length}个项目` : 
          typeof value === 'string' ? value.substring(0, 50) + '...' : value
        );
      }
    });
    
    if (!hasEmptyFields) {
      console.log("✅ 所有字段都有有效值");
    }
    
  } else {
    console.log("❌ Spec生成失败");
  }
  
} catch (error) {
  console.log("❌ Spec测试失败:", error.message);
}

console.log("\n🏁 测试完成");