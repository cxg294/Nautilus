<script setup lang="ts">
/**
 * 参数面板组件
 * 提供粒子效果参数的实时调节控件
 * 包含：基础参数 + 高级样式参数（柔化、曲线、大小模式、颜色渐变）
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  NSlider, NColorPicker, NButton, NSpace, NTooltip,
  NDivider, NUpload, NSelect, NSwitch,
  useMessage,
  type UploadFileInfo, type SelectOption
} from 'naive-ui';
import type { EffectParams } from '../composables/use-effects';
import type { LifeCurve, SizeMode } from '../composables/use-burst-particles';

const props = defineProps<{
  /** 当前参数值 */
  params: EffectParams;
  /** 是否正在播放 */
  isPlaying: boolean;
  /** 是否有自定义图片 */
  hasCustomImage: boolean;
  /** 是否为爆发模式 */
  isBurstMode?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:params', value: EffectParams): void;
  (e: 'toggle-play'): void;
  (e: 'reset'): void;
  (e: 'copy-config'): void;
  (e: 'export-html'): void;
  (e: 'upload-image', dataUrl: string): void;
  (e: 'clear-image'): void;
  (e: 'toggle-fullscreen'): void;
}>();

const { t } = useI18n();
const message = useMessage();

/** 更新单个参数 */
function updateParam<K extends keyof EffectParams>(key: K, value: EffectParams[K]) {
  emit('update:params', { ...props.params, [key]: value });
}

/** 衰减曲线选项 */
const lifeCurveOptions = computed<SelectOption[]>(() => [
  { label: t('page.effectsGenerator.curves.easeOut'), value: 'easeOut' },
  { label: t('page.effectsGenerator.curves.easeIn'), value: 'easeIn' },
  { label: t('page.effectsGenerator.curves.linear'), value: 'linear' },
  { label: t('page.effectsGenerator.curves.easeInOut'), value: 'easeInOut' },
  { label: t('page.effectsGenerator.curves.pulse'), value: 'pulse' }
]);

/** 大小模式选项 */
const sizeModeOptions = computed<SelectOption[]>(() => [
  { label: t('page.effectsGenerator.sizeModes.shrink'), value: 'shrink' },
  { label: t('page.effectsGenerator.sizeModes.grow'), value: 'grow' },
  { label: t('page.effectsGenerator.sizeModes.constant'), value: 'constant' },
  { label: t('page.effectsGenerator.sizeModes.pop'), value: 'pop' }
]);

/** 是否启用了颜色渐变 */
const hasColorGradient = computed(() => !!props.params.colorGradient);

/** 切换颜色渐变 */
function toggleColorGradient(enabled: boolean) {
  updateParam('colorGradient', enabled ? '#333333' : '');
}

/** 处理图片上传 */
function handleUpload({ file }: { file: UploadFileInfo }) {
  if (!file.file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const result = e.target?.result;
    if (typeof result === 'string') {
      emit('upload-image', result);
      message.success(t('page.effectsGenerator.uploadImage') + ' ✓');
    }
  };
  reader.readAsDataURL(file.file);
  return false;
}
</script>

<template>
  <div class="params-panel">
    <!-- 控制按钮组 -->
    <div class="params-panel__controls">
      <NSpace :size="8" justify="center" :wrap="false">
        <NTooltip>
          <template #trigger>
            <NButton
              :type="isPlaying ? 'warning' : 'success'"
              size="small"
              circle
              @click="emit('toggle-play')"
            >
              <template #icon>
                <span class="btn-icon">{{ isPlaying ? '⏸' : '▶' }}</span>
              </template>
            </NButton>
          </template>
          {{ isPlaying ? t('page.effectsGenerator.stop') : t('page.effectsGenerator.play') }}
        </NTooltip>
        <NTooltip>
          <template #trigger>
            <NButton size="small" circle @click="emit('reset')">
              <template #icon><span class="btn-icon">🔄</span></template>
            </NButton>
          </template>
          {{ t('page.effectsGenerator.reset') }}
        </NTooltip>
        <NTooltip>
          <template #trigger>
            <NButton size="small" circle @click="emit('toggle-fullscreen')">
              <template #icon><span class="btn-icon">⛶</span></template>
            </NButton>
          </template>
          {{ t('page.effectsGenerator.fullscreen') }}
        </NTooltip>
      </NSpace>
    </div>

    <NDivider style="margin: 10px 0 6px;" />

    <!-- 基础参数 -->
    <div class="params-panel__section-header">📊 {{ t('page.effectsGenerator.params') }}</div>
    <div class="params-panel__section">
      <div class="param-item">
        <label class="param-item__label">{{ t('page.effectsGenerator.particleCount') }}</label>
        <NSlider
          :value="params.particleCount"
          :min="5"
          :max="300"
          :step="5"
          :tooltip="true"
          @update:value="(v: number) => updateParam('particleCount', v)"
        />
      </div>

      <div class="param-item">
        <label class="param-item__label">{{ t('page.effectsGenerator.speed') }}</label>
        <NSlider
          :value="params.speed"
          :min="0.1"
          :max="20"
          :step="0.1"
          :tooltip="true"
          @update:value="(v: number) => updateParam('speed', v)"
        />
      </div>

      <div class="param-item">
        <label class="param-item__label">{{ t('page.effectsGenerator.size') }}</label>
        <NSlider
          :value="params.size"
          :min="1"
          :max="20"
          :step="0.5"
          :tooltip="true"
          @update:value="(v: number) => updateParam('size', v)"
        />
      </div>

      <div class="param-item">
        <label class="param-item__label">{{ t('page.effectsGenerator.gravity') }}</label>
        <NSlider
          :value="params.gravity"
          :min="0"
          :max="3"
          :step="0.1"
          :tooltip="true"
          @update:value="(v: number) => updateParam('gravity', v)"
        />
      </div>

      <div class="param-item">
        <label class="param-item__label">{{ t('page.effectsGenerator.background') }}</label>
        <NColorPicker
          :value="params.background"
          :show-alpha="false"
          size="small"
          :swatches="['#0d1117', '#1a1a2e', '#16213e', '#0f3460', '#1b1b2f', '#162447', '#000000', '#0a0a1a']"
          @update:value="(v: string) => updateParam('background', v)"
        />
      </div>
    </div>

    <!-- 高级样式参数（仅 Burst 模式显示） -->
    <template v-if="isBurstMode">
      <NDivider style="margin: 10px 0 6px;" />
      <div class="params-panel__section-header">✨ {{ t('page.effectsGenerator.styleParams') }}</div>
      <div class="params-panel__section">
        <!-- 边缘柔化 -->
        <div class="param-item">
          <label class="param-item__label">
            🌫️ {{ t('page.effectsGenerator.softness') }}
            <span class="param-item__value">{{ (params.softness * 100).toFixed(0) }}%</span>
          </label>
          <NSlider
            :value="params.softness"
            :min="0"
            :max="1"
            :step="0.05"
            :tooltip="true"
            :format-tooltip="(v: number) => `${(v * 100).toFixed(0)}%`"
            @update:value="(v: number) => updateParam('softness', v)"
          />
        </div>

        <!-- 衰减曲线 -->
        <div class="param-item">
          <label class="param-item__label">📈 {{ t('page.effectsGenerator.lifeCurve') }}</label>
          <NSelect
            :value="params.lifeCurve"
            :options="lifeCurveOptions"
            size="small"
            @update:value="(v: LifeCurve) => updateParam('lifeCurve', v)"
          />
        </div>

        <!-- 大小模式 -->
        <div class="param-item">
          <label class="param-item__label">📐 {{ t('page.effectsGenerator.sizeMode') }}</label>
          <NSelect
            :value="params.sizeMode"
            :options="sizeModeOptions"
            size="small"
            @update:value="(v: SizeMode) => updateParam('sizeMode', v)"
          />
        </div>

        <!-- 颜色渐变 -->
        <div class="param-item">
          <label class="param-item__label">
            🎨 {{ t('page.effectsGenerator.colorGradient') }}
            <NSwitch
              :value="hasColorGradient"
              size="small"
              style="margin-left: 8px;"
              @update:value="toggleColorGradient"
            />
          </label>
          <NColorPicker
            v-if="hasColorGradient"
            :value="params.colorGradient"
            :show-alpha="false"
            size="small"
            :swatches="['#000000', '#333333', '#8B4513', '#000033', '#1a0000', '#001a00', '#1a001a']"
            @update:value="(v: string) => updateParam('colorGradient', v)"
          />
        </div>
      </div>
    </template>

    <NDivider style="margin: 10px 0 6px;" />

    <!-- 自定义粒子 -->
    <div class="params-panel__section">
      <label class="param-item__label">{{ t('page.effectsGenerator.customParticle') }}</label>
      <NSpace :size="8" vertical>
        <NUpload
          :show-file-list="false"
          accept="image/*"
          :max="1"
          @change="handleUpload"
        >
          <NButton size="small" block dashed>
            {{ t('page.effectsGenerator.uploadImage') }}
          </NButton>
        </NUpload>
        <NButton
          v-if="hasCustomImage"
          size="small"
          type="error"
          ghost
          block
          @click="emit('clear-image')"
        >
          清除自定义图片
        </NButton>
      </NSpace>
    </div>

    <NDivider style="margin: 10px 0 6px;" />

    <!-- 导出按钮 -->
    <div class="params-panel__export">
      <NButton type="primary" size="small" block ghost @click="emit('copy-config')">
        📋 {{ t('page.effectsGenerator.copyConfig') }}
      </NButton>
      <NButton type="info" size="small" block ghost style="margin-top: 8px;" @click="emit('export-html')">
        💾 {{ t('page.effectsGenerator.exportHtml') }}
      </NButton>
    </div>
  </div>
</template>

<style scoped>
.params-panel {
  display: flex;
  flex-direction: column;
  padding: 12px;
  height: 100%;
  overflow-y: auto;
}

.params-panel__controls {
  display: flex;
  justify-content: center;
}

.btn-icon {
  font-size: 14px;
  line-height: 1;
}

.params-panel__section-header {
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
  letter-spacing: 0.5px;
  text-transform: uppercase;
  margin-bottom: 8px;
}

.params-panel__section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.param-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.param-item__label {
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.6);
  letter-spacing: 0.3px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.param-item__value {
  margin-left: auto;
  font-size: 11px;
  color: rgba(99, 102, 241, 0.8);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.params-panel__export {
  margin-top: auto;
  padding-top: 8px;
}
</style>
