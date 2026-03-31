<script setup lang="ts">
/**
 * StyleGrid — 右侧风格卡片网格
 *
 * 展示风格库，AI 推荐的排最前
 */
import { computed } from 'vue';
import { useMaterialStudio, STYLE_LIBRARY } from '../composables/use-material-studio';

const { state, selectStyleAndGenerate } = useMaterialStudio();

// 排序：推荐的排前面
const sortedStyles = computed(() => {
  const hints = state.styleHints.map(h => h.toLowerCase());
  return [...STYLE_LIBRARY].sort((a, b) => {
    const aMatch = hints.some(h => a.id.includes(h) || a.nameEn.toLowerCase().includes(h) || a.name.includes(h));
    const bMatch = hints.some(h => b.id.includes(h) || b.nameEn.toLowerCase().includes(h) || b.name.includes(h));
    if (aMatch && !bMatch) return -1;
    if (!aMatch && bMatch) return 1;
    return 0;
  });
});

function isRecommended(style: typeof STYLE_LIBRARY[0]) {
  const hints = state.styleHints.map(h => h.toLowerCase());
  return hints.some(h => style.id.includes(h) || style.nameEn.toLowerCase().includes(h) || style.name.includes(h));
}
</script>

<template>
  <div class="style-grid-panel">
    <div class="panel-header">
      <span class="panel-icon">🎨</span>
      <span class="panel-title">选择视觉风格</span>
    </div>
    <p class="panel-hint">选择一个风格后将开始生成图片</p>

    <div class="style-grid">
      <button
        v-for="style in sortedStyles"
        :key="style.id"
        class="style-card"
        :class="{ recommended: isRecommended(style) }"
        @click="selectStyleAndGenerate(style.id)"
      >
        <span v-if="isRecommended(style)" class="rec-badge">⭐ 推荐</span>
        <span class="style-icon">{{ style.icon }}</span>
        <span class="style-name">{{ style.name }}</span>
        <span class="style-desc">{{ style.description }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.style-grid-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 14px;
  overflow-y: auto;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.panel-icon {
  font-size: 16px;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: #ddd;
}

.panel-hint {
  font-size: 12px;
  color: #888;
  margin: 0;
}

.style-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.style-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 16px 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.03);
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
}

.style-card:hover {
  background: rgba(124, 92, 252, 0.08);
  border-color: rgba(124, 92, 252, 0.25);
  transform: translateY(-2px);
}

.style-card.recommended {
  border-color: rgba(124, 92, 252, 0.3);
  background: rgba(124, 92, 252, 0.06);
}

.rec-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  font-size: 10px;
  color: #f0c040;
  background: rgba(240, 192, 64, 0.12);
  padding: 2px 6px;
  border-radius: 8px;
}

.style-icon {
  font-size: 28px;
}

.style-name {
  font-size: 13px;
  font-weight: 600;
  color: #ddd;
}

.style-desc {
  font-size: 11px;
  color: #888;
  line-height: 1.4;
}
</style>
