/**
 * 权限展示目录。
 * key 是稳定的授权标识；目录只负责管理端的名称、归属、说明和依赖关系，
 * 因此产品调整文案或分组时不会影响既有角色授权。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const viewsDir = fileURLToPath(new URL('../../src/views', import.meta.url));
const publicModules = new Set(fs.readdirSync(viewsDir, { withFileTypes: true }).filter(item => item.isDirectory()).flatMap(item => {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(viewsDir, item.name, 'manifest.json'), 'utf8'));
    return manifest.guestAccessible ? [manifest.name] : [];
  } catch { return []; }
}));

const SYSTEM = {
  'system:user:manage': { label: '用户与账号管理', parentKey: 'module:user-manager:access', description: '查看、创建、编辑昵称、分配角色、启停和删除用户；注册审批另行授权' },
  'system:user:approve': { label: '审批注册申请', parentKey: 'module:user-manager:access', description: '查看待审批名单，通过或拒绝注册申请' },
  'system:role:manage': { label: '角色与权限管理', parentKey: 'module:role-manager:access', description: '创建、编辑角色，查看成员并配置角色权限' },
  'system:settings:edit': { label: '系统设置管理', parentKey: 'module:proxy-settings:access', description: '查看、修改服务代理等系统级设置' }
};

const FEATURE = {
  'feature:voice-lab:clone': { label: '复刻音色', group: '素材工具 · 语音合成', parentKey: 'module:voice-lab:access', description: '从音频创建可用音色' },
  'feature:voice-lab:design': { label: '设计音色', group: '素材工具 · 语音合成', parentKey: 'module:voice-lab:access', description: '根据描述创建新音色' },
  'feature:voice-lab:manage-voices': { label: '管理音色', group: '素材工具 · 语音合成', parentKey: 'module:voice-lab:access', description: '重命名或删除共享音色' }
};

const MODULE_GROUPS = {
  'user-manager': ['账号与系统', '账号管理'],
  'role-manager': ['账号与系统', '权限与角色'],
  'proxy-settings': ['账号与系统', '系统设置'],
  'analytics-dashboard': ['账号与系统', '系统运行'],
  'mid-price-course': ['数据与课程', '课程数据'],
  'course-assets': ['数据与课程', '课程资产'],
  'course-structure': ['数据与课程', '课程资产'],
  'character-library': ['内容制作', '课程内容'],
  'sequence-player': ['内容制作', '课程内容'],
  'sb3-compressor': ['内容制作', '素材工具'],
  'voice-lab': ['内容制作', '素材工具'],
  'effects-generator': ['内容制作', '素材工具'],
  'image-matting': ['内容制作', '素材工具'],
  'video-frame-extractor': ['内容制作', '素材工具'],
  'base64-converter': ['轻量工具', '通用转换'],
  'image-compressor': ['内容制作', '素材工具'],
  'timestamp-converter': ['轻量工具', '通用转换'],
  'qrcode-generator': ['轻量工具', '常用辅助'],
  'regex-workflow': ['轻量工具', '常用辅助'],
  'icon-explorer': ['轻量工具', '常用辅助'],
  'quick-links': ['轻量工具', '常用辅助']
};

function moduleLabel(permission) {
  return String(permission.description || permission.key)
    .replace(/^访问\s*/, '')
    .replace(/权限$/, '');
}

export function catalogPermission(permission) {
  const { key } = permission;
  if (key.startsWith('system:')) {
    const item = SYSTEM[key] || {};
    return { ...permission, category: '系统管理', group: '后台管理', label: item.label || permission.description || key, description: item.description || permission.description || '', parentKey: item.parentKey || null, risk: '管理', public: false };
  }
  if (key.startsWith('feature:')) {
    const item = FEATURE[key] || {};
    return { ...permission, category: '应用功能', group: item.group || '其他功能', label: item.label || permission.description || key, description: item.description || permission.description || '', parentKey: item.parentKey || null, risk: '普通' };
  }
  if (key.startsWith('module:')) {
    const moduleName = key.split(':')[1];
    const [category, group] = MODULE_GROUPS[moduleName] || ['其他', '未归类'];
    const isPublic = publicModules.has(moduleName);
    return { ...permission, category, group, label: moduleLabel(permission), description: isPublic ? '默认向所有人开放，无需角色授权' : `允许进入「${moduleLabel(permission)}」；管理操作需单独授权`, parentKey: null, risk: '普通', public: isPublic };
  }
  return { ...permission, category: '其他权限', group: '其他', label: permission.description || key, description: '', parentKey: null, risk: '普通' };
}

export function catalogPermissions(permissions) {
  return permissions.map(catalogPermission);
}

/** 前后端使用同一依赖目录。公开入口不作为可撤销授权保存。 */
export function normalizePermissions(keys, permissions) {
  const catalog = new Map(catalogPermissions(permissions).map(item => [item.key, item]));
  if (!Array.isArray(keys) || keys.some(key => typeof key !== 'string' || !catalog.has(key))) {
    throw new Error('包含不存在的权限项');
  }
  const selected = new Set(keys.filter(key => !catalog.get(key).public));
  for (const key of selected) {
    const parent = catalog.get(key).parentKey;
    if (parent) {
      if (!catalog.has(parent)) throw new Error('权限目录缺少关联的页面入口');
      selected.add(parent);
    }
  }
  return [...selected].sort();
}
