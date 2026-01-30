import express from 'express';
import { db } from '../lib/db.js';

const router = express.Router();

/**
 * 数据同步端点 - 接收来自本地的数据导入
 * POST /api/admin/sync-data
 * 
 * 授权: 可选 Bearer token（可通过环境变量 SYNC_TOKEN 配置）
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

    const { analytics, pipeline, timestamp } = req.body;

    console.log(`[admin/sync] 接收数据同步请求 at ${timestamp}`);

    let analyticsCount = 0;
    let pipelineCount = 0;

    // 导入 Analytics 数据
    if (analytics) {
      const { users, sessions, behavior, daily } = analytics;

      if (users && Array.isArray(users)) {
        const insertUser = db.prepare(`
          INSERT OR REPLACE INTO analytics_users 
          (id, source, timezone, country, device_type, browser, is_active, created_at, last_active_at, metadata)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        for (const user of users) {
          try {
            insertUser.run(
              user.id, user.source, user.timezone, user.country, user.device_type,
              user.browser, user.is_active, user.created_at, user.last_active_at,
              typeof user.metadata === 'string' ? user.metadata : JSON.stringify(user.metadata || {})
            );
            analyticsCount++;
          } catch (e) {
            console.log(`   ⚠️ 跳过用户 ${user.id}: ${e.message}`);
          }
        }
      }

      if (sessions && Array.isArray(sessions)) {
        const insertSession = db.prepare(`
          INSERT OR REPLACE INTO analytics_sessions 
          (id, user_id, session_start, session_end, duration_seconds, page_views, device_type, browser, referrer, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        for (const session of sessions) {
          try {
            insertSession.run(
              session.id, session.user_id, session.session_start, session.session_end,
              session.duration_seconds, session.page_views, session.device_type,
              session.browser, session.referrer, session.created_at
            );
            analyticsCount++;
          } catch (e) {
            console.log(`   ⚠️ 跳过会话 ${session.id}: ${e.message}`);
          }
        }
      }

      if (daily && Array.isArray(daily)) {
        const insertDaily = db.prepare(`
          INSERT OR REPLACE INTO analytics_daily 
          (date, unique_users, new_users, returning_users, total_sessions, total_page_views, avg_session_duration, bounce_rate, cumulative_users, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        for (const day of daily) {
          try {
            insertDaily.run(
              day.date, day.unique_users, day.new_users, day.returning_users,
              day.total_sessions, day.total_page_views, day.avg_session_duration,
              day.bounce_rate, day.cumulative_users, day.created_at
            );
            analyticsCount++;
          } catch (e) {
            console.log(`   ⚠️ 跳过日期 ${day.date}: ${e.message}`);
          }
        }
      }

      console.log(`   ✅ Analytics 导入: ${analyticsCount} 条数据`);
    }

    // 导入 Pipeline 数据
    if (pipeline) {
      const { specs, runs, evaluations, runErrors } = pipeline;

      if (specs && Array.isArray(specs)) {
        const insertSpec = db.prepare(`
          INSERT OR REPLACE INTO specs (id, user_id, title, spec_json, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        
        for (const spec of specs) {
          try {
            insertSpec.run(
              spec.id, spec.user_id, spec.title,
              typeof spec.spec_json === 'string' ? spec.spec_json : JSON.stringify(spec.spec_json || {}),
              spec.status, spec.created_at, spec.updated_at
            );
            pipelineCount++;
          } catch (e) {
            console.log(`   ⚠️ 跳过 spec ${spec.id}: ${e.message}`);
          }
        }
      }

      if (runs && Array.isArray(runs)) {
        const insertRun = db.prepare(`
          INSERT OR REPLACE INTO runs (id, user_id, model, provider, status, input_blocks, output, result_summary, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        for (const run of runs) {
          try {
            insertRun.run(
              run.id, run.user_id, run.model, run.provider, run.status,
              typeof run.input_blocks === 'string' ? run.input_blocks : JSON.stringify(run.input_blocks || {}),
              run.output, run.result_summary, run.created_at
            );
            pipelineCount++;
          } catch (e) {
            console.log(`   ⚠️ 跳过 run ${run.id}: ${e.message}`);
          }
        }
      }

      if (evaluations && Array.isArray(evaluations)) {
        const insertEval = db.prepare(`
          INSERT OR REPLACE INTO evaluations (id, run_id, score, verdict, summary, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        
        for (const eval of evaluations) {
          try {
            insertEval.run(
              eval.id, eval.run_id, eval.score, eval.verdict, eval.summary, eval.created_at
            );
            pipelineCount++;
          } catch (e) {
            console.log(`   ⚠️ 跳过 evaluation ${eval.id}: ${e.message}`);
          }
        }
      }

      console.log(`   ✅ Pipeline 导入: ${pipelineCount} 条数据`);
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
