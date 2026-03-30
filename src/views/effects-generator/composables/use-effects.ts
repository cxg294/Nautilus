import { ref, computed, type Ref } from 'vue';
import type { ISourceOptions } from '@tsparticles/engine';
import type { BurstConfig, LifeCurve, SizeMode } from './use-burst-particles';

/** 特效类型 */
export type EffectType = 'burst' | 'ambient';

/** 预设效果定义 */
export interface EffectPreset {
  /** 预设唯一 key */
  key: string;
  /** 多语言 key */
  i18nKey: string;
  /** 特效类型 */
  type: EffectType;
  /** tsParticles 配置（ambient 类型用） */
  options?: ISourceOptions;
  /** 爆发配置（burst 类型用） */
  burstConfig?: BurstConfig;
  /** 默认背景色 */
  background: string;
}

/** 可调节参数 */
export interface EffectParams {
  /** 粒子数量 */
  particleCount: number;
  /** 运动速度 */
  speed: number;
  /** 粒子大小 */
  size: number;
  /** 透明度 0~1 */
  opacity: number;
  /** 重力 */
  gravity: number;
  /** 背景色 */
  background: string;
  /** 边缘柔化度 0~1 */
  softness: number;
  /** 生命衰减曲线 */
  lifeCurve: LifeCurve;
  /** 大小衰减模式 */
  sizeMode: SizeMode;
  /** 颜色渐变终点色（空字符串=不启用） */
  colorGradient: string;
}

/** 默认参数 */
const defaultParams: EffectParams = {
  particleCount: 50,
  speed: 3,
  size: 4,
  opacity: 0.8,
  gravity: 0.5,
  background: '#0d1117',
  softness: 0,
  lifeCurve: 'easeOut',
  sizeMode: 'shrink',
  colorGradient: ''
};

// ============================================================
// 点击爆发特效 — 点一下就 BOOM！
// ============================================================

const burstPresets: Record<string, { burstConfig: BurstConfig; background: string }> = {
  'star-burst': {
    background: '#0a0a1a',
    burstConfig: {
      count: 35,
      shapes: ['star'],
      colors: ['#FFD700', '#FFA500', '#FFEC8B', '#FFE4B5', '#FFFFFF', '#FFC125'],
      life: [0.8, 1.8],
      size: [6, 18],
      speed: [150, 400],
      gravity: 0.8,
      friction: 0.97,
      glow: true,
      trail: true,
      softness: 0.4,
      lifeCurve: 'easeOut',
      sizeMode: 'shrink'
    }
  },

  'confetti-pop': {
    background: '#0d1117',
    burstConfig: {
      count: 50,
      shapes: ['square', 'circle', 'diamond'],
      colors: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96E6A1', '#FDCB6E', '#E056A0', '#A29BFE', '#FF9FF3', '#54A0FF'],
      life: [1.5, 3.0],
      size: [5, 12],
      speed: [100, 350],
      gravity: 1.2,
      friction: 0.98,
      lifeCurve: 'linear',
      sizeMode: 'constant'
    }
  },

  'heart-burst': {
    background: '#1a0a14',
    burstConfig: {
      count: 25,
      shapes: ['heart'],
      colors: ['#FF1493', '#FF69B4', '#FF6EB4', '#FF82AB', '#FFB6C1', '#DC143C', '#FF4081'],
      life: [1.0, 2.0],
      size: [8, 20],
      speed: [120, 300],
      gravity: 0.6,
      friction: 0.96,
      glow: true,
      softness: 0.6,
      lifeCurve: 'easeInOut',
      sizeMode: 'pop'
    }
  },

  'sparkle-flash': {
    background: '#06061a',
    burstConfig: {
      count: 60,
      shapes: ['circle', 'star', 'spark'],
      colors: ['#FFFFFF', '#F0F8FF', '#E6E6FA', '#E0FFFF', '#B0E0E6', '#87CEFA', '#FFD700'],
      life: [0.3, 0.9],
      size: [2, 8],
      speed: [200, 500],
      gravity: 0.1,
      friction: 0.94,
      glow: true,
      trail: true,
      softness: 0.8,
      lifeCurve: 'pulse',
      sizeMode: 'constant'
    }
  },

  'firework-click': {
    background: '#050510',
    burstConfig: {
      count: 8,
      shapes: ['spark'],
      colors: ['#FFAA00', '#FF8800', '#FFCC44'],
      life: [0.4, 0.6],
      size: [3, 5],
      speed: [200, 350],
      gravity: 0,
      friction: 0.95,
      trail: true,
      angleRange: [-Math.PI * 0.8, -Math.PI * 0.2] as [number, number],
      // 每个火花在消失前的位置产生二次爆炸
      secondaryBurst: {
        count: 40,
        shapes: ['circle', 'star'],
        colors: ['#FF4444', '#44FF44', '#4444FF', '#FFFF44', '#FF44FF', '#44FFFF', '#FFD700', '#FF6347'],
        life: [0.8, 1.6],
        size: [3, 8],
        speed: [80, 250],
        gravity: 1.0,
        friction: 0.97,
        glow: true,
        trail: true
      }
    }
  },

  'lightning-spark': {
    background: '#05050f',
    burstConfig: {
      count: 45,
      shapes: ['spark', 'circle'],
      colors: ['#00BFFF', '#1E90FF', '#87CEEB', '#ADD8E6', '#FFFFFF', '#7DF9FF', '#00CED1'],
      life: [0.2, 0.6],
      size: [2, 10],
      speed: [300, 600],
      gravity: 0,
      friction: 0.92,
      glow: true,
      trail: true,
      softness: 0.3,
      lifeCurve: 'easeIn',
      sizeMode: 'grow',
      colorGradient: '#000033'
    }
  },

  'rainbow-burst': {
    background: '#0a0a14',
    burstConfig: {
      count: 50,
      shapes: ['circle', 'ring', 'diamond'],
      colors: ['#FF0000', '#FF7700', '#FFFF00', '#00FF00', '#0000FF', '#8B00FF', '#FF00FF'],
      life: [1.0, 2.5],
      size: [4, 14],
      speed: [100, 350],
      gravity: 0.5,
      friction: 0.96,
      glow: true,
      softness: 0.5,
      lifeCurve: 'easeInOut',
      sizeMode: 'shrink'
    }
  },

  'gold-coins': {
    background: '#0d0d00',
    burstConfig: {
      count: 30,
      shapes: ['circle', 'ring'],
      colors: ['#FFD700', '#DAA520', '#B8860B', '#FFA500', '#F4A460', '#FFEC8B'],
      life: [1.2, 2.5],
      size: [6, 16],
      speed: [100, 300],
      gravity: 1.5,
      friction: 0.98,
      glow: true,
      angleRange: [-Math.PI, 0] as [number, number],
      lifeCurve: 'easeOut',
      sizeMode: 'constant',
      colorGradient: '#8B4513'
    }
  }
};

// ============================================================
// 背景氛围特效 — 加入鼠标交互
// ============================================================

const ambientPresets: Record<string, { options: ISourceOptions; background: string }> = {
  // 深空星云 — 多层粒子 + 连线 + twinkle 闪烁
  'deep-space': {
    background: '#020010',
    options: {
      background: { color: '#020010' },
      fullScreen: false,
      detectRetina: true,
      interactivity: {
        events: {
          onHover: { enable: true, mode: ['grab', 'bubble'] },
          onClick: { enable: true, mode: 'push' }
        },
        modes: {
          grab: { distance: 180, links: { opacity: 0.5, color: '#8b5cf6' } },
          bubble: { distance: 200, size: 6, duration: 0.3, opacity: 1 },
          push: { quantity: 4 }
        }
      },
      particles: {
        number: { value: 100, density: { enable: true } },
        color: { value: ['#ffffff', '#c4b5fd', '#a78bfa', '#818cf8', '#6366f1', '#fbbf24', '#f472b6'] },
        shape: { type: ['circle', 'star'] },
        opacity: {
          value: { min: 0.1, max: 1 },
          animation: { enable: true, speed: 0.5, sync: false }
        },
        size: {
          value: { min: 0.5, max: 4 },
          animation: { enable: true, speed: 1.5, sync: false }
        },
        links: {
          enable: true, distance: 120, color: '#6366f1',
          opacity: 0.15, width: 0.8
        },
        move: {
          enable: true, speed: 0.4, direction: 'none',
          random: true, outModes: { default: 'out' }
        },
        twinkle: {
          particles: { enable: true, frequency: 0.03, opacity: 1, color: { value: '#fbbf24' } }
        },
        shadow: { enable: true, color: '#6366f1', blur: 8 }
      }
    }
  },

  // 极光波浪 — 大颗渐变发光粒子缓慢飘浮
  aurora: {
    background: '#030614',
    options: {
      background: { color: '#030614' },
      fullScreen: false,
      detectRetina: true,
      interactivity: {
        events: {
          onHover: { enable: true, mode: 'repulse' },
          onClick: { enable: true, mode: 'push' }
        },
        modes: {
          repulse: { distance: 120, speed: 0.3, duration: 3 },
          push: { quantity: 3 }
        }
      },
      particles: {
        number: { value: 50, density: { enable: true } },
        color: {
          value: ['#22d3ee', '#06b6d4', '#0ea5e9', '#6366f1', '#8b5cf6', '#a855f7', '#34d399', '#10b981'],
          animation: { enable: true, speed: 3, sync: false }
        },
        shape: { type: 'circle' },
        opacity: {
          value: { min: 0.15, max: 0.6 },
          animation: { enable: true, speed: 0.3, sync: false }
        },
        size: {
          value: { min: 8, max: 40 },
          animation: { enable: true, speed: 2, sync: false }
        },
        move: {
          enable: true, speed: 0.6, direction: 'none',
          random: true, outModes: { default: 'out' },
          trail: { enable: true, length: 5, fill: { color: '#030614' } }
        },
        shadow: { enable: true, color: '#06b6d4', blur: 30 }
      }
    }
  },

  // 霓虹矩阵 — 发光连线网格 + 鼠标抓取交互
  'neon-matrix': {
    background: '#0a0a0a',
    options: {
      background: { color: '#0a0a0a' },
      fullScreen: false,
      detectRetina: true,
      interactivity: {
        events: {
          onHover: { enable: true, mode: 'grab' },
          onClick: { enable: true, mode: 'push' }
        },
        modes: {
          grab: { distance: 200, links: { opacity: 0.8, color: '#00ff88' } },
          push: { quantity: 3 }
        }
      },
      particles: {
        number: { value: 80, density: { enable: true } },
        color: { value: ['#00ff88', '#00ffcc', '#00ddff', '#0088ff', '#ffffff'] },
        shape: { type: 'circle' },
        opacity: { value: { min: 0.3, max: 0.8 } },
        size: { value: { min: 1, max: 3 } },
        links: {
          enable: true, distance: 150, color: '#00ff88',
          opacity: 0.25, width: 1,
          triangles: { enable: true, color: '#003322', opacity: 0.03 }
        },
        move: {
          enable: true, speed: 1.2, direction: 'none',
          random: false, outModes: { default: 'bounce' }
        },
        shadow: { enable: true, color: '#00ff88', blur: 12 }
      }
    }
  },

  // 赛博泡泡 — 半透明大气泡 + 弹跳 + 渐变色
  'cyber-bubbles': {
    background: '#0d0d1a',
    options: {
      background: { color: '#0d0d1a' },
      fullScreen: false,
      detectRetina: true,
      interactivity: {
        events: {
          onHover: { enable: true, mode: 'bubble' },
          onClick: { enable: true, mode: 'repulse' }
        },
        modes: {
          bubble: { distance: 200, size: 30, duration: 2, opacity: 0.6 },
          repulse: { distance: 300, speed: 1, duration: 1 }
        }
      },
      particles: {
        number: { value: 30, density: { enable: true } },
        color: {
          value: ['#f472b6', '#8b5cf6', '#60a5fa', '#34d399', '#fbbf24', '#fb923c'],
          animation: { enable: true, speed: 5, sync: false }
        },
        shape: { type: 'circle' },
        opacity: { value: { min: 0.1, max: 0.35 } },
        size: {
          value: { min: 15, max: 50 },
          animation: { enable: true, speed: 3, sync: false }
        },
        move: {
          enable: true, speed: 0.8, direction: 'none',
          random: true, outModes: { default: 'bounce' }
        },
        stroke: { width: 1, color: { value: '#ffffff', animation: { enable: true, speed: 5 } } },
        shadow: { enable: true, color: '#8b5cf6', blur: 25 }
      }
    }
  },

  // 火焰升腾 — 使用 emitter 从底部持续喷射
  'fire-rise': {
    background: '#0a0000',
    options: {
      background: { color: '#0a0000' },
      fullScreen: false,
      detectRetina: true,
      particles: {
        number: { value: 0 },
        color: { value: ['#ff4500', '#ff6600', '#ff8800', '#ffaa00', '#ffcc00', '#ffee00'] },
        shape: { type: 'circle' },
        opacity: {
          value: { min: 0.3, max: 1 },
          animation: { enable: true, speed: 1.5, sync: false, startValue: 'max', destroy: 'min' }
        },
        size: {
          value: { min: 2, max: 7 },
          animation: { enable: true, speed: 4, sync: false, startValue: 'max', destroy: 'min' }
        },
        life: { duration: { sync: false, value: { min: 0.5, max: 2 } }, count: 1 },
        move: {
          enable: true,
          gravity: { enable: true, acceleration: -5 },
          speed: { min: 3, max: 8 },
          direction: 'top',
          random: true,
          outModes: { default: 'destroy', bottom: 'none' }
        },
        shadow: { enable: true, color: '#ff4500', blur: 15 }
      },
      emitters: [
        {
          direction: 'top',
          life: { count: 0, duration: 0.1, delay: 0.01 },
          rate: { delay: 0.015, quantity: 3 },
          size: { width: 80, height: 0 },
          position: { y: 98, x: 50 }
        }
      ]
    }
  },

  // 能量喷泉 — 多彩粒子从底部喷射
  fountain: {
    background: '#050515',
    options: {
      background: { color: '#050515' },
      fullScreen: false,
      detectRetina: true,
      particles: {
        number: { value: 0 },
        color: { value: ['#00d2ff', '#3a7bd5', '#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe'] },
        shape: { type: ['circle', 'star'] },
        opacity: {
          value: { min: 0.4, max: 1 },
          animation: { enable: true, speed: 1, sync: false, startValue: 'max', destroy: 'min' }
        },
        size: {
          value: { min: 2, max: 6 },
          animation: { enable: true, speed: 3, sync: false, startValue: 'max', destroy: 'min' }
        },
        life: { duration: { sync: false, value: { min: 1, max: 3 } }, count: 1 },
        move: {
          enable: true,
          gravity: { enable: true, acceleration: 9.8 },
          speed: { min: 10, max: 22 },
          direction: 'top',
          outModes: { default: 'destroy', top: 'none' }
        },
        shadow: { enable: true, color: '#667eea', blur: 10 },
        twinkle: { particles: { enable: true, frequency: 0.1, opacity: 1 } }
      },
      emitters: {
        direction: 'top',
        life: { count: 0, duration: 0.1, delay: 0.01 },
        rate: { delay: 0.02, quantity: 3 },
        size: { width: 15, height: 0 },
        position: { y: 95, x: 50 }
      }
    }
  }
};

// ============================================================
// 导出 — 预设列表
// ============================================================

/** 所有预设列表 */
export const PRESET_LIST: EffectPreset[] = [
  // 点击特效
  ...Object.entries(burstPresets).map(([key, val]) => ({
    key,
    i18nKey: `page.effectsGenerator.presets.${key}` as string,
    type: 'burst' as EffectType,
    burstConfig: val.burstConfig,
    background: val.background
  })),
  // 背景特效
  ...Object.entries(ambientPresets).map(([key, val]) => ({
    key,
    i18nKey: `page.effectsGenerator.presets.${key}` as string,
    type: 'ambient' as EffectType,
    options: val.options,
    background: val.background
  }))
];

/** 按类型分组 */
export const BURST_PRESETS = PRESET_LIST.filter(p => p.type === 'burst');
export const AMBIENT_PRESETS = PRESET_LIST.filter(p => p.type === 'ambient');

/**
 * 特效管理组合式函数
 */
export function useEffects() {
  /** 当前激活的预设 key */
  const activePresetKey = ref('star-burst');

  /** 是否正在播放 */
  const isPlaying = ref(true);

  /** 当前参数 */
  const params: Ref<EffectParams> = ref({ ...defaultParams, background: '#0a0a1a' });

  /** 自定义粒子图片的 Data URL */
  const customImageUrl = ref<string | null>(null);

  /** 当前激活的预设 */
  const activePreset = computed(() => {
    return PRESET_LIST.find(p => p.key === activePresetKey.value) || PRESET_LIST[0];
  });

  /** 当前是否为点击式特效 */
  const isBurstMode = computed(() => activePreset.value.type === 'burst');

  /**
   * 获取当前爆发配置（应用参数调节）
   */
  const activeBurstConfig = computed<BurstConfig | null>(() => {
    const preset = activePreset.value;
    if (preset.type !== 'burst' || !preset.burstConfig) return null;

    const base = JSON.parse(JSON.stringify(preset.burstConfig)) as BurstConfig;
    // 应用参数面板的调节
    base.count = params.value.particleCount;
    base.speed = [base.speed[0] * (params.value.speed / 3), base.speed[1] * (params.value.speed / 3)];
    base.size = [base.size[0] * (params.value.size / 4), base.size[1] * (params.value.size / 4)];
    base.gravity = params.value.gravity;
    // 应用新的样式参数
    base.softness = params.value.softness;
    base.lifeCurve = params.value.lifeCurve;
    base.sizeMode = params.value.sizeMode;
    if (params.value.colorGradient) {
      base.colorGradient = params.value.colorGradient;
    }
    return base;
  });

  /**
   * 将预设配置与参数面板的值合并（背景特效用）
   */
  const mergedOptions = computed<ISourceOptions>(() => {
    const preset = activePreset.value;
    if (preset.type !== 'ambient' || !preset.options) {
      return { background: { color: params.value.background }, fullScreen: false };
    }

    const base = JSON.parse(JSON.stringify(preset.options)) as ISourceOptions;
    (base as any).background = { color: params.value.background };

    if ((base as any).particles) {
      const p = (base as any).particles;
      if (p.number && typeof p.number.value === 'number' && p.number.value > 0) {
        p.number.value = params.value.particleCount;
      }
      if (p.move) {
        if (typeof p.move.speed === 'number') {
          p.move.speed = params.value.speed;
        } else if (typeof p.move.speed === 'object') {
          p.move.speed = { min: params.value.speed * 0.3, max: params.value.speed };
        }
      }
      if (p.size) {
        if (typeof p.size.value === 'number') {
          p.size.value = params.value.size;
        } else if (typeof p.size.value === 'object') {
          p.size.value = { min: Math.max(0.5, params.value.size * 0.25), max: params.value.size };
        }
      }
      if (p.opacity) {
        if (typeof p.opacity.value === 'number') {
          p.opacity.value = params.value.opacity;
        } else if (typeof p.opacity.value === 'object') {
          p.opacity.value = { min: params.value.opacity * 0.2, max: params.value.opacity };
        }
      }
      if (p.move?.gravity) {
        (p.move.gravity as any).acceleration = params.value.gravity * 15;
      }
      if (customImageUrl.value) {
        p.shape = {
          type: 'image',
          options: { image: { src: customImageUrl.value, width: 32, height: 32 } }
        };
      }
    }

    return base;
  });

  /** 切换预设 */
  function selectPreset(key: string) {
    activePresetKey.value = key;
    const preset = PRESET_LIST.find(p => p.key === key);
    if (preset) {
      params.value.background = preset.background;
      // 同步预设的新样式参数
      if (preset.burstConfig) {
        params.value.softness = preset.burstConfig.softness ?? 0;
        params.value.lifeCurve = preset.burstConfig.lifeCurve ?? 'easeOut';
        params.value.sizeMode = preset.burstConfig.sizeMode ?? 'shrink';
        params.value.colorGradient = preset.burstConfig.colorGradient ?? '';
      } else {
        // 背景特效重置为默认
        params.value.softness = defaultParams.softness;
        params.value.lifeCurve = defaultParams.lifeCurve;
        params.value.sizeMode = defaultParams.sizeMode;
        params.value.colorGradient = defaultParams.colorGradient;
      }
    }
    isPlaying.value = true;
  }

  /** 切换播放/暂停 */
  function togglePlay() {
    isPlaying.value = !isPlaying.value;
  }

  /** 重置参数 */
  function resetParams() {
    const preset = activePreset.value;
    params.value = {
      ...defaultParams,
      background: preset.background,
      softness: preset.burstConfig?.softness ?? defaultParams.softness,
      lifeCurve: preset.burstConfig?.lifeCurve ?? defaultParams.lifeCurve,
      sizeMode: preset.burstConfig?.sizeMode ?? defaultParams.sizeMode,
      colorGradient: preset.burstConfig?.colorGradient ?? defaultParams.colorGradient
    };
    customImageUrl.value = null;
  }

  /** 设置自定义图片 */
  function setCustomImage(dataUrl: string | null) {
    customImageUrl.value = dataUrl;
  }

  /** 获取当前完整配置的 JSON 字符串 */
  function getConfigJson(): string {
    if (isBurstMode.value) {
      return JSON.stringify({
        type: 'burst',
        preset: activePresetKey.value,
        config: activeBurstConfig.value
      }, null, 2);
    }
    return JSON.stringify(mergedOptions.value, null, 2);
  }

  /** 生成可独立运行的 HTML 文件内容 */
  function generateStandaloneHtml(): string {
    if (isBurstMode.value) {
      return generateBurstHtml();
    }
    return generateAmbientHtml();
  }

  function generateBurstHtml(): string {
    const config = JSON.stringify(activeBurstConfig.value, null, 2);
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>点击特效 - ${activePresetKey.value}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { overflow: hidden; background: ${params.value.background}; cursor: crosshair; }
    canvas { width: 100vw; height: 100vh; display: block; }
    .hint { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
      color: rgba(255,255,255,0.5); font-size: 14px; font-family: sans-serif;
      pointer-events: none; animation: fadeHint 3s ease-out forwards; }
    @keyframes fadeHint { 0%{opacity:1} 70%{opacity:1} 100%{opacity:0} }
  </style>
</head>
<body>
  <canvas id="c"></canvas>
  <div class="hint">✨ 点击任意位置触发特效</div>
  <script>
    // 内联的迷你版爆发引擎
    const canvas = document.getElementById('c');
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    function resize() {
      canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
      ctx.scale(dpr, dpr);
    }
    resize(); window.addEventListener('resize', resize);

    const config = ${config};
    const particles = [];
    const rand = (a,b) => Math.random()*(b-a)+a;
    const pick = a => a[Math.floor(Math.random()*a.length)];

    function burst(x, y) {
      const {count,shapes,colors,life,size,speed,gravity,friction,glow,trail,angleRange} = config;
      for (let i=0;i<count;i++) {
        const angle = rand(angleRange?angleRange[0]:0, angleRange?angleRange[1]:Math.PI*2);
        const spd = rand(speed[0],speed[1]);
        const l = rand(life[0],life[1]);
        particles.push({x,y,vx:Math.cos(angle)*spd,vy:Math.sin(angle)*spd,
          size:rand(size[0],size[1]),life:l,maxLife:l,color:pick(colors),
          shape:pick(shapes),rotation:rand(0,6.28),rs:rand(-5,5),
          gravity,friction,glow:!!glow,trail:!!trail,history:[]});
      }
    }

    canvas.addEventListener('click', e => burst(e.clientX, e.clientY));

    function drawStar(x,y,s,r){ctx.beginPath();for(let i=0;i<10;i++){const rad=i%2?s*0.4:s;const a=i*Math.PI/5-Math.PI/2+r;ctx.lineTo(x+Math.cos(a)*rad,y+Math.sin(a)*rad)}ctx.closePath()}

    let last = performance.now();
    function loop() {
      const now = performance.now(), dt = Math.min((now-last)/1000, 0.05); last=now;
      ctx.clearRect(0,0,innerWidth,innerHeight);
      for(let i=particles.length-1;i>=0;i--){
        const p=particles[i];
        if(p.trail){p.history.push({x:p.x,y:p.y,o:p.life/p.maxLife});if(p.history.length>8)p.history.shift()}
        p.vy+=p.gravity*dt*300;p.vx*=Math.pow(p.friction,dt*60);p.vy*=Math.pow(p.friction,dt*60);
        p.x+=p.vx*dt;p.y+=p.vy*dt;p.rotation+=p.rs*dt;p.life-=dt;
        if(p.life<=0){particles.splice(i,1);continue}
        const prog=p.life/p.maxLife,op=Math.min(1,prog*2.5),sz=p.size*(0.3+prog*0.7);
        ctx.save();ctx.globalAlpha=op;
        if(p.glow){ctx.shadowColor=p.color;ctx.shadowBlur=sz*3}
        ctx.fillStyle=p.color;ctx.strokeStyle=p.color;
        if(p.shape==='star'){drawStar(p.x,p.y,sz,p.rotation);ctx.fill()}
        else if(p.shape==='spark'){ctx.lineWidth=sz*0.3;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rotation);
          ctx.beginPath();ctx.moveTo(0,-sz*1.5);ctx.lineTo(0,sz*1.5);ctx.restore();ctx.stroke()}
        else{ctx.beginPath();ctx.arc(p.x,p.y,sz,0,6.28);ctx.fill()}
        ctx.restore();
      }
      requestAnimationFrame(loop);
    }
    loop();
    burst(innerWidth/2, innerHeight/2); // 初始演示
  <\/script>
</body>
</html>`;
  }

  function generateAmbientHtml(): string {
    const config = JSON.stringify(mergedOptions.value, null, 2);
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>背景特效 - ${activePresetKey.value}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { overflow: hidden; background: ${params.value.background}; }
    #tsparticles { width: 100vw; height: 100vh; }
  </style>
</head>
<body>
  <div id="tsparticles"></div>
  <script src="https://cdn.jsdelivr.net/npm/@tsparticles/slim@3/tsparticles.slim.bundle.min.js"><\/script>
  <script>
    (async () => {
      await tsParticles.load({ id: "tsparticles", options: ${config} });
    })();
  <\/script>
</body>
</html>`;
  }

  return {
    activePresetKey,
    activePreset,
    isBurstMode,
    isPlaying,
    params,
    customImageUrl,
    mergedOptions,
    activeBurstConfig,
    selectPreset,
    togglePlay,
    resetParams,
    setCustomImage,
    getConfigJson,
    generateStandaloneHtml
  };
}
