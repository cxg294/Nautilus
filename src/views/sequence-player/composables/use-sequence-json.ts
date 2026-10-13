/**
 * 序列 JSON 导入/导出工具
 *
 * 这里承接播放器内部格式，后续飞书/Word/AI 导入都应先归一成这份结构。
 */
import type {
  Character,
  CharacterPose,
  ProjectSettings,
  SequenceProject,
  StageConfig,
  StageSequence,
  Step,
  TtsConfig,
} from '../types/sequence';
import {
  DEFAULT_SETTINGS,
  DEFAULT_STAGE_CONFIG,
  DEFAULT_TTS_CONFIG,
} from '../types/sequence';

export const SEQUENCE_SCHEMA_VERSION = '0.3';

export interface SequenceJsonInput {
  title: string;
  rawScript: string;
  characters: Character[];
  steps: Step[];
  settings: ProjectSettings;
  stage?: StageConfig;
  stageSequences?: StageSequence[];
}

export interface SequenceJsonResult {
  project: SequenceProject;
  warnings: string[];
}

function safeId(prefix: string, value: string | undefined, index: number): string {
  const source = value || `${prefix}_${index + 1}`;
  const slug = source
    .trim()
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `${prefix}_${slug || index + 1}`;
}

function normalizeTtsConfig(input: Partial<TtsConfig> | undefined): TtsConfig {
  const engine = input?.engine === 'none' || input?.engine === 'external' ? input.engine : 'browser';
  return {
    ...DEFAULT_TTS_CONFIG,
    ...input,
    engine,
    rate: typeof input?.rate === 'number' ? input.rate : DEFAULT_TTS_CONFIG.rate,
    pitch: typeof input?.pitch === 'number' ? input.pitch : DEFAULT_TTS_CONFIG.pitch,
  };
}

function normalizePose(rawPose: Partial<CharacterPose>, charName: string, index: number): CharacterPose {
  const name = typeof rawPose?.name === 'string' && rawPose.name.trim() ? rawPose.name.trim() : '默认';
  return {
    id: typeof rawPose?.id === 'string' && rawPose.id.trim()
      ? rawPose.id
      : safeId(`pose_${charName}`, name, index),
    name,
    imageUrl: typeof rawPose?.imageUrl === 'string' ? rawPose.imageUrl : '',
  };
}

function normalizeCharacter(rawChar: Partial<Character>, index: number): Character {
  const name = typeof rawChar?.name === 'string' && rawChar.name.trim()
    ? rawChar.name.trim()
    : `角色${index + 1}`;
  const poses = Array.isArray(rawChar?.poses) && rawChar.poses.length > 0
    ? rawChar.poses.map((pose, poseIndex) => normalizePose(pose, name, poseIndex))
    : [normalizePose({ name: '默认' }, name, 0)];
  const defaultPoseId = rawChar?.defaultPoseId && poses.some(pose => pose.id === rawChar.defaultPoseId)
    ? rawChar.defaultPoseId
    : poses[0].id;

  return {
    id: typeof rawChar?.id === 'string' && rawChar.id.trim() ? rawChar.id : safeId('char', name, index),
    name,
    displayName: typeof rawChar?.displayName === 'string' && rawChar.displayName.trim()
      ? rawChar.displayName.trim()
      : name,
    color: typeof rawChar?.color === 'string' && rawChar.color.trim() ? rawChar.color : '#4FC3F7',
    poses,
    defaultPoseId,
    ttsConfig: normalizeTtsConfig(rawChar?.ttsConfig),
    courseRole: rawChar?.courseRole === 'lead_instructor'
      || rawChar?.courseRole === 'supporting_character'
      || rawChar?.courseRole === 'narrator'
      ? rawChar.courseRole
      : undefined,
    voiceProfileRef: typeof rawChar?.voiceProfileRef === 'string' && rawChar.voiceProfileRef.trim()
      ? rawChar.voiceProfileRef
      : undefined,
    position: rawChar?.position === 'left' || rawChar?.position === 'center' || rawChar?.position === 'right'
      ? rawChar.position
      : undefined,
    scale: typeof rawChar?.scale === 'number' ? rawChar.scale : 1,
  };
}

function normalizeStep(rawStep: Partial<Step>, index: number): Step {
  const type = rawStep?.type === 'wait'
    || rawStep?.type === 'narration'
    || rawStep?.type === 'direction'
    || rawStep?.type === 'dialogue'
    ? rawStep.type
    : 'direction';
  const text = typeof rawStep?.text === 'string' ? rawStep.text : '';
  return {
    ...rawStep,
    id: typeof rawStep?.id === 'string' && rawStep.id.trim() ? rawStep.id : `step_${index + 1}`,
    type,
    text,
    speakText: typeof rawStep?.speakText === 'string'
      ? rawStep.speakText
      : (type === 'dialogue' || type === 'narration' ? text : ''),
    duration: type === 'wait'
      ? (typeof rawStep?.duration === 'number' ? rawStep.duration : 1000)
      : rawStep?.duration,
  };
}

function normalizeSettings(input: Partial<ProjectSettings> | undefined): ProjectSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...input,
    globalRate: typeof input?.globalRate === 'number' ? input.globalRate : DEFAULT_SETTINGS.globalRate,
    typingSpeed: typeof input?.typingSpeed === 'number' ? input.typingSpeed : DEFAULT_SETTINGS.typingSpeed,
    defaultPause: typeof input?.defaultPause === 'number' ? input.defaultPause : DEFAULT_SETTINGS.defaultPause,
  };
}

function normalizeStage(input: Partial<StageConfig> | undefined): StageConfig {
  return {
    ...DEFAULT_STAGE_CONFIG,
    ...input,
    background: {
      ...DEFAULT_STAGE_CONFIG.background,
      ...input?.background,
    },
    size: {
      ...DEFAULT_STAGE_CONFIG.size,
      ...input?.size,
    },
    leftPosition: {
      ...DEFAULT_STAGE_CONFIG.leftPosition,
      ...input?.leftPosition,
    },
    rightPosition: {
      ...DEFAULT_STAGE_CONFIG.rightPosition,
      ...input?.rightPosition,
    },
    subtitle: {
      ...DEFAULT_STAGE_CONFIG.subtitle,
      ...input?.subtitle,
    },
    contentArea: {
      ...DEFAULT_STAGE_CONFIG.contentArea,
      ...input?.contentArea,
    },
  };
}

export function createSequenceProject(input: SequenceJsonInput): SequenceProject {
  const now = Date.now();
  return {
    schemaVersion: SEQUENCE_SCHEMA_VERSION,
    id: `project_${now}`,
    title: input.title || '未命名项目',
    rawScript: input.rawScript || '',
    source: {
      type: 'manual',
      importedAt: now,
    },
    characters: input.characters,
    steps: input.steps,
    settings: input.settings,
    stage: input.stage || DEFAULT_STAGE_CONFIG,
    assets: [],
    stageSequences: input.stageSequences || [],
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeSequenceProject(raw: unknown): SequenceJsonResult {
  const warnings: string[] = [];
  if (!raw || typeof raw !== 'object') {
    throw new Error('JSON 根节点必须是对象');
  }

  const source = raw as Partial<SequenceProject> & { raw_script?: string };
  const steps = Array.isArray(source.steps)
    ? source.steps.map((step, index) => normalizeStep(step, index))
    : [];
  const characters = Array.isArray(source.characters)
    ? source.characters.map((char, index) => normalizeCharacter(char, index))
    : [];
  const stageSequences = Array.isArray(source.stageSequences)
    ? source.stageSequences.filter(sequence => sequence && typeof sequence === 'object' && Array.isArray(sequence.events))
    : [];

  if (steps.length === 0 && stageSequences.length === 0) warnings.push('未找到可播放序列，导入后需要重新解析逐字稿');
  if (characters.length === 0) warnings.push('未找到 characters，导入后可能无法展示角色立绘');

  const now = Date.now();
  const project: SequenceProject = {
    schemaVersion: source.schemaVersion || SEQUENCE_SCHEMA_VERSION,
    id: typeof source.id === 'string' && source.id.trim() ? source.id : `project_import_${now}`,
    title: typeof source.title === 'string' && source.title.trim() ? source.title : '导入项目',
    rawScript: typeof source.rawScript === 'string' ? source.rawScript : (source.raw_script || ''),
    source: source.source || {
      type: 'json',
      importedAt: now,
    },
    characters,
    steps,
    settings: normalizeSettings(source.settings),
    stage: normalizeStage(source.stage),
    assets: Array.isArray(source.assets) ? source.assets : [],
    stageSequences,
    createdAt: typeof source.createdAt === 'number' ? source.createdAt : now,
    updatedAt: now,
  };

  return { project, warnings };
}

export function downloadSequenceProject(project: SequenceProject) {
  const json = JSON.stringify(project, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeTitle = (project.title || 'sequence-project')
    .trim()
    .replace(/[\\/:*?"<>|\s]+/g, '_')
    .replace(/^_+|_+$/g, '');

  a.href = url;
  a.download = `${safeTitle || 'sequence-project'}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function readJsonFile(file: File): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result || '{}')));
      } catch {
        reject(new Error('JSON 解析失败，请检查文件格式'));
      }
    };
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsText(file);
  });
}
