import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

// 执行页面实际的切换函数，隔离接口和路由，验证异步期间保留旧内容及提交时机。
const page = await readFile(new URL('./index.vue', import.meta.url), 'utf8');
const script = page.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1];
const ast = ts.createSourceFile('page.ts', script, ts.ScriptTarget.Latest, true);
const names = new Set(['loadStructure', 'retryStructure', 'switchWorkspaceChapter', 'getCodePreviewKey', 'getCodePreviewUrl']);
const functions = ast.statements.filter(item => ts.isFunctionDeclaration(item) && names.has(item.name?.text)).map(item => item.getText(ast)).join('\n');
const compiled = ts.transpileModule(functions, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const ref = value => ({ value });
const response = id => ({ status: 'ready', course: { chapterId: id, zipMd5: 'md5' }, source: { fromCache: true } });
function harness(fetch) {
  const replaced = [], old = response(1);
  const scope = {
    canView: ref(true), loading: ref(false), selectionVersion: 0, chapterId: ref(1),
    chapters: ref([{ id: 1, name: '原路径', hasCourseware: true }, { id: 2, name: '新路径', hasCourseware: true }, { id: 3, name: '无课件', hasCourseware: false }]),
    subjectId: ref(19), unitId: ref(100), pendingChapterId: ref(null), failedChapterId: ref(null), operationError: ref(''),
    metaError: ref(''), metaRequest: 0, checking: ref(false), fetchCourseStructureUnit: fetch,
    committingLoadedChapter: false, selectedNodeId: ref(101), pathFilter: ref('questions'), preferPathList: ref(true),
    expandedResources: ref({ old: true }), codePreviewStates: ref({}), codeDiffCache: new Map(),
    structure: ref(old), filterDrawerVisible: ref(false), courseMeta: ref(null), updateAvailable: ref(false),
    router: { replace: value => { replaced.push(value); return Promise.resolve(); } }, route: { query: { extra: 'keep' } }
  };
  const api = new Function(...Object.keys(scope), `${compiled}; return {loadStructure, retryStructure, switchWorkspaceChapter, getCodePreviewKey, invalidate() { selectionVersion++; loading.value=false; pendingChapterId.value=null; }};`)(...Object.values(scope));
  return { scope, api, old, replaced };
}
test('选择路径即请求，完成前保留当前工作区，成功后提交路径并更新刷新地址', async () => {
  let complete; const calls = [];
  const h = harness(query => { calls.push(query); return new Promise(resolve => { complete = resolve; }); });
  const task = h.api.loadStructure(false, 2);
  assert.equal(h.scope.structure.value, h.old);
  assert.equal(h.scope.chapterId.value, 1);
  assert.equal(h.scope.pendingChapterId.value, 2);
  assert.equal(h.scope.loading.value, true);
  complete({ data: response(2) }); await task;
  assert.equal(h.scope.chapterId.value, 2);
  assert.equal(h.scope.structure.value.course.chapterId, 2);
  assert.equal(h.scope.loading.value, false);
  assert.equal(h.scope.pathFilter.value, 'all');
  assert.equal(h.scope.pendingChapterId.value, null);
  assert.deepEqual(calls, [{ subjectId: 19, unitId: 100, chapterId: 2, forceRefresh: false }]);
  assert.equal(h.replaced[0].query.chapterId, '2');
  assert.equal(h.replaced[0].query.extra, 'keep');
});
test('切换失败不丢旧内容，重试请求失败的目标路径', async () => {
  let fail = true; const ids = [];
  const h = harness(async query => { ids.push(query.chapterId); return fail ? { data: { status: 'error', error: { message: '超时' } } } : { data: response(2) }; });
  await h.api.loadStructure(false, 2);
  assert.equal(h.scope.structure.value, h.old);
  assert.equal(h.scope.chapterId.value, 1);
  assert.equal(h.scope.failedChapterId.value, 2);
  assert.match(h.scope.operationError.value, /仍显示原路径/);
  fail = false; await h.api.retryStructure();
  assert.deepEqual(ids, [2, 2]);
  assert.equal(h.scope.chapterId.value, 2);
});
test('更换课程后旧请求无权提交，接口返回错误路径也不覆盖旧路径', async () => {
  let complete;
  const h = harness(() => new Promise(resolve => { complete = resolve; }));
  const task = h.api.loadStructure(false, 2);
  h.api.invalidate(); complete({ data: response(2) }); await task;
  assert.equal(h.scope.structure.value, h.old);
  assert.equal(h.scope.chapterId.value, 1);
  assert.equal(h.replaced.length, 0);
  const wrong = harness(async () => ({ data: response(9) }));
  await wrong.api.loadStructure(false, 2);
  assert.equal(wrong.scope.structure.value, wrong.old);
  assert.match(wrong.scope.operationError.value, /返回的路径/);
});
test('没有课件的路径不发送请求；相同题号的不同代码地址不会串缓存', async () => {
  let calls = 0;
  const h = harness(async () => { calls++; return { data: response(2) }; });
  await h.api.loadStructure(false, 3); assert.equal(calls, 0);
  const q = { questionId: 1, projectUrl: 'a.zip', defaultOpenFile: 'a.py' };
  assert.notEqual(h.api.getCodePreviewKey(q, 'project'), h.api.getCodePreviewKey({ ...q, projectUrl: 'b.zip' }, 'project'));
  assert.notEqual(h.api.getCodePreviewKey(q, 'project'), h.api.getCodePreviewKey({ ...q, defaultOpenFile: 'b.py' }, 'project'));
});
