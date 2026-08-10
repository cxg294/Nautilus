-- 下线 BTC 课程进量看板的缓存与权限；新看板权限由 manifest 同步注册。
DROP TABLE IF EXISTS btc_course_volume_cache;

DELETE FROM role_permissions WHERE permission_key = 'module:btc-course-volume:access';

DELETE FROM permissions WHERE key = 'module:btc-course-volume:access';
