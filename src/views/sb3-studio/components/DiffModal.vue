<script setup lang="ts">
/**
 * DiffModal — 版本对比弹窗
 *
 * 上传第二个 SB3 文件与当前项目对比
 */
import { ref } from 'vue';
import { useSb3Project } from '../composables/use-sb3-project';
import { parseSB3 } from '../core/sb3Parser';
import { diffProjects } from '../core/diffEngine';

defineProps<{
  visible: boolean;
}>();

const emit = defineEmits(['update:visible']);

const { project, fileName } = useSb3Project();

const compareProject = ref<any>(null);
const compareFileName = ref('');
const diffResult = ref<any>(null);
const loading = ref(false);
const error = ref<string | null>(null);

/** 加载对比文件 */
async function handleFileUpload(options: { file: { file: File | null } }) {
  const file = options.file.file;
  if (!file) return;

  loading.value = true;
  error.value = null;
  try {
    const result = await parseSB3(file);
    compareProject.value = result.project;
    compareFileName.value = result.fileName;
    diffResult.value = diffProjects(project.value, result.project);
  } catch (err: any) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

/** 变更详情的类型标签 */
function detailLabel(detail: any) {
  const map: Record<string, string> = {
    property: '📝 属性变更',
    costumes: '🎨 造型变更',
    sounds: '🔊 声音变更',
    variable: '📦 变量变更',
    blocks: '🧱 积木数量变更',
    scripts: '📜 脚本变更',
  };
  return map[detail.type] || detail.type;
}

function statusType(status: string) {
  if (status === 'added') return 'success';
  if (status === 'removed') return 'error';
  if (status === 'modified') return 'warning';
  return 'default';
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    added: '新增',
    removed: '删除',
    modified: '修改',
    unchanged: '未变更',
  };
  return map[status] || status;
}

function close() {
  emit('update:visible', false);
  diffResult.value = null;
  compareProject.value = null;
  compareFileName.value = '';
  error.value = null;
}
</script>

<template>
  <NModal
    :show="visible"
    preset="card"
    title="⚡ 版本对比"
    style="width: 900px; max-width: 90vw"
    :bordered="false"
    size="huge"
    @update:show="close"
  >
    <!-- 上传对比文件 -->
    <div v-if="!diffResult" style="text-align: center; padding: 40px 0">
      <NText depth="3" style="display: block; margin-bottom: 16px">
        当前文件：<NTag size="small">{{ fileName }}</NTag>
      </NText>
      <NUpload
        :show-file-list="false"
        accept=".sb3,.json"
        :custom-request="() => {}"
        @change="handleFileUpload"
      >
        <NButton type="primary" :loading="loading">
          📂 选择对比文件
        </NButton>
      </NUpload>
      <NAlert v-if="error" type="error" :title="error" style="margin-top: 16px" />
    </div>

    <!-- 对比结果 -->
    <div v-else>
      <!-- 摘要 -->
      <NSpace style="margin-bottom: 16px">
        <NTag size="small">{{ fileName }}</NTag>
        <NText>vs</NText>
        <NTag size="small">{{ compareFileName }}</NTag>
      </NSpace>

      <NSpace style="margin-bottom: 12px">
        <NTag type="success" size="small">新增 {{ diffResult.summary.added }}</NTag>
        <NTag type="error" size="small">删除 {{ diffResult.summary.removed }}</NTag>
        <NTag type="warning" size="small">修改 {{ diffResult.summary.modified }}</NTag>
        <NTag type="default" size="small">未变更 {{ diffResult.summary.unchanged }}</NTag>
      </NSpace>

      <!-- 按角色展开 -->
      <NCollapse>
        <NCollapseItem
          v-for="td in diffResult.targetDiffs.filter((d: any) => d.status !== 'unchanged')"
          :key="td.name"
          :title="td.name"
        >
          <template #header-extra>
            <NTag :type="statusType(td.status)" size="small">{{ statusLabel(td.status) }}</NTag>
          </template>

          <div v-if="td.details.length > 0">
            <div v-for="(detail, idx) in td.details" :key="idx" style="margin-bottom: 8px">
              <NTag size="tiny" style="margin-right: 8px">{{ detailLabel(detail) }}</NTag>

              <!-- 属性变更 -->
              <template v-if="detail.type === 'property'">
                <NText code>{{ detail.key }}</NText>:
                <NText type="error" delete>{{ detail.from }}</NText>
                →
                <NText type="success">{{ detail.to }}</NText>
              </template>

              <!-- 积木数量 -->
              <template v-else-if="detail.type === 'blocks'">
                {{ detail.from }} → {{ detail.to }} 个积木
              </template>

              <!-- 造型/声音 -->
              <template v-else-if="detail.type === 'costumes' || detail.type === 'sounds'">
                {{ detail.action === 'added' ? '➕' : '➖' }}
                {{ detail.items.join(', ') }}
              </template>

              <!-- 变量 -->
              <template v-else-if="detail.type === 'variable'">
                {{ detail.action === 'added' ? '➕' : detail.action === 'removed' ? '➖' : '✏️' }}
                {{ detail.name }}
              </template>

              <!-- 脚本 -->
              <template v-else-if="detail.type === 'scripts'">
                <div v-for="(sd, sidx) in detail.diffs" :key="sidx" class="script-diff">
                  <NTag :type="sd.action === 'added' ? 'success' : sd.action === 'removed' ? 'error' : 'warning'" size="tiny">
                    {{ sd.action === 'added' ? '新增' : sd.action === 'removed' ? '删除' : '修改' }}
                  </NTag>
                  <pre class="diff-code">{{ sd.content || sd.after }}</pre>
                </div>
              </template>
            </div>
          </div>
          <NText v-else depth="3">无详细变更</NText>
        </NCollapseItem>
      </NCollapse>

      <!-- 重新选择 -->
      <div style="text-align: center; margin-top: 16px">
        <NButton size="small" @click="diffResult = null">
          🔄 重新选择对比文件
        </NButton>
      </div>
    </div>
  </NModal>
</template>

<style scoped>
.script-diff {
  margin: 4px 0;
}

.diff-code {
  margin: 4px 0;
  padding: 6px 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  background: var(--n-color-modal);
  border-radius: 4px;
  white-space: pre-wrap;
  max-height: 200px;
  overflow-y: auto;
}
</style>
