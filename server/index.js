import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './config/env.js';
import db, { runMigrations } from './db/index.js';
import authRoutes from './routes/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// === 中间件 ===
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// === 数据库初始化 ===
runMigrations();

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

// 认证路由
app.use('/auth', authRoutes);

// TODO: Phase 2 - 用户管理路由
// app.use('/api/users', userRoutes);

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
