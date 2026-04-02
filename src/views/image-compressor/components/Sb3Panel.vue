<script setup lang="ts">
/**
 * SB3 压缩面板
 *
 * 功能：
 * 1. 上传 .sb3 文件并解析内部图片资源
 * 2. 显示资源列表（支持勾选/取消）
 * 3. 批量压缩选中图片
 * 4. 更新 project.json 引用后重新打包导出
 */
import { useI18n } from 'vue-i18n';
import { useSb3Compressor } from '../composables/use-sb3-compressor';

const { t } = useI18n();
const {
  isLoaded,
  isCompressing,
  isExporting,
  fileName,
  fileSize,
  assets,
  quality,
  compressibleCount,
  selectedCount,
  totalSaved,
  progressPercent,
  loadSb3,
  compressAssets,
  exportSb3,
  selectAll,
} = useSb3Compressor();

/** 处理文件上传 */
async function handleUpload(opts: { file: { file: File | null } }) {
  const file = opts.file.file;
  if (!file) return;

  try {
    await loadSb3(file);
  } catch (err) {
    console.error('SB3 加载失败:', err);
    window.$message?.error(String(err));
  }
}

/** 格式化文件大小 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
</script>

<template>
  <div class="sb3-panel">
    <!-- 未加载状态 -->
    <div v-if="!isLoaded" class="empty-state">
      <div class="empty-icon">🧩</div>
      <NH4 style="margin: 0">{{ t('page.imageCompressor.noSb3') }}</NH4>
      <NText depth="3" style="font-size: 13px">{{ t('page.imageCompressor.uploadDesc') }}</NText>
      <NUpload
        :show-file-list="false"
        accept=".sb3"
        :custom-request="() => {}"
        style="margin-top: 16px"
        @change="handleUpload"
      >
        <NButton type="primary">📂 {{ t('page.imageCompressor.sb3.uploadSb3') }}</NButton>
      </NUpload>
    </div>

    <!-- 已加载状态 -->
    <div v-else class="sb3-layout">
      <!-- 左侧：SB3 信息 + 设置 -->
      <div class="sb3-settings">
        <NCard :bordered="false" size="small">
          <template #header>
            <div class="card-header">🧩 SB3 {{ t('page.imageCompressor.settings') }}</div>
          </template>

          <NSpace vertical :size="12">
            <!-- 文件信息 -->
            <NDescriptions :column="1" label-placement="left" size="small" bordered>
              <NDescriptionsItem :label="t('page.imageCompressor.sb3.fileName')">
                <NTag type="info" size="small" round>{{ fileName }}</NTag>
              </NDescriptionsItem>
              <NDescriptionsItem :label="t('page.imageCompressor.sb3.fileSize')">
                {{ formatSize(fileSize) }}
              </NDescriptionsItem>
              <NDescriptionsItem :label="t('page.imageCompressor.sb3.imageCount')">
                {{ compressibleCount }}
                <NText v-if="assets.filter(a => a.isSvg).length > 0" depth="3" style="font-size: 12px">
                  (+{{ assets.filter(a => a.isSvg).length }} SVG)
                </NText>
              </NDescriptionsItem>
            </NDescriptions>

            <!-- 质量滑块 -->
            <div class="setting-item">
              <NText class="setting-label">
                {{ t('page.imageCompressor.sb3.compressQuality') }}
                <NTag size="tiny" round>{{ Math.round(quality * 100) }}%</NTag>
              </NText>
              <NSlider
                v-model:value="quality"
                :min="0.1"
                :max="1"
                :step="0.05"
                :format-tooltip="(v: number) => `${Math.round(v * 100)}%`"
              />
            </div>

            <!-- 选择操作 -->
            <NSpace :size="6">
              <NButton size="small" quaternary @click="selectAll(true)">
                {{ t('page.imageCompressor.sb3.selectAll') }}
              </NButton>
              <NButton size="small" quaternary @click="selectAll(false)">
                {{ t('page.imageCompressor.sb3.deselectAll') }}
              </NButton>
            </NSpace>

            <!-- 操作按钮 -->
            <NButton
              block
              type="primary"
              :loading="isCompressing"
              :disabled="selectedCount === 0"
              @click="compressAssets"
            >
              🚀 {{ t('page.imageCompressor.sb3.startCompress') }}
              ({{ selectedCount }})
            </NButton>

            <!-- 进度条 -->
            <NProgress
              v-if="isCompressing"
              type="line"
              :percentage="progressPercent"
              status="info"
              processing
            />

            <!-- 导出按钮 -->
            <NButton
              block
              type="success"
              :loading="isExporting"
              :disabled="totalSaved <= 0"
              @click="exportSb3"
            >
              💾 {{ t('page.imageCompressor.sb3.exportSb3') }}
            </NButton>

            <!-- 总计节省 -->
            <div v-if="totalSaved > 0" class="saved-info">
              <NText type="success" strong>
                {{ t('page.imageCompressor.sb3.totalSaved') }}: {{ formatSize(totalSaved) }}
              </NText>
            </div>

            <!-- 重新上传 -->
            <NUpload
              :show-file-list="false"
              accept=".sb3"
              :custom-request="() => {}"
              @change="handleUpload"
            >
              <NButton block quaternary size="small">
                🔄 {{ t('page.imageCompressor.sb3.uploadSb3') }}
              </NButton>
            </NUpload>
          </NSpace>
        </NCard>
      </div>

      <!-- 右侧：资源列表 -->
      <div class="sb3-assets">
        <NCard :bordered="false" size="small">
          <template #header>
            <div class="card-header">
              <span>🎨 {{ t('page.imageCompressor.sb3.imageCount') }}</span>
              <NTag type="info" size="small" round>{{ assets.length }}</NTag>
            </div>
          </template>

          <div class="asset-list">
            <div
              v-for="asset in assets"
              :key="asset.zipPath"
              class="asset-item"
              :class="{ 'is-svg': asset.isSvg, 'is-done': asset.status === 'done' }"
            >
              <!-- 选择框 -->
              <NCheckbox
                :checked="asset.selected"
                :disabled="asset.isSvg"
                @update:checked="(v: boolean) => asset.selected = v"
              />

              <!-- 预览缩略图 -->
              <div class="asset-thumb">
                <img :src="asset.previewUrl" :alt="asset.zipPath" />
              </div>

              <!-- 文件信息 -->
              <div class="asset-info">
                <NText class="asset-name" :title="asset.zipPath">
                  {{ asset.zipPath }}
                </NText>
                <div class="asset-size">
                  <NText depth="3" style="font-size: 12px">{{ formatSize(asset.originalSize) }}</NText>
                  <template v-if="asset.status === 'done'">
                    <span class="arrow">→</span>
                    <NText type="success" style="font-size: 12px; font-weight: 600">
                      {{ formatSize(asset.compressedSize) }}
                    </NText>
                    <NText type="success" style="font-size: 11px">
                      (-{{ ((asset.originalSize - asset.compressedSize) / asset.originalSize * 100).toFixed(1) }}%)
                    </NText>
                  </template>
                </div>
              </div>

              <!-- 状态 -->
              <NTag
                :type="asset.isSvg ? 'default' : asset.status === 'done' ? 'success' : asset.status === 'compressing' ? 'info' : 'default'"
                size="tiny"
                round
              >
                {{ asset.isSvg ? 'SVG' : asset.status === 'done' ? '✓' : asset.status === 'compressing' ? '...' : '—' }}
              </NTag>
            </div>
          </div>
        </NCard>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sb3-panel {
  height: 100%;
  overflow: hidden;
}

.sb3-layout {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 16px;
  height: 100%;
  min-height: 0;
}

.sb3-settings {
  overflow-y: auto;
}

.sb3-assets {
  overflow-y: auto;
  min-height: 0;
}

.card-header {
  font-size: 15px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.setting-label {
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
}

.saved-info {
  text-align: center;
  padding: 8px;
  background: var(--n-color-target, rgba(24, 160, 88, 0.08));
  border-radius: 8px;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  text-align: center;
  border: 2px dashed var(--n-border-color, #e0e0e6);
  border-radius: 12px;
  padding: 40px;
  transition: border-color 0.3s;
}

.empty-state:hover {
  border-color: var(--n-primary-color, #18a058);
}

.empty-icon {
  font-size: 56px;
  margin-bottom: 12px;
}

/* 资源列表 */
.asset-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.asset-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--n-border-color, #e0e0e6);
  border-radius: 8px;
  transition: all 0.2s;
}

.asset-item:hover {
  background: var(--n-color-hover, rgba(0, 0, 0, 0.02));
}

.asset-item.is-svg {
  opacity: 0.5;
}

.asset-item.is-done {
  border-color: var(--n-success-color, #18a058);
  background: rgba(24, 160, 88, 0.04);
}

.asset-thumb {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  overflow: hidden;
  flex-shrink: 0;
  background: repeating-conic-gradient(#f0f0f4 0% 25%, transparent 0% 50%) 50% / 8px 8px;
}

.asset-thumb img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.asset-info {
  flex: 1;
  min-width: 0;
}

.asset-name {
  font-size: 12px;
  font-weight: 500;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.asset-size {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
}

.arrow {
  color: var(--n-text-color-3);
  font-size: 12px;
}

/* 响应式 */
@media (max-width: 768px) {
  .sb3-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto 1fr;
  }
}
</style>
