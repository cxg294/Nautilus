<script setup lang="ts">
/**
 * ElementPanel — 元素处理面板
 *
 * Bbox Canvas 叠加可视化 + 元素列表（直接用/重绘切换）+ 批量操作
 */
import { ref, onMounted, nextTick, watch } from 'vue';
import { useLevelStudio } from '../composables/use-level-studio';
import { BBOX_COLORS } from '../constants/presets';

const emit = defineEmits<{
  openInpaint: [url: string];
}>();

const {
  state, cropElement, regenerateElement,
  processAllElements, switchElementMode, goToExport,
} = useLevelStudio();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const canvasScale = ref(1);
const hoveredIdx = ref(-1);

/** 在 Canvas 上绘制场景图 + Bbox 叠加 */
function drawBboxOverlay() {
  const canvas = canvasRef.value;
  if (!canvas || !state.selectedScene) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const maxWidth = 600;
    const scale = img.width > maxWidth ? maxWidth / img.width : 1;
    canvas.width = img.width * scale;
    canvas.height = img.height * scale;
    canvasScale.value = scale;

    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    state.elements.forEach((elem, idx) => {
      const [x, y, w, h] = elem.bbox;
      const color = BBOX_COLORS[idx % BBOX_COLORS.length];
      const sx = x * scale;
      const sy = y * scale;
      const sw = w * scale;
      const sh = h * scale;

      const isHovered = hoveredIdx.value === idx;

      // 填充
      ctx.fillStyle = color + (isHovered ? '40' : '15');
      ctx.fillRect(sx, sy, sw, sh);

      // 边框
      ctx.strokeStyle = color;
      ctx.lineWidth = isHovered ? 3 : 1.5;
      ctx.strokeRect(sx, sy, sw, sh);

      // 标签
      const label = `${idx + 1}. ${elem.name}${elem.occluded ? ' ⚠️' : ''}`;
      ctx.font = 'bold 11px Inter, system-ui, sans-serif';
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = color;
      ctx.fillRect(sx, sy - 18, tw + 10, 18);
      ctx.fillStyle = '#fff';
      ctx.fillText(label, sx + 5, sy - 5);
    });
  };
  img.src = state.selectedScene;
}

watch(hoveredIdx, () => drawBboxOverlay());
watch(() => state.elements.length, () => nextTick(drawBboxOverlay));

onMounted(() => {
  nextTick(drawBboxOverlay);
});

/** 处理单个元素 */
async function handleCrop(idx: number) {
  switchElementMode(idx, 'crop');
  await cropElement(idx);
}

async function handleRegen(idx: number) {
  switchElementMode(idx, 'regen');
  await regenerateElement(idx);
}

/** 批量处理 */
const batchLoading = ref(false);
async function handleBatchProcess() {
  batchLoading.value = true;
  await processAllElements();
  batchLoading.value = false;
}

/** 判断是否所有选中元素都已处理 */
function allProcessed() {
  return state.elements
    .filter(el => el.selected)
    .every(el => el.activeUrl);
}
</script>

<template>
  <div class="element-panel">
    <div class="panel-layout">
      <!-- 左侧：Canvas 场景预览 -->
      <div class="canvas-side">
        <div class="section-label">
          <span>🔍 元素识别结果</span>
          <NTag size="tiny" type="info">{{ state.elements.length }} 个元素</NTag>
        </div>
        <div class="canvas-wrapper">
          <canvas ref="canvasRef" class="bbox-canvas" />
        </div>
        <div class="canvas-actions">
          <NButton size="tiny" quaternary @click="emit('openInpaint', state.selectedScene)">
            🖌️ 局部重绘
          </NButton>
        </div>
      </div>

      <!-- 右侧：元素列表 -->
      <div class="list-side">
        <div class="section-label">
          <span>🧩 元素操作</span>
        </div>

        <div class="element-list">
          <div
            v-for="(el, idx) in state.elements"
            :key="idx"
            class="element-row"
            :class="{ dimmed: !el.selected }"
            @mouseenter="hoveredIdx = idx"
            @mouseleave="hoveredIdx = -1"
          >
            <NCheckbox v-model:checked="el.selected" size="small" />

            <div
              class="color-dot"
              :style="{ background: BBOX_COLORS[idx % BBOX_COLORS.length] }"
            />

            <div class="el-info">
              <span class="el-name">{{ el.name }}</span>
              <NTag v-if="el.occluded" size="tiny" type="warning">有遮挡</NTag>
              <span class="el-size">{{ el.bbox[2] }}×{{ el.bbox[3] }}</span>
            </div>

            <div class="el-actions">
              <NButtonGroup size="tiny">
                <NButton
                  :type="el.mode === 'crop' ? 'primary' : 'default'"
                  :disabled="!el.selected"
                  :loading="el.loading && el.mode === 'crop'"
                  @click="handleCrop(idx)"
                >
                  ✅ 直接用
                </NButton>
                <NButton
                  :type="el.mode === 'regen' ? 'primary' : 'default'"
                  :disabled="!el.selected"
                  :loading="el.loading && el.mode === 'regen'"
                  @click="handleRegen(idx)"
                >
                  🔄 重绘
                </NButton>
              </NButtonGroup>
            </div>

            <!-- 处理结果缩略图 -->
            <div v-if="el.activeUrl" class="el-preview">
              <img :src="el.activeUrl" alt="预览" class="preview-thumb" />
            </div>
          </div>
        </div>

        <!-- 批量操作 -->
        <div class="batch-actions">
          <NButton
            size="small"
            :loading="batchLoading"
            @click="handleBatchProcess"
          >
            🚀 批量处理所有选中
          </NButton>
          <NButton
            type="primary"
            size="small"
            :disabled="!allProcessed()"
            @click="goToExport"
          >
            📦 进入导出 →
          </NButton>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.element-panel {
  max-width: 960px;
  margin: 0 auto;
}

.panel-layout {
  display: flex;
  gap: 20px;
}

.canvas-side {
  flex-shrink: 0;
  width: 400px;
}

.list-side {
  flex: 1;
  min-width: 0;
}

.section-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 10px;
}

.canvas-wrapper {
  border: 1px solid var(--n-border-color, #e5e5e5);
  border-radius: 8px;
  overflow: hidden;
  background: #f5f5f5;
}

.bbox-canvas {
  display: block;
  width: 100%;
  height: auto;
}

.canvas-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 6px;
}

/* 元素列表 */
.element-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 420px;
  overflow-y: auto;
}

.element-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--n-border-color, #e5e5e5);
  border-radius: 8px;
  transition: all 0.15s;
  flex-wrap: wrap;
}

.element-row:hover {
  background: rgba(124, 92, 252, 0.04);
  border-color: rgba(124, 92, 252, 0.2);
}

.element-row.dimmed {
  opacity: 0.4;
}

.color-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.el-info {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.el-name {
  font-size: 13px;
  font-weight: 500;
}

.el-size {
  font-size: 11px;
  color: var(--n-text-color-3, #999);
}

.el-actions {
  flex-shrink: 0;
}

.el-preview {
  width: 100%;
  margin-top: 6px;
}

.preview-thumb {
  height: 48px;
  border-radius: 4px;
  border: 1px solid var(--n-border-color, #e5e5e5);
  object-fit: contain;
  background: #fafafa;
}

/* 批量操作 */
.batch-actions {
  display: flex;
  justify-content: space-between;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--n-border-color, #e5e5e5);
}

@media (max-width: 768px) {
  .panel-layout {
    flex-direction: column;
  }
  .canvas-side {
    width: 100%;
  }
}
</style>
