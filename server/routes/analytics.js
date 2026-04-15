/**
 * 埋点分析 API 路由
 *
 * POST /events    — 批量上报事件（需登录）
 * GET  /summary   — 聚合统计（需 owner 权限，预留给看板）
 * GET  /recent    — 最近事件流水（需 owner 权限，预留给看板）
 */
import express from 'express';
import db from '../db/index.js';
import { success, fail, CODE } from '../utils/response.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// 所有埋点接口都需要登录
router.use(requireAuth);

// ═══════════════════════════════════════════
// POST /events — 批量上报埋点事件
// ═══════════════════════════════════════════
const insertStmt = db.prepare(`
  INSERT INTO analytics_events (user_id, username, event_type, tool_name, action_name, result, duration, meta)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertMany = db.transaction((events, user) => {
  let count = 0;
  for (const evt of events) {
    // 基本校验
    if (!evt.eventType || !evt.toolName) continue;
    if (!['page_view', 'action'].includes(evt.eventType)) continue;

    insertStmt.run(
      user.id,
      user.username || '',
      evt.eventType,
      evt.toolName,
      evt.actionName || '',
      evt.result || 'success',
      evt.duration || 0,
      JSON.stringify(evt.meta || {})
    );
    count++;
  }
  return count;
});

router.post('/events', (req, res) => {
  try {
    const { events } = req.body;

    if (!Array.isArray(events) || events.length === 0) {
      return res.json(success({ inserted: 0 }));
    }

    // 限制单次上报最多 50 条，防止异常请求
    const batch = events.slice(0, 50);
    const count = insertMany(batch, req.user);

    res.json(success({ inserted: count }));
  } catch (err) {
    console.error('[Analytics] 事件上报失败:', err);
    // 埋点失败不应影响业务，返回成功但 inserted=0
    res.json(success({ inserted: 0, error: true }));
  }
});

// ═══════════════════════════════════════════
// GET /summary — 聚合统计（看板用）
// ═══════════════════════════════════════════
router.get('/summary', (req, res) => {
  try {
    // 仅 owner 可访问
    if (req.user.role !== 'owner') {
      return res.status(403).json(fail(CODE.FAIL, '权限不足'));
    }

    const { days = 30 } = req.query;
    const daysNum = Math.min(parseInt(days, 10) || 30, 365);
    const since = `datetime('now', 'localtime', '-${daysNum} days')`;

    // 工具使用排行
    const toolRanking = db.prepare(`
      SELECT tool_name, COUNT(*) as total,
        SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) as views,
        SUM(CASE WHEN event_type = 'action' THEN 1 ELSE 0 END) as actions
      FROM analytics_events
      WHERE created_at >= ${since}
      GROUP BY tool_name
      ORDER BY total DESC
    `).all();

    // 用户活跃度
    const userRanking = db.prepare(`
      SELECT user_id, username, COUNT(*) as total,
        COUNT(DISTINCT tool_name) as tools_used,
        SUM(CASE WHEN event_type = 'action' THEN 1 ELSE 0 END) as actions
      FROM analytics_events
      WHERE created_at >= ${since}
      GROUP BY user_id
      ORDER BY total DESC
    `).all();

    // 每日趋势
    const dailyTrend = db.prepare(`
      SELECT date(created_at) as date, COUNT(*) as total,
        SUM(CASE WHEN event_type = 'page_view' THEN 1 ELSE 0 END) as views,
        SUM(CASE WHEN event_type = 'action' THEN 1 ELSE 0 END) as actions,
        COUNT(DISTINCT user_id) as active_users
      FROM analytics_events
      WHERE created_at >= ${since}
      GROUP BY date(created_at)
      ORDER BY date DESC
    `).all();

    // 总计
    const totals = db.prepare(`
      SELECT COUNT(*) as total_events,
        COUNT(DISTINCT user_id) as total_users,
        COUNT(DISTINCT tool_name) as total_tools
      FROM analytics_events
      WHERE created_at >= ${since}
    `).get();

    res.json(success({
      days: daysNum,
      totals,
      toolRanking,
      userRanking,
      dailyTrend,
    }));
  } catch (err) {
    console.error('[Analytics] 获取统计失败:', err);
    res.status(500).json(fail(CODE.FAIL, `获取统计失败: ${err.message}`));
  }
});

// ═══════════════════════════════════════════
// GET /recent — 最近事件流水（看板用）
// ═══════════════════════════════════════════
router.get('/recent', (req, res) => {
  try {
    if (req.user.role !== 'owner') {
      return res.status(403).json(fail(CODE.FAIL, '权限不足'));
    }

    const { limit = 50, offset = 0, tool, user_id: filterUserId } = req.query;
    const limitNum = Math.min(parseInt(limit, 10) || 50, 200);
    const offsetNum = parseInt(offset, 10) || 0;

    let where = '1=1';
    const params = [];

    if (tool) {
      where += ' AND tool_name = ?';
      params.push(tool);
    }
    if (filterUserId) {
      where += ' AND user_id = ?';
      params.push(filterUserId);
    }

    const events = db.prepare(`
      SELECT * FROM analytics_events
      WHERE ${where}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, limitNum, offsetNum);

    const total = db.prepare(`
      SELECT COUNT(*) as count FROM analytics_events WHERE ${where}
    `).get(...params);

    res.json(success({
      events,
      total: total.count,
      limit: limitNum,
      offset: offsetNum,
    }));
  } catch (err) {
    console.error('[Analytics] 获取事件流水失败:', err);
    res.status(500).json(fail(CODE.FAIL, `获取事件流水失败: ${err.message}`));
  }
});

export default router;
