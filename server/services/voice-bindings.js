import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import db from '../db/index.js';
import { queryVoice } from './aliyun-tts.js';
import { inferVoiceModel, requireVoiceModel, VOICE_MODELS } from './voice-models.js';
import { getCatalogVoice } from './voice-catalog.js';

export const VOICE_SOURCE_DIR = path.resolve('server/voice-lab-sources');
const MAX_SOURCE_BYTES = 30 * 1024 * 1024;

export function getVoiceBinding(voice, database = db) {
  return database.prepare('SELECT * FROM voice_lab_voice_bindings WHERE voice_id = ?').get(voice);
}

export function saveVoiceBinding(voice, model, database = db) {
  if (!voice || !model) throw new Error('音色与模型绑定不能为空');
  database.prepare(`INSERT INTO voice_lab_voice_bindings (voice_id, target_model) VALUES (?, ?)
    ON CONFLICT(voice_id) DO UPDATE SET target_model=excluded.target_model, updated_at=CURRENT_TIMESTAMP`).run(voice, model);
}

export async function resolveVoiceModel(voice, requestedModel, { database = db, query = queryVoice } = {}) {
  if (!/^[\w.-]{1,240}$/.test(voice)) throw new Error('无效的音色 ID');
  if (requestedModel) requireVoiceModel(requestedModel);
  const catalogVoice = getCatalogVoice(voice);
  if (catalogVoice) {
    if (requestedModel && requestedModel !== catalogVoice.targetModel) throw new Error('音色与模型不匹配，请重新选择音色');
    return catalogVoice.targetModel;
  }
  let binding = getVoiceBinding(voice, database);
  if (!binding) {
    const detail = await query(voice);
    if (detail.status !== 'OK') throw new Error(`音色暂不可用（${detail.status || '状态未知'}），请稍后刷新音色`);
    requireVoiceModel(detail.targetModel);
    saveVoiceBinding(voice, detail.targetModel, database);
    binding = getVoiceBinding(voice, database);
  }
  requireVoiceModel(binding.target_model);
  if (requestedModel && requestedModel !== binding.target_model) {
    throw new Error(`音色与模型不匹配，请重新选择音色；此音色属于 ${binding.target_model}`);
  }
  return binding.target_model;
}

export function canReadVoiceSource(binding, user) {
  return Boolean(binding?.source_file && (Number(binding.created_by) === Number(user?.id) || user?.permissions?.includes('feature:voice-lab:manage-voices')));
}

export function attachVoiceBindings(voices, user, database = db) {
  return voices.map(voice => {
    const binding = getVoiceBinding(voice.voice, database);
    const targetModel = binding?.target_model || voice.targetModel || inferVoiceModel(voice.voice);
    const model = VOICE_MODELS.find(item => item.id === targetModel);
    const source = JSON.parse(binding?.clone_params || '{}').kind === 'design' ? 'design' : voice.source;
    return { ...voice, source, targetModel, ssmlSupported: voice.ssmlSupported ?? source === 'clone',
      wordTimestampsSupported: voice.wordTimestampsSupported ?? source === 'clone',
      modelLabel: model?.label || targetModel || '待确认模型',
      modelSupported: !targetModel || Boolean(model),
      sourceAudio: canReadVoiceSource(binding, user) ? { url: `/api/voice-lab/voices/${encodeURIComponent(voice.voice)}/source`, bytes: binding.source_bytes, contentType: binding.source_type } : null };
  });
}

// 克隆成功后留存未经处理的原件；失败只提示，不让用户重复提交已完成的云端克隆。
export async function preserveVoiceSource({ voice, model, file, params, userId }, { database = db, query = queryVoice, directory = VOICE_SOURCE_DIR } = {}) {
  saveVoiceBinding(voice, model, database);
  let buffer, contentType;
  if (file) {
    buffer = await fs.readFile(file.path);
    contentType = file.mimetype || 'application/octet-stream';
  } else {
    const detail = await query(voice);
    if (!detail.resourceLink) throw new Error('供应商未返回原始录音');
    const response = await fetch(detail.resourceLink, { signal: AbortSignal.timeout(30000) });
    if (!response.ok || Number(response.headers.get('content-length')) > MAX_SOURCE_BYTES) throw new Error('原始录音下载失败或文件过大');
    const chunks = []; let bytes = 0;
    for await (const chunk of response.body) {
      bytes += chunk.length;
      if (bytes > MAX_SOURCE_BYTES) throw new Error('原始录音文件过大');
      chunks.push(chunk);
    }
    buffer = Buffer.concat(chunks);
    contentType = response.headers.get('content-type') || 'application/octet-stream';
  }
  if (!buffer.length || buffer.length > MAX_SOURCE_BYTES) throw new Error('原始录音大小无效');
  const extension = ({ 'audio/mpeg': '.mp3', 'audio/mp3': '.mp3', 'audio/wav': '.wav', 'audio/x-wav': '.wav', 'audio/mp4': '.m4a', 'audio/webm': '.webm', 'audio/ogg': '.ogg', 'audio/flac': '.flac' })[contentType.split(';')[0]] || '.audio';
  const name = crypto.randomUUID() + extension;
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, name), buffer);
  try {
    database.prepare(`UPDATE voice_lab_voice_bindings SET source_file=?, source_type=?, source_bytes=?, clone_params=?, created_by=?, updated_at=CURRENT_TIMESTAMP WHERE voice_id=?`)
      .run(name, contentType, buffer.length, JSON.stringify(params), userId, voice);
  } catch (error) {
    await fs.unlink(path.join(directory, name)).catch(() => {});
    throw error;
  }
}
