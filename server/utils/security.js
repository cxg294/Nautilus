/**
 * 安全校验工具集
 *
 * 提供路径遍历防护、URL 校验（SSRF 防护）等通用安全工具。
 */
import path from 'path';
import { URL } from 'url';

// ═══ 路径遍历防护 ═══

/**
 * 校验路径参数是否安全（无路径穿越攻击）
 * @param {string} baseDir - 允许访问的根目录（绝对路径）
 * @param  {...string} segments - 用户传入的路径片段
 * @returns {{ safe: boolean, resolved: string }} 校验结果和解析后的绝对路径
 */
export function safePath(baseDir, ...segments) {
  const resolved = path.resolve(baseDir, ...segments);
  const normalizedBase = path.resolve(baseDir);
  const safe = resolved.startsWith(normalizedBase + path.sep) || resolved === normalizedBase;
  return { safe, resolved };
}

/**
 * 校验路径片段不包含目录穿越字符
 * @param {string} segment - 单个路径片段（如 taskId, filename）
 * @returns {boolean} 是否安全
 */
export function isSafePathSegment(segment) {
  if (!segment || typeof segment !== 'string') return false;
  // 禁止 .., /, \, null bytes
  return !/(\.\.|[/\\]|\0)/.test(segment);
}

// ═══ SSRF 防护 ═══

// 私有 IP 段正则
const PRIVATE_IP_PATTERNS = [
  /^127\./,              // Loopback
  /^10\./,               // Class A private
  /^172\.(1[6-9]|2\d|3[01])\./,  // Class B private
  /^192\.168\./,         // Class C private
  /^0\./,                // Current network
  /^169\.254\./,         // Link-local
  /^fc00:/i,             // IPv6 ULA
  /^fe80:/i,             // IPv6 link-local
  /^::1$/,               // IPv6 loopback
  /^localhost$/i,
];

/**
 * 校验 URL 是否安全（防 SSRF）
 * @param {string} urlStr - 待校验的 URL
 * @param {Object} options
 * @param {string[]} options.allowedDomains - 允许的域名后缀白名单（如 ['.aliyuncs.com']）
 * @param {boolean} options.httpsOnly - 是否仅允许 HTTPS，默认 false
 * @returns {{ safe: boolean, reason?: string }}
 */
export function isSafeUrl(urlStr, options = {}) {
  const { allowedDomains = [], httpsOnly = false } = options;

  try {
    const parsed = new URL(urlStr);

    // 协议检查
    if (httpsOnly && parsed.protocol !== 'https:') {
      return { safe: false, reason: '仅允许 HTTPS 协议' };
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { safe: false, reason: `不支持的协议: ${parsed.protocol}` };
    }

    // 私有 IP 检查
    const hostname = parsed.hostname;
    for (const pattern of PRIVATE_IP_PATTERNS) {
      if (pattern.test(hostname)) {
        return { safe: false, reason: '禁止访问私有/内网地址' };
      }
    }

    // 域名白名单检查（如果配置了白名单）
    if (allowedDomains.length > 0) {
      const domainAllowed = allowedDomains.some(d => hostname.endsWith(d));
      if (!domainAllowed) {
        return { safe: false, reason: `域名不在允许列表中: ${hostname}` };
      }
    }

    return { safe: true };
  } catch {
    return { safe: false, reason: '无效的 URL 格式' };
  }
}
