<script setup lang="ts">
/**
 * 图片压缩面板
 *
 * 左侧：压缩参数设置 + 操作按钮
 * 右侧：图片网格列表（缩略图 + 状态 + 大小对比）
 */
import { useI18n } from 'vue-i18n';
import { useImageCompressor, type ImageItem } from '../composables/use-image-compressor';
import CompareModal from './CompareModal.vue';
import { ref } from 'vue';

const { t } = useI18n();
const {
  images,
  options,
  engine,
  isCompressing,
  totalOriginalSize,
  totalCompressedSize,
  totalCompressionRate,
  doneCount,
  allDone,
  addImages,
  compressAll,
  downloadSingle,
  downloadAllAsZip,
  removeImage,
  clearAll
} = useImageCompressor();

/** 对比弹窗 */
const compareVisible = ref(false);
const compareItem = ref<ImageItem | null>(null);

/** 处理文件上传 */
function handleUpload(opts: { file: { file: File | null } }) {
  const file = opts.file.file;
  if (file) addImages([file]);
}

/** 处理拖拽上传 */
function handleDrop(e: DragEvent) {
  e.preventDefault();
  const files = Array.from(e.dataTransfer?.files || []);
  addImages(files);
}

/** 打开对比弹窗 */
function openCompare(item: ImageItem) {
  compareItem.value = item;
  compareVisible.value = true;
}

/** 格式化文件大小 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/** 获取状态标签类型 */
function getStatusType(status: string): 'default' | 'info' | 'success' | 'error' {
  const map: Record<string, 'default' | 'info' | 'success' | 'error'> = {
    pending: 'default',
    compressing: 'info',
    done: 'success',
    error: 'error'
  };
  return map[status] || 'default';
}
</script>

<template>
  <div class="image-panel" @dragover.prevent @drop="handleDrop">
    <div class="panel-layout">
      <!-- 左侧：设置面板 -->
      <div class="settings-panel">
        <NCard :bordered="false" size="small">
          <template #header>
            <div class="card-header">
              <span>⚙️ {{ t('page.imageCompressor.settings') }}</span>
            </div>
          </template>

          <NSpace vertical :size="16">
            <!-- 压缩引擎选择 -->
            <div class="setting-item">
              <NText class="setting-label">🔧 压缩引擎</NText>
              <NRadioGroup v-model:value="engine" size="small">
                <NRadioButton value="wasm">
                  ⚡ 高级 (WASM)
                </NRadioButton>
                <NRadioButton value="canvas">
                  🚀 快速 (Canvas)
                </NRadioButton>
              </NRadioGroup>
              <NText depth="3" style="font-size: 11px; line-height: 1.3">
                {{ engine === 'wasm' ? 'MozJPEG / OxiPNG / WebP — 画质更好，压缩率更高' : 'Canvas API — 速度更快，体积稍大' }}
              </NText>
            </div>

            <!-- 最大宽度 -->
            <div class="setting-item">
              <NText class="setting-label">{{ t('page.imageCompressor.maxWidth') }}</NText>
              <NInputNumber
                v-model:value="options.maxWidth"
                :min="100"
                :max="8192"
                :step="100"
                size="small"
              />
            </div>

            <!-- 最大高度 -->
            <div class="setting-item">
              <NText class="setting-label">{{ t('page.imageCompressor.maxHeight') }}</NText>
              <NInputNumber
                v-model:value="options.maxHeight"
                :min="100"
                :max="8192"
                :step="100"
                size="small"
              />
            </div>

            <!-- 图片质量 -->
            <div class="setting-item">
              <NText class="setting-label">
                {{ t('page.imageCompressor.quality') }}
                <NTag size="tiny" round>{{ Math.round(options.quality * 100) }}%</NTag>
              </NText>
              <NSlider
                v-model:value="options.quality"
                :min="0.1"
                :max="1"
                :step="0.05"
                :tooltip="true"
                :format-tooltip="(v: number) => `${Math.round(v * 100)}%`"
              />
            </div>

            <!-- 输出格式 -->
            <div class="setting-item">
              <NText class="setting-label">{{ t('page.imageCompressor.outputFormat') }}</NText>
              <NSelect
                v-model:value="options.outputFormat"
                size="small"
                :options="[
                  { label: t('page.imageCompressor.keepOriginal'), value: 'auto' },
                  { label: 'JPEG', value: 'image/jpeg' },
                  { label: 'PNG', value: 'image/png' },
                  { label: 'WebP', value: 'image/webp' }
                ]"
              />
            </div>
          </NSpace>

          <!-- 操作按钮 -->
          <NSpace vertical :size="8" class="action-buttons">
            <NUpload
              :show-file-list="false"
              accept="image/*"
              :custom-request="() => {}"
              multiple
              @change="handleUpload"
            >
              <NButton block type="primary" ghost>
                📁 {{ t('page.imageCompressor.uploadImages') }}
              </NButton>
            </NUpload>

            <NButton
              block
              type="primary"
              :loading="isCompressing"
              :disabled="images.length === 0"
              @click="compressAll"
            >
              🚀 {{ t('page.imageCompressor.compressAll') }}
            </NButton>

            <NButton
              block
              type="success"
              :disabled="doneCount === 0"
              @click="downloadAllAsZip"
            >
              📦 {{ t('page.imageCompressor.downloadZip') }}
            </NButton>

            <NButton
              block
              quaternary
              type="error"
              :disabled="images.length === 0"
              @click="clearAll"
            >
              🗑️ {{ t('page.imageCompressor.clearAll') }}
            </NButton>
          </NSpace>

          <!-- 统计信息 -->
          <div v-if="images.length > 0" class="stats-section">
            <NDivider />
            <NStatistic :label="t('page.imageCompressor.originalSize')" :value="formatSize(totalOriginalSize)" />
            <NStatistic
              v-if="doneCount > 0"
              :label="t('page.imageCompressor.compressedSize')"
              :value="formatSize(totalCompressedSize)"
            />
            <NStatistic
              v-if="doneCount > 0"
              :label="t('page.imageCompressor.compressionRate')"
            >
              <NText :type="totalCompressionRate > 0 ? 'success' : 'warning'">
                {{ totalCompressionRate > 0 ? '-' : '+' }}{{ Math.abs(totalCompressionRate).toFixed(1) }}%
              </NText>
            </NStatistic>
          </div>
        </NCard>
      </div>

      <!-- 右侧：图片列表 -->
      <div class="images-panel">
        <!-- 空状态 -->
        <div v-if="images.length === 0" class="empty-state">
          <div class="empty-icon">🖼️</div>
          <NH4 style="margin: 0">{{ t('page.imageCompressor.uploadTitle') }}</NH4>
          <NText depth="3" style="font-size: 13px">{{ t('page.imageCompressor.uploadDesc') }}</NText>
          <NUpload
            :show-file-list="false"
            accept="image/*"
            :custom-request="() => {}"
            multiple
            @change="handleUpload"
            style="margin-top: 16px"
          >
            <NButton type="primary">📁 {{ t('page.imageCompressor.uploadImages') }}</NButton>
          </NUpload>
        </div>

        <!-- 图片网格 -->
        <div v-else class="image-grid">
          <div
            v-for="img in images"
            :key="img.id"
            class="image-card"
          >
            <!-- 缩略图 -->
            <div class="thumb-container">
              <img
                :src="img.compressedUrl || img.originalUrl"
                :alt="img.file.name"
                class="thumb"
              />
              <NTag
                class="status-badge"
                :type="getStatusType(img.status)"
                size="tiny"
                round
              >
                {{ t(`page.imageCompressor.status.${img.status}`) }}
              </NTag>
            </div>

            <!-- 文件信息 -->
            <div class="image-info">
              <NText class="file-name" :title="img.file.name">{{ img.file.name }}</NText>
              <div class="size-info">
                <NText depth="3" style="font-size: 12px">{{ formatSize(img.originalSize) }}</NText>
                <template v-if="img.status === 'done'">
                  <span class="arrow">→</span>
                  <NText type="success" style="font-size: 12px; font-weight: 600">
                    {{ formatSize(img.compressedSize) }}
                  </NText>
                  <NText
                    :type="img.compressedSize < img.originalSize ? 'success' : 'warning'"
                    style="font-size: 11px"
                  >
                    ({{ img.compressedSize < img.originalSize ? '-' : '+' }}{{ Math.abs(((img.originalSize - img.compressedSize) / img.originalSize) * 100).toFixed(1) }}%)
                  </NText>
                </template>
              </div>
            </div>

            <!-- 操作按钮 -->
            <div class="image-actions">
              <NButton
                v-if="img.status === 'done'"
                size="tiny"
                quaternary
                type="info"
                @click="openCompare(img)"
              >
                {{ t('page.imageCompressor.compare') }}
              </NButton>
              <NButton
                v-if="img.status === 'done'"
                size="tiny"
                quaternary
                type="success"
                @click="downloadSingle(img)"
              >
                ↓
              </NButton>
              <NButton
                size="tiny"
                quaternary
                type="error"
                @click="removeImage(img.id)"
              >
                ✕
              </NButton>
            </div>

            <!-- 压缩中的进度条 -->
            <NProgress
              v-if="img.status === 'compressing'"
              type="line"
              :percentage="50"
              :show-indicator="false"
              status="info"
              class="compress-progress"
              processing
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 对比弹窗 -->
    <CompareModal
      v-model:visible="compareVisible"
      :item="compareItem"
    />
  </div>
</template>

<style scoped>
.image-panel {
  height: 100%;
  overflow: hidden;
}

.panel-layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 16px;
  height: 100%;
  min-height: 0;
}

.settings-panel {
  overflow-y: auto;
}

.images-panel {
  overflow-y: auto;
  min-height: 0;
}

.card-header {
  font-size: 15px;
  font-weight: 600;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.setting-label {
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
}

.action-buttons {
  margin-top: 20px;
}

.stats-section {
  margin-top: 4px;
}

.stats-section :deep(.n-statistic) {
  margin-bottom: 8px;
}

.stats-section :deep(.n-statistic .n-statistic__label) {
  font-size: 12px;
}

.stats-section :deep(.n-statistic .n-statistic-value__content) {
  font-size: 16px;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  text-align: center;
  border: 2px dashed var(--n-border-color, #e0e0e6);
  border-radius: 12px;
  padding: 40px;
  transition: border-color 0.3s;
}

.empty-state:hover {
  border-color: var(--n-primary-color, #18a058);
}

.empty-icon {
  font-size: 56px;
  margin-bottom: 12px;
}

/* 图片网格 */
.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
  padding-bottom: 16px;
}

.image-card {
  border: 1px solid var(--n-border-color, #e0e0e6);
  border-radius: 10px;
  overflow: hidden;
  background: var(--n-color, #fff);
  transition: box-shadow 0.2s, transform 0.2s;
  position: relative;
}

.image-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.thumb-container {
  position: relative;
  width: 100%;
  height: 140px;
  overflow: hidden;
  background: repeating-conic-gradient(#f0f0f4 0% 25%, transparent 0% 50%) 50% / 16px 16px;
}

.thumb {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.status-badge {
  position: absolute;
  top: 6px;
  right: 6px;
}

.image-info {
  padding: 8px 10px 4px;
}

.file-name {
  font-size: 12px;
  font-weight: 500;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.size-info {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
  flex-wrap: wrap;
}

.arrow {
  color: var(--n-text-color-3);
  font-size: 12px;
}

.image-actions {
  display: flex;
  justify-content: flex-end;
  padding: 2px 6px 6px;
  gap: 2px;
}

.compress-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
}

/* 响应式 */
@media (max-width: 768px) {
  .panel-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }
}
</style>
