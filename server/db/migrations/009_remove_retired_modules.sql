-- 移除已下线模块的权限项
-- 2026-07-01：素材生成工作台、语音工具、逐字稿审查/生成、案例设计已从插件目录移除。

DELETE FROM role_permissions
WHERE permission_key IN (
  'module:material-studio:access',
  'module:tts-studio:access',
  'module:script-review:access',
  'module:script-generator:access',
  'module:case-design:access'
);

DELETE FROM permissions
WHERE key IN (
  'module:material-studio:access',
  'module:tts-studio:access',
  'module:script-review:access',
  'module:script-generator:access',
  'module:case-design:access'
);
