/**
 * 系统设置 API 路由
 *
 * GET    /proxy       — 获取所有代理配置
 * PUT    /proxy       — 更新代理配置
 * POST   /proxy/test  — 测试代理连通性
 *
 * 所有接口仅限 owner 角色访问
 */
import express from 'express';
import db from '../db/index.js';
import { success, fail, CODE } from '../utils/response.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();
router.use(requireAuth);

// owner 权限检查
function requireOwner(req, res, next) {
  if (req.user.role !== 'owner') {
    return res.status(403).json(fail(CODE.FAIL, '权限不足'));
  }
  next();
}
router.use(requireOwner);

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

    let updated = 0;
    for (const [key, value] of Object.entries(settings)) {
      if (!PROXY_KEYS.includes(key)) continue;
      if (typeof value !== 'string') continue;
      upsertStmt.run(key, value.trim());
      updated++;
    }

    res.json(success({ updated }));
  } catch (err) {
    console.error('[SystemSettings] 更新代理配置失败:', err);
    res.status(500).json(fail(CODE.FAIL, err.message));
  }
});

// ═══ POST /proxy/test — 测试连通性 ═══
router.post('/proxy/test', async (req, res) => {
  try {
    const { key, url } = req.body;
    if (!key || !url) {
      return res.status(400).json(fail(CODE.FAIL, '缺少 key 或 url'));
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
