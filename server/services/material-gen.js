/**
 * Material Studio AI 服务
 *
 * 提供素材生成工作台所需的全部 AI 能力：
 * - 意图评估 + 追问引导（黑箱 #1）
 * - Prompt 增强工程（黑箱 #2）
 * - 图片生成
 * - 元素识别 + Bbox
 * - 背景重绘
 */

import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import config from '../config/env.js';

// 模型选择
const MODEL_TEXT = 'gemini-3.1-flash-lite-preview';       // 意图判断 + Prompt 增强
const MODEL_IMAGE = 'gemini-3.1-flash-image-preview';      // 图片生成

// 输出目录
const OUTPUT_DIR = config.materialStudioOutput;
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

/** 从 Gemini 响应中提取并保存图片到指定任务目录 */
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
  const taskId = `task_${crypto.randomUUID().slice(0, 12)}`;
  const taskDir = path.join(OUTPUT_DIR, taskId);
  fs.mkdirSync(taskDir, { recursive: true });
  fs.mkdirSync(path.join(taskDir, 'elements'), { recursive: true });
  return { taskId, taskDir };
}

// ===========================
// 1. 意图评估 + 追问（黑箱 #1）
// ===========================

const INTENT_SYSTEM_PROMPT = `你是一位专业的视觉素材设计助手，正在帮助用户精确描述他们想要生成的图片素材。

## 你的任务

分析用户的输入，从三个维度评估描述的完整性，并决定下一步动作。

## 三大评估维度

### D1 - 主体内容（画面具体构成）
评估用户是否描述了画面中要出现的具体元素及其布局关系。
- ✅ 合格："画面左侧有一只机器人，右边是太空飞船，中间有一颗发光的星球"
- ✅ 合格："一只猫坐在窗台上，窗外是下雨的城市"
- ❌ 不合格："帮我画个东西" / "我要一张好看的图" / "太空主题"
- ⚠️ 边界："一只猫" → 有主体但缺布局和场景细节，仍算不合格

### D2 - 呈现意图（情绪/氛围/表达目标）
评估用户是否说明了画面想要传达的情感、氛围或视觉目标。
- ✅ 合格："画面要明亮温暖，突出探险的兴奋感" / "要有紧张刺激的游戏感"
- ✅ 合格："整体酷一点，科技感强"
- ❌ 不合格：完全没提到任何情感/氛围相关的描述

### D3 - 背景约束（用途/场景）
评估用户是否说明了这个素材的用途或使用场景。
- ✅ 合格："这是给SB3编程关卡用的" / "做PPT封面" / "公众号配图" / "游戏素材"
- ❌ 不合格：完全没提到用途

## 评估规则

1. 严格按照上述标准判断每个维度，不要放水
2. 如果存在之前的对话历史，要综合所有轮次的信息来判断
3. 一个维度一旦在之前轮次确认，后续不再追问

## 追问优先级

当有多个维度缺失时，按以下优先级只追问排在最前的那一个：
D1（主体内容）> D3（背景约束）> D2（呈现意图）

## 追问要求

- 语气友好自然，像设计师同事在聊天
- 先肯定用户已有的描述，再引导补充
- 必须提供 3-4 个具体选项供用户快捷选择
- 选项要贴合用户已经提供的信息，不能太泛
- 同时允许用户自己描述（选项之外）

## 输出格式

请以纯 JSON 输出（不要 markdown 代码块），格式如下：

{
  "dimensions": {
    "d1": {
      "status": "pass" 或 "fail",
      "extracted": "从用户输入中提取的主体内容摘要，pass时必填",
      "reason": "判断理由，简短说明"
    },
    "d2": {
      "status": "pass" 或 "fail",
      "extracted": "提取的呈现意图摘要",
      "reason": "判断理由"
    },
    "d3": {
      "status": "pass" 或 "fail",
      "extracted": "提取的背景约束摘要",
      "reason": "判断理由"
    }
  },
  "allPass": true 或 false,
  "nextAction": "clarify_d1" 或 "clarify_d2" 或 "clarify_d3" 或 "select_style",
  "reply": "给用户的自然语言回复",
  "options": ["选项1", "选项2", "选项3"],
  "styleHints": ["当 allPass 时，根据收集的信息推荐 2-3 个适合的风格关键词"]
}`;

/**
 * 评估用户意图，决定追问或通过
 * @param {string} message - 用户当前输入
 * @param {object} context - 对话上下文
 * @param {boolean} hasRefImage - 是否有参考图
 * @param {string} aspectRatio - 比例
 * @returns {Promise<object>} AI 评估结果
 */
export async function evaluateIntent(message, context, hasRefImage = false, aspectRatio = '1:1') {
  const client = getClient();

  const userContext = JSON.stringify({
    currentMessage: message,
    history: context.history || [],
    hasReferenceImage: hasRefImage,
    aspectRatio,
  }, null, 2);

  const prompt = `${INTENT_SYSTEM_PROMPT}

---
用户上下文：
${userContext}

用户当前输入："${message}"`;

  const response = await client.models.generateContent({
    model: MODEL_TEXT,
    contents: [{ text: prompt }],
    config: {
      responseMimeType: 'application/json',
    },
  });

  const text = response.candidates[0].content.parts[0].text;
  return JSON.parse(text);
}

// ===========================
// 2. Prompt 增强（黑箱 #2）
// ===========================

/**
 * 将收集到的完整意图增强为专业 Prompt
 * @param {object} conclusions - 三维度结论
 * @param {string} style - 选定风格
 * @param {string} aspectRatio - 比例
 * @param {string} refImagePath - 参考图路径（可选）
 * @returns {Promise<string>} 增强后的英文 Prompt
 */
export async function enhancePrompt(conclusions, style, aspectRatio, refImagePath) {
  const client = getClient();

  const systemPrompt = `你是一位顶尖的 AI 图片生成 Prompt 工程师。请将以下结构化的用户意图转化为一个专业的英文 AI 绘图 Prompt。

## 用户意图
- 主体内容：${conclusions.d1}
- 呈现意图：${conclusions.d2}
- 用途约束：${conclusions.d3}
- 视觉风格：${style}
- 画面比例：${aspectRatio}

## 增强策略

1. 翻译为英文并使用专业美术术语
2. 根据用途约束自动注入特定要求：
   - 如果是 SB3/Scratch 关卡 → 强调分层意识（前景元素可分离）、游戏风格、各元素清晰可辨
   - 如果是 PPT → 强调留白给文字、构图大气、商务感
   - 如果是公众号/社交媒体 → 强调吸引眼球、色彩鲜艳
   - 如果是游戏素材 → 强调高质量、细节丰富、角色突出
3. 补充细节描述（材质、光影、纹理）
4. 添加质量控制关键词（high quality, detailed, vibrant colors 等）
5. 根据比例优化构图描述
6. 融入选定风格的视觉特征${refImagePath ? '\n7. 参考图已提供，请融合参考图的视觉特征' : ''}

## 输出

请以纯 JSON 输出（不要 markdown 代码块）：
{
  "enhancedPrompt": "完整的英文 Prompt 字符串",
  "summary": "20字以内的中文摘要，描述这个 Prompt 的核心内容"
}`;

  const contents = [];
  if (refImagePath && fs.existsSync(refImagePath)) {
    contents.push(imageToPart(refImagePath));
  }
  contents.push({ text: systemPrompt });

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
// 3. 图片生成
// ===========================

/**
 * 生成图片
 * @param {string} enhancedPrompt - 增强后的 Prompt
 * @param {string} taskDir - 任务目录
 * @param {string} aspectRatio - 比例
 * @param {string} refImagePath - 参考图（可选）
 * @returns {Promise<string|null>} 生成的图片文件名
 */
export async function generateImage(enhancedPrompt, taskDir, aspectRatio = '1:1', refImagePath) {
  const client = getClient();

  const prompt = `Generate an image based on this description:\n\n${enhancedPrompt}\n\nAspect ratio: ${aspectRatio}. High quality, detailed, professional.`;

  const contents = [];
  if (refImagePath && fs.existsSync(refImagePath)) {
    contents.push(imageToPart(refImagePath));
  }
  contents.push({ text: prompt });

  const response = await client.models.generateContent({
    model: MODEL_IMAGE,
    contents,
    config: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  });

  return saveImageFromResponse(response, taskDir, 'original.png');
}

// ===========================
// 4. 元素识别 + Bbox
// ===========================

/**
 * 分析图片中的前景元素
 * @param {string} imagePath - 图片路径
 * @returns {Promise<Array<{name: string, bbox: number[]}>>}
 */
export async function analyzeElements(imagePath) {
  const client = getClient();
  const imgPart = imageToPart(imagePath);

  const sharp = (await import('sharp')).default;
  const metadata = await sharp(imagePath).metadata();
  const imgW = metadata.width;
  const imgH = metadata.height;

  const prompt = `请分析这张图片（尺寸：${imgW}x${imgH} 像素），识别其中的前景元素。

重要规则：
- 只识别前景元素，不要标注背景元素（天空、地面、远景等）
- 最多返回 12 个元素，按面积从大到小排序
- 同类元素只返回一个代表
- 忽略太小的元素（宽或高小于 30 像素）

对于每个元素，提供：
- name：元素的中文名称（简洁，2-6 个字）
- bbox：边界框 [x, y, width, height]，单位为像素

请只返回纯 JSON 数组，不要包含 markdown 代码块或其它文字：
[{"name": "飞船", "bbox": [100, 300, 200, 150]}, ...]`;

  const response = await client.models.generateContent({
    model: MODEL_TEXT,
    contents: [imgPart, { text: prompt }],
    config: {
      responseMimeType: 'application/json',
    },
  });

  const text = response.candidates[0].content.parts[0].text;
  const elements = JSON.parse(text);

  // 验证和清洗
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
        valid.push({ name: elem.name, bbox });
      }
    }
  }

  return valid.slice(0, 12);
}

// ===========================
// 5. 背景重绘
// ===========================

/**
 * 去掉选中元素后重绘背景
 * @param {string} imagePath - 原图路径
 * @param {Array<{name: string, bbox: number[]}>} elements - 要去除的元素
 * @param {string} taskDir - 任务目录
 * @param {string} aspectRatio - 比例
 * @returns {Promise<string|null>}
 */
export async function regenerateBackground(imagePath, elements, taskDir, aspectRatio = '1:1') {
  const client = getClient();

  const elementDesc = elements.map(e => `"${e.name}" at [${e.bbox.join(', ')}]`).join(', ');

  const prompt = `Based on this image, generate ONLY the background with the following foreground elements REMOVED: ${elementDesc}.

Requirements:
- Remove ALL listed foreground objects completely
- Fill in the areas naturally with background continuation
- Keep the overall style, colors, mood, and lighting consistent
- Aspect ratio: ${aspectRatio}
- The result should be a clean, seamless background`;

  const contents = [imageToPart(imagePath), { text: prompt }];

  const response = await client.models.generateContent({
    model: MODEL_IMAGE,
    contents,
    config: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  });

  return saveImageFromResponse(response, taskDir, 'background.png');
}

// ===========================
// 6. 元素裁切（复用 image-processor 逻辑）
// ===========================

/**
 * 从图片中裁切指定 bbox 区域
 * @param {string} imagePath - 原图路径
 * @param {number[]} bbox - [x, y, width, height]
 * @param {string} outputPath - 输出文件路径
 * @param {number} padding - 裁切边距
 */
export async function cropElement(imagePath, bbox, outputPath, padding = 10) {
  const sharp = (await import('sharp')).default;
  const [x, y, w, h] = bbox;
  const metadata = await sharp(imagePath).metadata();
  const imgW = metadata.width;
  const imgH = metadata.height;

  const left = Math.max(0, x - padding);
  const top = Math.max(0, y - padding);
  const width = Math.min(imgW - left, w + 2 * padding);
  const height = Math.min(imgH - top, h + 2 * padding);

  await sharp(imagePath)
    .extract({ left, top, width, height })
    .png()
    .toFile(outputPath);
}
