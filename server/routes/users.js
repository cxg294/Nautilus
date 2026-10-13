/** 用户与注册审批分别授权；账号写操作统一校验 owner 边界并记录变更。 */
import { Router } from 'express';
import db from '../db/index.js';
import { success, fail, CODE } from '../utils/response.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import {
  findById, usernameExists, createUser, updateStatus, updateRole, updateProfile,
  listUsers, listPendingUsers, deleteUser, assertUserManagement
} from '../services/user.js';
import { listRoles } from '../services/role.js';
import { recordAdminAction } from '../services/admin-audit.js';

const router = Router();
router.use(requireAuth);
const manage = requirePermission('system:user:manage');
const approve = requirePermission('system:user:approve');
const snapshot = user => user ? { role: user.role, status: user.status, displayName: user.display_name } : null;

function targetUser(req) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('用户 ID 无效');
  const user = findById(id);
  if (!user) throw new Error('用户不存在');
  return user;
}
function write(req, res, action, change, message) {
  try {
    const data = db.transaction(() => {
      const user = targetUser(req);
      const before = snapshot(user);
      change(user);
      recordAdminAction(req.user, action, { type: 'user', id: user.id, name: user.username }, before, snapshot(findById(user.id)));
      return null;
    })();
    res.json(success(data, message));
  } catch (error) {
    res.status(error.status || 200).json(fail(CODE.VALIDATION, error.message));
  }
}

router.get('/role-options', manage, (req, res) => {
  res.json(success(listRoles().filter(role => req.user.role === 'owner' || role.name !== 'owner')
    .map(role => ({ name: role.name, displayName: role.display_name }))));
});
router.get('/', manage, (req, res) => res.json(success(listUsers(req.query.status ? { status: req.query.status } : {}))));
router.get('/pending', approve, (_req, res) => res.json(success(listPendingUsers())));

router.post('/', manage, (req, res) => {
  const { userName, password, displayName, role = 'user', email } = req.body;
  if (typeof userName !== 'string' || !/^[a-zA-Z0-9_-]{2,32}$/.test(userName)
    || typeof password !== 'string' || password.length < 6) {
    return res.json(fail(CODE.VALIDATION, '用户名需为 2-32 位字母、数字、下划线或短横线，密码至少 6 位'));
  }
  if (!listRoles().some(item => item.name === role)) return res.json(fail(CODE.VALIDATION, '角色不存在'));
  try {
    const user = db.transaction(() => {
      assertUserManagement(req.user, null, { role });
      if (usernameExists(userName)) throw new Error('用户名已被占用');
      const created = createUser({ username: userName, password, displayName, role, email, status: 'active' });
      recordAdminAction(req.user, 'user.create', { type: 'user', id: created.id, name: created.username }, null, snapshot(created));
      return created;
    })();
    res.json(success({ id: user.id, username: user.username, display_name: user.display_name, role: user.role, status: user.status }, '用户创建成功'));
  } catch (error) {
    res.status(error.status || 200).json(fail(CODE.VALIDATION, error.message));
  }
});

router.put('/:id/profile', manage, (req, res) => {
  const name = typeof req.body.displayName === 'string' ? req.body.displayName.trim() : '';
  if (!name || name.length > 50) return res.json(fail(CODE.VALIDATION, '昵称需为 1-50 个字符'));
  write(req, res, 'user.profile', user => {
    assertUserManagement(req.user, user);
    updateProfile(user.id, { displayName: name });
  }, '用户昵称已更新');
});

for (const [operation, status, message] of [
  ['approve', 'active', '审批通过，用户已激活'], ['reject', 'disabled', '已拒绝该注册申请']
]) {
  router.put(`/:id/${operation}`, approve, (req, res) => {
    write(req, res, `user.${operation}`, user => {
      if (user.status !== 'pending') throw new Error('该用户不在待审批状态');
      assertUserManagement(req.user, user, { status });
      updateStatus(user.id, status);
    }, message);
  });
}
router.put('/:id/role', manage, (req, res) => {
  const { role } = req.body;
  if (!listRoles().some(item => item.name === role)) return res.json(fail(CODE.VALIDATION, '角色不存在'));
  write(req, res, 'user.role', user => {
    assertUserManagement(req.user, user, { role });
    if (user.id === req.user.id) throw new Error('不能修改自己的角色');
    updateRole(user.id, role);
  }, '用户角色已更新');
});
router.put('/:id/status', manage, (req, res) => {
  const { status } = req.body;
  if (!['active', 'disabled'].includes(status)) return res.json(fail(CODE.VALIDATION, '状态只能为启用或禁用'));
  write(req, res, 'user.status', user => {
    assertUserManagement(req.user, user, { status });
    if (user.id === req.user.id) throw new Error('不能修改自己的状态');
    if (user.status === 'pending') throw new Error('待审批账号应通过注册审批处理');
    updateStatus(user.id, status);
  }, status === 'active' ? '用户已启用' : '用户已禁用');
});
router.delete('/:id', manage, (req, res) => {
  write(req, res, 'user.delete', user => {
    assertUserManagement(req.user, user, { deleting: true });
    if (user.id === req.user.id) throw new Error('不能删除自己');
    if (user.status === 'pending') throw new Error('待审批账号应通过注册审批处理');
    deleteUser(user.id);
  }, '用户已删除');
});
export default router;
