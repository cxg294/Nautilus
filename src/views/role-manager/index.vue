<script setup lang="ts">
import { ref, computed, onMounted, watch, h } from 'vue';
import { NButton, NTag, NSpace, NPopconfirm, useMessage } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import {
  fetchRoleList, fetchPermissionList, fetchCreateRole, fetchUpdateRole, fetchDeleteRole,
  fetchSetRolePermissions, fetchRoleMembers, fetchAdminAudit
} from '@/service/api/role-management';
import type { RoleRecord, PermissionRecord, RoleMember, AdminAuditRecord } from '@/service/api/role-management';
import { usePageTracker } from '@/hooks/common/use-tracker';
import { useAuth } from '@/hooks/business/auth';
import { useAuthStore } from '@/store/modules/auth';

defineOptions({ name: 'RoleManager' });
usePageTracker('role-manager');
const message = useMessage();
const { hasAuth } = useAuth();
const authStore = useAuthStore();
const canManage = computed(() => hasAuth('system:role:manage'));
const loading = ref(false);
const roles = ref<RoleRecord[]>([]);
const allPermissions = ref<PermissionRecord[]>([]);
const activeTab = ref('roles');
const showRoleModal = ref(false);
const roleBeingEdited = ref<RoleRecord | null>(null);
const roleForm = ref({ name: '', displayName: '', description: '' });
const roleSaving = ref(false);
const showPermModal = ref(false);
const editingRole = ref<RoleRecord | null>(null);
const selectedPerms = ref<string[]>([]);
const permissionKeyword = ref('');
const showSelectedOnly = ref(false);
const showConfirm = ref(false);
const permSaving = ref(false);
const showMembers = ref(false);
const memberRole = ref<RoleRecord | null>(null);
const members = ref<RoleMember[]>([]);
const membersLoading = ref(false);
const audit = ref<AdminAuditRecord[]>([]);
const auditLoading = ref(false);
const label = (key: string) => allPermissions.value.find(item => item.key === key)?.label || key;
const controlledKeys = (keys: string[]) => keys.filter(key => !allPermissions.value.find(item => item.key === key)?.public);
const originalPerms = computed(() => controlledKeys(editingRole.value?.permissions || []));
const added = computed(() => selectedPerms.value.filter(key => !originalPerms.value.includes(key)));
const removed = computed(() => originalPerms.value.filter(key => !selectedPerms.value.includes(key)));
const permissionGroups = computed(() => {
  const keyword = permissionKeyword.value.trim().toLowerCase();
  const groups = new Map<string, { category: string; group: string; permissions: PermissionRecord[] }>();
  for (const permission of allPermissions.value) {
    const matches = !keyword || [permission.label, permission.description, permission.key, permission.group]
      .some(value => String(value || '').toLowerCase().includes(keyword));
    if (!matches || (showSelectedOnly.value && (permission.public || !selectedPerms.value.includes(permission.key)))) continue;
    const key = `${permission.category}:${permission.group}`;
    if (!groups.has(key)) groups.set(key, { category: permission.category, group: permission.group, permissions: [] });
    groups.get(key)!.permissions.push(permission);
  }
  const order = ['账号与系统', '系统管理', '数据与课程', '内容制作', '应用功能', '轻量工具', '其他'];
  return [...groups.values()].sort((a, b) => (order.indexOf(a.category) - order.indexOf(b.category)) || a.group.localeCompare(b.group, 'zh-CN'));
});
async function loadData() {
  if (!canManage.value) return;
  loading.value = true;
  try {
    const [rolesRes, permsRes] = await Promise.all([fetchRoleList(), fetchPermissionList()]);
    if (!canManage.value) return;
    if (!rolesRes.error) roles.value = rolesRes.data;
    if (!permsRes.error) allPermissions.value = permsRes.data;
  } finally { loading.value = false; }
}
async function loadAudit() {
  if (!canManage.value) return;
  auditLoading.value = true;
  try { const { data, error } = await fetchAdminAudit(); if (!error && canManage.value) audit.value = data; }
  finally { auditLoading.value = false; }
}
onMounted(loadData);
watch(canManage, allowed => {
  if (allowed) void loadData();
  else { roles.value = []; members.value = []; audit.value = []; showPermModal.value = false; showConfirm.value = false; showRoleModal.value = false; showMembers.value = false; }
});
watch(activeTab, tab => { if (tab === 'audit') void loadAudit(); });
function openRoleEditor(role?: RoleRecord) {
  roleBeingEdited.value = role || null;
  roleForm.value = role ? { name: role.name, displayName: role.display_name, description: role.description || '' } : { name: '', displayName: '', description: '' };
  showRoleModal.value = true;
}
async function saveRole() {
  if (!roleForm.value.name.trim() || !roleForm.value.displayName.trim()) { message.warning('请填写角色标识和名称'); return; }
  roleSaving.value = true;
  try {
    const data = { displayName: roleForm.value.displayName.trim(), description: roleForm.value.description };
    const result = roleBeingEdited.value ? await fetchUpdateRole(roleBeingEdited.value.id, data) : await fetchCreateRole({ name: roleForm.value.name.trim(), ...data });
    if (!result.error) { message.success('角色已保存'); showRoleModal.value = false; await loadData(); }
  } finally { roleSaving.value = false; }
}
async function deleteRole(role: RoleRecord) {
  const { error } = await fetchDeleteRole(role.id);
  if (!error) { message.success('角色已删除'); await loadData(); }
}
async function openMembers(role: RoleRecord) {
  memberRole.value = role; members.value = []; showMembers.value = true; membersLoading.value = true;
  try { const { data, error } = await fetchRoleMembers(role.name); if (!error && canManage.value && memberRole.value?.name === role.name) members.value = data; }
  finally { membersLoading.value = false; }
}
function openPermEditor(role: RoleRecord) {
  editingRole.value = role; selectedPerms.value = controlledKeys([...role.permissions]);
  for (const key of selectedPerms.value) {
    const parent = allPermissions.value.find(item => item.key === key)?.parentKey;
    if (parent && !selectedPerms.value.includes(parent)) selectedPerms.value.push(parent);
  }
  permissionKeyword.value = ''; showSelectedOnly.value = false; showPermModal.value = true;
}
function togglePerm(key: string) {
  const permission = allPermissions.value.find(item => item.key === key);
  if (!permission || permission.public) return;
  if (selectedPerms.value.includes(key)) {
    selectedPerms.value = selectedPerms.value.filter(item => item !== key && allPermissions.value.find(p => p.key === item)?.parentKey !== key);
  } else {
    selectedPerms.value.push(key);
    if (permission.parentKey && !selectedPerms.value.includes(permission.parentKey)) selectedPerms.value.push(permission.parentKey);
  }
}
async function savePermissions() {
  if (!editingRole.value) return;
  permSaving.value = true;
  try {
    const { error } = await fetchSetRolePermissions(editingRole.value.name, selectedPerms.value, editingRole.value.permissions);
    if (!error) {
      message.success('权限已保存，关联用户会自动同步'); showConfirm.value = false; showPermModal.value = false;
      await authStore.refreshAuthorization(true); await loadData();
    }
  } finally { permSaving.value = false; }
}
const columns: DataTableColumns<RoleRecord> = [
  { title: '角色名称', key: 'display_name', width: 180, render: row => h(NSpace, { size: 6 }, { default: () => [row.display_name, row.is_system ? h(NTag, { size: 'small' }, { default: () => '内置' }) : null] }) },
  { title: '说明', key: 'description', ellipsis: { tooltip: true } },
  { title: '成员', key: 'user_count', width: 90, render: row => h(NButton, { text: true, type: 'primary', onClick: () => openMembers(row) }, { default: () => `${row.user_count} 人` }) },
  { title: '授权摘要', key: 'permissions', width: 260, render: row => {
    if (row.name === 'owner') return h(NTag, { type: 'success', size: 'small' }, { default: () => '全部权限' });
    const keys = controlledKeys(row.permissions);
    const modules = keys.filter(key => key.startsWith('module:')).length;
    const actions = keys.length - modules;
    return `${modules} 个受控入口 · ${actions} 项操作能力`;
  } },
  { title: '操作', key: 'actions', width: 220, render: row => {
    if (row.name === 'owner') return '系统所有者，权限固定';
    return h(NSpace, { size: 4 }, { default: () => [
      h(NButton, { size: 'small', onClick: () => openRoleEditor(row) }, { default: () => '编辑' }),
      h(NButton, { size: 'small', type: 'primary', onClick: () => openPermEditor(row) }, { default: () => '配置权限' }),
      !row.is_system ? h(NPopconfirm, { disabled: row.user_count > 0, onPositiveClick: () => deleteRole(row) }, {
        trigger: () => h(NButton, { size: 'small', type: 'error', quaternary: true, disabled: row.user_count > 0, title: row.user_count ? '请先调整该角色的成员' : '' }, { default: () => '删除' }),
        default: () => `确定删除空角色「${row.display_name}」？`
      }) : null
    ] });
  } }
];
const statuses: Record<string, string> = { active: '已启用', disabled: '已禁用', pending: '待审批' };
const memberColumns: DataTableColumns<RoleMember> = [
  { title: '用户名', key: 'username' }, { title: '昵称', key: 'display_name' }, { title: '状态', key: 'status', render: row => statuses[row.status] }
];
const actions: Record<string, string> = {
  'role.create': '新建角色', 'role.update': '编辑角色', 'role.delete': '删除角色', 'role.permissions': '调整权限',
  'user.create': '创建账号', 'user.profile': '修改昵称', 'user.role': '调整用户角色', 'user.status': '启停账号',
  'user.delete': '删除账号', 'user.approve': '通过注册', 'user.reject': '拒绝注册', 'settings.update': '调整服务设置'
};
function auditSummary(row: AdminAuditRecord) {
  const before = row.before?.permissions as string[] | undefined;
  const after = row.after?.permissions as string[] | undefined;
  if (before && after) {
    const changes = [...after.filter(key => !before.includes(key)).map(key => `新增 ${label(key)}`), ...before.filter(key => !after.includes(key)).map(key => `撤销 ${label(key)}`)];
    return changes.join('；') || '授权未变化';
  }
  if (row.action === 'user.role') return `${row.before?.role} → ${row.after?.role}`;
  if (row.action === 'user.status') return `${statuses[String(row.before?.status)]} → ${statuses[String(row.after?.status)]}`;
  if (row.action === 'role.update') return `${row.before?.displayName} → ${row.after?.displayName}；${row.after?.description || '无说明'}`;
  if (row.action === 'settings.update') return '已更新代理配置（不记录地址或凭据）';
  return String(row.after?.displayName || row.before?.displayName || '');
}
const auditColumns: DataTableColumns<AdminAuditRecord> = [
  { title: '时间', key: 'created_at', width: 170, render: row => new Date(row.created_at + 'Z').toLocaleString('zh-CN') },
  { title: '操作人', key: 'actor_name', width: 120 }, { title: '操作', key: 'action', width: 130, render: row => actions[row.action] || row.action },
  { title: '对象', key: 'target_name', width: 150 }, { title: '变更', key: 'changes', ellipsis: { tooltip: true }, render: auditSummary }
];
</script>

<template>
  <div class="role-manager">
    <NAlert v-if="!canManage" type="info" title="此角色只有页面访问权限">管理角色和权限需要“角色与权限管理”能力，请联系管理员。</NAlert>
    <template v-else>
      <div class="role-manager__header">
        <div class="role-manager__title-row">
          <h2 class="role-manager__title">角色与权限</h2>
          <NSpace><NButton type="primary" @click="openRoleEditor()">新建角色</NButton><NButton @click="activeTab === 'audit' ? loadAudit() : loadData()">刷新</NButton></NSpace>
        </div>
        <p class="role-manager__desc">按角色分配应用和操作能力。公开工具默认开放；owner 始终拥有全部权限。</p>
      </div>
      <NTabs v-model:value="activeTab" type="line"><NTabPane name="roles" tab="角色与成员" /><NTabPane name="audit" tab="最近管理变更" /></NTabs>
      <NDataTable v-if="activeTab === 'roles'" :columns="columns" :data="roles" :loading="loading" :bordered="false" :scroll-x="900" :row-key="(row: RoleRecord) => row.id" class="role-manager__table" />
      <NDataTable v-else :columns="auditColumns" :data="audit" :loading="auditLoading" :bordered="false" :scroll-x="900" :row-key="(row: AdminAuditRecord) => row.id" class="role-manager__table" />
    </template>
    <NModal v-model:show="showRoleModal" preset="dialog" :title="roleBeingEdited ? '编辑角色' : '新建角色'" :mask-closable="false">
      <NForm label-placement="left" label-width="80" class="role-manager__form">
        <NFormItem label="角色标识" required><NInput v-model:value="roleForm.name" :disabled="Boolean(roleBeingEdited)" maxlength="32" placeholder="如 teacher" /></NFormItem>
        <NFormItem label="显示名称" required><NInput v-model:value="roleForm.displayName" maxlength="50" placeholder="如 教师" /></NFormItem>
        <NFormItem label="说明"><NInput v-model:value="roleForm.description" type="textarea" :rows="2" maxlength="500" show-count /></NFormItem>
      </NForm>
      <template #action><NSpace><NButton @click="showRoleModal = false">取消</NButton><NButton type="primary" :loading="roleSaving" @click="saveRole">保存</NButton></NSpace></template>
    </NModal>
    <NModal v-model:show="showMembers" preset="card" :title="`${memberRole?.display_name || ''} · 成员`" style="width: min(620px, calc(100vw - 32px))">
      <NDataTable :columns="memberColumns" :data="members" :loading="membersLoading" :row-key="(row: RoleMember) => row.id" />
      <p class="role-manager__desc" style="margin-top: 12px">调整成员角色请前往用户管理。有成员的角色不能删除。</p>
    </NModal>
    <NModal v-model:show="showPermModal" preset="dialog" :title="`配置「${editingRole?.display_name}」的权限`" :mask-closable="false" style="width: min(760px, calc(100vw - 32px))">
      <NAlert type="info" :show-icon="false">选择操作能力时自动添加所需入口；取消入口时同时取消相关能力。</NAlert>
      <div class="perm-editor">
        <div class="perm-toolbar"><NInput v-model:value="permissionKeyword" clearable placeholder="搜索应用或能力" /><NCheckbox v-model:checked="showSelectedOnly">仅看已授权（{{ selectedPerms.length }}）</NCheckbox></div>
        <div v-for="group in permissionGroups" :key="`${group.category}:${group.group}`" class="perm-section">
          <div class="perm-section__heading"><h4 class="perm-section__title">{{ group.group }}</h4><NTag size="tiny">{{ group.category }}</NTag></div>
          <div class="perm-grid">
            <div v-for="perm in group.permissions" :key="perm.key" class="perm-item" :class="{ 'perm-item--active': !perm.public && selectedPerms.includes(perm.key), 'perm-item--child': perm.parentKey }" @click="togglePerm(perm.key)">
              <NCheckbox :checked="perm.public || selectedPerms.includes(perm.key)" :disabled="perm.public" @click.stop @update:checked="togglePerm(perm.key)" />
              <div class="perm-item__content"><div class="perm-item__name">{{ perm.label }}<NTag v-if="perm.public" size="tiny">默认开放</NTag><NTag v-else-if="perm.risk === '管理'" size="tiny" type="warning">管理</NTag></div><div class="perm-item__desc">{{ perm.description }}</div></div>
            </div>
          </div>
        </div>
        <NEmpty v-if="permissionGroups.length === 0" description="没有匹配的权限" size="small" />
      </div>
      <template #action><NSpace><NButton @click="showPermModal = false">取消</NButton><NButton type="primary" :disabled="added.length + removed.length === 0" @click="showConfirm = true">预览并保存</NButton></NSpace></template>
    </NModal>
    <NModal v-model:show="showConfirm" preset="dialog" title="确认权限变更" :mask-closable="false">
      <p>「{{ editingRole?.display_name }}」的 {{ editingRole?.user_count || 0 }} 位成员将应用这些变更。</p>
      <p>新增 {{ added.length }} 项，撤销 {{ removed.length }} 项。权限会自动同步。</p>
      <NSpace><NTag v-for="key in added" :key="key" type="success">新增 · {{ label(key) }}</NTag><NTag v-for="key in removed" :key="key" type="warning">撤销 · {{ label(key) }}</NTag></NSpace>
      <template #action><NSpace><NButton :disabled="permSaving" @click="showConfirm = false">返回修改</NButton><NButton type="primary" :loading="permSaving" @click="savePermissions">确认保存</NButton></NSpace></template>
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
