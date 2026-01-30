#!/usr/bin/env node

/**
 * 数据同步脚本 - 在backend中运行（分批发送模式）
 * 
 * 使用方式:
 *   cd backend && node scripts/sync-to-cloud.js <cloud-url>
 *   例如: cd backend && node scripts/sync-to-cloud.js https://promptly-v0-6-cloudtest-cursor-dev.onrender.com
 * 
 * 特点: 分批发送大数据，避免单个请求过大导致超时
 */

import Database from 'better-sqlite3';
import fetch from 'node-fetch';

const cloudUrl = process.argv[2];
if (!cloudUrl) {
  console.error('❌ 请提供云端URL');
  console.error('使用方式: node scripts/sync-to-cloud.js <cloud-url>');
  console.error('例如: node scripts/sync-to-cloud.js https://promptly-v0-6-cloudtest-cursor-dev.onrender.com');
  process.exit(1);
}

console.log('════════════════════════════════════════════════════════════');
console.log('📤 Promptly 数据同步工具（分批模式）');
console.log('════════════════════════════════════════════════════════════');
console.log(`📍 本地数据库: ./data/app.db`);
console.log(`☁️  云端URL: ${cloudUrl}`);
console.log('');

const BATCH_SIZE = 300; // 每批300条记录，避免请求过大

/**
 * 发送单批数据到云端
 */
async function sendBatch(cloudUrl, payload, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒超时
      
      const response = await fetch(`${cloudUrl}/api/admin/sync-data?_skip_validation=true`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SYNC_TOKEN || ''}`,
          'X-Skip-Validation': 'true'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${response.status} ${response.statusText}`);
      }
      
      return await response.json();
      
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }
      console.log(`   ⚠️  重试第 ${attempt} 次...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}

async function syncData() {
  try {
    // 1. 连接本地数据库
    console.log('🔗 连接本地数据库...');
    const db = new Database('./data/app.db');
    
    // 2. 导出analytics数据
    console.log('📊 导出Analytics数据...');
    const analyticsUsers = db.prepare('SELECT * FROM analytics_users').all();
    const analyticsSessions = db.prepare('SELECT * FROM analytics_sessions').all();
    const analyticsDaily = db.prepare('SELECT * FROM analytics_daily').all();
    
    console.log(`   ✅ Users: ${analyticsUsers.length} 条`);
    console.log(`   ✅ Sessions: ${analyticsSessions.length} 条`);
    console.log(`   ✅ Daily: ${analyticsDaily.length} 条`);
    
    db.close();
    
    // 3. 发送数据，分批处理大数据
    console.log('');
    console.log('📤 发送数据到云端...');
    
    let totalCount = 0;
    
    // 分批发送users数据
    if (analyticsUsers.length > 0) {
      const batches = Math.ceil(analyticsUsers.length / BATCH_SIZE);
      console.log(`   📤 Users数据（${batches}批，每批${BATCH_SIZE}条）...`);
      for (let i = 0; i < analyticsUsers.length; i += BATCH_SIZE) {
        const batch = analyticsUsers.slice(i, i + BATCH_SIZE);
        const result = await sendBatch(cloudUrl, { analytics: { users: batch } });
        totalCount += result.analyticsCount || 0;
        const progress = Math.min(i + BATCH_SIZE, analyticsUsers.length);
        console.log(`      [${progress}/${analyticsUsers.length}]`);
      }
    }
    
    // 分批发送sessions数据
    if (analyticsSessions.length > 0) {
      const batches = Math.ceil(analyticsSessions.length / BATCH_SIZE);
      console.log(`   📤 Sessions数据（${batches}批）...`);
      for (let i = 0; i < analyticsSessions.length; i += BATCH_SIZE) {
        const batch = analyticsSessions.slice(i, i + BATCH_SIZE);
        const result = await sendBatch(cloudUrl, { analytics: { sessions: batch } });
        totalCount += result.analyticsCount || 0;
        const progress = Math.min(i + BATCH_SIZE, analyticsSessions.length);
        console.log(`      [${progress}/${analyticsSessions.length}]`);
      }
    }
    
    // 发送daily汇总数据
    if (analyticsDaily.length > 0) {
      console.log(`   📤 Daily汇总数据...`);
      const result = await sendBatch(cloudUrl, { analytics: { daily: analyticsDaily } });
      totalCount += result.analyticsCount || 0;
    }
    
    console.log('');
    console.log(`✨ 数据同步完成!`);
    console.log(`   📊 总共同步: ${totalCount} 条数据`);
    console.log('════════════════════════════════════════════════════════════');
    
  } catch (error) {
    console.error('');
    console.error('❌ 同步失败:', error.message);
    console.error('');
    console.error('💡 可能的原因:');
    console.error('   1. 云端URL不正确或服务未启动');
    console.error('   2. 云端未更新admin路由');
    console.error('   3. 网络连接问题或超时');
    console.error('');
    process.exit(1);
  }
}

syncData();
