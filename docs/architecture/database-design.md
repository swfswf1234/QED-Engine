# 数据库设计（共享 qed 库总纲）

设计状态：Accepted
实现状态：In Progress
最后更新：2026-08-20
关联代码：`.env.example`（变量模板）
关联测试：`tests/contract/test_architecture_documents.py`
关联 ADR：`docs/adr/0003-shared-qed-database-independence.md`、`docs/adr/0009-shared-qed-tables.md`（2026-08-16：新增 `qed_*` 共享表族，部分补充 0003）、`docs/adr/0010-documentation-versioning.md`

> 本文件是 **QED-Engine 的固定数据库设计文档（总纲）**（ADR 0010）：只登记共享 `qed` 库的
> 命名空间隔离规则、表清单总览与跨项目契约要点；**qt_*/af_* 部分置空，指向子项目各自的
> 数据库设计文档**（QED-Tracker `docs/architecture/database-schema.md` 为其全部
> `qed_*`/`qt_*` 表唯一事实源；Axiom-Flow 的 `af_*` 表由其仓库定义）。版本末期确认更新后，
> 前版本进 `history/`。

## 目的与边界

本文件是根仓库对共享 MySQL `qed` 库的**指引与规划**：只登记命名空间隔离规则、表清单总览与
跨项目契约要点；**具体表结构与迁移由各子项目仓库确认与维护**（`qt_*` 属 QED-Tracker、
`af_*` 属 Axiom-Flow、`qed_*` 共享表所有权 QED-Tracker），根仓库不复制其定义。QED-Tracker
侧已回执（REQ-026 关闭，2026-08-16）：其 `docs/architecture/database-schema.md`（原
`docs/design/`，2026-08-20 文档规范轮调整）为 qed 库全部 `qed_*`/`qt_*` 表**唯一事实源**。
Axiom-Flow 侧 af_* 表确认动作登记于 [REQ-027](../trackers/todo.md)。
跨项目对接语义见[三项目对接规范](../design/service-contracts.md)。

**数据边界新模式（2026-08-16 用户裁决，ARCH-013）**：dataset 只管理数据资料（原始数据 +
整理后解析产物，见 [dataset-conventions.md](../design/dataset-conventions.md)）；**元数据默认存数据库**
——登记、状态、进度、评价、课程体系、任务记录等一律入本库，`meta/` JSON 不再作为事实源
（退役，REQ-032）。

## 库与命名空间

- MySQL 8，库名 `qed`，三个项目共用同一实例与库——独立性铁律的明确例外（[ADR 0003](../adr/0003-shared-qed-database-independence.md)）。
- 表命名空间隔离：QED-Tracker 使用 `qt_*` 前缀，Axiom-Flow 使用 `af_*` 前缀；互不读取对方表。
- **共享 `qed_*` 前缀表族**（2026-08-16，[ADR 0009](../adr/0009-shared-qed-tables.md) 补充 0003）：
  三项目共用的基础元数据；所有权 QED-Tracker（Alembic 建表维护），其他项目只读不写；
  schema 变更须先在本文件登记。
- 凭据与库名唯一事实源：根 `.env` 的 `QED_DB_*` 变量（见
  [configuration-and-secrets.md](../design/configuration-and-secrets.md) 统一数据库小节）。
- 存量库 `xqfm11`（Axiom-Flow 运行库）不迁移、不改名。

## 表清单总览

| 表 | 前缀 | 所有权 | 一行= | 状态 | 事实源 |
| --- | --- | --- | --- | --- | --- |
| `qed_domain` | 共享 | QED-Tracker 建表维护，其他项目只读 | 一个学科（math；扩展预留），含 stages | QED-031，迁移 0006 已落地 | QED-Tracker database-schema.md |
| `qed_course` | 共享 | 同上 | 一门课程（阶段/先修 DAG/别名/顺序），取代 courses/math.json | QED-031 | QED-Tracker database-schema.md |
| `qed_llm_calls` | 共享 | QED-Tracker 建表维护，三项目可写 | 一次 LLM 调用记录（prompt/回答/耗时/成败） | ARCH-016，根仓库迁移 | 本文件（ARCH-016 登记）；结构见 [llm-gateway-and-model-management](../design/llm-gateway-and-model-management.md) |
| `qt_knowledge` | 私有 | QED-Tracker | 一套教程（tutorial）或一组课程延展资料归类（other_material） | QED-031 | QED-Tracker database-schema.md |
| `qt_books` | 私有 | QED-Tracker | 一册/一卷/一个快照（candidate→decided→downloading→downloaded→verified） | QED-031 | QED-Tracker database-schema.md |
| `qt_sources` | 私有 | QED-Tracker | 一次渠道尝试（外键挂 book_id） | QED-031 | QED-Tracker database-schema.md |
| `qt_*` 任务/存量表 | 私有 | QED-Tracker | 任务记录、存量迁移备份（qt_sources_legacy 等） | 见 database-schema.md | QED-Tracker database-schema.md |
| `af_*`（af_books / af_block_reviews 等） | 私有 | Axiom-Flow | 解析书目、块级判定等 | **待 REQ-027 确认** | Axiom-Flow 仓库（待建） |
| 学习表族（规划） | 暂缓 | 待裁决 | 课程进度/练习记录/问答会话 | 规划，M2 里程碑启动时裁决 | 本文件「学习表族规划」节 |

> **qt_*/af_* 部分置空（2026-08-20 用户裁决）**：QED-Engine 总纲不复制子项目表结构，
> 一律指向子项目数据库文档。qt_* 详情见 QED-Tracker `docs/architecture/database-schema.md`；
> af_* 详情待 Axiom-Flow 仓库定义（REQ-027 承接）。

## qed_* 共享表族

三项目共用的基础元数据；QED-Tracker 唯一写权限（Alembic 建表维护），其他项目只读不写
（`qed_llm_calls` 例外：三项目均可写入调用记录，表结构由根仓库迁移定义）。schema 变更须先
在本文件登记。

### qed_domain / qed_course（课程体系，QED-031）

领域 → 课程的知识体系元数据（含 stages、先修 DAG、别名、sort_order），取代 QED-Tracker
`courses/math.json`。字段明细与迁移见 QED-Tracker database-schema.md（唯一事实源）。

### qed_llm_calls（LLM 调用记录，ARCH-016）

三项目 LLM 调用记录单表（prompt/回答/耗时/成败），用于 prompt 与工具调用调优。所有权
QED-Tracker 托管建表，**三项目可写**（网关统一写 + 子项目 local 直连自写，`service` 字段
标识调用方）。结构（字段明细见 [llm-gateway-and-model-management](../design/llm-gateway-and-model-management.md)）：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | BIGINT PK AUTO_INCREMENT | — |
| `service` | VARCHAR(32) | 调用方：`qed_engine` / `qed_tracker` / `axiom_flow` |
| `mode` | VARCHAR(16) | `api` / `local` |
| `provider` | VARCHAR(32) | `qwen` / `deepseek` / `glm` / `lmstudio` / `mineru` / `gateway` |
| `model` | VARCHAR(64) | 实际模型名 |
| `endpoint` | VARCHAR(16) | `text` / `vision` / `embedding` |
| `prompt_template` | VARCHAR(255) | 模板名/标识，可空 |
| `prompt` | MEDIUMTEXT | 实际提问 |
| `response` | MEDIUMTEXT | 实际回答 |
| `duration_ms` | INT | 耗时 |
| `status` | VARCHAR(16) | `success` / `error` |
| `error` | VARCHAR(500) | 失败原因，可空 |
| `created_at` | DATETIME | 调用时间 |
| `task` | VARCHAR(64) | 任务标识（如 paper-plan、book-eval），可空（REQ-060） |
| `step` | VARCHAR(32) | 步骤标识（如 plan、assess、propose），可空（REQ-060） |
| `review_status` | VARCHAR(16) | 审核状态：`unreviewed` / `passed` / `rejected`（REQ-060） |
| `review_note` | VARCHAR(1000) | 审核备注，可空（REQ-060） |

## qt_*（QED-Tracker，私有）

QED-Tracker 定义自身完整数据库定义（`docs/architecture/database-schema.md` 唯一事实源，
REQ-026 已回执；2026-08-20 起作为固定文档）。知识层次五表：qt_knowledge（教程/资料归类）、
qt_books（书行状态机）、qt_sources（渠道尝试）+ 任务记录表。根仓库总纲不复制其结构。

## af_*（Axiom-Flow，私有，规划）

Axiom-Flow 侧表结构待其仓库设计确认（REQ-027），确认后由 Axiom-Flow 定义完整数据库文档；
根仓库只维护命名空间与敏感字段规则，不复制其结构。当前已知规划表：af_books（解析书目，
含课程归属与解析进度）、af_block_reviews（块级判定，REQ-042）。

## QED-Engine 学习表族（规划，暂缓）

学习中心（课程进度、练习记录、问答会话等，见 [learning-center.md](../design/learning-center.md) §4）
的元数据入本库，但**归属暂缓**（2026-08-16 用户裁决）：待学习中心 M2 里程碑（单课程试点，
依赖解析产物管线）启动时裁决——候选方案：① 扩展 `qed_*` 共享族（所有权委托 QED-Tracker
托管建表）；② 根仓库后端自建数据层（backend/ 引入 Alembic，`qed_learning_*` 或独立前缀）。
本文件届时补登记表清单与所有权。

## 迁移

- `qed` 库由各项目 Alembic **独立初始化**自己的表，互不影响；`qed_*` 共享表由 QED-Tracker
  Alembic 建表与维护（`qed_llm_calls` 结构由根仓库迁移定义后登记，所有权仍 QED-Tracker）。
  存量 `xqfm11` 库不迁移。
- 新增表或共享字段变化：先更新本文件与对应契约，再实现迁移。

## 敏感字段规则

- `QED_DB_PASSWORD` 绝不下发到任何接口响应、日志或异常信息。
- 配置中心 `/config/database` 只返回 host/port/name/user/configured/reachable/reason；
  `reachable` 为真实连接探测（pymysql 认证，3s 超时、结果缓存 60s），未配置密码不探测
  （契约见 [api-contracts.md](api-contracts.md)）。

## 变量来源

`QED_DB_HOST`/`QED_DB_PORT`/`QED_DB_NAME`/`QED_DB_USER`/`QED_DB_PASSWORD` 的默认值与说明
以 [configuration-and-secrets.md](../design/configuration-and-secrets.md) 变量表为唯一事实源，
本文件不复制。

## 验证

- `pytest tests/contract -q` 全绿。
- 8900 `/config/database` 实测返回真实连接状态（`reachable`/`reason`），响应不含密码。
- 子项目数据库冒烟以其各自仓库为准（QED_DB_SMOKE 等）。
