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

  // Gemini API
  geminiApiKey: process.env.GEMINI_API_KEY || '',




  // Material Studio 输出目录
  materialStudioOutput: path.resolve(__dirname, '../material-studio-output'),

  // 工具 API Key（AI Agent 调用鉴权）
  apiKey: process.env.NAUTILUS_API_KEY || 'naut-dev-key-change-me',

  // Qwen3 TTS Gradio 服务地址
  tts: {
    base: process.env.TTS_BASE_URL || 'http://10.64.128.6:8000',       // 声音克隆
    custom: process.env.TTS_CUSTOM_URL || 'http://10.64.128.6:8001',   // 角色语音
    design: process.env.TTS_DESIGN_URL || 'http://10.64.128.6:8002',   // 音色设计
  },

  // 阿里云视觉智能（分割抠图）
  aliyun: {
    accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID || '',
    accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET || '',
    endpoint: 'imageseg.cn-shanghai.aliyuncs.com', // 视觉智能服务端点
  },
};

