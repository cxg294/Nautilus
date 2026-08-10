import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './config/env.js';
import { runMigrations } from './db/index.js';
import { syncToolPermissions } from './services/permission-sync.js';
import authRoutes from './routes/auth.js';

import userRoutes from './routes/users.js';
import roleRoutes from './routes/roles.js';
import newsRoutes from './routes/news.js';
import toolsRoutes from './routes/tools.js';
import { requireApiKey } from './middleware/apiKey.js';
import imageMattingRoutes from './routes/image-matting.js';
import analyticsRoutes from './routes/analytics.js';
import systemSettingsRoutes from './routes/system-settings.js';
import midPriceCourseRoutes from './routes/mid-price-course.js';
import voiceLabRoutes from './routes/voice-lab.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// === 安全中间件 ===
// Security Headers（X-Content-Type-Options, X-Frame-Options, HSTS 等）
app.use(helmet({
  contentSecurityPolicy: false, // 前端 SPA 需要内联脚本，暂不启用 CSP
}));

// CORS 白名单（从 ALLOWED_ORIGINS 环境变量读取，逗号分隔）
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:9527')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

function isAllowedDevOrigin(origin) {
  if (!config.isDev) return false;

  try {
    const url = new URL(origin);
    if (url.protocol !== 'http:' || url.port !== '9527') return false;

    const host = url.hostname;
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '[::1]' ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) ||
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host) ||
      /^198\.(18|19)\.\d{1,3}\.\d{1,3}$/.test(host)
    );
  } catch {
    return false;
  }
}

app.use(cors({
  origin(origin, callback) {
    // 允许非浏览器请求（如 curl、Postman）和白名单域名
    if (!origin || allowedOrigins.includes(origin) || isAllowedDevOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS 拒绝来源: ${origin}`));
    }
  },
  credentials: true,
}));

// 登录接口速率限制：15 分钟内最多 15 次
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: '4029', msg: '登录尝试过于频繁，请 15 分钟后重试', data: null },
});

// 请求体大小限制
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// === 数据库初始化 ===
runMigrations();

// === 权限同步：扫描 manifest.json 自动注册工具权限 ===
syncToolPermissions();

// === API 路由 ===
// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    name: 'Nautilus',
    version: '0.2.0',
    timestamp: new Date().toISOString(),
  });
});

// 认证路由（登录接口附加速率限制）
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/register', loginLimiter);
app.use('/api/auth', authRoutes);

// 用户管理路由
app.use('/api/users', userRoutes);

// 角色/权限管理路由
app.use('/api/roles', roleRoutes);

// 新闻路由（公开，无需鉴权）
app.use('/api/news', newsRoutes);



// 工具 API（AI Agent 调用，API Key 鉴权）
app.use('/api/tools', requireApiKey, toolsRoutes);

// 阿里云分割抠图功能
app.use('/api/image-matting', imageMattingRoutes);

// 埋点分析
app.use('/api/analytics', analyticsRoutes);

// 中价课课程看板
app.use('/api/mid-price-course', midPriceCourseRoutes);

// 语音合成与声音复刻
app.use('/api/voice-lab', voiceLabRoutes);

// 系统设置（代理配置等）
app.use('/api/system-settings', systemSettingsRoutes);


// === 生产模式：提供前端静态文件 ===
if (!config.isDev) {
  const clientDist = path.resolve(__dirname, '../client/dist');
  app.use(express.static(clientDist));

  // SPA 回退：所有非 API 路由返回 index.html
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(clientDist, 'index.html'));
    }
  });
}

// === 全局错误处理（隐藏内部错误细节） ===
app.use((err, req, res, _next) => {
  console.error('[Global Error]', err);
  const message = config.isDev ? err.message : '服务器内部错误';
  res.status(err.status || 500).json({ code: '5000', msg: message, data: null });
});

// === 启动服务器 ===
app.listen(config.port, () => {
  console.log(`
  🐚 Nautilus 服务器已启动
  ├── 端口: ${config.port}
  ├── 环境: ${config.isDev ? '开发' : '生产'}
  └── 数据库: ${config.dbPath}
  `);
});

export default app;
