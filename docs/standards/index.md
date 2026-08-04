# 规范索引

状态：Current
最后更新：2026-08-04

本目录是工程治理规则的唯一事实源。根 [AGENTS.md](../../AGENTS.md) 负责快速路由，指南负责操作
步骤，ADR 负责决定及理由；这些位置不得复制标准正文。

| 标准 | 治理对象 | 权威产物 | 自动门禁 |
| --- | --- | --- | --- |
| [任务生命周期](task-lifecycle.md) | 任务分类、计划准入、tracker 状态、实施门禁与关闭交付 | 计划正文及 tracker | `tests/contract/test_plan_governance.py`、`tests/contract/test_tracker_governance.py` |
| [文档规范](documentation.md) | 文档分类、写作、元数据、索引、命名、归档与删除 | 当前文档树及 History | `tests/contract/test_document_structure.py`、`tests/contract/test_markdown_links.py`、`tests/contract/test_standard_governance.py` |
| [ADR 治理规范](adr-governance.md) | ADR 准入、全局编号、元数据、状态、取代关系与归档路径 | ADR 正文及 ADR index | `tests/contract/test_adr_governance.py` |
| [文档与代码双向追溯规范](code-document-traceability.md) | code-map、模块 DesignRef、架构/设计关联和语义同步门禁 | `docs/architecture/code-map.md` | `tests/contract/test_code_document_mapping.py`、`tests/contract/test_architecture_documents.py`、`tests/contract/test_design_documents.py` |
| [测试架构与门禁](testing.md) | 测试职责、分层、隔离、替身、门禁与覆盖率证据 | 分层测试目录及门禁 | `tests/contract/test_test_suite_governance.py` |
| [跨项目协作流程](cross-project-collaboration.md) | 三项目间的需求传递、评审、执行与验收回执 | 对方项目设计文档 + todo 任务 + 根总台账 | `tests/contract/test_cross_project_collaboration.py` |

## 规则

- 标准声明状态、最后更新、治理对象、依据 ADR 和关联测试，并使用统一公共章节。
- 改变规范语义必须先新增 ADR（见 [ADR 索引](../adr/index.md)）。
- 子项目（Axiom-Flow、QED-Tracker）各自维护独立的标准副本；根仓库标准作为三项目治理模式的
  上游参照，子项目按需同步（见 [ADR 0001](../adr/0001-root-contract-tests.md)）。
