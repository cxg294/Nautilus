<script setup lang="ts">
/**
 * GeneratingView — 生成中动画
 */
import { useMaterialStudio } from '../composables/use-material-studio';

const { state } = useMaterialStudio();
</script>

<template>
  <div class="generating-view">
    <div class="gen-content">
      <!-- 动画圆环 -->
      <div class="gen-spinner">
        <div class="spinner-ring" />
        <div class="spinner-ring ring-2" />
        <div class="spinner-ring ring-3" />
        <span class="spinner-icon">✦</span>
      </div>

      <!-- 步骤文案 -->
      <div class="gen-text">
        <p class="gen-step">{{ state.generatingStep || '准备中...' }}</p>
        <p class="gen-hint">这可能需要 10-30 秒，请耐心等待</p>
      </div>

      <!-- 装饰粒子 -->
      <div class="particles">
        <span v-for="i in 6" :key="i" class="particle" :class="`p-${i}`" />
      </div>
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

.gen-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  position: relative;
}

/* 旋转圆环 */
.gen-spinner {
  position: relative;
  width: 100px;
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.spinner-ring {
  position: absolute;
  inset: 0;
  border: 2px solid transparent;
  border-top-color: #7c5cfc;
  border-radius: 50%;
  animation: spin 1.5s linear infinite;
}

.ring-2 {
  inset: 8px;
  border-top-color: #36d1dc;
  animation-duration: 2s;
  animation-direction: reverse;
}

.ring-3 {
  inset: 16px;
  border-top-color: #f093fb;
  animation-duration: 2.5s;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.spinner-icon {
  font-size: 24px;
  color: #7c5cfc;
  animation: pulse-glow 1.5s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%, 100% { opacity: 0.5; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.2); }
}

/* 文案 */
.gen-text {
  text-align: center;
}

.gen-step {
  font-size: 16px;
  font-weight: 600;
  color: #ddd;
  margin: 0 0 6px;
  animation: fadeIn 0.5s ease;
}

.gen-hint {
  font-size: 13px;
  color: #888;
  margin: 0;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 粒子 */
.particles {
  position: absolute;
  inset: -40px;
  pointer-events: none;
}

.particle {
  position: absolute;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #7c5cfc;
  opacity: 0;
  animation: particle-float 3s ease-in-out infinite;
}

.p-1 { top: 10%; left: 20%; animation-delay: 0s; background: #7c5cfc; }
.p-2 { top: 30%; right: 10%; animation-delay: 0.5s; background: #36d1dc; }
.p-3 { bottom: 20%; left: 30%; animation-delay: 1s; background: #f093fb; }
.p-4 { top: 50%; left: 5%; animation-delay: 1.5s; background: #7c5cfc; }
.p-5 { bottom: 10%; right: 25%; animation-delay: 2s; background: #36d1dc; }
.p-6 { top: 15%; right: 30%; animation-delay: 2.5s; background: #f093fb; }

@keyframes particle-float {
  0% { opacity: 0; transform: translateY(20px) scale(0); }
  30% { opacity: 0.8; transform: translateY(0) scale(1); }
  70% { opacity: 0.8; transform: translateY(-10px) scale(1); }
  100% { opacity: 0; transform: translateY(-30px) scale(0); }
}
</style>
