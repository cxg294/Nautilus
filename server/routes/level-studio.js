/**
 * Level Studio API 路由
 *
 * 关卡素材工作台的全部 API 端点
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import config from '../config/env.js';
import * as gemini from '../services/gemini.js';
import * as imageProcessor from '../services/image-processor.js';

const router = express.Router();

// 文件上传配置
const OUTPUT_DIR = config.levelStudioOutput;
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const upload = multer({
  dest: path.join(OUTPUT_DIR, 'uploads'),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// ===========================
// 1. Prompt 分叉增强
// ===========================
router.post('/fork-prompts', upload.single('reference'), async (req, res) => {
  try {
    const { description, styleTag } = req.body;
    if (!description) {
      return res.status(400).json({ error: '请输入关卡描述' });
    }

    const refPath = req.file?.path || null;
    const result = await gemini.forkPrompts(description, styleTag || '扁平卡通', refPath);

    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[Level Studio] fork-prompts error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===========================
// 2. 场景图生成
// ===========================
router.post('/generate', upload.single('reference'), async (req, res) => {
  try {
    const { prompt, aspectRatio } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: '缺少 prompt' });
    }

    const refPath = req.file?.path || req.body.refPath || null;
    const filename = await gemini.generateScene(prompt, refPath, aspectRatio || '4:3');

    if (!filename) {
      return res.status(500).json({ error: '场景图生成未返回结果' });
    }

    res.json({ success: true, scene: `/api/level-studio/output/${filename}` });
  } catch (err) {
    console.error('[Level Studio] generate error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===========================
// 3. 元素识别
// ===========================
router.post('/analyze', async (req, res) => {
  try {
    const { sceneUrl } = req.body;
    if (!sceneUrl) {
      return res.status(400).json({ error: '缺少场景图路径' });
    }

    // 从 URL 中提取文件名
    const filename = sceneUrl.split('/').pop();
    const scenePath = path.join(OUTPUT_DIR, filename);

    if (!fs.existsSync(scenePath)) {
      return res.status(404).json({ error: '场景图不存在' });
    }

    const elements = await gemini.analyzeElements(scenePath);
    res.json({ success: true, elements });
  } catch (err) {
    console.error('[Level Studio] analyze error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===========================
// 4. 场景裁切（单元素）
// ===========================
router.post('/crop', async (req, res) => {
  try {
    const { sceneUrl, bbox } = req.body;
    if (!sceneUrl || !bbox) {
      return res.status(400).json({ error: '缺少参数' });
    }

    const filename = sceneUrl.split('/').pop();
    const scenePath = path.join(OUTPUT_DIR, filename);

    if (!fs.existsSync(scenePath)) {
      return res.status(404).json({ error: '场景图不存在' });
    }

    const croppedFilename = await imageProcessor.cropElement(scenePath, bbox);
    res.json({
      success: true,
      url: `/api/level-studio/output/${croppedFilename}`,
    });
  } catch (err) {
    console.error('[Level Studio] crop error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===========================
// 5. 独立重绘（单元素）
// ===========================
router.post('/regenerate', upload.single('reference'), async (req, res) => {
  try {
    const { elementName, elementDesc, sceneUrl, bbox, styleTag } = req.body;
    if (!elementName || !sceneUrl) {
      return res.status(400).json({ error: '缺少参数' });
    }

    const sceneFilename = sceneUrl.split('/').pop();
    const scenePath = path.join(OUTPUT_DIR, sceneFilename);
    const refPath = req.file?.path || req.body.refPath || null;
    const bboxArr = typeof bbox === 'string' ? JSON.parse(bbox) : bbox;

    const filename = await gemini.regenerateElement(
      elementName,
      elementDesc || '',
      scenePath,
      bboxArr,
      styleTag || '扁平卡通',
      refPath
    );

    if (!filename) {
      return res.status(500).json({ error: '元素重绘未返回结果' });
    }

    res.json({
      success: true,
      url: `/api/level-studio/output/${filename}`,
    });
  } catch (err) {
    console.error('[Level Studio] regenerate error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===========================
// 6. 背景生成
// ===========================
router.post('/background', upload.single('reference'), async (req, res) => {
  try {
    const { description, sceneUrl, aspectRatio } = req.body;
    if (!sceneUrl) {
      return res.status(400).json({ error: '缺少场景图' });
    }

    const sceneFilename = sceneUrl.split('/').pop();
    const scenePath = path.join(OUTPUT_DIR, sceneFilename);
    const refPath = req.file?.path || req.body.refPath || null;

    const filename = await gemini.generateBackground(
      description || '',
      scenePath,
      aspectRatio || '4:3',
      refPath
    );

    if (!filename) {
      return res.status(500).json({ error: '背景生成未返回结果' });
    }

    res.json({
      success: true,
      url: `/api/level-studio/output/${filename}`,
    });
  } catch (err) {
    console.error('[Level Studio] background error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===========================
// 7. 局部重绘
// ===========================
router.post('/inpaint', upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'mask', maxCount: 1 },
]), async (req, res) => {
  try {
    const { prompt } = req.body;
    const imageFile = req.files?.image?.[0];
    const maskFile = req.files?.mask?.[0];

    if (!prompt || !imageFile || !maskFile) {
      return res.status(400).json({ error: '缺少参数' });
    }

    const filename = await gemini.inpaintImage(imageFile.path, maskFile.path, prompt);

    if (!filename) {
      return res.status(500).json({ error: '重绘未返回结果' });
    }

    res.json({
      success: true,
      url: `/api/level-studio/output/${filename}`,
    });
  } catch (err) {
    console.error('[Level Studio] inpaint error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===========================
// 8. ZIP 打包下载
// ===========================
router.post('/download', async (req, res) => {
  try {
    const { fileUrls } = req.body;
    if (!fileUrls || !Array.isArray(fileUrls) || fileUrls.length === 0) {
      return res.status(400).json({ error: '没有文件可下载' });
    }

    const files = fileUrls
      .map(url => {
        const filename = url.split('/').pop();
        return {
          path: path.join(OUTPUT_DIR, filename),
          name: filename,
        };
      })
      .filter(f => fs.existsSync(f.path));

    if (files.length === 0) {
      return res.status(400).json({ error: '没有有效的文件' });
    }

    const zipFilename = await imageProcessor.createZip(files);
    const zipPath = path.join(OUTPUT_DIR, zipFilename);

    res.download(zipPath, 'level_assets.zip');
  } catch (err) {
    console.error('[Level Studio] download error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===========================
// 静态文件：输出目录
// ===========================
router.use('/output', express.static(OUTPUT_DIR));

export default router;
