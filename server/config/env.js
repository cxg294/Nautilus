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

// JWT Secret 安全校验：生产环境必须通过环境变量提供强密钥
const jwtSecret = process.env.JWT_SECRET;
const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
if (!jwtSecret || jwtSecret.includes('change-me') || jwtSecret.length < 32) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('生产环境必须设置 JWT_SECRET（长度 >= 32），请检查 .env 配置');
  }
  console.warn('⚠️  JWT_SECRET 未配置或过短，请尽快更换为强随机密钥');
}

export default {
  // 服务端口
  port: parseInt(process.env.PORT || '3000', 10),

  // JWT 配置（不再提供弱 fallback）
  jwt: {
    secret: jwtSecret || 'INSECURE-DEV-ONLY-CHANGE-ME',
    refreshSecret: jwtRefreshSecret || 'INSECURE-DEV-ONLY-CHANGE-ME',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },

  // 数据库路径（相对于 server/ 目录）
  dbPath: path.resolve(__dirname, '../db/nautilus.db'),

  // migration 目录
  migrationsDir: path.resolve(__dirname, '../db/migrations'),

  // 运行环境
  isDev: process.env.NODE_ENV !== 'production',

  // 工具 API Key（AI Agent 调用鉴权）
  apiKey: process.env.NAUTILUS_API_KEY || 'naut-dev-key-change-me',

  // 首页 AI 新闻源配置
  news: {
    source: process.env.NEWS_SOURCE || 'hybrid', // rss | lark | hybrid
    rssUrl: process.env.NEWS_RSS_URL || 'https://llmposts.com/feed/',
    refreshMinutes: parseInt(process.env.NEWS_REFRESH_MINUTES || '60', 10),
    requestTimeoutMs: parseInt(process.env.NEWS_REQUEST_TIMEOUT_MS || '8000', 10),
  },

  // hetao-cli 数据源配置
  htcli: {
    bin: process.env.HETAO_CLI_BIN || 'hetao-cli',
    profile: process.env.HETAO_CLI_PROFILE || '',
    timeoutMs: parseInt(process.env.HETAO_CLI_TIMEOUT_MS || '30000', 10),
  },

  // 阿里云视觉智能（分割抠图）
  aliyun: {
    accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID || '',
    accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET || '',
    endpoint: 'imageseg.cn-shanghai.aliyuncs.com', // 视觉智能服务端点
  },

  // 阿里云百炼 / DashScope（语音合成、声音复刻）
  dashscope: {
    apiKey: process.env.DASHSCOPE_API_KEY || '',
    baseUrl: (process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/api/v1').replace(/\/+$/, ''),
  },

  // 阿里云 OSS（CosyVoice 复刻音频临时中转）
  oss: {
    region: process.env.OSS_REGION || 'oss-cn-beijing',
    bucket: process.env.OSS_BUCKET || 'nautilus-audio',
    prefix: process.env.OSS_PREFIX || 'nautilus/voice-lab/',
    signedUrlExpiresSeconds: parseInt(process.env.OSS_SIGN_URL_EXPIRES_SECONDS || '1800', 10),
    cleanupAfterClone: process.env.OSS_CLEANUP_AFTER_CLONE !== 'false',
  },
};
