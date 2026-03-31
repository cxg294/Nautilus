<script setup lang="ts">
/**
 * ResultView — 结果页定制 UI
 *
 * 图片预览 + 操作控件
 */
import { ref } from 'vue';
import { useMaterialStudio } from '../composables/use-material-studio';

const { state, regenerate, changeStyle, analyzeImage, downloadFile } = useMaterialStudio();

const showPrompt = ref(false);
</script>

<template>
  <div class="result-view">
    <!-- 左侧：图片预览 -->
    <div class="result-preview">
      <div class="preview-frame">
        <img :src="state.imageUrl" alt="生成结果" class="preview-img" />
      </div>
    </div>

    <!-- 右侧：操作面板 -->
    <div class="result-actions">
      <div class="actions-header">
        <span class="actions-icon">🎉</span>
        <span class="actions-title">生成完成</span>
      </div>

      <p v-if="state.promptSummary" class="result-summary">{{ state.promptSummary }}</p>

      <!-- 操作按钮组 -->
      <div class="action-group">
        <button class="action-btn primary" @click="analyzeImage" :disabled="state.analyzeLoading">
          <span class="btn-icon">🔍</span>
          <span class="btn-text">
            {{ state.analyzeLoading ? '识别中...' : '素材拆解' }}
          </span>
          <span class="btn-hint">AI 识别前景元素</span>
        </button>

        <button class="action-btn" @click="regenerate" :disabled="state.generateLoading">
          <span class="btn-icon">🔄</span>
          <span class="btn-text">重新生成</span>
          <span class="btn-hint">相同描述，不同结果</span>
        </button>

        <button class="action-btn" @click="changeStyle">
          <span class="btn-icon">🎨</span>
          <span class="btn-text">更换风格</span>
          <span class="btn-hint">保留描述，换个风格</span>
        </button>

        <button class="action-btn" @click="downloadFile(state.imageUrl, 'original.png')">
          <span class="btn-icon">📥</span>
          <span class="btn-text">下载原图</span>
          <span class="btn-hint">保存当前生成的图片</span>
        </button>
      </div>

      <!-- 生成信息折叠 -->
      <div class="prompt-section">
        <button class="prompt-toggle" @click="showPrompt = !showPrompt">
          <span>📋 生成信息</span>
          <span class="toggle-arrow" :class="{ open: showPrompt }">▸</span>
        </button>
        <div v-if="showPrompt" class="prompt-content">
          <p class="prompt-label">Enhanced Prompt:</p>
          <p class="prompt-text">{{ state.enhancedPrompt }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.result-view {
  height: 100%;
  display: flex;
  gap: 20px;
  overflow: hidden;
}

/* 图片预览 */
.result-preview {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.preview-frame {
  max-width: 100%;
  max-height: 100%;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.preview-img {
  display: block;
  max-width: 100%;
  max-height: calc(100vh - 180px);
  object-fit: contain;
}

/* 操作面板 */
.result-actions {
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 14px;
  overflow-y: auto;
}

.actions-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.actions-icon {
  font-size: 20px;
}

.actions-title {
  font-size: 16px;
  font-weight: 600;
  color: #ddd;
}

.result-summary {
  font-size: 13px;
  color: #999;
  margin: 0;
  line-height: 1.5;
}

/* 操作按钮 */
.action-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  cursor: pointer;
  transition: all 0.2s;
  text-align: left;
  position: relative;
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.12);
  transform: translateX(2px);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.action-btn.primary {
  background: rgba(124, 92, 252, 0.08);
  border-color: rgba(124, 92, 252, 0.2);
}

.action-btn.primary:hover {
  background: rgba(124, 92, 252, 0.15);
  border-color: rgba(124, 92, 252, 0.3);
}

.btn-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.btn-text {
  font-size: 13px;
  font-weight: 600;
  color: #ddd;
}

.btn-hint {
  position: absolute;
  right: 12px;
  font-size: 11px;
  color: #777;
}

/* 生成信息 */
.prompt-section {
  margin-top: auto;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding-top: 10px;
}

.prompt-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 6px 0;
  border: none;
  background: none;
  color: #888;
  font-size: 12px;
  cursor: pointer;
}

.toggle-arrow {
  transition: transform 0.2s;
}

.toggle-arrow.open {
  transform: rotate(90deg);
}

.prompt-content {
  padding: 8px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  margin-top: 6px;
}

.prompt-label {
  font-size: 11px;
  color: #777;
  margin: 0 0 4px;
}

.prompt-text {
  font-size: 11px;
  color: #aaa;
  line-height: 1.5;
  margin: 0;
  word-break: break-word;
}
</style>
