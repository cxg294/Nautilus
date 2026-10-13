import db from '../db/index.js';

// 合成成功后在服务端记一次，语音实验室与逐字稿工坊共用同一入口。
export function recordVoiceGeneration({ user, result, kind, origin = 'voice-lab' }, database = db) {
  if (!['synthesize', 'audition'].includes(kind)) throw new Error('无效的语音生成事件');
  const voice = String(result?.voice || '').trim();
  if (!voice) throw new Error('语音生成结果缺少音色 ID');

  const meta = {
    recordedBy: 'server',
    voice,
    model: result.model || '',
    characters: Number(result.usage?.characters) || 0,
    requestId: result.requestId || '',
    origin: origin === 'sequence-player' ? 'sequence-player' : 'voice-lab',
  };
  database.prepare(`
    INSERT INTO analytics_events (user_id, username, event_type, tool_name, action_name, result, meta)
    VALUES (?, ?, 'action', 'voice-lab', ?, 'success', ?)
  `).run(String(user?.id || ''), String(user?.username || ''), kind, JSON.stringify(meta));
}

export function getVoiceUsageMap(database = db) {
  const rows = database.prepare(`
    SELECT json_extract(meta, '$.voice') AS voice,
      SUM(CASE WHEN action_name = 'synthesize' THEN 1 ELSE 0 END) AS synthesisCount,
      SUM(CASE WHEN action_name = 'audition' THEN 1 ELSE 0 END) AS auditionCount,
      MAX(CASE WHEN action_name = 'synthesize' THEN created_at END) AS lastSynthesizedAt
    FROM analytics_events
    WHERE tool_name = 'voice-lab'
      AND event_type = 'action'
      AND result = 'success'
      AND action_name IN ('synthesize', 'audition')
      AND json_valid(meta)
      AND json_extract(meta, '$.recordedBy') = 'server'
      AND json_extract(meta, '$.voice') IS NOT NULL
    GROUP BY json_extract(meta, '$.voice')
  `).all();
  return new Map(rows.map(row => [row.voice, row]));
}

export function attachVoiceUsage(voices, database = db) {
  const usage = getVoiceUsageMap(database);
  return voices.map(voice => ({
    ...voice,
    synthesisCount: usage.get(voice.voice)?.synthesisCount || 0,
    auditionCount: usage.get(voice.voice)?.auditionCount || 0,
    lastSynthesizedAt: usage.get(voice.voice)?.lastSynthesizedAt || '',
  }));
}
