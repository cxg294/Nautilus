import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import config from '../config/env.js';
import { runHetaoCliJson } from './htcli.js';

let tempDir;
let db;
let assets;
let fixture;
const request = { subjectId: 17, templateId: 9021 };
const refresh = () => assets.getCourseTemplateDetails({ templates: [request] });
const cache = () => assets.getCourseTemplateCache(request);
const saveFixture = () => writeFile(path.join(tempDir, 'responses.json'), JSON.stringify(fixture));

before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), 'nautilus-course-assets-test-'));
  config.dbPath = path.join(tempDir, 'test.db');
  config.htcli.bin = path.join(tempDir, 'hetao-cli');
  config.htcli.profile = '';
  // 模拟 CLI 以 0 退出但返回业务错误，以及新版模板树的字段。
  await writeFile(config.htcli.bin, `#!${process.execPath}
const fs = require('node:fs');
const path = require('node:path');
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'responses.json'), 'utf8'));
const args = process.argv.slice(2);
const params = args.includes('--params') ? JSON.parse(args[args.indexOf('--params') + 1]) : {};
let response;
if (args[0] === 'auth') response = fixture.auth;
else if (args.slice(0, 3).join(' ') === 'course template tree' && params.subjectId === 17 && params.templateId === 9021) response = fixture.tree;
else if (args.slice(0, 3).join(' ') === 'course unit detail' && params.subjectId === 17) response = fixture.units[params.unitId];
console.log(JSON.stringify(response || {code: 400, message: 'Unexpected command or parameters'}));
`, { mode: 0o755 });
  assets = await import('./course-assets.js');
  db = (await import('../db/index.js')).default;
  cache();
});

beforeEach(async () => {
  db.prepare('DELETE FROM course_asset_template_cache').run();
  fixture = {
    auth: { identity: 'user', tokenStatus: 'valid' },
    tree: {
      code: 200,
      data: {
        templateId: 9021,
        name: '课程模板',
        levels: [{ level: 1, name: '第一周', units: [
          { unitId: 127376, unitName: '家长准备课', name: '内部名称', sequence: 0 },
          { unitId: 166905, unitName: '项目01：路径规划', sequence: 1 },
          { unitId: 162982, unitName: 'AI 伙伴机器人-搭建课', sequence: 2 },
        ] }],
      },
    },
    units: {
      127376: { errcode: 0, data: [{ id: 127376, name: '', unitContentType: 'STAGE' }] },
      166905: { errcode: 0, data: [{ id: 166905, unitContentType: 'SOFT_PROJECT', parts: [{ chapters: [
        { id: 101, itemType: 'LIVE_STREAMING', name: '直播互动', item: { arrangementId: 15938, pptInfo: { url: '//example.com/lesson.pdf' } } },
        { id: 102, itemType: 'LEARNING_LINK', name: '路径规划', item: { arrangementId: 16238, zipUrl: 'https://example.com/course.zip', zipMd5: 'v1' } },
        { id: 103, itemType: 'LEARNING_LINK', name: '补充路径', item: { arrangementId: 16239, normalZipList: [{ type: 'Cocos', zipUrl: 'https://example.com/extra.zip', zipMd5: 'extra1' }] } },
      ] }] }] },
      162982: { errcode: 0, data: [{ id: 162982, unitContentType: 'HARDWARE_PROJECT' }] },
    },
  };
  await saveFixture();
});

after(async () => {
  db?.close();
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
});

test('刷新读取模板树的新 Unit ID、展示名称、课序、课程类型及路径资料，并保存缓存', async () => {
  const result = await refresh();
  const template = result.templates[0];
  assert.equal(template.error, undefined);
  assert.equal(template.id, 9021);
  assert.equal(template.source, 'upstream');
  const units = template.levels[0].units;
  assert.deepEqual(units.map(unit => unit.unitId), [127376, 166905, 162982]);
  assert.deepEqual(units.map(unit => unit.unitNo), [0, 1, 2]);
  assert.deepEqual(units.map(unit => unit.contentType), ['STAGE', 'SOFT_PROJECT', 'HARDWARE_PROJECT']);
  assert.equal(units[0].title, '家长准备课');
  assert.equal(units[1].livePathId, 15938);
  assert.equal(units[1].practicePathId, 16238);
  assert.equal(units[1].materialUrl, 'https://example.com/lesson.pdf');
  assert.equal(cache().syncedAt, template.syncedAt);
  assert.deepEqual(cache().template.levels, template.levels);
});

test('模板已提供类型时，Unit 详情中的默认类型不能覆盖它', async () => {
  fixture.tree.data.levels[0].units[2].unitContentType = 'HARDWARE_PROJECT';
  fixture.units[162982].data[0].unitContentType = 'SOFT_PROJECT';
  await saveFixture();
  assert.equal((await refresh()).templates[0].levels[0].units[2].contentType, 'HARDWARE_PROJECT');
});

test('CLI 退出成功仍检查 code / errcode / success，透出真实上游错误并保留缓存', async () => {
  await refresh();
  const saved = cache();
  for (const response of [
    { code: 500, message: "Required request parameter 'id' is not present" },
    { errcode: 401, errmsg: '登录失效' },
    { success: false, msg: '没有权限' },
  ]) {
    fixture.tree = response;
    await saveFixture();
    const result = await refresh();
    assert.equal(result.templates[0].error.reason, 'HTCLI_API_ERROR');
    assert.ok(result.templates[0].error.message.includes(response.message || response.errmsg || response.msg));
    assert.deepEqual(cache(), saved);
  }
});

test('空课表、无效 Unit ID 或错误模板 ID 都不能覆盖已有缓存', async () => {
  await refresh();
  const saved = cache();
  for (const data of [
    {},
    { templateId: 9021, name: '空模板', levels: [{ level: 1, units: [] }] },
    { templateId: 9021, name: '错误 Unit', levels: [{ level: 1, units: [{ unitId: 0 }] }] },
    { ...fixture.tree.data, templateId: 9032 },
  ]) {
    fixture.tree.data = data;
    await saveFixture();
    assert.ok((await refresh()).templates[0].error);
    assert.deepEqual(cache(), saved);
  }
});

test('Unit 资料失败时返回具体原因，整体缓存不被部分结果覆盖', async () => {
  await refresh();
  const saved = cache();
  fixture.units[166905] = { errcode: 403, errmsg: 'Unit 访问被拒绝' };
  await saveFixture();
  const error = (await refresh()).templates[0].error;
  assert.equal(error.reason, 'INCOMPLETE_TEMPLATE_DETAIL');
  assert.match(error.message, /166905.*Unit 访问被拒绝/);
  assert.deepEqual(cache(), saved);
});

test('错误的 Unit 详情不能写入请求的 Unit，缓存仍保留', async () => {
  await refresh();
  const saved = cache();
  fixture.units[166905].data[0].id = 163093;
  await saveFixture();
  assert.equal((await refresh()).templates[0].error.reason, 'INCOMPLETE_TEMPLATE_DETAIL');
  assert.deepEqual(cache(), saved);
});

test('无业务错误码的状态响应以及字符串成功码仍能正常读取', async () => {
  assert.deepEqual((await runHetaoCliJson(['auth', 'status'])).json, fixture.auth);
  fixture.tree.code = '200';
  fixture.units[166905].errcode = '0';
  await saveFixture();
  assert.equal((await refresh()).templates[0].error, undefined);
});


test('保存 Level 业务名称及完整多路径，并保留可用于解析的 Chapter ID', async () => {
  const detail = (await refresh()).templates[0];
  assert.equal(detail.levels[0].name, '第一周');
  const paths = detail.levels[0].units[1].paths;
  assert.deepEqual(paths.map(coursePath => coursePath.chapterId), [101, 102, 103]);
  assert.deepEqual(paths.map(coursePath => coursePath.hasCourseware), [false, true, true]);
  assert.equal(assets.getCourseTemplateCatalog().templates[0].syncedAt, detail.syncedAt);
});

test('静默检查最新版本不改同步时间和缓存；路径课件更新可被检测', async () => {
  await refresh();
  const saved = cache();
  assert.equal((await assets.checkCourseTemplateUpdate(request)).status, 'fresh');
  assert.deepEqual(cache(), saved);
  // 同步会清除检查结果缓存，下一次检查需读取上游。
  await refresh();
  const baseline = cache();
  fixture.units[166905].data[0].parts[0].chapters[2].item.normalZipList[0].zipMd5 = 'extra2';
  await saveFixture();
  assert.equal((await assets.checkCourseTemplateUpdate(request)).status, 'stale');
  assert.deepEqual(cache(), baseline);
  await refresh();
  assert.equal((await assets.checkCourseTemplateUpdate(request)).status, 'fresh');
});

test('检查遇到上游失败不会把旧缓存误报成最新', async () => {
  await refresh();
  const baseline = cache();
  fixture.units[166905] = { errcode: 403, errmsg: 'Unit 无权限' };
  await saveFixture();
  const result = await assets.checkCourseTemplateUpdate(request);
  assert.equal(result.status, 'error');
  assert.deepEqual(cache(), baseline);
});

test('缺少缓存时检查只提示待同步，不自动写入；旧缓存提示升级', async () => {
  await refresh();
  db.prepare('DELETE FROM course_asset_template_cache').run();
  assert.equal((await assets.checkCourseTemplateUpdate(request)).status, 'missing');
  assert.equal(cache().status, 'missing');
  await refresh();
  const old = cache().template;
  delete old.schemaVersion;
  delete old.levels[0].name;
  db.prepare('UPDATE course_asset_template_cache SET template_json = ?').run(JSON.stringify(old));
  assert.equal((await assets.checkCourseTemplateUpdate(request)).status, 'stale');
});


test('网关以 error 字段返回限流时保留明确原因，不误报空数据', async () => {
  fixture.tree = { error: 'cli gateway rate limit exceeded' };
  await saveFixture();
  await assert.rejects(
    runHetaoCliJson(['course', 'template', 'tree', '--params', JSON.stringify(request), '--format', 'json']),
    error => error.reason === 'HTCLI_API_ERROR' && error.message.includes('rate limit exceeded')
  );
});
