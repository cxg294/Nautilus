<script setup lang="ts">
/**
 * ExportPanel — 导出面板
 *
 * 素材卡片展示 + 背景生成 + ZIP 下载
 */
import { computed } from 'vue';
import { useLevelStudio } from '../composables/use-level-studio';

const { state, generateBackground, downloadZip } = useLevelStudio();

const selectedElements = computed(() =>
  state.elements.filter(el => el.selected && el.activeUrl)
);
</script>

<template>
  <div class="export-panel">
    <div class="section-header">
      <h3>📦 素材清单</h3>
      <p class="hint">所有素材已就绪，可以下载了</p>
    </div>

    <!-- 素材卡片网格 -->
    <div class="asset-grid">
      <!-- 场景图 -->
      <div v-if="state.selectedScene" class="asset-card scene-card">
        <img :src="state.selectedScene" alt="场景图" class="asset-img" />
        <div class="asset-label">🖼️ 场景图</div>
      </div>

      <!-- 各元素 -->
      <div
        v-for="(el, idx) in selectedElements"
        :key="idx"
        class="asset-card"
      >
        <img :src="el.activeUrl!" alt="元素" class="asset-img element-img" />
        <div class="asset-label">
          🧩 {{ el.name }}
          <NTag size="tiny" :type="el.mode === 'regen' ? 'success' : 'default'">
            {{ el.mode === 'regen' ? '重绘' : '裁切' }}
          </NTag>
        </div>
      </div>

      <!-- 背景图 -->
      <div v-if="state.bgUrl" class="asset-card scene-card">
        <img :src="state.bgUrl" alt="背景" class="asset-img" />
        <div class="asset-label">🌄 背景图</div>
      </div>
    </div>

    <!-- 背景生成 -->
    <div class="bg-section">
      <div class="section-label">🌄 生成背景图</div>
      <div class="bg-row">
        <NInput
          v-model:value="state.bgDescription"
          placeholder="背景描述（可选，留空则自动从场景提取）"
          size="small"
          style="flex: 1"
        />
        <NButton
          size="small"
          :loading="state.bgLoading"
          @click="generateBackground"
        >
          ✨ 生成
        </NButton>
      </div>
    </div>

    <!-- 下载 -->
    <div class="download-section">
      <NButton
        type="primary"
        size="large"
        :loading="state.downloadLoading"
        @click="downloadZip"
      >
        <template #icon><span>📦</span></template>
        下载 ZIP 压缩包
      </NButton>
      <span class="file-count">
        共 {{ 1 + selectedElements.length + (state.bgUrl ? 1 : 0) }} 个文件
      </span>
    </div>
  </div>
</template>

<style scoped>
.export-panel {
  max-width: 860px;
  margin: 0 auto;
}

.section-header {
  margin-bottom: 16px;
}

.section-header h3 {
  margin: 0 0 4px;
  font-size: 16px;
}

.hint {
  font-size: 13px;
  color: var(--n-text-color-3, #999);
  margin: 0;
}

/* 素材网格 */
.asset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.asset-card {
  border: 1px solid var(--n-border-color, #e5e5e5);
  border-radius: 10px;
  overflow: hidden;
  transition: box-shadow 0.2s;
}

.asset-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.scene-card {
  grid-column: span 2;
}

.asset-img {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  display: block;
  background: #f5f5f5;
}

.element-img {
  aspect-ratio: 1;
  object-fit: contain;
  background: #fafafa;
}

.asset-label {
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 4px;
}

/* 背景生成 */
.bg-section {
  padding: 14px;
  background: var(--n-color-modal, #f8f8f8);
  border-radius: 10px;
  margin-bottom: 16px;
}

.section-label {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
}

.bg-row {
  display: flex;
  gap: 8px;
}

/* 下载 */
.download-section {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px 0;
}

.file-count {
  font-size: 12px;
  color: var(--n-text-color-3, #999);
}
</style>
