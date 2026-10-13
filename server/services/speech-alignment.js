import { normalizeWordIndices } from './voice-alignment-indices.js';

// 指定读法改变了读出的字数；将供应商时间映射回原文，字幕不显示读法或 XML。
export function alignControlledSpeech(payloads, compiled) {
  const original = Array.from(compiled.displayText);
  const raw = payloads.filter(p => p.output?.type === 'sentence-end')
    .sort((a, b) => (a.output.sentence?.index || 0) - (b.output.sentence?.index || 0))
    .flatMap(p => (p.output.sentence?.words || []).map(w => ({ text: String(w.text || ''),
      beginIndex: Number(w.begin_index), endIndex: Number(w.end_index),
      beginTimeMs: Number(w.begin_time), endTimeMs: Number(w.end_time) })))
    .filter(w => w.text && Number.isFinite(w.beginTimeMs) && Number.isFinite(w.endTimeMs) && w.endTimeMs > w.beginTimeMs);
  const words = [];
  for (const word of normalizeWordIndices(compiled.spokenText, raw, 0)) {
    const first = compiled.characterMap[word.beginIndex], last = compiled.characterMap[word.endIndex - 1];
    if (!first || !last) continue;
    const token = { ...word, text: original.slice(first.begin, last.end).join(''), beginIndex: first.begin, endIndex: last.end };
    const previous = words.at(-1);
    if (previous && token.beginIndex < previous.endIndex) {
      // 一个缩写读成多个词，整段原文共用这段读音的时间范围。
      previous.endIndex = Math.max(previous.endIndex, token.endIndex);
      previous.text = original.slice(previous.beginIndex, previous.endIndex).join('');
      previous.endTimeMs = Math.max(previous.endTimeMs, token.endTimeMs);
    } else words.push(token);
  }
  return { requested: true, available: words.length > 0, unit: 'ms', granularity: 'word',
    sentences: [{ index: 0, text: compiled.displayText, words }] };
}
