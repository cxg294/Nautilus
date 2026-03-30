<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const route = useRoute();

// 从路由 meta 中获取工具名称，用于显示
const toolName = computed(() => {
  const i18nKey = route.meta?.i18nKey as string;
  if (i18nKey) {
    return t(i18nKey);
  }
  return t('common.lookForward');
});
</script>

<template>
  <div class="locked-page">
    <div class="locked-container">
      <!-- 锁定图标动画 -->
      <div class="lock-icon-wrapper">
        <div class="lock-glow" />
        <div class="lock-icon">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="lock-svg"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            <circle cx="12" cy="16" r="1" />
          </svg>
        </div>
      </div>

      <!-- 标题 -->
      <h2 class="locked-title">{{ toolName }}</h2>

      <!-- 状态标签 -->
      <div class="locked-badge">
        <span class="badge-dot" />
        <span>{{ t('common.lookForward') }}</span>
      </div>

      <!-- 说明文字 -->
      <p class="locked-desc">
        该工具正在开发中，暂未开放访问。
      </p>
    </div>

    <!-- 底部装饰粒子 -->
    <div class="particles">
      <div v-for="i in 6" :key="i" class="particle" :style="{ '--i': i }" />
    </div>
  </div>
</template>

<style scoped>
.locked-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100%;
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.03) 0%, rgba(139, 92, 246, 0.03) 100%);
}

.locked-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 48px;
  text-align: center;
  position: relative;
  z-index: 1;
}

/* 锁定图标容器 */
.lock-icon-wrapper {
  position: relative;
  width: 120px;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 光晕效果 */
.lock-glow {
  position: absolute;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%);
  animation: pulse-glow 3s ease-in-out infinite;
}

/* 锁图标容器 */
.lock-icon {
  width: 80px;
  height: 80px;
  border-radius: 24px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
  border: 1px solid rgba(99, 102, 241, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(10px);
  animation: float 6s ease-in-out infinite;
}

.lock-svg {
  width: 36px;
  height: 36px;
  color: rgba(99, 102, 241, 0.6);
}

/* 标题 */
.locked-title {
  font-size: 22px;
  font-weight: 600;
  color: var(--n-text-color, #334155);
  margin: 0;
  letter-spacing: -0.01em;
}

/* 状态标签 */
.locked-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  border-radius: 100px;
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.2);
  font-size: 13px;
  font-weight: 500;
  color: rgb(180, 120, 20);
}

.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgb(245, 158, 11);
  animation: blink 2s ease-in-out infinite;
}

/* 描述文字 */
.locked-desc {
  font-size: 14px;
  color: var(--n-text-color-3, #94a3b8);
  margin: 0;
  max-width: 320px;
  line-height: 1.6;
}

/* 装饰粒子 */
.particles {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.particle {
  position: absolute;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: rgba(99, 102, 241, 0.15);
  animation: drift calc(8s + var(--i) * 2s) ease-in-out infinite;
  left: calc(10% + var(--i) * 14%);
  top: calc(20% + var(--i) * 10%);
}

/* 动画 */
@keyframes pulse-glow {
  0%, 100% { transform: scale(1); opacity: 0.5; }
  50% { transform: scale(1.15); opacity: 1; }
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

@keyframes drift {
  0%, 100% {
    transform: translate(0, 0) scale(1);
    opacity: 0.3;
  }
  25% {
    transform: translate(10px, -20px) scale(1.5);
    opacity: 0.6;
  }
  50% {
    transform: translate(-5px, -40px) scale(1);
    opacity: 0.2;
  }
  75% {
    transform: translate(15px, -15px) scale(1.3);
    opacity: 0.5;
  }
}

/* 暗色模式适配 */
:root.dark .locked-title {
  color: #e2e8f0;
}

:root.dark .locked-desc {
  color: #64748b;
}

:root.dark .locked-badge {
  background: rgba(245, 158, 11, 0.1);
  color: rgb(251, 191, 36);
}

:root.dark .lock-icon {
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%);
  border-color: rgba(99, 102, 241, 0.25);
}
</style>
