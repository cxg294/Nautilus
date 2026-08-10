<script setup lang="ts">
/**
 * 权限管理工具
 * 管理角色及其可访问的应用/工具权限配置
 */
import { ref, computed, onMounted, h } from 'vue';
import { NButton, NTag, NSpace, NPopconfirm, useMessage } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import {
  fetchRoleList,
  fetchPermissionList,
  fetchCreateRole,
  fetchDeleteRole,
  fetchSetRolePermissions
} from '@/service/api/role-management';
import type { RoleRecord, PermissionRecord } from '@/service/api/role-management';
import { usePageTracker } from '@/hooks/common/use-tracker';

defineOptions({ name: 'RoleManager' });

usePageTracker('role-manager');

const message = useMessage();

// === State ===
const loading = ref(false);
const roles = ref<RoleRecord[]>([]);
const allPermissions = ref<PermissionRecord[]>([]);
const showCreateModal = ref(false);
const showPermModal = ref(false);
const editingRole = ref<RoleRecord | null>(null);
const permSaving = ref(false);
const permissionKeyword = ref('');
const showSelectedOnly = ref(false);

// 选中的权限 keys
const selectedPerms = ref<string[]>([]);

// 创建角色表单
const createForm = ref({ name: '', displayName: '', description: '' });
const creating = ref(false);

// === 权限分类 ===
const permissionGroups = computed(() => {
  const keyword = permissionKeyword.value.trim().toLowerCase();
  const groups = new Map<string, { category: string; group: string; permissions: PermissionRecord[] }>();
  for (const permission of allPermissions.value) {
    const matches = !keyword || [permission.label, permission.description, permission.key, permission.group]
      .some(value => String(value || '').toLowerCase().includes(keyword));
    if (!matches || (showSelectedOnly.value && !isPermSelected(permission.key))) continue;
    const groupKey = `${permission.category}:${permission.group}`;
    if (!groups.has(groupKey)) groups.set(groupKey, { category: permission.category, group: permission.group, permissions: [] });
    groups.get(groupKey)!.permissions.push(permission);
  }
  const categoryOrder = ['账号与系统', '数据与课程', '内容制作', '轻量工具', '其他'];
  return [...groups.values()].sort((a, b) => {
    const categoryDiff = categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category);
    return categoryDiff || a.group.localeCompare(b.group, 'zh-CN');
  });
});

// === Data Loading ===
async function loadData() {
  loading.value = true;
  try {
    const [rolesRes, permsRes] = await Promise.all([fetchRoleList(), fetchPermissionList()]);
    if (!rolesRes.error) roles.value = rolesRes.data;
    if (!permsRes.error) allPermissions.value = permsRes.data;
  } finally {
    loading.value = false;
  }
}

onMounted(loadData);

// === 创建角色 ===
async function handleCreateRole() {
  if (!createForm.value.name || !createForm.value.displayName) {
    message.warning('角色标识和显示名称不能为空');
    return;
  }
  creating.value = true;
  try {
    const { error } = await fetchCreateRole({
      name: createForm.value.name,
      displayName: createForm.value.displayName,
      description: createForm.value.description || undefined
    });
    if (!error) {
      message.success('角色创建成功');
      showCreateModal.value = false;
      createForm.value = { name: '', displayName: '', description: '' };
      await loadData();
    }
  } finally {
    creating.value = false;
  }
}

// === 删除角色 ===
async function handleDeleteRole(role: RoleRecord) {
  const { error } = await fetchDeleteRole(role.id);
  if (!error) {
    message.success(`已删除角色 ${role.display_name}`);
    await loadData();
  }
}

// === 权限配置弹窗 ===
function openPermEditor(role: RoleRecord) {
  editingRole.value = role;
  selectedPerms.value = [...role.permissions];
  showPermModal.value = true;
  permissionKeyword.value = '';
  showSelectedOnly.value = false;
}

function isPermSelected(key: string) {
  return selectedPerms.value.includes(key);
}

function togglePerm(key: string) {
  const permission = allPermissions.value.find(item => item.key === key);
  const idx = selectedPerms.value.indexOf(key);
  if (idx >= 0) {
    selectedPerms.value.splice(idx, 1);
    // 撤销应用访问时，撤销依赖该应用的功能权限。
    selectedPerms.value = selectedPerms.value.filter(item => allPermissions.value.find(p => p.key === item)?.parentKey !== key);
  } else {
    selectedPerms.value.push(key);
    // 功能权限依赖其所属应用的访问权限。
    if (permission?.parentKey && !selectedPerms.value.includes(permission.parentKey)) {
      selectedPerms.value.push(permission.parentKey);
    }
  }
}

async function savePermissions() {
  if (!editingRole.value) return;
  permSaving.value = true;
  try {
    const { error } = await fetchSetRolePermissions(editingRole.value.name, selectedPerms.value);
    if (!error) {
      message.success(`${editingRole.value.display_name} 的权限已更新`);
      showPermModal.value = false;
      await loadData();
    }
  } finally {
    permSaving.value = false;
  }
}

// === 工具名映射 ===
function _permLabel(key: string): string {
  const p = allPermissions.value.find(x => x.key === key);
  return p?.description || key;
}

function permShortName(key: string): string {
  // module:sb3-studio:access → SB3 工作室
  const p = allPermissions.value.find(x => x.key === key);
  if (p?.description) return p.description;
  const parts = key.split(':');
  return parts.length >= 2 ? parts[1] : key;
}

// === 表格列定义 ===
const columns: DataTableColumns<RoleRecord> = [
  { title: 'ID', key: 'id', width: 60 },
  {
    title: '角色标识',
    key: 'name',
    width: 120,
    render(row) {
      return h('code', { class: 'role-code' }, row.name);
    }
  },
  {
    title: '显示名称',
    key: 'display_name',
    width: 120,
    render(row) {
      const children: any[] = [row.display_name];
      if (row.is_system) {
        children.push(
          h(NTag, { size: 'tiny', type: 'info', round: true, style: 'margin-left:6px' }, { default: () => '内置' })
        );
      }
      return h('span', { class: 'role-name-cell' }, children);
    }
  },
  {
    title: '描述',
    key: 'description',
    ellipsis: { tooltip: true }
  },
  {
    title: '权限摘要',
    key: 'permissions',
    width: 320,
    render(row) {
      const toolPerms = row.permissions.filter(p => p.startsWith('module:'));
      const systemPermCount = row.permissions.filter(p => p.startsWith('system:')).length;
      if (row.name === 'owner') {
        return h(NTag, { size: 'small', type: 'success', round: true }, { default: () => '全部权限' });
      }
      if (toolPerms.length === 0 && systemPermCount === 0) {
        return h('span', { style: 'color:#999;font-size:12px' }, '无');
      }
      return h(NSpace, { size: 4 }, {
        default: () => [
          ...toolPerms.slice(0, 3).map(p => h(NTag, { size: 'small', round: true }, { default: () => permShortName(p) })),
          toolPerms.length > 3 ? h(NTag, { size: 'small', round: true }, { default: () => `另 ${toolPerms.length - 3} 个应用` }) : null,
          systemPermCount ? h(NTag, { size: 'small', type: 'warning', round: true }, { default: () => `${systemPermCount} 项管理权限` }) : null
        ].filter(Boolean)
      });
    }
  },
  {
    title: '操作',
    key: 'actions',
    width: 180,
    fixed: 'right',
    render(row) {
      if (row.name === 'owner') {
        return h('span', { style: 'color:#999;font-size:12px' }, '管理员拥有全部权限');
      }
      const btns: any[] = [
        h(
          NButton,
          { size: 'small', type: 'primary', onClick: () => openPermEditor(row) },
          { default: () => '配置权限' }
        )
      ];
      if (!row.is_system) {
        btns.push(
          h(
            NPopconfirm,
            { onPositiveClick: () => handleDeleteRole(row) },
            {
              trigger: () => h(NButton, { size: 'small', type: 'error', quaternary: true }, { default: () => '删除' }),
              default: () => `确定删除角色「${row.display_name}」？`
            }
          )
        );
      }
      return h(NSpace, { size: 6 }, { default: () => btns });
    }
  }
];
</script>

<template>
  <div class="role-manager">
    <!-- Header -->
    <div class="role-manager__header">
      <div class="role-manager__title-row">
        <h2 class="role-manager__title">权限管理</h2>
        <NSpace>
          <NButton type="primary" @click="showCreateModal = true">
            <template #icon>
              <span class="i-mdi-plus" />
            </template>
            新建角色
          </NButton>
          <NButton @click="loadData">
            <template #icon>
              <span class="i-mdi-refresh" />
            </template>
            刷新
          </NButton>
        </NSpace>
      </div>
      <p class="role-manager__desc">管理角色、应用访问和细分能力。系统管理员拥有全部权限且不可修改。</p>
    </div>

    <!-- 角色列表 -->
    <NDataTable
      :columns="columns"
      :data="roles"
      :loading="loading"
      :bordered="false"
      :single-line="false"
      size="small"
      :scroll-x="900"
      :row-key="(row: RoleRecord) => row.id"
      class="role-manager__table"
    />

    <!-- 创建角色弹窗 -->
    <NModal v-model:show="showCreateModal" preset="dialog" title="新建角色" :mask-closable="false">
      <NForm label-placement="left" label-width="80" class="role-manager__form">
        <NFormItem label="角色标识" required>
          <NInput v-model:value="createForm.name" placeholder="如 editor, teacher (字母数字下划线)" />
        </NFormItem>
        <NFormItem label="显示名称" required>
          <NInput v-model:value="createForm.displayName" placeholder="如 编辑员、教师" />
        </NFormItem>
        <NFormItem label="描述">
          <NInput
            v-model:value="createForm.description"
            type="textarea"
            :rows="2"
            placeholder="可选，描述角色用途"
          />
        </NFormItem>
      </NForm>
      <template #action>
        <NSpace>
          <NButton @click="showCreateModal = false">取消</NButton>
          <NButton type="primary" :loading="creating" @click="handleCreateRole">创建</NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- 权限配置弹窗 -->
    <NModal
      v-model:show="showPermModal"
      preset="dialog"
      :title="`配置「${editingRole?.display_name}」的权限`"
      :mask-closable="false"
      style="width: min(760px, calc(100vw - 32px))"
    >
      <div class="perm-editor">
        <div class="perm-toolbar">
          <NInput v-model:value="permissionKeyword" clearable placeholder="搜索应用、能力或权限标识" />
          <NCheckbox v-model:checked="showSelectedOnly">仅看已授权（{{ selectedPerms.length }}）</NCheckbox>
        </div>
        <div v-for="group in permissionGroups" :key="`${group.category}:${group.group}`" class="perm-section">
          <div class="perm-section__heading">
            <h4 class="perm-section__title">{{ group.group }}</h4>
            <NTag size="tiny" :type="group.category === '系统管理' ? 'warning' : 'default'">{{ group.category }}</NTag>
          </div>
          <div class="perm-grid">
            <div v-for="perm in group.permissions" :key="perm.key" class="perm-item" :class="{ 'perm-item--active': isPermSelected(perm.key), 'perm-item--child': perm.parentKey }" @click="togglePerm(perm.key)">
              <NCheckbox :checked="isPermSelected(perm.key)" @click.stop @update:checked="() => togglePerm(perm.key)" />
              <div class="perm-item__content">
                <div class="perm-item__name">
                  {{ perm.label }}
                  <NTag v-if="perm.risk === '管理'" size="tiny" type="warning" round>管理</NTag>
                </div>
                <div class="perm-item__desc">{{ perm.description || perm.key }}</div>
              </div>
            </div>
          </div>
        </div>
        <NEmpty v-if="permissionGroups.length === 0" description="没有匹配的权限" size="small" />
      </div>
      <template #action>
        <NSpace>
          <NButton @click="showPermModal = false">取消</NButton>
          <NButton type="primary" :loading="permSaving" @click="savePermissions">保存</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.role-manager {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 20px;
  gap: 16px;
}

.role-manager__header {
  flex-shrink: 0;
}

.role-manager__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.role-manager__title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.role-manager__desc {
  margin: 0;
  font-size: 13px;
  color: #999;
}

.role-manager__table {
  flex: 1;
  overflow: auto;
}

.role-manager__form {
  padding-top: 12px;
}

.role-code {
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(128, 128, 128, 0.1);
  font-size: 12px;
}

.role-name-cell {
  display: flex;
  align-items: center;
}

/* 权限配置编辑器 */
.perm-editor {
  margin-top: 8px;
  max-height: min(62vh, 640px);
  overflow: auto;
  padding-right: 4px;
}

.perm-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.perm-section {
  margin-bottom: 16px;
}

.perm-section__title {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 500;
  color: #666;
}

.perm-section__heading {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.perm-section__heading .perm-section__title {
  margin: 0;
}

.dark .perm-section__title {
  color: #aaa;
}

.perm-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.perm-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(128, 128, 128, 0.06);
  cursor: pointer;
  transition: all 0.15s;
}

.perm-item--child {
  margin-left: 24px;
}

.perm-item:hover {
  background: rgba(128, 128, 128, 0.12);
}

.perm-item--active {
  background: rgba(24, 160, 88, 0.08);
}

.dark .perm-item {
  background: rgba(255, 255, 255, 0.04);
}

.dark .perm-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.dark .perm-item--active {
  background: rgba(99, 226, 183, 0.1);
}

.perm-item__content {
  min-width: 0;
}

.perm-item__name {
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.perm-item__desc {
  margin-top: 2px;
  color: #999;
  font-size: 12px;
  line-height: 1.4;
}

@media (max-width: 600px) {
  .perm-toolbar {
    align-items: stretch;
    flex-direction: column;
    gap: 8px;
  }
}
</style>
