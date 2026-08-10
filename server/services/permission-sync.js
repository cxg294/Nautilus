/**
 * 工具权限自动同步服务
 *
 * 在服务启动时扫描前端 manifest.json 文件，
 * 自动将缺失的 module:xxx:access 权限写入 permissions 表，
 * 并确保 owner 角色拥有所有权限。
 *
 * 这使得新增工具时无需手动写 SQL migration 来注册权限。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../db/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 扫描 manifest.json 并同步权限到数据库
 */
export function syncToolPermissions() {
  const viewsDir = path.resolve(__dirname, '../../src/views');

  if (!fs.existsSync(viewsDir)) {
    console.log('[权限同步] src/views 目录不存在，跳过同步');
    return;
  }

  const upsertPerm = db.prepare(
    `INSERT INTO permissions (key, description) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET description = excluded.description`
  );
  const upsertOwner = db.prepare(
    'INSERT OR IGNORE INTO role_permissions (role, permission_key) VALUES (?, ?)'
  );

  const dirs = fs.readdirSync(viewsDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('_'));

  let synced = 0;

  const transaction = db.transaction(() => {
    for (const dir of dirs) {
      const manifestPath = path.join(viewsDir, dir.name, 'manifest.json');
      if (!fs.existsSync(manifestPath)) continue;

      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
        const permKey = `module:${manifest.name}:access`;
        const description = manifest.i18n?.['zh-CN']?.route || manifest.name;

        // 同步名称：manifest 是工具名称的唯一来源，避免旧 migration 留下过期文案。
        const result = upsertPerm.run(permKey, description);
        if (result.changes > 0) {
          synced++;
          console.log(`[权限同步] 新增权限: ${permKey} (${description})`);
        }

        // 确保 owner 拥有该权限
        upsertOwner.run('owner', permKey);
      } catch (err) {
        console.warn(`[权限同步] 解析 ${dir.name}/manifest.json 失败:`, err.message);
      }
    }
  });

  transaction();

  if (synced > 0) {
    console.log(`[权限同步] 完成，新增 ${synced} 个权限`);
  } else {
    console.log('[权限同步] 权限已是最新，无需更新');
  }
}
