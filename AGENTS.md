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

**接手任何任务前，先读[项目状态快照](docs/trackers/project-status.md)**：四服务当前实现
状态、三中心定位与当前主线一览（30 秒了解项目到哪）。未关闭任务与未来方向分别见
[任务台账](docs/trackers/todo.md) 与[能力路线图](docs/trackers/roadmap.md)。

**文档优先级**：agent 与项目开发优先读取**已确认文档**（当前：`standards/doc-governance.md`、
`standards/local-dev.md`；`architecture/`、`design/` 与其余 standards 文档目前为**暂定**，可读
可执行但待评审）。文档链路规则见[文档治理规范](docs/standards/doc-governance.md)。

## 四个服务与独立性

| 服务 | 位置 | 端口 | 实现状态 | 职责 |
| --- | --- | --- | --- | --- |
| QED-Engine 前端 | 本仓库 `web-ui/`（构建产物 dist/ 由 serve_web.py 托管） | 8903 | 已运行 | 学习中心（建设中）+ 管理后台：控制台 / 仪表盘 / 文档下载管理 / 文档解析管理（含解析进度、原始文档对照两个子视图）；**只连 8900**（ADR 0007） |
| QED-Engine 后端 | 本仓库 `backend/qed_engine/` | 8900 | 已运行 | 三域组织（ARCH-012）：控制域（配置五端点 + /services 启停托管 + /logs、/monitor/gpu、lmstudio、mineru、/self-restart 监控诊断）+ 数据域·QED-Tracker（目录/三表/任务适配 8901）+ 数据域·Axiom-Flow（预留）；密钥不下发 |
| Axiom-Flow | 子仓库 | 8902（已迁移，8000 兼容保留） | 已实现 | 下载后文档的解析、OCR、图表/公式还原、质量审阅 |
| QED-Tracker | 子仓库 | 8901 | 已服务化 | 教材/习题集/论文的发现、下载、校验、登记 |

**独立性铁律**：Axiom-Flow 与 QED-Tracker 未启动时，QED-Engine 前端对话/展示必须正常；QED-Engine 后端离线时，前两者用本地默认配置降级运行。三个项目均可独立开发、独立部署。

## 文档入口

具体约束一律以 docs 正文为准，本文件不保存正文事实：

| 需要 | 入口 |
| --- | --- |
| 项目当前状态（开发状态指针） | [docs/trackers/project-status.md](docs/trackers/project-status.md) |
| 系统结构与服务边界（固定架构文档） | [docs/architecture/](docs/architecture/index.md)：总体架构、服务架构、固定 API 文档（[api-contracts.md](docs/architecture/api-contracts.md)）、数据库总纲（[database-design.md](docs/architecture/database-design.md)）、映射见 [code-map.md](docs/architecture/code-map.md) |
| 服务契约、dataset 约定、统一配置接口（相对确定设计文档） | [docs/design/](docs/design/index.md) |
| 工程治理规则（文档规范等） | `docs/standards/` 是工程治理规则的唯一事实源，入口 [docs/standards/](docs/standards/index.md)，具体采用 [任务生命周期](docs/standards/task-lifecycle.md)、[文档治理规范](docs/standards/doc-governance.md)、[ADR 治理](docs/standards/adr-governance.md)、[代码与文档追溯](docs/standards/code-document-traceability.md)、[测试架构与门禁](docs/standards/testing.md)、[跨项目协作规范](docs/standards/cross-project-collaboration.md)（已确认：文档治理规范、本地开发环境、代码与文档追溯、跨项目协作规范、ADR 治理；其余暂定） |
| 本地开发环境 | [docs/standards/local-dev.md](docs/standards/local-dev.md)：机器标识、环境依赖、构建命令与开发约定 |
| 开发/联调步骤 | [docs/guides/](docs/guides/index.md) |
| 未关闭任务与路线图 | [docs/trackers/](docs/trackers/index.md)，任务台账 [todo.md](docs/trackers/todo.md) |
| 长期决策（ADR） | [docs/adr/](docs/adr/index.md) |
| 全部入口汇总 | [docs/index.md](docs/index.md) |

## 协作流程

每项目独立走：**头脑风暴 → 设计文档 → 计划 → 实现（TDD）→ 验证 → 代码评审**。

- 技能清单（精简保留）：`brainstorming`、`writing-plans`、`executing-plans`、`subagent-driven-development`、`dispatching-parallel-agents`、`test-driven-development`、`systematic-debugging`、`verification-before-completion`、`requesting-code-review`、`receiving-code-review`。
- 已移出禁用：`using-git-worktrees`、`writing-skills`、`finishing-a-development-branch`（在 `~/.config/opencode/skills-disabled/` 备查）。
- 决策机制：关键决策由用户拍板（多选问答），agent 不擅自决定方向。
- **跨项目协作**：规则见[跨项目协作规范](docs/standards/cross-project-collaboration.md)。
  核心要点：① 根仓库 agent 在子项目工作区只读+写文档，不得产生代码改动；② 子项目 git
  提交/推送不归根仓库 agent 执行；③ 误产生的代码改动须登记移交。
- 中文交流；文档默认中文，标识符/API 字段保持英文。

## 变更分级与边界（AI 开发守则）

本项目以**文档控制代码**：先文档后实现，实现完成后文档与代码同步收口。任何改动先按下表
定级，再按[开发指南·AI 开发工作流程](docs/guides/development.md)六步模式执行；本节只保留
边界判据，流程细则与治理正文见 development.md 与 [文档治理规范](docs/standards/doc-governance.md)。

| 变更对象 | 定级 | 前置动作 |
| --- | --- | --- |
| `docs/architecture/`（固定架构：总体/服务架构、API 设计、数据库设计、服务架构总体框架等） | 大修改 | 必须先建 todo 任务 + `plans/` 改造计划，评审后才动文档与代码 |
| `docs/` 目录结构（新建/删除/移动目录或治理类目，判例：曾出现的 `docs/superpowers/`） | **阻止项** | 默认阻止；仅人类明确同意且建 todo + `plans/` 改造计划后方可执行 |
| `docs/design/` 大变更（新增/重写设计契约） | 大修改 | todo + `plans/` 计划，评审确认后晋升固定文档 |
| `docs/design/` 小修改或 bug（错漏修正、行为与设计不符的小修） | 小修改 | 登记[设计类小修与 bug 修复台账](docs/plans/design-bugfix-log.md)（无则新建）并补充设计文档，不单独立项 |
| 一般小改（措辞、链接、错别字、无行为修正） | 豁免 | 差异 + 验证记录承接，不入 todo |

- **未定级不实施**：无法判定属于哪级时询问用户，不擅自降级或跳过前置动作。
- 任务分类器（[任务生命周期](docs/standards/task-lifecycle.md)，暂定）的 A/B/C/D 分类与
  准入规则可随守则演进重构，调整走 `plans/` 计划（ADR 0012）。
- `standards/` 实质规则变更仍按[文档治理规范·变更与取代](docs/standards/doc-governance.md)
  先立 ADR。

## 执行规范

### 本地环境识别

当 agent 检测到当前机器 UUID 为 `2C6ECD2C-BBEE-11ED-8A95-F0D4154ABBA8` 时，必须遵循 [本地开发环境](docs/standards/local-dev.md) 中的配置约定，其他环境需复制该文档并修改 UUID 和主机名。

### 文档治理遵守

修改文档或执行 todo 任务时，必须遵守 [文档治理规范](docs/standards/doc-governance.md) 中的规定，包括文档生命周期、确认状态和归档规则。

## 完成检查

1. 不把子项目文件或 dataset 数据加入本仓库索引。
2. **未在 Axiom-Flow / QED-Tracker 工作区产生代码改动**（文档修改与任务登记除外；若产生，
   已登记移交由对方审阅）。
3. 涉及子项目的改动在其仓库内完成并遵守其门禁。
4. 声称完成前已运行验证命令并展示输出。
5. 未获得明确要求不提交 git。
