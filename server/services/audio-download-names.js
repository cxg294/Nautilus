import path from 'path';

const MAX_PART_LENGTH = 18;

function safePart(value, fallback) {
  const normalized = String(value || '')
    .normalize('NFKC')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[，。！？、；：“”‘’（）【】《》…·~`!@#$%^&()_+={}\[\];',.]/g, ' ')
    .replace(/\s+/g, '')
    .trim();
  return Array.from(normalized || fallback).slice(0, MAX_PART_LENGTH).join('');
}

function stamp(date = new Date()) {
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

export function makeSynthesisDownloadName({ voiceName, text, extension = 'wav', date }) {
  return `${safePart(voiceName, '音色')}_${safePart(text, '语音')}_${stamp(date)}.${extension}`;
}

export function makeEffectDownloadName({ presetName, sourceName, extension = 'wav', date }) {
  return `${safePart(presetName, '效果')}(DSP)_${safePart(path.parse(sourceName || '').name, '音频')}_${stamp(date)}.${extension}`;
}

export function makeSourceDownloadName(fileName) {
  const extension = path.extname(String(fileName || '')).replace('.', '').toLowerCase() || 'wav';
  return `${safePart(path.parse(String(fileName || '')).name, '音频')}.${extension}`;
}
