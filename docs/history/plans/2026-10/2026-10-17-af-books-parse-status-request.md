# af_books 书级三列回写与跨库分叉归一跨项目请求稿（Axiom-Flow 承接）（af-books-parse-status-request）

状态：Superseded
关闭结果：Not Applicable（用户 2026-10-21 裁决把对 Axiom-Flow 的四枚在册数据库修改请求合并为单枚综合请求 [REQ-136](../../../plans/2026-10-21-af-family-rebuild-consolidated-request.md)，本壳 R1／R2（书级三列复位与两库分叉归一）整体并入其 R4 随档 B 重建同窗裁定；归并不删壳（ADR 0021 第 5 条），本件正文保留作原请求口径与实读证据锚点，不再单独追回执）
任务类型：A
最后更新：2026-10-21
关联 ADR：[ADR 0014](../../../adr/0014-parsing-ownership-and-model-boundary.md)（解析能力归属与模型边界：`af_*` 表与解析管线归 Axiom-Flow）、[ADR 0017](../../../adr/0017-design-doc-structure-contract.md)（事实源唯一）、[ADR 0023](../../../adr/0023-todo-row-carries-scope-and-criteria.md)（成功标准正本在台账行）
关联设计：[cross-project-contracts.md](../../../design/cross-project-contracts.md) §6（Axiom-Flow 服务接口契约 8902）、[parsing-flow.md](../../../design/parsing-flow.md)（根侧解析消费流）、Axiom-Flow [ADR 0007](../../../../Axiom-Flow/docs/adr/0007-parse-status-semantics.md)（书级进度／结局／生效版本三分语义正本，**只读**）、Axiom-Flow [ADR 0015](../../../../Axiom-Flow/docs/adr/0015-db-single-source-for-readiness.md)（就绪判据只取 DB 页行，**只读**）、Axiom-Flow [database-design.md](../../../../Axiom-Flow/docs/architecture/database-design.md)（`af_*` 结构唯一事实源，**只读**）
关联 Tracker：docs/trackers/todo.md（REQ-123 登记，普通任务轮 ARCH-035 节）；2026-10-21 该行已原子移出 todo 并入综合请求 [REQ-136](../../../plans/2026-10-21-af-family-rebuild-consolidated-request.md)
归档判定：Retain（跨项目请求原文、实读证据锚点与回执口径属不可替代过程证据）

## 对接信息（跨项目协作规范·计划文档模板）

| 项 | 值 |
| --- | --- |
| 需求方 | QED-Engine 根仓库（8900 只读消费侧 + 8903 解析管理页） |
| 目标项目 | Axiom-Flow（8902） |
| 接口面 | `af_books` 三列（`pages_done`／`last_parse_result`／`active_job_id`）与 `af_pages`／`af_parse_jobs` 页行事实的自洽性；经 `GET /api/v1/books` 原样透出到 8900。**无新增端点、无端口／协议／`.env` 变量变化** |
| 评审方 | 用户 |
| 执行方 | Axiom-Flow 会话（其 `src/axiom_flow/api/main.py` 摄取路径、`db/repositories.py` 回写、其 docs 与门禁 `pytest tests -q` + `ruff check src tests`） |
| 验收标准 | 逐条对照 todo.md `REQ-123` 行「成功标准」列（S1~S4） |

## 目标与成功标准

**目标**：把 8902 书级三列在其自有语义契约（其 ADR 0007 决定 1/3/4）下写成自洽的——「结局」不得指向
一个已被复位掉的生效版本，「进度」不得与页行事实长期背离；并对本窗口实测到的 `qed`／`qed_test` 两库
`af_books` 分叉行给出只读清点与归一口径。目标效果＝8900 与 8903 按三分语义只读消费时不再拿到互相打脸
的三列。

**成功标准正本在台账行**（ADR 0023）：逐条对照 todo.md `REQ-123` 行「成功标准」列，本壳不复制判据。

## 范围与非目标

**范围**：R1~R2 两项请求成文、逐条带实读证据锚点与兼容性判定，并按[跨项目协作规范](../../../standards/cross-project-collaboration.md)
登记到根台账请求行；回执跟踪口径写本壳。

**非目标**：
- **不改对方代码**；对方文档面按[跨项目协作规范](../../../standards/cross-project-collaboration.md)只登记承接
  （2026-10-17 用户放行由根侧代登，见「过程与证据」节 W4 行）：其 `api/main.py`、`db/repositories.py` 等
  代码改动一律由对方会话执行。按其 ADR 0011 决定 2「共享既有计划 ⇒ 登记 `REQ-*` 支线行引用同一承载」，
  承接已落其既有壳（ARCH-022／PLAN-019）＋其 todo `REQ-123` 行，不新立专属计划。
  根侧未新增其 `docs/trackers/` 文件，故其「目录文件等值白名单」守护无需同步（实测其契约 207 passed）。
- **不请求改 `parse_status` 的取值口径**：`pending`／`parsing` 只表达进度、不表达结局是对方的设计决定
  （其 ADR 0007 决定 3），根侧 8903 已按该三分语义实现（`web-ui/src/stores/dashboard.ts` 的
  `parse_status === 'parsing'` 判在飞、结局取 `last_parse_result`、可读版本取 `active_job_id`），
  本次排查最初「页面显示不出进度＝对方漏写回」的假设经复验**不成立**，已撤回。
- **不新增端点、不扩 8902 契约面**；不涉 `qed_*` 共享表与 `qt_*` 私有表。
- **不动库**：本壳不提供 DDL 与数据改写脚本，归一动作属所有权方执行面。

## 前置条件

1. 用户评审本稿并放行移交。
2. 8902 单实例部署前提成立（对方 ADR 0007 决定 4 的正当性前提）；若多实例并存，R2 的归一口径须先改为
   心跳＋后台回收，否则启动期归一会误杀他实例的活任务。
3. 只读取证脚本与快照留在 `tmp/req123_probe.py`／`tmp/req123_probe2.py`／`tmp/req123_probe3.py`
   与同名 `.txt`（对方复验可直接引用，不必重写探针）。

## 请求项

| ID | 对象 | 请求 | 证据锚点（实读，非推断） | 兼容性 |
| --- | --- | --- | --- | --- |
| R1 | 重新摄取路径的书级结局复位 | 请核明并修正：重新摄取（ingest 再入口）在复位生效指针与进度时，`last_parse_result` 保留上一版本的旧结局，导致库里出现「结局 `completed`、`active_job_id` 为空、该书页行成百上千」的自相矛盾行。请给出该列在此路径的复位口径（随指针一并归零、或引入表达「版本已复位」的取值）并补其回归用例 | 对方代码：`api/main.py:372-374`（`set_active_job(book_id, None)` + `update_parse(parse_status=PENDING, pages_done=0)`，该调用**不传** `last_parse_result`）与 `db/repositories.py:232-244`（`last_parse_result is None` 即保留原值）；库内实读：`qed` 与 `qed_test` 的 `mathanalysis-b12` 两行均为 `parse_status=pending`／`pages_done=3`／`last_parse_result=completed`／`active_job_id=NULL`，而 `af_pages` 中该书各有 486／540 页行（快照 `tmp/req123_probe3.txt` 第 6、27 行）；对方 ADR 0007 决定 3 自述「`active_job_id` 仍是『哪一版可读』唯一事实源」 | 纯语义修正，取值枚举可不扩；8900 只读侧遇未知取值按保守处理（对方 ADR 0007 决定 7 已约定），不破坏既有契约 |
| R2 | `af_books` 跨库分叉行的只读清点与归一 | 请对 `af_books` 三列与 `af_pages`／`af_parse_jobs` 页行事实做一次**只读**对账并给归一口径：同一书目行在业务库 `qed` 与测试库 `qed_test` 给出不同的生效指针／进度／结局时，以何库为准、如何在不重跑解析的前提下收敛；并把该口径写入其 `af_*` 事实源文档 | 库内实读（同快照）：`mathanalysis-b05` 在 `qed` 为 `active_job_id=012d637df1eb`／`pages_done=317`，在 `qed_test` 为 `active_job_id=NULL`／`pages_done=317`，而该 job 在两库 `af_parse_jobs` 都是 `completed`／317；成因＝8902 实例先后按各自 `.env` 连过两个库（库名一致性缺失另见根侧 `DEFECT-015`），旧写入留在另一库；另：`parse_status` 曾存在的越枚举存量值（`qed_test.b05`＝`completed`）在本窗口内已由对方启动期归一（其 ADR 0007 决定 4）自动收敛为 `pending`，故**不列请求项**，仅作 R2 归一机制有效的实证 | 只读清点为主，改写仅及 `af_books` 三列（所有权在对方）；不涉及 DDL、不改列名与端点字段 |

## 工作项

| 条目 | 内容 | 状态 |
| --- | --- | --- |
| W1 | 取证与请求稿成文（本壳）：三轮只读探针定锚、撤回「页面显示漏写回」误假设、确认根侧消费面已按三分语义实现 | 已落地（2026-10-17） |
| W2 | 根台账登记：todo `REQ-123` 行（成功标准条目化）+ `cross-project-contracts.md` §4 在途请求追加 | 已落地（2026-10-17） |
| W3 | 用户评审本稿并放行移交 | 已放行（2026-10-17） |
| W4 | 移交执行：对方按其 ADR 0011 在既有支线壳（ARCH-022／PLAN-019 一族）内加承接条目并回执 R1/R2 | 已移交（2026-10-17，根侧经用户放行代登对方文档面；其承接行 `REQ-123` 与其壳 W10/W11 已入册，待其执行与回执） |
| W5 | 回执随步：根侧只读消费复核（`GET /books` 三列自洽）与设计文档随步（`parsing-flow.md` 消费口径） | 待回执 |

## 过程与证据

| 日期 | 条目 | 过程与证据 |
| --- | --- | --- |
| 2026-10-17 | W1 取证（三轮只读探针，快照落 `tmp/req123_probe*.txt`） | 起因＝上一窗口排查 8903 解析管理页无数据时记下「`af_books.parse_status` 恒 `pending`」待登记。本轮核实：① 该形态是对方设计口径（其 ADR 0007 决定 3 把该列收窄为纯进度，取值 `pending`／`parsing`，结局移入 `last_parse_result`，可读版本唯一事实源是 `active_job_id`），② 根侧 8903 已按三分语义实现（`web-ui/src/stores/dashboard.ts` 及其 `dashboard.aggregate.test.ts` 的 `parseBookLabel` 用例矩阵），**故不构成根侧缺陷、也不构成对方漏写回**——原假设撤回；③ 真正的自洽性缺口在 R1（重新摄取复位指针却保留旧结局，实读 `mathanalysis-b12` 两库均为「completed + 空指针」）；④ 跨库分叉在 R2（`mathanalysis-b05` 两库生效指针不一致），其上游成因是库名一致性缺失，已另立根侧 `DEFECT-015` 承载；⑤ 探针期间观测到库面**正在被写**（12:2x 与 12:3x 两次快照间 `qed.b05.active_job_id`、`qed_test.b05.parse_status` 均变化，且 `qed_test` 越枚举值 `completed` 被启动期归一为 `pending`），故本壳一切数值均标快照时刻，不以单次读数定性。取证脚本三个与输出留 `tmp/`，随本壳引用。 |
| 2026-10-17 | W2 立项与登记 | 根 todo 增 `REQ-123` 行（类别＝支线、状态与壳镜像 `Accepted`、成功标准 S1~S4 条目化）；`cross-project-contracts.md` §4「在途跨项目请求登记」追加本请求去处；普通任务轮壳（ARCH-035）不承载本请求正文，仅 `DEFECT-015` 在其登记表开 W23 条目。**本轮零代码改动**（对方工作区全程只读，根侧未动一行业务码）。 |
| 2026-10-17 | W2 之后：本轮文档面收尾（零代码改动） | 根侧同步五处——[parsing-flow.md](../../../design/parsing-flow.md) §9 补 `GET /parsing/tree` 的 503 例外与两种同形空态（登 [design-bugfix-log.md](../../../plans/design-bugfix-log.md) BUGFIX-032）、§3 库名现状列（BUGFIX-031）与 §4 在途请求行、[project-configuration.md](../../../design/project-configuration.md) 变量表现状段补「本机联调落点」一条、[project-status.md](../../../trackers/project-status.md) 当前主线加 2026-10-17 条、[database-design.md](../../../architecture/database-design.md) 两处「待放行／随发布批次」改两库已落地；REQ-118 壳 W1/W3/W6 状态格按阶段二事实随步。门禁＝契约 83 passed／全量 779 passed／ruff All checks passed，两枚存量红不变（REQ-122 的 database-design 逐列守护、他窗口 `scripts/image-model/.keepalive.pid`）。 |
| 2026-10-17 | W3 评审放行 → W4 移交执行（根侧代登对方文档面，零代码改动） | 用户裁决「REQ-123 W3 评审后移交 Axiom-Flow」后，根侧在其工作区**只写文档**完成移交三处：① 其 `docs/plans/2026-09-28-parse-artifact-trust.md`（PLAN-019）新增 `## 承载 REQ-123` 节（R1/R2 请求项 + 实读证据锚点 + 承接判据 + 回执口径），并在 `## 工作项` 追加 W10（R1 复位口径定档与实施）／W11（R2 跨库对账与归一口径入 `database-design.md`），其 `关联 Tracker` 元数据登记 REQ-123；② 其 `docs/trackers/todo.md` 新增 `REQ-123` 支线行（`**请求接收（QED-Engine 根仓库 REQ-123）**` 标记置于「任务」列句首，承载列单指针指向 PLAN-019 壳，成功标准 34 字无禁词无日期），并按其守护`test_main_aggregate_rows_list_branch_children` 在其主线聚合行 ARCH-021 的「任务」列补记该行 ID；③ 根侧 `cross-project-contracts.md` §4 在途请求行随步记过去处。锚点校正：根稿原写对方 `db/repositories.py:232-244`，实读为 `:231-244`（`update_parse` 定义在 231 行），移交稿已按实读写。对方门禁复跑＝`pytest tests/contract -q` 207 passed（含台账与计划治理、链接与目录白名单守护），其全量 `pytest tests -q` **640 passed / 10 skipped** + `ruff check src tests` All checks passed（2026-10-17 本会话代跑，仅证明文档改动不破其契约，代码面执行与回执仍归对方窗口）；根侧未在其工作区产生代码改动、未执行其 git 操作。 |
| 2026-10-18 | 台账清理第⑬行复验（跳过·保持 `Accepted`） | 用户裁决＝本轮不推进，理由＝S1/S2 判据（对方逐条回执＋其门禁输出）与 S3 复核（`GET /books` 三列自洽）全排在对方执行之后，根侧无代码面可做。**承接现状（只读复验，未代改）**＝Axiom-Flow `docs/trackers/todo.md:33` 已有 `REQ-123` 支线行（`Open`，事项内列 R1/R2 与判据锚点），其承载壳 `docs/plans/2026-09-28-parse-artifact-trust.md` 有「承载 REQ-123」节与 W10/W11 两工作项（均「待开始（2026-10-17 移交入壳）」），其聚合行 `ARCH-021`（同文件 `:28`）已声明本请求由 ARCH-022 壳承接——S2 判据（不新立请求行、并入既有支线壳）在移交当日即已满足。根侧 `af_books` 只读消费面本轮未复核（不做只读探针即不进 S3）。本行零代码、零库内读、零 git 操作，行状态保持 `Accepted`。 |


## 验证与验收

- 逐条对照 todo.md `REQ-123` 行「成功标准」列（S1~S4），本壳不复制判据（ADR 0023）。
- 根侧本轮验收面＝文档与台账登记本身：契约门禁 `tests/contract/test_tracker_governance.py`（G1/G2/G4/G5）
  与 `test_plan_governance.py`（G3/G7）、`test_markdown_links.py` 全绿；对方代码面验收以其门禁输出为证据，
  根侧不复跑其测试。

## 回滚

- 文档面回滚＝删除本壳文件与 todo `REQ-123` 行、还原 `cross-project-contracts.md` §4 在途请求一行；
  零代码改动故无行为回滚。
- `tmp/req123_probe*.py`／`.txt` 为本会话产物，回滚或收口时随 `tmp/` 清理规则处置（不进版本控制）。

## 关闭与归档

- 归档判定＝**Retain**：请求原文、实读证据锚点与回执口径属不可替代过程证据，收口后留 `history/plans/`。
- 关闭条件＝R1/R2 均有对方回执（落地／推后／拒绝之一）且根侧完成只读消费复核；回执执行进展记入本壳
  「过程与证据」节，不写回 todo 行。
- 门禁证据与 completed.md 关闭行随 `qed-closeout` 执行。
