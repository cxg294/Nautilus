# 🐚 Nautilus

> 万用工作台 — 模块化、跨平台、可扩展

## 技术栈

| 层级 | 技术 |
|:---|:---|
| 前端 | Vue 3 + NaiveUI (Soybean Admin) + UnoCSS |
| 后端 | Node.js + Express 5 |
| 数据库 | SQLite (better-sqlite3) |
| 认证 | JWT (Access + Refresh Token) |
| 包管理 | pnpm (Workspace) |

## 快速开始

> 本机推荐 Node.js `v20.19.0`，与 `better-sqlite3` 原生模块 ABI 保持一致。项目已通过 `.nvmrc` 和 `packageManager` 固定运行基线。

```bash
# 安装依赖
pnpm install

# 初始化数据库 & 播种
pnpm run db:seed

# 启动开发服务器（前后端同时启动）
pnpm run dev
```

默认管理员账号：`admin` / `admin123`

前端：http://localhost:9527  
后端：http://localhost:3000

## 本机诊断

```bash
pnpm run doctor
```

诊断会检查 Node/pnpm、better-sqlite3、SQLite 数据库、macOS LaunchAgent、前后端健康检查、AI 新闻接口、lark-cli 与 Git 工作区状态。

## 项目结构

```
nautilus/
├── src/                  # 前端源码 (Vue 3 + Soybean Admin)
│   ├── views/            # 页面
│   ├── store/            # Pinia 状态管理
│   ├── service/          # API 调用层
│   └── locales/          # 多语言
├── server/               # 后端源码 (Express)
│   ├── routes/           # 路由
│   ├── middleware/        # 中间件 (JWT 认证)
│   ├── services/         # 服务层
│   ├── db/               # 数据库 & Migration
│   └── config/           # 配置
├── infra/                # 基础设施
│   ├── memory-layer/     # AI 记忆系统
│   ├── feishu-bridge/    # 飞书集成 (计划中)
│   ├── ocr-daemon/       # OCR 服务 (计划中)
│   └── scraper/          # 爬虫服务 (计划中)
├── packages/             # 内部共享包
└── build/                # 构建配置
```

## 开发策略

采用「基建优先」策略 — 先搭框架和核心基础设施，再逐步接入业务模块。

## License

Private
