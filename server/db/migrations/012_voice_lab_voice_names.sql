-- 012: 语音工具本地音色名称
-- 阿里云 CosyVoice 只返回机器可用的 voice_id；这里维护人类可读的显示名。

CREATE TABLE IF NOT EXISTS voice_lab_voice_names (
  voice_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL DEFAULT '',
  source TEXT DEFAULT '',
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_voice_lab_voice_names_updated
ON voice_lab_voice_names(updated_at DESC);
