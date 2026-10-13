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

### 本机开发基线（2026-07-01）

- Node.js 固定为 `v20.19.0`（`.nvmrc`），避免 `better-sqlite3` 与 Node 22/23 ABI 不兼容
- pnpm 固定为 `10.33.0`（`packageManager`），避免 Corepack 自动注入 pnpm 11 造成环境漂移
- 本机健康检查命令：`pnpm run doctor`
- 诊断覆盖：Node/pnpm、`better-sqlite3`、SQLite、macOS LaunchAgent、前后端健康检查、AI 新闻接口、`lark-cli`、Git 工作区状态

### UI 组件规范（强制）

> ⚠️ **所有页面必须使用 NaiveUI 标准组件**，严禁手写原生 HTML 替代已有组件。
> NaiveUI 通过 `unplugin-vue-components` + `NaiveUiResolver` 实现**模板内自动导入**，无需 import。
> 仅在 render 函数中使用时需要显式 `import { NButton, NTag, ... } from 'naive-ui'`。

#### 组件对照表

| 场景 | ✅ 使用 | ❌ 禁止 |
|:---|:---|:---|
| 按钮 | `<NButton>` | `<button class="xxx">` |
| 下拉选择 | `<NSelect>` | `<select>` |
| 标签/徽章 | `<NTag>` | `<span class="chip">` |
| 卡片容器 | `<NCard>` | `<div class="card">` |
| 数据表格 | `<NDataTable>` | `<table>` |
| Tab 切换 | `<NTabs>` + `<NTabPane>` | `<button class="tab">` |
| 弹窗/抽屉 | `<NModal>` / `<NDrawer>` | 自定义弹窗 |
| 间距布局 | `<NSpace>` | `<div style="gap:...">` |
| 输入框 | `<NInput>` | `<input>` |
| 复选框 | `<NCheckbox>` | `<input type="checkbox">` |
| 加载状态 | `<NSpin>` | 自定义 loading |
| 提示消息 | `useMessage()` | `alert()` |

#### 暗色模式适配

- **NaiveUI 组件**：自动适配（`App.vue` 中 `NConfigProvider` + `darkTheme` 控制）
- **自定义样式**：使用 `.dark .xxx` 选择器覆盖（`DARK_CLASS = 'dark'`，挂在 `<html>` 上）
- **UnoCSS**：使用 `dark:` 前缀（如 `class="bg-white dark:bg-dark"`）
- **ECharts**：需手动监听 darkMode 切换背景色和文字色

#### 样式优先级

1. NaiveUI 组件（自带暗色适配） → 2. UnoCSS 原子类（`dark:` 前缀） → 3. Scoped CSS（`.dark .xxx`）

#### 页面空间感

- 新增业务页面必须延续首页/框架的空间感：首屏应有清晰页眉、适度留白、分区节奏和主次层级，避免把所有控件压成局促的小面板。
- 工作台类页面优先使用 hero/概览区 + 主工作区 + 辅助侧栏/指标带的组合；表格和表单应服务于任务流程，而不是占满首屏成为唯一视觉主体。
- 2026-07-02 复盘：不要用“加一个统一 hero/指标卡外壳”替代空间感优化。真正的空间感要从页面内部工作流入手：默认/高级控件分层、主工作区比例、次要信息折叠、列表/表格密度、空状态与结果态切换、移动端任务顺序。
- 沉浸式工具页（画布、播放器、IDE/分析器）可以保持工具型密度，但必须明确哪块该紧凑、哪块该留白；先评估使用场景和操作频次，再动布局。

#### 标准页面参考

- `src/views/role-manager/index.vue` — NDataTable + NButton + NTag 组合
- `src/views/sb3-studio/components/DataPanel.vue` — NTabs + NDataTable
- `src/views/sb3-studio/components/LogicPanel.vue` — NSelect + NDataTable + NTag

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
- 导航重构：图片工具 / SB3 图形化 / 杂货铺 / 数据看板 / 文案创意 / 常用网站 / 系统管理
- 图片压缩工具、图片/GIF 去背景、特效生成器（含 GIF 录制）、SB3 压缩、时间戳转换、Base64 转换、二维码生成、逐字稿播放器、正则规则工作台
- 图片/GIF 去背景（2026-07-01）：静态图走阿里云 `SegmentCommonImage` 通用分割；GIF 因供应商不直接支持，后端使用 `modern-gif` 解码、`sharp` 逐帧转 PNG 调阿里云、再重新编码为 GIF。服务端硬限制最多 30 帧，本地结果通过鉴权 `/api/image-matting/output/:file` 提供预览与下载。
- 模块裁剪（2026-07-01）：素材生成工作台、旧语音工具、逐字稿审查/生成/案例设计占位已移除；逐字稿播放器移动到文案创意分类
- 语音合成字级时间轴（2026-08-31）：当前 `voice-lab` 使用百炼 `cosyvoice-v3.5-flash`。复刻音色合成已改为 HTTP SSE 输出并开启 `word_timestamp_enabled`，接口随音频返回供应商无关的 `alignment`（毫秒、句子、字/词、原句内索引与起止时间），页面支持导出 `.alignment.json`；设计音色因官方未明确保证时间戳，继续走非流式合成。真实 4 字验证返回四个汉字时间段及百炼自动补入的句号时间段，后续卡拉 OK 字幕应按原文索引映射，自动标点按不可见/停顿 token 处理。
- 语音使用统计（2026-09-28）：成功调用 `/api/voice-lab/synthesize` 后由服务端写入 `analytics_events`，`meta.recordedBy=server`、`meta.voice`、`model`、`characters`、`requestId`、`origin`；逐字稿工坊使用同一接口并标记 `origin=sequence-player`。音色试听以独立 `audition` 动作记录，音色库展示按音色聚合的新统计。旧的 613 条前端“合成成功”事件不含音色 ID，历史逐音色次数不可还原；统计必须明确标注只覆盖新埋点上线后。
- 音色列表与去重（2026-09-28）：本地没有音色存储数量配额；百炼 `list_voice` 单页默认请求 100 条，接口最大单页 100 条，语音合成页和逐字稿工坊会分页拉取全部音色。当前云端 73 个音色中有 14 组“同类别、同显示名、不同 ID”的版本，共涉及 48 个音色；仅凭名称不能判断声学重复。候选明细保存在 `/Users/chenxinguang/Documents/nautilus/reports/语音合成重复音色候选-2026-09-28.md`，去重前须保留现存项目引用的完整音色 ID。
- 逐字稿播放器（2026-07-03）：后续能力围绕“飞书链接/Word/纯文本 -> 序列 JSON -> 播放器”推进。标准序列格式记录在 Obsidian `逐字稿播放器-序列JSON格式.md`，代码中已扩展 `SequenceProject`/`Step` 支持 `source`、`assets`、`stage`、`display`、`audio`、`sourceRef` 等字段，并支持前端导入/导出序列 JSON。语音字段保持供应商无关，只抽象为 `none | browser | external`、`voiceId`、`provider`；不要把 Fish、Edge 或任何具体服务写死进核心格式。页面结构基线已调整为顶部项目命令栏 + 左侧逐字稿/步骤列表 + 右侧舞台预览/控制区，后续角色库、舞台管理、飞书导入都应在这个结构上增量扩展，避免回到窄侧栏堆 tiny 图标按钮的低可读布局。当前“舞台与角色”抽屉已具备基础管理：舞台尺寸/比例/最大高度、左右角色位置、右侧翻转、字幕字号/宽度、播放节奏；角色显示名、颜色、左/右站位、缩放、TTS 抽象配置、造型增删和默认造型。舞台配置保存到 JSON 顶层 `stage`，服务器项目兼容放在 `settings.stage`。
- 正则规则工作台（2026-07-01）：`regex-workflow` 归入「文案创意」，纯前端提供 AI 提示词复制、JSON 导入/合并、N/Y 规则编辑、平台顺序模拟测试、提示语维护与 `noticeDict/front_end_code` JS 预览下载；设计上使用宽松工作台首屏，避免二级工具页过度紧凑。
- 工具页空间感复盘（2026-07-02）：上一轮统一外壳方案已回滚。后续先盘每个页面的内部布局密度和工作流，再针对性优化，不再默认抽象统一壳。
- BTC 课程进量看板正式版（2026-07-02）：`btc-course-volume` 已从占位/POC 升级为正式 htcli 缓存看板。后端通过固定白名单 `/api/btc-course-volume/dashboard|refresh|status|interfaces` 调用服务端本机 `hetao-cli`，固定读取 DC Davinci `memId=29977`“公益课教研看板-BTC-教研整体数据”；`btc_course_volume_cache` 按北京时间今日缓存原始行、聚合结果、CLI 用户、源更新时间和错误状态，页面打开时今日无 ready 缓存才自动更新，管理员可手动普通刷新或 `flush:true` 强制刷新。聚合口径：进量人数=领账号人数，有效期次=期次领账号人数求和大于 0，最近 3 期按期次编号倒序；SKU 解析支持 Python/图形化、小低/小高（`小低小高` 判小高）、人工智能/编程；L1 领取率按领账号人数加权，BTC3/4/5 完课转化率为 L1 领取人数除以对应课完课人数。前端为最近 3 期总览、按期次/按 SKU 双视角、SKU 聚焦三段体验。用户反馈当前看板不够容易读，缺少统计图表；后续优化应优先做信息层级和图表化表达（期次趋势、SKU 跨期趋势、课程漏斗、结构占比、默认聚焦场景、指标解释），不要只继续堆表格。正式多用户方案仍需后续补“用户显式连接 htcli/核桃数据权限”的 token 隔离、刷新、解绑和审计；当前仍是服务端本机 htcli 登录态 + 全局缓存。
- 用户管理与角色管理后台
- 首页重构：动态 Dashboard（天气预报 + 快捷入口 + AI 新闻 + 更新日志）
- AI 新闻源（2026-07-01）：后端 `/api/news` 改为 `NEWS_SOURCE=hybrid`，默认优先读取 `https://llmposts.com/feed/` RSS，失败时回退飞书 Base「AI每日资讯」（Base Token `Az66bPYH0a0VsOsVNOJcxCddnwg`，Table `tblM5xDNiyCXHAUq`）；缓存按 `NEWS_REFRESH_MINUTES` 分钟级 TTL 刷新，默认 60 分钟。

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

适用模块：图片压缩、视频抽帧、特效生成、Base64 转换、QR码生成、时间戳转换、逐字稿播放器项目 CRUD、用户/角色管理

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
| 🪄 图片/GIF 去背景 | image-tools | ✅ 已完成（阿里云通用分割；GIF 最多 30 帧逐帧处理） |
| 🎬 视频抽帧 | image-tools | ✅ 已完成 |
| ✨ 特效生成器 | image-tools | ✅ 已完成（含 GIF 录制） |
| 🧩 SB3 积木分析 | sb3-graphical | ✅ 已完成（V6） |
| 📦 SB3 压缩 | sb3-graphical | ✅ 已完成 |
| ⏱️ 时间戳转换 | misc-shop | ✅ 已完成 |
| 🔤 Base64 转换 | misc-shop | ✅ 已完成 |
| 📱 二维码生成 | misc-shop | ✅ 已完成 |
| 🎭 逐字稿播放器 | copywriting | ✅ 已完成（原 sequence-player） |
| 🧪 正则规则工作台 | copywriting | ✅ 已完成（AI 协作 + 规则测试 + JS 导出） |
| 📊 BTC 课程进量看板 | data-dashboard | ✅ htcli 正式缓存看板 |
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
