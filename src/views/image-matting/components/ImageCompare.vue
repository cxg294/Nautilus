<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{
  originalSrc: string;
  resultSrc: string;
}>();

const containerRef = ref<HTMLElement | null>(null);
const sliderPosition = ref(50); // 0-100%

const updateSlider = (e: MouseEvent | TouchEvent) => {
  if (!containerRef.value) return;
  const rect = containerRef.value.getBoundingClientRect();
  
  // 提取坐标
  let clientX = 0;
  if ('touches' in e) {
    clientX = e.touches[0].clientX;
  } else {
    clientX = (e as MouseEvent).clientX;
  }

  // 计算相对位置
  let x = clientX - rect.left;
  // 限制在容器范围内
  x = Math.max(0, Math.min(x, rect.width));
  // 转为百分比
  sliderPosition.value = (x / rect.width) * 100;
};

// 重置位置
watch(() => props.originalSrc, () => {
  sliderPosition.value = 50;
});
</script>

<template>
  <div 
    ref="containerRef"
    class="image-compare-container relative w-full h-full min-h-[400px] overflow-hidden rounded-xl cursor-crosshair select-none bg-white shadow-inner"
    @mousemove="updateSlider"
    @touchmove="updateSlider"
  >
    <!-- 底层：透明网格底图 + AI去背后结果图 -->
    <div class="absolute inset-0 bg-transparent flex items-center justify-center p-4">
      <!-- 渲染网格背景 -->
      <div class="absolute inset-0 bg-pattern z-0 opacity-50"></div>
      <img :src="resultSrc" class="max-w-full max-h-full object-contain pointer-events-none z-10 relative drop-shadow-md" />
    </div>
    
    <!-- 顶层：原始图片（带有 clip-path 切割）-->
    <div 
      class="absolute inset-0 flex items-center justify-center p-4 z-20"
      :style="{ clipPath: `polygon(0 0, ${sliderPosition}% 0, ${sliderPosition}% 100%, 0 100%)` }"
    >
      <!-- 给顶层一个底色，遮住底层可能露出的部分背景 -->
      <div class="absolute inset-0 bg-gray-50/90 z-0"></div>
      <img :src="originalSrc" class="max-w-full max-h-full object-contain pointer-events-none relative z-10" />
    </div>

    <!-- 交互分割线与滑块指示器 -->
    <div 
      class="absolute top-0 bottom-0 w-1 bg-white/80 shadow-[0_0_8px_rgba(0,0,0,0.3)] z-30 pointer-events-none flex flex-col justify-center items-center backdrop-blur-sm"
      :style="{ left: `calc(${sliderPosition}% - 2px)` }"
    >
      <div class="w-10 h-10 bg-white/95 text-gray-600 rounded-full flex items-center justify-center shadow-lg border border-gray-100 backdrop-blur-md transition-transform duration-200">
        <svg xmlns="http://www.w3.org/2000/svg" width="1.4em" height="1.4em" viewBox="0 0 24 24">
          <path fill="currentColor" d="M8 14V9l-4 3zm8 0l4-3l-4-3z" />
        </svg>
      </div>
    </div>
    
    <!-- 提示文本 -->
    <div class="absolute top-4 left-4 z-40 bg-black/50 text-white px-3 py-1 text-xs rounded-full backdrop-blur-md pointer-events-none">
      原图 (拖动对比)
    </div>
    <div class="absolute top-4 right-4 z-40 bg-primary/80 text-white px-3 py-1 text-xs rounded-full backdrop-blur-md pointer-events-none">
      去背效果
    </div>
  </div>
</template>

<style scoped>
.image-compare-container {
  touch-action: pan-y;
}

.bg-pattern {
  background-image: repeating-conic-gradient(#e5e7eb 0 25%, transparent 0 50%);
  background-size: 20px 20px;
}
</style>
