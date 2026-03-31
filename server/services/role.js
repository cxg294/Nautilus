/**
 * 角色服务层
 * 管理角色的 CRUD 及角色-工具权限映射
 */
import db from '../db/index.js';

/**
 * 获取所有角色
 */
export function listRoles() {
  return db.prepare(
    'SELECT id, name, display_name, description, is_system, created_at, updated_at FROM roles ORDER BY is_system DESC, id ASC'
  ).all();
}

/**
 * 根据 name 查找角色
 */
export function findRoleByName(name) {
  return db.prepare('SELECT * FROM roles WHERE name = ?').get(name);
}

/**
 * 根据 id 查找角色
 */
export function findRoleById(id) {
  return db.prepare('SELECT * FROM roles WHERE id = ?').get(id);
}

/**
 * 创建角色
 * @param {object} params
 * @param {string} params.name - 角色标识
 * @param {string} params.displayName - 显示名称
 * @param {string} [params.description] - 描述
 * @returns {object} 创建的角色
 */
export function createRole({ name, displayName, description }) {
  const result = db.prepare(
    'INSERT INTO roles (name, display_name, description) VALUES (?, ?, ?)'
  ).run(name, displayName, description || null);
  return findRoleById(result.lastInsertRowid);
}

/**
 * 更新角色
 */
export function updateRoleInfo(id, { displayName, description }) {
  db.prepare(
    'UPDATE roles SET display_name = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(displayName, description || null, id);
}

/**
 * 删除角色（仅非 is_system 可删除）
 */
export function deleteRole(id) {
  // 先删除关联的权限
  const role = findRoleById(id);
  if (role) {
    db.prepare('DELETE FROM role_permissions WHERE role = ?').run(role.name);
  }
  db.prepare('DELETE FROM roles WHERE id = ? AND is_system = 0').run(id);
}

/**
 * 检查角色名是否已存在
 */
export function roleNameExists(name) {
  return !!db.prepare('SELECT id FROM roles WHERE name = ?').get(name);
}

/**
 * 获取角色对应的工具权限列表
 * @param {string} roleName
 * @returns {string[]} permission_key 数组
 */
export function getRoleToolPermissions(roleName) {
  const rows = db.prepare(
    'SELECT permission_key FROM role_permissions WHERE role = ?'
  ).all(roleName);
  return rows.map(r => r.permission_key);
}

/**
 * 设置角色的工具权限（全量替换）
 * @param {string} roleName
 * @param {string[]} permissionKeys
 */
export function setRoleToolPermissions(roleName, permissionKeys) {
  const deleteStmt = db.prepare('DELETE FROM role_permissions WHERE role = ?');
  const insertStmt = db.prepare('INSERT OR IGNORE INTO role_permissions (role, permission_key) VALUES (?, ?)');

  const transaction = db.transaction(() => {
    deleteStmt.run(roleName);
    for (const key of permissionKeys) {
      insertStmt.run(roleName, key);
    }
  });

  transaction();
}

/**
 * 获取所有可分配的工具权限（以 module: 开头的 permission）
 */
export function listToolPermissions() {
  return db.prepare(
    "SELECT key, description FROM permissions WHERE key LIKE 'module:%' ORDER BY key"
  ).all();
}

/**
 * 获取所有权限
 */
export function listAllPermissions() {
  return db.prepare('SELECT key, description FROM permissions ORDER BY key').all();
}
