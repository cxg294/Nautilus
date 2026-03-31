<script setup lang="ts">
/**
 * StudioLayout — 左右分栏布局容器
 *
 * 左侧：对话卡片栈
 * 右侧：结论面板 / 风格网格（根据阶段切换）
 */
import { useMaterialStudio } from '../composables/use-material-studio';
import CardStack from './CardStack.vue';
import ConclusionPanel from './ConclusionPanel.vue';
import StyleGrid from './StyleGrid.vue';

const { state } = useMaterialStudio();
</script>

<template>
  <div class="studio-layout">
    <!-- 左侧：对话卡片栈 -->
    <div class="layout-left">
      <CardStack />
    </div>

    <!-- 右侧：内容面板 -->
    <div class="layout-right">
      <ConclusionPanel v-if="state.phase === 'clarifying'" />
      <StyleGrid v-else-if="state.phase === 'styling'" />
    </div>
  </div>
</template>

<style scoped>
.studio-layout {
  display: flex;
  gap: 16px;
  height: 100%;
  overflow: hidden;
}

.layout-left {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.layout-right {
  width: 320px;
  flex-shrink: 0;
  overflow: hidden;
}
</style>
