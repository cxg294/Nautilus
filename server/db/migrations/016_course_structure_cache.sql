-- 课程内容结构解析缓存：只保存归一化 JSON，不保存原始 zip
CREATE TABLE IF NOT EXISTS course_structure_cache (
  cache_key TEXT PRIMARY KEY,
  subject_id INTEGER NOT NULL,
  unit_id INTEGER NOT NULL,
  chapter_id INTEGER NOT NULL,
  zip_md5 TEXT DEFAULT '',
  zip_url TEXT DEFAULT '',
  zip_platform TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'ready',
  parsed_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  structure_bytes INTEGER NOT NULL DEFAULT 0,
  structure_json TEXT NOT NULL DEFAULT '{}',
  error_json TEXT NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_course_structure_cache_unit
ON course_structure_cache(subject_id, unit_id);

CREATE INDEX IF NOT EXISTS idx_course_structure_cache_updated
ON course_structure_cache(updated_at);
