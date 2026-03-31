import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { removeBackground } from '../services/aliyun-imageseg.js';

const router = express.Router();

// 配置 multer 用于保存客户端上传图片的临时文件
const uploadDir = path.join(process.cwd(), 'server', 'matting-output');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 15 * 1024 * 1024 }, // 最大 15MB
});

// ===========================
// 1. 提交图片进行抠图去背
// ===========================
router.post('/segment', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '请上传一张图片' });
    }

    const { path: tempPath } = req.file;

    // 1. 调用阿里云服务去背景
    const resultUrl = await removeBackground(tempPath);

    // 2. 为了防盗链或者缓存问题，这里可以直接返回阿里云的 URL
    // 因为阿里云返回的图片是临时的可公网访问 OSS 链接，有效期一般为一小时，足够下载。
    // 如果需要长期保存，也可以下载到服务器并返回，此处采用最轻量方式，直接返回云端临时地址。

    // 请求完成后清理临时上传的文件
    fs.unlink(tempPath, (err) => {
      if (err) console.error('清理临时文件失败:', err);
    });

    res.json({
      success: true,
      url: resultUrl,
    });
  } catch (error) {
    console.error('[Image Matting] Processing error:', error);
    // 同时清理失败时的临时文件
    if (req.file?.path) {
      fs.unlink(req.file.path, () => {});
    }
    res.status(500).json({ success: false, error: `抠图处理失败: ${error.message}` });
  }
});

// ===========================
// 2. 提供阿里云回传图片的代理下载 (绕过跨域限制进行前端 canvas 或 blob 请求) 
// ===========================
router.get('/proxy-image', async (req, res) => {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ success: false, error: '缺少图片链接' });
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
});

export default router;
