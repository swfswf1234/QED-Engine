# af_ 表族重构综合请求（整合 REQ-123／129／133／135 四枚在册请求，挂 ARCH-025 轮线 2）（af-family-rebuild-consolidated-request）

状态：Accepted
任务类型：A
最后更新：2026-10-21
关联 ADR：[ADR 0014](../adr/0014-parsing-ownership-and-model-boundary.md)（解析能力与 `af_*` 表族归 Axiom-Flow）、
[ADR 0017](../adr/0017-design-doc-structure-contract.md)（事实源唯一）、
[ADR 0023](../adr/0023-todo-row-carries-scope-and-criteria.md)（成功标准正本在台账行）、
[ADR 0024](../adr/0024-preschema-rebuild-tiers-and-demo-gate.md)（1.0 前 schema 重建档位与 demo 门）、
[ADR 0025](../adr/0025-database-design-master-doc-and-ddl-ownership.md)（决定 3：前缀即所有权，`af_*` 列级正本在对方仓库文档）
关联设计：逐列形状正本＝Axiom-Flow PLAN-024（`Axiom-Flow/docs/plans/2026-10-21-af-table-family-rebuild.md`，
2026-10-21 同日定档；根侧 [REQ-134 壳](2026-10-21-af-table-architecture-design.md) 已退为指针，只作被否选项的证据与取证锚）；
本壳只发请求、不重述设计；
被整合四枚请求原文（已归档，逐条 R 项可查）＝
[REQ-123 书级三列回写与跨库分叉归一](../history/plans/2026-10/2026-10-17-af-books-parse-status-request.md)、
[REQ-133 结构梳理与迁移指针对齐](../history/plans/2026-10/2026-10-21-af-family-table-refactor-request.md)、
[REQ-135 档 B 整族重建与知识点两表](../history/plans/2026-10/2026-10-21-af-family-rebuild-kp-tables-request.md)、
REQ-129 保留期（其承载为[普通任务轮壳 W5](2026-09-29-ordinary-tasks-round.md) 与总纲 §7.9）；
根侧 [database-design.md](../architecture/database-design.md) §6.2／§7.3／§7.8／§7.9、
[cross-project-contracts.md](../design/cross-project-contracts.md) §4／§6；
Axiom-Flow [database-design.md](../../Axiom-Flow/docs/architecture/database-design.md)（`af_*` 结构与迁移链唯一事实源，**只读**）、
Axiom-Flow [parsing-management.md](../../Axiom-Flow/docs/design/parsing-management.md)（PM-16／PM-17／PM-18）
关联 Tracker：docs/trackers/todo.md（REQ-136 登记，Axiom-Flow（V1.0）优化轮 ARCH-025 节；本行取代 REQ-123／REQ-129／REQ-133／REQ-135 四行，其逐条 R 项并入本壳工作项）
归档判定：Retain（四枚请求的合并裁定、`af_*` 现状读数与「一次重构只开一个回执窗口」的口径属不可替代过程证据）

## 对接信息（跨项目协作规范·计划文档模板）

| 项 | 值 |
| --- | --- |
| 需求方 | QED-Engine 根仓库（8900 消费侧与总纲事实源维护方） |
| 目标项目 | Axiom-Flow（8902，`af_*` 表族与迁移链所有权方） |
| 接口面 | `af_books`／`af_pages`／`af_parse_jobs`／`af_page_regions` 四枚私有表 + 共享 `qed_llm_calls`；8902 只读导出端点；根侧总纲 §6.2／§7.8／§7.9 三处登记面 |
| 评审方 | Axiom-Flow 侧独立评审轮（其 ADR 与准入守则为准）；根侧只就写权边界与消费语义提出判据 |
| 执行方 | Axiom-Flow（库内 DDL、迁移链、代码与文档）；根侧零代码零 DDL，只在表级变更落地后同批随步总纲 |
| 验收标准 | 见台账行 REQ-136 `成功标准` 列（正本在行，ADR 0023），本壳不复制判据条目 |

## 目标与成功标准

**目标**：把「af_ 表族要怎么改」这件事收成**一次重构、一个回执窗口**。合并理由不是省事，而是这四件事互相决定
形状——整族重建（原 REQ-135）一旦采纳，三列语义（原 REQ-123）、双列权威归属（原 REQ-133 R3）、保留期与
不可裁剪不变量（原 REQ-129）都要在同一个新形状里重定；分四批发函必然出现「先回执的口径被后落地的重建推翻」。
本壳只做整合与裁定，逐列形状正本＝对方 PLAN-024（2026-10-21 定档，REQ-134 同日退为指针）。

**为什么现在做**：`af_*` 处于 ADR 0024 的 1.0 前重建档位（无兼容负担、可整族重建），而根侧消费面已把三列
不自洽读成实际缺陷（`GET /books`「completed 但无可读版本」）。重建档位是窗口，过了 V1.0 就要走加列红线。

## 范围与非目标

- 范围：`af_*` 五表（含 `af_page_regions`）的结构层判定、迁移链指针与两库（`qed`／`qed_test`）实存对齐、
  知识点梳理两枚新表（`af_kp_nodes`／`af_kp_edges`）的准入裁定、解析正文入库三案择一、书级三列写入语义、
  `af_parse_jobs` 保留期口径。
- 非目标：不重述 REQ-134 的逐列形状与服务端不变式；不动共享 `qed_*` 四表与根私有 `qe_*` 七表（后者归 REQ-132）；
  不认领渲染面（ARCH-027-M1）、检索配方与向量库（本请求只到形状，不到检索实现）；根侧不代改对方代码、迁移面
  与库内数据。

## 前置条件

1. 本壳的发函对象＝Axiom-Flow 台账，需对方为综合请求立**一枚**承接行（不再为四枚原 ID 各立一行）。
2. 库内现状读数须可同机复算（REQ-135 归档件的两库读数为其依据；变化时以新读数为准并回填本壳过程与证据节）。
3. Axiom-Flow 侧达到 V1.0 版本前，本请求只做设计与预承接，不实施（ARCH-025 轮 S4 启动门槛）。

## 工作项（请求项与合并来源）

| 条目 | 请求项（合并来源） | 判定要点 | 责任侧 | 状态 |
| --- | --- | --- | --- | --- |
| R1 | 两库现状读数与文档自陈更正（原 REQ-133 R1、REQ-135 R1） | 对方 `alembic_version` 指针与 `af_page_regions`／`parser_signature` 实存的自陈 head 对齐；根侧总纲 §7.8 T7／T8 两行据其结论收口 | AF（根侧只读取证） | 待发函 |
| R2 | 档 B 整族重建采否四件必答（原 REQ-135 R2） | 采／不采／改造三择一，且作业行处置、`af_pages` 回归路径、空窗对 8900 与 8903 的可见后果、legacy 哨兵收法各给一条答案 | AF | 待发函 |
| R3 | 逐列形状、双列权威收敛与净新增两表准入（原 REQ-133 R2／R3／R5／R6、REQ-135 R3／R4、REQ-129 的 `af_books` 快照列侧） | **正本已移交对方 PLAN-024**（2026-10-21，根侧 [REQ-134 壳](2026-10-21-af-table-architecture-design.md) 同日退为指针）；本项只要求对方就净新增知识点表走其准入守则、三对同事实双列给权威归属、跨族引用列宽随共享表定档 | AF | 待发函 |
| R4 | 书级三列自洽与两库分叉归一（原 REQ-123 R1／R2、REQ-133 R4） | 复位语义写成三列不再互相打脸的取值口径；不重跑解析的分叉归一口径入 `af_*` 事实源；与 R2 同窗裁定（重建即重定，不出两次口径） | AF | 待发函 |
| R5 | `af_parse_jobs` 保留期与不可裁剪不变量（原 REQ-129） | 自定保留窗或明文「不清理」，并声明被 `af_books.active_job_id` 引用之行永不裁剪；触发阈值判据见总纲 §7.9，根侧不代设数值、不代执行 | AF | 待发函 |

## 过程与证据

### 2026-10-21 立项与四枚请求合并（用户裁决）

- 裁决＝把对 Axiom-Flow 的数据库修改请求挂成**一枚综合 todo 任务**、并入 ARCH-025 轮（解析 + 知识库），
  准备整族重构 `af_*` 专用库结构、综合考虑一起做；合并范围经用户择定为 **REQ-123 + REQ-129 + REQ-133 + REQ-135
  四枚**，REQ-134（我方设计稿、非出站请求）保留在册作逐列形状正本〔同日第二批随步：对方同日自立 PLAN-024 承载同一形状并
  已定档，逐列正本移交该稿，REQ-134 退为指针——本行「保留在册」仍是事实，但其身份变成被否选项的证据与根侧取证锚〕。
- 落点与治理口径：任务行只承载「任务描述 + 成功标准」（ADR 0023），四枚原 ID 的任务行原子移出 todo 写入
  completed.md（关闭结果 Not Applicable，取代关系见各行）；三枚原请求稿壳按「归并不删壳」（ADR 0021 第 5 条）
  移 `docs/history/plans/2026-10/` 并置 `状态：Superseded`，其逐条 R 项原文仍在归档件内可查，本壳不重述；
  ARCH-025 轮壳线 2 登记表加一行指针承载本请求（轮次不增设，ADR 0021 第 1 条）。
- 为何不是「REQ-136 行的锚直接指 ARCH-025 轮壳」：`tests/contract/test_tracker_governance.py`
  `test_todo_plan_rows_exactly_mirror_active_plan_bodies` 要求「一枚计划文件恰好被一行镜像、且
  `docs/plans/` 内每个计划文件都必须有镜像行」。一行指 ARCH-025 壳会与 ARCH-025 自己的行撞同一目标（断言
  `link.group("path") not in plan_rows` 直接红），且综合请求壳将成无主文件。故「挂到 ARCH-025 轮」在治理模型里的
  合法表达＝todo 行落在该轮分节 + 该轮壳登记表放指针 + 综合请求自持一壳一行。
- 同日并入的判据更正（本壳 R5 的依据）：`docs/architecture/database-design.md` §7.9 的「不可裁剪行」举例含
  `qed_course.active_job_id` 与「学习面 `ref_id` 指向的行」两处**代码中不存在**的指针（`backend/qed_engine/services/shared_tables.py`
  无 `active_job_id` 列；学习面 `ref_id` 的 `kind` 闭集为 book／af_version／knowledge，指向书目与版本行而非作业行），
  已按实读改写为四类真判据。附带查实的 Tracker 侧事实（作为 R5 与 §7.9 的立论，不进本请求执行面）＝
  `QED-Tracker/src/qed_tracker/db/selection_repository.py:183-190` 的 `downloaded_arxiv_ids()` 以**全表**
  `qt_selections.payload.downloads` 派生论文去重集，且 `list()`（:165-171）无上限全表扫描——该表按时间清理会
  缩小去重集、导致重复下载，属「数据源表」不是「流水表」。
- REQ-128（对 QED-Tracker 的保留期请求）经用户同日裁决**取消**，与本合并无关：见 completed.md 该行。
- 口径随步面（本轮零代码、零 DDL、零 git 操作，对方工作区只读）＝契约 §4 在途请求登记（四枚并为一条 ＋ REQ-128
  取消并记两条需求失效依据，另登 [BUGFIX-037](design-bugfix-log.md)）、总纲 §7.8 T8 与 §7.9、[REQ-134 设计稿](2026-10-21-af-table-architecture-design.md)
  的指针与交叠划清节、REQ-120／REQ-132／REQ-131 三壳的 REQ-133／135 指针、todo 的 REQ-120 行描述列、
  [项目状态快照](../trackers/project-status.md)「当前主线」与 10-18 两行的随步注记。
- 收口门禁（QED_env 解释器、串行跑防并行假红）＝`pytest tests/contract -q` **88 passed／1 failed**、
  `pytest tests -q` **869 passed／1 failed**（150.58s）、`ruff check backend tests scripts` **All checks passed**；
  两枚门禁的唯一红同源＝存量 `test_runtime_artifacts_only_under_logs_and_tmp` 检出
  `scripts/image-model/.keepalive.pid`（并行窗口容器保活产物，[普通任务轮壳](2026-09-29-ordinary-tasks-round.md) W28 行已归因待单独立项），非本批引入。

## 验证与验收

- 根侧交付物＝本壳与台账行，零代码、零 DDL；验收手段＝对方回执（S1／S2）+ 表级变更落地后的总纲随步与契约门禁
  （S3：`pytest tests/contract -q` 全绿，含 `test_architecture_documents` 的 `af_*` 总览行与读写矩阵守护）。
- R1 的读数复核＝`information_schema` 与 `alembic_version` 只读探针（仅 `qed_test`），逐条可同机复算。
- 发函后可跟踪性＝对方台账一枚承接行 + 本壳过程与证据节回执登记（按 `standards/cross-project-collaboration.md`）。

## 回滚

- 本壳与台账行由根仓库 git 提交锚定；四枚原 ID 的行内容与判据原文在 `docs/trackers/completed.md` 与三枚归档件内
  完整留存，撤销合并＝按各行记录把 todo 行还原并把归档件移回 `docs/plans/`（同时把状态改回 `Accepted`）。
- 库内不属本壳回滚面：`af_*` 一切结构与数据变更由 Axiom-Flow 侧按其迁移链与备份红线执行。

## 关闭与归档

- 关闭条件＝台账行 S1~S5 逐条达成（正本在行）；关闭结果取值按 `standards/task-lifecycle.md`「关闭判定」节。
- 归档判定 Retain：R 项的合并裁定与对方回执口径属不可替代证据，收口后按当时里程碑移 `docs/history/plans/`。
- 残余移交（发函窗口内须一并转告，不代改）：
  1. Axiom-Flow 台账入站行 `REQ-123`（其 todo:33）与 `REQ-129`（其 todo:44）现挂在已取消的根侧 ID 上，须改指
     REQ-136 并合并为一枚承接行——该改动属对方文档面，由对方窗口或经用户授权后代登。
  2. 生产 `qed` 库的 `af_*` 现状读数随本请求的发函窗一并复采（本轮只读 `qed_test`）。
