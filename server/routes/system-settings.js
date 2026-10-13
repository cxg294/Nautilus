/**
 * 系统设置 API 路由
 *
 * GET    /proxy       — 获取所有代理配置
 * PUT    /proxy       — 更新代理配置
 * POST   /proxy/test  — 测试代理连通性
 *
 * 所有接口需要 system:settings:edit 权限
 */
import express from 'express';
import db from '../db/index.js';
import { success, fail, CODE } from '../utils/response.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { recordAdminAction } from '../services/admin-audit.js';

const router = express.Router();
router.use(requireAuth, requirePermission('system:settings:edit'));

// 代理配置的 key 列表（白名单）
const PROXY_KEYS = [
  'proxy.gemini_base_url',
  'proxy.tts_base',
  'proxy.tts_custom',
  'proxy.tts_design',
];

// 默认值
const PROXY_DEFAULTS = {
  'proxy.gemini_base_url': '',
  'proxy.tts_base': '',
  'proxy.tts_custom': '',
  'proxy.tts_design': '',
};

// ═══ GET /proxy — 获取所有代理配置 ═══
router.get('/proxy', (req, res) => {
  try {
    const rows = db.prepare(
      `SELECT key, value, updated_at FROM system_settings WHERE key IN (${PROXY_KEYS.map(() => '?').join(',')})`
    ).all(...PROXY_KEYS);

    const result = {};
    for (const k of PROXY_KEYS) {
      const row = rows.find(r => r.key === k);
      result[k] = {
        value: row ? row.value : PROXY_DEFAULTS[k],
        updatedAt: row ? row.updated_at : null,
      };
    }

    res.json(success(result));
  } catch (err) {
    console.error('[SystemSettings] 获取代理配置失败:', err);
    res.status(500).json(fail(CODE.FAIL, err.message));
  }
});

// ═══ PUT /proxy — 更新代理配置 ═══
const upsertStmt = db.prepare(`
  INSERT INTO system_settings (key, value, updated_at)
  VALUES (?, ?, datetime('now','localtime'))
  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
`);

router.put('/proxy', (req, res) => {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json(fail(CODE.FAIL, '参数格式错误'));
    }

    const updated = db.transaction(() => {
      const keys = Object.keys(settings).filter(key => PROXY_KEYS.includes(key) && typeof settings[key] === 'string');
      for (const key of keys) upsertStmt.run(key, settings[key].trim());
      // 代理 URL 可能含凭据，日志只记录修改了哪些设置项。
      recordAdminAction(req.user, 'settings.update', { type: 'settings', id: 'proxy', name: '服务代理设置' }, null, { keys });
      return keys.length;
    })();

    res.json(success({ updated }));
  } catch (err) {
    console.error('[SystemSettings] 更新代理配置失败:', err);
    res.status(500).json(fail(CODE.FAIL, err.message));
  }
});

// ═══ POST /proxy/test — 测试连通性 ═══
// oxlint-disable-next-line oxc/no-async-endpoint-handlers -- Express 5 自动转发异步路由的拒绝错误。
router.post('/proxy/test', async (req, res) => {
  try {
    const { key, url } = req.body;
    if (!key || !url) {
      return res.status(400).json(fail(CODE.FAIL, '缺少 key 或 url'));
    }

    // SSRF 防护：禁止访问内网地址
    const { isSafeUrl } = await import('../utils/security.js');
    const check = isSafeUrl(url);
    if (!check.safe) {
      return res.status(403).json(fail(CODE.FAIL, `URL 校验失败: ${check.reason}`));
    }

    const startTime = Date.now();
    let testResult = { ok: false, latency: 0, message: '' };

    if (key === 'proxy.gemini_base_url') {
      // 对 Gemini 代理，尝试请求 models 列表
      try {
        const testUrl = url.replace(/\/+$/, '') + '/v1beta/models?key=test';
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const resp = await fetch(testUrl, { signal: controller.signal });
        clearTimeout(timeout);
        testResult.latency = Date.now() - startTime;
        // 即使返回 400/401 也说明代理通了
        testResult.ok = resp.status < 500;
        testResult.message = `HTTP ${resp.status} (${testResult.latency}ms)`;
      } catch (e) {
        testResult.latency = Date.now() - startTime;
        testResult.message = e.name === 'AbortError' ? '连接超时 (10s)' : e.message;
      }
    } else if (key.startsWith('proxy.tts_')) {
      // TTS 服务，尝试请求健康检查
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const resp = await fetch(url.replace(/\/+$/, '') + '/', { signal: controller.signal });
        clearTimeout(timeout);
        testResult.latency = Date.now() - startTime;
        testResult.ok = resp.status < 500;
        testResult.message = `HTTP ${resp.status} (${testResult.latency}ms)`;
      } catch (e) {
        testResult.latency = Date.now() - startTime;
        testResult.message = e.name === 'AbortError' ? '连接超时 (10s)' : e.message;
      }
    } else {
      return res.status(400).json(fail(CODE.FAIL, '不支持的服务类型'));
    }

    res.json(success(testResult));
  } catch (err) {
    console.error('[SystemSettings] 测试连通性失败:', err);
    res.status(500).json(fail(CODE.FAIL, err.message));
  }
});

export default router;
