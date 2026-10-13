import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  audioKey,
  synthesisInstruction,
  createCharacter,
  createSegment,
  dialogueText,
  emptyState,
  exportText,
  fromProject,
  isReady,
  parseTranscript,
  prepareSegments,
  prepareEditedTranscript,
  resolvePortrait,
  safeAudioUrl,
  splitSpeech,
  toProject,
  updateAutomaticPauses,
  presetReferenceUrl,
  semanticPunctuation
} from './model';

const audioUrl = '/api/voice-lab/output/voice-lab-123-test.wav';
function readyProject() {
  const state = emptyState();
  const role = state.characters[0];
  role.ttsConfig.voiceId = 'cosyvoice-v3-test';
  role.ttsConfig.model = 'cosyvoice-v3.5-flash';
  const segment = createSegment(role.id, '你好，开始吧。');
  segment.audio = {
    key: audioKey(segment, role),
    status: 'ready',
    units: [{ text: segment.speakText, url: audioUrl, durationMs: 1500, pauseAfterMs: 0 }]
  };
  state.segments = [segment];
  return { state, role, segment };
}

test('角色标题、多行延续、博士别名和显式等待可同时导入', () => {
  const state = emptyState();
  const segments = parseTranscript(
    '博士：\n水晶球旁边，\n有左右两个通道。\n【停顿1.5s】\n乌拉乎﹕准备好了吗？\n【展示积木】',
    state
  );
  assert.deepEqual(
    segments.map(item => [item.kind, item.characterId]),
    [
      ['dialogue', 'doctor'],
      ['dialogue', 'doctor'],
      ['wait', ''],
      ['dialogue', 'wulahu'],
      ['direction', '']
    ]
  );
  assert.equal(segments[2].waitMs, 1500);
  assert.equal(state.characters.length, 6);
});

test('括号里的教学代码和知识保留，只移出表演提示', () => {
  assert.equal(
    dialogueText('调用 print("hello")，括号（用于分组）。（微笑）').speakText,
    '调用 print("hello")，括号（用于分组）。'
  );
  assert.equal(dialogueText('（好奇）为什么？').notes, '好奇');
});

test('整理补充衔接标点、识别问句并拆分长字幕', () => {
  const state = emptyState();
  const lines = prepareSegments(parseTranscript('博士：水晶球旁边\n有左右两个通道\n乌拉乎：准备好了吗', state));
  assert.equal(lines[0].text, '水晶球旁边，有左右两个通道。');
  assert.equal(lines[1].text, '准备好了吗？');
  assert.equal(lines[1].tone, '好奇提问');
  assert.equal(lines[0].pauseAfterMs, 500);
  assert.equal(lines[1].pauseAfterMs, 0);
  const long = prepareSegments([
    createSegment(
      'doctor',
      '这是一段需要按照语义拆开而且超过两行的讲解字幕我们可以先观察水晶球的位置然后选择合适的代码块让它转动起来'
    )
  ]);
  assert.ok(long.length > 1);
  assert.ok(long.every(line => Array.from(line.text).length <= 25));
  assert.equal(new Set(long.map(line => line.id)).size, long.length);
  const code = 'for (let i = 0; i < 10; i++) { console.log(i); }';
  assert.equal(prepareSegments([createSegment('doctor', code)]).length, 1);
});

test('仅改变声音有关参数时旧音频失效，立绘与停顿不触发合成', () => {
  const { segment, role } = readyProject();
  assert.equal(isReady(segment, role), true);
  segment.portraitId = 'other';
  segment.pauseAfterMs = 300;
  assert.equal(isReady(segment, role), true);
  for (const change of [
    () => (segment.speakText = '新台词'),
    () => (segment.toneDescription = '轻声'),
    () => (role.ttsConfig.rate = 1.5),
    () => (role.ttsConfig.voiceId = 'cosyvoice-new')
  ]) {
    const { segment: original, role: originalRole } = readyProject();
    Object.assign(segment, original);
    Object.assign(role, originalRole);
    change();
    assert.equal(isReady(segment, role), false);
  }
});

test('本机项目可往返保存角色 ID、声音、配音、立绘和已删除角色', () => {
  const { state } = readyProject();
  state.characters.splice(2, 1);
  const custom = createCharacter('小向导');
  custom.displayName = '向导';
  custom.aliases = ['助手'];
  state.characters.push(custom);
  state.segments.push(createSegment(custom.id, '往这里走。'));
  const portrait = {
    id: 'portrait',
    type: 'image' as const,
    name: '自定义立绘',
    url: '/api/sequence-player/assets/12345678-1234-1234-1234-123456789abc.webp'
  };
  state.assets.push(portrait);
  custom.poses.push({ id: 'portrait', name: '开心', imageUrl: portrait.url });
  const loaded = fromProject(JSON.parse(JSON.stringify(toProject(state))));
  assert.deepEqual(
    loaded.characters.map(role => role.id),
    state.characters.map(role => role.id)
  );
  assert.equal(loaded.segments[1].characterId, custom.id);
  assert.equal(loaded.characters.at(-1)?.displayName, '向导');
  assert.deepEqual(loaded.characters.at(-1)?.aliases, ['助手']);
  assert.equal(isReady(loaded.segments[0], loaded.characters[0]), true);
  assert.deepEqual(loaded.assets, state.assets);
});

test('旧工坊和渲染任务导入保留台词语气，排除所有旧音色及音频', () => {
  const loaded = fromProject({
    project: { title: '旧工坊' },
    characters: [
      {
        id: 'old-doctor',
        name: '博士',
        side: 'left',
        voiceClone: { provider: 'ai-lib-b', voiceId: 'voice_doctor' },
        ttsConfig: { provider: 'nautilus', voiceId: 'voice_doctor' }
      }
    ],
    segments: [
      {
        id: 'old-line',
        characterId: 'old-doctor',
        text: '向左转！',
        tts: { tone: '惊讶强调', toneDescription: '大声强调' },
        timing: { pauseAfterMs: 350 },
        audioUnits: [{ audioUrl: 'http://old/audio.wav' }],
        audio: { status: 'ready', units: [] }
      }
    ]
  });
  assert.equal(loaded.title, '旧工坊');
  assert.equal(loaded.segments[0].characterId, 'doctor');
  assert.equal(loaded.segments[0].tone, '惊讶强调');
  assert.equal(loaded.segments[0].toneDescription, '大声强调');
  assert.equal(loaded.segments[0].pauseAfterMs, 350);
  assert.equal(loaded.segments[0].audio, undefined);
  assert.ok(loaded.characters.every(role => !role.ttsConfig.voiceId));
  assert.doesNotMatch(JSON.stringify(toProject(loaded)), /ai-lib|voice_doctor|old\/audio/);
});

test('旧舞台片段扁平显示，编辑保存后不会重新投影覆盖修改', () => {
  const raw = {
    title: '课程',
    steps: [],
    stageSequences: [
      {
        id: 'seq1',
        events: [
          { id: 'event1', type: 'dialogue', actor: '博士', speakText: '旧台词', visualCue: { action: 'highlight' } },
          { id: 'wait1', type: 'wait', duration: 900 }
        ]
      }
    ]
  };
  const state = fromProject(raw);
  assert.equal(state.segments[0].text, '旧台词');
  state.segments[0].text = '新台词';
  state.segments[0].speakText = '新台词';
  const loaded = fromProject(toProject(state));
  assert.equal(loaded.segments[0].text, '新台词');
  assert.equal(loaded.segments[1].waitMs, 900);
  assert.deepEqual(loaded.legacy.stageSequences, raw.stageSequences);
});

test('音频必须为本机地址且每个合成单元完整，阻止残缺缓存被标为完成', () => {
  assert.equal(safeAudioUrl(audioUrl), true);
  for (const url of [
    'https://old/audio.wav',
    '/api/voice-lab/output/voice-lab-a.wav?_token=secret',
    '/api/voice-lab/output/../secret.wav',
    'data:audio/wav;base64,a'
  ])
    assert.equal(safeAudioUrl(url), false);
  const { segment, role } = readyProject();
  segment.audio!.units[0].text = '错误台词';
  assert.equal(isReady(segment, role), false);
  segment.audio!.units = [];
  assert.equal(isReady(segment, role), false);
});

test('按语气自动匹配立绘，手动立绘优先，文本导出不包含音频', () => {
  const { state, segment, role } = readyProject();
  segment.tone = '惊讶强调';
  assert.match(resolvePortrait(role, segment), /%E6%83%8A%E8%AE%B6/);
  segment.portraitId = role.poses[0].id;
  assert.equal(resolvePortrait(role, segment), role.poses[0].imageUrl);
  assert.equal(exportText(state), '乌拉乎：你好，开始吧。');
  assert.deepEqual(splitSpeech('这是前半句。现在开始！'), ['这是前半句。', '现在开始！']);
});

test('合并不跨等待、舞台提示、手动设置和来源信息，整理保留原对象', () => {
  const first = createSegment('doctor', '先观察');
  const customized = { ...createSegment('doctor', '仔细看'), toneDescription: '轻声' };
  const manual = { ...createSegment('doctor', '等一等'), pauseMode: 'manual' as const, pauseAfterMs: 1200 };
  const sourced = { ...createSegment('doctor', '来源片段'), sourceStep: { displayNote: '保留来源' } };
  const lines = prepareSegments([first, customized, manual, sourced]);
  assert.equal(lines.length, 4);
  assert.equal(first.text, '先观察');
  assert.equal(lines[1].toneDescription, '轻声');
  assert.equal(lines[2].pauseAfterMs, 1200);
  assert.deepEqual(lines[3].sourceStep, sourced.sourceStep);
  const state = emptyState();
  const barriers = prepareSegments(
    parseTranscript(
      `博士：第一句
【停顿1s】
博士：第二句
【展示积木】
博士：第三句`,
      state
    )
  );
  assert.deepEqual(
    barriers.map(line => line.kind),
    ['dialogue', 'wait', 'dialogue', 'direction', 'dialogue']
  );
  assert.equal(barriers[0].pauseAfterMs, 0);
});

test('语义标点处理连接词与重复标点，代码和知识括号原样保留', () => {
  assert.equal(
    semanticPunctuation('无论向左还是向右都可以但是要看清目标。。'),
    '无论向左，还是向右都可以，但是要看清目标。'
  );
  const code = '调用 print("所以")，括号（用于分组）';
  assert.equal(semanticPunctuation(code), code);
});

test('新角色自然语速，旧项目语速与手动停顿往返不变，预设标识不可作音色 ID', () => {
  const state = emptyState();
  assert.equal(state.characters[0].ttsConfig.rate, 1);
  assert.equal(presetReferenceUrl(state.characters[0]), '/sequence-player/voices/wulahu-reference.mp3');
  state.characters[0].ttsConfig.rate = 1.4;
  state.segments = [{ ...createSegment('wulahu', '你好。'), pauseAfterMs: 700, pauseMode: 'manual' }];
  const loaded = fromProject(toProject(state));
  updateAutomaticPauses(loaded.segments);
  assert.equal(loaded.characters[0].ttsConfig.rate, 1.4);
  assert.equal(loaded.segments[0].pauseAfterMs, 700);
  const raw = toProject(state);
  raw.characters[0].ttsConfig.voiceId = 'nautilus-preset-wulahu';
  assert.equal(fromProject(raw).characters[0].ttsConfig.voiceId, '');
});

test('单句单请求缓存和旧拆句缓存均可读，残缺旧缓存不可播放', () => {
  const { segment, role } = readyProject();
  segment.speakText = '第一句。第二句！';
  segment.audio!.key = audioKey(segment, role);
  segment.audio!.units[0].text = segment.speakText;
  assert.equal(isReady(segment, role), true);
  segment.audio!.units = splitSpeech(segment.speakText).map(text => ({
    text,
    url: audioUrl,
    durationMs: 1000,
    pauseAfterMs: 0
  }));
  assert.equal(isReady(segment, role), true);
  segment.audio!.units.pop();
  assert.equal(isReady(segment, role), false);
});

test('长字幕优先在成对关联词前断开，保持短的成对结构完整', () => {
  const lines = prepareSegments([createSegment('doctor', '我们已经认识了这个方法，无论向左还是向右都可以完成任务。')]);
  assert.equal(lines[0].text, '我们已经认识了这个方法，');
  assert.equal(lines[1].text, '无论向左，还是向右都可以完成任务。');
});

test('编辑整稿不重新合并已微调行，保留声音缓存、手动语气和停顿', () => {
  const { state, segment } = readyProject();
  segment.tone = '亲切鼓励';
  segment.pauseMode = 'manual';
  segment.pauseAfterMs = 1300;
  segment.audio!.key = audioKey(segment, state.characters[0]);
  const next = createSegment(segment.characterId, '继续观察。');
  state.segments.push(next);
  const prepared = prepareEditedTranscript(exportText(state) + '\n禾木：到这里来', state);
  assert.equal(prepared.length, 3);
  assert.equal(prepared[0].id, segment.id);
  assert.equal(prepared[0].tone, '亲切鼓励');
  assert.equal(prepared[0].pauseAfterMs, 1300);
  assert.equal(isReady(prepared[0], state.characters[0]), true);
  assert.equal(prepared[1].id, next.id);
  assert.equal(prepared[2].text, '到这里来。');
});

test('失败句补选音色后保存刷新仍可重试，旧成功缓存不会冒充新音色', () => {
  const { state, segment, role } = readyProject();
  segment.audio!.status = 'failed';
  segment.audio!.error = '缺少声音';
  role.ttsConfig.voiceId = 'cosyvoice-new';
  const loaded = fromProject(toProject(state));
  assert.equal(loaded.segments[0].audio?.status, 'failed');
  assert.equal(isReady(loaded.segments[0], loaded.characters[0]), false);
  segment.audio!.status = 'ready';
  assert.equal(fromProject(toProject(state)).segments[0].audio, undefined);
});

test('整稿修改等待时长采用新值，多个等待和项目往返也不串值', () => {
  const state = emptyState();
  state.segments = parseTranscript('【停顿1s】', state);
  assert.equal(prepareEditedTranscript('【停顿2s】', state)[0].waitMs, 2000);
  state.segments = parseTranscript('【停顿1s】\n【停顿2s】', state);
  assert.deepEqual(
    prepareEditedTranscript('【停顿9s】\n【停顿1s】', state).map(line => line.waitMs),
    [9000, 1000]
  );
  const loaded = fromProject(toProject(state));
  assert.deepEqual(
    prepareEditedTranscript('【停顿1.5s】\n【停顿3s】', loaded).map(line => line.waitMs),
    [1500, 3000]
  );
});

test('整稿改写对应台词保留人工设置和来源，仅失效受影响音频', () => {
  const { state, role, segment } = readyProject();
  Object.assign(segment, {
    tone: '亲切鼓励',
    toneDescription: '轻声',
    portraitId: 'wulahu-开心',
    pauseMode: 'manual',
    pauseAfterMs: 1300,
    sourceStep: { displayNote: '来源保留' }
  });
  segment.audio!.key = audioKey(segment, role);
  const next = createSegment('taozi', '继续观察。');
  state.segments.push(next);
  updateAutomaticPauses(state.segments);
  const edited = prepareEditedTranscript('乌拉乎：修改后的句子。\n桃子：继续观察。', state);
  assert.equal(edited[0].id, segment.id);
  assert.equal(edited[0].text, '修改后的句子。');
  assert.equal(edited[0].speakText, '修改后的句子。');
  for (const key of ['tone', 'toneDescription', 'portraitId', 'pauseMode', 'pauseAfterMs', 'sourceStep'] as const)
    assert.deepEqual(edited[0][key], segment[key]);
  assert.equal(edited[0].audio, undefined);
  assert.deepEqual(edited[1], next);
  assert.equal(segment.text, '你好，开始吧。');
  assert.equal(isReady(segment, role), true);
  const loaded = fromProject(toProject({ ...state, segments: edited }));
  assert.equal(loaded.segments[0].pauseAfterMs, 1300);
  assert.equal(loaded.segments[0].portraitId, 'wulahu-开心');
});

test('插入、删除、调序和换角色不把人工设置挪给新句', () => {
  const { state, segment } = readyProject();
  segment.portraitId = 'wulahu-开心';
  const next = createSegment('wulahu', '继续观察。');
  next.toneDescription = '继续的语气';
  state.segments.push(next);
  const inserted = prepareEditedTranscript('乌拉乎：新插入。\n乌拉乎：你好，开始吧。\n乌拉乎：继续观察。', state);
  assert.equal(inserted[0].portraitId, 'auto');
  assert.equal(inserted[1].id, segment.id);
  assert.equal(inserted[2].id, next.id);
  const removed = prepareEditedTranscript('乌拉乎：继续观察。', state);
  assert.equal(removed[0].id, next.id);
  const reordered = prepareEditedTranscript('乌拉乎：继续观察。\n乌拉乎：你好，开始吧。', state);
  assert.deepEqual(
    reordered.map(line => line.id),
    [next.id, segment.id]
  );
  const changedRole = prepareEditedTranscript('桃子：你好，开始吧。\n乌拉乎：继续观察。', state);
  assert.notEqual(changedRole[0].id, segment.id);
  assert.equal(changedRole[0].portraitId, 'auto');
});

test('括号、嵌套括号、代码和算式长句不拆开或插入逗号', () => {
  for (const text of [
    '这是一段说明（括号里面是需要原样保留的知识内容而且不要在中间插入逗号）然后继续讲解。',
    '这是一段说明(括号里面是需要原样保留的知识内容而且不要在中间插入逗号)然后继续讲解。',
    '先观察（外层包含（内层知识）而且整体都要保持原样）然后继续讲解。',
    '调用 print("这是完整代码而且不能增加标点也不能断开字符串") 然后继续讲解。',
    '计算这道题目时先观察表达式 12345.67 + 89012.34 = 101358.01 再回答。'
  ]) {
    const prepared = prepareSegments([createSegment('doctor', text)]);
    assert.equal(prepared.length, 1);
    assert.equal(prepared[0].text, text);
    assert.equal(prepared[0].speakText, text);
  }
});

test('重生成失败记录和仍可播放的原音频可一起保存恢复', () => {
  const { state, segment } = readyProject();
  segment.generationError = '服务拒绝了本次重生成';
  const loaded = fromProject(toProject(state));
  assert.equal(loaded.segments[0].generationError, segment.generationError);
  assert.equal(isReady(loaded.segments[0], loaded.characters[0]), true);
});


test('新台词无情绪指令，显式开启后限制计费长度，项目往返保留选择', () => {
  const { state, segment, role } = readyProject();
  assert.equal(synthesisInstruction(segment), '');
  const before = audioKey(segment, role);
  segment.useInstruction = true;
  segment.toneDescription = '温柔'.repeat(80);
  const instruction = synthesisInstruction(segment);
  assert(instruction.length <= 50);
  assert(instruction.startsWith('平静讲解'));
  assert.notEqual(audioKey(segment, role), before);
  assert.equal(fromProject(toProject(state)).segments[0].useInstruction, true);
  segment.useInstruction = false;
  assert.equal(fromProject(toProject(state)).segments[0].useInstruction, false);
});

test('旧项目缺少语气开关时保留原合成行为及已生成音频缓存', () => {
  const { state, segment, role } = readyProject();
  delete segment.useInstruction;
  segment.audio!.key = audioKey(segment, role);
  const originalKey = segment.audio!.key;
  const loaded = fromProject(toProject(state));
  assert.equal(loaded.segments[0].useInstruction, true);
  assert.equal(audioKey(loaded.segments[0], loaded.characters[0]), originalKey);
  assert.equal(isReady(loaded.segments[0], loaded.characters[0]), true);
  assert.equal(synthesisInstruction(loaded.segments[0]), '平静讲解');
});


test('speech controls survive project round trips and invalidate only changed audio', () => {
  const state = emptyState();
  const role = state.characters[0];
  role.ttsConfig.voiceId = 'test-voice';
  const segment = createSegment(role.id, '请看W3C。然后继续。');
  state.segments = [segment];
  const originalKey = audioKey(segment, role);
  segment.speechControls = [];
  assert.equal(audioKey(segment, role), originalKey);
  segment.speechControls = [{kind:'reading',text:'W3C',alias:'网络协议标准'},{kind:'pause',after:'W3C。',occurrence:1,timeMs:500}];
  const key = audioKey(segment, role);
  assert.notEqual(key, originalKey);
  const restored = fromProject(toProject(state));
  assert.deepEqual(restored.segments[0].speechControls, segment.speechControls);
  assert.equal(audioKey(restored.segments[0], restored.characters[0]), key);
  segment.speechControls[1] = {kind:'pause',after:'W3C。',occurrence:1,timeMs:800};
  assert.notEqual(audioKey(segment, role), key);
});
