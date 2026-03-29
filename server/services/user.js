/**
 * 用户服务层
 * 封装用户相关的数据库操作
 */
import crypto from 'crypto';
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
 * Soybean Admin 静态路由模式下，super role 由 VITE_STATIC_SUPER_ROLE 定义
 * @param {string} role - 数据库中的角色名
 * @returns {string[]}
 */
export function mapRolesToFrontend(role) {
  const roleMap = {
    owner: ['R_SUPER', 'R_ADMIN'],
    user: ['R_USER'],
    guest: ['R_GUEST'],
  };
  return roleMap[role] || ['R_GUEST'];
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
