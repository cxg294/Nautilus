<script setup lang="ts">
/**
 * WelcomePanel — 首页：文本输入 + 参考图 + 上传角色
 */
import { useCharacterGen } from '../composables/use-character-gen';

const { state, error, setReferenceImage, createCharacter, uploadCharacter } = useCharacterGen();

/** 选择参考图 */
function onRefFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0] || null;
  setReferenceImage(file);
  input.value = '';
}

/** 移除参考图 */
function removeRef() {
  setReferenceImage(null);
}

/** 选择上传角色图 */
function onUploadCharacter() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = () => {
    const file = input.files?.[0];
    if (file) {
      uploadCharacter(file);
    }
  };
  input.click();
}

/** 回车发送 */
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    createCharacter();
  }
}
</script>

<template>
  <div class="welcome-panel">
    <div class="welcome-content">
      <!-- 标题 -->
      <div class="welcome-header">
        <div class="welcome-icon">🎭</div>
        <h1 class="welcome-title">角色生成工作台</h1>
        <p class="welcome-desc">描述你想要的角色，AI 将为你生成。也可以直接上传已有的角色图。</p>
      </div>

      <!-- 输入区域 -->
      <div class="input-area">
        <NInput
          v-model:value="state.characterPrompt"
          type="textarea"
          placeholder="描述你想要的角色，例如：一只穿蓝色斗篷的小狐狸，大眼睛，圆润可爱..."
          :autosize="{ minRows: 3, maxRows: 6 }"
          :disabled="state.loading"
          @keydown="onKeydown"
        />

        <!-- 参考图区域 -->
        <div class="ref-section">
          <div v-if="state.referencePreview" class="ref-preview">
            <img :src="state.referencePreview" alt="参考图" />
            <NButton size="tiny" circle quaternary class="ref-remove" @click="removeRef">
              ✕
            </NButton>
            <span class="ref-label">参考图</span>
          </div>
          <label v-else class="ref-upload-btn">
            <input type="file" accept="image/*" hidden @change="onRefFileChange" />
            <span class="ref-upload-icon">📎</span>
            <span>添加参考图（可选）</span>
          </label>
        </div>

        <!-- 操作按钮 -->
        <div class="action-row">
          <NButton
            type="primary"
            size="large"
            :disabled="!state.characterPrompt.trim() || state.loading"
            :loading="state.loading"
            @click="createCharacter"
          >
            ✨ 生成角色
          </NButton>
        </div>
      </div>

      <!-- 分隔线 -->
      <div class="divider">
        <span class="divider-line" />
        <span class="divider-text">或</span>
        <span class="divider-line" />
      </div>

      <!-- 上传角色图 -->
      <div class="upload-section">
        <NButton size="large" secondary :disabled="state.loading" @click="onUploadCharacter">
          📤 直接上传角色图
        </NButton>
        <p class="upload-hint">上传的图片将直接作为角色，跳过生成步骤</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.welcome-panel {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-y: auto;
}

.welcome-content {
  max-width: 560px;
  width: 100%;
  padding: 32px 24px;
}

.welcome-header {
  text-align: center;
  margin-bottom: 32px;
}

.welcome-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.welcome-title {
  font-size: 24px;
  font-weight: 700;
  margin: 0 0 8px;
}

.welcome-desc {
  font-size: 14px;
  color: var(--text-color-3, #999);
  margin: 0;
  line-height: 1.6;
}

.input-area {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ref-section {
  display: flex;
  align-items: center;
}

.ref-preview {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-radius: 8px;
  background: rgba(124, 92, 252, 0.06);
  border: 1px solid rgba(124, 92, 252, 0.15);
}

.ref-preview img {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  object-fit: cover;
}

.ref-remove {
  position: absolute;
  top: -6px;
  right: -6px;
  font-size: 10px;
}

.ref-label {
  font-size: 12px;
  color: #7c5cfc;
}

.ref-upload-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-color-3, #999);
  cursor: pointer;
  transition: all 0.2s;
}

.ref-upload-btn:hover {
  background: rgba(124, 92, 252, 0.06);
  color: #7c5cfc;
}

.ref-upload-icon {
  font-size: 16px;
}

.action-row {
  display: flex;
  justify-content: flex-end;
}

.divider {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 28px 0;
}

.divider-line {
  flex: 1;
  height: 1px;
  background: var(--border-color, #e5e5e5);
}

.dark .divider-line {
  background: rgba(255, 255, 255, 0.08);
}

.divider-text {
  font-size: 13px;
  color: var(--text-color-3, #999);
}

.upload-section {
  text-align: center;
}

.upload-hint {
  font-size: 12px;
  color: var(--text-color-3, #999);
  margin-top: 8px;
}
</style>
