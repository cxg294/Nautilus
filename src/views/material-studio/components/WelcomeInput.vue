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
import { STYLE_LIBRARY } from '../config/styles';
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

function handleGalleryClick(styleName: string) {
  if (state.inputText.trim()) {
    state.inputText += `，使用${styleName}风格`;
  } else {
    state.inputText = `使用${styleName}风格`;
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
        <NImage :src="state.refImagePreview" object-fit="cover" class="ref-thumb" preview-disabled />
        <NButton circle size="tiny" type="error" class="ref-remove" @click="removeImage">
          ✕
        </NButton>
        <span class="ref-label">参考图</span>
      </div>

      <!-- 输入框区域 -->
      <div class="input-container">
        <NInput
          v-model:value="state.inputText"
          type="textarea"
          placeholder="描述你想要的画面内容、氛围和用途..."
          :autosize="{ minRows: 2, maxRows: 6 }"
          size="large"
          class="main-input"
          @keydown="handleKeydown"
        >
          <template #prefix>
            <NButton quaternary circle @click="triggerUpload" title="上传参考图">
              <span style="font-size: 20px; font-weight: 300; line-height: 1;">＋</span>
            </NButton>
             <input
                ref="fileInput"
                type="file"
                accept="image/*"
                style="display: none"
                @change="handleFileChange"
              />
          </template>
          <template #suffix>
            <div class="flex items-end h-full pb-1">
              <NButton
                circle
                type="primary"
                :disabled="!state.inputText.trim()"
                @click="handleSubmit"
              >
                <span style="font-weight: 700; font-size: 16px;">↑</span>
              </NButton>
            </div>
          </template>
        </NInput>
      </div>

      <!-- 比例选择 -->
      <div class="options-row">
        <AspectRatioSelector v-model="state.aspectRatio" />
      </div>
    </div>

    <!-- 底部灵感画廊 (无限滚动展示 40 种风格) -->
    <div class="welcome-gallery">
      <div class="gallery-scroll">
        <div v-for="style in STYLE_LIBRARY" :key="style.id" class="gallery-item" @click="handleGalleryClick(style.name)">
          <img :src="`/images/styles/${style.id}.png`" loading="lazy" />
          <div class="gallery-item-name">{{ style.name }}</div>
        </div>
        <!-- 重复一份，实现无缝滚动 -->
        <div v-for="style in STYLE_LIBRARY" :key="style.id + '-copy'" class="gallery-item" @click="handleGalleryClick(style.name)">
          <img :src="`/images/styles/${style.id}.png`" loading="lazy" />
          <div class="gallery-item-name">{{ style.name }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.welcome-container {
  height: 100%;
  display: flex;
  flex-direction: column;
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
  opacity: 0.1;
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
  max-width: 680px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 0 20px;
}

/* 标题 */
.welcome-title {
  margin: 0;
  font-size: 36px;
  font-weight: 700;
  letter-spacing: -0.5px;
}

.title-gradient {
  background: linear-gradient(135deg, #7c5cfc 0%, #36d1dc 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.welcome-subtitle {
  margin: -8px 0 0;
  font-size: 15px;
  color: var(--n-text-color-3);
}

/* 参考图预览 */
.ref-preview {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 12px;
  background: var(--n-color-modal);
  border: 1px solid var(--n-border-color);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.ref-thumb {
  width: 60px;
  height: 60px;
  border-radius: 6px;
  overflow: hidden;
}

.ref-remove {
  position: absolute;
  top: -8px;
  right: -8px;
  z-index: 2;
}

.ref-label {
  font-size: 12px;
  color: var(--n-text-color-3);
  padding-right: 8px;
}

/* 输入框 */
.input-container {
  width: 100%;
  background: var(--n-color-modal);
  border-radius: 16px;
  padding: 4px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
  border: 1px solid var(--n-border-color);
  transition: box-shadow 0.3s ease;
}

.input-container:focus-within {
  box-shadow: 0 8px 30px rgba(124, 92, 252, 0.15);
  border-color: rgba(124, 92, 252, 0.4);
}

.main-input {
  background: transparent !important;
  border: none !important;
}

.main-input :deep(.n-input__border),
.main-input :deep(.n-input__state-border) {
  display: none;
}

.main-input :deep(.n-input-wrapper) {
  padding: 12px;
}

.main-input :deep(.n-input__textarea-el) {
  font-size: 16px;
  line-height: 1.6;
}

/* 选项行 */
.options-row {
  display: flex;
  justify-content: center;
  margin-top: 8px;
}

/* 底部画廊 */
.welcome-gallery {
  position: absolute;
  bottom: 40px;
  width: 100vw;
  overflow: hidden;
  height: 140px;
  display: flex;
  align-items: center;
  mask-image: linear-gradient(to right, transparent, black 15%, black 85%, transparent);
  -webkit-mask-image: linear-gradient(to right, transparent, black 15%, black 85%, transparent);
}

.gallery-scroll {
  display: flex;
  gap: 16px;
  width: max-content;
  animation: scroll-left 90s linear infinite;
}

.gallery-scroll:hover {
  animation-play-state: paused;
}

.gallery-item {
  position: relative;
  width: 120px;
  height: 120px;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  background: var(--n-color-modal);
  cursor: pointer;
}

.gallery-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.4s ease;
}

.gallery-item:hover img {
  transform: scale(1.1);
}

.gallery-item-name {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 24px 8px 8px;
  background: linear-gradient(transparent, rgba(0,0,0,0.8));
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  text-align: center;
  pointer-events: none;
}

@keyframes scroll-left {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
</style>
