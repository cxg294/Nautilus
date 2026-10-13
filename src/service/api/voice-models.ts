import models from '../../../shared/voice-models.json';

export const defaultCloneModel = 'cosyvoice-v3.5-flash';
export const cloneModelOptions = models.filter(model => model.clone).map(model => ({
  value: model.id,
  label: `${model.label} · ${model.pricePer10k} 元/万字符`
}));
export const designModelOptions = models.filter(model => model.design).map(model => ({ value: model.id, label: model.label }));
export const voiceModelOptions = models.map(model => ({ value: model.id, label: model.label }));
export function voiceModelLabel(model?: string) {
  return models.find(item => item.id === model)?.label || model || '自动识别模型';
}
export function voiceModelPrice(model?: string) {
  return models.find(item => item.id === model)?.pricePer10k;
}
export function modelForVoice(voice?: { voice: string; targetModel?: string }, id = '') {
  return voice?.targetModel || models.find(model => (voice?.voice || id).startsWith(model.id + '-'))?.id;
}
