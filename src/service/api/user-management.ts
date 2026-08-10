import { request } from '../request';

/** 用户管理 API（需 owner 权限） */

export interface UserRecord {
  id: number;
  username: string;
  email: string | null;
  display_name: string;
  /** 角色标识（动态，不再限制为固定枚举） */
  role: string;
  status: 'pending' | 'active' | 'disabled';
  created_at: string;
  updated_at: string;
}

/** 角色选项（仅用于下拉框） */
export interface RoleOption {
  name: string;
  displayName: string;
}

/** 获取用户列表 */
export function fetchUserList(status?: string) {
  return request<UserRecord[]>({
    url: '/users',
    params: status ? { status } : {}
  });
}

/** 获取待审批用户列表 */
export function fetchPendingUsers() {
  return request<UserRecord[]>({ url: '/users/pending' });
}

/** 获取可分配的角色选项列表 */
export function fetchRoleOptions() {
  return request<RoleOption[]>({ url: '/users/role-options' });
}

/** 管理员直接创建用户 */
export function fetchCreateUser(data: {
  userName: string;
  password: string;
  displayName?: string;
  role?: string;
  email?: string;
}) {
  return request({
    url: '/users',
    method: 'post',
    data
  });
}

/** 审批通过 */
export function fetchApproveUser(id: number) {
  return request({
    url: `/users/${id}/approve`,
    method: 'put'
  });
}

/** 拒绝注册 */
export function fetchRejectUser(id: number) {
  return request({
    url: `/users/${id}/reject`,
    method: 'put'
  });
}

/** 修改用户角色 */
export function fetchUpdateUserRole(id: number, role: string) {
  return request({
    url: `/users/${id}/role`,
    method: 'put',
    data: { role }
  });
}

/** 修改用户昵称 */
export function fetchUpdateUserProfile(id: number, data: { displayName: string }) {
  return request({
    url: `/users/${id}/profile`,
    method: 'put',
    data
  });
}

/** 修改状态 */
export function fetchUpdateStatus(id: number, status: string) {
  return request({
    url: `/users/${id}/status`,
    method: 'put',
    data: { status }
  });
}

/** 删除用户 */
export function fetchDeleteUser(id: number) {
  return request({
    url: `/users/${id}`,
    method: 'delete'
  });
}
