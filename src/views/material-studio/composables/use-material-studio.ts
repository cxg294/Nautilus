/**
 * Material Studio 状态管理 + API 调用
 */

import { reactive, ref, computed } from 'vue';

// ===========================
// 类型定义
// ===========================

/** 对话卡片 */
export interface DialogCardData {
  id: string;
  round: number;
  userInput: string;
  aiReply: string;
  dimension: string;
  options: string[];
  userChoice: string | null;
}

/** 三维度结论 */
export interface Conclusions {
  d1: string | null;
  d2: string | null;
  d3: string | null;
}

/** 元素 */
export interface ElementItem {
  name: string;
  bbox: number[];
  selected: boolean;
}

/** 提取结果元素 */
export interface ExtractedElement {
  name: string;
  file: string;
  bbox: number[];
  url: string;
}

/** 阶段 */
export type Phase =
  | 'welcome'       // 初始欢迎
  | 'clarifying'    // 追问中
  | 'styling'       // 风格选择
  | 'generating'    // 生成中
  | 'result'        // 结果展示
  | 'decomposing'   // 素材拆解
  | 'extracting'    // 素材提取中
  | 'exported';     // 导出完成

// ===========================
// 预设风格库
// ===========================

export interface StyleOption {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
  description: string;
}

export const STYLE_LIBRARY: StyleOption[] = [
  { id: 'flat-cartoon', name: '扁平卡通', nameEn: 'Flat Cartoon', icon: '🎨', description: '简洁明快，适合教育类和儿童向' },
  { id: 'cyberpunk', name: '赛博朋克', nameEn: 'Cyberpunk', icon: '🌆', description: '霓虹灯光、暗色调、科技感强烈' },
  { id: 'pixel-retro', name: '像素复古', nameEn: 'Pixel Retro', icon: '👾', description: '8bit 像素风格，复古游戏感' },
  { id: 'watercolor', name: '水彩手绘', nameEn: 'Watercolor', icon: '🖌️', description: '柔和温暖，艺术气息浓郁' },
  { id: 'realistic-3d', name: '写实3D', nameEn: 'Realistic 3D', icon: '🏔️', description: '高品质渲染，立体感强' },
  { id: 'anime', name: '日系动漫', nameEn: 'Anime', icon: '✨', description: '日漫画风，色彩明亮' },
  { id: 'minimalist', name: '极简主义', nameEn: 'Minimalist', icon: '⬜', description: '大量留白，线条简洁' },
  { id: 'sci-fi', name: '科幻史诗', nameEn: 'Sci-Fi Epic', icon: '🚀', description: '宏大场景，太空科幻感' },
  { id: 'low-poly', name: '低多边形', nameEn: 'Low Poly', icon: '💎', description: '几何棱角，现代时尚' },
  { id: 'comic', name: '美漫风格', nameEn: 'Comic Style', icon: '💥', description: '漫画分格感，色彩饱和' },
];

// ===========================
// 全局状态
// ===========================

const state = reactive({
  phase: 'welcome' as Phase,

  // -- 用户输入 --
  inputText: '',
  refImage: null as File | null,
  refImagePreview: '',
  aspectRatio: '4:3' as string,

  // -- 追问对话 --
  cards: [] as DialogCardData[],
  conclusions: { d1: null, d2: null, d3: null } as Conclusions,
  currentReply: '',
  currentOptions: [] as string[],
  currentDimension: '',

  // -- 风格选择 --
  styleHints: [] as string[],
  selectedStyle: '',

  // -- 生成结果 --
  taskId: '',
  imageUrl: '',
  enhancedPrompt: '',
  promptSummary: '',

  // -- 素材拆解 --
  elements: [] as ElementItem[],

  // -- 素材提取 --
  backgroundUrl: '',
  extractedElements: [] as ExtractedElement[],
  manifestUrl: '',

  // -- 对话上下文（发送给后端） --
  apiContext: { history: [], refPath: null } as any,

  // -- 加载状态 --
  chatLoading: false,
  generateLoading: false,
  analyzeLoading: false,
  extractLoading: false,

  // -- 生成进度文案 --
  generatingStep: '',
});

const error = ref('');

// ===========================
// API helpers
// ===========================

const API = '/api/material-studio';

async function apiPost(endpoint: string, body: any) {
  const resp = await fetch(`${API}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: '请求失败' }));
    throw new Error(err.error || '请求失败');
  }
  return resp.json();
}

async function apiPostForm(endpoint: string, formData: FormData) {
  const resp = await fetch(`${API}${endpoint}`, {
    method: 'POST',
    body: formData,
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: '请求失败' }));
    throw new Error(err.error || '请求失败');
  }
  return resp.json();
}

// ===========================
// Actions
// ===========================

/** 设置参考图 */
function setRefImage(file: File | null) {
  state.refImage = file;
  if (file) {
    state.refImagePreview = URL.createObjectURL(file);
  } else {
    state.refImagePreview = '';
  }
}

/** 发送消息（初次提交 / 追问回复） */
async function sendMessage(message: string) {
  if (!message.trim()) return;
  error.value = '';
  state.chatLoading = true;

  try {
    const formData = new FormData();
    formData.append('message', message);
    formData.append('context', JSON.stringify(state.apiContext));
    formData.append('aspectRatio', state.aspectRatio);
    if (state.refImage && state.cards.length === 0) {
      formData.append('reference', state.refImage);
    }

    const data = await apiPostForm('/chat', formData);

    // 添加卡片
    const card: DialogCardData = {
      id: `card_${Date.now()}`,
      round: state.cards.length + 1,
      userInput: message,
      aiReply: data.reply,
      dimension: data.dimension,
      options: data.options || [],
      userChoice: null,
    };
    state.cards.push(card);

    // 更新状态
    state.conclusions = data.conclusions;
    state.currentReply = data.reply;
    state.currentOptions = data.options || [];
    state.currentDimension = data.dimension;
    state.styleHints = data.styleHints || [];
    state.apiContext = data.context;

    // 切换阶段
    if (state.phase === 'welcome') {
      state.phase = 'clarifying';
    }

    if (data.action === 'select_style') {
      state.phase = 'styling';
    }
  } catch (e: any) {
    error.value = e.message;
  } finally {
    state.chatLoading = false;
  }
}

/** 选择追问选项 */
function selectOption(cardId: string, option: string) {
  const card = state.cards.find(c => c.id === cardId);
  if (card) {
    card.userChoice = option;
  }
  // 自动发送选择作为下一轮消息
  sendMessage(option);
}

/** 选择风格并生成 */
async function selectStyleAndGenerate(styleId: string) {
  state.selectedStyle = styleId;
  state.phase = 'generating';
  state.generateLoading = true;
  error.value = '';

  try {
    state.generatingStep = '正在增强描述...';

    const formData = new FormData();
    formData.append('conclusions', JSON.stringify(state.conclusions));
    formData.append('style', styleId);
    formData.append('aspectRatio', state.aspectRatio);
    formData.append('context', JSON.stringify(state.apiContext));
    if (state.refImage) {
      formData.append('reference', state.refImage);
    }

    state.generatingStep = '正在生成图片...';

    const data = await apiPostForm('/generate', formData);

    state.taskId = data.taskId;
    state.imageUrl = data.imageUrl;
    state.enhancedPrompt = data.enhancedPrompt;
    state.promptSummary = data.summary;
    state.phase = 'result';
  } catch (e: any) {
    error.value = e.message;
    state.phase = 'styling'; // 失败回到风格选择
  } finally {
    state.generateLoading = false;
    state.generatingStep = '';
  }
}

/** 重新生成（同 Prompt） */
async function regenerate() {
  state.phase = 'generating';
  state.generateLoading = true;
  error.value = '';

  try {
    state.generatingStep = '正在重新生成...';

    const formData = new FormData();
    formData.append('conclusions', JSON.stringify(state.conclusions));
    formData.append('style', state.selectedStyle);
    formData.append('aspectRatio', state.aspectRatio);
    formData.append('context', JSON.stringify(state.apiContext));
    if (state.refImage) {
      formData.append('reference', state.refImage);
    }

    const data = await apiPostForm('/generate', formData);

    state.taskId = data.taskId;
    state.imageUrl = data.imageUrl;
    state.enhancedPrompt = data.enhancedPrompt;
    state.promptSummary = data.summary;
    state.phase = 'result';
  } catch (e: any) {
    error.value = e.message;
    state.phase = 'result';
  } finally {
    state.generateLoading = false;
    state.generatingStep = '';
  }
}

/** 更换风格 */
function changeStyle() {
  state.phase = 'styling';
}

/** 素材拆解 */
async function analyzeImage() {
  state.analyzeLoading = true;
  error.value = '';

  try {
    const data = await apiPost('/analyze', { taskId: state.taskId });
    state.elements = (data.elements || []).map((el: any) => ({
      name: el.name,
      bbox: el.bbox,
      selected: true, // 默认全选
    }));
    state.phase = 'decomposing';
  } catch (e: any) {
    error.value = e.message;
  } finally {
    state.analyzeLoading = false;
  }
}

/** 切换元素选中状态 */
function toggleElement(index: number) {
  if (state.elements[index]) {
    state.elements[index].selected = !state.elements[index].selected;
  }
}

/** 素材提取 */
async function extractAssets() {
  const selected = state.elements.filter(el => el.selected);
  if (selected.length === 0) {
    error.value = '请至少选择一个元素';
    return;
  }

  state.phase = 'extracting';
  state.extractLoading = true;
  error.value = '';

  try {
    const data = await apiPost('/extract', {
      taskId: state.taskId,
      selectedElements: selected.map(el => ({ name: el.name, bbox: el.bbox })),
      aspectRatio: state.aspectRatio,
    });

    state.backgroundUrl = data.background;
    state.extractedElements = data.elements;
    state.manifestUrl = data.manifestUrl;
    state.phase = 'exported';
  } catch (e: any) {
    error.value = e.message;
    state.phase = 'decomposing';
  } finally {
    state.extractLoading = false;
  }
}

/** 下载 ZIP */
function downloadZip() {
  if (!state.taskId) return;
  const a = document.createElement('a');
  a.href = `${API}/download/${state.taskId}`;
  a.download = `material_assets_${state.taskId}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/** 下载单个文件 */
function downloadFile(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/** 全部重置 */
function reset() {
  state.phase = 'welcome';
  state.inputText = '';
  state.refImage = null;
  state.refImagePreview = '';
  state.cards = [];
  state.conclusions = { d1: null, d2: null, d3: null };
  state.currentReply = '';
  state.currentOptions = [];
  state.currentDimension = '';
  state.styleHints = [];
  state.selectedStyle = '';
  state.taskId = '';
  state.imageUrl = '';
  state.enhancedPrompt = '';
  state.promptSummary = '';
  state.elements = [];
  state.backgroundUrl = '';
  state.extractedElements = [];
  state.manifestUrl = '';
  state.apiContext = { history: [], refPath: null };
  error.value = '';
}

// ===========================
// Composable 导出
// ===========================

export function useMaterialStudio() {
  return {
    state,
    error,
    STYLE_LIBRARY,
    setRefImage,
    sendMessage,
    selectOption,
    selectStyleAndGenerate,
    regenerate,
    changeStyle,
    analyzeImage,
    toggleElement,
    extractAssets,
    downloadZip,
    downloadFile,
    reset,
  };
}
