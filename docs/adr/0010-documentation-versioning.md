# ADR 0010：文档体系分层与版本治理（确定文档 / 相对确定 / 实时状态）

状态：Accepted
日期：2026-08-20
领域：工程治理
决策阶段：v0.1
取代：—
被取代：—

## 背景

项目从探索期进入稳定交付期，文档积累已覆盖全部子系统，但目录事实边界模糊：`architecture/`
混放固定架构与实时状态快照，API 契约与数据库设计散落在 `design/`，guides 未区分操作与开发。
2026-08-20 用户裁决重构文档体系，确立「确定文档 / 相对确定 / 实时状态」三层结构，并以
QED-Engine 为范本对齐 Axiom-Flow 与 QED-Tracker。结构调整改变了[文档规范](../standards/documentation.md)
的分类与事实归属（属 standards 实质规则变更），故本 ADR 先行登记。

## 决定

1. **architecture/ 只放确定文档**：总体架构（三项目四服务总览）、每个服务一份服务架构文档
   （QED-Engine 前后端两份，其相互联系与交互由总体架构确定；Axiom-Flow、QED-Tracker 各自
   在自身仓库维护）、固定 API 接口文档、数据库设计文档（总纲）、code-map.md。
   **实时状态快照 ../trackers/project-status.md 移入 trackers/**（与 todo/roadmap 同域）。
2. **版本机制**：当前版本 v0.1（跑通完整服务）。`adr/` 保持为当前版本的架构决策登记；
   版本末期（用户确认升版本时）将本版本 ADR 决策合并进 architecture/ 或其他固定文档，
   `history/` 记录前版本。API 与数据库等固定文档的变更设计先在 plans/（不确定文档）中
   进行，版本末期确认后更新进 architecture/，更新前旧版本进 history/。
3. **design/ 为相对确定的设计文档**：相关任务完成后按「合并进确定文档 / 归档 history /
   保持原状」三态梳理，与 todo 任务关联（任务关闭时检查其设计文档去向）。
4. **guides/ 为人类可读文档**：操作文档（启停服务等各类操作）+ 开发文档（介绍项目怎么开发），
   与根 README 用户手册一致；每个主线 TODO 任务完成后梳理是否更新。
5. **trackers/ 主线归并**：每次主线 TODO 任务完成后梳理，完成的任务移入 completed.md；
   主线轮次集中承载支线任务。
6. **plans/ 对应进行中任务的讨论与计划**（不确定文档），完成后归档或将有用信息合并到
   design/ 等确定性文档；**learning/ 为 QED-Engine 独有**，第四轮主线（Axiom-Flow 探索轮）
   开始时再进行学习探索。

## 后果

- 好处：文档事实边界清晰——architecture/ 稳定可依赖，trackers/ 反映实时状态，design/ 按
  任务演进；版本机制保证固定文档与版本强绑定，历史可追溯。
- 成本：本轮需同步调整全部目录索引、AGENTS.md 路由与契约测试守护面；子项目以 QED-Engine
  为范本对齐（含其契约测试），由对方项目执行并回执。
- 风险：固定文档「版本末期才更新」可能滞后于实现；以"变更设计先入 plans/ + 版本末期确认
  更新"缓解，重大契约变更仍按 ADR 流程登记。

## 关联

- 关联设计：`docs/architecture/api-contracts.md`、`docs/architecture/../architecture/database-design.md`
  （本轮新建固定文档）、`docs/design/`（相对确定设计文档）
- 关联架构：`docs/architecture/four-service-architecture.md`（总体架构）、
  `docs/architecture/frontend-architecture.md`、`docs/architecture/backend-architecture.md`、
  `docs/architecture/code-map.md`
- 关联规范：[文档规范](../standards/documentation.md)、[ADR 治理规范](../standards/adr-governance.md)、
  [任务生命周期](../standards/task-lifecycle.md)（本轮同步修订）
- 关联 ADR：[ADR 0001](0001-root-contract-tests.md)（工程治理契约测试）、
  [ADR 0006](0006-engineering-governance-contract.md)（治理契约范本）
