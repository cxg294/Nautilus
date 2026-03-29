import { ref, shallowRef, computed } from 'vue';
import JSZip from 'jszip';

/** 帧数据结构 */
export interface FrameData {
  /** 唯一标识 */
  id: string;
  /** 帧在视频中的时间点（秒） */
  timestamp: number;
  /** 帧的 data URL（base64 编码图片） */
  dataUrl: string;
  /** 缩略图 data URL */
  thumbUrl: string;
  /** 是否被选中 */
  selected: boolean;
}

/** 抽帧模式 */
export type ExtractMode = 'count' | 'interval';

/** 输出格式 */
export type OutputFormat = 'png' | 'jpeg';

/** 视频信息 */
export interface VideoInfo {
  /** 文件名 */
  fileName: string;
  /** 时长（秒） */
  duration: number;
  /** 视频宽度 */
  width: number;
  /** 视频高度 */
  height: number;
  /** 文件大小（字节） */
  fileSize: number;
}

/**
 * 视频抽帧核心逻辑 Composable
 *
 * 提供视频加载、抽帧（按数量/按间隔）、手动截帧、ZIP 导出、单图下载等能力。
 * 全部在前端完成，基于 HTML5 Video + Canvas API。
 */
export function useFrameExtractor() {
  // === 响应式状态 ===
  const videoEl = shallowRef<HTMLVideoElement | null>(null);
  const videoUrl = ref('');
  const videoInfo = ref<VideoInfo | null>(null);
  const frames = ref<FrameData[]>([]);
  const isExtracting = ref(false);
  const extractProgress = ref(0);
  const outputFormat = ref<OutputFormat>('png');
  const outputQuality = ref(0.92);

  // === 计算属性 ===
  const selectedFrames = computed(() => frames.value.filter(f => f.selected));
  const selectedCount = computed(() => selectedFrames.value.length);
  const allSelected = computed(() => frames.value.length > 0 && frames.value.every(f => f.selected));

  /** 生成唯一 ID */
  function generateId(): string {
    return `frame_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /** 格式化时间戳为 HH:MM:SS.mmm */
  function formatTimestamp(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.round((seconds % 1) * 1000);
    if (h > 0) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
  }

  /**
   * 绑定 video 元素的引用
   */
  function setVideoElement(el: HTMLVideoElement) {
    videoEl.value = el;
  }

  /**
   * 加载视频文件
   *
   * 使用临时 video 元素预加载元数据，避免依赖 DOM 中的 video 元素（可能尚未渲染）。
   * 验证视频可播放后，再设置 videoUrl 触发 Vue 渲染。
   */
  function loadVideo(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      // 清除上一个视频的 URL
      if (videoUrl.value) {
        URL.revokeObjectURL(videoUrl.value);
      }

      // 重置状态
      frames.value = [];
      extractProgress.value = 0;

      const url = URL.createObjectURL(file);

      // 使用临时 video 元素来获取元数据，不依赖 DOM 中的 <video>
      const tempVideo = document.createElement('video');
      tempVideo.preload = 'metadata';
      tempVideo.src = url;

      tempVideo.onloadedmetadata = () => {
        // 先记录元数据（tempVideo 马上要被清理）
        const duration = tempVideo.duration;
        const width = tempVideo.videoWidth;
        const height = tempVideo.videoHeight;

        // 元数据获取成功，记录视频信息
        videoInfo.value = {
          fileName: file.name,
          duration,
          width,
          height,
          fileSize: file.size,
        };

        console.log(`[FrameExtractor] 视频加载成功: ${file.name} (${width}×${height}, ${duration.toFixed(1)}s)`);

        // ⚠️ 必须先清除事件处理器，否则 tempVideo.src = '' 会触发 onerror 导致 blob URL 被销毁
        tempVideo.onloadedmetadata = null;
        tempVideo.onerror = null;
        tempVideo.src = '';
        tempVideo.load(); // 释放临时元素的内部资源

        // 设置 videoUrl，触发 Vue 渲染 <video> 元素
        videoUrl.value = url;

        resolve();
      };

      tempVideo.onerror = (e) => {
        URL.revokeObjectURL(url);
        tempVideo.onloadedmetadata = null;
        tempVideo.onerror = null;
        tempVideo.src = '';

        const errMsg = '视频加载失败，请确认文件格式';
        console.error(`[FrameExtractor] ${errMsg}: ${file.name}`, e);
        reject(new Error(errMsg));
      };
    });
  }

  /**
   * 从视频的指定时间点捕获一帧
   */
  function captureFrame(video: HTMLVideoElement, time: number): Promise<{ dataUrl: string; thumbUrl: string }> {
    return new Promise((resolve) => {
      video.currentTime = time;
      video.onseeked = () => {
        // 全尺寸画布
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const mimeType = outputFormat.value === 'png' ? 'image/png' : 'image/jpeg';
        const quality = outputFormat.value === 'jpeg' ? outputQuality.value : undefined;
        const dataUrl = canvas.toDataURL(mimeType, quality);

        // 缩略图画布（最大宽度 240px）
        const thumbWidth = Math.min(240, video.videoWidth);
        const thumbHeight = Math.round((thumbWidth / video.videoWidth) * video.videoHeight);
        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = thumbWidth;
        thumbCanvas.height = thumbHeight;
        const thumbCtx = thumbCanvas.getContext('2d')!;
        thumbCtx.drawImage(video, 0, 0, thumbWidth, thumbHeight);
        const thumbUrl = thumbCanvas.toDataURL('image/jpeg', 0.7);

        resolve({ dataUrl, thumbUrl });
      };
    });
  }

  /**
   * 按帧数量均匀抽帧
   */
  async function extractByCount(count: number) {
    const video = videoEl.value;
    if (!video || !videoInfo.value) return;

    isExtracting.value = true;
    extractProgress.value = 0;

    // 暂停视频播放
    video.pause();

    const duration = videoInfo.value.duration;
    // 均匀分布时间点，避免首尾完全在 0 和 duration 处
    const step = duration / (count + 1);
    const newFrames: FrameData[] = [];

    for (let i = 1; i <= count; i++) {
      const time = step * i;
      const { dataUrl, thumbUrl } = await captureFrame(video, time);
      newFrames.push({
        id: generateId(),
        timestamp: time,
        dataUrl,
        thumbUrl,
        selected: false,
      });
      extractProgress.value = Math.round((i / count) * 100);
    }

    frames.value = [...frames.value, ...newFrames];
    isExtracting.value = false;
  }

  /**
   * 按时间间隔抽帧
   */
  async function extractByInterval(intervalSeconds: number) {
    const video = videoEl.value;
    if (!video || !videoInfo.value) return;

    isExtracting.value = true;
    extractProgress.value = 0;

    video.pause();

    const duration = videoInfo.value.duration;
    const totalFrames = Math.floor(duration / intervalSeconds);
    const newFrames: FrameData[] = [];

    for (let i = 0; i < totalFrames; i++) {
      const time = intervalSeconds * (i + 0.5); // 每个间隔取中间点
      if (time >= duration) break;
      const { dataUrl, thumbUrl } = await captureFrame(video, time);
      newFrames.push({
        id: generateId(),
        timestamp: time,
        dataUrl,
        thumbUrl,
        selected: false,
      });
      extractProgress.value = Math.round(((i + 1) / totalFrames) * 100);
    }

    frames.value = [...frames.value, ...newFrames];
    isExtracting.value = false;
  }

  /**
   * 截取当前播放位置的帧
   */
  async function captureCurrentFrame() {
    const video = videoEl.value;
    if (!video) return;

    const time = video.currentTime;

    // 直接使用当前画面，不需要 seek
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const mimeType = outputFormat.value === 'png' ? 'image/png' : 'image/jpeg';
    const quality = outputFormat.value === 'jpeg' ? outputQuality.value : undefined;
    const dataUrl = canvas.toDataURL(mimeType, quality);

    const thumbWidth = Math.min(240, video.videoWidth);
    const thumbHeight = Math.round((thumbWidth / video.videoWidth) * video.videoHeight);
    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = thumbWidth;
    thumbCanvas.height = thumbHeight;
    const thumbCtx = thumbCanvas.getContext('2d')!;
    thumbCtx.drawImage(video, 0, 0, thumbWidth, thumbHeight);
    const thumbUrl = thumbCanvas.toDataURL('image/jpeg', 0.7);

    frames.value.push({
      id: generateId(),
      timestamp: time,
      dataUrl,
      thumbUrl,
      selected: false,
    });
  }

  /**
   * 将 dataUrl 转换为 Blob
   */
  function dataUrlToBlob(dataUrl: string): Blob {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)![1];
    const bstr = atob(arr[1]);
    const n = bstr.length;
    const u8arr = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      u8arr[i] = bstr.charCodeAt(i);
    }
    return new Blob([u8arr], { type: mime });
  }

  /**
   * 导出选中的帧为 ZIP
   */
  async function exportAsZip(targetFrames?: FrameData[]) {
    const framesToExport = targetFrames || selectedFrames.value;
    if (framesToExport.length === 0) return;

    const zip = new JSZip();
    const ext = outputFormat.value === 'png' ? 'png' : 'jpg';
    const prefix = videoInfo.value?.fileName.replace(/\.[^/.]+$/, '') || 'video';

    framesToExport.forEach((frame, index) => {
      const blob = dataUrlToBlob(frame.dataUrl);
      const timeStr = formatTimestamp(frame.timestamp).replace(/:/g, '-');
      zip.file(`${prefix}_${String(index + 1).padStart(3, '0')}_${timeStr}.${ext}`, blob);
    });

    const content = await zip.generateAsync({ type: 'blob' });
    downloadBlob(content, `${prefix}_frames.zip`);
  }

  /**
   * 下载单张帧图片
   */
  function downloadSingleFrame(frame: FrameData) {
    const ext = outputFormat.value === 'png' ? 'png' : 'jpg';
    const prefix = videoInfo.value?.fileName.replace(/\.[^/.]+$/, '') || 'video';
    const timeStr = formatTimestamp(frame.timestamp).replace(/:/g, '-');
    const blob = dataUrlToBlob(frame.dataUrl);
    downloadBlob(blob, `${prefix}_${timeStr}.${ext}`);
  }

  /**
   * 通用 Blob 下载
   */
  function downloadBlob(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // === 帧管理操作 ===

  /** 切换单帧选中状态 */
  function toggleFrameSelect(id: string) {
    const frame = frames.value.find(f => f.id === id);
    if (frame) frame.selected = !frame.selected;
  }

  /** 全选 */
  function selectAll() {
    frames.value.forEach(f => (f.selected = true));
  }

  /** 取消全选 */
  function deselectAll() {
    frames.value.forEach(f => (f.selected = false));
  }

  /** 反选 */
  function invertSelection() {
    frames.value.forEach(f => (f.selected = !f.selected));
  }

  /** 删除选中的帧 */
  function deleteSelected() {
    frames.value = frames.value.filter(f => !f.selected);
  }

  /** 删除单帧 */
  function deleteFrame(id: string) {
    frames.value = frames.value.filter(f => f.id !== id);
  }

  /** 清空所有帧 */
  function clearFrames() {
    frames.value = [];
  }

  /** 清理资源 */
  function cleanup() {
    if (videoUrl.value) {
      URL.revokeObjectURL(videoUrl.value);
      videoUrl.value = '';
    }
    videoInfo.value = null;
    frames.value = [];
  }

  return {
    // 状态
    videoEl,
    videoUrl,
    videoInfo,
    frames,
    isExtracting,
    extractProgress,
    outputFormat,
    outputQuality,
    selectedFrames,
    selectedCount,
    allSelected,

    // 方法
    setVideoElement,
    loadVideo,
    extractByCount,
    extractByInterval,
    captureCurrentFrame,
    exportAsZip,
    downloadSingleFrame,
    toggleFrameSelect,
    selectAll,
    deselectAll,
    invertSelection,
    deleteSelected,
    deleteFrame,
    clearFrames,
    cleanup,
    formatTimestamp,
  };
}
