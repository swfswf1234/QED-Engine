# 计划索引

状态：Current
最后更新：2026-09-10

本目录保存对应**进行中任务的讨论与计划**（不确定文档，ADR 0010）；待评审设计随计划承载，
确定后按 [ADR 0011](../history/adr/v0.1/0011-pending-design-location.md) 迁入 `design/` 或合并固定文档。
完成后归档（`../history/plans/<year-month>/`）。文档分类与元数据规则见
[文档治理规范](../standards/doc-governance.md)。

## 目录边界

- 本索引只解释目录边界并链接任务台账，不维护第二张计划状态表。
- 活跃计划状态与任务清单见[任务台账](../trackers/todo.md)；关闭计划在事实
  同步且 Git 锚点有效后删除，或按归档规则进入 `../history/plans/<year-month>/`。

## 活跃计划

### 块 2：全流程交互逻辑（design 预备）
- ARCH-019，PLAN-023（**主文档**，全流程交互规范），状态见任务台账
- ARCH-019，PLAN-022（技术架构参考，挂靠 PLAN-023），状态见任务台账

### 联调问题
- REQ-068 配套，联调问题解决清单（活跃：ISSUE-001/002），状态见任务台账

### 治理与补登记（2026-09-10）
- PLAN-035/036 合并为 [文档下载管理页面交互规范](2026-09-10-downloads-interaction-spec.md)
  （课程详情弹窗状态机 + 书目详情确认下载链路），ARCH-019 补登记，规定和设计文档，
  实现已落地，状态见任务台账

### 其他
- REQ-032，Phase 1+2 已完成，Phase 3 暂缓
- [AI Agent 知识收件箱](ai-agent-knowledge-inbox.md)（REQ-062，**长期滚动收件箱**：agent
  利用经验捕获 → 审核三判据 → 批量晋升正式文档 → 体系优化；**不随任务归档**，例外依据见其头部声明）

## 已归档计划（2026-08）
- [文档下载管理界面优化（REQ-067 综合计划）](../history/plans/2026-08/2026-08-29-req067-downloads-optimization.md)（PLAN-025，已归档：§A/§B 全量完成（B1~B8 经 PLAN-033/034），设计事实迁入 [design/downloads-flow.md](../design/downloads-flow.md)；浏览器验收由用户手动导入轮执行）
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
- [文档与代码双向追溯规范精简计划（traceability-refactor）](../history/plans/2026-08/2026-08-30-traceability-refactor.md)（PLAN-027，已归档：内容确定后移出的规则已并入 standards/code-document-traceability.md）
- [架构文档 Mermaid 图设计计划（architecture-diagrams）](../history/plans/2026-08/2026-08-31-architecture-diagrams.md)（PLAN-029，已归档：合并至 architecture/ 三份固定文档）

## 已归档计划（2026-09）
- [design/ 文档体系固定化重构计划（REQ-070）](../history/plans/2026-09/2026-09-10-req070-design-restructure.md)（REQ-070，Achieved 2026-09-10：design/ 20 份 → 12 份语义名五组固定 + 2 份 plans/ 现状文档（REQ-070-PARS/070-LEARN）+ 6 份过时文档删除靠 git 恢复 + DesignRef 全量同步；契约 52 + 全量 401 passed；计划壳 Retain 归档）
- [AI 开发守则整合轮（REQ-069）](../history/plans/2026-09/2026-09-10-req069-ai-dev-conduct.md)（REQ-069，Achieved 2026-09-10：守则落位——AGENTS.md 变更分级边界节 + development.md 六步流程节 + design-bugfix-log 台账，ADR 0012；同轮治理 superpowers/ 违规目录删除 + PLAN-035/036 迁正 + api-contracts 端点补登记；计划壳 Retain 归档）
- [文档下载管理界面共享表优化（REQ-067 综合计划补充）](../history/plans/2026-09/2026-09-02-req067-shared-tables-optimization.md)（PLAN-028，已归档：成功标准 8/8 达成、门禁全绿（pytest 353 + ruff + vitest 160 + build + 契约 52）；浏览器手动导入轮验收由用户清库后执行）
- [文档下载管理领域探索 UI 逻辑与展示规范（arch019-explore-ui-logic）](../history/plans/2026-09/2026-09-08-arch019-explore-ui-logic.md)（PLAN-033，已归档：实现完成（2026-09-08 用户裁决四项 UI 改造 R1~R4 + 前端 F1~F6，门禁全绿），设计事实迁入 [design/downloads-flow.md](../design/downloads-flow.md)）
- [领域探索后端链路与端点契约（arch019-explore-backend-chain）](../history/plans/2026-09/2026-09-08-arch019-explore-backend-chain.md)（PLAN-034，已归档：5 端点实装 + 写点矩阵落地 + test_domain_explore.py 14 用例 + 契约登记（2026-09-08），设计事实迁入 [design/downloads-flow.md](../design/downloads-flow.md)；8901 移交清单为 REQ-068 持续跟踪）
- [领域探索状态机设计（exploration-state-machine）](../history/plans/2026-09/2026-09-07-exploration-state-machine.md)（已归档：被 PLAN-033 吸收合并，失败态口径由 PLAN-033 补齐）
- [领域探索状态机实施计划（exploration-state-machine-plan）](../history/plans/2026-09/2026-09-07-exploration-state-machine-plan.md)（已归档：Task 1~5 已落地，残余缺口由 PLAN-033 §4 承接）
- [控制台（Console）设计快照](../history/plans/2026-09/2026-09-01-console-design-snapshot.md)（PLAN-030，已归档：设计迁入 [design/admin-console.md](../design/admin-console.md)，内容被 PLAN-032 承接）
- [控制台重构与资源监控改造（console-refactor）](../history/plans/2026-09/2026-09-06-console-refactor.md)（PLAN-032，已归档：设计迁入 [design/admin-console.md](../design/admin-console.md) + [design/local-model-management.md](../design/local-model-management.md)）
- [文档下载管理界面修复计划（downloads-tree-fixes）](../history/plans/2026-09/2026-09-07-downloads-tree-fixes.md)（已归档：修复问题1-3，测试通过，构建成功）
- [仪表盘（Dashboard）设计快照](../history/plans/2026-09/2026-09-01-dashboard-design-snapshot.md)（PLAN-031，已归档：设计迁入 [design/admin-dashboard.md](../design/admin-dashboard.md)）
