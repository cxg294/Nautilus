/** 使用临时 SQLite 和真实路由验证权限边界，不读取或改动日常账号。 */
import { test, before as beforeSuite, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import express from 'express';
import jwt from 'jsonwebtoken';
import { hashSync } from 'bcryptjs';

const directory = mkdtempSync(path.join(tmpdir(), 'nautilus-access-'));
process.env.NAUTILUS_DB_PATH = path.join(directory, 'test.db');
process.env.JWT_SECRET = 'isolated-nautilus-access-control-test-secret';
const { default: db, runMigrations } = await import('../db/index.js');
runMigrations();
const { syncToolPermissions } = await import('../services/permission-sync.js');
syncToolPermissions();
const { createRefreshToken, findById, assertUserManagement } = await import('../services/user.js');
const { default: auth } = await import('./auth.js');
const { default: users } = await import('./users.js');
const { default: roles } = await import('./roles.js');
const { default: settings } = await import('./system-settings.js');
const { default: analytics } = await import('./analytics.js');
const passwordHash = hashSync('fixture-password', 4);
let server, base, owner, manager, approver, reader, member, pending;

function account(username, role, status = 'active') {
  const result = db.prepare('INSERT INTO users (username, password_hash, role, status, display_name) VALUES (?, ?, ?, ?, ?)')
    .run(username, passwordHash, role, status, username);
  return findById(result.lastInsertRowid);
}
function grant(role, keys) {
  db.prepare('DELETE FROM role_permissions WHERE role = ?').run(role);
  for (const key of keys) db.prepare('INSERT INTO role_permissions (role, permission_key) VALUES (?, ?)').run(role, key);
}
function token(user, extra = {}) {
  return jwt.sign({ id: user.id, username: user.username, role: user.role, version: user.auth_version, ...extra }, process.env.JWT_SECRET, { expiresIn: '5m' });
}
async function call(url, user = owner, method = 'GET', body) {
  const options = { method, headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${typeof user === 'string' ? user : token(user)}` } : {}) } };
  if (method !== 'GET' && body !== undefined) options.body = JSON.stringify(body);
  const response = await fetch(base + url, options);
  return { status: response.status, headers: response.headers, ...await response.json() };
}
const ok = response => { assert.equal(response.code, '0000', response.msg); return response.data; };
const denied = response => assert.equal(response.status, 403, response.msg);

beforeSuite(async () => {
  const app = express();
  app.use(express.json());
  app.use('/auth', auth); app.use('/users', users); app.use('/roles', roles);
  app.use('/settings', settings); app.use('/analytics', analytics);
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(() => {
  db.exec('DELETE FROM admin_audit_log; DELETE FROM analytics_events; DELETE FROM refresh_tokens; DELETE FROM users; DELETE FROM role_permissions; DELETE FROM roles WHERE is_system = 0;');
  for (const name of ['accounts', 'approval', 'readers', 'staff']) {
    db.prepare('INSERT INTO roles (name, display_name) VALUES (?, ?)').run(name, name);
  }
  grant('accounts', ['module:user-manager:access', 'system:user:manage']);
  grant('approval', ['module:user-manager:access', 'system:user:approve']);
  grant('readers', ['module:analytics-dashboard:access', 'system:settings:edit', 'module:proxy-settings:access']);
  owner = account('owner_fixture', 'owner');
  manager = account('manager_fixture', 'accounts');
  approver = account('approver_fixture', 'approval');
  reader = account('reader_fixture', 'readers');
  member = account('member_fixture', 'staff');
  pending = account('pending_fixture', 'staff', 'pending');
});
after(async () => {
  await new Promise(resolve => server.close(resolve));
  db.close(); rmSync(directory, { recursive: true, force: true });
});

test('兼容迁移前的活跃会话，owner 的有效权限不依赖存储授予', async () => {
  const legacy = jwt.sign({ id: owner.id, role: 'guest' }, process.env.JWT_SECRET, { expiresIn: '5m' });
  const response = await call('/auth/getUserInfo', legacy);
  const info = ok(response);
  assert.equal(info.roleName, 'owner');
  assert.ok(info.buttons.includes('system:role:manage'));
  assert.equal(response.headers.get('x-nautilus-authorization'), info.authorizationVersion);
  ok(await call('/roles', legacy));
});

test('禁用撤销 access/refresh，重新启用也不会复活旧会话', async () => {
  const old = token(member), refresh = createRefreshToken(member.id);
  ok(await call(`/users/${member.id}/status`, owner, 'PUT', { status: 'disabled' }));
  assert.equal((await call('/auth/getUserInfo', old)).code, '8888');
  assert.equal((await call('/auth/refreshToken', null, 'POST', { refreshToken: refresh })).code, '8888');
  ok(await call(`/users/${member.id}/status`, owner, 'PUT', { status: 'active' }));
  assert.equal((await call('/auth/getUserInfo', old)).code, '8888');
  ok(await call('/auth/getUserInfo', findById(member.id)));
});

test('降级和提权立即使用数据库中的角色，忽略 JWT 的旧角色', async () => {
  const secondary = account('second_owner', 'owner'), old = token(secondary);
  ok(await call('/roles', old));
  ok(await call(`/users/${secondary.id}/role`, owner, 'PUT', { role: 'staff' }));
  denied(await call('/roles', old));
  assert.equal(ok(await call('/auth/getUserInfo', old)).roleName, 'staff');
  const oldMember = token(member);
  ok(await call(`/users/${member.id}/role`, owner, 'PUT', { role: 'readers' }));
  ok(await call('/analytics/summary', oldMember));
});

test('角色权限变化立即拦截旧令牌并返回新的授权指纹', async () => {
  const old = token(reader);
  const before = await call('/auth/getUserInfo', old);
  ok(await call('/roles/readers/permissions', owner, 'PUT', { permissions: [] }));
  const forbidden = await call('/settings/proxy', old);
  denied(forbidden);
  assert.notEqual(forbidden.headers.get('x-nautilus-authorization'), before.data.authorizationVersion);
  assert.deepEqual(ok(await call('/auth/getUserInfo', old)).buttons, []);
});

test('改密码撤销全部旧会话，账号删除后令牌失效', async () => {
  const old = token(member), refresh = createRefreshToken(member.id);
  ok(await call('/auth/changePassword', old, 'POST', { oldPassword: 'fixture-password', newPassword: 'changed-password' }));
  assert.equal((await call('/auth/getUserInfo', old)).code, '8888');
  assert.equal((await call('/auth/refreshToken', null, 'POST', { refreshToken: refresh })).code, '8888');
  const login = ok(await call('/auth/login', null, 'POST', { userName: member.username, password: 'changed-password' }));
  assert.equal(jwt.decode(login.token).version, 1);
  ok(await call(`/users/${member.id}`, owner, 'DELETE'));
  assert.equal((await call('/auth/getUserInfo', login.token)).code, '8888');
});

test('普通账号管理员不能创建 owner、操作 owner 或将用户升级为 owner', async () => {
  const roleOptions = ok(await call('/users/role-options', manager));
  assert.ok(!roleOptions.some(role => role.name === 'owner'));
  denied(await call('/users', manager, 'POST', { userName: 'new_owner', password: 'fixture-password', role: 'owner' }));
  denied(await call(`/users/${member.id}/role`, manager, 'PUT', { role: 'owner' }));
  denied(await call(`/users/${owner.id}/role`, manager, 'PUT', { role: 'staff' }));
  denied(await call(`/users/${owner.id}/status`, manager, 'PUT', { status: 'disabled' }));
  denied(await call(`/users/${owner.id}/profile`, manager, 'PUT', { displayName: 'changed' }));
  denied(await call(`/users/${owner.id}`, manager, 'DELETE'));
  assert.equal(findById(owner.id).role, 'owner');
  assert.equal(db.prepare('SELECT COUNT(*) count FROM admin_audit_log').get().count, 0);
});

test('保护最后一个启用的 owner 与当前账号，允许 owner 管理其他 owner', async () => {
  assert.throws(() => assertUserManagement(owner, owner, { status: 'disabled' }), /至少一个/);
  assert.throws(() => assertUserManagement(owner, owner, { role: 'staff' }), /至少一个/);
  assert.throws(() => assertUserManagement(owner, owner, { deleting: true }), /至少一个/);
  for (const [suffix, body] of [['role', { role: 'staff' }], ['status', { status: 'disabled' }]]) {
    assert.equal((await call(`/users/${owner.id}/${suffix}`, owner, 'PUT', body)).code, '1001');
  }
  const secondary = account('second_owner', 'owner');
  assert.match((await call(`/users/${owner.id}/role`, owner, 'PUT', { role: 'staff' })).msg, /自己/);
  ok(await call(`/users/${secondary.id}/status`, owner, 'PUT', { status: 'disabled' }));
  ok(await call(`/users/${secondary.id}`, owner, 'DELETE'));
  assert.equal((await call(`/users/${manager.id}`, manager, 'DELETE')).code, '1001');
  assert.equal((await call(`/users/${manager.id}/status`, manager, 'PUT', { status: 'disabled' })).code, '1001');
});

test('注册审批独立于账号管理，账号管理不能通过状态或删除绕过审批', async () => {
  assert.equal(ok(await call('/users/pending', approver)).length, 1);
  denied(await call('/users', approver));
  denied(await call('/users/role-options', approver));
  denied(await call(`/users/${member.id}/status`, approver, 'PUT', { status: 'disabled' }));
  denied(await call('/users/pending', manager));
  denied(await call(`/users/${pending.id}/approve`, manager, 'PUT'));
  denied(await call(`/users/${pending.id}/reject`, manager, 'PUT'));
  assert.equal((await call(`/users/${pending.id}/status`, manager, 'PUT', { status: 'active' })).code, '1001');
  assert.equal((await call(`/users/${pending.id}`, manager, 'DELETE')).code, '1001');
  ok(await call(`/users/${pending.id}/approve`, approver, 'PUT'));
  assert.equal(findById(pending.id).status, 'active');
  assert.equal((await call(`/users/${pending.id}/reject`, approver, 'PUT')).code, '1001');
  const other = account('rejected_fixture', 'staff', 'pending');
  ok(await call(`/users/${other.id}/reject`, approver, 'PUT'));
  assert.equal(findById(other.id).status, 'disabled');
});

test('系统设置和分析看板按权限委派，日志不保留代理凭据', async () => {
  ok(await call('/settings/proxy', reader));
  ok(await call('/analytics/summary', reader));
  ok(await call('/analytics/recent', reader));
  denied(await call('/settings/proxy', member));
  denied(await call('/analytics/recent', member));
  const privateUrl = 'https://fixture-user:fixture-secret@example.test';
  ok(await call('/settings/proxy', reader, 'PUT', { settings: { 'proxy.tts_base': privateUrl } }));
  const audit = ok(await call('/roles/audit'));
  assert.deepEqual(audit[0].after, { keys: ['proxy.tts_base'] });
  assert.ok(!JSON.stringify(audit).includes('fixture-secret'));
  assert.equal(audit[0].actor_name, reader.username);
});

test('角色显示成员数量，阻止删除在用角色及内置角色', async () => {
  const role = ok(await call('/roles')).find(item => item.name === 'staff');
  assert.equal(role.user_count, 2);
  const members = ok(await call('/roles/staff/members'));
  assert.deepEqual(members.map(item => item.id), [member.id, pending.id]);
  assert.ok(!members.some(item => 'password_hash' in item));
  grant('staff', ['module:voice-lab:access']);
  assert.equal((await call(`/roles/${role.id}`, owner, 'DELETE')).code, '1001');
  assert.equal(db.prepare("SELECT COUNT(*) count FROM role_permissions WHERE role='staff'").get().count, 1);
  const created = ok(await call('/roles', owner, 'POST', { name: 'empty', displayName: '空角色' }));
  ok(await call(`/roles/${created.id}`, owner, 'PUT', { displayName: '新名称', description: '新说明' }));
  assert.equal(db.prepare('SELECT display_name FROM roles WHERE id=?').get(created.id).display_name, '新名称');
  ok(await call(`/roles/${created.id}`, owner, 'DELETE'));
  assert.equal((await call(`/roles/${db.prepare("SELECT id FROM roles WHERE name='owner'").get().id}`, owner, 'DELETE')).code, '1001');
});

test('管理和子功能授权补齐页面入口，公开工具不能伪装成可撤销授权', async () => {
  const catalog = ok(await call('/roles/permissions'));
  assert.equal(catalog.find(item => item.key === 'module:image-compressor:access').public, true);
  const saved = ok(await call('/roles/staff/permissions', owner, 'PUT', {
    permissions: ['system:user:approve', 'feature:voice-lab:clone', 'module:image-compressor:access'], expectedPermissions: []
  }));
  assert.deepEqual(saved.permissions, ['feature:voice-lab:clone', 'module:user-manager:access', 'module:voice-lab:access', 'system:user:approve']);
  assert.equal(saved.affectedUsers, 2);
  assert.equal((await call('/roles/staff/permissions', owner, 'PUT', { permissions: ['unknown'] })).code, '1001');
  assert.equal((await call('/roles/owner/permissions', owner, 'PUT', { permissions: [] })).code, '1001');
});

test('检测并发管理员覆盖，失败的授权修改不产生成功审计', async () => {
  ok(await call('/roles/staff/permissions', owner, 'PUT', { permissions: ['system:user:approve'], expectedPermissions: [] }));
  const before = ok(await call('/roles/staff/permissions'));
  const stale = await call('/roles/staff/permissions', owner, 'PUT', { permissions: [], expectedPermissions: [] });
  assert.equal(stale.status, 409);
  assert.deepEqual(ok(await call('/roles/staff/permissions')), before);
  assert.equal(ok(await call('/roles/audit?limit=1.5')).length, 1);
  const audit = ok(await call('/roles/audit'));
  assert.equal(audit.length, 1);
  assert.deepEqual(audit[0].before, { permissions: [] });
  assert.deepEqual(audit[0].after, { permissions: before });
});

test('审计写入失败时同时回滚授权变更', async () => {
  db.exec("CREATE TRIGGER fixture_audit_failure BEFORE INSERT ON admin_audit_log BEGIN SELECT RAISE(ABORT, 'fixture audit failure'); END;");
  try {
    const response = await call('/roles/staff/permissions', owner, 'PUT', { permissions: ['system:user:approve'] });
    assert.equal(response.code, '1001');
    assert.deepEqual(ok(await call('/roles/staff/permissions')), []);
  } finally { db.exec('DROP TRIGGER fixture_audit_failure'); }
});

test('刷新令牌按实际时刻过期，并使用最新角色与会话版本签发', async () => {
  const expired = createRefreshToken(member.id);
  db.prepare('UPDATE refresh_tokens SET expires_at=? WHERE token=?').run(new Date(Date.now() - 1000).toISOString(), expired);
  assert.equal((await call('/auth/refreshToken', null, 'POST', { refreshToken: expired })).code, '8888');
  const valid = createRefreshToken(member.id);
  ok(await call(`/users/${member.id}/role`, owner, 'PUT', { role: 'readers' }));
  const renewed = ok(await call('/auth/refreshToken', null, 'POST', { refreshToken: valid }));
  assert.equal(jwt.decode(renewed.token).role, 'readers');
  ok(await call('/settings/proxy', renewed.token));
  assert.equal((await call('/auth/refreshToken', null, 'POST', { refreshToken: valid })).code, '8888');
});
