<script setup lang="ts">
/**
 * MermaidRenderer — 通用 Mermaid 图渲染组件
 */
import { ref, watch, onMounted, nextTick } from 'vue';
import mermaid from 'mermaid';

const props = defineProps<{
  definition: string;
}>();

const containerRef = ref<HTMLElement>();
const svgContent = ref('');
const error = ref<string | null>(null);

// 初始化 mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  suppressErrorRendering: true,
  flowchart: {
    useMaxWidth: true,
    htmlLabels: true,
    curve: 'basis',
  },
  securityLevel: 'loose',
});

let renderCount = 0;

async function renderDiagram() {
  if (!props.definition || !containerRef.value) return;
  error.value = null;

  try {
    const id = `mermaid-${++renderCount}`;
    const { svg } = await mermaid.render(id, props.definition);
    svgContent.value = svg;
  } catch (err: any) {
    error.value = err.message || '渲染失败';
    console.warn('Mermaid render error:', err);
  }
}

watch(() => props.definition, () => {
  nextTick(renderDiagram);
});

onMounted(() => {
  nextTick(renderDiagram);
});
</script>

<template>
  <div ref="containerRef" class="mermaid-container">
    <div v-if="svgContent" class="mermaid-svg" v-html="svgContent" />
    <NAlert v-else-if="error" type="warning" title="图表渲染失败">
      {{ error }}
    </NAlert>
    <div v-else class="mermaid-loading">
      <NSpin size="small" />
    </div>
  </div>
</template>

<style scoped>
.mermaid-container {
  width: 100%;
  overflow-x: auto;
}

.mermaid-svg {
  display: flex;
  justify-content: center;
}

.mermaid-svg :deep(svg) {
  max-width: 100%;
  height: auto;
}

.mermaid-loading {
  display: flex;
  justify-content: center;
  padding: 40px;
}
</style>
