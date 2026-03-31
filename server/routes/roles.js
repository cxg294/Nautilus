/**
 * 角色/权限管理路由
 * 提供角色 CRUD 和角色-工具权限配置
 * 所有接口需要 owner 角色
 */
import { Router } from 'express';
import { success, fail, CODE } from '../utils/response.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import {
  listRoles,
  findRoleByName,
  findRoleById,
  createRole,
  updateRoleInfo,
  deleteRole,
  roleNameExists,
  getRoleToolPermissions,
  setRoleToolPermissions,
  listToolPermissions,
  listAllPermissions,
} from '../services/role.js';

const router = Router();

// 所有接口需要 owner 角色
router.use(requireAuth, requireRole('owner'));

/**
 * GET /api/roles
 * 获取所有角色（含其工具权限）
 */
router.get('/', (req, res) => {
  const roles = listRoles();
  // 附加每个角色的权限列表
  const result = roles.map(role => ({
    ...role,
    permissions: getRoleToolPermissions(role.name),
  }));
  res.json(success(result));
});

/**
 * GET /api/roles/permissions
 * 获取所有可分配的工具权限列表
 */
router.get('/permissions', (req, res) => {
  const permissions = listAllPermissions();
  res.json(success(permissions));
});

/**
 * POST /api/roles
 * 创建新角色
 * 请求体: { name, displayName, description? }
 */
router.post('/', (req, res) => {
  const { name, displayName, description } = req.body;

  if (!name || !displayName) {
    return res.json(fail(CODE.VALIDATION, '角色标识和显示名称不能为空'));
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    return res.json(fail(CODE.VALIDATION, '角色标识只能包含字母、数字、下划线和短横线'));
  }

  if (roleNameExists(name)) {
    return res.json(fail(CODE.VALIDATION, '角色标识已存在'));
  }

  const role = createRole({ name, displayName, description });
  res.json(success(role, '角色创建成功'));
});

/**
 * PUT /api/roles/:id
 * 更新角色信息
 * 请求体: { displayName, description? }
 */
router.put('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { displayName, description } = req.body;

  const role = findRoleById(id);
  if (!role) {
    return res.json(fail(CODE.FAIL, '角色不存在'));
  }

  if (!displayName) {
    return res.json(fail(CODE.VALIDATION, '显示名称不能为空'));
  }

  updateRoleInfo(id, { displayName, description });
  res.json(success(null, '角色信息已更新'));
});

/**
 * DELETE /api/roles/:id
 * 删除角色（系统内置角色不可删除）
 */
router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const role = findRoleById(id);

  if (!role) {
    return res.json(fail(CODE.FAIL, '角色不存在'));
  }

  if (role.is_system) {
    return res.json(fail(CODE.FAIL, '系统内置角色不可删除'));
  }

  deleteRole(id);
  res.json(success(null, '角色已删除'));
});

/**
 * GET /api/roles/:name/permissions
 * 获取指定角色的权限列表
 */
router.get('/:name/permissions', (req, res) => {
  const { name } = req.params;
  const role = findRoleByName(name);

  if (!role) {
    return res.json(fail(CODE.FAIL, '角色不存在'));
  }

  const permissions = getRoleToolPermissions(name);
  res.json(success(permissions));
});

/**
 * PUT /api/roles/:name/permissions
 * 设置角色的权限（全量替换）
 * 请求体: { permissions: string[] }
 */
router.put('/:name/permissions', (req, res) => {
  const { name } = req.params;
  const { permissions } = req.body;

  const role = findRoleByName(name);
  if (!role) {
    return res.json(fail(CODE.FAIL, '角色不存在'));
  }

  if (role.name === 'owner') {
    return res.json(fail(CODE.FAIL, '管理员角色的权限不可修改'));
  }

  if (!Array.isArray(permissions)) {
    return res.json(fail(CODE.VALIDATION, 'permissions 必须为数组'));
  }

  setRoleToolPermissions(name, permissions);
  res.json(success(null, '权限已更新'));
});

export default router;
