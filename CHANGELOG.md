# Nautilus 更新日志

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
