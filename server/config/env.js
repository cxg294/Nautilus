import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件目录（兼容 ES Module）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载环境变量
dotenv.config({ path: path.resolve(__dirname, '../.env') });

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

  // 数据库路径
  dbPath: path.resolve(__dirname, process.env.DB_PATH || './db/nautilus.db'),

  // 运行环境
  isDev: process.env.NODE_ENV !== 'production',
};
