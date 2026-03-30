# Nautilus 情景记忆

> 此文件是 Nautilus 项目的 L1 情景记忆。
> AI 在完成阶段性工作后，将要点与本文件**比对合并**更新。
> ⚠️ 严禁追加流水账，只保留最新状态。

---

## 项目状态

- **当前阶段**: Phase 0-1 完成，两个业务模块已上线（视频抽帧 + SB3 积木分析），飞书 CLI 基础设施已就绪
- **最后更新**: 2026-03-30

## 已完成的里程碑

- Phase 0 脚手架搭建（前后端框架、DB schema、种子数据）
- Phase 0.5 前端迁移到 Soybean Admin（Vue3 + NaiveUI + Elegant Router）
- Phase 1 认证系统（JWT 登录、getUserInfo、refreshToken、前端对接验证通过）
- 四层记忆系统设计与协议文件
- 第一个业务模块：视频抽帧工具（纯前端，HTML5 Video + Canvas + JSZip）
- `/new-module` 工作流更新到 Soybean Admin 版本
- 清理 `client-legacy/` 旧前端代码
- SB3 积木分析工作台上线（含 UI 重构 + 8 项功能补全，详见 L2 语义记忆）
- 首页及公开工具支持游客模式访问（无需登录）
- Logo SVG 替换为自定义鹦鹉螺号 Mascot
- 飞书 CLI 集成：Lark CLI v1.0.0 安装 + Bot 身份配置 + 19 个 AI Skills 安装到 `.agents/skills/lark-*`

## 近期讨论与决策

- **SB3 Studio V6**: 2026-03-30 完成从批处理工具到分析工作台的全面重构
  - 前身是 `sb3-batch-studio`（开发者视角），现改为四Tab场景化布局（项目总览/素材管理/变量与广播/逻辑分析）
  - 对标 cubetest 项目补全 8 项功能：深度搜索、引用资源分析、孤立积木检测、脚本过滤器、变量管理、素材预览替换、广播→脚本跨面板跳转
  - 已用 `untitled (6).sb3`（5.9MB/29角色/2721积木）验证通过
  - 关键文件：`SpritePanel.vue`(V6)、`DataPanel.vue`(V3)、`LogicPanel.vue`、`blockConverter.js`、`use-sb3-project.ts`
  - MermaidRenderer 添加 `suppressErrorRendering: true` 修复渲染错误
- **飞书 CLI**: 2026-03-30 安装配置完成，应用 `cli_a993f6f82838dcb4`；Bot 身份可用，用户身份因 `offline_access` 权限审批问题暂时搁置
- **认知卸载方案**: 已完成设计方案文档（`认知卸载机制设计方案.md`），三路采集 + 本地 OCR + Gemini 分析管道；Limitless (Rewind) 方案已否决，全面转向自研
- **飞书桥接策略**: 原计划 Phase 2b 使用 Webhook 桥接，现可改用 Lark CLI 直接对接飞书 API（消息通知、多维表格读写等），简化集成路径
- **路由注册**: Soybean Admin 使用 Elegant Router，新增页面需改 3+1 个文件
- **前端架构**: 纯前端模块不需要后端支持，composable 封装核心逻辑

## 未解决问题

- Phase 2a（记忆层 API）待实现
- 前端全局错误日志/埋点系统待设计
- 认知卸载 MVP 待验证（macOS Vision OCR 准确度、截屏覆盖率）
- 飞书用户身份登录待解决（需 `offline_access` scope 审批）
- 更多业务模块待选择和接入
