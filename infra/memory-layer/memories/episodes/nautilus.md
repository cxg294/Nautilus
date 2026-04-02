# Nautilus 情景记忆

> 此文件是 Nautilus 项目的 L1 情景记忆。
> AI 在完成阶段性工作后，将要点与本文件**比对合并**更新。
> ⚠️ 严禁追加流水账，只保留最新状态。

---

## 项目状态

- **当前阶段**: Phase 0-1 完成，插件化架构改造完成，9 个工具已上线 + 5 个锁定占位（BTC课程流转已解锁），飞书 CLI 已就绪
- **最后更新**: 2026-04-02

## 已完成的里程碑

- Phase 0 脚手架搭建（前后端框架、DB schema、种子数据）
- Phase 0.5 前端迁移到 Soybean Admin（Vue3 + NaiveUI + Elegant Router）
- Phase 1 认证系统（JWT 双 Token、前后端对接、路由守卫）
- 四层记忆系统设计与协议文件
- 业务模块：视频抽帧、图片压缩、特效生成器（含 GIF 录制）、SB3 积木分析(V6)、SB3 压缩、时间戳转换、Base64 转换、二维码生成
- 5 个锁定占位工具（素材生成工作台、BTC课中数据、逐字稿×2、案例设计）
- **BTC 课程流转数据看板 v3**（2026-04-02）：Excel 上传→解析→多维透视/趋势/漏斗/对比 四模式分析平台
- 首页动态 Dashboard 重构（天气 + 快捷入口 + AI 新闻 + 更新日志）
- 游客免登录访问 + Logo 自定义鹦鹉螺号 Mascot
- 飞书 CLI 集成（Lark CLI v1.0.0 + Bot 身份 + 19 个 AI Skills）
- **插件化架构改造**（2026-03-31）：manifest.json 自注册 + plugin-scanner.ts，新增工具零共享文件修改
- 导航重构为五大分类：图片工具 / SB3 图形化 / 杂货铺 / 数据看板 / 文案创意

## 近期讨论与决策

- **UI 组件规范强化**（2026-04-02）：发现 BTC 看板手写了大量原生 HTML 组件（button/select/table），违反项目 NaiveUI 规范。已将完整的 UI 组件对照表和暗色模式适配规则写入 L2 语义记忆（`_project.md`），确保后续开发强制使用 NaiveUI 标准组件。
- **BTC 看板 v3 架构决策**（2026-04-02）：侧边栏布局替代下拉菜单、`calcRate` 返回 null（非 0%）处理缺课数据、趋势图过滤低样本期次（attend_1 < 10）、布局统一用 `width:100%` 避免跳跃。当前手写组件仍需后续用 NaiveUI 重构。
- **插件化架构改造**: 2026-03-31 完成。核心是 `plugin-scanner.ts` 利用 Vite `import.meta.glob()` 扫描 `manifest.json`。
- **SB3 Studio V6**: 2026-03-30 完成从批处理工具到分析工作台的全面重构
- **飞书 CLI**: 2026-03-30 安装配置完成，应用 `cli_a993f6f82838dcb4`；Bot 身份可用，用户身份因 `offline_access` 权限审批问题暂时搁置
- **前端架构**: 纯前端模块不需要后端支持，composable 封装核心逻辑

## 未解决问题

- **BTC 看板 NaiveUI 重构**：当前 BTC 课程流转看板仍使用手写原生组件（button/select/table），需要重构为 NaiveUI 标准组件（NTabs/NSelect/NDataTable/NTag 等）
- 插件化 Phase 2：工具内部 page 翻译迁移到工具目录内
- Phase 2a（记忆层 API）待实现
- 前端全局错误日志/埋点系统待设计
- 认知卸载 MVP 待验证（macOS Vision OCR 准确度、截屏覆盖率）
- 飞书用户身份登录待解决（需 `offline_access` scope 审批）
- sb3-studio 和 effects-generator 有预先存在的 TypeScript 类型错误未修复
