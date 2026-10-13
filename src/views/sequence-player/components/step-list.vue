<script setup lang="ts">
/**
 * 步骤列表 — 台词高亮跟随 + 点击跳转
 */
import type { Step, Character } from '../types/sequence';

const props = defineProps<{
  steps: Step[];
  characters: Character[];
  currentIndex: number;
  status: string;
}>();

const emit = defineEmits<{
  (e: 'go-to', index: number): void;
}>();

/** 获取角色颜色 */
function getCharColor(charName?: string): string {
  if (!charName) return '#94a3b8';
  const char = props.characters.find(c => c.name === charName);
  return char?.color || '#94a3b8';
}

/** 步骤类型 icon class */
function getStepIcon(step: Step): string {
  switch (step.type) {
    case 'dialogue': return 'i-mdi-message-text-outline';
    case 'wait': return 'i-mdi-timer-sand';
    case 'narration': return 'i-mdi-text';
    case 'direction': return 'i-mdi-directions';
    default: return 'i-mdi-help';
  }
}

/** 步骤简短描述 */
function getStepLabel(step: Step): string {
  switch (step.type) {
    case 'dialogue': return step.text;
    case 'wait': return `停顿 ${(step.duration || 0) / 1000}s`;
    case 'narration': return step.text;
    case 'direction': return step.text;
    default: return step.text;
  }
}
</script>

<template>
  <div class="step-list">
    <div class="step-list__header">
      <span class="step-list__title">步骤列表</span>
      <span class="step-list__count">{{ steps.length }} 步</span>
    </div>
    <div class="step-list__body">
      <div
        v-for="(step, idx) in steps"
        :key="step.id"
        class="step-item"
        :class="{
          'step-item--active': idx === currentIndex,
          'step-item--played': idx < currentIndex,
          'step-item--wait': step.type === 'wait',
        }"
        @click="emit('go-to', idx)"
      >
        <div class="step-item__index">{{ idx + 1 }}</div>
        <div
          v-if="step.type === 'dialogue'"
          class="step-item__char-dot"
          :style="{ backgroundColor: getCharColor(step.characterName) }"
        />
        <span v-else class="step-item__icon" :class="getStepIcon(step)" />
        <div class="step-item__content">
          <div v-if="step.characterName" class="step-item__char" :style="{ color: getCharColor(step.characterName) }">
            {{ step.characterName }}
            <span v-if="step.poseName" class="step-item__pose">({{ step.poseName }})</span>
          </div>
          <div class="step-item__text">{{ getStepLabel(step) }}</div>
        </div>
      </div>

      <div v-if="steps.length === 0" class="step-list__empty">
        <span class="i-mdi-script-text-outline" style="font-size: 24px; opacity: 0.3;" />
        <p>暂无步骤，请先导入脚本</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.step-list {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.step-list__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  border-bottom: 1px solid var(--sp-border);
  background: var(--sp-surface-alt);
  flex-shrink: 0;
}

.step-list__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--sp-text);
}

.step-list__count {
  padding: 2px 7px;
  border-radius: 999px;
  background: var(--sp-surface-muted);
  color: var(--sp-text-subtle);
  font-size: 11px;
  font-weight: 600;
}

.step-list__body {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.step-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  min-height: 54px;
  padding: 9px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, opacity 0.15s;
  font-size: 13px;
  border: 1px solid transparent;
  border-left-width: 3px;
}

.step-item:hover {
  background: var(--sp-surface-muted);
}

.step-item--active {
  background: var(--sp-primary-soft) !important;
  border-color: var(--sp-primary-border);
  border-left-color: var(--sp-primary);
}

.step-item--played {
  opacity: 0.68;
}

.step-item__index {
  width: 20px;
  font-size: 11px;
  color: var(--sp-text-subtle);
  font-weight: 700;
  text-align: right;
  flex-shrink: 0;
  line-height: 20px;
}

.step-item__char-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  margin-top: 7px;
  flex-shrink: 0;
  box-shadow: 0 0 0 3px rgba(148, 163, 184, 0.16);
}

.step-item__icon {
  font-size: 14px;
  color: var(--sp-text-subtle);
  margin-top: 2px;
  flex-shrink: 0;
}

.step-item__content {
  flex: 1;
  min-width: 0;
}

.step-item__char {
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 2px;
}

.step-item__pose {
  font-size: 11px;
  opacity: 0.6;
}

.step-item__text {
  color: var(--sp-text-muted);
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.step-item--wait .step-item__text {
  color: var(--sp-text-subtle);
}

.step-list__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
  gap: 8px;
  color: var(--sp-text-subtle);
}

.step-list__empty p {
  margin: 0;
  font-size: 13px;
}
</style>
