-- 013: 语音工具试听音频缓存
-- 为每个 CosyVoice 音色保留一段本地试听音频。

ALTER TABLE voice_lab_voice_names ADD COLUMN audition_file_name TEXT DEFAULT '';
ALTER TABLE voice_lab_voice_names ADD COLUMN audition_content_type TEXT DEFAULT '';
ALTER TABLE voice_lab_voice_names ADD COLUMN audition_bytes INTEGER DEFAULT 0;
ALTER TABLE voice_lab_voice_names ADD COLUMN audition_text TEXT DEFAULT '';
ALTER TABLE voice_lab_voice_names ADD COLUMN audition_created_at DATETIME;
