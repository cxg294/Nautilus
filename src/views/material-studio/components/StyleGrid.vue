<script setup lang="ts">
/**
 * StyleGrid — 右侧风格卡片网格
 *
 * 展示风格库，AI 推荐的排最前
 */
import { computed, ref } from 'vue';
import { useMaterialStudio } from '../composables/use-material-studio';
import { STYLE_LIBRARY } from '../config/styles';

const { state, selectStyleAndGenerate } = useMaterialStudio();

const categories = ['全部', ...new Set(STYLE_LIBRARY.map(s => s.category))];
const activeCategory = ref('全部');

// 排序并过滤：按分类过滤，且推荐的排前面
const sortedStyles = computed(() => {
  const hints = state.styleHints.map(h => h.toLowerCase());
  
  let filtered = [...STYLE_LIBRARY];
  if (activeCategory.value !== '全部') {
    filtered = filtered.filter(s => s.category === activeCategory.value);
  }

  const sorted = filtered.sort((a, b) => {
    const aMatch = hints.some(h => a.id.includes(h) || a.nameEn.toLowerCase().includes(h) || a.name.includes(h));
    const bMatch = hints.some(h => b.id.includes(h) || b.nameEn.toLowerCase().includes(h) || b.name.includes(h));
    if (aMatch && !bMatch) return -1;
    if (!aMatch && bMatch) return 1;
    return 0;
  });

  // 始终在最前面注入“不指定风格”
  return [
    {
      id: 'none',
      name: '不指定风格',
      nameEn: 'No specific style',
      category: '基础',
      icon: '✨',
      description: '保持原始自由的AI生成，不加约束',
      nautilusPrompt: ''
    },
    ...sorted
  ];
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

    <div class="category-tabs">
      <button 
        v-for="cat in categories" 
        :key="cat"
        class="cat-tab"
        :class="{ active: activeCategory === cat }"
        @click="activeCategory = cat"
      >
        {{ cat }}
      </button>
    </div>

    <div class="style-grid">
      <button
        v-for="style in sortedStyles"
        :key="style.id"
        class="style-card"
        :class="{ 'has-cover': style.id !== 'none', recommended: isRecommended(style) }"
        @click="selectStyleAndGenerate(style.id === 'none' ? '原汁原味的自然画风' : style.id)"
      >
        <!-- 封面图 (只有真实风格才有) -->
        <div v-if="style.id !== 'none'" class="img-wrapper">
          <img :src="`/images/styles/${style.id}.png`" :alt="style.name" class="style-cover" loading="lazy" />
          <span v-if="isRecommended(style)" class="rec-badge">⭐ 推荐</span>
        </div>
        
        <!-- 空白风格特别样式 -->
        <div v-else class="img-wrapper none-cover">
          <span class="none-icon">✨</span>
          <span class="none-text">自然发挥</span>
        </div>

        <div class="style-info">
          <span class="style-name">{{ style.icon }} {{ style.name }}</span>
          <span class="style-desc">{{ style.description }}</span>
        </div>
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
  background: var(--n-color-modal);
  border: 1px solid var(--n-border-color);
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
  color: var(--n-text-color);
}

.panel-hint {
  font-size: 12px;
  color: var(--n-text-color-3);
  margin: 0;
}

/* 分类 Tab */
.category-tabs {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 8px;
  margin-top: 4px;
}

.category-tabs::-webkit-scrollbar {
  height: 4px;
}

.category-tabs::-webkit-scrollbar-thumb {
  background: var(--n-border-color);
  border-radius: 2px;
}

.cat-tab {
  padding: 6px 12px;
  border-radius: 16px;
  border: 1px solid var(--n-border-color);
  background: var(--n-color);
  color: var(--n-text-color-3);
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s;
}

.cat-tab:hover {
  background: var(--n-color-hover, rgba(0,0,0,0.03));
}

.cat-tab.active {
  background: var(--n-primary-color, rgba(124, 92, 252, 0.15));
  border-color: var(--n-primary-color, #7c5cfc);
  color: var(--n-primary-color, #7c5cfc);
  font-weight: 600;
}

.style-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
}

.style-card {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 0;
  border: 1px solid var(--n-border-color);
  border-radius: 12px;
  background: var(--n-color);
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  overflow: hidden;
}

.style-card:hover {
  border-color: rgba(124, 92, 252, 0.4);
  box-shadow: 0 4px 16px rgba(124, 92, 252, 0.15);
  transform: translateY(-2px);
}

.style-card.recommended {
  border-color: rgba(124, 92, 252, 0.4);
}

.img-wrapper {
  position: relative;
  width: 100%;
  aspect-ratio: 1; /* 1:1 cover */
  overflow: hidden;
  background: var(--n-color-modal);
}

.style-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.style-card:hover .style-cover {
  transform: scale(1.05);
}

.none-cover {
  background: linear-gradient(135deg, #1f1c2c, #928DAB);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.none-icon {
  font-size: 32px;
  animation: pulse 2s infinite ease-in-out;
}

.none-text {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  letter-spacing: 2px;
  text-shadow: 0 2px 4px rgba(0,0,0,0.5);
}

.rec-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, #f0c040, #ff8c00);
  padding: 4px 8px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  z-index: 2;
}

.style-info {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  background: var(--n-color);
  z-index: 1;
}

.style-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--n-text-color);
  display: flex;
  align-items: center;
  gap: 4px;
}

.style-desc {
  font-size: 12px;
  color: var(--n-text-color-3);
  line-height: 1.4;
}
</style>
