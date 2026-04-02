/**
 * Diff Engine - Compare two SB3 projects and produce structured diffs
 */
import { blockToText, HAT_OPCODES } from './blockConverter';

/**
 * Compare two projects and return a structured diff
 */
export function diffProjects(projA, projB) {
  const targetsA = {};
  const targetsB = {};
  for (const t of (projA.targets || [])) targetsA[t.name] = t;
  for (const t of (projB.targets || [])) targetsB[t.name] = t;

  const allNames = new Set([...Object.keys(targetsA), ...Object.keys(targetsB)]);
  const targetDiffs = [];

  for (const name of [...allNames].sort()) {
    const a = targetsA[name];
    const b = targetsB[name];

    if (!a) {
      targetDiffs.push({ name, status: 'added', details: [], target: b });
    } else if (!b) {
      targetDiffs.push({ name, status: 'removed', details: [], target: a });
    } else {
      const details = diffTarget(a, b);
      targetDiffs.push({
        name,
        status: details.length > 0 ? 'modified' : 'unchanged',
        details,
        target: b,
      });
    }
  }

  // Extension diff
  const extA = new Set(projA.extensions || []);
  const extB = new Set(projB.extensions || []);
  const extDiffs = [];
  for (const e of extB) if (!extA.has(e)) extDiffs.push({ name: e, status: 'added' });
  for (const e of extA) if (!extB.has(e)) extDiffs.push({ name: e, status: 'removed' });

  // Summary
  const summary = {
    added: targetDiffs.filter(d => d.status === 'added').length,
    removed: targetDiffs.filter(d => d.status === 'removed').length,
    modified: targetDiffs.filter(d => d.status === 'modified').length,
    unchanged: targetDiffs.filter(d => d.status === 'unchanged').length,
  };

  return { targetDiffs, extDiffs, summary };
}

function diffTarget(a, b) {
  const details = [];

  // Properties
  for (const prop of ['x', 'y', 'size', 'direction', 'visible', 'volume', 'draggable', 'rotationStyle', 'currentCostume']) {
    if (a[prop] !== b[prop]) {
      details.push({ type: 'property', key: prop, from: a[prop], to: b[prop] });
    }
  }

  // Costumes
  const costA = (a.costumes || []).map(c => c.name);
  const costB = (b.costumes || []).map(c => c.name);
  const costAdded = costB.filter(c => !costA.includes(c));
  const costRemoved = costA.filter(c => !costB.includes(c));
  if (costAdded.length) details.push({ type: 'costumes', action: 'added', items: costAdded });
  if (costRemoved.length) details.push({ type: 'costumes', action: 'removed', items: costRemoved });

  // Sounds
  const sndA = (a.sounds || []).map(s => s.name);
  const sndB = (b.sounds || []).map(s => s.name);
  const sndAdded = sndB.filter(s => !sndA.includes(s));
  const sndRemoved = sndA.filter(s => !sndB.includes(s));
  if (sndAdded.length) details.push({ type: 'sounds', action: 'added', items: sndAdded });
  if (sndRemoved.length) details.push({ type: 'sounds', action: 'removed', items: sndRemoved });

  // Variables
  const varsA = Object.entries(a.variables || {}).map(([id, v]) => ({ id, name: v[0], value: v[1] }));
  const varsB = Object.entries(b.variables || {}).map(([id, v]) => ({ id, name: v[0], value: v[1] }));
  for (const vb of varsB) {
    const va = varsA.find(v => v.id === vb.id);
    if (!va) {
      details.push({ type: 'variable', action: 'added', name: vb.name, value: vb.value });
    } else if (va.name !== vb.name || String(va.value) !== String(vb.value)) {
      details.push({ type: 'variable', action: 'modified', name: va.name, from: va, to: vb });
    }
  }
  for (const va of varsA) {
    if (!varsB.find(v => v.id === va.id)) {
      details.push({ type: 'variable', action: 'removed', name: va.name });
    }
  }

  // Blocks count comparison
  const blockCountA = Object.values(a.blocks || {}).filter(blk => typeof blk === 'object').length;
  const blockCountB = Object.values(b.blocks || {}).filter(blk => typeof blk === 'object').length;
  if (blockCountA !== blockCountB) {
    details.push({ type: 'blocks', from: blockCountA, to: blockCountB });
  }

  // Script-level diff using pseudocode
  const scriptsA = extractScriptTexts(a);
  const scriptsB = extractScriptTexts(b);
  const scriptDiffs = diffScriptLists(scriptsA, scriptsB);
  if (scriptDiffs.length > 0) {
    details.push({ type: 'scripts', diffs: scriptDiffs });
  }

  return details;
}

function extractScriptTexts(target) {
  const blocks = target.blocks || {};
  const scripts = [];

  for (const [id, block] of Object.entries(blocks)) {
    if (typeof block !== 'object' || !block.topLevel) continue;
    if (!HAT_OPCODES.has(block.opcode)) continue;

    const lines = [];
    let current = id;
    while (current) {
      const b = blocks[current];
      if (!b) break;
      lines.push(blockToText(current, blocks));
      current = b.next;
    }
    scripts.push(lines.join('\n'));
  }

  return scripts;
}

function diffScriptLists(scriptsA, scriptsB) {
  const diffs = [];
  const matchedB = new Set();

  for (const sa of scriptsA) {
    let bestMatch = -1;
    let bestScore = 0;
    for (let i = 0; i < scriptsB.length; i++) {
      if (matchedB.has(i)) continue;
      const score = similarity(sa, scriptsB[i]);
      if (score > bestScore) { bestScore = score; bestMatch = i; }
    }

    if (bestMatch >= 0 && bestScore > 0.3) {
      matchedB.add(bestMatch);
      if (bestScore < 1.0) {
        diffs.push({ action: 'modified', before: sa, after: scriptsB[bestMatch] });
      }
    } else {
      diffs.push({ action: 'removed', content: sa });
    }
  }

  for (let i = 0; i < scriptsB.length; i++) {
    if (!matchedB.has(i)) {
      diffs.push({ action: 'added', content: scriptsB[i] });
    }
  }

  return diffs;
}

function similarity(a, b) {
  if (a === b) return 1.0;
  const linesA = a.split('\n');
  const linesB = b.split('\n');
  const setA = new Set(linesA);
  const setB = new Set(linesB);
  const intersection = [...setA].filter(x => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 1.0 : intersection / union;
}
