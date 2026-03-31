/**
 * Gemini AI 服务封装
 *
 * 提供 Level Studio 所需的全部 AI 能力：
 * - Prompt 分叉增强
 * - 场景图生成
 * - 元素识别 + Bbox + 遮挡检测
 * - 单元素独立重绘
 * - 背景独立生成
 * - 局部重绘
 */

import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 模型选择
const MODEL_IMAGE = 'gemini-2.0-flash-exp-image-generation'; // 图片生成
const MODEL_TEXT = 'gemini-2.5-flash';                        // 纯文本分析

// 输出目录
const OUTPUT_DIR = config.levelStudioOutput;
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/** 获取 Gemini 客户端 */
function getClient() {
  if (!config.geminiApiKey) {
    throw new Error('请在 .env 文件中配置 GEMINI_API_KEY');
  }
  return new GoogleGenAI({ apiKey: config.geminiApiKey });
}

/** 从 Gemini 响应中提取并保存图片 */
function saveImageFromResponse(response) {
  if (!response.candidates || !response.candidates[0]) return null;
  const parts = response.candidates[0].content.parts;
  for (const part of parts) {
    if (part.inlineData && part.inlineData.mimeType?.startsWith('image/')) {
      const filename = `${crypto.randomUUID().slice(0, 12)}.png`;
      const filepath = path.join(OUTPUT_DIR, filename);
      const buffer = Buffer.from(part.inlineData.data, 'base64');
      fs.writeFileSync(filepath, buffer);
      return filename;
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

// ===========================
// 1. Prompt 分叉增强
// ===========================

/**
 * 将用户的朴素描述分叉为两个不同方向的专业 Prompt
 * @param {string} userDesc - 用户写的简单描述
 * @param {string} styleTag - 选择的风格标签
 * @param {string} refImagePath - 参考图路径（可选）
 * @returns {Promise<{promptA: string, promptB: string, directionA: string, directionB: string}>}
 */
export async function forkPrompts(userDesc, styleTag, refImagePath) {
  const client = getClient();

  const systemPrompt = `你是一位专业的游戏美术提示词工程师。用户会用简单的中文描述一个游戏关卡的需求。

你需要将这个描述扩展为两个不同方向的英文专业美术 Prompt，用于 AI 图像生成。

两个方向要有明显的差异（例如：一个偏可爱风格、一个偏酷炫风格；或一个偏简约、一个偏细腻丰富），但都要忠实于用户描述的核心元素。

每个 Prompt 都必须包含：
- 具体的画面风格描述（基于用户选择的风格标签：${styleTag}）
- 构图和视角
- 光影和色调
- 适合作为游戏关卡的场景构图
- 所有用户提到的元素

请以 JSON 格式返回（不要 markdown 代码块）：
{
  "directionA": "2-4个字的方向描述（中文）",
  "promptA": "完整的英文 Prompt",
  "directionB": "2-4个字的方向描述（中文）", 
  "promptB": "完整的英文 Prompt"
}`;

  const contents = [{ text: systemPrompt + '\n\n用户描述：' + userDesc }];

  // 如果有参考图，加入上下文
  if (refImagePath && fs.existsSync(refImagePath)) {
    contents.unshift(imageToPart(refImagePath));
    contents[1].text += '\n\n（参考图已上传，请参考其风格和色调）';
  }

  const response = await client.models.generateContent({
    model: MODEL_TEXT,
    contents,
    config: {
      responseMimeType: 'application/json',
    },
  });

  const text = response.candidates[0].content.parts[0].text;
  return JSON.parse(text);
}

// ===========================
// 2. 场景图生成
// ===========================

/**
 * 生成场景图
 * @param {string} enhancedPrompt - AI 增强后的专业 Prompt
 * @param {string} refImagePath - 参考图路径（可选）
 * @param {string} aspectRatio - 宽高比
 * @returns {Promise<string|null>} 生成的图片文件名
 */
export async function generateScene(enhancedPrompt, refImagePath, aspectRatio = '4:3') {
  const client = getClient();

  const fullPrompt = `Generate a complete game level scene based on this description:\n\n${enhancedPrompt}\n\nRequirements:\n- Aspect ratio: ${aspectRatio} (landscape)\n- High quality, vibrant colors, suitable as a game level visual design\n- Include all elements mentioned in the description with clear visibility\n- Each element should be clearly distinguishable and not too small`;

  const contents = [];
  if (refImagePath && fs.existsSync(refImagePath)) {
    contents.push(imageToPart(refImagePath));
  }
  contents.push({ text: fullPrompt });

  const response = await client.models.generateContent({
    model: MODEL_IMAGE,
    contents,
    config: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  });

  return saveImageFromResponse(response);
}

// ===========================
// 3. 元素识别 + Bbox + 遮挡检测
// ===========================

/**
 * 分析场景图，识别元素及其 Bbox，判断遮挡关系
 * @param {string} scenePath - 场景图路径
 * @returns {Promise<Array<{name: string, bbox: number[], occluded: boolean}>>}
 */
export async function analyzeElements(scenePath) {
  const client = getClient();
  const scenePart = imageToPart(scenePath);

  // 获取图片尺寸
  const sharp = (await import('sharp')).default;
  const metadata = await sharp(scenePath).metadata();
  const imgW = metadata.width;
  const imgH = metadata.height;

  const analyzePrompt = `请分析这张游戏关卡场景图（尺寸：${imgW}x${imgH} 像素），识别其中不同种类的游戏元素。

重要规则：
- 最多返回 15 个元素，按面积从大到小排序
- 同类元素只返回一个代表（如有 10 颗子弹，只返回一个"子弹"）
- 不同外观的算不同种类
- 忽略太小的元素（宽或高小于 30 像素的不要标注）
- 忽略纯背景元素（云朵、星星等属于背景的内容）

对于每个元素，请判断：
- name：元素种类的中文名称（简洁，2-6 个字）
- bbox：该元素的边界框 [x, y, width, height]，单位为像素
- occluded：该元素是否被其他元素遮挡或与其他元素重叠（true/false）

遮挡判断标准：如果该元素的边界框与其他元素有明显重叠，或元素本身被部分遮挡无法看到完整轮廓，则标记为 occluded: true。

请只返回纯 JSON 数组，不要包含 markdown 代码块或其它文字：
[{"name": "玩家飞机", "bbox": [100, 300, 200, 150], "occluded": false}, ...]`;

  const response = await client.models.generateContent({
    model: MODEL_TEXT,
    contents: [scenePart, { text: analyzePrompt }],
    config: {
      responseMimeType: 'application/json',
    },
  });

  const text = response.candidates[0].content.parts[0].text;
  const elements = JSON.parse(text);

  // 验证和清洗数据
  const valid = [];
  for (const elem of elements) {
    if (elem?.name && Array.isArray(elem?.bbox) && elem.bbox.length === 4) {
      const bbox = elem.bbox.map((v, i) => {
        const val = Math.max(0, Math.round(v));
        if (i === 0) return Math.min(val, imgW);
        if (i === 1) return Math.min(val, imgH);
        if (i === 2) return Math.min(val, imgW - Math.max(0, Math.round(elem.bbox[0])));
        return Math.min(val, imgH - Math.max(0, Math.round(elem.bbox[1])));
      });
      if (bbox[2] > 10 && bbox[3] > 10) {
        valid.push({
          name: elem.name,
          bbox,
          occluded: !!elem.occluded,
        });
      }
    }
  }

  return valid;
}

// ===========================
// 4. 单元素独立重绘
// ===========================

/**
 * 独立重绘单个元素（高质量白底版）
 * @param {string} elementName - 元素名称
 * @param {string} elementDesc - 元素描述（可选，用户自定义）
 * @param {string} scenePath - 原场景图路径（用作风格参考）
 * @param {number[]} bbox - 元素在场景中的位置
 * @param {string} styleTag - 风格标签
 * @param {string} refImagePath - 参考图路径（可选）
 * @returns {Promise<string|null>} 生成的图片文件名
 */
export async function regenerateElement(elementName, elementDesc, scenePath, bbox, styleTag, refImagePath) {
  const client = getClient();

  const contents = [];

  // 参考图 + 场景图作为风格锚
  if (refImagePath && fs.existsSync(refImagePath)) {
    contents.push(imageToPart(refImagePath));
  }
  if (scenePath && fs.existsSync(scenePath)) {
    contents.push(imageToPart(scenePath));
  }

  const desc = elementDesc || elementName;
  const prompt = `Based on the reference images above, generate a single game asset element: "${elementName}".

${elementDesc ? `Additional description: ${elementDesc}` : ''}

This element appears in the scene at position [${bbox.join(', ')}] (x, y, width, height in pixels).

Requirements:
- Pure white background (#FFFFFF)
- Single element only, centered, no other objects
- Style must match the reference images exactly (${styleTag} style)
- High detail, clean edges, game-ready sprite
- The element should be large and prominent in the image
- Maintain the same visual identity as the element in the scene`;

  contents.push({ text: prompt });

  const response = await client.models.generateContent({
    model: MODEL_IMAGE,
    contents,
    config: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  });

  return saveImageFromResponse(response);
}

// ===========================
// 5. 背景独立生成
// ===========================

/**
 * 生成纯背景图（去除所有前景元素）
 * @param {string} bgDesc - 背景描述
 * @param {string} scenePath - 场景图路径
 * @param {string} aspectRatio - 宽高比
 * @param {string} refImagePath - 参考图路径（可选）
 * @returns {Promise<string|null>}
 */
export async function generateBackground(bgDesc, scenePath, aspectRatio = '4:3', refImagePath) {
  const client = getClient();

  const contents = [];
  if (refImagePath && fs.existsSync(refImagePath)) {
    contents.push(imageToPart(refImagePath));
  }
  if (scenePath && fs.existsSync(scenePath)) {
    contents.push(imageToPart(scenePath));
  }

  const prompt = `Based on the scene image above, generate ONLY the background with ALL foreground elements removed.

${bgDesc ? `Background description: ${bgDesc}` : ''}

Requirements:
- Remove ALL foreground objects, characters, and UI elements
- Keep only the background (sky, terrain, environment)
- Style, colors, and mood must match the scene exactly
- Fill in areas where foreground elements were with natural background continuation
- Aspect ratio: ${aspectRatio}
- Complete, seamless background suitable as a game level backdrop`;

  contents.push({ text: prompt });

  const response = await client.models.generateContent({
    model: MODEL_IMAGE,
    contents,
    config: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  });

  return saveImageFromResponse(response);
}

// ===========================
// 6. 局部重绘
// ===========================

/**
 * 局部重绘
 * @param {string} imagePath - 原图路径
 * @param {string} maskPath - 遮罩图路径
 * @param {string} prompt - 修改描述
 * @returns {Promise<string|null>}
 */
export async function inpaintImage(imagePath, maskPath, prompt) {
  const client = getClient();

  const contents = [
    imageToPart(imagePath),
    imageToPart(maskPath),
    {
      text: `Please modify this image. The second image is a mask where white areas should be repainted and black areas kept unchanged.

Modification request: ${prompt}

Keep unmasked areas completely unchanged. The repainted area should blend naturally with the surrounding content.`,
    },
  ];

  const response = await client.models.generateContent({
    model: MODEL_IMAGE,
    contents,
    config: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  });

  return saveImageFromResponse(response);
}
