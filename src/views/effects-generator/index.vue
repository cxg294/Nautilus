<script setup lang="ts">
/**
 * 特效生成器 — 主页面
 * 支持双模式：点击爆发特效 + 背景氛围特效
 * 支持 GIF 录制与区域选取导出
 */
import { ref, onMounted, onUnmounted } from 'vue';
import { useI18n } from 'vue-i18n';
import { NCard, useMessage } from 'naive-ui';
import { useEffects } from './composables/use-effects';
import { useGifRecorder, type CropRegion } from './composables/use-gif-recorder';
import PresetList from './components/preset-list.vue';
import ParamsPanel from './components/params-panel.vue';
import PreviewCanvas from './components/preview-canvas.vue';
import CropOverlay from './components/crop-overlay.vue';
import RecordingPanel from './components/recording-panel.vue';

const { t } = useI18n();
const message = useMessage();

const {
  activePresetKey,
  activePreset,
  isBurstMode,
  isPlaying,
  params,
  customImageUrl,
  mergedOptions,
  activeBurstConfig,
  selectPreset,
  togglePlay,
  resetParams,
  setCustomImage,
  getConfigJson,
  generateStandaloneHtml
} = useEffects();

// ============================================================
// GIF 录制
// ============================================================

const recorder = useGifRecorder();
const previewCanvasRef = ref<InstanceType<typeof PreviewCanvas> | null>(null);

/** 预览区尺寸（像素） */
const previewSize = ref({ width: 800, height: 600 });

/** 预览区容器引用，用于全屏和尺寸监听 */
const previewRef = ref<HTMLElement | null>(null);
const isFullscreen = ref(false);

/** 监听预览区尺寸变化 */
let resizeObserver: ResizeObserver | null = null;

onMounted(() => {
  if (previewRef.value) {
    resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        previewSize.value = {
          width: Math.round(entry.contentRect.width),
          height: Math.round(entry.contentRect.height)
        };
      }
    });
    resizeObserver.observe(previewRef.value);
  }
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  recorder.cleanup();
});

/** 进入区域选取模式 */
function handleEnterSelect() {
  recorder.enterSelectMode();
}

/** 区域选取确认 */
function handleCropConfirm() {
  // region 已在 CropOverlay 的 update:region 事件中同步
}

/** 区域选取更新 */
function handleCropUpdate(region: CropRegion) {
  recorder.setCropRegion(region);
}

/** 全选画布 */
function handleSelectAll() {
  const canvas = previewCanvasRef.value?.getActiveCanvas();
  if (canvas) {
    recorder.selectFullCanvas(canvas);
  } else {
    // 回退到预览区尺寸
    recorder.setCropRegion({
      x: 0, y: 0,
      width: previewSize.value.width,
      height: previewSize.value.height
    });
  }
}

/** 取消区域选取 */
function handleCropCancel() {
  recorder.cleanup();
}

/** 开始录制 */
function handleStartRecording() {
  const canvas = previewCanvasRef.value?.getActiveCanvas();
  if (!canvas) {
    message.error('无法获取画布元素');
    return;
  }
  recorder.startRecording(canvas);
  message.info(t('page.effectsGenerator.recording.stateRecording') + '...');
}

/** 停止录制 */
function handleStopRecording() {
  recorder.stopRecording();
}

/** 取消录制 */
function handleCancelRecording() {
  recorder.cancelRecording();
}

/** 下载 GIF */
function handleDownloadGif() {
  recorder.downloadGif(`effect-${activePresetKey.value}-${Date.now()}.gif`);
  message.success('GIF 已下载');
}

/** 重新录制 */
function handleReRecord() {
  recorder.reRecord();
}

/** 更新录制配置 */
function handleUpdateConfig(cfg: typeof recorder.config.value) {
  recorder.config.value = cfg;
}

// ============================================================
// 原有功能
// ============================================================

/** 复制配置到剪贴板 */
async function handleCopyConfig() {
  try {
    await navigator.clipboard.writeText(getConfigJson());
    message.success(t('page.effectsGenerator.copySuccess'));
  } catch {
    message.error('复制失败');
  }
}

/** 导出独立 HTML 文件 */
function handleExportHtml() {
  const html = generateStandaloneHtml();
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `effect-${activePresetKey.value}-${Date.now()}.html`;
  a.click();
  URL.revokeObjectURL(url);
  message.success(t('page.effectsGenerator.exportSuccess'));
}

/** 全屏 */
function handleToggleFullscreen() {
  if (!previewRef.value) return;
  if (!isFullscreen.value) {
    previewRef.value.requestFullscreen?.();
    isFullscreen.value = true;
  } else {
    document.exitFullscreen?.();
    isFullscreen.value = false;
  }
}

document.addEventListener('fullscreenchange', () => {
  isFullscreen.value = !!document.fullscreenElement;
});

function handleUploadImage(dataUrl: string) {
  setCustomImage(dataUrl);
}

function handleClearImage() {
  setCustomImage(null);
}

function handleUpdateParams(newParams: typeof params.value) {
  params.value = newParams;
}
</script>

<template>
  <div class="effects-page">
    <!-- 页面标题 -->
    <div class="effects-page__header">
      <h1 class="effects-page__title">
        <span class="effects-page__title-icon">✨</span>
        {{ t('page.effectsGenerator.pageTitle') }}
      </h1>
      <div class="effects-page__mode-tag" :class="{ 'effects-page__mode-tag--burst': isBurstMode }">
        {{ isBurstMode ? '👆 ' + t('page.effectsGenerator.categoryBurst') : '🌌 ' + t('page.effectsGenerator.categoryAmbient') }}
      </div>
    </div>

    <!-- 三栏内容 -->
    <div class="effects-page__body">
      <!-- 左栏：预设列表 -->
      <NCard
        class="effects-page__sidebar"
        :bordered="false"
        content-style="padding: 0;"
      >
        <PresetList
          :active-key="activePresetKey"
          @select="selectPreset"
        />
      </NCard>

      <!-- 中栏：预览画布 -->
      <div ref="previewRef" class="effects-page__preview">
        <PreviewCanvas
          ref="previewCanvasRef"
          :options="mergedOptions"
          :burst-config="activeBurstConfig"
          :is-burst-mode="isBurstMode"
          :is-playing="isPlaying"
          :background="params.background"
        />

        <!-- GIF 区域选取覆盖层 -->
        <CropOverlay
          :visible="recorder.isSelecting.value"
          :container-width="previewSize.width"
          :container-height="previewSize.height"
          :region="recorder.cropRegion.value"
          @update:region="handleCropUpdate"
          @confirm="handleCropConfirm"
          @cancel="handleCropCancel"
          @select-all="handleSelectAll"
        />

        <!-- 录制中红点指示 -->
        <Transition name="fade">
          <div v-if="recorder.isRecording.value" class="effects-page__rec-badge">
            <span class="rec-dot" />
            REC {{ recorder.elapsed.value.toFixed(1) }}s
          </div>
        </Transition>

        <!-- 悬浮效果名标签 -->
        <div class="effects-page__preset-badge">
          {{ t(`page.effectsGenerator.presets.${activePresetKey}`) }}
        </div>
      </div>

      <!-- 右栏：参数面板 + 录制面板 -->
      <NCard
        class="effects-page__params"
        :bordered="false"
        content-style="padding: 0;"
      >
        <ParamsPanel
          :params="params"
          :is-playing="isPlaying"
          :has-custom-image="!!customImageUrl"
          :is-burst-mode="isBurstMode"
          @update:params="handleUpdateParams"
          @toggle-play="togglePlay"
          @reset="resetParams"
          @copy-config="handleCopyConfig"
          @export-html="handleExportHtml"
          @upload-image="handleUploadImage"
          @clear-image="handleClearImage"
          @toggle-fullscreen="handleToggleFullscreen"
        />

        <!-- GIF 录制面板 -->
        <RecordingPanel
          :state="recorder.state.value"
          :config="recorder.config.value"
          :crop-region="recorder.cropRegion.value"
          :elapsed="recorder.elapsed.value"
          :progress="recorder.progress.value"
          :preview-url="recorder.previewUrl.value"
          :file-size="recorder.fileSize.value"
          :error-msg="recorder.errorMsg.value"
          @update:config="handleUpdateConfig"
          @enter-select="handleEnterSelect"
          @start-recording="handleStartRecording"
          @stop-recording="handleStopRecording"
          @cancel-recording="handleCancelRecording"
          @download="handleDownloadGif"
          @re-record="handleReRecord"
        />
      </NCard>
    </div>
  </div>
</template>

<style scoped>
.effects-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px;
  gap: 16px;
  background: linear-gradient(135deg, rgba(13, 17, 23, 0.5), rgba(22, 27, 34, 0.3));
  min-height: 0;
}

.effects-page__header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 16px;
}

.effects-page__title {
  font-size: 22px;
  font-weight: 700;
  color: #ffffff;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.effects-page__title-icon {
  font-size: 24px;
  animation: sparkle 2s ease-in-out infinite;
}

@keyframes sparkle {
  0%, 100% { transform: scale(1) rotate(0deg); opacity: 1; }
  50% { transform: scale(1.2) rotate(15deg); opacity: 0.8; }
}

.effects-page__mode-tag {
  padding: 4px 14px;
  border-radius: 14px;
  font-size: 12px;
  font-weight: 500;
  background: rgba(34, 197, 94, 0.12);
  color: rgba(34, 197, 94, 0.85);
  border: 1px solid rgba(34, 197, 94, 0.2);
  transition: all 0.3s ease;
}

.effects-page__mode-tag--burst {
  background: rgba(99, 102, 241, 0.12);
  color: rgba(139, 132, 255, 0.9);
  border-color: rgba(99, 102, 241, 0.25);
}

/* ===== 三栏布局 ===== */
.effects-page__body {
  flex: 1;
  display: grid;
  grid-template-columns: 210px 1fr 260px;
  gap: 16px;
  min-height: 0;
}

.effects-page__sidebar {
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.06);
  overflow: hidden;
}

.effects-page__preview {
  position: relative;
  border-radius: 14px;
  overflow: hidden;
  box-shadow:
    0 0 40px rgba(99, 102, 241, 0.08),
    0 4px 24px rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.effects-page__preset-badge {
  position: absolute;
  top: 12px;
  left: 12px;
  padding: 6px 14px;
  border-radius: 20px;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.85);
  font-size: 13px;
  font-weight: 500;
  pointer-events: none;
  z-index: 5;
  transition: all 0.3s ease;
}

.effects-page__params {
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.06);
  overflow-y: auto;
}

/* GIF 录制中红点指示 */
.effects-page__rec-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 20px;
  background: rgba(239, 68, 68, 0.2);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(239, 68, 68, 0.4);
  color: #fca5a5;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 1px;
  z-index: 10;
  pointer-events: none;
}

.rec-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
  animation: rec-blink 1s ease-in-out infinite;
}

@keyframes rec-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.2; }
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

.effects-page__preview:fullscreen {
  border-radius: 0;
  border: none;
}

@media (max-width: 1200px) {
  .effects-page__body {
    grid-template-columns: 180px 1fr 220px;
  }
}

@media (max-width: 900px) {
  .effects-page__body {
    grid-template-columns: 1fr;
    grid-template-rows: auto 400px auto;
  }
}
</style>
