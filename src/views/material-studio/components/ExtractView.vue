<script setup lang="ts">
/**
 * ExtractView — 素材提取完成 + 导出
 *
 * 展示背景 + 各前景缩略图 + 下载控件
 */
import { useMaterialStudio } from '../composables/use-material-studio';

const { state, downloadZip, downloadFile, reset } = useMaterialStudio();
</script>

<template>
  <div class="extract-view">
    <!-- 素材预览区 -->
    <div class="assets-preview">
      <!-- 背景 -->
      <div class="asset-section">
        <div class="section-title">
          <span class="section-icon">🖼️</span>
          背景
        </div>
        <div class="asset-card bg-card">
          <img :src="state.backgroundUrl" alt="背景" class="asset-thumb" />
          <button class="card-download" @click="downloadFile(state.backgroundUrl, 'background.png')">
            📥
          </button>
        </div>
      </div>

      <!-- 前景元素 -->
      <div class="asset-section">
        <div class="section-title">
          <span class="section-icon">✂️</span>
          前景元素（{{ state.extractedElements.length }}）
        </div>
        <div class="elements-grid">
          <div
            v-for="(elem, idx) in state.extractedElements"
            :key="idx"
            class="asset-card elem-card"
          >
            <img :src="elem.url" :alt="elem.name" class="asset-thumb checkerboard" />
            <div class="card-info">
              <span class="card-name">{{ elem.name }}</span>
              <span class="card-bbox">{{ elem.bbox.join(', ') }}</span>
            </div>
            <button class="card-download" @click="downloadFile(elem.url, `${elem.name}.png`)">
              📥
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 操作栏 -->
    <div class="export-actions">
      <div class="actions-header">
        <span class="actions-icon">📦</span>
        <span class="actions-title">素材包就绪</span>
      </div>

      <div class="stats">
        <div class="stat-item">
          <span class="stat-num">1</span>
          <span class="stat-label">背景</span>
        </div>
        <div class="stat-item">
          <span class="stat-num">{{ state.extractedElements.length }}</span>
          <span class="stat-label">前景元素</span>
        </div>
        <div class="stat-item">
          <span class="stat-num">1</span>
          <span class="stat-label">清单文件</span>
        </div>
      </div>

      <button class="download-zip-btn" @click="downloadZip">
        📦 下载 ZIP 素材包
      </button>

      <button class="download-manifest-btn" @click="downloadFile(state.manifestUrl, 'manifest.json')">
        📄 下载 manifest.json
      </button>

      <div class="action-divider" />

      <button class="new-task-btn" @click="reset">
        ✨ 开始新任务
      </button>
    </div>
  </div>
</template>

<style scoped>
.extract-view {
  height: 100%;
  display: flex;
  gap: 16px;
  overflow: hidden;
}

/* 素材预览 */
.assets-preview {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 4px;
}

.asset-section { }

.section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--n-text-color-2);
  margin-bottom: 10px;
}

.section-icon { font-size: 16px; }

/* 素材卡片 */
.asset-card {
  position: relative;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--n-border-color);
  transition: all 0.2s;
}

.asset-card:hover {
  border-color: var(--n-primary-color, #7c5cfc);
}

.bg-card .asset-thumb {
  width: 100%;
  max-height: 300px;
  object-fit: cover;
  display: block;
}

.elements-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
}

.elem-card {
  display: flex;
  flex-direction: column;
}

.elem-card .asset-thumb {
  width: 100%;
  height: 120px;
  object-fit: contain;
  display: block;
  padding: 8px;
}

/* 棋盘格背景（透明底展示） */
.checkerboard {
  background-image:
    linear-gradient(45deg, #333 25%, transparent 25%),
    linear-gradient(-45deg, #333 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #333 75%),
    linear-gradient(-45deg, transparent 75%, #333 75%);
  background-size: 12px 12px;
  background-position: 0 0, 0 6px, 6px -6px, -6px 0;
  background-color: #2a2a2a;
}

.card-info {
  padding: 6px 10px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-name {
  font-size: 12px;
  color: var(--n-text-color-2);
  font-weight: 500;
}

.card-bbox {
  font-size: 10px;
  color: var(--n-text-color-3);
  font-family: monospace;
}

.card-download {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: none;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
}

.asset-card:hover .card-download {
  opacity: 1;
}

/* 操作栏 */
.export-actions {
  width: 260px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  background: var(--n-color-modal);
  border: 1px solid var(--n-border-color);
  border-radius: 14px;
}

.actions-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.actions-icon { font-size: 20px; }
.actions-title { font-size: 16px; font-weight: 600; color: var(--n-text-color); }

.stats {
  display: flex;
  gap: 8px;
}

.stat-item {
  flex: 1;
  padding: 10px;
  border-radius: 10px;
  background: var(--n-color);
  border: 1px solid var(--n-border-color);
  text-align: center;
}

.stat-num {
  display: block;
  font-size: 20px;
  font-weight: 700;
  color: #7c5cfc;
}

.stat-label {
  font-size: 11px;
  color: var(--n-text-color-3);
}

.download-zip-btn {
  padding: 14px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #7c5cfc, #36d1dc);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.download-zip-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(124, 92, 252, 0.3);
}

.download-manifest-btn {
  padding: 10px;
  border: 1px solid var(--n-border-color);
  border-radius: 10px;
  background: transparent;
  color: var(--n-text-color-2);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.download-manifest-btn:hover {
  background: var(--n-color);
}

.action-divider {
  height: 1px;
  background: var(--n-border-color);
}

.new-task-btn {
  padding: 10px;
  border: 1px solid var(--n-border-color);
  border-radius: 10px;
  background: transparent;
  color: var(--n-text-color-3);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.new-task-btn:hover {
  background: var(--n-color-hover, rgba(0,0,0,0.03));
  color: var(--n-text-color);
}
</style>
