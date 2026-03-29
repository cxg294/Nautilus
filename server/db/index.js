import Database from 'better-sqlite3';
import config from '../config/env.js';
import path from 'path';
import fs from 'fs';

// 确保数据库目录存在
const dbDir = path.dirname(config.dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// 初始化 SQLite 数据库
const db = new Database(config.dbPath);

// 启用 WAL 模式（提升并发读写性能）
db.pragma('journal_mode = WAL');

/**
 * 运行数据库 migration
 * 自动执行 migrations 目录下的所有 SQL 文件
 */
export function runMigrations() {
  const migrationsDir = path.resolve(path.dirname(config.dbPath), 'migrations');

  // 创建 migration 记录表
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 获取已执行的 migration
  const applied = new Set(
    db.prepare('SELECT name FROM _migrations').all().map(r => r.name)
  );

  // 扫描并执行未应用的 migration
  if (fs.existsSync(migrationsDir)) {
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (!applied.has(file)) {
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
        db.exec(sql);
        db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
        console.log(`[DB] 已执行 migration: ${file}`);
      }
    }
  }
}

export default db;
