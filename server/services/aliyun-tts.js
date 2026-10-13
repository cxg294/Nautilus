import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import config from '../config/env.js';
import { requireVoiceModel } from './voice-models.js';
import { getCatalogVoice } from './voice-catalog.js';
import { compileSpeech } from '../../shared/speech-controls.js';
import { alignControlledSpeech } from './speech-alignment.js';
import { normalizeWordIndices } from './voice-alignment-indices.js';
import db from '../db/index.js';

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

export function parseSseJsonPayloads(text) {
  const payloads = [];
  let dataLines = [];

  const flushEvent = () => {
    if (!dataLines.length) return;

    const data = dataLines.join('\n').trim();
    dataLines = [];
    if (!data || data === '[DONE]') return;

    try {
      payloads.push(JSON.parse(data));
    } catch {
      throw new Error('百炼语音服务返回了无法解析的流式事件');
    }
  };

  for (const line of String(text || '').split(/\r?\n/)) {
    if (!line.trim()) {
      flushEvent();
      continue;
    }

    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  flushEvent();
  return payloads;
}

async function readDashScopeSseResponse(response) {
  const text = await response.text();
  let payloads;

  try {
    payloads = parseSseJsonPayloads(text);
  } catch (error) {
    if (!response.ok) {
      let payload;
      try {
        payload = text ? JSON.parse(text) : {};
      } catch {
        payload = { raw: text };
      }
      throw new Error(normalizeDashScopeError(payload, response.status), { cause: error });
    }
    throw error;
  }

  const errorPayload = payloads.find(payload => payload?.code || payload?.error);
  if (!response.ok || errorPayload) {
    throw new Error(normalizeDashScopeError(errorPayload || { raw: text }, response.status));
  }
  if (!payloads.length) {
    throw new Error('百炼语音服务没有返回有效的流式事件');
  }

  return payloads;
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

export async function callDashScopeSse(apiPath, body) {
  ensureDashScopeConfigured();

  const response = await fetch(getDashScopeUrl(apiPath), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.dashscope.apiKey}`,
      'Content-Type': 'application/json',
      'X-DashScope-SSE': 'enable',
    },
    body: JSON.stringify(body),
  });

  return readDashScopeSseResponse(response);
}

function getAudioUrlFromSynthesis(payload) {
  return payload?.output?.audio?.url || payload?.output?.url || '';
}

export function collectWordAlignment(payloads) {
  const sentences = [];
  let originalOffset = 0;

  for (const payload of payloads || []) {
    const output = payload?.output || payload?.payload?.output;
    if (output?.type !== 'sentence-end' || !Array.isArray(output?.sentence?.words)) continue;

    const words = output.sentence.words.map(word => ({
      text: String(word?.text || ''),
      beginIndex: Number(word?.begin_index) || 0,
      endIndex: Number(word?.end_index) || 0,
      beginTimeMs: Number(word?.begin_time) || 0,
      endTimeMs: Number(word?.end_time) || 0,
    })).filter(word => word.text && word.endTimeMs >= word.beginTimeMs);

    const sentenceText = String(output.original_text || '');
    sentences.push({
      index: Number(output.sentence.index) || 0,
      text: sentenceText,
      words: normalizeWordIndices(sentenceText, words, originalOffset),
    });
    originalOffset += Array.from(sentenceText).length;
  }

  sentences.sort((left, right) => left.index - right.index);
  return {
    requested: true,
    available: sentences.some(sentence => sentence.words.length > 0),
    unit: 'ms',
    granularity: 'word',
    sentences,
  };
}

// 上游有句内字符索引、全文字符索引和全文 token 索引三种实际返回。
// Audio 的 token 可含尾随标点（如“好，”），所以不能只减去分句偏移量。
// 对齐到 original_text 后，对外统一为句内字符索引，时间仍相对整段音频。

function findLastSynthesisPayload(payloads) {
  for (let index = payloads.length - 1; index >= 0; index -= 1) {
    if (getAudioUrlFromSynthesis(payloads[index])) return payloads[index];
  }
  return payloads[payloads.length - 1] || {};
}

function getLastUsage(payloads) {
  for (let index = payloads.length - 1; index >= 0; index -= 1) {
    const usage = payloads[index]?.usage || payloads[index]?.payload?.usage;
    if (usage) return usage;
  }
  return {};
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
    enableWordTimestamps = false,
    speechControls = [],
  } = options;

  const modelInfo = requireVoiceModel(model);
  const trimmedText = String(text || '').trim();
  if (!trimmedText) throw new Error('合成文本不能为空');
  if (!voice) throw new Error('音色不能为空');
  const compiled = compileSpeech(trimmedText, speechControls);
  const catalogVoice = getCatalogVoice(voice);
  if (compiled.enabled) {
    const binding = db.prepare('SELECT clone_params FROM voice_lab_voice_bindings WHERE voice_id=?').get(voice);
    const name = db.prepare('SELECT source FROM voice_lab_voice_names WHERE voice_id=?').get(voice);
    if (catalogVoice?.ssmlSupported === false || name?.source === 'design' || JSON.parse(binding?.clone_params || '{}').kind === 'design') {
      throw new Error('此音色不支持停顿和指定读法，请选择复刻音色或基础音色');
    }
  }

  const input = {
    text: compiled.text,
    voice: String(voice).trim(),
    format,
    sample_rate: Number(sampleRate) || 24000,
    rate: Math.min(Math.max(Number(rate) || 1, 0.5), 2),
    language_hints: [normalizeCosyLanguage(languageHint)],
  };
  if (compiled.enabled) input.enable_ssml = true;

  if (instruction?.trim()) {
    input.instruction = instruction.trim();
  }

  let payload;
  let usage;
  let alignment = {
    requested: Boolean(enableWordTimestamps),
    available: false,
    unit: 'ms',
    granularity: 'word',
    sentences: [],
  };

  if (enableWordTimestamps && catalogVoice?.wordTimestampsSupported !== false) {
    input.word_timestamp_enabled = true;
    const payloads = await callDashScopeSse(COSYVOICE_SYNTHESIS_PATH, { model, input });
    payload = findLastSynthesisPayload(payloads);
    usage = getLastUsage(payloads);
    alignment = compiled.enabled ? alignControlledSpeech(payloads, compiled) : collectWordAlignment(payloads);
  } else {
    payload = await callDashScope(COSYVOICE_SYNTHESIS_PATH, { model, input });
    usage = payload.usage || {};
  }

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
    usage,
    alignment,
    displayText: trimmedText,
    spokenText: compiled.spokenText,
    estimate: estimateTtsCost(trimmedText, instruction, modelInfo.pricePer10k),
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
    throw new Error('声音复刻需要公网可访问的音频 URL');
  }

  const input = {
    action: 'create_voice',
    target_model: targetModel,
    prefix: normalizeCosyPrefix(prefix),
    url,
    language_hints: [normalizeCosyLanguage(languageHint)],
    max_prompt_audio_length: Math.min(Math.max(Number(maxPromptAudioLength) || 10, 3), 30),
    // multipart/form-data 将复选框值传成字符串；Boolean('false') 会错误开启预处理。
    enable_preprocess: enablePreprocess === true || enablePreprocess === 'true',
    enable_volume_normalization: 'false',
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
  const pageSize = Math.min(Math.max(Number(options.pageSize) || 100, 1), 100);
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

export async function queryVoice(voice) {
  const payload = await callDashScope(CUSTOMIZATION_PATH, {
    model: DEFAULT_VOICE_ENROLLMENT_MODEL,
    input: { action: 'query_voice', voice_id: voice },
  });
  const output = payload.output || {};
  return { targetModel: output.target_model || '', status: output.status || '', resourceLink: output.resource_link || '' };
}
