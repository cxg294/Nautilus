INSERT OR IGNORE INTO permissions (key, description) VALUES
  ('module:course-assets:access', '访问课程资产中心');

INSERT OR IGNORE INTO role_permissions (role, permission_key) VALUES
  ('owner', 'module:course-assets:access'),
  ('user', 'module:course-assets:access');
