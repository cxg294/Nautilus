<script setup lang="ts">
import { ref } from 'vue';
import { useMessage, type UploadFileInfo } from 'naive-ui';
import axios from 'axios';
import imageCompression from 'browser-image-compression';
import JSZip from 'jszip';
import ImageCompare from './components/ImageCompare.vue';
import { usePageTracker, useActionTracker } from '@/hooks/common/use-tracker';

usePageTracker('image-matting');
const { trackAction } = useActionTracker('image-matting');

interface MattingTask {
  id: string;
  file: File;
  originalUrl: string;
  resultUrl: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  errorMsg?: string;
  progress?: number;
}

const message = useMessage();
const tasks = ref<MattingTask[]>([]);
const isProcessingAll = ref(false);
const showCompareModal = ref(false);
const activeCompareTask = ref<MattingTask | null>(null);

const handleUploadChange = (newFileList: UploadFileInfo[]) => {
  newFileList.forEach((fileInfo) => {
    if (fileInfo.file && !tasks.value.find(t => t.id === fileInfo.id)) {
      tasks.value.push({
        id: fileInfo.id,
        file: fileInfo.file,
        originalUrl: URL.createObjectURL(fileInfo.file),
        resultUrl: '',
        status: 'pending'
      });
    }
  });
};

const removeTask = (id: string) => {
  const index = tasks.value.findIndex(t => t.id === id);
  if (index > -1) {
    URL.revokeObjectURL(tasks.value[index].originalUrl);
    tasks.value.splice(index, 1);
  }
};

const processTask = async (task: MattingTask) => {
  if (task.status === 'success' || task.status === 'processing') return;
  task.status = 'processing';
  task.errorMsg = '';
  
  let fileToUpload = task.file;
  try {
    const options = { maxSizeMB: 2.8, maxWidthOrHeight: 1999, useWebWorker: true };
    if (fileToUpload.size > 2.8 * 1024 * 1024 || await needsResizing(fileToUpload)) {
      fileToUpload = await imageCompression(fileToUpload, options);
    }
  } catch (err) {
    console.warn(`[Task ${task.id}] 预压缩失败，将原图上传`, err);
  }

  const formData = new FormData();
  formData.append('image', fileToUpload);

  try {
    const response = await axios.post('/api/image-matting/segment', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 45000 
    });
    
    if (response.data.success) {
      task.resultUrl = response.data.url;
      task.status = 'success';
    } else {
      task.status = 'error';
      task.errorMsg = response.data.error || '处理失败';
    }
  } catch (error: any) {
    task.status = 'error';
    task.errorMsg = error.response?.data?.error || '请求出错';
  }
};

// Queue system
const startAll = async () => {
  const pendingTasks = tasks.value.filter(t => t.status === 'pending' || t.status === 'error');
  if (pendingTasks.length === 0) {
    message.warning('没有等待处理的图片');
    return;
  }

  isProcessingAll.value = true;
  message.info(`开始处理 ${pendingTasks.length} 张图片，请耐心等待...`);

  // 并发控制：最大 3 个同时进行
  const MAX_CONCURRENT = 3;
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
  const successCount = tasks.value.filter(t => t.status === 'success').length;
  trackAction('batch_matting', successCount === tasks.value.length ? 'success' : 'fail', { total: tasks.value.length, success: successCount });
  if (successCount === tasks.value.length) {
    message.success('全部抠图处理完成！');
  } else {
    message.warning(`处理结束，成功 ${successCount}，失败 ${tasks.value.length - successCount}`);
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
  // 利用自建 proxy 回避跨域，可强制下载
  a.href = `/api/image-matting/proxy-image?url=${encodeURIComponent(task.resultUrl)}`;
  a.download = `matting_result_${task.file.name}.png`;
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
      const proxyUrl = `/api/image-matting/proxy-image?url=${encodeURIComponent(task.resultUrl)}`;
      const res = await axios.get(proxyUrl, { responseType: 'blob' });
      // 生成安全的文件名
      const baseName = task.file.name.replace(/\.[^/.]+$/, '');
      folder?.file(`${baseName}_nobg.png`, res.data);
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
  activeCompareTask.value = task;
  showCompareModal.value = true;
};
</script>

<template>
  <div class="image-matting-container p-6 w-full h-full flex flex-col gap-6 overflow-y-auto">
    <div class="header">
      <h2 class="text-2xl font-bold mb-2">图片去背景 <NTag type="primary" size="small" round>智能抠图</NTag></h2>
      <p class="text-gray-500">将多张含有任意主体的照片拖入，一键全自动批量分离背景与前景内容。</p>
    </div>
    
    <div class="content flex-1 flex flex-col gap-6">
      <!-- 统一的上传入口 -->
      <div 
        class="upload-zone transition-all duration-300" 
        :class="tasks.length === 0 ? 'w-full max-w-2xl mx-auto mt-20' : 'w-full'"
      >
        <NUpload
          multiple
          directory-dnd
          action=""
          :default-upload="false"
          :show-file-list="false"
          accept="image/*"
          @update:file-list="handleUploadChange"
        >
          <NUploadDragger>
            <div class="flex flex-col items-center py-4">
              <NIcon size="48" :depth="3" class="mb-2 transition-transform scale-hover">
                <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="M19.35 10.04C18.67 6.59 15.64 4 12 4C9.11 4 6.6 5.64 5.35 8.04C2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5c0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5l5 5h-3z" /></svg>
              </NIcon>
              <NText style="font-size: 16px; font-weight: 500;">
                {{ tasks.length === 0 ? '点击或者拖动多张图片到此处排队处理' : '继续追加图片到任务队列...' }}
              </NText>
              <NP depth="3" class="mt-2 mb-0 text-sm">
                超出 3MB 的大图将自动在本地等比极速压缩，同时最高并发处理 3 张
              </NP>
            </div>
          </NUploadDragger>
        </NUpload>
      </div>

      <!-- 操作栏 -->
      <div v-if="tasks.length > 0" class="action-bar flex flex-wrap justify-between items-center bg-gray-50 dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="text-base font-medium flex items-center gap-2">
          任务队列 ({{ tasks.length }})
          <NTag v-if="tasks.filter(t => t.status === 'success').length" type="success" size="small">
            成功: {{ tasks.filter(t => t.status === 'success').length }}
          </NTag>
        </div>
        <div class="flex flex-wrap gap-3">
          <NButton ghost size="small" @click="() => tasks = []">清空列表</NButton>
          <NButton 
            v-if="tasks.filter(t => t.status === 'success').length > 1" 
            type="success" size="small" tertiary 
            :loading="isDownloadingZip" 
            @click="handleDownloadZip"
          >
            <template #icon><svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7l7-7zm-8 2V5h2v6h1.17L12 13.17L9.83 11zM5 19v-2h14v2z" /></svg></template>
            图集 ZIP 打包下载
          </NButton>
          <NButton type="primary" size="small" :loading="isProcessingAll" @click="startAll">
            <template #icon><svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="M8 5v14l11-7z" /></svg></template>
            一键批量处理
          </NButton>
        </div>
      </div>

      <!-- 单图模式全屏对比 -->
      <div v-if="tasks.length === 1 && tasks[0].status === 'success'" class="single-task-view flex-1 min-h-[500px] w-full max-w-5xl mx-auto fade-in">
        <NCard class="h-[600px] shadow-sm rounded-xl overflow-hidden flex flex-col" :content-style="{ padding: 0, flex: 1, display: 'flex' }">
          <ImageCompare 
            :original-src="tasks[0].originalUrl"
            :result-src="tasks[0].resultUrl"
          />
          <template #action>
            <div class="flex justify-end p-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
              <NButton type="success" size="large" @click="handleDownloadSingle(tasks[0])">
                <template #icon><svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7l7-7z" /></svg></template>
                下载此图片
              </NButton>
            </div>
          </template>
        </NCard>
      </div>

      <!-- 任务网格 -->
      <div v-if="tasks.length > 0 && !(tasks.length === 1 && tasks[0].status === 'success')" class="tasks-grid grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        <div 
          v-for="task in tasks" 
          :key="task.id" 
          class="task-card group relative bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm border hover:shadow-md transition-shadow"
          :class="[
            task.status === 'success' ? 'border-green-400 border-2' : 
            task.status === 'error' ? 'border-red-400 border-2' : 
            task.status === 'processing' ? 'border-blue-400' : 'border-gray-200 dark:border-gray-700'
          ]"
        >
          <!-- 图片主体 -->
          <div class="aspect-square relative w-full h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900 overflow-hidden" :class="task.status === 'success' ? 'bg-pattern' : ''">
            <img 
              :src="task.status === 'success' ? task.resultUrl : task.originalUrl" 
              class="max-w-full max-h-full object-contain transition-opacity duration-300" 
              :class="task.status === 'pending' || task.status === 'processing' ? 'opacity-40 blur-[1px]' : ''"
            />
            
            <!-- 遮罩层状态提示 -->
            <div v-if="task.status !== 'success'" class="absolute inset-0 flex flex-col items-center justify-center bg-black/10 text-white p-4 text-center">
              <template v-if="task.status === 'processing'">
                <NSpin size="medium" />
                <span class="mt-2 text-xs font-bold text-gray-800 dark:text-gray-100">云端推理中...</span>
              </template>
              <template v-else-if="task.status === 'error'">
                <div class="bg-red-500 rounded-full w-8 h-8 flex items-center justify-center mb-1 text-white">!</div>
                <span class="text-xs font-bold leading-tight drop-shadow-md text-red-500">{{ task.errorMsg || '失败' }}</span>
                <NButton size="tiny" type="primary" class="mt-2" @click="processTask(task)">重试</NButton>
              </template>
              <template v-else>
                <NButton size="tiny" type="info" ghost @click="processTask(task)">处理</NButton>
              </template>
            </div>
            
            <!-- 成功后的对比/下载操作悬浮按钮 -->
            <div v-if="task.status === 'success'" class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-2 backdrop-blur-sm">
              <NTooltip placement="top" trigger="hover">
                <template #trigger>
                  <NButton circle type="primary" @click="openCompareModal(task)">
                    <template #icon><svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5M12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5s5 2.24 5 5s-2.24 5-5 5m0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3s3-1.34 3-3s-1.34-3-3-3" /></svg></template>
                  </NButton>
                </template>
                精细对比
              </NTooltip>
              <NTooltip placement="top" trigger="hover">
                <template #trigger>
                  <NButton circle type="success" @click="handleDownloadSingle(task)">
                    <template #icon><svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="M5 20h14v-2H5v2zM19 9h-4V3H9v6H5l7 7l7-7z" /></svg></template>
                  </NButton>
                </template>
                单图下载
              </NTooltip>
            </div>
          </div>
          
          <!-- 右上角移除按钮 -->
          <div class="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <NButton circle size="tiny" type="error" @click.stop="removeTask(task.id)">
              <template #icon><svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12z" /></svg></template>
            </NButton>
          </div>
        </div>
      </div>
    </div>

    <!-- 弹窗对比视图（多图模式下点击查看详情用） -->
    <NModal v-model:show="showCompareModal" preset="card" class="w-11/12 max-w-5xl" :title="'细节对比: ' + (activeCompareTask?.file.name || '')">
      <div v-if="activeCompareTask" class="h-[70vh] min-h-[500px] w-full rounded-lg overflow-hidden relative">
        <ImageCompare 
          :original-src="activeCompareTask.originalUrl"
          :result-src="activeCompareTask.resultUrl"
        />
      </div>
    </NModal>
  </div>
</template>

<style scoped>
.upload-zone :deep(.n-upload-dragger) {
  padding: 24px;
  background-color: var(--n-color-modal);
  border-radius: 12px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.upload-zone :deep(.n-upload-dragger:hover) {
  border-color: var(--primary-color);
  background-color: var(--n-action-color);
}
.scale-hover {
  transition: transform 0.3s;
}
.upload-zone :deep(.n-upload-dragger:hover) .scale-hover {
  transform: translateY(-5px) scale(1.1);
}
.bg-pattern {
  background-image: repeating-conic-gradient(#e5e7eb 0 25%, transparent 0 50%);
  background-size: 20px 20px;
}
.fade-in {
  animation: fadeIn 0.4s ease-out forwards;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
