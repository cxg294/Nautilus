<script setup lang="ts">
/**
 * SB3 压缩 — 独立页面
 *
 * 复用 image-compressor 模块中的 Sb3Panel 组件，
 * 作为独立路由入口供侧边栏直接访问。
 */
import Sb3Panel from '../image-compressor/components/Sb3Panel.vue';
import { usePageTracker } from '@/hooks/common/use-tracker';

usePageTracker('sb3-compressor');
</script>

<template>
  <div class="sb3-compressor-page">
    <Sb3Panel />
  </div>
</template>

<style scoped>
.sb3-compressor-page {
  height: 100%;
  overflow: hidden;
}
</style>
