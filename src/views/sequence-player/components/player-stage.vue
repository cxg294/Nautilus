<script setup lang="ts">
/**
 * 播放器舞台 — 双角色 GAL 风格渲染器
 *
 * 核心视觉体验：
 * - 16:9 固定比例舞台
 * - 双角色同屏（主讲左 + 其他右）+ 焦点高亮
 * - 角色立绘 + 表情切换（public/characters/{name}/{pose}.png）
 * - 磨砂玻璃对话框
 */
import { ref, computed, watch, reactive } from 'vue';
import type { Character, StageConfig, StageVisualCue, Step, TeachingObject } from '../types/sequence';
import { BUILTIN_BACKGROUNDS, DEFAULT_STAGE_CONFIG } from '../types/sequence';

const props = defineProps<{
  backgroundKey: string;
  currentCharacter: Character | null;
  currentPoseName: string | null;
  displayText: string;
  currentStep: Step | null;
  characters: Character[];
  status: string;
  mainSpeaker?: string;
  isTypingDone?: boolean;
  stageConfig?: StageConfig;
  /** 当前教学片段的可视化知识对象；不含学生需要操作的关卡内容。 */
  teachingObjects?: TeachingObject[];
  /** 片段切换时用来重置舞台上的角色和展示状态。 */
  stageSequenceId?: string;
}>();

const emit = defineEmits<{
  (e: 'click-advance'): void;
}>();

function onStageClick() {
  if (props.status === 'idle') return;
  emit('click-advance');
}

// ============================================================
// 工具函数
// ============================================================

const DEFAULT_PORTRAIT_URL = '/characters/_placeholder/default.svg';
const failedImages = reactive(new Set<string>());

/**
 * 角色立绘 URL（从 public/characters/ 加载）。
 *
 * 回退顺序：指定姿态 → 该角色默认姿态 → 全局问号剪影。
 * 这样导入的未知角色仍可参与舞台播放，后续补齐立绘后会自动替换。
 */
function charImageUrl(name: string, pose = '默认'): string {
  const requestedUrl = `/characters/${encodeURIComponent(name)}/${encodeURIComponent(pose)}.png`;
  const characterDefaultUrl = `/characters/${encodeURIComponent(name)}/%E9%BB%98%E8%AE%A4.png`;

  if (!failedImages.has(requestedUrl)) return requestedUrl;
  if (!failedImages.has(characterDefaultUrl)) return characterDefaultUrl;
  return DEFAULT_PORTRAIT_URL;
}

/** 判断 hex 颜色是否偏暗 */
function isDark(hex: string): boolean {
  const c = hex.replace('#', '');
  if (c.length < 6) return false;
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

// ============================================================
// 双角色状态
// ============================================================

interface CharState { name: string; pose: string }

const leftChar = ref<CharState | null>(null);
const rightChar = ref<CharState | null>(null);
const activeSide = ref<'left' | 'right' | null>(null);
const activeVisualCue = ref<StageVisualCue | null>(null);

// 立绘加载失败追踪

const config = computed(() => props.stageConfig || DEFAULT_STAGE_CONFIG);

const mainCharacter = computed(() => {
  const leadInstructor = props.characters.find(char => char.courseRole === 'lead_instructor');
  if (leadInstructor) return leadInstructor;

  if (props.mainSpeaker) {
    const exact = props.characters.find(char => char.name === props.mainSpeaker || char.displayName === props.mainSpeaker);
    if (exact) return exact;
  }
  return props.characters[0] || null;
});

const mainName = computed(() => {
  return mainCharacter.value?.name || '';
});

const hasCourseRoles = computed(() => props.characters.some(char => Boolean(char.courseRole)));

const activeTeachingObject = computed(() => {
  const target = activeVisualCue.value?.target;
  if (!target) return null;
  return props.teachingObjects?.find(item => item.id === target) || null;
});

const focusedTokenIds = computed(() => new Set(activeVisualCue.value?.tokens || []));

function isFocusedToken(tokenId: string): boolean {
  const cue = activeVisualCue.value;
  if (!cue || cue.action === 'show') return false;
  return cue.tokens?.length ? focusedTokenIds.value.has(tokenId) : true;
}

// 监听步骤变化 → 更新双角色状态
watch(
  [() => props.currentStep, () => props.stageSequenceId],
  ([step, stageSequenceId], [, previousStageSequenceId]) => {
    if (stageSequenceId !== previousStageSequenceId) {
      leftChar.value = null;
      rightChar.value = null;
      activeSide.value = null;
      activeVisualCue.value = null;
    }

    if (step?.visualCue) {
      activeVisualCue.value = step.visualCue.action === 'hide' ? null : step.visualCue;
    }

    if (!step || step.type !== 'dialogue') return;

    const speaker = step.characterName!;
    const pose = step.poseName || '默认';
    const isMain = speaker === mainName.value;
    const speakerCharacter = characterByName(speaker);
    const speakerPosition = speakerCharacter?.position;
    const targetSide = hasCourseRoles.value
      ? (speakerCharacter?.courseRole === 'lead_instructor' ? 'left' : 'right')
      : speakerPosition === 'left'
        ? 'left'
        : speakerPosition === 'right'
          ? 'right'
          : (isMain ? 'left' : 'right');

    if (targetSide === 'left') {
      leftChar.value = { name: speaker, pose };
      activeSide.value = 'left';
    } else {
      rightChar.value = { name: speaker, pose };
      activeSide.value = 'right';
      // 主讲人没入场时一并入场
      if (!leftChar.value && mainName.value && mainName.value !== speaker) {
        leftChar.value = { name: mainName.value, pose: '默认' };
      }
    }
  },
  { deep: true, immediate: true },
);

function onImgError(event: Event) {
  const image = event.currentTarget as HTMLImageElement;
  const currentUrl = new URL(image.src).pathname;
  if (currentUrl === DEFAULT_PORTRAIT_URL) return;
  failedImages.add(currentUrl);
}

// ============================================================
// 计算属性
// ============================================================

const backgroundCss = computed(() => {
  const bg = BUILTIN_BACKGROUNDS.find(b => b.key === props.backgroundKey);
  return bg ? bg.css : BUILTIN_BACKGROUNDS[0].css;
});

const stageStyle = computed(() => {
  const { size } = config.value;
  return {
    aspectRatio: size.aspectRatio.replace(':', ' / '),
    width: `${Math.min(Math.max(size.widthPercent, 50), 100)}%`,
    maxHeight: `${Math.min(Math.max(size.maxHeight, 320), 1000)}px`,
  };
});

const dialogueStyle = computed(() => ({
  width: `${Math.min(Math.max(config.value.subtitle.width, 60), 96)}%`,
}));

const dialogueTextStyle = computed(() => ({
  fontSize: `${Math.min(Math.max(config.value.subtitle.fontSize, 12), 28)}px`,
}));

function characterByName(name: string): Character | undefined {
  return props.characters.find(char => char.name === name || char.displayName === name);
}

function getCharStyle(state: CharState, side: 'left' | 'right') {
  const position = side === 'left' ? config.value.leftPosition : config.value.rightPosition;
  const scale = characterByName(state.name)?.scale || 1;
  return {
    left: `${Math.min(Math.max(position.horizontal, 0), 78)}%`,
    bottom: `${Math.min(Math.max(position.vertical, -12), 20)}%`,
    width: `${Math.min(Math.max(38 * scale, 20), 58)}%`,
  };
}

function getCharImageStyle(side: 'left' | 'right') {
  if (side !== 'right' || !config.value.rightFlip) return {};
  return { transform: 'scaleX(-1)' };
}

const speakerColor = computed(() => props.currentCharacter?.color || '#4FC3F7');

const speakerName = computed(() => {
  if (!props.currentStep || props.currentStep.type !== 'dialogue') return '';
  return props.currentCharacter?.displayName || props.currentStep.characterName || '';
});

const speakerTextColor = computed(() => isDark(speakerColor.value) ? '#fff' : '#1d1d1f');
</script>

<template>
  <div class="stage" :class="{ 'stage--clickable': status !== 'idle' }" :style="stageStyle" @click="onStageClick">
    <!-- 背景 -->
    <div class="stage__bg" :style="{ background: backgroundCss }" />

    <!-- 知识展示区：由演绎序列的 visualCue 驱动，不承载互动题或关卡操作。 -->
    <Transition name="teaching-card">
      <section v-if="activeTeachingObject" class="stage__teaching" :class="`stage__teaching--${activeTeachingObject.kind}`">
        <span class="stage__teaching-kicker">{{ activeTeachingObject.kind === 'code' ? '代码讲解' : '知识讲解' }}</span>
        <h3>{{ activeTeachingObject.title }}</h3>
        <p v-if="activeTeachingObject.description">{{ activeTeachingObject.description }}</p>

        <div v-if="activeTeachingObject.kind === 'code'" class="stage__code" :aria-label="activeTeachingObject.title">
          <span
            v-for="token in activeTeachingObject.tokens || []"
            :key="token.id"
            class="stage__code-token"
            :class="{ 'stage__code-token--focus': isFocusedToken(token.id) }"
          >{{ token.text }}</span>
          <code v-if="!activeTeachingObject.tokens?.length">{{ activeTeachingObject.normalizedCode }}</code>
        </div>
      </section>
    </Transition>

    <!-- 左侧角色（主讲人） -->
    <Transition name="char-enter">
      <div
        v-if="leftChar"
        :key="`L-${leftChar.name}`"
        class="stage__char stage__char--left"
        :class="{ 'stage__char--dim': activeSide === 'right' }"
        :style="getCharStyle(leftChar, 'left')"
      >
        <img
          :key="`${leftChar.name}-${leftChar.pose}-${charImageUrl(leftChar.name, leftChar.pose)}`"
          :src="charImageUrl(leftChar.name, leftChar.pose)"
          :alt="leftChar.name"
          class="stage__char-img"
          :style="getCharImageStyle('left')"
          @error="onImgError"
        />
      </div>
    </Transition>

    <!-- 右侧角色（其他） -->
    <Transition name="char-enter">
      <div
        v-if="rightChar"
        :key="`R-${rightChar.name}`"
        class="stage__char stage__char--right"
        :class="{ 'stage__char--dim': activeSide === 'left' }"
        :style="getCharStyle(rightChar, 'right')"
      >
        <img
          :key="`${rightChar.name}-${rightChar.pose}-${charImageUrl(rightChar.name, rightChar.pose)}`"
          :src="charImageUrl(rightChar.name, rightChar.pose)"
          :alt="rightChar.name"
          class="stage__char-img"
          :style="getCharImageStyle('right')"
          @error="onImgError"
        />
      </div>
    </Transition>

    <!-- 对话框（磨砂玻璃） -->
    <div v-if="displayText || currentStep?.type === 'wait'" class="stage__dlg" :style="dialogueStyle">
      <!-- 等待态 -->
      <div v-if="currentStep?.type === 'wait'" class="stage__dlg-wait">
        <span v-for="i in 3" :key="i" class="stage__dlg-dot" />
      </div>
      <!-- 对话态 -->
      <template v-else>
        <div
          v-if="speakerName"
          class="stage__dlg-name"
          :style="{ backgroundColor: speakerColor, color: speakerTextColor }"
        >
          {{ speakerName }}
        </div>
        <div class="stage__dlg-box">
          <span class="stage__dlg-text" :style="dialogueTextStyle">{{ displayText }}</span>
          <span v-if="isTypingDone" class="stage__dlg-cursor" />
          <span v-if="currentStep?.displayNote" class="stage__dlg-note">
            （{{ currentStep.displayNote }}）
          </span>
        </div>
      </template>
    </div>

    <!-- 空态 -->
    <div v-if="status === 'idle'" class="stage__empty">
      <span class="stage__empty-icon i-mdi-movie-open-outline" />
      <p>导入脚本后开始播放</p>
    </div>
  </div>
</template>

<style scoped>
/* ==================== 舞台 ==================== */
.stage {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  max-height: 100%;
  overflow: hidden;
  user-select: none;
  border: 1px solid var(--sp-border);
  border-radius: 8px;
  background: var(--sp-surface-alt);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.28);
}

.stage__bg {
  position: absolute;
  inset: 0;
  z-index: 0;
}

/* ==================== 知识展示区 ==================== */
.stage__teaching {
  position: absolute;
  z-index: 1;
  top: 9%;
  left: 23%;
  right: 23%;
  min-width: 250px;
  padding: 15px 18px;
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.12);
  backdrop-filter: blur(16px) saturate(150%);
  -webkit-backdrop-filter: blur(16px) saturate(150%);
  pointer-events: none;
}

.stage__teaching-kicker {
  display: block;
  margin-bottom: 4px;
  color: #35699a;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.stage__teaching h3 {
  margin: 0;
  color: #172033;
  font-size: clamp(16px, 1.7vw, 22px);
  line-height: 1.25;
}

.stage__teaching p {
  margin: 5px 0 0;
  color: rgba(23, 32, 51, 0.68);
  font-size: clamp(12px, 1.15vw, 15px);
  line-height: 1.45;
}

.stage__code {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
  margin-top: 12px;
  padding: 10px 12px;
  overflow-x: auto;
  border-radius: 8px;
  background: #172033;
  color: #e6edf7;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: clamp(12px, 1.25vw, 16px);
  white-space: pre;
}

.stage__code-token {
  display: inline-block;
  padding: 1px 2px;
  border-radius: 4px;
  transition: background-color 0.2s, color 0.2s, transform 0.2s;
}

.stage__code-token--focus {
  color: #172033;
  background: #fcd34d;
  box-shadow: 0 0 0 2px rgba(252, 211, 77, 0.22);
  transform: translateY(-1px);
}

.teaching-card-enter-active,
.teaching-card-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.teaching-card-enter-from,
.teaching-card-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* ==================== 角色 ==================== */
.stage__char {
  position: absolute;
  z-index: 2;
  bottom: 0;
  left: 0;
  right: auto;
  width: 38%;
  height: 100%;
  display: flex;
  align-items: flex-end;
  pointer-events: none;
  transition: filter 0.3s, opacity 0.3s;
}

.stage__char--left  { justify-content: flex-start; }
.stage__char--right { justify-content: flex-end; }

.stage__char--dim {
  filter: brightness(0.7) grayscale(0.2);
  opacity: 0.72;
}

/* 入退场动画 */
.char-enter-enter-active { transition: all 0.35s cubic-bezier(0.4, 0, 0.2, 1); }
.char-enter-leave-active { transition: all 0.25s ease-in; }
.char-enter-enter-from  { opacity: 0; transform: translateY(30px); }
.char-enter-leave-to    { opacity: 0; transform: translateY(20px); }

.stage__char-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 8px 20px rgba(0, 0, 0, 0.12));
  transform-origin: bottom center;
  transition: transform 0.2s ease;
}

/* ==================== 对话框 ==================== */
.stage__dlg {
  position: absolute;
  z-index: 10;
  bottom: 14px;
  left: 50%;
  transform: translateX(-50%);
  width: 88%;
  max-width: 860px;
}

.stage__dlg-name {
  display: inline-block;
  font-size: 13px;
  font-weight: 600;
  padding: 4px 14px;
  border-radius: 6px 6px 0 0;
  margin-bottom: -1px;
  position: relative;
  z-index: 1;
  letter-spacing: 0;
}

.stage__dlg-box {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(15, 23, 42, 0.14);
  border-radius: 0 8px 8px 8px;
  padding: 16px 22px;
  min-height: 56px;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.12);
}

.stage__dlg-text {
  font-size: 17px;
  line-height: 1.65;
  color: #1d1d1f;
  letter-spacing: 0;
}

.stage__dlg-note {
  font-size: 13px;
  color: rgba(29, 29, 31, 0.4);
  font-style: italic;
  margin-left: 4px;
}

/* 等待点 */
.stage__dlg-wait {
  display: flex;
  gap: 8px;
  justify-content: center;
  padding: 16px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(15, 23, 42, 0.14);
  border-radius: 8px;
}

.stage__dlg-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(0, 122, 255, 0.5);
  animation: dotPulse 1.4s ease-in-out infinite;
}
.stage__dlg-dot:nth-child(2) { animation-delay: 0.2s; }
.stage__dlg-dot:nth-child(3) { animation-delay: 0.4s; }

@keyframes dotPulse {
  0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
  40%           { opacity: 1;   transform: scale(1.2); }
}

/* 空态 */
.stage__empty {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--sp-text-subtle);
}
.stage__empty-icon { font-size: 48px; }
.stage__empty p    { margin: 0; font-size: 15px; }

/* ==================== 暗色模式 ==================== */
.dark .stage__dlg-box,
.dark .stage__dlg-wait {
  background: rgba(15, 23, 42, 0.9);
  border-color: rgba(148, 163, 184, 0.28);
}
.dark .stage__dlg-text { color: rgba(255, 255, 255, 0.92); }
.dark .stage__dlg-note { color: rgba(255, 255, 255, 0.35); }
.dark .stage__empty    { color: var(--sp-text-subtle); }
.dark .stage__teaching {
  border-color: rgba(148, 163, 184, 0.3);
  background: rgba(15, 23, 42, 0.88);
}
.dark .stage__teaching h3 { color: rgba(255, 255, 255, 0.94); }
.dark .stage__teaching p { color: rgba(255, 255, 255, 0.62); }
.dark .stage__dlg-cursor { border-color: transparent transparent transparent rgba(255, 255, 255, 0.5); }

/* 点击推进光标 */
.stage--clickable { cursor: pointer; }

/* 打字完成后的闪烁三角 */
.stage__dlg-cursor {
  display: inline-block;
  width: 0;
  height: 0;
  margin-left: 6px;
  border-style: solid;
  border-width: 6px 0 6px 8px;
  border-color: transparent transparent transparent rgba(0, 0, 0, 0.25);
  vertical-align: middle;
  animation: cursorBlink 1s ease-in-out infinite;
}

@keyframes cursorBlink {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.2; }
}
</style>
