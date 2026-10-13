/**
 * 序列脚本播放器 — 核心类型定义
 *
 * 数据模型设计参见 docs/sequence-player-discussion.md
 */

// ============================================================
// 课程序列项目
// ============================================================

/** 课程序列项目 */
export interface SequenceProject {
  /** 序列格式版本；旧项目可能没有 */
  schemaVersion?: string;
  id: string;
  title: string;
  /** 原始脚本文本 */
  rawScript: string;
  /** 导入来源，飞书/Word/JSON 导入时使用 */
  source?: ImportSource;
  characters: Character[];
  steps: Step[];
  settings: ProjectSettings;
  /** 舞台设置，下一轮舞台管理使用；旧项目可为空 */
  stage?: StageConfig;
  /** 媒体资产池，图片/视频/音频都先归一到这里 */
  assets?: MediaAsset[];
  /** 结构化舞台序列；旧项目可为空，保留 steps 作为兼容播放格式 */
  stageSequences?: StageSequence[];
  createdAt: number;
  updatedAt: number;
}

/** 导入来源 */
export interface ImportSource {
  type: 'manual' | 'feishu_doc' | 'feishu_wiki' | 'feishu_sheet' | 'docx' | 'json';
  url?: string;
  token?: string;
  title?: string;
  importedAt: number;
}

/** 项目设置 */
export interface ProjectSettings {
  /** 背景图 key（内置背景名或自定义 URL） */
  backgroundKey: string;
  /** 全局语速倍率 */
  globalRate: number;
  /** 字幕打字速度 ms/字 */
  typingSpeed: number;
  /** 台词间默认停顿 ms */
  defaultPause: number;
}

export const DEFAULT_SETTINGS: ProjectSettings = {
  backgroundKey: 'classroom',
  globalRate: 1.0,
  typingSpeed: 60,
  defaultPause: 300,
};

// ============================================================
// 角色
// ============================================================

/** 角色 = 立绘组 + 声音配置 */
export interface Character {
  id: string;
  /** 角色名（脚本中的标识符） */
  name: string;
  /** 显示名 */
  displayName: string;
  /** 代表色 (hex) */
  color: string;
  /** 表情/造型组 */
  poses: CharacterPose[];
  /** 默认造型 ID */
  defaultPoseId: string;
  /** 语音配置 */
  ttsConfig: TtsConfig;
  /** 课程内的叙事/教学职责，播放器据此选择舞台位置与入场策略 */
  courseRole?: CourseRole;
  /** 角色声音档案；未配置时使用课程默认声音 */
  voiceProfileRef?: string;
  /** @deprecated 旧项目站位；结构化舞台序列不再写入具体左右位置 */
  position?: CharacterPosition;
  /** 缩放比例 0.5~1.5 */
  scale: number;
}

/** 角色站位 */
export type CharacterPosition = 'left' | 'center' | 'right';

/** 课程角色职责。职责属于课程角色，不属于某一句台词。 */
export type CourseRole = 'lead_instructor' | 'supporting_character' | 'narrator';

/** 舞台百分比，固定以图片底部中心为锚点，原图保持宽高比。 */
export interface PortraitLayout {
  x: number;
  y: number;
  height: number;
}

/** 角色造型/表情 */
export interface CharacterPose {
  id: string;
  /** 造型名（如"开心"、"严肃"） */
  name: string;
  /** 立绘图片 URL（空则用占位头像） */
  imageUrl: string;
  layout?: PortraitLayout;
}

/** TTS 配置 */
export interface TtsConfig {
  /** 引擎类型 */
  engine: 'none' | 'browser' | 'external';
  /** 浏览器 TTS 声音名称 */
  voiceName?: string;
  /** 外部语音服务的业务声音 ID，不绑定具体供应商 */
  voiceId?: string;
  /** 外部语音服务标识，仅用于显示/适配器路由 */
  provider?: string;
  /** 语速 0.5~2.0 */
  rate: number;
  /** 音调 0.5~2.0 */
  pitch: number;
}

export const DEFAULT_TTS_CONFIG: TtsConfig = {
  engine: 'browser',
  rate: 1.0,
  pitch: 1.0,
};

// ============================================================
// 播放步骤
// ============================================================

/** 步骤类型 */
export type StepType = 'dialogue' | 'wait' | 'narration' | 'direction';

/** 播放步骤 */
export interface Step {
  id: string;
  /** 步骤类型 */
  type: StepType;
  /** 说话角色的名称（dialogue/narration 时有值） */
  characterName?: string;
  /** 造型名（如"开心"，可选） */
  poseName?: string;
  /** 显示文本（含括号动作提示） */
  text: string;
  /** 实际朗读文本（去除括号内容） */
  speakText: string;
  /** wait 类型的等待时长 (ms) */
  duration?: number;
  /** 括号中提取的画面/动作提示 */
  displayNote?: string;
  /** 当前步骤关联的展示资产，下一轮图片/视频展示使用 */
  display?: StepDisplay;
  /** 当前步骤关联的音频资产或待生成状态 */
  audio?: StepAudio;
  /** 来源位置，飞书/Word 导入时用于回溯 */
  sourceRef?: SourceRef;
  /** 自动识别置信度 */
  confidence?: number;
  /** 自动识别警告 */
  warnings?: string[];
  /** 结构化舞台序列投影到旧播放器步骤后的画面提示 */
  visualCue?: StageVisualCue;
}

// ============================================================
// 结构化舞台序列（新格式）
// ============================================================

export type TeachingObjectKind = 'code' | 'concept' | 'ide-region';

/** 讲解时可被舞台展示的知识对象，不等同于学生需要完成的关卡代码。 */
export interface TeachingObject {
  id: string;
  kind: TeachingObjectKind;
  title: string;
  description?: string;
  language?: string;
  normalizedCode?: string;
  tokens?: Array<{
    id: string;
    text: string;
    meaning?: string;
  }>;
}

/** 台词期间驱动展示区的抽象提示，具体画面可由素材、录屏或生成内容实现。 */
export interface StageVisualCue {
  target: string;
  action: 'show' | 'focus' | 'reveal' | 'pulse' | 'hide';
  tokens?: string[];
}

export interface StageDialogueEvent {
  id: string;
  type: 'dialogue';
  actor: string;
  pose?: string;
  /** 字幕与语义原文 */
  speakText: string;
  /** 需要特殊读音时覆盖 speakText，例如 C++ / cout */
  synthesisText?: string;
  visualCue?: StageVisualCue;
  sourceRef?: SourceRef;
}

export interface StageWaitEvent {
  id: string;
  type: 'wait';
  duration: number;
  sourceRef?: SourceRef;
}

export type StageEvent = StageDialogueEvent | StageWaitEvent;

/** 一个能独立进入播放器的教学表达片段。 */
export interface StageSequence {
  id: string;
  title: string;
  durationHintSec?: number;
  teachingObjects?: TeachingObject[];
  events: StageEvent[];
  sourceRef?: SourceRef;
}

/** 步骤展示配置 */
export interface StepDisplay {
  assetIds?: string[];
  area?: 'content' | 'background' | 'overlay';
  layout?: 'single' | 'grid' | 'side-by-side';
  fit?: 'contain' | 'cover';
  caption?: string;
}

/** 步骤音频配置 */
export interface StepAudio {
  assetId?: string;
  voiceId?: string;
  duration?: number;
  status?: 'none' | 'pending' | 'ready' | 'failed';
}

/** 内容来源引用 */
export interface SourceRef {
  blockId?: string;
  tableIndex?: number;
  rowIndex?: number;
  columnName?: string;
}

/** 媒体资产 */
export interface MediaAsset {
  id: string;
  type: 'image' | 'video' | 'audio' | 'file';
  url: string;
  name?: string;
  note?: string;
  sourceRef?: SourceRef;
}

/** 舞台配置 */
export interface StageConfig {
  size: StageSizeConfig;
  background: {
    type: 'builtin' | 'gradient' | 'image';
    value: string;
  };
  leftPosition: {
    horizontal: number;
    vertical: number;
  };
  rightPosition: {
    horizontal: number;
    vertical: number;
  };
  rightFlip: boolean;
  subtitle: {
    fontSize: number;
    width: number;
  };
  contentArea: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

/** 舞台尺寸配置 */
export interface StageSizeConfig {
  aspectRatio: '16:9' | '4:3' | '1:1' | '9:16';
  widthPercent: number;
  maxHeight: number;
}

export const DEFAULT_STAGE_CONFIG: StageConfig = {
  size: {
    aspectRatio: '16:9',
    widthPercent: 100,
    maxHeight: 720,
  },
  background: {
    type: 'builtin',
    value: 'classroom',
  },
  leftPosition: {
    horizontal: 10,
    vertical: 0,
  },
  rightPosition: {
    horizontal: 60,
    vertical: 0,
  },
  rightFlip: false,
  subtitle: {
    fontSize: 18,
    width: 90,
  },
  contentArea: {
    top: 20,
    bottom: 28,
    left: 18,
    right: 18,
  },
};

// ============================================================
// 播放器状态
// ============================================================

/** 播放器状态枚举 */
export type PlayerStatus = 'idle' | 'ready' | 'playing' | 'paused';

/** 播放器运行时状态 */
export interface PlayerState {
  status: PlayerStatus;
  /** 当前步骤索引 */
  currentIndex: number;
  /** 当前台词已显示的字数（打字机效果） */
  visibleChars: number;
  /** 当前在场的角色名列表 */
  activeCharacters: string[];
}

// ============================================================
// 内置背景
// ============================================================

export interface BackgroundOption {
  key: string;
  label: string;
  /** CSS 背景值 */
  css: string;
}

export const BUILTIN_BACKGROUNDS: BackgroundOption[] = [
  {
    key: 'classroom',
    label: '教室',
    css: 'linear-gradient(to bottom, #eef6ff 0%, #dbeafe 68%, #cbd5e1 69%, #b6c3d4 100%)',
  },
  {
    key: 'workshop',
    label: '工作坊',
    css: 'linear-gradient(to bottom, #e0f2f1 0%, #b2dfdb 100%)',
  },
  {
    key: 'outdoor',
    label: '户外',
    css: 'linear-gradient(to bottom, #dcedc8 0%, #aed581 100%)',
  },
  {
    key: 'studio',
    label: '演播室',
    css: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
  },
  {
    key: 'warm',
    label: '暖色调',
    css: 'linear-gradient(to bottom, #fce4ec 0%, #f8bbd0 100%)',
  },
  {
    key: 'sky',
    label: '天空',
    css: 'linear-gradient(to bottom, #bbdefb 0%, #90caf9 100%)',
  },
];

// ============================================================
// 预设角色色板
// ============================================================

/** 角色代表色预设（柔和的高饱和色） */
export const CHARACTER_COLORS = [
  '#4FC3F7', // 天蓝
  '#FF8A65', // 暖橙
  '#AED581', // 青绿
  '#F06292', // 粉红
  '#BA68C8', // 紫色
  '#FFD54F', // 金黄
  '#4DB6AC', // 青色
  '#E57373', // 珊瑚红
  '#7986CB', // 靛蓝
  '#81C784', // 翠绿
];
