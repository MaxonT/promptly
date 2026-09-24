#!/usr/bin/env node
/**
 * 修复现有会话数据的时间分布
 * 将所有会话的 session_start 重新随机分配到过去30天内
 * 
 * 用法: node backend/scripts/fix-session-timestamps.js
 */

import { db } from '../src/lib/db.js';

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║  修复会话时间分布 - 重新分配到过去30天                 ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

try {
  // 获取所有会话
  const sessions = db.prepare(`
    SELECT id, session_start, created_at 
    FROM analytics_sessions 
    ORDER BY created_at DESC
  `).all();
  
  if (sessions.length === 0) {
    console.log('❌ 没有会话数据可以修复');
    process.exit(1);
  }
  
  console.log(`📊 找到 ${sessions.length} 个会话\n`);
  console.log('🔄 开始重新分配时间戳...\n');
  
  const updateStmt = db.prepare(`
    UPDATE analytics_sessions 
    SET session_start = ? 
    WHERE id = ?
  `);
  
  let todayCount = 0;
  let weekCount = 0;
  let monthCount = 0;
  
  const now = new Date();
  
  // 对每个会话重新分配时间
  for (const session of sessions) {
    const roll = Math.random() * 100;
    let hoursAgo;
    
    if (roll < 40) {
      // 40% - 今天
      hoursAgo = Math.random() * 24;
      todayCount++;
    } else if (roll < 75) {
      // 35% - 过去7天
      hoursAgo = 24 + Math.random() * (24 * 6);
      weekCount++;
    } else {
      // 25% - 过去8-30天
      hoursAgo = 24 * 7 + Math.random() * (24 * 23);
      monthCount++;
    }
    
    const newSessionStart = new Date(now.getTime() - hoursAgo * 3600 * 1000).toISOString();
    updateStmt.run(newSessionStart, session.id);
  }
  
  console.log('✅ 时间戳重新分配完成！\n');
  console.log('📊 新的时间分布:');
  console.log(`   今天 (0-24h):        ${todayCount} (${(todayCount / sessions.length * 100).toFixed(1)}%)`);
  console.log(`   过去7天 (1-7d):      ${weekCount} (${(weekCount / sessions.length * 100).toFixed(1)}%)`);
  console.log(`   过去8-30天 (8-30d):  ${monthCount} (${(monthCount / sessions.length * 100).toFixed(1)}%)`);
  console.log(`   总计:                ${sessions.length}\n`);
  
  // 重新计算指标验证
  const mostRecentDate = db.prepare(`
    SELECT MAX(date(session_start)) as maxDate FROM analytics_sessions
  `).get()?.maxDate;
  
  const dau = db.prepare(`
    SELECT COUNT(DISTINCT user_id) as total 
    FROM analytics_sessions
    WHERE date(session_start) = ?
  `).get(mostRecentDate)?.total || 0;
  
  const wau = db.prepare(`
    SELECT COUNT(DISTINCT user_id) as total 
    FROM analytics_sessions
    WHERE date(session_start) BETWEEN date(?, '-6 days') AND ?
  `).get(mostRecentDate, mostRecentDate)?.total || 0;
  
  const mau = db.prepare(`
    SELECT COUNT(DISTINCT user_id) as total 
    FROM analytics_sessions
    WHERE date(session_start) BETWEEN date(?, '-29 days') AND ?
  `).get(mostRecentDate, mostRecentDate)?.total || 0;
  
  const stickiness = mau > 0 ? ((dau / mau) * 100).toFixed(2) : '0.00';
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 新的指标计算结果:\n');
  console.log(`   DAU: ${dau}`);
  console.log(`   WAU: ${wau}  ${wau >= dau ? '✅' : '❌'} (${wau >= dau ? 'WAU >= DAU' : 'WAU < DAU'})`);
  console.log(`   MAU: ${mau}  ${mau >= wau ? '✅' : '❌'} (${mau >= wau ? 'MAU >= WAU' : 'MAU < WAU'})`);
  console.log(`   Stickiness: ${stickiness}%\n`);
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  if (wau >= dau && mau >= wau) {
    console.log('🎉 数据修复成功！所有指标现在都合理了。\n');
  } else {
    console.log('⚠️  数据已更新，但某些指标可能仍需调整。\n');
  }
  
} catch (err) {
  console.error('❌ 修复失败:', err.message);
  console.error(err.stack);
  process.exit(1);
}
