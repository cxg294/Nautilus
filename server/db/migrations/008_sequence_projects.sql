-- 逐字稿播放器项目存储
-- 用于持久化课程序列项目数据

CREATE TABLE IF NOT EXISTS sequence_projects (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL DEFAULT '未命名项目',
  raw_script TEXT NOT NULL DEFAULT '',
  characters TEXT NOT NULL DEFAULT '[]',        -- JSON: Character[]
  steps TEXT NOT NULL DEFAULT '[]',             -- JSON: Step[]
  settings TEXT NOT NULL DEFAULT '{}',          -- JSON: ProjectSettings
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sequence_projects_user ON sequence_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_sequence_projects_updated ON sequence_projects(updated_at DESC);
