import crypto from 'crypto';
import path from 'path';
import OSS from 'ali-oss';
import config from '../config/env.js';

const AUDIO_EXTENSIONS = new Set(['wav', 'mp3', 'm4a', 'aac', 'flac', 'ogg', 'opus', 'amr', 'webm']);

export function ensureOssConfigured() {
  if (!config.aliyun.accessKeyId || !config.aliyun.accessKeySecret) {
    throw new Error('未配置阿里云 AccessKey，无法使用 OSS 中转音频。');
  }
  if (!config.oss.region || !config.oss.bucket) {
    throw new Error('未配置 OSS_REGION 或 OSS_BUCKET，无法使用 OSS 中转音频。');
  }
}

export function isOssConfigured() {
  return Boolean(config.aliyun.accessKeyId && config.aliyun.accessKeySecret && config.oss.region && config.oss.bucket);
}

export function getOssPublicConfig() {
  return {
    configured: isOssConfigured(),
    region: config.oss.region,
    bucket: config.oss.bucket,
    prefix: config.oss.prefix,
    signedUrlExpiresSeconds: config.oss.signedUrlExpiresSeconds,
    cleanupAfterClone: config.oss.cleanupAfterClone,
  };
}

function createOssClient() {
  ensureOssConfigured();
  return new OSS({
    region: config.oss.region,
    accessKeyId: config.aliyun.accessKeyId,
    accessKeySecret: config.aliyun.accessKeySecret,
    bucket: config.oss.bucket,
    secure: true,
  });
}

function normalizePrefix(value) {
  const prefix = String(value || '').replace(/^\/+/, '').replace(/\/+$/, '');
  return prefix ? `${prefix}/` : '';
}

function getExtension(fileName = '', mimeType = '') {
  const byName = path.extname(fileName).replace('.', '').toLowerCase();
  if (AUDIO_EXTENSIONS.has(byName)) return byName;

  const normalizedMime = String(mimeType || '').toLowerCase();
  if (normalizedMime.includes('mpeg')) return 'mp3';
  if (normalizedMime.includes('mp4') || normalizedMime.includes('m4a')) return 'm4a';
  if (normalizedMime.includes('wav') || normalizedMime.includes('wave')) return 'wav';
  if (normalizedMime.includes('flac')) return 'flac';
  if (normalizedMime.includes('ogg')) return 'ogg';
  if (normalizedMime.includes('webm')) return 'webm';
  if (normalizedMime.includes('amr')) return 'amr';

  return '';
}

export function assertSupportedAudioFile(file) {
  const extension = getExtension(file?.originalname, file?.mimetype);
  if (!extension) {
    throw new Error('仅支持 wav、mp3、m4a、aac、flac、ogg、opus、amr、webm 音频文件');
  }
  return extension;
}

function createObjectName(file, extension) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = normalizePrefix(config.oss.prefix);
  const randomId = crypto.randomUUID();
  return `${prefix}${date}/${Date.now()}-${randomId}.${extension}`;
}

export async function uploadVoicePromptToOss(file) {
  const extension = assertSupportedAudioFile(file);
  const client = createOssClient();
  const objectName = createObjectName(file, extension);

  await client.put(objectName, file.path, {
    headers: {
      'Content-Type': file.mimetype || 'application/octet-stream',
    },
  });

  const expires = Math.max(60, Number(config.oss.signedUrlExpiresSeconds) || 1800);
  const signedUrl = client.signatureUrl(objectName, {
    expires,
    method: 'GET',
  });

  return {
    objectName,
    signedUrl,
    expires,
    expiresAt: new Date(Date.now() + expires * 1000).toISOString(),
  };
}

export async function deleteOssObject(objectName) {
  const name = String(objectName || '').trim();
  if (!name) return false;

  const client = createOssClient();
  await client.delete(name);
  return true;
}

export function scheduleOssObjectCleanup(objectName, delaySeconds = config.oss.signedUrlExpiresSeconds) {
  if (!config.oss.cleanupAfterClone || !objectName) return;

  const delayMs = Math.max(60, Number(delaySeconds) || 1800) * 1000;
  const timer = setTimeout(() => {
    deleteOssObject(objectName).catch(error => {
      console.warn('[voice-lab] OSS cleanup failed:', error?.message || error);
    });
  }, delayMs);

  if (typeof timer.unref === 'function') timer.unref();
}

export async function probeOssBucket() {
  const client = createOssClient();
  const result = await client.list({
    prefix: normalizePrefix(config.oss.prefix),
    'max-keys': 1,
  });

  return {
    bucket: config.oss.bucket,
    region: config.oss.region,
    prefix: config.oss.prefix,
    objects: Array.isArray(result.objects) ? result.objects.length : 0,
  };
}
