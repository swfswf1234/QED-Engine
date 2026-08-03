# QED-Engine 项目总纲（Agent 执行入口）

## 项目目标

从公理到证明，重构数学认知边界。根仓库 **QED-Engine** 是三个子项目的总控：
提供高等数学学习界面、对 Axiom-Flow 与 QED-Tracker 的管理界面，并集中管理模型/API-key/数据库配置。

## 仓库结构（本仓库不包含子项目代码）

```
QED-Engine/            # 本仓库（git：QED-Engine）
├── Axiom-Flow/        # 独立 git 仓库（PDF 解析/OCR/质量审阅，不进本仓库版本控制）
├── QED-Tracker/       # 独立 git 仓库（书籍/论文下载、校验、登记，不进本仓库版本控制）
├── dataset/           # 共享数据目录：原始文档 + 解析产物（git 忽略，仅保留目录骨架）
└── docs/              # 本仓库文档（设计文档、学习资料等）
```

- 进入 Axiom-Flow / QED-Tracker 目录工作前，**必须先读各自的 AGENTS.md**，遵守其分支与门禁规则。
- 不得把子项目代码提交到本仓库；`.gitignore` 已忽略，勿手动添加。

## 四个服务与独立性

| 服务 | 位置 | 职责 |
| --- | --- | --- |
| QED-Engine 前端 | 本仓库 | 学习界面（知识点/练习/温故知新）、管理界面（解析进度、原始文档对照、追溯） |
| QED-Engine 后端 | 本仓库 | 统一配置中心：模型/API-key/数据库选择，向 Axiom-Flow、QED-Tracker 提供接口 |
| Axiom-Flow | 子仓库 | 下载后文档的解析、OCR、图表/公式还原、质量审阅 |
| QED-Tracker | 子仓库 | 教材/习题集/论文的发现、下载、校验、登记 |

**独立性铁律**：Axiom-Flow 与 QED-Tracker 未启动时，QED-Engine 前端对话/展示必须正常；QED-Engine 后端离线时，前两者用本地默认配置降级运行。三个项目均可独立开发、独立部署。

## dataset 约定（Phase 1 细化）

- 根目录 `dataset/` 存放原始文档与解析产物，是本项目（QED-Engine）目录的一部分；
- 子项目通过配置指向该目录写入/读取，具体子目录结构（raw/parsed 等）与读写契约见后续设计文档；
- 目录当前仅保留骨架（`.gitkeep`），数据文件不入库。

## 协作流程

每项目独立走：**头脑风暴 → 设计文档 → 计划 → 实现（TDD）→ 验证 → 代码评审**。

- 技能清单（精简保留）：`brainstorming`、`writing-plans`、`executing-plans`、`subagent-driven-development`、`dispatching-parallel-agents`、`test-driven-development`、`systematic-debugging`、`verification-before-completion`、`requesting-code-review`、`receiving-code-review`。
- 已移出禁用：`using-git-worktrees`、`writing-skills`、`finishing-a-development-branch`（在 `~/.config/opencode/skills-disabled/` 备查）。
- 决策机制：关键决策由用户拍板（多选问答），agent 不擅自决定方向。
- 中文交流；文档默认中文，标识符/API 字段保持英文。

## 完成检查

1. 不把子项目文件或 dataset 数据加入本仓库索引。
2. 涉及子项目的改动在其仓库内完成并遵守其门禁。
3. 声称完成前已运行验证命令并展示输出。
4. 未获得明确要求不提交 git。
