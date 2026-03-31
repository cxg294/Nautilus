/**
 * 认证路由
 * 提供登录、注册、获取用户信息、刷新 Token、修改密码
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
  usernameExists,
  createUser,
  updatePassword,
  mapRolesToFrontend,
  getRolePermissions,
  createRefreshToken,
  findValidRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
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
  const status = user.status || (user.is_active ? 'active' : 'disabled');
  if (status === 'pending') {
    return res.json(fail(CODE.USER_DISABLED, '账号正在审批中，请等待管理员审批'));
  }
  if (status === 'disabled') {
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
 * POST /auth/register
 * 请求体: { userName, password, confirmPassword, displayName? }
 * 用户注册申请（需管理员审批后才能使用）
 */
router.post('/register', (req, res) => {
  const { userName, password, confirmPassword, displayName } = req.body;

  // 参数校验
  if (!userName || !password || !confirmPassword) {
    return res.json(fail(CODE.VALIDATION, '用户名、密码和确认密码不能为空'));
  }

  if (password !== confirmPassword) {
    return res.json(fail(CODE.VALIDATION, '两次输入的密码不一致'));
  }

  if (password.length < 6) {
    return res.json(fail(CODE.VALIDATION, '密码长度不能少于 6 位'));
  }

  if (userName.length < 2 || userName.length > 32) {
    return res.json(fail(CODE.VALIDATION, '用户名长度需在 2-32 位之间'));
  }

  // 用户名格式校验：只允许字母、数字、下划线、短横线
  if (!/^[a-zA-Z0-9_-]+$/.test(userName)) {
    return res.json(fail(CODE.VALIDATION, '用户名只能包含字母、数字、下划线和短横线'));
  }

  // 检查用户名是否已存在
  if (usernameExists(userName)) {
    return res.json(fail(CODE.VALIDATION, '用户名已被占用'));
  }

  // 创建用户（status=pending，需管理员审批）
  const user = createUser({
    username: userName,
    password,
    displayName: displayName || userName,
    role: 'user',
    status: 'pending',
  });

  res.json(success({
    userId: String(user.id),
    userName: user.username,
    status: 'pending',
  }, '注册申请已提交，请等待管理员审批'));
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

  const status = user.status || (user.is_active ? 'active' : 'disabled');
  if (status !== 'active') {
    return res.json(fail(CODE.FORCE_LOGOUT, '账号状态异常'));
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
  const status = user ? (user.status || (user.is_active ? 'active' : 'disabled')) : null;
  if (!user || status !== 'active') {
    return res.json(fail(CODE.FORCE_LOGOUT, '用户不存在或状态异常'));
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
 * POST /auth/changePassword
 * 需要 Bearer Token
 * 请求体: { oldPassword, newPassword }
 */
router.post('/changePassword', requireAuth, (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.json(fail(CODE.VALIDATION, '旧密码和新密码不能为空'));
  }

  if (newPassword.length < 6) {
    return res.json(fail(CODE.VALIDATION, '新密码长度不能少于 6 位'));
  }

  const user = findById(req.user.id);
  if (!user) {
    return res.json(fail(CODE.FORCE_LOGOUT, '用户不存在'));
  }

  // 验证旧密码
  if (!bcrypt.compareSync(oldPassword, user.password_hash)) {
    return res.json(fail(CODE.VALIDATION, '旧密码错误'));
  }

  // 更新密码
  updatePassword(user.id, newPassword);

  // 吊销所有 refresh token（强制重新登录）
  revokeAllUserTokens(user.id);

  res.json(success(null, '密码修改成功，请重新登录'));
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
