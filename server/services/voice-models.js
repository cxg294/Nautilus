import models from '../../shared/voice-models.json' with { type: 'json' };

export const VOICE_MODELS = models;
export const DEFAULT_VOICE_MODEL = 'cosyvoice-v3.5-flash';

export function requireVoiceModel(value, { clone = false, design = false } = {}) {
  const model = models.find(item => item.id === value);
  if (!model || (clone && !model.clone) || (design && !model.design)) throw new Error(`不支持的语音模型：${value || '未指定'}`);
  return model;
}

// 仅供列表初步识别；合成前通过本地绑定或 query_voice 确认，不凭前端参数猜测。
export function inferVoiceModel(voice) {
  return models.find(item => String(voice || '').startsWith(item.id + '-'))?.id || '';
}
