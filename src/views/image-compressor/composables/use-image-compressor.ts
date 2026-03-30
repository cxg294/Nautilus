/**
 * 图片压缩核心组合式函数（双引擎版）
 *
 * 支持两种压缩引擎：
 * - WASM（默认）：使用 jSquash（MozJPEG / OxiPNG / WebP），压缩率高、画质好
 * - Canvas（快速）：使用 browser-image-compression，速度快但压缩率一般
 *
 * SB3 压缩固定使用 WASM 引擎。
 */
import { ref, computed } from 'vue';
import imageCompression from 'browser-image-compression';
import JSZip from 'jszip';

// === jSquash WASM 编解码器（懒加载） ===
let jpegCodec: { decode: (buf: ArrayBuffer) => Promise<ImageData>; encode: (data: ImageData, opts?: { quality?: number }) => Promise<ArrayBuffer> } | null = null;
let pngCodec: { decode: (buf: ArrayBuffer) => Promise<ImageData>; encode: (data: ImageData) => Promise<ArrayBuffer> } | null = null;
let webpCodec: { decode: (buf: ArrayBuffer) => Promise<ImageData>; encode: (data: ImageData, opts?: { quality?: number }) => Promise<ArrayBuffer> } | null = null;
let oxipngCodec: { optimise: (data: ArrayBuffer, opts?: { level?: number }) => Promise<ArrayBuffer> } | null = null;

/** 懒加载 WASM 编解码器 */
async function ensureWasmCodecs() {
  if (!jpegCodec) {
    const [jpeg, png, webp, oxipng] = await Promise.all([
      import('@jsquash/jpeg'),
      import('@jsquash/png'),
      import('@jsquash/webp'),
      import('@jsquash/oxipng')
    ]);
    jpegCodec = jpeg;
    pngCodec = png;
    webpCodec = webp;
    oxipngCodec = oxipng;
  }
}

/** 压缩引擎类型 */
export type CompressEngine = 'wasm' | 'canvas';

/** 单张图片的状态 */
export interface ImageItem {
  /** 唯一 ID */
  id: string;
  /** 原始文件 */
  file: File;
  /** 原始文件大小（字节） */
  originalSize: number;
  /** 原始预览 URL */
  originalUrl: string;
  /** 压缩后的 Blob */
  compressedBlob: Blob | null;
  /** 压缩后文件大小（字节） */
  compressedSize: number;
  /** 压缩后预览 URL */
  compressedUrl: string;
  /** 压缩状态 */
  status: 'pending' | 'compressing' | 'done' | 'error';
  /** 错误信息 */
  error: string;
}

/** 压缩参数 */
export interface CompressOptions {
  /** 最大宽度（px） */
  maxWidth: number;
  /** 最大高度（px） */
  maxHeight: number;
  /** 图片质量 0.1 ~ 1.0 */
  quality: number;
  /** 输出格式：auto 表示保持原格式 */
  outputFormat: 'auto' | 'image/jpeg' | 'image/png' | 'image/webp';
}

let idCounter = 0;

export function useImageCompressor() {
  // === 响应式状态 ===
  const images = ref<ImageItem[]>([]);
  const isCompressing = ref(false);
  /** 当前压缩引擎，默认 WASM */
  const engine = ref<CompressEngine>('wasm');
  const options = ref<CompressOptions>({
    maxWidth: 1920,
    maxHeight: 1920,
    quality: 0.8,
    outputFormat: 'auto'
  });

  // === 计算属性 ===
  const totalOriginalSize = computed(() =>
    images.value.reduce((sum, img) => sum + img.originalSize, 0)
  );

  const totalCompressedSize = computed(() =>
    images.value
      .filter(img => img.status === 'done')
      .reduce((sum, img) => sum + img.compressedSize, 0)
  );

  const totalCompressionRate = computed(() => {
    const doneItems = images.value.filter(img => img.status === 'done');
    if (doneItems.length === 0) return 0;
    const doneOriginal = doneItems.reduce((s, img) => s + img.originalSize, 0);
    const doneCompressed = doneItems.reduce((s, img) => s + img.compressedSize, 0);
    if (doneOriginal === 0) return 0;
    return ((doneOriginal - doneCompressed) / doneOriginal) * 100;
  });

  const doneCount = computed(() =>
    images.value.filter(img => img.status === 'done').length
  );

  const allDone = computed(() =>
    images.value.length > 0 && images.value.every(img => img.status === 'done')
  );

  // === 方法 ===

  /** 添加图片文件 */
  function addImages(files: File[]) {
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      const item: ImageItem = {
        id: `img_${++idCounter}_${Date.now()}`,
        file,
        originalSize: file.size,
        originalUrl: URL.createObjectURL(file),
        compressedBlob: null,
        compressedSize: 0,
        compressedUrl: '',
        status: 'pending',
        error: ''
      };
      images.value.push(item);
    }
  }

  /** 使用 WASM 引擎压缩单张图片 */
  async function compressWithWasm(item: ImageItem): Promise<Blob> {
    await ensureWasmCodecs();

    const arrayBuffer = await item.file.arrayBuffer();
    const mime = item.file.type;
    const targetFormat = options.value.outputFormat === 'auto' ? mime : options.value.outputFormat;

    // Step 1: 解码为 ImageData
    let imageData: ImageData;
    if (mime === 'image/png') {
      imageData = await pngCodec!.decode(arrayBuffer);
    } else if (mime === 'image/webp') {
      imageData = await webpCodec!.decode(arrayBuffer);
    } else {
      // JPEG 或其他格式
      imageData = await jpegCodec!.decode(arrayBuffer);
    }

    // Step 2: 缩放（如果需要）
    imageData = resizeImageData(imageData, options.value.maxWidth, options.value.maxHeight);

    // Step 3: 用目标格式的 WASM 编码器编码
    let outputBuffer: ArrayBuffer;
    let outputMime: string;
    const q = Math.round(options.value.quality * 100);

    if (targetFormat === 'image/png') {
      // 先用 PNG 编码，再用 OxiPNG 优化
      const pngBuffer = await pngCodec!.encode(imageData);
      outputBuffer = await oxipngCodec!.optimise(pngBuffer, { level: 3 });
      outputMime = 'image/png';
    } else if (targetFormat === 'image/webp') {
      outputBuffer = await webpCodec!.encode(imageData, { quality: q });
      outputMime = 'image/webp';
    } else {
      // 默认 JPEG（MozJPEG）
      outputBuffer = await jpegCodec!.encode(imageData, { quality: q });
      outputMime = 'image/jpeg';
    }

    return new Blob([outputBuffer], { type: outputMime });
  }

  /** 使用 Canvas 引擎压缩单张图片 */
  async function compressWithCanvas(item: ImageItem): Promise<Blob> {
    const opts: Parameters<typeof imageCompression>[1] = {
      maxWidthOrHeight: Math.max(options.value.maxWidth, options.value.maxHeight),
      initialQuality: options.value.quality,
      useWebWorker: true,
      maxIteration: 10
    };
    if (options.value.outputFormat !== 'auto') {
      opts.fileType = options.value.outputFormat;
    }
    return await imageCompression(item.file, opts);
  }

  /** 压缩单张图片（根据当前引擎选择） */
  async function compressSingle(item: ImageItem) {
    item.status = 'compressing';
    item.error = '';

    try {
      let result: Blob;
      if (engine.value === 'wasm') {
        result = await compressWithWasm(item);
      } else {
        result = await compressWithCanvas(item);
      }

      if (item.compressedUrl) URL.revokeObjectURL(item.compressedUrl);

      item.compressedBlob = result;
      item.compressedSize = result.size;
      item.compressedUrl = URL.createObjectURL(result);
      item.status = 'done';
    } catch (err) {
      item.status = 'error';
      item.error = String(err);
      console.error('压缩失败:', item.file.name, err);
    }
  }

  /** 批量压缩所有待处理的图片 */
  async function compressAll() {
    isCompressing.value = true;

    // WASM 引擎需要预加载编解码器
    if (engine.value === 'wasm') {
      await ensureWasmCodecs();
    }

    const pendingItems = images.value.filter(
      img => img.status === 'pending' || img.status === 'error'
    );

    // WASM 为串行（避免内存溢出），Canvas 可并行
    const concurrency = engine.value === 'wasm' ? 1 : 3;
    for (let i = 0; i < pendingItems.length; i += concurrency) {
      const batch = pendingItems.slice(i, i + concurrency);
      await Promise.all(batch.map(item => compressSingle(item)));
    }

    isCompressing.value = false;
  }

  /** 下载单张压缩后的图片 */
  function downloadSingle(item: ImageItem) {
    if (!item.compressedBlob) return;
    const ext = getExtFromMime(item.compressedBlob.type);
    const baseName = item.file.name.replace(/\.[^.]+$/, '');
    downloadBlob(item.compressedBlob, `${baseName}_compressed.${ext}`);
  }

  /** 打包为 ZIP 下载 */
  async function downloadAllAsZip() {
    const doneItems = images.value.filter(img => img.status === 'done' && img.compressedBlob);
    if (doneItems.length === 0) return;

    const zip = new JSZip();
    for (const item of doneItems) {
      const ext = getExtFromMime(item.compressedBlob!.type);
      const baseName = item.file.name.replace(/\.[^.]+$/, '');
      zip.file(`${baseName}_compressed.${ext}`, item.compressedBlob!);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(blob, 'compressed_images.zip');
  }

  /** 删除单张图片 */
  function removeImage(id: string) {
    const idx = images.value.findIndex(img => img.id === id);
    if (idx === -1) return;
    const item = images.value[idx];
    URL.revokeObjectURL(item.originalUrl);
    if (item.compressedUrl) URL.revokeObjectURL(item.compressedUrl);
    images.value.splice(idx, 1);
  }

  /** 清空所有图片 */
  function clearAll() {
    for (const item of images.value) {
      URL.revokeObjectURL(item.originalUrl);
      if (item.compressedUrl) URL.revokeObjectURL(item.compressedUrl);
    }
    images.value = [];
  }

  return {
    images,
    options,
    engine,
    isCompressing,
    totalOriginalSize,
    totalCompressedSize,
    totalCompressionRate,
    doneCount,
    allDone,
    addImages,
    compressSingle,
    compressAll,
    downloadSingle,
    downloadAllAsZip,
    removeImage,
    clearAll
  };
}

// === 工具函数 ===

/** 缩放 ImageData（使用 OffscreenCanvas） */
function resizeImageData(imageData: ImageData, maxW: number, maxH: number): ImageData {
  const { width, height } = imageData;
  if (width <= maxW && height <= maxH) return imageData;

  const scale = Math.min(maxW / width, maxH / height);
  const newW = Math.round(width * scale);
  const newH = Math.round(height * scale);

  // 用 OffscreenCanvas 进行高质量缩放
  const srcCanvas = new OffscreenCanvas(width, height);
  const srcCtx = srcCanvas.getContext('2d')!;
  srcCtx.putImageData(imageData, 0, 0);

  const dstCanvas = new OffscreenCanvas(newW, newH);
  const dstCtx = dstCanvas.getContext('2d')!;
  dstCtx.drawImage(srcCanvas, 0, 0, newW, newH);

  return dstCtx.getImageData(0, 0, newW, newH);
}

function getExtFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp'
  };
  return map[mime] || 'jpg';
}

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
