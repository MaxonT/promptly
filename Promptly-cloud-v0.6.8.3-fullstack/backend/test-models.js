import 'dotenv/config';
import { resolveModelName } from './src/lib/modelRegistry.js';
import { chatText } from './src/lib/openaiClient.js';

async function testModelResolution() {
  console.log("--- 1. 检查解析逻辑 ---");
  const modelsToTest = ['promptly', 'qwen-2.5-72b', 'llama-3.1-8b', 'non-existent'];
  
  for (const id of modelsToTest) {
    const resolved = resolveModelName(id);
    console.log(`输入ID: [${id}] -> 解析后模型名: [${resolved}]`);
  }

  console.log("\n--- 2. 模拟实际 LLM 调用 ---");
  try {
    // 故意用一个可能不存在的模型触发调用
    console.log("尝试调用模型...");
    const result = await chatText([
      { role: 'user', content: 'Respond with "OK" if you receive this.' }
    ], { model: 'promptly' });
    
    // 注意：我们在 openaiClient.js 修改过逻辑，它会打印 fallback 日志
    console.log("调用成功。");
  } catch (err) {
    console.error("调用彻底失败:", err.message);
  }
}

testModelResolution();
