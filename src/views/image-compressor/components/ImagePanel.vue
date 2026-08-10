<script setup lang="ts">
/**
 * 图片压缩面板（重构版）
 *
 * 顶部：header + 操作栏
 * 主体：拖拽上传 / 图片网格
 * 设置：NDrawer 抽屉承载压缩参数
 */
import { useI18n } from 'vue-i18n';
import { useImageCompressor, type ImageItem } from '../composables/use-image-compressor';
import CompareModal from './CompareModal.vue';
import { computed, ref } from 'vue';

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

/** 设置抽屉 */
const showSettings = ref(false);
const pendingCount = computed(() => images.value.filter(img => img.status === 'pending').length);
const compressingCount = computed(() => images.value.filter(img => img.status === 'compressing').length);
const errorCount = computed(() => images.value.filter(img => img.status === 'error').length);

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
  <div class="image-panel" :class="{ 'image-panel--empty': images.length === 0 }" @dragover.prevent @drop="handleDrop">
    <!-- 页面 Header -->
    <div v-if="images.length > 0" class="page-header">
      <div class="header-left">
        <h2 class="page-title">
          压缩队列
          <NTag type="primary" size="small" round>{{ engine === 'wasm' ? 'WASM' : 'Canvas' }}</NTag>
        </h2>
        <div class="status-line">
          <span>{{ images.length }} 张图片</span>
          <NTag v-if="pendingCount" size="small" round>{{ pendingCount }} 等待中</NTag>
          <NTag v-if="compressingCount" type="info" size="small" round>{{ compressingCount }} 压缩中</NTag>
          <NTag v-if="doneCount" type="success" size="small" round>{{ doneCount }} 已完成</NTag>
          <NTag v-if="errorCount" type="error" size="small" round>{{ errorCount }} 失败</NTag>
        </div>
      </div>
      <div class="header-actions">
        <NTooltip trigger="hover" placement="bottom">
          <template #trigger>
            <NButton quaternary circle @click="showSettings = true">
              <template #icon>
                <SvgIcon icon="mdi:cog-outline" />
              </template>
            </NButton>
          </template>
          压缩设置
        </NTooltip>
      </div>
    </div>

    <!-- 上传区域（空状态时大展示，有图片后缩小） -->
    <div
      class="upload-zone transition-all duration-300"
      :class="images.length === 0 ? 'upload-zone--empty' : 'upload-zone--compact'"
    >
      <NUpload
        :show-file-list="false"
        accept="image/*"
        :custom-request="() => {}"
        multiple
        @change="handleUpload"
      >
        <NUploadDragger>
          <div class="dragger-content">
            <div v-if="images.length === 0" class="dragger-empty">
              <span class="dragger-icon">
                <SvgIcon icon="mdi:image-multiple-outline" />
              </span>
              <NText class="empty-title">图片批量压缩</NText>
              <NText style="font-size: 16px; font-weight: 500">
                {{ t('page.imageCompressor.uploadTitle') }}
              </NText>
              <NText depth="3" class="mt-2" style="font-size: 13px">
                {{ t('page.imageCompressor.uploadDesc') }}
              </NText>
            </div>
            <div v-else class="dragger-compact">
              <SvgIcon icon="mdi:plus-box-outline" />
              <NText style="font-size: 13px">继续追加图片到队列</NText>
            </div>
          </div>
        </NUploadDragger>
      </NUpload>
    </div>

    <!-- 操作栏（有图片时显示） -->
    <div v-if="images.length > 0" class="action-bar">
      <div class="action-bar-left">
        <span class="action-bar-title">批量操作</span>
        <NTag size="small" round>已选择 {{ images.length }} 张</NTag>
        <NTag v-if="doneCount > 0" type="success" size="small" round>
          已完成: {{ doneCount }}
        </NTag>
        <template v-if="doneCount > 0">
          <NTag size="small" round>
            {{ formatSize(totalOriginalSize) }} → {{ formatSize(totalCompressedSize) }}
          </NTag>
          <NTag
            :type="totalCompressionRate > 0 ? 'success' : 'warning'"
            size="small"
            round
          >
            {{ totalCompressionRate > 0 ? '-' : '+' }}{{ Math.abs(totalCompressionRate).toFixed(1) }}%
          </NTag>
        </template>
      </div>
      <div class="action-bar-right">
        <NButton size="small" ghost @click="clearAll">清空列表</NButton>
        <NButton
          v-if="doneCount > 1"
          type="success"
          size="small"
          tertiary
          @click="downloadAllAsZip"
        >
          <template #icon>
              <SvgIcon icon="mdi:download-outline" />
          </template>
          ZIP 打包下载
        </NButton>
        <NButton
          type="primary"
          size="small"
          :loading="isCompressing"
          :disabled="images.length === 0"
          @click="compressAll"
        >
          <template #icon>
              <SvgIcon icon="mdi:play-outline" />
          </template>
          {{ t('page.imageCompressor.compressAll') }}
        </NButton>
      </div>
    </div>

    <!-- 图片网格 -->
    <div v-if="images.length > 0" class="image-grid">
      <div
        v-for="img in images"
        :key="img.id"
        class="image-card group"
        :class="{
          'image-card--done': img.status === 'done',
          'image-card--error': img.status === 'error',
          'image-card--processing': img.status === 'compressing'
        }"
      >
        <!-- 缩略图 -->
        <div class="thumb-container">
          <img
            :src="img.compressedUrl || img.originalUrl"
            :alt="img.file.name"
            class="thumb"
            :class="{ 'thumb--processing': img.status === 'compressing' || img.status === 'pending' }"
          />

          <!-- 状态角标 -->
          <NTag
            class="status-badge"
            :type="getStatusType(img.status)"
            size="tiny"
            round
          >
            {{ t(`page.imageCompressor.status.${img.status}`) }}
          </NTag>

          <!-- 处理中遮罩 -->
          <div v-if="img.status === 'compressing'" class="processing-overlay">
            <NSpin size="small" />
            <span class="processing-text">压缩中...</span>
          </div>

          <!-- 成功后的 hover 操作层 -->
          <div v-if="img.status === 'done'" class="hover-overlay">
            <NTooltip trigger="hover" placement="top">
              <template #trigger>
                <NButton circle type="primary" size="small" @click="openCompare(img)">
                  <template #icon>
                    <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5M12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5s5 2.24 5 5s-2.24 5-5 5m0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3s3-1.34 3-3s-1.34-3-3-3" />
                    </svg>
                  </template>
                </NButton>
              </template>
              {{ t('page.imageCompressor.compare') }}
            </NTooltip>
            <NTooltip trigger="hover" placement="top">
              <template #trigger>
                <NButton circle type="success" size="small" @click="downloadSingle(img)">
                  <template #icon>
                    <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7l7-7z" />
                    </svg>
                  </template>
                </NButton>
              </template>
              下载
            </NTooltip>
          </div>

          <!-- 右上角删除按钮 -->
          <div class="remove-btn">
            <NButton circle size="tiny" type="error" @click.stop="removeImage(img.id)">
              <template #icon>
                <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12z" />
                </svg>
              </template>
            </NButton>
          </div>
        </div>

        <!-- 文件名 + 大小信息 -->
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
      </div>
    </div>

    <!-- 设置抽屉 -->
    <NDrawer v-model:show="showSettings" :width="320" placement="right">
      <NDrawerContent title="⚙️ 压缩设置" closable>
        <NSpace vertical :size="20">
          <!-- 压缩引擎选择 -->
          <div class="setting-item">
            <NText class="setting-label">🔧 压缩引擎</NText>
            <NRadioGroup v-model:value="engine" size="small">
              <NRadioButton value="wasm">⚡ 高级 (WASM)</NRadioButton>
              <NRadioButton value="canvas">🚀 快速 (Canvas)</NRadioButton>
            </NRadioGroup>
            <NText depth="3" style="font-size: 11px; line-height: 1.4">
              {{ engine === 'wasm' ? 'MozJPEG / OxiPNG / WebP — 画质更好，压缩率更高' : 'Canvas API — 速度更快，体积稍大' }}
            </NText>
          </div>

          <NDivider style="margin: 0" />

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
              <NTag size="tiny" round type="primary">{{ Math.round(options.quality * 100) }}%</NTag>
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
      </NDrawerContent>
    </NDrawer>

    <!-- 对比弹窗 -->
    <CompareModal
      v-model:visible="compareVisible"
      :item="compareItem"
    />
  </div>
</template>

<style scoped>
.image-panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 14px;
  overflow: hidden;
  padding: 20px 24px;
  border-radius: 10px;
  background:
    linear-gradient(135deg, rgba(37, 99, 235, 0.06), transparent 32%),
    linear-gradient(315deg, rgba(15, 118, 110, 0.05), transparent 38%);
}

.image-panel--empty {
  justify-content: center;
}

/* ---- Page Header ---- */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 18px;
  flex-shrink: 0;
}

.page-title {
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 4px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
  color: var(--n-text-color-2);
  font-size: 13px;
}

.header-actions {
  display: flex;
  flex-shrink: 0;
}

/* ---- Upload Zone ---- */
.upload-zone :deep(.n-upload-dragger) {
  background: var(--n-color-modal);
  border-radius: 12px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.upload-zone :deep(.n-upload-dragger:hover) {
  border-color: var(--primary-color);
}

.upload-zone--empty {
  width: min(720px, 100%);
  margin: 0 auto;
}

.upload-zone--empty :deep(.n-upload-dragger) {
  padding: 52px 24px;
}

.upload-zone--compact :deep(.n-upload-dragger) {
  padding: 10px 16px;
}

.dragger-content {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.dragger-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 8px;
}

.dragger-icon {
  width: 56px;
  height: 56px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  color: #2563eb;
  background: rgba(37, 99, 235, 0.1);
  transition: transform 0.3s;
}

.dragger-icon :deep(svg) {
  width: 30px;
  height: 30px;
}

.empty-title {
  color: var(--n-text-color);
  font-size: 30px;
  font-weight: 700;
  line-height: 1.2;
}

.upload-zone :deep(.n-upload-dragger:hover) .dragger-icon {
  transform: translateY(-5px) scale(1.1);
}

.dragger-compact {
  display: flex;
  align-items: center;
  gap: 8px;
  opacity: 0.7;
}

.dragger-compact :deep(svg) {
  width: 18px;
  height: 18px;
  color: #2563eb;
}

/* ---- Action Bar ---- */
.action-bar {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-radius: 12px;
  border: 1px solid var(--n-border-color, #e0e0e6);
  background: var(--n-color-modal, #f9f9fb);
  gap: 12px;
  flex-shrink: 0;
}

.dark .action-bar {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.08);
}

.action-bar-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.action-bar-title {
  font-size: 14px;
  font-weight: 600;
}

.action-bar-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* ---- Image Grid ---- */
.image-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  grid-auto-rows: max-content;
  align-content: start;
  align-items: start;
  gap: 14px;
  overflow-y: auto;
  padding: 2px 2px 18px;
}

.image-card {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid var(--n-border-color, #e0e0e6);
  background: var(--n-color, #fff);
  transition: box-shadow 0.3s ease, transform 0.2s ease, border-color 0.3s ease;
}

.dark .image-card {
  background: rgba(255, 255, 255, 0.03);
  border-color: rgba(255, 255, 255, 0.08);
}

.image-card:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
}

.dark .image-card:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

.image-card--done {
  border-color: rgba(24, 160, 88, 0.4);
}

.image-card--error {
  border-color: rgba(208, 48, 80, 0.4);
}

.image-card--processing {
  border-color: rgba(32, 128, 240, 0.4);
}

/* ---- Thumbnail ---- */
.thumb-container {
  position: relative;
  width: 100%;
  height: clamp(150px, 11vw, 210px);
  overflow: hidden;
  background: repeating-conic-gradient(#f0f0f4 0% 25%, transparent 0% 50%) 50% / 16px 16px;
}

.dark .thumb-container {
  background: repeating-conic-gradient(#2a2a3e 0% 25%, #1e1e2e 0% 50%) 50% / 16px 16px;
}

.thumb {
  width: 100%;
  height: 100%;
  object-fit: contain;
  transition: opacity 0.3s, filter 0.3s;
}

.thumb--processing {
  opacity: 0.4;
  filter: blur(1px);
}

.status-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 2;
}

/* ---- Processing Overlay ---- */
.processing-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(2px);
  z-index: 1;
}

.processing-text {
  font-size: 12px;
  font-weight: 600;
  opacity: 0.8;
}

/* ---- Hover Overlay ---- */
.hover-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
  opacity: 0;
  transition: opacity 0.3s ease;
  z-index: 1;
}

.image-card:hover .hover-overlay {
  opacity: 1;
}

/* ---- Remove Button ---- */
.remove-btn {
  position: absolute;
  top: 6px;
  right: 6px;
  opacity: 0;
  transition: opacity 0.2s;
  z-index: 3;
}

.image-card:hover .remove-btn {
  opacity: 1;
}

/* ---- Image Info ---- */
.image-info {
  padding: 10px 12px 10px;
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
  margin-top: 4px;
  flex-wrap: wrap;
}

.arrow {
  color: var(--n-text-color-3);
  font-size: 12px;
}

/* ---- Settings Drawer ---- */
.setting-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.setting-label {
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
}

/* ---- Responsive ---- */
@media (max-width: 640px) {
  .image-panel {
    padding: 16px;
    overflow-y: auto;
  }

  .image-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    overflow: visible;
  }

  .action-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .action-bar-right {
    justify-content: flex-end;
  }
}
</style>
