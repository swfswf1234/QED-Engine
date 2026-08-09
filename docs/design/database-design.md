# 数据库设计（共享 qed 库）

设计状态：Accepted
实现状态：In Progress
最后更新：2026-08-09
关联代码：`scripts/load-env.ps1`（`QED_DB_*` 映射）、`.env.example`（变量模板）
关联测试：`tests/contract/test_design_documents.py`
关联 ADR：`docs/adr/0003-shared-qed-database-independence.md`

## 目的与边界

根仓库登记三项目共享 MySQL `qed` 库的命名空间、表清单与关键字段；具体列细节与迁移由各
子项目仓库维护（`qt_*` 属 QED-Tracker、`af_*` 属 Axiom-Flow），根仓库不复制其定义。
跨项目对接语义见[三项目对接规范](service-contracts.md)。

## 库与命名空间

- MySQL 8，库名 `qed`，三个项目共用同一实例与库——独立性铁律的明确例外（[ADR 0003](../adr/0003-shared-qed-database-independence.md)）。
- 表命名空间隔离：QED-Tracker 使用 `qt_*` 前缀，Axiom-Flow 使用 `af_*` 前缀；互不读取对方表。
- 凭据与库名唯一事实源：根 `.env` 的 `QED_DB_*` 变量（见
  [configuration-and-secrets.md](configuration-and-secrets.md) 统一数据库小节）。
- 存量库 `xqfm11`（Axiom-Flow 运行库）不迁移、不改名。

## 表设计

### qt_resources（QED-Tracker 资源登记查询索引）

资源登记双写契约：下载登记时 `meta/resources/<sha256>.json` 保持为文件状态事实，MySQL
`qt_resources` 为查询/展示索引；登记顺序**先落盘后登记**，失败可重放（幂等）。

关键字段与状态（登记内容）：

- `sha256`：资源唯一标识，与 `meta/resources/<sha256>.json` 对应；
- 状态机 `candidate → confirmed → downloading → downloaded → approved / rejected`
  （`failed` 终态可重试；`pending_manual`/`not_found` 为登记辅助状态；`backup` 备选态：
  candidate→backup→{confirmed,rejected}）；
- `review_note`：人工评审建议（confirm/backup/reject 可选 `note` 参数落此字段）。

列细节与迁移由 QED-Tracker 仓库维护（`docs/design/tracker-service.md`）。

### 任务记录（QED-Tracker 后台任务）

写操作（下载、评估、目录批处理等）的任务记录落盘 `meta/tasks/<task-id>.json`（JSON 文件，
非 MySQL），服务重启后历史可见；状态机 `queued → running → succeeded / failed`。

### af_*（Axiom-Flow，规划）

Axiom-Flow 侧表定义待其仓库设计（端口/解析产物登记轮），完成后在根仓库本节补登记表清单。

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
