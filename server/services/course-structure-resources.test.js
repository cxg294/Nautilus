import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import config from '../config/env.js';
let tempDir, service, db;
before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'nautilus-structure-resources-'));
  config.dbPath = path.join(tempDir, 'test.db');
  service = await import('./course-structure.js');
  db = (await import('../db/index.js')).default;
});
after(async () => { db?.close(); await rm(tempDir, { recursive: true, force: true }); });
test('解析保留超过 80 项的题目素材', () => {
  const refs = service.normalizeResourceRefs({}, {}, Array.from({ length: 100 }, (_, i) => ({ key: 'picture', name: `素材${i}`, value: `https://example.com/${i}.png` })));
  assert.equal(refs.length, 100);
});
test('选项素材超过 12 项也完整保留', () => {
  const options = service.normalizeQuestionOptions({ options: [{ name: '选项', images: Array.from({ length: 20 }, (_, i) => `https://example.com/${i}.png`) }] });
  assert.equal(options[0].resourceUrls.length, 20);
});
test('旧缓存触及截断上限时标记可能不完整，新版完整缓存不误报', () => {
  const value = { nodes: [{ boards: [{ checkpoint: { questions: [{ resourceRefs: Array(80).fill({ url: 'x' }) }] } }] }] };
  assert.equal(service.hasLegacyResourceTruncation(value), true);
  assert.equal(service.hasLegacyResourceTruncation({ ...value, resourceInventoryVersion: 1 }), false);
  assert.equal(service.hasLegacyResourceTruncation({ nodes: [] }), false);
});
