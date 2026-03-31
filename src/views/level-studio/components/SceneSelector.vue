<script setup lang="ts">
/**
 * SceneSelector — 双图候选选择
 */
import { useLevelStudio } from '../composables/use-level-studio';

const emit = defineEmits<{
  openInpaint: [url: string];
}>();

const { state, selectScene, analyzeScene, generateScenes } = useLevelStudio();

function handleSelect(url: string) {
  selectScene(url);
}

async function handleConfirm() {
  await analyzeScene();
}
</script>

<template>
  <div class="scene-selector">
    <div class="section-header">
      <h3>🖼️ 选择场景</h3>
      <p class="hint">AI 沿两个方向各生成了一张候选，选择你更满意的</p>
    </div>

    <div class="candidates">
      <div
        class="candidate-card"
        :class="{ selected: state.selectedScene === state.sceneA }"
        @click="handleSelect(state.sceneA)"
      >
        <div class="card-badge">方向 A · {{ state.directionA }}</div>
        <img v-if="state.sceneA" :src="state.sceneA" alt="候选 A" class="candidate-img" />
        <div class="card-check">
          <NRadio :checked="state.selectedScene === state.sceneA" />
        </div>
      </div>
      <div
        class="candidate-card"
        :class="{ selected: state.selectedScene === state.sceneB }"
        @click="handleSelect(state.sceneB)"
      >
        <div class="card-badge">方向 B · {{ state.directionB }}</div>
        <img v-if="state.sceneB" :src="state.sceneB" alt="候选 B" class="candidate-img" />
        <div class="card-check">
          <NRadio :checked="state.selectedScene === state.sceneB" />
        </div>
      </div>
    </div>

    <div class="actions">
      <NButton quaternary size="small" @click="generateScenes" :loading="state.sceneLoading">
        🔄 都不满意，重新生成
      </NButton>
      <NButton
        v-if="state.selectedScene"
        quaternary
        size="small"
        @click="emit('openInpaint', state.selectedScene)"
      >
        🖌️ 局部重绘
      </NButton>
      <NButton
        type="primary"
        :disabled="!state.selectedScene"
        :loading="state.analyzeLoading"
        @click="handleConfirm"
      >
        🔍 识别元素并继续
      </NButton>
    </div>
  </div>
</template>

<style scoped>
.scene-selector {
  max-width: 860px;
  margin: 0 auto;
}

.section-header {
  margin-bottom: 16px;
}

.section-header h3 {
  margin: 0 0 4px;
  font-size: 16px;
}

.hint {
  font-size: 13px;
  color: var(--n-text-color-3, #999);
  margin: 0;
}

.candidates {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}

.candidate-card {
  position: relative;
  border: 2px solid var(--n-border-color, #e5e5e5);
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.25s;
}

.candidate-card:hover {
  border-color: rgba(124, 92, 252, 0.4);
  box-shadow: 0 4px 16px rgba(124, 92, 252, 0.1);
}

.candidate-card.selected {
  border-color: #7c5cfc;
  box-shadow: 0 4px 20px rgba(124, 92, 252, 0.2);
}

.card-badge {
  position: absolute;
  top: 8px;
  left: 8px;
  background: rgba(0, 0, 0, 0.65);
  color: #fff;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  z-index: 1;
}

.candidate-img {
  width: 100%;
  display: block;
  aspect-ratio: 4 / 3;
  object-fit: cover;
}

.card-check {
  position: absolute;
  bottom: 8px;
  right: 8px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  padding: 2px;
}

.actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}
</style>
