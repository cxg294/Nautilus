import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件目录（兼容 ES Module）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 项目根目录（server/config → 上两级）
const rootDir = path.resolve(__dirname, '../../');

// 加载项目根目录的 .env
dotenv.config({ path: path.resolve(rootDir, '.env') });

export default {
  // 服务端口
  port: parseInt(process.env.PORT || '3000', 10),

  // JWT 配置
  jwt: {
    secret: process.env.JWT_SECRET || 'nautilus-dev-secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'nautilus-dev-refresh-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  // 数据库路径（相对于 server/ 目录）
  dbPath: path.resolve(__dirname, '../db/nautilus.db'),

  // migration 目录
  migrationsDir: path.resolve(__dirname, '../db/migrations'),

  // 运行环境
  isDev: process.env.NODE_ENV !== 'production',
};

