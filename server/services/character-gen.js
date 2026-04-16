/**
 * Character Generator AI 服务
 *
 * 提供角色生成工具所需的 AI 能力：
 * - 角色生成（文本描述 → 白色背景角色图）
 * - 造型变换（角色图 + 动作/情绪描述 → 新造型图）
 */

import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import config from '../config/env.js';
import db from '../db/index.js';

// 模型选择
const MODEL_IMAGE = 'gemini-3.1-flash-image-preview'; // 图片生成

// 输出目录
const OUTPUT_DIR = path.resolve(config.materialStudioOutput, '../character-gen-output');
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/** 获取 Gemini 客户端（复用 material-gen 的代理配置逻辑） */
function getClient() {
  if (!config.geminiApiKey) {
    throw new Error('请在 .env 文件中配置 GEMINI_API_KEY');
  }

  const opts = { apiKey: config.geminiApiKey };

  // 读取代理 baseUrl 配置
  try {
    const row = db.prepare('SELECT value FROM system_settings WHERE key = ?').get('proxy.gemini_base_url');
    if (row && row.value) {
      opts.httpOptions = { baseUrl: row.value.replace(/\/+$/, '') };
      console.log('[Character-Gen] 使用 Gemini 代理:', row.value);
    }
  } catch {
    // 表可能不存在（首次启动迁移未完成），忽略
  }

  return new GoogleGenAI(opts);
}

/** 从 Gemini 响应中提取并保存图片 */
function saveImageFromResponse(response, taskDir, filename = null) {
  if (!response.candidates || !response.candidates[0]) return null;
  const parts = response.candidates[0].content.parts;
  for (const part of parts) {
    if (part.inlineData && part.inlineData.mimeType?.startsWith('image/')) {
      const name = filename || `${crypto.randomUUID().slice(0, 12)}.png`;
      const filepath = path.join(taskDir, name);
      const buffer = Buffer.from(part.inlineData.data, 'base64');
      fs.writeFileSync(filepath, buffer);
      return name;
    }
  }
  return null;
}

/** 将图片文件转为 Gemini Part */
function imageToPart(imagePath) {
  const data = fs.readFileSync(imagePath);
  const ext = path.extname(imagePath).toLowerCase();
  const mimeMap = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
  };
  return {
    inlineData: {
      data: data.toString('base64'),
      mimeType: mimeMap[ext] || 'image/png',
    },
  };
}

/** 创建任务目录 */
export function createTaskDir() {
  const taskId = `chargen_${crypto.randomUUID().slice(0, 12)}`;
  const taskDir = path.join(OUTPUT_DIR, taskId);
  fs.mkdirSync(taskDir, { recursive: true });
  return { taskId, taskDir };
}

/** 获取输出根目录 */
export function getOutputDir() {
  return OUTPUT_DIR;
}

// ===========================
// 1. 角色生成（白色背景）
// ===========================

/**
 * 根据文本描述生成角色图
 * @param {string} prompt - 角色描述
 * @param {string} taskDir - 任务目录
 * @param {string|null} refImagePath - 参考图路径（可选，影响风格）
 * @returns {Promise<string|null>} 生成的图片文件名
 */
export async function generateCharacter(prompt, taskDir, refImagePath = null) {
  const client = getClient();

  const fullPrompt = `Generate a full-body character based on this description:

${prompt}

Requirements:
- The character MUST be on a pure white background (#FFFFFF)
- Full body visible, centered in the frame
- Clear, clean character design with well-defined outlines
- No background elements, patterns, shadows, or gradients on the background
- The background must be completely plain white
- High quality, detailed character illustration`;

  const contents = [];
  if (refImagePath && fs.existsSync(refImagePath)) {
    contents.push(imageToPart(refImagePath));
    contents.push({ text: `Use this image as a visual style reference. ${fullPrompt}` });
  } else {
    contents.push({ text: fullPrompt });
  }

  const response = await client.models.generateContent({
    model: MODEL_IMAGE,
    contents,
    config: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  });

  return saveImageFromResponse(response, taskDir, 'character.png');
}

// ===========================
// 2. 造型变换（图生图）
// ===========================

/**
 * 基于已有角色图生成新造型
 * @param {string} characterImagePath - 角色原图路径
 * @param {string} outfitDesc - 造型描述（中文或英文）
 * @param {string} outfitKeywords - 造型英文关键词
 * @param {string} taskDir - 任务目录
 * @returns {Promise<string|null>} 生成的造型图文件名
 */
export async function generateOutfit(characterImagePath, outfitDesc, outfitKeywords, taskDir) {
  const client = getClient();

  const prompt = `Based on this character image, generate a new image showing the EXACT SAME character with the following change:

${outfitDesc}
(Keywords: ${outfitKeywords})

Requirements:
- MAINTAIN the character's identity completely: same appearance, colors, species, proportions, clothing style, and all visual features
- ONLY change the pose or expression as described above
- Keep the EXACT same art style as the original image
- Pure white background (#FFFFFF), no background elements
- Full body visible, centered in frame
- High quality, detailed`;

  const contents = [
    imageToPart(characterImagePath),
    { text: prompt },
  ];

  const response = await client.models.generateContent({
    model: MODEL_IMAGE,
    contents,
    config: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  });

  const filename = `outfit_${Date.now()}.png`;
  return saveImageFromResponse(response, taskDir, filename);
}
