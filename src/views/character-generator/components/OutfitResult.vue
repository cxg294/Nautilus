<script setup lang="ts">
/**
 * OutfitResult — 造型结果展示
 */
import { useCharacterGen } from '../composables/use-character-gen';

const { state, backToOutfitSelect, changeCharacter } = useCharacterGen();

/** 下载造型图 */
function downloadOutfit() {
  if (!state.outfitImageUrl) return;
  const a = document.createElement('a');
  a.href = state.outfitImageUrl;
  a.download = `outfit_${Date.now()}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
</script>

<template>
  <div class="outfit-result">
    <!-- 左：角色原图 -->
    <div class="result-card">
      <div class="card-label">角色原图</div>
      <div class="card-image-wrap">
        <img :src="state.characterImageUrl" alt="角色" />
      </div>
    </div>

    <!-- 箭头 -->
    <div class="arrow-indicator">
      <span class="arrow">→</span>
    </div>

    <!-- 右：造型结果 -->
    <div class="result-card result-card--main">
      <div class="card-label">
        {{ state.outfitType === 'custom' ? '自定义造型' : state.outfitSelection }} 造型
      </div>
      <div class="card-image-wrap">
        <img :src="state.outfitImageUrl" alt="造型" />
      </div>
    </div>

    <!-- 底部操作 -->
    <div class="result-actions">
      <NButton size="small" quaternary @click="changeCharacter">
        🔄 重新开始
      </NButton>
      <NButton size="small" secondary @click="backToOutfitSelect">
        🎭 继续生成新造型
      </NButton>
      <NButton size="small" type="primary" @click="downloadOutfit">
        💾 下载造型图
      </NButton>
    </div>
  </div>
</template>

<style scoped>
.outfit-result {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  position: relative;
  padding: 24px;
  flex-wrap: wrap;
}

.result-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  max-width: 360px;
  width: 100%;
}

.card-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-color-3, #999);
}

.card-image-wrap {
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

.dark .card-image-wrap {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.08);
}

.result-card--main .card-image-wrap {
  border-color: rgba(124, 92, 252, 0.3);
  box-shadow: 0 4px 24px rgba(124, 92, 252, 0.1);
}

.card-image-wrap img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.arrow-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
}

.arrow {
  font-size: 32px;
  color: var(--text-color-3, #999);
  opacity: 0.5;
}

.result-actions {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 12px;
}
</style>
