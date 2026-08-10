<script setup lang="ts">
/**
 * 预览画布组件 — 支持双模式
 * 1. Burst 模式：使用自研粒子引擎渲染点击爆发效果
 * 2. Ambient 模式：使用 tsParticles 渲染背景粒子
 */
import { computed, ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import type { ISourceOptions, Container } from '@tsparticles/engine';
import { loadSlim } from '@tsparticles/slim';
import { tsParticles } from '@tsparticles/engine';
import { loadEmittersPlugin } from '@tsparticles/plugin-emitters';
import { loadConfettiPreset } from '@tsparticles/preset-confetti';
import { loadFirePreset } from '@tsparticles/preset-fire';
import { loadFireflyPreset } from '@tsparticles/preset-firefly';
import { loadFireworksPreset } from '@tsparticles/preset-fireworks';
import { loadFountainPreset } from '@tsparticles/preset-fountain';
import { loadSnowPreset } from '@tsparticles/preset-snow';
import { loadStarsPreset } from '@tsparticles/preset-stars';
import { BurstEngine, type BurstConfig } from '../composables/use-burst-particles';
import type { BackgroundMode, CompositeConfig, EffectRenderer } from '../data/effect-registry';

const props = defineProps<{
  /** tsParticles 配置（ambient 模式） */
  options: ISourceOptions;
  /** 爆发配置（burst 模式） */
  burstConfig: BurstConfig | null;
  /** 复合特效配置 */
  compositeConfig: CompositeConfig | null;
  /** 当前渲染器 */
  renderer: EffectRenderer;
  /** 是否为爆发模式 */
  isBurstMode: boolean;
  /** 是否正在播放 */
  isPlaying: boolean;
  /** 背景色 */
  background: string;
  /** 背景模式 */
  backgroundMode: BackgroundMode;
}>();

const containerId = 'effects-preview-' + Math.random().toString(36).slice(2, 8);
const containerRef = ref<Container | null>(null);
const isEngineReady = ref(false);
const burstCanvasRef = ref<HTMLCanvasElement | null>(null);
let burstEngine: BurstEngine | null = null;
let loadTimer: ReturnType<typeof setTimeout> | null = null;
let compositeTimers: ReturnType<typeof setTimeout>[] = [];

const usesBurstCanvas = computed(() => props.renderer !== 'ambient');
const previewBackground = computed(() => (props.backgroundMode === 'transparent' ? 'transparent' : props.background));

// ============================================================
// tsParticles 引擎（Ambient 模式）
// ============================================================

async function initTsParticles() {
  await loadSlim(tsParticles);
  // 加载 emitters 插件，支持喷泉等需要发射器的特效
  await loadEmittersPlugin(tsParticles);
  await Promise.all([
    loadConfettiPreset(tsParticles),
    loadFirePreset(tsParticles),
    loadFireflyPreset(tsParticles),
    loadFireworksPreset(tsParticles),
    loadFountainPreset(tsParticles),
    loadSnowPreset(tsParticles),
    loadStarsPreset(tsParticles)
  ]);
  isEngineReady.value = true;
}

async function loadParticles() {
  if (!isEngineReady.value || props.renderer !== 'ambient') return;

  if (containerRef.value) {
    containerRef.value.destroy();
    containerRef.value = null;
  }

  await nextTick();

  try {
    const container = await tsParticles.load({
      id: containerId,
      options: { ...props.options, fullScreen: false }
    });
    containerRef.value = container || null;

    if (!props.isPlaying && containerRef.value) {
      containerRef.value.pause();
    }
  } catch (err) {
    console.warn('[EffectsGenerator] 粒子加载失败:', err);
  }
}

function scheduleLoadParticles() {
  if (loadTimer) clearTimeout(loadTimer);
  loadTimer = setTimeout(() => {
    loadParticles();
  }, 120);
}

// ============================================================
// 自研爆发引擎（Burst 模式）
// ============================================================

function initBurstEngine() {
  if (burstCanvasRef.value && !burstEngine) {
    burstEngine = new BurstEngine(burstCanvasRef.value);
  }
}

function clearCompositeTimers() {
  compositeTimers.forEach(timer => clearTimeout(timer));
  compositeTimers = [];
}

function runComposite() {
  if (!burstEngine || !burstCanvasRef.value || !props.compositeConfig || !props.isPlaying) return;
  clearCompositeTimers();
  burstEngine.clear();
  const rect = burstCanvasRef.value.getBoundingClientRect();

  for (const layer of props.compositeConfig.layers) {
    const timer = setTimeout(() => {
      if (!burstEngine || !props.isPlaying) return;
      if (layer.type === 'burst') {
        burstEngine.burst(rect.width * layer.x, rect.height * layer.y, layer.config);
      } else {
        burstEngine.overlay(layer.kind, layer.durationMs, layer.color);
      }
    }, layer.delayMs);
    compositeTimers.push(timer);
  }
}

function replayCurrentEffect() {
  if (!burstEngine || !burstCanvasRef.value || !props.isPlaying) return;
  const rect = burstCanvasRef.value.getBoundingClientRect();
  if (props.renderer === 'composite') {
    runComposite();
  } else if (props.renderer === 'burst' && props.burstConfig) {
    burstEngine.clear();
    burstEngine.burst(rect.width / 2, rect.height / 2, props.burstConfig);
  }
}

/** 处理点击事件 — 在点击位置触发爆发 */
function handleCanvasClick(e: MouseEvent) {
  if (!usesBurstCanvas.value || !burstEngine || !props.isPlaying) return;

  if (props.renderer === 'composite') {
    runComposite();
    return;
  }

  if (!props.burstConfig) return;

  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  burstEngine.burst(x, y, props.burstConfig);
}

// ============================================================
// 生命周期和观察者
// ============================================================

// 监听模式切换
watch(() => props.renderer, async () => {
  if (props.renderer !== 'ambient') {
    // 切到 burst 模式：销毁 tsParticles
    if (containerRef.value) {
      containerRef.value.destroy();
      containerRef.value = null;
    }
    await nextTick();
    initBurstEngine();
    burstEngine?.resizeCanvas();
    replayCurrentEffect();
  } else {
    // 切到 ambient 模式：清除 burst
    clearCompositeTimers();
    if (burstEngine) burstEngine.clear();
    await loadParticles();
  }
}, { immediate: false });

// 监听 burst 配置变化
watch(() => props.burstConfig, () => {
  if (props.renderer === 'burst' && burstEngine) {
    replayCurrentEffect();
  }
}, { deep: true });

watch(() => props.compositeConfig, () => {
  if (props.renderer === 'composite' && burstEngine) {
    runComposite();
  }
}, { deep: true });

// 监听 ambient 配置变化
watch(() => props.options, () => {
  if (props.renderer === 'ambient') scheduleLoadParticles();
}, { deep: true });

// 监听播放状态
watch(() => props.isPlaying, (playing) => {
  if (props.renderer === 'ambient' && containerRef.value) {
    if (playing) containerRef.value.play();
    else containerRef.value.pause();
  } else if (playing && props.renderer === 'composite') {
    runComposite();
  }
});

onMounted(async () => {
  await initTsParticles();
  await nextTick();
  initBurstEngine();

  if (props.renderer !== 'ambient') {
    // 初始自动演示
    burstEngine?.resizeCanvas();
    replayCurrentEffect();
  } else {
    await loadParticles();
  }
});

onUnmounted(() => {
  if (loadTimer) clearTimeout(loadTimer);
  clearCompositeTimers();
  if (containerRef.value) containerRef.value.destroy();
  if (burstEngine) burstEngine.destroy();
});

/**
 * 获取当前正在活跃渲染的 Canvas 元素
 * Burst 模式：返回自研 canvas；Ambient 模式：返回 tsParticles 内部 canvas
 */
function getActiveCanvas(): HTMLCanvasElement | null {
  if (usesBurstCanvas.value) {
    return burstCanvasRef.value;
  }
  // tsParticles 的 canvas 在容器 div 内部
  const el = document.querySelector(`#${containerId} canvas`) as HTMLCanvasElement | null;
  return el;
}

defineExpose({
  getActiveCanvas,
  containerId
});
</script>

<template>
  <div
    class="preview-canvas"
    :style="{ background: previewBackground }"
    :class="{ 'preview-canvas--burst': usesBurstCanvas, 'preview-canvas--transparent': backgroundMode === 'transparent' }"
    @click="handleCanvasClick"
  >
    <!-- Ambient 模式：tsParticles 渲染 -->
    <div
      v-show="renderer === 'ambient'"
      :id="containerId"
      class="preview-canvas__particles"
    />

    <!-- Burst 模式：自研 Canvas 渲染 -->
    <canvas
      v-show="usesBurstCanvas"
      ref="burstCanvasRef"
      class="preview-canvas__burst"
    />

    <!-- 点击提示（仅 Burst 模式） -->
    <Transition name="fade">
      <div v-if="usesBurstCanvas && isPlaying" class="preview-canvas__hint">
        <div class="hint-dot" />
        <span>{{ renderer === 'composite' ? '点击重放复合特效' : '点击任意位置触发特效' }}</span>
      </div>
    </Transition>

    <!-- 加载遮罩 -->
    <Transition name="fade">
      <div v-if="!isEngineReady && renderer === 'ambient'" class="preview-canvas__loading">
        <div class="loading-spinner" />
        <span>Loading engine...</span>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.preview-canvas {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.06);
  transition: background 0.5s ease;
}

.preview-canvas--burst {
  cursor: crosshair;
}

.preview-canvas--transparent {
  background-color: transparent !important;
  background-image:
    linear-gradient(45deg, rgba(255, 255, 255, 0.08) 25%, transparent 25%),
    linear-gradient(-45deg, rgba(255, 255, 255, 0.08) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, rgba(255, 255, 255, 0.08) 75%),
    linear-gradient(-45deg, transparent 75%, rgba(255, 255, 255, 0.08) 75%);
  background-size: 24px 24px;
  background-position: 0 0, 0 12px, 12px -12px, -12px 0;
}

.preview-canvas__particles {
  width: 100%;
  height: 100%;
}

.preview-canvas__particles :deep(canvas) {
  display: block;
  width: 100% !important;
  height: 100% !important;
}

.preview-canvas__burst {
  width: 100%;
  height: 100%;
  display: block;
}

/* 点击提示 */
.preview-canvas__hint {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 18px;
  border-radius: 20px;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.7);
  font-size: 13px;
  pointer-events: none;
  z-index: 5;
  animation: hint-float 3s ease-in-out infinite;
}

.hint-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #6366f1;
  animation: hint-pulse 1.5s ease-in-out infinite;
}

@keyframes hint-float {
  0%, 100% { transform: translateX(-50%) translateY(0); }
  50% { transform: translateX(-50%) translateY(-4px); }
}

@keyframes hint-pulse {
  0%, 100% { box-shadow: 0 0 4px rgba(99, 102, 241, 0.5); transform: scale(1); }
  50% { box-shadow: 0 0 12px rgba(99, 102, 241, 0.9); transform: scale(1.3); }
}

/* 加载遮罩 */
.preview-canvas__loading {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: rgba(13, 17, 23, 0.9);
  backdrop-filter: blur(8px);
  color: rgba(255, 255, 255, 0.6);
  font-size: 14px;
  z-index: 10;
}

.loading-spinner {
  width: 36px;
  height: 36px;
  border: 3px solid rgba(99, 102, 241, 0.2);
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.4s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
