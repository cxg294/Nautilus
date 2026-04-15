/**
 * Gemini API 反向代理 — Cloudflare Worker
 *
 * 功能：将请求透传到 Google Generative AI API
 * 安全：仅允许 Gemini API 相关路径，屏蔽其他请求
 *
 * 部署后得到的 URL（如 https://gemini-proxy.xxx.workers.dev）
 * 填入 Nautilus「服务代理设置 → Gemini API」即可
 */

const UPSTREAM = 'https://generativelanguage.googleapis.com';

// 允许的路径前缀白名单
const ALLOWED_PREFIXES = [
  '/v1beta/',
  '/v1alpha/',
  '/v1/',
  '/upload/',
];

export default {
  async fetch(request, env) {
    // CORS 预检
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const url = new URL(request.url);

    // 根路径健康检查
    if (url.pathname === '/' || url.pathname === '') {
      return new Response(JSON.stringify({
        status: 'ok',
        service: 'gemini-proxy',
        upstream: UPSTREAM,
        timestamp: new Date().toISOString(),
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 路径白名单检查
    const isAllowed = ALLOWED_PREFIXES.some(prefix => url.pathname.startsWith(prefix));
    if (!isAllowed) {
      return new Response(JSON.stringify({ error: 'Path not allowed' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 构造上游请求
    const upstreamUrl = UPSTREAM + url.pathname + url.search;

    const headers = new Headers(request.headers);
    headers.set('Host', 'generativelanguage.googleapis.com');

    const upstreamReq = new Request(upstreamUrl, {
      method: request.method,
      headers,
      body: request.body,
    });

    // 转发并返回
    const response = await fetch(upstreamReq);

    // 添加 CORS 头
    const respHeaders = new Headers(response.headers);
    respHeaders.set('Access-Control-Allow-Origin', '*');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: respHeaders,
    });
  },
};
