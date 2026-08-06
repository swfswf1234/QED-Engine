# ADR 0003：三项目共享 qed 数据库与独立性铁律修订

状态：Accepted
日期：2026-08-05
领域：架构与边界
决策阶段：v0.1
取代：—
被取代：—

## 背景

2026-08-04 用户裁决：新建 MySQL 8 `qed` 库，三个项目共用同一实例与库（QED-Tracker 登记
`qt_*` 表、Axiom-Flow 使用 `af_*` 表），根 `.env` 的 `QED_DB_*` 为唯一事实源。但
`docs/design/service-contracts.md` 独立性约定原文仍为"三个项目各自独立部署、独立升级，不共享
Python 包、**数据库**或代码仓库"，与统一 `qed` 库决策直接冲突。QED-Tracker 服务化轮
（QED-012 MySQL 登记）与 Axiom-Flow 对齐轮（ALN-003 qed 库 `af_*` 表）均依赖该库，须先行
修订独立性表述，避免子项目实现时按旧约定各自建库。

## 决定

1. **共享实例与库**：三项目共用同一 MySQL 8 实例与 `qed` 库；凭据与库名唯一事实源为根 `.env`
   的 `QED_DB_*`，密码绝不下发到任何接口响应。
2. **表命名空间隔离**：QED-Tracker 只使用 `qt_*` 前缀表，Axiom-Flow 只使用 `af_*` 前缀表；
   互不读取、不写入对方表；各自 Alembic 独立初始化与迁移，schema 互不依赖。
3. **独立性铁律修订**：独立性指部署、升级、测试、代码仓库与 Python 包独立，以及运行时的表级
   隔离；共享 `qed` 库实例为明确例外。无 `QED_DB_PASSWORD` 时各项目数据库能力本地降级（服务与
   CLI 正常启动、登记暂缓并提醒），不因共享库阻塞主链路。
4. **存量库不迁移**：Axiom-Flow 存量 `xqfm11` 库不迁移、不改名，新数据落 `qed` 库。

## 后果

- `service-contracts.md` 独立性约定同步修订为"不共享 Python 包或代码仓库；MySQL 例外为共享
  qed 库实例（表命名空间隔离）"。
- 好处：统一备份、运维与查询；避免子项目按旧约定各自建库导致的数据分叉。
- 风险：共享实例单点故障影响面扩大；以表隔离 + 无密码降级运行缓解，且 `qed` 库为新建库可
  重建，回滚不触存量数据。
- QED-Tracker 侧文档（tracker-service.md、服务化计划）已注明本 ADR"登记中"；登记完成后其
  链接生效。

## 关联

- 关联设计：`docs/design/service-contracts.md`（独立性约定、统一数据库章节）、
  `docs/design/configuration-and-secrets.md`（QED_DB_* 唯一事实源）
- 关联计划：`docs/plans/2026-08-textbook-download-round.md`（目标 1：统一数据库落地）
- 关联 ADR：[ADR 0002](0002-frontend-and-port-centralization.md)（端口与归属规划，本决定为其
  数据层配套）；QED-Tracker [ADR 0001](../../QED-Tracker/docs/adr/0001-tracker-service-architecture.md)
  （服务化架构，子仓库独立编号）
