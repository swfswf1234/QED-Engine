# 设计文档索引

状态：Current
最后更新：2026-08-05

本目录保存当前契约与接口：服务间通信、dataset 目录约定、统一配置接口、失败语义和质量门槛。
文档分类与元数据规则见[文档规范](../standards/documentation.md)。

## 当前文档

| 文档 | 设计状态 | 实现状态 | 内容 |
| --- | --- | --- | --- |
| [service-contracts.md](service-contracts.md) | Accepted | In Progress | 三项目对接规范：边界、数据流、独立性、统一 qed 库与 MySQL 登记契约、差距 |
| [dataset-conventions.md](dataset-conventions.md) | Accepted | In Progress | 根 dataset 目录约定：raw/parsed/meta 契约、资源登记双写 |
| [configuration-and-secrets.md](configuration-and-secrets.md) | Accepted | In Progress | 统一配置与密钥：供应商 key、OCR 模型、QED_DB_* 统一数据库、映射、原则 |
| [config-center-api.md](config-center-api.md) | Accepted | Implemented | 配置中心 API 契约：health / 模型路由 / 供应商与数据库状态，密钥不下发 |

## 规则

- 设计文档声明设计状态、实现状态、最后更新、关联代码/测试/ADR。
- dataset 读写契约是本目录职责，数据文件本身不入库。
- 子项目内部契约以其自身 `docs/design/` 为准。
- 实现状态随教材下载轮推进更新（QED-Tracker QED-008~016、Axiom-Flow ALN-002/003 见
  [任务台账](../trackers/todo.md)）。
