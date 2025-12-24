import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

import { resolveModelName } from './src/lib/modelRegistry.js';
import { chatText } from './src/lib/openaiClient.js';

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
      const start = Date.now();
      const result = await chatText([
        { role: 'user', content: 'Hi' } // 极短内容，省 Token
      ], { model: id }); // 传入前端 ID，让系统自己解析
      
      const duration = Date.now() - start;
      console.log(`🎉 调用成功! 耗时: ${duration}ms`);
      // 注意：我们在 openaiClient.js 里加了日志，控制台会打印最终使用的模型
    } catch (err) {
      console.error(`❌ 调用失败: ${err.message}`);
    }
  }
}

verify();
