# Nautilus 情景记忆

> 此文件是 Nautilus 项目的 L1 情景记忆。
> AI 在完成阶段性工作后，将要点与本文件**比对合并**更新。
> ⚠️ 严禁追加流水账，只保留最新状态。

---

## 项目状态

- **当前阶段**: Phase 0-1 完成，插件化架构改造完成，业务模块持续迭代，飞书 CLI 与 BTC hetao-cli 正式缓存看板已就绪；本机 Mac 开发服务已通过 LaunchAgent 启用
- **最后更新**: 2026-08-31

## 已完成的里程碑

- Phase 0 脚手架搭建（前后端框架、DB schema、种子数据）
- Phase 0.5 前端迁移到 Soybean Admin（Vue3 + NaiveUI + Elegant Router）
- Phase 1 认证系统（JWT 双 Token、前后端对接、路由守卫）
- 四层记忆系统设计与协议文件
- 业务模块：视频抽帧、图片压缩、图片/GIF 去背景、特效生成器（含 GIF 录制）、SB3 积木分析(V6)、SB3 压缩、时间戳转换、Base64 转换、二维码生成、逐字稿播放器、正则规则工作台
- BTC 课程进量看板：已从占位入口升级为 hetao-cli 正式缓存看板
- **BTC 课程流转数据看板 v3**（2026-04-02）：曾实现 Excel 上传→解析→多维透视/趋势/漏斗/对比四模式分析；已于 2026-07-02 下线
- 首页动态 Dashboard 重构（天气 + 快捷入口 + AI 新闻 + 更新日志）
- 游客免登录访问 + Logo 自定义鹦鹉螺号 Mascot
- 飞书 CLI 集成（Lark CLI v1.0.0 + Bot 身份 + 19 个 AI Skills）
- **插件化架构改造**（2026-03-31）：manifest.json 自注册 + plugin-scanner.ts，新增工具零共享文件修改
- 导航重构为五大分类：图片工具 / SB3 图形化 / 杂货铺 / 数据看板 / 文案创意

## 近期讨论与决策

- **本机运行方式恢复**（2026-06-25）：macOS 上使用 `local.nautilus.backend` 与 `local.nautilus.frontend` 两个用户级 LaunchAgent 托管开发服务；固定后端/前端运行 Node 20.19.0，以兼容现有 `better-sqlite3` 原生模块。前端地址 `http://localhost:9527/`，后端健康检查 `http://localhost:3000/api/health`。
- **登录续期配置修复**（2026-07-03）：本机前端 LaunchAgent 以 `vite --mode test` 运行，原先 Vite 运行态里 `VITE_SERVICE_EXPIRED_TOKEN_CODES` / `VITE_SERVICE_LOGOUT_CODES` / `VITE_SERVICE_MODAL_LOGOUT_CODES` 都是空字符串；后端认证中间件对过期 access token 返回 `9999`，对无效 token 返回 `3333`，refresh token 存在 SQLite `refresh_tokens` 表中，重启后不会丢。已在 `.env.test` 补齐 `VITE_SERVICE_EXPIRED_TOKEN_CODES=9999,3333`、`VITE_SERVICE_LOGOUT_CODES=8888`、`VITE_SERVICE_MODAL_LOGOUT_CODES=7777`，并在 `src/service/request/index.ts` 加默认码兜底，避免 env 漏配再次绕过 `handleExpiredRequest` 静默续期。
- **稳定性收口第一轮**（2026-07-01）：`.nvmrc` 更新为 `v20.19.0`，`packageManager` 固定为 `pnpm@10.33.0`，新增 `pnpm run doctor` 本机诊断脚本，覆盖 Node/pnpm、`better-sqlite3`、SQLite、LaunchAgent、前后端健康、AI 新闻、`lark-cli` 与 Git 工作区状态；修复 `icon-explorer`/`sequence-player` 路由多语言缺项、视频抽帧 GIF 类型错误与埋点参数错误。验证通过：`pnpm typecheck`、`pnpm build:test`、`pnpm run doctor`。
- **AI 新闻源改造**（2026-07-01）：首页新闻后端从“固定读取飞书 Base”升级为 RSS 主源 + 飞书兜底。默认 `NEWS_SOURCE=hybrid`，优先读取 `https://llmposts.com/feed/`，解析 RSS `title/link/pubDate/category/description` 映射为现有 NewsItem；RSS 失败时回退飞书 Base「AI每日资讯」。缓存从每日 10 点刷新改为分钟级 TTL（默认 60 分钟）。已重启后端并验证 `/api/news` 与 `/api/news/refresh` 返回 `provider: "rss"`。
- **模块裁剪与重组**（2026-07-01）：移除素材生成工作台、语音工具，以及逐字稿审查/逐字稿生成/案例设计三个占位模块；`sequence-player` 保留内部技术名和 API/DB，菜单展示改为「逐字稿播放器」并移动到「文案创意」分类；新增 `009_remove_retired_modules.sql` 清理下线模块权限。
- **图片去背景 GIF 扩展**（2026-07-01）：阿里云 `SegmentCommonImage` 通用分割不直接支持 GIF，当前实现为后端使用 `modern-gif` 解码、`sharp` 转逐帧 PNG、逐帧调用阿里云去背、再重新编码 GIF；服务端硬限制最多 30 帧，本地生成结果通过鉴权 `/api/image-matting/output/:file` 提供预览/下载。前端跳过 GIF 压缩，支持 GIF 结果预览、单文件下载与 ZIP 打包；混合队列中 GIF 串行处理以控制云端调用压力。已验证 31 帧 GIF 返回 HTTP 400，未进入阿里云逐帧调用。
- **正则规则工作台纳入 Nautilus**（2026-07-01）：新增 `regex-workflow` 到「文案创意」分类，纯前端实现课程正则验收规则的 AI 提示词复制、JSON 导入/合并、N/Y 规则编辑、平台顺序模拟测试、提示语维护与 `noticeDict/front_end_code` JS 预览下载。页面采用宽松工作台布局（hero + 指标带 + 项目侧栏 + 主工作区），避免临时页面过度紧凑。
- **工具页空间感方案回滚**（2026-07-02）：上一轮用通用 hero/指标卡外壳处理“空间感”，但未真正解决工具内部布局紧凑问题，已按用户反馈回滚。后续空间感优化必须先盘页面工作流密度、默认/高级控件分层、内容区域比例和任务节奏；不能用“加好看的外壳”替代内部布局优化。
- **BTC 数据看板正式版**（2026-07-02）：下线 `btc-course-flow` 课程流转数据看板和 `btc-in-class` 课中数据占位入口，移除旧 `/api/btc-course-flow` 挂载；`btc-course-volume`「BTC 课程进量看板」归入「数据看板」分类，并从 hetao-cli POC 升级为正式缓存看板。后端新增 `btc_course_volume_cache` 与正式接口 `/api/btc-course-volume/dashboard|refresh`，打开页面时按北京时间检查今日 ready 缓存，无缓存则服务端本机 `hetao-cli dc-report query-view query` 拉取 DC Davinci `memId=29977`“公益课教研看板-BTC-教研整体数据”；缓存包含原始行、聚合结果、CLI 用户、源更新时间和错误状态。聚合口径：进量人数=领账号人数，有效期次=期次领账号人数求和大于 0，最近 3 期按期次编号倒序，SKU 解析支持 Python/图形化、小低/小高（`小低小高` 判小高）、人工智能/编程，L1 领取率按领账号人数加权，BTC3/4/5 完课转化率为 L1 领取人数除以对应课完课人数。前端重构为最近 3 期总览、按期次/按 SKU 双视角、SKU 聚焦三段体验；已验证 `pnpm typecheck`、`pnpm build:test`、真实拉取 10308 行、缓存命中、POST 普通刷新、普通 user 默认 403、Vite 路由 200。用户后续反馈：当前看板功能可用但不够易读，缺少统计图表；下一轮应围绕“怎么读数据”重做信息层级和图表表达，优先补期次趋势、SKU 跨期趋势、课程漏斗、结构占比和默认聚焦场景。
- **逐字稿播放器飞书稿件调研与 JSON 格式落地**（2026-07-03）：用户希望后续做到“甩一个飞书链接即可播放逐字稿，有声音、有图像、有角色”。已读取稿件索引 Wiki（`PBNaweRLGiHvNekTtFlcWgyKnzg`），共 62 个入口，覆盖 S、趣C、趣P、数理C、老PY、BtoCpython、BtoCAI课S、BtoCAI课P。抽样发现稿件形态包括分场景剧本文档、命名/逐字稿/动画标注表格、类型/关卡/逐字稿/效果预览四列表格、配音角色/配音脚本表格，以及正文中嵌入 sheet 的复合文档。本机还有可复用老原型 `GAL脚本预览器`：源码在 `/Users/chenxinguang/cursor/GAL脚本预览器`，Obsidian 记录在 `/Users/chenxinguang/Documents/沉淀库/02-项目/Nautilus/GAL脚本预览器`，轻量包在 `/Users/chenxinguang/Downloads/anticowork/Nautilus/GAL脚本预览器_轻量分发版_20260428`；其 `word-parser.js` 已实现 Word 表格逐字稿/图片列识别，角色立绘素材已迁入 Nautilus `public/characters`。语音方案已明确不绑定 Fish 或其他具体供应商，统一按 `none | browser | external` 与 `voiceId/provider` 抽象建模；老原型中的具体 TTS 实现只作为历史参考。老原型的 `character-manager.js`/`character-editor.js`/`stage-settings.js` 可作为角色库与舞台管理蓝本：支持角色名、颜色、造型、缩放、音色配置，脚本中使用角色置顶，背景类型、左右角色位置、右侧翻转、字幕字号/宽度、图片展示区域四边距。当前 `sequence-player` 已有双角色舞台、16:9、立绘加载、项目 CRUD 和浏览器 TTS；已新增 Obsidian 文档 `逐字稿播放器-序列JSON格式.md`，并在代码中扩展 `SequenceProject`/`Step` 类型，支持 `source`、`assets`、`stage`、`display`、`audio`、`sourceRef` 等字段；前端已支持导入/导出序列 JSON。下一轮方案应继续推进飞书链接导入、表格/正文/图片/动画标注归一化、角色库编辑、舞台布局编辑或展示事件映射。
- **逐字稿播放器页面可读性重构**（2026-07-03）：用户反馈播放器页面配色、布局和按钮样式不清楚。已把页面从左侧 320px 面板内塞项目标题和 tiny 图标按钮，重构为顶部项目命令栏（项目/导入 JSON/导出/保存 + 状态标签）、左侧逐字稿与步骤列表工作区、右侧舞台预览与控制区。修复浅色模式下文字颜色 fallback 偏白的问题，步骤列表改为更清楚的当前/已播放/停顿状态，控制条改为明确工具条，空态图标改为 MDI 图标，并把默认课堂背景从偏粉紫改为更中性的蓝灰墙面/地面分区。已用本机 `http://localhost:9527/sequence-player` 登录态截图验证空态和加载示例状态，`corepack pnpm typecheck` 通过。后续角色库/舞台管理应沿用这个页面结构继续增量接入。
- **逐字稿播放器角色/舞台管理补齐**（2026-07-03）：在页面可读性重构后，用户指出角色管理和舞台大小设置仍缺失。已把“舞台与角色”抽屉扩展为舞台/角色两个 Tab：舞台支持背景、比例、宽度、最大高度、左右角色位置、右侧翻转、字幕字号/宽度、打字速度和台词停顿；角色支持新增、显示名、代表色、左/右站位、立绘缩放、TTS 引擎抽象配置、造型增删与默认造型。舞台渲染已接入 `StageConfig`，尺寸、左右站位、缩放、翻转和字幕设置会实时影响 `PlayerStage`。脚本中已使用的角色暂不允许删除，避免打断 `Step.characterName` 引用。`StageConfig` 增加 `size` 段，并在序列 JSON 顶层 `stage` 保存；服务器项目不新增 DB 字段，兼容存到 `settings.stage` 并在详情接口展开。验证：`corepack pnpm typecheck`、`node --check server/routes/sequence-player.js` 通过；in-app browser 能读取页面但 click 通道在本轮验收中卡住，未完成最终截图验证。
- **语音合成与音色盘点**（2026-08-31、2026-09-28）：`voice-lab` 的 CosyVoice 复刻音色合成改为百炼 HTTP SSE 调用，开启 `word_timestamp_enabled` 并从 `sentence-end` 事件收集字/词级毫秒时间戳；REST 返回供应商无关的 `alignment`，前端可导出 JSON。设计音色继续走非流式接口。真实“字幕测试”返回四个汉字时间段和百炼自动补入的句号 token，后续字幕需按原句索引处理自动标点；当时通过 `pnpm test:voice-lab`、`pnpm typecheck`、`pnpm build:test` 和真实百炼 SSE 验证。2026-09-28 盘点：云端现存 73 个音色（复刻 37、设计 36），本地另有 14 条已删除记录；复刻音色对应 21 个本地名称。此前 613 条“合成成功”行为事件没有 voice ID，工坊也没有完整按音色计数，故无法从本地还原历史每音色生成次数。同日补了后端成功合成埋点：`/voice-lab/synthesize` 和试听接口按音色 ID 记入 `analytics_events`，记录模型、字符数、请求 ID、入口，工坊请求带 `origin=sequence-player`；移除前端重复合成埋点，音色库显示新统计且分页加载全部音色。`list_voice` 本地默认单页数量从 50 调到 100，实测一次返回全部 73 个。14 组同类别同名不同 ID 的候选涉及 48 个音色，含复刻 10 组、设计 4 组；详细版本、创建时间、新增生成次数和项目引用见 `/Users/chenxinguang/Documents/nautilus/reports/语音合成重复音色候选-2026-09-28.md`。用户暂未指定保留版本，因此没有隐藏或删除音色。
- **图片抠图失败修复**（2026-06-25）：抠图页面原先直接使用裸 `axios` 调用受保护的 `/api/image-matting/*`，不会携带登录 token，导致后端 `requireAuth` 返回未认证而前端仅显示“处理失败”。已在上传、单图下载、ZIP 下载中补齐认证信息；单图下载通过后端支持的 `_token` query 兜底。
- **TTS 未取到 event_id 修复（历史）**（2026-06-25）：当时修复了 TTS Studio 的认证与 Gradio 文件代理问题；该语音工具已在 2026-07-01 的模块裁剪中下线。
- **开发环境登录 CORS 修复**（2026-06-25）：Vite 页面从网络地址 `http://10.199.9.112:9527` 打开时，后端 CORS 只允许 `http://localhost:9527`，导致浏览器登录请求被拦截。已在开发模式下允许 9527 端口的 localhost、常见内网 IP 与 `198.18/19.*` 地址来源。
- **UI 组件规范强化**（2026-04-02）：发现 BTC 看板手写了大量原生 HTML 组件（button/select/table），违反项目 NaiveUI 规范。已将完整的 UI 组件对照表和暗色模式适配规则写入 L2 语义记忆（`_project.md`），后续页面仍应优先使用 NaiveUI，但需要结合具体工作流重构，避免只做组件替换。
- **BTC 看板 v3 架构决策（历史）**（2026-04-02）：侧边栏布局替代下拉菜单、`calcRate` 返回 null（非 0%）处理缺课数据、趋势图过滤低样本期次（attend_1 < 10）、布局统一用 `width:100%` 避免跳跃；该旧模块已下线。
- **插件化架构改造**: 2026-03-31 完成。核心是 `plugin-scanner.ts` 利用 Vite `import.meta.glob()` 扫描 `manifest.json`。
- **SB3 Studio V6**: 2026-03-30 完成从批处理工具到分析工作台的全面重构
- **飞书 CLI**: 2026-03-30 安装配置完成，应用 `cli_a993f6f82838dcb4`；Bot 身份可用，用户身份因 `offline_access` 权限审批问题暂时搁置
- **前端架构**: 纯前端模块不需要后端支持，composable 封装核心逻辑

## 未解决问题

- 插件化 Phase 2：工具内部 page 翻译迁移到工具目录内
- Phase 2a（记忆层 API）待实现
- 前端全局错误日志/埋点系统待设计
- 认知卸载 MVP 待验证（macOS Vision OCR 准确度、截屏覆盖率）
- 飞书用户身份登录待解决（需 `offline_access` scope 审批）
- 当前工作区仍有较多未提交改动，需按主题拆分提交：救火修复、运行环境/诊断、新闻 RSS、模块裁剪、逐字稿播放器、视频抽帧/GIF、用户/权限与安全增强
- 正则规则工作台当前为本地草稿与导入导出流程，尚未接后端项目库或 AI 直连；多人共用时可补持久化与权限细分。
- BTC 课程进量看板当前正式版仍使用服务端本机 hetao-cli 登录态和全局缓存，尚未接入“用户显式连接/授权自己的 htcli token”流程；下一步需设计 token 隔离、过期、解绑和审计。
- BTC 课程进量看板体验仍需二次设计：目前表格信息密度高，不够容易读；缺少统计图表与明确分析动线。后续优化重点是图表化、默认场景、指标解释、趋势/结构/漏斗视图，而不是继续增加明细表。
