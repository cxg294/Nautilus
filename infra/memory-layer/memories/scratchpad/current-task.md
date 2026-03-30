# 当前工作焦点

> 此文件由 AI 助手在完成阶段性工作后即时更新，记录当前工作状态。

---

## 活跃项目
- **Nautilus** — 个人万用工作台

## 当前阶段
- Phase 0 脚手架 ✅
- Phase 0.5 Soybean Admin 迁移 ✅
- Phase 1 认证系统 ✅
- 业务模块开发（9 个已上线 + 6 个锁定占位）✅
- 飞书 CLI 基础设施 ✅
- 插件化架构改造 ✅

## 最近完成（2026-03-31）
- 插件化架构改造：manifest.json 自注册 + plugin-scanner.ts 编译时扫描
- 为所有 14 个工具创建 manifest.json
- 路由/i18n/类型系统全面改造，新增工具零共享文件修改
- `/new-module` 工作流更新为插件化流程
- 导航重构为五大分类

## 下一步
- 插件化 Phase 2：工具内部 page 翻译迁移到工具目录
- CI/CD：manifest.json schema 校验 + pre-commit hook
- Phase 2a 记忆层 API
- Phase 2b 飞书桥接（Lark CLI 已就绪）
- 认知卸载 MVP 验证
- 或开始开发锁定工具（解锁占位模块）

## 阻塞项
- 飞书用户身份登录：需 `offline_access` scope 审批，暂时搁置
- sb3-studio / effects-generator 有预先存在的 TypeScript 类型错误
