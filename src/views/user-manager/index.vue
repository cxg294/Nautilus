<script setup lang="ts">
/**
 * 用户管理工具
 * 管理员可以：查看用户列表、审批注册、创建用户、修改角色、禁用/启用、删除
 */
import { ref, computed, onMounted, h } from 'vue';
import { NButton, NTag, NSpace, NPopconfirm, useMessage } from 'naive-ui';
import type { DataTableColumns } from 'naive-ui';
import {
  fetchUserList,
  fetchPendingUsers,
  fetchCreateUser,
  fetchApproveUser,
  fetchRejectUser,
  fetchUpdateUserRole,
  fetchUpdateStatus,
  fetchDeleteUser
} from '@/service/api/user-management';
import type { UserRecord } from '@/service/api/user-management';

defineOptions({ name: 'UserManager' });

const message = useMessage();

// === State ===
const loading = ref(false);
const users = ref<UserRecord[]>([]);
const pendingUsers = ref<UserRecord[]>([]);
const activeTab = ref<'all' | 'pending'>('all');
const showCreateModal = ref(false);

// 创建用户表单
const createForm = ref({
  userName: '',
  password: '',
  displayName: '',
  role: 'user' as string
});
const creating = ref(false);

// === Data Loading ===
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
  await Promise.all([loadUsers(), loadPendingUsers()]);
}

onMounted(refreshData);

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
    message.success(`${user.username} 的角色已更新为 ${newRole}`);
    await refreshData();
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
const roleLabel: Record<string, string> = {
  owner: '管理员',
  user: '普通用户',
  guest: '访客'
};

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
    width: 120,
    render(row) {
      return h(
        NTag,
        {
          type: row.role === 'owner' ? 'error' : row.role === 'user' ? 'info' : 'default',
          size: 'small',
          round: true
        },
        { default: () => roleLabel[row.role] || row.role }
      );
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
    width: 280,
    fixed: 'right',
    render(row) {
      const buttons: any[] = [];

      // 不能操作自己（admin 的 owner 角色用户）
      // 简单地通过 role=owner 来识别（可优化为 userId 对比）

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
      } else {
        // 角色切换
        if (row.role !== 'owner') {
          const nextRole = row.role === 'user' ? 'guest' : 'user';
          buttons.push(
            h(
              NButton,
              { size: 'small', quaternary: true, onClick: () => handleRoleChange(row, nextRole) },
              { default: () => `→ ${roleLabel[nextRole]}` }
            )
          );
        }

        // 禁用/启用
        if (row.role !== 'owner') {
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
        }

        // 删除
        if (row.role !== 'owner') {
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

const displayedUsers = computed(() => (activeTab.value === 'pending' ? pendingUsers.value : users.value));
const displayedColumns = computed(() => (activeTab.value === 'pending' ? pendingColumns : allColumns));
</script>

<template>
  <div class="user-manager">
    <!-- Header -->
    <div class="user-manager__header">
      <div class="user-manager__title-row">
        <h2 class="user-manager__title">用户管理</h2>
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

      <!-- Tab 切换 -->
      <div class="user-manager__tabs">
        <button
          class="user-manager__tab"
          :class="{ 'user-manager__tab--active': activeTab === 'all' }"
          @click="activeTab = 'all'"
        >
          全部用户 ({{ users.length }})
        </button>
        <button
          class="user-manager__tab"
          :class="{
            'user-manager__tab--active': activeTab === 'pending',
            'user-manager__tab--badge': pendingCount > 0
          }"
          @click="activeTab = 'pending'"
        >
          待审批
          <span v-if="pendingCount > 0" class="user-manager__badge">{{ pendingCount }}</span>
        </button>
      </div>
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
            :options="[
              { label: '普通用户', value: 'user' },
              { label: '管理员', value: 'owner' },
              { label: '访客', value: 'guest' }
            ]"
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

.user-manager__header {
  flex-shrink: 0;
}

.user-manager__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.user-manager__title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
}

.user-manager__tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid rgba(128, 128, 128, 0.2);
  padding-bottom: 0;
}

.user-manager__tab {
  position: relative;
  padding: 8px 16px;
  border: none;
  background: none;
  font-size: 14px;
  color: #666;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.user-manager__tab:hover {
  color: #333;
}

.user-manager__tab--active {
  color: #18a058;
  border-bottom-color: #18a058;
  font-weight: 500;
}

.dark .user-manager__tab {
  color: #999;
}

.dark .user-manager__tab:hover {
  color: #ccc;
}

.dark .user-manager__tab--active {
  color: #63e2b7;
  border-bottom-color: #63e2b7;
}

.user-manager__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  margin-left: 6px;
  border-radius: 9px;
  background: #f44;
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
}

.user-manager__table {
  flex: 1;
  overflow: auto;
}

.user-manager__form {
  padding-top: 12px;
}
</style>
