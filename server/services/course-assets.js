import db from '../db/index.js';
import { createHash } from 'node:crypto';
import { runHetaoCliJson, serializeHetaoCliError } from './htcli.js';

const HTCLI_TIMEOUT_MS = 30000;
const COVER_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_UNIT_IDS = 40;
const MAX_CONCURRENCY = 3;
const UNIT_ASSET_CONCURRENCY = 1;
const MAX_TEMPLATE_REQUESTS = 40;
const ALLOWED_SUBJECT_IDS = new Set([17, 19, 21]);

const coverCache = new Map();

function ensureTemplateCacheTable() {
  db.exec(`
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
  `);
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function getTemplateCacheKey(subjectId, templateId) {
  return `${subjectId}:${templateId}`;
}

function parseCachedTemplate(json) {
  try {
    const value = JSON.parse(json || '{}');
    return value?.name && Array.isArray(value?.levels) ? value : null;
  } catch {
    return null;
  }
}

function writeTemplateCache(template) {
  ensureTemplateCacheTable();

  const now = new Date().toISOString();
  const cacheKey = getTemplateCacheKey(template.subjectId, template.templateId);
  db.prepare(`
    INSERT INTO course_asset_template_cache (
      cache_key, subject_id, template_id, synced_at, updated_at, template_json
    )
    VALUES (@cacheKey, @subjectId, @templateId, @syncedAt, @updatedAt, @templateJson)
    ON CONFLICT(cache_key) DO UPDATE SET
      synced_at = excluded.synced_at,
      updated_at = excluded.updated_at,
      template_json = excluded.template_json
  `).run({
    cacheKey,
    subjectId: template.subjectId,
    templateId: template.templateId,
    syncedAt: now,
    updatedAt: now,
    templateJson: JSON.stringify(template),
  });

  return now;
}

function normalizeUnitIds(unitIds) {
  const values = Array.isArray(unitIds) ? unitIds : [];
  const seen = new Set();

  return values
    .map(toNumber)
    .filter(value => Number.isInteger(value) && value > 0)
    .filter(value => {
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
}

function pickUnit(payload) {
  const data = payload?.data;
  if (Array.isArray(data)) return data[0] || null;
  return data || null;
}

function normalizeMaterialUrl(value) {
  const url = String(value || '').trim();
  if (!url) return '';
  return url.startsWith('//') ? `https:${url}` : url;
}

function getUnitChapterPaths(unit) {
  const parts = Array.isArray(unit?.parts) ? unit.parts : [];

  return parts.flatMap(part => (Array.isArray(part?.chapters) ? part.chapters : []))
    .map(chapter => {
      const item = chapter?.item || {};
      const arrangementId = toNumber(item.arrangementId);
      const itemType = String(chapter?.itemType || '').trim();
      const name = String(chapter?.name || '').trim();

      if (!itemType || !name) return null;
      return {
        chapterId: toNumber(chapter.id),
        itemType,
        arrangementId,
        hasCourseware: Boolean(item.zipUrl || item.normalZipList?.some(zip => zip.zipUrl)),
        publishedAt: String(item.arrangementPublishTime || ''),
        revision: createHash('sha256').update(JSON.stringify([
          item.zipMd5 || item.zipUrl || '',
          (item.normalZipList || []).map(zip => [zip.type, zip.zipMd5 || zip.zipUrl || '']),
        ])).digest('hex'),
        name,
        pptInfo: item.pptInfo || null,
      };
    })
    .filter(Boolean);
}

function normalizeUnitAssets(unitId, payload) {
  const unit = pickUnit(payload);
  const paths = getUnitChapterPaths(unit);
  const livePath = paths.find(path => path.itemType === 'LIVE_STREAMING');
  const practicePath = paths.find(path => path.itemType === 'LEARNING_LINK');
  const ppt = paths.find(path => normalizeMaterialUrl(path.pptInfo?.url));
  const materialUrl = normalizeMaterialUrl(ppt?.pptInfo?.url);
  const coverUrl = String(unit?.avatar || '').trim();

  return {
    unitId,
    version: toNumber(unit?.version),
    paths,
    // 名称和课序以模板树为准；类型仅在模板树没有提供时补充。
    ...(unit?.unitContentType ? { contentType: String(unit.unitContentType) } : {}),
    ...(coverUrl ? { coverUrl } : {}),
    ...(livePath ? {
      livePathId: livePath.arrangementId,
      livePathName: livePath.name,
    } : {}),
    ...(practicePath ? {
      practicePathId: practicePath.arrangementId,
      practicePathName: practicePath.name,
    } : {}),
    ...(materialUrl ? {
      materialLabel: materialUrl.toLowerCase().includes('.pdf') ? 'PDF' : 'PPT',
      materialUrl,
    } : {}),
    ...(paths.length ? {
      pathSummary: paths.map(path => `${path.itemType}:${path.name}#${path.arrangementId}`).join('; '),
    } : {}),
  };
}

function getCachedCover(cacheKey) {
  const cached = coverCache.get(cacheKey);
  if (!cached) return null;
  if (Date.now() - cached.cachedAt > COVER_CACHE_TTL_MS) {
    coverCache.delete(cacheKey);
    return null;
  }
  return cached;
}

function setCachedCover(cacheKey, coverUrl) {
  const cached = {
    coverUrl: String(coverUrl || ''),
    cachedAt: Date.now(),
  };
  coverCache.set(cacheKey, cached);
  return cached;
}

async function mapWithConcurrency(items, limit, worker) {
  const results = Array.from({ length: items.length });
  let cursor = 0;

  async function runNext() {
    const index = cursor;
    cursor += 1;
    if (index >= items.length) return;

    results[index] = await worker(items[index]);
    await runNext();
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runNext));
  return results;
}

async function fetchUnitCover(subjectId, unitId) {
  const cacheKey = `${subjectId}:${unitId}`;
  const cached = getCachedCover(cacheKey);
  if (cached) {
    return {
      unitId,
      coverUrl: cached.coverUrl,
      fromCache: true,
    };
  }

  try {
    const detail = await runHetaoCliJson([
      'course',
      'unit',
      'detail',
      '--params',
      JSON.stringify({ subjectId, unitId }),
      '--format',
      'json',
    ], { timeoutMs: HTCLI_TIMEOUT_MS });
    const unit = pickUnit(detail.json);
    const cachedCover = setCachedCover(cacheKey, unit?.avatar || '');

    return {
      unitId,
      coverUrl: cachedCover.coverUrl,
      fromCache: false,
    };
  } catch (err) {
    return {
      unitId,
      coverUrl: '',
      fromCache: false,
      error: serializeHetaoCliError(err),
    };
  }
}

async function fetchUnitAssets(subjectId, unitId) {
  let lastError = null;

  // 课程服务偶发返回成功但 data 为空。若不重试，模板名称虽正确，
  // 路径/PPT 会被误显示为缺失。
  for (let attempt = 0; attempt < 3; attempt += 1) {
    // 空响应/限流立即重试通常仍失败，留出短暂恢复时间。
    if (attempt > 0) await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    try {
      const detail = await runHetaoCliJson([
        'course', 'unit', 'detail', '--params',
        JSON.stringify({ subjectId, unitId }),
        '--format', 'json',
      ], { timeoutMs: HTCLI_TIMEOUT_MS });
      const unit = pickUnit(detail.json);
      if (toNumber(unit?.unitId || unit?.id) === unitId) return normalizeUnitAssets(unitId, detail.json);
      lastError = new Error('课程服务返回空 Unit 详情');
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('课程服务未返回 Unit 详情');
}

export async function getCourseUnitCovers({ subjectId, unitIds }) {
  const normalizedSubjectId = toNumber(subjectId);
  const normalizedUnitIds = normalizeUnitIds(unitIds);

  if (!ALLOWED_SUBJECT_IDS.has(normalizedSubjectId)) {
    const err = new Error('subjectId 仅支持 17 / 19 / 21');
    err.reason = 'INVALID_SUBJECT';
    throw err;
  }

  if (!normalizedUnitIds.length) {
    const err = new Error('unitIds 不能为空');
    err.reason = 'INVALID_UNIT_IDS';
    throw err;
  }

  if (normalizedUnitIds.length > MAX_UNIT_IDS) {
    const err = new Error(`unitIds 一次最多 ${MAX_UNIT_IDS} 个`);
    err.reason = 'TOO_MANY_UNIT_IDS';
    throw err;
  }

  const items = await mapWithConcurrency(
    normalizedUnitIds,
    MAX_CONCURRENCY,
    unitId => fetchUnitCover(normalizedSubjectId, unitId)
  );

  return {
    status: 'ready',
    subjectId: normalizedSubjectId,
    covers: items,
    cache: {
      size: coverCache.size,
      ttlMs: COVER_CACHE_TTL_MS,
    },
  };
}

function normalizeTemplateRequests(templates) {
  const seen = new Set();
  return (Array.isArray(templates) ? templates : [])
    .map(item => ({ subjectId: toNumber(item?.subjectId), templateId: toNumber(item?.templateId) }))
    .filter(item => ALLOWED_SUBJECT_IDS.has(item.subjectId) && Number.isInteger(item.templateId) && item.templateId > 0)
    .filter(item => {
      const key = `${item.subjectId}:${item.templateId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function getCourseTemplateCache({ subjectId, templateId }) {
  const request = normalizeTemplateRequests([{ subjectId, templateId }])[0];
  if (!request) {
    const err = new Error('subjectId / templateId 无效，且仅支持学科 17 / 19 / 21');
    err.reason = 'INVALID_TEMPLATE_IDS';
    throw err;
  }

  ensureTemplateCacheTable();
  const row = db.prepare(`
    SELECT template_json, synced_at
    FROM course_asset_template_cache
    WHERE cache_key = ?
  `).get(getTemplateCacheKey(request.subjectId, request.templateId));
  const template = parseCachedTemplate(row?.template_json);

  if (!template) {
    return {
      status: 'missing',
      source: 'cache',
      subjectId: request.subjectId,
      templateId: request.templateId,
    };
  }

  return {
    status: 'ready',
    source: 'cache',
    syncedAt: row.synced_at,
    template,
  };
}

function normalizeTemplateDetail(subjectId, templateId, payload) {
  const template = payload?.data || {};
  return {
    subjectId,
    templateId,
    id: toNumber(template.id || template.templateId, templateId),
    name: String(template.name || ''),
    updatedTemplate: true,
    schemaVersion: 2,
    levels: (Array.isArray(template.levels) ? template.levels : []).map(level => ({
      levelNo: toNumber(level.level),
      name: String(level.name || ''),
      units: (Array.isArray(level.units) ? level.units : []).map(unit => ({
        unitId: toNumber(unit.unitId || unit.id),
        title: String(unit.unitName || unit.name || ''),
        order: toNumber(unit.sequence) + 1,
        levelNo: toNumber(level.level),
        unitNo: toNumber(unit.sequence),
        contentType: String(unit.unitContentType || ''),
        coverUrl: String(unit.avatar || ''),
      })),
    })),
  };
}

async function enrichTemplateDetailUnits(subjectId, template) {
  const unitRefs = template.levels.flatMap(level => level.units);
  const assetsByUnitId = new Map(
    // 与模板详情一致，课程服务并发读取会间歇性返回空 data。
    (await mapWithConcurrency(unitRefs, UNIT_ASSET_CONCURRENCY, async unit => {
      try {
        return await fetchUnitAssets(subjectId, unit.unitId);
      } catch (err) {
        return { unitId: unit.unitId, error: serializeHetaoCliError(err) };
      }
    })).map(asset => [asset.unitId, asset])
  );

  return {
    ...template,
    levels: template.levels.map(level => ({
      ...level,
      units: level.units.map(unit => ({
        ...unit,
        ...assetsByUnitId.get(unit.unitId),
        contentType: unit.contentType || assetsByUnitId.get(unit.unitId)?.contentType || 'SOFT_PROJECT',
      })),
    })),
  };
}

function getTemplateDetailError(template) {
  const failedUnit = template.levels
    .flatMap(level => level.units)
    .find(unit => unit.error);

  if (!failedUnit) return null;
  return {
    reason: 'INCOMPLETE_TEMPLATE_DETAIL',
    message: `Unit ${failedUnit.unitId} 资料同步失败：${failedUnit.error.message}。本次不会覆盖本地缓存`,
  };
}

// 检查与手动同步共用在途读取，避免同模板并发访问上游。
const templateReads = new Map();
const templateChecks = new Map();

export function getCourseTemplateCatalog() {
  ensureTemplateCacheTable();
  return {
    status: 'ready',
    templates: db.prepare('SELECT template_json, synced_at FROM course_asset_template_cache').all()
      .flatMap(row => {
        const template = parseCachedTemplate(row.template_json);
        return template ? [{ ...template, syncedAt: row.synced_at, source: 'cache' }] : [];
      }),
  };
}

export async function getCourseTemplateDetails({ templates, persist = true }) {
  const requests = normalizeTemplateRequests(templates);
  if (!requests.length) {
    const err = new Error('templates 不能为空，且仅支持学科 17 / 19 / 21');
    err.reason = 'INVALID_TEMPLATE_IDS';
    throw err;
  }
  if (requests.length > MAX_TEMPLATE_REQUESTS) {
    const err = new Error(`一次最多刷新 ${MAX_TEMPLATE_REQUESTS} 个模板`);
    err.reason = 'TOO_MANY_TEMPLATE_IDS';
    throw err;
  }
  // 模板详情服务在并发请求时会间歇性返回空 data；必须串行拉取，
  // 否则会把不完整模板误当成最新版本写入本地快照。
  const items = await mapWithConcurrency(requests, 1, async item => {
    const key = getTemplateCacheKey(item.subjectId, item.templateId);
    if (!templateReads.has(key)) {
      const read = readTemplateDetail(item).finally(() => templateReads.delete(key));
      templateReads.set(key, read);
    }
    const detail = await templateReads.get(key);
    if (detail.error || !persist) return detail;
    const syncedAt = writeTemplateCache(detail);
    templateChecks.delete(key);
    return { ...detail, source: 'upstream', syncedAt };
  });
  return { status: 'ready', checkedAt: new Date().toISOString(), templates: items };
}

async function readTemplateDetail(item) {
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const result = await runHetaoCliJson([
        // detail 现仅接受 id 且不提供完整课表；tree 返回已审核的 Level / Unit 编排。
        'course', 'template', 'tree', '--params',
        JSON.stringify({ subjectId: item.subjectId, templateId: item.templateId }), '--format', 'json',
      ], { timeoutMs: HTCLI_TIMEOUT_MS });
      const detail = normalizeTemplateDetail(item.subjectId, item.templateId, result.json);
      const units = detail.levels.flatMap(level => level.units);
      if (detail.id === item.templateId && detail.name && units.length && units.every(unit => unit.unitId > 0)) {
        const enriched = await enrichTemplateDetailUnits(item.subjectId, detail);
        const detailError = getTemplateDetailError(enriched);
        if (detailError) return { ...item, error: detailError };
        return enriched;
      }
      lastError = new Error(`课程服务未返回有效的模板 ${item.templateId} 课表，本次不会覆盖本地缓存`);
    } catch (err) {
      lastError = err;
    }
  }
  return { ...item, error: serializeHetaoCliError(lastError) };
}

export async function checkCourseTemplateUpdate(request) {
  // 先校验参数；检查永不写入模板缓存，也不改变最近同步时间。
  getCourseTemplateCache(request);
  const key = getTemplateCacheKey(request.subjectId, request.templateId);
  let check = templateChecks.get(key);
  if (!check || Date.now() - check.startedAt > 60000) {
    check = {
      startedAt: Date.now(),
      result: getCourseTemplateDetails({ templates: [request], persist: false }),
    };
    templateChecks.set(key, check);
  }
  const result = await check.result;
  const latest = result.templates[0];
  if (latest.error) {
    templateChecks.delete(key);
    return { status: 'error', error: latest.error, checkedAt: result.checkedAt };
  }
  const cached = getCourseTemplateCache(request);
  // 模板归一化后的全部展示字段 + Unit 版本 + 路径发布信息及课件指纹。
  const changed = !cached.template || JSON.stringify(cached.template) !== JSON.stringify(latest);
  return {
    status: cached.template ? (changed ? 'stale' : 'fresh') : 'missing',
    checkedAt: result.checkedAt,
    syncedAt: cached.syncedAt,
  };
}

export function serializeCourseAssetsError(err) {
  return {
    reason: err?.reason || 'UNKNOWN',
    message: err?.message || '课程资产查询失败',
  };
}
