import { ref, computed } from 'vue';

// API 基础路径
const API_BASE = '/api/btc-course-flow';

// ═══════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════

/** 原始数据行 */
export interface BtcRow {
  period: string;
  semester?: string;
  course_name: string;
  course_theme?: string;
  course_version?: string;
  device?: string;
  channel?: string;
  course_mode?: string;
  grade?: string;
  season?: string;
  year?: string;
  make_year?: string;
  reg_count: number;
  l1_count: number;
  attend_1: number;
  attend_2: number;
  attend_3: number;
  attend_4: number;
  attend_5: number;
  complete_1: number;
  complete_2: number;
  complete_3: number;
  complete_4: number;
  complete_5: number;
  [key: string]: string | number | undefined;
}

/** 计数指标定义 */
interface CountMetricDef {
  label: string;
  type: 'count';
  key: string;
}

/** 比率指标定义 */
interface RateMetricDef {
  label: string;
  type: 'rate';
  num: string;
  den: string;
}

type MetricDef = CountMetricDef | RateMetricDef;

/** 聚合后的数据行 */
export interface AggRow {
  [key: string]: string | number | null | undefined;
  _key: string;
  _count: number;
  _n: number;
}

/** 维度定义 */
interface DimensionDef {
  label: string;
  key: string;
}

/** 元数据（后端返回） */
interface BtcMeta {
  totalRows?: number;
  periods?: string[];
  [key: string]: unknown;
}

// ═══════════════════════════════════════════════
// 全局状态 (single source of truth)
// ═══════════════════════════════════════════════

const rawData = ref<BtcRow[]>([]);
const meta = ref<BtcMeta | null>(null);
const loading = ref(false);
const hasData = computed(() => rawData.value.length > 0);

// ═══════════════════════════════════════════════
// 比率类指标定义
// ═══════════════════════════════════════════════
export const METRICS: Record<string, MetricDef> = {
  // 计数指标
  reg_count:   { label: '领号人数', type: 'count', key: 'reg_count' },
  l1_count:    { label: 'L1领取人数', type: 'count', key: 'l1_count' },
  attend_1:    { label: 'BTC1课到课', type: 'count', key: 'attend_1' },
  attend_2:    { label: 'BTC2课到课', type: 'count', key: 'attend_2' },
  attend_3:    { label: 'BTC3课到课', type: 'count', key: 'attend_3' },
  attend_4:    { label: 'BTC4课到课', type: 'count', key: 'attend_4' },
  attend_5:    { label: 'BTC5课到课', type: 'count', key: 'attend_5' },
  complete_1:  { label: 'BTC1课完课', type: 'count', key: 'complete_1' },
  complete_2:  { label: 'BTC2课完课', type: 'count', key: 'complete_2' },
  complete_3:  { label: 'BTC3课完课', type: 'count', key: 'complete_3' },
  complete_4:  { label: 'BTC4课完课', type: 'count', key: 'complete_4' },
  complete_5:  { label: 'BTC5课完课', type: 'count', key: 'complete_5' },
  // 比率指标 (分子/分母)
  cr_1:        { label: 'BTC1课完课率', type: 'rate', num: 'complete_1', den: 'attend_1' },
  cr_2:        { label: 'BTC2课完课率', type: 'rate', num: 'complete_2', den: 'attend_2' },
  cr_3:        { label: 'BTC3课完课率', type: 'rate', num: 'complete_3', den: 'attend_3' },
  cr_4:        { label: 'BTC4课完课率', type: 'rate', num: 'complete_4', den: 'attend_4' },
  cr_5:        { label: 'BTC5课完课率', type: 'rate', num: 'complete_5', den: 'attend_5' },
  funnel_rate: { label: '总完课率', type: 'rate', num: '_last_complete', den: 'attend_1' },
  l1_rate:     { label: 'L1领取率', type: 'rate', num: 'l1_count', den: 'reg_count' },
  ret_2:       { label: 'BTC2课留存', type: 'rate', num: 'attend_2', den: 'attend_1' },
  ret_3:       { label: 'BTC3课留存', type: 'rate', num: 'attend_3', den: 'attend_2' },
  ret_4:       { label: 'BTC4课留存', type: 'rate', num: 'attend_4', den: 'attend_3' },
  ret_5:       { label: 'BTC5课留存', type: 'rate', num: 'attend_5', den: 'attend_4' },
  to_course_cvr: { label: '首课到课转化率', type: 'rate', num: 'l1_count', den: 'attend_1' },
};

// ═══════════════════════════════════════════════
// 维度字段定义
// ═══════════════════════════════════════════════
export const DIMENSIONS: Record<string, DimensionDef> = {
  period:         { label: '期次', key: 'period' },
  semester:       { label: '学期', key: 'semester' },
  course_name:    { label: '课程', key: 'course_name' },
  course_theme:   { label: '课程主题', key: 'course_theme' },
  course_version: { label: '课程版本', key: 'course_version' },
  device:         { label: '设备', key: 'device' },
  channel:        { label: '渠道', key: 'channel' },
  course_mode:    { label: '课程模式', key: 'course_mode' },
  grade:          { label: '年龄段', key: 'grade' },
  season:         { label: '季节', key: 'season' },
  year:           { label: '年份', key: 'year' },
  make_year:      { label: '制作年份', key: 'make_year' },
};

// ═══════════════════════════════════════════════
// 聚合计算
// ═══════════════════════════════════════════════

/** 对一组行求和（计数字段） */
function sumRows(rows: BtcRow[]): Record<string, number> {
  const s: Record<string, number> = {};
  const countKeys = Object.values(METRICS)
    .filter((m): m is CountMetricDef => m.type === 'count')
    .map(m => m.key);
  for (const k of countKeys) s[k] = 0;
  for (const r of rows) {
    for (const k of countKeys) s[k] += (Number(r[k]) || 0);
  }
  return s;
}

/** 判断总完课率的分子：取最后一课有数据的完课人数 */
function getLastComplete(sums: Record<string, number>): number {
  if (sums.attend_5 > 0) return sums.complete_5;
  return sums.complete_4;
}

/** 计算比率指标 */
function calcRate(metricDef: RateMetricDef, sums: Record<string, number>): number | null {
  const num = metricDef.num === '_last_complete' ? getLastComplete(sums) : sums[metricDef.num];
  const den = sums[metricDef.den];
  if (!den || den === 0) return null;
  // 当分子对应的原始数据为0且该字段可能不存在（如无第5课），返回 null 而非 0
  if (num === 0 && den > 0) {
    const absentFields = ['attend_5', 'complete_5'];
    if (absentFields.includes(metricDef.num)) return null;
    // ret_5: num=attend_5, 若 attend_5=0 说明无第5课
    if (metricDef.num === 'attend_5' && sums.attend_5 === 0) return null;
  }
  return num / den;
}

/** 格式化比率 */
export function fmtRate(val: number | null | undefined): string {
  if (val === null || val === undefined) return '-';
  return (val * 100).toFixed(1) + '%';
}

/** 格式化数字 */
export function fmtNum(val: number | null | undefined): string {
  if (val === null || val === undefined) return '-';
  return val.toLocaleString();
}

// ═══════════════════════════════════════════════
// 透视引擎
// ═══════════════════════════════════════════════

/** 按维度分组聚合 */
export function pivot(data: BtcRow[], rowDim: string, metrics: string[]): AggRow[] {
  // 分组
  const groups = new Map<string, BtcRow[]>();
  for (const row of data) {
    const key = String(row[rowDim] ?? '未知');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  // 聚合
  const result: AggRow[] = [];
  for (const [key, rows] of groups) {
    const sums = sumRows(rows);
    const entry: AggRow = { _key: key, _count: rows.length, _n: sums.attend_1, ...sums };

    for (const mKey of metrics) {
      const def = METRICS[mKey];
      if (def && def.type === 'rate') {
        entry[mKey] = calcRate(def, sums);
      }
    }
    result.push(entry);
  }

  return result;
}

/** 汇总行（合计） */
export function totalRow(data: BtcRow[], metrics: string[]): AggRow {
  const sums = sumRows(data);
  const entry: AggRow = { _key: '合计', _count: data.length, _n: sums.attend_1, ...sums };
  for (const mKey of metrics) {
    const def = METRICS[mKey];
    if (def && def.type === 'rate') {
      entry[mKey] = calcRate(def, sums);
    }
  }
  return entry;
}

// ═══════════════════════════════════════════════
// 数据加载
// ═══════════════════════════════════════════════

export function useBtcData() {
  async function loadData(excludeTest = true) {
    loading.value = true;
    try {
      const resp = await fetch(`${API_BASE}/data?excludeTest=${excludeTest}`);
      const json = await resp.json();
      rawData.value = json.data || [];
    } catch (e) {
      console.error('[BTC] Failed to load data:', e);
    } finally {
      loading.value = false;
    }
  }

  async function loadMeta(excludeTest = true) {
    try {
      const resp = await fetch(`${API_BASE}/meta?excludeTest=${excludeTest}`);
      meta.value = await resp.json();
    } catch (e) {
      console.error('[BTC] Failed to load meta:', e);
    }
  }

  async function uploadFile(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const resp = await fetch(`${API_BASE}/upload`, { method: 'POST', body: formData });
    const json = await resp.json();
    if (!resp.ok) throw new Error(json.error || '上传失败');
    return json;
  }

  return {
    rawData,
    meta,
    loading,
    hasData,
    loadData,
    loadMeta,
    uploadFile,
  };
}
