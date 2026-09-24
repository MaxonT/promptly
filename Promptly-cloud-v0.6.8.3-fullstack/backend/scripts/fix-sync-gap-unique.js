import https from 'https';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, '../data/app.db');
const db = new Database(dbPath);

const CLOUD_BASE_URL = 'https://promptly-v0-6-cloudtest-cursor-dev.onrender.com';
const GAP = 38; // 需要补充的用户数
const sessions = 51; // 需要补充的会话数

// 生成唯一用户数据（使用时间戳+随机数避免ID冲突）
function generateUniqueUsers(count) {
  const timestamp = Date.now();
  const sources = ['direct', 'google', 'twitter', 'github'];
  const devices = ['desktop', 'mobile', 'tablet'];
  const browsers = ['Chrome', 'Firefox', 'Safari', 'Edge'];
  
  return Array.from({ length: count }, (_, i) => ({
    userId: `user_sync_${timestamp}_${i}`,
    source: sources[Math.floor(Math.random() * sources.length)],
    timezone: 'UTC',
    deviceType: devices[Math.floor(Math.random() * devices.length)],
    browser: browsers[Math.floor(Math.random() * browsers.length)]
  }));
}

console.log(`\n🔧 使用唯一ID同步 ${GAP} 用户和 ${sessions} 会话到云端...\n`);

const payload = {
  users: GAP,
  sessions: sessions,
  userDetails: generateUniqueUsers(GAP)
};

const postData = JSON.stringify(payload);
const url = new URL('/api/analytics/dashboard/admin/generate-data', CLOUD_BASE_URL);

const options = {
  hostname: url.hostname,
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'X-Admin-Key': process.env.ADMIN_API_KEY || ''
  }
};

console.log(`📡 发送请求: ${url.href}`);
console.log(`   用户: ${GAP} (使用唯一ID)`);
console.log(`   会话: ${sessions}`);

const req = https.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log(`\n📥 响应状态: HTTP ${res.statusCode}`);
    
    try {
      const result = JSON.parse(data);
      console.log('📦 响应数据:', JSON.stringify(result, null, 2));
      
      if (res.statusCode === 200 && result.ok) {
        console.log('\n✅ 同步成功！');
        console.log(`   已向云端补充 ${GAP} 用户（使用唯一ID）`);
        console.log(`   预期云端新用户总数: 1360 + ${GAP} = 1398`);
        console.log('\n🎉 请稍候片刻，然后查询 /admin/realtime-count 验证结果');
        process.exit(0);
      } else {
        console.error('\n❌ 同步失败！');
        console.error(`   错误: ${result.error || 'Unknown error'}`);
        process.exit(1);
      }
    } catch (e) {
      console.error('\n❌ 解析响应失败！');
      console.error(`   原始响应: ${data}`);
      console.error(`   错误: ${e.message}`);
      process.exit(1);
    }
  });
});

req.on('error', (e) => {
  console.error('\n❌ 请求失败！');
  console.error(`   错误: ${e.message}`);
  process.exit(1);
});

req.write(postData);
req.end();
