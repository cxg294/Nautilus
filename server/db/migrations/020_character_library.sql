CREATE TABLE IF NOT EXISTS character_library (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  character TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, id)
);
INSERT OR IGNORE INTO permissions (key, description) VALUES ('module:character-library:access', '人物声音与立绘');
INSERT OR IGNORE INTO role_permissions (role, permission_key)
SELECT role, 'module:character-library:access' FROM role_permissions WHERE permission_key = 'module:sequence-player:access';
