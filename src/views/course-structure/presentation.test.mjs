import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('./presentation.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { collectResources, contentCounts, nodeConnections, questionResources } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const question = { questionId: 1, name: '题目一', resourceRefs: [{ url: 'a.png', label: '任务图', kind: 'picture' }], taskTargets: [] };
const board = { objectId: 10, checkpointId: 100, objectName: '挑战', resourceRefs: [{ url: 'a.png', label: '共用图', kind: 'picture' }], checkpoint: { questions: [question] } };
const node = { nodeId: 1, nodeName: '分支入口', sequenceNo: '1', videos: [], boards: [board], objectUrls: ['a.png', 'a.png', ...Array.from({ length: 15 }, (_, i) => `${i}.mp3`)] };

test('跨节点、关卡与题目素材按 URL 去重且保留归属，超过 12 条不丢失', () => {
  const resources = collectResources(node);
  assert.equal(resources.length, 16);
  assert.equal(resources.find(item => item.url === 'a.png').sources.length, 3);
  assert.ok(resources.some(item => item.url === '14.mp3'));
});
test('题目重复资源只展示一次，缺省资源仍使用任务内容', () => {
  assert.equal(questionResources({ ...question, resourceRefs: [...question.resourceRefs, ...question.resourceRefs] }).length, 1);
  assert.equal(questionResources({ ...question, resourceRefs: [], taskTargets: [{ key: 'audio', name: '提示', value: 'hint.mp3' }] })[0].url, 'hint.mp3');
});
test('关卡和题目分开计数，同一 ID 复用不重复累加', () => {
  assert.deepEqual(contentCounts([node, { ...node, nodeId: 2 }]), { nodes: 2, videos: 0, checkpoints: 1, questions: 1 });
  assert.deepEqual(contentCounts([]), { nodes: 0, videos: 0, checkpoints: 0, questions: 0 });
});
test('前后连接保留分支、条件、循环以及没有预览的边界节点', () => {
  const next = { ...node, nodeId: 2, nodeName: '下一步', sequenceNo: '2' };
  const edges = [
    { sourceNodeId: 0, targetNodeId: 1, name: '开始' },
    { sourceNodeId: 1, targetNodeId: 2, name: '分支A', conditionCodeScript: 'return level > 3;', listenVars: ['level'] },
    { sourceNodeId: 1, targetNodeId: 99, name: '结束' },
    { sourceNodeId: 2, targetNodeId: 1, name: '返回' },
  ];
  const connections = nodeConnections(node, [node, next], { edges });
  assert.equal(connections.length, 4);
  assert.equal(connections.filter(item => item.direction === '后续').length, 2);
  assert.equal(connections[1].target.nodeId, 2);
  assert.equal(connections[1].conditionCodeScript, 'return level > 3;');
  assert.equal(connections[2].target, undefined);
  assert.equal(connections[2].targetId, 99);
});


test('选项素材也进入去重清单，保持超过 12 项的完整数量', () => {
  const value = { ...question, options: [{ index: 0, resourceUrls: ['a.png', ...Array.from({ length: 20 }, (_, i) => `${i}.jpg`)] }] };
  assert.equal(questionResources(value).length, 21);
});
