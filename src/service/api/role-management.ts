import { request } from '../request';

/** 角色/权限管理 API（需 system:role:manage 权限） */

export interface RoleRecord {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
  is_system: number;
  permissions: string[];
  created_at: string;
  updated_at: string;
  user_count: number;
}

export interface PermissionRecord {
  key: string;
  description: string | null;
  label: string;
  category: string;
  group: string;
  parentKey: string | null;
  risk: '普通' | '管理';
  public?: boolean;
}

/** 获取所有角色（含权限列表） */
export function fetchRoleList() {
  return request<RoleRecord[]>({ url: '/roles' });
}

/** 获取所有可分配的权限 */
export function fetchPermissionList() {
  return request<PermissionRecord[]>({ url: '/roles/permissions' });
}

/** 创建角色 */
export function fetchCreateRole(data: { name: string; displayName: string; description?: string }) {
  return request({ url: '/roles', method: 'post', data });
}

/** 更新角色信息 */
export function fetchUpdateRole(id: number, data: { displayName: string; description?: string }) {
  return request({ url: `/roles/${id}`, method: 'put', data });
}

/** 删除角色 */
export function fetchDeleteRole(id: number) {
  return request({ url: `/roles/${id}`, method: 'delete' });
}

/** 获取角色权限 */
export function fetchRolePermissions(name: string) {
  return request<string[]>({ url: `/roles/${name}/permissions` });
}

/** 设置角色权限（全量替换） */
export function fetchSetRolePermissions(name: string, permissions: string[], expectedPermissions: string[]) {
  return request({ url: `/roles/${name}/permissions`, method: 'put', data: { permissions, expectedPermissions } });
}

export interface RoleMember { id: number; username: string; display_name: string; status: 'active' | 'pending' | 'disabled'; }
export function fetchRoleMembers(name: string) {
  return request<RoleMember[]>({ url: `/roles/${name}/members` });
}
export interface AdminAuditRecord {
  id: number; actor_name: string; action: string; target_name: string; created_at: string;
  before: Record<string, unknown> | null; after: Record<string, unknown> | null;
}
export function fetchAdminAudit() { return request<AdminAuditRecord[]>({ url: '/roles/audit' }); }
