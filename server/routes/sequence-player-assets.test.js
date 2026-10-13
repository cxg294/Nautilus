import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import sharp from 'sharp';
import { createSequenceAssetRouter } from './sequence-player-assets.js';

test('立绘上传转码、读取和用户隔离；无效图片与超限上传明确拒绝', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nautilus-sequence-assets-'));
  const app = express();
  // 测试夹具提供已认证身份；生产父路由保留 requireAuth / requirePermission。
  app.use((req, _res, next) => {
    req.user = { id: req.headers['x-test-user'] || 'owner' };
    next();
  });
  app.use(createSequenceAssetRouter({ assetRoot: root }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await fs.rm(root, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const upload = async (buffer, name = '角色.png') => {
    const form = new FormData();
    form.append('image', new Blob([buffer]), name);
    return fetch(`${base}/assets`, { method: 'POST', body: form });
  };
  const png = await sharp({
    create: { width: 2000, height: 1000, channels: 4, background: { r: 120, g: 80, b: 200, alpha: 0.5 } }
  })
    .png()
    .toBuffer();
  const uploaded = await upload(png);
  assert.equal(uploaded.status, 200);
  const result = await uploaded.json();
  assert.equal(result.code, '0000');
  const relative = result.data.url.replace('/api/sequence-player', '');
  const response = await fetch(`${base}${relative}`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control'), /private/);
  const metadata = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
  assert.equal(metadata.format, 'webp');
  assert.equal(metadata.width, 1600);
  assert.equal(metadata.height, 800);
  assert.equal(metadata.hasAlpha, true);
  assert.equal((await fetch(`${base}${relative}`, { headers: { 'x-test-user': 'other' } })).status, 404);
  assert.equal((await upload(Buffer.from('<script>invalid</script>'), 'fake.png')).status, 400);
  assert.equal((await upload(Buffer.alloc(8 * 1024 * 1024 + 1))).status, 400);
  assert.equal((await fetch(`${base}/assets/not-a-file.webp`)).status, 400);
  assert.equal((await fs.readdir(path.join(root, 'owner'))).length, 1);
});
