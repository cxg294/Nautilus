-- 018: 删除已移除模块的遗留权限，避免在角色配置中造成干扰。
DELETE FROM role_permissions
WHERE permission_key IN (
  'module:btc-course-flow:access',
  'module:btc-in-class:access',
  'module:dashboard:access'
);

DELETE FROM permissions
WHERE key IN (
  'module:btc-course-flow:access',
  'module:btc-in-class:access',
  'module:dashboard:access'
);
