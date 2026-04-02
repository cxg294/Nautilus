-- BTC 课程流转数据表
CREATE TABLE IF NOT EXISTS btc_course_flow (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- 原始维度
  period TEXT NOT NULL,
  semester TEXT NOT NULL,
  sku TEXT NOT NULL,
  device TEXT NOT NULL,
  is_valid TEXT DEFAULT '是',
  -- 预拆子维度（从期次/学期/SKU拆出）
  year INTEGER,
  season TEXT,
  period_num INTEGER,
  channel TEXT,
  course_mode TEXT,
  grade TEXT,
  make_year INTEGER,
  -- 课程映射
  course_name TEXT,
  course_theme TEXT,
  course_version TEXT,
  -- 12个基础人数字段
  reg_count INTEGER DEFAULT 0,
  l1_count INTEGER DEFAULT 0,
  attend_1 INTEGER DEFAULT 0,
  attend_2 INTEGER DEFAULT 0,
  attend_3 INTEGER DEFAULT 0,
  attend_4 INTEGER DEFAULT 0,
  attend_5 INTEGER DEFAULT 0,
  complete_1 INTEGER DEFAULT 0,
  complete_2 INTEGER DEFAULT 0,
  complete_3 INTEGER DEFAULT 0,
  complete_4 INTEGER DEFAULT 0,
  complete_5 INTEGER DEFAULT 0,
  -- 元信息
  is_test INTEGER DEFAULT 0,
  batch_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 常用查询索引
CREATE INDEX IF NOT EXISTS idx_bcf_period ON btc_course_flow(period);
CREATE INDEX IF NOT EXISTS idx_bcf_course_name ON btc_course_flow(course_name);
CREATE INDEX IF NOT EXISTS idx_bcf_is_test ON btc_course_flow(is_test);
CREATE INDEX IF NOT EXISTS idx_bcf_batch ON btc_course_flow(batch_id);
