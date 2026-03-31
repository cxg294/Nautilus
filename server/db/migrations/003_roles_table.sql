-- 003: 自定义角色表
-- 支持动态创建和管理权限角色

-- 角色表：管理系统内所有角色的元数据
CREATE TABLE IF NOT EXISTS roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,           -- 角色标识（如 user, guest, editor 等）
  display_name TEXT NOT NULL,          -- 显示名称（如 普通用户、访客、编辑员）
  description TEXT,                    -- 角色描述
  is_system INTEGER NOT NULL DEFAULT 0, -- 系统内置角色不可删除
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 插入系统内置角色
INSERT OR IGNORE INTO roles (name, display_name, description, is_system) VALUES
  ('owner', '管理员', '拥有系统全部权限，可以管理用户和角色', 1),
  ('user', '普通用户', '可以使用大部分业务工具', 1),
  ('guest', '访客', '只能使用开放的公共工具', 1);
