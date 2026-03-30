<script setup lang="ts">
/**
 * DataPanel — 变量与广播（V3）
 *
 * 新增：广播发送者/接收者可点击，跳转到素材管理对应角色的脚本
 */
import { ref, computed, h } from 'vue';
import { NTag, NButton, NPopconfirm, useDialog, useMessage } from 'naive-ui';
import { useSb3Project } from '../composables/use-sb3-project';
import { computeVarStats, computeBroadcastStats } from '../core/analyzer';

const dialog = useDialog();
const message = useMessage();
const { project, navigateToScript } = useSb3Project();
const subTab = ref('variables');

/** 变量/列表统计 */
const varStats = computed(() => {
  if (!project.value) return { variables: [], lists: [] };
  return computeVarStats(project.value.targets || []);
});

/** 广播统计 */
const broadcastStats = computed(() => {
  if (!project.value) return [];
  return computeBroadcastStats(project.value.targets || []);
});

/** 未使用的变量 */
const unusedVars = computed(() => varStats.value.variables.filter((v: any) => v.reads === 0 && v.writes === 0));

/** 广播状态颜色映射 */
function bcStatusType(status: string) {
  if (status === 'normal') return 'success';
  if (status === 'send-only') return 'warning';
  if (status === 'receive-only') return 'error';
  if (status === 'dynamic') return 'info';
  return 'default';
}
function bcStatusLabel(status: string) {
  const map: Record<string, string> = {
    normal: '正常', 'send-only': '仅发送', 'receive-only': '仅接收',
    dynamic: '动态', unused: '未使用',
  };
  return map[status] || status;
}

/** 引用者格式化 */
function formatRefs(referencedBy: Record<string, { reads: number; writes: number }>) {
  return Object.entries(referencedBy)
    .map(([name, { reads, writes }]) => `${name}(读${reads}/写${writes})`)
    .join(', ');
}

// ──── 变量重命名 ────
function renameVariable(varInfo: any) {
  const oldName = varInfo.name;
  const inputRef = ref(oldName);
  dialog.create({
    title: `📝 重命名变量`,
    content: () => h('div', { style: 'padding: 8px 0' }, [
      h('div', { style: 'font-size: 12px; color: #888; margin-bottom: 8px' }, `当前名称：${oldName}`),
      h('input', {
        value: inputRef.value,
        onInput: (e: any) => { inputRef.value = e.target.value; },
        style: 'width: 100%; padding: 6px 8px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 13px;',
        placeholder: '输入新名称',
      }),
    ]),
    positiveText: '确认',
    negativeText: '取消',
    onPositiveClick: () => {
      const newName = inputRef.value.trim();
      if (!newName || newName === oldName) return;
      doRenameVariable(oldName, newName, varInfo.varId, varInfo.scope === 'global');
    },
  });
}

function doRenameVariable(oldName: string, newName: string, varId: string, isGlobal: boolean) {
  if (!project.value) return;
  let count = 0;
  for (const target of project.value.targets || []) {
    if (target.variables) {
      for (const [id, varDef] of Object.entries(target.variables) as [string, any][]) {
        if (Array.isArray(varDef) && varDef[0] === oldName) {
          varDef[0] = newName;
          count++;
        }
      }
    }
    if (target.blocks) {
      for (const [, block] of Object.entries(target.blocks) as [string, any][]) {
        if (typeof block !== 'object' || !block.opcode) continue;
        if (block.fields?.VARIABLE && block.fields.VARIABLE[0] === oldName) {
          block.fields.VARIABLE[0] = newName;
          count++;
        }
      }
    }
  }
  message.success(`✅ 已将「${oldName}」重命名为「${newName}」（修改 ${count} 处）`);
}

// ──── 删除无效变量 ────
function deleteUnusedVariables() {
  if (!project.value) return;
  const unused = unusedVars.value;
  if (unused.length === 0) { message.info('没有未使用的变量'); return; }

  let deleted = 0;
  for (const uv of unused) {
    for (const target of project.value.targets || []) {
      if (target.variables) {
        for (const [id, varDef] of Object.entries(target.variables) as [string, any][]) {
          if (Array.isArray(varDef) && varDef[0] === uv.name) {
            delete target.variables[id];
            deleted++;
          }
        }
      }
    }
  }
  message.success(`🗑️ 已删除 ${deleted} 个无效变量`);
}

// ──── 广播改名 ────
function renameBroadcast(bc: any) {
  const oldName = bc.name;
  const inputRef = ref(oldName);
  dialog.create({
    title: '📡 重命名广播',
    content: () => h('div', { style: 'padding: 8px 0' }, [
      h('div', { style: 'font-size: 12px; color: #888; margin-bottom: 8px' }, `当前名称：${oldName}`),
      h('input', {
        value: inputRef.value,
        onInput: (e: any) => { inputRef.value = e.target.value; },
        style: 'width: 100%; padding: 6px 8px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 13px;',
        placeholder: '输入新名称',
      }),
    ]),
    positiveText: '确认',
    negativeText: '取消',
    onPositiveClick: () => {
      const newName = inputRef.value.trim();
      if (!newName || newName === oldName) return;
      doRenameBroadcast(oldName, newName);
    },
  });
}

function doRenameBroadcast(oldName: string, newName: string) {
  if (!project.value) return;
  let count = 0;
  for (const target of project.value.targets || []) {
    if (target.broadcasts) {
      for (const [id, name] of Object.entries(target.broadcasts) as [string, string][]) {
        if (name === oldName) {
          target.broadcasts[id] = newName;
          count++;
        }
      }
    }
    if (target.blocks) {
      for (const [, block] of Object.entries(target.blocks) as [string, any][]) {
        if (typeof block !== 'object' || !block.opcode) continue;
        if (block.fields?.BROADCAST_OPTION && block.fields.BROADCAST_OPTION[0] === oldName) {
          block.fields.BROADCAST_OPTION[0] = newName;
          count++;
        }
        if (block.inputs?.BROADCAST_INPUT) {
          const input = block.inputs.BROADCAST_INPUT;
          if (Array.isArray(input[1]) && input[1][1] === oldName) {
            input[1][1] = newName;
            count++;
          }
        }
      }
    }
  }
  message.success(`✅ 已将广播「${oldName}」重命名为「${newName}」（修改 ${count} 处）`);
}

// ──── 广播跳转到素材管理 ────
function goToTargetScript(targetName: string, broadcastName: string) {
  navigateToScript(targetName, broadcastName);
  message.info(`🔗 正在跳转到「${targetName}」…`);
}

/** 创建可点击的角色名链接 */
function renderClickableTarget(targetName: string, broadcastName: string, suffix?: string) {
  return h('span', {
    style: 'cursor: pointer; color: #18a058; text-decoration: underline; text-decoration-style: dotted; margin-right: 4px',
    onClick: () => goToTargetScript(targetName, broadcastName),
    title: `点击跳转到「${targetName}」的相关脚本`,
  }, targetName + (suffix || ''));
}

/** 变量表格列 */
const varColumns = computed(() => [
  { title: '名称', key: 'name', ellipsis: true },
  {
    title: '作用域', key: 'scope', width: 100,
    render: (row: any) => row.scope === 'global' ? '🌐 全局' : `🎭 ${row.targetName}`,
  },
  { title: '当前值', key: 'value', width: 120, ellipsis: true },
  { title: '读取', key: 'reads', width: 55, align: 'center' as const },
  { title: '写入', key: 'writes', width: 55, align: 'center' as const },
  {
    title: '引用者', key: 'referencedBy', ellipsis: true,
    render: (row: any) => formatRefs(row.referencedBy),
  },
  {
    title: '操作', key: 'actions', width: 80, align: 'center' as const,
    render: (row: any) => h(NButton, {
      size: 'tiny',
      quaternary: true,
      onClick: () => renameVariable(row),
    }, () => '✏️ 改名'),
  },
]);

const listColumns = [
  { title: '名称', key: 'name', ellipsis: true },
  {
    title: '作用域', key: 'scope', width: 100,
    render: (row: any) => row.scope === 'global' ? '🌐 全局' : `🎭 ${row.targetName}`,
  },
  { title: '项目数', key: 'itemCount', width: 80, align: 'center' as const, render: (row: any) => Array.isArray(row.value) ? row.value.length : '—' },
  { title: '读取', key: 'reads', width: 60, align: 'center' as const },
  { title: '写入', key: 'writes', width: 60, align: 'center' as const },
];

/** 广播表格列 —— 发送者/接收者可点击跳转 */
const bcColumns = computed(() => [
  { title: '广播名称', key: 'name', ellipsis: true },
  {
    title: '状态', key: 'status', width: 100, align: 'center' as const,
    render: (row: any) => h(NTag, { size: 'small', type: bcStatusType(row.status) }, () => bcStatusLabel(row.status)),
  },
  {
    title: '发送者', key: 'senders', ellipsis: true,
    render: (row: any) => {
      if (!row.senders.length) return '—';
      return h('span', null, row.senders.map((s: any, i: number) => [
        i > 0 ? ', ' : '',
        renderClickableTarget(s.target, row.name, s.isWait ? '(等待)' : ''),
      ]).flat());
    },
  },
  {
    title: '接收者', key: 'receivers', ellipsis: true,
    render: (row: any) => {
      if (!row.receivers.length) return '—';
      return h('span', null, row.receivers.map((r: string, i: number) => [
        i > 0 ? ', ' : '',
        renderClickableTarget(r, row.name),
      ]).flat());
    },
  },
  {
    title: '操作', key: 'actions', width: 80, align: 'center' as const,
    render: (row: any) => h(NButton, {
      size: 'tiny',
      quaternary: true,
      onClick: () => renameBroadcast(row),
    }, () => '✏️ 改名'),
  },
]);
</script>

<template>
  <NTabs v-model:value="subTab" type="segment" size="small">
    <!-- 变量与列表 -->
    <NTabPane name="variables" tab="📦 变量与列表">
      <div style="display: flex; align-items: center; gap: 8px; margin: 12px 0 8px">
        <NH4 prefix="bar" style="margin: 0">变量</NH4>
        <NPopconfirm
          v-if="unusedVars.length > 0"
          @positive-click="deleteUnusedVariables"
        >
          <template #trigger>
            <NButton size="tiny" type="error" ghost>
              🗑️ 删除 {{ unusedVars.length }} 个无效变量
            </NButton>
          </template>
          确认删除所有未使用的变量？此操作不可撤销！
        </NPopconfirm>
      </div>
      <NDataTable
        v-if="varStats.variables.length > 0"
        :columns="varColumns"
        :data="varStats.variables"
        :bordered="false"
        :pagination="false"
        size="small"
        :row-class-name="(row: any) => (row.reads === 0 && row.writes === 0) ? 'unused-row' : ''"
      />
      <NEmpty v-else description="无变量" size="small" style="padding: 20px 0" />

      <NH4 prefix="bar" style="margin: 20px 0 8px">列表</NH4>
      <NDataTable
        v-if="varStats.lists.length > 0"
        :columns="listColumns"
        :data="varStats.lists"
        :bordered="false"
        :pagination="false"
        size="small"
      />
      <NEmpty v-else description="无列表" size="small" style="padding: 20px 0" />
    </NTabPane>

    <!-- 广播消息 -->
    <NTabPane name="broadcasts" tab="📡 广播消息">
      <div style="margin: 8px 0 4px; font-size: 12px; color: var(--n-text-color-3)">
        💡 点击发送者/接收者名称可跳转到素材管理中对应角色的脚本
      </div>
      <NDataTable
        v-if="broadcastStats.length > 0"
        :columns="bcColumns"
        :data="broadcastStats"
        :bordered="false"
        :pagination="false"
        size="small"
      />
      <NEmpty v-else description="无广播消息" size="small" style="padding: 40px 0" />
    </NTabPane>
  </NTabs>
</template>

<style scoped>
:deep(.unused-row) {
  opacity: 0.5;
  background: rgba(255,0,0,0.03);
}
:deep(.unused-row:hover) {
  opacity: 0.8;
}
</style>
