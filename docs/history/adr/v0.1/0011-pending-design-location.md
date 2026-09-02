# ADR 0011：待评审设计的目录流转（Draft 设计先入 plans/，确定后落 design/）

状态：Accepted
日期：2026-08-23
领域：工程治理
决策阶段：v0.1
取代：—
被取代：—

## 背景

[ADR 0010](0010-documentation-versioning.md) 确立了「确定文档 / 相对确定 / 实时状态」三层结构，
并规定 API 与数据库等固定文档的变更设计先在 `plans/` 进行、确认后落固定文档。但该规则未覆盖
`design/` 本身的新增入口：实践中出现 Draft 状态的设计文档直接落在 `design/`（如
exploration.md、learning-center.md），与「`plans/` 收不确定文档、`design/` 收相对确定文档」
的分层意图不符——待评审内容混入确定性文档目录，读者无法凭目录判断可信度。

2026-08-23 用户裁决（ARCH-019 第二轮主线·课程下载轮启动时）：待审核的计划与设计一律写在
`plans/`，完成/完全确定后再写入 `design/` 或 `adr/` 等固定文档目录。该裁决改变
[文档规范](../standards/documentation.md) 的分类事实边界（属 standards 实质规则变更），故本
ADR 先行登记。

## 决定

1. **Draft 设计不进 `design/`**：任何未定稿、待评审的设计内容（界面设计、接口契约草案、
   流程方案等）一律在其所属任务的计划文档中承载（`docs/plans/`，命名遵循
   `<YYYY-MM>-<slug>.md`）。
2. **确定的迁移时机**：计划中的设计内容经用户评审完全确定后，以稳定文件名（不含日期前缀）
   迁入 `design/`（设计状态标 Accepted）；属架构级契约的合并进 `architecture/` 固定文档；
   计划壳按任务生命周期关闭归档。
3. **被否决的设计**：评审否决的内容随计划关闭（Cancelled）处理，不迁入 `design/`；
   含审计价值的按归档规则进 `history/plans/<year-month>/`。
4. **存量豁免**：已存在于 `design/` 的 Draft 文档（exploration.md、learning-center.md）
   就地保留、不再迁移，避免链接断裂；仅新文档适用本规则。存量文档在其任务收尾三态梳理时
   一并消化。
5. **子项目对齐**：QED-Tracker 与 Axiom-Flow 的文档体系以本规则为范本对齐（等效条款写入
   各自 standards，存量豁免同理），由各自仓库执行并回执。

## 后果

- 好处：目录即可信度标签——`design/` 内全部为已确定设计，`plans/` 内为进行中讨论与待评审
  设计；评审状态与物理位置一致，消除「Draft 混居」歧义。
- 成本：设计确定时多一次文件迁移与引用更新；计划文档体积增大（承载设计正文）。
- 风险：迁移遗漏导致双份事实；由任务关闭时的三态梳理检查项兜底（关联 Tracker 列必须登记
  目标设计文档去向）。

## 关联

- 关联规范：[文档规范](../standards/documentation.md)（本轮同步修订）、
  [任务生命周期](../standards/task-lifecycle.md)（计划准入既有规则不变）、
  [ADR 治理规范](../standards/adr-governance.md)
- 关联 ADR：[ADR 0010](0010-documentation-versioning.md)（三层结构与版本机制，本 ADR 细化
  其 design/ 入口规则）
