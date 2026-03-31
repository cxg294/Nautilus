<script setup lang="ts">
/**
 * WelcomeInput — 初始欢迎界面
 *
 * 居中大对话框，类似 Google Stitch
 * - 大标题"今天想做点什么？"
 * - 输入框 + 上传图片 + 发送按钮
 * - 比例选择器
 */
import { ref } from 'vue';
import { useMaterialStudio } from '../composables/use-material-studio';
import AspectRatioSelector from './AspectRatioSelector.vue';

const { state, setRefImage, sendMessage } = useMaterialStudio();

const fileInput = ref<HTMLInputElement | null>(null);

function triggerUpload() {
  fileInput.value?.click();
}

function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0] || null;
  setRefImage(file);
}

function removeImage() {
  setRefImage(null);
  if (fileInput.value) fileInput.value.value = '';
}

function handleSubmit() {
  if (!state.inputText.trim()) return;
  const msg = state.inputText;
  state.inputText = '';
  sendMessage(msg);
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSubmit();
  }
}
</script>

<template>
  <div class="welcome-container">
    <!-- 装饰背景 -->
    <div class="welcome-bg">
      <div class="bg-orb bg-orb-1" />
      <div class="bg-orb bg-orb-2" />
      <div class="bg-orb bg-orb-3" />
    </div>

    <div class="welcome-content">
      <!-- 大标题 -->
      <h1 class="welcome-title">
        <span class="title-gradient">今天想做点什么？</span>
      </h1>
      <p class="welcome-subtitle">描述你想要的画面，AI 帮你生成专业素材</p>

      <!-- 参考图预览 -->
      <div v-if="state.refImagePreview" class="ref-preview">
        <img :src="state.refImagePreview" alt="参考图" class="ref-thumb" />
        <button class="ref-remove" @click="removeImage">✕</button>
        <span class="ref-label">参考图</span>
      </div>

      <!-- 输入框区域 -->
      <div class="input-box">
        <!-- 上传按钮 -->
        <button class="upload-btn" title="上传参考图" @click="triggerUpload">
          <span class="upload-icon">＋</span>
        </button>
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          style="display: none"
          @change="handleFileChange"
        />

        <!-- 文本输入 -->
        <textarea
          v-model="state.inputText"
          class="text-input"
          placeholder="描述你想要的画面内容、氛围和用途..."
          rows="2"
          @keydown="handleKeydown"
        />

        <!-- 发送按钮 -->
        <button
          class="send-btn"
          :class="{ active: state.inputText.trim() }"
          :disabled="!state.inputText.trim()"
          @click="handleSubmit"
        >
          <span class="send-icon">↑</span>
        </button>
      </div>

      <!-- 比例选择 -->
      <div class="options-row">
        <AspectRatioSelector v-model="state.aspectRatio" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.welcome-container {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

/* 装饰背景光斑 */
.welcome-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.bg-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.15;
}

.bg-orb-1 {
  width: 300px;
  height: 300px;
  background: #7c5cfc;
  top: 10%;
  left: 20%;
  animation: float 8s ease-in-out infinite;
}

.bg-orb-2 {
  width: 250px;
  height: 250px;
  background: #36d1dc;
  bottom: 20%;
  right: 15%;
  animation: float 10s ease-in-out infinite reverse;
}

.bg-orb-3 {
  width: 200px;
  height: 200px;
  background: #f093fb;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  animation: float 12s ease-in-out infinite;
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-20px); }
}

/* 内容区 */
.welcome-content {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 640px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 0 20px;
}

/* 标题 */
.welcome-title {
  margin: 0;
  font-size: 32px;
  font-weight: 700;
  letter-spacing: -0.5px;
}

.title-gradient {
  background: linear-gradient(135deg, #b8a5ff 0%, #7c5cfc 40%, #36d1dc 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.welcome-subtitle {
  margin: -8px 0 0;
  font-size: 14px;
  color: #888;
}

/* 参考图预览 */
.ref-preview {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.ref-thumb {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 8px;
}

.ref-remove {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #ff4757;
  color: #fff;
  border: none;
  font-size: 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ref-label {
  font-size: 11px;
  color: #999;
  padding-right: 8px;
}

/* 输入框 */
.input-box {
  width: 100%;
  display: flex;
  align-items: flex-end;
  gap: 0;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  padding: 8px;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.input-box:focus-within {
  border-color: rgba(124, 92, 252, 0.4);
  box-shadow: 0 0 0 3px rgba(124, 92, 252, 0.08);
}

.upload-btn {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  border: 2px dashed rgba(255, 255, 255, 0.15);
  background: transparent;
  color: #888;
  font-size: 22px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.upload-btn:hover {
  border-color: rgba(124, 92, 252, 0.4);
  color: #b8a5ff;
  background: rgba(124, 92, 252, 0.06);
}

.upload-icon {
  line-height: 1;
}

.text-input {
  flex: 1;
  border: none;
  background: transparent;
  color: #e0e0e0;
  font-size: 15px;
  line-height: 1.5;
  padding: 8px 12px;
  resize: none;
  outline: none;
  font-family: inherit;
}

.text-input::placeholder {
  color: #666;
}

.send-btn {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  border: none;
  background: rgba(255, 255, 255, 0.06);
  color: #666;
  font-size: 18px;
  cursor: not-allowed;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.send-btn.active {
  background: #7c5cfc;
  color: #fff;
  cursor: pointer;
}

.send-btn.active:hover {
  background: #6a4ae8;
}

.send-icon {
  font-weight: 700;
}

/* 选项行 */
.options-row {
  display: flex;
  justify-content: center;
}
</style>
