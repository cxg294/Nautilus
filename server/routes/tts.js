/**
 * TTS Studio — Gradio SSE v3 代理路由
 *
 * 统一代理三个 Qwen3-TTS Gradio 服务：
 *   base   (:8000) — 声音克隆
 *   custom (:8001) — 角色语音 + 情绪指令
 *   design (:8002) — 音色设计
 */
import { Router } from 'express';
import multer from 'multer';
import fetch from 'node-fetch';
import FormData from 'form-data';
import fs from 'fs';
import config from '../config/env.js';

const router = Router();
const upload = multer({ dest: '/tmp/tts-uploads/' });

// 服务地址映射
const SERVICE_MAP = {
  base: config.tts.base,
  custom: config.tts.custom,
  design: config.tts.design,
};

function getServiceUrl(service) {
  const url = SERVICE_MAP[service];
  if (!url) throw new Error(`Unknown TTS service: ${service}`);
  return url;
}

// ──────────────────────────────────────────
// POST /api/tts/upload/:service
// 上传音频文件到 Gradio 服务端
// ──────────────────────────────────────────
router.post('/upload/:service', upload.single('file'), async (req, res) => {
  try {
    const serviceUrl = getServiceUrl(req.params.service);
    const filePath = req.file.path;

    const form = new FormData();
    form.append('files', fs.createReadStream(filePath), {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });

    const response = await fetch(`${serviceUrl}/gradio_api/upload`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
    });

    // 清理临时文件
    fs.unlink(filePath, () => {});

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: text });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('[TTS Upload Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────
// POST /api/tts/call/:service/:apiName
// 提交合成任务
// ──────────────────────────────────────────
router.post('/call/:service/:apiName', async (req, res) => {
  try {
    const serviceUrl = getServiceUrl(req.params.service);
    const { apiName } = req.params;

    const response = await fetch(`${serviceUrl}/gradio_api/call/${apiName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(response.status).json({ error: text });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('[TTS Call Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────
// GET /api/tts/result/:service/:apiName/:eventId
// SSE 代理 — 透传 Gradio 的 SSE 事件流
// ──────────────────────────────────────────
router.get('/result/:service/:apiName/:eventId', async (req, res) => {
  try {
    const serviceUrl = getServiceUrl(req.params.service);
    const { apiName, eventId } = req.params;

    const upstream = await fetch(
      `${serviceUrl}/gradio_api/call/${apiName}/${eventId}`,
      { headers: { Accept: 'text/event-stream' } }
    );

    if (!upstream.ok) {
      const text = await upstream.text();
      return res.status(upstream.status).json({ error: text });
    }

    // 设置 SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    // 透传 SSE 流
    upstream.body.pipe(res);

    // 客户端断开时中止上游
    req.on('close', () => {
      upstream.body.destroy();
    });
  } catch (err) {
    console.error('[TTS SSE Error]', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    }
  }
});

// ──────────────────────────────────────────
// GET /api/tts/file/:service
// 代理下载 Gradio 生成的音频文件
// query: ?path=/path/to/file
// ──────────────────────────────────────────
router.get('/file/:service', async (req, res) => {
  try {
    const serviceUrl = getServiceUrl(req.params.service);
    const filePath = req.query.path;
    if (!filePath) return res.status(400).json({ error: 'Missing path param' });

    // Gradio 文件 URL: /gradio_api/file=<path> 或 /file=<path>
    const fileUrl = `${serviceUrl}/gradio_api/file=${filePath}`;
    const upstream = await fetch(fileUrl);

    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: 'File not found' });
    }

    // 透传 headers
    const contentType = upstream.headers.get('content-type');
    if (contentType) res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', 'attachment; filename="tts_output.wav"');

    upstream.body.pipe(res);
  } catch (err) {
    console.error('[TTS File Error]', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
