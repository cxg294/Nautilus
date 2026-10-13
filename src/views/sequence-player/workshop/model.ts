import presets from '../../../../shared/character-presets.json';
import { normalizeSpeechControls, type SpeechControl } from '../../../../shared/speech-controls';
import { normalizeLayout } from '../../character-library/layout';
import type { Character, MediaAsset, ProjectSettings, Step } from '../types/sequence';
import { DEFAULT_SETTINGS } from '../types/sequence';

export const TONES = ['平静讲解', '亲切鼓励', '活泼开心', '好奇提问', '惊讶强调', '沉稳总结'] as const;
export type Tone = (typeof TONES)[number];
export interface WorkshopCharacter extends Character {
  aliases?: string[];
  libraryRef?: { id: string; revision: number };
  /** 仅引用本地公开参考样本，不是合成服务的 voice ID。 */
  referencePreset?: string;
  ttsConfig: Character['ttsConfig'] & { model?: string };
}
export interface AudioUnit {
  text: string;
  url: string;
  durationMs: number;
  pauseAfterMs: number;
}
export interface SegmentAudio {
  key: string;
  status: 'pending' | 'ready' | 'failed';
  units: AudioUnit[];
  error?: string;
}
export interface Segment {
  id: string;
  kind: 'dialogue' | 'wait' | 'direction';
  characterId: string;
  text: string;
  speakText: string;
  tone: Tone;
  toneDescription: string;
  /** 新台词默认不发送情绪指令；未带此字段的旧项目沿用原行为。 */
  useInstruction?: boolean;
  speechControls?: SpeechControl[];
  portraitId: string;
  pauseAfterMs: number;
  pauseMode?: 'auto' | 'manual';
  waitMs: number;
  audio?: SegmentAudio;
  /** 最近一次生成失败的原因；重生成失败时仍可保留并播放原音频。 */
  generationError?: string;
  sourceStep?: Partial<Step>;
}
export interface WorkshopState {
  title: string;
  rawScript: string;
  sourceScript: string;
  prepared: boolean;
  characters: WorkshopCharacter[];
  segments: Segment[];
  settings: ProjectSettings;
  assets: MediaAsset[];
  /** 保留旧舞台信息用于 JSON 回溯，本版本只展示扁平台词。 */
  legacy: Record<string, unknown>;
}

export const id = (prefix = 'item') => `${prefix}-${crypto.randomUUID()}`;
const portraitRoot = '/sequence-player/characters/';
export const PLACEHOLDER = `${portraitRoot}generic-person-silhouette.png`;
const roleSpecs = presets.map(preset => [preset.id, preset.name, preset.position, preset.color]);
export function createCharacter(name: string, index = 0): WorkshopCharacter {
  const preset = presets.find(item => item.name === name);
  if (preset) return JSON.parse(JSON.stringify(preset)) as WorkshopCharacter;
  const roleId = id('role');
  return {
    id: roleId,
    name,
    displayName: name,
    aliases: [],
    color: ['#6176bb', '#d85e63', '#2d85b3'][index % 3],
    position: 'right',
    scale: 1,
    defaultPoseId: `${roleId}-default`,
    poses: [{ id: `${roleId}-default`, name: '默认', imageUrl: PLACEHOLDER, layout: { x: 80, y: 93, height: 60 } }],
    ttsConfig: { engine: 'external', provider: 'nautilus', voiceId: '', rate: 1, pitch: 1 }
  };
}
export function emptyState(): WorkshopState {
  return {
    title: '未命名逐字稿',
    rawScript: '',
    sourceScript: '',
    prepared: false,
    characters: roleSpecs.map((item, index) => createCharacter(item[1], index)),
    segments: [],
    settings: { ...DEFAULT_SETTINGS, globalRate: 1 },
    assets: [],
    legacy: {}
  };
}
export function roleFor(state: WorkshopState, segment?: Segment) {
  return state.characters.find(role => role.id === segment?.characterId);
}
export function createSegment(characterId: string, text = ''): Segment {
  return {
    id: id('line'),
    kind: 'dialogue',
    characterId,
    text,
    speakText: text,
    tone: '平静讲解',
    toneDescription: '',
    useInstruction: false,
    portraitId: 'auto',
    pauseAfterMs: 200,
    pauseMode: 'auto',
    waitMs: 1000
  };
}
export function inferTone(text: string): Tone {
  if (/好奇|疑惑|提问|[？?]/.test(text)) return '好奇提问';
  if (/惊讶|震惊|强调|大声/.test(text)) return '惊讶强调';
  if (/开心|兴奋|高兴|活泼|[！!]/.test(text)) return '活泼开心';
  if (/亲切|鼓励|温柔|安慰/.test(text)) return '亲切鼓励';
  if (/沉稳|总结|严肃|坚定/.test(text)) return '沉稳总结';
  return '平静讲解';
}
const normalizeName = (name: string) => name.replace(/[:：﹕︰]/g, '').trim();
export function findRole(roles: WorkshopCharacter[], name: string) {
  const normalized = normalizeName(name);
  return roles.find(role => [role.name, role.displayName, ...(role.aliases || [])].includes(normalized));
}
/** 只移出明确的中文表演提示，不删除代码括号或普通括号里的知识内容。 */
export function dialogueText(text: string) {
  const notes: string[] = [];
  const speakText = text
    .replace(/[（(]([^（）()]+)[）)]/g, (full, note: string) => {
      if (
        !/开心|兴奋|惊讶|好奇|疑惑|微笑|笑着|严肃|温柔|亲切|鼓励|沉稳|平静|语气|语调|大声|小声|轻声|指着|展示|挥手|看向|点头|摇头/.test(
          note
        )
      )
        return full;
      notes.push(note.trim());
      return '';
    })
    .trim();
  return { speakText, notes: notes.join('；') };
}
export function parseTranscript(source: string, state: WorkshopState): Segment[] {
  const result: Segment[] = [];
  let currentRole = state.characters[0] || createCharacter('旁白');
  if (!state.characters.length) state.characters.push(currentRole);
  let pendingNote = '';
  let pendingPose = '';
  for (const raw of source.replace(/\r/g, '').split('\n')) {
    const line = raw.trim().replace(/[﹕︰꞉]/g, '：');
    if (!line || /^(?:\/\/|#|--PAGE|%%)/.test(line)) continue;
    const wait = line.match(/^[【[](?:停顿|等待|暂停|pause)\s*([\d.]+)\s*(?:s|秒)?[】\]]$/i);
    if (wait) {
      result.push({
        ...createSegment('', ''),
        kind: 'wait',
        waitMs: Math.min(60000, Math.max(100, Number(wait[1]) * 1000)),
        pauseAfterMs: 0
      });
      continue;
    }
    if (/^【.+】$/.test(line)) {
      result.push({ ...createSegment('', line), kind: 'direction', speakText: '', pauseAfterMs: 0 });
      continue;
    }
    let content = line;
    const speaker = line.match(/^([^:：]{1,24})[:：]\s*(.*)$/);
    if (speaker) {
      const parts = speaker[1].match(/^(.+?)(?:[（(]([^（）()]+)[）)])?$/);
      const name = normalizeName(parts?.[1] || speaker[1]);
      // 排除常见说明性前缀，避免“例如：”“代码：”被当作人物。
      if (
        findRole(state.characters, name) ||
        (/^[\u3400-\u9fff·A-Za-z_-]{1,12}$/.test(name) &&
          !/^(例如|比如|注意|说明|画面|代码|问题|答案|提示|步骤|输出|输入|总结)$/.test(name))
      ) {
        currentRole = findRole(state.characters, name) || createCharacter(name, state.characters.length);
        if (!state.characters.some(role => role.id === currentRole.id)) state.characters.push(currentRole);
        pendingNote = parts?.[2] || '';
        pendingPose = currentRole.poses.find(pose => pose.name === pendingNote)?.id || '';
        content = speaker[2];
        if (!content.trim()) continue;
      }
    }
    const parsed = dialogueText(content);
    if (!parsed.speakText) continue;
    const note = [pendingNote, parsed.notes].filter(Boolean).join('；');
    result.push({
      ...createSegment(currentRole.id, content),
      speakText: parsed.speakText,
      tone: inferTone(note || content),
      toneDescription: note,
      portraitId: pendingPose || 'auto'
    });
    pendingNote = '';
    pendingPose = '';
  }
  return result;
}
export function punctuationPause(text: string) {
  return /[，、；：,;:]$/.test(text.trim()) ? 100 : 200;
}
export function splitSpeech(text: string): string[] {
  const units: string[] = [];
  let start = 0;
  for (const boundary of text.matchAll(/…+|\.{3,}|[。！？!?]+|[，、；：,;:]+/g)) {
    const end = boundary.index + boundary[0].length;
    if (/[…。！？!?]|\.{3}/.test(boundary[0]) || Array.from(text.slice(start, end)).length >= 18) {
      units.push(text.slice(start, end).trim());
      start = end;
    }
  }
  units.push(text.slice(start).trim());
  return units.filter(Boolean);
}
/** 与工坊一致按 24 字左右拆字幕；代码和知识括号沿用标点整理的保护规则。 */
function splitSubtitles(text: string) {
  if (protectedText(text)) return [text];
  const sentences = text.match(/[^。！？!?…]+(?:[。！？!?…]+|$)|[。！？!?…]+/g) || [text];
  return sentences.flatMap(sentence => {
    const result: string[] = [];
    let chars = Array.from(sentence.trim());
    while (chars.length > 24) {
      const window = chars.slice(0, 24);
      let cut = 0;
      // 关联结构开始前已有完整分句时，优先从该分句断开。
      const remaining = chars.join('');
      const pair =
        /(?:无论|不论|不管)[^。！？!?]{0,48}?(?:还是|或是)|(?:不仅|不但)[^。！？!?]{0,48}?(?:而且|并且)|(?:虽然|尽管|即使)[^。！？!?]{0,48}?(?:但是|可是|也|还)/.exec(
          remaining
        );
      if (pair && pair.index > 0 && pair.index <= 24) {
        const prefix = remaining.slice(0, pair.index);
        const boundary = [...prefix.matchAll(/[，、；：,;:]/g)].at(-1);
        if (boundary && boundary.index >= 7) cut = Array.from(prefix.slice(0, boundary.index + 1)).length;
      }
      const pairedCut = cut;
      window.forEach((char, index) => {
        if (index >= 8 && /[，、；：,;。！？!?]/.test(char)) cut = index + 1;
      });
      cut = pairedCut || cut;
      if (!cut) {
        const head = window.join('');
        for (const match of head.matchAll(
          /因为|所以|但是|不过|然后|接下来|如果|那么|而且|并且|只要|可以|需要|让我们|我们|你们|这个|那个/g
        )) {
          const position = Array.from(head.slice(0, match.index)).length;
          if (position >= 8) cut = position;
        }
      }
      cut ||= 24;
      let chunk = chars.slice(0, cut).join('').trim();
      if (!/[，、；：,;。！？!?]$/.test(chunk)) chunk += '，';
      result.push(chunk);
      chars = chars.slice(cut);
    }
    if (chars.length) result.push(chars.join('').trim());
    return result;
  });
}
/** 教学代码和括号里的知识按原文保留，不应用自然语言补标点规则。 */
const protectedText = (text: string) => /[<>{}[\]（）()]|\d\s*[+*/×÷=−-]\s*\d/.test(text);
export function semanticPunctuation(value: string) {
  if (protectedText(value)) return value.trim();
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[，、；：,;:]+(?=[。！？!?])/g, '')
    .replace(/([。！？!?])\1+/g, '$1')
    .replace(
      /([^，。！？、；：,;:!?\s])(?=但是|不过|可是|所以|因此|然后|接着|同时|而且|并且|如果|那么|因为|只要|也就是说|换句话说)/g,
      '$1，'
    )
    .replace(/((?:无论|不论|不管)[^，。！？、；：,;:!?]+?)(?=还是|或是)/g, '$1，')
    .replace(/((?:不仅|不但|虽然|尽管|即使)[^，。！？、；：,;:!?]+?)(?=而且|但是|可是)/g, '$1，');
}
function canCoalesce(previous: Segment, next: Segment) {
  return (
    previous.kind === 'dialogue' &&
    next.kind === 'dialogue' &&
    previous.characterId === next.characterId &&
    previous.tone === next.tone &&
    !previous.toneDescription &&
    !next.toneDescription &&
    !previous.speechControls?.length &&
    !next.speechControls?.length &&
    previous.portraitId === 'auto' &&
    next.portraitId === 'auto' &&
    previous.pauseMode !== 'manual' &&
    next.pauseMode !== 'manual' &&
    !previous.audio &&
    !next.audio &&
    !previous.sourceStep &&
    !next.sourceStep &&
    !protectedText(previous.text) &&
    !protectedText(next.text)
  );
}
export function updateAutomaticPauses(segments: Segment[]) {
  segments.forEach((segment, index) => {
    if (segment.kind !== 'dialogue' || segment.pauseMode !== 'auto') return;
    const next = segments[index + 1];
    segment.pauseAfterMs =
      !next || next.kind === 'wait'
        ? 0
        : next.kind === 'dialogue' && next.characterId !== segment.characterId
          ? 500
          : punctuationPause(segment.text);
  });
}
export function prepareSegments(segments: Segment[], preserveIds: ReadonlySet<string> = new Set()): Segment[] {
  const groups: Segment[] = [];
  for (const segment of segments) {
    const previous = groups.at(-1);
    if (previous && !preserveIds.has(previous.id) && !preserveIds.has(segment.id) && canCoalesce(previous, segment)) {
      const separator = /[。！？!?，,；;：:…]$/.test(previous.text.trim()) ? '' : '，';
      previous.text = previous.text.trim() + separator + segment.text.trim();
      previous.speakText = dialogueText(previous.text).speakText;
    } else groups.push({ ...segment });
  }
  const prepared = groups.flatMap(segment => {
    if (segment.kind !== 'dialogue' || preserveIds.has(segment.id) || segment.speechControls?.length) return [segment];
    let text = semanticPunctuation(segment.text);
    if (!text) return [];
    if (!/[。！？!?，,；;：:…]$/.test(text) && !protectedText(text)) {
      text +=
        segment.tone === '好奇提问' || /吗|呢|怎么|怎样|为什么|如何|哪里|哪个|谁|什么|是否/.test(text.slice(-8))
          ? '？'
          : /活泼|惊讶/.test(segment.tone)
            ? '！'
            : '。';
    }
    return splitSubtitles(text).map((part, partIndex, parts) => {
      const unchanged = part === segment.text;
      const finalPart = partIndex === parts.length - 1;
      return {
        ...segment,
        id: partIndex ? id('line') : segment.id,
        text: part,
        speakText: unchanged ? segment.speakText : dialogueText(part).speakText,
        tone: segment.tone === '平静讲解' ? inferTone(part) : segment.tone,
        pauseMode: finalPart ? segment.pauseMode : ('auto' as const),
        pauseAfterMs: finalPart ? segment.pauseAfterMs : punctuationPause(part),
        audio: unchanged ? segment.audio : undefined
      };
    });
  });
  updateAutomaticPauses(prepared);
  return prepared;
}
/** 先以未改动的行定位编辑区间，再保留同角色、一对一修改的人工设置。 */
export function prepareEditedTranscript(source: string, state: WorkshopState) {
  const parsed = parseTranscript(source, state);
  const signature = (segment: Segment) =>
    JSON.stringify([
      segment.kind,
      segment.kind === 'dialogue' ? segment.characterId : '',
      segment.text,
      segment.speakText,
      segment.kind === 'wait' ? segment.waitMs : null
    ]);
  const oldByContent = new Map<string, number[]>();
  state.segments.forEach((segment, index) => {
    const key = signature(segment);
    const indices = oldByContent.get(key) || [];
    indices.push(index);
    oldByContent.set(key, indices);
  });
  const matches = parsed.map(segment => oldByContent.get(signature(segment))?.shift() ?? -1);
  const anchors = matches.flatMap((oldIndex, newIndex) => (oldIndex < 0 ? [] : [{ oldIndex, newIndex }]));
  // 调换顺序的原句仍保留设置；混合改写与调序时不猜测新句子的归属。
  const ordered = anchors.every((anchor, index) => !index || anchors[index - 1].oldIndex < anchor.oldIndex);
  if (ordered) {
    let oldStart = 0;
    let newStart = 0;
    for (const anchor of [...anchors, { oldIndex: state.segments.length, newIndex: parsed.length }]) {
      if (anchor.oldIndex - oldStart === anchor.newIndex - newStart) {
        for (let offset = 0; offset < anchor.newIndex - newStart; offset++) {
          const old = state.segments[oldStart + offset];
          const next = parsed[newStart + offset];
          if (old.kind === next.kind && (old.kind !== 'dialogue' || old.characterId === next.characterId)) {
            matches[newStart + offset] = oldStart + offset;
          }
        }
      }
      oldStart = anchor.oldIndex + 1;
      newStart = anchor.newIndex + 1;
    }
  }
  const preserved = new Set<string>();
  const reconciled = parsed.map((segment, index) => {
    const old = state.segments[matches[index]];
    if (!old) return segment;
    preserved.add(old.id);
    if (signature(old) === signature(segment)) return old;
    const edited = {
      ...old,
      text: segment.text,
      speakText: segment.speakText,
      waitMs: segment.waitMs,
      // 整稿里明确写入的表演提示优先，否则沿用单句面板的人工设置。
      toneDescription: segment.toneDescription || old.toneDescription,
      useInstruction: old.useInstruction,
      generationError: undefined
    };
    const role = roleFor(state, edited);
    if (audioKey(edited, role) !== audioKey(old, role)) edited.audio = undefined;
    return edited;
  });
  const result = prepareSegments(reconciled, preserved);
  updateAutomaticPauses(result);
  return result;
}
export function presetReferenceUrl(role?: WorkshopCharacter) {
  return roleSpecs.some(spec => spec[0] === role?.referencePreset)
    ? `/sequence-player/voices/${role!.referencePreset}-reference.mp3`
    : '';
}
export function synthesisInstruction(segment: Segment) {
  if (segment.useInstruction === false) return '';
  const text = [segment.tone, segment.toneDescription].filter(Boolean).join('；');
  let result = '', count = 0;
  for (const char of text) {
    count += /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(char) ? 2 : 1;
    if (count > 100) break;
    result += char;
  }
  return result;
}
export function audioKey(segment: Segment, character?: WorkshopCharacter) {
  return JSON.stringify({
    v: 1,
    text: segment.speakText,
    voice: character?.ttsConfig.voiceId,
    provider: 'nautilus',
    model: character?.ttsConfig.model,
    rate: character?.ttsConfig.rate,
    tone: segment.tone,
    description: segment.toneDescription,
    ...(segment.useInstruction === false ? { instructionEnabled: false } : {}),
    ...(segment.speechControls?.length ? { speechControls: segment.speechControls } : {})
  });
}
export function isReady(segment: Segment, character?: WorkshopCharacter) {
  if (segment.kind !== 'dialogue') return true;
  const parts = segment.speechControls?.length || segment.audio?.units.length === 1 ? [segment.speakText] : splitSpeech(segment.speakText);
  return Boolean(
    character?.ttsConfig.voiceId &&
    segment.audio?.status === 'ready' &&
    segment.audio.key === audioKey(segment, character) &&
    parts.length &&
    segment.audio.units.length === parts.length &&
    segment.audio.units.every(
      (unit, index) =>
        unit.text === parts[index] &&
        Number.isFinite(unit.durationMs) &&
        unit.durationMs > 0 &&
        Number.isFinite(unit.pauseAfterMs) &&
        unit.pauseAfterMs >= 0 &&
        safeAudioUrl(unit.url)
    )
  );
}
export function safeAudioUrl(url: unknown): url is string {
  return typeof url === 'string' && /^\/api\/voice-lab\/output\/voice-lab[\w.-]+\.(wav|mp3|m4a)$/.test(url);
}
export function safeImageUrl(url: unknown): string {
  if (typeof url !== 'string') return '';
  if (
    /^\/(?:characters|sequence-player\/characters)\/[^?#]*\.(png|jpg|jpeg|webp|svg)$/i.test(url) &&
    !url.includes('..')
  )
    return url;
  if (/^\/api\/(?:sequence-player|character-library)\/assets\/[a-f0-9-]+\.webp$/.test(url)) return url;
  return '';
}
export function resolvePose(character?: WorkshopCharacter, segment?: Segment) {
  if (!character) return undefined;
  const manual = character.poses.find(pose => pose.id === segment?.portraitId);
  const keys: Record<Tone, string[]> = {
    平静讲解: ['讲解', '默认'],
    亲切鼓励: ['微笑', '开心'],
    活泼开心: ['开心', '激动', '星星眼'],
    好奇提问: ['疑惑', '思考'],
    惊讶强调: ['惊讶', '惊喜'],
    沉稳总结: ['严肃', '默认']
  };
  const automatic = (segment?.tone && segment.tone !== '平静讲解' ? keys[segment.tone] : [])
    .map(key => character.poses.find(pose => pose.name.includes(key)))
    .find(Boolean);
  const pose =
    manual || automatic || character.poses.find(item => item.id === character.defaultPoseId) || character.poses[0];
  return pose;
}
export function resolvePortrait(character?: WorkshopCharacter, segment?: Segment) {
  return safeImageUrl(resolvePose(character, segment)?.imageUrl) || PLACEHOLDER;
}
export function segmentDuration(segment: Segment, character?: WorkshopCharacter) {
  if (segment.kind === 'wait') return segment.waitMs;
  if (segment.kind === 'direction') return 500;
  const audioMs = isReady(segment, character)
    ? segment.audio!.units.reduce((sum, unit) => sum + unit.durationMs + unit.pauseAfterMs, 0)
    : Math.max(1000, (Array.from(segment.speakText).length * 220) / (character?.ttsConfig.rate || 1));
  return audioMs + segment.pauseAfterMs;
}
export function exportText(state: WorkshopState) {
  return state.segments
    .map(segment =>
      segment.kind === 'wait'
        ? `【停顿${segment.waitMs / 1000}s】`
        : segment.kind === 'direction'
          ? segment.text
          : `${roleFor(state, segment)?.displayName || '旁白'}：${segment.text}`
    )
    .join('\n');
}
export function toProject(state: WorkshopState) {
  return {
    schemaVersion: '0.4',
    title: state.title,
    rawScript: state.rawScript,
    characters: state.characters,
    steps: state.segments.map(segment => ({
      ...segment.sourceStep,
      id: segment.id,
      type: segment.kind,
      characterName: roleFor(state, segment)?.name,
      text: segment.text,
      speakText: segment.speakText,
      duration: segment.kind === 'wait' ? segment.waitMs : undefined,
      poseName: roleFor(state, segment)?.poses.find(pose => pose.id === segment.portraitId)?.name,
      workshop: { ...segment, sourceStep: undefined }
    })),
    settings: {
      ...state.settings,
      workshop: { version: 1, prepared: state.prepared, sourceScript: state.sourceScript, legacy: state.legacy }
    },
    assets: state.assets
  };
}

/** 接受现有 Nautilus 项目和旧工坊 JSON；旧工坊声音与音频一律丢弃。 */
export function fromProject(raw: any): WorkshopState {
  if (
    !raw ||
    typeof raw !== 'object' ||
    (!Array.isArray(raw.steps) &&
      !Array.isArray(raw.segments) &&
      !Array.isArray(raw.stageSequences) &&
      typeof raw.rawScript !== 'string' &&
      typeof raw.raw_script !== 'string')
  )
    throw new Error('请选择有效的逐字稿项目 JSON');
  const state = emptyState();
  const isOldWorkshop = Array.isArray(raw.segments);
  const isNativeWorkshop = raw.settings?.workshop?.version === 1 && !isOldWorkshop;
  if (isNativeWorkshop && Array.isArray(raw.characters) && raw.characters.length) state.characters = [];
  state.title = String(raw.title || raw.projectTitle || raw.project?.title || '未命名逐字稿');
  state.rawScript = String(raw.rawScript || raw.raw_script || raw.scriptText || '');
  state.sourceScript = String(raw.settings?.workshop?.sourceScript || raw.sourceScriptText || state.rawScript);
  state.prepared = Boolean(raw.settings?.workshop?.prepared || raw.wholeScriptReady);
  state.settings = { ...DEFAULT_SETTINGS, ...raw.settings };
  state.legacy = raw.settings?.workshop?.legacy || {
    stage: raw.stage,
    stageSequences: raw.stageSequences,
    source: raw.source
  };
  state.assets = Array.isArray(raw.assets)
    ? raw.assets.filter((asset: MediaAsset) => asset.type === 'image' && safeImageUrl(asset.url))
    : [];
  const oldIds = new Map<string, string>();
  for (const source of Array.isArray(raw.characters) ? raw.characters : []) {
    const name = normalizeName(String(source.name || source.displayName || '新角色'));
    const existing = findRole(state.characters, name);
    const role = existing || createCharacter(name, state.characters.length);
    if (isNativeWorkshop && source.id) role.id = String(source.id);
    if (roleSpecs.some(spec => spec[0] === source.referencePreset)) role.referencePreset = source.referencePreset;
    if (isNativeWorkshop && Array.isArray(source.aliases)) role.aliases = source.aliases.map(String);
    if (source.libraryRef && typeof source.libraryRef.id === 'string' && Number.isInteger(source.libraryRef.revision))
      role.libraryRef = { id: source.libraryRef.id, revision: source.libraryRef.revision };
    oldIds.set(source.id, role.id);
    if (!existing) state.characters.push(role);
    role.displayName = existing?.aliases?.includes(name) ? role.name : String(source.displayName || name);
    role.position = source.side === 'left' || source.position === 'left' ? 'left' : 'right';
    const poses = (source.poses || source.portraits || [])
      .map((pose: any) => ({
        id: String(pose.id || id('pose')),
        name: String(pose.name || '默认'),
        imageUrl: safeImageUrl(pose.imageUrl || pose.url),
        ...(normalizeLayout(pose.layout) ? { layout: normalizeLayout(pose.layout) } : {})
      }))
      .filter((pose: any) => pose.imageUrl);
    if (poses.length) role.poses = poses;
    role.defaultPoseId = role.poses.some(pose => pose.id === source.defaultPoseId)
      ? source.defaultPoseId
      : role.poses[0].id;
    // 只有本机导出的明确 nautilus 配置可以复用，其他供应商和旧 voice_* ID 不进入工作台。
    if (
      !isOldWorkshop &&
      source.ttsConfig?.provider === 'nautilus' &&
      !/^(?:voice_|nautilus-preset-)/.test(String(source.ttsConfig.voiceId || ''))
    ) {
      role.ttsConfig = {
        ...role.ttsConfig,
        ...source.ttsConfig,
        engine: 'external',
        provider: 'nautilus',
        rate: Math.min(2, Math.max(0.5, Number(source.ttsConfig.rate) || 1))
      };
    }
  }
  let sourceSteps = raw.steps || raw.segments || [];
  if (!raw.settings?.workshop && raw.stageSequences?.length) {
    sourceSteps = raw.stageSequences.flatMap((sequence: any) =>
      (sequence.events || []).map((event: any) => ({
        ...event,
        characterName: event.actor,
        text: event.speakText || '',
        speakText: event.synthesisText || event.speakText || ''
      }))
    );
  }
  state.segments = sourceSteps.map((step: any) => {
    const data = !isOldWorkshop ? step.workshop || step : step;
    let character =
      state.characters.find(role => role.id === oldIds.get(data.characterId)) ||
      findRole(state.characters, step.characterName || '');
    if (!character && step.characterName) {
      character = createCharacter(step.characterName, state.characters.length);
      state.characters.push(character);
    }
    const kind =
      step.type === 'wait' || data.kind === 'wait'
        ? 'wait'
        : step.type === 'direction' || data.kind === 'direction'
          ? 'direction'
          : 'dialogue';
    const text = String(data.text || step.text || '');
    const segment: Segment = {
      ...createSegment(character?.id || state.characters[0].id, text),
      id: String(data.id || id('line')),
      kind,
      speakText: String(data.speakText ?? step.speakText ?? dialogueText(text).speakText),
      tone: TONES.includes(data.tone || data.tts?.tone) ? data.tone || data.tts.tone : inferTone(text),
      toneDescription: String(data.toneDescription || data.tts?.toneDescription || ''),
      useInstruction: typeof data.useInstruction === 'boolean' ? data.useInstruction : isNativeWorkshop,
      speechControls: normalizeSpeechControls(data.speechControls),
      portraitId: String(
        data.portraitId ||
          data.portrait?.portraitId ||
          character?.poses.find(pose => pose.name === step.poseName)?.id ||
          'auto'
      ),
      pauseAfterMs: Math.min(
        5000,
        Math.max(0, Number(data.pauseAfterMs ?? data.timing?.pauseAfterMs ?? punctuationPause(text)) || 0)
      ),
      pauseMode: data.pauseMode === 'auto' ? 'auto' : 'manual',
      waitMs: Math.min(60000, Math.max(100, Number(data.waitMs || step.duration) || 1000)),
      sourceStep: { sourceRef: step.sourceRef, displayNote: step.displayNote, visualCue: step.visualCue }
    };
    if (isNativeWorkshop && typeof data.generationError === 'string') segment.generationError = data.generationError;
    if (
      !isOldWorkshop &&
      (data.audio?.key === audioKey(segment, character) || data.audio?.status === 'failed') &&
      Array.isArray(data.audio.units) &&
      data.audio.units.every((unit: AudioUnit) => safeAudioUrl(unit.url))
    )
      segment.audio = data.audio;
    return segment;
  });
  if (!state.segments.length && state.rawScript) state.segments = parseTranscript(state.rawScript, state);
  if (!state.rawScript) state.rawScript = exportText(state);
  if (!state.sourceScript) state.sourceScript = state.rawScript;
  return state;
}

export function buildRenderJob(state: WorkshopState) {
  return {
    version: 1,
    jobType: 'transcript-video-render',
    project: toProject(state),
    canvas: { width: 1920, height: 1080, background: '#ffffff' },
    output: { format: 'mp4', fps: 30 },
    segments: state.segments.map(segment => ({
      ...segment,
      portraitUrl: resolvePortrait(roleFor(state, segment), segment),
      durationMs: segmentDuration(segment, roleFor(state, segment))
    }))
  };
}
