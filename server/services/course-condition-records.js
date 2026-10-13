import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describeCondition } from '../../shared/course-condition-description.js';

const schema = readFileSync(new URL('../db/migrations/018_course_condition_records.sql', import.meta.url), 'utf8');
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** 只写本地记录；不修改课包，也不执行原始条件。可注入数据库与转译器进行隔离测试。 */
export function createConditionRecordStore(db, describe = describeCondition) {
  db.exec(schema);
  const find = db.prepare('SELECT fingerprint FROM course_condition_records WHERE fingerprint = ?');
  const upsert = db.prepare(`INSERT INTO course_condition_records
    (fingerprint, script, listen_vars_json, status, reason, description, notes_json, first_seen_at, last_seen_at, resolved_at)
    VALUES (@fingerprint, @script, @listenVars, @status, @reason, @description, @notes, @now, @now, @resolvedAt)
    ON CONFLICT(fingerprint) DO UPDATE SET status=excluded.status, reason=excluded.reason,
      description=excluded.description, notes_json=excluded.notes_json, last_seen_at=excluded.last_seen_at,
      resolved_at=CASE WHEN excluded.status='resolved' THEN COALESCE(course_condition_records.resolved_at, excluded.resolved_at) ELSE NULL END`);
  const location = db.prepare(`INSERT INTO course_condition_locations
    (fingerprint, location_key, context_json, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(fingerprint, location_key) DO UPDATE SET context_json=excluded.context_json, last_seen_at=excluded.last_seen_at`);
  function assessment(script) {
    const result = describe(script);
    const reason = !result.translated ? 'unsupported' : result.notes.length ? 'partial' : '';
    return { result, reason, status: reason ? 'pending' : 'resolved' };
  }
  const recordStructure = db.transaction(structure => {
    if (structure?.status !== 'ready' || !structure.course) return 0;
    const course = structure.course;
    const nodes = new Map((structure.nodes || []).map(node => [String(node.nodeId), node.nodeName]));
    const now = new Date().toISOString();
    let count = 0;
    for (const edge of structure.graph?.edges || []) {
      const script = typeof edge.conditionCodeScript === 'string' ? edge.conditionCodeScript.trim() : '';
      const listenVars = [...new Set((edge.listenVars || []).map(String))].sort();
      if (!script && !listenVars.length) continue;
      const fingerprint = hash([script, listenVars]);
      const { result, reason, status } = assessment(script);
      if (!reason && !find.get(fingerprint)) continue;
      upsert.run({ fingerprint, script, listenVars: JSON.stringify(listenVars), status, reason,
        description: result.text, notes: JSON.stringify(result.notes), now, resolvedAt: reason ? null : now });
      const context = {
        subjectId: course.subjectId, unitId: course.unitId, unitName: course.unitName,
        chapterId: course.chapterId, chapterName: course.chapterName, zipMd5: course.zipMd5,
        sourceNodeId: edge.sourceNodeId, sourceNodeName: nodes.get(String(edge.sourceNodeId)) || '',
        targetNodeId: edge.targetNodeId, targetNodeName: nodes.get(String(edge.targetNodeId)) || '',
        edgeName: edge.name || '',
      };
      const locationKey = hash([course.subjectId, course.unitId, course.chapterId, edge.sourceNodeId, edge.targetNodeId, edge.name]);
      location.run(fingerprint, locationKey, JSON.stringify(context), now, now);
      count++;
    }
    return count;
  });
  // 用当前代码重验历史原码：即使旧课包已不在缓存中，修复后仍可标记完成。
  const recheck = db.transaction(() => {
    const rows = db.prepare('SELECT fingerprint, script FROM course_condition_records').all();
    const update = db.prepare(`UPDATE course_condition_records SET status=?, reason=?, description=?, notes_json=?,
      resolved_at=CASE WHEN ?='resolved' THEN COALESCE(resolved_at, ?) ELSE NULL END WHERE fingerprint=?`);
    for (const row of rows) {
      const { result, reason, status } = assessment(row.script);
      update.run(status, reason, result.text, JSON.stringify(result.notes), status, new Date().toISOString(), row.fingerprint);
    }
    return rows.length;
  });
  function list({ all = false } = {}) {
    const rows = db.prepare(`SELECT * FROM course_condition_records ${all ? '' : "WHERE status='pending'"} ORDER BY first_seen_at, fingerprint`).all();
    const locations = db.prepare('SELECT * FROM course_condition_locations WHERE fingerprint=? ORDER BY first_seen_at');
    return rows.map(row => ({ ...row, listenVars: JSON.parse(row.listen_vars_json), notes: JSON.parse(row.notes_json),
      listen_vars_json: undefined, notes_json: undefined,
      locations: locations.all(row.fingerprint).map(item => ({ ...JSON.parse(item.context_json), firstSeenAt: item.first_seen_at, lastSeenAt: item.last_seen_at })) }));
  }
  return { recordStructure, recheck, list };
}
