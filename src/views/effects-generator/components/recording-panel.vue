<script setup lang="ts">
/**
 * GIF 录制控制面板
 * 嵌入参数面板底部，控制录制流程
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { NSlider, NSelect, NProgress, NButton, NCollapse, NCollapseItem } from 'naive-ui';
import type { RecordingState, RecordingConfig, CropRegion } from '../composables/use-gif-recorder';

const props = defineProps<{
  state: RecordingState;
  config: RecordingConfig;
  cropRegion: CropRegion | null;
  elapsed: number;
  progress: number;
  previewUrl: string | null;
  fileSize: number;
  errorMsg: string | null;
}>();

const emit = defineEmits<{
  (e: 'update:config', config: RecordingConfig): void;
  (e: 'enter-select'): void;
  (e: 'start-recording'): void;
  (e: 'stop-recording'): void;
  (e: 'cancel-recording'): void;
  (e: 'download'): void;
  (e: 're-record'): void;
}>();

const { t } = useI18n();

// ---- 配置选项 ----
const fpsOptions = [
  { label: '10 fps', value: 10 },
  { label: '15 fps', value: 15 },
  { label: '20 fps', value: 20 },
  { label: '24 fps', value: 24 }
];

const qualityOptions = [
  { label: t('page.effectsGenerator.recording.qualityHigh'), value: 256 },
  { label: t('page.effectsGenerator.recording.qualityMedium'), value: 128 },
  { label: t('page.effectsGenerator.recording.qualityLow'), value: 64 }
];

// ---- 更新配置 ----
function updateFps(val: number) {
  emit('update:config', { ...props.config, fps: val });
}

function updateDuration(val: number) {
  emit('update:config', { ...props.config, duration: val });
}

function updateQuality(val: number) {
  emit('update:config', { ...props.config, maxColors: val });
}

// ---- 格式化 ----
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const regionInfo = computed(() => {
  if (!props.cropRegion) return t('page.effectsGenerator.recording.noRegion');
  const r = props.cropRegion;
  return `${Math.round(r.width)} × ${Math.round(r.height)} px`;
});

const stateLabel = computed(() => {
  switch (props.state) {
    case 'idle': return t('page.effectsGenerator.recording.stateIdle');
    case 'selecting': return t('page.effectsGenerator.recording.stateSelecting');
    case 'ready': return t('page.effectsGenerator.recording.stateReady');
    case 'recording': return `${t('page.effectsGenerator.recording.stateRecording')} ${props.elapsed.toFixed(1)}s`;
    case 'encoding': return t('page.effectsGenerator.recording.stateEncoding');
    case 'done': return t('page.effectsGenerator.recording.stateDone');
    default: return '';
  }
});

const isConfigDisabled = computed(() =>
  props.state === 'recording' || props.state === 'encoding'
);
</script>

<template>
  <div class="rec-panel">
    <NCollapse :default-expanded-names="['recording']">
      <NCollapseItem name="recording">
        <template #header>
          <div class="rec-panel__header">
            <span class="rec-panel__header-icon">🎬</span>
            <span>{{ t('page.effectsGenerator.recording.title') }}</span>
            <!-- 录制中闪烁指示 -->
            <span v-if="state === 'recording'" class="rec-indicator" />
          </div>
        </template>

        <div class="rec-panel__body">
          <!-- 参数配置 -->
          <div class="rec-config">
            <!-- 帧率 -->
            <div class="config-row">
              <label class="config-label">{{ t('page.effectsGenerator.recording.fps') }}</label>
              <NSelect
                :value="config.fps"
                :options="fpsOptions"
                size="small"
                :disabled="isConfigDisabled"
                style="width: 100px"
                @update:value="updateFps"
              />
            </div>

            <!-- 时长 -->
            <div class="config-row">
              <label class="config-label">{{ t('page.effectsGenerator.recording.duration') }}</label>
              <div class="config-slider">
                <NSlider
                  :value="config.duration"
                  :min="1"
                  :max="10"
                  :step="1"
                  :disabled="isConfigDisabled"
                  :format-tooltip="(v: number) => `${v}s`"
                  @update:value="updateDuration"
                />
                <span class="config-value">{{ config.duration }}s</span>
              </div>
            </div>

            <!-- 画质 -->
            <div class="config-row">
              <label class="config-label">{{ t('page.effectsGenerator.recording.quality') }}</label>
              <NSelect
                :value="config.maxColors"
                :options="qualityOptions"
                size="small"
                :disabled="isConfigDisabled"
                style="width: 100px"
                @update:value="updateQuality"
              />
            </div>
          </div>

          <!-- 选区信息 -->
          <div class="rec-region">
            <NButton
              size="small"
              :type="state === 'selecting' ? 'warning' : 'default'"
              :disabled="state === 'recording' || state === 'encoding'"
              quaternary
              @click="$emit('enter-select')"
            >
              📐 {{ t('page.effectsGenerator.recording.selectRegion') }}
            </NButton>
            <span class="region-info">{{ regionInfo }}</span>
          </div>

          <!-- 状态 -->
          <div class="rec-status">
            <span class="status-label">{{ stateLabel }}</span>
            <!-- 进度条（录制+编码时显示） -->
            <NProgress
              v-if="state === 'recording' || state === 'encoding'"
              type="line"
              :percentage="Math.round(progress * 100)"
              :color="state === 'encoding' ? '#f59e0b' : '#6366f1'"
              :height="6"
              :show-indicator="false"
              style="margin-top: 4px"
            />
          </div>

          <!-- 错误信息 -->
          <div v-if="errorMsg" class="rec-error">
            ⚠️ {{ errorMsg }}
          </div>

          <!-- 操作按钮 -->
          <div class="rec-actions">
            <template v-if="state === 'idle' || state === 'ready' || state === 'selecting'">
              <NButton
                type="error"
                size="small"
                :disabled="!cropRegion"
                @click="$emit('start-recording')"
              >
                ● {{ t('page.effectsGenerator.recording.start') }}
              </NButton>
            </template>

            <template v-else-if="state === 'recording'">
              <NButton
                type="warning"
                size="small"
                @click="$emit('stop-recording')"
              >
                ■ {{ t('page.effectsGenerator.recording.stop') }}
              </NButton>
              <NButton
                size="small"
                quaternary
                @click="$emit('cancel-recording')"
              >
                {{ t('page.effectsGenerator.recording.cancel') }}
              </NButton>
            </template>

            <template v-else-if="state === 'encoding'">
              <NButton size="small" loading disabled>
                {{ t('page.effectsGenerator.recording.stateEncoding') }}
              </NButton>
            </template>
          </div>

          <!-- 预览区（完成后） -->
          <div v-if="state === 'done' && previewUrl" class="rec-preview">
            <div class="preview-img-wrap">
              <img :src="previewUrl" alt="GIF Preview" class="preview-img" />
            </div>
            <div class="preview-info">
              <span>{{ t('page.effectsGenerator.recording.fileSize') }}: {{ formatSize(fileSize) }}</span>
            </div>
            <div class="preview-actions">
              <NButton type="primary" size="small" @click="$emit('download')">
                💾 {{ t('page.effectsGenerator.recording.download') }}
              </NButton>
              <NButton size="small" quaternary @click="$emit('re-record')">
                🔄 {{ t('page.effectsGenerator.recording.reRecord') }}
              </NButton>
            </div>
          </div>
        </div>
      </NCollapseItem>
    </NCollapse>
  </div>
</template>

<style scoped>
.rec-panel {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  margin-top: 8px;
}

.rec-panel__header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
}

.rec-panel__header-icon {
  font-size: 15px;
}

/* 录制中闪烁指示灯 */
.rec-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
  animation: rec-blink 1s ease-in-out infinite;
  margin-left: 4px;
}

@keyframes rec-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.2; }
}

.rec-panel__body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 4px;
}

/* 配置行 */
.rec-config {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.config-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.config-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
  min-width: 42px;
  flex-shrink: 0;
}

.config-slider {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.config-value {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  min-width: 28px;
  text-align: right;
}

/* 区域信息 */
.rec-region {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
}

.region-info {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
}

/* 状态 */
.rec-status {
  padding: 4px 0;
}

.status-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
}

/* 错误 */
.rec-error {
  font-size: 11px;
  color: #f87171;
  padding: 4px 8px;
  background: rgba(239, 68, 68, 0.1);
  border-radius: 6px;
}

/* 按钮区 */
.rec-actions {
  display: flex;
  gap: 8px;
}

/* 预览区 */
.rec-preview {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.preview-img-wrap {
  border-radius: 6px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  justify-content: center;
}

.preview-img {
  max-width: 100%;
  max-height: 150px;
  object-fit: contain;
}

.preview-info {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  text-align: center;
}

.preview-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
}
</style>
