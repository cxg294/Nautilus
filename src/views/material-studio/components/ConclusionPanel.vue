<script setup lang="ts">
/**
 * ConclusionPanel — 右侧结论汇总面板
 *
 * 实时显示三维度完成状态
 */
import { useMaterialStudio } from '../composables/use-material-studio';

const { state } = useMaterialStudio();

const dimensions = [
  { key: 'd1', label: '主体内容', icon: '🎯', desc: '画面中的具体元素和布局' },
  { key: 'd2', label: '呈现意图', icon: '✨', desc: '情绪、氛围和视觉目标' },
  { key: 'd3', label: '用途场景', icon: '📋', desc: '素材的使用场景和约束' },
] as const;
</script>

<template>
  <div class="conclusion-panel">
    <div class="panel-header">
      <span class="panel-icon">📊</span>
      <span class="panel-title">需求收集进度</span>
    </div>

    <div class="dimension-list">
      <div
        v-for="dim in dimensions"
        :key="dim.key"
        class="dimension-item"
        :class="{ done: state.conclusions[dim.key] }"
      >
        <div class="dim-header">
          <span class="dim-icon">{{ dim.icon }}</span>
          <span class="dim-label">{{ dim.label }}</span>
          <span class="dim-status">
            <span v-if="state.conclusions[dim.key]" class="status-done">✓</span>
            <span v-else class="status-pending">⏳</span>
          </span>
        </div>
        <div class="dim-desc">{{ dim.desc }}</div>
        <div v-if="state.conclusions[dim.key]" class="dim-value">
          {{ state.conclusions[dim.key] }}
        </div>
      </div>
    </div>

    <!-- 参考图 -->
    <div v-if="state.refImagePreview" class="ref-section">
      <div class="ref-header">
        <span class="panel-icon">🖼️</span>
        <span>参考图</span>
      </div>
      <img :src="state.refImagePreview" alt="参考图" class="ref-img" />
    </div>

    <!-- 比例 -->
    <div class="ratio-section">
      <span class="ratio-tag">{{ state.aspectRatio }}</span>
      <span class="ratio-text">画面比例</span>
    </div>
  </div>
</template>

<style scoped>
.conclusion-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
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
  padding-bottom: 12px;
  border-bottom: 1px solid var(--n-border-color);
}

.panel-icon {
  font-size: 16px;
}

.panel-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--n-text-color);
}

.dimension-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dimension-item {
  padding: 12px;
  border-radius: 10px;
  background: var(--n-color);
  border: 1px solid var(--n-border-color);
  transition: all 0.3s;
}

.dimension-item.done {
  background: rgba(46, 213, 115, 0.04);
  border-color: rgba(46, 213, 115, 0.2);
}

.dim-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.dim-icon {
  font-size: 14px;
}

.dim-label {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: var(--n-text-color-2);
}

.dim-status {
  font-size: 14px;
}

.status-done {
  color: #2ed573;
}

.status-pending {
  opacity: 0.5;
}

.dim-desc {
  font-size: 11px;
  color: var(--n-text-color-3);
  margin-bottom: 4px;
}

.dim-value {
  font-size: 13px;
  color: #7c5cfc;
  padding: 6px 10px;
  background: rgba(124, 92, 252, 0.06);
  border-radius: 6px;
  margin-top: 6px;
  line-height: 1.5;
}

.ref-section {
  padding-top: 12px;
  border-top: 1px solid var(--n-border-color);
}

.ref-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--n-text-color-3);
  margin-bottom: 8px;
}

.ref-img {
  width: 100%;
  max-height: 120px;
  object-fit: cover;
  border-radius: 8px;
}

.ratio-section {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 8px;
}

.ratio-tag {
  padding: 3px 10px;
  background: rgba(124, 92, 252, 0.1);
  border-radius: 12px;
  font-size: 12px;
  color: #7c5cfc;
  font-weight: 600;
}

.ratio-text {
  font-size: 12px;
  color: var(--n-text-color-3);
}
</style>
