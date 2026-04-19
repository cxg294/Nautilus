-- 007: 清理已删除的 character-generator 工具的权限数据
DELETE FROM role_permissions WHERE permission_key = 'module:character-generator:access';
DELETE FROM permissions WHERE key = 'module:character-generator:access';
