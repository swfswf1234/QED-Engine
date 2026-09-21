# 计划索引

状态：Current
最后更新：2026-09-21

本目录保存对应**进行中任务的讨论与计划**（不确定文档，ADR 0010）；待评审设计随计划承载，
确定后按 [ADR 0011](../history/adr/v0.1/0011-pending-design-location.md) 迁入 `design/` 或合并固定文档。
完成后归档（`../history/plans/<year-month>/`）。文档分类与元数据规则见
[文档治理规范](../standards/doc-governance.md)。

## 目录边界

- 本索引只解释目录边界并链接任务台账，不维护第二张计划状态表。
- 活跃计划状态与任务清单见[任务台账](../trackers/todo.md)；关闭计划在事实
  同步且 Git 锚点有效后删除，或按归档规则进入 `../history/plans/<year-month>/`。

## 活跃计划

### 现状承载（2026-09-10）
- REQ-070-LEARN（学习功能现状），状态见任务台账

### ARCH-020 解析联调轮（2026-09-14）
- PLAN-044（文档解析管理·与 Axiom-Flow 交互全链路），状态见任务台账

### 其他
- [AI Agent 知识收件箱](ai-agent-knowledge-inbox.md)（REQ-062，**长期滚动收件箱**：agent
  利用经验捕获 → 审核三判据 → 批量晋升正式文档 → 体系优化；**不随任务归档**，例外依据见其头部声明）

## 已归档计划（2026-09）
- [模型注册表与三接口统一轮（llm-registry-unification）](../history/plans/2026-09/2026-09-16-llm-registry-unification.md)（PLAN-046 / ARCH-023，Achieved 2026-09-21：registry/runtimes + 四段式 env + 控制台三卡 W1~W9 落地，W7/W10 真实冒烟全绿（含 BUGFIX-008 api 回退链尊重 .env）；设计事实并入 [design/llm-gateway.md](../design/llm-gateway.md) 与 [design/local-model-management.md](../design/local-model-management.md)，壳归档）
- [解析界面单屏回调轮（parsing-sidebar-single-view）](../history/plans/2026-09/2026-09-20-parsing-sidebar-single-view.md)（ARCH-020-G，Achieved 2026-09-20：单屏「左树纯选择+右对照」定档，R1~R5 全段+复审修正 BUGFIX-007；裁决并入 [design/parsing-ui.md](../design/parsing-ui.md)，壳归档）
- [解析界面工作台重设计轮（parsing-workbench-redesign）](../history/plans/2026-09/2026-09-20-parsing-workbench-redesign.md)（ARCH-020-WB，Partial 2026-09-20：设计并入 parsing-ui.md、D 轮实现成果保留；两级界面形态被 G 轮裁决取代，壳归档）
- [解析界面展示优化轮（parsing-display-round）](../history/plans/2026-09/2026-09-20-parsing-display-round.md)（ARCH-020-UI，Achieved 2026-09-20：大屏/A4 基准/原始文件优先并入 parsing-ui.md（BUGFIX-006），产物版本划分归 dataset-conventions/REQ-080；壳归档）
- [本地模型部署轮（local-model-deployment）](../history/plans/2026-09/2026-09-14-local-model-deployment.md)（PLAN-045，Achieved 2026-09-14：MinerU 去模型化镜像重建 + 卷挂载 + mineru.json 路径校准 + 探针端点校准 + 8900 集成 + 真实解析冒烟；事实并入 [design/local-model-management.md](../design/local-model-management.md) 与 `scripts/image-model/README.md`）
- [文档解析管理·前端设计（parsing-ui）](../history/plans/2026-09/2026-09-14-parsing-management-frontend-design.md)（PLAN-043，Achieved 2026-09-14：设计定稿并经用户评审确认，晋升 [design/parsing-ui.md](../design/parsing-ui.md)；实现归 ARCH-020-D，后端全链路归 PLAN-044）
- [本地模型管理整理轮（local-model-management-reorg）](../history/plans/2026-09/2026-09-14-local-model-management-reorg.md)（PLAN-042，Achieved 2026-09-14：TEXT_SCRIPT 硬伤修复 + Qwen 切 llama.cpp + 槽位目录/manifest + 全量去 LM Studio + MinerU 清理核查；设计事实并入 [design/local-model-management.md](../design/local-model-management.md)，部署另起 PLAN-045）
- [文档解析管理界面优化（ARCH-020 前端部分）](../history/plans/2026-09/2026-09-14-arch020-parsing-ui-redesign.md)（Superseded，2026-09-14 随 ARCH-020 重构归档：内容并入 [design/parsing-ui.md](../design/parsing-ui.md)）
- [文档解析管理现状（Parsing）](../history/plans/2026-09/2026-09-10-parsing-management-current-state.md)（REQ-070-PARS，Achieved 2026-09-14：现状事实并入 [design/parsing-ui.md](../design/parsing-ui.md) 与 PLAN-044 后退役归档）
- [REQ-032 meta/ JSON 退役计划](../history/plans/2026-09/2026-09-01-req032-meta-json-retirement.md)（REQ-032，已归档：Phase 1+2 完成，Phase 3 暂缓）
- [文档探索+下载全流程计划（exploration-download-flow）](../history/plans/2026-09/2026-08-27-exploration-download-flow.md)（PLAN-022，Achieved 2026-09-11：B1-B5/F1-F5 全量执行，状态机/交互事实源迁 [design/downloads-flow.md](../design/downloads-flow.md)；随 ARCH-019 收尾归档）
- [文档下载管理页面交互规范（downloads-interaction-spec）](../history/plans/2026-09/2026-09-10-downloads-interaction-spec.md)（PLAN-037，Achieved 2026-09-11：课程详情弹窗状态机 + 书目详情确认下载链路；实现落地，随 ARCH-019 收尾归档）
- [文档下载管理全链路文档对齐轮（downloads-doc-alignment）](../history/plans/2026-09/2026-09-11-downloads-doc-alignment.md)（PLAN-038，Achieved 2026-09-11：领域 6 态/课程 5 态/书籍 8 值/UI 5 档口径统一；契约 63 passed）
- [统一上传与书目详情界面优化（unified-upload-book-detail）](../history/plans/2026-09/2026-09-11-unified-upload-book-detail.md)（PLAN-039，Achieved 2026-09-11：multipart 上传 + 书目详情重设计；门禁全绿）
- [8900 书籍路由集对齐（book-route-alignment）](../history/plans/2026-09/2026-09-11-book-route-alignment.md)（PLAN-040，Achieved 2026-09-11：`POST /books` 目标契约/201 + `cancel` + 删旧端点；门禁全绿）
- [领域探索阶段修正与第二轮主线收尾（arch019-stage-fixes-closeout）](../history/plans/2026-09/2026-09-11-arch019-stage-fixes-closeout.md)（PLAN-041，Achieved 2026-09-11：`已生成` 可探索 + 离线默认 `未开始` + 导入 409 修复；随 ARCH-019 收尾归档）
- [联调问题解决清单（QED-Engine ↔ QED-Tracker）](../history/plans/2026-09/2026-09-08-integration-issues-checklist.md)（REQ-068-PLAN，Achieved 2026-09-11：ISSUE-001~008 全部 Closed，随 ARCH-019 收尾归档）

## 已归档计划（2026-08）
- [文档下载全流程交互规范（ARCH-019）](../history/plans/2026-08/2026-08-27-download-ux-flow.md)（PLAN-023，已归档：Superseded——旧 8 态按钮矩阵、教程 reject/supersede/complete、探索弹窗流与 mock 与现行设计冲突；状态机与交互事实源迁 [design/downloads-flow.md](../design/downloads-flow.md) / [downloads-ui.md](../design/downloads-ui.md)）
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
- 根开发指南重整（dev-guide-rework，已删除：REQ-072 关闭，事实并入 `docs/guides/development.md`、`docs/guides/index.md`、`docs/standards/local-dev.md`；Delete 判定）
- Agent 开发流程规范体系（agent-doc-governance，已删除：REQ-071 关闭，事实并入新增 `standards/code-standards.md`、`standards/storage-conventions.md`、`AGENTS.md` 骨架与 ADR 0013；Delete 判定）
- [课程详情弹窗状态机优化（course-detail-state-machine）](../history/plans/2026-09/2026-09-09-course-detail-state-machine.md)（PLAN-035，已归档：合并入 PLAN-037 文档下载管理页面交互规范，DEFECT-002 治理合规化）
- [书目详情"确认下载"链路重构（book-detail-download-flow）](../history/plans/2026-09/2026-09-09-book-detail-download-flow.md)（PLAN-036，已归档：合并入 PLAN-037 文档下载管理页面交互规范，DEFECT-002 治理合规化）
- 知识 API 对接与 exploration_stage 修复（knowledge-api-and-exploration-stage，已删除：实现事实并入 [architecture/api-contracts.md](../architecture/api-contracts.md) 的 PATCH/DELETE knowledge 端点登记，Git 锚点 fc7a94c）
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
