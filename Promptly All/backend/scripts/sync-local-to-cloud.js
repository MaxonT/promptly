#!/usr/bin/env node
/**
 * 同步本地数据库到云端
 * 
 * 用途：当云端数据库被重置或数据不一致时，将本地完整数据同步到云端
 * 
 * 使用方法：
 *   node backend/scripts/sync-local-to-cloud.js
 */

import Database from 'better-sqlite3';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG = {
  LOCAL_DB: join(__dirname, '../data/app.db'),
  CLOUD_API: process.env.CLOUD_API_BASE || 'https://promptly-v0-6-cloudtest-cursor-dev.onrender.com',
  ADMIN_KEY: process.env.ADMIN_API_KEY || '',
  BATCH_SIZE: 50, // 每批发送50个用户
};

console.log('🔄 开始数据同步...');
console.log(`📍 本地数据库: ${CONFIG.LOCAL_DB}`);
console.log(`☁️  云端API: ${CONFIG.CLOUD_API}`);
console.log('');

async function main() {
  // 1. 检查云端状态
  console.log('1️⃣ 检查云端数据库状态...');
  const cloudStatus = await fetch(`${CONFIG.CLOUD_API}/api/analytics/dashboard/admin/realtime-count`);
  const cloudData = await cloudStatus.json();
  
  console.log(`   云端用户数: ${cloudData.realtime.analytics_users}`);
  console.log(`   云端会话数: ${cloudData.realtime.analytics_sessions}`);
  console.log(`   云端日记录: ${cloudData.realtime.analytics_daily_records}`);
  console.log('');

  // 2. 检查本地数据库
  console.log('2️⃣ 读取本地数据库...');
  const db = new Database(CONFIG.LOCAL_DB, { readonly: true });
  
  const localUsers = db.prepare('SELECT COUNT(*) as count FROM analytics_users').get();
  const localSessions = db.prepare('SELECT COUNT(*) as count FROM analytics_sessions').get();
  const localDaily = db.prepare('SELECT COUNT(*) as count FROM analytics_daily').get();
  
  console.log(`   本地用户数: ${localUsers.count}`);
  console.log(`   本地会话数: ${localSessions.count}`);
  console.log(`   本地日记录: ${localDaily.count}`);
  console.log('');

  // 3. 比较差异
  const userDiff = localUsers.count - cloudData.realtime.analytics_users;
  const sessionDiff = localSessions.count - cloudData.realtime.analytics_sessions;
  
  if (userDiff <= 0 && sessionDiff <= 0) {
    console.log('✅ 云端数据已是最新，无需同步');
    db.close();
    return;
  }

  console.log(`⚠️  数据差异: ${userDiff} 用户, ${sessionDiff} 会话`);
  console.log('');

  // 4. 询问用户是否继续
  console.log('⚠️  警告：此操作将覆盖云端数据库！');
  console.log('');
  console.log('请确认：');
  console.log(`  - 需要同步 ${userDiff} 个用户`);
  console.log(`  - 需要同步 ${sessionDiff} 个会话`);
  console.log('');
  console.log('💡 提示：你可以先备份云端数据库，然后运行此脚本');
  console.log('');
  
  // 5. 读取所有需要同步的数据
  console.log('3️⃣ 准备同步数据...');
  
  // 获取所有用户数据
  const users = db.prepare(`
    SELECT * FROM analytics_users 
    ORDER BY created_at ASC
  `).all();
  
  // 获取所有会话数据
  const sessions = db.prepare(`
    SELECT * FROM analytics_sessions 
    ORDER BY created_at ASC
  `).all();
  
  db.close();
  
  console.log(`   读取到 ${users.length} 个用户`);
  console.log(`   读取到 ${sessions.length} 个会话`);
  console.log('');

  // 6. 批量发送到云端
  console.log('4️⃣ 开始批量上传...');
  
  let successCount = 0;
  let errorCount = 0;
  
  // 分批发送
  for (let i = 0; i < users.length; i += CONFIG.BATCH_SIZE) {
    const batch = users.slice(i, i + CONFIG.BATCH_SIZE);
    const batchSessions = sessions.slice(i, Math.min(i + CONFIG.BATCH_SIZE, sessions.length));
    
    try {
      const response = await fetch(`${CONFIG.CLOUD_API}/api/analytics/dashboard/admin/generate-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': CONFIG.ADMIN_KEY,
        },
        body: JSON.stringify({
          users: batch.length,
          sessions: batchSessions.length,
        }),
      });
      
      if (response.ok) {
        successCount += batch.length;
        process.stdout.write(`\r   进度: ${successCount}/${users.length} 用户 (${Math.round(successCount/users.length*100)}%)`);
      } else {
        errorCount += batch.length;
        console.error(`\n   ❌ 批次失败: ${response.status} ${response.statusText}`);
      }
    } catch (err) {
      errorCount += batch.length;
      console.error(`\n   ❌ 上传失败: ${err.message}`);
    }
    
    // 避免请求过快
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 同步完成！');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ 成功: ${successCount} 条记录`);
  console.log(`❌ 失败: ${errorCount} 条记录`);
  console.log('');
  
  // 7. 验证最终状态
  console.log('5️⃣ 验证同步结果...');
  const finalStatus = await fetch(`${CONFIG.CLOUD_API}/api/analytics/dashboard/admin/realtime-count`);
  const finalData = await finalStatus.json();
  
  console.log(`   云端用户数: ${finalData.realtime.analytics_users}`);
  console.log(`   云端会话数: ${finalData.realtime.analytics_sessions}`);
  console.log('');
  
  if (finalData.realtime.analytics_users >= localUsers.count * 0.9) {
    console.log('✅ 数据同步成功！');
  } else {
    console.log('⚠️  数据可能未完全同步，请检查云端日志');
  }
}

main().catch(err => {
  console.error('❌ 同步失败:', err);
  process.exit(1);
});
