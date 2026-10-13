import { ref, onBeforeUnmount, onDeactivated, type Ref } from 'vue';
import { request } from '@/service/request';
import { fetchVoiceLabStatus } from '@/service/api/voice-lab';
import { isReady, roleFor, safeAudioUrl, segmentDuration, type WorkshopState } from './model';

/** 通过已有 request 获取受保护音频，令牌不进入项目数据或导出文件。 */
export async function loadAudioBlob(url: string, signal?: AbortSignal): Promise<Blob> {
  if (!safeAudioUrl(url)) throw new Error('音频地址不属于当前语音实验室，请重新生成');
  const fetchBlob = () => request<Blob, 'blob'>({ url: url.replace(/^\/api/, ''), responseType: 'blob', signal });
  let result = await fetchBlob();
  if (!result.error && result.data?.type.includes('json')) {
    // 二进制响应无法走通用业务错误码判断，用 JSON 状态接口完成过期令牌刷新再重试。
    const status = await fetchVoiceLabStatus();
    if (status.error) throw new Error('登录状态已过期，请重新登录');
    result = await fetchBlob();
  }
  if (result.error || !result.data || result.data.type.includes('json'))
    throw new Error('音频读取失败，请重新生成此句');
  return result.data;
}

export async function measureAudio(blob: Blob, signal?: AbortSignal): Promise<number> {
  if (signal?.aborted) throw new DOMException('已停止生成', 'AbortError');
  const url = URL.createObjectURL(blob);
  const audio = new Audio();
  let timer: ReturnType<typeof setTimeout>;
  let abort: () => void = () => {};
  try {
    return await new Promise((resolve, reject) => {
      abort = () => reject(new DOMException('已停止生成', 'AbortError'));
      signal?.addEventListener('abort', abort, { once: true });
      timer = setTimeout(() => reject(new Error('音频时长读取超时')), 15000);
      audio.onloadedmetadata = () => {
        if (Number.isFinite(audio.duration) && audio.duration > 0) resolve(Math.round(audio.duration * 1000));
        else reject(new Error('生成的音频没有有效时长'));
      };
      audio.onerror = () => reject(new Error('生成的音频无法解码'));
      audio.src = url;
      audio.load();
    });
  } finally {
    clearTimeout(timer!);
    signal?.removeEventListener('abort', abort);
    audio.onloadedmetadata = null;
    audio.onerror = null;
    audio.removeAttribute('src');
    audio.load();
    URL.revokeObjectURL(url);
  }
}

export function useWorkshopPlayback(state: Ref<WorkshopState>, onError: (message: string) => void) {
  const currentIndex = ref(0);
  const status = ref<'idle' | 'loading' | 'playing' | 'paused'>('idle');
  const elapsedMs = ref(0);
  let controller: AbortController | null = null;
  let audio: HTMLAudioElement | null = null;
  let objectUrl = '';
  let pausedFrom: 'loading' | 'playing' = 'playing';
  let disposed = false;
  const isPaused = () => status.value === 'paused';
  const offsetAt = (index: number) =>
    state.value.segments
      .slice(0, index)
      .reduce((sum, segment) => sum + segmentDuration(segment, roleFor(state.value, segment)), 0);
  function cleanupAudio() {
    if (audio) {
      audio.pause();
      audio.onended = null;
      audio.onerror = null;
      audio.ontimeupdate = null;
      audio.removeAttribute('src');
      audio.load();
      audio = null;
    }
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = '';
    }
  }
  function stop() {
    controller?.abort();
    controller = null;
    cleanupAudio();
    status.value = 'idle';
  }
  function select(index: number) {
    stop();
    currentIndex.value = Math.max(0, Math.min(index, state.value.segments.length - 1));
    elapsedMs.value = offsetAt(currentIndex.value);
  }
  async function wait(ms: number, signal: AbortSignal, start = elapsedMs.value) {
    let completed = 0;
    let last = performance.now();
    while (completed < ms) {
      if (signal.aborted || disposed) throw new DOMException('Stopped', 'AbortError');
      await new Promise(resolve => setTimeout(resolve, 30));
      const now = performance.now();
      if (status.value !== 'paused') {
        completed += now - last;
        elapsedMs.value = start + Math.min(ms, completed);
      }
      last = now;
    }
  }
  async function waitUntilResumed(signal: AbortSignal) {
    while (status.value === 'paused') {
      if (signal.aborted || disposed) throw new DOMException('Stopped', 'AbortError');
      await new Promise(resolve => setTimeout(resolve, 40));
    }
    if (signal.aborted || disposed) throw new DOMException('Stopped', 'AbortError');
  }
  async function play(index = currentIndex.value, single = false) {
    stop();
    const control = new AbortController();
    controller = control;
    const signal = control.signal;
    status.value = 'loading';
    try {
      for (let i = index; i < state.value.segments.length; i++) {
        if (signal.aborted) return;
        currentIndex.value = i;
        elapsedMs.value = offsetAt(i);
        const segment = state.value.segments[i];
        if (segment.kind !== 'dialogue') {
          status.value = 'playing';
          await wait(segmentDuration(segment), signal);
        } else {
          if (!isReady(segment, roleFor(state.value, segment))) throw new Error(`第 ${i + 1} 句还没有配音，请先生成`);
          for (const unit of segment.audio!.units) {
            const start = elapsedMs.value;
            if (!isPaused()) status.value = 'loading';
            const blob = await loadAudioBlob(unit.url, signal);
            await waitUntilResumed(signal);
            objectUrl = URL.createObjectURL(blob);
            const active = new Audio(objectUrl);
            audio = active;
            status.value = 'playing';
            await new Promise<void>((resolve, reject) => {
              const abort = () => {
                active.pause();
                reject(new DOMException('Stopped', 'AbortError'));
              };
              signal.addEventListener('abort', abort, { once: true });
              active.ontimeupdate = () => {
                if (!signal.aborted) elapsedMs.value = start + Math.min(unit.durationMs, active.currentTime * 1000);
              };
              active.onended = () => {
                signal.removeEventListener('abort', abort);
                resolve();
              };
              active.onerror = () => {
                signal.removeEventListener('abort', abort);
                reject(new Error(`第 ${i + 1} 句音频无法播放，请重新生成`));
              };
              active.play().catch(error => {
                signal.removeEventListener('abort', abort);
                reject(error);
              });
            });
            cleanupAudio();
            elapsedMs.value = start + unit.durationMs;
            if (unit.pauseAfterMs) await wait(unit.pauseAfterMs, signal);
          }
          if (!single) await wait(segment.pauseAfterMs, signal);
        }
        if (single) break;
      }
    } catch (error: any) {
      if (!signal.aborted) onError(error.message || '播放失败');
    } finally {
      if (controller === control) {
        cleanupAudio();
        controller = null;
        status.value = 'idle';
      }
    }
  }
  async function toggle() {
    if (status.value === 'idle')
      return play(elapsedMs.value >= offsetAt(state.value.segments.length) ? 0 : currentIndex.value);
    if (status.value === 'paused') {
      status.value = pausedFrom;
      if (audio) {
        status.value = 'playing';
        try {
          await audio.play();
        } catch {
          stop();
          onError('浏览器未允许播放，请再次点击播放');
        }
      }
    } else {
      pausedFrom = status.value;
      status.value = 'paused';
      audio?.pause();
    }
  }
  function seek(ms: number) {
    let passed = 0;
    let index = state.value.segments.length - 1;
    for (let i = 0; i < state.value.segments.length; i++) {
      passed += segmentDuration(state.value.segments[i], roleFor(state.value, state.value.segments[i]));
      if (ms < passed) {
        index = i;
        break;
      }
    }
    const wasPlaying = status.value === 'playing' || status.value === 'loading';
    select(index);
    if (wasPlaying) void play(index);
  }
  onDeactivated(stop);
  onBeforeUnmount(() => {
    disposed = true;
    stop();
  });
  return { currentIndex, status, elapsedMs, play, stop, select, toggle, seek };
}
