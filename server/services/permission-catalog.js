/**
 * 权限展示目录。
 * key 是稳定的授权标识；目录只负责管理端的名称、归属、说明和依赖关系，
 * 因此产品调整文案或分组时不会影响既有角色授权。
 */
const SYSTEM = {
  'system:user:manage': { label: '用户与账号管理', description: '查看、创建、编辑昵称、分配角色、启停和删除用户' },
  'system:user:approve': { label: '审批注册申请', description: '审批或拒绝新用户注册申请' },
  'system:role:manage': { label: '角色与权限管理', description: '创建角色并配置角色权限' },
  'system:settings:edit': { label: '系统设置管理', description: '修改服务代理等系统级设置' }
};

const FEATURE = {
  'feature:voice-lab:clone': { label: '复刻音色', group: '语音实验室', parentKey: 'module:voice-lab:access', description: '从音频创建可用音色' },
  'feature:voice-lab:design': { label: '设计音色', group: '语音实验室', parentKey: 'module:voice-lab:access', description: '根据描述创建新音色' },
  'feature:voice-lab:manage-voices': { label: '管理音色', group: '语音实验室', parentKey: 'module:voice-lab:access', description: '重命名或删除共享音色' }
};

const MODULE_GROUPS = {
  'user-manager': ['账号与系统', '账号管理'],
  'role-manager': ['账号与系统', '权限与角色'],
  'proxy-settings': ['账号与系统', '系统设置'],
  'analytics-dashboard': ['账号与系统', '系统运行'],
  'mid-price-course': ['数据与课程', '课程数据'],
  'sb3-studio': ['内容制作', '课程内容'],
  'sb3-compressor': ['内容制作', '课程内容'],
  'voice-lab': ['内容制作', '音频与视觉'],
  'effects-generator': ['内容制作', '音频与视觉'],
  'image-matting': ['内容制作', '音频与视觉'],
  'video-frame-extractor': ['内容制作', '音频与视觉'],
  'base64-converter': ['轻量工具', '通用转换'],
  'image-compressor': ['轻量工具', '通用转换'],
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
    return { ...permission, category: '系统管理', group: '后台管理', label: item.label || permission.description || key, description: item.description || permission.description || '', parentKey: null, risk: '管理' };
  }
  if (key.startsWith('feature:')) {
    const item = FEATURE[key] || {};
    return { ...permission, category: '应用功能', group: item.group || '其他功能', label: item.label || permission.description || key, description: item.description || permission.description || '', parentKey: item.parentKey || null, risk: '普通' };
  }
  if (key.startsWith('module:')) {
    const moduleName = key.split(':')[1];
    const [category, group] = MODULE_GROUPS[moduleName] || ['其他', '未归类'];
    return { ...permission, category, group, label: moduleLabel(permission), description: `允许进入「${moduleLabel(permission)}」`, parentKey: null, risk: '普通' };
  }
  return { ...permission, category: '其他权限', group: '其他', label: permission.description || key, description: '', parentKey: null, risk: '普通' };
}

export function catalogPermissions(permissions) {
  return permissions.map(catalogPermission);
}
