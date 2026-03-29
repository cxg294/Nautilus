# Nautilus 情景记忆

> 此文件是 Nautilus 项目的 L1 情景记忆。
> AI 在完成阶段性工作后，将要点与本文件**比对合并**更新。
> ⚠️ 严禁追加流水账，只保留最新状态。

---

## 项目状态

- **当前阶段**: Phase 0-1 完成，第一个业务模块已上线
- **最后更新**: 2026-03-29

## 已完成的里程碑

- Phase 0 脚手架搭建（前后端框架、DB schema、种子数据）
- Phase 0.5 前端迁移到 Soybean Admin（Vue3 + NaiveUI + Elegant Router）
- Phase 1 认证系统（JWT 登录、getUserInfo、refreshToken、前端对接验证通过）
- 四层记忆系统设计与协议文件
- 第一个业务模块：视频抽帧工具（纯前端，HTML5 Video + Canvas + JSZip）
- `/new-module` 工作流更新到 Soybean Admin 版本
- 清理 `client-legacy/` 旧前端代码

## 近期讨论与决策

- **路由注册**: Soybean Admin 使用 Elegant Router，新增页面需改 3+1 个文件（elegant-router.d.ts → routes.ts → imports.ts → app.d.ts）
- **前端架构**: 纯前端模块不需要后端支持，composable 封装核心逻辑
- **视频抽帧 Bug**: loadVideo 时序问题 — video 元素依赖 Vue DOM 渲染，改用临时 video 元素获取元数据
- **知识沉淀需求**: 用户确认路由注册模式等项目知识应写入 L2/L3 记忆，减少后续上下文探索开销
- **错误日志**: 用户建议添加前端错误埋点系统，暂时先加 console 日志，后续可接入正式日志服务

## 未解决问题

- Phase 2a（记忆层 API）待实现
- 前端全局错误日志/埋点系统待设计
- 更多业务模块待选择和接入
