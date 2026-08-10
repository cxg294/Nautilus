/**
 * GIF 动图生成引擎 — 核心 Composable
 *
 * 将视频抽帧后选中的帧合成为 GIF 动画。
 * 复用 modern-gif 编码（与 effects-generator 一致的技术方案）。
 */
import { ref, computed } from 'vue';
import { encode } from 'modern-gif';
import type { FrameData } from './use-frame-extractor';

// ============================================================
// 类型定义
// ============================================================

/** GIF 生成配置 */
export interface GifConfig {
  /** 帧间隔（毫秒），默认 200 */
  delay: number;
  /** 输出最大宽度（像素），默认 480 */
  maxWidth: number;
  /** 最大颜色数（2-256），默认 256 */
  maxColors: number;
  /** 循环次数：0=无限循环 */
  loop: number;
}

/** GIF 生成状态 */
export type GifState = 'idle' | 'generating' | 'done' | 'error';

// ============================================================
// 常量
// ============================================================

const DEFAULT_CONFIG: GifConfig = {
  delay: 200,
  maxWidth: 480,
  maxColors: 256,
  loop: 0
};

// ============================================================
// Composable
// ============================================================

export function useGifMaker() {
  // ---- 响应式状态 ----
  const state = ref<GifState>('idle');
  const config = ref<GifConfig>({ ...DEFAULT_CONFIG });
  const progress = ref(0);
  const previewUrl = ref<string | null>(null);
  const fileSize = ref(0);
  const errorMsg = ref<string | null>(null);
  const gifBlob = ref<Blob | null>(null);

  // ---- 计算属性 ----
  const isGenerating = computed(() => state.value === 'generating');
  const isDone = computed(() => state.value === 'done');
  const isError = computed(() => state.value === 'error');

  // ============================================================
  // 核心方法
  // ============================================================

  /**
   * 计算下采样目标尺寸
   * 保持宽高比，限制最大宽度
   */
  function computeTargetSize(srcW: number, srcH: number): { w: number; h: number } {
    const maxW = config.value.maxWidth;
    if (srcW <= maxW) {
      return { w: srcW, h: srcH };
    }
    const scale = maxW / srcW;
    return {
      w: maxW,
      h: Math.round(srcH * scale)
    };
  }

  /**
   * 将 dataUrl 图片绘制到 Canvas 并提取 RGBA 像素数据
   */
  function loadImageData(
    dataUrl: string,
    targetW: number,
    targetH: number
  ): Promise<Uint8ClampedArray> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d')!;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'medium';
        ctx.drawImage(img, 0, 0, targetW, targetH);
        const imageData = ctx.getImageData(0, 0, targetW, targetH);
        resolve(imageData.data);
      };
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = dataUrl;
    });
  }

  /**
   * 从选中的帧数据生成 GIF
   * @param frames 选中的帧数据（按时间顺序排列）
   */
  async function generateGif(frames: FrameData[]): Promise<void> {
    if (frames.length < 2) {
      errorMsg.value = '至少选择 2 帧才能生成 GIF';
      state.value = 'error';
      return;
    }

    state.value = 'generating';
    progress.value = 0;
    errorMsg.value = null;

    try {
      // 从第一帧获取原始尺寸
      const firstImg = await _loadImage(frames[0].dataUrl);
      const { w: gifW, h: gifH } = computeTargetSize(firstImg.width, firstImg.height);

      console.log(`[GifMaker] 开始生成, ${frames.length} 帧, 目标尺寸 ${gifW}×${gifH}`);

      // 逐帧提取像素数据
      const gifFrames: { data: ArrayBuffer; delay: number }[] = [];
      for (let i = 0; i < frames.length; i++) {
        const pixelData = await loadImageData(frames[i].dataUrl, gifW, gifH);
        const frameBuffer = new ArrayBuffer(pixelData.byteLength);
        new Uint8Array(frameBuffer).set(pixelData);
        gifFrames.push({
          data: frameBuffer,
          delay: config.value.delay
        });
        progress.value = Math.round(((i + 1) / frames.length) * 60); // 帧提取占 60%
      }

      // 编码 GIF
      console.log(`[GifMaker] 开始编码...`);
      const output = await encode({
        width: gifW,
        height: gifH,
        maxColors: config.value.maxColors,
        frames: gifFrames
      });

      progress.value = 95;

      // 生成 Blob + 预览 URL
      const blob = new Blob([output], { type: 'image/gif' });
      fileSize.value = blob.size;
      gifBlob.value = blob;

      // 清理旧的预览 URL
      if (previewUrl.value) {
        URL.revokeObjectURL(previewUrl.value);
      }
      previewUrl.value = URL.createObjectURL(blob);

      state.value = 'done';
      progress.value = 100;

      console.log(`[GifMaker] 生成完成, 文件大小: ${formatFileSize(blob.size)}`);
    } catch (err) {
      console.error('[GifMaker] 生成失败:', err);
      errorMsg.value = `GIF 生成失败: ${err}`;
      state.value = 'error';
    }
  }

  /** 加载图片元素（用于获取尺寸） */
  function _loadImage(dataUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = dataUrl;
    });
  }

  /** 下载 GIF */
  function downloadGif(filename?: string) {
    if (!previewUrl.value) return;
    const a = document.createElement('a');
    a.href = previewUrl.value;
    a.download = filename || `frames-gif-${Date.now()}.gif`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  /** 重置状态（重新生成） */
  function reset() {
    if (previewUrl.value) {
      URL.revokeObjectURL(previewUrl.value);
      previewUrl.value = null;
    }
    gifBlob.value = null;
    fileSize.value = 0;
    progress.value = 0;
    errorMsg.value = null;
    state.value = 'idle';
  }

  /** 完全清理 */
  function cleanup() {
    reset();
    config.value = { ...DEFAULT_CONFIG };
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
    progress,
    previewUrl,
    fileSize,
    errorMsg,
    gifBlob,
    // 计算属性
    isGenerating,
    isDone,
    isError,
    // 方法
    generateGif,
    downloadGif,
    reset,
    cleanup,
    formatFileSize
  };
}
