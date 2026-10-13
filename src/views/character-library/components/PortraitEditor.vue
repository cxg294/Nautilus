<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { CharacterPose, CharacterPosition, PortraitLayout } from '../../sequence-player/types/sequence';
import presets from '../../../../shared/character-presets.json';
import { legacyLayout, normalizeLayout, portraitStyle } from '../layout';
import PortraitSprite from './PortraitSprite.vue';
const props = defineProps<{ pose: CharacterPose; src: string; position?: CharacterPosition; disabled?: boolean }>();
const emit = defineEmits<{ change: [layout: PortraitLayout] }>();
const stage = ref<HTMLElement>();
const aspect = ref(1);
const layout = computed(() => props.pose.layout || legacyLayout(props.position, aspect.value));
const boxStyle = computed(() => ({
  ...portraitStyle(layout.value),
  width: `${((layout.value.height * 9) / 16) * aspect.value}%`
}));
watch(
  () => props.src,
  src => {
    const img = new Image();
    img.onload = () => {
      if (src === props.src) aspect.value = img.naturalWidth / img.naturalHeight || 1;
    };
    img.src = src;
  },
  { immediate: true }
);
let drag: {
  pointer: number;
  x: number;
  y: number;
  layout: PortraitLayout;
  mode: 'move' | 'scale';
  width: number;
  height: number;
} | null = null;
function change(patch: Partial<PortraitLayout>) {
  if (props.disabled) return;
  emit('change', normalizeLayout({ ...layout.value, ...patch })!);
}
function start(event: PointerEvent, mode: 'move' | 'scale') {
  if (props.disabled || event.button !== 0 || !stage.value) return;
  event.preventDefault();
  event.stopPropagation();
  const rect = stage.value.getBoundingClientRect();
  drag = {
    pointer: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    layout: { ...layout.value },
    mode,
    width: rect.width,
    height: rect.height
  };
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}
function move(event: PointerEvent) {
  if (!drag || drag.pointer !== event.pointerId) return;
  const dx = ((event.clientX - drag.x) / drag.width) * 100;
  const dy = ((event.clientY - drag.y) / drag.height) * 100;
  if (drag.mode === 'move') change({ x: drag.layout.x + dx, y: drag.layout.y + dy });
  else change({ height: drag.layout.height - dy });
}
function keyboard(event: KeyboardEvent) {
  const amount = event.shiftKey ? 1 : 0.1;
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
  event.preventDefault();
  change({
    x: layout.value.x + (event.key === 'ArrowRight' ? amount : event.key === 'ArrowLeft' ? -amount : 0),
    y: layout.value.y + (event.key === 'ArrowDown' ? amount : event.key === 'ArrowUp' ? -amount : 0)
  });
}
function reset() {
  const calibrated = presets
    .flatMap(c => c.poses)
    .find(p => decodeURI(p.imageUrl) === decodeURI(props.pose.imageUrl))?.layout;
  change(calibrated || legacyLayout(props.position, aspect.value));
}
</script>
<template>
  <div class="portrait-editor">
    <div ref="stage" class="calibration-stage" aria-label="立绘位置预览">
      <div class="safe-zone">16:9 · 安全区</div>
      <PortraitSprite :pose="pose" :src="src" :position="position" :name="pose.name" />
      <div class="subtitle-guide">字幕区域</div>
      <div
        class="edit-box"
        :style="boxStyle"
        role="button"
        tabindex="0"
        aria-label="拖动立绘位置，方向键微调"
        @keydown="keyboard"
        @pointerdown="start($event, 'move')"
        @pointermove="move"
        @pointerup="drag = null"
        @pointercancel="drag = null"
        @lostpointercapture="drag = null"
      >
        <span class="anchor">＋</span>
        <button
          class="resize-handle"
          :style="{ top: `${Math.max(0, ((layout.height - layout.y) / layout.height) * 100)}%` }"
          type="button"
          aria-label="拖动等比缩放立绘"
          :disabled="disabled"
          @pointerdown="start($event, 'scale')"
          @pointermove.stop="move"
          @pointerup.stop="drag = null"
          @pointercancel="drag = null"
          @lostpointercapture="drag = null"
        >
          ↗
        </button>
      </div>
    </div>
    <div class="layout-toolbar">
      <div class="layout-actions">
        <NButton size="tiny" quaternary :disabled="disabled" @click="change({ x: 20 })">靠左</NButton>
        <NButton size="tiny" quaternary :disabled="disabled" @click="change({ x: 50 })">居中</NButton>
        <NButton size="tiny" quaternary :disabled="disabled" @click="change({ x: 80 })">靠右</NButton>
        <NButton size="tiny" quaternary :disabled="disabled" @click="reset">还原位置</NButton>
      </div>
      <NPopover trigger="click" placement="bottom-end">
        <template #trigger><NButton size="tiny" quaternary>精细调整</NButton></template>
        <div class="precision-settings">
          <div class="layout-fields">
            <label>
              水平位置 %
              <NInputNumber
                :value="layout.x"
                :min="-50"
                :max="150"
                :step="0.1"
                :precision="1"
                :disabled="disabled"
                aria-label="立绘水平位置"
                @update:value="v => v !== null && change({ x: v })"
              />
            </label>
            <label>
              底部位置 %
              <NInputNumber
                :value="layout.y"
                :min="-50"
                :max="150"
                :step="0.1"
                :precision="1"
                :disabled="disabled"
                aria-label="立绘底部位置"
                @update:value="v => v !== null && change({ y: v })"
              />
            </label>
            <label>
              图片高度 %
              <NInputNumber
                :value="layout.height"
                :min="5"
                :max="160"
                :step="0.1"
                :precision="1"
                :disabled="disabled"
                aria-label="立绘图片高度"
                @update:value="v => v !== null && change({ height: v })"
              />
            </label>
          </div>
          <p class="hint">坐标以原图底部中心为准，图片高度包含透明留白。</p>
        </div>
      </NPopover>
    </div>
  </div>
</template>
<style scoped>
.calibration-stage {
  position: relative;
  aspect-ratio: 16/9;
  overflow: hidden;
  background: #fff;
  border: 1px solid #d9dee5;
  border-radius: 8px;
  color: #687581;
}
.safe-zone {
  position: absolute;
  inset: 4%;
  border: 1px dashed #ccd5dc;
  font-size: 12px;
  padding: 6px;
  pointer-events: none;
}
.subtitle-guide {
  position: absolute;
  bottom: 8%;
  left: 8%;
  right: 8%;
  height: 9%;
  border: 1px dashed #94a3b8;
  background: #ffffffdd;
  display: grid;
  place-items: center;
  font-size: clamp(10px, 1vw, 14px);
  pointer-events: none;
}
.edit-box {
  position: absolute;
  border: 1px dashed rgb(var(--primary-color));
  cursor: move;
  touch-action: none;
}
.edit-box:focus-visible {
  outline: 2px solid rgb(var(--primary-color));
}
.resize-handle {
  position: absolute;
  top: 0;
  right: 0;
  width: 26px;
  height: 26px;
  background: rgb(var(--primary-color));
  color: white;
  cursor: ns-resize;
  touch-action: none;
  border: 0;
}
.anchor {
  position: absolute;
  left: 50%;
  bottom: -10px;
  color: rgb(var(--primary-color));
  transform: translateX(-50%);
}
.layout-fields {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin: 16px 0;
}
.layout-fields label {
  display: grid;
  gap: 6px;
  font-size: 13px;
}
.layout-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
}
.layout-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 8px;
  flex-wrap: wrap;
}
.precision-settings {
  width: min(340px, 80vw);
  font-size: 12px;
  color: rgb(var(--base-text-color) / 0.6);
}
.hint {
  color: rgb(var(--base-text-color) / 0.6);
  font-size: 12px;
}
</style>
