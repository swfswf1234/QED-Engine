# 数据库设计（共享 qed 库）

设计状态：Accepted
实现状态：In Progress
最后更新：2026-08-16
关联代码：`.env.example`（变量模板）
关联测试：`tests/contract/test_design_documents.py`
关联 ADR：`docs/adr/0003-shared-qed-database-independence.md`、`docs/adr/0009-shared-qed-tables.md`（2026-08-16：新增 `qed_*` 共享表族，部分补充 0003）

## 目的与边界

本文件是根仓库对共享 MySQL `qed` 库的**指引与规划**：只登记命名空间隔离规则、表清单规划与
跨项目契约要点；**具体表结构与迁移由各子项目仓库确认与维护**（`qt_*` 属 QED-Tracker、
`af_*` 属 Axiom-Flow、`qed_*` 共享表所有权 QED-Tracker），根仓库不复制其定义。QED-Tracker
侧已回执（REQ-026 关闭，2026-08-16）：其 `docs/design/database-schema.md` 为 qed 库全部
`qed_*`/`qt_*` 表**唯一事实源**。Axiom-Flow 侧 af_* 表确认动作登记于 [REQ-027](../trackers/todo.md)。
跨项目对接语义见[三项目对接规范](service-contracts.md)。

**数据边界新模式（2026-08-16 用户裁决，ARCH-013）**：dataset 只管理数据资料（原始数据 +
整理后解析产物，见 [dataset-conventions.md](dataset-conventions.md)）；**元数据默认存数据库**
——登记、状态、进度、评价、课程体系、任务记录等一律入本库，`meta/` JSON 不再作为事实源
（退役，REQ-032）。

## 库与命名空间

- MySQL 8，库名 `qed`，三个项目共用同一实例与库——独立性铁律的明确例外（[ADR 0003](../adr/0003-shared-qed-database-independence.md)）。
- 表命名空间隔离：QED-Tracker 使用 `qt_*` 前缀，Axiom-Flow 使用 `af_*` 前缀；互不读取对方表。
- **共享 `qed_*` 前缀表族**（2026-08-16，[ADR 0009](../adr/0009-shared-qed-tables.md) 补充 0003）：
  三项目共用的基础元数据；所有权 QED-Tracker（Alembic 建表维护），其他项目只读不写；
  schema 变更须先在本文件登记。
- 凭据与库名唯一事实源：根 `.env` 的 `QED_DB_*` 变量（见
  [configuration-and-secrets.md](configuration-and-secrets.md) 统一数据库小节）。
- 存量库 `xqfm11`（Axiom-Flow 运行库）不迁移、不改名。

## 表清单规划

### 知识层次五表（QED-031，2026-08-16）

课程收集主链路的元数据模型：**领域 → 课程 → 知识行（教程/资料归类）→ 书行 → 渠道**。
唯一事实源为 QED-Tracker `docs/design/database-schema.md`；本文件只登记所有权与契约要点。

| 表 | 前缀 | 所有权 | 一行= | 状态 |
| --- | --- | --- | --- | --- |
| `qed_domain` | 共享 | QED-Tracker 建表维护，其他项目只读 | 一个学科（math；扩展预留），含 stages | QED-031，规划迁移 0006 |
| `qed_course` | 共享 | 同上 | 一门课程（阶段/先修 DAG/别名/顺序），取代 courses/math.json | QED-031 |
| `qt_knowledge` | 私有 | QED-Tracker | 一套教程（tutorial）或一组课程延展资料归类（other_material） | QED-031 |
| `qt_books` | 私有 | QED-Tracker | 一册/一卷/一个快照（candidate→decided→downloading→downloaded→verified） | QED-031 |
| `qt_sources` | 私有 | QED-Tracker | 一次渠道尝试（外键挂 book_id） | 迁移重建 |
| `qt_selections` / `qt_downloads` | 私有 | — | 三表模型（QED-028/029） | **存量迁移后退役（drop）** |

- 共享表：三项目可读；QED-Tracker 唯一写权限（Alembic 建表维护）；schema 变更须先在本文件登记。
- 状态机与字段明细见 QED-Tracker `docs/design/database-schema.md`（唯一事实源）。
- `qt_resources`（QED-030 已退役）与三表（QED-031 取代）的历史契约留档见
  [downloads-three-table-model.md](downloads-three-table-model.md)（Superseded）。

### QED-Engine 学习表族（规划，暂缓）

学习中心（课程进度、练习记录、问答会话等，见 [learning-center.md](learning-center.md) §4）
的元数据入本库，但**归属暂缓**（2026-08-16 用户裁决）：待学习中心 M2 里程碑（单课程试点，
依赖解析产物管线）启动时裁决——候选方案：① 扩展 `qed_*` 共享族（所有权委托 QED-Tracker
托管建表）；② 根仓库后端自建数据层（backend/ 引入 Alembic，`qed_learning_*` 或独立前缀）。
本文件届时补登记表清单与所有权。

### 任务记录（QED-Tracker）

写操作（下载、评估、目录批处理等）的任务记录**入 DB**（元数据默认存数据库，2026-08-16 裁决；
表归属见 QED-Tracker database-schema.md）；历史 JSON 落盘 `meta/tasks/<task-id>.json` 方案
随 meta/ 退役（REQ-032）不再作为事实源。状态机 `queued → running → succeeded / failed`。

### af_*（Axiom-Flow，规划）

Axiom-Flow 侧表结构待其仓库设计确认（REQ-027），确认后在本文件补登记表清单；根仓库只
维护命名空间与敏感字段规则。

## 迁移

- `qed` 库由各项目 Alembic **独立初始化**自己的表，互不影响；`qed_*` 共享表由 QED-Tracker
  Alembic 建表与维护。存量 `xqfm11` 库不迁移。
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
