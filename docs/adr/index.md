# ADR 索引

状态：Current
最后更新：2026-08-20

本目录登记影响长期约束的架构决策：决定、理由、后果和取代关系。编号与生命周期规则见
[ADR 治理规范](../standards/adr-governance.md)。

**当前版本：v0.1（跑通完整服务）**——本索引登记当前版本的架构决策（ADR 0010 文档体系
与版本治理）。版本末期（用户确认升版本）时，本版本决策合并进 `architecture/` 或其他
固定文档，`history/` 记录前版本（见 [ADR 0010](0010-documentation-versioning.md)）。

## 当前决定

| 编号 | 标题 | 领域 | 决策阶段 | 状态 | 取代关系 |
| --- | --- | --- | --- | --- | --- |
| [`0001`](0001-root-contract-tests.md) | 根仓库建立工程治理契约测试 | 工程治理 | v0.1 | Accepted | — |
| [`0002`](0002-frontend-and-port-centralization.md) | 前端统一到 QED-Engine 与全局端口规划 | 工程治理 | v0.1 | Accepted | — |
| [`0003`](0003-shared-qed-database-independence.md) | 三项目共享 qed 数据库与独立性铁律修订 | 架构与边界 | v0.1 | Accepted | — |
| [`0004`](0004-personal-library-positioning.md) | 项目定位为个人图书馆与三中心形态 | 架构与边界 | v0.1 | Accepted | — |
| [`0005`](0005-control-center-service-hosting.md) | 控制中心服务托管规划 | 架构与边界 | v0.1 | Accepted | — |
| [`0006`](0006-engineering-governance-contract.md) | 工程治理契约范本化 | 工程治理 | v0.1 | Accepted | — |
| [`0007`](0007-qed-engine-backend-gateway.md) | QED-Engine 后端网关化：前端统一入口 8900 | 架构与边界 | v0.1 | Accepted | — |
| [`0008`](0008-frontend-react-refactor.md) | 前端框架与工程化选型：React 全家桶重构 8903 | 架构与边界 | v0.1 | Accepted | — |
| [`0009`](0009-shared-qed-tables.md) | qed 库新增 qed_* 共享表族（课程体系元数据跨项目共享） | 架构与边界 | v0.1 | Accepted | — |
| [`0010`](0010-documentation-versioning.md) | 文档体系分层与版本治理（确定文档 / 相对确定 / 实时状态） | 工程治理 | v0.1 | Accepted | — |

下一个可用编号：0011
