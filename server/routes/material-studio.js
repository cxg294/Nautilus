/**
 * Material Studio API 路由
 *
 * 素材生成工作台的全部 API 端点
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
// Node 22+ 内置全局 fetch，无需额外导入
import config from '../config/env.js';
import * as materialGen from '../services/material-gen.js';
import { removeBackground } from '../services/aliyun-imageseg.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = express.Router();

// 文件上传配置
const OUTPUT_DIR = config.materialStudioOutput;
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const upload = multer({
  dest: path.join(OUTPUT_DIR, 'uploads'),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// ===========================
// 1. 意图评估 + 追问
// ===========================
router.post('/chat', upload.single('reference'), asyncHandler(async (req, res) => {
  try {
    const { message, context: ctxStr, aspectRatio } = req.body;
    if (!message) {
      return res.status(400).json({ error: '请输入描述' });
    }

    const context = ctxStr ? JSON.parse(ctxStr) : { history: [] };
    const hasRefImage = !!req.file;
    const refPath = req.file?.path || null;

    const result = await materialGen.evaluateIntent(message, context, hasRefImage, aspectRatio || '1:1');

    // 更新上下文历史
    const updatedHistory = [...(context.history || []), {
      round: (context.history || []).length + 1,
      userInput: message,
      aiResponse: result.reply,
      dimension: result.nextAction,
      options: result.options,
    }];

    // 构建结论
    const conclusions = {
      d1: result.dimensions.d1.status === 'pass' ? result.dimensions.d1.extracted : null,
      d2: result.dimensions.d2.status === 'pass' ? result.dimensions.d2.extracted : null,
      d3: result.dimensions.d3.status === 'pass' ? result.dimensions.d3.extracted : null,
    };

    // 构建行动策略
    let action = result.allPass ? 'select_style' : 'clarify';
    let autoDetectStyle = null;

    if (result.allPass && result.explicitStyle) {
      action = 'auto_generate';
      autoDetectStyle = result.explicitStyle;
    }

    res.json({
      success: true,
      action,
      autoDetectStyle,
      dimension: result.nextAction,
      reply: result.reply,
      options: result.options || [],
      styleHints: result.styleHints || [],
      conclusions,
      context: {
        history: updatedHistory,
        refPath,
      },
    });
  } catch (err) {
    console.error('[Material Studio] chat error:', err);
    res.status(500).json({ error: err.message });
  }
}));

// ===========================
// 2. 图片生成（Prompt 增强 + 生成）
// ===========================
router.post('/generate', upload.single('reference'), asyncHandler(async (req, res) => {
  try {
    const { conclusions: conclusionsStr, style, aspectRatio, context: ctxStr } = req.body;
    if (!conclusionsStr || !style) {
      return res.status(400).json({ error: '缺少参数' });
    }

    const conclusions = JSON.parse(conclusionsStr);
    const context = ctxStr ? JSON.parse(ctxStr) : {};
    const refPath = req.file?.path || context.refPath || null;

    // Step 1: Prompt 增强
    const enhanced = await materialGen.enhancePrompt(conclusions, style, aspectRatio || '1:1', refPath);

    // Step 2: 创建任务目录
    const { taskId, taskDir } = materialGen.createTaskDir();

    // Step 3: 图片生成
    const filename = await materialGen.generateImage(
      enhanced.enhancedPrompt,
      taskDir,
      aspectRatio || '1:1',
      refPath
    );

    if (!filename) {
      return res.status(500).json({ error: '图片生成未返回结果' });
    }

    res.json({
      success: true,
      taskId,
      imageUrl: `/api/material-studio/output/${taskId}/${filename}`,
      enhancedPrompt: enhanced.enhancedPrompt,
      summary: enhanced.summary,
    });
  } catch (err) {
    console.error('[Material Studio] generate error:', err);
    res.status(500).json({ error: err.message });
  }
}));

// ===========================
// 3. 素材拆解（元素识别）
// ===========================
router.post('/analyze', asyncHandler(async (req, res) => {
  try {
    const { taskId } = req.body;
    if (!taskId) {
      return res.status(400).json({ error: '缺少 taskId' });
    }

    const taskDir = path.join(OUTPUT_DIR, taskId);
    const imagePath = path.join(taskDir, 'original.png');

    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ error: '原始图片不存在' });
    }

    const elements = await materialGen.analyzeElements(imagePath);
    res.json({ success: true, elements });
  } catch (err) {
    console.error('[Material Studio] analyze error:', err);
    res.status(500).json({ error: err.message });
  }
}));

// ===========================
// 4. 素材提取（背景重绘 + 前景抠图）
// ===========================
router.post('/extract', asyncHandler(async (req, res) => {
  try {
    const { taskId, selectedElements, aspectRatio } = req.body;
    if (!taskId || !selectedElements || !Array.isArray(selectedElements)) {
      return res.status(400).json({ error: '缺少参数' });
    }

    const taskDir = path.join(OUTPUT_DIR, taskId);
    const imagePath = path.join(taskDir, 'original.png');

    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ error: '原始图片不存在' });
    }

    // Step 1: 背景重绘（去掉所有选中元素）
    const bgFilename = await materialGen.regenerateBackground(
      imagePath,
      selectedElements,
      taskDir,
      aspectRatio || '1:1'
    );

    // Step 2: 逐个裁切 + 抠图
    const elementResults = [];
    for (let i = 0; i < selectedElements.length; i++) {
      const elem = selectedElements[i];
      const cropPath = path.join(taskDir, 'elements', `element_${i}_crop.png`);
      const finalPath = path.join(taskDir, 'elements', `element_${i}.png`);

      // 裁切
      await materialGen.cropElement(imagePath, elem.bbox, cropPath);

      // 抠图（调用阿里云去背景）
      try {
        const mattedUrl = await removeBackground(cropPath);
        // 下载抠图结果到本地
        const response = await fetch(mattedUrl);
        const arrayBuf = await response.arrayBuffer();
        fs.writeFileSync(finalPath, Buffer.from(arrayBuf));
      } catch (mattingErr) {
        console.warn(`[Material Studio] 元素 ${elem.name} 抠图失败，使用裁切图:`, mattingErr.message);
        // 抠图失败则直接用裁切图
        fs.copyFileSync(cropPath, finalPath);
      }

      elementResults.push({
        name: elem.name,
        file: `elements/element_${i}.png`,
        bbox: elem.bbox,
      });
    }

    // Step 3: 生成 manifest.json
    const manifest = {
      original: 'original.png',
      background: bgFilename || 'background.png',
      aspectRatio: aspectRatio || '1:1',
      elements: elementResults,
    };
    fs.writeFileSync(path.join(taskDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

    res.json({
      success: true,
      taskId,
      background: `/api/material-studio/output/${taskId}/${manifest.background}`,
      elements: elementResults.map(e => ({
        ...e,
        url: `/api/material-studio/output/${taskId}/${e.file}`,
      })),
      manifestUrl: `/api/material-studio/output/${taskId}/manifest.json`,
    });
  } catch (err) {
    console.error('[Material Studio] extract error:', err);
    res.status(500).json({ error: err.message });
  }
}));

// ===========================
// 5. ZIP 打包下载
// ===========================
router.get('/download/:taskId', asyncHandler(async (req, res) => {
  try {
    const { taskId } = req.params;
    const taskDir = path.join(OUTPUT_DIR, taskId);
    const manifestPath = path.join(taskDir, 'manifest.json');

    if (!fs.existsSync(manifestPath)) {
      return res.status(404).json({ error: '任务不存在或尚未完成素材提取' });
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

    // 收集所有文件
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    // 原图
    const origPath = path.join(taskDir, manifest.original);
    if (fs.existsSync(origPath)) {
      zip.file(manifest.original, fs.readFileSync(origPath));
    }

    // 背景
    const bgPath = path.join(taskDir, manifest.background);
    if (fs.existsSync(bgPath)) {
      zip.file(manifest.background, fs.readFileSync(bgPath));
    }

    // 元素
    for (const elem of manifest.elements) {
      const elemPath = path.join(taskDir, elem.file);
      if (fs.existsSync(elemPath)) {
        zip.file(elem.file, fs.readFileSync(elemPath));
      }
    }

    // manifest
    zip.file('manifest.json', fs.readFileSync(manifestPath));

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="material_assets_${taskId}.zip"`);
    res.send(zipBuffer);
  } catch (err) {
    console.error('[Material Studio] download error:', err);
    res.status(500).json({ error: err.message });
  }
}));

// ===========================
// 6. 单个文件下载
// ===========================
router.get('/download-file/:taskId/:filename', (req, res) => {
  const { taskId, filename } = req.params;
  const filePath = path.join(OUTPUT_DIR, taskId, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: '文件不存在' });
  }

  res.download(filePath);
});

router.get('/download-file/:taskId/elements/:filename', (req, res) => {
  const { taskId, filename } = req.params;
  const filePath = path.join(OUTPUT_DIR, taskId, 'elements', filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: '文件不存在' });
  }

  res.download(filePath);
});

// ===========================
// 静态文件：输出目录
// ===========================
router.use('/output', express.static(OUTPUT_DIR));

export default router;
