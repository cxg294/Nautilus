---
description: 创建新的业务模块
---
// turbo-all

# 创建新模块（插件化架构）

标准化的新模块创建流程。项目使用 **插件化架构**，新工具只需在自己目录内创建文件，**无需修改任何全局共享文件**。

## 核心原则

- 工具开发者**只动自己的目录**，不碰 routes.ts、imports.ts、elegant-router.d.ts 等全局文件
- 路由、菜单、i18n 全部通过 `manifest.json` 声明，系统自动扫描注册
- 框架使用 Soybean Admin（Vue3 + NaiveUI），路由由 Elegant Router + 插件扫描器管理

## 步骤

1. 确认模块名称（英文 kebab-case，如 `my-new-tool`）

2. **创建模块目录和清单文件** — `src/views/<模块名>/manifest.json`：
   ```json
   {
     "name": "<模块名>",
     "category": "<分类名>",
     "icon": "mdi:<图标名>",
     "order": 1,
     "categoryOrder": 10,
     "access": "guest",
     "locked": false,
     "i18n": {
       "zh-CN": {
         "route": "中文名称",
         "category": "分类中文名",
         "categoryIcon": "mdi:<分类图标>"
       },
       "en-US": {
         "route": "English Name",
         "category": "Category Name",
         "categoryIcon": "mdi:<category-icon>"
       }
     }
   }
   ```
   
   **字段说明：**
   - `name`：必须与目录名一致
   - `category`：分类标识（相同 category 的工具自动归为一组）
   - `icon`：Iconify 格式图标
   - `order`：在分类内的排列顺序
   - `categoryOrder`：分类在侧边栏中的排列顺序
   - `access`：权限级别（`guest` / `user` / `admin`）
   - `locked`：是否为锁定占位工具

3. **创建主页面** — `src/views/<模块名>/index.vue`

4. **创建子目录**（可选）：
   ```
   src/views/<模块名>/
   ├── manifest.json           ← 必须：模块声明
   ├── index.vue               ← 必须：主页面
   ├── components/             ← 可选：模块内部组件
   └── composables/            ← 可选：组合式函数
   ```

5. 如果模块需要页面级别的 i18n 文案（如表单、按钮文字等），仍需添加到全局 locale 文件：
   - `src/locales/langs/zh-cn.ts` → 在 `page` 中添加中文
   - `src/locales/langs/en-us.ts` → 在 `page` 中添加英文
   - `src/typings/app.d.ts` → 在 `Schema.page` 中添加类型声明

6. 如果模块需要后端 API：
   - 在 `server/routes/` 创建路由文件
   - 在 `server/index.js` 中 `app.use('/api/<模块>', <路由>)` 挂载
   - 在 `src/service/api/` 创建前端 API 调用文件

7. 如果模块需要数据库表：
   - 在 `server/db/migrations/` 创建新的 migration SQL 文件（编号递增，如 `003_xxx.sql`）
   - 运行 `pnpm run db:migrate`

8. 运行 `pnpm dev` 验证模块正常加载

## ⚡ 最小可用模块示例

只需 2 个文件即可创建一个可运行的模块：

**manifest.json:**
```json
{
  "name": "hello-world",
  "category": "misc-shop",
  "icon": "mdi:hand-wave",
  "order": 10,
  "categoryOrder": 4,
  "access": "guest",
  "locked": false,
  "i18n": {
    "zh-CN": { "route": "Hello World", "category": "杂货铺", "categoryIcon": "mdi:toolbox-outline" },
    "en-US": { "route": "Hello World", "category": "Misc Shop", "categoryIcon": "mdi:toolbox-outline" }
  }
}
```

**index.vue:**
```vue
<template>
  <div class="p-4">
    <h1>Hello World!</h1>
  </div>
</template>
```

## 现有分类参考

| 分类标识 | 中文名 | categoryOrder |
|---------|--------|---------------|
| image-tools | 图片工具 | 2 |
| sb3-graphical | SB3 图形化 | 3 |
| misc-shop | 杂货铺 | 4 |
| data-dashboard | 数据看板 | 5 |
| copywriting | 文案创意 | 6 |

新建分类只需在 manifest.json 中使用新的 category 值即可，系统会自动创建分类。

## 参考模块

- `image-compressor` — 纯前端实现，附带 manifest.json，可作为模板参考
- `timestamp-converter` — 简单工具模板
