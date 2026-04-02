import { request } from '../request';

/** 角色/权限管理 API（需 owner 权限） */

export interface RoleRecord {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
  is_system: number;
  permissions: string[];
  created_at: string;
  updated_at: string;
}

export interface PermissionRecord {
  key: string;
  description: string | null;
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
export function fetchSetRolePermissions(name: string, permissions: string[]) {
  return request({ url: `/roles/${name}/permissions`, method: 'put', data: { permissions } });
}
