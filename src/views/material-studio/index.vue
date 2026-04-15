<script setup lang="ts">
/**
 * Material Studio — 素材生成工作台 主页面
 *
 * 阶段路由：
 *   welcome    → WelcomeInput（居中大对话框）
 *   clarifying → StudioLayout（左右分栏 · 追问）
 *   styling    → StudioLayout（左右分栏 · 风格选择）
 *   generating → GeneratingView（生成动画）
 *   result     → ResultView（结果定制 UI）
 *   decomposing→ DecomposeView（素材拆解）
 *   extracting → GeneratingView（提取动画复用）
 *   exported   → ExtractView（导出）
 */
import { useMaterialStudio } from './composables/use-material-studio';
import WelcomeInput from './components/WelcomeInput.vue';
import StudioLayout from './components/StudioLayout.vue';
import GeneratingView from './components/GeneratingView.vue';
import ResultView from './components/ResultView.vue';
import DecomposeView from './components/DecomposeView.vue';
import ExtractView from './components/ExtractView.vue';
import { usePageTracker } from '@/hooks/common/use-tracker';

usePageTracker('material-studio');

const { state, error, reset } = useMaterialStudio();
</script>

<template>
  <div class="material-studio">
    <!-- 顶部栏（非 welcome 阶段才显示） -->
    <div v-if="state.phase !== 'welcome'" class="toolbar">
      <div class="toolbar-left">
        <span class="toolbar-title">🎨 素材生成工作台</span>
        <div class="phase-tag">
          <template v-if="state.phase === 'clarifying'">需求收集</template>
          <template v-else-if="state.phase === 'styling'">风格选择</template>
          <template v-else-if="state.phase === 'generating'">生成中</template>
          <template v-else-if="state.phase === 'result'">生成完成</template>
          <template v-else-if="state.phase === 'decomposing'">素材拆解</template>
          <template v-else-if="state.phase === 'extracting'">素材提取</template>
          <template v-else-if="state.phase === 'exported'">导出就绪</template>
        </div>
      </div>
      <NButton size="small" quaternary @click="reset">
        🔄 重新开始
      </NButton>
    </div>

    <!-- 全局错误提示 -->
    <NAlert
      v-if="error"
      type="error"
      :title="error"
      closable
      style="margin-bottom: 8px; flex-shrink: 0"
      @close="error = ''"
    />

    <!-- 主内容区 -->
    <div class="main-content">
      <!-- 初始欢迎 -->
      <WelcomeInput v-if="state.phase === 'welcome'" />

      <!-- 追问 / 风格选择 -->
      <StudioLayout v-else-if="state.phase === 'clarifying' || state.phase === 'styling'" />

      <!-- 生成中 / 提取中 -->
      <GeneratingView v-else-if="state.phase === 'generating' || state.phase === 'extracting'" />

      <!-- 结果页 -->
      <ResultView v-else-if="state.phase === 'result'" />

      <!-- 素材拆解 -->
      <DecomposeView v-else-if="state.phase === 'decomposing'" />

      <!-- 导出完成 -->
      <ExtractView v-else-if="state.phase === 'exported'" />
    </div>
  </div>
</template>

<style scoped>
.material-studio {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
  padding: 4px 0;
}

/* 顶部工具栏 */
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 10px;
  flex-shrink: 0;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.toolbar-title {
  font-weight: 700;
  font-size: 15px;
  white-space: nowrap;
}

.phase-tag {
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 12px;
  color: #7c5cfc;
  background: rgba(124, 92, 252, 0.08);
  border: 1px solid rgba(124, 92, 252, 0.2);
  font-weight: 600;
}

/* 主内容区 */
.main-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
</style>
