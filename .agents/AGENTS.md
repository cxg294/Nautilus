# Nautilus AI 工作协议

> 本文件定义了 AI 助手在 Nautilus 项目中工作时必须遵守的协议。
> 每次对话开始时，AI 工具会自动加载本文件。

---

## 一、记忆系统协议

Nautilus 采用四层记忆架构（L0-L3），AI 助手必须按照以下规则读写记忆。

### 1.1 对话开始时（必须执行）

按以下顺序加载记忆：

1. **L2 全局记忆** — 读取 `infra/memory-layer/memories/semantic/global.md`
2. **L2 项目记忆** — 根据当前工作内容，读取对应的项目记忆文件：
   - Nautilus 本体: `infra/memory-layer/memories/semantic/nautilus/_project.md`
   - 子模块（如有）: `infra/memory-layer/memories/semantic/nautilus/<模块名>.md`
3. **L1 情景记忆** — 读取当前项目的情景记忆：`infra/memory-layer/memories/episodes/<project>.md`
4. **L0 工作记忆** — 读取 `infra/memory-layer/memories/scratchpad/current-task.md`

### 1.2 对话进行中

- 发现**新的持久性事实**（用户偏好、架构决策、技术选型等）：
  1. 更新到 L2 对应的语义记忆文件
  2. 在对话中告知用户："已更新到 L2 记忆：`<简要描述>`"
- 发现**新的可复用流程/SOP**：
  1. 写入 L3 程序记忆（`infra/memory-layer/memories/procedures/` 或 `.agents/workflows/`）
  2. 告知用户

### 1.3 阶段性工作完成时（即时蒸馏）

完成一个阶段性工作（如实现了一个功能、讨论完一个方案、解决了一个问题）后，**立即执行**以下操作，不等对话结束：

1. **更新 L1 情景记忆**：将本次要点与 `episodes/<project>.md` 中的已有记录**比对合并**
   - ⚠️ **严禁流水账**：不得每次新增条目，必须比对后更新已有记录
   - 过时信息必须替换，不得保留
2. **更新 L0 工作记忆**：刷新 `scratchpad/current-task.md` 中的当前焦点

> 为什么不等对话结束？因为 AI 没有"对话结束"的信号，且下次对话无法访问上一次的 artifact。
> 即时蒸馏确保记忆始终是最新的。

### 1.4 L1 → L2 自动提炼

- 当 L1 中反复出现某个事实时，自动提炼到 L2
- 提炼后在对话中告知用户："已更新到 L2 记忆：`<简要描述>`"
- 用户可随时查看和修改 L2 文件

---

## 二、记忆层级说明

| 层级 | 名称 | 存储方式 | 生命周期 |
|:---:|:---|:---|:---|
| L0 | 工作记忆 | Markdown 文件（`scratchpad/`） | 当前会话，即时刷新 |
| L1 | 情景记忆 | Markdown 文件（`episodes/`，每项目一个文件） | 中长期，比对更新 |
| L2 | 语义记忆 | Markdown 文件（`semantic/`，渐进式加载） | 永久 |
| L3 | 程序记忆 | Markdown 文件（`procedures/` 或 `.agents/workflows/`） | 永久 |

> 全部使用 Markdown 文件，确保 AI 可直接读写，不依赖后端服务。
> SQLite（`002_memory_episodes.sql`）保留用于未来管理界面的后端存储。

---

## 三、L2 语义记忆的渐进式加载

```
对话开始
  │
  ├─ 1. 始终加载: semantic/global.md
  │
  ├─ 2. 按项目加载: semantic/<project>/_project.md
  │
  └─ 3. 按模块加载: semantic/<project>/<module>.md（如需要）
```

---

## 四、项目通用规则

- 代码注释使用简体中文
- Agent 回复使用中文
- 页面文案根据多语言设置使用相应语言
- 遵循「基建优先」开发策略
- 所有新模块创建须遵循 `/new-module` 工作流
