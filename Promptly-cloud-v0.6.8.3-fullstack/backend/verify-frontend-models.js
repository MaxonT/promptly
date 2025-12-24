import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

// Dynamic import to ensure env vars are loaded BEFORE openaiClient.js is evaluated
const { resolveModelName } = await import('./src/lib/modelRegistry.js');
const { chatText } = await import('./src/lib/openaiClient.js');

// 模拟前端传来的三个 ID
const FRONTEND_CHOICES = [
  'promptly-v0-mini',
  'promptly-v0',
  'promptly-v0-max'
];

async function verify() {
  console.log("🚀 开始验证前端模型选项的实际调用...\n");

  for (const id of FRONTEND_CHOICES) {
    console.log(`\n--- 测试选项: [${id}] ---`);
    
    // 1. 验证解析逻辑
    const resolved = resolveModelName(id);
    console.log(`✅ 解析结果: ${resolved}`);
    
    // 2. 验证实际调用 (发送一个极简请求)
    try {
      console.log(`📡 发起请求 (模拟实际调用)...`);
      
      // Print debug info about env vars
      if (id === FRONTEND_CHOICES[0]) {
         console.log(`[Debug] OPENAI_BASE_URL: ${process.env.OPENAI_BASE_URL || 'Using Default (OpenAI)'}`);
         console.log(`[Debug] OPENAI_MODEL (Env): ${process.env.OPENAI_MODEL}`);
      }

      const start = Date.now();
      // Use correct object signature for chatText
      const result = await chatText({
        user: 'Hi', // 极短内容，省 Token
        model: id   // 传入前端 ID，让系统自己解析
      }); 
      
      const duration = Date.now() - start;
      console.log(`🎉 调用成功! 耗时: ${duration}ms`);
      // 注意：我们在 openaiClient.js 里加了日志，控制台会打印最终使用的模型
    } catch (err) {
      console.error(`❌ 调用失败: ${err.message}`);
    }
  }
}

verify();
