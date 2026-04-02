/**
 * 数据库种子数据
 * 运行: npm run db:seed
 * 为开发环境填充初始数据（如默认管理员账号）
 */
import db, { runMigrations } from './index.js';
import { hashSync } from 'bcryptjs';

// 确保 migration 已执行
runMigrations();

// 创建默认管理员
const existingOwner = db.prepare('SELECT id FROM users WHERE role = ?').get('owner');

if (!existingOwner) {
  const passwordHash = hashSync('admin123', 10);
  db.prepare(`
    INSERT INTO users (username, email, password_hash, display_name, role)
    VALUES (?, ?, ?, ?, ?)
  `).run('admin', 'admin@nautilus.local', passwordHash, '管理员', 'owner');

  console.log('[Seed] ✅ 已创建默认管理员账号');
  console.log('[Seed]    用户名: admin');
  console.log('[Seed]    密码: admin123');
  console.log('[Seed]    ⚠️  请在生产环境中修改密码！');
} else {
  console.log('[Seed] 管理员账号已存在，跳过');
}

console.log('[Seed] 种子数据填充完成');
