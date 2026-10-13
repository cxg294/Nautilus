<script setup lang="ts">
/**
 * 播放控制条 — 播放/暂停/上一步/下一步/进度
 */
import type { PlayerStatus } from '../types/sequence';

const props = defineProps<{
  status: PlayerStatus;
  currentIndex: number;
  totalSteps: number;
  progress: number;
  isFirstStep: boolean;
  isLastStep: boolean;
}>();

const emit = defineEmits<{
  (e: 'toggle-play'): void;
  (e: 'stop'): void;
  (e: 'prev'): void;
  (e: 'next'): void;
}>();

function getStatusIcon(): string {
  switch (props.status) {
    case 'playing': return 'i-mdi-pause';
    case 'paused': return 'i-mdi-play';
    default: return 'i-mdi-play';
  }
}

function getStatusTooltip(): string {
  switch (props.status) {
    case 'playing': return '暂停 (Space)';
    case 'paused': return '继续 (Space)';
    default: return '播放 (Space)';
  }
}
</script>

<template>
  <div class="controls">
    <!-- 左侧：播放控制 -->
    <div class="controls__left">
      <NButton
        circle
        size="medium"
        secondary
        :disabled="isFirstStep || status === 'idle'"
        title="上一步 (←)"
        @click="emit('prev')"
      >
        <template #icon><span class="i-mdi-skip-previous" /></template>
      </NButton>

      <NButton
        circle
        size="large"
        type="primary"
        :disabled="status === 'idle'"
        :title="getStatusTooltip()"
        @click="emit('toggle-play')"
      >
        <template #icon><span :class="getStatusIcon()" /></template>
      </NButton>

      <NButton
        circle
        size="medium"
        secondary
        :disabled="isLastStep || status === 'idle'"
        title="下一步 (→)"
        @click="emit('next')"
      >
        <template #icon><span class="i-mdi-skip-next" /></template>
      </NButton>

      <NButton
        circle
        size="medium"
        secondary
        :disabled="status === 'idle'"
        title="停止"
        @click="emit('stop')"
      >
        <template #icon><span class="i-mdi-stop" /></template>
      </NButton>
    </div>

    <!-- 中间：进度 -->
    <div class="controls__center">
      <NProgress
        type="line"
        :percentage="progress"
        :show-indicator="false"
        :height="6"
        color="var(--sp-primary)"
        rail-color="rgba(148, 163, 184, 0.24)"
        style="flex: 1;"
      />
    </div>

    <!-- 右侧：步骤计数 -->
    <div class="controls__right">
      <span class="controls__counter">
        {{ status === 'idle' ? '—' : `${currentIndex + 1} / ${totalSteps}` }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.controls {
  display: flex;
  align-items: center;
  gap: 14px;
  min-height: 58px;
  padding: 10px 14px;
  background: var(--sp-surface-alt);
  border: 1px solid var(--sp-border);
  border-radius: 8px;
}

.controls__left {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.controls__center {
  flex: 1;
  display: flex;
  align-items: center;
}

.controls__right {
  flex-shrink: 0;
}

.controls__counter {
  font-size: 12px;
  color: var(--sp-text-muted);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  min-width: 60px;
  text-align: right;
}
</style>
