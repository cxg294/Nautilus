/**
 * JWT 认证中间件
 * 验证请求头中的 Bearer Token，解码后将用户信息挂载到 req.user
 */
import jwt from 'jsonwebtoken';
import config from '../config/env.js';
import { fail, CODE } from '../utils/response.js';

/**
 * 验证 Access Token
 * 成功时设置 req.user = { id, username, role }
 */
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  // 优先从 Authorization header 获取 token
  // 如果没有，尝试从 query 参数获取（sendBeacon 兜底方案）
  let token;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (req.query._token) {
    token = req.query._token;
  }

  if (!token) {
    return res.json(fail(CODE.FORCE_LOGOUT, '未提供认证令牌'));
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    next();
  } catch (err) {
    // 区分 token 过期和 token 无效
    if (err.name === 'TokenExpiredError') {
      return res.json(fail(CODE.TOKEN_EXPIRED, '令牌已过期，请刷新'));
    }
    return res.json(fail(CODE.TOKEN_INVALID, '无效的认证令牌'));
  }
}
