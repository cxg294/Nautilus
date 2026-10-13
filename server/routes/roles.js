/** 角色、权限、成员与管理变更记录。 */
import { Router } from 'express';
import db from '../db/index.js';
import { success, fail, CODE } from '../utils/response.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import {
  listRoles, findRoleByName, findRoleById, createRole, updateRoleInfo, deleteRole,
  roleNameExists, getRoleToolPermissions, setRoleToolPermissions, listAllPermissions, listRoleMembers
} from '../services/role.js';
import { catalogPermissions, normalizePermissions } from '../services/permission-catalog.js';
import { recordAdminAction, listAdminActions } from '../services/admin-audit.js';

const router = Router();
router.use(requireAuth, requirePermission('system:role:manage'));
const target = role => ({ type: 'role', id: role.name, name: role.display_name });
function mutate(res, work) {
  try { res.json(success(db.transaction(work)())); }
  catch (error) { res.status(error.status || 200).json(fail(CODE.VALIDATION, error.message)); }
}
function roleById(id) {
  const role = Number.isSafeInteger(Number(id)) && findRoleById(Number(id));
  if (!role) throw new Error('角色不存在');
  return role;
}
router.get('/', (_req, res) => res.json(success(listRoles().map(role => ({ ...role, permissions: getRoleToolPermissions(role.name) })))));
router.get('/permissions', (_req, res) => res.json(success(catalogPermissions(listAllPermissions()))));
router.get('/audit', (req, res) => res.json(success(listAdminActions(req.query.limit))));

router.post('/', (req, res) => {
  const { name, displayName, description = '' } = req.body;
  if (typeof name !== 'string' || !/^[a-zA-Z0-9_-]{1,32}$/.test(name)
    || typeof displayName !== 'string' || !displayName.trim() || displayName.trim().length > 50
    || typeof description !== 'string' || description.length > 500) {
    return res.json(fail(CODE.VALIDATION, '角色标识最多 32 位；名称需为 1-50 字；说明最多 500 字'));
  }
  mutate(res, () => {
    if (roleNameExists(name)) throw new Error('角色标识已存在');
    const role = createRole({ name, displayName: displayName.trim(), description });
    recordAdminAction(req.user, 'role.create', target(role), null, { displayName: role.display_name, description: role.description });
    return role;
  });
});
router.put('/:id', (req, res) => {
  const { displayName, description = '' } = req.body;
  if (typeof displayName !== 'string' || !displayName.trim() || displayName.trim().length > 50
    || typeof description !== 'string' || description.length > 500) {
    return res.json(fail(CODE.VALIDATION, '名称需为 1-50 字；说明最多 500 字'));
  }
  mutate(res, () => {
    const role = roleById(req.params.id);
    if (role.name === 'owner') throw new Error('owner 角色信息不可修改');
    updateRoleInfo(role.id, { displayName: displayName.trim(), description });
    recordAdminAction(req.user, 'role.update', target(role), { displayName: role.display_name, description: role.description }, { displayName: displayName.trim(), description });
    return null;
  });
});
router.delete('/:id', (req, res) => {
  mutate(res, () => {
    const role = roleById(req.params.id);
    const permissions = getRoleToolPermissions(role.name);
    deleteRole(role.id);
    recordAdminAction(req.user, 'role.delete', target(role), { permissions }, null);
    return null;
  });
});
router.get('/:name/members', (req, res) => {
  if (!findRoleByName(req.params.name)) return res.json(fail(CODE.VALIDATION, '角色不存在'));
  res.json(success(listRoleMembers(req.params.name)));
});
router.get('/:name/permissions', (req, res) => {
  if (!findRoleByName(req.params.name)) return res.json(fail(CODE.VALIDATION, '角色不存在'));
  res.json(success(getRoleToolPermissions(req.params.name)));
});
router.put('/:name/permissions', (req, res) => {
  mutate(res, () => {
    const role = findRoleByName(req.params.name);
    if (!role) throw new Error('角色不存在');
    if (role.name === 'owner') throw new Error('owner 始终拥有全部权限，不可修改');
    const before = getRoleToolPermissions(role.name).sort();
    const expected = req.body.expectedPermissions;
    if (expected !== undefined && (!Array.isArray(expected) || JSON.stringify([...expected].sort()) !== JSON.stringify(before))) {
      const error = new Error('该角色权限已被其他管理员修改，请重新打开配置');
      error.status = 409;
      throw error;
    }
    const permissions = normalizePermissions(req.body.permissions, listAllPermissions());
    setRoleToolPermissions(role.name, permissions);
    recordAdminAction(req.user, 'role.permissions', target(role), { permissions: before }, { permissions });
    return { permissions, affectedUsers: listRoleMembers(role.name).length };
  });
});
export default router;
