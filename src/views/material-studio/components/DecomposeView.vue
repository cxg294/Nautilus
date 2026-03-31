<script setup lang="ts">
/**
 * DecomposeView — 素材拆解
 *
 * 在生成的图片上叠加 bbox 框，用户勾选保留的元素
 */
import { computed } from 'vue';
import { useMaterialStudio } from '../composables/use-material-studio';

const { state, toggleElement, extractAssets } = useMaterialStudio();

const selectedCount = computed(() => state.elements.filter(e => e.selected).length);
</script>

<template>
  <div class="decompose-view">
    <!-- 左侧：图片 + bbox 叠加 -->
    <div class="decompose-canvas">
      <div class="canvas-wrapper">
        <img :src="state.imageUrl" alt="原图" class="base-img" ref="baseImg" />
        <!-- bbox 框 -->
        <div
          v-for="(el, idx) in state.elements"
          :key="idx"
          class="bbox-overlay"
          :class="{ selected: el.selected }"
          :style="{
            left: `${(el.bbox[0] / 1024) * 100}%`,
            top: `${(el.bbox[1] / 1024) * 100}%`,
            width: `${(el.bbox[2] / 1024) * 100}%`,
            height: `${(el.bbox[3] / 1024) * 100}%`,
          }"
          @click="toggleElement(idx)"
        >
          <span class="bbox-label">{{ el.name }}</span>
          <span class="bbox-check">{{ el.selected ? '✓' : '' }}</span>
        </div>
      </div>
    </div>

    <!-- 右侧：元素列表 -->
    <div class="decompose-panel">
      <div class="panel-header">
        <span class="panel-icon">🔍</span>
        <span class="panel-title">前景元素</span>
        <span class="panel-count">{{ selectedCount }}/{{ state.elements.length }}</span>
      </div>

      <p class="panel-hint">勾选要提取的前景元素，将分别抠图输出</p>

      <div class="element-list">
        <label
          v-for="(el, idx) in state.elements"
          :key="idx"
          class="element-item"
          :class="{ checked: el.selected }"
        >
          <input
            type="checkbox"
            :checked="el.selected"
            @change="toggleElement(idx)"
          />
          <span class="elem-name">{{ el.name }}</span>
          <span class="elem-bbox">{{ el.bbox.join(', ') }}</span>
        </label>
      </div>

      <button
        class="extract-btn"
        :disabled="selectedCount === 0 || state.extractLoading"
        @click="extractAssets"
      >
        {{ state.extractLoading ? '正在提取...' : `提取 ${selectedCount} 个元素` }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.decompose-view {
  height: 100%;
  display: flex;
  gap: 16px;
  overflow: hidden;
}

/* 图片区域 */
.decompose-canvas {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.canvas-wrapper {
  position: relative;
  display: inline-block;
  max-width: 100%;
  max-height: 100%;
}

.base-img {
  display: block;
  max-width: 100%;
  max-height: calc(100vh - 180px);
  object-fit: contain;
  border-radius: 10px;
}

/* bbox 叠加 */
.bbox-overlay {
  position: absolute;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.bbox-overlay:hover {
  border-color: rgba(124, 92, 252, 0.8);
  background: rgba(124, 92, 252, 0.1);
}

.bbox-overlay.selected {
  border-color: #2ed573;
  background: rgba(46, 213, 115, 0.1);
}

.bbox-label {
  font-size: 10px;
  color: #fff;
  background: rgba(0, 0, 0, 0.6);
  padding: 1px 6px;
  border-radius: 3px;
  white-space: nowrap;
  position: absolute;
  top: -16px;
  left: 0;
}

.bbox-check {
  font-size: 12px;
  color: #2ed573;
  position: absolute;
  top: 2px;
  right: 4px;
}

/* 右侧面板 */
.decompose-panel {
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
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

.panel-icon { font-size: 16px; }
.panel-title { font-size: 14px; font-weight: 600; color: #ddd; flex: 1; }
.panel-count { font-size: 12px; color: #7c5cfc; }

.panel-hint {
  font-size: 12px;
  color: #888;
  margin: 0;
}

.element-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  overflow-y: auto;
}

.element-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  cursor: pointer;
  transition: all 0.2s;
}

.element-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.element-item.checked {
  background: rgba(46, 213, 115, 0.04);
  border-color: rgba(46, 213, 115, 0.15);
}

.element-item input[type="checkbox"] {
  accent-color: #2ed573;
}

.elem-name {
  flex: 1;
  font-size: 13px;
  color: #ccc;
}

.elem-bbox {
  font-size: 10px;
  color: #777;
  font-family: monospace;
}

.extract-btn {
  padding: 12px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #7c5cfc, #36d1dc);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.extract-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(124, 92, 252, 0.3);
}

.extract-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
