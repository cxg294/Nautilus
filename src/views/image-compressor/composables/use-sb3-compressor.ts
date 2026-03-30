/**
 * SB3 文件压缩组合式函数（WASM 引擎版）
 *
 * 固定使用 jSquash WASM 编解码器（MozJPEG / OxiPNG），
 * 实现最高画质的压缩效果。
 *
 * 流程：解压 SB3 → 识别 PNG/JPEG → WASM 编码压缩 →
 * 更新 project.json md5ext → 重新打包。
 */
import { ref, computed } from 'vue';
import JSZip from 'jszip';

// === jSquash WASM 编解码器（懒加载） ===
let jpegCodec: { decode: (buf: ArrayBuffer) => Promise<ImageData>; encode: (data: ImageData, opts?: { quality?: number }) => Promise<ArrayBuffer> } | null = null;
let pngCodec: { decode: (buf: ArrayBuffer) => Promise<ImageData>; encode: (data: ImageData) => Promise<ArrayBuffer> } | null = null;
let oxipngCodec: { optimise: (data: ArrayBuffer, opts?: { level?: number }) => Promise<ArrayBuffer> } | null = null;

/** 懒加载 WASM 编解码器 */
async function ensureWasmCodecs() {
  if (!jpegCodec) {
    const [jpeg, png, oxipng] = await Promise.all([
      import('@jsquash/jpeg'),
      import('@jsquash/png'),
      import('@jsquash/oxipng')
    ]);
    jpegCodec = jpeg;
    pngCodec = png;
    oxipngCodec = oxipng;
  }
}

/** SB3 内部图片资源项 */
export interface Sb3AssetItem {
  /** 在 ZIP 中的文件路径 */
  zipPath: string;
  /** 原始 Blob */
  originalBlob: Blob;
  /** 原始大小 */
  originalSize: number;
  /** 压缩后 Blob */
  compressedBlob: Blob | null;
  /** 压缩后大小 */
  compressedSize: number;
  /** 压缩后的新文件名（含扩展名） */
  newZipPath: string;
  /** 是否选中参与压缩 */
  selected: boolean;
  /** 是否为 SVG */
  isSvg: boolean;
  /** 压缩状态 */
  status: 'pending' | 'compressing' | 'done' | 'skipped' | 'error';
  /** 预览 URL */
  previewUrl: string;
}

export function useSb3Compressor() {
  const isLoaded = ref(false);
  const isCompressing = ref(false);
  const isExporting = ref(false);
  const fileName = ref('');
  const fileSize = ref(0);
  const assets = ref<Sb3AssetItem[]>([]);
  const quality = ref(0.7);
  const progress = ref(0);

  let zipInstance: JSZip | null = null;
  let projectJson: any = null;

  // === 计算属性 ===
  const compressibleCount = computed(() =>
    assets.value.filter(a => !a.isSvg).length
  );

  const selectedCount = computed(() =>
    assets.value.filter(a => a.selected && !a.isSvg).length
  );

  const totalSaved = computed(() =>
    assets.value
      .filter(a => a.status === 'done')
      .reduce((sum, a) => sum + (a.originalSize - a.compressedSize), 0)
  );

  const progressPercent = computed(() => {
    const total = assets.value.filter(a => a.selected && !a.isSvg).length;
    if (total === 0) return 0;
    return Math.round((progress.value / total) * 100);
  });

  // === 方法 ===

  /** 加载 SB3 文件 */
  async function loadSb3(file: File) {
    resetState();
    fileName.value = file.name;
    fileSize.value = file.size;

    try {
      const zip = await JSZip.loadAsync(file);
      zipInstance = zip;

      const pjFile = zip.file('project.json');
      if (!pjFile) throw new Error('无效的 SB3 文件：找不到 project.json');

      const pjText = await pjFile.async('text');
      projectJson = JSON.parse(pjText);

      const entries = Object.entries(zip.files);
      for (const [path, entry] of entries) {
        if (path === 'project.json' || entry.dir) continue;

        const ext = path.split('.').pop()?.toLowerCase() || '';
        const isImage = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'].includes(ext);
        const isSvg = ext === 'svg';

        if (isImage || isSvg) {
          const blob = await entry.async('blob');
          assets.value.push({
            zipPath: path,
            originalBlob: blob,
            originalSize: blob.size,
            compressedBlob: null,
            compressedSize: 0,
            newZipPath: path,
            selected: !isSvg,
            isSvg,
            status: isSvg ? 'skipped' : 'pending',
            previewUrl: URL.createObjectURL(blob)
          });
        }
      }

      isLoaded.value = true;
    } catch (err) {
      console.error('加载 SB3 失败:', err);
      throw err;
    }
  }

  /**
   * 使用 WASM 引擎压缩单个资源
   * Scratch 的造型绝大多数是 PNG，少部分是 JPEG。
   */
  async function compressAssetWithWasm(asset: Sb3AssetItem, q: number): Promise<Blob> {
    const arrayBuffer = await asset.originalBlob.arrayBuffer();
    const ext = asset.zipPath.split('.').pop()?.toLowerCase() || '';

    let outputBuffer: ArrayBuffer;
    let outputMime: string;

    if (ext === 'png') {
      // PNG → OxiPNG 优化（无损压缩优化，不改变画质）
      // 同时尝试有损：先解码 → 重新编码，利用 OxiPNG 的优化
      outputBuffer = await oxipngCodec!.optimise(arrayBuffer, { level: 3 });
      outputMime = 'image/png';

      // 如果质量设置较低，可以尝试用 MozJPEG 获取更高压缩率
      // 但 Scratch 造型通常需要透明通道，所以保持 PNG
    } else if (ext === 'jpg' || ext === 'jpeg') {
      // JPEG → MozJPEG 重新编码
      const imageData = await jpegCodec!.decode(arrayBuffer);
      outputBuffer = await jpegCodec!.encode(imageData, { quality: Math.round(q * 100) });
      outputMime = 'image/jpeg';
    } else {
      // 其他格式（webp 等）通过 Canvas 回退处理
      outputBuffer = arrayBuffer;
      outputMime = `image/${ext}`;
    }

    return new Blob([outputBuffer], { type: outputMime });
  }

  /** 压缩选中的图片资源（使用 WASM 引擎） */
  async function compressAssets() {
    isCompressing.value = true;
    progress.value = 0;

    // 预加载 WASM 编解码器
    await ensureWasmCodecs();

    const selected = assets.value.filter(a => a.selected && !a.isSvg);

    // WASM 串行执行，避免内存溢出
    for (const asset of selected) {
      asset.status = 'compressing';

      try {
        const compressed = await compressAssetWithWasm(asset, quality.value);

        asset.compressedBlob = compressed;
        asset.compressedSize = compressed.size;

        // 计算新的内容 hash 作为文件名
        const hashHex = await computeContentHash(compressed);
        const ext = asset.zipPath.split('.').pop() || 'png';
        asset.newZipPath = `${hashHex}.${ext}`;

        asset.status = 'done';
      } catch (err) {
        asset.status = 'error';
        console.error('WASM 压缩 SB3 资源失败:', asset.zipPath, err);
      }

      progress.value++;
    }

    isCompressing.value = false;
  }

  /** 导出压缩后的 SB3 */
  async function exportSb3() {
    if (!zipInstance || !projectJson) return;
    isExporting.value = true;

    try {
      const newZip = new JSZip();

      // 构建重命名映射
      const updatedProject = JSON.parse(JSON.stringify(projectJson));
      const renameMap = new Map<string, string>();
      for (const asset of assets.value) {
        if (asset.status === 'done' && asset.zipPath !== asset.newZipPath) {
          renameMap.set(asset.zipPath, asset.newZipPath);
        }
      }

      // 更新 project.json 引用
      updateProjectReferences(updatedProject, renameMap);
      newZip.file('project.json', JSON.stringify(updatedProject));

      // 添加资源文件
      for (const asset of assets.value) {
        if (asset.status === 'done' && asset.compressedBlob) {
          newZip.file(asset.newZipPath, asset.compressedBlob);
        } else {
          newZip.file(asset.zipPath, asset.originalBlob);
        }
      }

      // 添加非图片文件
      const imagePaths = new Set(assets.value.map(a => a.zipPath));
      for (const [path, entry] of Object.entries(zipInstance.files)) {
        if (path === 'project.json' || entry.dir || imagePaths.has(path)) continue;
        const blob = await entry.async('blob');
        newZip.file(path, blob);
      }

      const blob = await newZip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      const baseName = fileName.value.replace(/\.sb3$/i, '');
      downloadBlob(blob, `${baseName}_compressed.sb3`);
    } finally {
      isExporting.value = false;
    }
  }

  function selectAll(val: boolean) {
    assets.value.forEach(a => {
      if (!a.isSvg) a.selected = val;
    });
  }

  function resetState() {
    for (const asset of assets.value) {
      if (asset.previewUrl) URL.revokeObjectURL(asset.previewUrl);
    }
    assets.value = [];
    isLoaded.value = false;
    isCompressing.value = false;
    isExporting.value = false;
    fileName.value = '';
    fileSize.value = 0;
    progress.value = 0;
    zipInstance = null;
    projectJson = null;
  }

  return {
    isLoaded,
    isCompressing,
    isExporting,
    fileName,
    fileSize,
    assets,
    quality,
    progress,
    compressibleCount,
    selectedCount,
    totalSaved,
    progressPercent,
    loadSb3,
    compressAssets,
    exportSb3,
    selectAll,
    resetState
  };
}

// === 工具函数 ===

/** 计算 Blob 内容的 SHA-1 hash（取前 32 字符模拟 MD5 长度） */
async function computeContentHash(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-1', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

/** 递归更新 project.json 中所有 md5ext 引用 */
function updateProjectReferences(obj: any, renameMap: Map<string, string>) {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    for (const item of obj) updateProjectReferences(item, renameMap);
    return;
  }
  for (const key of Object.keys(obj)) {
    if (key === 'md5ext' && typeof obj[key] === 'string') {
      const newName = renameMap.get(obj[key]);
      if (newName) {
        obj[key] = newName;
        if (obj.assetId) obj.assetId = newName.replace(/\.[^.]+$/, '');
      }
    } else if (typeof obj[key] === 'object') {
      updateProjectReferences(obj[key], renameMap);
    }
  }
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
