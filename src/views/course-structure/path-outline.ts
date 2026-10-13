import type { CourseStructureGraph, CourseStructureNode } from '@/service/api/course-structure';

type Edge = CourseStructureGraph['edges'][number];
export interface PathOutlineRow {
  key: string;
  kind: 'node' | 'branch' | 'reference' | 'boundary' | 'condition';
  ancestors: string[];
  node?: CourseStructureNode;
  targetId?: string;
  edge?: Edge;
  label?: string;
  merge?: boolean;
}
export interface PathOutline { supported: boolean; reason: string; rows: PathOutlineRow[] }

/** 按真实有向边组织浏览结构；不以课包的列表序号推断执行顺序。 */
export function buildPathOutline(nodes: CourseStructureNode[], graph?: CourseStructureGraph): PathOutline {
  const fallback = (reason: string): PathOutline => ({ supported: false, reason, rows: [] });
  if (!nodes.length || !graph?.edges.length) return fallback('缺少完整连接信息');
  if (nodes.length > 400 || graph.edges.length > 1200) return fallback('节点或连接数量较多');
  const known = new Map(nodes.map(node => [String(node.nodeId), node]));
  if (known.size !== nodes.length) return fallback('存在重复节点编号');
  const ids = new Set(known.keys());
  const outgoing = new Map<string, Array<{ edge: Edge; index: number }>>();
  const incoming = new Map<string, number>();
  graph.edges.forEach((edge, index) => {
    const from = String(edge.sourceNodeId), to = String(edge.targetNodeId);
    ids.add(from); ids.add(to);
    const list = outgoing.get(from) || [];
    list.push({ edge, index }); outgoing.set(from, list);
    incoming.set(to, (incoming.get(to) || 0) + 1);
  });
  if (ids.size > 450) return fallback('连接中的节点数量较多');
  for (const id of ids) {
    if (!known.has(id) && incoming.get(id) && outgoing.get(id)?.length) return fallback('部分中间节点缺少内容信息');
  }
  // 有向无环图才进入嵌套展示；循环和多入口的执行含义交给原连接列表。
  const roots = [...ids].filter(id => !incoming.get(id));
  if (roots.length !== 1) return fallback('包含多个入口、独立节点或循环');
  const degree = new Map(incoming), order: string[] = [], queue = [...roots];
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i]; order.push(id);
    for (const { edge } of outgoing.get(id) || []) {
      const next = String(edge.targetNodeId);
      degree.set(next, (degree.get(next) || 0) - 1);
      if (!degree.get(next)) queue.push(next);
    }
  }
  if (order.length !== ids.size) return fallback('包含循环或无法连续展开的连接');
  // 所有出口连接到虚拟终点，寻找各分支必经的最近共同汇合点。
  const end = '__outline_end__';
  const post = new Map<string, Set<string>>([[end, new Set([end])]]);
  for (const id of [...order].reverse()) {
    const successors = (outgoing.get(id) || []).map(item => String(item.edge.targetNodeId));
    if (!successors.length) successors.push(end);
    const first = post.get(successors[0])!;
    const intersection = new Set([...first].filter(value => successors.every(next => post.get(next)!.has(value))));
    intersection.add(id); post.set(id, intersection);
  }
  const rank = new Map([...order, end].map((id, index) => [id, index]));
  const visited = new Set<string>(), rows: PathOutlineRow[] = [];
  const emittedEdges = new Set<number>();
  function row(value: Omit<PathOutlineRow, 'key'>, key = `row:${rows.length}`) { rows.push({ ...value, key }); }
  function walk(start: string, stop: string, ancestors: string[]) {
    if (ancestors.length > 5) throw new Error('分支嵌套层级较深');
    let id = start;
    while (id !== stop && id !== end) {
      if (visited.has(id)) {
        row({ kind: 'reference', targetId: id, node: known.get(id), ancestors, label: '转至' });
        return;
      }
      visited.add(id);
      const edges = outgoing.get(id) || [];
      const node = known.get(id);
      row({ kind: node ? 'node' : 'boundary', node, targetId: id, ancestors,
        label: node ? undefined : incoming.get(id) ? '路径终点' : '路径入口', merge: (incoming.get(id) || 0) > 1 });
      if (!edges.length) return;
      if (edges.length === 1) {
        const { edge, index } = edges[0]; emittedEdges.add(index);
        // 单一路径的恒真边无需逐条展示；其他条件仍保留。
        const script = edge.conditionCodeScript?.trim();
        if (script && !['1 === 1', 'true'].includes(script)) row({ kind: 'condition', edge, ancestors });
        id = String(edge.targetNodeId);
      } else {
        if (edges.length > 8) throw new Error('同一节点的分支数量较多');
        const common = [...post.get(id)!].filter(value => value !== id).sort((a, b) => rank.get(a)! - rank.get(b)!)[0] || end;
        for (const { edge, index } of edges) {
          emittedEdges.add(index);
          const key = `branch:${index}`;
          row({ kind: 'branch', edge, ancestors }, key);
          walk(String(edge.targetNodeId), common, [...ancestors, key]);
          // 无内容的终点只在收束后显示一次，避免每条分支重复提示“汇合至终点”。
          if (known.has(common)) row({ kind: 'reference', targetId: common, node: known.get(common), ancestors: [...ancestors, key], label: '汇合至' });
        }
        id = common;
      }
    }
  }
  try { walk(roots[0], end, []); }
  catch (error) { return fallback((error as Error).message); }
  if (visited.size !== ids.size || emittedEdges.size !== graph.edges.length) return fallback('存在无法完整归入分支的节点或连接');
  return { supported: true, reason: '', rows };
}
