import assert from 'node:assert/strict';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createConditionRecordStore } from './course-condition-records.js';

const fixture = (script = 'customCheck()') => ({
  status: 'ready', course: { subjectId: 17, unitId: 101, unitName: '课程', chapterId: 201, chapterName: '路径', zipMd5: 'version1' },
  nodes: [{ nodeId: 1, nodeName: '起点' }, { nodeId: 2, nodeName: '终点' }],
  graph: { edges: [{ sourceNodeId: 1, targetNodeId: 2, name: '分支', conditionCodeScript: script, listenVars: ['b', 'a'] }] }
});
test('重复打开去重，原码、监听变量和多课程位置均持久保留', () => {
  const dir = mkdtempSync(join(tmpdir(), 'course-conditions-'));
  let db;
  try {
    const file = join(dir, 'records.db');
    db = new Database(file);
    let store = createConditionRecordStore(db);
    store.recordStructure(fixture());
    const first = store.list()[0].first_seen_at;
    const repeated = fixture();
    repeated.graph.edges[0].listenVars = ['a', 'b', 'a'];
    store.recordStructure(repeated);
    const other = fixture(); other.course.unitId = 102;
    store.recordStructure(other);
    assert.equal(store.list().length, 1);
    assert.equal(store.list()[0].locations.length, 2);
    db.close(); db = new Database(file); store = createConditionRecordStore(db);
    const record = store.list()[0];
    assert.equal(record.script, 'customCheck()');
    assert.deepEqual(record.listenVars, ['a', 'b']);
    assert.equal(record.first_seen_at, first);
    assert.equal(record.locations[0].sourceNodeName, '起点');
    assert.equal(record.locations[0].targetNodeName, '终点');
    assert.ok(record.last_seen_at);
  } finally { db?.close(); rmSync(dir, { recursive: true, force: true }); }
});
test('扫描整条路径，记录无法识别和未完整释义，跳过已支持的普通条件', () => {
  const db = new Database(':memory:');
  try {
    const store = createConditionRecordStore(db);
    const value = fixture('1 === 1');
    value.graph.edges.push({ ...value.graph.edges[0], sourceNodeId: 3, conditionCodeScript: 'newRule()' });
    store.recordStructure(value);
    store.recordStructure(fixture('UserOrderGrade >= 5 && UserOrderGrade <= 9'));
    store.recordStructure(fixture('UnmappedVariable === 1'));
    store.recordStructure({ status: 'error' });
    const records = store.list();
    assert.equal(records.length, 3);
    assert.equal(records.filter(item => item.reason === 'unsupported').length, 1);
    assert.equal(records.filter(item => item.reason === 'partial').length, 2);
    assert.equal(records.find(item => item.script === 'newRule()').locations[0].sourceNodeId, 3);
  } finally { db.close(); }
});
test('新增规则后重验历史记录标记完成，保留历史与位置，规则退化时重新待处理', () => {
  const db = new Database(':memory:');
  try {
    let store = createConditionRecordStore(db);
    store.recordStructure(fixture());
    store = createConditionRecordStore(db, () => ({ text: '新的中文说明', translated: true, notes: [] }));
    assert.equal(store.recheck(), 1);
    assert.equal(store.list().length, 0);
    const resolved = store.list({ all: true })[0];
    assert.equal(resolved.status, 'resolved');
    assert.equal(resolved.description, '新的中文说明');
    assert.ok(resolved.resolved_at);
    assert.equal(resolved.locations.length, 1);
    store = createConditionRecordStore(db);
    store.recheck();
    assert.equal(store.list()[0].status, 'pending');
    assert.equal(store.list()[0].resolved_at, null);
  } finally { db.close(); }
});
test('脚本只存储和解析，不执行；事务失败不留下半条记录', () => {
  const db = new Database(':memory:');
  try {
    const store = createConditionRecordStore(db);
    const script = "globalThis.conditionRecordTest = true; throw new Error('execute')";
    store.recordStructure(fixture(script));
    assert.equal(globalThis.conditionRecordTest, undefined);
    assert.equal(store.list()[0].script, script);
    db.exec("CREATE TRIGGER fail_location BEFORE INSERT ON course_condition_locations BEGIN SELECT RAISE(ABORT, 'test write failure'); END");
    assert.throws(() => store.recordStructure(fixture('anotherUnknown()')), /test write failure/);
    assert.equal(store.list().length, 1);
  } finally { db.close(); }
});
