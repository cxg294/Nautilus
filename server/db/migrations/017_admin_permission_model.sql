-- 017: 后台管理能力改为可分配的系统权限，并校正遗留展示名称。
INSERT INTO permissions (key, description) VALUES
  ('system:user:manage', '用户与账号管理'),
  ('system:user:approve', '审批注册申请'),
  ('system:role:manage', '角色与权限管理'),
  ('system:settings:edit', '系统设置管理')
ON CONFLICT(key) DO UPDATE SET description = excluded.description;

INSERT OR IGNORE INTO role_permissions (role, permission_key) VALUES
  ('owner', 'system:user:manage'),
  ('owner', 'system:user:approve'),
  ('owner', 'system:role:manage'),
  ('owner', 'system:settings:edit');

UPDATE roles
SET display_name = '系统管理员',
    description = '拥有系统全部权限，可管理账号、角色和系统设置'
WHERE name = 'owner';
