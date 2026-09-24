#!/usr/bin/env node
/**
 * 测试指标修复 - 验证 DAU/WAU/MAU/Stickiness/Bounce Rate 计算是否正确
 * 
 * 用法: node backend/scripts/test-metrics-fix.js
 */

import { db } from '../src/lib/db.js';

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║  测试分析指标计算（按更新的Glossary定义）              ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

try {
  // 获取最近日期
  const mostRecentDate = db.prepare(`
    SELECT MAX(date(session_start)) as maxDate FROM analytics_sessions
  `).get()?.maxDate;
  
  if (!mostRecentDate) {
    console.log('❌ 没有会话数据，无法测试');
    process.exit(1);
  }
  
  console.log(`📅 参考日期: ${mostRecentDate}\n`);
  
  // 1. DAU - 特定日期的唯一用户
  const dau = db.prepare(`
    SELECT COUNT(DISTINCT user_id) as total 
    FROM analytics_sessions
    WHERE date(session_start) = ?
  `).get(mostRecentDate)?.total || 0;
  
  console.log(`📊 DAU (Daily Active Users)`);
  console.log(`   SQL: COUNT(DISTINCT user_id) WHERE date = '${mostRecentDate}'`);
  console.log(`   结果: ${dau} 用户\n`);
  
  // 2. WAU - 过去7天的唯一用户 (使用 BETWEEN 包含 reference_date)
  const wau = db.prepare(`
    SELECT COUNT(DISTINCT user_id) as total 
    FROM analytics_sessions
    WHERE date(session_start) BETWEEN date(?, '-6 days') AND ?
  `).get(mostRecentDate, mostRecentDate)?.total || 0;
  
  console.log(`📊 WAU (Weekly Active Users)`);
  console.log(`   SQL: COUNT(DISTINCT user_id) WHERE date BETWEEN '${mostRecentDate}'-6days AND '${mostRecentDate}'`);
  console.log(`   窗口: 7个日历天（包含reference_date）`);
  console.log(`   结果: ${wau} 用户\n`);
  
  // 3. MAU - 过去30天的唯一用户 (使用 BETWEEN 包含 reference_date)
  const mau = db.prepare(`
    SELECT COUNT(DISTINCT user_id) as total 
    FROM analytics_sessions
    WHERE date(session_start) BETWEEN date(?, '-29 days') AND ?
  `).get(mostRecentDate, mostRecentDate)?.total || 0;
  
  console.log(`📊 MAU (Monthly Active Users)`);
  console.log(`   SQL: COUNT(DISTINCT user_id) WHERE date BETWEEN '${mostRecentDate}'-29days AND '${mostRecentDate}'`);
  console.log(`   窗口: 30个日历天（包含reference_date）`);
  console.log(`   结果: ${mau} 用户\n`);
  
  // 4. Stickiness
  const stickiness = mau > 0 ? ((dau / mau) * 100).toFixed(2) : '0.00';
  
  console.log(`📊 Stickiness (DAU/MAU Ratio)`);
  console.log(`   公式: (DAU / MAU) × 100%`);
  console.log(`   计算: (${dau} / ${mau}) × 100% = ${stickiness}%`);
  console.log(`   说明: Higher values indicate more frequent user engagement\n`);
  
  // 5. Bounce Rate - 加权计算
  const bounceData = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN page_views <= 1 THEN 1 ELSE 0 END) as bounced
    FROM analytics_sessions
    WHERE date(session_start) BETWEEN date(?, '-6 days') AND ?
  `).get(mostRecentDate, mostRecentDate);
  
  const bounceRate = bounceData.total > 0 
    ? ((bounceData.bounced / bounceData.total) * 100).toFixed(2) 
    : '0.00';
  
  console.log(`📊 Bounce Rate (加权计算)`);
  console.log(`   公式: SUM(bounced_sessions) / SUM(total_sessions)`);
  console.log(`   计算: ${bounceData.bounced} / ${bounceData.total} = ${bounceRate}%\n`);
  
  // 6. New Users (Last 24h) - 相对于当前时间
  const newUsers24h = db.prepare(`
    SELECT COUNT(*) as count FROM analytics_users
    WHERE created_at >= datetime('now', '-24 hours')
  `).get()?.count || 0;
  
  console.log(`📊 New Users (Last 24h)`);
  console.log(`   SQL: COUNT(*) WHERE created_at >= datetime('now', '-24 hours')`);
  console.log(`   结果: ${newUsers24h} 用户\n`);
  
  // 7. Total Registered Users
  const totalUsers = db.prepare(`
    SELECT COUNT(*) as count FROM analytics_users
  `).get()?.count || 0;
  
  const usersWithEmail = db.prepare(`
    SELECT COUNT(*) as count FROM analytics_users WHERE email IS NOT NULL
  `).get()?.count || 0;
  
  console.log(`📊 Total Registered Users (All-time)`);
  console.log(`   SQL: COUNT(*) FROM analytics_users`);
  console.log(`   结果: ${totalUsers} 用户 (${usersWithEmail} 有email)\n`);
  
  // 验证数据合理性
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ 数据合理性检查:\n');
  
  const checks = [];
  
  // 检查 1: WAU >= DAU
  if (wau >= dau) {
    console.log(`✅ WAU (${wau}) >= DAU (${dau}) ✓`);
    checks.push(true);
  } else {
    console.log(`❌ WAU (${wau}) < DAU (${dau}) ✗ [不合理！]`);
    checks.push(false);
  }
  
  // 检查 2: MAU >= WAU
  if (mau >= wau) {
    console.log(`✅ MAU (${mau}) >= WAU (${wau}) ✓`);
    checks.push(true);
  } else {
    console.log(`❌ MAU (${mau}) < WAU (${wau}) ✗ [不合理！]`);
    checks.push(false);
  }
  
  // 检查 3: Stickiness 在合理范围
  const stickinessNum = parseFloat(stickiness);
  if (stickinessNum > 0 && stickinessNum <= 100) {
    console.log(`✅ Stickiness (${stickiness}%) 在有效范围 (0-100%) ✓`);
    checks.push(true);
  } else {
    console.log(`❌ Stickiness (${stickiness}%) 不在有效范围 ✗`);
    checks.push(false);
  }
  
  // 检查 4: Bounce Rate 在合理范围
  const bounceRateNum = parseFloat(bounceRate);
  if (bounceRateNum >= 0 && bounceRateNum <= 100) {
    console.log(`✅ Bounce Rate (${bounceRate}%) 在有效范围 (0-100%) ✓`);
    checks.push(true);
  } else {
    console.log(`❌ Bounce Rate (${bounceRate}%) 不在有效范围 ✗`);
    checks.push(false);
  }
  
  // 检查 5: 会话时间分布
  const sessionDistribution = db.prepare(`
    SELECT 
      COUNT(CASE WHEN date(session_start) = ? THEN 1 END) as today,
      COUNT(CASE WHEN date(session_start) BETWEEN date(?, '-6 days') AND date(?, '-1 day') THEN 1 END) as past_week,
      COUNT(CASE WHEN date(session_start) BETWEEN date(?, '-29 days') AND date(?, '-7 days') THEN 1 END) as past_month,
      COUNT(*) as total
    FROM analytics_sessions
  `).get(mostRecentDate, mostRecentDate, mostRecentDate, mostRecentDate, mostRecentDate);
  
  console.log(`\n📊 会话时间分布:`);
  console.log(`   今天: ${sessionDistribution.today} (${(sessionDistribution.today / sessionDistribution.total * 100).toFixed(1)}%)`);
  console.log(`   过去7天(不含今天): ${sessionDistribution.past_week} (${(sessionDistribution.past_week / sessionDistribution.total * 100).toFixed(1)}%)`);
  console.log(`   过去8-30天: ${sessionDistribution.past_month} (${(sessionDistribution.past_month / sessionDistribution.total * 100).toFixed(1)}%)`);
  console.log(`   总计: ${sessionDistribution.total}`);
  
  if (sessionDistribution.past_week > 0 || sessionDistribution.past_month > 0) {
    console.log(`✅ 会话有历史分布 ✓`);
    checks.push(true);
  } else {
    console.log(`⚠️  所有会话都在今天（需要历史数据）`);
    checks.push(false);
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const allPassed = checks.every(c => c);
  if (allPassed) {
    console.log('\n🎉 所有检查通过！指标计算正确且数据合理。\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  部分检查未通过，请运行行为模拟器生成更多数据。\n');
    process.exit(1);
  }
  
} catch (err) {
  console.error('❌ 测试失败:', err.message);
  console.error(err.stack);
  process.exit(1);
}
