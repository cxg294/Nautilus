import express from 'express';
import multer from 'multer';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import { decode, decodeFrames, encode } from 'modern-gif';
import { removeBackground, removeBackgroundToBuffer } from '../services/aliyun-imageseg.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/requirePermission.js';

const router = express.Router();
const MAX_GIF_FRAMES = 30;
const MAX_ALIYUN_IMAGE_BYTES = 2.8 * 1024 * 1024;
const MAX_ALIYUN_EDGE = 1999;
const MIN_UPLOAD_EDGE = 64;
const GIF_FRAME_CONCURRENCY = 2;

// === 安全守卫：抠图调用阿里云 API 按次计费，必须鉴权 ===
router.use(requireAuth, requirePermission('module:image-matting:access'));

// 配置 multer 用于保存客户端上传图片的临时文件
const uploadDir = path.join(process.cwd(), 'server', 'matting-output');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 15 * 1024 * 1024 }, // 最大 15MB
});

function isGifUpload(file) {
  return file?.mimetype === 'image/gif' || /\.gif$/i.test(file?.originalname || '');
}

function createClientError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function fitInsideDimensions(width, height, maxEdge) {
  const longestEdge = Math.max(width, height);
  if (longestEdge <= maxEdge) {
    return { width, height };
  }

  const scale = maxEdge / longestEdge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function getFrameDataBuffer(frame) {
  return Buffer.from(frame.data.buffer, frame.data.byteOffset, frame.data.byteLength);
}

function normalizeDelay(delay) {
  if (!Number.isFinite(delay) || delay <= 0) {
    return 100;
  }

  return Math.max(20, Math.round(delay));
}

async function renderFramePng(frame, width, height) {
  return sharp(getFrameDataBuffer(frame), {
    raw: {
      width: frame.width,
      height: frame.height,
      channels: 4,
    },
  })
    .resize({ width, height, fit: 'fill' })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function prepareFrameUpload(frame, targetWidth, targetHeight, workDir, index) {
  let maxEdge = Math.max(targetWidth, targetHeight);

  while (maxEdge >= MIN_UPLOAD_EDGE) {
    const { width, height } = fitInsideDimensions(targetWidth, targetHeight, maxEdge);
    const uploadBuffer = await renderFramePng(frame, width, height);

    if (uploadBuffer.byteLength <= MAX_ALIYUN_IMAGE_BYTES) {
      const framePath = path.join(workDir, `frame-${String(index).padStart(3, '0')}.png`);
      await fsp.writeFile(framePath, uploadBuffer);
      return { framePath };
    }

    maxEdge = Math.floor(maxEdge * 0.85);
  }

  throw createClientError(`第 ${index + 1} 帧压缩后仍超过 3MB，无法提交抠图`);
}

async function processGifFrame(frame, index, targetWidth, targetHeight, workDir) {
  const { framePath } = await prepareFrameUpload(frame, targetWidth, targetHeight, workDir, index);
  const resultBuffer = await removeBackgroundToBuffer(framePath);
  const { data } = await sharp(resultBuffer)
    .resize({ width: targetWidth, height: targetHeight, fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    data: new Uint8ClampedArray(data),
    delay: normalizeDelay(frame.delay),
  };
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex], currentIndex);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

async function processGifMatting(localFilePath) {
  const source = await fsp.readFile(localFilePath);
  let gif;

  try {
    gif = decode(source);
  } catch {
    throw createClientError('GIF 解析失败，请确认文件没有损坏');
  }

  const frameCount = gif.frames?.length || 0;
  if (frameCount === 0) {
    throw createClientError('GIF 中没有可处理的动画帧');
  }
  if (frameCount > MAX_GIF_FRAMES) {
    throw createClientError(`GIF 最多支持 ${MAX_GIF_FRAMES} 帧，当前文件有 ${frameCount} 帧`);
  }

  const frames = decodeFrames(source, { gif });
  const firstFrame = frames[0];
  const baseWidth = gif.width || firstFrame?.width;
  const baseHeight = gif.height || firstFrame?.height;
  if (!firstFrame || !baseWidth || !baseHeight) {
    throw createClientError('GIF 尺寸读取失败');
  }

  const { width: targetWidth, height: targetHeight } = fitInsideDimensions(baseWidth, baseHeight, MAX_ALIYUN_EDGE);
  const workDir = path.join(uploadDir, `gif-work-${Date.now()}-${crypto.randomUUID()}`);

  await fsp.mkdir(workDir, { recursive: true });
  try {
    const processedFrames = await mapLimit(frames, GIF_FRAME_CONCURRENCY, (frame, index) =>
      processGifFrame(frame, index, targetWidth, targetHeight, workDir)
    );
    const encodedGif = await encode({
      width: targetWidth,
      height: targetHeight,
      frames: processedFrames,
      maxColors: 255,
      looped: gif.looped ?? true,
      loopCount: gif.loopCount ?? 0,
    });
    const fileName = `matting-gif-${Date.now()}-${crypto.randomUUID()}.gif`;
    const outputPath = path.join(uploadDir, fileName);

    await fsp.writeFile(outputPath, Buffer.from(encodedGif));

    return {
      url: `/api/image-matting/output/${fileName}`,
      frameCount,
      width: targetWidth,
      height: targetHeight,
    };
  } finally {
    await fsp.rm(workDir, { recursive: true, force: true });
  }
}

function safeUnlink(filePath) {
  if (!filePath) return;
  fs.unlink(filePath, (err) => {
    if (err) console.error('清理临时文件失败:', err);
  });
}

// ===========================
// 1. 提交图片进行抠图去背
// ===========================
router.post('/segment', upload.single('image'), asyncHandler(async (req, res) => {
  const tempPath = req.file?.path;

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '请上传一张图片' });
    }

    if (isGifUpload(req.file)) {
      const gifResult = await processGifMatting(tempPath);
      return res.json({
        success: true,
        type: 'gif',
        ...gifResult,
      });
    }

    // 1. 调用阿里云服务去背景
    const resultUrl = await removeBackground(tempPath);

    // 2. 为了防盗链或者缓存问题，这里可以直接返回阿里云的 URL
    // 因为阿里云返回的图片是临时的可公网访问 OSS 链接，有效期一般为一小时，足够下载。
    // 如果需要长期保存，也可以下载到服务器并返回，此处采用最轻量方式，直接返回云端临时地址。

    res.json({
      success: true,
      type: 'image',
      url: resultUrl,
    });
  } catch (error) {
    console.error('[Image Matting] Processing error:', error);
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({ success: false, error: `抠图处理失败: ${error.message}` });
  } finally {
    safeUnlink(tempPath);
  }
}));

// ===========================
// 2. 提供本地生成结果下载，当前用于 GIF 逐帧重组后的结果
// ===========================
router.get('/output/:file', asyncHandler(async (req, res) => {
  const fileName = req.params.file;
  if (fileName !== path.basename(fileName) || !/^matting-gif-[\w.-]+\.gif$/i.test(fileName)) {
    return res.status(400).json({ success: false, error: '非法文件名' });
  }

  const outputPath = path.resolve(uploadDir, fileName);
  const outputRoot = path.resolve(uploadDir);
  if (!outputPath.startsWith(`${outputRoot}${path.sep}`)) {
    return res.status(403).json({ success: false, error: '非法文件路径' });
  }
  if (!fs.existsSync(outputPath)) {
    return res.status(404).json({ success: false, error: '文件不存在或已被清理' });
  }

  res.setHeader('Content-Type', 'image/gif');
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.sendFile(outputPath);
}));

// ===========================
// 3. 提供阿里云回传图片的代理下载 (绕过跨域限制进行前端 canvas 或 blob 请求)
// ===========================
router.get('/proxy-image', asyncHandler(async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ success: false, error: '缺少图片链接' });
  }

  // SSRF 防护：仅允许代理阿里云 OSS 域名
  const { isSafeUrl } = await import('../utils/security.js');
  const check = isSafeUrl(url, { allowedDomains: ['.aliyuncs.com'], httpsOnly: true });
  if (!check.safe) {
    return res.status(403).json({ success: false, error: `URL 校验失败: ${check.reason}` });
  }

  try {
    // NodeJS 18+ 原生全局 fetch
    const imageRes = await fetch(url);
    if (!imageRes.ok) {
      return res.status(imageRes.status).send('获取图片失败');
    }

    const arrayBuffer = await imageRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // 原样设置 Content-Type 并返回二进制
    res.setHeader('Content-Type', imageRes.headers.get('content-type') || 'image/png');
    // 如果需要跨域
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(buffer);
  } catch (error) {
    console.error('[Image Matting Proxy] Fetch error:', error);
    res.status(500).json({ success: false, error: '代理拉取图片失败' });
  }
}));

export default router;
