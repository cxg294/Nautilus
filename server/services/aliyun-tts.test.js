import assert from 'node:assert/strict';
import test from 'node:test';
import { collectWordAlignment, createCosyVoiceClone, parseSseJsonPayloads } from './aliyun-tts.js';
import config from '../config/env.js';

test('clone preserves the preprocessing choice for multipart uploads and JSON URLs', async t => {
  const originalKey = config.dashscope.apiKey;
  config.dashscope.apiKey = 'unit-test-no-network';
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    requests.push(JSON.parse(options.body));
    return new Response(JSON.stringify({ output: { voice_id: 'test-voice' } }), { status: 200 });
  });
  try {
    for (const checked of [false, true]) {
      const form = new FormData();
      form.append('enablePreprocess', String(checked));
      await createCosyVoiceClone({ audioUrl: 'https://example.com/reference.wav', enablePreprocess: form.get('enablePreprocess') });
      assert.equal(requests.at(-1).input.enable_preprocess, checked, `multipart ${checked}`);
      await createCosyVoiceClone({ audioUrl: 'https://example.com/reference.wav', enablePreprocess: checked });
      assert.equal(requests.at(-1).input.enable_preprocess, checked, `JSON ${checked}`);
    }
    await createCosyVoiceClone({ audioUrl: 'https://example.com/reference.wav' });
    assert.equal(requests.at(-1).input.enable_preprocess, false, 'omitted defaults to disabled');
  } finally {
    config.dashscope.apiKey = originalKey;
  }
});

test('parseSseJsonPayloads parses DashScope SSE data events', () => {
  const source = [
    'event: result',
    'data: {"request_id":"request-1","output":{"type":"sentence-begin","original_text":"今天天气","sentence":{"index":0,"words":[]}}}',
    '',
    'event: result',
    'data: {"request_id":"request-1","output":{"type":"sentence-end","original_text":"今天天气","sentence":{"index":0,"words":[{"text":"今","begin_index":0,"end_index":1,"begin_time":0,"end_time":180},{"text":"天","begin_index":1,"end_index":2,"begin_time":180,"end_time":360}]}}}',
    '',
    'data: {"request_id":"request-1","output":{"finish_reason":"stop","audio":{"url":"https://example.com/audio.wav"}},"usage":{"characters":4}}',
    '',
    'data: [DONE]',
  ].join('\n');

  const payloads = parseSseJsonPayloads(source);

  assert.equal(payloads.length, 3);
  assert.equal(payloads[1].output.type, 'sentence-end');
  assert.equal(payloads[2].output.audio.url, 'https://example.com/audio.wav');
});

test('collectWordAlignment keeps sentence text, indices, and millisecond timestamps', () => {
  const alignment = collectWordAlignment([
    {
      output: {
        type: 'sentence-end',
        original_text: '今天天气',
        sentence: {
          index: 0,
          words: [
            { text: '今', begin_index: 0, end_index: 1, begin_time: 0, end_time: 180 },
            { text: '天', begin_index: 1, end_index: 2, begin_time: 180, end_time: 360 },
          ],
        },
      },
    },
  ]);

  assert.deepEqual(alignment, {
    requested: true,
    available: true,
    unit: 'ms',
    granularity: 'word',
    sentences: [
      {
        index: 0,
        text: '今天天气',
        words: [
          { text: '今', beginIndex: 0, endIndex: 1, beginTimeMs: 0, endTimeMs: 180 },
          { text: '天', beginIndex: 1, endIndex: 2, beginTimeMs: 180, endTimeMs: 360 },
        ],
      },
    ],
  });
});

test('Audio token indices with punctuation and cumulative offsets become sentence-local character spans', () => {
  const event = (index, text, items) => ({ output: { type: 'sentence-end', original_text: text, sentence: { index, words: items.map(([word, begin, end], i) => ({ text: word, begin_index: begin, end_index: end, begin_time: index * 1000 + i * 100, end_time: index * 1000 + (i + 1) * 100 })) } } });
  const result = collectWordAlignment([
    event(0, '你好，同学。', [['你',0,1],['好，',1,2],['同',2,3],['学。',3,4]]),
    event(1, '再见。', [['再',4,5],['见。',5,6]])
  ]);
  assert.deepEqual(result.sentences[0].words.map(w => [w.text,w.beginIndex,w.endIndex]), [['你',0,1],['好，',1,3],['同',3,4],['学。',4,6]]);
  assert.deepEqual(result.sentences[1].words.map(w => [w.text,w.beginIndex,w.endIndex]), [['再',0,1],['见。',1,3]]);
  assert.equal(result.sentences[1].words[0].beginTimeMs, 1000);
});

test('CosyVoice global character indices, normalized numbers and added punctuation stay aligned', () => {
  const result = collectWordAlignment([
    { output: { type: 'sentence-end', original_text: '第12关。', sentence: { index: 0, words: [
      ['第',0,1],['十二',1,3],['关',3,4],['。',4,5]
    ].map(([text,begin_index,end_index],i)=>({text,begin_index,end_index,begin_time:i*100,end_time:(i+1)*100})) } } },
    { output: { type: 'sentence-end', original_text: '你好', sentence: { index: 1, words: [
      ['你',5,6],['好',6,7],['。',7,8]
    ].map(([text,begin_index,end_index],i)=>({text,begin_index,end_index,begin_time:1000+i*100,end_time:1000+(i+1)*100})) } } }
  ]);
  assert.deepEqual(result.sentences[0].words.map(w=>w.text), ['第','12','关','。']);
  assert.deepEqual(result.sentences[1].words.map(w=>[w.text,w.beginIndex,w.endIndex]), [['你',0,1],['好',1,2]]);
});
