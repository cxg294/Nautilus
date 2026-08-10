import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import config from '../config/env.js';

export const DEFAULT_COSYVOICE_MODEL = 'cosyvoice-v3.5-flash';
export const DEFAULT_VOICE_ENROLLMENT_MODEL = 'voice-enrollment';

const COSYVOICE_SYNTHESIS_PATH = '/services/audio/tts/SpeechSynthesizer';
const CUSTOMIZATION_PATH = '/services/audio/tts/customization';
const AUDIO_OUTPUT_DIR = path.resolve(process.cwd(), 'server', 'voice-lab-output');

const MIME_EXTENSION_MAP = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'application/octet-stream': 'wav',
};

const COSYVOICE_LANGUAGES = new Set(['zh', 'en', 'fr', 'de', 'ja', 'ko', 'ru', 'pt', 'th', 'id', 'vi']);
const COSYVOICE_DESIGN_LANGUAGES = new Set(['zh', 'en']);

export function ensureDashScopeConfigured() {
  if (!config.dashscope.apiKey) {
    throw new Error('未配置 DASHSCOPE_API_KEY，无法调用百炼语音服务。');
  }
}

export function getVoiceLabOutputDir() {
  fs.mkdirSync(AUDIO_OUTPUT_DIR, { recursive: true });
  return AUDIO_OUTPUT_DIR;
}

function getDashScopeUrl(apiPath) {
  return `${config.dashscope.baseUrl}${apiPath}`;
}

function normalizeDashScopeError(payload, fallbackStatus) {
  const code = payload?.code || payload?.error?.code || `HTTP_${fallbackStatus}`;
  const message = payload?.message || payload?.error?.message || payload?.raw || '百炼语音服务调用失败';
  return `${code}: ${message}`;
}

async function readDashScopeResponse(response) {
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }

  if (!response.ok || payload?.code || payload?.error) {
    throw new Error(normalizeDashScopeError(payload, response.status));
  }

  return payload;
}

export async function callDashScope(apiPath, body) {
  ensureDashScopeConfigured();

  const response = await fetch(getDashScopeUrl(apiPath), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.dashscope.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  return readDashScopeResponse(response);
}

function getAudioUrlFromSynthesis(payload) {
  return payload?.output?.audio?.url || payload?.output?.url || '';
}

function getExtensionFromContentType(contentType, fallback = 'wav') {
  const type = String(contentType || '').split(';')[0].trim().toLowerCase();
  return MIME_EXTENSION_MAP[type] || fallback;
}

function getMimeTypeFromExtension(extension) {
  if (extension === 'mp3') return 'audio/mpeg';
  if (extension === 'm4a') return 'audio/mp4';
  return 'audio/wav';
}

export async function downloadAudioToOutput(audioUrl, preferredExtension = 'wav') {
  const response = await fetch(audioUrl);
  if (!response.ok) {
    throw new Error(`音频结果下载失败: HTTP ${response.status}`);
  }

  const contentType = response.headers.get('content-type') || '';
  const extension = getExtensionFromContentType(contentType, preferredExtension);
  const fileName = `voice-lab-${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const filePath = path.join(getVoiceLabOutputDir(), fileName);
  const buffer = Buffer.from(await response.arrayBuffer());

  if (buffer.length === 0) {
    throw new Error('音频结果为空');
  }

  fs.writeFileSync(filePath, buffer);

  return {
    fileName,
    filePath,
    url: `/api/voice-lab/output/${fileName}`,
    contentType: contentType || getMimeTypeFromExtension(extension),
    bytes: buffer.length,
  };
}

export function saveBase64AudioToOutput(base64Data, extension = 'wav') {
  const normalized = String(base64Data || '').replace(/^data:audio\/[\w.+-]+;base64,/, '');
  const buffer = Buffer.from(normalized, 'base64');

  if (buffer.length === 0) {
    throw new Error('预览音频为空');
  }

  const safeExtension = ['wav', 'mp3', 'pcm'].includes(extension) ? extension : 'wav';
  const fileName = `voice-lab-preview-${Date.now()}-${crypto.randomUUID()}.${safeExtension}`;
  const filePath = path.join(getVoiceLabOutputDir(), fileName);
  fs.writeFileSync(filePath, buffer);

  return {
    fileName,
    filePath,
    url: `/api/voice-lab/output/${fileName}`,
    contentType: getMimeTypeFromExtension(safeExtension),
    bytes: buffer.length,
  };
}

export function countTtsBillingCharacters(text) {
  return Array.from(String(text || '')).reduce((sum, char) => {
    return sum + (/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(char) ? 2 : 1);
  }, 0);
}

export function estimateTtsCost(text, extraText = '', pricePer10k = 0.8) {
  const characters = countTtsBillingCharacters(text) + countTtsBillingCharacters(extraText);
  return {
    characters,
    pricePer10k,
    estimatedCny: Number(((characters / 10000) * pricePer10k).toFixed(4)),
  };
}

function normalizeCosyPrefix(value) {
  const normalized = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 10);

  if (!normalized) {
    return `v${Date.now().toString(36).slice(-6)}`.slice(0, 10);
  }

  return /^[A-Za-z]/.test(normalized) ? normalized : `v${normalized}`.slice(0, 10);
}

function normalizeCosyLanguage(value, fallback = 'zh') {
  return COSYVOICE_LANGUAGES.has(value) ? value : fallback;
}

function normalizeCosyDesignLanguage(value) {
  return COSYVOICE_DESIGN_LANGUAGES.has(value) ? value : 'zh';
}

export async function synthesizeSpeech(options) {
  const {
    text,
    voice,
    model = DEFAULT_COSYVOICE_MODEL,
    languageHint = 'zh',
    instruction = '',
    rate = 1,
    format = 'wav',
    sampleRate = 24000,
    download = true,
  } = options;

  const trimmedText = String(text || '').trim();
  if (!trimmedText) throw new Error('合成文本不能为空');
  if (!voice) throw new Error('音色不能为空');

  const input = {
    text: trimmedText,
    voice: String(voice).trim(),
    format,
    sample_rate: Number(sampleRate) || 24000,
    rate: Math.min(Math.max(Number(rate) || 1, 0.5), 2),
    language_hints: [normalizeCosyLanguage(languageHint)],
  };

  if (instruction?.trim()) {
    input.instruction = instruction.trim();
  }

  const payload = await callDashScope(COSYVOICE_SYNTHESIS_PATH, {
    model,
    input,
  });

  const audioUrl = getAudioUrlFromSynthesis(payload);
  if (!audioUrl) {
    throw new Error('百炼返回结果中没有找到音频 URL');
  }

  const audio = download ? await downloadAudioToOutput(audioUrl, format) : null;

  return {
    requestId: payload.request_id || payload.requestId || '',
    model,
    voice: input.voice,
    sourceAudioUrl: audioUrl,
    audio,
    usage: payload.usage || {},
    estimate: estimateTtsCost(trimmedText, instruction),
  };
}

export async function createCosyVoiceClone(options) {
  const {
    audioUrl,
    prefix,
    targetModel = DEFAULT_COSYVOICE_MODEL,
    languageHint = 'zh',
    maxPromptAudioLength = 10,
    enablePreprocess = false,
  } = options;

  const url = String(audioUrl || '').trim();
  if (!/^https?:\/\//i.test(url)) {
    throw new Error('CosyVoice 复刻需要公网可访问的音频 URL');
  }

  const input = {
    action: 'create_voice',
    target_model: targetModel,
    prefix: normalizeCosyPrefix(prefix),
    url,
    language_hints: [normalizeCosyLanguage(languageHint)],
    max_prompt_audio_length: Math.min(Math.max(Number(maxPromptAudioLength) || 10, 3), 30),
    enable_preprocess: Boolean(enablePreprocess),
  };

  const payload = await callDashScope(CUSTOMIZATION_PATH, {
    model: DEFAULT_VOICE_ENROLLMENT_MODEL,
    input,
  });

  const output = payload.output || {};
  return {
    requestId: payload.request_id || '',
    voice: output.voice_id || output.voice || '',
    targetModel,
    source: 'clone',
    status: output.status || '',
    usage: payload.usage || {},
  };
}

export async function createCosyVoiceDesign(options) {
  const {
    voicePrompt,
    previewText,
    prefix,
    targetModel = DEFAULT_COSYVOICE_MODEL,
    languageHint = 'zh',
    responseFormat = 'wav',
    sampleRate = 24000,
  } = options;

  const prompt = String(voicePrompt || '').trim();
  const text = String(previewText || '').trim();
  if (!prompt) throw new Error('声音描述不能为空');
  if (!text) throw new Error('预览文本不能为空');

  const payload = await callDashScope(CUSTOMIZATION_PATH, {
    model: DEFAULT_VOICE_ENROLLMENT_MODEL,
    input: {
      action: 'create_voice',
      target_model: targetModel,
      voice_prompt: prompt,
      preview_text: text,
      prefix: normalizeCosyPrefix(prefix),
      language_hints: [normalizeCosyDesignLanguage(languageHint)],
    },
    parameters: {
      sample_rate: Number(sampleRate) || 24000,
      response_format: responseFormat,
    },
  });

  const output = payload.output || {};
  const previewAudio = output.preview_audio || {};
  const audio = previewAudio.data
    ? saveBase64AudioToOutput(previewAudio.data, previewAudio.response_format || responseFormat)
    : null;

  return {
    requestId: payload.request_id || '',
    voice: output.voice_id || output.voice || '',
    targetModel: output.target_model || targetModel,
    source: 'design',
    previewAudio: audio,
    usage: payload.usage || {},
  };
}

export async function listCosyVoiceVoices(options = {}) {
  const pageSize = Math.min(Math.max(Number(options.pageSize) || 50, 1), 100);
  const pageIndex = Math.max(Number(options.pageIndex) || 0, 0);
  const prefix = String(options.prefix || '').trim();

  const input = {
    action: 'list_voice',
    page_size: pageSize,
    page_index: pageIndex,
  };
  if (prefix) input.prefix = prefix;

  const payload = await callDashScope(CUSTOMIZATION_PATH, {
    model: DEFAULT_VOICE_ENROLLMENT_MODEL,
    input,
  });

  const output = payload.output || {};
  const voices = Array.isArray(output.voice_list) ? output.voice_list : [];

  return {
    requestId: payload.request_id || '',
    pageIndex,
    pageSize,
    totalCount: output.total_count ?? voices.length,
    voices: voices.map(item => ({
      id: item.voice_id || item.voice || '',
      voice: item.voice_id || item.voice || '',
      language: item.language || '',
      targetModel: item.target_model || '',
      createdAt: item.gmt_create || '',
      updatedAt: item.gmt_modified || '',
      status: item.status || '',
      voicePrompt: item.voice_prompt || '',
      previewText: item.preview_text || '',
      source: item.voice_prompt ? 'design' : 'clone',
    })).filter(item => item.id),
  };
}

export async function deleteCosyVoiceVoice(voice) {
  const value = String(voice || '').trim();
  if (!value) throw new Error('音色 ID 不能为空');

  const payload = await callDashScope(CUSTOMIZATION_PATH, {
    model: DEFAULT_VOICE_ENROLLMENT_MODEL,
    input: {
      action: 'delete_voice',
      voice_id: value,
    },
  });

  return {
    requestId: payload.request_id || '',
    voice: value,
    usage: payload.usage || {},
  };
}
