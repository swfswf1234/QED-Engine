# ADR 0006：工程治理契约范本化

状态：Superseded
日期：2026-08-09
领域：工程治理
决策阶段：v0.1
取代：—
被取代：—

## 背景

ADR 0001 建立 `tests/contract/` 治理契约测试后，契约测试的编写模式（docstring 契约头、纯标准库、
自包含、`ROOT` 推导、DesignRef 一对一）一直是无文档的隐性约定，新增契约测试只能参照已有文件。
2026-08-09 用户决定将治理契约设计显式化为规范：新增 `governance-contract.md` 标准，作为根仓库
与子项目（Axiom-Flow / QED-Tracker）可复用的统一范本。

## 决定

1. **新增标准**：新增 `docs/standards/governance-contract.md`，定义治理契约的守护面清单（七类）、
   契约头（六字段）、编写约定（纯标准库 / 自包含 / 零网络）与新增流程。
2. **契约头规范化**：每个契约测试文件以六字段 docstring 声明：模块职责、设计关联（DesignRef）、
   实现状态、被测代码、守护面、失效后果；DesignRef 指向守护的核心标准，可声明多行。
3. **存量迁移**：现有 11 个契约测试同步补齐契约头字段，测试逻辑不变。
4. **守护面清单**：文档结构与导航 / 标准治理 / ADR 治理 / 计划与任务治理 / 架构与设计追溯 /
   测试工程与门禁 / 跨项目协作 七类，清单随新治理面扩展。
5. **三项目复用**：本规范为可移植范本，子项目按其文档体系适配（`ROOT` 推导、DesignRef 指向
   自身标准、ADR 独立编号、守护面按目录裁剪）；对齐请求以根仓库 todo 登记，在子项目仓库内
   实现。

## 后果

- 契约测试的编写从「参照现有文件」变为「遵循规范」，新契约测试有明确流程。
- 契约头字段由契约测试自身守护（`test_test_suite_governance.py` 扩展），契约守护契约。
- 子项目按需对齐范本，不强制同步改造；对齐以跨项目请求推进。

## 关联

- 关联标准：`docs/standards/governance-contract.md`、`docs/standards/testing.md`
- 关联测试：`tests/contract/test_test_suite_governance.py`、`tests/contract/test_standard_governance.py`
- 关联 ADR：[ADR 0001](0001-root-contract-tests.md)（治理契约测试的建立，本决定为其设计规范化）
