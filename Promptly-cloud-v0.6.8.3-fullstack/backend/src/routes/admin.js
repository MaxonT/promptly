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
    
    if (!analytics && !pipeline) {
      return res.status(400).json({
        ok: false,
        error: '请提供analytics或pipeline数据'
      });
    }

    let analyticsCount = 0;
    let pipelineCount = 0;

    // 导入 Analytics 数据
    if (analytics) {
      const { users, sessions, behavior, daily } = analytics;

      if (Array.isArray(users)) {
        const insertUser = db.prepare(`
          INSERT OR REPLACE INTO analytics_users 
          (id, source, timezone, country, device_type, browser, is_active, created_at, last_active_at, metadata)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        for (const user of users) {
          try {
            insertUser.run(
              user.id, user.source || 'organic', user.timezone || 'UTC', user.country || 'US', user.device_type || 'desktop',
              user.browser || 'unknown', user.is_active !== undefined ? user.is_active : 1, user.created_at, user.last_active_at,
              typeof user.metadata === 'string' ? user.metadata : JSON.stringify(user.metadata || {})
            );
            analyticsCount++;
          } catch (e) {
            console.log(`   ⚠️ 跳过用户 ${user.id}: ${e.message}`);
          }
        }
      }

      if (Array.isArray(sessions)) {
        const insertSession = db.prepare(`
          INSERT OR REPLACE INTO analytics_sessions 
          (id, user_id, session_start, session_end, duration_seconds, page_views, device_type, browser, referrer, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        for (const session of sessions) {
          try {
            insertSession.run(
              session.id, session.user_id, session.session_start, session.session_end,
              session.duration_seconds || 0, session.page_views || 1, session.device_type || 'desktop',
              session.browser || 'unknown', session.referrer, session.created_at
            );
            analyticsCount++;
          } catch (e) {
            console.log(`   ⚠️ 跳过会话 ${session.id}: ${e.message}`);
          }
        }
      }

      if (Array.isArray(daily)) {
        const insertDaily = db.prepare(`
          INSERT OR REPLACE INTO analytics_daily 
          (date, unique_users, new_users, returning_users, total_sessions, total_page_views, avg_session_duration, bounce_rate, cumulative_users, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        for (const day of daily) {
          try {
            insertDaily.run(
              day.date, day.unique_users || 0, day.new_users || 0, day.returning_users || 0,
              day.total_sessions || 0, day.total_page_views || 0, day.avg_session_duration || 0,
              day.bounce_rate || 0, day.cumulative_users || 0, day.created_at
            );
            analyticsCount++;
          } catch (e) {
            console.log(`   ⚠️ 跳过日期 ${day.date}: ${e.message}`);
          }
        }
      }

      console.log(`[admin/sync] ✅ Analytics 导入: ${analyticsCount} 条数据`);
    }

    res.json({
      ok: true,
      message: '数据同步成功',
      analyticsCount,
      pipelineCount,
      totalCount: analyticsCount + pipelineCount,
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

export const adminRouter = router;
