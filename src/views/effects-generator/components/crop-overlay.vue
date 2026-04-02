<script setup lang="ts">
/**
 * 区域选取覆盖层 — 拖拽框选 + 蚂蚁线边框
 * 覆盖在预览画布之上，允许用户拖拽选取 GIF 录制区域
 */
import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { CropRegion } from '../composables/use-gif-recorder';

const props = defineProps<{
  /** 容器宽度（像素） */
  containerWidth: number;
  /** 容器高度（像素） */
  containerHeight: number;
  /** 当前选区 */
  region: CropRegion | null;
  /** 是否可见 */
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:region', region: CropRegion): void;
  (e: 'confirm'): void;
  (e: 'cancel'): void;
  (e: 'select-all'): void;
}>();

// ---- 状态 ----
const overlayRef = ref<HTMLElement | null>(null);
const isDragging = ref(false);
const isResizing = ref(false);
const isMoving = ref(false);
const dragStart = ref({ x: 0, y: 0 });
const currentRegion = ref<CropRegion>({ x: 0, y: 0, width: 0, height: 0 });
const resizeHandle = ref<string>('');
const aspectRatio = ref<string>('free'); // 'free' | '1:1' | '16:9' | '4:3'

// ---- 比例选项 ----
const ratioOptions = [
  { key: 'free', label: '自由' },
  { key: '1:1', label: '1:1' },
  { key: '16:9', label: '16:9' },
  { key: '4:3', label: '4:3' }
];

// ---- 选区样式 ----
const regionStyle = computed(() => {
  const r = currentRegion.value;
  return {
    left: `${r.x}px`,
    top: `${r.y}px`,
    width: `${r.width}px`,
    height: `${r.height}px`
  };
});

// ---- 遮罩路径（选区外半透暗色） ----
const maskPath = computed(() => {
  const r = currentRegion.value;
  const cw = props.containerWidth;
  const ch = props.containerHeight;
  if (r.width <= 0 || r.height <= 0) return '';

  // 外圈逆时针 + 内圈顺时针 → 只遮罩外部
  return `M0,0 L${cw},0 L${cw},${ch} L0,${ch} Z ` +
    `M${r.x},${r.y} L${r.x + r.width},${r.y} L${r.x + r.width},${r.y + r.height} L${r.x},${r.y + r.height} Z`;
});

const hasRegion = computed(() => currentRegion.value.width > 10 && currentRegion.value.height > 10);

// ---- 鼠标事件 ----
function getRelativePos(e: MouseEvent) {
  if (!overlayRef.value) return { x: 0, y: 0 };
  const rect = overlayRef.value.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(e.clientX - rect.left, props.containerWidth)),
    y: Math.max(0, Math.min(e.clientY - rect.top, props.containerHeight))
  };
}

function onMouseDown(e: MouseEvent) {
  if (e.button !== 0) return;
  const pos = getRelativePos(e);

  // 检查是否点在控制点上
  const handle = getHandleAt(pos.x, pos.y);
  if (handle && hasRegion.value) {
    isResizing.value = true;
    resizeHandle.value = handle;
    dragStart.value = pos;
    e.preventDefault();
    return;
  }

  // 检查是否点在选区内部 → 移动
  const r = currentRegion.value;
  if (hasRegion.value &&
    pos.x >= r.x && pos.x <= r.x + r.width &&
    pos.y >= r.y && pos.y <= r.y + r.height) {
    isMoving.value = true;
    dragStart.value = { x: pos.x - r.x, y: pos.y - r.y };
    e.preventDefault();
    return;
  }

  // 新建选区
  isDragging.value = true;
  dragStart.value = pos;
  currentRegion.value = { x: pos.x, y: pos.y, width: 0, height: 0 };
  e.preventDefault();
}

function onMouseMove(e: MouseEvent) {
  const pos = getRelativePos(e);

  if (isDragging.value) {
    const x = Math.min(dragStart.value.x, pos.x);
    const y = Math.min(dragStart.value.y, pos.y);
    let w = Math.abs(pos.x - dragStart.value.x);
    let h = Math.abs(pos.y - dragStart.value.y);

    // 应用比例约束
    [w, h] = applyAspectRatio(w, h);

    // 边界约束
    if (x + w > props.containerWidth) w = props.containerWidth - x;
    if (y + h > props.containerHeight) h = props.containerHeight - y;

    currentRegion.value = { x, y, width: w, height: h };
  } else if (isMoving.value) {
    const r = currentRegion.value;
    let nx = pos.x - dragStart.value.x;
    let ny = pos.y - dragStart.value.y;

    // 边界
    nx = Math.max(0, Math.min(nx, props.containerWidth - r.width));
    ny = Math.max(0, Math.min(ny, props.containerHeight - r.height));

    currentRegion.value = { ...r, x: nx, y: ny };
  } else if (isResizing.value) {
    handleResize(pos);
  }
}

function onMouseUp() {
  if (isDragging.value || isResizing.value || isMoving.value) {
    isDragging.value = false;
    isResizing.value = false;
    isMoving.value = false;

    if (hasRegion.value) {
      emit('update:region', { ...currentRegion.value });
    }
  }
}

// ---- 控制点检测 ----
const HANDLE_SIZE = 8;

function getHandleAt(x: number, y: number): string {
  const r = currentRegion.value;
  if (!hasRegion.value) return '';

  const handles: Record<string, { cx: number; cy: number }> = {
    nw: { cx: r.x, cy: r.y },
    ne: { cx: r.x + r.width, cy: r.y },
    sw: { cx: r.x, cy: r.y + r.height },
    se: { cx: r.x + r.width, cy: r.y + r.height },
    n: { cx: r.x + r.width / 2, cy: r.y },
    s: { cx: r.x + r.width / 2, cy: r.y + r.height },
    w: { cx: r.x, cy: r.y + r.height / 2 },
    e: { cx: r.x + r.width, cy: r.y + r.height / 2 }
  };

  for (const [key, { cx, cy }] of Object.entries(handles)) {
    if (Math.abs(x - cx) <= HANDLE_SIZE && Math.abs(y - cy) <= HANDLE_SIZE) {
      return key;
    }
  }
  return '';
}

function handleResize(pos: { x: number; y: number }) {
  const r = { ...currentRegion.value };
  const h = resizeHandle.value;

  if (h.includes('e')) r.width = Math.max(20, pos.x - r.x);
  if (h.includes('w')) { const dx = pos.x - r.x; r.x = pos.x; r.width = Math.max(20, r.width - dx); }
  if (h.includes('s')) r.height = Math.max(20, pos.y - r.y);
  if (h.includes('n')) { const dy = pos.y - r.y; r.y = pos.y; r.height = Math.max(20, r.height - dy); }

  // 应用比例约束（基于宽度）
  if (aspectRatio.value !== 'free') {
    const [rw, rh] = applyAspectRatio(r.width, r.height);
    r.width = rw;
    r.height = rh;
  }

  // 边界
  r.x = Math.max(0, r.x);
  r.y = Math.max(0, r.y);
  if (r.x + r.width > props.containerWidth) r.width = props.containerWidth - r.x;
  if (r.y + r.height > props.containerHeight) r.height = props.containerHeight - r.y;

  currentRegion.value = r;
}

function applyAspectRatio(w: number, h: number): [number, number] {
  if (aspectRatio.value === '1:1') return [w, w];
  if (aspectRatio.value === '16:9') return [w, Math.round(w * 9 / 16)];
  if (aspectRatio.value === '4:3') return [w, Math.round(w * 3 / 4)];
  return [w, h];
}

// ---- 快捷操作 ----
function selectAll() {
  currentRegion.value = {
    x: 0, y: 0,
    width: props.containerWidth,
    height: props.containerHeight
  };
  emit('update:region', { ...currentRegion.value });
  emit('select-all');
}

function confirmRegion() {
  if (hasRegion.value) {
    emit('update:region', { ...currentRegion.value });
    emit('confirm');
  }
}

// ---- 全局鼠标事件 ----
onMounted(() => {
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);

  // 初始化为已有 region
  if (props.region) {
    currentRegion.value = { ...props.region };
  }
});

onUnmounted(() => {
  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseup', onMouseUp);
});
</script>

<template>
  <Transition name="crop-fade">
    <div
      v-if="visible"
      ref="overlayRef"
      class="crop-overlay"
      @mousedown="onMouseDown"
    >
      <!-- 暗色遮罩 SVG -->
      <svg class="crop-overlay__mask" :viewBox="`0 0 ${containerWidth} ${containerHeight}`">
        <path :d="maskPath" fill="rgba(0,0,0,0.55)" fill-rule="evenodd" />
      </svg>

      <!-- 选区框（蚂蚁线） -->
      <div
        v-if="hasRegion"
        class="crop-overlay__selection"
        :style="regionStyle"
      >
        <!-- 蚂蚁线边框 -->
        <div class="selection-border selection-border--marching" />

        <!-- 三分线 -->
        <div class="selection-grid">
          <div class="grid-line grid-line--h" style="top: 33.33%" />
          <div class="grid-line grid-line--h" style="top: 66.66%" />
          <div class="grid-line grid-line--v" style="left: 33.33%" />
          <div class="grid-line grid-line--v" style="left: 66.66%" />
        </div>

        <!-- 尺寸标签 -->
        <div class="selection-size">
          {{ Math.round(currentRegion.width) }} × {{ Math.round(currentRegion.height) }}
        </div>

        <!-- 8 个控制点 -->
        <div class="handle handle--nw" />
        <div class="handle handle--ne" />
        <div class="handle handle--sw" />
        <div class="handle handle--se" />
        <div class="handle handle--n" />
        <div class="handle handle--s" />
        <div class="handle handle--w" />
        <div class="handle handle--e" />
      </div>

      <!-- 提示文字（无选区时） -->
      <div v-if="!hasRegion" class="crop-overlay__hint">
        <span>🖱️ 拖拽选取区域</span>
      </div>

      <!-- 底部工具栏 -->
      <div class="crop-overlay__toolbar">
        <!-- 比例按钮 -->
        <div class="toolbar-ratios">
          <button
            v-for="opt in ratioOptions"
            :key="opt.key"
            class="ratio-btn" :class="[{ 'ratio-btn--active': aspectRatio === opt.key }]"
            @click.stop="aspectRatio = opt.key"
          >
            {{ opt.label }}
          </button>
        </div>

        <div class="toolbar-divider" />

        <!-- 操作按钮 -->
        <button class="toolbar-btn toolbar-btn--all" @click.stop="selectAll">
          ⬜ 全选
        </button>
        <button
          class="toolbar-btn toolbar-btn--confirm"
          :disabled="!hasRegion"
          @click.stop="confirmRegion"
        >
          ✅ 确定
        </button>
        <button class="toolbar-btn toolbar-btn--cancel" @click.stop="$emit('cancel')">
          ❌ 取消
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.crop-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  cursor: crosshair;
  user-select: none;
}

.crop-overlay__mask {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

/* 选区 */
.crop-overlay__selection {
  position: absolute;
  z-index: 2;
  pointer-events: none;
}

/* 蚂蚁线边框 */
.selection-border {
  position: absolute;
  inset: 0;
  border: 2px dashed rgba(255, 255, 255, 0.9);
  pointer-events: none;
}

.selection-border--marching {
  animation: marching-ants 0.5s linear infinite;
  border: 2px dashed transparent;
  background: repeating-linear-gradient(
    90deg,
    #fff 0, #fff 4px,
    transparent 4px, transparent 8px
  ) top left / 100% 2px no-repeat,
  repeating-linear-gradient(
    90deg,
    #fff 0, #fff 4px,
    transparent 4px, transparent 8px
  ) bottom left / 100% 2px no-repeat,
  repeating-linear-gradient(
    0deg,
    #fff 0, #fff 4px,
    transparent 4px, transparent 8px
  ) top left / 2px 100% no-repeat,
  repeating-linear-gradient(
    0deg,
    #fff 0, #fff 4px,
    transparent 4px, transparent 8px
  ) top right / 2px 100% no-repeat;
}

@keyframes marching-ants {
  to { background-position: 8px 0, -8px 100%, 0 -8px, 100% 8px; }
}

/* 三分线 */
.selection-grid {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.grid-line {
  position: absolute;
  background: rgba(255, 255, 255, 0.15);
}

.grid-line--h {
  left: 0; right: 0; height: 1px;
}

.grid-line--v {
  top: 0; bottom: 0; width: 1px;
}

/* 尺寸标签 */
.selection-size {
  position: absolute;
  bottom: -26px;
  left: 50%;
  transform: translateX(-50%);
  padding: 2px 10px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
  pointer-events: none;
}

/* 控制点 */
.handle {
  position: absolute;
  width: 10px;
  height: 10px;
  background: #fff;
  border: 2px solid #6366f1;
  border-radius: 2px;
  pointer-events: auto;
  z-index: 3;
}

.handle--nw { top: -5px; left: -5px; cursor: nw-resize; }
.handle--ne { top: -5px; right: -5px; cursor: ne-resize; }
.handle--sw { bottom: -5px; left: -5px; cursor: sw-resize; }
.handle--se { bottom: -5px; right: -5px; cursor: se-resize; }
.handle--n { top: -5px; left: 50%; transform: translateX(-50%); cursor: n-resize; }
.handle--s { bottom: -5px; left: 50%; transform: translateX(-50%); cursor: s-resize; }
.handle--w { top: 50%; left: -5px; transform: translateY(-50%); cursor: w-resize; }
.handle--e { top: 50%; right: -5px; transform: translateY(-50%); cursor: e-resize; }

/* 提示 */
.crop-overlay__hint {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  padding: 12px 24px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  color: rgba(255, 255, 255, 0.85);
  font-size: 14px;
  font-weight: 500;
  pointer-events: none;
  animation: hint-pulse 2s ease-in-out infinite;
}

@keyframes hint-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

/* 底部工具栏 */
.crop-overlay__toolbar {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  z-index: 10;
}

.toolbar-ratios {
  display: flex;
  gap: 2px;
}

.ratio-btn {
  padding: 4px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.ratio-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.ratio-btn--active {
  background: rgba(99, 102, 241, 0.3);
  color: #fff;
}

.toolbar-divider {
  width: 1px;
  height: 20px;
  background: rgba(255, 255, 255, 0.15);
  margin: 0 4px;
}

.toolbar-btn {
  padding: 4px 12px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.toolbar-btn--all {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
}

.toolbar-btn--all:hover {
  background: rgba(255, 255, 255, 0.2);
}

.toolbar-btn--confirm {
  background: rgba(34, 197, 94, 0.2);
  color: #4ade80;
}

.toolbar-btn--confirm:hover:not(:disabled) {
  background: rgba(34, 197, 94, 0.35);
}

.toolbar-btn--confirm:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.toolbar-btn--cancel {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
}

.toolbar-btn--cancel:hover {
  background: rgba(239, 68, 68, 0.3);
}

/* 过渡 */
.crop-fade-enter-active, .crop-fade-leave-active {
  transition: opacity 0.3s ease;
}
.crop-fade-enter-from, .crop-fade-leave-to {
  opacity: 0;
}
</style>
