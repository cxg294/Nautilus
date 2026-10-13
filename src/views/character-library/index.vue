<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { useDialog, useMessage } from 'naive-ui';
import {
  fetchCharacterLibrary,
  saveLibraryCharacter,
  archiveLibraryCharacter,
  type CharacterRecord
} from '@/service/api/character-library';
import { getToken } from '@/store/modules/auth/shared';
import { createCharacter, PLACEHOLDER, type WorkshopCharacter } from '../sequence-player/workshop/model';
import CharacterEditor from './components/CharacterEditor.vue';
defineOptions({ name: 'CharacterLibrary' });
const message = useMessage(),
  dialog = useDialog();
const records = ref<CharacterRecord[]>([]);
const record = ref<CharacterRecord>();
const draft = ref<WorkshopCharacter>();
const baseline = ref('');
const busy = ref(false),
  loading = ref(false),
  failed = ref(false),
  showArchived = ref(false);
const dirty = computed(() => !!draft.value && JSON.stringify(draft.value) !== baseline.value);
const visible = computed(() => records.value.filter(r => showArchived.value || !r.archived));
const moreOptions = computed(() => [
  { label: '刷新角色列表', key: 'refresh', disabled: busy.value || loading.value },
  { label: showArchived.value ? '隐藏归档角色' : '显示归档角色', key: 'archived' },
  ...(record.value
    ? [{ label: record.value.archived ? '恢复当前角色' : '归档当前角色', key: 'archive', disabled: busy.value }]
    : [])
]);
function more(key: string) {
  if (key === 'refresh') void load();
  if (key === 'archived') showArchived.value = !showArchived.value;
  if (key === 'archive') void archive();
}
function portrait(character: WorkshopCharacter) {
  const url =
    (character.poses.find(p => p.id === character.defaultPoseId) || character.poses[0])?.imageUrl || PLACEHOLDER;
  return /^\/api\/(sequence-player|character-library)\/assets\//.test(url)
    ? `${url}?_token=${encodeURIComponent(getToken())}`
    : url;
}
function canDiscard(): Promise<boolean> {
  if (!dirty.value) return Promise.resolve(true);
  return new Promise(resolve =>
    dialog.warning({
      title: '还有未保存的配置',
      content: '离开会丢弃本次修改。',
      positiveText: '丢弃修改',
      negativeText: '继续编辑',
      onPositiveClick: () => resolve(true),
      onNegativeClick: () => resolve(false),
      onClose: () => resolve(false),
      onMaskClick: () => resolve(false)
    })
  );
}
async function select(value?: CharacterRecord) {
  if (!(await canDiscard())) return;
  record.value = value;
  draft.value = value ? JSON.parse(JSON.stringify(value.character)) : createCharacter('新人物');
  draft.value!.aliases ||= [];
  baseline.value = value ? JSON.stringify(draft.value) : '';
}
async function load() {
  if (!(await canDiscard())) return;
  loading.value = true;
  failed.value = false;
  const r = await fetchCharacterLibrary();
  loading.value = false;
  if (r.error || !r.data) {
    failed.value = true;
    return;
  }
  records.value = r.data;
  baseline.value = JSON.stringify(draft.value);
  await select(records.value.find(item => item.id === record.value?.id) || records.value.find(item => !item.archived));
}
async function save() {
  if (!draft.value || busy.value) return;
  busy.value = true;
  const snapshot = JSON.parse(JSON.stringify(draft.value));
  const r = await saveLibraryCharacter(snapshot, record.value);
  busy.value = false;
  if (r.error || !r.data) return;
  const index = records.value.findIndex(v => v.id === r.data.id);
  if (index < 0) records.value.push(r.data);
  else records.value[index] = r.data;
  record.value = r.data;
  baseline.value = JSON.stringify(snapshot);
  message.success('角色已保存');
}
async function archive() {
  if (!record.value || !(await canDiscard())) return;
  busy.value = true;
  const r = await archiveLibraryCharacter(record.value, !record.value.archived);
  busy.value = false;
  if (r.error || !r.data) return;
  records.value = records.value.map(v => (v.id === r.data.id ? r.data : v));
  baseline.value = JSON.stringify(draft.value);
  await select(r.data);
  message.success(r.data.archived ? '已归档，已有项目不受影响' : '已恢复人物');
}
onBeforeRouteLeave(canDiscard);
onMounted(load);
</script>
<template>
  <div class="character-library-page">
    <header class="page-heading">
      <h1>人物声音与立绘</h1>
      <div class="actions">
        <span v-if="draft" class="save-status">
          {{ dirty ? '未保存' : '已保存' }}{{ record?.archived ? ' · 已归档' : '' }}
        </span>
        <NButton type="primary" :loading="busy" :disabled="!draft || !dirty || loading" @click="save">保存</NButton>
      </div>
    </header>
    <NAlert v-if="failed" type="error">人物库读取失败，请在角色列表的更多菜单中刷新重试。</NAlert>
    <div class="library-content">
      <aside class="character-sidebar" aria-label="角色列表">
        <div class="list-heading">
          <strong>
            角色
            <span>{{ visible.length }}</span>
          </strong>
          <NDropdown trigger="click" :options="moreOptions" @select="more">
            <NButton text aria-label="角色列表更多操作">•••</NButton>
          </NDropdown>
        </div>
        <NButton block dashed :disabled="busy || loading || failed" class="add-character" @click="select()">
          ＋ 新增角色
        </NButton>
        <div class="person-list">
          <NButton v-if="draft && !record" block secondary type="primary" class="new-person" aria-current="true">
            <span class="person-item">
              <strong>{{ draft.displayName || '新角色' }}</strong>
              <small>正在创建</small>
            </span>
          </NButton>
          <NButton
            v-for="item in visible"
            :key="item.id"
            block
            secondary
            :type="record?.id === item.id ? 'primary' : 'default'"
            :aria-current="record?.id === item.id ? 'true' : undefined"
            :disabled="busy || loading"
            @click="select(item)"
          >
            <img class="person-avatar" :src="portrait(item.character)" alt="" />
            <span class="person-item">
              <strong>{{ record?.id === item.id ? draft?.displayName : item.character.displayName }}</strong>
              <small>{{ item.archived ? '已归档' : `${item.character.poses.length} 张立绘` }}</small>
            </span>
          </NButton>
        </div>
      </aside>
      <main v-if="draft">
        <CharacterEditor :key="record?.id || draft.id" v-model:character="draft" :disabled="busy || loading" />
      </main>
      <div v-else class="empty-library">
        {{ loading ? '正在读取角色…' : '从左侧新增一个角色，开始设置立绘和声音。' }}
      </div>
    </div>
  </div>
</template>
<style scoped>
.character-library-page {
  padding: 20px 24px;
  height: 100%;
  overflow: auto;
}
.page-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
}
h1 {
  font-size: 20px;
  font-weight: 650;
}
.actions {
  display: flex;
  gap: 12px;
  align-items: center;
}
.save-status {
  color: rgb(var(--base-text-color) / 0.5);
  font-size: 12px;
}
.library-content {
  display: grid;
  grid-template-columns: 164px minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}
.character-sidebar {
  min-width: 0;
}
.list-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 30px;
  margin-bottom: 10px;
}
.list-heading span {
  margin-left: 6px;
  font-size: 12px;
  font-weight: 400;
  color: rgb(var(--base-text-color) / 0.45);
}
.add-character {
  margin-bottom: 12px;
}
.person-list {
  display: grid;
  gap: 6px;
}
.person-list .n-button {
  height: auto;
  padding: 10px;
}
.person-list :deep(.n-button__content) {
  justify-content: flex-start;
  width: 100%;
  gap: 10px;
}
.person-avatar {
  width: 36px;
  height: 42px;
  object-fit: contain;
  flex-shrink: 0;
  background: #fff;
  border-radius: 6px;
}
.person-item {
  display: grid;
  gap: 4px;
  text-align: left;
  white-space: normal;
  overflow-wrap: anywhere;
}
.person-item strong {
  font-size: 13px;
  font-weight: 550;
}
.person-item small {
  font-size: 11px;
  opacity: 0.55;
}
main {
  min-width: 0;
}
.empty-library {
  padding: 80px 20px;
  text-align: center;
  color: rgb(var(--base-text-color) / 0.5);
}
@media (max-width: 1000px) {
  .character-library-page {
    padding: 16px;
  }
  .library-content {
    grid-template-columns: 136px minmax(0, 1fr);
    gap: 16px;
  }
}
@media (max-width: 700px) {
  .library-content {
    grid-template-columns: 1fr;
  }
  .person-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    max-height: 200px;
    overflow: auto;
  }
}
</style>
