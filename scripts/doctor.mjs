#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const rootDir = path.resolve(path.dirname(__filename), '..');
const jsonMode = process.argv.includes('--json');
const checks = [];

function add(status, name, detail = '', hint = '') {
  checks.push({ status, name, detail, hint });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, file), 'utf8'));
}

function command(args, options = {}) {
  const [bin, ...rest] = args;
  return spawnSync(bin, rest, {
    cwd: rootDir,
    encoding: 'utf8',
    timeout: options.timeout ?? 8000,
    env: {
      ...process.env,
      PATH: process.env.PATH || ''
    }
  });
}

function parseVersion(input) {
  return String(input || '')
    .replace(/^v/, '')
    .split('.')
    .map(part => Number.parseInt(part, 10) || 0);
}

function gteVersion(actual, minimum) {
  const a = parseVersion(actual);
  const b = parseVersion(minimum);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if ((a[i] || 0) > (b[i] || 0)) return true;
    if ((a[i] || 0) < (b[i] || 0)) return false;
  }
  return true;
}

async function httpGet(url, timeoutMs = 2500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  } finally {
    clearTimeout(timer);
  }
}

function short(text, max = 180) {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function checkProjectFiles() {
  const pkg = readJson('package.json');
  add(pkg.name === 'nautilus' ? 'pass' : 'fail', '项目根目录', `package.json name=${pkg.name || 'unknown'}`);

  const nvmrc = fs.existsSync(path.join(rootDir, '.nvmrc'))
    ? fs.readFileSync(path.join(rootDir, '.nvmrc'), 'utf8').trim()
    : '';
  add(nvmrc === 'v20.19.0' ? 'pass' : 'warn', '.nvmrc', nvmrc || '未找到', '建议固定为 v20.19.0，避免 better-sqlite3 ABI 不一致');

  add(fs.existsSync(path.join(rootDir, 'pnpm-lock.yaml')) ? 'pass' : 'fail', 'pnpm lockfile', 'pnpm-lock.yaml');
}

function checkNodeAndPnpm() {
  const pkg = readJson('package.json');
  const minNode = (pkg.engines?.node || '>=20.19.0').replace(/^[^\d]*/, '');
  const nodeVersion = process.version.replace(/^v/, '');

  if (!gteVersion(nodeVersion, minNode)) {
    add('fail', 'Node.js', `当前 ${process.version}，项目要求 ${pkg.engines?.node || '>=20.19.0'}`);
  } else if (!nodeVersion.startsWith('20.')) {
    add('warn', 'Node.js', `当前 ${process.version}，可运行但本机服务建议使用 v20.19.0`, '切换到与 .nvmrc 匹配的 Node.js 版本后重新运行 pnpm install');
  } else {
    add('pass', 'Node.js', process.version);
  }

  const pnpmInPath = command(['pnpm', '--version']);
  const userAgent = process.env.npm_config_user_agent || '';
  if (pnpmInPath.status === 0) {
    add('pass', 'pnpm', pnpmInPath.stdout.trim());
  } else if (userAgent.includes('pnpm/')) {
    add('pass', 'pnpm', userAgent.split(' ')[0]);
  } else {
    add('warn', 'pnpm', '当前 shell PATH 找不到 pnpm', '将 Node 20.19.0 的 bin 目录加入 PATH，或用绝对路径运行 pnpm');
  }
}

async function checkNativeDeps() {
  try {
    await import('better-sqlite3');
    add('pass', 'better-sqlite3', '原生模块可加载');
  } catch (error) {
    add('fail', 'better-sqlite3', short(error.message), '通常是 Node 版本或依赖安装环境不一致，使用 Node 20.19.0 后重新 pnpm install');
  }
}

function checkLocalFiles() {
  const dbPath = path.join(rootDir, 'server/db/nautilus.db');
  add(fs.existsSync(dbPath) ? 'pass' : 'warn', 'SQLite 数据库', path.relative(rootDir, dbPath), '首次启动前运行 pnpm setup 或 pnpm db:migrate');

  if (process.platform === 'darwin') {
    const launchAgents = [
      path.join(process.env.HOME || '', 'Library/LaunchAgents/local.nautilus.backend.plist'),
      path.join(process.env.HOME || '', 'Library/LaunchAgents/local.nautilus.frontend.plist')
    ];
    const missing = launchAgents.filter(file => !fs.existsSync(file));
    add(missing.length === 0 ? 'pass' : 'warn', 'macOS LaunchAgent', missing.length === 0 ? 'backend/frontend 已配置' : `缺少 ${missing.map(file => path.basename(file)).join(', ')}`);
  }
}

async function checkHttpServices() {
  const backend = `http://localhost:${process.env.PORT || '3000'}`;
  try {
    const health = await httpGet(`${backend}/api/health`);
    if (!health.ok) {
      add('fail', '后端健康检查', `HTTP ${health.status}: ${short(health.text)}`);
    } else {
      const data = JSON.parse(health.text);
      add(data.status === 'ok' ? 'pass' : 'warn', '后端健康检查', `${backend}/api/health => ${data.status || 'unknown'}`);
    }
  } catch (error) {
    add('fail', '后端健康检查', short(error.message), '确认 local.nautilus.backend 已启动，或运行 pnpm dev:server');
  }

  try {
    const frontend = await httpGet('http://localhost:9527/');
    add(frontend.ok ? 'pass' : 'fail', '前端页面', `http://localhost:9527/ => HTTP ${frontend.status}`);
  } catch (error) {
    add('fail', '前端页面', short(error.message), '确认 local.nautilus.frontend 已启动，或运行 pnpm dev:client');
  }

  try {
    const news = await httpGet(`${backend}/api/news`, 5000);
    if (!news.ok) {
      add('warn', 'AI 新闻接口', `HTTP ${news.status}: ${short(news.text)}`);
      return;
    }
    const payload = JSON.parse(news.text);
    const items = Array.isArray(payload.data) ? payload.data : [];
    const newest = items.reduce((max, item) => Math.max(max, Number(item.date || 0)), 0);
    const ageHours = newest ? Math.round((Date.now() - newest) / 36e5) : null;
    if (!items.length) {
      add('warn', 'AI 新闻接口', '返回 0 条新闻');
    } else if (ageHours !== null && ageHours > 36) {
      add('warn', 'AI 新闻接口', `${items.length} 条，最新约 ${ageHours} 小时前`, '可登录后调用 /api/news/refresh 或检查飞书 Base');
    } else {
      add('pass', 'AI 新闻接口', `${items.length} 条，最新约 ${Math.max(0, ageHours ?? 0)} 小时前`);
    }
  } catch (error) {
    add('warn', 'AI 新闻接口', short(error.message));
  }
}

function checkLarkCli() {
  const lark = command(['lark-cli', '--help']);
  add(lark.status === 0 ? 'pass' : 'warn', 'lark-cli', lark.status === 0 ? '命令可用' : '当前 shell PATH 找不到或不可执行', '新闻、飞书 Base 等能力依赖 lark-cli');
}

function checkGitWorktree() {
  const status = command(['git', 'status', '--porcelain']);
  if (status.status !== 0) {
    add('warn', 'Git 工作区', short(status.stderr || status.stdout));
    return;
  }
  const lines = status.stdout.split('\n').filter(Boolean);
  if (!lines.length) {
    add('pass', 'Git 工作区', 'clean');
    return;
  }
  const modified = lines.filter(line => !line.startsWith('??')).length;
  const untracked = lines.filter(line => line.startsWith('??')).length;
  add('warn', 'Git 工作区', `${modified} 个已跟踪改动，${untracked} 个未跟踪文件/目录`, '建议按主题拆分提交：救火修复、运行环境、新闻 RSS、模块裁剪、逐字稿播放器、视频抽帧/GIF');
}

function printHuman() {
  const icon = { pass: 'PASS', warn: 'WARN', fail: 'FAIL' };
  console.log('Nautilus Doctor');
  console.log('='.repeat(16));
  for (const check of checks) {
    const line = `[${icon[check.status]}] ${check.name}${check.detail ? ` - ${check.detail}` : ''}`;
    console.log(line);
    if (check.hint && check.status !== 'pass') console.log(`       ${check.hint}`);
  }
  const counts = checks.reduce((acc, check) => {
    acc[check.status] += 1;
    return acc;
  }, { pass: 0, warn: 0, fail: 0 });
  console.log('-'.repeat(16));
  console.log(`Summary: ${counts.pass} passed, ${counts.warn} warnings, ${counts.fail} failures`);
}

checkProjectFiles();
checkNodeAndPnpm();
await checkNativeDeps();
checkLocalFiles();
await checkHttpServices();
checkLarkCli();
checkGitWorktree();

if (jsonMode) {
  console.log(JSON.stringify({ ok: !checks.some(check => check.status === 'fail'), checks }, null, 2));
} else {
  printHuman();
}

process.exitCode = checks.some(check => check.status === 'fail') ? 1 : 0;
