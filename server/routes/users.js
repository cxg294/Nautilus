/**
 * 用户管理路由
 * 提供管理员对用户的 CRUD 操作和审批功能
 * 所有接口需要 owner 角色
 */
import { Router } from 'express';
import { success, fail, CODE } from '../utils/response.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import {
  findById,
  usernameExists,
  createUser,
  updateStatus,
  updateRole,
  listUsers,
  listPendingUsers,
  deleteUser,
} from '../services/user.js';

const router = Router();

// 所有接口都需要登录 + owner 角色
router.use(requireAuth, requireRole('owner'));

/**
 * GET /api/users
 * 获取用户列表
 * 查询参数: status (可选，按状态筛选)
 */
router.get('/', (req, res) => {
  const { status } = req.query;
  const users = listUsers(status ? { status } : {});
  res.json(success(users));
});

/**
 * GET /api/users/pending
 * 获取待审批用户列表
 */
router.get('/pending', (req, res) => {
  const users = listPendingUsers();
  res.json(success(users));
});

/**
 * POST /api/users
 * 管理员直接创建用户（无需审批）
 * 请求体: { userName, password, displayName?, role?, email? }
 */
router.post('/', (req, res) => {
  const { userName, password, displayName, role = 'user', email } = req.body;

  // 参数校验
  if (!userName || !password) {
    return res.json(fail(CODE.VALIDATION, '用户名和密码不能为空'));
  }

  if (password.length < 6) {
    return res.json(fail(CODE.VALIDATION, '密码长度不能少于 6 位'));
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(userName)) {
    return res.json(fail(CODE.VALIDATION, '用户名只能包含字母、数字、下划线和短横线'));
  }

  // 校验角色值
  const validRoles = ['owner', 'user', 'guest'];
  if (!validRoles.includes(role)) {
    return res.json(fail(CODE.VALIDATION, `角色值无效，允许值：${validRoles.join(', ')}`));
  }

  if (usernameExists(userName)) {
    return res.json(fail(CODE.VALIDATION, '用户名已被占用'));
  }

  // 管理员创建的用户直接激活
  const user = createUser({
    username: userName,
    password,
    displayName: displayName || userName,
    email,
    role,
    status: 'active',
  });

  res.json(success({
    id: user.id,
    username: user.username,
    display_name: user.display_name,
    role: user.role,
    status: user.status,
  }, '用户创建成功'));
});

/**
 * PUT /api/users/:id/approve
 * 审批通过注册申请
 */
router.put('/:id/approve', (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const user = findById(userId);

  if (!user) {
    return res.json(fail(CODE.FAIL, '用户不存在'));
  }

  const status = user.status || (user.is_active ? 'active' : 'disabled');
  if (status !== 'pending') {
    return res.json(fail(CODE.FAIL, '该用户不在待审批状态'));
  }

  updateStatus(userId, 'active');
  res.json(success(null, '审批通过，用户已激活'));
});

/**
 * PUT /api/users/:id/reject
 * 拒绝注册申请
 */
router.put('/:id/reject', (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const user = findById(userId);

  if (!user) {
    return res.json(fail(CODE.FAIL, '用户不存在'));
  }

  const status = user.status || (user.is_active ? 'active' : 'disabled');
  if (status !== 'pending') {
    return res.json(fail(CODE.FAIL, '该用户不在待审批状态'));
  }

  updateStatus(userId, 'disabled');
  res.json(success(null, '已拒绝该注册申请'));
});

/**
 * PUT /api/users/:id/role
 * 修改用户角色
 * 请求体: { role }
 */
router.put('/:id/role', (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const { role } = req.body;

  const validRoles = ['owner', 'user', 'guest'];
  if (!role || !validRoles.includes(role)) {
    return res.json(fail(CODE.VALIDATION, `角色值无效，允许值：${validRoles.join(', ')}`));
  }

  const user = findById(userId);
  if (!user) {
    return res.json(fail(CODE.FAIL, '用户不存在'));
  }

  // 不允许修改自己的角色
  if (userId === req.user.id) {
    return res.json(fail(CODE.FAIL, '不能修改自己的角色'));
  }

  updateRole(userId, role);
  res.json(success(null, `角色已更新为 ${role}`));
});

/**
 * PUT /api/users/:id/status
 * 启用/禁用用户
 * 请求体: { status } - active/disabled
 */
router.put('/:id/status', (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const { status } = req.body;

  if (!status || !['active', 'disabled'].includes(status)) {
    return res.json(fail(CODE.VALIDATION, '状态值无效，允许值：active, disabled'));
  }

  const user = findById(userId);
  if (!user) {
    return res.json(fail(CODE.FAIL, '用户不存在'));
  }

  // 不允许禁用自己
  if (userId === req.user.id) {
    return res.json(fail(CODE.FAIL, '不能修改自己的状态'));
  }

  updateStatus(userId, status);
  res.json(success(null, status === 'active' ? '用户已启用' : '用户已禁用'));
});

/**
 * DELETE /api/users/:id
 * 删除用户
 */
router.delete('/:id', (req, res) => {
  const userId = parseInt(req.params.id, 10);

  if (userId === req.user.id) {
    return res.json(fail(CODE.FAIL, '不能删除自己'));
  }

  const user = findById(userId);
  if (!user) {
    return res.json(fail(CODE.FAIL, '用户不存在'));
  }

  deleteUser(userId);
  res.json(success(null, '用户已删除'));
});

export default router;
