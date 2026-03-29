---
description: 创建新的业务模块
---
// turbo-all

# 创建新模块

标准化的新模块创建流程，确保每个模块结构一致。项目已从原始脚手架迁移到 **Soybean Admin**（Vue3 + NaiveUI + Elegant Router）。

## 前提知识

- 前端使用 Soybean Admin 框架，路由由 **Elegant Router** 管理（非 vue-router 直注册）
- 路由注册需要同时修改 **3 个文件**（类型声明 + 路由表 + 视图导入）
- 多语言需要同时修改 **3 个文件**（类型声明 + 中文 + 英文）
- 后端路由挂载在 `server/index.js`，所有 API 以 `/api/` 开头（Vite 代理到 3000 端口）

## 步骤

1. 确认模块名称（英文 kebab-case，如 `video-frame-extractor`）

2. **注册 Elegant Router 类型** — `src/typings/elegant-router.d.ts`：
   - 在 `RouteMap` 中添加路由路径映射
   - 在 `FirstLevelRouteKey` 中添加路由 key
   - 在 `LastLevelRouteKey` 中添加路由 key

3. **注册路由表** — `src/router/elegant/routes.ts`：
   ```typescript
   {
     name: '<模块名>',
     path: '/<模块路径>',
     component: 'layout.base$view.<模块名>',
     meta: {
       title: '<模块名>',
       i18nKey: 'route.<模块名>',
       icon: 'mdi:<图标名称>',
       order: <排序数字>
     }
   },
   ```

4. **注册视图导入** — `src/router/elegant/imports.ts`：
   ```typescript
   "<模块名>": () => import("@/views/<模块名>/index.vue"),
   ```

5. **创建前端页面目录**：
   ```
   src/views/<模块名>/
   ├── index.vue               ← 主页面
   ├── components/             ← 模块内部组件（可选）
   └── composables/            ← 组合式函数（可选）
   ```

6. **添加多语言翻译**：
   - `src/typings/app.d.ts` → 在 `Schema.page` 中添加模块类型声明
   - `src/locales/langs/zh-cn.ts` → 在 `route` 和 `page` 中添加中文
   - `src/locales/langs/en-us.ts` → 在 `route` 和 `page` 中添加英文

7. 如果模块需要后端 API：
   - 在 `server/routes/` 创建路由文件
   - 在 `server/index.js` 中 `app.use('/api/<模块>', <路由>)` 挂载
   - 在 `src/service/api/` 创建前端 API 调用文件

8. 如果模块需要数据库表：
   - 在 `server/db/migrations/` 创建新的 migration SQL 文件（编号递增，如 `003_xxx.sql`）
   - 运行 `pnpm run db:migrate`

9. 运行 `pnpm dev` 验证模块正常加载

## 参考模块

- `video-frame-extractor` — 第一个业务模块，纯前端实现（无后端），可作为模板参考
