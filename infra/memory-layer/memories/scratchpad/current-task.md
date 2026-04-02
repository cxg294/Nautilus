# 当前工作焦点

> 此文件由 AI 助手在完成阶段性工作后即时更新，记录当前工作状态。

---

## 活跃项目
- **Nautilus** — 个人万用工作台

## 当前阶段
- Phase 0 脚手架 ✅
- Phase 0.5 Soybean Admin 迁移 ✅
- Phase 1 认证系统 ✅
- 业务模块开发（9 个已上线 + 5 个锁定占位）✅
- 飞书 CLI 基础设施 ✅
- 插件化架构改造 ✅
- BTC 课程流转数据看板 v3 ✅（功能完成，待 NaiveUI 组件重构）

## 最近完成（2026-04-02）
- BTC 课程流转数据看板 v3：透视分析、期次趋势、课程对比、完课漏斗 四模式
- 透视图增加 L1 领取率折线 + 领号人数柱状图（双 Y 轴）
- 趋势图过滤低样本期次（attend_1 < 10）
- 布局一致性修复（width:100% 消除 Tab 跳跃）
- **UI 组件规范写入 L2 记忆**：完整的 NaiveUI 组件对照表 + 暗色模式适配规则

## 下一步
- ⚠️ **BTC 看板 NaiveUI 重构**：将手写 button/select/table 替换为 NTabs/NSelect/NDataTable 等
- 插件化 Phase 2：工具内部 page 翻译迁移到工具目录
- Phase 2a 记忆层 API
- Phase 2b 飞书桥接（Lark CLI 已就绪）
- 或解锁其他占位模块

## 阻塞项
- 飞书用户身份登录：需 `offline_access` scope 审批，暂时搁置
- sb3-studio / effects-generator 有预先存在的 TypeScript 类型错误
