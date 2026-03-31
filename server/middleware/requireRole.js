/**
 * 角色校验中间件
 * 在 requireAuth 之后使用，检查用户是否具有指定角色
 */
import { fail, CODE } from '../utils/response.js';

/**
 * 创建角色检查中间件
 * @param  {...string} roles - 允许的角色列表
 * @returns {Function} Express 中间件
 *
 * @example
 * router.get('/admin-only', requireAuth, requireRole('owner'), handler);
 * router.get('/user-or-admin', requireAuth, requireRole('owner', 'user'), handler);
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.json(fail(CODE.FORCE_LOGOUT, '未提供认证信息'));
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json(fail(CODE.FAIL, '权限不足，需要以下角色之一：' + roles.join(', ')));
    }

    next();
  };
}
