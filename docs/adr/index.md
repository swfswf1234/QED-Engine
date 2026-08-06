# ADR 索引

状态：Current
最后更新：2026-08-05

本目录登记影响长期约束的架构决策：决定、理由、后果和取代关系。编号与生命周期规则见
[ADR 治理规范](../standards/adr-governance.md)。

## 当前决定

| 编号 | 标题 | 领域 | 决策阶段 | 状态 | 取代关系 |
| --- | --- | --- | --- | --- | --- |
| [`0001`](0001-root-contract-tests.md) | 根仓库建立工程治理契约测试 | 工程治理 | v0.1 | Accepted | — |
| [`0002`](0002-frontend-and-port-centralization.md) | 前端统一到 QED-Engine 与全局端口规划 | 工程治理 | v0.1 | Accepted | — |
| [`0003`](0003-shared-qed-database-independence.md) | 三项目共享 qed 数据库与独立性铁律修订 | 架构与边界 | v0.1 | Accepted | — |

下一个可用编号：0004

## 规则

- 改变文档分类、事实归属、强制元数据、索引入口或归档条件时必须先新增 ADR。
- Rejected/Superseded ADR 永久进入 `../history/adr/`。
