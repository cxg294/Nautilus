/**
 * TTS Studio — 核心 composable
 *
 * 封装 Gradio SSE v3 调用协议：
 *   1. 上传文件 → POST /api/tts/upload/:service
 *   2. 提交任务 → POST /api/tts/call/:service/:apiName
 *   3. SSE 取结果 → GET /api/tts/result/:service/:apiName/:eventId
 */
import { ref } from 'vue';
import { useMessage } from 'naive-ui';

export type TtsService = 'base' | 'custom' | 'design';

export interface TtsResult {
  audioUrl: string;
  status: string;
}

/**
 * 上传音频文件到 Gradio 服务端
 */
export async function uploadAudio(service: TtsService, file: File): Promise<string[]> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`/api/tts/upload/${service}`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: '上传失败' }));
    throw new Error(err.error || '上传失败');
  }

  return res.json(); // Gradio 返回文件路径数组
}

/**
 * 调用 TTS 合成 — 完整的 SSE v3 两步流程
 */
export async function callTts(
  service: TtsService,
  apiName: string,
  data: any[]
): Promise<TtsResult> {
  // Step 1: 提交任务
  const submitRes = await fetch(`/api/tts/call/${service}/${apiName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  });

  if (!submitRes.ok) {
    const err = await submitRes.json().catch(() => ({ error: '提交失败' }));
    throw new Error(err.error || '提交任务失败');
  }

  const { event_id } = await submitRes.json();
  if (!event_id) throw new Error('未获取到 event_id');

  // Step 2: SSE 获取结果
  return new Promise((resolve, reject) => {
    const evtSource = new EventSource(
      `/api/tts/result/${service}/${apiName}/${event_id}`
    );

    const timeout = setTimeout(() => {
      evtSource.close();
      reject(new Error('合成超时(60s)，请重试'));
    }, 60000);

    evtSource.addEventListener('complete', (e: MessageEvent) => {
      clearTimeout(timeout);
      evtSource.close();

      try {
        const resultData = JSON.parse(e.data);
        // Gradio 返回 [audioFileData, statusText]
        const audioData = resultData[0];
        const statusText = resultData[1] || '';

        if (!audioData?.url && !audioData?.path) {
          throw new Error(statusText || '合成失败，未返回音频');
        }

        // 构造音频下载 URL
        const audioUrl = audioData.url
          ? proxyAudioUrl(service, audioData.url)
          : `/api/tts/file/${service}?path=${encodeURIComponent(audioData.path)}`;

        resolve({ audioUrl, status: statusText });
      } catch (err: any) {
        reject(new Error(err.message || '解析结果失败'));
      }
    });

    evtSource.addEventListener('error', (e: MessageEvent) => {
      clearTimeout(timeout);
      evtSource.close();
      // Gradio 错误事件可能带消息
      const msg = e.data ? String(e.data) : '合成出错';
      reject(new Error(msg));
    });

    evtSource.onerror = () => {
      clearTimeout(timeout);
      evtSource.close();
      reject(new Error('SSE 连接中断'));
    };
  });
}

/**
 * 将 Gradio 返回的绝对 URL 转换为代理 URL
 * Gradio URL: http://10.64.128.6:8001/gradio_api/file=/tmp/xxx.wav
 * → /api/tts/file/custom?path=/tmp/xxx.wav
 */
function proxyAudioUrl(service: TtsService, gradioUrl: string): string {
  try {
    const url = new URL(gradioUrl);
    // 路径格式: /gradio_api/file=/tmp/gradio/xxx.wav 或 /file=/tmp/xxx.wav
    const match = url.pathname.match(/file=(.+)/);
    if (match) {
      return `/api/tts/file/${service}?path=${encodeURIComponent(match[1])}`;
    }
    // fallback: 直接用完整路径
    return `/api/tts/file/${service}?path=${encodeURIComponent(url.pathname)}`;
  } catch {
    return `/api/tts/file/${service}?path=${encodeURIComponent(gradioUrl)}`;
  }
}

/* ─── 语种选项 ─── */
export const LANGUAGE_OPTIONS = [
  { label: '自动识别', value: 'Auto' },
  { label: '中文', value: 'Chinese' },
  { label: 'English', value: 'English' },
  { label: '日本語', value: 'Japanese' },
  { label: '한국어', value: 'Korean' },
  { label: 'Français', value: 'French' },
  { label: 'Deutsch', value: 'German' },
  { label: 'Español', value: 'Spanish' },
  { label: 'Italiano', value: 'Italian' },
  { label: 'Português', value: 'Portuguese' },
  { label: 'Русский', value: 'Russian' },
];

/* ─── 预设说话人 ─── */
export const SPEAKERS = [
  { id: 'Serena', name: 'Serena', desc: '温柔知性女声', icon: '👩‍💼' },
  { id: 'Vivian', name: 'Vivian', desc: '活泼甜美女声', icon: '👧' },
  { id: 'Ono Anna', name: 'Ono Anna', desc: '日系女声', icon: '🎌' },
  { id: 'Sohee', name: 'Sohee', desc: '韩系女声', icon: '🇰🇷' },
  { id: 'Ryan', name: 'Ryan', desc: '成熟男声', icon: '👨‍💼' },
  { id: 'Aiden', name: 'Aiden', desc: '年轻阳光男声', icon: '🧑' },
  { id: 'Eric', name: 'Eric', desc: '磁性男声', icon: '🎙️' },
  { id: 'Dylan', name: 'Dylan', desc: '深沉男声', icon: '🎵' },
  { id: 'Uncle Fu', name: 'Uncle Fu', desc: '中年男声', icon: '👴' },
];

/* ─── 通用 composable ─── */
export function useTts() {
  const message = useMessage();
  const loading = ref(false);
  const result = ref<TtsResult | null>(null);
  const error = ref('');

  const synthesize = async (
    service: TtsService,
    apiName: string,
    data: any[]
  ) => {
    loading.value = true;
    result.value = null;
    error.value = '';

    try {
      result.value = await callTts(service, apiName, data);
      message.success('语音合成完成！');
    } catch (err: any) {
      error.value = err.message;
      message.error(`合成失败：${err.message}`);
    } finally {
      loading.value = false;
    }
  };

  const reset = () => {
    result.value = null;
    error.value = '';
  };

  return { loading, result, error, synthesize, reset };
}
