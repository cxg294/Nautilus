-- 课程资产模板缓存：前端默认读取本地持久化数据，手动更新时才访问课程服务。
CREATE TABLE IF NOT EXISTS course_asset_template_cache (
  cache_key TEXT PRIMARY KEY,
  subject_id INTEGER NOT NULL,
  template_id INTEGER NOT NULL,
  synced_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  template_json TEXT NOT NULL DEFAULT '{}'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_course_asset_template_cache_subject_template
ON course_asset_template_cache(subject_id, template_id);

CREATE INDEX IF NOT EXISTS idx_course_asset_template_cache_synced
ON course_asset_template_cache(synced_at);
