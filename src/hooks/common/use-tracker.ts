/**
 * 埋点 Vue Composable
 *
 * 提供两个 composable：
 * - usePageTracker(toolName)  — 自动追踪页面停留时长
 * - useActionTracker(toolName) — 返回操作追踪方法
 *
 * 用法示例：
 * ```ts
 * // 在 setup 中调用
 * usePageTracker('qrcode-generator')
 * const { trackAction } = useActionTracker('qrcode-generator')
 *
 * // 在操作成功时调用
 * trackAction('generate', 'success', { format: 'png' })
 * ```
 */

import { onMounted, onBeforeUnmount } from 'vue';
import { trackPageView, trackPageLeave, trackAction as rawTrackAction } from '@/utils/tracker';

/**
 * 自动追踪页面访问和停留时长
 *
 * 在 onMounted 时记录进入，onBeforeUnmount 时计算停留时长
 */
export function usePageTracker(toolName: string): void {
  let enterTime = 0;

  onMounted(() => {
    enterTime = Date.now();
    trackPageView(toolName);
  });

  onBeforeUnmount(() => {
    if (enterTime > 0) {
      const duration = (Date.now() - enterTime) / 1000;
      trackPageLeave(toolName, duration);
    }
  });
}

/**
 * 返回操作追踪方法
 *
 * 绑定了 toolName，使用时只需传 actionName
 */
export function useActionTracker(toolName: string) {
  function trackAction(
    actionName: string,
    result: 'success' | 'fail' = 'success',
    meta?: Record<string, unknown>
  ): void {
    rawTrackAction(toolName, actionName, result, meta);
  }

  return { trackAction };
}
