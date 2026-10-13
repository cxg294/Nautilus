/**
 * 播放器引擎 — 核心状态机
 *
 * 控制播放进度、步骤推进、自动/手动模式
 *
 * 状态转换：
 *   idle → ready (加载脚本)
 *   ready → playing (播放)
 *   playing → paused (暂停)
 *   paused → playing (恢复)
 *   playing → ready (停止)
 *   any → ready (重新加载)
 */
import { ref, computed, shallowRef } from 'vue';
import type { Step, PlayerStatus, Character, ProjectSettings } from '../types/sequence';

export interface PlayerEngineOptions {
  /** 当步骤切换时回调 */
  onStepChange?: (step: Step, index: number) => void;
  /** 当播放完成时回调 */
  onComplete?: () => void;
  /** 当需要 TTS 播放时回调，返回 Promise 等待播放完成 */
  onSpeak?: (text: string, characterName?: string) => Promise<void>;
}

export function usePlayerEngine(options: PlayerEngineOptions = {}) {
  // ---- 核心状态 ----
  const status = ref<PlayerStatus>('idle');
  const steps = shallowRef<Step[]>([]);
  const characters = ref<Character[]>([]);
  const currentIndex = ref(-1);
  const visibleChars = ref(0);

  // ---- 设置 ----
  const settings = ref<ProjectSettings>({
    backgroundKey: 'classroom',
    globalRate: 1.0,
    typingSpeed: 60,
    defaultPause: 300,
  });

  // ---- 内部 ----
  let _typingTimer: ReturnType<typeof setInterval> | null = null;
  let _pauseTimer: ReturnType<typeof setTimeout> | null = null;
  let _isAdvancing = false;
  let _cancelled = false;

  // ---- 计算属性 ----

  const currentStep = computed<Step | null>(() => {
    const idx = currentIndex.value;
    return idx >= 0 && idx < steps.value.length ? steps.value[idx] : null;
  });

  const totalSteps = computed(() => steps.value.length);

  const isFirstStep = computed(() => currentIndex.value <= 0);
  const isLastStep = computed(() => currentIndex.value >= steps.value.length - 1);

  /** 当前说话角色 */
  const currentCharacter = computed<Character | null>(() => {
    const step = currentStep.value;
    if (!step?.characterName) return null;
    return characters.value.find(c => c.name === step.characterName) || null;
  });

  /** 当前造型名 */
  const currentPoseName = computed<string | null>(() => {
    const step = currentStep.value;
    return step?.poseName || null;
  });

  /** 当前字幕文本（打字机效果：只显示 visibleChars 个字） */
  const displayText = computed(() => {
    const step = currentStep.value;
    if (!step || step.type !== 'dialogue') return '';
    const text = step.text;
    return text.slice(0, visibleChars.value);
  });

  /** 打字机是否完成 */
  const isTypingDone = computed(() => {
    const step = currentStep.value;
    if (!step || step.type !== 'dialogue') return true;
    return visibleChars.value >= step.text.length;
  });

  /** 进度百分比 */
  const progress = computed(() => {
    if (steps.value.length === 0) return 0;
    return Math.round(((currentIndex.value + 1) / steps.value.length) * 100);
  });

  // ============================================================
  // 公共方法
  // ============================================================

  /** 加载脚本数据 */
  function load(newSteps: Step[], newCharacters: Character[], newSettings?: Partial<ProjectSettings>) {
    stop();
    steps.value = newSteps;
    characters.value = newCharacters;
    if (newSettings) {
      settings.value = { ...settings.value, ...newSettings };
    }
    currentIndex.value = newSteps.length > 0 ? 0 : -1;
    visibleChars.value = 0;
    status.value = newSteps.length > 0 ? 'ready' : 'idle';
    _cancelled = false;
  }

  /** 开始播放 */
  async function play() {
    if (status.value === 'idle' || steps.value.length === 0) return;

    if (status.value === 'ready' && currentIndex.value < 0) {
      currentIndex.value = 0;
    }

    status.value = 'playing';
    _cancelled = false;
    await advanceLoop();
  }

  /** 暂停 */
  function pause() {
    if (status.value !== 'playing') return;
    status.value = 'paused';
    _cancelled = true;
    clearTimers();
  }

  /** 恢复播放 */
  async function resume() {
    if (status.value !== 'paused') return;
    status.value = 'playing';
    _cancelled = false;
    await advanceLoop();
  }

  /** 停止（回到开头） */
  function stop() {
    _cancelled = true;
    clearTimers();
    status.value = steps.value.length > 0 ? 'ready' : 'idle';
    currentIndex.value = steps.value.length > 0 ? 0 : -1;
    visibleChars.value = 0;
  }

  /** 跳转到指定步骤 */
  function goTo(index: number) {
    if (index < 0 || index >= steps.value.length) return;
    const wasPlaying = status.value === 'playing';
    clearTimers();
    _cancelled = true;

    currentIndex.value = index;
    visibleChars.value = 0;

    if (wasPlaying) {
      // 继续播放新位置
      status.value = 'playing';
      _cancelled = false;
      advanceLoop();
    } else {
      // 如果暂停中或 ready 中，仅跳转不自动播
      visibleChars.value = steps.value[index]?.text?.length || 0;
    }

    options.onStepChange?.(steps.value[index], index);
  }

  /** 下一步 */
  function next() {
    if (currentIndex.value >= steps.value.length - 1) return;
    goTo(currentIndex.value + 1);
  }

  /** 上一步 */
  function prev() {
    if (currentIndex.value <= 0) return;
    goTo(currentIndex.value - 1);
  }

  /** 切换播放/暂停 */
  async function togglePlay() {
    if (status.value === 'playing') {
      pause();
    } else if (status.value === 'paused') {
      await resume();
    } else {
      await play();
    }
  }

  // ============================================================
  // 内部方法
  // ============================================================

  /** 主播放循环 */
  async function advanceLoop() {
    if (_isAdvancing) return;
    _isAdvancing = true;

    try {
      while (status.value === 'playing') {
        if (_cancelled) break;
        const idx = currentIndex.value;
        if (idx < 0 || idx >= steps.value.length) {
          // 播放完毕
          status.value = 'ready';
          options.onComplete?.();
          break;
        }

        const step = steps.value[idx];
        options.onStepChange?.(step, idx);

        // 执行当前步骤
        await executeStep(step);

        if (_cancelled) break;

        // 台词间停顿
        if (step.type === 'dialogue') {
          await delay(settings.value.defaultPause);
        }

        if (_cancelled) break;

        // 推进到下一步
        if (idx >= steps.value.length - 1) {
          status.value = 'ready';
          currentIndex.value = 0;
          visibleChars.value = 0;
          options.onComplete?.();
          break;
        }

        currentIndex.value = idx + 1;
        visibleChars.value = 0;
      }
    } finally {
      _isAdvancing = false;
    }
  }

  /** 执行单个步骤 */
  async function executeStep(step: Step): Promise<void> {
    switch (step.type) {
      case 'dialogue':
        // 1. 打字机效果
        await runTypingEffect(step.text);
        if (_cancelled) return;
        // 2. TTS 朗读
        if (options.onSpeak && step.speakText) {
          await options.onSpeak(step.speakText, step.characterName);
        }
        break;

      case 'wait':
        await delay(step.duration || 1000);
        break;

      case 'narration':
        await runTypingEffect(step.text);
        if (_cancelled) return;
        if (options.onSpeak && step.speakText) {
          await options.onSpeak(step.speakText);
        }
        break;

      case 'direction':
        // 舞台指令仅短暂显示
        await delay(500);
        break;
    }
  }

  /** 打字机效果 */
  function runTypingEffect(text: string): Promise<void> {
    return new Promise((resolve) => {
      visibleChars.value = 0;
      const totalChars = text.length;
      if (totalChars === 0) {
        resolve();
        return;
      }

      _typingTimer = setInterval(() => {
        if (_cancelled) {
          clearTimers();
          resolve();
          return;
        }

        visibleChars.value++;
        if (visibleChars.value >= totalChars) {
          if (_typingTimer) clearInterval(_typingTimer);
          _typingTimer = null;
          resolve();
        }
      }, settings.value.typingSpeed);
    });
  }

  /** 延迟工具 */
  function delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      _pauseTimer = setTimeout(() => {
        _pauseTimer = null;
        resolve();
      }, ms);
    });
  }

  /** 清理所有定时器 */
  function clearTimers() {
    if (_typingTimer) {
      clearInterval(_typingTimer);
      _typingTimer = null;
    }
    if (_pauseTimer) {
      clearTimeout(_pauseTimer);
      _pauseTimer = null;
    }
  }

  return {
    // 状态
    status,
    steps,
    characters,
    currentIndex,
    currentStep,
    currentCharacter,
    currentPoseName,
    displayText,
    isTypingDone,
    progress,
    totalSteps,
    isFirstStep,
    isLastStep,
    settings,

    // 方法
    load,
    play,
    pause,
    resume,
    stop,
    goTo,
    next,
    prev,
    togglePlay,
  };
}
