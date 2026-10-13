import { isSafeUrl } from './security.js';

/** 阿里云会返回 HTTP 签名链接；下载时升级为 HTTPS，保留签名原文。 */
export function normalizeMattingResultUrl(url) {
  const normalizedUrl = typeof url === 'string' ? url.replace(/^http:/i, 'https:') : '';
  const check = isSafeUrl(normalizedUrl, { allowedDomains: ['.aliyuncs.com'], httpsOnly: true });
  if (!check.safe) {
    const error = new Error(`URL 校验失败: ${check.reason}`);
    error.statusCode = 403;
    throw error;
  }
  return normalizedUrl;
}
