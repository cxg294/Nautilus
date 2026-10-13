import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, beforeEach, test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

// 运行实际 composable 和 Vue 响应式，只隔离网络、媒体播放和组件生命周期。
// 这些测试不会访问账号、项目数据库或真实合成服务。
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const require = createRequire(import.meta.url);
const adapters = {
  'workshop-test-controls': `
    export const controls = { saved: [], calls: [], messages: [] };
    export function reset() {
      controls.saved.length = controls.calls.length = controls.messages.length = 0;
      controls.save = async () => ({ data: { id: 'test-project' } });
      controls.synthesize = async () => ({ data: { audio: { url: '/api/voice-lab/output/voice-lab-new.wav' } } });
      controls.load = async () => new Blob(['test']);
      controls.measure = async () => 1500;
    }
  `,
  vue: `
    export { ref, computed } from ${JSON.stringify(require.resolve('vue'))};
    export const watch = () => {};
    export const onMounted = () => {};
    export const onActivated = () => {};
    export const onDeactivated = () => {};
    export const onBeforeUnmount = () => {};
  `,
  'naive-ui': `
    import { controls } from 'workshop-test-controls';
    export const useMessage = () => Object.fromEntries(['success', 'warning', 'error'].map(type =>
      [type, text => controls.messages.push({type, text})]));
    export const useDialog = () => ({ warning() {} });
  `,
  '@/store/modules/auth': `export const useAuthStore = () => ({ userInfo: { userId: 'test' } });`,
  '@/store/modules/auth/shared': `export const getToken = () => '';`,
  '@/service/api/character-library': `export const fetchCharacterLibrary = async () => ({ data: [] });`,
  '@/service/api/voice-lab': `
    import { controls } from 'workshop-test-controls';
    export const fetchVoiceLabStatus = async () => ({ data: { configured: true, defaults: { synthesisModel: 'test-model' } } });
    export const fetchVoiceClones = async () => ({ data: { voices: [], totalCount: 0 } });
    export const fetchVoiceCatalog = async () => ({ data: { voices: [], totalCount: 0 } });
    export const synthesizeVoice = async (data, options) => {
      controls.calls.push(structuredClone(data));
      return controls.synthesize(data, options);
    };
    export const createVoiceCloneFromUpload = async () => { throw Error('测试不应创建声音'); };
  `,
  '@/service/api/sequence-player': `
    import { controls } from 'workshop-test-controls';
    export const createProject = async data => {
      controls.saved.push(structuredClone(data));
      return controls.save(data);
    };
    export const updateProject = async (id, data) => createProject(data);
    export const fetchProjects = async () => ({ data: [] });
    export const fetchProject = async () => ({});
    export const uploadSequenceImage = async () => ({});
  `,
  './audio': `
    import { ref } from 'vue';
    import { controls } from 'workshop-test-controls';
    export const useWorkshopPlayback = () => ({
      currentIndex: ref(0), status: ref('idle'), elapsedMs: ref(0),
      stop() {}, select() {}, play() {}, toggle() {}
    });
    export const loadAudioBlob = (...args) => controls.load(...args);
    export const measureAudio = (...args) => controls.measure(...args);
  `
};
const directory = await mkdtemp(join(tmpdir(), 'workshop-regression-'));
after(() => rm(directory, { recursive: true, force: true }));
const bundle = await build({
  stdin: {
    contents: `
      export { useWorkshop } from './src/views/sequence-player/workshop/use-workshop.ts';
      export { audioKey, isReady, fromProject, toProject } from './src/views/sequence-player/workshop/model.ts';
      export { controls, reset } from 'workshop-test-controls';
    `,
    resolveDir: root,
    loader: 'ts'
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  define: { 'process.env.NODE_ENV': '"test"' },
  plugins: [
    {
      name: 'isolated-workshop-adapters',
      setup(builder) {
        builder.onResolve({ filter: /.*/ }, args =>
          args.path in adapters ? { path: args.path, namespace: 'test-adapter' } : undefined
        );
        builder.onLoad({ filter: /.*/, namespace: 'test-adapter' }, args => ({
          contents: adapters[args.path],
          loader: 'js',
          resolveDir: root
        }));
      }
    }
  ]
});
const bundlePath = join(directory, 'workshop.mjs');
await writeFile(bundlePath, bundle.outputFiles[0].text);
const { useWorkshop, audioKey, isReady, fromProject, toProject, controls, reset } = await import(
  pathToFileURL(bundlePath)
);
beforeEach(reset);

function workshop(ready = false, script = '乌拉乎：旧台词。') {
  const w = useWorkshop();
  w.applyScript(script);
  const role = w.state.value.characters[0];
  role.ttsConfig.voiceId = 'test-voice';
  role.ttsConfig.model = 'test-model';
  if (ready)
    for (const segment of w.state.value.segments) {
      segment.audio = {
        key: audioKey(segment, role),
        status: 'ready',
        units: [
          { text: segment.speakText, url: '/api/voice-lab/output/voice-lab-old.wav', durationMs: 1000, pauseAfterMs: 0 }
        ]
      };
    }
  return { w, role, segment: w.state.value.segments[0] };
}
function deferred() {
  let resolve;
  const promise = new Promise(done => {
    resolve = done;
  });
  return { promise, resolve };
}
function failSynthesis() {
  controls.synthesize = async () => ({ error: { response: { status: 400, data: { msg: '测试服务拒绝请求' } } } });
}

test('编辑整稿时直接保存，服务端得到新稿、人工设置和更新后的等待', async () => {
  const { w, segment } = workshop(false, '乌拉乎：旧台词。\n【停顿1s】');
  segment.toneDescription = '轻声';
  segment.portraitId = 'wulahu-开心';
  segment.pauseMode = 'manual';
  segment.pauseAfterMs = 1300;
  w.startEditScript();
  w.draftText.value = '乌拉乎：新版台词。\n【停顿2s】';
  await w.saveProject();
  const loaded = fromProject(controls.saved[0]);
  assert.equal(loaded.segments[0].text, '新版台词。');
  assert.equal(loaded.segments[0].toneDescription, '轻声');
  assert.equal(loaded.segments[0].portraitId, 'wulahu-开心');
  assert.equal(loaded.segments[0].pauseAfterMs, 1300);
  assert.equal(loaded.segments[1].waitMs, 2000);
  assert.equal(w.editingScript.value, false);
  assert.equal(w.saveLabel.value, '已保存到项目');
});

test('保存请求期间继续修改，不误报当前内容全部已保存', async () => {
  for (const changeDraft of [false, true]) {
    const { w } = workshop();
    const pending = deferred();
    controls.save = () => pending.promise;
    const saving = w.saveProject();
    if (changeDraft) {
      w.startEditScript();
      w.draftText.value = '乌拉乎：保存期间的新稿。';
    } else w.state.value.title = '保存期间的新标题';
    pending.resolve({ data: { id: 'test-project' } });
    await saving;
    assert.equal(w.saveLabel.value, '有新修改尚未保存到项目');
    assert.equal(controls.saved.at(-1).title, '未命名逐字稿');
    assert.equal(controls.saved.at(-1).steps[0].text, '旧台词。');
  }
});

test('TXT 和项目 JSON 导出先应用整稿编辑，空编辑不导出或保存旧稿', async t => {
  const blobs = [];
  const anchors = [];
  t.mock.method(URL, 'createObjectURL', blob => {
    blobs.push(blob);
    return 'blob:test';
  });
  t.mock.method(URL, 'revokeObjectURL', () => {});
  const originalDocument = globalThis.document;
  globalThis.document = {
    createElement: () => {
      const anchor = { click() {} };
      anchors.push(anchor);
      return anchor;
    }
  };
  t.after(() => {
    globalThis.document = originalDocument;
  });
  for (const kind of ['text', 'json']) {
    const { w } = workshop();
    w.startEditScript();
    w.draftText.value = `乌拉乎：${kind}的新台词。`;
    w.download(kind);
    const text = await blobs.at(-1).text();
    assert.equal(
      kind === 'text' ? text : JSON.parse(text).steps[0].text,
      kind === 'text' ? '乌拉乎：text的新台词。' : 'json的新台词。'
    );
    assert.equal(anchors.at(-1).download.endsWith(kind === 'text' ? '.txt' : '.json'), true);
  }
  const { w } = workshop();
  w.startEditScript();
  w.draftText.value = '  ';
  await w.saveProject();
  w.download('text');
  assert.equal(controls.saved.length, 0);
  assert.equal(blobs.length, 2);
});

test('单句重生成失败保留可播放音频，失败标记能保存并单独重试', async () => {
  const { w, role, segment } = workshop(true);
  const previous = JSON.stringify(segment.audio);
  failSynthesis();
  await w.generateOne(segment, true);
  assert.equal(JSON.stringify(segment.audio), previous);
  assert.equal(isReady(segment, role), true);
  assert.equal(w.failedSegments.value.length, 1);
  assert.match(segment.generationError, /拒绝/);
  const loaded = fromProject(toProject(w.state.value));
  assert.equal(isReady(loaded.segments[0], loaded.characters[0]), true);
  assert.equal(loaded.segments[0].generationError, segment.generationError);
  controls.synthesize = async () => ({ data: { audio: { url: '/api/voice-lab/output/voice-lab-retried.wav' } } });
  await w.generateAll(true);
  assert.equal(controls.calls.length, 2);
  assert.equal(segment.audio.units[0].url, '/api/voice-lab/output/voice-lab-retried.wav');
  assert.equal(w.failedSegments.value.length, 0);
  assert.equal(isReady(segment, role), true);
});

test('整段重生成失败保留旧音频，重试只请求失败句', async () => {
  const { w, role } = workshop(true, '乌拉乎：第一句。\n【停顿1s】\n乌拉乎：第二句。');
  const [first, , second] = w.state.value.segments;
  const original = JSON.stringify(first.audio);
  controls.synthesize = async data =>
    data.text === '第一句。'
      ? { error: { response: { status: 400, data: { msg: '第一句拒绝' } } } }
      : { data: { audio: { url: '/api/voice-lab/output/voice-lab-second.wav' } } };
  await w.generateAll();
  assert.equal(JSON.stringify(first.audio), original);
  assert.equal(second.audio.units[0].url, '/api/voice-lab/output/voice-lab-second.wav');
  assert.equal(isReady(first, role), true);
  assert.equal(w.failedSegments.value.length, 1);
  controls.synthesize = async () => ({ data: { audio: { url: '/api/voice-lab/output/voice-lab-retried.wav' } } });
  await w.generateAll();
  assert.deepEqual(
    controls.calls.map(call => call.text),
    ['第一句。', '第二句。', '第一句。']
  );
  assert.equal(w.failedSegments.value.length, 0);
});

test('停止重生成或迟到结果不会覆盖原音频', async () => {
  const { w, role, segment } = workshop(true);
  const previous = JSON.stringify(segment.audio);
  const entered = deferred();
  const pending = deferred();
  controls.synthesize = async () => {
    entered.resolve();
    return pending.promise;
  };
  const generating = w.generateOne(segment, true);
  await entered.promise;
  assert.equal(JSON.stringify(segment.audio), previous);
  w.stopGeneration();
  pending.resolve({ data: { audio: { url: '/api/voice-lab/output/voice-lab-late.wav' } } });
  await generating;
  assert.equal(JSON.stringify(segment.audio), previous);
  assert.equal(isReady(segment, role), true);
  assert.equal(w.failedSegments.value.length, 0);
});

test('新音频下载失败或时长无效时不覆盖旧音频，通过校验才替换', async () => {
  for (const failure of ['download', 'duration', 'success']) {
    const { w, role, segment } = workshop(true);
    const previous = JSON.stringify(segment.audio);
    controls.load = async () => {
      if (failure === 'download') throw new Error('音频下载失败');
      return new Blob(['test']);
    };
    controls.measure = async () => (failure === 'duration' ? 0 : 2000);
    await w.generateOne(segment, true);
    assert.equal(isReady(segment, role), true);
    if (failure === 'success') {
      assert.equal(segment.audio.units[0].url, '/api/voice-lab/output/voice-lab-new.wav');
      assert.equal(segment.audio.units[0].durationMs, 2000);
      assert.equal(w.failedSegments.value.length, 0);
    } else {
      assert.equal(JSON.stringify(segment.audio), previous);
      assert.equal(w.failedSegments.value.length, 1);
    }
  }
});

test('首次生成失败仍明确标记失败，重新导入不继承旧稿的人工设置', async () => {
  const { w, segment } = workshop();
  failSynthesis();
  await w.generateOne(segment);
  assert.equal(segment.audio.status, 'failed');
  assert.equal(w.failedSegments.value.length, 1);
  segment.toneDescription = '旧稿的语气';
  w.applyScript('乌拉乎：全新导入的稿件。');
  assert.equal(w.state.value.segments[0].toneDescription, '');
  assert.notEqual(w.state.value.segments[0].id, segment.id);
});

test('首次生成完成后进度响应式更新，不需要重新选择句子或刷新页面', async () => {
  const { w } = workshop();
  const entered = deferred();
  const pending = deferred();
  controls.synthesize = async () => {
    entered.resolve();
    return pending.promise;
  };
  const generating = w.generateAll();
  await entered.promise;
  assert.equal(w.readyCount.value, 0);
  assert.equal(w.allReady.value, false);
  pending.resolve({ data: { audio: { url: '/api/voice-lab/output/voice-lab-first.wav' } } });
  await generating;
  assert.equal(w.readyCount.value, 1);
  assert.equal(w.allReady.value, true);
  assert.equal(w.progress.value, 100);
});

test('解析新人物时使用人物库别名及布局，旧角色快照与未出场人物不变', () => {
  const { w, role } = workshop(true);
  const candidate = JSON.parse(JSON.stringify(role));
  candidate.id = 'library-demo';
  candidate.name = '库中向导';
  candidate.displayName = '库中向导';
  candidate.aliases = ['小向导'];
  candidate.poses[0].layout = { x: 32, y: 91, height: 70 };
  w.library.value = [
    { id: 'library-demo', revision: 5, character: candidate, archived: false, updatedAt: '' },
    {
      id: 'unused-demo',
      revision: 1,
      character: { ...candidate, id: 'unused', name: '未出场人物', aliases: [] },
      archived: false,
      updatedAt: ''
    }
  ];
  const before = JSON.stringify(role);
  w.applyScript('小向导：你好。');
  const adopted = w.roleFor(w.state.value, w.state.value.segments[0]);
  assert.equal(adopted.name, '库中向导');
  assert.equal(adopted.libraryRef.revision, 5);
  assert.deepEqual(adopted.poses[0].layout, { x: 32, y: 91, height: 70 });
  assert.equal(adopted.ttsConfig.voiceId, 'test-voice');
  assert.equal(JSON.stringify(role), before);
  assert(!w.state.value.characters.some(c => c.name === '未出场人物'));
});


test('Audio 音色自动识别模型，新台词不发送情绪指令，已生成缓存可复用', async () => {
  const { w, role, segment } = workshop(false);
  role.ttsConfig.voiceId = 'qwen-audio-3.0-tts-flash-fixture';
  role.ttsConfig.model = '';
  controls.synthesize = async () => ({ data: { model: 'qwen-audio-3.0-tts-flash', audio: { url: '/api/voice-lab/output/voice-lab-flash.wav' } } });
  await w.generateOne(segment);
  assert.equal(controls.calls[0].model, 'qwen-audio-3.0-tts-flash');
  assert.equal(controls.calls[0].instruction, '');
  assert.equal(isReady(segment, role), true);
});

test('手填旧音色由服务端补齐模型后，生成结果按新模型正确写入缓存', async () => {
  const { w, role, segment } = workshop(false);
  role.ttsConfig.voiceId = 'legacy-manual-voice';
  role.ttsConfig.model = '';
  controls.synthesize = async () => ({ data: { model: 'qwen-audio-3.0-tts-flash', audio: { url: '/api/voice-lab/output/voice-lab-manual.wav' } } });
  await w.generateOne(segment);
  assert.equal(role.ttsConfig.model, 'qwen-audio-3.0-tts-flash');
  assert.equal(isReady(segment, role), true);
});
