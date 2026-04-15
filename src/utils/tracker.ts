/**
 * 轻量级埋点 SDK
 *
 * 设计原则：
 * 1. fire-and-forget：上报失败静默丢弃，绝不影响业务
 * 2. 批量上报：攒一批再发，减少请求数
 * 3. sendBeacon 兜底：离开页面时确保数据发出
 * 4. 不阻塞渲染：使用 requestIdleCallback 延迟处理
 */

import { localStg } from '@/utils/storage';

/** 单条事件 */
interface TrackEvent {
  eventType: 'page_view' | 'action';
  toolName: string;
  actionName?: string;
  result?: 'success' | 'fail';
  duration?: number;
  meta?: Record<string, unknown>;
}

/** 配置 */
const CONFIG = {
  /** 批量发送阈值 */
  BATCH_SIZE: 10,
  /** 定时发送间隔（ms） */
  FLUSH_INTERVAL: 5000,
  /** API 端点 */
  ENDPOINT: '/api/analytics/events'
};

/** 事件队列 */
let queue: TrackEvent[] = [];

/** 定时器 */
let flushTimer: ReturnType<typeof setInterval> | null = null;

/** 是否已初始化 */
let initialized = false;

/**
 * 获取请求头（带 JWT token）
 */
function getHeaders(): Record<string, string> {
  const token = localStg.get('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

/**
 * 发送事件批次
 * fire-and-forget，失败静默丢弃
 */
function flush(): void {
  if (queue.length === 0) return;

  const batch = queue.splice(0, CONFIG.BATCH_SIZE);

  // 未登录不上报
  const token = localStg.get('token');
  if (!token) {
    return;
  }

  try {
    fetch(CONFIG.ENDPOINT, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ events: batch }),
      // 不需要等待响应
      keepalive: true
    }).catch(() => {
      // 静默丢弃，仅开发环境打日志
      if (import.meta.env.DEV) {
        console.warn('[Tracker] 上报失败，已丢弃', batch.length, '条事件');
      }
    });
  } catch {
    // 静默丢弃
  }

  // 如果队列还有剩余，继续 flush
  if (queue.length > 0) {
    scheduleFlush();
  }
}

/**
 * 使用 requestIdleCallback 延迟 flush（不阻塞主线程）
 */
function scheduleFlush(): void {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => flush());
  } else {
    setTimeout(() => flush(), 0);
  }
}

/**
 * 将事件加入队列
 */
function enqueue(event: TrackEvent): void {
  queue.push(event);

  // 达到阈值立即发送
  if (queue.length >= CONFIG.BATCH_SIZE) {
    scheduleFlush();
  }
}

/**
 * 页面卸载时使用 sendBeacon 兜底发送
 */
function onPageUnload(): void {
  if (queue.length === 0) return;

  const token = localStg.get('token');
  if (!token) return;

  const payload = JSON.stringify({ events: queue.splice(0) });
  const blob = new Blob([payload], { type: 'application/json' });

  // sendBeacon 不支持自定义 header，所以用 URL 传 token
  // 但为了安全我们仍然走标准方式，sendBeacon 会在浏览器后台完成发送
  try {
    const url = `${CONFIG.ENDPOINT}?_token=${encodeURIComponent(token)}`;
    navigator.sendBeacon(url, blob);
  } catch {
    // 静默丢弃
  }
}

// ──────────────────────────────────────────
// 对外 API
// ──────────────────────────────────────────

/**
 * 初始化 tracker
 * 在 app 启动时调用一次
 */
export function initTracker(): void {
  if (initialized) return;
  initialized = true;

  // 定时 flush
  flushTimer = setInterval(flush, CONFIG.FLUSH_INTERVAL);

  // 离开页面兜底
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      onPageUnload();
    }
  });

  // 页面关闭兜底
  window.addEventListener('pagehide', onPageUnload);
}

/**
 * 销毁 tracker（测试用）
 */
export function destroyTracker(): void {
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
  window.removeEventListener('pagehide', onPageUnload);
  queue = [];
  initialized = false;
}

/**
 * 记录页面访问
 */
export function trackPageView(toolName: string): void {
  enqueue({
    eventType: 'page_view',
    toolName
  });
}

/**
 * 记录页面离开（带停留时长）
 */
export function trackPageLeave(toolName: string, durationSeconds: number): void {
  enqueue({
    eventType: 'page_view',
    toolName,
    actionName: 'leave',
    duration: Math.round(durationSeconds)
  });
}

/**
 * 记录核心操作
 */
export function trackAction(
  toolName: string,
  actionName: string,
  result: 'success' | 'fail' = 'success',
  meta?: Record<string, unknown>
): void {
  enqueue({
    eventType: 'action',
    toolName,
    actionName,
    result,
    meta
  });
}

/**
 * 手动 flush（测试和调试用）
 */
export function flushTracker(): void {
  flush();
}
