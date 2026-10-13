import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import jwt from 'jsonwebtoken';

const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'voice-model-integration-'));
process.env.NAUTILUS_DB_PATH = path.join(directory, 'test.db');
process.env.JWT_SECRET = 'isolated-voice-model-integration-secret';
process.env.DASHSCOPE_API_KEY = 'unit-test-no-network';
const { default: db, runMigrations } = await import('../db/index.js');
runMigrations();
const { syncToolPermissions } = await import('../services/permission-sync.js');
syncToolPermissions();
const { default: router } = await import('./voice-lab.js');
const { resolveVoiceModel, getVoiceBinding, preserveVoiceSource, canReadVoiceSource, attachVoiceBindings, VOICE_SOURCE_DIR } = await import('../services/voice-bindings.js');
const app = express(); app.use(express.json()); app.use('/voice', router);
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const owner = db.prepare("INSERT INTO users (username,password_hash,role,status) VALUES ('model-fixture','unused','owner','active')").run().lastInsertRowid;
const token = jwt.sign({ id: owner, version: 0 }, process.env.JWT_SECRET);
const nativeFetch = globalThis.fetch;
const requests = [], generatedFiles = [];
let lastModel = 'qwen-audio-3.0-tts-flash';
const fixtureBytes = Buffer.from('original-recording-bytes');
globalThis.fetch = async (url, options = {}) => {
  if (String(url).startsWith(base)) return nativeFetch(url, options);
  if (String(url).startsWith('https://fixture.test/')) return new Response(fixtureBytes, { headers: { 'Content-Type': 'audio/wav' } });
  const request = JSON.parse(options.body); requests.push(request);
  if (request.input.action === 'create_voice') {
    lastModel = request.input.target_model;
    return Response.json({ output: { voice_id: `${lastModel}-fixture-${request.input.voice_prompt ? "design" : "clone"}` } });
  }
  if (request.input.action === 'query_voice') return Response.json({ output: {
    target_model: request.input.voice_id.startsWith('cosyvoice-') ? 'cosyvoice-v3.5-flash' : 'qwen-audio-3.0-tts-flash',
    status: 'OK', resource_link: 'https://fixture.test/original.wav'
  } });
  if (request.input.action === 'delete_voice') return Response.json({ output: {} });
  if (request.input.action === 'list_voice') return Response.json({ output: { voice_list: [
    { voice_id: 'qwen-audio-3.0-tts-flash-fixture-clone', status: 'OK' },
    { voice_id: 'cosyvoice-v3.5-flash-old', status: 'OK' }
  ] } });
  if (options.headers['X-DashScope-SSE']) {
    return new Response([
      { output: { type: 'sentence-end', original_text: '你好', sentence: { index: 0, words: [
        { text: '你', begin_index: 0, end_index: 1, begin_time: 320, end_time: 640 },
        { text: '好', begin_index: 1, end_index: 2, begin_time: 640, end_time: 960 }
      ] } } },
      { output: { audio: { url: 'https://fixture.test/output.wav' } }, usage: { characters: 4 } }
    ].map(event => `data: ${JSON.stringify(event)}\n\n`).join(''));
  }
  return Response.json({ output: { audio: { url: 'https://fixture.test/output.wav' } }, usage: { characters: 4 } });
};
async function call(route, body, method = body ? 'POST' : 'GET') {
  const response = await fetch(base + '/voice' + route, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const json = await response.json();
  if (json.data?.previewAudio?.fileName) generatedFiles.push(path.resolve('server/voice-lab-output', json.data.previewAudio.fileName));
  if (json.data?.audio?.fileName) generatedFiles.push(path.resolve('server/voice-lab-output', json.data.audio.fileName));
  return { status: response.status, ...json };
}
after(async () => {
  globalThis.fetch = nativeFetch;
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  for (const row of db.prepare("SELECT source_file FROM voice_lab_voice_bindings WHERE source_file != ''").all()) {
    await fs.unlink(path.join(VOICE_SOURCE_DIR, row.source_file)).catch(() => {});
  }
  for (const file of generatedFiles) await fs.unlink(file).catch(() => {});
  db.close(); await fs.rm(directory, { recursive: true, force: true });
});

test('clone selects Audio, persists binding and original; reload does not depend on list target_model', async () => {
  const result = await call('/voices/clone', { audioUrl: 'https://fixture.test/original.wav', prefix: 'fixture', targetModel: lastModel, enablePreprocess: 'false' });
  assert.equal(result.code, '0000', result.msg);
  assert.equal(result.data.sourceSaved, true);
  const request = requests.find(r => r.input.action === 'create_voice');
  assert.equal(request.input.target_model, 'qwen-audio-3.0-tts-flash');
  assert.equal(request.input.enable_preprocess, false);
  assert.equal(request.input.enable_volume_normalization, 'false');
  const binding = getVoiceBinding(result.data.voice);
  assert.deepEqual(await fs.readFile(path.join(VOICE_SOURCE_DIR, binding.source_file)), fixtureBytes);
  assert(!binding.clone_params.includes('fixture.test'));
  const list = await call('/voices');
  assert.equal(list.data.voices[0].targetModel, lastModel);
  assert.equal(list.data.voices[1].targetModel, 'cosyvoice-v3.5-flash');
  assert(list.data.voices[0].sourceAudio.url);
  assert.equal(canReadVoiceSource(binding, { id: owner + 1, permissions: [] }), false);
});

test('synthesis and audition follow the voice, preserve timestamps and charge the correct model price', async () => {
  const voice = 'qwen-audio-3.0-tts-flash-fixture-clone';
  const result = await call('/synthesize', { voice, text: '你好', enableWordTimestamps: true });
  assert.equal(result.code, '0000', result.msg);
  assert.equal(result.data.model, 'qwen-audio-3.0-tts-flash');
  assert.equal(result.data.estimate.pricePer10k, 1);
  assert.equal(result.data.estimate.estimatedCny, 0.0004);
  assert.equal(result.data.alignment.available, true);
  assert.deepEqual(result.data.alignment.sentences[0].words[0], { text: '你', beginIndex: 0, endIndex: 1, beginTimeMs: 320, endTimeMs: 640 });
  assert(!Object.hasOwn(requests.at(-1).input, 'instruction'));
  const audition = await call(`/voices/${voice}/audition`, { text: '你好' });
  assert.equal(audition.data.model, result.data.model);
  const old = await call('/synthesize', { voice: 'cosyvoice-v3.5-flash-old', text: '你好', model: 'cosyvoice-v3.5-flash' });
  assert.equal(old.data.model, 'cosyvoice-v3.5-flash');
  assert.equal(old.data.estimate.pricePer10k, 0.8);
});

test('unsupported and mismatched models fail before paid synthesis; old manual voices are queried once', async () => {
  for (const model of ['qwen-audio-typo', 'cosyvoice-v3.5-flash']) {
    const before = requests.length;
    const result = await call('/synthesize', { voice: 'qwen-audio-3.0-tts-flash-fixture-clone', text: '你好', model });
    assert.equal(result.status, 400);
    assert.equal(requests.length, before);
  }
  let queries = 0;
  const options = { query: async () => { queries++; return { targetModel: 'qwen-audio-3.0-tts-flash', status: 'OK' }; } };
  assert.equal(await resolveVoiceModel('historical-unlabelled', undefined, options), 'qwen-audio-3.0-tts-flash');
  await resolveVoiceModel('historical-unlabelled', undefined, options);
  assert.equal(queries, 1);
  const estimate = await call('/estimate', { text: '你好', model: 'qwen-audio-3.0-tts-plus' });
  assert.equal(estimate.data.pricePer10k, 1.4);
});

test('upload source storage preserves exact bytes without invoking audio preprocessing', async () => {
  const file = path.join(directory, 'upload.wav'); await fs.writeFile(file, fixtureBytes);
  await preserveVoiceSource({ voice: 'upload-fixture', model: 'qwen-audio-3.0-tts-flash', file: { path: file, mimetype: 'audio/wav' }, params: { enablePreprocess: false }, userId: owner });
  const stored = getVoiceBinding('upload-fixture');
  assert.deepEqual(await fs.readFile(path.join(VOICE_SOURCE_DIR, stored.source_file)), fixtureBytes);
});


test('invalid clone model is rejected for both URL and multipart upload before cloud creation', async () => {
  const count = requests.length;
  const url = await call('/voices/clone', { targetModel: 'not-a-model', audioUrl: 'https://fixture.test/original.wav' });
  assert.equal(url.status, 400);
  const form = new FormData(); form.append('audio', new Blob([fixtureBytes], { type: 'audio/wav' }), 'fixture.wav'); form.append('targetModel', 'not-a-model');
  const response = await fetch(base + '/voice/voices/clone-upload', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  assert.equal(response.status, 400);
  assert.equal(requests.length, count);
});


test('catalog exposes 1208 immutable voices; built-in synthesis skips enrollment lookup', async () => {
  const catalog = await call('/catalog');
  assert.equal(catalog.data.voices.length, 1208);
  const entry = catalog.data.voices.find(v => v.voice === 'longanhuan_v3.6');
  assert.equal(entry.displayName, '龙安欢');
  assert.equal(entry.readOnly, true);
  const count = requests.length;
  const result = await call('/synthesize', {voice: entry.voice, text:'你好'});
  assert.equal(result.code, '0000', result.msg);
  assert.equal(result.data.model, entry.targetModel);
  assert(!requests.slice(count).some(r => r.input.action === 'query_voice'));
  for (const [route,body,method] of [ ['/voices/'+entry.voice,undefined,'DELETE'], ['/voices/'+entry.voice+'/name',{displayName:'改名'},'PATCH'] ]) {
    const invalid=await call(route,body,method); assert.equal(invalid.status,400);
  }
  const mismatch=await call('/synthesize',{voice:entry.voice,text:'你好',model:'qwen-audio-3.0-tts-plus'});
  assert.equal(mismatch.status,400);
});
test('SSML output is escaped; invalid controls and unsupported voices are rejected before synthesis', async () => {
  const voice='qwen-audio-3.0-tts-flash-fixture-clone';
  const controls=[{kind:'reading',text:'W3C',alias:'网络协议标准'},{kind:'pause',after:'W3C',timeMs:500}];
  const r=await call('/synthesize',{voice,text:'W3C你好',speechControls:controls});
  assert.equal(r.code,'0000',r.msg);
  const request=requests.at(-1);
  assert.equal(request.input.enable_ssml,true);
  assert.equal(request.input.text,'<speak><sub alias="网络协议标准">W3C</sub><break time="500ms"/>你好</speak>');
  const count=requests.length;
  for(const body of [{voice,text:'你好',speechControls:controls},{voice:'longanhuan_v3.6',text:'W3C你好',speechControls:controls}]) {
    const invalid=await call('/synthesize',body);assert.equal(invalid.status,400);
  }
  assert.equal(requests.length,count);
});
test('Audio design persists model and design kind, and unsupported models fail before cloud creation', async () => {
  const result=await call('/voices/design',{targetModel:'qwen-audio-3.0-tts-plus',voicePrompt:'温柔清晰的女老师',previewText:'你好同学',prefix:'fixture',displayName:'设计测试'});
  assert.equal(result.code,'0000',result.msg);
  assert.equal(result.data.targetModel,'qwen-audio-3.0-tts-plus');
  const binding=getVoiceBinding(result.data.voice);
  assert.equal(JSON.parse(binding.clone_params).kind,'design');
  const reloaded=attachVoiceBindings([{voice:result.data.voice,source:'clone'}],{id:owner})[0];
  assert.equal(reloaded.source,'design');
  assert.equal(reloaded.ssmlSupported,false);
  assert.equal(reloaded.wordTimestampsSupported,false);
  assert.equal(requests.at(-1).input.target_model,'qwen-audio-3.0-tts-plus');
  const invalid=await call('/voices/design',{targetModel:'invalid',voicePrompt:'老师',previewText:'你好'});
  assert.equal(invalid.status,400);
  const ssml=await call('/synthesize',{voice:result.data.voice,text:'你好',speechControls:[{kind:'pause',after:'你',timeMs:500}]});
  assert.equal(ssml.status,400);
});
