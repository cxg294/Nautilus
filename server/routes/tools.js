/**
 * 工具 API 路由
 *
 * 为 AI Agent 提供 Nautilus 轻量工具的 HTTP 接口。
 * 所有 endpoint 需要 API Key 认证。
 * 纯 JSON 输入输出，无状态。
 */
import express from 'express';
import QRCode from 'qrcode';
import sharp from 'sharp';
import { success, fail, CODE } from '../utils/response.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = express.Router();

// ═══════════════════════════════════════════
// GET /catalog — 列出所有可用工具及参数说明
// ═══════════════════════════════════════════
router.get('/catalog', (req, res) => {
  res.json(success({
    version: '1.0.0',
    tools: [
      {
        name: 'qrcode',
        method: 'POST',
        path: '/api/tools/qrcode',
        description: '生成二维码图片，返回 PNG base64',
        params: {
          content: { type: 'string', required: true, description: '二维码内容（文本、URL、WiFi 等）' },
          size: { type: 'number', default: 280, description: '图片尺寸（像素）' },
          fgColor: { type: 'string', default: '#000000', description: '前景色' },
          bgColor: { type: 'string', default: '#FFFFFF', description: '背景色' },
          errorLevel: { type: 'string', default: 'M', enum: ['L', 'M', 'Q', 'H'], description: '纠错等级' },
          margin: { type: 'number', default: 2, description: '边距' },
          format: { type: 'string', default: 'png', enum: ['png', 'svg'], description: '输出格式' },
        },
      },
      {
        name: 'timestamp',
        method: 'POST',
        path: '/api/tools/timestamp',
        description: '时间戳与日期字符串双向转换',
        params: {
          value: { type: 'string|number', required: true, description: '要转换的值（时间戳数字或日期字符串）' },
          direction: { type: 'string', required: true, enum: ['ts2date', 'date2ts'], description: '转换方向' },
          unit: { type: 'string', default: 's', enum: ['s', 'ms'], description: '时间戳单位（仅 ts2date 方向时有效）' },
        },
      },
      {
        name: 'base64_encode',
        method: 'POST',
        path: '/api/tools/base64/encode',
        description: '将文本编码为 Base64',
        params: {
          text: { type: 'string', required: true, description: '要编码的文本' },
          urlSafe: { type: 'boolean', default: false, description: '是否使用 URL 安全模式' },
        },
      },
      {
        name: 'base64_decode',
        method: 'POST',
        path: '/api/tools/base64/decode',
        description: '将 Base64 解码为文本',
        params: {
          base64: { type: 'string', required: true, description: 'Base64 编码的字符串' },
          urlSafe: { type: 'boolean', default: false, description: '输入是否为 URL 安全模式' },
        },
      },
      {
        name: 'image_compress',
        method: 'POST',
        path: '/api/tools/image/compress',
        description: '压缩图片，支持 JPEG/PNG/WebP。输入输出均为 base64',
        params: {
          image: { type: 'string', required: true, description: '图片的 base64 编码（不含 data:... 前缀）' },
          quality: { type: 'number', default: 80, description: '压缩质量 (1-100)' },
          maxWidth: { type: 'number', default: 1920, description: '最大宽度（像素），超过则等比缩放' },
          maxHeight: { type: 'number', default: 1920, description: '最大高度（像素），超过则等比缩放' },
          format: { type: 'string', default: 'jpeg', enum: ['jpeg', 'png', 'webp'], description: '输出格式' },
        },
      },
    ],
  }));
});

// ═══════════════════════════════════════════
// POST /qrcode — 生成二维码
// ═══════════════════════════════════════════
router.post('/qrcode', asyncHandler(async (req, res) => {
  try {
    const {
      content,
      size = 280,
      fgColor = '#000000',
      bgColor = '#FFFFFF',
      errorLevel = 'M',
      margin = 2,
      format = 'png',
    } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json(fail(CODE.VALIDATION, '缺少必填参数 content'));
    }

    const options = {
      width: size,
      margin,
      color: { dark: fgColor, light: bgColor },
      errorCorrectionLevel: errorLevel,
    };

    if (format === 'svg') {
      const svg = await QRCode.toString(content, { ...options, type: 'svg' });
      return res.json(success({ format: 'svg', data: svg }));
    }

    // PNG → base64
    const dataUrl = await QRCode.toDataURL(content, options);
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    res.json(success({ format: 'png', base64, size }));
  } catch (err) {
    console.error('[Tools API] qrcode error:', err);
    res.status(500).json(fail(CODE.FAIL, `二维码生成失败: ${err.message}`));
  }
}));

// ═══════════════════════════════════════════
// POST /timestamp — 时间戳转换
// ═══════════════════════════════════════════
router.post('/timestamp', (req, res) => {
  try {
    const { value, direction, unit = 's' } = req.body;

    if (value === undefined || value === null || value === '') {
      return res.status(400).json(fail(CODE.VALIDATION, '缺少必填参数 value'));
    }
    if (!['ts2date', 'date2ts'].includes(direction)) {
      return res.status(400).json(fail(CODE.VALIDATION, 'direction 必须是 ts2date 或 date2ts'));
    }

    if (direction === 'ts2date') {
      const num = Number(value);
      if (isNaN(num)) {
        return res.status(400).json(fail(CODE.VALIDATION, 'value 不是有效的数字时间戳'));
      }
      const ms = unit === 's' ? num * 1000 : num;
      const d = new Date(ms);
      if (isNaN(d.getTime())) {
        return res.status(400).json(fail(CODE.VALIDATION, '无效的时间戳'));
      }

      const pad = (n) => String(n).padStart(2, '0');
      res.json(success({
        iso: d.toISOString(),
        local: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
        utc: d.toUTCString(),
        timestamp_s: Math.floor(d.getTime() / 1000),
        timestamp_ms: d.getTime(),
      }));
    } else {
      // date2ts
      const d = new Date(value);
      if (isNaN(d.getTime())) {
        return res.status(400).json(fail(CODE.VALIDATION, '无法解析日期字符串，请使用 ISO 8601 或常见日期格式'));
      }

      res.json(success({
        timestamp_s: Math.floor(d.getTime() / 1000),
        timestamp_ms: d.getTime(),
        iso: d.toISOString(),
      }));
    }
  } catch (err) {
    console.error('[Tools API] timestamp error:', err);
    res.status(500).json(fail(CODE.FAIL, `时间戳转换失败: ${err.message}`));
  }
});

// ═══════════════════════════════════════════
// POST /base64/encode — Base64 编码
// ═══════════════════════════════════════════
router.post('/base64/encode', (req, res) => {
  try {
    const { text, urlSafe = false } = req.body;

    if (text === undefined || text === null) {
      return res.status(400).json(fail(CODE.VALIDATION, '缺少必填参数 text'));
    }

    let encoded = Buffer.from(text, 'utf-8').toString('base64');

    if (urlSafe) {
      encoded = encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }

    res.json(success({
      base64: encoded,
      urlSafe,
      originalLength: text.length,
      encodedLength: encoded.length,
    }));
  } catch (err) {
    console.error('[Tools API] base64 encode error:', err);
    res.status(500).json(fail(CODE.FAIL, `Base64 编码失败: ${err.message}`));
  }
});

// ═══════════════════════════════════════════
// POST /base64/decode — Base64 解码
// ═══════════════════════════════════════════
router.post('/base64/decode', (req, res) => {
  try {
    const { base64, urlSafe = false } = req.body;

    if (!base64) {
      return res.status(400).json(fail(CODE.VALIDATION, '缺少必填参数 base64'));
    }

    let input = base64;
    if (urlSafe) {
      input = input.replace(/-/g, '+').replace(/_/g, '/');
      while (input.length % 4) input += '=';
    }

    const decoded = Buffer.from(input, 'base64').toString('utf-8');

    res.json(success({
      text: decoded,
      urlSafe,
      decodedLength: decoded.length,
    }));
  } catch (err) {
    console.error('[Tools API] base64 decode error:', err);
    res.status(500).json(fail(CODE.FAIL, `Base64 解码失败: ${err.message}`));
  }
});

// ═══════════════════════════════════════════
// POST /image/compress — 图片压缩
// ═══════════════════════════════════════════
// 请求体限制提升到 10MB（base64 图片较大）
router.post('/image/compress', express.json({ limit: '10mb' }), asyncHandler(async (req, res) => {
  try {
    const {
      image,
      quality = 80,
      maxWidth = 1920,
      maxHeight = 1920,
      format = 'jpeg',
    } = req.body;

    if (!image) {
      return res.status(400).json(fail(CODE.VALIDATION, '缺少必填参数 image（base64 编码的图片）'));
    }

    if (!['jpeg', 'png', 'webp'].includes(format)) {
      return res.status(400).json(fail(CODE.VALIDATION, 'format 必须是 jpeg、png 或 webp'));
    }

    const inputBuffer = Buffer.from(image, 'base64');
    const originalSize = inputBuffer.length;

    // 获取原始图片信息
    const metadata = await sharp(inputBuffer).metadata();

    // 构建 sharp 管道
    let pipeline = sharp(inputBuffer);

    // 如果超过最大尺寸则等比缩放
    if ((metadata.width && metadata.width > maxWidth) || (metadata.height && metadata.height > maxHeight)) {
      pipeline = pipeline.resize(maxWidth, maxHeight, { fit: 'inside', withoutEnlargement: true });
    }

    // 应用压缩格式
    if (format === 'jpeg') {
      pipeline = pipeline.jpeg({ quality, mozjpeg: true });
    } else if (format === 'png') {
      pipeline = pipeline.png({ quality, compressionLevel: 9 });
    } else {
      pipeline = pipeline.webp({ quality });
    }

    const outputBuffer = await pipeline.toBuffer();
    const compressedSize = outputBuffer.length;
    const outputBase64 = outputBuffer.toString('base64');

    // 获取输出图片的实际尺寸
    const outputMeta = await sharp(outputBuffer).metadata();

    res.json(success({
      base64: outputBase64,
      format,
      originalSize,
      compressedSize,
      compressionRate: `${((1 - compressedSize / originalSize) * 100).toFixed(1)}%`,
      width: outputMeta.width,
      height: outputMeta.height,
    }));
  } catch (err) {
    console.error('[Tools API] image compress error:', err);
    res.status(500).json(fail(CODE.FAIL, `图片压缩失败: ${err.message}`));
  }
}));

export default router;
