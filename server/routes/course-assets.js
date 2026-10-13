import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { success } from '../utils/response.js';
import {
  getCourseUnitCovers,
  getCourseTemplateCatalog,
  checkCourseTemplateUpdate,
  getCourseTemplateCache,
  getCourseTemplateDetails,
  serializeCourseAssetsError,
} from '../services/course-assets.js';

const router = express.Router();

const ACCESS_PERMISSION = 'module:course-assets:access';

router.use(requireAuth, requirePermission(ACCESS_PERMISSION));

router.get('/catalog', (_req, res) => res.json(success(getCourseTemplateCatalog())));

router.get('/template-check', async (req, res) => {
  try {
    res.json(success(await checkCourseTemplateUpdate({ subjectId: req.query.subjectId, templateId: req.query.templateId })));
  } catch (err) {
    res.json(success({ status: 'error', error: serializeCourseAssetsError(err) }));
  }
});

router.post('/unit-covers', async (req, res) => {
  try {
    const result = await getCourseUnitCovers({
      subjectId: req.body?.subjectId,
      unitIds: req.body?.unitIds,
    });

    res.json(success(result));
  } catch (err) {
    res.json(success({
      status: 'error',
      error: serializeCourseAssetsError(err),
    }));
  }
});

router.post('/template-details', async (req, res) => {
  try {
    res.json(success(await getCourseTemplateDetails({ templates: req.body?.templates })));
  } catch (err) {
    res.json(success({ status: 'error', error: serializeCourseAssetsError(err) }));
  }
});

router.get('/template-cache', (req, res) => {
  try {
    res.json(success(getCourseTemplateCache({
      subjectId: req.query.subjectId,
      templateId: req.query.templateId,
    })));
  } catch (err) {
    res.json(success({ status: 'error', error: serializeCourseAssetsError(err) }));
  }
});

export default router;
