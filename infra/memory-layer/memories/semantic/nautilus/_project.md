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

### 插件化模块注册（2026-03-31 改造完成）

新增工具**只需在自己目录内创建 2 个文件**，无需修改任何共享文件：
1. `src/views/<工具名>/manifest.json` — 声明路由、图标、分类、i18n
2. `src/views/<工具名>/index.vue` — 页面组件

核心机制：`src/router/plugin-scanner.ts` 利用 Vite 的 `import.meta.glob()` 在编译时扫描所有 `manifest.json`，自动生成路由配置、视图导入映射和 i18n 数据。

详见 `.agents/workflows/new-module.md`

> ⚠️ 工具内部的 page 翻译（如 `page.imageCompressor.xxx`）仍在全局 locale 文件中，后续 Phase 2 迁移

---

## 当前进度

### 已完成
- Phase 0: 脚手架搭建（前后端框架、DB schema、种子数据）
- Phase 0.5: 前端迁移到 Soybean Admin（Vue3 + NaiveUI + Elegant Router）
- Phase 1: 认证系统（JWT 双 Token、前后端对接、路由守卫）
- 四层记忆系统协议与目录结构
- 新模块创建工作流 `/new-module`（已更新到 Soybean Admin 版本）
- 第一个业务模块：视频抽帧工具
- 第二个业务模块：SB3 积木分析工作台（V6，含 8 项分析功能 + 跨面板导航）
- 首页及公开工具支持游客免登录访问
- 飞书 CLI 集成基础设施（Lark CLI v1.0.0 安装 + 19 个 AI Skills 安装 + Bot 身份配置）
- 插件化架构改造（2026-03-31）：manifest.json 自注册 + plugin-scanner.ts 编译时扫描，新增工具零共享文件修改
- 导航重构：图片工具(4) / SB3 图形化(2) / 杂货铺(3) / 数据看板(2) / 文案创意(3) 五大分类
- 图片压缩工具、特效生成器（含 GIF 录制）、SB3 压缩、时间戳转换、Base64 转换、二维码生成
- 5 个锁定占位工具（BTC 课程流转、BTC 课中数据、逐字稿审查、逐字稿生成、素材工作室）
- TTS Studio（语音合成工作台，已接入 Qwen3 TTS）
- 用户管理与角色管理后台
- 首页重构：动态 Dashboard（天气预报 + 快捷入口 + AI 新闻 + 更新日志）

### 进行中
- 认知卸载机制设计（`认知卸载机制设计方案.md`，方案阶段，待验证）
  - 三路数据采集：截屏+元数据、Webhook 灵感捕捉、多维表格会议记录
  - 处理链路：本地 OCR → 三路合流 → Gemini 生成日报/周报
  - Limitless (Rewind) 已否决（2026-03-30），全面转向完全自研

### 待推进
- 插件化 Phase 2：将工具内部 page 翻译迁移到工具目录内
- CI/CD：manifest.json schema 校验 + pre-commit hook
- Phase 2a: 记忆层 API（将 Markdown 记忆暴露为 CRUD API）
- Phase 2b: 飞书桥接（Lark CLI Bot 身份已就绪，可对接消息通知、多维表格等）
- 认知卸载 MVP：macOS Vision OCR 验证 → 截屏守护进程 → SQLite 日志存储 → AI 分析管道
- 部署配置（Docker / PM2）
- 单元测试框架（Vitest）
- **AI 集成（远期）**: 双轨架构，详见下方「AI 集成架构决策」章节

---

## AI 集成架构决策（2026-03-31 确定）

> Nautilus 能力最终要暴露给 AI Agent 调用。此章节记录架构层面的设计决策。

### 核心决策：双轨制

| 轨道 | 适用场景 | 协议 | 状态管理 |
|:---|:---|:---|:---|
| **REST API / MCP** | 轻量工具 + CRUD 操作 | HTTP 无状态 | 无状态（传参→拿结果） |
| **独立 Agent Skill** | 重交互/本地文件操作（如 SB3） | 本地脚本 | Agent 自行管理 |

### 轨道 1：无状态 API（所有轻量能力）

适用模块：图片压缩、视频抽帧、特效生成、Base64 转换、QR码生成、时间戳转换、TTS 语音合成、素材工作室 CRUD、脚本审核、用户/角色管理

- 每个操作一个 endpoint / MCP tool
- 完全无状态：输入 → 处理 → 输出，无需 session
- 复合工作流（素材工作室、脚本审核）也拆为原子操作，AI 自行编排调用顺序
- REST API 是底座，MCP 是 AI 友好的包装层

### 轨道 2：本地 Agent Skill（重交互模块）

适用模块：SB3 积木分析/编辑（文件大、多步操作、需要项目上下文）

- 以 `.agents/skills/sb3-studio/` 形式提供，类似现有 `lark-*` skills
- Agent 直接在本地文件系统操作，不走网络
- 包含解析、分析、修改、导出等脚本

### 排除决策

- SB3 相关操作 **不走 API**：文件大、操作链长、天然适合本地处理
- **不做 Session 模式**：排除 SB3 后，剩余操作均为单次请求可完成，无需会话状态

### 待定事项

- 认证：AI 调用时用专用 bot 用户还是代替当前用户（影响权限和审计）
- 文件传递：二进制文件用临时 URL 引用还是 Base64 内联（倾向 URL 引用）
- MCP 包装层的具体实现时机

---

## 飞书 CLI 集成

- **工具**: `@larksuite/cli` v1.0.0（2026-03-28 发布）
- **应用 ID**: `cli_a993f6f82838dcb4`
- **身份**: ⚠️ **始终使用 Bot（tenant）身份**（`--as bot`），不使用 user 身份
- **AI Skills**: 19 个已安装到 `.agents/skills/lark-*`
- **权限清单**: 详见 `.agents/lark-cli-scopes.json`
- **Bot 可用能力**: 多维表格 CRUD、日历管理、通讯录读取、文档读写、消息收发、电子表格操作、任务管理、知识库管理、会议/录制查询
- **多设备**: Windows + Mac 均已配置（`lark-cli config init --app-id ... --brand feishu`）
- **测试群**: `教研助手测试群` chat_id = `oc_c649c785ed30ccac6ce3c20f494329f7`
- **知识库 Nautilus 节点**: `https://wrpnn3mat2.feishu.cn/wiki/TTs4wvu6SiR4TGkZkluco4ZBn7c`（wiki_node = `TTs4wvu6SiR4TGkZkluco4ZBn7c`）

### Windows 平台调用注意事项

> ⚠️ **PowerShell JSON 转义坑**: 在 PowerShell 中直接传含嵌套双引号的 JSON 给 lark-cli 会导致参数被拆分（`Error: accepts 2 arg(s), received 14`）。

**解决方案**: 使用 Node.js `execFileSync` + 参数数组，直接调用 lark-cli 的 `run.js` 入口，完全绕过 shell 解析：

```javascript
const { execFileSync } = require('child_process');
const runJs = 'C:\\Users\\20342\\AppData\\Roaming\\npm\\node_modules\\@larksuite\\cli\\scripts\\run.js';
const result = execFileSync(process.execPath, [
  runJs, 'api', 'POST', '/open-apis/im/v1/messages',
  '--params', JSON.stringify({ receive_id_type: 'chat_id' }),
  '--data', JSON.stringify({ receive_id: 'oc_xxx', msg_type: 'text', content: '...' }),
  '--as', 'bot'
], { encoding: 'utf-8', timeout: 15000 });
```

- **关键**: 用 `process.execPath`（node）执行 `run.js`，不用 `.cmd` wrapper（`.cmd` 在 `execFileSync` 中会 `EINVAL`）
- **lark-cli 全局路径**: `C:\Users\20342\AppData\Roaming\npm\lark-cli.cmd`
- **run.js 入口**: `C:\Users\20342\AppData\Roaming\npm\node_modules\@larksuite\cli\scripts\run.js`
- **简单查询命令**（如 `lark-cli config show`、`lark-cli doctor`）在 PowerShell 中可直接运行，只有传复杂 JSON 时需要绕过

---

## 业务模块规划

| 模块 | 分类 | 状态 |
|:---|:---|:---|
| 🖼️ 图片压缩 | image-tools | ✅ 已完成 |
| 🎬 视频抽帧 | image-tools | ✅ 已完成 |
| ✨ 特效生成器 | image-tools | ✅ 已完成（含 GIF 录制） |
| 🎨 素材工作室 | image-tools | 🔒 锁定占位（原名「案例设计」，已更名） |
| 🧩 SB3 积木分析 | sb3-graphical | ✅ 已完成（V6） |
| 📦 SB3 压缩 | sb3-graphical | ✅ 已完成 |
| ⏱️ 时间戳转换 | misc-shop | ✅ 已完成 |
| 🔤 Base64 转换 | misc-shop | ✅ 已完成 |
| 📱 二维码生成 | misc-shop | ✅ 已完成 |
| 🗣️ TTS Studio | misc-shop | ✅ 已接入 Qwen3 TTS |
| 📊 BTC 课程流转数据 | data-dashboard | 🔒 锁定占位 |
| 📈 BTC 课中数据 | data-dashboard | 🔒 锁定占位 |
| 📝 逐字稿审查 | copywriting | 🔒 锁定占位 |
| 📝 逐字稿生成 | copywriting | 🔒 锁定占位 |
| 🧠 认知卸载 | — | 📐 方案设计中 |

---

## SB3 积木分析工作台

- **路径**: `src/views/sb3-studio/`
- **前身**: sb3-batch-studio（开发者视角的批处理工具），现重构为场景化分析平台
- **对标项目**: cubetest（已废弃，cxg294.github.io/cubetest/dist/）
- **四 Tab 布局**: 项目总览 / 素材管理 / 变量与广播 / 逻辑分析
- **核心架构**:
  - `composables/use-sb3-project.ts` — 全局状态 + 跨面板导航（navigationTarget）
  - `core/sb3Parser.js` — SB3 zip 解包 + assets Map
  - `core/analyzer.js` — 变量/广播统计
  - `core/blockConverter.js` — 积木→文本转换 + extractOrphans + extractReferencedResources
- **已实现功能**:
  1. 深度搜索（文本/Opcode 双模式 + 角色过滤 + 高亮）
  2. 引用资源分析（变量 R/W 计数 + 广播收发链路）
  3. 孤立积木检测（橙色警告展示）
  4. 脚本变量/广播过滤器
  5. 变量管理（重命名 + 删除无效变量 + 广播改名）
  6. 积木行号 + 分类 Badge（颜色对应 Scratch 积木类别）
  7. 素材预览（造型图片缩略图、声音真实播放）+ 替换（内存级文件上传）
  8. 广播→脚本跨面板跳转（DataPanel 点击 → index.vue Tab 切换 → SpritePanel 角色选择+过滤）
- **MermaidRenderer**: 流程图渲染组件，已添加 `suppressErrorRendering: true`
