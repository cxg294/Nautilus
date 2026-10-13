import { Router } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import sharp from 'sharp';
import { success, fail, CODE } from '../utils/response.js';

/** 必须挂在认证与模块权限守卫之后；root 参数供隔离测试使用。 */
export function createSequenceAssetRouter({ assetRoot = path.resolve('server/sequence-player-assets'), urlPrefix = '/api/sequence-player/assets' } = {}) {
  const router = Router();
  // 立绘归属于当前用户。转码后保存，项目 JSON 只保存地址，避免把大图写进数据库/草稿。

  const imageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 1 } });
  router.post('/assets', (req, res) => {
    imageUpload.single('image')(req, res, async error => {
      if (error) return res.status(400).json(fail(CODE.VALIDATION, '图片不能超过 8 MB'));
      if (!req.file) return res.status(400).json(fail(CODE.VALIDATION, '请选择立绘图片'));
      try {
        const buffer = await sharp(req.file.buffer, { limitInputPixels: 25_000_000 })
          .rotate()
          .resize(1600, 1600, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 90 })
          .toBuffer();
        const fileName = `${crypto.randomUUID()}.webp`;
        const dir = path.join(assetRoot, String(req.user.id));
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(path.join(dir, fileName), buffer);
        res.json(
          success({
            id: fileName,
            type: 'image',
            name: req.file.originalname,
            url: `${urlPrefix}/${fileName}`
          })
        );
      } catch {
        res.status(400).json(fail(CODE.VALIDATION, '图片无法读取，请使用 PNG、JPEG 或 WebP 图片'));
      }
    });
  });
  router.get('/assets/:file', (req, res) => {
    if (!/^[a-f0-9-]{36}\.webp$/.test(req.params.file))
      return res.status(400).json(fail(CODE.VALIDATION, '无效的图片地址'));
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.sendFile(path.join(assetRoot, String(req.user.id), req.params.file), error => {
      if (error && !res.headersSent) res.status(404).json(fail(CODE.FAIL, '图片不存在或当前用户无权访问'));
    });
  });

  return router;
}
