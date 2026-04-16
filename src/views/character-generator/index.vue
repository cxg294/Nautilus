<script setup lang="ts">
/**
 * Character Generator — 角色生成（test）主页面
 *
 * 阶段路由：
 *   welcome           → WelcomePanel（首页）
 *   generating         → GeneratingView（角色生成中）
 *   character_ready    → CharacterPreview（角色确认 + 造型选择）
 *   outfit_generating  → GeneratingView（造型生成中）
 *   outfit_result      → OutfitResult（造型结果）
 */
import { useCharacterGen } from './composables/use-character-gen';
import WelcomePanel from './components/WelcomePanel.vue';
import GeneratingView from './components/GeneratingView.vue';
import CharacterPreview from './components/CharacterPreview.vue';
import OutfitResult from './components/OutfitResult.vue';

const { state, error, reset } = useCharacterGen();
</script>

<template>
  <div class="character-generator">
    <!-- 顶部栏（非 welcome 阶段才显示） -->
    <div v-if="state.phase !== 'welcome'" class="toolbar">
      <div class="toolbar-left">
        <span class="toolbar-title">🎭 角色生成工作台</span>
        <div class="phase-tag">
          <template v-if="state.phase === 'generating'">角色生成中</template>
          <template v-else-if="state.phase === 'character_ready'">选择造型</template>
          <template v-else-if="state.phase === 'outfit_generating'">造型生成中</template>
          <template v-else-if="state.phase === 'outfit_result'">造型完成</template>
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
      <!-- 首页 -->
      <WelcomePanel v-if="state.phase === 'welcome'" />

      <!-- 生成中（角色 / 造型） -->
      <GeneratingView v-else-if="state.phase === 'generating' || state.phase === 'outfit_generating'" />

      <!-- 角色确认 + 造型选择 -->
      <CharacterPreview v-else-if="state.phase === 'character_ready'" />

      <!-- 造型结果 -->
      <OutfitResult v-else-if="state.phase === 'outfit_result'" />
    </div>
  </div>
</template>

<style scoped>
.character-generator {
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
