# 2026-08 文档与架构重构轮（docs-refactor-round）

状态：Accepted
任务类型：A
最后更新：2026-08-09
关联 ADR：[ADR 0006](../adr/0006-engineering-governance-contract.md)（治理契约范本化，本轮治理基础）
关联设计：[项目状态快照](../architecture/project-status.md)（当前主线维护）
关联 Tracker：`docs/trackers/todo.md`（ARCH-008 登记；REQ-024 承接 ADR 重新治理；REQ-021 大变动同步）
归档判定：W1-W9 全部完成、REQ-024（ADR 重新治理）完成、门禁全绿、用户确认后关闭并归档

## 前置条件

- v0.1 版本目标已冻结（用户 2026-08-09 决定）：三项目完成初步目标——数学 13 门课程全链路
  与 QED-Engine 各功能实现，重构为完整可交付版本，预留未来扩展能力。
- 定位与控制中心决策已登记：ADR 0004（个人图书馆定位与三中心形态）、ADR 0005（控制中心
  服务托管规划）。
- 治理契约范本已生效：ADR 0006 + governance-contract.md（契约头/守护面清单/新增流程），
  契约测试基线 148 passed + ruff clean（2026-08-09）。

## 目标与成功标准

对齐 v0.1 版本目标：将 QED-Engine 文档与架构重新梳理为完整、自洽、可交付状态，作为三项目
重构与交付的文档基础。

成功标准：

1. docs/ 各子目录逐节审查完毕（adr/ 已完成；standards/、architecture/、design/、guides/、
   trackers/、plans/、learning/、history/ 依次过完）。
2. 架构文档与现状一致：四服务实现状态（8903 已运行、Axiom 8902 迁移中）、三中心定位、
   控制中心托管规划与既有 ADR/设计文档对齐。
3. 治理 ADR 重新治理完成（REQ-024）：贵精不贵多、边界区分、合理性审查、每次优化留记录。
4. `pytest tests -q` 全绿 + `ruff check src tests` 无错误；每节复核结论记入
   project-status.md 当前主线与 todo 证据列。

## 范围与非目标

范围内：

- docs/ 全子目录文档、元数据与契约测试守护面的一致性审查与回修。
- 根 README.md / AGENTS.md 定位与路由表述（大变动同步 REQ-021 的持续执行）。
- 架构文档回修：four-service-architecture.md（落后于现状）、code-map.md、project-status.md。

非目标：

- 不实现功能代码；文档审查暴露的实现偏差登记 todo 由后续轮承接。
- 不修改子项目文件（跨项目对齐走既有请求流程，如 REQ-022/REQ-023）。
- 不迁移历史基线；learning/ 个人资料自由组织不动。

## 工作项

| ID | 工作项 | 状态 |
| --- | --- | --- |
| W1 | adr/ 小节：ADR 0004/0005/0006 登记、ADR 治理规范修订（决策阶段定义/登记时机/大变动检查）、治理契约范本化（governance-contract.md + 契约头迁移 + 契约守护契约） | 已完成（2026-08-09，148 passed） |
| W2 | standards/ 小节：task-lifecycle、code-document-traceability、cross-project-collaboration、documentation 复核与回修 | 已完成（2026-08-09：任务类型收编、占位清理、7 处 index 规则节清理、「index 只导航」守护，150 passed） |
| W3 | architecture/ 小节：four-service-architecture.md 回修（8903 已运行/三中心/控制中心托管/8902 迁移态）、code-map.md 复核、project-status.md 持续更新 | 已完成（2026-08-09：架构文档回修到现状 + 技术栈选型 tech-stack.md + 数据库设计 database-design.md，150 passed） |
| W4 | design/ 小节：service-contracts、dataset-conventions、configuration-and-secrets、config-center-api 复核与对齐 | 已完成（2026-08-09：8903 前端契约独立成 web-frontend.md、service-contracts 瘦身、dataset 差距表/配置五接口等过时修复、tech-stack 模型收敛、关联 ADR 补齐，150 passed） |
| W5 | guides/ 小节：development.md 等指南复核（过时命令回修） | 待开始 |
| W6 | trackers/ 小节：todo 登记完整性、roadmap 与 v0.1 目标对齐、completed 台账 | 待开始 |
| W7 | plans/ 小节：活跃计划与 todo 镜像核对 | 待开始 |
| W8 | learning/ + history/ 小节：历史归档合规检查（baselines/plans 归档规则） | 待开始 |
| W9 | 治理 ADR 重新治理（REQ-024 承接）：既有 ADR 审查（贵精不贵多/边界区分/合理性/优化留痕）、adr-governance.md 原则固化 | 待开始（触发：W1-W8 完成后） |

## 验证与验收

- 每个工作项完成后运行 `pytest tests -q`（重点 tests/contract/）与 `ruff check src tests`。
- 契约测试先行：先更新守护再改正文（红→绿），失败即暴露漂移。
- 每节复核结论更新 project-status.md「当前主线」与 todo 证据列。
- 人工验收：用户抽查各节（标准索引、架构图与现状、指南命令可执行性、ADR 合理性）。

## 回滚

- 文档改动经 git 回滚；契约测试先行保证漂移早暴露。
- 计划与 ADR 状态回滚按 task-lifecycle 与 adr-governance 规则（Accepted 正文不静默改写）。

## 关闭与归档

- 关闭条件：W1-W9 全部完成、REQ-024 完成、门禁全绿、用户确认。
- 归档：计划关闭后按计划归档规则处理（Git 锚点有效可删除或按需归档 history/plans/）。
- v0.1 目标整体推进以 roadmap 方向行为准，后续执行轮各自建计划。
