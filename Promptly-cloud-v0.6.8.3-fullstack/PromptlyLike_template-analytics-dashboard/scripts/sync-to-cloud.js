#!/usr/bin/env node

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Analytics Dashboard - 跨环境数据同步脚本
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * 将本地数据库中的 Analytics 数据同步到远程云端环境。
 * 
 * 使用方式:
 *   node scripts/sync-to-cloud.js <cloud-url>
 *   
 * 示例:
 *   node scripts/sync-to-cloud.js https://your-app.onrender.com
 *   node scripts/sync-to-cloud.js https://your-app.herokuapp.com
 * 
 * 特点:
 *   - 分批发送，避免大请求超时
 *   - 自动重试失败请求
 *   - INSERT OR REPLACE 处理重复数据
 *   - 详细的进度输出
 * 
 * 环境变量:
 *   SYNC_TOKEN    - 同步认证令牌 (可选)
 *   LOCAL_DB_PATH - 本地数据库路径 (默认: ./data/app.db)
 *   BATCH_SIZE    - 每批记录数 (默认: 300)
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import Database from 'better-sqlite3';
import fetch from 'node-fetch';

// ═══════════════════════════════════════════════════════════════════════════════
// 配置
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  localDbPath: process.env.LOCAL_DB_PATH || './data/app.db',
  batchSize: parseInt(process.env.BATCH_SIZE) || 300,
  timeout: 30000,    // 30秒超时
  maxRetries: 3,
  retryDelay: 1000   // 重试延迟(ms)
};

// ═══════════════════════════════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════════════════════════════

function printBanner() {
  console.log('════════════════════════════════════════════════════════════');
  console.log('📤 Analytics Dashboard - 数据同步工具');
  console.log('════════════════════════════════════════════════════════════');
}

function printUsage() {
  console.log(`
使用方式:
  node scripts/sync-to-cloud.js <cloud-url>

示例:
  node scripts/sync-to-cloud.js https://your-app.onrender.com

环境变量:
  SYNC_TOKEN    - 同步认证令牌
  LOCAL_DB_PATH - 本地数据库路径 (默认: ./data/app.db)
  BATCH_SIZE    - 每批记录数 (默认: 300)
`);
}

/**
 * 发送单批数据到云端
 * @param {string} cloudUrl - 云端URL
 * @param {Object} payload - 数据负载
 * @param {number} retries - 当前重试次数
 * @returns {Promise<Object>} 响应数据
 */
async function sendBatch(cloudUrl, payload, retries = 0) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout);
    
    const response = await fetch(`${cloudUrl}/api/admin/sync-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SYNC_TOKEN || ''}`,
        'X-Sync-Source': 'analytics-sync-script'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText.slice(0, 100)}`);
    }
    
    return await response.json();
    
  } catch (error) {
    if (retries < CONFIG.maxRetries) {
      console.log(`   ⚠️  重试第 ${retries + 1} 次...`);
      await new Promise(resolve => setTimeout(resolve, CONFIG.retryDelay * (retries + 1)));
      return sendBatch(cloudUrl, payload, retries + 1);
    }
    throw error;
  }
}

/**
 * 分批发送表数据
 * @param {string} cloudUrl - 云端URL
 * @param {string} tableName - 表名
 * @param {Array} records - 记录数组
 */
async function syncTable(cloudUrl, tableName, records) {
  if (!records.length) {
    console.log(`   ⏭️  ${tableName}: 无数据，跳过`);
    return 0;
  }
  
  const batches = Math.ceil(records.length / CONFIG.batchSize);
  console.log(`   📤 ${tableName} (${records.length} 条, ${batches} 批)...`);
  
  let synced = 0;
  
  for (let i = 0; i < records.length; i += CONFIG.batchSize) {
    const batch = records.slice(i, i + CONFIG.batchSize);
    const result = await sendBatch(cloudUrl, { analytics: { [tableName]: batch } });
    synced += result.analyticsCount || batch.length;
    
    const progress = Math.min(i + CONFIG.batchSize, records.length);
    process.stdout.write(`      [${progress}/${records.length}]\r`);
  }
  
  console.log(`      ✅ ${synced} 条已同步`);
  return synced;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 主函数
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  printBanner();
  
  // 解析参数
  const cloudUrl = process.argv[2];
  
  if (!cloudUrl) {
    console.error('❌ 错误: 请提供云端URL');
    printUsage();
    process.exit(1);
  }
  
  // 验证URL格式
  try {
    new URL(cloudUrl);
  } catch {
    console.error('❌ 错误: 无效的URL格式');
    process.exit(1);
  }
  
  console.log(`📍 本地数据库: ${CONFIG.localDbPath}`);
  console.log(`☁️  云端URL: ${cloudUrl}`);
  console.log(`📦 批次大小: ${CONFIG.batchSize}`);
  console.log('');
  
  try {
    // 1. 连接本地数据库
    console.log('🔗 连接本地数据库...');
    const db = new Database(CONFIG.localDbPath);
    
    // 2. 检查表是否存在
    const tableCheck = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name LIKE 'analytics_%'
    `).all();
    
    if (tableCheck.length === 0) {
      console.error('❌ 错误: 本地数据库中没有 analytics 表');
      process.exit(1);
    }
    
    console.log(`   找到 ${tableCheck.length} 个 analytics 表`);
    
    // 3. 导出数据
    console.log('');
    console.log('📊 导出 Analytics 数据...');
    
    const data = {
      users: db.prepare('SELECT * FROM analytics_users').all(),
      sessions: db.prepare('SELECT * FROM analytics_sessions').all(),
      behavior: db.prepare('SELECT * FROM analytics_behavior').all(),
      daily: db.prepare('SELECT * FROM analytics_daily').all()
    };
    
    console.log(`   Users: ${data.users.length} 条`);
    console.log(`   Sessions: ${data.sessions.length} 条`);
    console.log(`   Behavior: ${data.behavior.length} 条`);
    console.log(`   Daily: ${data.daily.length} 条`);
    
    const totalLocal = Object.values(data).reduce((sum, arr) => sum + arr.length, 0);
    console.log(`   总计: ${totalLocal} 条`);
    
    db.close();
    
    // 4. 同步到云端
    console.log('');
    console.log('📤 同步到云端...');
    
    let totalSynced = 0;
    totalSynced += await syncTable(cloudUrl, 'users', data.users);
    totalSynced += await syncTable(cloudUrl, 'sessions', data.sessions);
    totalSynced += await syncTable(cloudUrl, 'behavior', data.behavior);
    totalSynced += await syncTable(cloudUrl, 'daily', data.daily);
    
    // 5. 完成
    console.log('');
    console.log('════════════════════════════════════════════════════════════');
    console.log(`✨ 同步完成!`);
    console.log(`   📊 本地: ${totalLocal} 条`);
    console.log(`   ☁️  云端: ${totalSynced} 条`);
    console.log('════════════════════════════════════════════════════════════');
    
  } catch (error) {
    console.error('');
    console.error('❌ 同步失败:', error.message);
    console.error('');
    console.error('💡 可能的原因:');
    console.error('   1. 云端URL不正确或服务未启动');
    console.error('   2. 云端未配置 /api/admin/sync-data 端点');
    console.error('   3. 网络连接问题或超时');
    console.error('   4. 本地数据库文件不存在');
    console.error('');
    process.exit(1);
  }
}

main();
