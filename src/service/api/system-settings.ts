import { request } from '../request';

/** 系统设置 — 服务代理配置 API（需 owner 权限） */

export interface ProxyConfigItem {
  value: string;
  updatedAt: string | null;
}

export type ProxyConfigMap = Record<string, ProxyConfigItem>;

export interface ProxyTestResult {
  ok: boolean;
  latency: number;
  message: string;
}

/** 获取所有代理配置 */
export function fetchProxySettings() {
  return request<ProxyConfigMap>({ url: '/system-settings/proxy' });
}

/** 更新代理配置 */
export function updateProxySettings(settings: Record<string, string>) {
  return request<{ updated: number }>({ url: '/system-settings/proxy', method: 'put', data: { settings } });
}

/** 测试代理连通性 */
export function testProxyConnection(key: string, url: string) {
  return request<ProxyTestResult>({ url: '/system-settings/proxy/test', method: 'post', data: { key, url } });
}
