/**
 * 统一响应工具函数
 * 所有 API 响应格式遵循 Soybean Admin 约定：{ code, data, msg }
 */

// === 响应码常量（与前端 .env 配置对应） ===
export const CODE = {
  /** 请求成功 */
  SUCCESS: '0000',
  /** 通用业务错误 */
  FAIL: '1000',
  /** 参数校验失败 */
  VALIDATION: '1001',
  /** 用户名或密码错误 */
  AUTH_INVALID: '1002',
  /** 用户已被禁用 */
  USER_DISABLED: '1003',
  /** 需要弹窗提示的登出（对应 VITE_SERVICE_MODAL_LOGOUT_CODES） */
  MODAL_LOGOUT: '7777',
  /** 强制登出（对应 VITE_SERVICE_LOGOUT_CODES） */
  FORCE_LOGOUT: '8888',
  /** Token 过期（对应 VITE_SERVICE_EXPIRED_TOKEN_CODES） */
  TOKEN_EXPIRED: '9999',
  /** Token 无效 */
  TOKEN_INVALID: '3333',
};

/**
 * 成功响应
 * @param {any} data - 响应数据
 * @param {string} [msg='ok'] - 响应消息
 */
export function success(data = null, msg = 'ok') {
  return {
    code: CODE.SUCCESS,
    data,
    msg,
  };
}

/**
 * 失败响应
 * @param {string} code - 错误码
 * @param {string} msg - 错误消息
 * @param {any} [data=null] - 附加数据
 */
export function fail(code, msg, data = null) {
  return {
    code,
    data,
    msg,
  };
}
