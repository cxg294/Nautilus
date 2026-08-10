import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { getVoiceLabOutputDir } from './aliyun-tts.js';
import { makeEffectDownloadName } from './audio-download-names.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKER_DIR = path.resolve(__dirname, '..', 'audio-effects-worker');
const WORKER_SCRIPT = path.join(WORKER_DIR, 'render.py');
const WORKER_PYTHON = process.env.NAUTILUS_AUDIO_EFFECTS_PYTHON || path.join(WORKER_DIR, '.venv', 'bin', 'python');
const SAFE_FILE_NAME = /^voice-lab(?:-preview|-effect)?-[\w.-]+\.(wav|mp3|m4a|pcm)$/i;

export const DEFAULT_EFFECT_PARAMS = { pitchSemitones: 0, effectStrength: 0.55, clarity: 0.7, space: 0.1 };
export const VOICE_EFFECT_PRESETS = {
  original: { label: '原声清晰', description: '轻微母带处理，保持原声', params: { effectStrength: 0, clarity: 0.9, space: 0 } },
  robot: { label: '清晰机器人', description: '干声托底的电子机械感', params: { pitchSemitones: -1, effectStrength: 0.52, clarity: 0.78, space: 0.08 } },
  'heavy-mech': { label: '重装机甲', description: '低沉、厚重的金属角色感', params: { pitchSemitones: -5, effectStrength: 0.62, clarity: 0.7, space: 0.18 } },
  'playful-high': { label: '童趣高音', description: '明亮、活泼的高音角色感', params: { pitchSemitones: 5, effectStrength: 0.32, clarity: 0.86, space: 0.08 } },
  telephone: { label: '电话', description: '窄频对讲机质感', params: { effectStrength: 0.72, clarity: 0.65, space: 0 } },
};

const clamp = (value, min, max, fallback) => Number.isFinite(Number(value)) ? Math.min(Math.max(Number(value), min), max) : fallback;
function normalizeParams(input = {}) {
  return {
    pitchSemitones: clamp(input.pitchSemitones, -12, 12, 0),
    effectStrength: clamp(input.effectStrength, 0, 1, 0.55),
    clarity: clamp(input.clarity, 0, 1, 0.7),
    space: clamp(input.space, 0, 1, 0.1),
  };
}

function getSourceAudioPath(fileName) {
  const safeName = String(fileName || '');
  if (!SAFE_FILE_NAME.test(safeName) || safeName !== path.basename(safeName)) throw new Error('无效的源音频文件');
  const filePath = path.join(getVoiceLabOutputDir(), safeName);
  if (!fs.existsSync(filePath)) throw new Error('源音频不存在或已清理');
  return filePath;
}

function resolveFfmpegCommand() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  return [path.join(os.homedir(), '.local', 'bin', 'ffmpeg'), '/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg'].find(fs.existsSync) || 'ffmpeg';
}

function prepareWorkerInput(sourcePath) {
  const inputPath = path.join(getVoiceLabOutputDir(), `voice-lab-effect-input-${Date.now()}-${crypto.randomUUID()}.wav`);
  return new Promise((resolve, reject) => {
    const child = spawn(resolveFfmpegCommand(), ['-y', '-i', sourcePath, '-vn', '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', inputPath], { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.on('error', error => reject(new Error(`无法预处理效果器音频：${error.message}`)));
    child.on('close', code => code === 0 ? resolve(inputPath) : reject(new Error(`效果器音频预处理失败：${stderr.slice(-500)}`)));
  });
}

function runWorker(payload) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(WORKER_PYTHON)) return reject(new Error('效果器运行环境未安装，请执行 audio-effects-worker 的依赖安装。'));
    const child = spawn(WORKER_PYTHON, [WORKER_SCRIPT], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk.toString(); });
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.on('error', error => reject(new Error(`无法启动效果器 worker：${error.message}`)));
    child.on('close', code => {
      try {
        const result = JSON.parse(stdout.trim());
        if (code === 0 && result.ok) return resolve(result);
        reject(new Error(result.error || stderr || '效果器渲染失败'));
      } catch {
        reject(new Error(`效果器渲染失败${stderr ? `：${stderr.slice(-500)}` : ''}`));
      }
    });
    child.stdin.end(JSON.stringify(payload));
  });
}

export function listVoiceEffectPresets() {
  return Object.entries(VOICE_EFFECT_PRESETS).map(([id, preset]) => ({ id, label: preset.label, description: preset.description, params: normalizeParams({ ...DEFAULT_EFFECT_PARAMS, ...preset.params }) }));
}

export async function renderVoiceEffect({ sourceFileName, sourceDownloadName = '', presetId = 'original', params = {} }) {
  const preset = VOICE_EFFECT_PRESETS[presetId];
  if (!preset) throw new Error('不支持的效果预设');
  const sourcePath = getSourceAudioPath(sourceFileName);
  const resolvedParams = normalizeParams({ ...DEFAULT_EFFECT_PARAMS, ...preset.params, ...params });
  const fileName = `voice-lab-effect-${Date.now()}-${crypto.randomUUID()}.wav`;
  const filePath = path.join(getVoiceLabOutputDir(), fileName);
  let workerInputPath = '';
  try {
    workerInputPath = await prepareWorkerInput(sourcePath);
    await runWorker({ sourcePath: workerInputPath, outputPath: filePath, presetId, params: resolvedParams });
    const bytes = fs.statSync(filePath).size;
    if (!bytes) throw new Error('效果器输出为空');
    return { presetId, preset: { label: preset.label, description: preset.description }, params: resolvedParams, audio: { fileName, downloadName: makeEffectDownloadName({ presetName: preset.label, sourceName: sourceDownloadName || sourceFileName }), url: `/api/voice-lab/output/${fileName}`, contentType: 'audio/wav', bytes } };
  } catch (error) {
    fs.rmSync(filePath, { force: true });
    throw error;
  } finally {
    if (workerInputPath) fs.rmSync(workerInputPath, { force: true });
  }
}
