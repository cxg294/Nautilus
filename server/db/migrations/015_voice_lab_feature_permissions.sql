-- 015: 语音实验室功能级权限
-- 保留 module:voice-lab:access 作为进入工具的权限；
-- 复刻、设计、管理音色等高风险动作单独授权。

INSERT OR IGNORE INTO permissions (key, description) VALUES
  ('feature:voice-lab:clone', '语音合成：复刻音色'),
  ('feature:voice-lab:design', '语音合成：设计音色'),
  ('feature:voice-lab:manage-voices', '语音合成：管理音色');

INSERT OR IGNORE INTO role_permissions (role, permission_key) VALUES
  ('owner', 'feature:voice-lab:clone'),
  ('owner', 'feature:voice-lab:design'),
  ('owner', 'feature:voice-lab:manage-voices');
