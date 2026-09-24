/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Analytics Database Migration - Template v1.0
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * 此迁移脚本创建 Analytics Dashboard 所需的数据库表并生成初始历史数据
 * 
 * 表结构:
 * - analytics_users: 用户信息
 * - analytics_sessions: 会话记录
 * - analytics_behavior: 用户行为数据
 * - analytics_daily: 每日聚合统计
 * 
 * 运行方式:
 * node migrations/002_analytics.js
 * 
 * 或者通过 migrate 脚本:
 * npm run migrate
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration - 配置
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 数据库路径
 * 可通过 SQLITE_PATH 环境变量覆盖
 */
const DB_PATH = process.env.SQLITE_PATH || path.join(process.cwd(), 'data', 'analytics.db');

/**
 * S-曲线配置
 * 根据项目需求调整这些值
 */
const S_CURVE_CONFIG = {
  targetUsers: 2000,           // L: 最终用户数 (渐近线)
  growthRate: 0.08,            // k: 增长率 (0.06-0.15 典型值)
  inflectionPoint: 40,         // x0: 拐点天数 (达到50%用户)
  projectStartDate: null,      // 自动设置为90天前
  dataEndDate: null            // 自动设置为今天
};

// 自动计算日期范围
const today = new Date();
S_CURVE_CONFIG.dataEndDate = today.toISOString().split('T')[0];

const startDate = new Date();
startDate.setDate(startDate.getDate() - 90); // 90天历史数据
S_CURVE_CONFIG.projectStartDate = startDate.toISOString().split('T')[0];

/**
 * 数据分布配置
 */
const DATA_CONFIG = {
  // 时区分布
  timezones: [
    { zone: 'America/New_York', weight: 20 },
    { zone: 'America/Los_Angeles', weight: 15 },
    { zone: 'America/Chicago', weight: 10 },
    { zone: 'Europe/London', weight: 12 },
    { zone: 'Europe/Paris', weight: 8 },
    { zone: 'Europe/Berlin', weight: 6 },
    { zone: 'Asia/Shanghai', weight: 10 },
    { zone: 'Asia/Tokyo', weight: 8 },
    { zone: 'Asia/Singapore', weight: 5 },
    { zone: 'Australia/Sydney', weight: 4 },
    { zone: 'UTC', weight: 2 }
  ],
  
  // 设备类型分布
  deviceTypes: [
    { type: 'desktop', weight: 60 },
    { type: 'mobile', weight: 35 },
    { type: 'tablet', weight: 5 }
  ],
  
  // 浏览器分布
  browsers: [
    { name: 'Chrome', weight: 65 },
    { name: 'Safari', weight: 20 },
    { name: 'Firefox', weight: 10 },
    { name: 'Edge', weight: 5 }
  ],
  
  // 来源渠道分布
  sources: [
    { source: 'direct', weight: 30 },
    { source: 'google', weight: 25 },
    { source: 'twitter', weight: 15 },
    { source: 'github', weight: 10 },
    { source: 'producthunt', weight: 8 },
    { source: 'hackernews', weight: 7 },
    { source: 'linkedin', weight: 5 }
  ]
};

// ═══════════════════════════════════════════════════════════════════════════════
// Helper Functions - 辅助函数
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * S-曲线 (Logistic Function) 计算累积用户数
 * 
 * 公式: f(x) = L / (1 + e^(-k(x - x0)))
 * 
 * @param {number} x - 天数
 * @param {number} L - 最大用户数 (渐近线)
 * @param {number} k - 增长率
 * @param {number} x0 - 拐点
 * @returns {number} 累积用户数
 */
function sCurve(x, L, k, x0) {
  return L / (1 + Math.exp(-k * (x - x0)));
}

/**
 * 生成唯一ID
 * @param {string} prefix - ID前缀
 * @returns {string}
 */
function generateId(prefix = 'id') {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * 根据权重随机选择
 * @param {Array} items - 带权重的项目数组
 * @returns {*} 选中的值
 */
function weightedRandom(items) {
  const total = items.reduce((sum, item) => sum + (item.weight || 1), 0);
  let random = Math.random() * total;
  
  for (const item of items) {
    random -= (item.weight || 1);
    if (random <= 0) {
      const key = Object.keys(item).find(k => k !== 'weight');
      return item[key];
    }
  }
  
  const key = Object.keys(items[0]).find(k => k !== 'weight');
  return items[0][key];
}

/**
 * 生成随机时间 (当天某时刻)
 * @param {string} dateStr - 日期字符串 YYYY-MM-DD
 * @returns {string} ISO时间字符串
 */
function randomTimeOnDate(dateStr) {
  const date = new Date(dateStr);
  date.setHours(Math.floor(Math.random() * 24));
  date.setMinutes(Math.floor(Math.random() * 60));
  date.setSeconds(Math.floor(Math.random() * 60));
  return date.toISOString();
}

/**
 * 获取日期范围内的所有日期
 * @param {string} startDate - 开始日期
 * @param {string} endDate - 结束日期
 * @returns {string[]} 日期数组
 */
function getDateRange(startDate, endDate) {
  const dates = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Database Schema - 数据库结构
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 创建数据库表
 * @param {Database} db - 数据库实例
 */
function createTables(db) {
  console.log('[migration] Creating analytics tables...');
  
  // 用户表
  db.exec(`
    CREATE TABLE IF NOT EXISTS analytics_users (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      source TEXT DEFAULT 'direct',
      timezone TEXT DEFAULT 'UTC',
      country TEXT,
      device_type TEXT DEFAULT 'desktop',
      browser TEXT DEFAULT 'Chrome',
      is_active INTEGER DEFAULT 1,
      last_active_at TEXT,
      metadata TEXT
    )
  `);
  console.log('[migration] ✓ analytics_users table created');
  
  // 会话表
  db.exec(`
    CREATE TABLE IF NOT EXISTS analytics_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      session_start TEXT NOT NULL,
      session_end TEXT,
      duration_seconds INTEGER,
      page_views INTEGER DEFAULT 1,
      device_type TEXT,
      browser TEXT,
      referrer TEXT,
      landing_page TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES analytics_users(id)
    )
  `);
  console.log('[migration] ✓ analytics_sessions table created');
  
  // 行为表
  db.exec(`
    CREATE TABLE IF NOT EXISTS analytics_behavior (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      session_id TEXT,
      recorded_at TEXT NOT NULL,
      mouse_movements INTEGER DEFAULT 0,
      scrolls INTEGER DEFAULT 0,
      clicks INTEGER DEFAULT 0,
      typing_events INTEGER DEFAULT 0,
      focus_time_seconds INTEGER DEFAULT 0,
      engagement_score REAL DEFAULT 0,
      return_frequency_days REAL,
      FOREIGN KEY (user_id) REFERENCES analytics_users(id),
      FOREIGN KEY (session_id) REFERENCES analytics_sessions(id)
    )
  `);
  console.log('[migration] ✓ analytics_behavior table created');
  
  // 每日聚合表
  db.exec(`
    CREATE TABLE IF NOT EXISTS analytics_daily (
      date TEXT PRIMARY KEY,
      unique_users INTEGER DEFAULT 0,
      new_users INTEGER DEFAULT 0,
      total_sessions INTEGER DEFAULT 0,
      total_page_views INTEGER DEFAULT 0,
      avg_session_duration REAL DEFAULT 0,
      bounce_rate REAL DEFAULT 0,
      cumulative_users INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `);
  console.log('[migration] ✓ analytics_daily table created');
  
  // 创建索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_users_created_at ON analytics_users(created_at);
    CREATE INDEX IF NOT EXISTS idx_users_timezone ON analytics_users(timezone);
    CREATE INDEX IF NOT EXISTS idx_users_source ON analytics_users(source);
    CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON analytics_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_start ON analytics_sessions(session_start);
    CREATE INDEX IF NOT EXISTS idx_behavior_user_id ON analytics_behavior(user_id);
    CREATE INDEX IF NOT EXISTS idx_behavior_recorded_at ON analytics_behavior(recorded_at);
    CREATE INDEX IF NOT EXISTS idx_daily_date ON analytics_daily(date);
  `);
  console.log('[migration] ✓ Indexes created');
}

// ═══════════════════════════════════════════════════════════════════════════════
// Data Generation - 数据生成
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 生成历史数据
 * @param {Database} db - 数据库实例
 */
function generateHistoricalData(db) {
  console.log('[migration] Generating historical data using S-curve model...');
  console.log(`[migration] Config: L=${S_CURVE_CONFIG.targetUsers}, k=${S_CURVE_CONFIG.growthRate}, x0=${S_CURVE_CONFIG.inflectionPoint}`);
  console.log(`[migration] Date range: ${S_CURVE_CONFIG.projectStartDate} to ${S_CURVE_CONFIG.dataEndDate}`);
  
  const dates = getDateRange(S_CURVE_CONFIG.projectStartDate, S_CURVE_CONFIG.dataEndDate);
  const { targetUsers, growthRate, inflectionPoint } = S_CURVE_CONFIG;
  
  // 预编译的语句
  const insertUser = db.prepare(`
    INSERT INTO analytics_users (id, created_at, source, timezone, country, device_type, browser, is_active, last_active_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
  `);
  
  const insertSession = db.prepare(`
    INSERT INTO analytics_sessions (id, user_id, session_start, session_end, duration_seconds, page_views, device_type, browser, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const insertBehavior = db.prepare(`
    INSERT INTO analytics_behavior (user_id, session_id, recorded_at, mouse_movements, scrolls, clicks, typing_events, engagement_score, return_frequency_days)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const insertDaily = db.prepare(`
    INSERT INTO analytics_daily (date, unique_users, new_users, total_sessions, total_page_views, avg_session_duration, bounce_rate, cumulative_users, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);
  
  // 使用事务提高性能
  const generateAll = db.transaction(() => {
    let cumulativeUsers = 0;
    const allUserIds = [];
    
    dates.forEach((date, dayIndex) => {
      // 计算当天的累积用户数
      const cumulativeTarget = Math.round(sCurve(dayIndex, targetUsers, growthRate, inflectionPoint));
      
      // 计算当天新增用户
      const newUsersCount = Math.max(0, cumulativeTarget - cumulativeUsers);
      cumulativeUsers = cumulativeTarget;
      
      const dailyUserIds = [];
      
      // 生成新用户
      for (let i = 0; i < newUsersCount; i++) {
        const userId = generateId('au');
        const timezone = weightedRandom(DATA_CONFIG.timezones);
        const deviceType = weightedRandom(DATA_CONFIG.deviceTypes);
        const browser = weightedRandom(DATA_CONFIG.browsers);
        const source = weightedRandom(DATA_CONFIG.sources);
        const createdAt = randomTimeOnDate(date);
        
        insertUser.run(userId, createdAt, source, timezone, 'US', deviceType, browser, createdAt);
        dailyUserIds.push(userId);
        allUserIds.push(userId);
      }
      
      // 计算DAU (基于S曲线的活跃用户比例)
      // 早期活跃比例高，后期趋于稳定在30-40%
      const dauRatio = Math.max(0.25, Math.min(0.9, 0.9 - dayIndex * 0.007));
      const activeUsersCount = Math.round(cumulativeUsers * dauRatio);
      
      // 从所有用户中选择活跃用户
      const shuffledUsers = [...allUserIds].sort(() => Math.random() - 0.5);
      const activeUserIds = shuffledUsers.slice(0, Math.min(activeUsersCount, shuffledUsers.length));
      
      // 添加今日新用户到活跃列表
      dailyUserIds.forEach(uid => {
        if (!activeUserIds.includes(uid)) {
          activeUserIds.push(uid);
        }
      });
      
      let totalSessions = 0;
      let totalPageViews = 0;
      let totalDuration = 0;
      let bounceCount = 0;
      
      // 为活跃用户生成会话
      activeUserIds.forEach(userId => {
        // 每个用户1-3个会话
        const sessionsPerUser = 1 + Math.floor(Math.random() * 2);
        
        for (let s = 0; s < sessionsPerUser; s++) {
          const sessionId = generateId('as');
          const sessionStart = randomTimeOnDate(date);
          const duration = Math.round(30 + Math.random() * 300); // 30-330秒
          const pageViews = 1 + Math.floor(Math.random() * 5);
          const deviceType = weightedRandom(DATA_CONFIG.deviceTypes);
          const browser = weightedRandom(DATA_CONFIG.browsers);
          
          const endDate = new Date(sessionStart);
          endDate.setSeconds(endDate.getSeconds() + duration);
          
          insertSession.run(
            sessionId, userId, sessionStart, endDate.toISOString(),
            duration, pageViews, deviceType, browser, sessionStart
          );
          
          totalSessions++;
          totalPageViews += pageViews;
          totalDuration += duration;
          if (pageViews === 1) bounceCount++;
          
          // 生成行为数据
          const mouseMovements = Math.round(50 + Math.random() * 200);
          const scrolls = Math.round(5 + Math.random() * 30);
          const clicks = Math.round(3 + Math.random() * 15);
          const typingEvents = Math.round(10 + Math.random() * 80);
          const engagementScore = Math.min(100, mouseMovements / 5 + clicks * 3 + scrolls * 2);
          const returnFrequency = 1 + Math.random() * 7;
          
          insertBehavior.run(
            userId, sessionId, sessionStart,
            mouseMovements, scrolls, clicks, typingEvents,
            engagementScore, returnFrequency
          );
        }
      });
      
      // 计算每日聚合
      const avgDuration = totalSessions > 0 ? totalDuration / totalSessions : 0;
      const bounceRate = totalSessions > 0 ? bounceCount / totalSessions : 0;
      
      insertDaily.run(
        date,
        activeUserIds.length,
        newUsersCount,
        totalSessions,
        totalPageViews,
        avgDuration,
        bounceRate,
        cumulativeUsers
      );
      
      // 进度输出 (每10天输出一次)
      if (dayIndex % 10 === 0 || dayIndex === dates.length - 1) {
        console.log(`[migration] Day ${dayIndex + 1}/${dates.length}: ${date} - ${newUsersCount} new users, ${cumulativeUsers} total, ${activeUserIds.length} DAU`);
      }
    });
    
    return { totalUsers: cumulativeUsers, totalDays: dates.length };
  });
  
  const result = generateAll();
  console.log(`[migration] ✓ Generated ${result.totalDays} days of data with ${result.totalUsers} total users`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Migration Function - 主迁移函数
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 运行迁移
 */
export function runMigration() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(' Analytics Dashboard - Database Migration');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`[migration] Database path: ${DB_PATH}`);
  
  // 确保目录存在
  const dbDir = path.dirname(DB_PATH);
  const fs = await import('fs');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log(`[migration] Created directory: ${dbDir}`);
  }
  
  // 打开数据库
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  
  try {
    // 检查表是否已存在
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='analytics_daily'
    `).get();
    
    if (tableExists) {
      console.log('[migration] Analytics tables already exist. Checking for data...');
      
      const count = db.prepare('SELECT COUNT(*) as count FROM analytics_daily').get().count;
      if (count > 0) {
        console.log(`[migration] Found ${count} days of existing data. Skipping generation.`);
        console.log('[migration] To regenerate, delete the database and run again.');
        return;
      }
    }
    
    // 创建表
    createTables(db);
    
    // 生成数据
    generateHistoricalData(db);
    
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(' Migration completed successfully!');
    console.log('═══════════════════════════════════════════════════════════════');
    
  } catch (err) {
    console.error('[migration] Error:', err);
    throw err;
  } finally {
    db.close();
  }
}

// 导出配置以便自定义
export { S_CURVE_CONFIG, DATA_CONFIG };

// 如果直接运行此文件
const isMainModule = process.argv[1]?.endsWith('002_analytics.js');
if (isMainModule) {
  runMigration();
}
