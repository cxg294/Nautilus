<script setup lang="ts">
/**
 * Level Studio — 关卡素材工作台 主页面
 *
 * 布局：左右双栏 始终保持，右侧面板内容随 phase 变化：
 *   input/scene/candidates → InputPanel（内含右侧复用面板）
 *   elements → ElementPanel 替换整个主区
 *   export   → ExportPanel
 */
import { ref } from 'vue';
import { useLevelStudio } from './composables/use-level-studio';
import InputPanel from './components/InputPanel.vue';
import ElementPanel from './components/ElementPanel.vue';
import InpaintModal from './components/InpaintModal.vue';
import ExportPanel from './components/ExportPanel.vue';

const { state, error, globalLoading, reset } = useLevelStudio();

const inpaintVisible = ref(false);
const inpaintTarget = ref('');

function openInpaint(imageUrl: string) {
  inpaintTarget.value = imageUrl;
  inpaintVisible.value = true;
}
</script>

<template>
  <div class="level-studio">
    <!-- 顶部操作栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <span class="toolbar-title">🎮 关卡素材工作台</span>
        <!-- 步骤指示器 -->
        <div class="step-pills">
          <div class="step-pill" :class="{ active: state.phase === 'input' || state.phase === 'scene' }">
            <span class="step-num">1</span> 输入需求
          </div>
          <div class="step-arrow">›</div>
          <div class="step-pill" :class="{ active: state.phase === 'elements' }">
            <span class="step-num">2</span> 处理元素
          </div>
          <div class="step-arrow">›</div>
          <div class="step-pill" :class="{ active: state.phase === 'export' }">
            <span class="step-num">3</span> 导出
          </div>
        </div>
      </div>
      <NButton v-if="state.phase !== 'input'" size="small" quaternary @click="reset">
        🔄 重新开始
      </NButton>
    </div>

    <!-- 全局错误提示 -->
    <NAlert v-if="error" type="error" :title="error" closable style="margin-bottom: 8px; flex-shrink: 0" @close="error = ''" />

    <!-- 主内容区 -->
    <div class="main-content">
      <!-- Phase 1+2：输入 + 候选选择（左右双栏，右侧内容由 InputPanel 的 rightPanelMode 控制） -->
      <InputPanel
        v-if="state.phase === 'input' || state.phase === 'scene'"
        @open-inpaint="openInpaint"
      />

      <!-- Phase 3：元素处理 -->
      <ElementPanel
        v-else-if="state.phase === 'elements'"
        @open-inpaint="openInpaint"
      />

      <!-- Phase 4：导出 -->
      <ExportPanel v-else-if="state.phase === 'export'" />
    </div>

    <!-- 局部重绘弹窗 -->
    <InpaintModal v-model:visible="inpaintVisible" :image-url="inpaintTarget" />

    <!-- 全局加载遮罩 -->
    <div v-if="globalLoading" class="global-loading">
      <NSpin size="large" />
    </div>
  </div>
</template>

<style scoped>
.level-studio {
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
  gap: 16px;
}

.toolbar-title {
  font-weight: 700;
  font-size: 15px;
  white-space: nowrap;
}

/* 步骤指示器 */
.step-pills {
  display: flex;
  align-items: center;
  gap: 4px;
}

.step-pill {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 12px;
  color: #999;
  background: var(--n-color-modal, #f5f5f5);
  border: 1px solid transparent;
  transition: all 0.2s;
}

.step-pill.active {
  color: #7c5cfc;
  background: rgba(124, 92, 252, 0.08);
  border-color: rgba(124, 92, 252, 0.2);
  font-weight: 600;
}

.step-num {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #ddd;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  color: #fff;
}

.step-pill.active .step-num {
  background: #7c5cfc;
}

.step-arrow {
  color: #ccc;
  font-size: 14px;
}

/* 主内容区 */
.main-content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* 全局加载遮罩 */
.global-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.15);
  border-radius: 8px;
  z-index: 10;
}
</style>
