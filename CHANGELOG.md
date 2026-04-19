# Nautilus 更新日志

## [0.7.0] - 2026-05-13

### ⚠️ BREAKING CHANGE — 权限系统改造

> **@houna @ruoxi @wentao** 请在继续开发前执行下方「分支迁移步骤」。

#### 变更概要

1. **manifest.json 格式变更**（影响所有模块）
   - ❌ 移除：`"access": "guest" | "user" | "admin"` 字段
   - ✅ 新增：`"guestAccessible": true | false` 字段（放在 JSON 末尾）
   - 路由权限不再由前端 roles 双轨控制，统一为后端 `permission_key` 驱动

2. **character-generator 模块已删除**
   - 前后端代码全部移除（含 `server/routes/character-gen.js`、`server/services/character-gen.js`、`src/views/character-generator/` 整个目录）
   - DB migration `007_remove_character_generator.sql` 已包含

3. **AI 工具分类重命名**
   - `ai-tools` → `voice-tools`
   - 中文名：AI 工具 → 语音工具
   - 图标：`mdi:robot-outline` → `mdi:microphone-outline`

4. **路由核心改动**
   - `plugin-scanner.ts`：权限映射从 `accessRolesMap[access]` → `guestAccessible` + `permissionKey`
   - `route.ts` / `shared.ts` / `route/index.ts`：路由过滤逻辑更新
   - `router.d.ts`：新增 `permissionKey?: string` 类型声明

5. **新增后端中间件**
   - `server/middleware/requirePermission.js`：细粒度权限守卫
   - `server/services/permission-sync.js`：启动时自动注册模块权限到 DB

#### 分支迁移步骤

```bash
# 1. 切换到你的 test 分支
git checkout test-houna   # 或 test-ruoxi / test-wentao

# 2. 拉取最新 main
git fetch origin

# 3. 变基到最新 main（你的分支当前没有额外 commit，直接 reset 也可以）
git rebase origin/main

# 4. 如果你新建了模块，检查你的 manifest.json：
#    - 删除 "access" 字段
#    - 添加 "guestAccessible": false（或 true，如果无需登录可访问）
#    示例：
#    {
#      "name": "your-module",
#      "category": "your-category",
#      ...
#      "guestAccessible": false   ← 放在 JSON 最后
#    }

# 5. 确认无误后推送
git push origin test-houna --force-with-lease
```

#### manifest.json 新旧格式对照

```diff
 {
   "name": "btc-course-flow",
   "category": "data-dashboard",
   "icon": "mdi:swap-horizontal-bold",
   "order": 1,
   "categoryOrder": 5,
-  "access": "user",
   "locked": false,
   "i18n": { ... }
-}
+  },
+  "guestAccessible": false
+}
```

---

## [0.6.0] - 2026-05-03

### 🎬 新模块 — 序列脚本播放器 (Sequence Player)

教研"课堂 Galgame 引擎"——导入逐字稿后自动解析为可播放的课程序列。

- **脚本解析引擎**：规则式解析 `角色(造型)：台词`、`【停顿Ns】`、括号动作提示，自动发现角色并分配颜色
- **6 层播放器舞台**：背景层 + 角色占位/立绘层 + 字幕层（打字机效果）+ UI 控制层
- **播放器状态机**：idle → ready → playing/paused，支持自动步骤推进
- **浏览器 TTS 语音**：SpeechSynthesis 封装，支持语速/音调调节
- **播放控制**：播放/暂停/停止/上一步/下一步/点击跳转
- **步骤列表**：高亮跟随 + 角色颜色标记 + 自动滚动
- **键盘快捷键**：Space 播放/暂停、←→ 上/下一步、Esc 停止
- **设置面板**：5 种内置背景、打字速度、台词间停顿、语速
- **草稿保存**：localStorage 持久化
- **内置示例脚本**：一键加载演示

### 🎨 新模块 — 图标库浏览器 (Icon Explorer)

接入 Iconify 公共 API 的 200,000+ 开源图标搜索工具。

- **中文搜索**：内置 120+ 条中英翻译表（箭头→arrow、设置→settings…）
- **实时搜索**：300ms 防抖 + 防并发
- **分页加载**：每页 64 条 + 加载更多
- **图标集筛选**：左侧面板按集合过滤
- **5 种复制格式**：Iconify 名称、UnoCSS Class、Vue 组件、SVG URL、HTML img
- **搜索历史**：localStorage 持久化，最多 20 条
- **热门搜索建议**：15 个常用关键词一键触发

### 🔒 安全加固 — 后端权限中间件

- **TTS 路由**：挂载 `requireAuth + requirePermission('module:tts-studio:access')`
- **素材工坊路由**：挂载 `requirePermission('module:material-studio:access')`
- **抠图路由**：挂载 `requirePermission('module:image-matting:access')`
- **BTC 课程流路由**：挂载 `requirePermission('module:btc-course-flow:access')`

### 🔧 优化 — 用户管理 & 角色系统

- **后端动态化**：角色校验从硬编码 `['owner','user','guest']` 改为数据库动态查询
- **新增 API**：`GET /api/users/role-options` 返回可分配角色列表
- **前端 UI**：Tab → NTabs/NTabPane 组件化，角色切换 → NSelect 动态下拉
- **搜索筛选**：用户管理列表新增搜索过滤功能

## [0.4.0] - 2026-03-31

### 🏗️ 架构升级

- **用户认证体系重构**：后端 auth 路由 & user service 全面扩展，支持用户注册、角色鉴权、状态管理
- **数据库迁移**：新增 `002_user_status_and_permissions.sql`、`003_roles_table.sql`，完善用户权限与角色表结构
- **中间件层**：新增 `apiKey.js`（API Key 校验）、`requireRole.js`（角色权限守卫）
- **Vite 代理配置**：扩展 `vite.config.ts`，支持新增后端 API 路由的开发代理

### 🎨 前端 — 新模块

- **素材工作台 (Material Studio)**：AI 驱动的多阶段素材生成流水线（意图评估 → 风格引导 → 生成 → 元素分解 → 资产提取），包含 WelcomeInput、StyleGrid、GeneratingView、DecomposeView、ExtractView、ResultView 等组件
- **关卡工作室 (Level Studio)**：游戏关卡素材生成与编辑工具，支持 8 种预设风格（像素/水墨/赛博朋克等）、场景选择器、元素面板、局部重绘、导出面板
- **智能抠图 (Image Matting)**：基于阿里云图像分割 API 的一键抠图工具，含前后对比（ImageCompare）组件
- **TTS 工作室 (TTS Studio)**：文本转语音工具模块
- **用户管理 (User Manager)**：管理员用户列表、审批、创建、权限修改
- **角色管理 (Role Manager)**：系统角色的增删改查管理
- **权限守卫组件 (AuthGate)**：通用前端权限校验组件

### 🔧 前端 — 改进

- **登录页面重设计**：左右分屏布局（左侧动态 Slogan 动画 + 右侧精简登录表单），移除短信/验证码登录与管理员测试登录按钮
- **注册页面优化**：表单交互与校验流程完善
- **AI 资讯模块 (AI News Feed)**：接入飞书多维表格动态数据源，替换硬编码内容，支持每日自动刷新
- **路由系统**：`plugin-scanner.ts` 增强插件视图自动发现与映射；`routes.ts`、`imports.ts`、`transform.ts` 同步更新以支持新模块

### 🖥️ 后端 — 新增

- **路由层**：`news.js`（飞书 AI 资讯）、`image-matting.js`（抠图代理）、`level-studio.js`（关卡工作室）、`material-studio.js`（素材工作台）、`tools.js`（轻量工具 Skill API）、`users.js`（用户管理）、`roles.js`（角色管理）
- **服务层**：`gemini.js`（Gemini AI 调用）、`material-gen.js`（素材生成编排）、`aliyun-imageseg.js`（阿里云图像分割）、`image-processor.js`（图像后处理）、`role.js`（角色业务逻辑）

### 📄 文档 & 基础设施

- **架构文档**：新增 `docs/nautilus-arch.json`、`docs/nautilus-arch.png` — 系统架构图
- **项目记忆**：更新 `_project.md` 语义记忆文档
- **环境变量**：`.env.example` 补充新增服务所需配置项
- **依赖更新**：`package.json` & `pnpm-lock.yaml` 新增后端服务依赖

---

> **统计**：26 个文件修改（+1949 / -183 行），约 40 个新文件
