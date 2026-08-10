import db from '../db/index.js';
import { runHetaoCliJson, serializeHetaoCliError } from './htcli.js';

export const MID_PRICE_MEM_ID = 4111;
export const MID_PRICE_VIEW_ID = 3499;

// 指标结构升级时切换 key，避免当天旧缓存缺失新增字段。
const CACHE_KEY = 't7-v12';
const TRACKS = [
  { id: 23708, name: '暑假04期', templateId: 9021, subject: '图形化' },
  { id: 23709, name: '暑假04期', templateId: 9032, subject: 'Python' },
  { id: 23961, name: '暑假05期', templateId: 9021, subject: '图形化' },
  { id: 23962, name: '暑假05期', templateId: 9032, subject: 'Python' },
  { id: 24120, name: '暑假06期', templateId: 9021, subject: '图形化' },
  { id: 24121, name: '暑假06期', templateId: 9032, subject: 'Python' },
  { id: 24258, name: '暑假07期', templateId: 9021, subject: '图形化' },
  { id: 24259, name: '暑假07期', templateId: 9032, subject: 'Python' },
  { id: 24412, name: '暑假08期', templateId: 9021, subject: '图形化' },
  { id: 24413, name: '暑假08期', templateId: 9032, subject: 'Python' },
];

// 2026-08-03 人工校准：上游曾返回异常值，暑4第 1 课 T0 完到比以业务核对数据为准。
const FORCED_T0_COMPLETION_RATES = {
  '23708:01_01': 0.9465, // 图形化：230 / 243
  '23709:01_01': 0.9341, // Python：170 / 182
};

// 直播后台（已结束直播）于 2026-08-03 人工拉取。课序按直播 Level / Unit 映射：
// L1 U1/U2、L2 U1/U2 -> 01-01/01-02/02-01/02-02；L3 U2 -> AI1（03-02）。
const LIVE_ATTENDANCE_SNAPSHOT = [
  [23708, '01_01', '项目01：路径规划', '2026-07-17 17:50:01', 187], [23708, '01_02', '项目02：蜗牛爬井', '2026-07-18 17:50:03', 184], [23708, '02_01', '项目03：田忌赛马', '2026-07-24 17:50:02', 201], [23708, '02_02', '项目04：飞机大战', '2026-07-25 17:50:03', 193], [23708, '03_02', 'AI通识：人工智能与图像识别', '2026-08-01 13:50:04', 53],
  [23709, '01_01', '神秘读心术', '2026-07-17 17:50:07', 133], [23709, '01_02', '二维码词云', '2026-07-18 17:50:04', 128], [23709, '02_01', '巧克力博弈', '2026-07-24 17:50:07', 141], [23709, '02_02', '理财策略', '2026-07-25 17:50:04', 127], [23709, '03_02', 'AI通识：人工智能与图像识别', '2026-08-01 13:50:05', 98],
  [23961, '01_01', '项目01：路径规划', '2026-07-24 18:50:02', 126], [23961, '01_02', '项目02：蜗牛爬井', '2026-07-25 18:50:03', 107], [23961, '02_01', '项目03：田忌赛马', '2026-07-31 18:50:05', 116], [23961, '02_02', '项目04：飞机大战', '2026-08-01 18:50:02', 123],
  [23962, '01_01', '神秘读心术', '2026-07-24 18:50:10', 68], [23962, '01_02', '二维码词云', '2026-07-25 18:50:02', 65], [23962, '02_01', '巧克力博弈', '2026-07-31 18:50:02', 65], [23962, '02_02', '理财策略', '2026-08-01 18:50:02', 73],
  [24120, '01_01', '项目01：路径规划', '2026-07-31 17:50:06', 268], [24120, '01_02', '项目02：蜗牛爬井', '2026-08-01 17:50:03', 266],
  [24121, '01_01', '神秘读心术', '2026-07-31 17:50:02', 231], [24121, '01_02', '二维码词云', '2026-08-01 17:50:18', 214],
];

let refreshing = null;

function dateKey() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const get = type => parts.find(part => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function ensureTable() {
  db.exec(`CREATE TABLE IF NOT EXISTS mid_price_course_cache (
    cache_key TEXT PRIMARY KEY, date_key TEXT NOT NULL, updated_at TEXT NOT NULL,
    source_last_update_time TEXT DEFAULT '', row_count INTEGER NOT NULL DEFAULT 0,
    aggregate_json TEXT NOT NULL DEFAULT '{}', error_json TEXT NOT NULL DEFAULT '[]'
  )`);
}

function cacheRow() {
  ensureTable();
  return db.prepare('SELECT * FROM mid_price_course_cache WHERE cache_key = ?').get(CACHE_KEY) || null;
}

function number(value) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

// 4111 的时长已按年级聚合，不能再简单平均。按对应完课人数取加权中位数，
// 可避免少量年级对课程整体时长产生过大影响。
function weightedMedian(samples) {
  const valid = samples
    .filter(sample => Number.isFinite(sample.value) && sample.value > 0 && Number.isFinite(sample.weight) && sample.weight > 0)
    .sort((a, b) => a.value - b.value);
  const totalWeight = valid.reduce((sum, sample) => sum + sample.weight, 0);
  if (!totalWeight) return null;
  let accumulated = 0;
  for (const sample of valid) {
    accumulated += sample.weight;
    if (accumulated >= totalWeight / 2) return sample.value;
  }
  return valid[valid.length - 1]?.value ?? null;
}

async function fetchTrack(track, flush) {
  const result = await runHetaoCliJson([
    'dc-report', 'query-view', 'querydata', '--params', JSON.stringify({ viewId: MID_PRICE_VIEW_ID }), '--data', JSON.stringify({
      fields: ['unit_course_sequence', 'unit_course_rk', 'pay_grade', 'unit_unlocked_user_cnt', 'unit_finish_user_cnt', 'unit_total_finish_duration_median', 't0_unit_attend_user_cnt', 't0_unit_finish_user_cnt', 't7_unit_attend_user_cnt', 't7_unit_finish_user_cnt'],
      filters: [], flush, pageNo: 1, pageSize: 500,
      params: { unit_template_id: track.templateId, term_id: track.id },
    }),
  ]);
  if (result.json?.success !== true) {
    throw new Error(`达芬奇返回失败：${track.name} ${track.subject}（${result.json?.message || '未知错误'}）`);
  }
  const payload = result.json?.data?.payload || {};
  return { track, rows: Array.isArray(payload.resultList) ? payload.resultList : [], lastUpdateTime: payload.lastUpdateTime || '' };
}

function aggregate(results) {
  const series = [];
  const gradeRows = [];
  let sourceLastUpdateTime = '';
  for (const { track, rows, lastUpdateTime } of results) {
    sourceLastUpdateTime = sourceLastUpdateTime || lastUpdateTime;
    const lessons = new Map();
    for (const row of rows) {
      const key = String(row.unit_course_sequence || '未知课序');
      const item = lessons.get(key) || { lesson: key, rank: number(row.unit_course_rk), unlocked: 0, attend: 0, complete: 0, t7Attend: 0, t7Complete: 0, durationSamples: [] };
      item.rank = Math.min(item.rank || Infinity, number(row.unit_course_rk) || Infinity);
      // 同一课序的年级行要累加；期次进量在前端按课序解锁人数取最大值。
      item.unlocked += number(row.unit_unlocked_user_cnt);
      item.attend += number(row.t0_unit_attend_user_cnt);
      item.complete += number(row.t0_unit_finish_user_cnt);
      item.t7Attend += number(row.t7_unit_attend_user_cnt);
      item.t7Complete += number(row.t7_unit_finish_user_cnt);
      item.durationSamples.push({ value: number(row.unit_total_finish_duration_median), weight: number(row.unit_finish_user_cnt) });
      lessons.set(key, item);
      const unlocked = number(row.unit_unlocked_user_cnt);
      const attend = number(row.t0_unit_attend_user_cnt);
      const complete = number(row.t0_unit_finish_user_cnt);
      const t7Attend = number(row.t7_unit_attend_user_cnt);
      const t7Complete = number(row.t7_unit_finish_user_cnt);
      const durationMedianMs = number(row.unit_total_finish_duration_median) || null;
      gradeRows.push({
        termId: track.id, termName: track.name, templateId: track.templateId, subject: track.subject,
        lesson: key, rank: number(row.unit_course_rk), grade: String(row.pay_grade || '未知'), unlocked, attend, complete, t7Attend, t7Complete, durationMedianMs,
        attendRate: unlocked ? attend / unlocked : null, completionRate: attend ? complete / attend : null,
        t7AttendRate: unlocked ? t7Attend / unlocked : null, t7CompletionRate: t7Attend ? t7Complete / t7Attend : null,
      });
    }
    series.push({
      termId: track.id, termName: track.name, templateId: track.templateId, subject: track.subject,
      lessons: [...lessons.values()].sort((a, b) => a.rank - b.rank).map(({ durationSamples, ...item }) => ({
        ...item, durationMedianMs: weightedMedian(durationSamples), attendRate: item.unlocked ? item.attend / item.unlocked : null,
        completionRate: FORCED_T0_COMPLETION_RATES[`${track.id}:${item.lesson}`] ?? (item.attend ? item.complete / item.attend : null),
        t7AttendRate: item.unlocked ? item.t7Attend / item.unlocked : null,
        t7CompletionRate: item.t7Attend ? item.t7Complete / item.t7Attend : null,
      })),
    });
  }
  const tracksById = new Map(TRACKS.map(track => [track.id, track]));
  const liveAttendance = LIVE_ATTENDANCE_SNAPSHOT.map(([termId, lesson, liveName, startedAt, attendees]) => {
    const track = tracksById.get(termId);
    return { termId, termName: track.name, templateId: track.templateId, subject: track.subject, lesson, liveName, startedAt, attendees };
  });
  return { source: { dashboardId: MID_PRICE_MEM_ID, viewId: MID_PRICE_VIEW_ID, sourceLastUpdateTime, liveAttendanceUpdatedAt: '2026-08-03' }, tracks: TRACKS, series, gradeRows, liveAttendance };
}

async function refresh({ flush = false } = {}) {
  const results = [];
  // 顺序请求，避免达芬奇网关限流后把失败响应误缓存为“无数据”。
  for (const track of TRACKS) {
    results.push(await fetchTrack(track, flush));
  }
  const dashboard = aggregate(results);
  ensureTable();
  db.prepare(`INSERT INTO mid_price_course_cache (cache_key,date_key,updated_at,source_last_update_time,row_count,aggregate_json,error_json)
    VALUES (@cacheKey,@dateKey,@updatedAt,@sourceLastUpdateTime,@rowCount,@aggregateJson,'[]')
    ON CONFLICT(cache_key) DO UPDATE SET date_key=excluded.date_key,updated_at=excluded.updated_at,source_last_update_time=excluded.source_last_update_time,row_count=excluded.row_count,aggregate_json=excluded.aggregate_json,error_json='[]'`).run({
    cacheKey: CACHE_KEY, dateKey: dateKey(), updatedAt: new Date().toISOString(), sourceLastUpdateTime: dashboard.source.sourceLastUpdateTime,
    rowCount: results.reduce((sum, item) => sum + item.rows.length, 0), aggregateJson: JSON.stringify(dashboard),
  });
  return { ...dashboard, cache: { status: 'ready', dateKey: dateKey(), updatedAt: new Date().toISOString(), rowCount: results.reduce((sum, item) => sum + item.rows.length, 0), fromCache: false } };
}

export async function getMidPriceCourseDashboard({ forceRefresh = false, flush = false } = {}) {
  const row = cacheRow();
  if (!forceRefresh && row?.date_key === dateKey()) {
    return { ...JSON.parse(row.aggregate_json), cache: { status: 'ready', dateKey: row.date_key, updatedAt: row.updated_at, rowCount: row.row_count, fromCache: true } };
  }
  if (!refreshing) refreshing = refresh({ flush }).finally(() => { refreshing = null; });
  try { return await refreshing; } catch (error) {
    if (row?.aggregate_json) return { ...JSON.parse(row.aggregate_json), cache: { status: 'stale', dateKey: row.date_key, updatedAt: row.updated_at, rowCount: row.row_count, fromCache: true }, errors: [serializeHetaoCliError(error)] };
    throw error;
  }
}

export function refreshMidPriceCourseDashboard(options) { return getMidPriceCourseDashboard({ ...options, forceRefresh: true }); }
