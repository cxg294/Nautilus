-- 001: 初始化用户和权限表
-- Nautilus 基础 Schema

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  email TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'user',  -- owner / user / guest
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 权限表
CREATE TABLE IF NOT EXISTS permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,         -- 例如 'module:sb3-workbench:access'
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 角色-权限关联表
CREATE TABLE IF NOT EXISTS role_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL,
  permission_key TEXT NOT NULL,
  UNIQUE(role, permission_key),
  FOREIGN KEY (permission_key) REFERENCES permissions(key)
);

-- Refresh Token 表（支持吊销）
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  revoked INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 插入默认权限
INSERT OR IGNORE INTO permissions (key, description) VALUES
  ('system:user:manage', '管理用户'),
  ('system:settings:edit', '修改系统设置'),
  ('module:dashboard:access', '访问仪表盘');

-- 给 owner 角色授予所有默认权限
INSERT OR IGNORE INTO role_permissions (role, permission_key) VALUES
  ('owner', 'system:user:manage'),
  ('owner', 'system:settings:edit'),
  ('owner', 'module:dashboard:access');

-- 给 user 角色授予仪表盘权限
INSERT OR IGNORE INTO role_permissions (role, permission_key) VALUES
  ('user', 'module:dashboard:access');
