/**
 * 角色生成（test）状态管理 + API 调用
 */

import { reactive, ref, computed } from 'vue';

// ===========================
// 类型定义
// ===========================

export type Phase = 'welcome' | 'generating' | 'character_ready' | 'outfit_generating' | 'outfit_result';

export type OutfitType = 'emotion' | 'action' | 'custom';

export interface OutfitOption {
  label: string;
  emoji: string;
  keywords: string;
}

// ===========================
// 预设选项
// ===========================

export const EMOTION_OPTIONS: OutfitOption[] = [
  { label: '开心', emoji: '😊', keywords: 'happy, smiling, joyful' },
  { label: '伤心', emoji: '😢', keywords: 'sad, crying, tearful' },
  { label: '生气', emoji: '😠', keywords: 'angry, furious, clenching fists' },
  { label: '惊讶', emoji: '😲', keywords: 'surprised, shocked, wide eyes and open mouth' },
  { label: '害怕', emoji: '😨', keywords: 'scared, frightened, trembling' },
  { label: '思考', emoji: '🤔', keywords: 'thinking, pondering, hand on chin' },
  { label: '自信', emoji: '😎', keywords: 'confident, proud, arms crossed' },
  { label: '困倦', emoji: '😴', keywords: 'sleepy, drowsy, yawning' },
  { label: '喜爱', emoji: '🥰', keywords: 'loving, adoring, hearts around' },
  { label: '不服气', emoji: '😤', keywords: 'defiant, stubborn, pouting' },
  { label: '兴奋', emoji: '🤩', keywords: 'excited, thrilled, sparkling eyes' },
  { label: '得意', emoji: '😏', keywords: 'smug, sly, smirking' },
  { label: '害羞', emoji: '😇', keywords: 'shy, bashful, blushing' },
  { label: '无语', emoji: '😑', keywords: 'unamused, deadpan, blank stare' },
  { label: '委屈', emoji: '🥺', keywords: 'aggrieved, teary-eyed, about to cry' },
  { label: '调皮', emoji: '😈', keywords: 'mischievous, playful, sticking tongue out' },
];

export const ACTION_OPTIONS: OutfitOption[] = [
  { label: '坐下', emoji: '🪑', keywords: 'sitting down, seated' },
  { label: '跳舞', emoji: '💃', keywords: 'dancing, dynamic dance pose' },
  { label: '奔跑', emoji: '🏃', keywords: 'running, sprinting' },
  { label: '挥手', emoji: '👋', keywords: 'waving hand, greeting' },
  { label: '跳跃', emoji: '🤸', keywords: 'jumping, leaping in the air' },
  { label: '盘腿打坐', emoji: '🧘', keywords: 'meditating, cross-legged, zen pose' },
  { label: '写字', emoji: '✍️', keywords: 'writing, drawing, holding a pen' },
  { label: '唱歌', emoji: '🎤', keywords: 'singing, holding a microphone, mouth open' },
  { label: '举手欢呼', emoji: '💪', keywords: 'cheering, arms raised up, celebrating' },
  { label: '躺下', emoji: '🛌', keywords: 'lying down, resting, relaxed' },
  { label: '鞠躬', emoji: '🤝', keywords: 'bowing, respectful bow' },
  { label: '走路', emoji: '🚶', keywords: 'walking, strolling, casual walk' },
];

// ===========================
// 全局状态
// ===========================

const state = reactive({
  phase: 'welcome' as Phase,

  // --- 环节一：角色 ---
  characterPrompt: '',
  referenceFile: null as File | null,
  referencePreview: '',
  uploadedCharacter: null as File | null,
  characterImageUrl: '',
  taskId: '',

  // --- 环节二：造型 ---
  outfitType: 'emotion' as OutfitType,
  outfitSelection: '',       // 选中的预设项 label
  outfitCustomText: '',      // 自定义描述
  outfitImageUrl: '',        // 造型结果图 URL

  // --- 通用 ---
  loading: false,
  loadingText: '',
});

const error = ref('');

// ===========================
// Computed
// ===========================

/** 当前选中的造型描述（用于发送给 API） */
const currentOutfitDesc = computed(() => {
  if (state.outfitType === 'custom') {
    return state.outfitCustomText;
  }
  return state.outfitSelection;
});

/** 当前选中的造型关键词 */
const currentOutfitKeywords = computed(() => {
  if (state.outfitType === 'custom') {
    return state.outfitCustomText;
  }
  const options = state.outfitType === 'emotion' ? EMOTION_OPTIONS : ACTION_OPTIONS;
  const opt = options.find(o => o.label === state.outfitSelection);
  return opt?.keywords || state.outfitSelection;
});

// ===========================
// API helpers
// ===========================

const API = '/api/character-gen';

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
function setReferenceImage(file: File | null) {
  state.referenceFile = file;
  if (file) {
    state.referencePreview = URL.createObjectURL(file);
  } else {
    state.referencePreview = '';
  }
}

/** AI 生成角色 */
async function createCharacter() {
  if (!state.characterPrompt.trim()) return;
  error.value = '';
  state.phase = 'generating';
  state.loading = true;
  state.loadingText = '正在准备生成参数...';

  const t1 = setTimeout(() => state.loading && (state.loadingText = '发送给 AI 绘画服务...'), 1000);
  const t2 = setTimeout(() => state.loading && (state.loadingText = 'AI 正在绘制角色中 (可能需要10~30秒)...'), 2500);

  try {
    const formData = new FormData();
    formData.append('prompt', state.characterPrompt.trim());
    if (state.referenceFile) {
      formData.append('reference', state.referenceFile);
    }

    const data = await apiPostForm('/create', formData);
    state.taskId = data.taskId;
    state.characterImageUrl = data.characterUrl;
    state.phase = 'character_ready';
  } catch (e: any) {
    error.value = e.message;
    state.phase = 'welcome';
  } finally {
    clearTimeout(t1);
    clearTimeout(t2);
    state.loading = false;
    state.loadingText = '';
  }
}

/** 上传角色图 */
async function uploadCharacter(file: File) {
  error.value = '';
  state.loading = true;
  state.loadingText = '正在上传角色图...';

  try {
    const formData = new FormData();
    formData.append('character', file);

    const data = await apiPostForm('/upload', formData);
    state.taskId = data.taskId;
    state.characterImageUrl = data.characterUrl;
    state.phase = 'character_ready';
  } catch (e: any) {
    error.value = e.message;
  } finally {
    state.loading = false;
    state.loadingText = '';
  }
}

/** 选择造型预设项 */
function selectOutfit(type: OutfitType, label: string) {
  state.outfitType = type;
  state.outfitSelection = label;
}

/** 生成造型 */
async function generateOutfit() {
  const desc = currentOutfitDesc.value;
  const keywords = currentOutfitKeywords.value;
  if (!desc) {
    error.value = '请选择或输入造型描述';
    return;
  }

  error.value = '';
  state.phase = 'outfit_generating';
  state.loading = true;
  state.loadingText = '正在准备造型参数...';

  const t1 = setTimeout(() => state.loading && (state.loadingText = '发送给 AI 绘画服务...'), 1000);
  const t2 = setTimeout(() => state.loading && (state.loadingText = 'AI 正在生成造型 (可能需要10~30秒)...'), 2500);

  try {
    const data = await apiPost('/outfit', {
      taskId: state.taskId,
      description: desc,
      keywords,
    });

    state.outfitImageUrl = data.outfitUrl;
    state.phase = 'outfit_result';
  } catch (e: any) {
    error.value = e.message;
    state.phase = 'character_ready';
  } finally {
    clearTimeout(t1);
    clearTimeout(t2);
    state.loading = false;
    state.loadingText = '';
  }
}

/** 回到造型选择页 */
function backToOutfitSelect() {
  state.outfitSelection = '';
  state.outfitCustomText = '';
  state.outfitImageUrl = '';
  state.phase = 'character_ready';
}

/** 更换角色（回到首页） */
function changeCharacter() {
  state.phase = 'welcome';
  state.characterPrompt = '';
  state.referenceFile = null;
  state.referencePreview = '';
  state.uploadedCharacter = null;
  state.characterImageUrl = '';
  state.taskId = '';
  state.outfitSelection = '';
  state.outfitCustomText = '';
  state.outfitImageUrl = '';
  error.value = '';
}

/** 全部重置 */
function reset() {
  changeCharacter();
  state.outfitType = 'emotion';
}

// ===========================
// Composable 导出
// ===========================

export function useCharacterGen() {
  return {
    state,
    error,
    currentOutfitDesc,
    currentOutfitKeywords,
    EMOTION_OPTIONS,
    ACTION_OPTIONS,
    setReferenceImage,
    createCharacter,
    uploadCharacter,
    selectOutfit,
    generateOutfit,
    backToOutfitSelect,
    changeCharacter,
    reset,
  };
}
