# 架构文档索引

状态：Current
最后更新：2026-08-31

本目录只放**确定文档**（ADR 0010，[文档治理规范](../standards/doc-governance.md)）：总体架构、
每个服务的服务架构文档、固定 API 接口文档、数据库设计文档与代码映射表。实时状态快照
[项目状态快照](../trackers/project-status.md) 移入 `trackers/`；设计契约见 `../design/`；
版本末期本目录文档随版本更新、前版本进 `history/`。

## 当前文档

| 文档 | 设计状态 | 实现状态 | 内容 |
| --- | --- | --- | --- |
| [三项目四服务总体架构](four-service-architecture.md) | Accepted | In Progress | 三项目四服务总览、端口、三中心形态、独立性铁律与交互拓扑（服务间联系与交互由此确定） |
| [QED-Engine 前端架构](frontend-architecture.md) | Accepted | Implemented | 8903 前端：web-ui/React 组织、信息架构（hash 路由）、唯一入口 8900 与独立性 |
| [QED-Engine 后端架构](backend-architecture.md) | Accepted | Implemented | 8900 后端：三域组织（控制域 / 数据域·Tracker / 数据域·Axiom）、分层与生命周期脚本 |
| [8900 API 接口文档](api-contracts.md) | Accepted | Implemented | 8900 固定 API 契约（按 QED-Tracker 范本逐端点展开）：服务管理 / 配置语义 / 数据透传·Tracker / 数据透传·Axiom / 监控诊断与 LLM 网关 + 统一错误码表；前端无 API 声明 |
| [数据库设计（总纲，范本化）](database-design.md) | Accepted | In Progress | 共享 qed 库登记与指引：命名空间隔离、qed_* 共享表族清单、qed_llm_calls 结构、qt_*/af_* 置空指向子项目数据库文档 |
| [代码与设计映射表](code-map.md) | Accepted | Implemented | 受管代码、DesignRef 与测试的双向映射唯一事实源 |

> Axiom-Flow、QED-Tracker 的服务架构 / API / 数据库文档以各自仓库 `docs/architecture/` 为准。
