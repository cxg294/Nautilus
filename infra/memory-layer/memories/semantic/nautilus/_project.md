# Nautilus 项目记忆

> 此文件包含 Nautilus 万用工作台项目的架构决策和关键事实。
> 当工作上下文为 Nautilus 项目时加载。

---

## 项目概况

- **名称**: Nautilus — 个人万用工作台
- **版本**: v0.2.0
- **目标**: 模块化、跨平台、可扩展的个人生产力工作台
- **设计主题**: 深海 / 鹦鹉螺号（深海蓝绿色调 + 琥珀色强调）

---

## 技术栈

| 层面 | 选型 | 决策理由 |
|:---|:---|:---|
| 前端框架 | Vue 3 + NaiveUI (Soybean Admin) + UnoCSS | 成熟模板，开箱即用 |
| 状态管理 | Pinia | Vue 3 官方推荐 |
| 路由 | Elegant Router | Soybean Admin 内置，自动类型推导 |
| 后端框架 | Express 5 | 轻量、生态成熟 |
| 数据库 | better-sqlite3 + WAL 模式 | 零服务依赖，读写性能好 |
| 认证方案 | JWT 双 Token（access 15min + refresh 7d） | 安全性与体验平衡 |
| 权限模型 | RBAC（owner / user / guest） | 简单有效 |

---

## 项目结构

```
nautilus/
├── src/                  # 前端源码 (Soybean Admin)
│   ├── views/            # 页面（按模块组织）
│   ├── store/modules/    # Pinia 状态管理
│   ├── service/api/      # API 调用层
│   ├── router/elegant/   # Elegant Router（routes.ts + imports.ts）
│   ├── locales/langs/    # 多语言（zh-cn / en-us）
│   └── typings/          # 类型声明（elegant-router.d.ts / app.d.ts）
├── server/               # 后端（Express 5）
│   ├── config/           # 环境配置
│   ├── db/               # 数据库 + migration
│   ├── middleware/       # 中间件（JWT）
│   ├── routes/           # API 路由
│   └── services/         # 业务服务
├── infra/                # 基建服务
│   ├── memory-layer/     # 多层级记忆系统
│   ├── feishu-bridge/    # 飞书通信桥接（待开发）
│   ├── ocr-daemon/       # OCR 服务（待开发）
│   └── scraper/          # 爬虫服务（待开发）
├── packages/             # 内部共享包（8个）
└── build/                # 构建配置
```

### Elegant Router 注册要点

新增页面需同时修改 3 类文件，详见 `.agents/workflows/new-module.md`：
1. **类型声明** `src/typings/elegant-router.d.ts` — RouteMap + FirstLevelRouteKey + LastLevelRouteKey
2. **路由表** `src/router/elegant/routes.ts` — 路由对象
3. **视图导入** `src/router/elegant/imports.ts` — 懒加载 import
4. **i18n 类型** `src/typings/app.d.ts` — Schema.page 中添加字段

---

## 当前进度

### 已完成
- Phase 0: 脚手架搭建（前后端框架、DB schema、种子数据）
- Phase 0.5: 前端迁移到 Soybean Admin（Vue3 + NaiveUI + Elegant Router）
- Phase 1: 认证系统（JWT 双 Token、前后端对接、路由守卫）
- 四层记忆系统协议与目录结构
- 新模块创建工作流 `/new-module`（已更新到 Soybean Admin 版本）
- 第一个业务模块：视频抽帧工具

### 待推进
- Phase 2a: 记忆层 API（将 Markdown 记忆暴露为 CRUD API）
- Phase 2b: 飞书 Webhook 桥接
- 部署配置（Docker / PM2）
- 单元测试框架（Vitest）

---

## 业务模块规划

| 模块 | 状态 |
|:---|:---|
| 🎬 视频抽帧工具 | ✅ 已完成 |
| 🎮 SB3 批处理工作台 | 待开发 |
| 🧠 认知卸载 | 待开发 |
| 🎨 素材生成器 | 待开发 |
| 📊 课程数据处理 | 待开发 |
| 🐕 柴犬集合站 | 待开发 |
| 📝 逐字稿审查器 | 待开发 |
