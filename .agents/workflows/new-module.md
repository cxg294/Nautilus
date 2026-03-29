---
description: 创建新的业务模块
---
// turbo-all

# 创建新模块

标准化的新模块创建流程，确保每个模块结构一致。

## 步骤

1. 确认模块名称（英文 kebab-case，如 `sb3-workbench`）

2. 在前端创建模块目录和入口文件：
   ```
   client/src/modules/<模块名>/
   ├── <模块名>View.vue     ← 主页面
   └── components/           ← 模块内部组件（可选）
   ```

3. 在 `client/src/router/index.js` 中添加路由：
   ```javascript
   {
     path: '/<模块路径>',
     name: '<模块名>',
     component: () => import('@/modules/<模块名>/<ModuleName>View.vue'),
     meta: { title: '模块中文名', icon: '🔧', requiresAuth: true },
   }
   ```

4. 在 `client/src/stores/app.js` 的 `modules` 数组中注册模块信息

5. 如果模块需要后端 API，在 `server/routes/` 创建路由文件，在 `server/index.js` 中挂载

6. 如果模块需要数据库表，在 `server/db/migrations/` 创建新的 migration SQL 文件（编号递增）

7. 运行 `npm run dev` 验证模块是否正常加载
