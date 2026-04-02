/**
 * 用户服务层
 * 封装用户相关的数据库操作
 */
import crypto from 'crypto';
import { hashSync } from 'bcryptjs';
import db from '../db/index.js';
import config from '../config/env.js';

/**
 * 根据用户名查找用户
 * @param {string} username
 * @returns {object|undefined}
 */
export function findByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

/**
 * 根据 ID 查找用户
 * @param {number} id
 * @returns {object|undefined}
 */
export function findById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

/**
 * 检查用户名是否已存在
 * @param {string} username
 * @returns {boolean}
 */
export function usernameExists(username) {
  const row = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  return !!row;
}

/**
 * 创建用户
 * @param {object} params
 * @param {string} params.username
 * @param {string} params.password - 明文密码，会被 bcrypt 哈希
 * @param {string} [params.displayName]
 * @param {string} [params.email]
 * @param {string} [params.role='user']
 * @param {string} [params.status='pending'] - pending/active/disabled
 * @returns {object} 创建的用户记录
 */
export function createUser({ username, password, displayName, email, role = 'user', status = 'pending' }) {
  const passwordHash = hashSync(password, 10);
  const result = db.prepare(`
    INSERT INTO users (username, email, password_hash, display_name, role, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(username, email || null, passwordHash, displayName || username, role, status);

  return findById(result.lastInsertRowid);
}

/**
 * 更新用户密码
 * @param {number} userId
 * @param {string} newPassword - 明文密码
 */
export function updatePassword(userId, newPassword) {
  const passwordHash = hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(passwordHash, userId);
}

/**
 * 更新用户状态
 * @param {number} userId
 * @param {string} status - pending/active/disabled
 */
export function updateStatus(userId, status) {
  db.prepare('UPDATE users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(status, userId);
}

/**
 * 更新用户角色
 * @param {number} userId
 * @param {string} role - owner/user/guest
 */
export function updateRole(userId, role) {
  db.prepare('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(role, userId);
}

/**
 * 获取用户列表（排除密码哈希）
 * @param {object} [options]
 * @param {string} [options.status] - 按状态筛选
 * @returns {object[]}
 */
export function listUsers(options = {}) {
  let sql = 'SELECT id, username, email, display_name, role, status, created_at, updated_at FROM users';
  const params = [];

  if (options.status) {
    sql += ' WHERE status = ?';
    params.push(options.status);
  }

  sql += ' ORDER BY created_at DESC';

  return db.prepare(sql).all(...params);
}

/**
 * 获取待审批用户列表
 * @returns {object[]}
 */
export function listPendingUsers() {
  return listUsers({ status: 'pending' });
}

/**
 * 删除用户
 * @param {number} userId
 */
export function deleteUser(userId) {
  // 先吊销所有 refresh token
  revokeAllUserTokens(userId);
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
}

/**
 * 获取角色对应的权限列表
 * @param {string} role - 角色名（owner / user / guest）
 * @returns {string[]} 权限 key 数组
 */
export function getRolePermissions(role) {
  const rows = db.prepare(
    'SELECT permission_key FROM role_permissions WHERE role = ?'
  ).all(role);
  return rows.map(r => r.permission_key);
}

/**
 * 将角色映射为前端所需的 roles 数组
 * 内置角色有固定映射，自定义角色默认映射为 R_USER
 * @param {string} role - 数据库中的角色名
 * @returns {string[]}
 */
export function mapRolesToFrontend(role) {
  const roleMap = {
    owner: ['R_SUPER', 'R_ADMIN'],
    user: ['R_USER'],
    guest: ['R_GUEST'],
  };
  // 自定义角色默认按 R_USER 级别处理（可通过 permission_key 精细控制工具访问）
  return roleMap[role] || ['R_USER'];
}

/**
 * 创建 Refresh Token 并存入数据库
 * @param {number} userId
 * @returns {string} refresh token 字符串
 */
export function createRefreshToken(userId) {
  const token = crypto.randomBytes(40).toString('hex');

  // 解析过期时间（如 '7d'）
  const daysMatch = config.jwt.refreshExpiresIn.match(/(\d+)d/);
  const days = daysMatch ? parseInt(daysMatch[1], 10) : 7;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)'
  ).run(userId, token, expiresAt);

  return token;
}

/**
 * 查找有效的 Refresh Token
 * @param {string} token
 * @returns {object|undefined}
 */
export function findValidRefreshToken(token) {
  return db.prepare(
    'SELECT * FROM refresh_tokens WHERE token = ? AND revoked = 0 AND expires_at > datetime(\'now\')'
  ).get(token);
}

/**
 * 吊销 Refresh Token
 * @param {string} token
 */
export function revokeRefreshToken(token) {
  db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE token = ?').run(token);
}

/**
 * 吊销用户的所有 Refresh Token
 * @param {number} userId
 */
export function revokeAllUserTokens(userId) {
  db.prepare('UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?').run(userId);
}
