import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('./path-outline.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { buildPathOutline: build } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const nodes = ids => ids.map(id => ({ nodeId: id, nodeName: `节点${id}`, sequenceNo: String(id), kind: 'video', boards: [], videos: [] }));
const edge = (a, b, condition = '1 === 1') => ({ sourceNodeId: a, targetNodeId: b, name: '兜底', listenVars: ['default'], conditionCodeScript: condition });
const graph = edges => ({ edges });

test('顺序由真实连接确定，不使用列表序号，边界节点和单边条件保留', () => {
  const result = build(nodes([3, 2, 1]), graph([edge(0, 1), edge(1, 2, 'duration > 1'), edge(2, 3), edge(3, 4)]));
  assert.equal(result.supported, true);
  assert.deepEqual(result.rows.filter(row => row.kind === 'node').map(row => row.node.nodeId), [1, 2, 3]);
  assert.equal(result.rows.filter(row => row.kind === 'condition').length, 1);
  assert.equal(result.rows.filter(row => row.kind === 'boundary').length, 2);
});
test('菱形分支在最近公共汇合点收束，后续内容只呈现一次', () => {
  const result = build(nodes([1, 2, 3, 4, 5]), graph([edge(1, 2, 'x > 1'), edge(1, 3), edge(2, 4), edge(3, 4), edge(4, 5)]));
  assert.equal(result.supported, true);
  assert.equal(result.rows.filter(row => row.kind === 'branch').length, 2);
  assert.equal(result.rows.filter(row => row.kind === 'reference' && row.targetId === '4').length, 2);
  const join = result.rows.find(row => row.kind === 'node' && row.node.nodeId === 4);
  assert.equal(join.merge, true);
  assert.deepEqual(join.ancestors, []);
  assert.equal(result.rows.filter(row => row.kind === 'node').length, 5);
});
test('交叉分支共用内容用引用定位，节点既不丢失也不重复，祖先可用于自动展开', () => {
  const result = build(nodes([1, 2, 3, 4, 5]), graph([edge(0, 2), edge(0, 3), edge(0, 1), edge(1, 2), edge(1, 3), edge(2, 4), edge(3, 4), edge(4, 5)]));
  assert.equal(result.supported, true);
  const normal = result.rows.filter(row => row.kind === 'node');
  assert.equal(new Set(normal.map(row => row.node.nodeId)).size, 5);
  assert.equal(normal.length, 5);
  assert.equal(result.rows.filter(row => row.kind === 'reference' && row.label === '转至').length, 2);
  assert.equal(normal.find(row => row.node.nodeId === 2).ancestors.length, 1);
});
test('嵌套分支、直达汇合点和多出口保留结构', () => {
  const result = build(nodes([1, 2, 3, 4, 5, 6]), graph([edge(1, 2), edge(1, 6), edge(2, 3), edge(2, 4), edge(3, 5), edge(4, 5), edge(5, 6)]));
  assert.equal(result.supported, true);
  assert.equal(result.rows.find(row => row.kind === 'node' && row.node.nodeId === 3).ancestors.length, 2);
  assert.equal(result.rows.find(row => row.kind === 'node' && row.node.nodeId === 6).ancestors.length, 0);
  assert.equal(build(nodes([1, 2, 3]), graph([edge(1, 2), edge(1, 3)])).supported, true);
});
test('循环、缺失中间节点、断开节点、多入口和无图信息明确回退原列表', () => {
  for (const [items, edges] of [
    [nodes([1, 2]), [edge(1, 2), edge(2, 1)]],
    [nodes([1, 3]), [edge(1, 2), edge(2, 3)]],
    [nodes([1, 2, 3]), [edge(1, 2)]],
    [nodes([1, 2, 3]), [edge(1, 3), edge(2, 3)]],
    [nodes([1]), []],
  ]) {
    const result = build(items, graph(edges));
    assert.equal(result.supported, false);
    assert.ok(result.reason);
    assert.deepEqual(result.rows, []);
  }
});
test('过大的图或过宽分支回退，不生成不完整的局部分支', () => {
  assert.equal(build(nodes(Array.from({ length: 401 }, (_, i) => i)), graph([edge(0, 1)])).supported, false);
  const ids = Array.from({ length: 10 }, (_, i) => i);
  assert.equal(build(nodes(ids), graph(ids.slice(1).map(id => edge(0, id)))).supported, false);
});
