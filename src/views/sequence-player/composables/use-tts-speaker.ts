/**
 * TTS 语音控制 — 浏览器 SpeechSynthesis 封装
 *
 * 使用浏览器原生 TTS 完成逐字稿播放朗读。
 */
import { ref, onUnmounted } from 'vue';

export interface SpeakOptions {
  voiceName?: string;
  rate?: number;
  pitch?: number;
}

export function useTtsSpeaker() {
  const isSpeaking = ref(false);
  const availableVoices = ref<SpeechSynthesisVoice[]>([]);
  const selectedVoiceName = ref<string>('');
  const rate = ref(1.0);
  const pitch = ref(1.0);

  // 加载可用声音
  function loadVoices() {
    const voices = window.speechSynthesis?.getVoices() || [];
    availableVoices.value = voices;
    // 默认选择中文声音
    if (!selectedVoiceName.value) {
      const zhVoice = voices.find(v =>
        v.lang.startsWith('zh') || v.lang.startsWith('cmn')
      );
      if (zhVoice) selectedVoiceName.value = zhVoice.name;
    }
  }

  // 部分浏览器异步加载声音
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }

  /** 当前取消控制 */
  let _rejectFn: (() => void) | null = null;

  /**
   * 朗读文本，返回 Promise 等待朗读完成
   */
  function speak(text: string, options?: string | SpeakOptions): Promise<void> {
    return new Promise(resolve => {
      if (!window.speechSynthesis || !text.trim()) {
        resolve();
        return;
      }

      // 如果还在说，先停
      cancel();

      const utterance = new SpeechSynthesisUtterance(text);

      // 设置声音
      const opts = typeof options === 'string' ? { voiceName: options } : options;
      const vName = opts?.voiceName || selectedVoiceName.value;
      if (vName) {
        const voice = availableVoices.value.find(v => v.name === vName);
        if (voice) utterance.voice = voice;
      }

      utterance.rate = opts?.rate || rate.value;
      utterance.pitch = opts?.pitch || pitch.value;
      utterance.lang = 'zh-CN';

      utterance.onstart = () => {
        isSpeaking.value = true;
      };

      utterance.onend = () => {
        isSpeaking.value = false;
        _rejectFn = null;
        resolve();
      };

      utterance.onerror = (e) => {
        isSpeaking.value = false;
        _rejectFn = null;
        // cancelled 不算错误
        if (e.error === 'canceled' || e.error === 'interrupted') {
          resolve();
        } else {
          resolve(); // 吞错误，不阻断播放
        }
      };

      _rejectFn = () => {
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  }

  /** 取消当前朗读 */
  function cancel() {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    isSpeaking.value = false;
    _rejectFn?.();
    _rejectFn = null;
  }

  // 清理
  onUnmounted(() => {
    cancel();
  });

  return {
    isSpeaking,
    availableVoices,
    selectedVoiceName,
    rate,
    pitch,
    speak,
    cancel,
    loadVoices,
  };
}
