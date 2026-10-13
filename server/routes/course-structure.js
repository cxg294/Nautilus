import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { success } from '../utils/response.js';
import {
  getCourseAssetPreview,
  getCourseStructure,
  getCourseStructureChapters,
  getCourseStructureCacheStatus,
  getCourseStructureMeta,
  serializeCourseStructureError,
} from '../services/course-structure.js';
import {
  getHetaoCliCommandMeta,
  runHetaoCliJson,
  serializeHetaoCliError,
} from '../services/htcli.js';

import { getCourseTemplateCatalog } from '../services/course-assets.js';
import db from '../db/index.js';
import { createConditionRecordStore } from '../services/course-condition-records.js';

const router = express.Router();
let conditionRecords;

const ACCESS_PERMISSION = 'module:course-structure:access';

router.use(requireAuth, requirePermission(ACCESS_PERMISSION));
router.get('/template-catalog', (_req, res) => res.json(success(getCourseTemplateCatalog())));

function asBoolean(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue;
  if (typeof value === 'boolean') return value;
  return ['1', 'true', 'yes', 'y'].includes(String(value).toLowerCase());
}

router.get('/status', async (_req, res) => {
  try {
    const result = await runHetaoCliJson(['auth', 'status']);
    const auth = result.json || {};

    res.json(success({
      status: 'ready',
      cli: {
        available: true,
        versionCommand: getHetaoCliCommandMeta(['--version']),
      },
      auth: {
        identity: auth.identity || '',
        tokenStatus: auth.tokenStatus || '',
        userName: auth.userName || '',
        userOpenId: auth.userOpenId || '',
        roleCodes: auth.roleCodes || [],
        grantedAt: auth.grantedAt || '',
        expiresAt: auth.expiresAt || '',
        refreshExpiresAt: auth.refreshExpiresAt || '',
      },
      cache: getCourseStructureCacheStatus(),
      durationMs: result.durationMs,
    }));
  } catch (err) {
    res.json(success({
      status: 'error',
      cache: getCourseStructureCacheStatus(),
      error: serializeHetaoCliError(err),
    }));
  }
});

router.get('/unit', async (req, res) => {
  try {
    const structure = await getCourseStructure({
      subjectId: req.query.subjectId,
      unitId: req.query.unitId,
      chapterId: req.query.chapterId,
      forceRefresh: asBoolean(req.query.forceRefresh),
    });

    // 每次打开整条路径都扫描全部连接（含缓存命中），不依赖用户逐个点开节点。
    // 记录失败不阻塞课程阅读；下次打开仍会再次尝试。
    try {
      conditionRecords ||= createConditionRecordStore(db);
      conditionRecords.recordStructure(structure);
    } catch (error) {
      console.warn('[course-structure] 条件记录失败：', error.message);
    }
    res.json(success(structure));
  } catch (err) {
    res.json(success({
      status: 'error',
      error: serializeCourseStructureError(err),
    }));
  }
});

router.get('/unit/chapters', async (req, res) => {
  try {
    res.json(success(await getCourseStructureChapters({
      subjectId: req.query.subjectId,
      unitId: req.query.unitId,
    })));
  } catch (err) {
    res.json(success({ status: 'error', error: serializeCourseStructureError(err) }));
  }
});

router.get('/unit/meta', async (req, res) => {
  try {
    const metadata = await getCourseStructureMeta({
      subjectId: req.query.subjectId,
      unitId: req.query.unitId,
      chapterId: req.query.chapterId,
    });

    res.json(success(metadata));
  } catch (err) {
    res.json(success({
      status: 'error',
      error: serializeCourseStructureError(err),
    }));
  }
});

router.get('/asset-preview', async (req, res) => {
  try {
    const preview = await getCourseAssetPreview({
      url: req.query.url,
      defaultOpenFile: req.query.defaultOpenFile,
    });

    res.json(success(preview));
  } catch (err) {
    res.json(success({
      status: 'error',
      error: serializeCourseStructureError(err),
    }));
  }
});

export default router;
