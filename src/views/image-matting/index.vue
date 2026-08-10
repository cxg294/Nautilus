<script setup lang="ts">
import { computed, ref } from 'vue';
import { useMessage, type UploadFileInfo } from 'naive-ui';
import axios from 'axios';
import imageCompression from 'browser-image-compression';
import JSZip from 'jszip';
import ImageCompare from './components/ImageCompare.vue';
import { usePageTracker, useActionTracker } from '@/hooks/common/use-tracker';
import { getToken } from '@/store/modules/auth/shared';

usePageTracker('image-matting');
const { trackAction } = useActionTracker('image-matting');

interface MattingTask {
  id: string;
  file: File;
  originalUrl: string;
  resultUrl: string;
  resultType?: 'image' | 'gif';
  status: 'pending' | 'processing' | 'success' | 'error';
  errorMsg?: string;
  progress?: number;
  frameCount?: number;
}

const message = useMessage();
const tasks = ref<MattingTask[]>([]);
const selectedTaskId = ref<string>('');
const isProcessingAll = ref(false);
const showCompareModal = ref(false);
const activeCompareTask = ref<MattingTask | null>(null);

const successCount = computed(() => tasks.value.filter(t => t.status === 'success').length);
const gifCount = computed(() => tasks.value.filter(t => t.resultType === 'gif' || isGifTask(t)).length);
const pendingCount = computed(() => tasks.value.filter(t => t.status === 'pending').length);
const processingCount = computed(() => tasks.value.filter(t => t.status === 'processing').length);
const errorCount = computed(() => tasks.value.filter(t => t.status === 'error').length);

const getAuthHeaders = () => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const getProxyImageUrl = (url: string) => {
  const params = new URLSearchParams({ url });
  const token = getToken();
  if (token) params.set('_token', token);
  return `/api/image-matting/proxy-image?${params.toString()}`;
};

const isGifTask = (task: MattingTask) => task.file.type === 'image/gif' || /\.gif$/i.test(task.file.name);

const activeTask = computed(() => tasks.value.find(task => task.id === selectedTaskId.value) || tasks.value[0] || null);

const isLocalResultUrl = (url: string) => url.startsWith('/api/image-matting/output/');

const withAuthQuery = (url: string) => {
  const token = getToken();
  if (!token) return url;

  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}_token=${encodeURIComponent(token)}`;
};

const getResultDisplayUrl = (url: string) => {
  if (!url) return '';
  return isLocalResultUrl(url) ? withAuthQuery(url) : url;
};

const getResultDownloadUrl = (url: string) => {
  if (!url) return '';
  return isLocalResultUrl(url) ? withAuthQuery(url) : getProxyImageUrl(url);
};

const getResultExtension = (task: MattingTask) => (task.resultType === 'gif' ? 'gif' : 'png');

const getTaskStatusType = (status: MattingTask['status']): 'default' | 'info' | 'success' | 'error' => {
  const map: Record<MattingTask['status'], 'default' | 'info' | 'success' | 'error'> = {
    pending: 'default',
    processing: 'info',
    success: 'success',
    error: 'error'
  };
  return map[status];
};

const getTaskStatusLabel = (status: MattingTask['status']) => {
  const map: Record<MattingTask['status'], string> = {
    pending: '待处理',
    processing: '处理中',
    success: '已完成',
    error: '失败'
  };
  return map[status];
};

const handleUploadChange = (newFileList: UploadFileInfo[]) => {
  let firstAddedId = '';

  newFileList.forEach((fileInfo) => {
    if (fileInfo.file && !tasks.value.find(t => t.id === fileInfo.id)) {
      if (!firstAddedId) firstAddedId = fileInfo.id;
      tasks.value.push({
        id: fileInfo.id,
        file: fileInfo.file,
        originalUrl: URL.createObjectURL(fileInfo.file),
        resultUrl: '',
        status: 'pending'
      });
    }
  });

  if (!selectedTaskId.value && firstAddedId) {
    selectedTaskId.value = firstAddedId;
  } else if (!activeTask.value && tasks.value.length > 0) {
    selectedTaskId.value = tasks.value[0].id;
  }
};

const removeTask = (id: string) => {
  const index = tasks.value.findIndex(t => t.id === id);
  if (index > -1) {
    URL.revokeObjectURL(tasks.value[index].originalUrl);
    tasks.value.splice(index, 1);
    if (selectedTaskId.value === id) {
      selectedTaskId.value = tasks.value[Math.min(index, tasks.value.length - 1)]?.id || '';
    }
  }
};

const clearTasks = () => {
  tasks.value.forEach(task => URL.revokeObjectURL(task.originalUrl));
  tasks.value = [];
  selectedTaskId.value = '';
};

const selectTask = (task: MattingTask) => {
  selectedTaskId.value = task.id;
};

const processTask = async (task: MattingTask) => {
  if (task.status === 'success' || task.status === 'processing') return;
  task.status = 'processing';
  task.errorMsg = '';
  
  let fileToUpload = task.file;
  const isGif = isGifTask(task);
  if (!isGif) {
    try {
      const options = { maxSizeMB: 2.8, maxWidthOrHeight: 1999, useWebWorker: true };
      if (fileToUpload.size > 2.8 * 1024 * 1024 || await needsResizing(fileToUpload)) {
        fileToUpload = await imageCompression(fileToUpload, options);
      }
    } catch (err) {
      console.warn(`[Task ${task.id}] 预压缩失败，将原图上传`, err);
    }
  }

  const formData = new FormData();
  formData.append('image', fileToUpload, task.file.name);

  try {
    const response = await axios.post('/api/image-matting/segment', formData, {
      headers: { 'Content-Type': 'multipart/form-data', ...getAuthHeaders() },
      timeout: isGif ? 300000 : 45000
    });
    
    if (response.data.success) {
      task.resultUrl = response.data.url;
      task.resultType = response.data.type === 'gif' ? 'gif' : 'image';
      task.frameCount = response.data.frameCount;
      task.status = 'success';
    } else {
      task.status = 'error';
      task.errorMsg = response.data.error || response.data.msg || '处理失败';
    }
  } catch (error: any) {
    task.status = 'error';
    task.errorMsg = error.response?.data?.error || error.response?.data?.msg || '请求出错';
  }
};

// Queue system
const startAll = async () => {
  const pendingTasks = tasks.value.filter(t => t.status === 'pending' || t.status === 'error');
  if (pendingTasks.length === 0) {
    message.warning('没有等待处理的素材');
    return;
  }

  isProcessingAll.value = true;
  const hasGif = pendingTasks.some(isGifTask);
  message.info(`开始处理 ${pendingTasks.length} 个素材，请耐心等待...`);

  // GIF 会逐帧调用云端抠图，混合队列中降为串行，避免请求风暴。
  const MAX_CONCURRENT = hasGif ? 1 : 3;
  let i = 0;
  
  const worker = async () => {
    while (i < pendingTasks.length) {
      const task = pendingTasks[i++];
      await processTask(task);
    }
  };

  const workers = Array.from({ length: Math.min(MAX_CONCURRENT, pendingTasks.length) }, () => worker());
  await Promise.all(workers);

  isProcessingAll.value = false;
  const completedCount = tasks.value.filter(t => t.status === 'success').length;
  trackAction('batch_matting', completedCount === tasks.value.length ? 'success' : 'fail', { total: tasks.value.length, success: completedCount });
  if (completedCount === tasks.value.length) {
    message.success('全部抠图处理完成！');
  } else {
    message.warning(`处理结束，成功 ${completedCount}，失败 ${tasks.value.length - completedCount}`);
  }
};

// 辅助检测图片尺寸是否超出限制
function needsResizing(file: File): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      resolve(img.width > 1999 || img.height > 1999);
    };
    img.onerror = () => resolve(false);
  });
}

const handleDownloadSingle = (task: MattingTask) => {
  if (!task.resultUrl) return;
  const a = document.createElement('a');
  a.href = getResultDownloadUrl(task.resultUrl);
  const baseName = task.file.name.replace(/\.[^/.]+$/, '');
  a.download = `${baseName}_nobg.${getResultExtension(task)}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

const isDownloadingZip = ref(false);
const handleDownloadZip = async () => {
  const successTasks = tasks.value.filter(t => t.status === 'success');
  if (successTasks.length === 0) return message.warning('暂无成功的抠图结果！');
  
  isDownloadingZip.value = true;
  message.info('正在打包下载...');
  try {
    const zip = new JSZip();
    const folder = zip.folder('matting_results');
    
    // Batch fetch over proxy to avoid CORS
    const fetchPromises = successTasks.map(async (task, _index) => {
      const resultUrl = getResultDownloadUrl(task.resultUrl);
      const res = await axios.get(resultUrl, { responseType: 'blob', headers: getAuthHeaders() });
      // 生成安全的文件名
      const baseName = task.file.name.replace(/\.[^/.]+$/, '');
      folder?.file(`${baseName}_nobg.${getResultExtension(task)}`, res.data);
    });
    
    await Promise.all(fetchPromises);
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = `matting_batch_${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // 可选: 延时回收URL
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    message.success('批量下载成功！');
  } catch (error) {
    console.error('ZIP Error:', error);
    message.error('下载打包失败！(可能是由于网络或跨域原因)');
  } finally {
    isDownloadingZip.value = false;
  }
};

const openCompareModal = (task: MattingTask) => {
  if (task.resultType === 'gif') {
    message.info('GIF 结果可直接在卡片中预览和下载');
    return;
  }

  activeCompareTask.value = task;
  showCompareModal.value = true;
};
</script>

<template>
  <div class="image-matting-page" :class="{ 'image-matting-page--empty': tasks.length === 0 }">
    <section v-if="tasks.length === 0" class="empty-workspace">
      <div class="empty-panel">
        <div class="empty-copy">
          <span class="empty-icon">
            <SvgIcon icon="mdi:image-multiple-outline" />
          </span>
          <div>
            <p class="eyebrow">Image Matting</p>
            <h1>图片去背景</h1>
            <p class="empty-desc">拖入图片或 GIF，生成透明背景素材。</p>
          </div>
        </div>

        <div class="upload-zone upload-zone--empty">
          <NUpload
            multiple
            directory-dnd
            action=""
            :default-upload="false"
            :show-file-list="false"
            accept="image/*,.gif"
            @update:file-list="handleUploadChange"
          >
            <NUploadDragger>
              <div class="dragger-content dragger-content--empty">
                <span class="dragger-icon">
                  <SvgIcon icon="mdi:cloud-upload-outline" />
                </span>
                <NText class="dragger-title">点击或者拖动图片 / GIF 到此处</NText>
                <NText depth="3" class="dragger-hint">
                  静态图超出 3MB 会先本地压缩，GIF 最多 30 帧
                </NText>
              </div>
            </NUploadDragger>
          </NUpload>
        </div>
      </div>
    </section>

    <template v-else>
      <main class="matting-workspace">
        <aside class="pool-panel">
          <div class="pool-header">
            <div class="pool-heading">
              <div class="title-row">
                <span class="title-icon">
                  <SvgIcon icon="mdi:image-multiple-outline" />
                </span>
                <h1>图片池</h1>
              </div>
              <div class="status-line">
                <span>{{ tasks.length }} 个素材</span>
                <NTag v-if="pendingCount" size="small" round>{{ pendingCount }} 待处理</NTag>
                <NTag v-if="processingCount" type="info" size="small" round>{{ processingCount }} 处理中</NTag>
                <NTag v-if="successCount" type="success" size="small" round>{{ successCount }} 已完成</NTag>
                <NTag v-if="errorCount" type="error" size="small" round>{{ errorCount }} 失败</NTag>
                <NTag v-if="gifCount" type="info" size="small" round>GIF {{ gifCount }}</NTag>
              </div>
            </div>

            <div class="pool-actions">
              <NButton ghost size="small" @click="clearTasks">清空</NButton>
              <NButton
                v-if="tasks.filter(t => t.status === 'success').length > 1"
                type="success"
                size="small"
                tertiary
                :loading="isDownloadingZip"
                @click="handleDownloadZip"
              >
                <template #icon><SvgIcon icon="mdi:download-outline" /></template>
                ZIP 下载
              </NButton>
              <NButton type="primary" size="small" :loading="isProcessingAll" @click="startAll">
                <template #icon><SvgIcon icon="mdi:play-outline" /></template>
                批量处理
              </NButton>
            </div>
          </div>

          <div class="upload-zone upload-zone--pool">
            <NUpload
              multiple
              directory-dnd
              action=""
              :default-upload="false"
              :show-file-list="false"
              accept="image/*,.gif"
              @update:file-list="handleUploadChange"
            >
              <NUploadDragger>
                <div class="dragger-content dragger-content--pool">
                  <SvgIcon icon="mdi:plus-box-outline" />
                  <span>追加图片 / GIF</span>
                </div>
              </NUploadDragger>
            </NUpload>
          </div>

          <div class="pool-list">
            <article
              v-for="task in tasks"
              :key="task.id"
              class="pool-item"
              :class="[`pool-item--${task.status}`, { 'pool-item--active': activeTask?.id === task.id }]"
              role="button"
              tabindex="0"
              @click="selectTask(task)"
              @keydown.enter.prevent="selectTask(task)"
              @keydown.space.prevent="selectTask(task)"
            >
              <div class="pool-thumb" :class="{ 'bg-pattern': task.status === 'success' }">
                <img
                  :src="task.status === 'success' ? getResultDisplayUrl(task.resultUrl) : task.originalUrl"
                  :alt="task.file.name"
                  class="pool-thumb__image"
                />
                <span v-if="task.status === 'processing'" class="pool-thumb__veil">
                  <NSpin size="small" />
                </span>
              </div>

              <div class="pool-info">
                <div class="pool-name" :title="task.file.name">{{ task.file.name }}</div>
                <div class="pool-meta">
                  <NTag :type="getTaskStatusType(task.status)" size="tiny" round>
                    {{ getTaskStatusLabel(task.status) }}
                  </NTag>
                  <NTag v-if="task.resultType === 'gif' || isGifTask(task)" type="info" size="tiny" round>
                    GIF{{ task.frameCount ? ` · ${task.frameCount} 帧` : '' }}
                  </NTag>
                </div>
              </div>

              <NButton class="pool-remove" circle size="tiny" tertiary @click.stop="removeTask(task.id)">
                <template #icon><SvgIcon icon="mdi:close" /></template>
              </NButton>
            </article>
          </div>
        </aside>

        <section v-if="activeTask" class="preview-panel">
          <div class="preview-header">
            <div class="preview-heading">
              <div class="preview-kicker">效果展示</div>
              <div class="preview-title" :title="activeTask.file.name">{{ activeTask.file.name }}</div>
              <div class="preview-meta">
                <NTag :type="getTaskStatusType(activeTask.status)" size="small" round>
                  {{ getTaskStatusLabel(activeTask.status) }}
                </NTag>
                <NTag
                  v-if="activeTask.resultType === 'gif' || isGifTask(activeTask)"
                  type="info"
                  size="small"
                  round
                >
                  GIF{{ activeTask.frameCount ? ` · ${activeTask.frameCount} 帧` : '' }}
                </NTag>
              </div>
            </div>

            <div class="preview-actions">
              <NButton
                v-if="activeTask.status === 'success' && activeTask.resultType !== 'gif'"
                secondary
                @click="openCompareModal(activeTask)"
              >
                <template #icon><SvgIcon icon="mdi:eye-outline" /></template>
                精细对比
              </NButton>
              <NButton v-if="activeTask.status === 'success'" type="success" @click="handleDownloadSingle(activeTask)">
                <template #icon><SvgIcon icon="mdi:download-outline" /></template>
                下载结果
              </NButton>
            </div>
          </div>

          <div class="preview-stage" :class="{ 'bg-pattern': activeTask.status === 'success' }">
            <ImageCompare
              v-if="activeTask.status === 'success' && activeTask.resultType !== 'gif'"
              :original-src="activeTask.originalUrl"
              :result-src="getResultDisplayUrl(activeTask.resultUrl)"
            />

            <div v-else-if="activeTask.status === 'success'" class="gif-compare-grid">
              <div class="gif-preview-pane">
                <NTag size="small" round>原始 GIF</NTag>
                <img :src="activeTask.originalUrl" alt="original gif" />
              </div>
              <div class="gif-preview-pane bg-pattern">
                <NTag type="success" size="small" round>去背 GIF</NTag>
                <img :src="getResultDisplayUrl(activeTask.resultUrl)" alt="matting gif" />
              </div>
            </div>

            <div v-else class="source-preview">
              <img
                :src="activeTask.originalUrl"
                :alt="activeTask.file.name"
                :class="{ 'source-preview__image--muted': activeTask.status !== 'pending' }"
                class="source-preview__image"
              />
              <div v-if="activeTask.status !== 'pending'" class="source-state">
                <template v-if="activeTask.status === 'processing'">
                  <NSpin size="large" />
                  <div>
                    <div class="source-state__title">云端推理中</div>
                    <div class="source-state__desc">正在生成透明背景结果</div>
                  </div>
                </template>
                <template v-else-if="activeTask.status === 'error'">
                  <span class="error-icon">
                    <SvgIcon icon="mdi:alert-circle-outline" />
                  </span>
                  <div>
                    <div class="source-state__title">处理失败</div>
                    <div class="source-state__desc">{{ activeTask.errorMsg || '请求出错' }}</div>
                  </div>
                </template>
              </div>
            </div>
          </div>

          <div v-if="activeTask.status !== 'success'" class="preview-bottom-actions">
            <NButton
              type="primary"
              size="large"
              class="preview-primary-action"
              :loading="activeTask.status === 'processing'"
              :disabled="activeTask.status === 'processing'"
              @click="processTask(activeTask)"
            >
              <template #icon><SvgIcon icon="mdi:play-outline" /></template>
              {{ activeTask.status === 'error' ? '重新抠图' : activeTask.status === 'processing' ? '处理中' : '开始抠图' }}
            </NButton>
          </div>
        </section>
      </main>
    </template>

    <!-- 弹窗对比视图（多图模式下点击查看详情用） -->
    <NModal
      v-model:show="showCompareModal"
      preset="card"
      class="compare-modal"
      style="width: 90vw; max-width: 1100px;"
      :title="'细节对比: ' + (activeCompareTask?.file.name || '')"
    >
      <div v-if="activeCompareTask" class="compare-modal__body">
        <ImageCompare
          :original-src="activeCompareTask.originalUrl"
          :result-src="getResultDisplayUrl(activeCompareTask.resultUrl)"
        />
      </div>
    </NModal>
  </div>
</template>

<style scoped>
.image-matting-page {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 20px 24px;
  border-radius: 10px;
  background:
    linear-gradient(135deg, rgba(15, 118, 110, 0.06), transparent 32%),
    linear-gradient(315deg, rgba(59, 130, 246, 0.05), transparent 38%);
}

.image-matting-page--empty {
  justify-content: center;
}

.empty-workspace {
  flex: 1;
  min-height: 0;
  display: grid;
  place-items: center;
}

.empty-panel {
  width: min(720px, 100%);
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.empty-copy {
  display: flex;
  align-items: flex-start;
  gap: 18px;
}

.empty-icon,
.title-icon {
  color: #0f766e;
}

.empty-icon {
  width: 56px;
  height: 56px;
  flex: 0 0 56px;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  background: rgba(15, 118, 110, 0.1);
}

.empty-icon :deep(svg) {
  width: 30px;
  height: 30px;
}

.eyebrow {
  margin: 0 0 8px;
  color: var(--n-text-color-3);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  color: var(--n-text-color);
  font-size: 30px;
  line-height: 1.2;
}

.empty-desc {
  margin: 10px 0 0;
  color: var(--n-text-color-2);
  font-size: 15px;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.title-row h1 {
  margin: 0;
  font-size: 22px;
}

.title-icon {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.title-icon :deep(svg) {
  width: 24px;
  height: 24px;
}

.status-line,
.result-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.status-line {
  gap: 8px;
  margin-top: 8px;
  color: var(--n-text-color-2);
  font-size: 13px;
}

.upload-zone {
  flex-shrink: 0;
}

.upload-zone :deep(.n-upload-dragger) {
  background: var(--n-color-modal);
  border-radius: 12px;
  transition: border-color 0.2s ease, background 0.2s ease;
}

.upload-zone :deep(.n-upload-dragger:hover) {
  border-color: var(--primary-color);
  background: var(--n-action-color);
}

.upload-zone--empty :deep(.n-upload-dragger) {
  padding: 48px 24px;
}

.dragger-content {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--n-text-color-2);
}

.dragger-content--empty {
  flex-direction: column;
  gap: 8px;
  text-align: center;
}

.dragger-icon {
  width: 46px;
  height: 46px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #0f766e;
}

.dragger-icon :deep(svg) {
  width: 46px;
  height: 46px;
}

.dragger-title {
  font-size: 16px;
  font-weight: 600;
}

.dragger-hint {
  font-size: 13px;
}

.matting-workspace {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 16px;
}

.pool-panel,
.preview-panel {
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.74);
  backdrop-filter: blur(10px);
}

.pool-panel {
  width: clamp(560px, 44vw, 720px);
  flex: 0 0 clamp(560px, 44vw, 720px);
  padding: 16px;
  gap: 12px;
}

.pool-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.pool-heading {
  min-width: 0;
}

.pool-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}

.upload-zone--pool :deep(.n-upload-dragger) {
  padding: 12px 14px;
}

.dragger-content--pool {
  gap: 8px;
  justify-content: flex-start;
  font-size: 13px;
}

.dragger-content--pool :deep(svg) {
  width: 18px;
  height: 18px;
  color: #0f766e;
}

.pool-list {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  grid-auto-rows: max-content;
  align-content: start;
  align-items: start;
  gap: 12px;
  overflow-y: auto;
  padding-right: 2px;
}

.pool-item {
  position: relative;
  width: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  border: 1px solid rgba(148, 163, 184, 0.18);
  border-radius: 10px;
  color: inherit;
  text-align: left;
  background: rgba(255, 255, 255, 0.58);
  cursor: pointer;
  transition: border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
}

.pool-item:hover {
  border-color: rgba(15, 118, 110, 0.3);
  background: rgba(255, 255, 255, 0.9);
}

.pool-item:focus-visible {
  outline: 2px solid rgba(15, 118, 110, 0.42);
  outline-offset: 2px;
}

.pool-item--success {
  border-color: rgba(22, 163, 74, 0.34);
}

.pool-item--error {
  border-color: rgba(239, 68, 68, 0.42);
}

.pool-item--processing {
  border-color: rgba(59, 130, 246, 0.46);
}

.pool-item--active,
.pool-item--active:hover {
  border-color: rgba(15, 118, 110, 0.62);
  background: rgba(240, 253, 250, 0.78);
  box-shadow: 0 10px 24px rgba(15, 118, 110, 0.08);
}

.pool-thumb {
  position: relative;
  width: 100%;
  height: clamp(160px, 12vw, 210px);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 8px;
  background: rgba(148, 163, 184, 0.1);
}

.pool-thumb__image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.pool-thumb__veil {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.58);
}

.pool-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.pool-name {
  min-width: 0;
  overflow: hidden;
  color: var(--n-text-color);
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pool-meta {
  min-width: 0;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.pool-remove {
  position: absolute;
  top: 8px;
  right: 8px;
  opacity: 0;
  transition: opacity 0.18s ease;
}

.pool-item:hover .pool-remove,
.pool-item--active .pool-remove {
  opacity: 1;
}

.preview-panel {
  flex: 1;
  min-width: 0;
  padding: 16px;
  gap: 14px;
}

.preview-header {
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.preview-heading {
  min-width: 0;
}

.preview-kicker {
  margin-bottom: 6px;
  color: var(--n-text-color-3);
  font-size: 12px;
  font-weight: 700;
}

.preview-title {
  max-width: min(38vw, 680px);
  overflow: hidden;
  color: var(--n-text-color);
  font-size: 18px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.preview-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}

.preview-stage {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border: 1px solid rgba(148, 163, 184, 0.24);
  border-radius: 12px;
  background: var(--n-color);
}

.preview-bottom-actions {
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  padding-top: 2px;
}

.preview-primary-action {
  min-width: min(360px, 100%);
  height: 48px;
  font-size: 15px;
  font-weight: 700;
}

.preview-bottom-actions :deep(.n-button__content) {
  font-weight: 700;
}

.source-preview {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 420px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 22px;
}

.source-preview__image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  transition: opacity 0.2s ease, filter 0.2s ease;
}

.source-preview__image--muted {
  opacity: 0.42;
  filter: blur(1px);
}

.source-state {
  position: absolute;
  left: 50%;
  bottom: 28px;
  width: min(420px, calc(100% - 56px));
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 14px 16px;
  border: 1px solid rgba(148, 163, 184, 0.26);
  border-radius: 12px;
  color: var(--n-text-color);
  background: rgba(255, 255, 255, 0.88);
  box-shadow: 0 18px 42px rgba(15, 23, 42, 0.1);
  backdrop-filter: blur(12px);
}

.dark .pool-panel,
.dark .preview-panel,
.dark .pool-item,
.dark .gif-preview-pane,
.dark .source-state {
  background: rgba(24, 24, 28, 0.74);
}

.source-state__title {
  font-size: 14px;
  font-weight: 700;
}

.source-state__desc {
  margin-top: 3px;
  color: var(--n-text-color-3);
  font-size: 12px;
}

.error-icon {
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 26px;
  color: #ef4444;
}

.error-icon :deep(svg) {
  width: 26px;
  height: 26px;
}

.gif-compare-grid {
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  padding: 14px;
}

.gif-preview-pane {
  position: relative;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 42px 16px 16px;
  border: 1px solid rgba(148, 163, 184, 0.35);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.72);
}

.gif-preview-pane :deep(.n-tag) {
  position: absolute;
  top: 12px;
  left: 12px;
}

.gif-preview-pane img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.compare-modal {
  width: 90vw;
  max-width: 1100px;
}

.compare-modal__body {
  width: 100%;
  height: 70vh;
  min-height: 500px;
  overflow: hidden;
  border-radius: 10px;
}

.bg-pattern {
  background-color: #f8fafc;
  background-image: repeating-conic-gradient(#e5e7eb 0 25%, transparent 0 50%);
  background-size: 20px 20px;
}

.fade-in {
  animation: fadeIn 0.28s ease-out both;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 860px) {
  .image-matting-page {
    padding: 16px;
    overflow-y: auto;
  }

  .preview-header {
    flex-direction: column;
  }

  .pool-header {
    flex-direction: column;
  }

  .pool-actions {
    width: 100%;
    justify-content: flex-start;
  }

  .matting-workspace {
    min-height: auto;
    flex-direction: column;
    overflow: visible;
  }

  .pool-panel {
    width: 100%;
    max-height: 360px;
    flex: none;
  }

  .preview-panel {
    min-height: 560px;
    flex: none;
  }

  .preview-title {
    max-width: 100%;
  }

  .preview-actions {
    width: 100%;
    justify-content: flex-start;
  }

  .source-state {
    left: 16px;
    right: 16px;
    bottom: 16px;
    width: auto;
    transform: none;
    flex-wrap: wrap;
  }

  .gif-compare-grid {
    grid-template-columns: 1fr;
  }
}
</style>
