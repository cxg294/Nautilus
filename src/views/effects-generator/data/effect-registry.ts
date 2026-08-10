import type { ISourceOptions } from '@tsparticles/engine';
import type { BurstConfig } from '../composables/use-burst-particles';

export type EffectCategory = 'emphasis' | 'celebration' | 'transition' | 'emotion' | 'character' | 'ambient';
export type EffectRenderer = 'burst' | 'ambient' | 'composite';
export type EffectQuality = 'preview' | 'standard' | 'export';
export type BackgroundMode = 'solid' | 'transparent';
export type ExportFormat = 'gif' | 'png-sequence' | 'html';
export type PerformanceCost = 'low' | 'medium' | 'high';

export interface EffectAsset {
  id: string;
  kind: 'particle' | 'overlay' | 'sfx' | 'license';
  path: string;
  license: 'CC0';
  sourceName: string;
  sourceUrl: string;
  author: string;
  attributionRequired: boolean;
}

export interface CompositeBurstLayer {
  type: 'burst';
  delayMs: number;
  x: number;
  y: number;
  config: BurstConfig;
}

export interface CompositeOverlayLayer {
  type: 'overlay';
  delayMs: number;
  durationMs: number;
  kind: 'flash' | 'spotlight' | 'curtain' | 'speedLines' | 'impactLines';
  color?: string;
}

export type CompositeLayer = CompositeBurstLayer | CompositeOverlayLayer;

export interface CompositeConfig {
  layers: CompositeLayer[];
}

export interface EffectRecipe {
  id: string;
  nameI18nKey: string;
  category: EffectCategory;
  tags: string[];
  renderer: EffectRenderer;
  durationMs: number;
  backgroundMode: BackgroundMode;
  performanceCost: PerformanceCost;
  assetRefs: string[];
  config: {
    burst?: BurstConfig;
    ambient?: ISourceOptions;
    composite?: CompositeConfig;
  };
}

export const EFFECT_CATEGORIES: Array<{ key: EffectCategory; i18nKey: string }> = [
  { key: 'emphasis', i18nKey: 'page.effectsGenerator.categories.emphasis' },
  { key: 'celebration', i18nKey: 'page.effectsGenerator.categories.celebration' },
  { key: 'transition', i18nKey: 'page.effectsGenerator.categories.transition' },
  { key: 'emotion', i18nKey: 'page.effectsGenerator.categories.emotion' },
  { key: 'character', i18nKey: 'page.effectsGenerator.categories.character' },
  { key: 'ambient', i18nKey: 'page.effectsGenerator.categories.ambient' }
];

const KENNEY_BASE = '/effects/kenney-particle-pack';
const KENNEY_SOURCE = 'https://www.kenney.nl/assets/particle-pack';

function kenneyAsset(id: string, filename: string, kind: EffectAsset['kind'] = 'particle'): EffectAsset {
  return {
    id,
    kind,
    path: `${KENNEY_BASE}/${filename}`,
    license: 'CC0',
    sourceName: 'Kenney Particle Pack',
    sourceUrl: KENNEY_SOURCE,
    author: 'Kenney',
    attributionRequired: false
  };
}

export const EFFECT_ASSETS: EffectAsset[] = [
  kenneyAsset('kenney-star-01', 'star_01.png'),
  kenneyAsset('kenney-star-02', 'star_02.png'),
  kenneyAsset('kenney-star-05', 'star_05.png'),
  kenneyAsset('kenney-spark-01', 'spark_01.png'),
  kenneyAsset('kenney-spark-03', 'spark_03.png'),
  kenneyAsset('kenney-spark-05', 'spark_05.png'),
  kenneyAsset('kenney-smoke-01', 'smoke_01.png'),
  kenneyAsset('kenney-smoke-03', 'smoke_03.png'),
  kenneyAsset('kenney-smoke-06', 'smoke_06.png'),
  kenneyAsset('kenney-trace-01', 'trace_01.png'),
  kenneyAsset('kenney-trace-04', 'trace_04.png'),
  kenneyAsset('kenney-circle-01', 'circle_01.png'),
  kenneyAsset('kenney-flare-01', 'flare_01.png'),
  kenneyAsset('kenney-light-01', 'light_01.png'),
  kenneyAsset('kenney-magic-01', 'magic_01.png'),
  kenneyAsset('kenney-muzzle-01', 'muzzle_01.png'),
  kenneyAsset('kenney-license', 'LICENSE.txt', 'license')
];

export const EFFECT_ASSET_MAP = Object.fromEntries(EFFECT_ASSETS.map(asset => [asset.id, asset])) as Record<string, EffectAsset>;

export function assetPaths(ids: string[]) {
  return ids.map(id => EFFECT_ASSET_MAP[id]?.path).filter(Boolean);
}

const starTextures = assetPaths(['kenney-star-01', 'kenney-star-02', 'kenney-star-05']);
const sparkTextures = assetPaths(['kenney-spark-01', 'kenney-spark-03', 'kenney-spark-05']);
const smokeTextures = assetPaths(['kenney-smoke-01', 'kenney-smoke-03', 'kenney-smoke-06']);
const traceTextures = assetPaths(['kenney-trace-01', 'kenney-trace-04']);

function burst(config: BurstConfig): BurstConfig {
  return config;
}

function particles(options: ISourceOptions): ISourceOptions {
  return options;
}

export const ADDITIONAL_EFFECT_RECIPES: EffectRecipe[] = [
  {
    id: 'corner-salute-center',
    nameI18nKey: 'page.effectsGenerator.presets.corner-salute-center',
    category: 'celebration',
    tags: ['corner', 'salute', 'ppt'],
    renderer: 'composite',
    durationMs: 1800,
    backgroundMode: 'transparent',
    performanceCost: 'medium',
    assetRefs: ['kenney-muzzle-01', 'kenney-trace-01', 'kenney-spark-01', 'kenney-star-01'],
    config: {
      composite: {
        layers: [
          {
            type: 'burst',
            delayMs: 0,
            x: 0.1,
            y: 0.9,
            config: burst({
              count: 18,
              shapes: ['spark'],
              colors: ['#ffd166', '#f97316', '#ffffff'],
              texturePaths: traceTextures,
              life: [0.35, 0.7],
              size: [18, 42],
              speed: [520, 760],
              gravity: 0,
              friction: 0.93,
              angleRange: [-Math.PI * 0.45, -Math.PI * 0.2],
              glow: true,
              trail: true,
              softness: 0.2,
              lifeCurve: 'easeOut',
              sizeMode: 'shrink'
            })
          },
          {
            type: 'burst',
            delayMs: 0,
            x: 0.9,
            y: 0.9,
            config: burst({
              count: 18,
              shapes: ['spark'],
              colors: ['#ffd166', '#f97316', '#ffffff'],
              texturePaths: traceTextures,
              life: [0.35, 0.7],
              size: [18, 42],
              speed: [520, 760],
              gravity: 0,
              friction: 0.93,
              angleRange: [-Math.PI * 0.8, -Math.PI * 0.55],
              glow: true,
              trail: true,
              softness: 0.2,
              lifeCurve: 'easeOut',
              sizeMode: 'shrink'
            })
          },
          {
            type: 'burst',
            delayMs: 560,
            x: 0.5,
            y: 0.46,
            config: burst({
              count: 90,
              shapes: ['star', 'circle', 'spark'],
              colors: ['#ffffff', '#fde68a', '#facc15', '#fb7185', '#60a5fa', '#34d399'],
              texturePaths: [...starTextures, ...sparkTextures],
              life: [0.7, 1.5],
              size: [9, 26],
              speed: [130, 460],
              gravity: 0.45,
              friction: 0.95,
              glow: true,
              trail: true,
              softness: 0.55,
              lifeCurve: 'pulse',
              sizeMode: 'pop'
            })
          },
          { type: 'overlay', delayMs: 520, durationMs: 420, kind: 'flash', color: '#fff7cc' }
        ]
      }
    }
  },
  {
    id: 'center-confetti-bloom',
    nameI18nKey: 'page.effectsGenerator.presets.center-confetti-bloom',
    category: 'celebration',
    tags: ['success', 'confetti'],
    renderer: 'burst',
    durationMs: 1600,
    backgroundMode: 'transparent',
    performanceCost: 'medium',
    assetRefs: ['kenney-star-02', 'kenney-spark-03'],
    config: {
      burst: burst({
        count: 96,
        shapes: ['square', 'diamond', 'star'],
        colors: ['#fb7185', '#f97316', '#facc15', '#22c55e', '#38bdf8', '#a78bfa'],
        texturePaths: [...starTextures, ...sparkTextures],
        life: [0.9, 2.0],
        size: [6, 18],
        speed: [120, 420],
        gravity: 0.85,
        friction: 0.965,
        glow: false,
        trail: false,
        lifeCurve: 'easeOut',
        sizeMode: 'constant'
      })
    }
  },
  {
    id: 'star-rain',
    nameI18nKey: 'page.effectsGenerator.presets.star-rain',
    category: 'celebration',
    tags: ['falling', 'sparkle'],
    renderer: 'ambient',
    durationMs: 3000,
    backgroundMode: 'transparent',
    performanceCost: 'low',
    assetRefs: ['kenney-star-01', 'kenney-star-05'],
    config: {
      ambient: particles({
        fullScreen: false,
        detectRetina: false,
        particles: {
          number: { value: 45, density: { enable: true } },
          color: { value: ['#ffffff', '#fde68a', '#facc15'] },
          shape: { type: ['star', 'circle'] },
          opacity: { value: { min: 0.35, max: 0.9 } },
          size: { value: { min: 2, max: 7 } },
          move: { enable: true, speed: { min: 1.2, max: 3.2 }, direction: 'bottom', outModes: { default: 'out', bottom: 'destroy' } },
          twinkle: { particles: { enable: true, frequency: 0.06, opacity: 1 } }
        }
      })
    }
  },
  {
    id: 'spotlight-focus',
    nameI18nKey: 'page.effectsGenerator.presets.spotlight-focus',
    category: 'emphasis',
    tags: ['focus', 'highlight'],
    renderer: 'composite',
    durationMs: 1600,
    backgroundMode: 'transparent',
    performanceCost: 'low',
    assetRefs: ['kenney-light-01', 'kenney-circle-01'],
    config: {
      composite: {
        layers: [
          { type: 'overlay', delayMs: 0, durationMs: 1500, kind: 'spotlight', color: '#020617' },
          {
            type: 'burst',
            delayMs: 120,
            x: 0.5,
            y: 0.5,
            config: burst({
              count: 28,
              shapes: ['ring', 'circle'],
              colors: ['#ffffff', '#fde68a', '#93c5fd'],
              texturePaths: [EFFECT_ASSET_MAP['kenney-light-01'].path],
              life: [0.55, 1.1],
              size: [18, 48],
              speed: [30, 120],
              gravity: 0,
              friction: 0.92,
              glow: true,
              trail: false,
              softness: 0.9,
              lifeCurve: 'easeOut',
              sizeMode: 'grow'
            })
          }
        ]
      }
    }
  },
  {
    id: 'important-flash-ring',
    nameI18nKey: 'page.effectsGenerator.presets.important-flash-ring',
    category: 'emphasis',
    tags: ['flash', 'ring'],
    renderer: 'composite',
    durationMs: 900,
    backgroundMode: 'transparent',
    performanceCost: 'low',
    assetRefs: ['kenney-flare-01', 'kenney-spark-05'],
    config: {
      composite: {
        layers: [
          { type: 'overlay', delayMs: 0, durationMs: 260, kind: 'flash', color: '#ffffff' },
          {
            type: 'burst',
            delayMs: 80,
            x: 0.5,
            y: 0.5,
            config: burst({
              count: 42,
              shapes: ['ring', 'spark', 'circle'],
              colors: ['#ffffff', '#fef08a', '#bfdbfe'],
              texturePaths: [EFFECT_ASSET_MAP['kenney-flare-01'].path, EFFECT_ASSET_MAP['kenney-spark-05'].path],
              life: [0.25, 0.8],
              size: [10, 30],
              speed: [180, 520],
              gravity: 0,
              friction: 0.9,
              glow: true,
              trail: true,
              softness: 0.6,
              lifeCurve: 'easeIn',
              sizeMode: 'grow'
            })
          }
        ]
      }
    }
  },
  {
    id: 'arrow-pop',
    nameI18nKey: 'page.effectsGenerator.presets.arrow-pop',
    category: 'emphasis',
    tags: ['pointer', 'direction'],
    renderer: 'composite',
    durationMs: 1100,
    backgroundMode: 'transparent',
    performanceCost: 'low',
    assetRefs: ['kenney-trace-04', 'kenney-spark-01'],
    config: {
      composite: {
        layers: [
          {
            type: 'burst',
            delayMs: 0,
            x: 0.18,
            y: 0.58,
            config: burst({
              count: 36,
              shapes: ['spark'],
              colors: ['#38bdf8', '#ffffff', '#a7f3d0'],
              texturePaths: traceTextures,
              life: [0.35, 0.8],
              size: [12, 30],
              speed: [280, 560],
              gravity: 0,
              friction: 0.9,
              angleRange: [-0.18, 0.18],
              glow: true,
              trail: true,
              lifeCurve: 'easeOut',
              sizeMode: 'shrink'
            })
          },
          {
            type: 'burst',
            delayMs: 260,
            x: 0.68,
            y: 0.58,
            config: burst({
              count: 30,
              shapes: ['circle', 'star'],
              colors: ['#ffffff', '#38bdf8', '#22c55e'],
              texturePaths: sparkTextures,
              life: [0.35, 1.0],
              size: [5, 16],
              speed: [90, 280],
              gravity: 0.1,
              friction: 0.92,
              glow: true,
              softness: 0.4,
              lifeCurve: 'pulse',
              sizeMode: 'pop'
            })
          }
        ]
      }
    }
  },
  {
    id: 'white-flash-transition',
    nameI18nKey: 'page.effectsGenerator.presets.white-flash-transition',
    category: 'transition',
    tags: ['flash', 'cut'],
    renderer: 'composite',
    durationMs: 620,
    backgroundMode: 'transparent',
    performanceCost: 'low',
    assetRefs: ['kenney-flare-01'],
    config: { composite: { layers: [{ type: 'overlay', delayMs: 0, durationMs: 620, kind: 'flash', color: '#ffffff' }] } }
  },
  {
    id: 'curtain-sweep',
    nameI18nKey: 'page.effectsGenerator.presets.curtain-sweep',
    category: 'transition',
    tags: ['wipe', 'scene'],
    renderer: 'composite',
    durationMs: 1200,
    backgroundMode: 'transparent',
    performanceCost: 'low',
    assetRefs: [],
    config: { composite: { layers: [{ type: 'overlay', delayMs: 0, durationMs: 1200, kind: 'curtain', color: '#111827' }] } }
  },
  {
    id: 'speed-lines',
    nameI18nKey: 'page.effectsGenerator.presets.speed-lines',
    category: 'emotion',
    tags: ['speed', 'wow'],
    renderer: 'composite',
    durationMs: 1300,
    backgroundMode: 'transparent',
    performanceCost: 'low',
    assetRefs: ['kenney-trace-01', 'kenney-trace-04'],
    config: { composite: { layers: [{ type: 'overlay', delayMs: 0, durationMs: 1300, kind: 'speedLines', color: '#e0f2fe' }] } }
  },
  {
    id: 'surprise-impact-lines',
    nameI18nKey: 'page.effectsGenerator.presets.surprise-impact-lines',
    category: 'emotion',
    tags: ['surprise', 'impact'],
    renderer: 'composite',
    durationMs: 1200,
    backgroundMode: 'transparent',
    performanceCost: 'low',
    assetRefs: ['kenney-spark-03'],
    config: {
      composite: {
        layers: [
          { type: 'overlay', delayMs: 0, durationMs: 1100, kind: 'impactLines', color: '#ffffff' },
          {
            type: 'burst',
            delayMs: 120,
            x: 0.5,
            y: 0.44,
            config: burst({
              count: 36,
              shapes: ['spark', 'ring'],
              colors: ['#ffffff', '#facc15', '#fb7185'],
              texturePaths: sparkTextures,
              life: [0.35, 0.9],
              size: [8, 22],
              speed: [120, 360],
              gravity: 0,
              friction: 0.91,
              glow: true,
              trail: true,
              lifeCurve: 'pulse',
              sizeMode: 'pop'
            })
          }
        ]
      }
    }
  },
  {
    id: 'character-entry-smoke',
    nameI18nKey: 'page.effectsGenerator.presets.character-entry-smoke',
    category: 'character',
    tags: ['entry', 'smoke'],
    renderer: 'burst',
    durationMs: 1500,
    backgroundMode: 'transparent',
    performanceCost: 'medium',
    assetRefs: ['kenney-smoke-01', 'kenney-smoke-03', 'kenney-smoke-06'],
    config: {
      burst: burst({
        count: 70,
        shapes: ['circle'],
        colors: ['#ffffff', '#cbd5e1', '#94a3b8'],
        texturePaths: smokeTextures,
        life: [0.8, 1.9],
        size: [20, 64],
        speed: [35, 180],
        gravity: -0.25,
        friction: 0.94,
        angleRange: [-Math.PI * 0.95, -Math.PI * 0.05],
        glow: false,
        trail: false,
        softness: 0.9,
        lifeCurve: 'easeOut',
        sizeMode: 'grow'
      })
    }
  },
  {
    id: 'dialogue-sparkle',
    nameI18nKey: 'page.effectsGenerator.presets.dialogue-sparkle',
    category: 'character',
    tags: ['dialogue', 'sparkle'],
    renderer: 'burst',
    durationMs: 1200,
    backgroundMode: 'transparent',
    performanceCost: 'low',
    assetRefs: ['kenney-star-01', 'kenney-magic-01'],
    config: {
      burst: burst({
        count: 42,
        shapes: ['star', 'circle'],
        colors: ['#ffffff', '#fef3c7', '#fde68a', '#93c5fd'],
        texturePaths: [EFFECT_ASSET_MAP['kenney-star-01'].path, EFFECT_ASSET_MAP['kenney-magic-01'].path],
        life: [0.5, 1.4],
        size: [8, 22],
        speed: [80, 240],
        gravity: -0.1,
        friction: 0.94,
        glow: true,
        trail: false,
        softness: 0.5,
        lifeCurve: 'pulse',
        sizeMode: 'pop'
      })
    }
  }
];
