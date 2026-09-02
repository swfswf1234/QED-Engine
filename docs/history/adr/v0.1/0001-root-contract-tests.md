# ADR 0001：根仓库建立工程治理契约测试

状态：Superseded
日期：2026-08-04
领域：工程治理
决策阶段：v0.1
取代：—
被取代：—

## 背景

`docs/standards/doc-governance.md` 原声明"根仓库不复制子项目的文档契约测试"，文档目录、元数据
与链接规则依赖人工审阅。本轮根仓库文档体系扩展（多份标准、ADR、架构、计划、学习资料），人工
审阅无法可靠守门，需要自动契约测试保护已采纳的治理规则。

## 决定

1. 根仓库在 `tests/contract/` 建立精简治理契约测试，守护标准、ADR、计划、tracker、文档结构、
   链接、架构/设计元数据与代码映射（DesignRef）。
2. 根仓库 `docs/standards/` 补齐 `task-lifecycle.md`、`adr-governance.md`、
   `code-document-traceability.md`、`testing.md`，与 Axiom-Flow 对应标准语义一致，作为三项目
   治理模式的上游参照；子项目各自维护自己的标准副本。
3. 更新 `doc-governance.md` 的"执行与门禁"章节：根仓库文档变更由契约测试守护，不再声明"不复制
   契约测试"。

## 后果

- 文档变更必须在提交前通过 `tests/contract/` 门禁，降低治理规则漂移风险。
- 根仓库测试规模扩大，但全部为纯标准库文件解析，不引入额外依赖。
- 子项目保持各自契约测试不变；本 ADR 不影响子项目门禁。
- 新增或修改标准、ADR、计划的规则时，须同步更新对应契约测试。

## 关联

- 关联标准：`docs/standards/doc-governance.md`、`docs/standards/adr-governance.md`、
  `docs/standards/code-document-traceability.md`、`docs/standards/testing.md`
- 关联测试：`tests/contract/` 全部测试文件
- 关联 ADR：[ADR 0002](0002-frontend-and-port-centralization.md)（同轮治理对齐）
