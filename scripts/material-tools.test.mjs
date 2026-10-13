import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';
import Database from 'better-sqlite3';
import { createServer } from 'vite';
import { createMemoryHistory, createRouter } from 'vue-router';
import { catalogPermission } from '../server/services/permission-catalog.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const assetTools = ['image-compressor', 'image-matting', 'video-frame-extractor', 'effects-generator', 'sb3-compressor', 'voice-lab'];
let server;
let routeModule;
let filterRoutes;
let getMenus;
let scanner;

before(async () => {
  // 测试真实路由生成和权限过滤；视图、图标、翻译无需挂载浏览器。
  server = await createServer({
    root,
    configFile: false,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, watch: null, hmr: false },
    appType: 'custom',
    resolve: { alias: { '@': path.join(root, 'src') } },
    plugins: [{
      name: 'route-test-view-stubs',
      load(id) {
        if (id.endsWith('.vue')) return 'export default {}';
        if (id === path.join(root, 'src/hooks/common/icon.ts')) return 'export const useSvgIcon = () => ({ SvgIconVNode: () => null })';
        if (id === path.join(root, 'src/locales/index.ts')) return 'export const $t = key => key';
      }
    }]
  });
  routeModule = await server.ssrLoadModule('/src/router/routes/index.ts');
  scanner = await server.ssrLoadModule('/src/router/plugin-scanner.ts');
  ({ filterAuthRoutesByPermissions: filterRoutes, getGlobalMenusByAuthRoutes: getMenus } = await server.ssrLoadModule('/src/store/modules/route/shared.ts'));
});

after(async () => { await server?.close(); });

const flatten = routes => routes.flatMap(route => [route, ...flatten(route.children || [])]);

test('所有正式路由与兼容跳转的名称、路径唯一，避免分类被覆盖', () => {
  const { constantRoutes, authRoutes } = routeModule.createStaticRoutes();
  const routes = flatten([...constantRoutes, ...authRoutes]);
  for (const field of ['name', 'path']) {
    const values = routes.map(route => route[field]);
    const duplicates = values.filter((value, index) => values.indexOf(value) !== index);
    assert.deepEqual(duplicates, [], `重复的路由 ${field}`);
  }
});

test('课程分类保留两个页面，各自授权及分类跳转均正确', async () => {
  const { authRoutes } = routeModule.createStaticRoutes();
  for (const modules of [[], ['course-assets'], ['course-structure'], ['course-assets', 'course-structure']]) {
    const filtered = filterRoutes(authRoutes, modules.map(name => `module:${name}:access`));
    // 与 route store 相同的按名称去重，覆盖菜单被兼容路由替换的实际故障。
    const stored = [...new Map(filtered.map(route => [route.name, route])).values()];
    const menu = getMenus(stored).find(item => item.key === 'course-assets');
    if (!modules.length) {
      assert.equal(menu, undefined);
      continue;
    }
    assert.ok(menu, `授权 ${modules} 后必须显示课程分类`);
    assert.deepEqual(menu.children.map(item => item.key), modules.map(name => `course-assets_${name}`));
    const router = createRouter({ history: createMemoryHistory(), routes: routeModule.getAuthVueRoutes(stored) });
    await router.push('/course-assets');
    assert.equal(router.currentRoute.value.path, `/course-assets/${modules[0]}`);
    for (const name of modules) {
      await router.push(`/course-assets/${name}`);
      assert.equal(router.currentRoute.value.name, `course-assets_${name}`);
      assert.equal(router.currentRoute.value.matched.length, 2);
      assert.equal(router.currentRoute.value.meta.permissionKey, `module:${name}:access`);
      assert.equal(router.currentRoute.value.meta.guestAccessible, false);
    }
    if (modules.includes('course-structure')) {
      await router.push('/course-structure');
      assert.equal(router.currentRoute.value.path, '/course-assets/course-structure');
    }
  }
});

test('素材工具包含六个入口，下线分析模块及空分类', () => {
  const { authRoutes } = routeModule.createStaticRoutes();
  const group = authRoutes.find(route => route.name === 'image-tools');
  assert.deepEqual(group.children.map(route => route.path), assetTools.map(name => `/image-tools/${name}`));
  assert.equal(scanner.getPluginI18n()['zh-CN'].route['image-tools'], '素材工具');
  assert.equal(scanner.getPluginI18n()['en-US'].route['image-tools'], 'Asset Tools');
  for (const route of flatten(authRoutes)) {
    assert.ok(!String(route.name).includes('sb3-studio'));
    assert.notEqual(route.name, 'sb3-graphical');
  }
  for (const name of assetTools) {
    assert.equal(catalogPermission({ key: `module:${name}:access`, description: name }).group, '素材工具');
  }
});

test('同组公开工具不放开语音/去背景权限，旧入口也受相同权限约束', () => {
  const { authRoutes } = routeModule.createStaticRoutes();
  const blocked = flatten(filterRoutes(authRoutes, []));
  assert.ok(blocked.some(route => route.path === '/image-tools/sb3-compressor'));
  for (const route of blocked) {
    assert.notEqual(route.meta?.permissionKey, 'module:voice-lab:access');
    assert.notEqual(route.meta?.permissionKey, 'module:image-matting:access');
  }
  const allowed = flatten(filterRoutes(authRoutes, ['module:voice-lab:access']));
  for (const modulePath of ['/voice-lab', '/copywriting/voice-lab', '/image-tools/voice-lab']) {
    const route = allowed.find(item => item.path === modulePath);
    assert.ok(route, modulePath);
    assert.equal(route.meta.permissionKey, 'module:voice-lab:access');
    assert.equal(route.meta.guestAccessible, false);
  }
  for (const feature of ['clone', 'design', 'manage-voices']) {
    const permission = catalogPermission({ key: `feature:voice-lab:${feature}` });
    assert.equal(permission.parentKey, 'module:voice-lab:access');
  }
});

test('旧地址跳转到正式入口并保留查询和锚点', async () => {
  const { authRoutes } = routeModule.createStaticRoutes();
  const router = createRouter({ history: createMemoryHistory(), routes: routeModule.getAuthVueRoutes(authRoutes) });
  for (const [oldPath, newPath] of [
    ['/sb3-graphical/sb3-compressor', '/image-tools/sb3-compressor'],
    ['/sb3-compressor', '/image-tools/sb3-compressor'],
    ['/copywriting/voice-lab', '/image-tools/voice-lab'],
    ['/voice-lab', '/image-tools/voice-lab']
  ]) {
    await router.push(`${oldPath}?from=bookmark#settings`);
    assert.equal(router.currentRoute.value.fullPath, `${newPath}?from=bookmark#settings`);
  }
  assert.equal(router.resolve('/sb3-studio').matched.length, 0);
  assert.equal(router.resolve('/sb3-graphical/sb3-studio').matched.length, 0);
});

test('数据库迁移删除分析权限且保留所有其他角色授权，重复执行安全', () => {
  const db = new Database(':memory:');
  try {
    db.pragma('foreign_keys = ON');
    const migrations = path.join(root, 'server/db/migrations');
    const retirement = '019_retire_sb3_studio.sql';
    for (const name of fs.readdirSync(migrations).filter(file => file.endsWith('.sql') && file < retirement).sort()) {
      db.exec(fs.readFileSync(path.join(migrations, name), 'utf8'));
    }
    for (const key of ['module:sb3-studio:access', 'module:sb3-compressor:access', 'module:voice-lab:access', 'feature:voice-lab:clone']) {
      db.prepare('INSERT OR IGNORE INTO permissions (key) VALUES (?)').run(key);
      db.prepare('INSERT OR IGNORE INTO role_permissions (role, permission_key) VALUES (?, ?)').run('test-editor', key);
    }
    const unaffected = () => db.prepare("SELECT * FROM role_permissions WHERE permission_key != 'module:sb3-studio:access' ORDER BY id").all();
    const originalPermissions = unaffected();
    const sql = fs.readFileSync(path.join(migrations, retirement), 'utf8');
    db.exec(sql);
    db.exec(sql);
    assert.deepEqual(unaffected(), originalPermissions);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM permissions WHERE key = 'module:sb3-studio:access'").get().count, 0);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM role_permissions WHERE permission_key = 'module:sb3-studio:access'").get().count, 0);
  } finally {
    db.close();
  }
});
