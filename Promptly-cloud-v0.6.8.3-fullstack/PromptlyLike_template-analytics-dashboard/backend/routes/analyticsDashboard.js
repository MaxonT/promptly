/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Analytics Dashboard API Routes - Template v1.0
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * 提供完整的 Analytics Dashboard API 端点:
 * 
 * GET  /summary          - 仪表盘摘要数据 (DAU/WAU/MAU, 时区分布等)
 * GET  /timeseries       - 时间序列数据 (支持 7/14/30/all 天)
 * GET  /growth           - 用户增长数据
 * POST /track/user       - 追踪新用户
 * POST /track/session-start  - 追踪会话开始
 * POST /track/session-end    - 追踪会话结束
 * POST /track/behavior   - 追踪用户行为
 * POST /admin/generate-data  - 管理员数据生成端点
 * 
 * 集成步骤:
 * 1. 在主服务器文件中导入此路由
 * 2. 挂载到 /api/analytics/dashboard 路径
 * 
 * 示例:
 * import { analyticsDashboardRouter } from './routes/analyticsDashboard.js';
 * app.use('/api/analytics/dashboard', analyticsDashboardRouter);
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { Router } from "express";
import crypto from 'crypto';

// 创建路由实例
export const analyticsDashboardRouter = Router();

// ═══════════════════════════════════════════════════════════════════════════════
// Configuration - 配置
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Analytics 配置
 * 可根据项目需求调整这些值
 */
const CONFIG = {
  // 目标值 (用于前端进度显示)
  goals: {
    totalUsers: 5000,        // 总用户目标
    dailyActiveUsers: 500    // DAU目标
  },
  
  // S-曲线参数 (用于历史数据生成)
  sCurve: {
    targetUsers: 2000,       // 最终用户数渐近线
    growthRate: 0.08,        // k值 - 增长率
    inflectionPoint: 40      // x0值 - 拐点天数
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// Database Accessor - 数据库访问器
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 数据库实例占位符
 * 
 * 使用方法:
 * 在主应用中初始化后，通过 setDatabase() 注入
 * 
 * 示例:
 * import { setDatabase } from './routes/analyticsDashboard.js';
 * setDatabase(yourDbInstance);
 */
let db = null;

/**
 * 设置数据库实例
 * @param {Object} database - better-sqlite3 数据库实例
 */
export function setDatabase(database) {
  db = database;
  console.log('[analytics-dashboard] Database connected');
}

/**
 * 获取数据库实例
 * @returns {Object} 数据库实例
 * @throws {Error} 如果数据库未初始化
 */
function getDb() {
  if (!db) {
    throw new Error('Analytics database not initialized. Call setDatabase() first.');
  }
  return db;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helper Functions - 辅助函数
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 检查 analytics 表是否存在
 * @returns {boolean}
 */
function checkTablesExist() {
  try {
    const result = getDb().prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='analytics_daily'
    `).get();
    return !!result;
  } catch {
    return false;
  }
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
 * 获取随机时区
 * @returns {string}
 */
function getRandomTimezone() {
  const timezones = [
    'America/New_York', 'America/Los_Angeles', 'America/Chicago',
    'Europe/London', 'Europe/Paris', 'Europe/Berlin',
    'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Singapore', 'Australia/Sydney'
  ];
  return timezones[Math.floor(Math.random() * timezones.length)];
}

/**
 * 获取随机设备类型
 * @returns {string}
 */
function getRandomDevice() {
  const devices = [['desktop', 60], ['mobile', 35], ['tablet', 5]];
  const total = devices.reduce((sum, [_, weight]) => sum + weight, 0);
  let random = Math.random() * total;
  
  for (const [device, weight] of devices) {
    random -= weight;
    if (random <= 0) return device;
  }
  return 'desktop';
}

/**
 * 获取随机浏览器
 * @returns {string}
 */
function getRandomBrowser() {
  const browsers = [['Chrome', 65], ['Safari', 20], ['Firefox', 10], ['Edge', 5]];
  const total = browsers.reduce((sum, [_, weight]) => sum + weight, 0);
  let random = Math.random() * total;
  
  for (const [browser, weight] of browsers) {
    random -= weight;
    if (random <= 0) return browser;
  }
  return 'Chrome';
}

// ═══════════════════════════════════════════════════════════════════════════════
// API Endpoints - API 端点
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /summary
 * 返回仪表盘摘要数据
 */
analyticsDashboardRouter.get("/summary", (req, res) => {
  try {
    const database = getDb();
    
    // 检查表是否存在
    if (!checkTablesExist()) {
      return res.json({
        ok: true,
        users: { total: 0, newLast24h: 0, newLast7d: 0, newLast30d: 0 },
        today: { activeUsers: 0, sessions: 0, pageViews: 0 },
        activity: { dau: 0, wau: 0, mau: 0, dau_mau_ratio: 0 },
        behavior: { bounceRate: 0, avgReturnFrequency: "0" },
        timezones: [],
        engagement: { avgMouseMovements: "0", avgScrolls: "0", avgClicks: "0", avgTypingEvents: "0" },
        goals: CONFIG.goals,
        timestamp: new Date().toISOString()
      });
    }

    // 获取数据库中最新日期作为参考点
    const mostRecentDate = database.prepare(`
      SELECT MAX(date) as maxDate FROM analytics_daily
    `).get()?.maxDate;
    
    const mostRecentUserTime = database.prepare(`
      SELECT MAX(created_at) as maxTime FROM analytics_users
    `).get()?.maxTime;

    // 总用户数
    const totalUsers = database.prepare(`
      SELECT COUNT(*) as count FROM analytics_users
    `).get()?.count || 0;
    
    // 相对于最新数据日期的新用户统计
    const newLast24h = database.prepare(`
      SELECT COUNT(*) as count FROM analytics_users
      WHERE created_at > datetime(?, '-1 day')
    `).get(mostRecentUserTime || 'now')?.count || 0;
    
    const newLast7d = database.prepare(`
      SELECT COUNT(*) as count FROM analytics_users
      WHERE created_at > datetime(?, '-7 days')
    `).get(mostRecentUserTime || 'now')?.count || 0;
    
    const newLast30d = database.prepare(`
      SELECT COUNT(*) as count FROM analytics_users
      WHERE created_at > datetime(?, '-30 days')
    `).get(mostRecentUserTime || 'now')?.count || 0;
    
    // 当日指标
    const today = database.prepare(`
      SELECT 
        unique_users,
        total_sessions,
        total_page_views,
        bounce_rate
      FROM analytics_daily
      WHERE date = ?
    `).get(mostRecentDate) || { unique_users: 0, total_sessions: 0, total_page_views: 0, bounce_rate: 0.15 };
    
    // DAU (基于会话数据)
    const dauFromSessions = database.prepare(`
      SELECT COUNT(DISTINCT user_id) as total FROM analytics_sessions
      WHERE date(session_start) = ?
    `).get(mostRecentDate)?.total || 0;
    
    const dauFromDaily = database.prepare(`
      SELECT unique_users FROM analytics_daily
      WHERE date = ?
    `).get(mostRecentDate)?.unique_users || 0;
    
    const dau = Math.max(dauFromSessions, dauFromDaily);
    
    // WAU
    const wauFromSessions = database.prepare(`
      SELECT COUNT(DISTINCT user_id) as total FROM analytics_sessions
      WHERE date(session_start) > date(?, '-7 days')
    `).get(mostRecentDate)?.total || 0;
    
    // MAU
    const mauFromSessions = database.prepare(`
      SELECT COUNT(DISTINCT user_id) as total FROM analytics_sessions
      WHERE date(session_start) > date(?, '-30 days')
    `).get(mostRecentDate)?.total || 0;
    
    const wau = Math.max(wauFromSessions, dau);
    const mau = Math.max(mauFromSessions, wau);
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Stickiness 计算 (DAU/MAU) - 保留2位小数
    // ═══════════════════════════════════════════════════════════════════════════
    // 
    // 对于历史数据或数据断层情况，使用估算的 WAU/MAU
    // 典型 SaaS 参数: WAU ≈ DAU * 4.5, MAU ≈ DAU * 12
    // 这样 Stickiness ≈ 8.33%
    //
    const avgDailyUsers = database.prepare(`
      SELECT AVG(unique_users) as avg FROM (
        SELECT unique_users FROM analytics_daily ORDER BY date DESC LIMIT 30
      )
    `).get()?.avg || dau;
    
    const representativeDau = Math.round(avgDailyUsers);
    const estimatedMau = Math.round(avgDailyUsers * 12);
    const effectiveMau = Math.max(mau, estimatedMau);
    
    // 保留2位小数作为字符串，避免精度丢失
    const dauMauRatio = effectiveMau > 0 
      ? ((representativeDau / effectiveMau) * 100).toFixed(2) 
      : "0.00";
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Bounce Rate 实时计算 - 从 sessions 表计算，保留2位小数
    // ═══════════════════════════════════════════════════════════════════════════
    let avgBounceRate;
    try {
      const bounceData = database.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN page_views <= 1 THEN 1 ELSE 0 END) as bounced
        FROM analytics_sessions
        WHERE date(session_start) > date(?, '-7 days')
      `).get(mostRecentDate);
      
      if (bounceData && bounceData.total > 0) {
        avgBounceRate = bounceData.bounced / bounceData.total;
      } else {
        // 回退到 daily 表
        avgBounceRate = database.prepare(`
          SELECT AVG(bounce_rate) as avg FROM analytics_daily
          WHERE date > date(?, '-7 days')
        `).get(mostRecentDate)?.avg || 0.15;
        if (avgBounceRate > 1) avgBounceRate = avgBounceRate / 100;
      }
    } catch (e) {
      avgBounceRate = 0.15;
    }
    
    // 时区分布
    const timezones = database.prepare(`
      SELECT 
        timezone,
        COUNT(*) as count,
        COUNT(DISTINCT id) as uniqueEvents
      FROM analytics_users
      WHERE timezone IS NOT NULL
      GROUP BY timezone
      ORDER BY count DESC
      LIMIT 12
    `).all() || [];
    
    // 行为指标
    const behavior = database.prepare(`
      SELECT 
        AVG(mouse_movements) as avgMouse,
        AVG(scrolls) as avgScrolls,
        AVG(clicks) as avgClicks,
        AVG(typing_events) as avgTyping,
        AVG(return_frequency_days) as avgReturn
      FROM analytics_behavior
      WHERE recorded_at > datetime(?, '-7 days')
    `).get(mostRecentUserTime || 'now') || {};
    
    res.json({
      ok: true,
      users: {
        total: totalUsers,
        newLast24h,
        newLast7d,
        newLast30d
      },
      today: {
        activeUsers: today.unique_users || dau,
        sessions: today.total_sessions || 0,
        pageViews: today.total_page_views || 0
      },
      activity: {
        dau,
        wau: Math.max(wau, Math.round(avgDailyUsers * 4.5)),
        mau: effectiveMau,
        dau_mau_ratio: dauMauRatio  // 字符串格式，保留2位小数
      },
      behavior: {
        bounceRate: (avgBounceRate * 100).toFixed(2),  // 保留2位小数
        avgReturnFrequency: (behavior.avgReturn || 3.5).toFixed(2)
      },
      timezones: timezones.map(tz => ({
        timezone: tz.timezone,
        count: tz.count,
        uniqueEvents: tz.uniqueEvents
      })),
      engagement: {
        avgMouseMovements: (behavior.avgMouse || 150).toFixed(1),
        avgScrolls: (behavior.avgScrolls || 20).toFixed(1),
        avgClicks: (behavior.avgClicks || 10).toFixed(1),
        avgTypingEvents: (behavior.avgTyping || 50).toFixed(1)
      },
      goals: CONFIG.goals,
      meta: {
        dataAsOf: mostRecentDate,
        latestUserActivity: mostRecentUserTime
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[analytics-dashboard] Summary error:', err);
    res.status(500).json({ ok: false, error: 'Failed to get analytics summary' });
  }
});

/**
 * GET /timeseries
 * 返回时间序列数据
 */
analyticsDashboardRouter.get("/timeseries", (req, res) => {
  try {
    const database = getDb();
    
    // 安全解析 days 参数
    const daysParam = String(req.query.days || '14').replace(/[^0-9]/g, '');
    const days = Math.min(Math.max(parseInt(daysParam) || 14, 1), 365);
    
    if (!checkTablesExist()) {
      return res.json({ ok: true, data: [] });
    }
    
    // 获取最新日期作为参考
    const mostRecentDate = database.prepare(`
      SELECT MAX(date) as maxDate FROM analytics_daily
    `).get()?.maxDate;
    
    if (!mostRecentDate) {
      return res.json({ ok: true, data: [] });
    }
    
    // 查询相对于最新日期的数据
    const data = database.prepare(`
      SELECT 
        date,
        unique_users as users,
        total_sessions as sessions,
        new_users as newUsers,
        cumulative_users as cumulativeUsers,
        bounce_rate as bounceRate
      FROM analytics_daily
      WHERE date > date(?, '-' || ? || ' days')
      ORDER BY date ASC
    `).all(mostRecentDate, days);
    
    res.json({
      ok: true,
      data: data.map(d => ({
        ...d,
        label: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        timestamp: d.date
      })),
      meta: {
        latestDate: mostRecentDate,
        days: days,
        recordCount: data.length
      }
    });
  } catch (err) {
    console.error('[analytics-dashboard] Timeseries error:', err);
    res.status(500).json({ ok: false, error: 'Failed to get timeseries data' });
  }
});

/**
 * GET /growth
 * 返回用户增长数据
 */
analyticsDashboardRouter.get("/growth", (req, res) => {
  try {
    const database = getDb();
    
    if (!checkTablesExist()) {
      return res.json({ ok: true, daily: [], weekly: [], monthly: [] });
    }
    
    // 每日增长 (最近30天)
    const daily = database.prepare(`
      SELECT date, new_users, cumulative_users
      FROM analytics_daily
      WHERE date > date('now', '-30 days')
      ORDER BY date ASC
    `).all();
    
    // 每周聚合
    const weekly = database.prepare(`
      SELECT 
        strftime('%Y-W%W', date) as week,
        SUM(new_users) as newUsers,
        MAX(cumulative_users) as cumulativeUsers
      FROM analytics_daily
      WHERE date > date('now', '-90 days')
      GROUP BY strftime('%Y-W%W', date)
      ORDER BY week ASC
    `).all();
    
    res.json({ ok: true, daily, weekly });
  } catch (err) {
    console.error('[analytics-dashboard] Growth error:', err);
    res.status(500).json({ ok: false, error: 'Failed to get growth data' });
  }
});

/**
 * POST /track/user
 * 追踪新用户注册
 */
analyticsDashboardRouter.post("/track/user", (req, res) => {
  try {
    const database = getDb();
    const { userId, source, timezone, deviceType, browser } = req.body;
    
    if (!userId) {
      return res.status(400).json({ ok: false, error: 'userId required' });
    }
    
    // 检查用户是否已存在
    const existing = database.prepare(`SELECT id FROM analytics_users WHERE id = ?`).get(userId);
    
    if (existing) {
      return res.json({ ok: true, message: 'user already exists' });
    }
    
    // 插入新用户
    database.prepare(`
      INSERT INTO analytics_users (id, created_at, source, timezone, device_type, browser, is_active, last_active_at)
      VALUES (?, datetime('now'), ?, ?, ?, ?, 1, datetime('now'))
    `).run(userId, source || 'direct', timezone || 'UTC', deviceType || 'desktop', browser || 'Chrome');
    
    // 更新每日统计
    const today = new Date().toISOString().split('T')[0];
    const dailyExists = database.prepare(`SELECT 1 FROM analytics_daily WHERE date = ?`).get(today);
    
    if (dailyExists) {
      database.prepare(`
        UPDATE analytics_daily SET 
          new_users = new_users + 1,
          cumulative_users = cumulative_users + 1
        WHERE date = ?
      `).run(today);
    } else {
      const totalUsers = database.prepare(`SELECT COUNT(*) as count FROM analytics_users`).get().count;
      database.prepare(`
        INSERT INTO analytics_daily (date, unique_users, new_users, cumulative_users, total_sessions, total_page_views, bounce_rate, created_at)
        VALUES (?, 1, 1, ?, 0, 0, 0, datetime('now'))
      `).run(today, totalUsers);
    }
    
    res.json({ ok: true, userId });
  } catch (err) {
    console.error('[analytics] Track user error:', err);
    res.status(500).json({ ok: false, error: 'Internal error' });
  }
});

/**
 * POST /track/session-start
 * 追踪会话开始
 */
analyticsDashboardRouter.post("/track/session-start", (req, res) => {
  try {
    const database = getDb();
    const { userId, sessionId, deviceType, browser } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ ok: false, error: 'sessionId required' });
    }
    
    const effectiveUserId = userId || 'anonymous';
    
    // 确保用户存在
    const userExists = database.prepare(`SELECT id FROM analytics_users WHERE id = ?`).get(effectiveUserId);
    if (!userExists) {
      database.prepare(`
        INSERT OR IGNORE INTO analytics_users (id, created_at, source, timezone, is_active, last_active_at)
        VALUES (?, datetime('now'), 'direct', 'UTC', 1, datetime('now'))
      `).run(effectiveUserId);
    }
    
    // 插入会话
    database.prepare(`
      INSERT INTO analytics_sessions (id, user_id, session_start, device_type, browser, created_at)
      VALUES (?, ?, datetime('now'), ?, ?, datetime('now'))
    `).run(sessionId, effectiveUserId, deviceType || 'desktop', browser || 'Chrome');
    
    // 更新每日唯一用户数
    const today = new Date().toISOString().split('T')[0];
    database.prepare(`
      UPDATE analytics_daily SET unique_users = (
        SELECT COUNT(DISTINCT user_id) FROM analytics_sessions 
        WHERE date(session_start) = ?
      ) WHERE date = ?
    `).run(today, today);
    
    res.json({ ok: true, sessionId });
  } catch (err) {
    console.error('[analytics] Track session-start error:', err);
    res.status(500).json({ ok: false, error: 'Internal error' });
  }
});

/**
 * POST /track/session-end
 * 追踪会话结束
 */
analyticsDashboardRouter.post("/track/session-end", (req, res) => {
  try {
    const database = getDb();
    const { sessionId, duration, pageViews } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ ok: false, error: 'sessionId required' });
    }
    
    database.prepare(`
      UPDATE analytics_sessions SET 
        session_end = datetime('now'),
        duration_seconds = ?,
        page_views = ?
      WHERE id = ?
    `).run(duration || 0, pageViews || 1, sessionId);
    
    // 更新每日统计
    const today = new Date().toISOString().split('T')[0];
    const dailyExists = database.prepare(`SELECT 1 FROM analytics_daily WHERE date = ?`).get(today);
    
    if (dailyExists) {
      database.prepare(`
        UPDATE analytics_daily SET 
          total_sessions = total_sessions + 1,
          total_page_views = total_page_views + ?,
          bounce_rate = (
            SELECT COALESCE(AVG(CASE WHEN page_views <= 1 THEN 100.0 ELSE 0.0 END), 0)
            FROM analytics_sessions WHERE date(session_start) = ?
          )
        WHERE date = ?
      `).run(pageViews || 1, today, today);
    }
    
    res.json({ ok: true, sessionId });
  } catch (err) {
    console.error('[analytics] Track session-end error:', err);
    res.status(500).json({ ok: false, error: 'Internal error' });
  }
});

/**
 * POST /track/behavior
 * 追踪用户行为数据
 */
analyticsDashboardRouter.post("/track/behavior", (req, res) => {
  try {
    const database = getDb();
    const { userId, sessionId, mouseMovements, scrolls, clicks, typingEvents } = req.body;
    
    // 确保用户存在
    if (userId && userId !== 'anonymous') {
      const userExists = database.prepare(`SELECT id FROM analytics_users WHERE id = ?`).get(userId);
      if (!userExists) {
        database.prepare(`
          INSERT OR IGNORE INTO analytics_users (id, created_at, source, timezone, is_active, last_active_at)
          VALUES (?, datetime('now'), 'direct', 'UTC', 1, datetime('now'))
        `).run(userId);
      }
    }
    
    // 确保会话存在
    if (sessionId) {
      const sessionExists = database.prepare(`SELECT id FROM analytics_sessions WHERE id = ?`).get(sessionId);
      if (!sessionExists) {
        database.prepare(`
          INSERT OR IGNORE INTO analytics_sessions (id, user_id, session_start, created_at)
          VALUES (?, ?, datetime('now'), datetime('now'))
        `).run(sessionId, userId || 'anonymous');
      }
    }
    
    // 计算参与度分数
    const engagementScore = Math.min(100, (mouseMovements || 0) / 5 + (clicks || 0) * 3 + (scrolls || 0) * 2);
    
    database.prepare(`
      INSERT INTO analytics_behavior (user_id, session_id, recorded_at, mouse_movements, scrolls, clicks, typing_events, engagement_score)
      VALUES (?, ?, datetime('now'), ?, ?, ?, ?, ?)
    `).run(
      userId || 'anonymous',
      sessionId || null,
      mouseMovements || 0,
      scrolls || 0,
      clicks || 0,
      typingEvents || 0,
      engagementScore
    );
    
    res.json({ ok: true });
  } catch (err) {
    console.error('[analytics] Track behavior error:', err);
    res.status(500).json({ ok: false, error: 'Internal error' });
  }
});

/**
 * POST /admin/generate-data
 * 管理员端点：生成模拟数据 (供行为模拟器使用)
 */
analyticsDashboardRouter.post("/admin/generate-data", (req, res) => {
  try {
    const database = getDb();
    
    // 简单的管理员密钥验证
    const adminKey = req.headers['x-admin-key'] || req.body.adminKey;
    const expectedKey = process.env.ADMIN_API_KEY;
    
    if (expectedKey && adminKey !== expectedKey) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    
    const { users = 0, sessions = 0 } = req.body;
    
    if (users < 0 || sessions < 0) {
      return res.status(400).json({ ok: false, error: 'Invalid parameters' });
    }
    
    const today = new Date().toISOString().split('T')[0];
    
    // 插入新用户
    const userInsert = database.prepare(`
      INSERT INTO analytics_users (id, source, timezone, country, device_type, browser, created_at, last_active_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const sessionInsert = database.prepare(`
      INSERT INTO analytics_sessions (id, user_id, session_start, duration_seconds, page_views, device_type, browser, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const newUserIds = [];
    
    for (let i = 0; i < users; i++) {
      const userId = generateId('au');
      const now = new Date().toISOString();
      const tz = getRandomTimezone();
      
      userInsert.run(
        userId, 'simulator', tz, 'US',
        getRandomDevice(), getRandomBrowser(), now, now
      );
      newUserIds.push(userId);
    }
    
    // 获取现有用户用于会话
    const existingUsers = database.prepare(`
      SELECT id FROM analytics_users ORDER BY created_at DESC LIMIT 100
    `).all().map(u => u.id);
    
    const allUserIds = [...newUserIds, ...existingUsers];
    
    // 插入会话
    for (let i = 0; i < sessions; i++) {
      const sessionId = generateId('as');
      const userId = allUserIds[Math.floor(Math.random() * allUserIds.length)];
      const now = new Date().toISOString();
      
      sessionInsert.run(
        sessionId, userId, now,
        Math.round(30 + Math.random() * 300),
        1 + Math.floor(Math.random() * 5),
        getRandomDevice(), getRandomBrowser(), now
      );
    }
    
    // 更新每日聚合
    const existingDaily = database.prepare(`
      SELECT * FROM analytics_daily WHERE date = ?
    `).get(today);
    
    if (existingDaily) {
      database.prepare(`
        UPDATE analytics_daily
        SET unique_users = unique_users + ?,
            new_users = new_users + ?,
            total_sessions = total_sessions + ?,
            cumulative_users = cumulative_users + ?
        WHERE date = ?
      `).run(users, users, sessions, users, today);
    } else {
      const prevCumulative = database.prepare(`
        SELECT cumulative_users FROM analytics_daily ORDER BY date DESC LIMIT 1
      `).get()?.cumulative_users || 0;
      
      database.prepare(`
        INSERT INTO analytics_daily (date, unique_users, new_users, total_sessions, cumulative_users, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `).run(today, users, users, sessions, prevCumulative + users);
    }
    
    res.json({
      ok: true,
      generated: { users, sessions },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[analytics-dashboard] Generate error:', err);
    res.status(500).json({ ok: false, error: 'Failed to generate data' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Health Check Endpoint
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /health
 * 健康检查端点
 */
analyticsDashboardRouter.get("/health", (req, res) => {
  try {
    const tablesExist = checkTablesExist();
    
    res.json({
      ok: true,
      status: 'healthy',
      database: db ? 'connected' : 'not connected',
      tablesExist,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      status: 'unhealthy',
      error: err.message
    });
  }
});

// 默认导出
export default analyticsDashboardRouter;
