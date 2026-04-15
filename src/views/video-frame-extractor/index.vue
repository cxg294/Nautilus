<script setup lang="ts">
/**
 * 视频抽帧工具 — 主页面
 *
 * 优化布局：
 * - 左侧（55%）：视频播放器（限高）+ 抽帧控制面板（紧凑）
 * - 右侧（45%）：帧预览画廊（全高可滚动）
 * - 所有关键操作保持在首屏可见
 */
import { useI18n } from 'vue-i18n';
import VideoPlayer from './components/video-player.vue';
import ExtractControls from './components/extract-controls.vue';
import FrameGallery from './components/frame-gallery.vue';
import { useFrameExtractor } from './composables/use-frame-extractor';
import { usePageTracker, useActionTracker } from '@/hooks/common/use-tracker';

usePageTracker('video-frame-extractor');
const { trackAction } = useActionTracker('video-frame-extractor');

const { t } = useI18n();

const {
  videoUrl,
  videoInfo,
  frames,
  isExtracting,
  extractProgress,
  outputFormat,
  outputQuality,
  selectedCount,
  allSelected,
  setVideoElement,
  loadVideo,
  extractByCount,
  extractByInterval,
  captureCurrentFrame,
  exportAsZip,
  downloadSingleFrame,
  toggleFrameSelect,
  selectAll,
  deselectAll,
  invertSelection,
  deleteSelected,
  deleteFrame,
} = useFrameExtractor();

/** 处理视频文件选择 */
async function handleFileSelect(file: File) {
  try {
    await loadVideo(file);
  } catch (err) {
    console.error('视频加载失败:', err);
    window.$message?.error(String(err));
  }
}

/** 处理 video 元素就绪 */
function handleVideoReady(el: HTMLVideoElement) {
  setVideoElement(el);
}
</script>

<template>
  <div class="video-frame-extractor">
    <div class="main-layout">
      <!-- 左侧面板：视频 + 控制 -->
      <div class="left-panel">
        <!-- 视频播放器卡片（限制高度） -->
        <NCard :bordered="false" class="card-wrapper player-card" size="small">
          <template #header>
            <div class="panel-header">
              <span>{{ t('page.videoFrameExtractor.videoPlayer') }}</span>
            </div>
          </template>
          <VideoPlayer
            :video-url="videoUrl"
            :video-info="videoInfo"
            @file-select="handleFileSelect"
            @video-ready="handleVideoReady"
          />
        </NCard>

        <!-- 抽帧控制（紧凑布局，始终可见） -->
        <ExtractControls
          v-model:output-format="outputFormat"
          v-model:output-quality="outputQuality"
          :has-video="!!videoInfo"
          :is-extracting="isExtracting"
          :extract-progress="extractProgress"
          :video-duration="videoInfo?.duration || 0"
          @extract-by-count="extractByCount"
          @extract-by-interval="extractByInterval"
          @capture-frame="captureCurrentFrame"
        />
      </div>

      <!-- 右侧面板：帧画廊 -->
      <div class="right-panel">
        <NCard :bordered="false" class="card-wrapper gallery-card" size="small">
          <template #header>
            <div class="panel-header">
              <span>{{ t('page.videoFrameExtractor.frameGallery') }}</span>
              <NTag v-if="frames.length > 0" type="info" size="small" round>
                {{ frames.length }}
              </NTag>
            </div>
          </template>
          <FrameGallery
            :frames="frames"
            :selected-count="selectedCount"
            :all-selected="allSelected"
            :is-extracting="isExtracting"
            @toggle-select="toggleFrameSelect"
            @select-all="selectAll"
            @deselect-all="deselectAll"
            @invert-selection="invertSelection"
            @delete-selected="deleteSelected"
            @delete-frame="deleteFrame"
            @export-zip="exportAsZip()"
            @download-frame="downloadSingleFrame"
          />
        </NCard>
      </div>
    </div>
  </div>
</template>

<style scoped>
.video-frame-extractor {
  height: 100%;
  overflow: hidden;
}

.main-layout {
  display: grid;
  grid-template-columns: 55% 45%;
  gap: 16px;
  height: 100%;
  min-height: 0;
}

.left-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  overflow-y: auto;
}

.right-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.player-card {
  flex-shrink: 0;
}

.gallery-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.gallery-card :deep(.n-card__content) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
}

/* 响应式：小屏幕变为上下布局 */
@media (max-width: 1024px) {
  .main-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }
}
</style>
