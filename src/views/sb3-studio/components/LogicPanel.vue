<script setup lang="ts">
/**
 * LogicPanel — 逻辑分析
 *
 * 子 Tab 1: 深度搜索（文本/Opcode 搜索 + 角色过滤 + 高亮 + 分类 Badge）
 * 子 Tab 2: 执行流程图（Mermaid）
 */
import { ref, computed, h } from 'vue';
import { NTag, NText } from 'naive-ui';
import { useSb3Project } from '../composables/use-sb3-project';
import { blockToText } from '../core/blockConverter';
import { buildExecutionFlow } from '../core/flowAnalyzer';
import MermaidRenderer from './MermaidRenderer.vue';

const { project } = useSb3Project();
const subTab = ref('search');

// ─── 搜索积木 ───
const searchQuery = ref('');
const searchMode = ref<'text' | 'opcode'>('text');
const targetFilter = ref<string[]>([]);

/** 角色选项 */
const targetOptions = computed(() =>
  (project.value?.targets || []).map((t: any) => ({
    label: `${t.isStage ? '🎬' : '🎭'} ${t.name}`,
    value: t.name,
  }))
);

/** Scratch 积木分类颜色 */
const CATEGORY_MAP: Record<string, { label: string; color: string }> = {
  motion: { label: '运动', color: '#4C97FF' },
  looks: { label: '外观', color: '#9966FF' },
  sound: { label: '声音', color: '#CF63CF' },
  event: { label: '事件', color: '#FFBF00' },
  control: { label: '控制', color: '#FFAB19' },
  sensing: { label: '侦测', color: '#5CB1D6' },
  operator: { label: '运算', color: '#59C059' },
  data: { label: '变量', color: '#FF8C1A' },
  procedures: { label: '自定义', color: '#FF6680' },
  argument: { label: '参数', color: '#FF6680' },
  pen: { label: '画笔', color: '#0FBD8C' },
  music: { label: '音乐', color: '#D65CD6' },
};

function getCategoryInfo(opcode: string) {
  const prefix = opcode?.split('_')[0] || '';
  return CATEGORY_MAP[prefix] || { label: '其他', color: '#888' };
}

/** 所有积木块（扁平化） */
const allBlocks = computed(() => {
  if (!project.value) return [];
  const results: any[] = [];
  for (const target of project.value.targets || []) {
    const blocks = target.blocks || {};
    for (const [id, block] of Object.entries(blocks) as any[]) {
      if (typeof block !== 'object' || !block.opcode) continue;
      results.push({
        id,
        targetName: target.name,
        isStage: target.isStage,
        opcode: block.opcode,
        text: blockToText(id, blocks),
        topLevel: block.topLevel,
        category: getCategoryInfo(block.opcode),
      });
    }
  }
  return results;
});

/** 搜索结果 */
const searchResults = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return [];

  let pool = allBlocks.value;

  // 角色过滤
  if (targetFilter.value.length > 0) {
    pool = pool.filter(b => targetFilter.value.includes(b.targetName));
  }

  // 搜索方式
  if (searchMode.value === 'opcode') {
    pool = pool.filter(b => b.opcode.toLowerCase().includes(q));
  } else {
    pool = pool.filter(b => {
      if (b.text.toLowerCase().includes(q)) return true;
      if (b.opcode.toLowerCase().includes(q)) return true;
      return false;
    });
  }

  return pool.slice(0, 200);
});

/** 高亮关键词渲染函数 */
function highlightText(text: string, query: string) {
  if (!query.trim()) return text;
  const q = query.trim();
  const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part: string) => {
    if (part.toLowerCase() === q.toLowerCase()) {
      return h('span', {
        style: 'background: rgba(255,165,0,0.25); padding: 0 2px; border-radius: 2px; font-weight: 600;'
      }, part);
    }
    return part;
  });
}

/** 搜索结果表格列 */
const searchColumns = computed(() => [
  {
    title: '角色',
    key: 'targetName',
    width: 120,
    render: (row: any) => `${row.isStage ? '🎬' : '🎭'} ${row.targetName}`,
  },
  {
    title: '分类',
    key: 'category',
    width: 70,
    align: 'center' as const,
    render: (row: any) => h(NTag, {
      size: 'tiny',
      bordered: false,
      style: {
        background: row.category.color + '18',
        color: row.category.color,
        fontWeight: '600',
        fontSize: '10px',
      },
    }, () => row.category.label),
  },
  {
    title: '积木',
    key: 'text',
    ellipsis: { tooltip: true },
    render: (row: any) => h('span', {
      style: `color: ${row.category.color}; font-weight: 500; font-size: 12px;`,
    }, highlightText(row.text, searchQuery.value)),
  },
  {
    title: 'Opcode',
    key: 'opcode',
    width: 200,
    ellipsis: { tooltip: true },
    render: (row: any) => h(NText, { depth: 3, style: 'font-size: 11px; font-family: monospace;' },
      () => highlightText(row.opcode, searchQuery.value)),
  },
]);

// ─── 执行流程图 ───
const flowData = computed(() => {
  if (!project.value) return null;
  try { return buildExecutionFlow(project.value); }
  catch (err) { console.warn('Flow analysis error:', err); return null; }
});

const mermaidDefinition = computed(() => flowData.value?.mermaid || '');

const flowStats = computed(() => {
  if (!flowData.value) return null;
  return {
    nodes: flowData.value.nodes.length,
    edges: flowData.value.edges.length,
    targets: new Set(flowData.value.nodes.map((n: any) => n.targetName)).size,
  };
});
</script>

<template>
  <NTabs v-model:value="subTab" type="segment" size="small">
    <!-- 深度搜索 -->
    <NTabPane name="search" tab="🔍 深度搜索">
      <!-- 搜索工具栏 -->
      <div class="search-toolbar">
        <NRadioGroup v-model:value="searchMode" size="small" style="flex-shrink: 0">
          <NRadioButton value="text">📝 文本搜索</NRadioButton>
          <NRadioButton value="opcode">🧩 Opcode</NRadioButton>
        </NRadioGroup>
        <NInput
          v-model:value="searchQuery"
          :placeholder="searchMode === 'opcode' ? '输入 opcode（如 motion_movesteps）' : '搜索积木文本、变量名、值...'"
          clearable
          size="small"
          style="flex: 1"
        >
          <template #prefix>🔍</template>
        </NInput>
        <NSelect
          v-model:value="targetFilter"
          :options="targetOptions"
          multiple
          placeholder="全部角色"
          size="small"
          clearable
          max-tag-count="responsive"
          style="min-width: 180px; max-width: 280px"
        />
      </div>

      <!-- 结果统计 -->
      <div v-if="searchQuery.trim()" class="search-stats">
        <NText depth="3" style="font-size: 12px">
          找到 <NText type="warning" strong>{{ searchResults.length }}</NText> 个匹配
          <template v-if="searchResults.length >= 200">（已截断，仅显示前 200 个）</template>
        </NText>
      </div>

      <!-- 结果表格 -->
      <NDataTable
        v-if="searchResults.length > 0"
        :columns="searchColumns"
        :data="searchResults"
        :bordered="false"
        :pagination="{ pageSize: 20 }"
        size="small"
        :row-class-name="() => 'search-row'"
      />

      <NEmpty
        v-else-if="searchQuery.trim()"
        description="未找到匹配的积木"
        size="small"
        style="padding: 40px 0"
      />
      <NEmpty
        v-else
        size="small"
        style="padding: 40px 0"
      >
        <template #default>
          <div style="text-align: center; line-height: 1.8">
            <div style="font-size: 13px; color: var(--n-text-color-3)">输入关键词搜索积木</div>
            <div style="font-size: 11px; color: var(--n-text-color-3); margin-top: 4px">
              💡 示例：「广播」「克隆」「如果」「motion_movesteps」
            </div>
          </div>
        </template>
      </NEmpty>
    </NTabPane>

    <!-- 执行流程图 -->
    <NTabPane name="flow" tab="🔀 执行流程图">
      <div v-if="flowStats" style="margin: 12px 0">
        <NSpace>
          <NTag size="small" type="info">{{ flowStats.targets }} 个角色</NTag>
          <NTag size="small" type="success">{{ flowStats.nodes }} 个脚本入口</NTag>
          <NTag size="small" type="warning">{{ flowStats.edges }} 个广播连接</NTag>
        </NSpace>
      </div>

      <NCard v-if="mermaidDefinition" :bordered="false" size="small" style="margin-top: 8px">
        <MermaidRenderer :definition="mermaidDefinition" />
      </NCard>

      <NEmpty
        v-else
        description="当前项目没有可分析的脚本"
        size="small"
        style="padding: 40px 0"
      />
    </NTabPane>
  </NTabs>
</template>

<style scoped>
.search-toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 10px 0;
  flex-wrap: wrap;
}

.search-stats {
  margin-bottom: 8px;
}

:deep(.search-row td) {
  padding-top: 4px !important;
  padding-bottom: 4px !important;
}
</style>
