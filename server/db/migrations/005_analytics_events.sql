-- 埋点事件表
-- 记录用户的页面访问和核心操作行为

CREATE TABLE IF NOT EXISTS analytics_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL,
  username    TEXT DEFAULT '',
  event_type  TEXT NOT NULL CHECK(event_type IN ('page_view', 'action')),
  tool_name   TEXT NOT NULL,
  action_name TEXT DEFAULT '',
  result      TEXT DEFAULT 'success',
  duration    INTEGER DEFAULT 0,
  meta        TEXT DEFAULT '{}',
  created_at  DATETIME DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_events_tool ON analytics_events(tool_name, created_at);
CREATE INDEX IF NOT EXISTS idx_events_user ON analytics_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_type ON analytics_events(event_type, created_at);
