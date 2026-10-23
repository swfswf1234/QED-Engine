# af_ 表族结构梳理与迁移指针对齐跨项目请求稿（Axiom-Flow 承接）（af-family-table-refactor-request）

状态：Superseded
关闭结果：Not Applicable（用户 2026-10-21 裁决合并入单枚综合请求 [REQ-136](../../../plans/2026-10-21-af-family-rebuild-consolidated-request.md)：本壳 R1（迁移指针与库内实存）并入其 R1，R2／R3／R5／R6（逐列形状、双列权威、跨族列宽、命名与键风格）并入其 R3，R4（`af_books` 三列）并入其 R4；归并不删壳（ADR 0021 第 5 条），本件保留作原请求六项判据原文，不再单独追回执）
任务类型：A
最后更新：2026-10-21
关联 ADR：[ADR 0014](../../../adr/0014-parsing-ownership-and-model-boundary.md)（解析能力归属与模型边界：`af_*` 表与解析管线归 Axiom-Flow）、[ADR 0017](../../../adr/0017-design-doc-structure-contract.md)（事实源唯一）、[ADR 0023](../../../adr/0023-todo-row-carries-scope-and-criteria.md)（成功标准正本在台账行）、[ADR 0025](../../../adr/0025-database-design-master-doc-and-ddl-ownership.md)（决定 3：表族顺序与「前缀即所有权」，`af_*` 列级正本在对方仓库文档）
关联设计：[cross-project-contracts.md](../../../design/cross-project-contracts.md) §6（Axiom-Flow 服务接口契约 8902）、[parsing-flow.md](../../../design/parsing-flow.md) §2（根侧解析消费流）、[database-design.md](../../../architecture/database-design.md) §6.2／§7.6／§7.8（根侧 `af_*` 总览行、改名批次口径与待确认事项）、Axiom-Flow [database-design.md](../../../../Axiom-Flow/docs/architecture/database-design.md)（`af_*` 结构与迁移链唯一事实源，**只读**）、Axiom-Flow [ADR 0010](../../../../Axiom-Flow/docs/adr/0010-page-regions-are-parse-inputs.md)（区域行跨版本存活与无 `job_id` 不变式，**只读**）
关联 Tracker：docs/trackers/todo.md（REQ-133 登记，普通任务轮 ARCH-035 节）；2026-10-21 该行已原子移出 todo 并入综合请求 [REQ-136](../../../plans/2026-10-21-af-family-rebuild-consolidated-request.md)
归档判定：Retain（跨项目请求原文、`af_*` 形状实读锚点与移交回执口径属不可替代过程证据）

## 对接信息（跨项目协作规范·计划文档模板）

| 项 | 值 |
| --- | --- |
| 需求方 | QED-Engine 根仓库（8900 只读消费侧 + 8903 解析管理页；根侧总纲登记方） |
| 目标项目 | Axiom-Flow（8902） |
| 接口面 | 其私有 `af_*` 五表（`af_books`／`af_parse_jobs`／`af_pages`／`af_block_edits`／`af_page_regions`）的**形状与迁移链现状**，及其经 `GET /api/v1/books`、`GET /api/v1/parsing/*` 透出到 8900 的字段语义。**无新增端点、无端口／协议／`.env` 变量变化**；表级变更（改名／增删表）按其通知走根侧总纲 §7.1 同批随步 |
| 评审方 | 用户 |
| 执行方 | Axiom-Flow 会话（其 `alembic/` 迁移链、`src/axiom_flow/db/models.py`、其 docs 与门禁 `pytest tests -q` + `ruff check src tests`） |
| 验收标准 | 逐条对照 todo.md `REQ-133` 行「成功标准」列（S1~S5） |

## 目标与成功标准

**目标**：把 `af_*` 表族的**结构层**问题一次性交其所有权方梳理定档——迁移链指针与业务库实存的对齐、
`qt_books` 只读快照列的陈旧处置、「同一事实两处存」的逐对自证或收敛、`legacy` 根视图哨兵的终局口径、
跨族引用列宽、表族内命名与键风格一致性——使其在 1.0 前 schema 重建档位内一次定档，而不是每处遇到
就补一句。目标效果＝8900 只读消费侧对 `af_*` 的读数解释与其自有文档一致，且根侧总纲 §7.8 的 `af_*`
待确认条目（T7／T8）有可关闭的路径。

**本请求不改动根侧任何消费代码**：根侧只做取证、登记、移交与文档随步。

## 范围与非目标

**范围内**（根侧动作）：只读取证（其文档与库内结构读数，不改数据）、请求稿成文、根台账登记、
经用户放行后代登对方文档面（零代码）、回执后的根侧总纲随步。

**非目标（一律不在本请求内）**：
- `af_books` 三列（`pages_done`／`last_parse_result`／`active_job_id`）的**自洽性复位**——已登记于
  [REQ-123](2026-10-17-af-books-parse-status-request.md)，其 R1/R2 判据与验收不在此重复（ADR 0017 事实源唯一）。
- `af_parse_jobs` 的**保留期口径**——已登记于 [REQ-129](../../../trackers/todo.md)（普通任务轮 ARCH-035 节），
  本请求不重开该问，也不代设保留窗数值。
- 根侧代改对方代码、代执行其迁移、代裁剪其库内数据（所有权边界；误产生的改动即登记移交）。
- 在根侧总纲写 `af_*` 的列级小节——由守护 `::test_database_design_does_not_define_other_projects_private_tables` 硬拦。
- 8900 消费面（`api/axiom.py`、`clients/axiom_client.py`）与 8903 前端的适配改造；对方字段语义变更
  如需根侧随步，另在 ARCH-035 登记表开条目。

## 前置条件

1. 本请求为**只读取证 + 文档请求**，默认零代码、零库内写；库内读数一律经本机 MySQL 客户端只读查询
   取得并落 `tmp/` 快照（快照时刻随附，不以单次读数定性）。
2. 对方工作区（`Axiom-Flow/`）按根 AGENTS.md 铁律为**只读 + 写文档**：代码改动与 git 操作归对方会话。
3. 与 [REQ-119](2026-10-16-shared-tables-tracker-request.md) R2（共享 `qed_domain.domain_id` 32→64）**同窗**：
   R5 的列宽判定引用其定档结果，两请求不同窗时以先落地者为准并在回执里记明。
4. 若 R3/R6 的结论触达业务库 `qed`（生产库）的 DDL，该窗口属 D 类操作：备份 → 用户批准 → 对方
   `alembic upgrade`，排期与批准归人工，本壳只出判据。

## 请求项

| ID | 对象 | 请求 | 证据锚点（实读，非推断） | 兼容性 |
| --- | --- | --- | --- | --- |
| R1 | 迁移链指针与业务库实存对齐 | 请核对 `qed`／`qed_test` 两库的 `alembic_version` 指针与 `af_*` 结构实存，把「谁落后」定档并修正其文档的自陈：其文档声明业务库 head 停在 `20260926_0001`、`20260926_0002`（建 `af_page_regions`）与 `20260928_0001`（`parser_signature`）「尚未在业务库执行」，而根侧总纲 §7.8 登记的实读是业务库两样俱在。若属指针未 stamp，给出 `alembic stamp` 的口径与守护；若属手工 DDL，给出补链迁移 | 对方 [database-design.md](../../../../Axiom-Flow/docs/architecture/database-design.md) `:264-279`（迁移序列表 + 「业务库 `qed` 的 head 停在 `20260926_0001`」段）；根侧 [database-design.md](../../../architecture/database-design.md) `:1083`（T8 行：「与生产 `qed` 库实存 `af_page_regions`／`af_parse_jobs.parser_signature` 不符」）；其 `:289-291` 自陈「应用不自动迁移，ORM 新增列与真机迁移必须同窗口发布，否则读该列即失败」 | 纯指针与文档自陈修正；不改列名与端点字段，根侧消费面零改动 |
| R2 | `af_books`  ← `qt_books` 快照列的陈旧处置 | `af_books` 里来自 `qt_books` 的只读快照列（`domain_id`／`course_id`／`course_name`／`knowledge_id`／`title`／`part`／`display_title`／`authors`／`file_path`）其文档明写「qt_books 侧删除或变更不回写已同步行（快照语义）」且同步只 upsert 不删行。请给出陈旧口径：上游改名／换领域／删书后何时刷新、陈旧可容忍到什么时候、`file_path` 陈旧时 `GET /books/{book_id}/file` 的行为（报错还是回落探测）与其对 8900 的可见后果 | 对方 [database-design.md](../../../../Axiom-Flow/docs/architecture/database-design.md) `:119-129`（九列快照清单）、`:143-145`（「重复同步只 upsert 不产生重复行；qt_books 侧删除或变更不回写已同步行」）、`:300`（「`af_books` 行同样可清：书目是同步来的快照，可经同步重建」）；根侧 [database-design.md](../../../architecture/database-design.md) `:57`（R5 只引用不复制：一律存 `ref_id` + `label` 快照） | 口径入文档 + 同步路径的刷新判据；不扩端点字段，8900 侧只读消费不受影响 |
| R3 | 「同一事实两处存」的逐对自证或收敛 | 请对以下三对双列各给「谁是权威 / 谁可派生 / 为何不算漂移」的明文判定，或在 1.0 前重建档位内收敛为单列：① `af_books.page_count` 与 `af_parse_jobs.page_count`；② `af_books.sha256` 与 `af_parse_jobs.source_sha256`；③ `af_parse_jobs.engine` 与 `af_pages.source`。其文档两处已确立该原则（「`af_parse_jobs` 上不设布尔生效列（同一事实两处存必漂移）」、合并成员「快照唯一落在 `members`，不另存并集列」），本请求要求把该原则一致地覆盖到这三对 | 对方 [database-design.md](../../../../Axiom-Flow/docs/architecture/database-design.md) `:129`（`af_books.page_count`＝ingest 写入、页清单枚举域唯一来源）与 `:170`（`af_parse_jobs.page_count`＝建任务时全书页数快照）；`:130`（`sha256`）与 `:168`（`source_sha256`）；`:163`（`engine`）与 `:202`（`source`）；原则出处 `:150`、`:261` | 若判保留双存则纯文档；若收敛列属 DDL，走 7.3 重建档位与其迁移链，须同批声明对 8900 已消费字段的兼容方式 |
| R4 | `legacy` 根视图哨兵的终局口径 | `job_id='legacy'` 同时出现在 `af_pages` 与 `af_block_edits`，并与 `af_books.active_job_id IS NULL` 共同表达「根视图」；其迁移判据把存量按「只有一个 job 则回填该 job，否则回填哨兵 `legacy`」处理，重新 ingest 只清 `job_id='legacy'` 的页行。请给出该哨兵的终局：长期保留并补其读写不变式守护，或给出一次性把存量产物搬入 `versions/<job_id>/` 的批次与判据（含「不把存量产物搬进 `versions/`」这条既有裁决是否作废）；并说明 `?purge=true` 与「历史任务行不清」在哨兵行存在时的行为 | 对方 [database-design.md](../../../../Axiom-Flow/docs/architecture/database-design.md) `:53-57`（「哪一版生效只看 `active_job_id`，`NULL` = 根视图 `legacy`」）、`:199` 与 `:218-220`（两表 `job_id` 的 `legacy` 语义）、`:269`（`20260920_0002` 存量判据：「不把存量产物搬进 `versions/`」）、`:148`（重新 ingest 清空 `legacy` 页行）、`:191-192`（`DELETE /books/{id}` 含 `?purge=true` 不清历史任务行） | 哨兵取值已在响应与页行主键中，改判属语义变更：需在其文档先行并给出 8900／8903 只读侧的兼容窗口 |
| R5 | 跨族引用列宽一致性 | 请判定 `af_books.domain_id`（VARCHAR(32)）与 `course_id`（VARCHAR(64)）是否随共享表定档同步加宽：REQ-119 R2 已请求共享 `qed_domain.domain_id` 32→64，`qed_course` 同批定档。跨族引用同一条 id 而列宽不同代，存在截断与不可比风险。给出加宽或「显式声明不受影响」的明文并写入其列清单 | 对方 [database-design.md](../../../../Axiom-Flow/docs/architecture/database-design.md) `:120-121`（`domain_id` VARCHAR(32)、`course_id` VARCHAR(64)）；根侧 [REQ-119 壳](2026-10-16-shared-tables-tracker-request.md)（R2 列宽定档）与 [database-design.md](../../../architecture/database-design.md) `:976`（`af_*` 同步矩阵行：列级正本在对方） | 加宽为原地 ALTER，不改语义；若判不加宽则纯文档，根侧总纲随步记明判定 |
| R6 | 表族内命名与键风格一致性梳理 | 请在 1.0 前 schema 重建档位内给出一次性的风格判定（每项落「统一」或「明文保留差异 + 理由」）：① 备注列单复数 `af_books.notes`(TEXT) 与 `af_block_edits.note`／`af_page_regions.note`(VARCHAR(1000))；② 主键风格 `af_block_edits.edit_id`（摘要 PK + 复合唯一键）与 `af_page_regions`（复合 PK + 派生 `region_id`）与 `af_pages`（纯复合 PK）；③ 审计列分布（`created_at`/`updated_at`/`edited_at`/`parsed_at`/`synced_at`/`ingested_at` 各族不一）；④ 索引登记完整度（`ix_af_parse_jobs_book`、`ix_af_page_regions_page` 有列，`af_pages`／`af_block_edits` 未列二级索引）。判定表输出，执行批次与取舍归对方 | 对方 [database-design.md](../../../../Axiom-Flow/docs/architecture/database-design.md) `:137`（`notes`）与 `:224`、`:249`（`note`）；`:217`（`edit_id`＝`ed_<md5(...)>`）与 `:243`（`region_id`＝`rgn_<md5(...)[:12]>`）与 `:198-200`（`af_pages` 三列复合 PK）；`:141`（`af_books` 两索引）与 `:175`、`:253`（另两表索引）；根侧 [database-design.md](../../../architecture/database-design.md) `:1009-1024`（§7.3 1.0 前 schema 重建档位三档） | 若触达列名或键形状属表级变更：走其迁移链 + 根侧总纲 §7.1「`af_*`／`qt_*` 表级：对方通知根，本文总览行与读写矩阵行同批随步」；不改 8900 已依赖的端点字段名 |

## 工作项

| 条目 | 内容 | 状态 |
| --- | --- | --- |
| W1 | 取证与请求稿成文（本壳）：`af_*` 五表形状实读、六项请求逐条锚到对方文档行号、与 REQ-123／REQ-129 的交叠划清 | 已落地（2026-10-21） |
| W2 | 根台账登记：todo `REQ-133` 行（成功标准 S1~S5 条目化）+ `cross-project-contracts.md` §4 在途请求登记追加本请求去处 | 已落地（2026-10-21） |
| W3 | 用户评审本稿并放行移交 | 待放行 |
| W4 | 移交执行：经用户放行后，根侧在对方工作区**只写文档**代登承接（其 todo 承接行 + 其承载壳「承载 REQ-133」节与工作项），零代码改动 | 待 W3 |
| W5 | 回执随步：对方逐条回执后，根侧总纲 §7.8 T7／T8 行按其结论收口、§6.2 同步矩阵与读写矩阵按表级变更同批随步 | 待回执 |

## 过程与证据

| 日期 | 条目 | 过程与证据 |
| --- | --- | --- |
| 2026-10-21 | W1 取证（REQ-120 改判探索的顺带产物，只读） | 起因＝用户裁决把 REQ-120 的前缀改判收窄为「只改根私有七表」，并新增「`af_*` 系列表重构」一行（本行）。本轮探索实读对方 [database-design.md](../../../../Axiom-Flow/docs/architecture/database-design.md)（全文 330 行）取得五表列清单、迁移序列（六条：`20260917_0001`→`20260928_0001`）与失败兼容语义；形状快照落 `tmp/req133_af_cols.txt`、`tmp/req133_afbooks.txt`、`tmp/req133_af_facts.txt`（根侧总纲节标题 + `af_` 提及全行），引用格式为「文件 `:行号`」。**未做库内只读探针**：R1 的「实存 vs 指针」以根侧总纲 §7.8 T8 行的既有实读登记为据（该读数由 REQ-118 轮取得），本壳不重复取数；R1 要求对方复核而非根侧再证。**本轮零代码改动、零 git 操作**（对方工作区全程只读）。 |
| 2026-10-21 | W1 交叠划清（避免重复发明判据） | 逐条自查与既有在册行的关系：`af_books` 三列复位与跨库分叉归一＝REQ-123 R1/R2（本壳 R 项不触该三列的取值自洽）；`af_parse_jobs` 保留期＝REQ-129（本壳 R3 只问 `page_count`/`sha256`/`engine` 三对双列的权威归属，不问何时裁剪）；`af_*` 列级晋升为根侧正本＝根侧 T7 的后续批次，属根侧文档动作，不写成对对方的请求。R4 与 R6 ②有接触点（键风格 vs 哨兵取值）：R4 定语义、R6 定形状，回执时若对方合并处理，根侧按合并结果同批收口两条，不判其偏离。 |
| 2026-10-21 | W2 立项与登记 | 用户裁决（AskUserQuestion 多选原文）＝「只改根私有七表」＋「学习侧改名 `qe_course_state`」＋「按推荐登记 REQ-132/133」；据此本行按 A 类跨项目请求稿立项，落普通任务轮（ARCH-035）支线，不另开轮次（ADR 0021 第 1 条）；根侧执行面＝取证 + 代登文档 + 随步，无代码交付物，故不建 demo 门（判据见 task-lifecycle「计划准入与分拆」节，A 类请求稿无端到端可跑场景）。REQ-132（B 类，含改名执行与 demo 门）见 [2026-10-21-qe-family-rename-and-refactor.md](2026-10-21-qe-family-rename-and-refactor.md)。 |

## 验证与验收

- 逐条对照 todo.md `REQ-133` 行「成功标准」列（S1~S5），本壳不复制判据（ADR 0023）。
- 根侧本轮验收面＝文档与台账登记本身：`pytest tests/contract -q`（G1/G2/G4/G5/G6/G7 与链接守护）
  与 `pytest tests -q`、`ruff check backend tests scripts` 全绿；对方代码与迁移面验收以其门禁输出为证据。
- 移交是否成立以**对方台账有承接行**为准（其自有治理守护 `test_main_aggregate_rows_list_branch_children`
  一族的口径由对方会话负责），根侧不以本壳声明替代对方在册事实。

## 回滚

- 本壳与 todo 行为纯文档新增：回滚＝删除该两文件与本行、`cross-project-contracts.md` §4 撤去追加行、
  `plans/index.md` 撤去登记；根侧与对方库内零写入，无需数据回滚。
- 代登对方文档面（W4）若需回滚，只撤对方 `docs/` 内的承接行与壳节，不触其 `src/`；其 git 操作归对方会话。

## 关闭与归档

- S1~S5 全达成 → `Achieved`；核心项未做（如对方只回执部分 R 项）→ `Partial` 并把未做项按其原文降级
  稳态登记（G3），残余工作在状态列显式写「移交」。
- 关闭时从 todo 原子移除并写入 `completed.md`，本壳按归档判定 Retain 移入 `docs/plans/history/2026-10/`，
  `plans/index.md` 登记去处；门禁证据与关闭行随 `qed-closeout` 执行。
