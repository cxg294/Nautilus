/** 运行真实 store/续期代码；仅替换网络、路由和本地存储，验证并发与会话边界。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
import * as vue from 'vue';
import * as pinia from 'pinia';
const require = createRequire(import.meta.url);
function load(relative, mocks, extras = {}) {
  const source = readFileSync(new URL(relative, import.meta.url), 'utf8').replaceAll('import.meta.env', '__env');
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: name => mocks[name] ?? require(name),
    __env: { VITE_AUTH_ROUTE_MODE: 'static', VITE_STATIC_SUPER_ROLE: 'R_SUPER' }, Date, console, ...extras });
  return exports;
}
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
function storage() {
  const values = new Map([['token', 'existing-access'], ['refreshToken', 'existing-refresh']]);
  return { get: key => values.get(key) ?? null, set: (key, value) => values.set(key, value), remove: key => values.delete(key) };
}
function authFixture() {
  pinia.setActivePinia(pinia.createPinia());
  const stg = storage(), infoResponse = deferred();
  let requests = 0, menus = 0;
  const routeStore = { isInitAuthRoute: true, resetStore() {}, refreshAuthRoutes: async () => { menus++; } };
  const mocks = {
    vue, 'vue-router': { useRoute: () => ({ meta: {} }) },
    pinia: { defineStore: (id, setup) => {
      const use = pinia.defineStore(id, setup);
      return () => {
        const store = use();
        store.$reset = () => { store.token = ''; Object.assign(store.userInfo, { userId: '', userName: '', roles: [], buttons: [] }); };
        return store;
      };
    } },
    '@sa/hooks': { useLoading: () => ({ loading: vue.ref(false), startLoading() {}, endLoading() {} }) },
    '@/service/api': { fetchGetUserInfo: () => { requests++; return infoResponse.promise; } },
    '@/hooks/common/router': { useRouterPush: () => ({ toLogin: async () => {}, redirectFromLogin: async () => {} }) },
    '@/utils/storage': { localStg: stg }, '@/enum': { SetupStoreId: { Auth: 'auth' } }, '@/locales': { $t: value => value },
    '../route': { useRouteStore: () => routeStore }, '../tab': { useTabStore: () => ({ cacheTabs() {} }) },
    './shared': { clearAuthStorage: () => { stg.remove('token'); stg.remove('refreshToken'); }, getToken: () => stg.get('token') }
  };
  const { useAuthStore } = load('../src/store/modules/auth/index.ts', mocks);
  const store = useAuthStore();
  store.token = 'existing-access';
  Object.assign(store.userInfo, { userId: 'fixture', userName: 'fixture', roles: ['R_USER'], buttons: ['module:user-manager:access'] });
  return { store, stg, resolve: infoResponse.resolve, requests: () => requests, menus: () => menus };
}
const info = buttons => ({ data: { userId: 'fixture', userName: 'fixture', roles: ['R_USER'], buttons, authorizationVersion: 'new-version' }, error: null });

test('合并并发权限同步，更新权限及菜单，并跟随续期后的令牌', async () => {
  const f = authFixture();
  const first = f.store.refreshAuthorization(true), second = f.store.refreshAuthorization(true);
  assert.equal(f.requests(), 1);
  f.stg.set('token', 'renewed-access');
  f.resolve(info([]));
  assert.equal(await first, true); assert.equal(await second, true);
  assert.equal(f.store.token, 'renewed-access');
  assert.deepEqual([...f.store.userInfo.buttons], []); assert.equal(f.menus(), 1);
});
test('权限没变化时不重建菜单，短间隔同步不重复请求', async () => {
  const f = authFixture(), result = f.store.refreshAuthorization(true);
  f.resolve(info(['module:user-manager:access']));
  await result; await f.store.refreshAuthorization();
  assert.equal(f.menus(), 0); assert.equal(f.requests(), 1);
  assert.equal(f.store.userInfo.authorizationVersion, 'new-version');
});
test('退出期间返回的旧用户信息不会恢复登录或重建菜单', async () => {
  const f = authFixture(), result = f.store.refreshAuthorization(true);
  await f.store.resetStore();
  f.resolve(info(['system:role:manage']));
  assert.equal(await result, false);
  assert.equal(f.store.isLogin, false); assert.equal(f.store.userInfo.userId, '');
  assert.equal(f.menus(), 0); assert.equal(f.stg.get('token'), null);
});

function renewalFixture() {
  const stg = storage(), response = deferred(), timers = [];
  let requests = 0, resets = 0, syncs = 0;
  const { handleExpiredRequest } = load('../src/service/request/shared.ts', {
    '@/store/modules/auth': { useAuthStore: () => ({ resetStore: () => { resets++; }, refreshAuthorization: async () => { syncs++; } }) },
    '@/utils/storage': { localStg: stg }, '../api': { fetchRefreshToken: () => { requests++; return response.promise; } }
  }, { setTimeout: (fn, delay) => { timers.push({ fn, delay }); } });
  const state = { refreshTokenPromise: null };
  return { stg, resolve: response.resolve, timers, request: () => handleExpiredRequest(state), requests: () => requests, resets: () => resets, syncs: () => syncs };
}
test('续期期间切换账号，旧响应不会覆盖新凭据或登出新账号', async () => {
  const f = renewalFixture(), result = f.request();
  f.stg.set('token', 'other-access'); f.stg.set('refreshToken', 'other-refresh');
  f.resolve({ data: { token: 'stale-access', refreshToken: 'stale-refresh' }, error: null });
  assert.equal(await result, false);
  assert.equal(f.stg.get('token'), 'other-access'); assert.equal(f.stg.get('refreshToken'), 'other-refresh');
  assert.equal(f.resets(), 0); assert.equal(f.syncs(), 0);
});
test('续期期间退出，旧响应不会复活凭据', async () => {
  const f = renewalFixture(), result = f.request();
  f.stg.remove('token'); f.stg.remove('refreshToken');
  f.resolve({ data: { token: 'stale-access', refreshToken: 'stale-refresh' }, error: null });
  assert.equal(await result, false); assert.equal(f.stg.get('token'), null); assert.equal(f.resets(), 0);
});
test('并发过期请求只续期一次，延后同步避免等待自身导致死锁', async () => {
  const f = renewalFixture(), first = f.request(), second = f.request();
  assert.equal(f.requests(), 1);
  f.resolve({ data: { token: 'new-access', refreshToken: 'new-refresh' }, error: null });
  assert.equal(await first, true); assert.equal(await second, true);
  assert.equal(f.stg.get('token'), 'new-access'); assert.equal(f.syncs(), 0);
  f.timers.find(timer => timer.delay === 0).fn(); assert.equal(f.syncs(), 1);
});
