/**
 * API Key 认证中间件
 *
 * 为工具 API 提供独立于 JWT 的认证机制。
 * AI Agent 通过 X-API-Key header 或 ?api_key= query 传递密钥。
 */
import config from '../config/env.js';
import { fail, CODE } from '../utils/response.js';

/**
 * 验证 API Key
 * 支持两种传递方式：
 * - Header: X-API-Key: <key>
 * - Query:  ?api_key=<key>
 */
export function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'] || req.query.api_key;

  if (!key) {
    return res.status(401).json(fail(CODE.FAIL, '缺少 API Key，请在 X-API-Key header 或 api_key query 中提供'));
  }

  if (key !== config.apiKey) {
    return res.status(403).json(fail(CODE.FAIL, 'API Key 无效'));
  }

  // 标记请求来源为 API 调用
  req.apiClient = true;
  next();
}
