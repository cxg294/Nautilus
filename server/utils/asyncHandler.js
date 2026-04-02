/**
 * Express async handler 包装器
 * 捕获 async 路由处理函数中的错误，转发给 Express 的错误处理中间件
 * @param {Function} fn - async route handler
 * @returns {Function} wrapped handler
 */
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
