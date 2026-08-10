import { Router } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import fsp from 'fs/promises';
import multer from 'multer';
import path from 'path';
import config from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { success, fail, CODE } from '../utils/response.js';
import {
  DEFAULT_COSYVOICE_MODEL,
  countTtsBillingCharacters,
  createCosyVoiceClone,
  createCosyVoiceDesign,
  deleteCosyVoiceVoice,
  estimateTtsCost,
  getVoiceLabOutputDir,
  listCosyVoiceVoices,
  synthesizeSpeech,
} from '../services/aliyun-tts.js';
import {
  getOssPublicConfig,
  probeOssBucket,
  scheduleOssObjectCleanup,
  uploadVoicePromptToOss,
} from '../services/aliyun-oss.js';
import {
  getVoiceMetadata,
  markVoiceDeleted,
  mergeVoiceDisplayNames,
  normalizeVoiceDisplayName,
  upsertVoiceAudition,
  upsertVoiceDisplayName,
} from '../services/voice-lab-names.js';
import { listVoiceEffectPresets, renderVoiceEffect } from '../services/voice-effects.js';
import { makeSourceDownloadName, makeSynthesisDownloadName } from '../services/audio-download-names.js';

const router = Router();

const VOICE_UPLOAD_DIR = path.join(process.cwd(), 'server', 'voice-lab-upload');
const MAX_AUDIO_BYTES = 30 * 1024 * 1024;
const COSY_LANGUAGES = new Set(['zh', 'en', 'fr', 'de', 'ja', 'ko', 'ru', 'pt', 'th', 'id', 'vi']);
const DESIGN_LANGUAGES = new Set(['zh', 'en']);
const TTS_MODELS = new Set([
  DEFAULT_COSYVOICE_MODEL,
  'cosyvoice-v3.5-plus',
]);

const PERMISSION = {
  clone: 'feature:voice-lab:clone',
  design: 'feature:voice-lab:design',
  manageVoices: 'feature:voice-lab:manage-voices',
};

fs.mkdirSync(VOICE_UPLOAD_DIR, { recursive: true });

const audioUpload = multer({
  dest: VOICE_UPLOAD_DIR,
  limits: { fileSize: MAX_AUDIO_BYTES },
  fileFilter(_req, file, callback) {
    if (/^audio\//i.test(file.mimetype) || /\.(wav|mp3|m4a|aac|flac|ogg|opus|amr|webm)$/i.test(file.originalname || '')) {
      callback(null, true);
      return;
    }
    callback(new Error('仅支持 wav、mp3、m4a、aac、flac、ogg、opus、amr、webm 音频文件'));
  },
});

router.use(requireAuth, requirePermission('module:voice-lab:access'));

function asSafeLanguage(value) {
  return COSY_LANGUAGES.has(value) ? value : 'zh';
}

function asSafeDesignLanguage(value) {
  return DESIGN_LANGUAGES.has(value) ? value : 'zh';
}

function asSafeTtsModel(value) {
  return TTS_MODELS.has(value) ? value : DEFAULT_COSYVOICE_MODEL;
}

function asSafeRate(value) {
  return Math.min(Math.max(Number(value) || 1, 0.5), 2);
}

function toClientError(res, error, fallback = '语音服务调用失败') {
  const message = error?.message || fallback;
  const status = /不能为空|仅支持|过长|缺少|无效|公网|文件过大|File too large/.test(message) ? 400 : 500;
  return res.status(status).json(fail(status === 400 ? CODE.VALIDATION : CODE.FAIL, message));
}

function handleAudioUpload(req, res, next) {
  audioUpload.single('audio')(req, res, error => {
    if (error) {
      toClientError(res, error, '音频上传失败');
      return;
    }
    next();
  });
}

router.get('/status', (req, res) => {
  res.json(success({
    configured: Boolean(config.dashscope.apiKey),
    baseUrl: config.dashscope.baseUrl,
    defaults: {
      synthesisModel: DEFAULT_COSYVOICE_MODEL,
      cloneModel: DEFAULT_COSYVOICE_MODEL,
      designModel: DEFAULT_COSYVOICE_MODEL,
      pricePer10k: 0.8,
      hasSystemVoices: false,
    },
    oss: getOssPublicConfig(),
  }));
});

router.get('/oss/probe', asyncHandler(async (_req, res) => {
  try {
    const result = await probeOssBucket();
    res.json(success(result));
  } catch (error) {
    console.error('[voice-lab] OSS probe error:', error);
    toClientError(res, error, 'OSS 配置检测失败');
  }
}));

router.post('/estimate', (req, res) => {
  const estimate = estimateTtsCost(req.body?.text || '', req.body?.instruction || '');
  res.json(success(estimate));
});

router.get('/effects/presets', (_req, res) => {
  res.json(success({ presets: listVoiceEffectPresets() }));
});

router.post('/effects/upload', handleAudioUpload, asyncHandler(async (req, res) => {
  try {
    if (!req.file) return res.status(400).json(fail(CODE.VALIDATION, '请上传音频文件'));
    const extension = path.extname(req.file.originalname || '').toLowerCase().replace('.', '');
    if (!['wav', 'mp3', 'm4a', 'pcm'].includes(extension)) {
      return res.status(400).json(fail(CODE.VALIDATION, '效果器暂支持 wav、mp3、m4a、pcm 音频'));
    }
    const fileName = `voice-lab-effect-source-${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const filePath = path.join(getVoiceLabOutputDir(), fileName);
    await fsp.rename(req.file.path, filePath);
    const bytes = (await fsp.stat(filePath)).size;
    const contentType = extension === 'mp3' ? 'audio/mpeg' : extension === 'm4a' ? 'audio/mp4' : 'audio/wav';
    res.json(success({ fileName, downloadName: makeSourceDownloadName(req.file.originalname), url: `/api/voice-lab/output/${fileName}`, contentType, bytes }));
  } catch (error) {
    console.error('[voice-lab] upload effect source error:', error);
    toClientError(res, error, '效果器音频上传失败');
  } finally {
    if (req.file?.path) fsp.unlink(req.file.path).catch(() => {});
  }
}));

router.post('/effects/render', asyncHandler(async (req, res) => {
  try {
    const result = await renderVoiceEffect({
      sourceFileName: req.body?.sourceFileName,
      sourceDownloadName: req.body?.sourceDownloadName,
      presetId: String(req.body?.presetId || ''),
      params: req.body?.params || {},
    });
    res.json(success(result, '变声音频已生成'));
  } catch (error) {
    console.error('[voice-lab] render effect error:', error);
    toClientError(res, error, '变声音频生成失败');
  }
}));

router.post('/effects/render-batch', asyncHandler(async (req, res) => {
  try {
    const sourceFileName = req.body?.sourceFileName;
    const presetIds = [...new Set(Array.isArray(req.body?.presetIds) ? req.body.presetIds.map(id => String(id)) : [])];
    if (!presetIds.length) return res.status(400).json(fail(CODE.VALIDATION, '请至少选择一个变声效果'));
    if (presetIds.length > 4) return res.status(400).json(fail(CODE.VALIDATION, '单次最多生成 4 个变声效果'));

    const results = [];
    for (const presetId of presetIds) {
      results.push(await renderVoiceEffect({ sourceFileName, presetId }));
    }
    res.json(success({ results }, `已生成 ${results.length} 个变声音频`));
  } catch (error) {
    console.error('[voice-lab] render effects batch error:', error);
    toClientError(res, error, '批量生成变声音频失败');
  }
}));

router.post('/synthesize', asyncHandler(async (req, res) => {
  try {
    const text = String(req.body?.text || '').trim();
    const voice = String(req.body?.voice || '').trim();
    const instruction = String(req.body?.instruction || req.body?.instructions || '').trim();

    if (!text) return res.status(400).json(fail(CODE.VALIDATION, '合成文本不能为空'));
    if (Array.from(text).length > 5000) {
      return res.status(400).json(fail(CODE.VALIDATION, '单次合成文本不能超过 5000 字符'));
    }
    if (!voice) return res.status(400).json(fail(CODE.VALIDATION, '请选择或填写 CosyVoice 音色 ID'));
    if (countTtsBillingCharacters(instruction) > 100) {
      return res.status(400).json(fail(CODE.VALIDATION, '指令文本不能超过 100 字符'));
    }

    const result = await synthesizeSpeech({
      text,
      voice,
      model: asSafeTtsModel(req.body?.model),
      languageHint: asSafeLanguage(req.body?.languageHint),
      instruction,
      rate: asSafeRate(req.body?.rate),
      format: 'wav',
      sampleRate: 24000,
      download: true,
    });

    if (result.audio) {
      const voiceMeta = getVoiceMetadata(result.voice);
      result.audio.downloadName = makeSynthesisDownloadName({
        voiceName: voiceMeta?.displayName || result.voice,
        text,
        extension: path.extname(result.audio.fileName).replace('.', '') || 'wav',
      });
      const audition = upsertVoiceAudition({
        voiceId: result.voice,
        audio: result.audio,
        auditionText: text,
        source: 'synthesis',
        userId: req.user?.id,
        overwrite: false,
      });
      result.auditionSaved = audition.saved;
      result.auditionAudio = audition.auditionAudio;
    }

    res.json(success(result));
  } catch (error) {
    console.error('[voice-lab] synthesize error:', error);
    toClientError(res, error, '合成失败');
  }
}));

router.get('/voices', asyncHandler(async (req, res) => {
  try {
    const result = await listCosyVoiceVoices({
      pageSize: req.query.pageSize,
      pageIndex: req.query.pageIndex,
      prefix: req.query.prefix,
    });
    const onlyMine = String(req.query.onlyMine || '').toLowerCase() === 'true';
    result.voices = mergeVoiceDisplayNames(result.voices, {
      onlyMine,
      userId: req.user?.id,
    });
    result.totalCount = result.voices.length;
    res.json(success(result));
  } catch (error) {
    console.error('[voice-lab] list voices error:', error);
    toClientError(res, error, '获取音色列表失败');
  }
}));

router.post('/voices/:voice/audition', asyncHandler(async (req, res) => {
  try {
    const voice = String(req.params.voice || '').trim();
    const text = String(req.body?.text || '大家好，这是这个音色的试听样本。').trim();
    const instruction = String(req.body?.instruction || '').trim();

    if (!voice) return res.status(400).json(fail(CODE.VALIDATION, '音色 ID 不能为空'));
    if (!text) return res.status(400).json(fail(CODE.VALIDATION, '试听文本不能为空'));
    if (Array.from(text).length > 200) {
      return res.status(400).json(fail(CODE.VALIDATION, '试听文本不能超过 200 字符'));
    }
    if (countTtsBillingCharacters(instruction) > 100) {
      return res.status(400).json(fail(CODE.VALIDATION, '指令文本不能超过 100 字符'));
    }

    const result = await synthesizeSpeech({
      text,
      voice,
      model: asSafeTtsModel(req.body?.model),
      languageHint: asSafeLanguage(req.body?.languageHint),
      instruction,
      rate: asSafeRate(req.body?.rate),
      format: 'wav',
      sampleRate: 24000,
      download: true,
    });

    const audition = upsertVoiceAudition({
      voiceId: voice,
      audio: result.audio,
      auditionText: text,
      source: 'audition',
      userId: req.user?.id,
      overwrite: true,
    });

    res.json(success({
      ...result,
      auditionAudio: audition.auditionAudio,
      auditionText: audition.auditionText,
    }));
  } catch (error) {
    console.error('[voice-lab] audition voice error:', error);
    toClientError(res, error, '生成试听失败');
  }
}));

router.post('/voices/clone', requirePermission(PERMISSION.clone), asyncHandler(async (req, res) => {
  try {
    const result = await createCosyVoiceClone({
      audioUrl: req.body?.audioUrl,
      prefix: req.body?.prefix,
      targetModel: DEFAULT_COSYVOICE_MODEL,
      languageHint: asSafeLanguage(req.body?.languageHint),
      maxPromptAudioLength: req.body?.maxPromptAudioLength,
      enablePreprocess: req.body?.enablePreprocess,
    });

    const displayName = normalizeVoiceDisplayName(req.body?.displayName);
    if (displayName && result.voice) {
      result.displayName = upsertVoiceDisplayName({
        voiceId: result.voice,
        displayName,
        source: 'clone',
        userId: req.user?.id,
      }).displayName;
    }
    if (result.previewAudio && result.voice) {
      const audition = upsertVoiceAudition({
        voiceId: result.voice,
        audio: result.previewAudio,
        auditionText: previewText,
        source: 'design',
        userId: req.user?.id,
        overwrite: false,
      });
      result.auditionAudio = audition.auditionAudio;
    }

    res.json(success(result));
  } catch (error) {
    console.error('[voice-lab] clone voice error:', error);
    toClientError(res, error, '创建复刻音色失败');
  }
}));

router.post('/voices/clone-upload', requirePermission(PERMISSION.clone), handleAudioUpload, asyncHandler(async (req, res) => {
  let ossUpload = null;
  try {
    if (!req.file) return res.status(400).json(fail(CODE.VALIDATION, '请上传音频文件'));

    ossUpload = await uploadVoicePromptToOss(req.file);
    const result = await createCosyVoiceClone({
      audioUrl: ossUpload.signedUrl,
      prefix: req.body?.prefix,
      targetModel: DEFAULT_COSYVOICE_MODEL,
      languageHint: asSafeLanguage(req.body?.languageHint),
      maxPromptAudioLength: req.body?.maxPromptAudioLength,
      enablePreprocess: req.body?.enablePreprocess,
    });

    const displayName = normalizeVoiceDisplayName(req.body?.displayName);
    if (displayName && result.voice) {
      result.displayName = upsertVoiceDisplayName({
        voiceId: result.voice,
        displayName,
        source: 'clone',
        userId: req.user?.id,
      }).displayName;
    }

    scheduleOssObjectCleanup(ossUpload.objectName, ossUpload.expires);

    res.json(success({
      ...result,
      transit: {
        bucket: config.oss.bucket,
        objectName: ossUpload.objectName,
        expiresAt: ossUpload.expiresAt,
        cleanupAfterClone: config.oss.cleanupAfterClone,
      },
    }));
  } catch (error) {
    if (ossUpload?.objectName) scheduleOssObjectCleanup(ossUpload.objectName, 300);
    console.error('[voice-lab] clone voice upload error:', error);
    toClientError(res, error, '上传并创建复刻音色失败');
  } finally {
    if (req.file?.path) {
      fsp.unlink(req.file.path).catch(() => {});
    }
  }
}));

router.post('/voices/design', requirePermission(PERMISSION.design), asyncHandler(async (req, res) => {
  try {
    const voicePrompt = String(req.body?.voicePrompt || '').trim();
    const previewText = String(req.body?.previewText || '').trim();
    if (Array.from(voicePrompt).length > 500) {
      return res.status(400).json(fail(CODE.VALIDATION, '声音描述不能超过 500 字符'));
    }
    if (Array.from(previewText).length > 200) {
      return res.status(400).json(fail(CODE.VALIDATION, '预览文本不能超过 200 字符'));
    }

    const result = await createCosyVoiceDesign({
      voicePrompt,
      previewText,
      prefix: req.body?.prefix,
      targetModel: DEFAULT_COSYVOICE_MODEL,
      languageHint: asSafeDesignLanguage(req.body?.languageHint),
      responseFormat: 'wav',
      sampleRate: 24000,
    });

    const displayName = normalizeVoiceDisplayName(req.body?.displayName);
    if (displayName && result.voice) {
      result.displayName = upsertVoiceDisplayName({
        voiceId: result.voice,
        displayName,
        source: 'design',
        userId: req.user?.id,
      }).displayName;
    }

    res.json(success(result));
  } catch (error) {
    console.error('[voice-lab] design voice error:', error);
    toClientError(res, error, '创建设计音色失败');
  }
}));

router.delete('/voices/:voice', requirePermission(PERMISSION.manageVoices), asyncHandler(async (req, res) => {
  try {
    const result = await deleteCosyVoiceVoice(req.params.voice);
    markVoiceDeleted(req.params.voice, req.user?.id);
    res.json(success(result, '音色已删除'));
  } catch (error) {
    console.error('[voice-lab] delete voice error:', error);
    toClientError(res, error, '删除音色失败');
  }
}));

router.patch('/voices/:voice/name', requirePermission(PERMISSION.manageVoices), asyncHandler(async (req, res) => {
  try {
    const result = upsertVoiceDisplayName({
      voiceId: req.params.voice,
      displayName: req.body?.displayName,
      source: req.body?.source,
      userId: req.user?.id,
    });
    res.json(success(result, '音色名称已保存'));
  } catch (error) {
    console.error('[voice-lab] rename voice error:', error);
    toClientError(res, error, '保存音色名称失败');
  }
}));

router.get('/output/:file', (req, res) => {
  const fileName = req.params.file;
  if (fileName !== path.basename(fileName) || !/^voice-lab(?:-preview|-effect)?-[\w.-]+\.(wav|mp3|m4a|pcm)$/i.test(fileName)) {
    return res.status(400).json(fail(CODE.VALIDATION, '无效的文件名'));
  }

  const filePath = path.join(getVoiceLabOutputDir(), fileName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json(fail(CODE.FAIL, '音频文件不存在或已清理'));
  }

  const ext = path.extname(fileName).toLowerCase();
  const contentType = ext === '.mp3' ? 'audio/mpeg' : ext === '.m4a' ? 'audio/mp4' : 'audio/x-wav';
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
  res.sendFile(filePath);
});

export default router;
