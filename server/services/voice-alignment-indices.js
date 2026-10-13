// 将全文字符 / token 索引归一化为原文字符范围。
export function normalizeWordIndices(text, words, originalOffset) {
  if (!text) return words;
  const chars = Array.from(text);
  const matchesAt = (word, offset) => {
    const begin = word.beginIndex - offset, end = word.endIndex - offset;
    return begin >= 0 && end <= chars.length && chars.slice(begin, end).join('') === word.text;
  };
  const offsets = [...new Set([0, originalOffset])];
  const scored = offsets.map(offset => ({ offset, matches: words.filter(word => matchesAt(word, offset)).length }))
    .sort((a, b) => b.matches - a.matches);
  // 已识别为字符索引时，兼容“十二”等读音与原文“12”不同的 token。
  const characterOffset = scored[0]?.matches >= Math.max(1, words.length * 0.6) ? scored[0].offset : null;
  const aligned = [];
  let cursor = 0;
  for (const word of words) {
    let begin = -1, end = -1;
    const tail = chars.slice(cursor).join('');
    const token = String(word.text);
    const variants = [...new Set([token, token.replace(/[\p{P}\p{Z}]+$/gu, '')])].filter(Boolean);
    for (const variant of variants) {
      const found = tail.indexOf(variant);
      // 自动补出的标点不应跳过正文，抢占后面原有的标点。
      if (found < 0 || (/^[\p{P}\p{Z}]+$/u.test(variant) && found !== 0)) continue;
      begin = cursor + Array.from(tail.slice(0, found)).length;
      end = begin + Array.from(variant).length;
      break;
    }
    if (begin < 0 && characterOffset !== null && !/^[\p{P}\p{Z}]+$/u.test(token)) {
      begin = word.beginIndex - characterOffset;
      end = word.endIndex - characterOffset;
    }
    if (begin < cursor || end <= begin || end > chars.length) continue;
    aligned.push({ ...word, text: chars.slice(begin, end).join(''), beginIndex: begin, endIndex: end });
    cursor = end;
  }
  return aligned;
}
