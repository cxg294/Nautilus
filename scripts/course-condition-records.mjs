// node scripts/course-condition-records.mjs [--rescan] [--all]
import db from '../server/db/index.js';
import { createConditionRecordStore } from '../server/services/course-condition-records.js';

const args = new Set(process.argv.slice(2));
if ([...args].some(arg => !['--rescan', '--all'].includes(arg))) throw new Error('用法：node scripts/course-condition-records.mjs [--rescan] [--all]');
try {
  const store = createConditionRecordStore(db);
  let scanned = 0;
  const failures = [];
  if (args.has('--rescan')) {
    store.recheck();
    if (db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='course_structure_cache'").get()) {
      for (const row of db.prepare('SELECT cache_key, structure_json FROM course_structure_cache').all()) {
        try { store.recordStructure(JSON.parse(row.structure_json)); scanned++; }
        catch (error) { failures.push({ cacheKey: row.cache_key, message: error.message }); }
      }
    }
  }
  const records = store.list({ all: args.has('--all') });
  console.log(JSON.stringify({ scanned, failures, count: records.length, records }, null, 2));
  if (failures.length) process.exitCode = 1;
} finally { db.close(); }
