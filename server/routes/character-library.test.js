import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import express from 'express';
import { createCharacterLibraryRouter } from './character-library.js';

const db = new Database(':memory:');
db.exec(
  "CREATE TABLE users (id INTEGER PRIMARY KEY); CREATE TABLE permissions (key TEXT PRIMARY KEY, description TEXT); CREATE TABLE role_permissions (role TEXT, permission_key TEXT, UNIQUE(role,permission_key)); INSERT INTO users VALUES(1),(2); INSERT INTO role_permissions VALUES('owner','module:sequence-player:access');"
);
db.exec(await fs.readFile(new URL('../db/migrations/008_sequence_projects.sql', import.meta.url), 'utf8'));
db.exec(await fs.readFile(new URL('../db/migrations/020_character_library.sql', import.meta.url), 'utf8'));
const presets = JSON.parse(await fs.readFile(new URL('../../shared/character-presets.json', import.meta.url), 'utf8'));
const previous = structuredClone(presets[0]);
previous.ttsConfig = {
  ...previous.ttsConfig,
  voiceId: 'cosyvoice-v3.5-flash-test',
  model: 'saved-test-model',
  rate: 1.2
};
db.prepare('INSERT INTO sequence_projects (id,user_id,characters) VALUES(?,?,?)').run(
  'test',
  1,
  JSON.stringify([previous])
);
const assetRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'character-assets-'));
const app = express();
app.use(express.json());
app.use((req, res, next) => {
  req.user = { id: Number(req.headers['x-test-user'] || 1) };
  next();
});
app.use('/api/character-library', createCharacterLibraryRouter({ db, assetRoot }));
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}/api/character-library`;
async function call(method = '', suffix = '', data, user = 1) {
  const r = await fetch(base + suffix, {
    method: method || 'GET',
    headers: { 'Content-Type': 'application/json', 'x-test-user': String(user) },
    ...(data ? { body: JSON.stringify(data) } : {})
  });
  return { status: r.status, ...(await r.json()) };
}
after(async () => {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  db.close();
  await fs.rm(assetRoot, { recursive: true, force: true });
});

test('新人物库继承本用户已有声音设置，不选择其他用户或任意同名音色', async () => {
  const one = await call(),
    two = await call('GET', '', undefined, 2);
  assert.equal(one.data.length, 6);
  assert.equal(one.data[0].character.ttsConfig.voiceId, 'cosyvoice-v3.5-flash-test');
  assert.equal(one.data[0].character.ttsConfig.rate, 1.2);
  assert.equal(two.data[0].character.ttsConfig.voiceId, '');
  assert.equal(
    db.prepare("SELECT COUNT(*) n FROM role_permissions WHERE permission_key='module:character-library:access'").get()
      .n,
    1
  );
});
test('持久化、版本冲突、归档恢复与用户隔离', async () => {
  const created = await call('POST', '', { character: presets[1] });
  assert.equal(created.code, '0000');
  const character = created.data.character;
  character.poses[0].layout.x = 33;
  const saved = await call('PUT', '/' + created.data.id, { character, revision: 1 });
  assert.equal(saved.data.revision, 2);
  assert.equal((await call('PUT', '/' + created.data.id, { character, revision: 1 })).status, 409);
  assert.equal((await call('PUT', '/' + created.data.id, { character, revision: 2 }, 2)).status, 404);
  const archived = await call('PATCH', '/' + created.data.id, { archived: true, revision: 2 });
  assert.equal(archived.data.archived, true);
  const restored = await call('PATCH', '/' + created.data.id, { archived: false, revision: 3 });
  assert.equal(restored.data.revision, 4);
  const found = (await call()).data.find(r => r.id === created.data.id);
  assert.equal(found.character.poses[0].layout.x, 33);
  assert.equal(
    JSON.parse(db.prepare("SELECT characters FROM sequence_projects WHERE id='test'").get().characters)[0].poses[0]
      .layout.x,
    previous.poses[0].layout.x
  );
});
test('拒绝非法布局、远程图片、路径穿越、其他用户的自定义图片', async () => {
  for (const modify of [
    c => (c.poses[0].layout.height = 0),
    c => (c.poses[0].layout.x = '12'),
    c => (c.poses[0].imageUrl = 'https://example.com/a.png'),
    c => (c.poses[0].imageUrl = '/characters/%2e%2e/a.png'),
    c => (c.poses[0].imageUrl = '/api/character-library/assets/11111111-1111-1111-1111-111111111111.webp'),
    c => (c.ttsConfig.rate = 3)
  ]) {
    const character = structuredClone(presets[0]);
    modify(character);
    assert.equal((await call('POST', '', { character })).status, 400);
  }
});
