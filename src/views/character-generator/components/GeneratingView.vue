<script setup lang="ts">
/**
 * GeneratingView — 生成中动画
 */
import { useCharacterGen } from '../composables/use-character-gen';

const { state } = useCharacterGen();
</script>

<template>
  <div class="generating-view">
    <div class="generating-content">
      <div class="spinner-ring">
        <div class="spinner-inner" />
      </div>
      <p class="generating-text">{{ state.loadingText || '生成中...' }}</p>
      <p class="generating-hint">请耐心等待，AI 正在创作中</p>
    </div>
  </div>
</template>

<style scoped>
.generating-view {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.generating-content {
  text-align: center;
}

.spinner-ring {
  width: 80px;
  height: 80px;
  margin: 0 auto 24px;
  border-radius: 50%;
  border: 3px solid rgba(124, 92, 252, 0.12);
  border-top-color: #7c5cfc;
  animation: spin 1s linear infinite;
  display: flex;
  align-items: center;
  justify-content: center;
}

.spinner-inner {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  border: 3px solid rgba(124, 92, 252, 0.08);
  border-bottom-color: rgba(124, 92, 252, 0.5);
  animation: spin 1.5s linear infinite reverse;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.generating-text {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 8px;
  color: #7c5cfc;
}

.generating-hint {
  font-size: 13px;
  color: var(--text-color-3, #999);
  margin: 0;
}
</style>
