/**
 * 用户管理路由
 * 提供管理员对用户的 CRUD 操作和审批功能
 * 管理接口需要 system:user:manage 权限；owner 自动拥有全部权限。
 */
import { Router } from 'express';
import { success, fail, CODE } from '../utils/response.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import {
  findById,
  usernameExists,
  createUser,
  updateStatus,
  updateRole,
  updateProfile,
  listUsers,
  listPendingUsers,
  deleteUser,
} from '../services/user.js';
import { listRoles } from '../services/role.js';

const router = Router();

/**
 * 动态获取所有角色名列表（从数据库 roles 表读取）
 * 用于替代硬编码的 ['owner', 'user', 'guest']
 */
function getValidRoleNames() {
  return listRoles().map(r => r.name);
}

/**
 * GET /api/users/role-options
 * 公开接口：返回可分配的角色选项列表（name + display_name）
 * 仅需登录，不需 owner 角色（供下拉框使用）
 */
router.get('/role-options', requireAuth, (req, res) => {
  const roles = listRoles().map(r => ({
    name: r.name,
    displayName: r.display_name,
  }));
  res.json(success(roles));
});

// 以下所有接口都需要登录 + 用户管理权限
router.use(requireAuth, requirePermission('system:user:manage'));

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

  // 校验角色值（动态从数据库读取）
  const validRoles = getValidRoleNames();
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
 * PUT /api/users/:id/profile
 * 更新用户昵称等可展示资料。用户名和密码不在这个接口处理。
 * 请求体: { displayName }
 */
router.put('/:id/profile', (req, res) => {
  const userId = parseInt(req.params.id, 10);
  const { displayName } = req.body;
  const normalizedName = typeof displayName === 'string' ? displayName.trim() : '';

  if (!normalizedName) {
    return res.json(fail(CODE.VALIDATION, '昵称不能为空'));
  }
  if (normalizedName.length > 50) {
    return res.json(fail(CODE.VALIDATION, '昵称不能超过 50 个字符'));
  }

  const user = findById(userId);
  if (!user) {
    return res.json(fail(CODE.FAIL, '用户不存在'));
  }

  updateProfile(userId, { displayName: normalizedName });
  res.json(success(null, '用户昵称已更新'));
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

  const validRoles = getValidRoleNames();
  if (!role || !validRoles.includes(role)) {
    return res.json(fail(CODE.VALIDATION, `角色值无效，允许值：${validRoles.join(', ')}`));
  }

  const user = findById(userId);
  if (!user) {
    return res.json(fail(CODE.FAIL, '用户不存在'));
  }

  // owner 是系统所有者；可配置的系统管理员不能通过分配 owner 获得绕过全部权限的能力。
  if ((role === 'owner' || user.role === 'owner') && req.user.role !== 'owner') {
    return res.status(403).json(fail(CODE.FAIL, '只有系统所有者可以分配或调整系统管理员角色'));
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
