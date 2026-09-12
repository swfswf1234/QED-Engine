# 规范索引

状态：Current
最后更新：2026-09-11

本目录是工程治理规则的唯一事实源。根 [AGENTS.md](../../AGENTS.md) 负责快速路由，指南负责操作
步骤，ADR 负责决定及理由；这些位置不得复制标准正文。

**已确认**：全部 9 份标准——文档治理规范（本文档体系）、本地开发环境、文档与代码追溯、跨项目
协作规范、ADR 治理、任务生命周期、测试架构与门禁、代码规范、临时目录与数据存储规范。

| 标准 | 治理对象 | 权威产物 | 自动门禁 |
| --- | --- | --- | --- |
| [任务生命周期](task-lifecycle.md) | 任务分类、计划准入、tracker 状态、实施门禁与关闭交付 | 计划正文及 tracker | `tests/contract/test_plan_governance.py`、`tests/contract/test_tracker_governance.py` |
| [文档治理规范](doc-governance.md) | 文档分类与事实边界、确认状态、文档生命周期、任务与文档绑定、写作命名索引元数据、归档与删除 | 当前文档树及 History | `tests/contract/test_document_structure.py`、`tests/contract/test_markdown_links.py`、`tests/contract/test_standard_governance.py` |
| [ADR 治理规范](adr-governance.md) | ADR 准入、全局编号、元数据、状态、取代关系与归档路径 | ADR 正文及 ADR index | `tests/contract/test_adr_governance.py` |
| [文档与代码双向追溯规范](code-document-traceability.md) | code-map、模块 DesignRef 和语义同步门禁 | `docs/architecture/code-map.md` | `tests/contract/test_code_document_mapping.py`、`tests/contract/test_api_endpoint_inventory.py` |
| [代码规范](code-standards.md) | 代码风格、命名、类型与错误处理、日志、依赖声明、前后端分层与允许/禁止清单 | 受管源码与工具配置（`pyproject.toml`、`tsconfig`） | `tests/contract/test_code_standards_governance.py` |
| [临时目录与数据存储规范](storage-conventions.md) | 统一数据根、raw/tmp/parsed 三区规则、临时目录生命周期、原子落盘、测试隔离与 Agent 工作临时目录 | `dataset/` 目录约定与数据根布局 | `tests/contract/test_storage_conventions_governance.py` |
| [测试架构与门禁](testing.md) | 测试职责、分层、隔离、替身、门禁与覆盖率证据；治理契约测试的守护面清单、契约头、编写约定与新增流程 | 分层测试目录、`tests/contract/` 契约测试与守护面清单 | `tests/contract/test_test_suite_governance.py` |
| [跨项目协作规范](cross-project-collaboration.md) | 三项目间的需求传递、评审、执行、验收回执与执行纪律 | 对方项目设计文档 + todo 任务 + 根总台账 | `tests/contract/test_cross_project_collaboration.py` |
| [本地开发环境](local-dev.md) | 本地机器标识、环境依赖、构建命令与开发约定 | 当前文档 | 无 |
