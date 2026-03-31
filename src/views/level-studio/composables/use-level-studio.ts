/**
 * Level Studio 状态管理 + API 调用
 */

import { reactive, ref, computed } from 'vue';

/** 单个元素状态 */
export interface ElementItem {
  name: string;
  bbox: number[];
  occluded: boolean;
  selected: boolean;
  /** 处理模式：crop = 场景裁切，regen = 独立重绘 */
  mode: 'crop' | 'regen';
  /** 裁切后的图片 URL */
  cropUrl: string | null;
  /** 重绘后的图片 URL */
  regenUrl: string | null;
  /** 当前使用的 URL（由 mode 决定） */
  activeUrl: string | null;
  /** 加载状态 */
  loading: boolean;
}

/** 全局状态 */
const state = reactive({
  /** 当前阶段：input -> scene -> elements -> export */
  phase: 'input' as 'input' | 'scene' | 'elements' | 'export',

  // -- Phase 1: 输入 --
  description: '',
  styleTag: 'flat-cartoon',
  aspectRatio: '4:3',
  refImageFile: null as File | null,
  refImageUrl: '' as string,
  /** 存在服务端的参考图路径（上传后获得） */
  refUploadedPath: '' as string,

  // Prompt 分叉结果
  promptForkLoading: false,
  directionA: '',
  promptA: '',
  directionB: '',
  promptB: '',

  // -- Phase 2: 场景选择 --
  sceneLoading: false,
  sceneA: '' as string,
  sceneB: '' as string,
  selectedScene: '' as string,

  // -- Phase 3: 元素处理 --
  analyzeLoading: false,
  elements: [] as ElementItem[],

  // -- Phase 4: 背景 + 导出 --
  bgDescription: '',
  bgUrl: '' as string,
  bgLoading: false,
  downloadLoading: false,
});

const error = ref('');
const globalLoading = computed(() =>
  state.promptForkLoading || state.sceneLoading || state.analyzeLoading || state.bgLoading
);

/** API 基础路径 */
const API = '/api/level-studio';

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
  state.refImageFile = file;
  if (file) {
    state.refImageUrl = URL.createObjectURL(file);
  } else {
    state.refImageUrl = '';
  }
}

/** Prompt 分叉增强 */
async function forkPrompts() {
  if (!state.description.trim()) {
    error.value = '请输入关卡描述';
    return;
  }
  error.value = '';
  state.promptForkLoading = true;

  try {
    const formData = new FormData();
    formData.append('description', state.description);
    formData.append('styleTag', state.styleTag);
    if (state.refImageFile) {
      formData.append('reference', state.refImageFile);
    }

    const data = await apiPostForm('/fork-prompts', formData);
    state.directionA = data.directionA;
    state.promptA = data.promptA;
    state.directionB = data.directionB;
    state.promptB = data.promptB;
  } catch (e: any) {
    error.value = e.message;
  } finally {
    state.promptForkLoading = false;
  }
}

/** 生成两张候选场景图 */
async function generateScenes() {
  if (!state.promptA || !state.promptB) {
    error.value = '请先生成 Prompt';
    return;
  }
  error.value = '';
  state.sceneLoading = true;
  state.sceneA = '';
  state.sceneB = '';

  try {
    const formDataA = new FormData();
    formDataA.append('prompt', state.promptA);
    formDataA.append('aspectRatio', state.aspectRatio);
    if (state.refImageFile) formDataA.append('reference', state.refImageFile);

    const formDataB = new FormData();
    formDataB.append('prompt', state.promptB);
    formDataB.append('aspectRatio', state.aspectRatio);
    if (state.refImageFile) formDataB.append('reference', state.refImageFile);

    // 并行生成两张
    const [resultA, resultB] = await Promise.all([
      apiPostForm('/generate', formDataA),
      apiPostForm('/generate', formDataB),
    ]);

    state.sceneA = resultA.scene;
    state.sceneB = resultB.scene;
    state.phase = 'scene';
  } catch (e: any) {
    error.value = e.message;
  } finally {
    state.sceneLoading = false;
  }
}

/** 选定场景图 */
function selectScene(url: string) {
  state.selectedScene = url;
}

/** 分析选定场景中的元素 */
async function analyzeScene() {
  if (!state.selectedScene) {
    error.value = '请先选择一张场景图';
    return;
  }
  error.value = '';
  state.analyzeLoading = true;
  state.elements = [];

  try {
    const data = await apiPost('/analyze', { sceneUrl: state.selectedScene });

    state.elements = (data.elements || []).map((el: any) => ({
      name: el.name,
      bbox: el.bbox,
      occluded: !!el.occluded,
      selected: true,
      // 有遮挡的元素默认选择重绘
      mode: el.occluded ? 'regen' : 'crop',
      cropUrl: null,
      regenUrl: null,
      activeUrl: null,
      loading: false,
    }));

    state.phase = 'elements';
  } catch (e: any) {
    error.value = e.message;
  } finally {
    state.analyzeLoading = false;
  }
}

/** 裁切单个元素 */
async function cropElement(index: number) {
  const el = state.elements[index];
  if (!el) return;
  el.loading = true;

  try {
    const data = await apiPost('/crop', {
      sceneUrl: state.selectedScene,
      bbox: el.bbox,
    });
    el.cropUrl = data.url;
    el.activeUrl = data.url;
    el.mode = 'crop';
  } catch (e: any) {
    error.value = e.message;
  } finally {
    el.loading = false;
  }
}

/** 独立重绘单个元素 */
async function regenerateElement(index: number) {
  const el = state.elements[index];
  if (!el) return;
  el.loading = true;

  try {
    const formData = new FormData();
    formData.append('elementName', el.name);
    formData.append('sceneUrl', state.selectedScene);
    formData.append('bbox', JSON.stringify(el.bbox));
    formData.append('styleTag', state.styleTag);
    if (state.refImageFile) formData.append('reference', state.refImageFile);

    const data = await apiPostForm('/regenerate', formData);
    el.regenUrl = data.url;
    el.activeUrl = data.url;
    el.mode = 'regen';
  } catch (e: any) {
    error.value = e.message;
  } finally {
    el.loading = false;
  }
}

/** 批量处理所有选中元素 */
async function processAllElements() {
  const selected = state.elements.filter(el => el.selected);
  for (const el of selected) {
    const idx = state.elements.indexOf(el);
    if (el.mode === 'regen') {
      await regenerateElement(idx);
    } else {
      await cropElement(idx);
    }
  }
}

/** 切换元素模式 */
function switchElementMode(index: number, mode: 'crop' | 'regen') {
  const el = state.elements[index];
  if (!el) return;
  el.mode = mode;
  if (mode === 'crop' && el.cropUrl) {
    el.activeUrl = el.cropUrl;
  } else if (mode === 'regen' && el.regenUrl) {
    el.activeUrl = el.regenUrl;
  }
}

/** 生成背景 */
async function generateBackground() {
  if (!state.selectedScene) return;
  state.bgLoading = true;

  try {
    const formData = new FormData();
    formData.append('sceneUrl', state.selectedScene);
    formData.append('description', state.bgDescription);
    formData.append('aspectRatio', state.aspectRatio);
    if (state.refImageFile) formData.append('reference', state.refImageFile);

    const data = await apiPostForm('/background', formData);
    state.bgUrl = data.url;
  } catch (e: any) {
    error.value = e.message;
  } finally {
    state.bgLoading = false;
  }
}

/** 下载 ZIP */
async function downloadZip() {
  state.downloadLoading = true;
  try {
    const urls: string[] = [];
    // 场景图
    if (state.selectedScene) urls.push(state.selectedScene);
    // 背景
    if (state.bgUrl) urls.push(state.bgUrl);
    // 元素
    for (const el of state.elements) {
      if (el.selected && el.activeUrl) urls.push(el.activeUrl);
    }

    if (urls.length === 0) {
      error.value = '没有可下载的文件';
      return;
    }

    const resp = await fetch(`${API}/download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileUrls: urls }),
    });

    if (!resp.ok) throw new Error('打包失败');

    const blob = await resp.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'level_assets.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (e: any) {
    error.value = e.message;
  } finally {
    state.downloadLoading = false;
  }
}

/** 重置 */
function reset() {
  state.phase = 'input';
  state.promptA = '';
  state.promptB = '';
  state.directionA = '';
  state.directionB = '';
  state.sceneA = '';
  state.sceneB = '';
  state.selectedScene = '';
  state.elements = [];
  state.bgUrl = '';
  error.value = '';
}

/** 进入导出阶段 */
function goToExport() {
  state.phase = 'export';
}

export function useLevelStudio() {
  return {
    state,
    error,
    globalLoading,
    setRefImage,
    forkPrompts,
    generateScenes,
    selectScene,
    analyzeScene,
    cropElement,
    regenerateElement,
    processAllElements,
    switchElementMode,
    generateBackground,
    downloadZip,
    goToExport,
    reset,
  };
}
