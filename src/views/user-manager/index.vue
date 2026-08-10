<script setup lang="ts">
/**
 * 用户管理工具
 * 管理员可以：查看用户列表、审批注册、创建用户、修改角色、禁用/启用、删除
 *
 * v0.6 优化：
 * - 手写 tab → NTabs 组件
 * - 硬编码角色选择 → 动态 NSelect（从数据库加载）
 * - 角色修改操作 → NSelect 下拉直接切换
 * - 新增搜索筛选功能
 */
import { ref, computed, onMounted, h } from 'vue';
import { NButton, NTag, NSpace, NPopconfirm, NSelect, useMessage } from 'naive-ui';
import type { DataTableColumns, SelectOption } from 'naive-ui';
import {
  fetchUserList,
  fetchPendingUsers,
  fetchCreateUser,
  fetchApproveUser,
  fetchRejectUser,
  fetchUpdateUserRole,
  fetchUpdateUserProfile,
  fetchUpdateStatus,
  fetchDeleteUser,
  fetchRoleOptions,
} from '@/service/api/user-management';
import type { UserRecord, RoleOption } from '@/service/api/user-management';
import { usePageTracker } from '@/hooks/common/use-tracker';

defineOptions({ name: 'UserManager' });

usePageTracker('user-manager');

const message = useMessage();

// === State ===
const loading = ref(false);
const users = ref<UserRecord[]>([]);
const pendingUsers = ref<UserRecord[]>([]);
const activeTab = ref<string>('all');
const showCreateModal = ref(false);
const searchKeyword = ref('');
const showProfileModal = ref(false);
const editingProfileUser = ref<UserRecord | null>(null);
const nicknameDraft = ref('');
const profileSaving = ref(false);

// 角色选项（动态加载）
const roleOptions = ref<RoleOption[]>([]);
const roleSelectOptions = computed<SelectOption[]>(() =>
  roleOptions.value.map(r => ({ label: r.displayName, value: r.name }))
);

// 角色名 → 显示名映射
const roleDisplayMap = computed(() => {
  const map: Record<string, string> = {};
  roleOptions.value.forEach(r => { map[r.name] = r.displayName; });
  return map;
});

// 创建用户表单
const createForm = ref({
  userName: '',
  password: '',
  displayName: '',
  role: 'user' as string
});
const creating = ref(false);

// === Data Loading ===
async function loadRoleOptions() {
  const { data, error } = await fetchRoleOptions();
  if (!error) roleOptions.value = data;
}

async function loadUsers() {
  loading.value = true;
  try {
    const { data, error } = await fetchUserList();
    if (!error) users.value = data;
  } finally {
    loading.value = false;
  }
}

async function loadPendingUsers() {
  loading.value = true;
  try {
    const { data, error } = await fetchPendingUsers();
    if (!error) pendingUsers.value = data;
  } finally {
    loading.value = false;
  }
}

async function refreshData() {
  await Promise.all([loadUsers(), loadPendingUsers(), loadRoleOptions()]);
}

onMounted(refreshData);

// === 搜索筛选 ===
const filteredUsers = computed(() => {
  const kw = searchKeyword.value.trim().toLowerCase();
  if (!kw) return users.value;
  return users.value.filter(u =>
    u.username.toLowerCase().includes(kw)
    || (u.display_name && u.display_name.toLowerCase().includes(kw))
    || (u.email && u.email.toLowerCase().includes(kw))
  );
});

// === 审批相关 ===
const pendingCount = computed(() => pendingUsers.value.length);

async function handleApprove(user: UserRecord) {
  const { error } = await fetchApproveUser(user.id);
  if (!error) {
    message.success(`已通过 ${user.username} 的注册申请`);
    await refreshData();
  }
}

async function handleReject(user: UserRecord) {
  const { error } = await fetchRejectUser(user.id);
  if (!error) {
    message.warning(`已拒绝 ${user.username} 的注册申请`);
    await refreshData();
  }
}

// === 创建用户 ===
async function handleCreateUser() {
  if (!createForm.value.userName || !createForm.value.password) {
    message.warning('用户名和密码不能为空');
    return;
  }
  if (createForm.value.password.length < 6) {
    message.warning('密码长度不能少于 6 位');
    return;
  }
  creating.value = true;
  try {
    const { error } = await fetchCreateUser({
      userName: createForm.value.userName,
      password: createForm.value.password,
      displayName: createForm.value.displayName || undefined,
      role: createForm.value.role
    });
    if (!error) {
      message.success('用户创建成功');
      showCreateModal.value = false;
      createForm.value = { userName: '', password: '', displayName: '', role: 'user' };
      await refreshData();
    }
  } finally {
    creating.value = false;
  }
}

// === 角色修改 ===
async function handleRoleChange(user: UserRecord, newRole: string) {
  const { error } = await fetchUpdateUserRole(user.id, newRole);
  if (!error) {
    const displayName = roleDisplayMap.value[newRole] || newRole;
    message.success(`${user.username} 的角色已更新为 ${displayName}`);
    await refreshData();
  }
}

function openProfileEditor(user: UserRecord) {
  editingProfileUser.value = user;
  nicknameDraft.value = user.display_name || '';
  showProfileModal.value = true;
}

async function saveProfile() {
  if (!editingProfileUser.value) return;
  const displayName = nicknameDraft.value.trim();
  if (!displayName) {
    message.warning('昵称不能为空');
    return;
  }
  profileSaving.value = true;
  try {
    const { error } = await fetchUpdateUserProfile(editingProfileUser.value.id, { displayName });
    if (!error) {
      message.success(`已更新 ${editingProfileUser.value.username} 的昵称`);
      showProfileModal.value = false;
      await refreshData();
    }
  } finally {
    profileSaving.value = false;
  }
}

// === 状态修改 ===
async function handleToggleStatus(user: UserRecord) {
  const newStatus = user.status === 'active' ? 'disabled' : 'active';
  const { error } = await fetchUpdateStatus(user.id, newStatus);
  if (!error) {
    message.success(newStatus === 'active' ? `已启用 ${user.username}` : `已禁用 ${user.username}`);
    await refreshData();
  }
}

// === 删除用户 ===
async function handleDelete(user: UserRecord) {
  const { error } = await fetchDeleteUser(user.id);
  if (!error) {
    message.success(`已删除用户 ${user.username}`);
    await refreshData();
  }
}

// === 表格列定义 ===
const statusTagType: Record<string, 'success' | 'warning' | 'error'> = {
  active: 'success',
  pending: 'warning',
  disabled: 'error'
};
const statusLabel: Record<string, string> = {
  active: '已激活',
  pending: '待审批',
  disabled: '已禁用'
};

/** 角色 Tag 颜色 */
function getRoleTagType(role: string): 'error' | 'info' | 'default' {
  if (role === 'owner') return 'error';
  if (role === 'user') return 'info';
  return 'default';
}

const allColumns: DataTableColumns<UserRecord> = [
  { title: 'ID', key: 'id', width: 60 },
  { title: '用户名', key: 'username', width: 140 },
  {
    title: '昵称',
    key: 'display_name',
    width: 140
  },
  {
    title: '角色',
    key: 'role',
    width: 160,
    render(row) {
      // owner 角色不允许修改，只显示 Tag
      if (row.role === 'owner') {
        return h(
          NTag,
          { type: 'error', size: 'small', round: true },
          { default: () => roleDisplayMap.value[row.role] || row.role }
        );
      }
      // 其他角色显示 NSelect 下拉
      return h(NSelect, {
        value: row.role,
        size: 'small',
        options: roleSelectOptions.value,
        style: { width: '130px' },
        onUpdateValue: (v: string) => handleRoleChange(row, v),
      });
    }
  },
  {
    title: '状态',
    key: 'status',
    width: 100,
    render(row) {
      return h(
        NTag,
        {
          type: statusTagType[row.status] || 'default',
          size: 'small',
          round: true
        },
        { default: () => statusLabel[row.status] || row.status }
      );
    }
  },
  {
    title: '注册时间',
    key: 'created_at',
    width: 170,
    render(row) {
      return row.created_at ? new Date(row.created_at + 'Z').toLocaleString('zh-CN') : '-';
    }
  },
  {
    title: '操作',
    key: 'actions',
    width: 200,
    fixed: 'right',
    render(row) {
      const buttons: any[] = [];

      buttons.push(
        h(
          NButton,
          { size: 'small', quaternary: true, onClick: () => openProfileEditor(row) },
          { default: () => '编辑昵称' }
        )
      );

      if (row.status === 'pending') {
        buttons.push(
          h(
            NButton,
            { size: 'small', type: 'success', onClick: () => handleApprove(row) },
            { default: () => '通过' }
          ),
          h(
            NPopconfirm,
            { onPositiveClick: () => handleReject(row) },
            {
              trigger: () => h(NButton, { size: 'small', type: 'warning' }, { default: () => '拒绝' }),
              default: () => `确定拒绝 ${row.username} 的注册申请？`
            }
          )
        );
      } else if (row.role !== 'owner') {
        // 禁用/启用
        buttons.push(
          h(
            NButton,
            {
              size: 'small',
              type: row.status === 'active' ? 'warning' : 'success',
              quaternary: true,
              onClick: () => handleToggleStatus(row)
            },
            { default: () => (row.status === 'active' ? '禁用' : '启用') }
          )
        );

        // 删除
        buttons.push(
          h(
            NPopconfirm,
            { onPositiveClick: () => handleDelete(row) },
            {
              trigger: () =>
                h(NButton, { size: 'small', type: 'error', quaternary: true }, { default: () => '删除' }),
              default: () => `确定删除用户 ${row.username}？此操作不可恢复。`
            }
          )
        );
      }

      return h(NSpace, { size: 4 }, { default: () => buttons });
    }
  }
];

const pendingColumns: DataTableColumns<UserRecord> = [
  { title: 'ID', key: 'id', width: 60 },
  { title: '用户名', key: 'username', width: 150 },
  { title: '昵称', key: 'display_name', width: 150 },
  {
    title: '申请时间',
    key: 'created_at',
    width: 180,
    render(row) {
      return row.created_at ? new Date(row.created_at + 'Z').toLocaleString('zh-CN') : '-';
    }
  },
  {
    title: '操作',
    key: 'actions',
    width: 180,
    render(row) {
      return h(NSpace, { size: 8 }, {
        default: () => [
          h(NButton, { size: 'small', type: 'success', onClick: () => handleApprove(row) }, { default: () => '通过' }),
          h(
            NPopconfirm,
            { onPositiveClick: () => handleReject(row) },
            {
              trigger: () => h(NButton, { size: 'small', type: 'warning' }, { default: () => '拒绝' }),
              default: () => `确定拒绝 ${row.username}？`
            }
          )
        ]
      });
    }
  }
];

const displayedUsers = computed(() => (activeTab.value === 'pending' ? pendingUsers.value : filteredUsers.value));
const displayedColumns = computed(() => (activeTab.value === 'pending' ? pendingColumns : allColumns));
</script>

<template>
  <div class="user-manager">
    <div class="user-manager__title-row">
      <div>
        <h2 class="user-manager__title">用户管理</h2>
        <p class="user-manager__desc">管理账号、注册审批、角色与启停状态。</p>
      </div>
      <NSpace>
        <NButton type="primary" @click="showCreateModal = true">
          <template #icon>
            <span class="i-mdi-account-plus-outline" />
          </template>
          新增用户
        </NButton>
        <NButton @click="refreshData">
          <template #icon>
            <span class="i-mdi-refresh" />
          </template>
          刷新
        </NButton>
      </NSpace>
    </div>

    <div class="user-manager__header">
      <!-- NTabs 替代手写 tab -->
      <NTabs
        v-model:value="activeTab"
        type="line"
        animated
        size="medium"
      >
        <NTabPane name="all" :tab="`全部用户 (${users.length})`" />
        <NTabPane name="pending">
          <template #tab>
            <NSpace :size="6" align="center" :wrap="false">
              <span>待审批</span>
              <NBadge v-if="pendingCount > 0" :value="pendingCount" :max="99" />
            </NSpace>
          </template>
        </NTabPane>
      </NTabs>
    </div>

    <!-- 搜索栏（全部用户视图下显示） -->
    <div v-if="activeTab === 'all'" class="user-manager__search">
      <NInput
        v-model:value="searchKeyword"
        placeholder="搜索用户名、昵称或邮箱…"
        clearable
        size="small"
        style="max-width: 320px;"
      >
        <template #prefix>
          <span class="i-mdi-magnify" style="opacity: 0.5;" />
        </template>
      </NInput>
    </div>

    <!-- Table -->
    <NDataTable
      :columns="displayedColumns"
      :data="displayedUsers"
      :loading="loading"
      :bordered="false"
      :single-line="false"
      size="small"
      :scroll-x="800"
      :row-key="(row: UserRecord) => row.id"
      class="user-manager__table"
    />

    <!-- 创建用户弹窗 -->
    <NModal v-model:show="showCreateModal" preset="dialog" title="新增用户" :mask-closable="false">
      <NForm label-placement="left" label-width="80" class="user-manager__form">
        <NFormItem label="用户名" required>
          <NInput v-model:value="createForm.userName" placeholder="字母、数字、下划线" />
        </NFormItem>
        <NFormItem label="密码" required>
          <NInput v-model:value="createForm.password" type="password" show-password-on="click" placeholder="至少 6 位" />
        </NFormItem>
        <NFormItem label="昵称">
          <NInput v-model:value="createForm.displayName" placeholder="可选" />
        </NFormItem>
        <NFormItem label="角色">
          <NSelect
            v-model:value="createForm.role"
            :options="roleSelectOptions"
            :loading="roleOptions.length === 0"
          />
        </NFormItem>
      </NForm>
      <template #action>
        <NSpace>
          <NButton @click="showCreateModal = false">取消</NButton>
          <NButton type="primary" :loading="creating" @click="handleCreateUser">创建</NButton>
        </NSpace>
      </template>
    </NModal>

    <NModal v-model:show="showProfileModal" preset="dialog" title="编辑用户昵称" :mask-closable="false">
      <NForm label-placement="left" label-width="72" class="user-manager__form">
        <NFormItem label="用户名">
          <NInput :value="editingProfileUser?.username || ''" disabled />
        </NFormItem>
        <NFormItem label="昵称" required>
          <NInput v-model:value="nicknameDraft" maxlength="50" show-count placeholder="输入展示给其他用户的昵称" />
        </NFormItem>
      </NForm>
      <template #action>
        <NSpace>
          <NButton @click="showProfileModal = false">取消</NButton>
          <NButton type="primary" :loading="profileSaving" @click="saveProfile">保存</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.user-manager {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 20px;
  gap: 16px;
}

.user-manager__title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.user-manager__title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.user-manager__desc {
  margin: 4px 0 0;
  font-size: 13px;
  color: #999;
}

.user-manager__header {
  flex-shrink: 0;
}

.user-manager__search {
  margin-bottom: 16px;
}

.user-manager__table {
  flex: 1;
  overflow: auto;
}

.user-manager__form {
  padding-top: 12px;
}
</style>
