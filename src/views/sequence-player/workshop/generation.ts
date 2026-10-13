/** 工坊自己的重试队列，不改变语音实验室其他页面的请求行为。 */
export class GenerationError extends Error {
  constructor(
    message: string,
    public status = 0,
    public retryAfterMs = 0,
    public recoverable = false
  ) {
    super(message);
    this.name = 'GenerationError';
  }
}
export function requestError(error: any, fallback = '配音生成失败，请重试'): GenerationError {
  const response = error?.response;
  const status = Number(response?.status || error?.status || 0);
  const hint = response?.headers?.['retry-after'];
  const retryAfterMs = hint
    ? /^\d+(\.\d+)?$/.test(String(hint))
      ? Number(hint) * 1000
      : Math.max(0, Date.parse(hint) - Date.now())
    : 0;
  const message = response?.data?.msg || response?.data?.message || error?.message || fallback;
  // 无效输入、权限或音色不存在不靠重试解决；服务端有时把上游错误统一包成 500。
  const permanent = /音色.*(?:不存在|无效|删除)|权限|未配置|InvalidParameter|InvalidVoice|Unauthorized|Forbidden/i.test(
    message
  );
  const recoverable =
    !permanent &&
    ([408, 425, 429, 500, 502, 503, 504].includes(status) ||
      ['ECONNABORTED', 'ETIMEDOUT', 'ERR_NETWORK'].includes(error?.code));
  return new GenerationError(message, status, Number.isFinite(retryAfterMs) ? retryAfterMs : 0, recoverable);
}
export function abortCheck(signal: AbortSignal) {
  if (signal.aborted) throw new DOMException('已停止生成', 'AbortError');
}
export function delay(ms: number, signal: AbortSignal): Promise<void> {
  abortCheck(signal);
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException('已停止生成', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, ms);
    signal.addEventListener('abort', abort, { once: true });
  });
}
export async function retryRequest<T>(
  operation: () => Promise<T>,
  options: {
    signal: AbortSignal;
    beforeAttempt?: () => Promise<void>;
    onRetry?: (attempt: number, error: GenerationError) => void;
    wait?: typeof delay;
  }
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    abortCheck(options.signal);
    await options.beforeAttempt?.();
    abortCheck(options.signal);
    try {
      return await operation();
    } catch (error) {
      abortCheck(options.signal);
      if (!(error instanceof GenerationError) || !error.recoverable || attempt >= 3) throw error;
      options.onRetry?.(attempt + 1, error);
      await (options.wait || delay)(
        Math.max(Math.min(8000, 900 * 2 ** (attempt - 1)), error.retryAfterMs),
        options.signal
      );
    }
  }
}
export async function runGenerationQueue<T>(
  items: T[],
  options: {
    signal: AbortSignal;
    ready: (item: T) => boolean;
    beforeItem: () => Promise<void>;
    generate: (item: T) => Promise<void>;
    failed: (item: T, error: unknown) => void;
  }
) {
  for (const item of items) {
    abortCheck(options.signal);
    await options.beforeItem();
    abortCheck(options.signal);
    if (options.ready(item)) continue;
    try {
      await options.generate(item);
    } catch (error) {
      abortCheck(options.signal);
      options.failed(item, error);
    }
  }
}
