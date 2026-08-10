/**
 * 细粒度权限校验中间件
 *
 * 在 requireAuth 之后使用，检查用户是否拥有指定的 permission_key。
 * owner 角色自动拥有全部权限，无需查表。
 *
 * @example
 * router.get('/sensitive', requireAuth, requirePermission('module:tool-name:access'), handler);
 * router.post('/admin-op', requireAuth, requirePermission('system:user:manage', 'system:settings:edit'), handler);
 */
import { fail, CODE } from '../utils/response.js';
import { getRolePermissions } from '../services/user.js';

/**
 * 创建权限检查中间件
 * @param  {...string} keys - 需要的权限 key 列表（要求全部满足）
 * @returns {Function} Express 中间件
 */
export function requirePermission(...keys) {
  return (req, res, next) => {
    if (!req.user) {
      return res.json(fail(CODE.FORCE_LOGOUT, '未提供认证信息'));
    }

    // owner 角色拥有全部权限
    if (req.user.role === 'owner') {
      return next();
    }

    const userPerms = getRolePermissions(req.user.role);
    const hasAll = keys.every(k => userPerms.includes(k));

    if (!hasAll) {
      return res.status(403).json(
        fail(CODE.FAIL, `权限不足，需要以下权限：${keys.join(', ')}`)
      );
    }

    next();
  };
}
