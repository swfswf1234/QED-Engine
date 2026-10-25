# af_ 表族重构综合请求（整合 REQ-123／129／133／135 四枚在册请求，挂 ARCH-025 轮线 2）（af-family-rebuild-consolidated-request）

状态：Closed（**Achieved**，2026-10-24 收口：S1~S5 全达成；S1 的「六项对接信息」按**等价达成**取值（用户 2026-10-24 裁决），R3 的净新增形状与 R4 的复位归零两处**经对方改判**成立，详见「关闭与归档」节；判 Retain 归档）
任务类型：A
最后更新：2026-10-24
关联 ADR：[ADR 0014](../../../adr/0014-parsing-ownership-and-model-boundary.md)（解析能力与 `af_*` 表族归 Axiom-Flow）、
[ADR 0017](../../../adr/0017-design-doc-structure-contract.md)（事实源唯一）、
[ADR 0023](../../../adr/0023-todo-row-carries-scope-and-criteria.md)（成功标准正本在台账行）、
[ADR 0024](../../../adr/0024-preschema-rebuild-tiers-and-demo-gate.md)（1.0 前 schema 重建档位与 demo 门）、
[ADR 0025](../../../adr/0025-database-design-master-doc-and-ddl-ownership.md)（决定 3：前缀即所有权，`af_*` 列级正本在对方仓库文档）
关联设计：逐列形状正本＝Axiom-Flow PLAN-024（`Axiom-Flow/docs/history/plans/2026-10/2026-10-21-af-table-family-rebuild.md`，
2026-10-21 同日定档、2026-10-23 该轮 Achieved 自关后归档；根侧 [REQ-134 壳](2026-10-21-af-table-architecture-design.md) 已退为指针，只作被否选项的证据与根侧取证锚）；
本壳只发请求、不重述设计；
被整合四枚请求原文（已归档，逐条 R 项可查）＝
[REQ-123 书级三列回写与跨库分叉归一](2026-10-17-af-books-parse-status-request.md)、
[REQ-133 结构梳理与迁移指针对齐](2026-10-21-af-family-table-refactor-request.md)、
[REQ-135 档 B 整族重建与知识点两表](2026-10-21-af-family-rebuild-kp-tables-request.md)、
REQ-129 保留期（其承载为[普通任务轮壳 W5](../../../plans/2026-09-29-ordinary-tasks-round.md) 与总纲 §7.9）；
根侧 [database-design.md](../../../architecture/database-design.md) §6.2／§7.3／§7.8／§7.9、
[cross-project-contracts.md](../../../design/cross-project-contracts.md) §4／§6；
Axiom-Flow [database-design.md](../../../../Axiom-Flow/docs/architecture/database-design.md)（`af_*` 结构与迁移链唯一事实源，**只读**）、
Axiom-Flow [parsing-management.md](../../../../Axiom-Flow/docs/design/parsing-management.md)（PM-16／PM-17／PM-18）
关联 Tracker：docs/trackers/todo.md（REQ-136 登记，Axiom-Flow（V1.0）优化轮 ARCH-025 节；本行取代 REQ-123／REQ-129／REQ-133／REQ-135 四行，其逐条 R 项并入本壳工作项）；**2026-10-24 该 REQ-136 行已原子移出 todo、关闭结果 `Achieved` 写入 [completed.md](../../../trackers/completed.md)**
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
| R1 | 两库现状读数与文档自陈更正（原 REQ-133 R1、REQ-135 R1） | 对方 `alembic_version` 指针与 `af_page_regions`／`parser_signature` 实存的自陈 head 对齐；根侧总纲 §7.8 T7／T8 两行据其结论收口 | AF（根侧只读取证） | **已回执·已了结**（对方 PLAN-024 W9 回执 R1；根侧 2026-10-24 探针复算并随步总纲） |
| R2 | 档 B 整族重建采否四件必答（原 REQ-135 R2） | 采／不采／改造三择一，且作业行处置、`af_pages` 回归路径、空窗对 8900 与 8903 的可见后果、legacy 哨兵收法各给一条答案 | AF | **已回执·采档 B 并已执行**（其裁决⑨ 采档 B；四件必答逐条给答，③空窗按 11 条 GET 实测、④`legacy` 只作 `af_pages.job_id` 作用域哨兵） |
| R3 | 逐列形状、双列权威收敛与净新增两表准入（原 REQ-133 R2／R3／R5／R6、REQ-135 R3／R4、REQ-129 的 `af_books` 快照列侧） | **正本已移交对方 PLAN-024**（2026-10-21，根侧 [REQ-134 壳](2026-10-21-af-table-architecture-design.md) 同日退为指针）；本项只要求对方就净新增知识点表走其准入守则、三对同事实双列给权威归属、跨族引用列宽随共享表定档 | AF | **已回执·经改判达成**（净新增改为 `af_operations`＋`af_kp` 两张，非本案原提的 `af_kp_nodes`／`af_kp_edges` 两枚窄表＋保留旧表；两表各走其准入三判据自查，三对同事实双列已各给唯一权威） |
| R4 | 书级三列自洽与两库分叉归一（原 REQ-123 R1／R2、REQ-133 R4） | 复位语义写成三列不再互相打脸的取值口径；不重跑解析的分叉归一口径入 `af_*` 事实源；与 R2 同窗裁定（重建即重定，不出两次口径） | AF | **已回执·形状面了结、数据面不适用**（两库 `af_*` 由重建归一，结构上不存在分叉行；`op_kind='ingest'` 建值不建写者，原 REQ-123 的「复位归零」经其裁决⑳ **裁撤不跟踪**） |
| R5 | `af_parse_jobs` 保留期与不可裁剪不变量（原 REQ-129） | 自定保留窗或明文「不清理」，并声明被 `af_books.active_job_id` 引用之行永不裁剪；触发阈值判据见总纲 §7.9，根侧不代设数值、不代执行 | AF | **已回执·已了结**（`af_parse_jobs` 表已不存在，口径改写为「事件表一律不清理」＋四类不可裁剪行 RP-1／RP-3，含被 `af_books.active_job_id` 引用的 parse 行；触发阈值仍按根侧总纲 §7.9，对方未设天数窗口） |

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
  取消并记两条需求失效依据，另登 [BUGFIX-037](../../../plans/design-bugfix-log.md)）、总纲 §7.8 T8 与 §7.9、[REQ-134 设计稿](2026-10-21-af-table-architecture-design.md)
  的指针与交叠划清节、REQ-120／REQ-132／REQ-131 三壳的 REQ-133／135 指针、todo 的 REQ-120 行描述列、
  [项目状态快照](../../../trackers/project-status.md)「当前主线」与 10-18 两行的随步注记。
- 收口门禁（QED_env 解释器、串行跑防并行假红）＝`pytest tests/contract -q` **88 passed／1 failed**、
  `pytest tests -q` **869 passed／1 failed**（150.58s）、`ruff check backend tests scripts` **All checks passed**；
  两枚门禁的唯一红同源＝存量 `test_runtime_artifacts_only_under_logs_and_tmp` 检出
  `scripts/image-model/.keepalive.pid`（并行窗口容器保活产物，[普通任务轮壳](../../../plans/2026-09-29-ordinary-tasks-round.md) W28 行已归因待单独立项），非本批引入。

### 2026-10-24 收口批：对方自关事实、根侧探针复算与六处总纲随步

- **对方自关事实**＝其 PLAN-024（`Axiom-Flow/docs/history/plans/2026-10/2026-10-21-af-table-family-rebuild.md`）
  `状态：Completed`、最后更新 2026-10-23，W1~W14 逐条「已执行」，其 `docs/trackers/completed.md` 记该轮 `Achieved`；
  门禁数字随批次递增至收尾 **707 passed／14 skipped ＋ ruff 净**（同仓自报）。R1~R5 的逐条回执在其壳两处＝
  「承载 REQ-136」判据表（`:749-755`）与「W9 回执」终态表（`:776-787`），故 S2 不依赖本侧推断。
- **根侧只读探针复算**（脚本与输出＝`tmp/req136_probe.py`／`tmp/req136_probe.json`，零库内写、零 DDL、生产库只 SELECT 与
  `information_schema`）＝两库 `alembic_version` 均 **`20261022_0001`**；`af_*` 恰四张，列数
  `af_books` 22／`af_operations` 27／`af_pages` **12**／`af_kp` 23；旧三表 `af_parse_jobs`／`af_block_edits`／
  `af_page_regions` 在两库**零存活**；行数＝`qed` 四表**全 0**，`qed_test` 为 `af_books` 17／`af_pages` 2614／
  `af_operations` 8／`af_kp` 0。
- **复算查出一处已被更新的回执读数**（不改写对方原文，只登记）＝对方 W9 与其「需根仓库随步的六处」第 5 条记
  重建后 `af_operations` **两库各 0 行**，本批实测 `qed_test` 已 **8 行**＝其自关之后 PLAN-025 知识点线继续推进所致
  ⇒ 总纲 §7.9 按现值登记、当时读数保留。
- **六处总纲随步**（逐处落到 [database-design.md](../../../architecture/database-design.md)）＝① §三 `af_books` 行
  「库内重建窗口未执行」→ **已执行**；② §7.8 T11 末段「业务库仍在旧五表、旧表消失前不直连消费新表」→
  窗口已执行、旧三表两库零存活，R2「经 8902 透传、不直连」恒定不变；③ T11 的 `af_pages` **11 列 → 12 列＝本侧事实错**
  （真库 `SHOW COLUMNS` 复算，表级登记不写逐列形状，只更正计数）；④ §7.8 T8 的 2026-10-21 读数加**已被 T11 新读数取代**标注、
  原文不回改；⑤ §7.9 触发阈值取证行「`af_operations`（现名 `af_parse_jobs`）7 行」补现值；⑥ 新增**消费可见后果**＝
  业务库 `qed` 新形状四表全空 ⇒ 8900／8903 走业务库透传看到**空态「暂无书目」而非故障**，在用演示数据只在 `qed_test`，
  业务面恢复归对方按其 runbook 回灌＋逐本重新 ingest（页行与版本不回填）。
- **三条知会不会入总纲**（对方自陈「根侧无需改码」，改动全在列级闭集与设计链路）＝`gen_status` 收窄为三值
  （`draft`／`candidate`／`rejected`，`adopted` 删）、`op_kind` 扩为九值（新增 `kp`，与 `index` 同属「本轮建值不建写者」）、
  对方 `docs/design/` 由三篇增至四篇并新增 `knowledge-analysis.md`（`KA-1~KA-28`）⇒ 8903 确认面与 8900 拉取式提升作业的
  通路判据**从此有篇可引**。本壳只登记指针、不重述其闭集（列级正本在对方仓库文档＝总纲 §6.1 与 ADR 0025），
  其**消费批归 REQ-139**（该行 A1~A6 判据正覆盖这三条），不在本行设判据、不另立轮次（ADR 0021 第 1 条）。
- **发函时刻口径的读法更正（原文不改）**＝「对接信息」表与「范围」节所列 `af_page_regions`／`af_parse_jobs` 两枚对象
  已随档 B 退役，本壳 接口面 现读作 `af_books`／`af_pages`／`af_operations`／`af_kp` 四张 ＋ 共享 `qed_llm_calls`。
- **S1 的「六项对接信息」按等价达成取值**（用户 2026-10-24 裁决原文＝「等价达成（推荐）」）＝对方承接节明写需求方＝
  根仓库 REQ-136、声明「本壳是它的唯一承接行」、逐条 R 项给答卷与落点、执行与评审在本仓、验收标准指回判据表——
  四要素均可指认，但**该仓没有六字段模板表**（在归档壳内逐词检索 `需求方`／`目标项目`／`接口面`／`评审方`／`执行方`／
  `验收标准` 零命中），故记**形态等价**、不记字面缺口；读法与 [REQ-121 归档壳](2026-10-16-book-intro-audience-tracker-request.md)
  收口时「取 meta 键位替代＝形态等价」同判，对方可复核改判。
- **本壳原记两枚残余就此了结**＝残余 1（对方台账 `REQ-123`／`REQ-129` 两枚旧行改指 REQ-136 并合并为一枚承接行）
  对方已按其裁决⑳ 执行并移入其 `completed.md`（该两行置 Superseded／Not Applicable，答卷各自安家）；
  残余 2（生产 `qed` 库读数随发函窗复采）本批探针已覆盖两库。
- **入站指针与他册随步（本批八处，均为文档面）**＝① [cross-project-contracts.md](../../../design/cross-project-contracts.md) §4
  该枚追加「2026-10-24 以 `Achieved` 收口」全句，并更正同段的 `af_kp` **21 列 → 23 列**（＝REQ-138 壳第 7 条在案观察的根侧对象）；
  ② [ARCH-025 滚动壳](../../../plans/2026-09-22-axiom-flow-v1-parsing-knowledge-optimization.md) 线 2 登记表状态由「待发函」→
  「已回执并收口」＋过程节新增一条 2026-10-24 收口行；③ [普通任务轮壳](../../../plans/2026-09-29-ordinary-tasks-round.md) W5 的
  `REQ-129`／`REQ-128` 注记加「残余了结」随步句并更正其 `af_parse_jobs` 7 行旧读数；④ [REQ-134 壳](2026-10-21-af-table-architecture-design.md)
  加 2026-10-24 随步句（其 R1 迁移指针前置条件已成立、形状经对方改判为 `af_operations`＋`af_kp`）并声明该壳内其余 `af_kp` 21 列字样按新读数读；
  ⑤ [集群总纲壳](../../../plans/2026-10-20-doc-knowledge-cluster-master-outline.md) 的「对方承接线」行标注 REQ-136 已收口、在途面转 REQ-139；
  ⑥ [REQ-138 壳](../../../plans/2026-10-23-admin-render-and-kp-review-workspace.md) 的 关联设计行与第 7 条在案观察标注「已由本批更正、可结」；
  ⑦ 总纲 §7.9 补登对方的 **RP-1／RP-3** 口径＝明文「一律不清理、不设保留窗数值」＋四类不可裁剪行，本节「须声明」要求自此兑现；
  ⑧ [项目状态快照](../../../trackers/project-status.md) 当前主线新增本批一条、并把 2026-10-21 立项那条由「进行中」改「已完成」。
  其中 ④⑤⑥ 属他线在册壳的**事实随步**（不改其判据、不动其裁决），按惯例在此披露。
- **收口门禁**（本批文档写定后串行跑，2026-10-24）＝`pytest tests/contract -q` **88 passed／1 failed** ＋ 全量 `pytest tests -q` **877 passed／1 failed** ＋ `ruff check backend tests scripts` **净**。唯一红＝既有已知项
  `tests/contract/test_storage_conventions_governance.py:164`（散落的 `scripts/image-model/.keepalive.pid` 系并行模型轮遗留、`.gitignore` 已含、非本批引入），
  与 REQ-119／121／132／137 收口时同一枚；数值同记于台账 [completed.md](../../../trackers/completed.md) 的 REQ-136 与 REQ-047 两行。

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

**逐 S 对照（判据正文在台账行、写定不改；ADR 0023）＝S1~S5 全达成，取值 `Achieved`（2026-10-24）**：

- **S1 达成**＝对方台账有**一枚**覆盖 R1~R5 的承接行（其 PLAN-024 镜像行，壳内明写「本壳是它的唯一承接行」并逐条给出
  R1~R5 答卷）；「六项对接信息」按**等价达成**取值（用户 2026-10-24 裁决），四要素可指认、无六字段模板表一事
  只登记不记缺口。
- **S2 达成**＝R1／R2／R3／R5 逐条「已了结」、R4「形状面已了结、数据面不适用」，并附其门禁输出（同仓自报
  704 → **707 passed／14 skipped** 递增、ruff 净、守护 `tests/unit/test_db_table_family_governance.py` 可指认）；
  四枚原 ID 不再单独追回执。
- **S3 达成**＝采否判定（采档 B 并已执行）给出后，根侧总纲 §三 与 §6.2 总览、§7.8 T8／T11、§7.9 共**六处随步**，
  其中一处是**本侧事实错**（`af_pages` 11 → 12 列）；契约门禁数值见本节末。
- **S4 达成**＝提升契约仍为单向：确认位在 `af_kp.confirmed`，8900 拉取式写共享主表（`qed_knowledge_point.from_detail_id`
  锚 `af_kp.node_id`），对方四张表内**无私有 LLM 日志表、无回写列**，8902 不直写共享表；根侧读写矩阵 `af_*` 行仍为
  「8900 –（经 8900）／8903 –（经 8902 透传）」。
- **S5 达成**＝根侧全链零代码零 DDL，本批改动全在 `docs/`；R1 读数由本批**两库**只读探针复算（`tmp/req136_probe.py`
  ＋ `tmp/req136_probe.json`），可同机复算。
- **两处经上游改判成立、不读作原样兑现**＝① R3 的净新增形状被对方改判为 `af_operations`＋`af_kp` 两张，**不是**本案
  原提的 `af_kp_nodes`／`af_kp_edges` 两枚窄表＋保留旧表（逐列正本移交对方，根侧 REQ-134 壳同日退为指针）；
  ② R4 的「ingest 复位归零」欠账经其裁决⑳ **裁撤不跟踪**，`op_kind='ingest'` 建值不建写者。
- **关闭时残余＝零**（S 判据层面）。两笔**移交观察**不占本行判据：① 业务库 `qed` 的新形状四表全空，业务面数据恢复
  归对方人工窗口按其 runbook 回灌＋逐本重新 ingest（页行与版本不回填）；本机 `.env` 的 `QED_DB_NAME` 指 `qed_test`，
  三服务仍钉测试库，故本轮空态不影响 8900／8903 演示与 demo 门。② 三条列级知会（`gen_status` 三值、`op_kind` 九值、
  对方新增 `knowledge-analysis.md`／`KA-1~KA-28`）的消费批归 **REQ-139**。
- **收口门禁**（2026-10-24 串行跑，本批零代码改动）＝contract 子集 **88 passed／1 failed**、全量 **877 passed／1 failed**、`ruff check backend tests scripts` **净**；
  唯一红＝既有已知项 `tests/contract/test_storage_conventions_governance.py:164`，随步记于台账 completed.md 的 REQ-136 与 REQ-047 两行。
- 归档判定 Retain：R 项的合并裁定、对方回执口径与「一次重构只开一个回执窗口」的判据属不可替代证据，
  按当时里程碑移 `docs/history/plans/2026-10/`，出链深度随步重算。
