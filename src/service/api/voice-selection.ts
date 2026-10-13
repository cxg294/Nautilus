import type { VoiceCloneItem } from './voice-lab';
import { modelForVoice, voiceModelLabel } from './voice-models';

const roleNames = ['小核桃', '乌拉乎', '桃子', '禾木', '艾博士', '宇航老师'];
// 依据官方声线描述给出少量试听起点；不代表音质排名。
export const suggestedVoiceIds = [
  'qwen-audio-3.0-tts-flash-longcanzhuyue',
  'longanfengyue',
  'longanlingxin',
  'longjielidou_v3.6',
  'longpaopao_v3.6',
  'loongjohn'
];

export function commonVoices(voices: VoiceCloneItem[], currentIds: string[] = []) {
  const chosen: VoiceCloneItem[] = [];
  const add = (voice?: VoiceCloneItem) => {
    if (voice && !chosen.some(v => v.voice === voice.voice)) chosen.push(voice);
  };
  for (const name of roleNames) {
    add(voices.find(v => v.displayName === `${name} · Audio Flash` && modelForVoice(v) === 'qwen-audio-3.0-tts-flash'));
  }
  voices.filter(v => !v.readOnly && v.displayName && !chosen.some(c => c.voice === v.voice) &&
    !/试听对照|接入验证/.test(v.displayName) && !/-(?:ab26[ab]|cvp26ab|qap26ab|cap26test)-/.test(v.voice))
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .slice(0, 4).forEach(add);
  suggestedVoiceIds.forEach(id => add(voices.find(v => v.voice === id)));
  currentIds.forEach(id => add(voices.find(v => v.voice === id)));
  return chosen;
}

export function voiceChoiceLabel(voice: VoiceCloneItem) {
  const name = (voice.displayName || '未命名').replace(/ · Audio Flash$/, '');
  return [name, voice.readOnly ? voice.description : '', voiceModelLabel(modelForVoice(voice)),
    voice.status && voice.status !== 'OK' ? voice.status : ''].filter(Boolean).join(' · ');
}
