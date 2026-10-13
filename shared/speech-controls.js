// 厂商无关的朗读设置；字幕保留原文，只在出站时编译成安全的 SSML。
export function normalizeSpeechControls(value) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 30) throw new Error('朗读设置最多支持 30 项');
  return value.map(item => {
    if (!item || typeof item !== 'object') throw new Error('无效的朗读设置');
    if (item.kind === 'pause') {
      const after = String(item.after || '').trim();
      const occurrence = item.occurrence ?? 1;
      if (!after || Array.from(after).length > 100 || !Number.isInteger(occurrence) || occurrence < 1 || occurrence > 100 ||
        !Number.isInteger(item.timeMs) || item.timeMs < 50 || item.timeMs > 10000) throw new Error('无效的停顿设置：填写定位文字，停顿范围为 50～10000 毫秒');
      return { kind: 'pause', after, occurrence, timeMs: item.timeMs };
    }
    if (item.kind === 'reading') {
      const text = String(item.text || '').trim(), alias = String(item.alias || '').trim();
      if (!text || !alias || Array.from(text).length > 100 || Array.from(alias).length > 100) throw new Error('无效的读法设置：填写原文和读法，各不超过 100 字');
      return { kind: 'reading', text, alias };
    }
    throw new Error('不支持的朗读设置');
  });
}

const escape = text => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
export function compileSpeech(text, value) {
  const controls = normalizeSpeechControls(value);
  const chars = Array.from(text), readings = [], pauses = new Map();
  const occurrences = needle => {
    const find = Array.from(needle), hits = [];
    for (let i = 0; i <= chars.length - find.length; i++) if (chars.slice(i, i + find.length).join('') === needle) hits.push([i, i + find.length]);
    return hits;
  };
  for (const control of controls) {
    if (control.kind === 'pause') {
      const match = occurrences(control.after)[control.occurrence - 1];
      if (!match) throw new Error(`停顿定位文字不存在：${control.after}（第 ${control.occurrence} 处）`);
      if (pauses.has(match[1])) throw new Error('同一位置不能重复设置停顿');
      pauses.set(match[1], control.timeMs);
    } else {
      const hits = occurrences(control.text);
      if (!hits.length) throw new Error(`读法对应的原文不存在：${control.text}`);
      readings.push(...hits.map(([begin, end]) => ({ begin, end, alias: control.alias })));
    }
  }
  readings.sort((a, b) => a.begin - b.begin);
  for (let i = 0; i < readings.length; i++) {
    if (i && readings[i].begin < readings[i - 1].end) throw new Error('指定读法的文字不能重叠');
    for (const pos of pauses.keys()) if (pos > readings[i].begin && pos < readings[i].end) throw new Error('停顿不能放在指定读法的文字内部');
  }
  let xml = '', spokenText = '', cursor = 0;
  const characterMap = [];
  const append = (spoken, begin, end, alias = false) => {
    spokenText += spoken;
    Array.from(spoken).forEach((_, i) => characterMap.push(alias ? { begin, end } : { begin: begin + i, end: begin + i + 1 }));
  };
  while (cursor < chars.length) {
    const reading = readings.find(r => r.begin === cursor);
    if (reading) {
      xml += `<sub alias="${escape(reading.alias)}">${escape(chars.slice(reading.begin, reading.end).join(''))}</sub>`;
      append(reading.alias, reading.begin, reading.end, true);
      cursor = reading.end;
    } else {
      xml += escape(chars[cursor]);
      append(chars[cursor], cursor, cursor + 1);
      cursor++;
    }
    if (pauses.has(cursor)) xml += `<break time="${pauses.get(cursor)}ms"/>`;
  }
  return { text: controls.length ? `<speak>${xml}</speak>` : text, displayText: text, spokenText, characterMap, controls, enabled: controls.length > 0 };
}
