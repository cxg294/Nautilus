import { Router } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { success, fail, CODE } from '../utils/response.js';
import { createSequenceAssetRouter } from './sequence-player-assets.js';

const presets = JSON.parse(fs.readFileSync(new URL('../../shared/character-presets.json', import.meta.url), 'utf8'));
const publicRoot = fileURLToPath(new URL('../../public/', import.meta.url));
const text = (v, max = 120) => (typeof v === 'string' && v.length <= max ? v.trim() : '');
const number = (v, min, max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

export function validateCharacter(input, { userId, assetRoot = path.resolve('server/sequence-player-assets') }) {
  const name = text(input?.name),
    displayName = text(input?.displayName);
  if (!name || !displayName) throw new Error('请填写人物名称和显示名称');
  if (!Array.isArray(input.poses) || !input.poses.length || input.poses.length > 60)
    throw new Error('每个人物需要 1–60 张立绘');
  const seen = new Set();
  const poses = input.poses.map(p => {
    const id = text(p.id),
      poseName = text(p.name);
    if (!id || !poseName || seen.has(id)) throw new Error('立绘名称不能为空，标识不能重复');
    seen.add(id);
    const imageUrl = text(p.imageUrl, 1000);
    let file;
    if (/^\/api\/(?:sequence-player|character-library)\/assets\/[a-f0-9-]{36}\.webp$/.test(imageUrl)) {
      file = path.join(assetRoot, String(userId), path.basename(imageUrl));
    } else {
      const decoded = decodeURIComponent(imageUrl);
      if (
        !/^\/(?:characters|sequence-player\/characters)\/[\p{L}\p{N}_ /.-]+\.(png|jpg|jpeg|webp|svg)$/u.test(decoded) ||
        decoded.includes('..')
      )
        throw new Error('立绘地址无效，请重新上传');
      file = path.join(publicRoot, decoded);
    }
    if (!fs.existsSync(file)) throw new Error('立绘不存在或不属于当前用户，请重新上传');
    let layout;
    if (p.layout !== undefined) {
      if (!number(p.layout?.x, -50, 150) || !number(p.layout?.y, -50, 150) || !number(p.layout?.height, 5, 160))
        throw new Error('立绘位置或大小超出范围');
      layout = { x: p.layout.x, y: p.layout.y, height: p.layout.height };
    }
    return { id, name: poseName, imageUrl, ...(layout ? { layout } : {}) };
  });
  if (!seen.has(input.defaultPoseId)) throw new Error('请选择有效的默认立绘');
  if (!Array.isArray(input.aliases) || input.aliases.length > 20 || input.aliases.some(v => !text(v, 40)))
    throw new Error('别名最多 20 个，每个不超过 40 字');
  const config = input.ttsConfig;
  if (!number(config?.rate, 0.5, 2)) throw new Error('语速须在 0.5–2.0 之间');
  const voiceId = text(config.voiceId, 240);
  if (voiceId && !/^[\w.-]+$/.test(voiceId)) throw new Error('音色标识无效');
  const model = text(config.model, 120);
  return {
    id: text(input.id) || crypto.randomUUID(),
    name,
    displayName,
    aliases: [...new Set(input.aliases.map(v => v.trim()))],
    color: /^#[a-f\d]{6}$/i.test(input.color) ? input.color : '#6176bb',
    position: ['left', 'center', 'right'].includes(input.position) ? input.position : 'right',
    scale: 1,
    poses,
    defaultPoseId: input.defaultPoseId,
    ...(presets.some(p => p.referencePreset === input.referencePreset)
      ? { referencePreset: input.referencePreset }
      : {}),
    ttsConfig: { engine: 'external', provider: 'nautilus', voiceId, model, rate: config.rate, pitch: 1 }
  };
}

/** Auth/permission are installed by the production mount; injected DB keeps tests isolated. */
export function createCharacterLibraryRouter({ db, assetRoot = path.resolve('server/sequence-player-assets') }) {
  const router = Router();
  router.use(createSequenceAssetRouter({ assetRoot, urlPrefix: '/api/character-library/assets' }));
  const serialize = row => ({
    id: row.id,
    revision: row.revision,
    character: JSON.parse(row.character),
    archived: Boolean(row.archived),
    updatedAt: row.updated_at
  });
  const get = (userId, id) =>
    db.prepare('SELECT * FROM character_library WHERE user_id = ? AND id = ?').get(userId, id);
  const seed = db.transaction(userId => {
    // Only seed missing records. Existing library versions and project snapshots are never rewritten.
    const missing = presets.filter(preset => !get(userId, `builtin-${preset.id}`));
    if (!missing.length) return;
    const projects = db
      .prepare('SELECT characters FROM sequence_projects WHERE user_id = ? ORDER BY updated_at DESC')
      .all(userId);
    for (const preset of missing) {
      const id = `builtin-${preset.id}`;
      const character = structuredClone(preset);
      for (const project of projects) {
        let roles;
        try {
          roles = JSON.parse(project.characters);
        } catch {
          continue;
        }
        const previous =
          Array.isArray(roles) &&
          roles.find(
            r =>
              (r.id === preset.id || r.name === preset.name) &&
              r.ttsConfig?.provider === 'nautilus' &&
              /^[\w.-]+$/.test(r.ttsConfig?.voiceId || '') &&
              !/^(voice_|nautilus-preset-)/.test(r.ttsConfig.voiceId)
          );
        if (!previous) continue;
        character.ttsConfig = {
          ...character.ttsConfig,
          voiceId: previous.ttsConfig.voiceId,
          model: text(previous.ttsConfig.model),
          rate: number(previous.ttsConfig.rate, 0.5, 2) ? previous.ttsConfig.rate : 1
        };
        break;
      }
      db.prepare('INSERT INTO character_library (user_id, id, character) VALUES (?, ?, ?)').run(
        userId,
        id,
        JSON.stringify(character)
      );
    }
  });
  router.get('/', (req, res) => {
    seed(req.user.id);
    res.json(
      success(
        db.prepare('SELECT * FROM character_library WHERE user_id = ? ORDER BY rowid').all(req.user.id).map(serialize)
      )
    );
  });
  router.post('/', (req, res) => {
    try {
      const character = validateCharacter(req.body.character, { userId: req.user.id, assetRoot });
      const id = crypto.randomUUID();
      db.prepare('INSERT INTO character_library (user_id, id, character) VALUES (?, ?, ?)').run(
        req.user.id,
        id,
        JSON.stringify(character)
      );
      res.json(success(serialize(get(req.user.id, id))));
    } catch (error) {
      res.status(400).json(fail(CODE.VALIDATION, error.message));
    }
  });
  router.put('/:id', (req, res) => {
    try {
      const existing = get(req.user.id, req.params.id);
      if (!existing) return res.status(404).json(fail(CODE.FAIL, '人物不存在'));
      const character = validateCharacter(req.body.character, { userId: req.user.id, assetRoot });
      const changed = db
        .prepare(
          'UPDATE character_library SET character = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND id = ? AND revision = ?'
        )
        .run(JSON.stringify(character), req.user.id, req.params.id, req.body.revision);
      if (!changed.changes) return res.status(409).json(fail(CODE.FAIL, '人物已在其他页面更新，请刷新后再编辑'));
      res.json(success(serialize(get(req.user.id, req.params.id))));
    } catch (error) {
      res.status(400).json(fail(CODE.VALIDATION, error.message));
    }
  });
  router.patch('/:id', (req, res) => {
    if (typeof req.body.archived !== 'boolean') return res.status(400).json(fail(CODE.VALIDATION, '归档状态无效'));
    const existing = get(req.user.id, req.params.id);
    if (!existing) return res.status(404).json(fail(CODE.FAIL, '人物不存在'));
    const result = db
      .prepare(
        'UPDATE character_library SET archived = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND id = ? AND revision = ?'
      )
      .run(Number(req.body.archived), req.user.id, req.params.id, req.body.revision);
    if (!result.changes) return res.status(409).json(fail(CODE.FAIL, '人物已更新，请刷新后重试'));
    res.json(success(serialize(get(req.user.id, req.params.id))));
  });
  return router;
}
