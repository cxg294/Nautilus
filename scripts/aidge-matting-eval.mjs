// Isolated paid-API experiment. Production routes and configuration are not changed.
// Usage: node scripts/aidge-matting-eval.mjs prepare|old|aidge /absolute/output/path
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import OSS from 'ali-oss';
import { SegmentCommonImageAdvanceRequest } from '@alicloud/imageseg20191230';
import { RuntimeOptions } from '@alicloud/tea-util';
import config from '../server/config/env.js';
import { createClient } from '../server/services/aliyun-imageseg.js';

const [mode, outputArg] = process.argv.slice(2);
if (!['prepare', 'old', 'aidge'].includes(mode) || !outputArg || !path.isAbsolute(outputArg)) {
  throw new Error('Usage: node scripts/aidge-matting-eval.mjs prepare|old|aidge /absolute/output/path');
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(outputArg);
const manifestPath = path.join(output, 'samples.json');
await fsp.mkdir(path.join(output, 'inputs'), { recursive: true });
const exists = file => fsp.access(file).then(() => true, () => false);
const save = (file, data) => fsp.writeFile(file, JSON.stringify(data, null, 2) + '\n');
const clean = value => {
  let text = String(value || '').replace(/https?:\/\/\S+/g, '[URL omitted]').replace(/uid=\d+/g, 'uid=[omitted]');
  for (const secret of [config.aliyun.accessKeyId, config.aliyun.accessKeySecret]) {
    if (secret) text = text.split(secret).join('[redacted]');
  }
  return text.slice(0, 500);
};

if (mode === 'prepare') {
  const samples = [];
  for (const [id, label] of [
    ['felt-toy', 'Felt / fuzzy edges'], ['minimal-line', 'Thin line drawing'],
    ['studio-lighting', 'Dark object / dark background'], ['ghibli', 'Illustration / complex background'],
    ['ice-sculpture', 'Ice / translucent material'], ['comic-book', 'Comic / multiple elements']
  ]) {
    const source = `public/images/styles/${id}.png`;
    const input = `inputs/${id}.png`;
    await fsp.copyFile(path.join(root, source), path.join(output, input));
    const metadata = await sharp(path.join(output, input)).metadata();
    samples.push({ id, label, kind: 'project-image', source, input, width: metadata.width, height: metadata.height });
  }
  // Known-alpha controls: these are synthesized composites, not original photos or videos.
  for (const [id, name, background] of [['taozi-control', '桃子', '#c7dbe8'], ['curator-control', '馆长', '#b9bec6']]) {
    const source = `public/characters/${name}/默认.png`;
    const input = `inputs/${id}.png`;
    const reference = `inputs/${id}-reference.png`;
    await fsp.copyFile(path.join(root, source), path.join(output, reference));
    await sharp(path.join(root, source)).flatten({ background }).png().toFile(path.join(output, input));
    const metadata = await sharp(path.join(output, input)).metadata();
    samples.push({ id, label: `${name} / synthetic known-alpha control`, kind: 'synthetic-composite', source, background, input, reference, width: metadata.width, height: metadata.height });
  }
  await save(manifestPath, samples);
  console.log(JSON.stringify({ prepared: samples.length, output }));
  process.exit(0);
}

const samples = JSON.parse(await fsp.readFile(manifestPath, 'utf8'));
const recordsPath = path.join(output, `${mode}-results.json`);
const records = await exists(recordsPath) ? JSON.parse(await fsp.readFile(recordsPath, 'utf8')) : [];
await fsp.mkdir(path.join(output, mode), { recursive: true });
const runtime = new RuntimeOptions({ readTimeout: 60000, connectTimeout: 15000, autoretry: false, maxAttempts: 1 });
let client, oss, core;
if (mode === 'old') client = createClient();
else {
  const require = createRequire(import.meta.url);
  core = createRequire(require.resolve('@alicloud/imageseg20191230'))('@alicloud/openapi-core');
  client = new core.default(new core.$OpenApiUtil.Config({
    accessKeyId: config.aliyun.accessKeyId, accessKeySecret: config.aliyun.accessKeySecret,
    endpoint: 'aidge.cn-beijing.aliyuncs.com', regionId: 'cn-beijing'
  }));
  oss = new OSS({ region: config.oss.region, bucket: config.oss.bucket, secure: true,
    accessKeyId: config.aliyun.accessKeyId, accessKeySecret: config.aliyun.accessKeySecret });
}

for (const sample of samples) {
  if (records.some(r => r.sample === sample.id && r.success && fs.existsSync(path.join(output, r.output)))) continue;
  const record = { sample: sample.id, provider: mode, startedAt: new Date().toISOString() };
  const start = Date.now();
  let objectName;
  try {
    let resultUrl;
    if (mode === 'old') {
      const request = new SegmentCommonImageAdvanceRequest({ imageURLObject: fs.createReadStream(path.join(output, sample.input)) });
      const response = await client.segmentCommonImageAdvance(request, runtime);
      record.apiIncludingUploadMs = Date.now() - start;
      record.requestId = response.body?.requestId;
      resultUrl = response.body?.data?.imageURL;
    } else {
      objectName = `nautilus/aidge-evaluation/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.png`;
      await oss.put(objectName, path.join(output, sample.input), { headers: { 'Content-Type': 'image/png' } });
      record.uploadMs = Date.now() - start;
      const apiStart = Date.now();
      const request = new core.$OpenApiUtil.OpenApiRequest({ query: core.OpenApiUtil.query({
        ImageUrl: oss.signatureUrl(objectName, { expires: 900, method: 'GET' }), BackGroundType: 'TRANSPARENT'
      }) });
      const params = new core.$OpenApiUtil.Params({ action: 'ImageMatting', version: '2026-04-28',
        protocol: 'HTTPS', pathname: '/', method: 'POST', authType: 'AK', style: 'RPC', reqBodyType: 'formData', bodyType: 'json' });
      const response = await client.callApi(params, request, runtime);
      record.apiMs = Date.now() - apiStart;
      record.httpStatus = response.statusCode;
      record.requestId = response.body?.RequestId;
      record.code = response.body?.Code;
      if (!response.body?.Success) throw Object.assign(new Error(response.body?.Message || 'Aidge business failure'), { code: record.code });
      resultUrl = response.body?.Data?.ImageUrl;
      record.score = response.body?.Data?.Score;
      record.reportedWidth = response.body?.Data?.Width;
      record.reportedHeight = response.body?.Data?.Height;
    }
    if (!resultUrl) throw new Error('No result image URL returned');
    const downloadStart = Date.now();
    const url = new URL(resultUrl);
    if (url.protocol === 'http:') url.protocol = 'https:';
    if (url.protocol !== 'https:') throw new Error('Unexpected result URL protocol');
    const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`Result download HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    record.downloadMs = Date.now() - downloadStart;
    const metadata = await sharp(bytes).metadata();
    record.width = metadata.width; record.height = metadata.height; record.hasAlpha = metadata.hasAlpha;
    record.sameCanvas = metadata.width === sample.width && metadata.height === sample.height;
    record.output = `${mode}/${sample.id}.png`;
    await sharp(bytes).png().toFile(path.join(output, record.output));
    const alpha = await sharp(bytes).ensureAlpha().extractChannel('alpha').raw().toBuffer();
    record.transparentFraction = alpha.filter(a => a === 0).length / alpha.length;
    record.semiTransparentFraction = alpha.filter(a => a > 0 && a < 255).length / alpha.length;
    if (sample.reference && record.sameCanvas) {
      const reference = await sharp(path.join(output, sample.reference)).ensureAlpha().extractChannel('alpha').raw().toBuffer();
      let absoluteError = 0, intersection = 0, union = 0;
      for (let i = 0; i < alpha.length; i++) {
        absoluteError += Math.abs(alpha[i] - reference[i]);
        if (alpha[i] >= 128 && reference[i] >= 128) intersection++;
        if (alpha[i] >= 128 || reference[i] >= 128) union++;
      }
      record.controlAlphaMAE = absoluteError / alpha.length / 255;
      record.controlForegroundIoU = union ? intersection / union : 1;
    }
    record.success = true;
  } catch (error) {
    record.success = false; record.code ||= clean(error.code || error.name);
    record.message = clean(error.message); record.requestId ||= error.data?.RequestId;
  } finally {
    if (objectName) {
      try { await oss.delete(objectName); record.tempOssDeleted = true; }
      catch (error) { record.tempOssDeleted = false; record.cleanupObject = objectName; record.cleanupError = clean(error.message); }
    }
    record.totalMs = Date.now() - start;
    records.push(record);
    await save(recordsPath, records);
    console.log(JSON.stringify(record));
  }
  if (['ServiceNotOpened', 'InvalidAccessKeyId.NotFound', 'Forbidden.RAM', 'Forbidden', 'SignatureDoesNotMatch'].includes(record.code) || record.tempOssDeleted === false) break;
}
