<script setup lang="ts">
/**
 * 预设效果列表组件 — 双栏网格布局
 * 分为「点击特效」和「背景特效」两大类
 */
import { useI18n } from 'vue-i18n';
import type { EffectPreset as _EffectPreset } from '../composables/use-effects';
import { BURST_PRESETS, AMBIENT_PRESETS } from '../composables/use-effects';

defineProps<{
  /** 当前激活的预设 key */
  activeKey: string;
}>();

const emit = defineEmits<{
  (e: 'select', key: string): void;
}>();

const { t } = useI18n();
</script>

<template>
  <div class="preset-list">
    <!-- 点击特效分类 -->
    <div class="preset-list__category">
      <div class="category-header">
        <span class="category-header__icon">👆</span>
        <span class="category-header__label">{{ t('page.effectsGenerator.categoryBurst') }}</span>
        <span class="category-header__badge">{{ BURST_PRESETS.length }}</span>
      </div>
      <div class="preset-list__grid">
        <button
          v-for="preset in BURST_PRESETS"
          :key="preset.key"
          class="preset-card" :class="[{ 'preset-card--active': activeKey === preset.key }]"
          :title="t(preset.i18nKey)"
          @click="emit('select', preset.key)"
        >
          <span class="preset-card__label">{{ t(preset.i18nKey) }}</span>
          <span v-if="activeKey === preset.key" class="preset-card__indicator" />
        </button>
      </div>
    </div>

    <!-- 背景特效分类 -->
    <div class="preset-list__category">
      <div class="category-header">
        <span class="category-header__icon">🌌</span>
        <span class="category-header__label">{{ t('page.effectsGenerator.categoryAmbient') }}</span>
        <span class="category-header__badge">{{ AMBIENT_PRESETS.length }}</span>
      </div>
      <div class="preset-list__grid">
        <button
          v-for="preset in AMBIENT_PRESETS"
          :key="preset.key"
          class="preset-card preset-card--ambient" :class="[{ 'preset-card--active': activeKey === preset.key }]"
          :title="t(preset.i18nKey)"
          @click="emit('select', preset.key)"
        >
          <span class="preset-card__label">{{ t(preset.i18nKey) }}</span>
          <span v-if="activeKey === preset.key" class="preset-card__indicator" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.preset-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  height: 100%;
  overflow-y: auto;
}

/* 分类 */
.preset-list__category {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.category-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.03);
}

.category-header__icon {
  font-size: 13px;
}

.category-header__label {
  font-size: 10px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
  letter-spacing: 1px;
  text-transform: uppercase;
  flex: 1;
}

.category-header__badge {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 8px;
  background: rgba(99, 102, 241, 0.15);
  color: rgba(99, 102, 241, 0.8);
  font-weight: 600;
}

/* 双栏网格 */
.preset-list__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
}

/* 预设卡片 — 紧凑方块 */
.preset-card {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 8px 6px;
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.02);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
  color: rgba(255, 255, 255, 0.65);
  font-size: 12px;
  min-height: 36px;
}

.preset-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.05));
  opacity: 0;
  transition: opacity 0.2s;
}

.preset-card:hover {
  border-color: rgba(99, 102, 241, 0.3);
  background: rgba(255, 255, 255, 0.05);
  transform: translateY(-1px);
  color: rgba(255, 255, 255, 0.95);
}

.preset-card:hover::before {
  opacity: 1;
}

.preset-card--active {
  border-color: rgba(99, 102, 241, 0.5);
  background: rgba(99, 102, 241, 0.12);
  color: #ffffff;
  box-shadow: 0 0 12px rgba(99, 102, 241, 0.12);
}

.preset-card--active::before {
  opacity: 1;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(168, 85, 247, 0.08));
}

.preset-card--ambient {
  border-color: rgba(34, 197, 94, 0.06);
}

.preset-card--ambient:hover {
  border-color: rgba(34, 197, 94, 0.3);
}

.preset-card--ambient.preset-card--active {
  border-color: rgba(34, 197, 94, 0.4);
  background: rgba(34, 197, 94, 0.1);
  box-shadow: 0 0 12px rgba(34, 197, 94, 0.1);
}

.preset-card--ambient.preset-card--active::before {
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.12), rgba(52, 211, 153, 0.06));
}

.preset-card__label {
  text-align: center;
  position: relative;
  z-index: 1;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}

.preset-card__indicator {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #6366f1;
  box-shadow: 0 0 8px rgba(99, 102, 241, 0.6);
  position: absolute;
  top: 4px;
  right: 4px;
  z-index: 1;
  animation: pulse-indicator 2s ease-in-out infinite;
}

.preset-card--ambient .preset-card__indicator {
  background: #22c55e;
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.6);
}

@keyframes pulse-indicator {
  0%, 100% { box-shadow: 0 0 6px currentColor; }
  50% { box-shadow: 0 0 14px currentColor; }
}
</style>
