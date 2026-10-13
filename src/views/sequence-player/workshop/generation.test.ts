import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GenerationError, requestError, retryRequest, runGenerationQueue, delay } from './generation';

test('短暂错误最多三次，退避遵守 Retry-After，不重试无效声音和权限', async () => {
  const controller = new AbortController();
  const waits: number[] = [];
  let calls = 0;
  const error = requestError({ response: { status: 429, data: { msg: '繁忙' }, headers: { 'retry-after': '3' } } });
  const result = await retryRequest(
    async () => {
      if (++calls < 3) throw error;
      return 'audio';
    },
    {
      signal: controller.signal,
      wait: async ms => {
        waits.push(ms);
      }
    }
  );
  assert.equal(result, 'audio');
  assert.deepEqual(waits, [3000, 3000]);
  calls = 0;
  await assert.rejects(
    retryRequest(
      async () => {
        calls++;
        throw error;
      },
      { signal: controller.signal, wait: async () => {} }
    )
  );
  assert.equal(calls, 3);
  for (const status of [400, 401, 403, 404]) assert.equal(requestError({ response: { status } }).recoverable, false);
  assert.equal(requestError({ code: 'ECONNABORTED' }).recoverable, true);
  assert.equal(requestError({ response: { status: 500, data: { msg: '音色不存在' } } }).recoverable, false);
});

test('一段失败不阻断后续，已完成音频不重做，失败重试保持相同角色', async () => {
  const signal = new AbortController().signal;
  const items = [
    { id: 'ready', voice: 'A' },
    { id: 'bad', voice: 'B' },
    { id: 'good', voice: 'C' }
  ];
  const ready = new Set(['ready']);
  const failures: string[] = [];
  const calls: string[] = [];
  const run = () =>
    runGenerationQueue(items, {
      signal,
      ready: item => ready.has(item.id),
      beforeItem: async () => {},
      generate: async item => {
        calls.push(item.voice);
        if (item.id === 'bad' && !failures.length) throw new GenerationError('失败');
        ready.add(item.id);
      },
      failed: item => {
        failures.push(item.id);
      }
    });
  await run();
  assert.deepEqual(calls, ['B', 'C']);
  assert.deepEqual(failures, ['bad']);
  await run();
  assert.deepEqual(calls, ['B', 'C', 'B']);
});

test('停止生成会中断退避，不再发起下一次请求，也不会继续后续句', async () => {
  const controller = new AbortController();
  let calls = 0;
  const pending = runGenerationQueue([1, 2], {
    signal: controller.signal,
    ready: () => false,
    beforeItem: async () => {},
    generate: () =>
      retryRequest(
        async () => {
          calls++;
          throw new GenerationError('繁忙', 503, 0, true);
        },
        {
          signal: controller.signal,
          onRetry: () => {
            controller.abort();
          }
        }
      ),
    failed: () => assert.fail('取消不能记成失败')
  });
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(calls, 1);
});

test('暂停门控在下一句和重试前生效，恢复后才继续', async () => {
  const controller = new AbortController();
  let resume!: () => void;
  const paused = new Promise<void>(resolve => {
    resume = resolve;
  });
  let calls = 0;
  const pending = retryRequest(
    async () => {
      calls++;
      return 'audio';
    },
    {
      signal: controller.signal,
      beforeAttempt: () => paused
    }
  );
  await Promise.resolve();
  assert.equal(calls, 0);
  resume();
  assert.equal(await pending, 'audio');
  const waiting = delay(30000, controller.signal);
  controller.abort();
  await assert.rejects(waiting, { name: 'AbortError' });
});
