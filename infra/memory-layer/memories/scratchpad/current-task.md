# 当前工作焦点

> 此文件由 AI 助手在完成阶段性工作后即时更新，记录当前工作状态。

---

## 活跃项目
- **Nautilus** — 个人万用工作台

## 当前关注（2026-09-28）
- 语音合成字级时间轴已落地：`voice-lab` 的复刻音色改走百炼 HTTP SSE，开启 `word_timestamp_enabled`，API 返回毫秒级 `alignment.sentences[].words[]`，页面可导出 `.alignment.json`；设计音色仍走非流式兼容路径。真实“字幕测试”验证拿到四个汉字时间段和百炼自动补入的句号 token，后续卡拉 OK 字幕需按原句索引映射并处理自动标点。2026-09-28 盘点云端现存 73 个音色（复刻 37、设计 36），历史 613 条合成成功埋点未记录 voice ID，不能从本地还原逐音色生成次数。随后已补后端逐音色成功合成与试听埋点，语音合成页移除重复客户端埋点并分页加载全部音色；新统计仅从这次改动后开始。`list_voice` 本地默认单页数量已从 50 调到 100，页面继续分页拉全。14 组同名不同 ID 候选涉及 48 个音色，报告在 `/Users/chenxinguang/Documents/nautilus/reports/`。用户尚未指定保留版本，未隐藏或删除。
- 登录续期问题已修复：`.env.test` 已补 `VITE_SERVICE_EXPIRED_TOKEN_CODES=9999,3333`、`VITE_SERVICE_LOGOUT_CODES=8888`、`VITE_SERVICE_MODAL_LOGOUT_CODES=7777`；`src/service/request/index.ts` 已加默认码兜底，避免 env 漏配导致 access token 过期时绕过 `handleExpiredRequest`。当前 Vite 运行态已注入新配置，验证通过 `pnpm typecheck` 与 `pnpm build:test`。
- 逐字稿播放器下一轮迭代正在讨论“甩一个飞书链接即可播放”的方向。已读取稿件索引 Wiki：共有 62 个稿件入口，覆盖 S、趣C、趣P、数理C、老PY、BtoCpython、BtoCAI课S、BtoCAI课P。
- 初步抽样结论：稿件主要分为分场景剧本表格、三/四列表格（命名/逐字稿/动画标注）、配音脚本表格、嵌入 sheet 的复合文档。现有 `sequence-player` 仅支持粘贴纯文本并用规则解析“角色：台词”和“【停顿】”，尚未支持飞书链接导入、表格结构识别、动画标注到展示事件的映射、角色声线/音频生成。
- 已补充本机 Obsidian 与 Antigravity 考古：老项目 `GAL脚本预览器` 位于 `/Users/chenxinguang/cursor/GAL脚本预览器`，Obsidian 记录在 `/Users/chenxinguang/Documents/沉淀库/02-项目/Nautilus/GAL脚本预览器`，轻量分发包在 `/Users/chenxinguang/Downloads/anticowork/Nautilus/GAL脚本预览器_轻量分发版_20260428`。其中 `word-parser.js` 已实现 Word 表格逐字稿/图片列识别；老项目中的具体 TTS 实现只作为历史参考，当前决策是不绑定供应商，统一走 `browser | external | none` 的抽象语音配置。
- `GAL脚本预览器` 的角色/舞台管理也可复用为产品蓝本：`character-manager.js` 管角色名、代表色、造型列表、缩放和 voice 配置；`character-editor.js` 支持脚本中使用角色置顶、角色 CRUD、造型增删改、缩放滑杆、音色选择；`stage-settings.js` 支持背景类型、左右角色位置、右侧翻转、字幕字号/宽度、图片展示区域四边距。当前 Nautilus 只有设置抽屉里的基础背景/打字/停顿/语速和只读角色卡，缺角色库编辑、舞台布局编辑、图片展示区域配置。
- 当前 Nautilus `sequence-player` 已具备双角色舞台、16:9、立绘加载、项目 CRUD 和浏览器 TTS；下一步不应重写播放器，而应补“文档导入与结构化 schema”：飞书链接拉取 -> 表格/正文/图片/动画标注归一化 -> `Step[]` 扩展图片/展示 cue/音频字段 -> 保存为项目。
- 已新增 Obsidian 文档 `逐字稿播放器-序列JSON格式.md`，并在代码中落地第一步：扩展 `SequenceProject`/`Step` 类型，增加 `source`、`assets`、`stage`、`display`、`audio`、`sourceRef` 等字段；前端已支持导入/导出序列 JSON。
- 已完成逐字稿播放器页面可读性重构：从“左侧窄面板塞项目标题与 tiny 图标按钮 + 大块低对比舞台”改为顶部项目命令栏、左侧逐字稿/步骤列表工作区、右侧舞台预览与控制区；修复浅色模式文字 fallback 偏白导致看不清的问题，并统一步骤列表、控制条、舞台空态和默认课堂背景的对比度。
- 已补上“舞台与角色”抽屉能力：舞台 Tab 支持背景、比例、宽度、最大高度、左右角色位置、右侧翻转、字幕字号/宽度、打字速度和台词停顿；角色 Tab 支持新增角色、显示名、代表色、左/右站位、立绘缩放、TTS 引擎抽象配置、造型增删与默认造型。脚本已使用的角色暂不允许删除，避免破坏步骤引用。舞台配置进入序列 JSON 顶层 `stage`，服务器项目在不改 DB schema 的前提下兼容保存到 `settings.stage`。
- 本轮讨论建议优先聚焦：导入器能力边界、稿件结构识别 schema、最小可播放事件模型、从动画标注抽取展示 cue 的方式，以及如何把飞书 doc/wiki/sheet 内容拉取接入后端。

## 当前阶段
- Phase 0 脚手架 ✅
- Phase 0.5 Soybean Admin 迁移 ✅
- Phase 1 认证系统 ✅
- 业务模块持续迭代 ✅
- 飞书 CLI 基础设施 ✅
- 插件化架构改造 ✅
- BTC 课程进量看板正式版 ✅（旧 BTC 流转/课中看板已下线）

## 最近完成（2026-07-01）
- 模块裁剪与重组：
  - 移除素材生成工作台、语音工具，以及逐字稿审查/逐字稿生成/案例设计三个占位模块
  - `sequence-player` 保留内部技术名，菜单展示改为「逐字稿播放器」，移动到「文案创意」分类
  - 新增 `009_remove_retired_modules.sql` 清理下线模块权限
- 图片去背景 GIF 能力：
  - 阿里云通用分割不直接支持 GIF；后端新增 GIF 解码、逐帧去背、重新编码输出链路
  - 服务端硬限制 GIF 最多 30 帧；前端跳过静态图压缩逻辑，支持 GIF 预览、单文件下载、ZIP 打包
  - 已重启后端；验证 31 帧 GIF 返回 HTTP 400，未进入阿里云逐帧调用
- 正则规则工作台：
  - 新增 `src/views/regex-workflow/`，归入「文案创意」分类，面向课程正则验收规则的 AI 协作、JSON 导入、规则编辑、测试与 JS 导出
  - 页面按工作台首屏设计，保留 hero、指标带、项目侧栏和主工作区，避免二级工具页过度紧凑
  - 已同步权限 `module:regex-workflow:access`，验证 `pnpm typecheck`、`pnpm build:test`、`pnpm run doctor`
- 工具页空间感方案回滚（2026-07-02）：
  - 已撤回上一轮 `ToolPageShell`/hero/指标卡统一外壳方案，以及由此带来的表格/按钮迁移和沉浸式工具外壳改造
  - 保留与空间感无关的业务改动：图片/GIF 去背景、视频抽帧 GIF、逐字稿播放器项目能力、用户角色下拉管理等
  - 关键结论：不能把“加一个好看的外壳”当作空间感优化；下一步必须先按页面工作流拆密度问题，再决定哪些区域该紧凑、哪些区域该放松
- BTC 数据看板正式版（2026-07-02）：
  - 下线旧 `btc-course-flow` 课程流转数据看板和 `btc-in-class` 课中数据占位入口
  - 移除旧 `/api/btc-course-flow` 后端挂载与旧页面内容
  - `btc-course-volume`「BTC 课程进量看板」归入「数据看板」分类，并从 hetao-cli POC 升级为正式缓存看板
  - 后端新增每日缓存表 `btc_course_volume_cache`，正式接口 `/api/btc-course-volume/dashboard` 与 `/refresh`；打开页面时按北京时间检查今日 ready 缓存，无缓存则服务端拉取 htcli，管理员可手动普通刷新或 `flush:true` 强制刷新
  - 数据源固定 DC Davinci `memId=29977`“公益课教研看板-BTC-教研整体数据”；服务端分页拉全并容忍 DC 偶发空页，缓存原始行、聚合结果、CLI 用户、更新时间与错误状态
  - 聚合口径：进量人数=领账号人数，有效期次=期次领账号人数求和大于 0，最近 3 期按期次编号倒序；SKU 解析支持 Python/图形化、小低/小高（`小低小高` 判小高）、人工智能/编程；L1 领取率按领账号人数加权，BTC3/4/5 完课转化率用 L1 领取人数除以对应课完课人数
  - 前端重构为最近 3 期总览、按期次/按 SKU 双视角、SKU 聚焦三段体验，展示课节到课/完课/留存与跨期 L1、BTC3/4/5 完课转化
  - 已验证：`pnpm typecheck`、`pnpm build:test`、API 真实拉取 10308 行、今日缓存命中、POST 普通刷新、普通 user 默认 403、Vite 路由 200
  - 用户反馈：当前看板信息可用但不够易读，缺少统计图表；后续优化应优先重做可读性、信息层级和图表化表达，而不是继续堆表格
- AI 新闻源改造：
  - `/api/news` 默认 `NEWS_SOURCE=hybrid`：优先读取 `https://llmposts.com/feed/` RSS，失败时回退飞书 Base「AI每日资讯」
  - 新增 `fast-xml-parser` 直接依赖，RSS 字段映射为现有 NewsItem，缓存 TTL 默认 60 分钟
  - 已重启后端，验证 `/api/news` 与 `/api/news/refresh` 均返回 5 条 `provider: "rss"` 新闻
- 第一优先级稳定性收口：
  - `.nvmrc` 固定为 `v20.19.0`，`packageManager` 固定为 `pnpm@10.33.0`
  - 新增 `pnpm run doctor` 本机诊断脚本，检查运行时、原生模块、LaunchAgent、前后端、AI 新闻、lark-cli、Git 工作区
  - 修复 typecheck：补 `icon-explorer`/`sequence-player` 路由多语言、修正 GIF 帧数据类型、修正视频抽帧 GIF 埋点参数
  - 验证通过：`pnpm typecheck`、`pnpm build:test`、`pnpm run doctor`

## 最近完成（2026-06-25）
- 修复开发环境无法登录：后端 CORS 现在允许从 Vite 网络地址（如 `http://10.199.9.112:9527`）发起登录请求；已重启后端并验证登录返回 token。
- 修复 TTS Studio “未获取到 event_id”（历史）：该语音工具已在 2026-07-01 模块裁剪中下线。
- 修复图片抠图失败：`src/views/image-matting/index.vue` 的上传和下载请求现在会携带登录 token，避免被后端 `requireAuth` 拦截。
- 本机 Mac 已恢复 Nautilus 开发服务：
  - 后端 LaunchAgent：`local.nautilus.backend`，端口 3000
  - 前端 LaunchAgent：`local.nautilus.frontend`，端口 9527
  - 固定使用 Node 20.19.0 运行，避免 `better-sqlite3` 与 Node 22/23 ABI 不兼容
- 验证结果：`/api/health` 返回 ok，前端 `http://localhost:9527/` 返回 200，新闻接口返回 5 条

## 最近完成（2026-04-02）
- BTC 课程流转数据看板 v3：透视分析、期次趋势、课程对比、完课漏斗 四模式（该模块已于 2026-07-02 下线）
- 透视图增加 L1 领取率折线 + 领号人数柱状图（双 Y 轴）
- 趋势图过滤低样本期次（attend_1 < 10）
- 布局一致性修复（width:100% 消除 Tab 跳跃）
- **UI 组件规范写入 L2 记忆**：完整的 NaiveUI 组件对照表 + 暗色模式适配规则

## 下一步
- 拆分当前工作区提交：救火修复 / 运行环境与诊断 / 新闻 RSS / 模块裁剪 / 逐字稿播放器 / 视频抽帧 GIF / 正则规则工作台 / 工具页空间感 / 用户权限与安全增强 / BTC htcli 看板 POC
- BTC htcli 后续：设计 Nautilus 用户与 htcli 授权连接的绑定、token 隔离、过期刷新、解绑和审计链路；当前正式版仍使用服务端本机 htcli 全局缓存
- BTC 看板体验后续：优化“读法”和统计图表，包括期次趋势、SKU 跨期折线/柱图、课程漏斗、结构占比、默认聚焦场景与指标解释
- 工具页空间感后续：先与用户重新盘方案；重点评估原页面内部布局、工作流密度、信息层级与默认/高级控件分层，而不是先套统一外壳
- 插件化 Phase 2：工具内部 page 翻译迁移到工具目录
- Phase 2a 记忆层 API
- Phase 2b 飞书桥接（Lark CLI 已就绪）
- 或解锁其他占位模块

## 阻塞项
- 飞书用户身份登录：需 `offline_access` scope 审批，暂时搁置
- 暂无 typecheck 阻塞；当前主要风险是未提交改动需要拆分收口
