# ADR 0009：qed 库新增 qed_* 共享表族（课程体系元数据跨项目共享）

状态：Accepted
日期：2026-08-16
领域：架构与边界
决策阶段：v0.1
取代：—
被取代：—

## 背景

[ADR 0003](0003-shared-qed-database-independence.md) 规定 qed 库表命名空间隔离：QED-Tracker
使用 `qt_*`、Axiom-Flow 使用 `af_*`，互不读取对方表。QED-Tracker 知识层次重构（QED-031，
见其 `docs/design/database-schema.md`）需要**跨项目共享的课程体系元数据**：领域（qed_domain）
与课程（qed_course，含阶段/先修/别名/学习顺序）。这些元数据是三项目共用的基础事实（8903
前端展示课程层次、Axiom-Flow 解析挂靠课程均需读取），单一项目私有前缀（`qt_*`/`af_*`）无法
表达"只读共享"语义；此前课程体系只存于 QED-Tracker 的 `courses/math.json` 单项目 JSON。

## 决定

1. **新增 `qed_*` 共享前缀表族**（qed 库内）：承载三项目共用的基础元数据，当前为
   `qed_domain`（领域）与 `qed_course`（课程）；后续新增共享表须先登记根仓库
   `docs/architecture/../architecture/database-design.md`。
2. **所有权 QED-Tracker**：共享表由 QED-Tracker 的 Alembic 建表与维护（写入）；
   Axiom-Flow 与 QED-Engine **只读不写**；schema 变更以 QED-Tracker
   `docs/design/database-schema.md` 为唯一事实源，先更新根仓库登记再迁移。
3. **命名空间隔离修订**：`qt_*` / `af_*` 互不读取规则不变；`qed_*` 为明确的三项目共享例外
   （仍遵守"不写入对方私有表"）。
4. **课程体系 JSON 退役**：QED-Tracker `courses/math.json` 数据迁入共享表后退役，
   课程体系唯一事实源为 `qed_domain`/`qed_course`。

## 后果

- 好处：课程层次单一事实源，三项目免于各自复制 JSON；前端与 Axiom-Flow 直接经共享表读取。
- 风险：共享表 schema 变更影响三项目——以"先根仓库登记 + 所有权唯一 + 只读消费"缓解；
  QED-Tracker 修改共享表须保证向后兼容（只加列不删列）。
- 补充关系：本 ADR 是 ADR 0003 决定的部分补充（共享例外），不改变 0003 状态。

## 关联

- 关联设计：`docs/architecture/../architecture/database-design.md`（表命名空间与 qed_* 共享表清单登记）、
  `docs/design/service-contracts.md`（统一数据库章节、对接点表）、
  QED-Tracker `docs/design/database-schema.md`（qed_*/qt_* 表唯一事实源）
- 关联 ADR：[ADR 0003](0003-shared-qed-database-independence.md)（本决定为其补充）
- 关联计划：QED-Tracker QED-031（知识层次数据库重构，`docs/trackers/todo.md`）
