<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { CourseStructureNode } from '@/service/api/course-structure';
import type { PathOutline } from '../path-outline';
import { describeCondition } from '../condition-description';

const props = defineProps<{ outline: PathOutline; selectedId: number | null; questionIds: number[]; questionsOnly: boolean }>();
const emit = defineEmits<{ select: [node: CourseStructureNode] }>();
const expanded = ref(new Set<string>());
const panel = ref<HTMLElement>();
const questionSet = computed(() => new Set(props.questionIds));
const displayRows = computed(() => props.outline.rows.filter(row =>
  row.ancestors.every(key => expanded.value.has(key)) &&
  (row.kind !== 'node' || !props.questionsOnly || questionSet.value.has(row.node!.nodeId))));
const conditions = computed(() => new Map(props.outline.rows.filter(row => row.edge).map(row => {
  const edge = row.edge!;
  const description = describeCondition(edge.conditionCodeScript);
  const isDefault = (edge.listenVars?.includes('default') || edge.name === '兜底') && description.text === '条件始终成立';
  return [row.key, { text: isDefault ? '兜底分支' : description.translated ? description.text : '暂不支持解释此条件', notes: description.notes }];
})));
const branchCounts = computed(() => new Map(props.outline.rows.filter(row => row.kind === 'branch').map(branch => {
  const descendants = props.outline.rows.filter(row => row.kind === 'node' && row.ancestors.includes(branch.key));
  const count = props.questionsOnly ? descendants.filter(row => questionSet.value.has(row.node!.nodeId)).length : descendants.length;
  return [branch.key, count ? `${count} ${props.questionsOnly ? '个题目节点' : '个节点'}` : descendants.length ? '此分支无题目节点' : '跳转连接'];
})));
function toggle(key: string) {
  const next = new Set(expanded.value);
  if (next.has(key)) next.delete(key); else next.add(key);
  expanded.value = next;
}
async function reveal(nodeId: number | null) {
  const row = props.outline.rows.find(item => item.kind === 'node' && item.node?.nodeId === nodeId);
  if (!row) return;
  expanded.value = new Set([...expanded.value, ...row.ancestors]);
  await nextTick();
  const target = panel.value?.querySelector<HTMLElement>(`[data-outline-node="${nodeId}"]`);
  if (target && panel.value) {
    const parent = panel.value.getBoundingClientRect(), rect = target.getBoundingClientRect();
    if (rect.top < parent.top || rect.bottom > parent.bottom) panel.value.scrollTop += rect.top - parent.top - 24;
  }
}
function select(node: CourseStructureNode) { emit('select', node); void reveal(node.nodeId); }
watch(() => props.outline, () => { expanded.value = new Set(); void reveal(props.selectedId); }, { immediate: true });
watch(() => [props.selectedId, props.questionsOnly], () => void reveal(props.selectedId));
const kindLabel = (node: CourseStructureNode) => ({ video: '视频', 'dialog-video': '对话视频', dialog: '对话', stage: '关卡', exam: '测试', share: '分享' }[node.kind] || '节点');
</script>

<template>
  <div ref="panel" class="outline-list" aria-label="课程分支结构">
    <template v-for="row in displayRows" :key="row.key">
      <div class="outline-row" :style="{ marginLeft: `${row.ancestors.length * 12}px` }">
        <button v-if="row.kind === 'node' && row.node" type="button" class="outline-node"
          :class="{ active: row.node.nodeId === selectedId }" :data-outline-node="row.node.nodeId"
          :aria-current="row.node.nodeId === selectedId ? 'step' : undefined" @click="select(row.node)">
          <span class="node-heading"><span class="sequence">{{ row.node.sequenceNo }}</span><strong>{{ row.node.nodeName }}</strong></span>
          <span class="node-meta">{{ kindLabel(row.node) }}<span v-if="row.merge"> · 汇合点</span><span v-if="row.node.boards.length"> · {{ row.node.boards.length }} 关卡</span></span>
        </button>
        <template v-else-if="row.kind === 'branch'">
          <button type="button" class="branch-toggle" :aria-expanded="expanded.has(row.key)" @click="toggle(row.key)">
            <SvgIcon :icon="expanded.has(row.key) ? 'mdi:chevron-down' : 'mdi:chevron-right'" />
            <span>{{ conditions.get(row.key)?.text }}</span>
            <small>{{ branchCounts.get(row.key) }}</small>
          </button>
          <template v-if="expanded.has(row.key)">
            <small v-for="note in conditions.get(row.key)?.notes" :key="note" class="condition-note">{{ note }}</small>
          </template>
        </template>
        <div v-else-if="row.kind === 'condition'" class="condition-label">
          {{ conditions.get(row.key)?.text }}
          <small v-for="note in conditions.get(row.key)?.notes" :key="note" class="condition-note">{{ note }}</small>
        </div>
        <button v-else-if="row.kind === 'reference' && row.node" class="reference-link" type="button" @click="select(row.node)">
          ↪ {{ row.label }} {{ row.node.sequenceNo }} · {{ row.node.nodeName }}
        </button>
        <span v-else class="boundary-label">{{ row.kind === 'reference' ? `${row.label}路径终点` : row.label }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.outline-list { flex: 1; min-height: 0; overflow: auto; padding: 10px; }
.outline-row { border-left: 1px solid rgb(var(--border-color)); padding: 3px 0 3px 8px; }
.outline-node { display: block; width: 100%; text-align: left; color: inherit; padding: 8px; border: 1px solid transparent; border-radius: 7px; background: transparent; cursor: pointer; }
.outline-node:hover, .outline-node.active { background: rgba(24,160,88,.12); border-color: rgba(24,160,88,.3); }
.node-heading { display: flex; align-items: baseline; gap: 6px; }
.node-heading strong { overflow-wrap: anywhere; font-size: 13px; }
.sequence { font-size: 11px; opacity: .65; flex-shrink: 0; }
.node-meta { display: block; margin-top: 4px; font-size: 11px; opacity: .65; }
.branch-toggle { display: flex; flex-wrap: wrap; align-items: center; gap: 5px; width: 100%; padding: 8px 5px; background: rgba(24,160,88,.08); border-radius: 6px; text-align: left; font-size: 12px; color: inherit; cursor: pointer; }
.branch-toggle > span { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.branch-toggle small { width: 100%; padding-left: 21px; opacity: .6; }
.condition-label { font-size: 12px; padding: 4px 8px; overflow-wrap: anywhere; }
.condition-note { display: block; padding: 2px 8px; font-size: 11px; opacity: .65; }
.reference-link { text-align: left; color: rgb(var(--primary-color)); font-size: 12px; padding: 6px; background: transparent; cursor: pointer; overflow-wrap: anywhere; }
.boundary-label { display: block; font-size: 11px; opacity: .65; padding: 6px; }
button:focus-visible { outline: 2px solid rgb(var(--primary-color)); outline-offset: 1px; }
</style>
