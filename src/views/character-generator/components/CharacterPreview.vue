<script setup lang="ts">
/**
 * CharacterPreview — 角色预览/确认 + 造型选择入口
 */
import { useCharacterGen, EMOTION_OPTIONS, ACTION_OPTIONS } from '../composables/use-character-gen';
import type { OutfitType } from '../composables/use-character-gen';

const {
  state, error,
  selectOutfit, generateOutfit, changeCharacter,
} = useCharacterGen();

/** 选择预设选项 */
function onSelectPreset(type: OutfitType, label: string) {
  selectOutfit(type, label);
}

/** 自定义模式 */
function onSwitchCustom() {
  state.outfitType = 'custom';
  state.outfitSelection = '';
}

/** 生成 */
function onGenerate() {
  generateOutfit();
}
</script>

<template>
  <div class="character-ready">
    <!-- 左侧：角色预览 -->
    <div class="preview-side">
      <div class="preview-card">
        <img :src="state.characterImageUrl" alt="角色" class="character-img" />
      </div>
      <div class="preview-actions">
        <NButton size="small" quaternary @click="changeCharacter">
          🔄 更换角色
        </NButton>
      </div>
    </div>

    <!-- 右侧：造型选择 -->
    <div class="outfit-side">
      <h3 class="outfit-title">选择造型</h3>
      <p class="outfit-desc">为角色选择一个动作或情绪，AI 将生成对应的造型图</p>

      <!-- Tabs -->
      <NTabs v-model:value="state.outfitType" type="segment" size="small" class="outfit-tabs">
        <NTabPane name="emotion" tab="😊 情绪">
          <div class="option-grid">
            <div
              v-for="opt in EMOTION_OPTIONS"
              :key="opt.label"
              class="option-chip"
              :class="{ active: state.outfitType === 'emotion' && state.outfitSelection === opt.label }"
              @click="onSelectPreset('emotion', opt.label)"
            >
              <span class="chip-emoji">{{ opt.emoji }}</span>
              <span class="chip-label">{{ opt.label }}</span>
            </div>
          </div>
        </NTabPane>

        <NTabPane name="action" tab="💃 动作">
          <div class="option-grid">
            <div
              v-for="opt in ACTION_OPTIONS"
              :key="opt.label"
              class="option-chip"
              :class="{ active: state.outfitType === 'action' && state.outfitSelection === opt.label }"
              @click="onSelectPreset('action', opt.label)"
            >
              <span class="chip-emoji">{{ opt.emoji }}</span>
              <span class="chip-label">{{ opt.label }}</span>
            </div>
          </div>
        </NTabPane>

        <NTabPane name="custom" tab="✏️ 自定义">
          <NInput
            v-model:value="state.outfitCustomText"
            type="textarea"
            placeholder="描述你想要的造型，例如：双手举过头顶做出胜利的姿势..."
            :autosize="{ minRows: 3, maxRows: 5 }"
          />
        </NTabPane>
      </NTabs>

      <!-- 生成按钮 -->
      <div class="generate-row">
        <NButton
          type="primary"
          size="large"
          :disabled="state.outfitType === 'custom' ? !state.outfitCustomText.trim() : !state.outfitSelection"
          @click="onGenerate"
        >
          🎨 生成造型
        </NButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.character-ready {
  height: 100%;
  display: flex;
  gap: 24px;
  overflow: hidden;
}

/* 左侧预览 */
.preview-side {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding-top: 8px;
}

.preview-card {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 16px;
  overflow: hidden;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
}

.dark .preview-card {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.08);
}

.character-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.preview-actions {
  display: flex;
  gap: 8px;
}

/* 右侧造型 */
.outfit-side {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 8px 0;
}

.outfit-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 4px;
}

.outfit-desc {
  font-size: 13px;
  color: var(--text-color-3, #999);
  margin: 0 0 16px;
}

.outfit-tabs {
  margin-bottom: 16px;
}

/* 选项网格 */
.option-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  padding: 12px 0;
}

.option-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 8px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  background: rgba(0, 0, 0, 0.02);
  border: 2px solid transparent;
  user-select: none;
}

.dark .option-chip {
  background: rgba(255, 255, 255, 0.04);
}

.option-chip:hover {
  background: rgba(124, 92, 252, 0.06);
  border-color: rgba(124, 92, 252, 0.2);
}

.option-chip.active {
  background: rgba(124, 92, 252, 0.1);
  border-color: #7c5cfc;
}

.chip-emoji {
  font-size: 24px;
  line-height: 1;
}

.chip-label {
  font-size: 12px;
  font-weight: 500;
}

.generate-row {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
}
</style>
