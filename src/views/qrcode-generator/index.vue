<script setup lang="ts">
/**
 * 二维码生成工具
 *
 * 功能：
 * - 实时生成二维码（文本、URL、WiFi、邮件）
 * - 自定义颜色、大小、纠错等级
 * - 支持添加 Logo
 * - 导出为 PNG/SVG
 * - 批量生成
 */
import { ref, computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import QRCode from 'qrcode';
import { usePageTracker, useActionTracker } from '@/hooks/common/use-tracker';

usePageTracker('qrcode-generator');
const { trackAction } = useActionTracker('qrcode-generator');

const { t } = useI18n();

// ──── 输入内容 ────
const contentType = ref<'text' | 'url' | 'wifi' | 'email'>('text');
const textContent = ref('');
const urlContent = ref('https://');

// WiFi 参数
const wifiSSID = ref('');
const wifiPassword = ref('');
const wifiEncryption = ref<'WPA' | 'WEP' | 'nopass'>('WPA');
const wifiHidden = ref(false);

// 邮件参数
const emailTo = ref('');
const emailSubject = ref('');
const emailBody = ref('');

// ──── 样式设置 ────
const qrSize = ref(280);
const fgColor = ref('#000000');
const bgColor = ref('#FFFFFF');
const errorLevel = ref<'L' | 'M' | 'Q' | 'H'>('M');
const margin = ref(2);

// ──── Logo ────
const logoEnabled = ref(false);
const logoDataUrl = ref('');

// ──── 输出 ────
const qrDataUrl = ref('');

/** 根据内容类型生成最终文本 */
const finalContent = computed(() => {
  switch (contentType.value) {
    case 'url':
      return urlContent.value;
    case 'wifi':
      return `WIFI:T:${wifiEncryption.value};S:${wifiSSID.value};P:${wifiPassword.value};H:${wifiHidden.value ? 'true' : 'false'};;`;
    case 'email':
      return `mailto:${emailTo.value}?subject=${encodeURIComponent(emailSubject.value)}&body=${encodeURIComponent(emailBody.value)}`;
    default:
      return textContent.value;
  }
});

/** 生成二维码 */
async function generateQR() {
  const content = finalContent.value;
  if (!content || !content.trim()) {
    qrDataUrl.value = '';
    return;
  }

  try {
    const dataUrl = await QRCode.toDataURL(content, {
      width: qrSize.value,
      margin: margin.value,
      color: {
        dark: fgColor.value,
        light: bgColor.value
      },
      errorCorrectionLevel: errorLevel.value
    });

    if (logoEnabled.value && logoDataUrl.value) {
      // 在二维码中心叠加 Logo
      qrDataUrl.value = await addLogoToQR(dataUrl, logoDataUrl.value);
    } else {
      qrDataUrl.value = dataUrl;
    }
  } catch (err) {
    console.error('二维码生成失败:', err);
    window.$message?.error(t('page.qrcodeGenerator.generateFailed'));
  }
}

/** 在二维码上叠加 Logo */
function addLogoToQR(qrImgUrl: string, logoSrc: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return reject(new Error('Canvas not supported'));

    const qrImg = new Image();
    qrImg.onload = () => {
      canvas.width = qrImg.width;
      canvas.height = qrImg.height;
      ctx.drawImage(qrImg, 0, 0);

      const logoImg = new Image();
      logoImg.onload = () => {
        // Logo 占二维码的 20%
        const logoSize = Math.floor(qrImg.width * 0.2);
        const logoX = Math.floor((qrImg.width - logoSize) / 2);
        const logoY = Math.floor((qrImg.height - logoSize) / 2);

        // 绘制白色背景圆角矩形
        const padding = 4;
        const radius = 6;
        ctx.fillStyle = '#ffffff';
        roundRect(ctx, logoX - padding, logoY - padding, logoSize + padding * 2, logoSize + padding * 2, radius);
        ctx.fill();

        // 绘制 Logo
        ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
        resolve(canvas.toDataURL('image/png'));
      };
      logoImg.onerror = reject;
      logoImg.src = logoSrc;
    };
    qrImg.onerror = reject;
    qrImg.src = qrImgUrl;
  });
}

/** 绘制圆角矩形 */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/** 上传 Logo */
function handleLogoUpload(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    logoDataUrl.value = reader.result as string;
    generateQR();
  };
  reader.readAsDataURL(file);
  input.value = '';
}

/** 下载二维码 */
function downloadQR(format: 'png' | 'svg') {
  if (!finalContent.value.trim()) return;
  trackAction('download', 'success', { format });

  if (format === 'svg') {
    QRCode.toString(finalContent.value, {
      type: 'svg',
      width: qrSize.value,
      margin: margin.value,
      color: { dark: fgColor.value, light: bgColor.value },
      errorCorrectionLevel: errorLevel.value
    }).then(svg => {
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      downloadFile(url, 'qrcode.svg');
      URL.revokeObjectURL(url);
    });
  } else {
    if (!qrDataUrl.value) return;
    downloadFile(qrDataUrl.value, 'qrcode.png');
  }
}

function downloadFile(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}

/** 复制到剪贴板 */
async function copyQRImage() {
  if (!qrDataUrl.value) return;
  try {
    const res = await fetch(qrDataUrl.value);
    const blob = await res.blob();
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    window.$message?.success(t('page.qrcodeGenerator.copied'));
  } catch {
    window.$message?.error(t('page.qrcodeGenerator.copyFailed'));
  }
}

// ──── 批量生成 ────
const batchInput = ref('');
const batchResults = ref<{ text: string; dataUrl: string }[]>([]);
const isBatchGenerating = ref(false);

async function generateBatch() {
  const lines = batchInput.value.split('\n').filter(l => l.trim());
  if (lines.length === 0) return;

  isBatchGenerating.value = true;
  batchResults.value = [];

  for (const line of lines) {
    try {
      const dataUrl = await QRCode.toDataURL(line.trim(), {
        width: 200,
        margin: 1,
        color: { dark: fgColor.value, light: bgColor.value },
        errorCorrectionLevel: errorLevel.value
      });
      batchResults.value.push({ text: line.trim(), dataUrl });
    } catch {
      batchResults.value.push({ text: line.trim(), dataUrl: '' });
    }
  }

  isBatchGenerating.value = false;
  trackAction('batch_generate', 'success', { count: lines.length });
}

function downloadBatchItem(item: { text: string; dataUrl: string }) {
  if (!item.dataUrl) return;
  downloadFile(item.dataUrl, `qr-${item.text.slice(0, 20)}.png`);
}

// 监听参数变化自动重新生成
watch([finalContent, qrSize, fgColor, bgColor, errorLevel, margin, logoEnabled, logoDataUrl], () => {
  generateQR();
}, { immediate: true });

const errorLevelOptions = [
  { label: 'L (7%)', value: 'L' },
  { label: 'M (15%)', value: 'M' },
  { label: 'Q (25%)', value: 'Q' },
  { label: 'H (30%)', value: 'H' }
];

const encryptionOptions = [
  { label: 'WPA/WPA2', value: 'WPA' },
  { label: 'WEP', value: 'WEP' },
  { label: '无密码', value: 'nopass' }
];

const contentTypeOptions = [
  { label: '📝 文本', value: 'text' },
  { label: '🔗 URL', value: 'url' },
  { label: '📶 WiFi', value: 'wifi' },
  { label: '📧 邮件', value: 'email' }
];
</script>

<template>
  <div class="qrcode-generator">
    <div class="main-layout">
      <!-- 左侧：输入和设置 -->
      <div class="left-panel">
        <!-- 内容输入 -->
        <NCard :bordered="false" class="card-wrapper" size="small">
          <template #header>
            <div class="panel-header">
              <span class="icon mdi mdi-qrcode header-icon" />
              <span>{{ t('page.qrcodeGenerator.content') }}</span>
            </div>
          </template>

          <div class="content-section">
            <NRadioGroup v-model:value="contentType" class="content-type-group">
              <NRadioButton
                v-for="opt in contentTypeOptions"
                :key="opt.value"
                :value="opt.value"
                :label="opt.label"
              />
            </NRadioGroup>

            <!-- 文本输入 -->
            <NInput
              v-if="contentType === 'text'"
              v-model:value="textContent"
              type="textarea"
              :placeholder="t('page.qrcodeGenerator.enterText')"
              :rows="4"
            />

            <!-- URL 输入 -->
            <NInput
              v-if="contentType === 'url'"
              v-model:value="urlContent"
              :placeholder="t('page.qrcodeGenerator.enterUrl')"
              clearable
            >
              <template #prefix>
                <span class="icon mdi mdi-link" />
              </template>
            </NInput>

            <!-- WiFi 输入 -->
            <div v-if="contentType === 'wifi'" class="wifi-form">
              <NInput v-model:value="wifiSSID" :placeholder="t('page.qrcodeGenerator.wifiSSID')" />
              <NInput v-model:value="wifiPassword" :placeholder="t('page.qrcodeGenerator.wifiPassword')" type="password" show-password-on="click" />
              <NSelect v-model:value="wifiEncryption" :options="encryptionOptions" />
              <NCheckbox v-model:checked="wifiHidden">{{ t('page.qrcodeGenerator.wifiHidden') }}</NCheckbox>
            </div>

            <!-- 邮件输入 -->
            <div v-if="contentType === 'email'" class="email-form">
              <NInput v-model:value="emailTo" :placeholder="t('page.qrcodeGenerator.emailTo')" />
              <NInput v-model:value="emailSubject" :placeholder="t('page.qrcodeGenerator.emailSubject')" />
              <NInput v-model:value="emailBody" type="textarea" :placeholder="t('page.qrcodeGenerator.emailBody')" :rows="3" />
            </div>
          </div>
        </NCard>

        <!-- 样式设置 -->
        <NCard :bordered="false" class="card-wrapper" size="small">
          <template #header>
            <div class="panel-header">
              <span class="icon mdi mdi-palette header-icon" />
              <span>{{ t('page.qrcodeGenerator.style') }}</span>
            </div>
          </template>

          <div class="style-section">
            <div class="style-row">
              <span class="style-label">{{ t('page.qrcodeGenerator.size') }}</span>
              <NSlider v-model:value="qrSize" :min="100" :max="600" :step="10" class="style-slider" />
              <NTag size="tiny">{{ qrSize }}px</NTag>
            </div>
            <div class="style-row">
              <span class="style-label">{{ t('page.qrcodeGenerator.margin') }}</span>
              <NSlider v-model:value="margin" :min="0" :max="8" :step="1" class="style-slider" />
              <NTag size="tiny">{{ margin }}</NTag>
            </div>
            <div class="style-row">
              <span class="style-label">{{ t('page.qrcodeGenerator.errorLevel') }}</span>
              <NSelect v-model:value="errorLevel" :options="errorLevelOptions" class="style-select" size="small" />
            </div>
            <div class="color-row">
              <div class="color-item">
                <span class="style-label">{{ t('page.qrcodeGenerator.fgColor') }}</span>
                <input v-model="fgColor" type="color" class="color-picker" />
                <span class="color-value mono">{{ fgColor }}</span>
              </div>
              <div class="color-item">
                <span class="style-label">{{ t('page.qrcodeGenerator.bgColor') }}</span>
                <input v-model="bgColor" type="color" class="color-picker" />
                <span class="color-value mono">{{ bgColor }}</span>
              </div>
            </div>
            <div class="style-row">
              <NCheckbox v-model:checked="logoEnabled">{{ t('page.qrcodeGenerator.addLogo') }}</NCheckbox>
              <NButton v-if="logoEnabled" ghost size="tiny" @click="($refs.logoInput as HTMLInputElement)?.click()">
                {{ t('page.qrcodeGenerator.uploadLogo') }}
              </NButton>
              <input ref="logoInput" type="file" accept="image/*" class="hidden-input" @change="handleLogoUpload" />
            </div>
            <NAlert v-if="logoEnabled" type="info" :show-icon="true" class="logo-hint">
              {{ t('page.qrcodeGenerator.logoHint') }}
            </NAlert>
          </div>
        </NCard>

        <!-- 批量生成 -->
        <NCard :bordered="false" class="card-wrapper" size="small">
          <template #header>
            <div class="panel-header">
              <span class="icon mdi mdi-format-list-bulleted header-icon" />
              <span>{{ t('page.qrcodeGenerator.batchGenerate') }}</span>
            </div>
          </template>
          <div class="batch-section">
            <NInput
              v-model:value="batchInput"
              type="textarea"
              :placeholder="t('page.qrcodeGenerator.batchPlaceholder')"
              :rows="3"
            />
            <NButton type="primary" size="small" :loading="isBatchGenerating" @click="generateBatch">
              {{ t('page.qrcodeGenerator.generateAll') }}
            </NButton>
            <div v-if="batchResults.length > 0" class="batch-grid">
              <div v-for="(item, i) in batchResults" :key="i" class="batch-item" @click="downloadBatchItem(item)">
                <img v-if="item.dataUrl" :src="item.dataUrl" class="batch-qr" />
                <span v-else class="batch-error">✕</span>
                <span class="batch-text">{{ item.text.length > 20 ? item.text.slice(0, 20) + '...' : item.text }}</span>
              </div>
            </div>
          </div>
        </NCard>
      </div>

      <!-- 右侧：预览 -->
      <div class="right-panel">
        <NCard :bordered="false" class="card-wrapper preview-card" size="small">
          <template #header>
            <div class="panel-header">
              <span class="icon mdi mdi-eye header-icon" />
              <span>{{ t('page.qrcodeGenerator.preview') }}</span>
            </div>
          </template>

          <div class="preview-section">
            <div
              class="qr-preview-area"
              :style="{ backgroundColor: bgColor }"
            >
              <img v-if="qrDataUrl" :src="qrDataUrl" class="qr-image" />
              <div v-else class="qr-placeholder">
                <span class="icon mdi mdi-qrcode-scan placeholder-icon" />
                <p>{{ t('page.qrcodeGenerator.emptyHint') }}</p>
              </div>
            </div>

            <div class="download-actions">
              <NButton type="primary" size="small" :disabled="!qrDataUrl" @click="downloadQR('png')">
                <template #icon><span class="icon mdi mdi-download" /></template>
                PNG
              </NButton>
              <NButton type="info" size="small" :disabled="!finalContent.trim()" @click="downloadQR('svg')">
                <template #icon><span class="icon mdi mdi-download" /></template>
                SVG
              </NButton>
              <NButton ghost size="small" :disabled="!qrDataUrl" @click="copyQRImage">
                <template #icon><span class="icon mdi mdi-content-copy" /></template>
                {{ t('page.qrcodeGenerator.copyImage') }}
              </NButton>
            </div>

            <!-- 编码内容预览 -->
            <NAlert v-if="finalContent.trim()" type="default" :show-icon="false" class="content-preview">
              <div class="content-preview-text mono">{{ finalContent }}</div>
            </NAlert>
          </div>
        </NCard>
      </div>
    </div>
  </div>
</template>

<style scoped>
.qrcode-generator {
  height: 100%;
  overflow-y: auto;
}

.main-layout {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 16px;
  min-height: 0;
}

.left-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
}

.right-panel {
  position: sticky;
  top: 0;
  align-self: start;
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

/* ── 内容输入 ── */
.content-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.content-type-group {
  width: 100%;
}

.wifi-form,
.email-form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* ── 样式设置 ── */
.style-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.style-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.style-label {
  font-size: 13px;
  opacity: 0.7;
  white-space: nowrap;
  min-width: 70px;
}

.style-slider {
  flex: 1;
}

.style-select {
  width: 140px;
}

.color-row {
  display: flex;
  gap: 24px;
}

.color-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.color-picker {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  padding: 0;
}

.color-value {
  font-size: 12px;
  opacity: 0.5;
}

.mono {
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
}

.hidden-input {
  display: none;
}

.logo-hint {
  font-size: 12px;
}

/* ── 预览区域 ── */
.preview-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.qr-preview-area {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 280px;
  border-radius: 12px;
  border: 1px solid rgba(128, 128, 128, 0.1);
  padding: 20px;
  transition: background-color 0.3s ease;
}

.qr-image {
  max-width: 100%;
  max-height: 320px;
  image-rendering: pixelated;
  border-radius: 4px;
}

.qr-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  opacity: 0.3;
}

.placeholder-icon {
  font-size: 64px;
}

.download-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
}

.content-preview {
  width: 100%;
  border-radius: 8px;
}

.content-preview-text {
  font-size: 12px;
  word-break: break-all;
  max-height: 80px;
  overflow-y: auto;
}

/* ── 批量生成 ── */
.batch-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.batch-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
}

.batch-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px;
  border-radius: 8px;
  border: 1px solid rgba(128, 128, 128, 0.1);
  cursor: pointer;
  transition: all 0.2s ease;
}

.batch-item:hover {
  border-color: var(--primary-color);
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.15);
}

.batch-qr {
  width: 100px;
  height: 100px;
  image-rendering: pixelated;
}

.batch-error {
  width: 100px;
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: #ef4444;
  opacity: 0.5;
}

.batch-text {
  font-size: 11px;
  opacity: 0.6;
  text-align: center;
  word-break: break-all;
}

/* ── 响应式 ── */
@media (max-width: 1024px) {
  .main-layout {
    grid-template-columns: 1fr;
  }
  .right-panel {
    position: static;
  }
}
</style>
