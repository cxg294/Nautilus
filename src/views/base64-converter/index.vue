<script setup lang="ts">
/**
 * Base64 编解码工具
 *
 * 功能：
 * - 文本 ↔ Base64 双向转换
 * - 文件 → Base64 转换（支持拖拽上传）
 * - Base64 → 文件下载
 * - 图片 Base64 实时预览
 * - URL 安全模式
 */
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { usePageTracker, useActionTracker } from '@/hooks/common/use-tracker';

usePageTracker('base64-converter');
const { trackAction } = useActionTracker('base64-converter');

const { t } = useI18n();

// ──── 模式切换 ────
const activeTab = ref<'text' | 'file'>('text');

// ──── 文本模式 ────
const textInput = ref('');
const base64Input = ref('');
const urlSafe = ref(false);
const autoSync = ref(true);

/** 文本 → Base64 */
function encodeText() {
  try {
    const encoded = btoa(unescape(encodeURIComponent(textInput.value)));
    base64Input.value = urlSafe.value
      ? encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
      : encoded;
    trackAction('encode', 'success');
  } catch {
    window.$message?.error(t('page.base64Converter.encodeFailed'));
  }
}

/** Base64 → 文本 */
function decodeBase64() {
  try {
    let input = base64Input.value;
    if (urlSafe.value) {
      input = input.replace(/-/g, '+').replace(/_/g, '/');
      // 补齐 padding
      while (input.length % 4) input += '=';
    }
    textInput.value = decodeURIComponent(escape(atob(input)));
    trackAction('decode', 'success');
  } catch {
    window.$message?.error(t('page.base64Converter.decodeFailed'));
  }
}

// 自动同步模式
watch(textInput, () => {
  if (autoSync.value && textInput.value) encodeText();
});

// ──── 文件模式 ────
const fileBase64 = ref('');
const fileName = ref('');
const fileSize = ref(0);
const fileType = ref('');
const isDragging = ref(false);
const isImageFile = ref(false);
const fileDataUrl = ref('');

function handleFileDrop(e: DragEvent) {
  e.preventDefault();
  isDragging.value = false;
  const file = e.dataTransfer?.files?.[0];
  if (file) processFile(file);
}

function handleFileInput(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) processFile(file);
  input.value = '';
}

function processFile(file: File) {
  fileName.value = file.name;
  fileSize.value = file.size;
  fileType.value = file.type;
  isImageFile.value = file.type.startsWith('image/');

  const reader = new FileReader();
  reader.onload = () => {
    const result = reader.result as string;
    // data:xxx;base64, 后面的部分
    const base64Part = result.split(',')[1] || '';
    fileBase64.value = base64Part;
    if (isImageFile.value) {
      fileDataUrl.value = result;
    } else {
      fileDataUrl.value = '';
    }
  };
  reader.readAsDataURL(file);
}

/** 从 Base64 下载文件 */
function downloadFromBase64() {
  if (!fileBase64.value) return;
  try {
    const binary = atob(fileBase64.value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: fileType.value || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.value || 'download';
    a.click();
    URL.revokeObjectURL(url);
  } catch {
    window.$message?.error(t('page.base64Converter.decodeFailed'));
  }
}

/** 复制到剪贴板 */
function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
  window.$message?.success(t('page.base64Converter.copied'));
}

/** 格式化文件大小 */
function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/** Base64 字符数统计 */
const base64Length = computed(() => {
  if (activeTab.value === 'text') return base64Input.value.length;
  return fileBase64.value.length;
});

const _base64SizeEstimate = computed(() => {
  // Base64 编码后大小约为原始大小的 4/3
  const len = base64Length.value;
  return formatSize(Math.ceil(len * 0.75));
});

/** 清空 */
function clearAll() {
  textInput.value = '';
  base64Input.value = '';
  fileBase64.value = '';
  fileName.value = '';
  fileSize.value = 0;
  fileType.value = '';
  isImageFile.value = false;
  fileDataUrl.value = '';
}
</script>

<template>
  <div class="base64-converter">
    <div class="main-layout">
      <!-- 左侧：输入 / 操作区 -->
      <NCard :bordered="false" class="card-wrapper" size="small">
        <template #header>
          <div class="panel-header">
            <span class="icon mdi mdi-code-braces header-icon" />
            <span>Base64 {{ t('page.base64Converter.converter') }}</span>
          </div>
        </template>

        <NTabs v-model:value="activeTab" type="segment" animated>
          <!-- 文本模式 -->
          <NTabPane name="text" :tab="t('page.base64Converter.textMode')">
            <div class="text-mode">
              <div class="text-area-group">
                <div class="text-area-header">
                  <span class="area-label">{{ t('page.base64Converter.plainText') }}</span>
                  <NButton quaternary size="tiny" @click="copyToClipboard(textInput)">
                    <template #icon><span class="icon mdi mdi-content-copy" /></template>
                  </NButton>
                </div>
                <NInput
                  v-model:value="textInput"
                  type="textarea"
                  :placeholder="t('page.base64Converter.enterText')"
                  :rows="6"
                  class="mono-input"
                />
              </div>

              <div class="action-row">
                <div class="action-options">
                  <NCheckbox v-model:checked="urlSafe">
                    {{ t('page.base64Converter.urlSafe') }}
                  </NCheckbox>
                  <NCheckbox v-model:checked="autoSync">
                    {{ t('page.base64Converter.autoSync') }}
                  </NCheckbox>
                </div>
                <div class="action-buttons">
                  <NButton type="primary" size="small" @click="encodeText">
                    {{ t('page.base64Converter.encode') }} ↓
                  </NButton>
                  <NButton type="info" size="small" @click="decodeBase64">
                    {{ t('page.base64Converter.decode') }} ↑
                  </NButton>
                  <NButton ghost size="small" @click="clearAll">
                    {{ t('page.base64Converter.clear') }}
                  </NButton>
                </div>
              </div>

              <div class="text-area-group">
                <div class="text-area-header">
                  <span class="area-label">Base64</span>
                  <NTag v-if="base64Input" size="tiny" type="info">
                    {{ base64Input.length }} chars
                  </NTag>
                  <NButton quaternary size="tiny" @click="copyToClipboard(base64Input)">
                    <template #icon><span class="icon mdi mdi-content-copy" /></template>
                  </NButton>
                </div>
                <NInput
                  v-model:value="base64Input"
                  type="textarea"
                  placeholder="Base64"
                  :rows="6"
                  class="mono-input"
                />
              </div>
            </div>
          </NTabPane>

          <!-- 文件模式 -->
          <NTabPane name="file" :tab="t('page.base64Converter.fileMode')">
            <div class="file-mode">
              <!-- 拖拽上传区 -->
              <div
                class="drop-zone"
                :class="{ dragging: isDragging }"
                @dragover.prevent="isDragging = true"
                @dragleave="isDragging = false"
                @drop="handleFileDrop"
                @click="($refs.fileInput as HTMLInputElement)?.click()"
              >
                <span class="icon mdi mdi-cloud-upload drop-icon" />
                <p class="drop-title">{{ t('page.base64Converter.dropFile') }}</p>
                <p class="drop-hint">{{ t('page.base64Converter.dropHint') }}</p>
                <input ref="fileInput" type="file" class="hidden-input" @change="handleFileInput" />
              </div>

              <!-- 文件信息 -->
              <NAlert v-if="fileName" type="info" :show-icon="false" class="file-info">
                <div class="file-info-row">
                  <span class="icon mdi mdi-file-outline file-icon" />
                  <div class="file-details">
                    <span class="file-name">{{ fileName }}</span>
                    <span class="file-meta">{{ fileType || 'unknown' }} · {{ formatSize(fileSize) }}</span>
                  </div>
                  <NTag size="tiny" type="success">
                    Base64: {{ formatSize(Math.ceil(fileBase64.length * 0.75)) }}
                  </NTag>
                </div>
              </NAlert>

              <!-- 图片预览 -->
              <div v-if="isImageFile && fileDataUrl" class="image-preview">
                <img :src="fileDataUrl" alt="preview" class="preview-img" />
              </div>

              <!-- 文件 Base64 输出 -->
              <div v-if="fileBase64" class="text-area-group">
                <div class="text-area-header">
                  <span class="area-label">Base64 {{ t('page.base64Converter.output') }}</span>
                  <NButton size="small" type="primary" ghost @click="copyToClipboard(fileBase64)">
                    <template #icon><span class="icon mdi mdi-content-copy" /></template>
                    {{ t('page.base64Converter.copyBase64') }}
                  </NButton>
                  <NButton size="small" type="info" ghost @click="copyToClipboard(fileDataUrl)">
                    {{ t('page.base64Converter.copyDataUrl') }}
                  </NButton>
                  <NButton size="small" ghost @click="downloadFromBase64">
                    <template #icon><span class="icon mdi mdi-download" /></template>
                    {{ t('page.base64Converter.download') }}
                  </NButton>
                </div>
                <NInput
                  v-model:value="fileBase64"
                  type="textarea"
                  :rows="6"
                  class="mono-input"
                  readonly
                />
              </div>
            </div>
          </NTabPane>
        </NTabs>
      </NCard>
    </div>
  </div>
</template>

<style scoped>
.base64-converter {
  height: 100%;
  overflow-y: auto;
}

.main-layout {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
}

.header-icon {
  font-size: 18px;
  opacity: 0.7;
}

/* ── 文本模式 ── */
.text-mode {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 12px;
}

.text-area-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.text-area-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.area-label {
  font-size: 13px;
  font-weight: 600;
  opacity: 0.7;
}

.mono-input :deep(textarea) {
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace !important;
  font-size: 13px;
}

.action-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-top: 1px solid rgba(128, 128, 128, 0.1);
  border-bottom: 1px solid rgba(128, 128, 128, 0.1);
}

.action-options {
  display: flex;
  align-items: center;
  gap: 16px;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

/* ── 文件模式 ── */
.file-mode {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 12px;
}

.drop-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  border: 2px dashed rgba(128, 128, 128, 0.2);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.25s ease;
  background: rgba(128, 128, 128, 0.02);
}

.drop-zone:hover,
.drop-zone.dragging {
  border-color: var(--primary-color);
  background: rgba(99, 102, 241, 0.05);
}

.drop-icon {
  font-size: 48px;
  opacity: 0.3;
  margin-bottom: 8px;
}

.drop-title {
  font-size: 15px;
  font-weight: 600;
  opacity: 0.7;
  margin: 0;
}

.drop-hint {
  font-size: 12px;
  opacity: 0.4;
  margin: 4px 0 0;
}

.hidden-input {
  display: none;
}

.file-info-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.file-icon {
  font-size: 24px;
  opacity: 0.5;
}

.file-details {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.file-name {
  font-weight: 600;
  font-size: 14px;
}

.file-meta {
  font-size: 12px;
  opacity: 0.5;
}

.image-preview {
  display: flex;
  justify-content: center;
  padding: 8px;
  background: repeating-conic-gradient(#f0f0f0 0% 25%, transparent 0% 50%) 50% / 16px 16px;
  border-radius: 8px;
  max-height: 200px;
  overflow: hidden;
}

.preview-img {
  max-width: 100%;
  max-height: 200px;
  object-fit: contain;
  border-radius: 4px;
}

/* ── 响应式 ── */
@media (max-width: 768px) {
  .action-row {
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }
}
</style>
