#!/usr/bin/env node

/**
 * 调试多语言问题的脚本
 */

import { generateBroadQuestions } from './backend/src/lib/llmAgents.js';

console.log("🧪 调试多语言问题...\n");

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
  
  console.log("原始响应:", JSON.stringify(chineseQuestions, null, 2));
  
  if (chineseQuestions && chineseQuestions.broad_questions && chineseQuestions.broad_questions.length > 0) {
    console.log("✅ 中文问题生成成功");
    console.log("第一个问题:", chineseQuestions.broad_questions[0].question);
    
    // 检查是否真的是中文
    const firstQuestion = chineseQuestions.broad_questions[0].question;
    if (/[\u4e00-\u9fff]/.test(firstQuestion)) {
      console.log("✅ 检测到中文内容");
    } else {
      console.log("⚠️  看起来还是英文");
      console.log("问题内容:", firstQuestion);
    }
  } else {
    console.log("❌ 中文问题生成失败");
    console.log("响应结构:", chineseQuestions);
  }
  
} catch (error) {
  console.log("❌ 中文测试失败:", error.message);
  console.log("错误堆栈:", error.stack);
}