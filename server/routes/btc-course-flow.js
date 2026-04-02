import { Router } from 'express';
import multer from 'multer';
import { read, utils } from 'xlsx';
import db from '../db/index.js';
import crypto from 'crypto';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ══════════════════════════════════════════════════
// 课程映射表 (SKU → 课程体系)
// ══════════════════════════════════════════════════
const COURSE_MAP = {
  '人工智能课程_小低_25年制作':        { name: 'AI 1.0 小低', theme: '人工智能', version: '1.0' },
  '人工智能课程_小高_25年制作':        { name: 'AI 1.0 小高', theme: '人工智能', version: '1.0' },
  '人工智能小高1.0_小高_25年制作':     { name: 'AI 1.0 小高', theme: '人工智能', version: '1.0' },
  '人工智能小低2.0_小低_25年制作':     { name: 'AI 2.0 小低', theme: '人工智能', version: '2.0' },
  '人工智能2.0-图形化_小低_26年制作':  { name: 'AI 2.0 小低', theme: '人工智能', version: '2.0' },
  '人工智能2.0python_小高_26年制作':   { name: 'AI 2.0 小高', theme: '人工智能', version: '2.0' },
  'py1.0小高_小高_24年制作':           { name: 'py课 小高', theme: '代码编程', version: '24年版' },
  'py1.0小高_小高_25年制作':           { name: 'py课 小高', theme: '代码编程', version: '25年版' },
  '图形化2.0小低_小低_24年制作':       { name: '图形化2.0 小低', theme: '代码编程', version: '2.0' },
  '图形化3.0小低_小低_24年制作':       { name: '图形化3.0A 小低', theme: '代码编程', version: '3.0' },
  '图形化3.0小高_小低_25年制作':       { name: '图形化3.0B 小低', theme: '代码编程', version: '3.0' },
  '通用版_新课3.0_小低_23年制作':      { name: '通用课 小低', theme: '通用', version: '3.0' },
  '通用版_新课3.0_小高_23年制作':      { name: '通用课 小高', theme: '通用', version: '3.0' },
};

// ══════════════════════════════════════════════════
// 维度拆解函数
// ══════════════════════════════════════════════════

/** 从期次名拆出年份、季节、期号 */
function parsePeriod(period) {
  // "2025年秋14期" → { year: 2025, season: '秋', periodNum: 14 }
  const m = period.match(/(\d{4})年(春|寒|秋)(\d+)期/);
  if (!m) return { year: null, season: null, periodNum: null };
  return { year: parseInt(m[1]), season: m[2], periodNum: parseInt(m[3]) };
}

/** 从学期名拆出渠道和课程模式 */
function parseSemester(semester) {
  // "2026年寒3期-通用-科特一天一课-系统"
  const parts = semester.split('-');
  if (parts.length >= 4) {
    return {
      channel: parts.slice(1, -2).join('-'),
      courseMode: parts[parts.length - 2]
    };
  } else if (parts.length >= 2) {
    return { channel: parts[1], courseMode: null };
  }
  return { channel: null, courseMode: null };
}

/** 从SKU拆出年级和制作年份 */
function parseSku(sku) {
  const parts = sku.split('_');
  if (parts.length < 3) return { grade: null, makeYear: null };
  const grade = parts[parts.length - 2];
  const makeStr = parts[parts.length - 1];
  const mYear = makeStr.match(/(\d+)年/);
  return {
    grade,
    makeYear: mYear ? parseInt(mYear[1]) : null
  };
}

/** 判断是否为测试数据 */
function isTestData(semester, sku) {
  // 学期名判断
  if (semester.startsWith('测试')) return true;
  if (/勿动|验证|演示/.test(semester)) return true;
  const semParts = semester.split('-');
  if (semParts.length >= 2 && semParts[1].includes('测试')) return true;
  // SKU判断
  if (sku.startsWith('测试') || sku.includes('勿动')) return true;
  const courseName = sku.split('_')[0];
  if (courseName.endsWith('测试') || courseName.endsWith('测试课')) return true;
  return false;
}

// ══════════════════════════════════════════════════
// 表头映射 (Excel列号 → 数据库字段)
// ══════════════════════════════════════════════════
const HEADER_MAP = {
  '公益课期次': 'period',
  '公益课学期': 'semester',
  'sku名称': 'sku',
  '设备': 'device',
  '是否有效': 'is_valid',
  '领账号人数': 'reg_count',
  'BTC1课完课人数': 'complete_1',
  'BTC2课完课人数': 'complete_2',
  'BTC3课完课人数': 'complete_3',
  'BTC4课完课人数': 'complete_4',
  'BTC5课完课人数': 'complete_5',
  'L1领取率': 'l1_rate',
  'BTC1课到课人数': 'attend_1',
  'BTC2课到课人数': 'attend_2',
  'BTC3课到课人数': 'attend_3',
  'BTC4课到课人数': 'attend_4',
  'BTC5课到课人数': 'attend_5',
};

// ══════════════════════════════════════════════════
// API: POST /upload — 上传并导入 xlsx
// ══════════════════════════════════════════════════
router.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请上传文件' });
    }

    const workbook = read(req.file.buffer, { type: 'buffer' });
    const ws = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows = utils.sheet_to_json(ws, { header: 1, defval: null });

    if (rawRows.length < 2) {
      return res.status(400).json({ error: '文件为空或格式不对' });
    }

    // 解析表头
    const headers = rawRows[0];
    const colMap = {};
    for (let i = 0; i < headers.length; i++) {
      const h = String(headers[i]).trim();
      if (HEADER_MAP[h]) colMap[HEADER_MAP[h]] = i;
    }

    // 验证必要列
    const required = ['period', 'semester', 'sku', 'device', 'reg_count', 'attend_1'];
    const missing = required.filter(k => colMap[k] === undefined);
    if (missing.length > 0) {
      return res.status(400).json({ error: `缺少必要列: ${missing.join(', ')}` });
    }

    const batchId = crypto.randomUUID();
    const dataRows = rawRows.slice(1);

    // 构建 INSERT 语句
    const insertStmt = db.prepare(`
      INSERT INTO btc_course_flow (
        period, semester, sku, device, is_valid,
        year, season, period_num, channel, course_mode, grade, make_year,
        course_name, course_theme, course_version,
        reg_count, l1_count, attend_1, attend_2, attend_3, attend_4, attend_5,
        complete_1, complete_2, complete_3, complete_4, complete_5,
        is_test, batch_id
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?
      )
    `);

    // 事务导入
    const importData = db.transaction(() => {
      // 清空旧数据
      db.exec('DELETE FROM btc_course_flow');

      let imported = 0;
      let testCount = 0;

      for (const row of dataRows) {
        const period = row[colMap.period] || '';
        const semester = row[colMap.semester] || '';
        const sku = row[colMap.sku] || '';
        const device = row[colMap.device] || '';
        const isValid = colMap.is_valid !== undefined ? (row[colMap.is_valid] || '是') : '是';

        if (!period || !semester || !sku) continue;

        // 维度拆解
        const { year, season, periodNum } = parsePeriod(period);
        const { channel, courseMode } = parseSemester(semester);
        const { grade, makeYear } = parseSku(sku);

        // 课程映射
        const mapping = COURSE_MAP[sku] || { name: sku, theme: '未分类', version: '未知' };

        // 基础人数
        const regCount = row[colMap.reg_count] || 0;
        const attend1 = row[colMap.attend_1] || 0;
        const attend2 = colMap.attend_2 !== undefined ? (row[colMap.attend_2] || 0) : 0;
        const attend3 = colMap.attend_3 !== undefined ? (row[colMap.attend_3] || 0) : 0;
        const attend4 = colMap.attend_4 !== undefined ? (row[colMap.attend_4] || 0) : 0;
        const attend5 = colMap.attend_5 !== undefined ? (row[colMap.attend_5] || 0) : 0;
        const complete1 = colMap.complete_1 !== undefined ? (row[colMap.complete_1] || 0) : 0;
        const complete2 = colMap.complete_2 !== undefined ? (row[colMap.complete_2] || 0) : 0;
        const complete3 = colMap.complete_3 !== undefined ? (row[colMap.complete_3] || 0) : 0;
        const complete4 = colMap.complete_4 !== undefined ? (row[colMap.complete_4] || 0) : 0;
        const complete5 = colMap.complete_5 !== undefined ? (row[colMap.complete_5] || 0) : 0;

        // L1还原：round(L1率 × 领号)
        const l1Rate = colMap.l1_rate !== undefined ? (row[colMap.l1_rate] || 0) : 0;
        const l1Count = Math.round(l1Rate * regCount);

        // 测试数据标记
        const isTest = isTestData(semester, sku) ? 1 : 0;
        if (isTest) testCount++;

        insertStmt.run(
          period, semester, sku, device, isValid,
          year, season, periodNum, channel, courseMode, grade, makeYear,
          mapping.name, mapping.theme, mapping.version,
          regCount, l1Count, attend1, attend2, attend3, attend4, attend5,
          complete1, complete2, complete3, complete4, complete5,
          isTest, batchId
        );
        imported++;
      }

      return { imported, testCount };
    });

    const result = importData();

    res.json({
      success: true,
      batchId,
      imported: result.imported,
      testDataCount: result.testCount,
      message: `成功导入 ${result.imported} 行数据，其中 ${result.testCount} 行为测试数据`
    });

  } catch (err) {
    console.error('[BTC Course Flow] Upload error:', err);
    res.status(500).json({ error: '导入失败: ' + err.message });
  }
});

// ══════════════════════════════════════════════════
// API: GET /data — 返回全量数据（供前端透视）
// ══════════════════════════════════════════════════
router.get('/data', (req, res) => {
  try {
    const excludeTest = req.query.excludeTest !== 'false';
    const where = excludeTest ? 'WHERE is_test = 0' : '';
    const rows = db.prepare(`SELECT * FROM btc_course_flow ${where} ORDER BY period, semester, sku`).all();
    res.json({ total: rows.length, data: rows });
  } catch (err) {
    console.error('[BTC Course Flow] Data query error:', err);
    res.status(500).json({ error: '查询失败: ' + err.message });
  }
});

// ══════════════════════════════════════════════════
// API: GET /meta — 返回各维度可选值（供筛选器用）
// ══════════════════════════════════════════════════
router.get('/meta', (req, res) => {
  try {
    const excludeTest = req.query.excludeTest !== 'false';
    const where = excludeTest ? 'WHERE is_test = 0' : '';

    const getDim = (col) =>
      db.prepare(`SELECT DISTINCT ${col} FROM btc_course_flow ${where} ORDER BY ${col}`).all().map(r => r[col]).filter(Boolean);

    res.json({
      periods: getDim('period'),
      semesters: getDim('semester'),
      devices: getDim('device'),
      channels: getDim('channel'),
      courseModes: getDim('course_mode'),
      grades: getDim('grade'),
      courseNames: getDim('course_name'),
      courseThemes: getDim('course_theme'),
      courseVersions: getDim('course_version'),
      seasons: getDim('season'),
      years: getDim('year'),
    });
  } catch (err) {
    console.error('[BTC Course Flow] Meta query error:', err);
    res.status(500).json({ error: '查询失败: ' + err.message });
  }
});

export default router;
