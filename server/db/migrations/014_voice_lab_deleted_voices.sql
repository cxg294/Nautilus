-- 014: 语音工具已删除音色标记
-- 百炼列表可能短时间仍返回刚删除的 voice_id；本地用 tombstone 隐藏它。

ALTER TABLE voice_lab_voice_names ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0;
ALTER TABLE voice_lab_voice_names ADD COLUMN deleted_at DATETIME;

CREATE INDEX IF NOT EXISTS idx_voice_lab_voice_names_deleted
ON voice_lab_voice_names(is_deleted, updated_at DESC);
