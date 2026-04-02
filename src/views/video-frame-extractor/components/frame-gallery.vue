<script setup lang="ts">
/**
 * 帧预览画廊组件
 *
 * 展示已抽取的帧缩略图，支持选中、大图预览、单图下载和批量操作。
 */
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { FrameData } from '../composables/use-frame-extractor';

const { t } = useI18n();

interface Props {
  /** 帧数据列表 */
  frames: FrameData[];
  /** 选中帧数量 */
  selectedCount: number;
  /** 是否全选 */
  allSelected: boolean;
  /** 正在抽帧中 */
  isExtracting: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  /** 切换帧选中 */
  toggleSelect: [id: string];
  /** 全选 */
  selectAll: [];
  /** 取消全选 */
  deselectAll: [];
  /** 反选 */
  invertSelection: [];
  /** 删除选中 */
  deleteSelected: [];
  /** 删除单帧 */
  deleteFrame: [id: string];
  /** 导出 ZIP */
  exportZip: [];
  /** 下载单图 */
  downloadFrame: [frame: FrameData];
}>();

/** 当前预览大图的 URL */
const previewVisible = ref(false);
const previewUrl = ref('');
const previewIndex = ref(0);

/** 预览图片列表（用于图片组导航） */
const _previewList = computed(() => props.frames.map(f => f.dataUrl));

/** 打开大图预览 */
function openPreview(index: number) {
  previewIndex.value = index;
  previewUrl.value = props.frames[index].dataUrl;
  previewVisible.value = true;
}

/** 格式化时间戳 */
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
}
</script>

<template>
  <div class="frame-gallery">
    <!-- 工具栏 -->
    <div class="gallery-toolbar">
      <div class="toolbar-left">
        <NSpace :size="8" align="center">
          <NCheckbox
            :checked="allSelected"
            :indeterminate="selectedCount > 0 && !allSelected"
            @update:checked="allSelected ? emit('deselectAll') : emit('selectAll')"
          >
            {{ t('common.selectAll') }}
          </NCheckbox>
          <NButton size="tiny" quaternary @click="emit('invertSelection')">
            {{ t('page.videoFrameExtractor.invertSelect') }}
          </NButton>
          <NTag v-if="selectedCount > 0" type="info" size="small" round>
            {{ selectedCount }} / {{ frames.length }}
          </NTag>
        </NSpace>
      </div>
      <div class="toolbar-right">
        <NSpace :size="6">
          <NButton
            size="small"
            type="error"
            secondary
            :disabled="selectedCount === 0"
            @click="emit('deleteSelected')"
          >
            {{ t('common.delete') }}
          </NButton>
          <NButton
            size="small"
            type="primary"
            :disabled="selectedCount === 0"
            @click="emit('exportZip')"
          >
            {{ t('page.videoFrameExtractor.exportZip') }}
          </NButton>
        </NSpace>
      </div>
    </div>

    <!-- 帧网格 -->
    <div v-if="frames.length > 0" class="frame-grid">
      <div
        v-for="(frame, index) in frames"
        :key="frame.id"
        class="frame-item"
        :class="{ selected: frame.selected }"
      >
        <!-- 选择框 -->
        <div class="frame-checkbox">
          <NCheckbox
            :checked="frame.selected"
            @update:checked="emit('toggleSelect', frame.id)"
          />
        </div>

        <!-- 缩略图 -->
        <div class="frame-thumb" @click="openPreview(index)">
          <img :src="frame.thumbUrl" :alt="`Frame ${index + 1}`" loading="lazy" />
          <div class="frame-overlay">
            <NIcon size="24">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path fill="currentColor" d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5A6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5S14 7.01 14 9.5S11.99 14 9.5 14z" />
              </svg>
            </NIcon>
          </div>
        </div>

        <!-- 帧信息 -->
        <div class="frame-info">
          <span class="frame-index">#{{ index + 1 }}</span>
          <span class="frame-time">{{ formatTime(frame.timestamp) }}</span>
        </div>

        <!-- 操作按钮 -->
        <div class="frame-actions">
          <NButton size="tiny" quaternary circle @click="emit('downloadFrame', frame)">
            <template #icon>
              <NIcon>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7l7-7z" />
                </svg>
              </NIcon>
            </template>
          </NButton>
          <NButton size="tiny" quaternary circle @click="emit('deleteFrame', frame.id)">
            <template #icon>
              <NIcon>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41z" />
                </svg>
              </NIcon>
            </template>
          </NButton>
        </div>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <NEmpty :description="t('page.videoFrameExtractor.noFrames')" />
    </div>

    <!-- 大图预览 — 使用 NImageGroup -->
    <NModal
      v-model:show="previewVisible"
      :mask-closable="true"
      preset="card"
      :bordered="false"
      size="huge"
      class="preview-modal"
      :title="`${t('page.videoFrameExtractor.preview')} #${previewIndex + 1}`"
      style="width: 90vw; max-width: 1200px;"
    >
      <div class="preview-container">
        <img
          :src="frames[previewIndex]?.dataUrl"
          class="preview-image"
          :alt="`Frame ${previewIndex + 1}`"
        />
      </div>
      <div class="preview-nav">
        <NButton
          :disabled="previewIndex <= 0"
          @click="previewIndex--"
        >
          ← {{ t('page.videoFrameExtractor.prevFrame') }}
        </NButton>
        <span class="preview-counter">
          {{ previewIndex + 1 }} / {{ frames.length }}
        </span>
        <NButton
          :disabled="previewIndex >= frames.length - 1"
          @click="previewIndex++"
        >
          {{ t('page.videoFrameExtractor.nextFrame') }} →
        </NButton>
      </div>
    </NModal>
  </div>
</template>

<style scoped>
.frame-gallery {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.gallery-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 4px;
  margin-bottom: 8px;
  flex-wrap: wrap;
  gap: 8px;
}

.frame-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 10px;
  overflow-y: auto;
  flex: 1;
  padding: 4px;
}

.frame-item {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
  border: 2px solid transparent;
  transition: all 0.2s ease;
  background: rgba(255, 255, 255, 0.03);
}

.frame-item:hover {
  border-color: rgba(255, 255, 255, 0.15);
}

.frame-item.selected {
  border-color: var(--primary-color, #63e2b7);
  box-shadow: 0 0 0 1px var(--primary-color, #63e2b7);
}

.frame-checkbox {
  position: absolute;
  top: 4px;
  left: 4px;
  z-index: 5;
}

.frame-thumb {
  position: relative;
  cursor: pointer;
  aspect-ratio: 16 / 9;
  overflow: hidden;
}

.frame-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.frame-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  opacity: 0;
  transition: opacity 0.2s;
  color: white;
}

.frame-thumb:hover .frame-overlay {
  opacity: 1;
}

.frame-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 8px;
  font-size: 11px;
}

.frame-index {
  font-weight: 600;
  color: var(--primary-color, #63e2b7);
}

.frame-time {
  color: var(--n-text-color-3, rgba(255, 255, 255, 0.38));
  font-family: 'Courier New', monospace;
}

.frame-actions {
  display: flex;
  justify-content: flex-end;
  padding: 0 4px 4px;
  gap: 2px;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 200px;
}

.preview-container {
  display: flex;
  justify-content: center;
  align-items: center;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
}

.preview-image {
  max-width: 100%;
  max-height: 70vh;
  object-fit: contain;
}

.preview-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 16px;
}

.preview-counter {
  font-size: 14px;
  color: var(--n-text-color-2, rgba(255, 255, 255, 0.6));
  font-weight: 500;
}
</style>
