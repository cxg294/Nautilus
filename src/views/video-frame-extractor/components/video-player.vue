<script setup lang="ts">
/**
 * 视频播放器组件 — 紧凑版
 *
 * 包含拖拽上传区和 HTML5 视频播放器，视频高度限制以保证控件在首屏可见。
 */
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { VideoInfo } from '../composables/use-frame-extractor';

const { t } = useI18n();

interface Props {
  /** 视频 URL */
  videoUrl: string;
  /** 视频信息 */
  videoInfo: VideoInfo | null;
}

const _props = defineProps<Props>();

const emit = defineEmits<{
  /** 视频文件选择完成 */
  fileSelect: [file: File];
  /** video 元素就绪 */
  videoReady: [el: HTMLVideoElement];
}>();

const videoRef = ref<HTMLVideoElement | null>(null);
const isDragOver = ref(false);
const fileInputRef = ref<HTMLInputElement | null>(null);

/** 处理文件上传 */
function handleFileInput(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file && file.type.startsWith('video/')) {
    emit('fileSelect', file);
  }
  // 重置 input 以支持重复选择同一文件
  if (input) input.value = '';
}

/** 点击选择文件 */
function triggerFileSelect() {
  fileInputRef.value?.click();
}

/** 拖拽事件 */
function handleDragOver(e: DragEvent) {
  e.preventDefault();
  isDragOver.value = true;
}
function handleDragLeave() {
  isDragOver.value = false;
}
function handleDrop(e: DragEvent) {
  e.preventDefault();
  isDragOver.value = false;
  const file = e.dataTransfer?.files[0];
  if (file && file.type.startsWith('video/')) {
    emit('fileSelect', file);
  }
}

/** video 元素加载完成回调 */
function onVideoLoad() {
  if (videoRef.value) {
    emit('videoReady', videoRef.value);
  }
}

/** 格式化文件大小 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** 格式化时长 */
function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

defineExpose({ videoRef });
</script>

<template>
  <div class="video-player">
    <!-- 隐藏的文件输入 -->
    <input
      ref="fileInputRef"
      type="file"
      accept="video/*"
      style="display: none"
      @change="handleFileInput"
    />

    <!-- 无视频时：拖拽上传区 -->
    <div
      v-if="!videoUrl"
      class="upload-zone"
      :class="{ 'drag-over': isDragOver }"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
      @click="triggerFileSelect"
    >
      <div class="upload-content">
        <div class="upload-icon">
          <NIcon size="40">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path fill="currentColor" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11zM8 15.01l1.41 1.41L11 14.84V19h2v-4.16l1.59 1.59L16 15.01L12.01 11L8 15.01z" />
            </svg>
          </NIcon>
        </div>
        <p class="upload-title">{{ t('page.videoFrameExtractor.uploadTitle') }}</p>
        <p class="upload-desc">{{ t('page.videoFrameExtractor.uploadDesc') }}</p>
      </div>
    </div>

    <!-- 有视频时：播放器 + 信息栏 -->
    <div v-else class="player-wrapper">
      <video
        ref="videoRef"
        :src="videoUrl"
        controls
        preload="auto"
        class="video-element"
        @loadedmetadata="onVideoLoad"
      />

      <!-- 视频信息 + 更换视频（同行显示） -->
      <div v-if="videoInfo" class="video-meta-bar">
        <div class="meta-tags">
          <NTag type="info" size="small">
            {{ videoInfo.width }} × {{ videoInfo.height }}
          </NTag>
          <NTag type="success" size="small">
            {{ formatDuration(videoInfo.duration) }}
          </NTag>
          <NTag size="small">
            {{ formatFileSize(videoInfo.fileSize) }}
          </NTag>
          <NTag type="warning" size="small" class="file-name-tag">
            {{ videoInfo.fileName }}
          </NTag>
        </div>
        <NButton size="small" type="warning" secondary @click="triggerFileSelect">
          {{ t('page.videoFrameExtractor.changeVideo') }}
        </NButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.video-player {
  width: 100%;
}

.upload-zone {
  border: 2px dashed var(--n-border-color, rgba(255, 255, 255, 0.15));
  border-radius: 12px;
  padding: 40px 20px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background: rgba(255, 255, 255, 0.02);
}

.upload-zone:hover,
.upload-zone.drag-over {
  border-color: var(--n-color-target, var(--primary-color, #63e2b7));
  background: rgba(99, 226, 183, 0.04);
}

.upload-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.upload-icon {
  color: var(--n-text-color-3, rgba(255, 255, 255, 0.3));
  transition: color 0.3s;
}

.upload-zone:hover .upload-icon {
  color: var(--primary-color, #63e2b7);
}

.upload-title {
  font-size: 14px;
  font-weight: 500;
  margin: 0;
}

.upload-desc {
  font-size: 12px;
  color: var(--n-text-color-3, rgba(255, 255, 255, 0.38));
  margin: 0;
}

.player-wrapper {
  position: relative;
}

.video-element {
  width: 100%;
  border-radius: 8px;
  display: block;
  background: #000;
  max-height: 320px;
  object-fit: contain;
}

.video-meta-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
  gap: 8px;
  flex-wrap: wrap;
}

.meta-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  align-items: center;
}

.file-name-tag {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
