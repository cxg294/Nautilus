import { request } from '../request';

export type VoiceLanguageHint = 'zh' | 'en' | 'fr' | 'de' | 'ja' | 'ko' | 'ru' | 'pt' | 'th' | 'id' | 'vi';
export type VoiceDesignLanguage = 'zh' | 'en';

export interface VoiceLabStatus {
  configured: boolean;
  baseUrl: string;
  defaults: {
    synthesisModel: string;
    cloneModel: string;
    designModel: string;
    pricePer10k: number;
    hasSystemVoices: boolean;
  };
  oss?: {
    configured: boolean;
    region: string;
    bucket: string;
    prefix: string;
    signedUrlExpiresSeconds: number;
    cleanupAfterClone: boolean;
  };
}

export interface VoiceLabEstimate {
  characters: number;
  pricePer10k: number;
  estimatedCny: number;
}

export interface VoiceLabAudio {
  fileName: string;
  /** 仅用于页面显示和浏览器下载的可读文件名；内部存储仍使用 fileName。 */
  downloadName?: string;
  url: string;
  contentType: string;
  bytes: number;
  createdAt?: string;
}

export interface VoiceEffectPreset {
  id: string;
  label: string;
  description: string;
  params: VoiceEffectParams;
}

export interface VoiceEffectParams {
  pitchSemitones: number;
  effectStrength: number;
  clarity: number;
  space: number;
}

export interface VoiceEffectResult {
  presetId: string;
  preset: Omit<VoiceEffectPreset, 'id'>;
  params: VoiceEffectParams;
  audio: VoiceLabAudio;
}

export interface VoiceSynthesisPayload {
  text: string;
  voice: string;
  model: string;
  languageHint: VoiceLanguageHint;
  instruction?: string;
  rate?: number;
}

export interface VoiceSynthesisResult {
  requestId: string;
  model: string;
  voice: string;
  sourceAudioUrl: string;
  audio: VoiceLabAudio;
  auditionAudio?: VoiceLabAudio | null;
  auditionSaved?: boolean;
  usage: {
    characters?: number;
  };
  estimate: VoiceLabEstimate;
}

export interface VoiceCloneItem {
  id: string;
  voice: string;
  displayName?: string;
  language: string;
  targetModel: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  source: 'clone' | 'design' | string;
  /** 创建该音色的 Nautilus 用户名；没有本地创建者时为空。 */
  creatorUsername?: string;
  /** 没有本地创建记录的云端音色按系统默认处理。 */
  isSystemDefault?: boolean;
  auditionAudio?: VoiceLabAudio | null;
  auditionText?: string;
  voicePrompt?: string;
  previewText?: string;
}

export interface VoiceCloneListResult {
  requestId: string;
  pageIndex: number;
  pageSize: number;
  totalCount: number;
  voices: VoiceCloneItem[];
}

export interface VoiceCreateResult {
  requestId: string;
  voice: string;
  displayName?: string;
  targetModel: string;
  source: 'clone' | 'design';
  status?: string;
  previewAudio?: VoiceLabAudio | null;
  auditionAudio?: VoiceLabAudio | null;
  transit?: {
    bucket: string;
    objectName: string;
    expiresAt: string;
    cleanupAfterClone: boolean;
  };
  usage: {
    count?: number;
  };
}

export interface DeleteVoiceResult {
  requestId: string;
  voice: string;
  usage: {
    count?: number;
  };
}

export function fetchVoiceLabStatus() {
  return request<VoiceLabStatus>({ url: '/voice-lab/status' });
}

export function estimateVoiceCost(text: string) {
  return request<VoiceLabEstimate>({ url: '/voice-lab/estimate', method: 'post', data: { text } });
}

export function synthesizeVoice(data: VoiceSynthesisPayload) {
  return request<VoiceSynthesisResult>({ url: '/voice-lab/synthesize', method: 'post', data, timeout: 120000 });
}

export function fetchVoiceEffectPresets() {
  return request<{ presets: VoiceEffectPreset[] }>({ url: '/voice-lab/effects/presets' });
}

export function renderVoiceEffect(data: { sourceFileName: string; sourceDownloadName?: string; presetId: string; params?: Partial<VoiceEffectParams> }) {
  return request<VoiceEffectResult>({ url: '/voice-lab/effects/render', method: 'post', data, timeout: 120000 });
}

export function uploadEffectSource(data: FormData) {
  return request<VoiceLabAudio>({ url: '/voice-lab/effects/upload', method: 'post', data, timeout: 120000 });
}

export function renderVoiceEffectsBatch(data: { sourceFileName: string; presetIds: string[] }) {
  return request<{ results: VoiceEffectResult[] }>({ url: '/voice-lab/effects/render-batch', method: 'post', data, timeout: 240000 });
}

export function fetchVoiceClones(params: { pageSize?: number; pageIndex?: number; prefix?: string; onlyMine?: boolean } = {}) {
  return request<VoiceCloneListResult>({ url: '/voice-lab/voices', params });
}

export function createVoiceClone(data: {
  audioUrl: string;
  prefix: string;
  displayName?: string;
  languageHint: VoiceLanguageHint;
  maxPromptAudioLength?: number;
  enablePreprocess?: boolean;
}) {
  return request<VoiceCreateResult>({
    url: '/voice-lab/voices/clone',
    method: 'post',
    data,
    timeout: 180000,
  });
}

export function createVoiceCloneFromUpload(data: FormData) {
  return request<VoiceCreateResult>({
    url: '/voice-lab/voices/clone-upload',
    method: 'post',
    data,
    timeout: 240000,
  });
}

export function createVoiceDesign(data: {
  voicePrompt: string;
  previewText: string;
  prefix: string;
  displayName?: string;
  languageHint: VoiceDesignLanguage;
}) {
  return request<VoiceCreateResult>({
    url: '/voice-lab/voices/design',
    method: 'post',
    data,
    timeout: 180000,
  });
}

export function updateVoiceName(voice: string, displayName: string) {
  return request<{ voice: string; displayName: string }>({
    url: `/voice-lab/voices/${encodeURIComponent(voice)}/name`,
    method: 'patch',
    data: { displayName },
  });
}

export function generateVoiceAudition(voice: string, data: {
  text?: string;
  model: string;
  languageHint: VoiceLanguageHint;
  instruction?: string;
  rate?: number;
}) {
  return request<VoiceSynthesisResult>({
    url: `/voice-lab/voices/${encodeURIComponent(voice)}/audition`,
    method: 'post',
    data,
    timeout: 120000,
  });
}

export function deleteVoiceClone(voice: string) {
  return request<DeleteVoiceResult>({ url: `/voice-lab/voices/${encodeURIComponent(voice)}`, method: 'delete' });
}
