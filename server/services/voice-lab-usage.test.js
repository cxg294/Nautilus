import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';
import { attachVoiceUsage, recordVoiceGeneration } from './voice-lab-usage.js';

test('按音色分别统计服务端成功合成与试听，不计入旧前端埋点', () => {
  const database = new Database(':memory:');
  try {
    database.exec(`
      CREATE TABLE analytics_events (
        user_id TEXT NOT NULL, username TEXT, event_type TEXT, tool_name TEXT,
        action_name TEXT, result TEXT, meta TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    database.prepare(`
      INSERT INTO analytics_events (user_id, username, event_type, tool_name, action_name, result, meta)
      VALUES ('1', 'admin', 'action', 'voice-lab', 'synthesize', 'success', '{"model":"old"}')
    `).run();

    const user = { id: 2, username: 'tester' };
    const voiceA = { voice: 'voice-a', model: 'cosyvoice-v3.5-flash', requestId: 'request-a', usage: { characters: 12 } };
    const voiceB = { ...voiceA, voice: 'voice-b', requestId: 'request-b' };
    recordVoiceGeneration({ user, result: voiceA, kind: 'synthesize', origin: 'sequence-player' }, database);
    recordVoiceGeneration({ user, result: voiceA, kind: 'audition' }, database);
    recordVoiceGeneration({ user, result: voiceB, kind: 'synthesize' }, database);

    const rows = attachVoiceUsage([{ voice: 'voice-a' }, { voice: 'voice-b' }, { voice: 'voice-c' }], database);
    assert.deepEqual(rows.map(({ synthesisCount, auditionCount }) => [synthesisCount, auditionCount]), [[1, 1], [1, 0], [0, 0]]);
    const metadata = JSON.parse(database.prepare(`SELECT meta FROM analytics_events WHERE username = 'tester' AND action_name = 'synthesize' ORDER BY rowid LIMIT 1`).get().meta);
    assert.equal(metadata.voice, 'voice-a');
    assert.equal(metadata.origin, 'sequence-player');
    assert.equal(metadata.characters, 12);
    assert.equal(metadata.recordedBy, 'server');
  } finally {
    database.close();
  }
});
