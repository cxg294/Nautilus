<script setup lang="ts">
/**
 * 抽帧控制面板组件 — 紧凑版
 *
 * 采用两行横向布局，确保控件始终在首屏可见。
 * 第一行：模式 + 参数 + 格式 + 质量
 * 第二行：操作按钮 + 进度
 */
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ExtractMode, OutputFormat } from '../composables/use-frame-extractor';

const { t } = useI18n();

interface Props {
  /** 是否有视频加载 */
  hasVideo: boolean;
  /** 是否正在抽帧 */
  isExtracting: boolean;
  /** 抽帧进度 (0-100) */
  extractProgress: number;
  /** 输出格式 */
  outputFormat: OutputFormat;
  /** JPEG 质量 */
  outputQuality: number;
  /** 视频时长（秒） */
  videoDuration: number;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  /** 按帧数量抽帧 */
  extractByCount: [count: number];
  /** 按时间间隔抽帧 */
  extractByInterval: [seconds: number];
  /** 截取当前帧 */
  captureFrame: [];
  /** 更新输出格式 */
  'update:outputFormat': [format: OutputFormat];
  /** 更新输出质量 */
  'update:outputQuality': [quality: number];
}>();

// === 本地状态 ===
const extractMode = ref<ExtractMode>('count');
const frameCount = ref(10);
const intervalSeconds = ref(2);

/** 处理开始抽帧 */
function handleExtract() {
  if (extractMode.value === 'count') {
    emit('extractByCount', frameCount.value);
  } else {
    emit('extractByInterval', intervalSeconds.value);
  }
}

/** 预估帧数 */
function estimatedFrames(): number {
  if (extractMode.value === 'count') return frameCount.value;
  if (props.videoDuration > 0) return Math.floor(props.videoDuration / intervalSeconds.value);
  return 0;
}
</script>

<template>
  <NCard
    :bordered="false"
    size="small"
    class="extract-controls"
    :title="t('page.videoFrameExtractor.extractSettings')"
  >
    <!-- 设置区：横向紧凑布局 -->
    <div class="controls-row">
      <!-- 抽帧模式 -->
      <div class="control-item">
        <div class="control-label">{{ t('page.videoFrameExtractor.extractMode') }}</div>
        <NRadioGroup v-model:value="extractMode" size="small">
          <NRadioButton value="count" :label="t('page.videoFrameExtractor.modeCount')" />
          <NRadioButton value="interval" :label="t('page.videoFrameExtractor.modeInterval')" />
        </NRadioGroup>
      </div>

      <!-- 参数输入 -->
      <div class="control-item">
        <div class="control-label">
          {{ extractMode === 'count' ? t('page.videoFrameExtractor.frameCount') : t('page.videoFrameExtractor.intervalSeconds') }}
        </div>
        <NInputNumber
          v-if="extractMode === 'count'"
          v-model:value="frameCount"
          :min="1"
          :max="200"
          :step="1"
          size="small"
          style="width: 120px"
        />
        <NInputNumber
          v-else
          v-model:value="intervalSeconds"
          :min="0.1"
          :max="300"
          :step="0.5"
          :precision="1"
          size="small"
          style="width: 120px"
        >
          <template #suffix>{{ t('page.videoFrameExtractor.seconds') }}</template>
        </NInputNumber>
      </div>

      <!-- 输出格式 -->
      <div class="control-item">
        <div class="control-label">{{ t('page.videoFrameExtractor.outputFormat') }}</div>
        <NRadioGroup
          :value="outputFormat"
          size="small"
          @update:value="(v: string) => emit('update:outputFormat', v as OutputFormat)"
        >
          <NRadioButton value="png" label="PNG" />
          <NRadioButton value="jpeg" label="JPEG" />
        </NRadioGroup>
      </div>

      <!-- JPEG 质量 -->
      <div v-if="outputFormat === 'jpeg'" class="control-item quality-item">
        <div class="control-label">{{ t('page.videoFrameExtractor.quality') }}: {{ Math.round(outputQuality * 100) }}%</div>
        <NSlider
          :value="outputQuality"
          :min="0.1"
          :max="1"
          :step="0.05"
          :tooltip="false"
          style="width: 100px"
          @update:value="(v: number) => emit('update:outputQuality', v)"
        />
      </div>

      <!-- 预估帧数 -->
      <div v-if="hasVideo" class="control-item estimated-badge">
        <NTag size="small" round type="info">
          ≈ {{ estimatedFrames() }} {{ t('page.videoFrameExtractor.estimatedFrames') }}
        </NTag>
      </div>
    </div>

    <!-- 操作按钮行 -->
    <div class="actions-row">
      <NButton
        type="primary"
        :disabled="!hasVideo || isExtracting"
        :loading="isExtracting"
        @click="handleExtract"
      >
        {{ isExtracting ? t('page.videoFrameExtractor.extracting') : t('page.videoFrameExtractor.startExtract') }}
      </NButton>

      <NButton
        type="info"
        secondary
        :disabled="!hasVideo || isExtracting"
        @click="emit('captureFrame')"
      >
        {{ t('page.videoFrameExtractor.captureCurrentFrame') }}
      </NButton>

      <!-- 进度条 -->
      <NProgress
        v-if="isExtracting"
        type="line"
        :percentage="extractProgress"
        :show-indicator="true"
        status="success"
        style="flex: 1; min-width: 100px"
      />
    </div>
  </NCard>
</template>

<style scoped>
.extract-controls {
  background: rgba(255, 255, 255, 0.02);
  flex-shrink: 0;
}

.controls-row {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.control-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.control-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--n-text-color-2, rgba(255, 255, 255, 0.6));
  white-space: nowrap;
}

.quality-item {
  min-width: 120px;
}

.estimated-badge {
  justify-content: flex-end;
}

.actions-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
