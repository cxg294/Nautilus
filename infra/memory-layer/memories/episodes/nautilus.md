# Nautilus 情景记忆

> 此文件是 Nautilus 项目的 L1 情景记忆。
> AI 在完成阶段性工作后，将要点与本文件**比对合并**更新。
> ⚠️ 严禁追加流水账，只保留最新状态。

---

## 项目状态

- **当前阶段**: Phase 0-1 完成，插件化架构改造完成，9 个工具已上线 + 6 个锁定占位，飞书 CLI 已就绪
- **最后更新**: 2026-03-31

## 已完成的里程碑

- Phase 0 脚手架搭建（前后端框架、DB schema、种子数据）
- Phase 0.5 前端迁移到 Soybean Admin（Vue3 + NaiveUI + Elegant Router）
- Phase 1 认证系统（JWT 双 Token、前后端对接、路由守卫）
- 四层记忆系统设计与协议文件
- 业务模块：视频抽帧、图片压缩、特效生成器（含 GIF 录制）、SB3 积木分析(V6)、SB3 压缩、时间戳转换、Base64 转换、二维码生成
- 6 个锁定占位工具（素材生成工作台、BTC×2、逐字稿×2、案例设计）
- 首页动态 Dashboard 重构（天气 + 快捷入口 + AI 新闻 + 更新日志）
- 游客免登录访问 + Logo 自定义鹦鹉螺号 Mascot
- 飞书 CLI 集成（Lark CLI v1.0.0 + Bot 身份 + 19 个 AI Skills）
- **插件化架构改造**（2026-03-31）：manifest.json 自注册 + plugin-scanner.ts，新增工具零共享文件修改
- 导航重构为五大分类：图片工具 / SB3 图形化 / 杂货铺 / 数据看板 / 文案创意

## 近期讨论与决策

- **插件化架构改造**: 2026-03-31 完成。核心是 `plugin-scanner.ts` 利用 Vite `import.meta.glob()` 扫描 `manifest.json`。类型系统使用 `(string & {})` 模式允许插件路由的动态 key，同时保持内置路由的 IDE 提示。`/new-module` 工作流已更新。
- **SB3 Studio V6**: 2026-03-30 完成从批处理工具到分析工作台的全面重构
- **飞书 CLI**: 2026-03-30 安装配置完成，应用 `cli_a993f6f82838dcb4`；Bot 身份可用，用户身份因 `offline_access` 权限审批问题暂时搁置
- **Windows Lark CLI 踩坑**: PowerShell 传嵌套 JSON 给 lark-cli 会拆参数，解决方案是 Node.js `execFileSync(process.execPath, [run.js, ...args])`
- **认知卸载方案**: 已完成设计文档，Limitless (Rewind) 已否决，全面转向自研
- **前端架构**: 纯前端模块不需要后端支持，composable 封装核心逻辑

## 未解决问题

- 插件化 Phase 2：工具内部 page 翻译迁移到工具目录内
- Phase 2a（记忆层 API）待实现
- 前端全局错误日志/埋点系统待设计
- 认知卸载 MVP 待验证（macOS Vision OCR 准确度、截屏覆盖率）
- 飞书用户身份登录待解决（需 `offline_access` scope 审批）
- sb3-studio 和 effects-generator 有预先存在的 TypeScript 类型错误未修复
