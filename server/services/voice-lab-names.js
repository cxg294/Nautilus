import db from '../db/index.js';

const MAX_DISPLAY_NAME_LENGTH = 50;

export function normalizeVoiceDisplayName(value) {
  return String(value || '').trim().slice(0, MAX_DISPLAY_NAME_LENGTH);
}

export function getVoiceNameMap() {
  const rows = db.prepare(`
    SELECT
      voice_lab_voice_names.voice_id AS voiceId,
      voice_lab_voice_names.display_name AS displayName,
      voice_lab_voice_names.created_by AS createdBy,
      users.username AS creatorUsername,
      audition_file_name AS auditionFileName,
      audition_content_type AS auditionContentType,
      audition_bytes AS auditionBytes,
      audition_text AS auditionText,
      audition_created_at AS auditionCreatedAt,
      voice_lab_voice_names.is_deleted AS isDeleted,
      voice_lab_voice_names.deleted_at AS deletedAt
    FROM voice_lab_voice_names
    LEFT JOIN users ON users.id = voice_lab_voice_names.created_by
  `).all();

  return new Map(rows.map(row => [row.voiceId, row]));
}

export function mergeVoiceDisplayNames(voices, { onlyMine = false, userId = null } = {}) {
  const nameMap = getVoiceNameMap();
  return voices.filter(voice => {
    const meta = nameMap.get(voice.voice);
    if (Number(meta?.isDeleted)) return false;
    // 没有本地创建记录的音色视为系统默认音色，始终保留在“只看我的”列表中。
    return !onlyMine || !meta?.createdBy || Number(meta.createdBy) === Number(userId);
  }).map(voice => {
    const meta = nameMap.get(voice.voice);
    return {
      ...voice,
      displayName: meta?.displayName || '',
      creatorUsername: meta?.creatorUsername || '',
      isSystemDefault: !meta?.createdBy,
      auditionAudio: getAuditionAudioFromMeta(meta),
      auditionText: meta?.auditionText || '',
    };
  });
}

export function upsertVoiceDisplayName({ voiceId, displayName, source = '', userId = null }) {
  const id = String(voiceId || '').trim();
  if (!id) throw new Error('音色 ID 不能为空');

  const name = normalizeVoiceDisplayName(displayName);

  db.prepare(`
    INSERT INTO voice_lab_voice_names (voice_id, display_name, source, created_by, is_deleted, deleted_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, 0, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(voice_id) DO UPDATE SET
      display_name = excluded.display_name,
      source = COALESCE(NULLIF(excluded.source, ''), voice_lab_voice_names.source),
      is_deleted = 0,
      deleted_at = NULL,
      updated_at = CURRENT_TIMESTAMP
  `).run(id, name, String(source || ''), userId);

  return {
    voice: id,
    displayName: name,
  };
}

export function getAuditionAudioFromMeta(meta) {
  if (!meta?.auditionFileName) return null;

  return {
    fileName: meta.auditionFileName,
    url: `/api/voice-lab/output/${meta.auditionFileName}`,
    contentType: meta.auditionContentType || 'audio/x-wav',
    bytes: Number(meta.auditionBytes) || 0,
    createdAt: meta.auditionCreatedAt || '',
  };
}

export function getVoiceMetadata(voiceId) {
  const id = String(voiceId || '').trim();
  if (!id) return null;

  const meta = db.prepare(`
    SELECT
      voice_id AS voiceId,
      display_name AS displayName,
      audition_file_name AS auditionFileName,
      audition_content_type AS auditionContentType,
      audition_bytes AS auditionBytes,
      audition_text AS auditionText,
      audition_created_at AS auditionCreatedAt,
      is_deleted AS isDeleted,
      deleted_at AS deletedAt
    FROM voice_lab_voice_names
    WHERE voice_id = ?
  `).get(id);

  if (!meta) return null;
  return {
    ...meta,
    auditionAudio: getAuditionAudioFromMeta(meta),
  };
}

export function upsertVoiceAudition({ voiceId, audio, auditionText = '', source = '', userId = null, overwrite = false }) {
  const id = String(voiceId || '').trim();
  if (!id) throw new Error('音色 ID 不能为空');
  if (!audio?.fileName) throw new Error('试听音频不能为空');

  const existing = getVoiceMetadata(id);
  if (existing?.auditionAudio && !overwrite) {
    return {
      voice: id,
      auditionAudio: existing.auditionAudio,
      auditionText: existing.auditionText || '',
      saved: false,
    };
  }

  db.prepare(`
    INSERT INTO voice_lab_voice_names (voice_id, display_name, source, created_by, is_deleted, deleted_at, created_at, updated_at)
    VALUES (?, '', ?, ?, 0, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(voice_id) DO UPDATE SET
      is_deleted = 0,
      deleted_at = NULL,
      source = COALESCE(NULLIF(excluded.source, ''), voice_lab_voice_names.source),
      updated_at = CURRENT_TIMESTAMP
  `).run(id, String(source || ''), userId);

  db.prepare(`
    UPDATE voice_lab_voice_names
    SET
      audition_file_name = ?,
      audition_content_type = ?,
      audition_bytes = ?,
      audition_text = ?,
      audition_created_at = CURRENT_TIMESTAMP,
      source = COALESCE(NULLIF(?, ''), source),
      is_deleted = 0,
      deleted_at = NULL,
      updated_at = CURRENT_TIMESTAMP
    WHERE voice_id = ?
  `).run(
    audio.fileName,
    audio.contentType || 'audio/x-wav',
    Number(audio.bytes) || 0,
    String(auditionText || '').trim().slice(0, 200),
    String(source || ''),
    id
  );

  const updated = getVoiceMetadata(id);
  return {
    voice: id,
    auditionAudio: updated?.auditionAudio || null,
    auditionText: updated?.auditionText || '',
    saved: true,
  };
}

export function markVoiceDeleted(voiceId, userId = null) {
  const id = String(voiceId || '').trim();
  if (!id) return null;

  db.prepare(`
    INSERT INTO voice_lab_voice_names (voice_id, display_name, source, created_by, is_deleted, deleted_at, created_at, updated_at)
    VALUES (?, '', 'deleted', ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(voice_id) DO UPDATE SET
      is_deleted = 1,
      deleted_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
  `).run(id, userId);

  return { voice: id, deleted: true };
}
