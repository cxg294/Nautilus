import { request } from '../request';

/** 用户管理 API（需 owner 权限） */

export interface UserRecord {
  id: number;
  username: string;
  email: string | null;
  display_name: string;
  role: 'owner' | 'user' | 'guest';
  status: 'pending' | 'active' | 'disabled';
  created_at: string;
  updated_at: string;
}

/** 获取用户列表 */
export function fetchUserList(status?: string) {
  return request<UserRecord[]>({
    url: '/api/users',
    params: status ? { status } : {}
  });
}

/** 获取待审批用户列表 */
export function fetchPendingUsers() {
  return request<UserRecord[]>({ url: '/api/users/pending' });
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
    url: '/api/users',
    method: 'post',
    data
  });
}

/** 审批通过 */
export function fetchApproveUser(id: number) {
  return request({
    url: `/api/users/${id}/approve`,
    method: 'put'
  });
}

/** 拒绝注册 */
export function fetchRejectUser(id: number) {
  return request({
    url: `/api/users/${id}/reject`,
    method: 'put'
  });
}

/** 修改用户角色 */
export function fetchUpdateUserRole(id: number, role: string) {
  return request({
    url: `/api/users/${id}/role`,
    method: 'put',
    data: { role }
  });
}

/** 修改状态 */
export function fetchUpdateStatus(id: number, status: string) {
  return request({
    url: `/api/users/${id}/status`,
    method: 'put',
    data: { status }
  });
}

/** 删除用户 */
export function fetchDeleteUser(id: number) {
  return request({
    url: `/api/users/${id}`,
    method: 'delete'
  });
}
