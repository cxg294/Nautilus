CREATE TABLE IF NOT EXISTS course_condition_records (
  fingerprint TEXT PRIMARY KEY,
  script TEXT NOT NULL,
  listen_vars_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reason TEXT NOT NULL,
  description TEXT NOT NULL,
  notes_json TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  resolved_at TEXT
);
CREATE TABLE IF NOT EXISTS course_condition_locations (
  fingerprint TEXT NOT NULL,
  location_key TEXT NOT NULL,
  context_json TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  PRIMARY KEY (fingerprint, location_key)
);
CREATE INDEX IF NOT EXISTS idx_course_condition_records_status ON course_condition_records(status, last_seen_at);
