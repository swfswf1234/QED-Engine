# ADR 0025：数据库设计总纲升为三项目总正本并承载建表语句

状态：Accepted
日期：2026-10-17
领域：架构与边界
决策阶段：v0.1
取代：—
被取代：—

本决定**收紧** [ADR 0017](0017-design-doc-structure-contract.md) 决定 2（根 `architecture/` 是根侧
surface 事实源）在数据库域的适用范围，并**延续** [ADR 0020](0020-task-closure-cadence-and-thin-registration.md)
「过程叙述归壳」到固定文档正文；不取代任何既有 ADR。零建表语句口径由 ARCH-031 计划轮
（2026-09-24）与长期行 REQ-047 设立，非 ADR 决定，故本处以新决定改判。

## 背景

REQ-122（database-design.md 从纯登记层改判为核心设计正本）执行到 W3 时，用户 2026-10-17 追加
四项裁决：① 本文后续作为**三个项目的数据库总设计文档**，QED-Tracker 的库根侧也负责（其保守性
要求＝根项目未启动时 8901 仍能独立运行，故这是文档权威的归属，不产生运行时依赖）；② 每个表要写
建表语句；③ 表族顺序改为本项目自视角；④ 本文是稳定文档，正文不得出现任何过程性描述。

其中 ②③④ 与本行已冻结的成功标准（S2 零建表语句原文、S4 四段顺序沿用 REQ-120 判据）和
REQ-047 的 S1/S3（总纲保持零 DDL 纯登记层、根侧无 DDL 快照副本）正面冲突，需先立 ADR 反转
强制口径，再改台账，再改守护，最后才动正文。取证支持：QED-Tracker **无 Alembic 迁移链**，
`models.py` 是唯一形状事实源（其 ADR 0006「模型即 schema」），其两份数据库文档已自陈「本文 DDL
为设计展示、实施事实源为 ORM」——把根文档升为正本不会与之争夺实施事实源；Axiom-Flow 的 DDL
真源是其 Alembic 链，根文档本轮不接管其列级内容。

## 决定

1. **文档定位**：`docs/architecture/database-design.md` 是共享 MySQL 库（工作库 `qed_test`、
   生产库 `qed`）的**三项目数据库总设计正本**。负责任粒度＝表清单、表族归属、列名与列序、
   SQL 类型与宽度、可空性、默认值语义、列注释、索引与约束、建表语句；**不负责任**迁移执行
   编排、运行时连接配置、数据搬迁脚本（这些指向代码与各仓库迁移面）。
2. **建表语句进文档**（反转「零 DDL 纯登记层」）：
   - 根侧代码持有 DDL 的九张表（`qed_knowledge_point`、`qed_llm_calls` 与七张 `qe_learn_*`）
     在本文写建表语句，且**与代码渲染结果逐字对齐**，由契约守护比对，任一侧改动即红。
   - 形状事实源在 QED-Tracker ORM 的两张共享表（`qed_domain`、`qed_course`）在本文写
     **等价展示 DDL**（由 ORM 派生，可执行面仍是对方 `create_all`/`ensure_schema`），守护
     比对列名、列序、类型与可空性，不比对逐字。
   - `qt_*` 与 `af_*` 两族本轮仍**只在总览登记与路由**，不写逐列小节与建表语句；其逐列晋升
     为正本属后续批次的改判，届时本文按同一形态接管、对方文档的「唯一事实源」声明降级为镜像。
3. **表族顺序**：一律按 **共享 `qed_*` → 根私有 `qe_*` → `af_*` → `qt_*`** 排列（本项目自视角、
   前缀即所有权），取代 REQ-120 的「共享 → `qt_*` → `af_*` → 根私有」顺序判据。跨项目影响面
   降序的阅读动线改由「变更与运维规范」章的变更顺序表承载，不再靠段落顺序表达。
4. **固定文档去过程化守则**（`architecture/` 与 `design/` 正文，强制）：
   - 不写裁决流水——谁在哪日提出、如何改判、轮次过程与证据一律落承载壳「过程与证据」节与
     git log（ADR 0020 在文档域的展开）。
   - 一次性事实（库内现状、未完迁移、跨项目偏差、待确认命名）**只能以表格备注承载**，
     不得成段叙述；无表可挂的事实用一行「待确认」条目登记。
   - 引用裁决保留**编号**（ADR/REQ/DEFECT/M 号）以便追溯，但不带叙述。
5. **机械与台账随步**：`test_database_design_is_registry_only_with_er_diagram` 的零
   `CREATE TABLE` 断言删除、改为 DDL 逐字对齐守护；新增「每表小节四件套齐备」与「总览表行数
   ＝读写矩阵行数」守护；REQ-047 与 REQ-122 两行的成功标准列按本决定改判。

## 后果

- 收益：一处读全库表设计与可执行形状，列级形状不再跨仓拼装；根侧改列时文档与代码同批红。
- 代价与缓解：DDL 双写（代码 + 文档）有漂移风险，以逐字对齐守护锁死；两份对方文档的正本声明
  需经请求稿改为镜像，回执前本文以其代码为形状事实源、不改写其正文。
- 本决定不改变独立性铁律与生产库红线：`qed_*` schema 变更仍先经根仓库登记，生产 `qed` 库的
  DDL 执行仍属 D 类转人工窗口。

## 关联

- 标准：[docs/standards/doc-governance.md](../standards/doc-governance.md)、
  [docs/standards/task-lifecycle.md](../standards/task-lifecycle.md)、
  [docs/standards/cross-project-collaboration.md](../standards/cross-project-collaboration.md)
- 文档：[docs/architecture/database-design.md](../architecture/database-design.md)（本决定落点）
- 测试：`tests/contract/test_architecture_documents.py`
- ADR：0009（共享 `qed_*` 表族）、0017（事实源唯一）、0020（过程叙述归壳）、
  0023（成功标准正本在台账行）、0024（1.0 前 schema 重建档位）
- 承载：[REQ-122 计划壳](../history/plans/2026-10/2026-10-16-database-design-core-registry.md)
