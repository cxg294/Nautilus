/**
 * 逐字稿播放器 — 后端路由
 *
 * 项目 CRUD + 权限守卫
 *
 * API:
 *   GET    /api/sequence-player/projects         — 列表（当前用户）
 *   GET    /api/sequence-player/projects/:id      — 详情
 *   POST   /api/sequence-player/projects          — 创建
 *   PUT    /api/sequence-player/projects/:id      — 更新
 *   DELETE /api/sequence-player/projects/:id      — 删除
 */
import { Router } from 'express';
import db from '../db/index.js';
import crypto from 'crypto';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { success, fail, CODE } from '../utils/response.js';
import { createSequenceAssetRouter } from './sequence-player-assets.js';

const router = Router();

function withStageSettings(settings = {}, stage, stageSequences, assets) {
  const safeSettings = settings && typeof settings === 'object' ? settings : {};
  if (!stage && !Array.isArray(stageSequences) && !Array.isArray(assets)) return safeSettings;
  return {
    ...safeSettings,
    ...(stage ? { stage } : {}),
    ...(Array.isArray(stageSequences) ? { stageSequences } : {}),
    ...(Array.isArray(assets) ? { assets } : {}),
  };
}

// 安全守卫
router.use(requireAuth, requirePermission('module:sequence-player:access'));

router.use(createSequenceAssetRouter());

// ══════════════════════════════════════════════════
// 获取当前用户的项目列表
// ══════════════════════════════════════════════════
router.get('/projects', (req, res) => {
  try {
    const userId = req.user.id;
    const projects = db.prepare(`
      SELECT id, title, created_at, updated_at
      FROM sequence_projects
      WHERE user_id = ?
      ORDER BY updated_at DESC
    `).all(userId);

    res.json(success(projects));
  } catch (err) {
    console.error('[sequence-player] list error:', err);
    res.json(fail(CODE.FAIL, '获取项目列表失败'));
  }
});

// ══════════════════════════════════════════════════
// 获取项目详情
// ══════════════════════════════════════════════════
router.get('/projects/:id', (req, res) => {
  try {
    const userId = req.user.id;
    const project = db.prepare(`
      SELECT * FROM sequence_projects
      WHERE id = ? AND user_id = ?
    `).get(req.params.id, userId);

    if (!project) {
      return res.json(fail(CODE.FAIL, '项目不存在'));
    }

    // 解析 JSON 字段
    project.characters = JSON.parse(project.characters || '[]');
    project.steps = JSON.parse(project.steps || '[]');
    project.settings = JSON.parse(project.settings || '{}');
    project.stage = project.settings.stage;
    project.stageSequences = Array.isArray(project.settings.stageSequences) ? project.settings.stageSequences : [];
    project.assets = Array.isArray(project.settings.assets) ? project.settings.assets : [];

    res.json(success(project));
  } catch (err) {
    console.error('[sequence-player] get error:', err);
    res.json(fail(CODE.FAIL, '获取项目失败'));
  }
});

// ══════════════════════════════════════════════════
// 创建项目
// ══════════════════════════════════════════════════
router.post('/projects', (req, res) => {
  try {
    const userId = req.user.id;
    const { title, rawScript, characters, steps, settings, stage, stageSequences, assets } = req.body;

    if (!title?.trim()) {
      return res.json(fail(CODE.VALIDATION, '项目名称不能为空'));
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO sequence_projects (id, user_id, title, raw_script, characters, steps, settings, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      userId,
      title.trim(),
      rawScript || '',
      JSON.stringify(characters || []),
      JSON.stringify(steps || []),
      JSON.stringify(withStageSettings(settings, stage, stageSequences, assets)),
      now,
      now,
    );

    res.json(success({ id, title: title.trim(), created_at: now, updated_at: now }));
  } catch (err) {
    console.error('[sequence-player] create error:', err);
    res.json(fail(CODE.FAIL, '创建项目失败'));
  }
});

// ══════════════════════════════════════════════════
// 更新项目
// ══════════════════════════════════════════════════
router.put('/projects/:id', (req, res) => {
  try {
    const userId = req.user.id;
    const { title, rawScript, characters, steps, settings, stage, stageSequences, assets } = req.body;

    // 确认项目属于当前用户
    const existing = db.prepare(`
      SELECT id FROM sequence_projects WHERE id = ? AND user_id = ?
    `).get(req.params.id, userId);

    if (!existing) {
      return res.json(fail(CODE.FAIL, '项目不存在'));
    }

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE sequence_projects
      SET title = ?, raw_script = ?, characters = ?, steps = ?, settings = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).run(
      title?.trim() || '未命名项目',
      rawScript || '',
      JSON.stringify(characters || []),
      JSON.stringify(steps || []),
      JSON.stringify(withStageSettings(settings, stage, stageSequences, assets)),
      now,
      req.params.id,
      userId,
    );

    res.json(success({ updated_at: now }, '项目已保存'));
  } catch (err) {
    console.error('[sequence-player] update error:', err);
    res.json(fail(CODE.FAIL, '更新项目失败'));
  }
});

// ══════════════════════════════════════════════════
// 删除项目
// ══════════════════════════════════════════════════
router.delete('/projects/:id', (req, res) => {
  try {
    const userId = req.user.id;

    const result = db.prepare(`
      DELETE FROM sequence_projects WHERE id = ? AND user_id = ?
    `).run(req.params.id, userId);

    if (result.changes === 0) {
      return res.json(fail(CODE.FAIL, '项目不存在'));
    }

    res.json(success(null, '项目已删除'));
  } catch (err) {
    console.error('[sequence-player] delete error:', err);
    res.json(fail(CODE.FAIL, '删除项目失败'));
  }
});

export default router;
