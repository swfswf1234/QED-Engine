# ADR 0013：开发流程规范体系——新增代码规范与存储规范

状态：Accepted
日期：2026-09-11
领域：工程治理
决策阶段：v0.1
取代：—
被取代：—

## 背景

根仓库 `docs/standards/` 已覆盖文档治理、ADR 治理、任务生命周期、测试门禁、跨项目协作、
本地环境与代码-文档追溯，但**开发流程的两类规则仍无标准归属**：

- **代码规范**：命名、类型与错误处理、日志、依赖声明、前后端风格与分层边界等规则分散在
  AGENTS.md 强制约束、`code-document-traceability.md`（仅 DesignRef）、`pyproject.toml` /
  `tsconfig`（工具配置）与开发指南中，agent 无法从单一标准获得可执行判据。
- **临时目录与数据存储规范**：`tmp/` 生命周期、原子落盘、数据根边界、测试隔离等规则散落于
  `design/dataset-conventions.md`（设计文档）、`local-dev.md` 与 `testing.md`，`design/` 与
  `standards/` 的事实边界不清。

同时 `task-lifecycle.md` 与 `testing.md` 已具备完整正文与契约守护，仍处「暂定」状态，需按
文档治理转正。REQ-071 基线契约门禁红（DEFECT-002）也说明规则漂移已实际发生。

## 决定

1. **新增标准 `standards/code-standards.md`（代码规范）**：承载代码风格、命名、类型与错误
   处理、日志、依赖声明、前后端分层与允许/禁止清单。文件头 DesignRef 字段定义仍归
   `code-document-traceability.md`，可复制命令仍归 `guides/development.md`；本标准只写规则，
   不复制其正文。
2. **新增标准 `standards/storage-conventions.md`（临时目录与数据存储规范）**：承载数据根
   `QED_DATA_ROOT`、`raw/tmp/parsed` 三区语义、`tmp/` 生命周期与原子落盘、`raw/` 不可变、
   元数据入 DB、测试隔离铁律与 Agent 工作临时目录约定。**目录结构与子域契约细节保留在
   `design/dataset-conventions.md`**，标准只链接不复制（一个事实一个维护位置）。
3. **事实边界**：`standards/` 管规则，`architecture/` 管固定契约，`design/` 管相对确定设计；
   数据存储的「规则」升 standards，数据存储的「结构」留 design。
4. **转正**：`task-lifecycle.md`、`testing.md` 由暂定转已确认；两份新标准经用户评审后同轮转正。
5. **门禁**：新增标准须在 `standards/index.md`、根 `AGENTS.md` 标准映射与
   `tests/contract/test_standard_governance.py` 白名单三方登记，并各自有契约测试守护。

## 后果

- `standards/` 由 7 份增至 9 份；契约白名单、标准索引与 AGENTS 路由需同批更新。
- 代码规则从「散落」收敛为单一标准；AGENTS.md 强制约束保留摘要并指向标准细则。
- 存储规则的唯一事实源从 `design/` 移向 `standards/`，`design/dataset-conventions.md` 保留
  目录结构并反向引用；`doc-governance.md` 的分类表引用同步。
- 新增两份契约测试（`test_code_standards_governance.py`、`test_storage_conventions_governance.py`），
  守护面清单与标准索引「自动门禁」列同步。
- 子项目（QED-Tracker / Axiom-Flow）按范本各自适配，经跨项目请求承接。

## 关联

- 标准：[代码规范](../standards/code-standards.md)、[临时目录与数据存储规范](../standards/storage-conventions.md)
  （新增）；[文档治理规范](../standards/doc-governance.md)（事实边界与转正）、
  [测试架构与门禁](../standards/testing.md)（隔离铁律）、
  [任务生命周期](../standards/task-lifecycle.md)（任务类型与计划准入）、
  [文档与代码双向追溯规范](../standards/code-document-traceability.md)（DesignRef）
- 设计：[dataset 目录约定](../design/dataset-conventions.md)（目录结构承接）、
  [数据库总纲](../architecture/database-design.md)（元数据入 DB）
- 守则：根 [AGENTS.md](../../AGENTS.md)（变更分级）、[开发指南](../guides/development.md)
- 任务：REQ-071（todo 镜像）、DEFECT-002（基线契约门禁修复）
