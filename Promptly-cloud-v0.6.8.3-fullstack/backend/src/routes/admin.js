import express from 'express';
import { db } from '../lib/db.js';

const router = express.Router();

/**
 * 数据同步端点 - 接收来自本地的数据导入
 * POST /api/admin/sync-data
 * 
 * 请求体中的JSON中的特殊字符会被检测为"SQL注入"，所以改用form-data或其他方式
 * 这里先验证端点存在性
 */
router.post('/sync-data', (req, res) => {
  try {
    // 可选的授权检查
    const syncToken = process.env.SYNC_TOKEN;
    if (syncToken) {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.replace('Bearer ', '');
      if (token !== syncToken) {
        return res.status(401).json({ 
          ok: false, 
          error: 'Unauthorized: Invalid sync token' 
        });
      }
    }

    const { analytics, pipeline } = req.body;
    
    console.log('[admin/sync] 收到同步请求，数据体:', { 
      hasAnalytics: !!analytics, 
      hasPipeline: !!pipeline,
      analyticsUsers: analytics?.users?.length || 0,
      analyticsSessions: analytics?.sessions?.length || 0,
      analyticsDaily: analytics?.daily?.length || 0
    });
    
    if (!analytics && !pipeline) {
      return res.status(400).json({
        ok: false,
        error: '请提供analytics或pipeline数据'
      });
    }

    // 确保analytics表存在
    if (analytics) {
      console.log('[admin/sync] 确保analytics表存在...');
      
      // 使用exec()一次性创建所有表
      try {
        const createTablesSql = `
          CREATE TABLE IF NOT EXISTS analytics_users (
            id TEXT PRIMARY KEY,
            source TEXT DEFAULT 'organic',
            timezone TEXT DEFAULT 'UTC',
            country TEXT DEFAULT 'US',
            device_type TEXT DEFAULT 'desktop',
            browser TEXT,
            is_active INTEGER DEFAULT 1,
            created_at TEXT NOT NULL,
            last_active_at TEXT,
            metadata TEXT DEFAULT '{}'
          );
          
          CREATE TABLE IF NOT EXISTS analytics_sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            session_start TEXT NOT NULL,
            session_end TEXT,
            duration_seconds INTEGER DEFAULT 0,
            page_views INTEGER DEFAULT 1,
            device_type TEXT,
            browser TEXT,
            referrer TEXT,
            created_at TEXT NOT NULL
          );
          
          CREATE TABLE IF NOT EXISTS analytics_behavior (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            session_id TEXT,
            recorded_at TEXT NOT NULL,
            mouse_movements INTEGER DEFAULT 0,
            scrolls INTEGER DEFAULT 0,
            clicks INTEGER DEFAULT 0,
            typing_events INTEGER DEFAULT 0,
            engagement_score REAL DEFAULT 50.0
          );
          
          CREATE TABLE IF NOT EXISTS analytics_daily (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT UNIQUE NOT NULL,
            unique_users INTEGER DEFAULT 0,
            new_users INTEGER DEFAULT 0,
            returning_users INTEGER DEFAULT 0,
            total_sessions INTEGER DEFAULT 0,
            total_page_views INTEGER DEFAULT 0,
            avg_session_duration INTEGER DEFAULT 0,
            bounce_rate REAL DEFAULT 0.15,
            cumulative_users INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
          );
        `;
        
        db.exec(createTablesSql);
        console.log('[admin/sync] ✓ Analytics tables ensured');
      } catch (e) {
        console.error('[admin/sync] ✗ Error creating tables:', e.message);
        // 继续处理，因为表可能已存在
      }
    }

    let analyticsCount = 0;
    let pipelineCount = 0;

    // 导入 Analytics 数据
    if (analytics) {
      const { users, sessions, behavior, daily } = analytics;

      if (Array.isArray(users) && users.length > 0) {
        console.log(`[admin/sync] 准备插入 ${users.length} 条用户数据...`);
        const insertUser = db.prepare(`
          INSERT OR REPLACE INTO analytics_users 
          (id, source, timezone, country, device_type, browser, is_active, created_at, last_active_at, metadata)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        // 使用事务确保所有数据同时提交
        const insertTransaction = db.transaction((usersList) => {
          let inserted = 0;
          for (const user of usersList) {
            try {
              const result = insertUser.run(
                user.id, user.source || 'organic', user.timezone || 'UTC', user.country || 'US', user.device_type || 'desktop',
                user.browser || 'unknown', user.is_active !== undefined ? user.is_active : 1, user.created_at, user.last_active_at,
                typeof user.metadata === 'string' ? user.metadata : JSON.stringify(user.metadata || {})
              );
              inserted++;
            } catch (e) {
              console.log(`[admin/sync] ⚠️ 跳过用户 ${user.id}: ${e.message}`);
            }
          }
          return inserted;
        });
        
        try {
          analyticsCount += insertTransaction(users);
          console.log(`[admin/sync] ✓ 成功插入 ${analyticsCount} 条用户数据`);
        } catch (e) {
          console.error(`[admin/sync] ✗ 用户数据事务失败: ${e.message}`);
        }
      }

      if (Array.isArray(sessions) && sessions.length > 0) {
        console.log(`[admin/sync] 准备插入 ${sessions.length} 条会话数据...`);
        const insertSession = db.prepare(`
          INSERT OR REPLACE INTO analytics_sessions 
          (id, user_id, session_start, session_end, duration_seconds, page_views, device_type, browser, referrer, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        const insertTransaction = db.transaction((sessionsList) => {
          let inserted = 0;
          for (const session of sessionsList) {
            try {
              insertSession.run(
                session.id, session.user_id, session.session_start, session.session_end,
                session.duration_seconds || 0, session.page_views || 1, session.device_type || 'desktop',
                session.browser || 'unknown', session.referrer, session.created_at
              );
              inserted++;
            } catch (e) {
              console.log(`[admin/sync] ⚠️ 跳过会话 ${session.id}: ${e.message}`);
            }
          }
          return inserted;
        });
        
        try {
          const sessionsInserted = insertTransaction(sessions);
          analyticsCount += sessionsInserted;
          console.log(`[admin/sync] ✓ 成功插入 ${sessionsInserted} 条会话数据`);
        } catch (e) {
          console.error(`[admin/sync] ✗ 会话数据事务失败: ${e.message}`);
        }
      }

      if (Array.isArray(behavior) && behavior.length > 0) {
        console.log(`[admin/sync] 准备插入 ${behavior.length} 条行为数据...`);
        const insertBehavior = db.prepare(`
          INSERT OR REPLACE INTO analytics_behavior 
          (id, session_id, user_id, event_type, event_timestamp, page_url, element_selector, metadata, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        const insertTransaction = db.transaction((behaviorList) => {
          let inserted = 0;
          for (const bh of behaviorList) {
            try {
              insertBehavior.run(
                bh.id, bh.session_id, bh.user_id, bh.event_type, bh.event_timestamp,
                bh.page_url, bh.element_selector || null,
                typeof bh.metadata === 'string' ? bh.metadata : JSON.stringify(bh.metadata || {}),
                bh.created_at
              );
              inserted++;
            } catch (e) {
              console.log(`[admin/sync] ⚠️ 跳过行为 ${bh.id}: ${e.message}`);
            }
          }
          return inserted;
        });
        
        try {
          const behaviorInserted = insertTransaction(behavior);
          analyticsCount += behaviorInserted;
          console.log(`[admin/sync] ✓ 成功插入 ${behaviorInserted} 条行为数据`);
        } catch (e) {
          console.error(`[admin/sync] ✗ 行为数据事务失败: ${e.message}`);
        }
      }

      if (Array.isArray(daily) && daily.length > 0) {
        console.log(`[admin/sync] 准备插入 ${daily.length} 条日数据...`);
        const insertDaily = db.prepare(`
          INSERT OR REPLACE INTO analytics_daily 
          (date, unique_users, new_users, returning_users, total_sessions, total_page_views, avg_session_duration, bounce_rate, cumulative_users, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        const insertTransaction = db.transaction((dailyList) => {
          let inserted = 0;
          for (const day of dailyList) {
            try {
              insertDaily.run(
                day.date, day.unique_users || 0, day.new_users || 0, day.returning_users || 0,
                day.total_sessions || 0, day.total_page_views || 0, day.avg_session_duration || 0,
                day.bounce_rate || 0, day.cumulative_users || 0, day.created_at
              );
              inserted++;
            } catch (e) {
              console.log(`[admin/sync] ⚠️ 跳过日期 ${day.date}: ${e.message}`);
            }
          }
          return inserted;
        });
        
        try {
          const dailyInserted = insertTransaction(daily);
          analyticsCount += dailyInserted;
          console.log(`[admin/sync] ✓ 成功插入 ${dailyInserted} 条日数据`);
        } catch (e) {
          console.error(`[admin/sync] ✗ 日数据事务失败: ${e.message}`);
        }
      }

      console.log(`[admin/sync] ✅ Analytics 导入: ${analyticsCount} 条数据`);
    }

    // 强制WAL checkpoint确保数据持久化
    try {
      db.exec('PRAGMA wal_checkpoint(RESTART);');
      console.log('[admin/sync] ✓ WAL checkpoint完成');
    } catch (e) {
      console.warn('[admin/sync] ⚠️ WAL checkpoint失败:', e.message);
    }

    // 验证数据是否真的被写入
    let verifyUsers = 0, verifySessions = 0, verifyDaily = 0;
    try {
      verifyUsers = db.prepare('SELECT COUNT(*) as c FROM analytics_users').get()?.c || 0;
      verifySessions = db.prepare('SELECT COUNT(*) as c FROM analytics_sessions').get()?.c || 0;
      verifyDaily = db.prepare('SELECT COUNT(*) as c FROM analytics_daily').get()?.c || 0;
      console.log(`[admin/sync] ✓ 数据验证: Users=${verifyUsers}, Sessions=${verifySessions}, Daily=${verifyDaily}`);
    } catch (e) {
      console.error(`[admin/sync] ✗ 数据验证失败: ${e.message}`);
    }

    res.json({
      ok: true,
      message: '数据同步成功',
      analyticsCount,
      pipelineCount,
      totalCount: analyticsCount + pipelineCount,
      verified: {
        users: verifyUsers,
        sessions: verifySessions,
        daily: verifyDaily
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[admin/sync] 错误:', error);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

/**
 * GET /api/admin/debug-daily
 * Debug endpoint to查看 daily 表的所有数据
 */
router.get("/debug-daily", (req, res) => {
  try {
    const count = db.prepare('SELECT COUNT(*) as c FROM analytics_daily').get();
    const all = db.prepare('SELECT date, unique_users, new_users, cumulative_users FROM analytics_daily ORDER BY date').all();
    const first5 = all.slice(0, 5);
    const last5 = all.slice(-5);
    
    res.json({
      ok: true,
      total: count.c,
      first5,
      last5,
      allDates: all.map(d => d.date)
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

export const adminRouter = router;
