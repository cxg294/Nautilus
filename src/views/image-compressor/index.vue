<script setup lang="ts">
/**
 * 图片压缩工具 — 主页面
 *
 * 使用 NTabs 切换两个功能面板：
 * - 图片压缩：批量压缩普通图片
 * - SB3 压缩：压缩 SB3 文件内的图片资源
 */
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import ImagePanel from './components/ImagePanel.vue';
import Sb3Panel from './components/Sb3Panel.vue';
import { usePageTracker } from '@/hooks/common/use-tracker';

usePageTracker('image-compressor');

const { t } = useI18n();
const activeTab = ref('images');
</script>

<template>
  <div class="image-compressor">
    <NTabs v-model:value="activeTab" type="line" animated class="main-tabs">
      <NTabPane name="images" :tab="t('page.imageCompressor.tabImages')">
        <ImagePanel />
      </NTabPane>
      <NTabPane name="sb3" :tab="t('page.imageCompressor.tabSb3')">
        <Sb3Panel />
      </NTabPane>
    </NTabs>
  </div>
</template>

<style scoped>
.image-compressor {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.main-tabs {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.main-tabs :deep(.n-tabs-pane-wrapper) {
  flex: 1;
  min-height: 0;
}

.main-tabs :deep(.n-tab-pane) {
  padding-top: 0;
  height: 100%;
}
</style>
