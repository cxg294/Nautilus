import { spawn } from 'child_process';
import config from '../config/env.js';

const DEFAULT_TIMEOUT_MS = 30000;
const MAX_BUFFER_CHARS = 4 * 1024 * 1024;

function maskSensitiveText(text) {
  if (!text) return '';

  return String(text)
    .replace(/("?(?:accessToken|refreshToken|token|userToken)"?\s*:\s*)"[^"]*"/gi, '$1"***"')
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, '$1***');
}

function createCliError(message, details = {}) {
  const err = new Error(message);
  err.name = 'HetaoCliError';
  Object.assign(err, details);
  return err;
}

function normalizeCliError({ args, code, signal, stdout, stderr }) {
  const output = maskSensitiveText(`${stderr || ''}\n${stdout || ''}`.trim());
  const lower = output.toLowerCase();

  let reason = 'HTCLI_COMMAND_FAILED';
  let message = 'hetao-cli 调用失败';

  if (code === 'ENOENT' || lower.includes('not found') || lower.includes('no such file')) {
    reason = 'HTCLI_NOT_FOUND';
    message = '未找到 hetao-cli，请确认服务端运行环境已安装';
  } else if (
    lower.includes('login') ||
    lower.includes('auth') ||
    lower.includes('unauthorized') ||
    lower.includes('未登录') ||
    lower.includes('认证') ||
    lower.includes('授权')
  ) {
    reason = 'HTCLI_AUTH_REQUIRED';
    message = 'hetao-cli 未登录或登录已失效';
  } else if (signal === 'SIGTERM' || lower.includes('timeout')) {
    reason = 'HTCLI_TIMEOUT';
    message = 'hetao-cli 调用超时';
  } else if (lower.includes('permission') || lower.includes('权限')) {
    reason = 'HTCLI_PERMISSION_DENIED';
    message = '当前 hetao-cli 用户没有访问该数据的权限';
  }

  return createCliError(message, {
    reason,
    code,
    signal,
    output,
    args,
  });
}

function tryParseJson(stdout) {
  const text = String(stdout || '').trim();
  if (!text) {
    throw createCliError('hetao-cli 没有返回内容', { reason: 'HTCLI_EMPTY_OUTPUT' });
  }

  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        // fall through
      }
    }

    throw createCliError('hetao-cli 返回内容不是有效 JSON', {
      reason: 'HTCLI_INVALID_JSON',
      output: maskSensitiveText(text.slice(0, 2000)),
    });
  }
}

export function getHetaoCliCommandMeta(args) {
  const bin = config.htcli.bin || 'hetao-cli';
  return {
    bin,
    args,
    profile: config.htcli.profile || '',
  };
}

export function runHetaoCli(args, options = {}) {
  const timeoutMs = options.timeoutMs || config.htcli.timeoutMs || DEFAULT_TIMEOUT_MS;
  const cliArgs = [...args];

  if (config.htcli.profile) {
    cliArgs.push('--profile', config.htcli.profile);
  }

  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const child = spawn(config.htcli.bin || 'hetao-cli', cliArgs, {
      env: {
        ...process.env,
        NO_COLOR: '1',
        FORCE_COLOR: '0',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      if (!settled) {
        settled = true;
        reject(normalizeCliError({
          args: cliArgs,
          signal: 'SIGTERM',
          stdout,
          stderr: `${stderr}\ntimeout after ${timeoutMs}ms`,
        }));
      }
    }, timeoutMs);

    child.stdout.on('data', chunk => {
      stdout += chunk.toString('utf8');
      if (stdout.length > MAX_BUFFER_CHARS) {
        stdout = stdout.slice(-MAX_BUFFER_CHARS);
      }
    });

    child.stderr.on('data', chunk => {
      stderr += chunk.toString('utf8');
      if (stderr.length > MAX_BUFFER_CHARS) {
        stderr = stderr.slice(-MAX_BUFFER_CHARS);
      }
    });

    child.on('error', err => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      reject(normalizeCliError({
        args: cliArgs,
        code: err.code,
        stdout,
        stderr: err.message,
      }));
    });

    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;

      if (code !== 0) {
        reject(normalizeCliError({ args: cliArgs, code, signal, stdout, stderr }));
        return;
      }

      resolve({
        stdout,
        stderr: maskSensitiveText(stderr),
        durationMs: Date.now() - startedAt,
        args: cliArgs,
      });
    });
  });
}

export async function runHetaoCliJson(args, options = {}) {
  const result = await runHetaoCli(args, options);
  return {
    ...result,
    json: tryParseJson(result.stdout),
  };
}

export function serializeHetaoCliError(err) {
  if (err?.name !== 'HetaoCliError') {
    return {
      reason: 'UNKNOWN',
      message: err?.message || '未知错误',
    };
  }

  return {
    reason: err.reason,
    message: err.message,
    output: err.output || '',
  };
}
