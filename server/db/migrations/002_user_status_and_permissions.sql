-- 002: 用户状态字段 + 补充权限
-- users 表新增 status 字段，替代 is_active 实现更细粒度的账号状态管理

-- 新增 status 字段（pending=待审批, active=已激活, disabled=已禁用）
ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active';

-- 将现有 is_active 数据迁移到 status
UPDATE users SET status = CASE WHEN is_active = 1 THEN 'active' ELSE 'disabled' END;

-- 补充工具级权限
INSERT OR IGNORE INTO permissions (key, description) VALUES
  ('module:sb3-studio:access', '访问 SB3 工作室'),
  ('module:material-studio:access', '访问素材工作室'),
  ('module:script-generator:access', '访问脚本生成器'),
  ('module:script-review:access', '访问脚本审查'),
  ('module:sb3-compressor:access', '访问 SB3 压缩器'),
  ('module:btc-course-flow:access', '访问课程流程'),
  ('module:btc-in-class:access', '访问课堂工具'),
  ('module:case-design:access', '访问案例设计'),
  ('system:user:approve', '审批用户注册');

-- 给 owner 角色授予所有新增权限
INSERT OR IGNORE INTO role_permissions (role, permission_key) VALUES
  ('owner', 'module:sb3-studio:access'),
  ('owner', 'module:material-studio:access'),
  ('owner', 'module:script-generator:access'),
  ('owner', 'module:script-review:access'),
  ('owner', 'module:sb3-compressor:access'),
  ('owner', 'module:btc-course-flow:access'),
  ('owner', 'module:btc-in-class:access'),
  ('owner', 'module:case-design:access'),
  ('owner', 'system:user:approve');

-- 给 user 角色授予业务工具权限
INSERT OR IGNORE INTO role_permissions (role, permission_key) VALUES
  ('user', 'module:sb3-studio:access'),
  ('user', 'module:material-studio:access'),
  ('user', 'module:script-generator:access'),
  ('user', 'module:script-review:access'),
  ('user', 'module:sb3-compressor:access');
