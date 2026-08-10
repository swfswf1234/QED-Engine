# 数据库设计（共享 qed 库）

设计状态：Accepted
实现状态：In Progress
最后更新：2026-08-09
关联代码：`scripts/load-env.ps1`（`QED_DB_*` 映射）、`.env.example`（变量模板）
关联测试：`tests/contract/test_design_documents.py`
关联 ADR：`docs/adr/0003-shared-qed-database-independence.md`

## 目的与边界

本文件是根仓库对共享 MySQL `qed` 库的**指引与规划**：只登记命名空间隔离规则、表清单规划与
跨项目契约要点；**具体表结构与迁移由各子项目仓库确认与维护**（`qt_*` 属 QED-Tracker、
`af_*` 属 Axiom-Flow），根仓库不复制其定义。子项目确认动作已登记跨项目请求：
[REQ-026](../trackers/todo.md)（QED-Tracker 确认 qt_* 表设计）、
[REQ-027](../trackers/todo.md)（Axiom-Flow 确认 af_* 表设计）。
跨项目对接语义见[三项目对接规范](service-contracts.md)。

## 库与命名空间

- MySQL 8，库名 `qed`，三个项目共用同一实例与库——独立性铁律的明确例外（[ADR 0003](../adr/0003-shared-qed-database-independence.md)）。
- 表命名空间隔离：QED-Tracker 使用 `qt_*` 前缀，Axiom-Flow 使用 `af_*` 前缀；互不读取对方表。
- 凭据与库名唯一事实源：根 `.env` 的 `QED_DB_*` 变量（见
  [configuration-and-secrets.md](configuration-and-secrets.md) 统一数据库小节）。
- 存量库 `xqfm11`（Axiom-Flow 运行库）不迁移、不改名。

## 表清单规划

### qt_resources（QED-Tracker，已落地待确认）

资源登记查询索引（QED-Tracker 服务化轮已落地）。契约要点（跨项目对齐面）：

- 双写契约：下载登记时 `meta/resources/<sha256>.json` 为文件状态事实，MySQL `qt_resources`
  为查询/展示索引；登记顺序**先落盘后登记**，失败可重放（幂等）。
- 状态机覆盖候选/确认/下载/验收全链路与人工评审留痕（`review_note`）。

**表结构明细由 QED-Tracker 确认并维护**（见其 `docs/design/tracker-service.md`），
确认结果回执后本文件按 REQ-026 关闭。

### 任务记录（QED-Tracker）

写操作（下载、评估、目录批处理等）的任务记录落盘 `meta/tasks/<task-id>.json`
（JSON 文件，非 MySQL），服务重启后历史可见；状态机 `queued → running → succeeded / failed`。

### af_*（Axiom-Flow，规划）

Axiom-Flow 侧表结构待其仓库设计确认（REQ-027），确认后在本文件补登记表清单；根仓库只
维护命名空间与敏感字段规则。

## 迁移

- `qed` 库由各项目 Alembic **独立初始化**自己的表，互不影响；存量 `xqfm11` 库不迁移。
- 新增表或共享字段变化：先更新本文件与对应契约，再实现迁移。

## 敏感字段规则

- `QED_DB_PASSWORD` 绝不下发到任何接口响应、日志或异常信息。
- 配置中心 `/config/database` 只返回 host/port/name/user/configured/reachable/reason；
  `reachable` 为真实连接探测（pymysql 认证，3s 超时、结果缓存 60s），未配置密码不探测
  （契约见 [config-center-api.md](config-center-api.md)）。

## 变量来源

`QED_DB_HOST`/`QED_DB_PORT`/`QED_DB_NAME`/`QED_DB_USER`/`QED_DB_PASSWORD` 的默认值与说明
以 [configuration-and-secrets.md](configuration-and-secrets.md) 变量表为唯一事实源，
本文件不复制。

## 验证

- `pytest tests/contract/test_design_documents.py -q` 全绿。
- 8900 `/config/database` 实测返回真实连接状态（`reachable`/`reason`），响应不含密码。
