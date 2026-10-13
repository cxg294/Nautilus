import db from '../db/index.js';

export function recordAdminAction(actor, action, target, before = null, after = null) {
  db.prepare(`INSERT INTO admin_audit_log
    (actor_id, actor_name, action, target_type, target_id, target_name, before_json, after_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
    actor.id, actor.username, action, target.type, String(target.id), target.name,
    before === null ? null : JSON.stringify(before), after === null ? null : JSON.stringify(after)
  );
}

export function listAdminActions(limit = 30) {
  return db.prepare('SELECT * FROM admin_audit_log ORDER BY id DESC LIMIT ?')
    .all(Math.min(Math.max(Math.trunc(Number(limit)) || 30, 1), 100))
    .map(({ before_json, after_json, ...row }) => ({
      ...row, before: before_json ? JSON.parse(before_json) : null, after: after_json ? JSON.parse(after_json) : null
    }));
}
