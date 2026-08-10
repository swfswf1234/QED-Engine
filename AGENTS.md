# QED-Engine 项目总纲（Agent 执行入口）

## 项目目标

从公理到证明，重构数学认知边界。根仓库 **QED-Engine** 是三个子项目的总控：
构建**个人图书馆**（个人核心：数学 + 计算机科学（AI 方向），当前以高等数学起步），
提供学习界面（**学习中心**）、对 Axiom-Flow 与 QED-Tracker 的管理界面
（**管理中心** + **控制中心**），并集中管理模型/API-key/数据库配置。
项目仍处探索阶段，形态随学习需求持续演进。

- **学习中心**（前端主界面，规划中）：课程学习（按知识节点推进）+ 知识问答（多 Agent），
  是项目最终向用户展示的核心功能；管理功能是它的准备工作，对用户透明。
- **管理中心**（后台内容）：文档下载管理、文档解析进度、原始文档对照。
- **控制中心**（后台运行）：三 Python 服务启停托管；容器化依赖只进规划不展示。

## 仓库结构（本仓库不包含子项目代码）

```
QED-Engine/            # 本仓库（git：QED-Engine）
├── Axiom-Flow/        # 独立 git 仓库（PDF 解析/OCR/质量审阅，不进本仓库版本控制）
├── QED-Tracker/       # 独立 git 仓库（书籍/论文下载、校验、登记，不进本仓库版本控制）
├── dataset/           # 共享数据目录：原始文档 + 解析产物（git 忽略，仅保留目录骨架）
└── docs/              # 本仓库文档（导航入口见 docs/index.md）
```

- 进入 Axiom-Flow / QED-Tracker 目录工作前，**必须先读各自的 AGENTS.md**，遵守其分支与门禁规则。
- 不得把子项目代码提交到本仓库；`.gitignore` 已忽略，勿手动添加。

## 开发状态指针

**接手任何任务前，先读[项目状态快照](docs/architecture/project-status.md)**：四服务当前实现
状态、三中心定位与当前主线一览（30 秒了解项目到哪）。未关闭任务与未来方向分别见
[任务台账](docs/trackers/todo.md) 与[能力路线图](docs/trackers/roadmap.md)。

## 四个服务与独立性

| 服务 | 位置 | 端口 | 实现状态 | 职责 |
| --- | --- | --- | --- | --- |
| QED-Engine 前端 | 本仓库 `web/` | 8903 | 已运行 | 学习中心（建设中）+ 管理后台：仪表大盘 / 文档下载管理 / 文档解析进度 / 原始文档对照；**只连 8900**（ADR 0007） |
| QED-Engine 后端 | 本仓库 `backend/qed_engine/` | 8900 | 已运行 | 配置域（模型/API-key/数据库选择与状态探测，密钥不下发）+ 数据域网关（目录/资源/任务适配 8901）+ 服务域（/services 启停托管，控制中心已实装） |
| Axiom-Flow | 子仓库 | 8000 → 8902 迁移中 | 已实现 | 下载后文档的解析、OCR、图表/公式还原、质量审阅 |
| QED-Tracker | 子仓库 | 8901 | 已服务化 | 教材/习题集/论文的发现、下载、校验、登记 |

**独立性铁律**：Axiom-Flow 与 QED-Tracker 未启动时，QED-Engine 前端对话/展示必须正常；QED-Engine 后端离线时，前两者用本地默认配置降级运行。三个项目均可独立开发、独立部署。

## 文档入口

具体约束一律以 docs 正文为准，本文件不保存正文事实：

| 需要 | 入口 |
| --- | --- |
| 项目当前状态（开发状态指针） | [docs/architecture/project-status.md](docs/architecture/project-status.md) |
| 系统结构与服务边界 | [docs/architecture/](docs/architecture/index.md)，映射与实现状态见 [code-map.md](docs/architecture/code-map.md) |
| 服务契约、dataset 约定、统一配置接口 | [docs/design/](docs/design/index.md) |
| 工程治理规则（文档规范等） | `docs/standards/` 是工程治理规则的唯一事实源，入口 [docs/standards/](docs/standards/index.md)，具体采用 [任务生命周期](docs/standards/task-lifecycle.md)、[文档规范](docs/standards/documentation.md)、[ADR 治理](docs/standards/adr-governance.md)、[代码与文档追溯](docs/standards/code-document-traceability.md)、[测试架构与门禁](docs/standards/testing.md)、[工程治理契约](docs/standards/governance-contract.md)、[跨项目协作流程](docs/standards/cross-project-collaboration.md) |
| 开发/联调步骤 | [docs/guides/](docs/guides/index.md) |
| 未关闭任务与路线图 | [docs/trackers/](docs/trackers/index.md)，任务台账 [todo.md](docs/trackers/todo.md) |
| 长期决策（ADR） | [docs/adr/](docs/adr/index.md) |
| 全部入口汇总 | [docs/index.md](docs/index.md) |

## 协作流程

每项目独立走：**头脑风暴 → 设计文档 → 计划 → 实现（TDD）→ 验证 → 代码评审**。

- 技能清单（精简保留）：`brainstorming`、`writing-plans`、`executing-plans`、`subagent-driven-development`、`dispatching-parallel-agents`、`test-driven-development`、`systematic-debugging`、`verification-before-completion`、`requesting-code-review`、`receiving-code-review`。
- 已移出禁用：`using-git-worktrees`、`writing-skills`、`finishing-a-development-branch`（在 `~/.config/opencode/skills-disabled/` 备查）。
- 决策机制：关键决策由用户拍板（多选问答），agent 不擅自决定方向。
- **跨项目协作**：需要对方项目配合时，在对方仓库建设计文档 + todo 任务（请求），用户评审
  确认后由对方执行；不直接修改对方项目代码。规则见
  [跨项目协作流程](docs/standards/cross-project-collaboration.md)；收到对方发起的配合需求时，
  先评审后执行。
- 中文交流；文档默认中文，标识符/API 字段保持英文。

## 完成检查

1. 不把子项目文件或 dataset 数据加入本仓库索引。
2. 涉及子项目的改动在其仓库内完成并遵守其门禁。
3. 声称完成前已运行验证命令并展示输出。
4. 未获得明确要求不提交 git。
