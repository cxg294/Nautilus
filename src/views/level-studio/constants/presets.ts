/**
 * Level Studio 预设常量
 * 风格库 + 游戏模板 + Prompt 默认词
 */

// 风格示意图静态资源（仅用于界面展示，不作为 AI 参考图发送）
import imgFlatCartoon from '../assets/styles/flat-cartoon.png';
import imgPixelArt from '../assets/styles/pixel-art.png';
import imgChibiCute from '../assets/styles/chibi-cute.png';
import imgWatercolor from '../assets/styles/watercolor.png';
import imgCyberpunk from '../assets/styles/cyberpunk.png';
import imgLowPoly from '../assets/styles/low-poly.png';
import imgInkwash from '../assets/styles/inkwash.png';
import imgRealistic from '../assets/styles/realistic.png';

/** 画面风格选项 */
export const STYLE_OPTIONS = [
  { label: '扁平卡通', value: 'flat-cartoon', keywords: 'flat cartoon style, bold outlines, vibrant saturated colors, clean shapes', preview: imgFlatCartoon },
  { label: '像素复古', value: 'pixel-art', keywords: 'pixel art style, retro 16-bit, crisp pixels, nostalgic palette', preview: imgPixelArt },
  { label: 'Q 版可爱', value: 'chibi-cute', keywords: 'chibi cute style, big heads, small bodies, kawaii, pastel colors, adorable', preview: imgChibiCute },
  { label: '手绘水彩', value: 'watercolor', keywords: 'hand-painted watercolor style, soft brush strokes, gentle gradients, artistic', preview: imgWatercolor },
  { label: '赛博朋克', value: 'cyberpunk', keywords: 'cyberpunk style, neon glow, dark futuristic, high contrast, holographic', preview: imgCyberpunk },
  { label: '低多边形', value: 'low-poly', keywords: 'low-poly 3D style, geometric, minimalist, faceted surfaces, clean colors', preview: imgLowPoly },
  { label: '水墨国风', value: 'inkwash', keywords: 'Chinese ink wash painting style, traditional brush strokes, elegant minimalist, mountains', preview: imgInkwash },
  { label: '写实', value: 'realistic', keywords: 'semi-realistic style, detailed textures, natural lighting, cinematic quality', preview: imgRealistic },
] as const;

/** 画面比例选项 */
export const ASPECT_RATIOS = [
  { label: '4:3 横版', value: '4:3' },
  { label: '16:9 宽屏', value: '16:9' },
  { label: '3:4 竖版', value: '3:4' },
  { label: '1:1 方形', value: '1:1' },
] as const;


/** Bbox 显示颜色调色板 */
export const BBOX_COLORS = [
  '#7c5cfc', '#5cfcb6', '#fc5c5c', '#fcb65c',
  '#5c8afc', '#fc5cba', '#b65cfc', '#5cfcfc',
  '#fcfc5c', '#5cfc5c', '#fc8c5c', '#5c5cfc',
];
