-- 002: 情景记忆表（L1）
-- 用于未来管理界面的后端存储（浏览、搜索、统计记忆）
-- 注意：AI 的主要读写路径是 Markdown 文件（infra/memory-layer/memories/episodes/）
-- 此表作为辅助索引，不是 AI 记忆的主存储

-- 情景记忆主表
-- 注意：这不是流水账日志，每条记录代表一个项目/主题的最新状态
-- 更新时必须比对已有记录，合并而非新增
CREATE TABLE IF NOT EXISTS memory_episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT NOT NULL,               -- 所属项目（如 'nautilus'）
  topic TEXT NOT NULL,                 -- 主题标识（如 'auth-system', 'memory-layer'）
  summary TEXT NOT NULL,               -- 当前状态摘要（Markdown 格式）
  key_facts TEXT,                      -- 关键事实（JSON 数组）
  open_questions TEXT,                 -- 未解决问题（JSON 数组）
  last_conversation_id TEXT,           -- 最后一次更新的对话 ID
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project, topic)              -- 同一项目+主题只有一条记录
);

-- 变更历史表（记录 L1 的关键转折点，仅保留重大变更）
CREATE TABLE IF NOT EXISTS memory_episode_changelog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  episode_id INTEGER NOT NULL,
  change_type TEXT NOT NULL,           -- 'created' | 'updated' | 'superseded'
  change_summary TEXT NOT NULL,        -- 变更简述
  changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (episode_id) REFERENCES memory_episodes(id)
);
