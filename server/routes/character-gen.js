/**
 * Character Generator API 路由
 *
 * 角色生成（test）工具的全部 API 端点
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import * as characterGen from '../services/character-gen.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = express.Router();

// 文件上传配置
const OUTPUT_DIR = characterGen.getOutputDir();

const upload = multer({
  dest: path.join(OUTPUT_DIR, 'uploads'),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// ===========================
// 1. AI 生成角色
// ===========================
router.post('/create', upload.single('reference'), asyncHandler(async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: '请输入角色描述' });
    }

    const refPath = req.file?.path || null;

    // 创建任务目录
    const { taskId, taskDir } = characterGen.createTaskDir();

    // 生成角色
    const filename = await characterGen.generateCharacter(prompt.trim(), taskDir, refPath);

    if (!filename) {
      return res.status(500).json({ error: '角色生成未返回结果' });
    }

    res.json({
      success: true,
      taskId,
      characterUrl: `/api/character-gen/output/${taskId}/${filename}`,
    });
  } catch (err) {
    console.error('[Character-Gen] create error:', err);
    res.status(500).json({ error: err.message });
  }
}));

// ===========================
// 2. 上传角色图
// ===========================
router.post('/upload', upload.single('character'), asyncHandler(async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传角色图片' });
    }

    // 创建任务目录
    const { taskId, taskDir } = characterGen.createTaskDir();

    // 复制上传文件到任务目录
    const ext = path.extname(req.file.originalname).toLowerCase() || '.png';
    const targetPath = path.join(taskDir, `character${ext}`);
    fs.copyFileSync(req.file.path, targetPath);

    // 清理临时文件
    try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }

    const filename = `character${ext}`;

    res.json({
      success: true,
      taskId,
      characterUrl: `/api/character-gen/output/${taskId}/${filename}`,
    });
  } catch (err) {
    console.error('[Character-Gen] upload error:', err);
    res.status(500).json({ error: err.message });
  }
}));

// ===========================
// 3. 造型变换
// ===========================
router.post('/outfit', asyncHandler(async (req, res) => {
  try {
    const { taskId, description, keywords } = req.body;
    if (!taskId || !description) {
      return res.status(400).json({ error: '缺少参数' });
    }

    const taskDir = path.join(OUTPUT_DIR, taskId);
    if (!fs.existsSync(taskDir)) {
      return res.status(404).json({ error: '任务不存在' });
    }

    // 查找角色原图
    let characterPath = null;
    for (const ext of ['.png', '.jpg', '.jpeg', '.webp']) {
      const p = path.join(taskDir, `character${ext}`);
      if (fs.existsSync(p)) {
        characterPath = p;
        break;
      }
    }

    if (!characterPath) {
      return res.status(404).json({ error: '角色原图不存在' });
    }

    // 生成造型
    const filename = await characterGen.generateOutfit(
      characterPath,
      description,
      keywords || description,
      taskDir
    );

    if (!filename) {
      return res.status(500).json({ error: '造型生成未返回结果' });
    }

    res.json({
      success: true,
      taskId,
      outfitUrl: `/api/character-gen/output/${taskId}/${filename}`,
    });
  } catch (err) {
    console.error('[Character-Gen] outfit error:', err);
    res.status(500).json({ error: err.message });
  }
}));

// ===========================
// 静态文件：输出目录
// ===========================
router.use('/output', express.static(OUTPUT_DIR));

export default router;
