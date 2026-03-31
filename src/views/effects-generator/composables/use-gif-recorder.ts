/**
 * GIF 录制引擎 — 核心 Composable
 * 负责逐帧抓取 Canvas 内容并编码为 GIF 动画
 */
import { ref, computed } from 'vue';
import { encode } from 'modern-gif';

// ============================================================
// 类型定义
// ============================================================

/** 裁剪区域（相对于 Canvas 的 CSS 像素坐标） */
export interface CropRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 录制配置 */
export interface RecordingConfig {
  /** 帧率（fps），默认 15 */
  fps: number;
  /** 最大录制时长（秒），默认 5 */
  duration: number;
  /** 画质（modern-gif maxColors），默认 256 */
  maxColors: number;
}

/** 录制状态 */
export type RecordingState = 'idle' | 'selecting' | 'ready' | 'recording' | 'encoding' | 'done';

/** 内部帧缓冲结构 */
interface FrameData {
  /** RGBA 像素数据 */
  data: Uint8ClampedArray;
  /** 帧延迟（毫秒） */
  delay: number;
}

// ============================================================
// 常量
// ============================================================

const DEFAULT_CONFIG: RecordingConfig = {
  fps: 15,
  duration: 5,
  maxColors: 256
};

/** GIF 输出最大边长限制（超出则自动缩放） */
const MAX_GIF_DIMENSION = 600;

// ============================================================
// Composable
// ============================================================

export function useGifRecorder() {
  // ---- 响应式状态 ----
  const state = ref<RecordingState>('idle');
  const config = ref<RecordingConfig>({ ...DEFAULT_CONFIG });
  const cropRegion = ref<CropRegion | null>(null);
  const elapsed = ref(0);
  const progress = ref(0);
  const previewUrl = ref<string | null>(null);
  const fileSize = ref(0);
  const errorMsg = ref<string | null>(null);

  // ---- 非响应式内部变量 ----
  let frameBuffer: FrameData[] = [];
  let captureTimer: ReturnType<typeof setInterval> | null = null;
  let startTime = 0;
  let sourceCanvas: HTMLCanvasElement | null = null;

  /** 录制帧的实际像素尺寸（经过下采样后） */
  let gifWidth = 0;
  let gifHeight = 0;

  // ---- 计算属性 ----
  const isRecording = computed(() => state.value === 'recording');
  const isEncoding = computed(() => state.value === 'encoding');
  const isDone = computed(() => state.value === 'done');
  const isSelecting = computed(() => state.value === 'selecting');
  const canRecord = computed(() => state.value === 'ready' && cropRegion.value !== null);

  // ============================================================
  // 方法
  // ============================================================

  /** 进入选取模式 */
  function enterSelectMode() {
    state.value = 'selecting';
    errorMsg.value = null;
  }

  /** 设置裁剪区域并进入就绪状态 */
  function setCropRegion(region: CropRegion) {
    cropRegion.value = region;
    state.value = 'ready';
  }

  /** 全选画布区域 */
  function selectFullCanvas(canvas: HTMLCanvasElement) {
    const w = canvas.clientWidth || canvas.offsetWidth;
    const h = canvas.clientHeight || canvas.offsetHeight;
    setCropRegion({ x: 0, y: 0, width: w, height: h });
  }

  /**
   * 计算下采样后的目标尺寸
   * @param srcW 源宽度（Canvas 实际像素）
   * @param srcH 源高度（Canvas 实际像素）
   */
  function computeTargetSize(srcW: number, srcH: number): { w: number; h: number } {
    if (srcW <= MAX_GIF_DIMENSION && srcH <= MAX_GIF_DIMENSION) {
      return { w: srcW, h: srcH };
    }
    const scale = Math.min(MAX_GIF_DIMENSION / srcW, MAX_GIF_DIMENSION / srcH);
    return {
      w: Math.round(srcW * scale),
      h: Math.round(srcH * scale)
    };
  }

  /** 开始录制 */
  function startRecording(canvas: HTMLCanvasElement) {
    sourceCanvas = canvas;
    frameBuffer = [];
    elapsed.value = 0;
    progress.value = 0;
    errorMsg.value = null;
    startTime = performance.now();
    state.value = 'recording';

    // 预计算下采样目标尺寸
    const region = cropRegion.value!;
    const cssW = canvas.clientWidth || canvas.offsetWidth || 1;
    const cssH = canvas.clientHeight || canvas.offsetHeight || 1;
    const scaleX = canvas.width / cssW;
    const scaleY = canvas.height / cssH;
    const srcW = Math.round(region.width * scaleX);
    const srcH = Math.round(region.height * scaleY);
    const target = computeTargetSize(srcW, srcH);
    gifWidth = target.w;
    gifHeight = target.h;

    console.log(`[GifRecorder] 开始录制, 选区 ${srcW}×${srcH} → 目标 ${gifWidth}×${gifHeight}`);

    const interval = 1000 / config.value.fps;
    const maxDuration = config.value.duration * 1000;

    captureTimer = setInterval(() => {
      const now = performance.now();
      elapsed.value = (now - startTime) / 1000;
      progress.value = Math.min(elapsed.value / config.value.duration, 1);

      // 超时自动停止
      if (now - startTime >= maxDuration) {
        stopRecording();
        return;
      }

      captureFrame();
    }, interval);
  }

  /** 抓取一帧（含坐标映射 + 下采样） */
  function captureFrame() {
    if (!sourceCanvas || !cropRegion.value) return;

    const region = cropRegion.value;

    // CSS 像素 → Canvas 实际像素
    const cssW = sourceCanvas.clientWidth || sourceCanvas.offsetWidth || 1;
    const cssH = sourceCanvas.clientHeight || sourceCanvas.offsetHeight || 1;
    const scaleX = sourceCanvas.width / cssW;
    const scaleY = sourceCanvas.height / cssH;

    const sx = Math.round(region.x * scaleX);
    const sy = Math.round(region.y * scaleY);
    const sw = Math.min(Math.round(region.width * scaleX), sourceCanvas.width - sx);
    const sh = Math.min(Math.round(region.height * scaleY), sourceCanvas.height - sy);

    if (sw <= 0 || sh <= 0) return;

    // 使用离屏 Canvas 裁剪 + 缩放
    const offscreen = document.createElement('canvas');
    offscreen.width = gifWidth;
    offscreen.height = gifHeight;
    const ctx = offscreen.getContext('2d')!;

    // 关闭图像平滑以提升性能（GIF 本身就是像素化的）
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';

    // 从源 canvas 裁切并缩放到目标尺寸
    ctx.drawImage(
      sourceCanvas,
      sx, sy, sw, sh,
      0, 0, gifWidth, gifHeight
    );

    // 提取像素数据（Uint8ClampedArray，可序列化）
    const imageData = ctx.getImageData(0, 0, gifWidth, gifHeight);

    frameBuffer.push({
      data: imageData.data,
      delay: Math.round(1000 / config.value.fps)
    });
  }

  /** 停止录制并开始编码 */
  async function stopRecording() {
    if (captureTimer) {
      clearInterval(captureTimer);
      captureTimer = null;
    }

    if (frameBuffer.length === 0) {
      state.value = 'ready';
      errorMsg.value = '未捕获到任何帧';
      return;
    }

    state.value = 'encoding';
    progress.value = 0;

    try {
      console.log(`[GifRecorder] 编码 ${frameBuffer.length} 帧, 尺寸 ${gifWidth}×${gifHeight}`);

      // 使用 modern-gif 编码（不使用 Worker 以确保兼容性）
      const output = await encode({
        width: gifWidth,
        height: gifHeight,
        maxColors: config.value.maxColors,
        // modern-gif 类型定义与 TS 5.9 的 ArrayBufferLike 不兼容，运行时无影响
        frames: frameBuffer.map(f => ({
          data: new Uint8Array(f.data.buffer) as any,
          delay: f.delay
        }))
      });

      // encode 返回 ArrayBuffer，转为 Blob
      const blob = new Blob([output], { type: 'image/gif' });
      fileSize.value = blob.size;
      console.log(`[GifRecorder] 编码完成, 文件大小: ${(blob.size / 1024).toFixed(1)} KB`);

      // 清理旧的预览 URL
      if (previewUrl.value) {
        URL.revokeObjectURL(previewUrl.value);
      }
      previewUrl.value = URL.createObjectURL(blob);
      state.value = 'done';
      progress.value = 1;

      // 释放帧缓冲区内存
      frameBuffer = [];
    } catch (err) {
      console.error('[GifRecorder] 编码失败:', err);
      errorMsg.value = `编码失败: ${err}`;
      state.value = 'ready';
      frameBuffer = [];
    }
  }

  /** 取消录制 */
  function cancelRecording() {
    if (captureTimer) {
      clearInterval(captureTimer);
      captureTimer = null;
    }
    frameBuffer = [];
    state.value = cropRegion.value ? 'ready' : 'idle';
    elapsed.value = 0;
    progress.value = 0;
  }

  /** 下载 GIF */
  function downloadGif(filename?: string) {
    if (!previewUrl.value) return;

    const a = document.createElement('a');
    a.href = previewUrl.value;
    a.download = filename || `effect-${Date.now()}.gif`;
    a.click();
  }

  /** 重新录制 */
  function reRecord() {
    if (previewUrl.value) {
      URL.revokeObjectURL(previewUrl.value);
      previewUrl.value = null;
    }
    frameBuffer = [];
    fileSize.value = 0;
    elapsed.value = 0;
    progress.value = 0;
    state.value = cropRegion.value ? 'ready' : 'idle';
  }

  /** 完全重置 */
  function cleanup() {
    cancelRecording();
    if (previewUrl.value) {
      URL.revokeObjectURL(previewUrl.value);
      previewUrl.value = null;
    }
    cropRegion.value = null;
    frameBuffer = [];
    fileSize.value = 0;
    errorMsg.value = null;
    state.value = 'idle';
  }

  /** 格式化文件大小 */
  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return {
    // 状态
    state,
    config,
    cropRegion,
    elapsed,
    progress,
    previewUrl,
    fileSize,
    errorMsg,
    // 计算属性
    isRecording,
    isEncoding,
    isDone,
    isSelecting,
    canRecord,
    // 方法
    enterSelectMode,
    setCropRegion,
    selectFullCanvas,
    startRecording,
    stopRecording,
    cancelRecording,
    downloadGif,
    reRecord,
    cleanup,
    formatFileSize
  };
}
