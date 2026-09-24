#!/usr/bin/env node
/**
 * backfill-timeline-gap.js
 * 
 * Fills the 365-day gap in analytics_daily (2025-01-31 to 2026-01-29)
 * with realistic "struggling product" data.
 * 
 * Usage:
 *   node backfill-timeline-gap.js local     # Backfill local SQLite database
 *   node backfill-timeline-gap.js cloud     # Backfill cloud via API
 *   node backfill-timeline-gap.js both      # Backfill both local and cloud
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const GAP_START = '2025-01-31';
const GAP_END = '2026-01-29';
const CUMULATIVE_START = 1360;  // End of seed data
const CUMULATIVE_END = 1360;    // Just before real data starts (2026-01-30 will add 7 → 1367)
const CLOUD_URL = 'https://promptly-v0-6-cloudtest-cursor-dev.onrender.com';
const ADMIN_KEY = process.env.ADMIN_API_KEY || '';

/**
 * Generate a pseudo-random number based on date seed (deterministic)
 */
function seededRandom(dateStr, salt = 0) {
  let hash = 0;
  const s = dateStr + String(salt);
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) - hash) + s.charCodeAt(i);
    hash |= 0;
  }
  return (Math.abs(hash) % 10000) / 10000;
}

/**
 * Generate daily records for the gap period
 * Story: Product stagnated after initial S-curve growth, 
 * slowly declining engagement, occasional new signups
 */
function generateGapRecords() {
  const records = [];
  const start = new Date(GAP_START);
  const end = new Date(GAP_END);
  const totalDays = Math.ceil((end - start) / (86400000)) + 1;
  
  // Total new users during gap = CUMULATIVE_END - CUMULATIVE_START = 0
  // We'll distribute a tiny number of users across the year
  const totalNewUsers = CUMULATIVE_END - CUMULATIVE_START;
  
  // Pre-determine which days get new users (spread evenly, with some randomness)
  const newUserDays = new Set();
  if (totalNewUsers > 0) {
    const interval = Math.floor(totalDays / totalNewUsers);
    for (let i = 0; i < totalNewUsers; i++) {
      const dayIndex = Math.min(interval * (i + 1) + Math.floor(seededRandom(`new_${i}`) * (interval / 2)), totalDays - 1);
      newUserDays.add(dayIndex);
    }
  }
  
  let cumulative = CUMULATIVE_START;
  
  for (let i = 0; i < totalDays; i++) {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().slice(0, 10);
    const dayOfWeek = date.getDay(); // 0=Sun, 6=Sat
    const month = date.getMonth(); // 0-11
    
    // New users: mostly 0, rarely 1
    const newUsers = newUserDays.has(i) ? 1 : 0;
    cumulative += newUsers;
    
    // Seasonal factor: slightly more activity in Q4 (Oct-Dec) due to holiday traffic
    let seasonFactor = 1.0;
    if (month >= 9 && month <= 11) seasonFactor = 1.3;  // Oct-Dec
    if (month >= 5 && month <= 7) seasonFactor = 0.7;   // Jun-Aug summer doldrums
    
    // Weekend factor: less activity
    const weekendFactor = (dayOfWeek === 0 || dayOfWeek === 6) ? 0.4 : 1.0;
    
    // Base unique users: struggling product, 3-12 daily actives
    const baseUnique = 5 + seededRandom(dateStr, 1) * 8;
    const uniqueUsers = Math.max(1, Math.round(baseUnique * seasonFactor * weekendFactor));
    
    // Returning users
    const returningUsers = Math.max(0, uniqueUsers - newUsers);
    
    // Sessions: 1.2-1.8x unique users
    const sessionMultiplier = 1.2 + seededRandom(dateStr, 2) * 0.6;
    const totalSessions = Math.max(uniqueUsers, Math.round(uniqueUsers * sessionMultiplier));
    
    // Page views: 2-5 per session
    const pvPerSession = 2 + seededRandom(dateStr, 3) * 3;
    const totalPageViews = Math.round(totalSessions * pvPerSession);
    
    // Average session duration: 30-180 seconds (struggling = short sessions)
    const avgSessionDuration = Math.round(30 + seededRandom(dateStr, 4) * 150);
    
    // Bounce rate: high for struggling product (40-75%)
    const bounceRate = parseFloat((0.40 + seededRandom(dateStr, 5) * 0.35).toFixed(2));
    
    records.push({
      date: dateStr,
      unique_users: uniqueUsers,
      new_users: newUsers,
      returning_users: returningUsers,
      total_sessions: totalSessions,
      total_page_views: totalPageViews,
      avg_session_duration: avgSessionDuration,
      bounce_rate: bounceRate,
      cumulative_users: cumulative
    });
  }
  
  console.log(`Generated ${records.length} records`);
  console.log(`Date range: ${records[0].date} → ${records[records.length - 1].date}`);
  console.log(`Cumulative users: ${CUMULATIVE_START} → ${cumulative}`);
  console.log(`Sample record:`, JSON.stringify(records[Math.floor(records.length / 2)], null, 2));
  
  return records;
}

/**
 * Backfill local SQLite database
 */
async function backfillLocal(records) {
  console.log('\n📦 Backfilling LOCAL database...');
  
  try {
    const Database = (await import('better-sqlite3')).default;
    const dbPath = join(__dirname, '..', 'data', 'app.db');
    const db = new Database(dbPath);
    
    const insert = db.prepare(`
      INSERT OR IGNORE INTO analytics_daily 
        (date, unique_users, new_users, returning_users, total_sessions, 
         total_page_views, avg_session_duration, bounce_rate, cumulative_users, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);
    
    let inserted = 0;
    const tx = db.transaction(() => {
      for (const r of records) {
        const result = insert.run(
          r.date, r.unique_users, r.new_users, r.returning_users,
          r.total_sessions, r.total_page_views, r.avg_session_duration,
          r.bounce_rate, r.cumulative_users
        );
        if (result.changes > 0) inserted++;
      }
    });
    tx();
    
    const total = db.prepare('SELECT COUNT(*) as c FROM analytics_daily').get().c;
    console.log(`✅ Local: inserted ${inserted}/${records.length} records (total: ${total} daily records)`);
    
    // Verify continuity
    const gap = db.prepare(`
      SELECT a.date as d1, MIN(b.date) as d2,
             CAST(julianday(MIN(b.date)) - julianday(a.date) AS INTEGER) as gap_days
      FROM analytics_daily a
      JOIN analytics_daily b ON b.date > a.date
      GROUP BY a.date
      HAVING gap_days > 1
      ORDER BY gap_days DESC
      LIMIT 3
    `).all();
    
    if (gap.length === 0) {
      console.log('✅ No gaps in timeline! Continuous data.');
    } else {
      console.log('⚠️ Remaining gaps:', gap);
    }
    
    db.close();
  } catch (err) {
    console.error('❌ Local backfill failed:', err.message);
  }
}

/**
 * Backfill cloud via API (in batches)
 */
async function backfillCloud(records) {
  console.log('\n☁️ Backfilling CLOUD database...');
  
  const BATCH_SIZE = 50;
  let totalInserted = 0;
  let totalSkipped = 0;
  
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(records.length / BATCH_SIZE);
    
    try {
      const response = await fetch(`${CLOUD_URL}/api/analytics/dashboard/admin/backfill-daily`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Key': ADMIN_KEY
        },
        body: JSON.stringify({ records: batch })
      });
      
      if (!response.ok) {
        const text = await response.text();
        console.error(`❌ Batch ${batchNum}/${totalBatches} failed: HTTP ${response.status} - ${text}`);
        continue;
      }
      
      const data = await response.json();
      totalInserted += data.inserted || 0;
      totalSkipped += data.skipped || 0;
      
      process.stdout.write(`\r  Batch ${batchNum}/${totalBatches}: +${data.inserted} inserted, ${data.skipped} skipped`);
    } catch (err) {
      console.error(`\n❌ Batch ${batchNum} error:`, err.message);
    }
  }
  
  console.log(`\n✅ Cloud: inserted ${totalInserted}, skipped ${totalSkipped}`);
  
  // Verify cloud data
  try {
    const res = await fetch(`${CLOUD_URL}/api/analytics/dashboard/timeseries?period=all`);
    const data = await res.json();
    if (data.ok && data.timeseries) {
      console.log(`  Cloud now has ${data.timeseries.length} daily records`);
      const first = data.timeseries[0];
      const last = data.timeseries[data.timeseries.length - 1];
      console.log(`  Range: ${first.date} → ${last.date}`);
      
      // Check for gaps > 1 day
      let maxGap = 0;
      for (let i = 1; i < data.timeseries.length; i++) {
        const prev = new Date(data.timeseries[i - 1].date);
        const curr = new Date(data.timeseries[i].date);
        const gap = Math.round((curr - prev) / 86400000);
        if (gap > maxGap) maxGap = gap;
      }
      console.log(`  Max gap between consecutive days: ${maxGap} day(s)`);
      if (maxGap <= 1) {
        console.log('  ✅ Timeline is continuous!');
      } else {
        console.log(`  ⚠️ Still has gaps of ${maxGap} days`);
      }
    }
  } catch (err) {
    console.error('  ❌ Cloud verification failed:', err.message);
  }
}

// Main
async function main() {
  const target = process.argv[2] || 'both';
  console.log('==============================================');
  console.log('  Analytics Timeline Gap Backfill');
  console.log(`  Target: ${target}`);
  console.log(`  Gap: ${GAP_START} → ${GAP_END}`);
  console.log('==============================================\n');
  
  const records = generateGapRecords();
  
  if (target === 'local' || target === 'both') {
    await backfillLocal(records);
  }
  
  if (target === 'cloud' || target === 'both') {
    await backfillCloud(records);
  }
  
  console.log('\n✅ Backfill complete!');
}

main().catch(console.error);
