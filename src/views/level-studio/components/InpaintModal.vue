<script setup lang="ts">
/**
 * InpaintModal — 局部重绘弹窗
 *
 * Canvas 拖拽画 Mask + 描述输入 + 重绘提交
 */
import { ref, watch, nextTick } from 'vue';
import { useLevelStudio } from '../composables/use-level-studio';

const props = defineProps<{
  visible: boolean;
  imageUrl: string;
}>();

const emit = defineEmits<{
  'update:visible': [val: boolean];
}>();

const { state } = useLevelStudio();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const prompt = ref('');
const loading = ref(false);
const drawing = ref(false);
const startX = ref(0);
const startY = ref(0);
const rectData = ref<{ x: number; y: number; w: number; h: number } | null>(null);

let imageData: ImageData | null = null;
let scale = 1;
let imgWidth = 0;
let imgHeight = 0;

watch(() => props.visible, async (v) => {
  if (v && props.imageUrl) {
    await nextTick();
    loadImage();
  }
});

function loadImage() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const maxW = 640;
    scale = img.width > maxW ? maxW / img.width : 1;
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    imgWidth = img.width;
    imgHeight = img.height;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  };
  img.src = props.imageUrl;
}

function handleMouseDown(e: MouseEvent) {
  const rect = canvasRef.value?.getBoundingClientRect();
  if (!rect) return;
  drawing.value = true;
  startX.value = e.clientX - rect.left;
  startY.value = e.clientY - rect.top;
}

function handleMouseMove(e: MouseEvent) {
  if (!drawing.value || !canvasRef.value) return;
  const canvas = canvasRef.value;
  const ctx = canvas.getContext('2d');
  if (!ctx || !imageData) return;

  const rect = canvas.getBoundingClientRect();
  const curX = e.clientX - rect.left;
  const curY = e.clientY - rect.top;

  ctx.putImageData(imageData, 0, 0);

  const x = Math.min(startX.value, curX);
  const y = Math.min(startY.value, curY);
  const w = Math.abs(curX - startX.value);
  const h = Math.abs(curY - startY.value);

  ctx.fillStyle = 'rgba(124, 92, 252, 0.3)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#7c5cfc';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);

  rectData.value = { x, y, w, h };
}

function handleMouseUp() {
  drawing.value = false;
}

function clearRect() {
  if (canvasRef.value && imageData) {
    const ctx = canvasRef.value.getContext('2d');
    ctx?.putImageData(imageData, 0, 0);
  }
  rectData.value = null;
}

async function handleSubmit() {
  if (!rectData.value || rectData.value.w < 10 || rectData.value.h < 10) {
    return;
  }
  if (!prompt.value.trim()) return;

  loading.value = true;
  try {
    // 创建 Mask Canvas
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = imgWidth;
    maskCanvas.height = imgHeight;
    const maskCtx = maskCanvas.getContext('2d')!;
    maskCtx.fillStyle = 'black';
    maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
    maskCtx.fillStyle = 'white';
    maskCtx.fillRect(
      rectData.value.x / scale,
      rectData.value.y / scale,
      rectData.value.w / scale,
      rectData.value.h / scale,
    );

    // 获取原图 blob
    const imgResp = await fetch(props.imageUrl);
    const imgBlob = await imgResp.blob();

    // 获取 mask blob
    const maskBlob = await new Promise<Blob>((resolve) =>
      maskCanvas.toBlob((b) => resolve(b!), 'image/png')
    );

    const formData = new FormData();
    formData.append('prompt', prompt.value);
    formData.append('image', imgBlob, 'image.png');
    formData.append('mask', maskBlob, 'mask.png');

    const resp = await fetch('/api/level-studio/inpaint', {
      method: 'POST',
      body: formData,
    });

    if (!resp.ok) throw new Error('重绘失败');
    const data = await resp.json();

    // 更新场景图
    if (data.url) {
      state.selectedScene = data.url;
    }

    emit('update:visible', false);
  } catch {
    // error handled by parent
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <NModal
    :show="visible"
    preset="card"
    title="🖌️ 局部重绘"
    style="max-width: 720px"
    :mask-closable="!loading"
    @update:show="emit('update:visible', $event)"
  >
    <p style="font-size: 12px; color: #999; margin: 0 0 10px">
      在图片上拖拽鼠标框选需要重绘的区域
    </p>

    <div class="canvas-container">
      <canvas
        ref="canvasRef"
        class="inpaint-canvas"
        @mousedown="handleMouseDown"
        @mousemove="handleMouseMove"
        @mouseup="handleMouseUp"
      />
    </div>

    <div class="controls">
      <NInput
        v-model:value="prompt"
        placeholder="描述你想如何修改这个区域..."
        size="small"
      />
      <NSpace :size="6">
        <NButton size="small" @click="clearRect">清除选框</NButton>
        <NButton
          type="primary"
          size="small"
          :loading="loading"
          :disabled="!rectData || !prompt.trim()"
          @click="handleSubmit"
        >
          ✨ 重绘
        </NButton>
      </NSpace>
    </div>
  </NModal>
</template>

<style scoped>
.canvas-container {
  border: 1px solid var(--n-border-color, #e5e5e5);
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 12px;
  background: #f5f5f5;
}

.inpaint-canvas {
  display: block;
  width: 100%;
  height: auto;
  cursor: crosshair;
}

.controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
