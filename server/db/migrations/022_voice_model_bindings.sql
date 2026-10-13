CREATE TABLE IF NOT EXISTS voice_lab_voice_bindings (
  voice_id TEXT PRIMARY KEY,
  target_model TEXT NOT NULL,
  source_file TEXT NOT NULL DEFAULT '',
  source_type TEXT NOT NULL DEFAULT '',
  source_bytes INTEGER NOT NULL DEFAULT 0,
  clone_params TEXT NOT NULL DEFAULT '{}',
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
