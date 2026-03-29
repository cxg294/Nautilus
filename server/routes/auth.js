/**
 * 认证路由
 * 提供登录、获取用户信息、刷新 Token 三个端点
 * 对齐前端 src/service/api/auth.ts 的调用
 */
import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import config from '../config/env.js';
import { success, fail, CODE } from '../utils/response.js';
import { requireAuth } from '../middleware/auth.js';
import {
  findByUsername,
  findById,
  mapRolesToFrontend,
  getRolePermissions,
  createRefreshToken,
  findValidRefreshToken,
  revokeRefreshToken,
} from '../services/user.js';

const router = Router();

/**
 * POST /auth/login
 * 请求体: { userName, password }
 * 响应: { token, refreshToken }
 */
router.post('/login', (req, res) => {
  const { userName, password } = req.body;

  // 参数校验
  if (!userName || !password) {
    return res.json(fail(CODE.VALIDATION, '用户名和密码不能为空'));
  }

  // 查找用户
  const user = findByUsername(userName);
  if (!user) {
    return res.json(fail(CODE.AUTH_INVALID, '用户名或密码错误'));
  }

  // 检查账号状态
  if (!user.is_active) {
    return res.json(fail(CODE.USER_DISABLED, '账号已被禁用'));
  }

  // 验证密码
  const isMatch = bcrypt.compareSync(password, user.password_hash);
  if (!isMatch) {
    return res.json(fail(CODE.AUTH_INVALID, '用户名或密码错误'));
  }

  // 签发 Access Token
  const tokenPayload = { id: user.id, username: user.username, role: user.role };
  const token = jwt.sign(tokenPayload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });

  // 创建 Refresh Token
  const refreshToken = createRefreshToken(user.id);

  res.json(success({ token, refreshToken }));
});

/**
 * GET /auth/getUserInfo
 * 需要 Bearer Token
 * 响应: { userId, userName, roles, buttons }
 */
router.get('/getUserInfo', requireAuth, (req, res) => {
  const user = findById(req.user.id);

  if (!user) {
    return res.json(fail(CODE.FORCE_LOGOUT, '用户不存在'));
  }

  if (!user.is_active) {
    return res.json(fail(CODE.FORCE_LOGOUT, '账号已被禁用'));
  }

  // 获取前端角色标识
  const roles = mapRolesToFrontend(user.role);

  // 获取权限按钮列表（作为 buttons）
  const buttons = getRolePermissions(user.role);

  res.json(success({
    userId: String(user.id),
    userName: user.display_name || user.username,
    roles,
    buttons,
  }));
});

/**
 * POST /auth/refreshToken
 * 请求体: { refreshToken }
 * 响应: { token, refreshToken }
 */
router.post('/refreshToken', (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.json(fail(CODE.FORCE_LOGOUT, '缺少 Refresh Token'));
  }

  // 查找有效的 Refresh Token
  const savedToken = findValidRefreshToken(refreshToken);
  if (!savedToken) {
    return res.json(fail(CODE.FORCE_LOGOUT, 'Refresh Token 无效或已过期'));
  }

  // 查找用户
  const user = findById(savedToken.user_id);
  if (!user || !user.is_active) {
    return res.json(fail(CODE.FORCE_LOGOUT, '用户不存在或已被禁用'));
  }

  // 吊销旧 Refresh Token（一次性使用）
  revokeRefreshToken(refreshToken);

  // 签发新的 Token 对
  const tokenPayload = { id: user.id, username: user.username, role: user.role };
  const newToken = jwt.sign(tokenPayload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
  const newRefreshToken = createRefreshToken(user.id);

  res.json(success({ token: newToken, refreshToken: newRefreshToken }));
});

/**
 * GET /auth/error
 * 测试用：返回自定义错误码
 * 查询参数: code, msg
 */
router.get('/error', (req, res) => {
  const { code = CODE.FAIL, msg = '自定义错误' } = req.query;
  res.json(fail(code, msg));
});

export default router;
