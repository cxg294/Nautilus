-- 下线 SB3 积木分析；压缩和语音合成只变更菜单归属，沿用原有权限和角色授权。
BEGIN TRANSACTION;

DELETE FROM role_permissions WHERE permission_key = 'module:sb3-studio:access';
DELETE FROM permissions WHERE key = 'module:sb3-studio:access';

COMMIT;
