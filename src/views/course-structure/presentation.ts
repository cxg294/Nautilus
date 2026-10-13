import type { CourseStructureNode, CourseStructureGraph, CourseStructureQuestion } from '@/service/api/course-structure';

export interface ResourceItem { url: string; label: string; kind: string; sources: string[] }
export function questionResources(question: CourseStructureQuestion) {
  const refs = question.resourceRefs?.length ? question.resourceRefs : (question.taskTargets || [])
    .filter(item => item.value).map(item => ({ url: item.value, label: item.name || item.key, kind: item.key }));
  const optionRefs = (question.options || []).flatMap(option => (option.resourceUrls || []).map(url => ({ url, label: `选项 ${option.index + 1} 素材`, kind: 'option' })));
  return [...new Map([...refs, ...optionRefs].filter(item => item.url).map(item => [item.url, item])).values()];
}

export function collectResources(node: CourseStructureNode | null): ResourceItem[] {
  const resources = new Map<string, ResourceItem>();
  function add(url: string, label: string, kind: string, source: string) {
    if (!url) return;
    const current = resources.get(url);
    if (current) {
      if (!current.sources.includes(source)) current.sources.push(source);
      if (label && current.kind === 'file') { current.label = label; current.kind = kind; }
    } else resources.set(url, { url, label: label || url.split('/').pop() || '素材', kind, sources: [source] });
  }
  node?.objectUrls?.forEach(url => add(url, '', 'file', '节点素材'));
  node?.boards.forEach(board => {
    const owner = `${board.objectName || '关卡'}（${board.checkpointId || board.objectId}）`;
    board.resourceRefs?.forEach(item => add(item.url, item.label, item.kind, owner));
    board.checkpoint?.questions.forEach(question => questionResources(question)
      .forEach(item => add(item.url, item.label, item.kind, `${question.name || '题目'}（${question.questionId}）`)));
  });
  return [...resources.values()];
}

export function contentCounts(nodes: CourseStructureNode[]) {
  const checkpoints = new Set<string>();
  const questions = new Set<number>();
  let videos = 0;
  nodes.forEach(node => {
    videos += node.videos.length;
    node.boards.forEach(board => {
      checkpoints.add(String(board.checkpointId || board.calculusKey || board.objectId));
      board.checkpoint?.questions.forEach(question => questions.add(question.questionId));
    });
  });
  return { nodes: nodes.length, videos, checkpoints: checkpoints.size, questions: questions.size };
}

export function nodeConnections(node: CourseStructureNode | null, nodes: CourseStructureNode[], graph?: CourseStructureGraph) {
  const byId = new Map(nodes.map(item => [String(item.nodeId), item]));
  return (graph?.edges || []).flatMap((edge, index) => {
    const outgoing = String(edge.sourceNodeId) === String(node?.nodeId);
    const incoming = String(edge.targetNodeId) === String(node?.nodeId);
    if (!node || (!outgoing && !incoming)) return [];
    const targetId = outgoing ? edge.targetNodeId : edge.sourceNodeId;
    const target = byId.get(String(targetId));
    return [{ ...edge, key: index, direction: outgoing ? '后续' : '前序', targetId, target,
      targetLabel: target ? `${target.sequenceNo} · ${target.nodeName}` : `节点 ${targetId}` }];
  });
}

export function questionTypeLabel(value: string) {
  return ({ PYTHON: 'Python 编程', CPP: 'C++ 编程', CHOICE: '选择题', DRAG: '拖拽题',
    COMPLETION: '填空题', DEBUG: '调试题', SURVEY: '调查题', CUSTOM: '自定义题' } as Record<string, string>)[value] || '其他题型';
}
