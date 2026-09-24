# 数据库设计（共享 qed 库总纲）

设计状态：Accepted
实现状态：In Progress
最后更新：2026-09-24
需求方：QED-Tracker（课程体系 `qed_domain`/`qed_course`）、QED-Engine（LLM 调用记录 `qed_llm_calls`）、Axiom-Flow（解析管理 `af_*` 四表）
确认状态：已确认
关联代码：`.env.example`（`QED_DB_*` 变量模板）
关联测试：`tests/contract/test_architecture_documents.py`、`tests/test_llm_call_log.py`
关联 ADR：`docs/history/adr/v0.1/0003-shared-qed-database-independence.md`、`docs/history/adr/v0.1/0009-shared-qed-tables.md`（新增 `qed_*` 共享表族，部分补充 0003）、`docs/history/adr/v0.1/0010-documentation-versioning.md`、`docs/adr/0014-parsing-ownership-and-model-boundary.md`

> 本文件是 **QED-Engine 的固定数据库设计文档（总纲）**（ADR 0010）：只登记共享 `qed` 库的
> 命名空间隔离规则、表清单总览、关系视图、读写矩阵与跨项目契约要点；**任何表的完整
> DDL/字段结构一律不在本文件维护**（事实源唯一铁律，ADR 0017 同源），指向各所有权方
> 文档：QED-Tracker `docs/architecture/database-shared-tables.md`（`qed_*`）与
> `database-private-tables.md`（`qt_*`）为其全部表**结构**唯一事实源；Axiom-Flow
> `docs/architecture/database-design.md` 为 `af_*` 四表结构唯一事实源。
> 版本末期确认更新后，前版本进 `history/`。

## 目的与边界

本文件是根仓库对共享 MySQL `qed` 库的**登记与指引**：只维护命名空间隔离规则、表清单
总览、关系视图、读写矩阵与跨项目契约要点。**结构事实源唯一**：`qed_*`/`qt_*` 在
QED-Tracker（其 Alembic 建表维护），`af_*` 在 Axiom-Flow；根仓库不复制任何 DDL，
只登记「一行 = 什么」与消费语义（`qed_llm_calls` 例外：根仓库定义结构，DDL 仍不落地
本文件，见该表小节）。exploration_stage 的**写权限与降级口径**是根侧消费语义，事实源在
[downloads-flow.md](../design/downloads-flow.md) §5.2/§5.4（终态写点矩阵），本文件不重复。
跨项目对接语义见[三项目协同与对接契约](../design/cross-project-contracts.md)。

**数据边界**：dataset 只管理数据资料（原始数据 +
整理后解析产物，见 [dataset-conventions.md](../design/dataset-conventions.md)）；**元数据默认存数据库**
——登记、状态、进度、评价、课程体系、任务记录等一律入本库，`meta/` JSON 不再作为事实源
（退役，REQ-032）。

## 库与命名空间

- MySQL 8，库名 `qed`，三个项目共用同一实例与库——独立性铁律的明确例外（[ADR 0003](../history/adr/v0.1/0003-shared-qed-database-independence.md)）。
- 表命名空间隔离：QED-Tracker 使用 `qt_*` 前缀，Axiom-Flow 使用 `af_*` 前缀；互不读取对方表。
- **共享 `qed_*` 前缀表族**（[ADR 0009](../history/adr/v0.1/0009-shared-qed-tables.md) 补充 0003）：
  三项目共用的基础元数据；所有权 QED-Tracker（Alembic 建表维护），其他项目只读不写
  （降级直写例外见[downloads-flow.md](../design/downloads-flow.md) §5.2/§5.4）；
  schema 变更须先经根仓库登记（ADR 0009，变更顺序见
  [cross-project-contracts §4](../design/cross-project-contracts.md)）。`qed_llm_calls` 例外：
  三项目均可写入调用记录，表结构由根仓库迁移定义后在 QED-Tracker `shared-tables.md` 登记。
- 凭据与库名唯一事实源：根 `.env` 的 `QED_DB_*` 变量（见
  [project-configuration.md](../design/project-configuration.md) 统一数据库小节）。
- 存量库现状：MySQL 面**仅业务库 `qed` 与测试库 `qed_test`**（后者隔离真实数据，保留）；
  遗留库已收敛清零（备份、还原演练与删除执行记录见
  [completed.md](../trackers/completed.md) 数据操作行，决策 [ADR 0014](../adr/0014-parsing-ownership-and-model-boundary.md)）。

## 表清单总览

| 表 | 前缀 | 一行= | 状态 | 结构事实源 |
| --- | --- | --- | --- | --- |
| `qed_domain` | 共享 | 一个学科（math；扩展预留），含 stages | QED-031，迁移 0006 已落地 | QED-Tracker database-shared-tables.md |
| `qed_course` | 共享 | 一门课程（阶段/先修 DAG/别名/顺序），取代 courses/math.json | QED-031 | QED-Tracker database-shared-tables.md |
| `qed_llm_calls` | 共享 | 一次 LLM 调用记录（prompt/回答/耗时/成败） | ARCH-016，根仓库迁移 | 结构在 QED-Tracker database-shared-tables.md 登记；字段语义见 [llm-gateway.md](../design/llm-gateway.md) |
| `qt_knowledge` | 私有 | 一套教程（tutorial）或课程延展资料归类（other_material），两态 draft→confirmed | QED-031，2026-09-03 重构 | QED-Tracker database-private-tables.md |
| `qt_books` | 私有 | 一册/一本书：选用态（candidate/decided/parallel/retired）+ 持有态（owned/missing）+ 下载生命周期（downloading/downloaded/verified/failed，QED-060） | QED-031 + QED-060 | QED-Tracker database-private-tables.md |
| `qt_sources` | 私有 | 一次渠道尝试（外键挂 book_id），ok 标达成败 | QED-031，0014 重建 | QED-Tracker database-private-tables.md |
| `qt_tasks` | 私有 | 一个后台任务记录（queued→running→succeeded/failed） | REQ-032，迁移 0016 建 | QED-Tracker database-private-tables.md |
| `af_books` | 私有 | 一册已验证书（qt_books 只读快照 + ingest/解析进度 + 生效版本指针） | **已落地**（Axiom-Flow Alembic 维护） | Axiom-Flow database-design.md |
| `af_parse_jobs` | 私有 | 一次解析任务＝一个解析版本（逐页/全本，状态与进度） | **已落地**（同上） | Axiom-Flow database-design.md |
| `af_pages` | 私有 | 一页解析状态与质量信号（按解析版本作用域） | **已落地**（同上） | Axiom-Flow database-design.md |
| `af_block_edits` | 私有 | 一次块级人工编辑（判定/备注/文字/范围，绑定解析版本） | **已落地**（同上） | Axiom-Flow database-design.md |
| 学习表族（规划） | 暂缓 | 课程进度/练习记录/问答会话 | 规划，M2 里程碑启动时裁决 | 本文件「学习表族规划」节 |

> 所有权与写权限见「读写矩阵」；本表不复制列结构（事实源唯一铁律）。

## 关系视图

跨命名空间连线均为**逻辑引用**（应用层维护，不建跨命名空间外键；同命名空间内允许外键）。

```mermaid
erDiagram
    qed_domain ||--o{ qed_course : "domain_id"
    qed_course ||--o{ qt_knowledge : "course_id"
    qt_knowledge }o--o{ qt_books : "教程 refs 承载归属"
    qt_books ||--o{ qt_sources : "book_id"
    qt_books {
        string book_id PK "选用态+持有态+下载生命周期"
    }
    af_books |o--o| af_parse_jobs : "active_job_id 生效版本指针"
    af_books ||--o{ af_parse_jobs : "book_id"
    af_parse_jobs ||--o{ af_pages : "job_id 版本作用域"
    af_pages ||--o{ af_block_edits : "book+job+page × block_index"
    qt_books ||--o| af_books : "verified 书目 book_id 同源只读快照"
    qed_llm_calls {
        bigint id PK "三项目可写调用记录"
    }
    qt_tasks {
        string task_id PK "8901 后台任务"
    }
```

- `qed_course → qed_domain`：DAG 先修关系存 `prerequisites` JSON，图中不展开。
- `af_pages.job_id='legacy'` 为根视图存量哨兵（非真实版本行）。
- 单行语义与列级关系明细以各结构事实源文档为准，本图只表达表间逻辑引用。

## 读写矩阵

R＝可读，W＝可写，–＝不直连（经对应服务 HTTP API 消费）。降级直写例外与终态写点矩阵
事实源：[downloads-flow.md](../design/downloads-flow.md) §5.2/§5.4。

| 表 | 8901 QED-Tracker | 8902 Axiom-Flow | 8900 QED-Engine |
| --- | --- | --- | --- |
| `qed_domain` | R/W（所有权，Alembic 维护） | R | R + 离线降级直写（限 description/stages/exploration_stage/explore_pending，REQ-064④） |
| `qed_course` | R/W（同上） | R | R + 离线降级直写（同上口径） |
| `qed_llm_calls` | W（local 直连自写） | W（local 直连自写） | R/W（网关统一写 + 建表维护 + 检索端点） |
| `qt_knowledge` / `qt_books` / `qt_sources` / `qt_tasks` | R/W（所有权） | – | –（经 8901 API 透传消费） |
| `af_books` / `af_parse_jobs` / `af_pages` / `af_block_edits` | – | R/W（所有权） | –（经 8902 API 透传消费；`GET /books/{book_id}/file` 只读 file_path 指向的 PDF 文件本体） |

- 命名空间铁律：`qt_*`/`af_*` 互不读取对方表；8900 对两个私有命名空间一律走 HTTP，
  不直连数据库读写（`qed_llm_calls` 的三项目可写是唯一跨项目直写例外）。

## qed_* 共享表族要点（消费语义，非结构契约）

三项目共用的基础元数据；所有权与写权限见「读写矩阵」。列结构与 DDL 一律见
QED-Tracker `database-shared-tables.md`，本节只登记根侧消费要点。

### qed_domain（领域表）

一行 = 一个学科领域（当前仅 math，预留扩展）。关键字段语义：
`exploration_stage`（流程状态枚举）+ `explore_pending`（待确认载荷，JSON）构成领域探索
门面读模型；`classic_tracks`/`stages`/`path_results` 为课程体系与学习链路元数据。
**exploration_stage 状态枚举、各态写主体与降级直写规则：事实源
[downloads-flow.md](../design/downloads-flow.md) §5.2/§5.4**（本文件不重复状态机表）。

### qed_course（课程表）

一行 = 一门课程（`domain_id` 归属、`sort_order` DAG 拓扑序、`prerequisites` 先修数组、
`stage` 值域来自 `qed_domain.stages` 四档：基础/主干/分支/前沿）。课程探索为**单步、
单轮**：报告生成即进入待确认，确认后已完成；写主体口径同 qed_domain
（见 [downloads-flow.md](../design/downloads-flow.md) §5.4）。

### qed_llm_calls（LLM 调用记录）

三项目 LLM 调用记录单表（prompt/回答/耗时/成败），用于 prompt 与工具调用调优。所有权
QED-Engine 后端（`backend/qed_engine/services/llm/call_log.py` 幂等建表 + `ensure_comments()`
注释补齐），**三项目可写**（网关统一写 + 子项目 local 直连自写，`service` 字段标识调用方）。
表结构由根仓库迁移定义，DDL 在 QED-Tracker `database-shared-tables.md` 登记；
字段语义与调用记录消费见 [llm-gateway.md](../design/llm-gateway.md)。

## qt_*（QED-Tracker，私有）

QED-Tracker 定义自身完整数据库定义（`docs/architecture/database-private-tables.md`（qt_*）与
`database-shared-tables.md`（qed_*）为其结构唯一事实源）。根仓库总纲不复制其结构。四张在用表：

- `qt_knowledge`：一套教程（tutorial）或课程延展资料归类（other_material），两态
  draft→confirmed（废弃由 notes 承载）。
- `qt_books`：域级书库，选用态 + 持有态 + 下载生命周期（QED-060）；
  承载补书优先级，下载执行留痕由 qt_sources 承载。
- `qt_sources`：一次渠道尝试（外键挂 book_id），ok 标达成败。
- `qt_tasks`：一个后台任务记录（queued→running→succeeded/failed），替代 `meta/tasks/` JSON 文件。

## af_*（Axiom-Flow，私有）

Axiom-Flow 侧表结构由 Axiom-Flow `docs/architecture/database-design.md` 定义；根仓库只维护
命名空间与敏感字段规则，不复制其结构。`af_*` 为四表：

- `af_books`：一册已验证书（qt_books 只读快照 + sha256/ingest_status/parse_status/
  pages_done + `active_job_id` 生效解析版本指针）。
- `af_parse_jobs`：一次解析任务＝一个解析版本（job_id/book_id/pages/engine/status/progress/
  failed_pages/error/source_sha256/page_count/时间戳）。
- `af_pages`：一个解析版本一页的解析状态（book_id+job_id+page_no PK；status/source/
  quality/error/parsed_at；`job_id='legacy'` 为根视图存量哨兵）。
- `af_block_edits`：一次块级人工编辑，绑定其所属解析版本（book_id+job_id+page_no/
  block_index 唯一；verdict/note/corrected_text/corrected_bbox/时间戳）。

完整 DDL 与字段语义以 Axiom-Flow `docs/architecture/database-design.md` 为唯一事实源
（根侧 DDL 快照已按 ADR 0017 删除）；四表由 Axiom-Flow Alembic 独立建表与维护。
全链路语义与根侧消费要点见[文档解析管理·全链路设计](../design/parsing-flow.md) §2。

## QED-Engine 学习表族（规划，暂缓）

学习中心（课程进度、练习记录、问答会话等，见 [学习功能现状](../plans/2026-09-10-learning-center-current-state.md)）
的元数据入本库，但**归属暂缓**：待学习中心 M2 里程碑（单课程试点，
依赖解析产物管线）启动时裁决——候选方案：① 扩展 `qed_*` 共享族（所有权委托 QED-Tracker
托管建表）；② 根仓库后端自建数据层（backend/ 引入 Alembic，`qed_learning_*` 或独立前缀）。
本文件届时补登记表清单与所有权。

## 迁移

- `qed` 库由各项目 Alembic **独立初始化**自己的表，互不影响；`qed_*` 共享表由 QED-Tracker
  Alembic 建表与维护（`qed_llm_calls` 结构由根仓库迁移定义后登记，所有权仍 QED-Tracker）。
- 新增表或共享字段变化：先更新本文件与对应契约，再实现迁移；
  **qed_* schema 变更顺序**（所有权方迁移先行 + 按契约演进流程通知消费方）见
  [cross-project-contracts §4](../design/cross-project-contracts.md) 与
  §10 契约演进规则，本文件不复制流程正文。

## 敏感字段规则

- `QED_DB_PASSWORD` 绝不下发到任何接口响应、日志或异常信息。
- 配置中心 `/config/database` 只返回 host/port/name/user/configured/reachable/reason；
  `reachable` 为启动时真实连接探测快照（pymysql 认证，3s 超时），未配置密码不探测
  （契约见 [api-contracts.md](api-contracts.md)）。

## 变量来源

`QED_DB_HOST`/`QED_DB_PORT`/`QED_DB_NAME`/`QED_DB_USER`/`QED_DB_PASSWORD` 的默认值与说明
以 [project-configuration.md](../design/project-configuration.md) 变量表为唯一事实源，
本文件不复制。

## 验证

- `pytest tests/contract -q` 全绿。
- 8900 `/config/database` 实测返回真实连接状态（`reachable`/`reason`），响应不含密码。
- 本文件零建表语句（事实源唯一铁律自证，由 `tests/contract/test_architecture_documents.py` 守护）。
- 子项目数据库冒烟以其各自仓库为准（QED_DB_SMOKE 等）。

## 决策依据

本文档的命名空间/共享表族/数据边界决策承载于
[ADR 0003](../history/adr/v0.1/0003-shared-qed-database-independence.md)、
[ADR 0009](../history/adr/v0.1/0009-shared-qed-tables.md)、
[ADR 0010](../history/adr/v0.1/0010-documentation-versioning.md)、
[ADR 0014](../adr/0014-parsing-ownership-and-model-boundary.md)；
历史备选方案（旧 database-schema.md 三件套替代、meta/ JSON 退役过程）见各 ADR 与
`docs/history/` 计划壳，本文件不保留裁决流水。
