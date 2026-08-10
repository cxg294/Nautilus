import express from 'express';
import { success } from '../utils/response.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { getMidPriceCourseDashboard, refreshMidPriceCourseDashboard } from '../services/mid-price-course.js';

const router = express.Router();
router.use(requireAuth, requirePermission('module:mid-price-course:access'));
router.get('/dashboard', async (req, res) => res.json(success(await getMidPriceCourseDashboard({ forceRefresh: req.query.forceRefresh === 'true', flush: req.query.flush === 'true' }))));
router.post('/refresh', async (req, res) => res.json(success(await refreshMidPriceCourseDashboard({ flush: Boolean(req.body?.flush) }))));
export default router;
