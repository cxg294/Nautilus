import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLayout, legacyLayout } from './layout';
import { adoptCharacter } from './project';
import {
  emptyState,
  createSegment,
  audioKey,
  isReady,
  toProject,
  fromProject,
  resolvePose
} from '../sequence-player/workshop/model';
import presets from '../../../shared/character-presets.json';

test('15 张校准立绘各自有位置；带大幅留白的博士表情用更高的原图比例', () => {
  assert.equal(presets.flatMap(c => c.poses).length, 15);
  const doctor = presets.find(c => c.id === 'doctor')!;
  assert.equal(doctor.poses[0].layout.height, 72);
  assert(doctor.poses[1].layout.height > doctor.poses[0].layout.height);
  for (const c of presets) for (const p of c.poses) assert.deepEqual(normalizeLayout(p.layout), p.layout);
  assert.equal(normalizeLayout({ x: NaN, y: 1, height: 60 }), undefined);
  assert.equal(normalizeLayout({ x: 1, y: 1, height: Infinity }), undefined);
  assert.deepEqual(legacyLayout('left', 1), { x: 21, y: 96, height: (32 * 16) / 9 });
});
test('每张立绘独立，默认立绘生效；手选和语气表情优先', () => {
  const role = emptyState().characters[0];
  role.defaultPoseId = role.poses[1].id;
  const line = createSegment(role.id, '测试');
  assert.equal(resolvePose(role, line)?.id, role.defaultPoseId);
  line.tone = '惊讶强调';
  assert.equal(resolvePose(role, line)?.name, '惊讶');
  line.portraitId = role.poses[3].id;
  assert.equal(resolvePose(role, line)?.name, '疑惑');
  const previous = role.poses[1].layout!.x;
  role.poses[0].layout!.x = 31;
  assert.equal(role.poses[1].layout!.x, previous);
});
test('项目导入导出保留单张布局与版本；旧项目缺少布局时不填入新推荐值', () => {
  const state = emptyState(),
    role = state.characters[0];
  role.poses[2].layout = { x: 70, y: 90, height: 88 };
  role.libraryRef = { id: 'builtin-wulahu', revision: 3 };
  state.segments = [createSegment(role.id, '你好')];
  const restored = fromProject(toProject(state));
  assert.deepEqual(restored.characters[0].poses[2].layout, role.poses[2].layout);
  assert.deepEqual(restored.characters[0].libraryRef, role.libraryRef);
  const old = toProject(state);
  for (const c of old.characters) for (const p of c.poses) delete p.layout;
  const legacy = fromProject(old);
  assert(legacy.characters[0].poses.every(p => !p.layout));
});
test('采用库快照保留项目人物 ID 与台词；仅改位置保留音频，改声音使音频待生成', () => {
  const state = emptyState(),
    role = state.characters[0];
  role.ttsConfig.voiceId = 'test-voice';
  const line = createSegment(role.id, '你好');
  state.segments = [line];
  line.portraitId = role.poses[1].id;
  line.audio = {
    key: audioKey(line, role),
    status: 'ready',
    units: [{ text: '你好', url: '/api/voice-lab/output/voice-lab-test.wav', durationMs: 1000, pauseAfterMs: 0 }]
  };
  const character = JSON.parse(JSON.stringify(role));
  character.poses[1].id = 'new-happy';
  character.poses[1].layout.x = 62;
  const record = { id: 'record', revision: 2, character, archived: false, updatedAt: '' };
  adoptCharacter(state, record, role.id);
  assert.equal(line.characterId, 'wulahu');
  assert.equal(line.portraitId, 'new-happy');
  assert(isReady(line, role));
  record.character.poses[1].layout.x = 90;
  assert.equal(role.poses[1].layout!.x, 62);
  record.character.ttsConfig.voiceId = 'new-voice';
  adoptCharacter(state, record, role.id);
  assert(!isReady(line, role));
  assert(line.audio);
});
