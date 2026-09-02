# 计划索引

状态：Current
最后更新：2026-09-01

本目录保存对应**进行中任务的讨论与计划**（不确定文档，ADR 0010）；待评审设计随计划承载，
确定后按 [ADR 0011](../history/adr/v0.1/0011-pending-design-location.md) 迁入 `design/` 或合并固定文档。
完成后归档（`../history/plans/<year-month>/`）。文档分类与元数据规则见
[文档治理规范](../standards/doc-governance.md)。

## 目录边界

- 本索引只解释目录边界并链接任务台账，不维护第二张计划状态表。
- 活跃计划状态与任务清单见[任务台账](../trackers/todo.md)；关闭计划在事实
  同步且 Git 锚点有效后删除，或按归档规则进入 `../history/plans/<year-month>/`。

## 活跃计划

### 块 1：UI 设计（design 预备）
- ARCH-019，REQ-067/REQ-053 → plans/PLAN-025（REQ-067 综合计划），状态见任务台账

### 块 2：全流程交互逻辑（design 预备）
- ARCH-019，PLAN-023（**主文档**，全流程交互规范），状态见任务台账
- ARCH-019，PLAN-022（技术架构参考，挂靠 PLAN-023），状态见任务台账

### 其他
- REQ-032，Phase 1+2 已完成，Phase 3 暂缓
- 架构文档 Mermaid 图设计计划（架构补图）
- [AI Agent 知识收件箱](ai-agent-knowledge-inbox.md)（REQ-062，**长期滚动收件箱**：agent
  利用经验捕获 → 审核三判据 → 批量晋升正式文档 → 体系优化；**不随任务归档**，例外依据见其头部声明）

## 已归档计划（2026-08）
- [课程探索界面设计计划（探索界面）](../history/plans/2026-08/2026-08-23-arch019-exploration-ui.md)（PLAN-020，已归档：有效交互裁决并入 PLAN-023/REQ-067，探索流程基于废弃契约）
- [文档下载管理界面术语统一与排序优化计划](../history/plans/2026-08/2026-08-28-downloads-terminology-sorting.md)（PLAN-024，已归档：全部 6 项并入 REQ-067 §A）
- [教材下载轮计划（textbook-download-round）](../history/plans/2026-08/2026-08-05-textbook-download-round.md)（ARCH-002，已归档：概念被 ARCH-019 继承，数据模型已过时）
- [REQ-067 领域探索优化（B9-B12）](../history/plans/2026-08/2026-08-31-req067-explore-optimizations.md)（Draft，B10 Not Applicable / B12 Achieved，计划壳归档）
- [导入领域知识 API 契约（REQ-067-A 配套）](../history/plans/2026-08/2026-08-30-req067-import-api.md)（PLAN-026，Achieved 2026-09-01；契约确定后并入 architecture/api-contracts.md，计划壳归档）
- 课程探索 API 契约（arch019-exploration-api）（PLAN-021，Completed 2026-08-25；按归档判定 Delete 移除——事实并入 architecture/api-contracts.md，Git 锚点 0517e5d）

- [REQ-060 模型调用记录扩展与审核 UI（req060-llm-call-review）](../history/plans/2026-08/2026-08-req060-llm-call-review.md)（REQ-060，Completed 2026-08-24）

- [数据前置轮计划：数据库清理重置与统一数据根规范（arch019-data-foundation）](../history/plans/2026-08/2026-08-arch019-data-foundation.md)（ARCH-019 前置 PLAN-019，Completed 2026-08-23）

- [2026-08 LLM 网关与模型管理实施轮（llm-gateway-and-model-management）](../history/plans/2026-08/2026-08-llm-gateway-and-model-management.md)（ARCH-016，Completed 2026-08-23）
- [2026-08 文档规范与架构确定轮（docs-restructure-round）](../history/plans/2026-08/2026-08-docs-restructure-round.md)（ARCH-018，Completed 2026-08-21）
- [2026-08 后端三域拆分轮（backend-domain-refactor）](../history/plans/2026-08/2026-08-backend-domain-refactor.md)（ARCH-012，Completed 2026-08-21）
- [2026-08 文档与数据边界整理轮（docs-data-boundary-round）](../history/plans/2026-08/2026-08-docs-data-boundary-round.md)（ARCH-013，Completed 2026-08-21）
- [2026-08 LLM 状态收敛与 DB 启动快照轮（llm-status-convergence）](../history/plans/2026-08/2026-08-llm-status-convergence.md)（ARCH-014，Completed 2026-08-21）
- [2026-08 前端重构主轮（frontend-react-refactor）](../history/plans/2026-08/2026-08-frontend-react-refactor.md)（ARCH-011，Completed 2026-08-21）
- [2026-08 下载管理界面重构轮（downloads-manage-redesign）](../history/plans/2026-08/2026-08-downloads-manage-redesign.md)（ARCH-015，Completed 2026-08-21）
