import JSZip from 'jszip';
import db from '../db/index.js';
import { runHetaoCliJson, serializeHetaoCliError } from './htcli.js';

const ZIP_FETCH_TIMEOUT_MS = 45000;
const HTCLI_TIMEOUT_MS = 60000;
const CACHE_TTL_MS = 30 * 60 * 1000;
const ASSET_PREVIEW_TIMEOUT_MS = 20000;
const MAX_ASSET_PREVIEW_BYTES = 2 * 1024 * 1024;
const MAX_ASSET_ARCHIVE_BYTES = 30 * 1024 * 1024;
const COURSE_ASSET_HOST_SUFFIXES = ['pipacoding.com', 'hetao101.com'];

const structureCache = new Map();
const assetPreviewCache = new Map();

function ensureCacheTable() {
  db.exec(`
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
  `);
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeText(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function tryJsonParse(text, fallback = null) {
  if (!text || typeof text !== 'string') return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function buildUrl(urlObject) {
  if (!urlObject) return '';
  if (typeof urlObject === 'string') return urlObject;

  const httpPre = urlObject.httpPre || '';
  const relativePath = urlObject.relativePath || '';
  const suffix = urlObject.suffix || '';

  return `${httpPre}${relativePath}${suffix}`;
}

function getFileNameFromUrl(url) {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    const name = parsed.pathname.split('/').filter(Boolean).pop() || '';
    return decodeURIComponent(name);
  } catch {
    return String(url).split('/').filter(Boolean).pop() || '';
  }
}

function getFileExtension(nameOrUrl) {
  const name = getFileNameFromUrl(nameOrUrl) || String(nameOrUrl || '');
  const match = name.match(/\.([a-z0-9]+)(?:$|\?)/i);
  return match ? match[1].toLowerCase() : '';
}

function isCourseAssetUrl(url) {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    return COURSE_ASSET_HOST_SUFFIXES.some(suffix => parsed.hostname === suffix || parsed.hostname.endsWith(`.${suffix}`));
  } catch {
    return false;
  }
}

function collectUrls(value, urls = [], seen = new Set(), depth = 0) {
  if (urls.length >= 60 || value === undefined || value === null || depth > 5) return urls;

  if (typeof value === 'string') {
    const direct = value.trim();
    if (/^https?:\/\//i.test(direct)) {
      urls.push(direct);
      return urls;
    }

    const matches = direct.match(/https?:\/\/[^\s"'<>\\)]+/gi) || [];
    urls.push(...matches);
    return urls;
  }

  if (typeof value !== 'object') return urls;
  if (seen.has(value)) return urls;
  seen.add(value);

  const builtUrl = buildUrl(value);
  if (builtUrl && /^https?:\/\//i.test(builtUrl)) urls.push(builtUrl);

  if (Array.isArray(value)) {
    for (const item of value) collectUrls(item, urls, seen, depth + 1);
    return urls;
  }

  for (const item of Object.values(value)) collectUrls(item, urls, seen, depth + 1);
  return urls;
}

function uniqUrls(urls) {
  const seen = new Set();
  return urls
    .map(url => String(url || '').trim())
    .filter(url => /^https?:\/\//i.test(url))
    .filter(url => {
      if (seen.has(url)) return false;
      seen.add(url);
      return true;
    });
}

export function normalizeResourceRefs(question, item, taskTargets) {
  const refs = [];
  const seen = new Set();

  function add(kind, label, url, source) {
    const normalizedUrl = String(url || '').trim();
    if (!/^https?:\/\//i.test(normalizedUrl) || seen.has(normalizedUrl)) return;
    seen.add(normalizedUrl);
    refs.push({
      kind,
      label: label || getFileNameFromUrl(normalizedUrl) || kind,
      url: normalizedUrl,
      source,
    });
  }

  for (const target of taskTargets || []) {
    if (target.value) add(target.key || 'task', target.name || target.key, target.value, 'taskTargetContentJson');
  }

  for (const url of uniqUrls(collectUrls(question?.pictures))) {
    add('picture', getFileNameFromUrl(url), url, 'pictures');
  }

  for (const url of uniqUrls(collectUrls(question?.objectUrls))) {
    add('object', getFileNameFromUrl(url), url, 'objectUrls');
  }

  for (const url of uniqUrls(collectUrls(item?.descPicture))) {
    add('picture', getFileNameFromUrl(url), url, 'descPicture');
  }

  for (const url of uniqUrls(collectUrls(question?.webThumbnailUrl))) {
    add('thumbnail', getFileNameFromUrl(url), url, 'webThumbnailUrl');
  }

  for (const url of uniqUrls(collectUrls(question?.contexts))) {
    add('context', getFileNameFromUrl(url), url, 'contexts');
  }

  for (const url of uniqUrls(collectUrls(question?.richTexts))) {
    add('richText', getFileNameFromUrl(url), url, 'richTexts');
  }

  return refs;
}

export function normalizeQuestionOptions(item) {
  const options = Array.isArray(item?.options)
    ? item.options
    : Array.isArray(item?.questionChoice?.options)
      ? item.questionChoice.options
      : [];

  return options.map((option, index) => ({
    index,
    label: option?.label || option?.name || option?.text || option?.content || option?.value || option?.optionContent || `选项 ${index + 1}`,
    isAnswer: Boolean(option?.isAnswer || option?.answer || option?.correct || option?.right),
    resourceUrls: uniqUrls(collectUrls(option)),
  }));
}

function normalizeRecordArray(value) {
  return Array.isArray(value) ? value : [];
}

function pickUnit(payload) {
  const data = payload?.data;
  if (Array.isArray(data)) return data[0] || null;
  return data || null;
}

function flattenChapters(unit) {
  return (unit?.parts || []).flatMap(part => {
    return (part.chapters || []).map(chapter => ({
      ...chapter,
      partId: part.id,
      partName: part.name || '',
    }));
  });
}

function serializeChapter(chapter) {
  const zipInfo = pickZipInfo(chapter);
  return {
    id: toNumber(chapter?.id),
    name: normalizeText(chapter?.name, `Chapter ${chapter?.id || ''}`),
    partId: toNumber(chapter?.partId),
    partName: normalizeText(chapter?.partName),
    itemType: normalizeText(chapter?.itemType),
    hasCourseware: Boolean(zipInfo?.zipUrl),
  };
}

function pickChapter(unit, chapterId) {
  const chapters = flattenChapters(unit);
  if (!chapters.length) return null;

  if (chapterId) {
    return chapters.find(chapter => Number(chapter.id) === Number(chapterId)) || chapters[0];
  }

  return chapters.find(chapter => chapter.item?.zipUrl || chapter.item?.normalZipList?.length) || chapters[0];
}

function pickZipInfo(chapter) {
  const item = chapter?.item || {};
  if (item.zipUrl) {
    return {
      zipUrl: item.zipUrl,
      zipMd5: item.zipMd5 || '',
      platform: 'default',
    };
  }

  const zipList = item.normalZipList || [];
  const preferred = zipList.find(entry => entry.type === 'Cocos')
    || zipList.find(entry => entry.type === 'Windows')
    || zipList[0];

  return preferred
    ? {
        zipUrl: preferred.zipUrl,
        zipMd5: preferred.zipMd5 || '',
        platform: preferred.type || 'normal',
      }
    : null;
}

function createCacheKey(subjectId, unitId, chapterId) {
  return `${subjectId}:${unitId}:${chapterId}`;
}

function buildCourseMeta(unit, chapter, zipInfo) {
  return {
    subjectId: unit.subjectId,
    unitId: unit.unitId || unit.id,
    unitName: unit.name || '',
    unitContentType: unit.unitContentType || '',
    chapterId: chapter.id,
    chapterName: chapter.name || '',
    itemType: chapter.itemType || '',
    arrangementId: chapter.item?.arrangementId || null,
    arrangementDescription: chapter.item?.arrangementDescription || '',
    arrangementPublishTime: chapter.item?.arrangementPublishTime || '',
    zipUrl: zipInfo.zipUrl,
    zipMd5: zipInfo.zipMd5,
    zipPlatform: zipInfo.platform,
  };
}

function readPersistedCache(cacheKey) {
  ensureCacheTable();
  return db.prepare('SELECT * FROM course_structure_cache WHERE cache_key = ?').get(cacheKey) || null;
}

function parsePersistedStructure(row) {
  if (!row?.structure_json) return null;
  return tryJsonParse(row.structure_json, null);
}

function writePersistedCache({ cacheKey, course, zipInfo, value }) {
  ensureCacheTable();

  const json = JSON.stringify(value);
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO course_structure_cache (
      cache_key,
      subject_id,
      unit_id,
      chapter_id,
      zip_md5,
      zip_url,
      zip_platform,
      status,
      parsed_at,
      updated_at,
      structure_bytes,
      structure_json,
      error_json
    )
    VALUES (
      @cacheKey,
      @subjectId,
      @unitId,
      @chapterId,
      @zipMd5,
      @zipUrl,
      @zipPlatform,
      'ready',
      @parsedAt,
      @updatedAt,
      @structureBytes,
      @structureJson,
      '{}'
    )
    ON CONFLICT(cache_key) DO UPDATE SET
      zip_md5 = excluded.zip_md5,
      zip_url = excluded.zip_url,
      zip_platform = excluded.zip_platform,
      status = excluded.status,
      parsed_at = excluded.parsed_at,
      updated_at = excluded.updated_at,
      structure_bytes = excluded.structure_bytes,
      structure_json = excluded.structure_json,
      error_json = excluded.error_json
  `).run({
    cacheKey,
    subjectId: course.subjectId,
    unitId: course.unitId,
    chapterId: course.chapterId,
    zipMd5: zipInfo.zipMd5 || '',
    zipUrl: zipInfo.zipUrl || '',
    zipPlatform: zipInfo.platform || '',
    parsedAt: now,
    updatedAt: now,
    structureBytes: Buffer.byteLength(json),
    structureJson: json,
  });
}

function getPersistedCacheStats() {
  ensureCacheTable();
  const row = db.prepare(`
    SELECT
      COUNT(*) AS count,
      COALESCE(SUM(structure_bytes), 0) AS bytes,
      MAX(updated_at) AS latestUpdatedAt
    FROM course_structure_cache
  `).get();

  return {
    count: row?.count || 0,
    bytes: row?.bytes || 0,
    latestUpdatedAt: row?.latestUpdatedAt || '',
  };
}

async function fetchZipBuffer(zipUrl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ZIP_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(zipUrl, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`课件 zip 下载失败：HTTP ${response.status}`);
    }

    return Buffer.from(await response.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
}

async function fetchAssetBuffer(assetUrl) {
  if (!isCourseAssetUrl(assetUrl)) {
    const err = new Error('只支持预览核桃课程素材域名下的资源');
    err.reason = 'ASSET_URL_NOT_ALLOWED';
    throw err;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ASSET_PREVIEW_TIMEOUT_MS);

  try {
    const response = await fetch(assetUrl, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`素材预览下载失败：HTTP ${response.status}`);
    }

    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > MAX_ASSET_ARCHIVE_BYTES) {
      const err = new Error('素材文件过大，暂不预览');
      err.reason = 'ASSET_TOO_LARGE';
      throw err;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_ASSET_ARCHIVE_BYTES) {
      const err = new Error('素材文件过大，暂不预览');
      err.reason = 'ASSET_TOO_LARGE';
      throw err;
    }

    return {
      buffer,
      contentType: response.headers.get('content-type') || '',
    };
  } finally {
    clearTimeout(timer);
  }
}

async function readMortonJson(zipBuffer) {
  const zip = await JSZip.loadAsync(zipBuffer);
  const mortonFile = zip.file('morton.json')
    || zip.file(/(^|\/)morton\.json$/i)[0]
    || null;

  if (!mortonFile) {
    throw new Error('课件包中没有找到 morton.json');
  }

  const text = await mortonFile.async('string');
  return JSON.parse(text);
}

function inferCodeLanguage(fileName) {
  const ext = getFileExtension(fileName);
  if (ext === 'py') return 'python';
  if (['cpp', 'cc', 'cxx', 'c', 'h', 'hpp'].includes(ext)) return 'cpp';
  if (['js', 'mjs', 'cjs'].includes(ext)) return 'javascript';
  if (ext === 'json') return 'json';
  if (ext === 'ts') return 'typescript';
  return ext || 'text';
}

function selectCodeFileFromZip(zip, defaultOpenFile) {
  const files = Object.values(zip.files).filter(file => !file.dir && !file.name.includes('__MACOSX/'));
  const normalizedDefault = String(defaultOpenFile || '').replace(/^\/+/, '');

  if (normalizedDefault) {
    const byDefault = files.find(file => {
      const name = file.name.replace(/^\/+/, '');
      return name === normalizedDefault || name.endsWith(`/${normalizedDefault}`) || name.split('/').pop() === normalizedDefault;
    });
    if (byDefault) return byDefault;
  }

  const codeExtensions = new Set(['py', 'cpp', 'cc', 'cxx', 'c', 'h', 'hpp', 'js', 'ts', 'json', 'txt']);
  return files.find(file => codeExtensions.has(getFileExtension(file.name))) || files[0] || null;
}

async function bufferToPreviewContent(buffer) {
  const truncated = buffer.length > MAX_ASSET_PREVIEW_BYTES;
  return {
    content: buffer.subarray(0, MAX_ASSET_PREVIEW_BYTES).toString('utf8'),
    bytes: buffer.length,
    truncated,
  };
}

function mapBy(items, keyGetter) {
  const map = new Map();
  for (const item of items || []) {
    const key = keyGetter(item);
    if (key !== undefined && key !== null && key !== '') {
      map.set(String(key), item);
    }
  }
  return map;
}

function getQuestionIdsFromCheckpoint(checkpoint) {
  return (checkpoint?.nodes || [])
    .map(node => node.questionId)
    .filter(id => id !== undefined && id !== null);
}

function normalizeTaskTargets(questionItem) {
  const raw = tryJsonParse(questionItem?.taskTargetContentJson, []);
  if (!Array.isArray(raw)) return [];

  return raw.map(item => ({
    key: item.key || '',
    name: item.name || '',
    value: item.value || '',
    autoPlay: Boolean(item.autoPlay),
  })).filter(item => item.key || item.name || item.value);
}

function normalizeQuestion(question) {
  if (!question) return null;

  const item = question.questionItem || {};
  const taskTargets = normalizeTaskTargets(item);
  return {
    questionId: question.questionId,
    questionType: question.questionType || '',
    name: question.name || '',
    difficulty: question.difficulty ?? null,
    isHomework: Boolean(question.isHomework),
    stem: question.stem || '',
    analyze: question.analyze || '',
    description: item.description || '',
    originChapterDescription: item.originChapterDescription || '',
    learningTarget: item.learningTarget || '',
    startDescriptionList: normalizeRecordArray(item.startDescriptionList),
    auxiliaryTips: normalizeRecordArray(question.auxiliaryTips),
    feedbackCount: normalizeRecordArray(question.questionFeedbacks).length,
    pictures: normalizeRecordArray(question.pictures),
    objectUrls: uniqUrls(collectUrls(question.objectUrls)),
    descPictureUrls: uniqUrls(collectUrls(item.descPicture)),
    webThumbnailUrl: question.webThumbnailUrl || '',
    options: normalizeQuestionOptions(item),
    drags: normalizeRecordArray(item.drags || item.questionDrag?.drags),
    hotAreas: normalizeRecordArray(item.hotAreas || item.questionDrag?.hotAreas),
    correctType: item.correctType || '',
    ideType: item.ideType || '',
    answerUrl: item.answer || '',
    projectUrl: item.projectUrl || '',
    playerUrl: item.playerUrl || '',
    grammarJudgementUrl: item.grammarJudgementUrl || '',
    defaultOpenFile: item.defaultOpenFile || '',
    runResultShowUrl: item.runResultShowUrl || '',
    projectExtendJson: tryJsonParse(item.projectExtendJson, []),
    taskTargets,
    resourceRefs: normalizeResourceRefs(question, item, taskTargets),
    codeTemplates: Array.isArray(item.codeTemplates) ? item.codeTemplates : [],
  };
}

function normalizeCheckpoint(checkpoint, questionById) {
  if (!checkpoint) return null;

  const questionIds = getQuestionIdsFromCheckpoint(checkpoint);
  return {
    checkpointKey: checkpoint.checkpointKey || '',
    name: checkpoint.name || '',
    writeCheckpointType: checkpoint.writeCheckpointType || '',
    passType: checkpoint.passType || '',
    noPassType: checkpoint.noPassType || '',
    description: checkpoint.description || '',
    targetLearningTime: checkpoint.targetLearningTime ?? null,
    questionIds,
    questions: questionIds
      .map(id => normalizeQuestion(questionById.get(String(id))))
      .filter(Boolean),
    graph: {
      nodes: checkpoint.nodes || [],
      edges: checkpoint.edges || [],
    },
  };
}

function inferNodeKind(node, sense, boards, videos, checkpoints) {
  if (node.nodeType === 'Start') return 'start';
  if (node.nodeType === 'End') return 'end';

  const iconPath = node.nodeUrl?.relativePath || '';
  const pageType = sense?.pageType || '';
  const checkpointTypes = checkpoints.map(item => item?.writeCheckpointType).filter(Boolean);

  if (iconPath.includes('share') || normalizeText(node.nodeName || node.name).includes('分享')) return 'share';
  if (checkpointTypes.includes('CLASS_EXAM')) return 'exam';
  if (boards.length > 0 || pageType === 'stage') return 'stage';
  if (pageType === 'video') return 'video';
  if (videos.length > 0) return pageType === 'dialog' ? 'dialog-video' : 'video';
  if (pageType === 'dialog') return 'dialog';

  return node.nodeType ? String(node.nodeType).toLowerCase() : 'unknown';
}

function buildLongestPath(nodes, edges) {
  const nodeById = mapBy(nodes, node => node.nodeId);
  const start = nodes.find(node => node.nodeType === 'Start') || nodes[0];
  const end = nodes.find(node => node.nodeType === 'End');
  const outgoing = new Map();

  for (const edge of edges || []) {
    const source = String(edge.sourceNodeId);
    if (!outgoing.has(source)) outgoing.set(source, []);
    outgoing.get(source).push(edge);
  }

  const memo = new Map();

  function bestFrom(nodeId, seen = new Set()) {
    const key = String(nodeId);
    if (memo.has(key)) return memo.get(key);
    if (seen.has(key)) return [key];
    if (end && key === String(end.nodeId)) return [key];

    const nextEdges = outgoing.get(key) || [];
    if (!nextEdges.length) return [key];

    const nextSeen = new Set(seen);
    nextSeen.add(key);

    let best = [key];
    for (const edge of nextEdges) {
      const targetId = String(edge.targetNodeId);
      if (!nodeById.has(targetId)) continue;
      const candidate = [key, ...bestFrom(targetId, nextSeen)];
      if (candidate.length > best.length) best = candidate;
    }

    memo.set(key, best);
    return best;
  }

  const path = start ? bestFrom(start.nodeId) : [];
  const pathSet = new Set(path);
  const sideNodes = nodes
    .filter(node => node.nodeType === 'Sense' && !pathSet.has(String(node.nodeId)))
    .sort((a, b) => toNumber(a.sequenceNo, 9999) - toNumber(b.sequenceNo, 9999))
    .map(node => String(node.nodeId));

  return {
    orderedIds: [...path, ...sideNodes],
    sideNodeIds: sideNodes,
  };
}

function normalizeMorton({ morton, unit, chapter, zipInfo }) {
  const senses = morton.senses || [];
  const nodes = morton.nodes || [];
  const edges = morton.edges || [];
  const checkpoints = morton.checkpoints || [];
  const questions = morton.questions || [];

  const senseById = mapBy(senses, sense => sense.senseId);
  const checkpointByKey = mapBy(checkpoints, checkpoint => checkpoint.checkpointKey);
  const questionById = mapBy(questions, question => question.questionId);
  const { orderedIds, sideNodeIds } = buildLongestPath(nodes, edges);
  const orderByNodeId = new Map(orderedIds.map((id, index) => [id, index]));

  const normalizedNodes = nodes
    .filter(node => node.nodeType === 'Sense')
    .map(node => {
      const sense = senseById.get(String(node.senseId)) || null;
      const senseObjects = sense?.senseObjects || [];
      const videos = senseObjects
        .filter(object => object.objectType === 'Video')
        .map(object => ({
          objectId: object.objectId,
          objectName: object.objectName || '',
          url: buildUrl(object.videoUrl),
          playPattern: object.playPattern || '',
          width: object.width || null,
          height: object.height || null,
          isStayEnd: Boolean(object.isStayEnd),
        }));

      const boards = senseObjects
        .filter(object => object.objectType === 'CalculusBoard')
        .map(object => {
          const checkpointKey = object.calculusKey || '';
          const checkpoint = normalizeCheckpoint(checkpointByKey.get(checkpointKey), questionById);

          return {
            objectId: object.objectId,
            objectName: object.objectName || '',
            calculusKey: checkpointKey,
            checkpointId: object.checkpointId || null,
            difficulty: object.difficulty ?? null,
            answerStatus: object.answerStatus || '',
            knowledge: object.knowledge || '',
            successfulGoal: object.successfulGoal || '',
            tipButton: object.tipButton || null,
            resourceRefs: uniqUrls(collectUrls([
              object.knowledge,
              object.successfulGoal,
              object.tipButton,
              object.senseCalculusBoard,
            ])).map(url => ({
              kind: 'board',
              label: getFileNameFromUrl(url) || '关卡素材',
              url,
              source: 'CalculusBoard',
            })),
            checkpoint,
          };
        });

      const h5Objects = senseObjects
        .filter(object => String(object.objectType || '').toLowerCase().includes('h5'))
        .map(object => ({
          objectId: object.objectId,
          objectName: object.objectName || '',
          h5Url: object.h5Url || '',
          kanbanUrl: object.kanbanUrl || '',
          openInWindow: Boolean(object.openInWindow),
        }));

      const objectTypes = [...new Set(senseObjects.map(object => object.objectType).filter(Boolean))];
      const checkpointsForKind = boards.map(board => board.checkpoint).filter(Boolean);
      const nodeId = String(node.nodeId);

      return {
        nodeId: node.nodeId,
        nodeName: node.nodeName || node.name || '',
        nodeType: node.nodeType || '',
        kind: inferNodeKind(node, sense, boards, videos, checkpointsForKind),
        sequenceNo: node.sequenceNo || '',
        senseId: node.senseId || null,
        pageType: sense?.pageType || '',
        subPageType: sense?.subPageType || '',
        senseType: sense?.senseType || '',
        objectTypes,
        nodeProgress: node.nodeProgress ?? null,
        necessary: Boolean(node.necessary),
        isSelection: Boolean(node.isSelection),
        hideInSelectList: Boolean(node.hideInSelectList),
        shareTargetNodeId: node.shareTargetNodeId || null,
        isSideNode: sideNodeIds.includes(nodeId),
        orderIndex: orderByNodeId.has(nodeId) ? orderByNodeId.get(nodeId) : 9999,
        videos,
        boards,
        h5Objects,
        objectUrls: Array.isArray(sense?.objectUrls)
          ? sense.objectUrls.map(buildUrl).filter(Boolean)
          : [],
        learningData: null,
      };
    })
    .sort((a, b) => a.orderIndex - b.orderIndex || toNumber(a.sequenceNo, 9999) - toNumber(b.sequenceNo, 9999));

  const normalizedEdges = edges.map(edge => ({
    sourceNodeId: edge.sourceNodeId,
    targetNodeId: edge.targetNodeId,
    name: edge.name || '',
    listenVars: edge.listenVars || [],
    conditionCodeScript: edge.conditionCodeScript || '',
  }));

  const videos = normalizedNodes.flatMap(node => node.videos.map(video => ({
    ...video,
    nodeId: node.nodeId,
    nodeName: node.nodeName,
    sequenceNo: node.sequenceNo,
    senseId: node.senseId,
  })));

  const questionIds = new Set();
  for (const node of normalizedNodes) {
    for (const board of node.boards) {
      for (const question of board.checkpoint?.questions || []) {
        questionIds.add(question.questionId);
      }
    }
  }

  return {
    status: 'ready',
    source: {
      provider: 'hetao-cli + course zip',
      cacheKey: `${unit.subjectId}:${unit.unitId}:${chapter.id}`,
      generatedAt: new Date().toISOString(),
    },
    course: buildCourseMeta(unit, chapter, zipInfo),
    stats: {
      nodeCount: normalizedNodes.length,
      edgeCount: normalizedEdges.length,
      videoCount: videos.length,
      checkpointCount: checkpoints.length,
      questionCount: questions.length,
      mappedQuestionCount: questionIds.size,
    },
    graph: {
      orderedNodeIds: orderedIds,
      sideNodeIds,
      edges: normalizedEdges,
    },
    nodes: normalizedNodes,
    videos,
    resourceInventoryVersion: 1,
    learningDataStatus: 'todo',
  };
}

export function getCourseStructureCacheStatus() {
  const persisted = getPersistedCacheStats();

  return {
    memory: {
      size: structureCache.size,
      ttlMs: CACHE_TTL_MS,
    },
    persisted,
  };
}

export async function getCourseStructureChapters({ subjectId, unitId }) {
  const normalizedSubjectId = toNumber(subjectId);
  const normalizedUnitId = toNumber(unitId);
  if (!normalizedSubjectId || !normalizedUnitId) {
    const err = new Error('subjectId 和 unitId 必填');
    err.reason = 'INVALID_PARAMS';
    throw err;
  }

  const detail = await runHetaoCliJson([
    'course', 'unit', 'detail', '--params',
    JSON.stringify({ subjectId: normalizedSubjectId, unitId: normalizedUnitId }),
    '--format', 'json',
  ], { timeoutMs: HTCLI_TIMEOUT_MS });
  const unit = pickUnit(detail.json);
  if (!unit) throw new Error('未查询到课程 unit 信息');

  return {
    status: 'ready',
    unit: {
      subjectId: toNumber(unit.subjectId, normalizedSubjectId),
      unitId: toNumber(unit.unitId || unit.id, normalizedUnitId),
      unitName: normalizeText(unit.name),
    },
    chapters: flattenChapters(unit).map(serializeChapter),
    checkedAt: new Date().toISOString(),
  };
}

async function resolveCourseSource({ subjectId, unitId, chapterId }) {
  const normalizedSubjectId = toNumber(subjectId);
  const normalizedUnitId = toNumber(unitId);
  const normalizedChapterId = chapterId ? toNumber(chapterId) : '';

  if (!normalizedSubjectId || !normalizedUnitId) {
    const err = new Error('subjectId 和 unitId 必填');
    err.reason = 'INVALID_PARAMS';
    throw err;
  }

  const detail = await runHetaoCliJson([
    'course',
    'unit',
    'detail',
    '--params',
    JSON.stringify({ subjectId: normalizedSubjectId, unitId: normalizedUnitId }),
    '--format',
    'json',
  ], { timeoutMs: HTCLI_TIMEOUT_MS });

  const unit = pickUnit(detail.json);
  if (!unit) {
    throw new Error('未查询到课程 unit 信息');
  }

  const chapter = pickChapter(unit, normalizedChapterId);
  if (!chapter) {
    throw new Error('该 unit 没有可解析的 chapter');
  }

  const zipInfo = pickZipInfo(chapter);
  if (!zipInfo?.zipUrl) {
    throw new Error('该 chapter 没有可解析的课件 zip 地址');
  }

  const course = buildCourseMeta(unit, chapter, zipInfo);
  const cacheKey = createCacheKey(course.subjectId, course.unitId, course.chapterId);
  const persistedCache = readPersistedCache(cacheKey);
  const updateAvailable = Boolean(persistedCache && (persistedCache.zip_md5 || '') !== (zipInfo.zipMd5 || ''));

  return {
    unit,
    chapter,
    zipInfo,
    course,
    cacheKey,
    persistedCache,
    updateAvailable,
  };
}

function buildCacheMeta({ cacheKey, course, zipInfo, persistedCache, updateAvailable }) {
  return {
    exists: Boolean(persistedCache),
    cacheKey,
    status: persistedCache ? (updateAvailable ? 'stale' : 'fresh') : 'missing',
    updateAvailable,
    parsedAt: persistedCache?.parsed_at || '',
    updatedAt: persistedCache?.updated_at || '',
    cachedZipMd5: persistedCache?.zip_md5 || '',
    currentZipMd5: zipInfo.zipMd5 || '',
    structureBytes: persistedCache?.structure_bytes || 0,
    course,
  };
}

function attachSourceState(value, sourceState) {
  return {
    ...value,
    source: {
      ...value.source,
      ...sourceState,
    },
  };
}

export async function getCourseStructureMeta({ subjectId, unitId, chapterId }) {
  const resolved = await resolveCourseSource({ subjectId, unitId, chapterId });

  return {
    status: 'ready',
    source: {
      provider: 'hetao-cli',
      checkedAt: new Date().toISOString(),
      cacheKey: resolved.cacheKey,
    },
    course: resolved.course,
    cache: buildCacheMeta(resolved),
  };
}

export function hasLegacyResourceTruncation(value) {
  if (value?.resourceInventoryVersion >= 1) return false;
  return (value?.nodes || []).some(node => (node.boards || []).some(board =>
    (board.checkpoint?.questions || []).some(question =>
      question.resourceRefs?.length >= 80 || question.options?.some(option => option.resourceUrls?.length >= 12))));
}

export async function getCourseStructure({ subjectId, unitId, chapterId, forceRefresh = false }) {
  const resolved = await resolveCourseSource({ subjectId, unitId, chapterId });
  const { unit, chapter, zipInfo, course, cacheKey, persistedCache, updateAvailable } = resolved;

  if (!forceRefresh && persistedCache) {
    const persistedValue = parsePersistedStructure(persistedCache);
    if (persistedValue) {
      structureCache.set(cacheKey, {
        cachedAt: Date.now(),
        value: persistedValue,
      });

      return attachSourceState(persistedValue, {
        fromCache: true,
        resourceListIncomplete: hasLegacyResourceTruncation(persistedValue),
        cacheStatus: updateAvailable ? 'stale' : 'fresh',
        updateAvailable,
        cachedAt: persistedCache.parsed_at,
        checkedAt: new Date().toISOString(),
      });
    }
  }

  const zipBuffer = await fetchZipBuffer(zipInfo.zipUrl);
  const morton = await readMortonJson(zipBuffer);
  const value = normalizeMorton({ morton, unit, chapter, zipInfo });

  writePersistedCache({ cacheKey, course, zipInfo, value });

  structureCache.set(cacheKey, {
    cachedAt: Date.now(),
    value,
  });

  return {
    ...value,
    source: {
      ...value.source,
      fromCache: false,
      cacheStatus: 'fresh',
      updateAvailable: false,
      checkedAt: new Date().toISOString(),
    },
  };
}

export async function getCourseAssetPreview({ url, defaultOpenFile }) {
  const assetUrl = normalizeText(url);
  if (!assetUrl) {
    const err = new Error('url 必填');
    err.reason = 'INVALID_PARAMS';
    throw err;
  }

  const cacheKey = `${assetUrl}::${defaultOpenFile || ''}`;
  const cached = assetPreviewCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return {
      ...cached.value,
      source: {
        ...cached.value.source,
        fromCache: true,
      },
    };
  }

  const { buffer, contentType } = await fetchAssetBuffer(assetUrl);
  const ext = getFileExtension(assetUrl);
  const isZip = ext === 'zip' || contentType.includes('zip');

  let value;
  if (isZip) {
    const zip = await JSZip.loadAsync(buffer);
    const file = selectCodeFileFromZip(zip, defaultOpenFile);
    if (!file) {
      const err = new Error('项目包里没有找到可预览的代码文件');
      err.reason = 'NO_PREVIEWABLE_FILE';
      throw err;
    }

    const fileBuffer = await file.async('nodebuffer');
    const preview = await bufferToPreviewContent(fileBuffer);
    value = {
      status: 'ready',
      source: {
        url: assetUrl,
        archive: true,
        contentType,
        fromCache: false,
        fetchedAt: new Date().toISOString(),
      },
      fileName: file.name,
      language: inferCodeLanguage(file.name),
      availableFiles: Object.values(zip.files)
        .filter(item => !item.dir && !item.name.includes('__MACOSX/'))
        .map(item => item.name)
        .slice(0, 80),
      ...preview,
    };
  } else {
    const preview = await bufferToPreviewContent(buffer);
    const fileName = getFileNameFromUrl(assetUrl);
    value = {
      status: 'ready',
      source: {
        url: assetUrl,
        archive: false,
        contentType,
        fromCache: false,
        fetchedAt: new Date().toISOString(),
      },
      fileName,
      language: inferCodeLanguage(fileName),
      availableFiles: [fileName].filter(Boolean),
      ...preview,
    };
  }

  assetPreviewCache.set(cacheKey, {
    cachedAt: Date.now(),
    value,
  });

  return value;
}

export function serializeCourseStructureError(err) {
  if (err?.name === 'HetaoCliError') return serializeHetaoCliError(err);

  return {
    reason: err?.reason || 'COURSE_STRUCTURE_ERROR',
    message: err?.message || '课程结构解析失败',
  };
}
