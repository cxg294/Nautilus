<script setup lang="ts">
/**
 * 压缩效果对比弹窗
 *
 * 左右分列对比原图与压缩后的图片，显示大小变化信息。
 */
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ImageItem } from '../composables/use-image-compressor';

const props = defineProps<{
  visible: boolean;
  item: ImageItem | null;
}>();

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void;
}>();

const { t } = useI18n();

const show = computed({
  get: () => props.visible,
  set: (v: boolean) => emit('update:visible', v)
});

/** 格式化文件大小 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
</script>

<template>
  <NModal
    v-model:show="show"
    preset="card"
    :title="t('page.imageCompressor.compareTitle')"
    style="width: 900px; max-width: 95vw"
    :bordered="false"
  >
    <div v-if="item" class="compare-layout">
      <!-- 原图 -->
      <div class="compare-side">
        <NTag type="default" size="small" round class="side-label">
          {{ t('page.imageCompressor.original') }}
        </NTag>
        <div class="compare-img-wrapper">
          <img :src="item.originalUrl" :alt="item.file.name" class="compare-img" />
        </div>
        <div class="compare-meta">
          <NText depth="3">{{ formatSize(item.originalSize) }}</NText>
        </div>
      </div>

      <!-- 分隔线 -->
      <div class="compare-divider">
        <div class="arrow-icon">→</div>
      </div>

      <!-- 压缩后 -->
      <div class="compare-side">
        <NTag type="success" size="small" round class="side-label">
          {{ t('page.imageCompressor.compressed') }}
        </NTag>
        <div class="compare-img-wrapper">
          <img :src="item.compressedUrl" :alt="item.file.name" class="compare-img" />
        </div>
        <div class="compare-meta">
          <NText type="success" strong>{{ formatSize(item.compressedSize) }}</NText>
          <NText
            :type="item.compressedSize < item.originalSize ? 'success' : 'warning'"
            style="font-size: 13px"
          >
            ({{ item.compressedSize < item.originalSize ? '-' : '+' }}{{ Math.abs(((item.originalSize - item.compressedSize) / item.originalSize) * 100).toFixed(1) }}%)
          </NText>
        </div>
      </div>
    </div>
  </NModal>
</template>

<style scoped>
.compare-layout {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 16px;
  align-items: start;
}

.compare-side {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.side-label {
  align-self: center;
}

.compare-img-wrapper {
  width: 100%;
  max-height: 450px;
  overflow: hidden;
  background: repeating-conic-gradient(#f0f0f4 0% 25%, transparent 0% 50%) 50% / 16px 16px;
  border-radius: 10px;
  border: 1px solid var(--n-border-color, #e0e0e6);
  display: flex;
  align-items: center;
  justify-content: center;
}

.dark .compare-img-wrapper {
  background: repeating-conic-gradient(#2a2a3e 0% 25%, #1e1e2e 0% 50%) 50% / 16px 16px;
  border-color: rgba(255, 255, 255, 0.08);
}

.compare-img {
  max-width: 100%;
  max-height: 450px;
  object-fit: contain;
}

.compare-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.compare-divider {
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 120px;
}

.arrow-icon {
  font-size: 24px;
  color: var(--n-text-color-3);
  font-weight: bold;
}
</style>
