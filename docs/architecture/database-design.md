# 数据库设计（共享 qed 库总纲）

设计状态：Accepted
实现状态：In Progress
最后更新：2026-08-31
需求方：QED-Tracker（课程体系 `qed_domain`/`qed_course`，REQ-026/QED-031）、QED-Engine（LLM 调用记录 `qed_llm_calls`，ARCH-016）
确认状态：暂定
关联代码：`.env.example`（`QED_DB_*` 变量模板）
关联测试：`tests/contract/test_architecture_documents.py`、`tests/test_llm_call_log.py`
关联 ADR：`docs/history/adr/v0.1/0003-shared-qed-database-independence.md`、`docs/history/adr/v0.1/0009-shared-qed-tables.md`（2026-08-16：新增 `qed_*` 共享表族，部分补充 0003）、`docs/history/adr/v0.1/0010-documentation-versioning.md`

> 本文件是 **QED-Engine 的固定数据库设计文档（总纲）**（ADR 0010）：只登记共享 `qed` 库的
> 命名空间隔离规则、表清单总览与跨项目契约要点；**qt_*/af_* 部分置空，指向子项目各自的
> 数据库设计文档**（QED-Tracker `docs/architecture/database-schema.md` 为其全部
> `qed_*`/`qt_*` 表**结构**唯一事实源；Axiom-Flow `docs/architecture/database-design.md`
> 定义其 `af_*` 表）。版本末期确认更新后，前版本进 `history/`。

## 目的与边界

本文件是根仓库对共享 MySQL `qed` 库的**登记与指引**：只维护命名空间隔离规则、表清单总览与
跨项目契约要点。共享表 `qed_*` 的**结构事实源仍在 QED-Tracker**（其 Alembic 建表维护，
根仓库仅登记同步）；`qt_*` 属 QED-Tracker、`af_*` 属 Axiom-Flow，根仓库不复制其表结构定义。
QED-Tracker 侧已回执（REQ-026 关闭，2026-08-16）：其 `docs/architecture/database-schema.md`
为 qed 库全部 `qed_*`/`qt_*` 表**唯一事实源**。Axiom-Flow 侧「af_* 包定义确认」登记于
[REQ-027](../trackers/todo.md)，其 `docs/architecture/database-design.md`
（2026-08-21）已登记 af_books / af_block_reviews（V2-013 规划契约）。
跨项目对接语义见[三项目对接规范](../design/service-contracts.md)。

**数据边界新模式（2026-08-16 用户裁决，ARCH-013）**：dataset 只管理数据资料（原始数据 +
整理后解析产物，见 [dataset-conventions.md](../design/dataset-conventions.md)）；**元数据默认存数据库**
——登记、状态、进度、评价、课程体系、任务记录等一律入本库，`meta/` JSON 不再作为事实源
（退役，REQ-032）。

## 库与命名空间

- MySQL 8，库名 `qed`，三个项目共用同一实例与库——独立性铁律的明确例外（[ADR 0003](../history/adr/v0.1/0003-shared-qed-database-independence.md)）。
- 表命名空间隔离：QED-Tracker 使用 `qt_*` 前缀，Axiom-Flow 使用 `af_*` 前缀；互不读取对方表。
- **共享 `qed_*` 前缀表族**（2026-08-16，[ADR 0009](../history/adr/v0.1/0009-shared-qed-tables.md) 补充 0003）：
  三项目共用的基础元数据；所有权 QED-Tracker（Alembic 建表维护），其他项目只读不写；
  schema 变更须先经根仓库登记（ADR 0009）。`qed_llm_calls` 例外：三项目均可写入调用记录，
  表结构由根仓库迁移定义后登记（所有权仍 QED-Tracker）。
- 凭据与库名唯一事实源：根 `.env` 的 `QED_DB_*` 变量（见
  [configuration-and-secrets.md](../design/configuration-and-secrets.md) 统一数据库小节）。
- 存量库 `xqfm11`（Axiom-Flow 运行库）不迁移、不改名。

## 表清单总览

| 表 | 前缀 | 所有权 | 一行= | 状态 | 事实源 |
| --- | --- | --- | --- | --- | --- |
| `qed_domain` | 共享 | QED-Tracker 建表维护，其他项目只读 | 一个学科（math；扩展预留），含 stages | QED-031，迁移 0006 已落地 | QED-Tracker database-schema.md |
| `qed_course` | 共享 | 同上 | 一门课程（阶段/先修 DAG/别名/顺序），取代 courses/math.json | QED-031 | QED-Tracker database-schema.md |
| `qed_llm_calls` | 共享 | QED-Engine 后端建表维护（call_log.py 幂等），三项目可写 | 一次 LLM 调用记录（prompt/回答/耗时/成败） | ARCH-016，根仓库迁移 | 本文件（ARCH-016 登记）；结构见 [llm-gateway-and-model-management](../design/llm-gateway-and-model-management.md) |
| `qt_knowledge` | 私有 | QED-Tracker | 一套教程（tutorial）或一组课程延展资料归类（other_material） | QED-031 | QED-Tracker database-schema.md |
| `qt_books` | 私有 | QED-Tracker | 一册/一卷/一个快照（candidate→decided→downloading→downloaded→verified） | QED-031 | QED-Tracker database-schema.md |
| `qt_sources` | 私有 | QED-Tracker | 一次渠道尝试（外键挂 book_id） | QED-031 | QED-Tracker database-schema.md |
| `qt_*` 任务/存量表 | 私有 | QED-Tracker | 任务记录、存量迁移备份（qt_sources_legacy 等） | 见 database-schema.md | QED-Tracker database-schema.md |
| `af_books` | 私有 | Axiom-Flow | 一册已验证书（qt_books 只读快照 + 解析进度） | **规划**（V2-013 承接） | Axiom-Flow database-design.md |
| `af_block_reviews` | 私有 | Axiom-Flow | 一次块级判定（一致/不一致） | **规划**（V2-013 承接） | Axiom-Flow database-design.md |
| 学习表族（规划） | 暂缓 | 待裁决 | 课程进度/练习记录/问答会话 | 规划，M2 里程碑启动时裁决 | 本文件「学习表族规划」节 |

> **qt_*/af_* 部分置空**：QED-Engine 总纲不复制子项目表结构，一律指向子项目数据库文档。
> qt_* 详情见 QED-Tracker `docs/architecture/database-schema.md`；af_* 详情见
> Axiom-Flow `docs/architecture/database-design.md`。

## qed_* 共享表族

三项目共用的基础元数据；QED-Tracker 唯一写权限（Alembic 建表维护），其他项目只读不写
（`qed_llm_calls` 例外：三项目均可写入调用记录，表结构由根仓库迁移定义）。schema 变更须先
在本文件登记（ADR 0009）。

### qed_domain（领域表，共享）

一行 = 一个学科领域（当前仅 math，预留扩展）。所有权 QED-Tracker（Alembic 建表维护），其他项目只读不写。

#### DDL

```sql
CREATE TABLE qed_domain (
  domain_id          VARCHAR(32)   NOT NULL,           -- PK：math（学科标识，扩展预留）
  name               VARCHAR(100)  NOT NULL,           -- 显示名（数学）
  description        TEXT          NOT NULL,           -- 学科介绍
  level              VARCHAR(50)   NOT NULL DEFAULT '',-- 探索范围（本科-硕士）
  scope              TEXT          NOT NULL,           -- 学科知识（管线暂不输出，置空）
  exploration_stage  VARCHAR(20)   NOT NULL DEFAULT '未开始', -- 流程状态（6态）
  classic_tracks     JSON          NOT NULL,           -- 课程方向 [{name,summary,kind}] 0~4 项
  stages             JSON          NOT NULL,           -- 学习阶段顺序（无默认值）
  path_results       JSON,                            -- 学习流程（notes/edges/graph_td）
  explore_pending    JSON,                            -- 探索待确认载荷（REQ-067-B12）
  created_by         VARCHAR(16)   NOT NULL DEFAULT '',
  updated_by         VARCHAR(16)   NOT NULL DEFAULT '',
  created_at         DATETIME      NOT NULL,
  updated_at         DATETIME      NOT NULL,
  PRIMARY KEY (domain_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='领域表：按学科组织课程体系，一行一个学科，记录学科介绍、探索范围与学习阶段划分';
```

#### 列说明

| # | 列名 | 类型 | 默认值 | 说明 |
|---|---|---|---|---|
| 1 | `domain_id` | VARCHAR(32) PK | — | 领域标识，如 "math"。扩展预留，不使用自增 ID |
| 2 | `name` | VARCHAR(100) | — | 显示名，如 "数学" |
| 3 | `description` | TEXT | — | 学科介绍（LLM 生成，人工审） |
| 4 | `level` | VARCHAR(50) | `""` | 探索范围标签，如 "本科-硕士"。管线 domain@v2 输出 |
| 5 | `scope` | TEXT | `""` | 学科知识（领域边界描述）。当前管线不输出，先置空 |
| 6 | `exploration_stage` | VARCHAR(20) | `"未开始"` | 流程状态枚举（6态，见下文状态机） |
| 7 | `classic_tracks` | JSON | `[]` | 课程方向，JSON 数组 [{name, summary, kind}]，0~4 项。`kind`：`main`=主干方向 / `branch`=分支方向 |
| 8 | `stages` | JSON | —（无默认值） | 学习阶段顺序列表，值为四档 `["基础","主干","分支","前沿"]` |
| 9 | `path_results` | JSON | `null` | 学习流程，可空。包含 notes/edges[{from,to}]/graph_td |
| 10 | `explore_pending` | JSON | `null` | 探索待确认载荷（REQ-067-B12）：`待确认` = `{kind:"review_results", courses:[...], domain_report}`；`失败` = `{kind:"failed", error:"..."}`；其余状态 NULL |
| 11-14 | audit | — | — | created_by/updated_by/created_at/updated_at |

#### exploration_stage 状态机（6 态，REQ-067-B12 契约）

```
未开始 → 已生成 → 探索中 → 待确认 → 已完成
                        └──────────────→ 失败
（待确认 --re-explore--> 探索中；失败可由 8900 重新发起探索回到 探索中）
```

| 值 | 触发时机 | 写主体 | explore_pending |
|---|---|---|---|
| 未开始 | 手动创建 | 创建方（8900 直建或本仓库 API） | NULL |
| 已生成 | 探索会话产出报告、待用户确认 | **8900**（写权限例外，见下） | NULL |
| 探索中 | 探索会话启动 | **8900**（同上） | NULL |
| 待确认 | 探索完成、审阅结果待用户采纳（REQ-067-B12） | **8900**（同上） | `{kind:"review_results", courses:[...], domain_report}` |
| 已完成 | 审阅采纳落库（本仓库 API）或手动导入（8901 `/domains/import`） | **本仓库 8901** | NULL（采纳时清空） |
| 失败 | 探索失败 / 服务重启中断 | **本仓库 8901** | `{kind:"failed", error:"服务重启，探索任务中断"}` |

#### 写入权限

- **写**：QED-Tracker（Alembic 迁移建表 + API 端点 + CLI）。
- **读**：QED-Engine 后端（前端学习中心透传）、Axiom-Flow（只读）。
- **8900 离线降级直写例外**：description、stages、exploration_stage、explore_pending（REQ-067-B12）。

---

### qed_course（课程表，共享）

一行 = 一门课程。所有权 QED-Tracker（Alembic 建表维护），其他项目只读不写。

#### DDL

```sql
CREATE TABLE qed_course (
  course_id          VARCHAR(64)   NOT NULL,         -- PK：01_math_analysis
  domain_id          VARCHAR(32)   NOT NULL,         -- FK → qed_domain.domain_id；索引
  sort_order         INT           NOT NULL,         -- 学习顺序（DAG 拓扑序）
  name               VARCHAR(200)  NOT NULL,         -- 规范名（数学分析）
  aliases            JSON          NOT NULL,         -- list[str]：别名
  track              VARCHAR(50)   NOT NULL DEFAULT '',-- 课程所属学术方向
  stage              VARCHAR(32)   NOT NULL,         -- 所属阶段（qed_domain.stages 之一）
  prerequisites      JSON          NOT NULL,         -- list[str]：先修 course_id 数组
  related_targets    JSON          NOT NULL,         -- list[str]：已验收关联目标
  description        VARCHAR(1000) NOT NULL DEFAULT '',-- 课程介绍
  exploration_stage  VARCHAR(20)   NOT NULL DEFAULT '未开始', -- 流程状态（6态）
  explore_pending    JSON,                            -- 探索待确认载荷（REQ-067-B12）
  created_by         VARCHAR(16)   NOT NULL DEFAULT '',
  updated_by         VARCHAR(16)   NOT NULL DEFAULT '',
  created_at         DATETIME      NOT NULL,
  updated_at         DATETIME      NOT NULL,
  PRIMARY KEY (course_id),
  KEY ix_qed_course_domain (domain_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='课程表：登记一门课程，记录课程名称、所属阶段、先修关系与学习顺序';
```

#### 列说明

| # | 列名 | 类型 | 默认值 | 说明 |
|---|---|---|---|---|
| 1 | `course_id` | VARCHAR(64) PK | — | 课程标识，如 "01_math_analysis" |
| 2 | `domain_id` | VARCHAR(32) | — | 所属领域，FK → qed_domain.domain_id |
| 3 | `sort_order` | INT | 0 | 学习顺序（DAG 拓扑序） |
| 4 | `name` | VARCHAR(200) | — | 规范名，如 "数学分析" |
| 5 | `aliases` | JSON | `[]` | 别名列表，如 ["高等数学（工科称呼）"] |
| 6 | `track` | VARCHAR(50) | `""` | 课程所属学术方向，如 "分析学"。管线 courses@v4 输出 |
| 7 | `stage` | VARCHAR(32) | — | 所属学习阶段，值域来自 qed_domain.stages |
| 8 | `prerequisites` | JSON | `[]` | 先修 course_id 数组（主知识链路 DAG） |
| 9 | `related_targets` | JSON | `[]` | 已通过验收的关联 catalog 目标（随验收回填） |
| 10 | `description` | VARCHAR(1000) | `""` | 课程介绍（原 note 字段，2026-08-27 重命名） |
| 11 | `exploration_stage` | VARCHAR(20) | `"未开始"` | 流程状态枚举（6态，同 qed_domain） |
| 12 | `explore_pending` | JSON | `null` | 探索待确认载荷（REQ-067-B12）：`待确认` = `{kind:"review_results", tutorials:[...]}`；`失败` = `{kind:"failed", error:"..."}`；其余状态 NULL |
| 13-16 | audit | — | — | created_by/updated_by/created_at/updated_at |

#### stage 字段说明

`stage` 的值域来自 `qed_domain.stages`（四档：`基础/主干/分支/前沿`，2026-08-29 用户裁定）。

#### exploration_stage 状态机（6 态，同 qed_domain）

`未开始 → 已生成 → 探索中 → 待确认 → 已完成`，`探索中/待确认 → 失败`。值域、explore_pending 载荷与实现状态标注见上文 qed_domain 状态机节（REQ-067-B12 契约）。

| 阶段 | 触发条件 | 写主体 |
|---|---|---|
| 未开始 | 手动创建 | 创建方（8900 直建或本仓库 API） |
| 已生成 | course-explore tutorials@v1 完成 | **8900**（写权限例外，见下） |
| 探索中 | 正式探索启动（异步场景） | **8900**（同上） |
| 待确认 | 课程探索完成、教材审阅结果待采纳（REQ-067-B12） | **8900**（同上） |
| 已完成 | 教材采纳 + 验收完成（knowledge complete 聚合时顺带回写）或课程 apply-results | **本仓库 8901** |
| 失败 | 探索失败 / 服务重启中断 | **本仓库 8901** |

#### 写入权限

- **写**：QED-Tracker（Alembic 迁移 + API 端点 + CLI + migrate_knowledge 脚本）。
- **读**：QED-Engine 后端（前端学习中心透传）、Axiom-Flow（只读）。
- **8900 离线降级直写例外**：stage、sort_order、description、aliases、exploration_stage、explore_pending（REQ-067-B12）。

### qed_llm_calls（LLM 调用记录，ARCH-016）

三项目 LLM 调用记录单表（prompt/回答/耗时/成败），用于 prompt 与工具调用调优。所有权
QED-Engine 后端（`backend/qed_engine/services/llm/call_log.py` 幂等建表 + `ensure_comments()`
注释补齐，2026-08-28 表/列中文注释已全量落库），**三项目可写**（网关统一写 + 子项目 local
直连自写，`service` 字段标识调用方）。表结构由根仓库迁移定义；字段明细见
[llm-gateway-and-model-management](../design/llm-gateway-and-model-management.md)：

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
qt_books（书籍状态机）、qt_sources（渠道尝试）+ 任务记录表。根仓库总纲不复制其结构。

## af_*（Axiom-Flow，私有）

Axiom-Flow 侧表结构由 Axiom-Flow `docs/architecture/database-design.md` 定义（REQ-027 已收尾，
2026-08-21 登记）；根仓库只维护命名空间与敏感字段规则，不复制其结构。当前已登记规划表：
af_books（解析书目，含课程归属与解析进度）、af_block_reviews（块级判定，REQ-042）；
两者均为 **V2-013 规划契约**，冻结节点以 V2-013 回执为准。

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
  `reachable` 为启动时真实连接探测快照（pymysql 认证，3s 超时），未配置密码不探测
  （契约见 [api-contracts.md](api-contracts.md)）。

## 变量来源

`QED_DB_HOST`/`QED_DB_PORT`/`QED_DB_NAME`/`QED_DB_USER`/`QED_DB_PASSWORD` 的默认值与说明
以 [configuration-and-secrets.md](../design/configuration-and-secrets.md) 变量表为唯一事实源，
本文件不复制。

## 验证

- `pytest tests/contract -q` 全绿。
- 8900 `/config/database` 实测返回真实连接状态（`reachable`/`reason`），响应不含密码。
- 子项目数据库冒烟以其各自仓库为准（QED_DB_SMOKE 等）。

## 决策记录（2026-08-16 用户裁决）

1. **共享 `qed_*` 前缀表族**：领域/课程为三项目共享表，所有权 QED-Tracker（Alembic 建表
   维护），其他项目只读不写；schema 变更须先经根仓库登记（ADR 0009 补充 0003）。
2. **唯一数据库设计文档**：qed 库全部 `qed_*`/`qt_*` 表结构唯一事实源为 QED-Tracker
   database-schema.md，替代旧的 database-schema-ownership.md / three-table-schema.md。
3. **数据边界新模式**（ARCH-013）：元数据默认存数据库，dataset 只管理数据资料，`meta/` JSON
   退役（REQ-032）。
