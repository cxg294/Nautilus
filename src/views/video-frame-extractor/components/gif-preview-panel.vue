<script setup lang="ts">
/**
 * GIF 预览面板组件
 *
 * 提供 GIF 生成配置（帧间隔、输出宽度、画质）、
 * 生成进度、预览播放、下载等完整交互。
 */
import { computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { FrameData } from '../composables/use-frame-extractor';
import type { GifConfig, GifState } from '../composables/use-gif-maker';

const { t } = useI18n();

interface Props {
  /** 选中的帧列表（按时间排序） */
  frames: FrameData[];
  /** GIF 生成状态 */
  state: GifState;
  /** 生成进度 0~100 */
  progress: number;
  /** 预览 URL */
  previewUrl: string | null;
  /** 文件大小（字节） */
  fileSize: number;
  /** 错误信息 */
  errorMsg: string | null;
  /** 配置 */
  config: GifConfig;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  /** 生成 GIF */
  generate: [];
  /** 下载 GIF */
  download: [];
  /** 重置 */
  reset: [];
  /** 更新配置 */
  'update:config': [config: GifConfig];
}>();

/** 帧间隔选项 */
const delayOptions = [
  { label: '50ms (极快)', value: 50 },
  { label: '100ms (快)', value: 100 },
  { label: '200ms (正常)', value: 200 },
  { label: '300ms (较慢)', value: 300 },
  { label: '500ms (慢)', value: 500 },
  { label: '1000ms (很慢)', value: 1000 }
];

/** 输出宽度选项 */
const widthOptions = [
  { label: '240px (小)', value: 240 },
  { label: '320px', value: 320 },
  { label: '480px (推荐)', value: 480 },
  { label: '640px', value: 640 },
  { label: '800px (大)', value: 800 }
];

/** 预估时长 */
const estimatedDuration = computed(() => {
  const totalMs = props.frames.length * props.config.delay;
  return (totalMs / 1000).toFixed(1);
});

/** 格式化文件大小 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** 更新配置字段 */
function updateConfig<K extends keyof GifConfig>(key: K, value: GifConfig[K]) {
  emit('update:config', { ...props.config, [key]: value });
}
</script>

<template>
  <div class="gif-panel">
    <!-- 帧预览缩略图条 -->
    <div class="gif-panel__frames-strip">
      <div class="strip-label">
        选中帧 ({{ frames.length }})
      </div>
      <div class="strip-thumbs">
        <img
          v-for="(frame, index) in frames.slice(0, 20)"
          :key="frame.id"
          :src="frame.thumbUrl"
          :alt="`帧 ${index + 1}`"
          class="strip-thumb"
        />
        <span v-if="frames.length > 20" class="strip-more">
          +{{ frames.length - 20 }}
        </span>
      </div>
    </div>

    <!-- 配置区 -->
    <div v-if="state === 'idle' || state === 'error'" class="gif-panel__config">
      <div class="config-row">
        <span class="config-label">帧间隔</span>
        <NSelect
          :value="config.delay"
          :options="delayOptions"
          size="small"
          style="width: 160px"
          @update:value="(v: number) => updateConfig('delay', v)"
        />
      </div>
      <div class="config-row">
        <span class="config-label">输出宽度</span>
        <NSelect
          :value="config.maxWidth"
          :options="widthOptions"
          size="small"
          style="width: 160px"
          @update:value="(v: number) => updateConfig('maxWidth', v)"
        />
      </div>
      <div class="config-row">
        <span class="config-label">预估时长</span>
        <NTag size="small" round>{{ estimatedDuration }}s</NTag>
      </div>

      <!-- 错误提示 -->
      <div v-if="errorMsg" class="gif-panel__error">
        <NTag type="error" size="small">{{ errorMsg }}</NTag>
      </div>

      <!-- 生成按钮 -->
      <NButton
        type="primary"
        :disabled="frames.length < 2"
        block
        @click="emit('generate')"
      >
        <template #icon>
          <NIcon>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
              <path fill="currentColor" d="M11.5 9C10.12 9 9 10.12 9 11.5S10.12 14 11.5 14S14 12.88 14 11.5S12.88 9 11.5 9M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2m0 14H4V6h16v12z" />
            </svg>
          </NIcon>
        </template>
        生成 GIF 动图
      </NButton>
    </div>

    <!-- 生成中 -->
    <div v-else-if="state === 'generating'" class="gif-panel__progress">
      <NProgress
        type="line"
        :percentage="progress"
        :indicator-placement="'inside'"
        processing
      />
      <p class="progress-text">
        {{ progress < 60 ? '正在提取帧数据…' : '正在编码 GIF…' }}
      </p>
    </div>

    <!-- 生成完成 -->
    <div v-else-if="state === 'done' && previewUrl" class="gif-panel__result">
      <!-- GIF 预览 -->
      <div class="gif-preview">
        <img :src="previewUrl" alt="GIF 预览" class="gif-preview__img" />
      </div>

      <!-- 信息 -->
      <div class="gif-info">
        <NTag type="success" size="small" round>生成成功</NTag>
        <NTag size="small" round>{{ formatSize(fileSize) }}</NTag>
        <NTag size="small" round>{{ frames.length }} 帧</NTag>
        <NTag size="small" round>{{ estimatedDuration }}s</NTag>
      </div>

      <!-- 操作按钮 -->
      <NSpace justify="center" :size="12">
        <NButton type="primary" @click="emit('download')">
          <template #icon>
            <NIcon>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path fill="currentColor" d="M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7l7-7z" />
              </svg>
            </NIcon>
          </template>
          下载 GIF
        </NButton>
        <NButton quaternary @click="emit('reset')">
          重新生成
        </NButton>
      </NSpace>
    </div>
  </div>
</template>

<style scoped>
.gif-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 0;
}

/* 帧预览条 */
.gif-panel__frames-strip {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.strip-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--n-text-color-3, rgba(255, 255, 255, 0.38));
}

.strip-thumbs {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  padding: 4px 0;
}

.strip-thumb {
  width: 48px;
  height: 27px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
}

.strip-more {
  display: flex;
  align-items: center;
  padding: 0 8px;
  font-size: 11px;
  color: var(--n-text-color-3, rgba(255, 255, 255, 0.38));
  flex-shrink: 0;
}

/* 配置区 */
.gif-panel__config {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.config-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.config-label {
  font-size: 13px;
  white-space: nowrap;
  color: var(--n-text-color-2, rgba(255, 255, 255, 0.6));
}

.gif-panel__error {
  text-align: center;
}

/* 进度 */
.gif-panel__progress {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 0;
}

.progress-text {
  text-align: center;
  font-size: 13px;
  color: var(--n-text-color-3, rgba(255, 255, 255, 0.38));
  margin: 0;
}

/* 结果 */
.gif-panel__result {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.gif-preview {
  display: flex;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 8px;
  padding: 8px;
  overflow: hidden;
}

.gif-preview__img {
  max-width: 100%;
  max-height: 300px;
  object-fit: contain;
  border-radius: 4px;
}

.gif-info {
  display: flex;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
