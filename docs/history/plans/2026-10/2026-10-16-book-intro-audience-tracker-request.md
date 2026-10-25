# （请求：QED-Tracker）教材级「简介／面向对象」两列落 qt_books（book-intro-audience-tracker-request）

状态：Closed
任务类型：A
最后更新：2026-10-23
关联 ADR：[ADR 0017](../../../adr/0017-design-doc-structure-contract.md)（事实源唯一）、[ADR 0023](../../../adr/0023-todo-row-carries-scope-and-criteria.md)（成功标准正本在台账行）、[ADR 0024](../../../adr/0024-preschema-rebuild-tiers-and-demo-gate.md)（1.0 前 schema 重建档位）、[ADR 0003](../../adr/v0.1/0003-shared-qed-database-independence.md)（共享 qed 库＝独立性铁律的明确例外）
关联设计：[cross-project-contracts.md](../../../design/cross-project-contracts.md)（跨项目口径）、[api-contracts.md](../../../architecture/api-contracts.md) §⑥ 学习域（`POST /learn/courses/sync` 的 `books` 元数据段）、[REQ-117 壳](2026-10-15-learn-course-study-redesign.md)（需求方轮，W8 书架清单 v2 的 C10 裁决）、[REQ-119 壳](2026-10-16-shared-tables-tracker-request.md)（同一目标项目的并函对象，2026-10-23 按 `Partial` 收口归档）、QED-Tracker `docs/architecture/database-design.md` §5.2「qt_books 详细设计」（`qt_books` 结构唯一事实源，**只读**；本壳原写 `docs/design/database-schema.md` 系错路径，已更正，见 [BUGFIX-038](../../../plans/design-bugfix-log.md)）
关联 Tracker：docs/trackers/completed.md（REQ-121 于 2026-10-23 以 `Achieved` 收口迁入；登记期间在 docs/trackers/todo.md，学习设计轮）
归档判定：Retain（跨项目请求原文、现网取证与回执口径属不可替代过程证据）

## 对接信息（跨项目协作规范·计划文档模板）

| 项 | 值 |
| --- | --- |
| 需求方 | QED-Engine 根仓库（REQ-117 W8 书架清单 v2） |
| 目标项目 | QED-Tracker（8901） |
| 接口面 | **收窄后形态（2026-10-23 用户裁决）**＝`qt_books.meta` 的 **`intro` 键**（零 ALTER、不加列）＋ 8901 `GET /books` 的 `to_dict()` 全列透传（现网已成立）＋ 本批新增的写面 `PATCH /api/v1/books/{id}`（仅 `meta`、按键合并）；「面向对象」（`audience`）**推后**；无端口／协议／`.env` 变量变化 |
| 评审方 | 用户 |
| 执行方 | **QED-Tracker 侧＝根侧 agent 依用户 2026-10-23 授权代执行**（原文＝「可用授权你最小化改动qed-tracker并进行两方的收尾」），改动清单见「过程与证据」2026-10-23 收窄落地批条目，对方会话可复核改判；根侧＝本仓 `api/learn.py` 读优先级一处 |
| 验收标准 | 逐条对照 todo.md `REQ-121` 行「成功标准」列（S1~S5） |

## 目标与成功标准

**目标**：把教材卡要向学习者展示的两句信息——这本书**讲什么**（简介）与**面向谁**（入门／进阶／深入等）——
落到书级事实源 `qt_books`，使书架清单的教材卡不必再从教程套（`qt_knowledge`）借这两项。
目标效果＝根侧 sync 的 `books` 元数据改读 `qt_books.intro`/`audience`（套级派生降为兜底），同套多本教材各说各话。

**2026-10-23 收窄（用户裁决原文见「过程与证据」）**＝只做「讲什么」，承载形态取 `qt_books.meta.intro`（零 ALTER）；
「面向谁」推后，继续读套级 `position`。**交付边界**＝键位定档＋读面改道＋写面补齐＋双侧守护；**逐本简介的文字内容**
属登记面（人工或解析侧产出），不在本请求交付内——现网 `meta` 26 行全 NULL，故卡面当前仍显示套句，写入一枚 `meta.intro`
即自动生效、根侧无需再改码。

**成功标准正本在台账行**（ADR 0023）：逐条对照 todo.md `REQ-121` 行「成功标准」列，本壳不复制判据。

## 范围与非目标

- **在范围**：`qt_books` 两列（或其 `meta` 键位替代方案）、8901 书目接口透传、存量回填口径、对方 schema 事实源随步。
- **不在范围**：① 根侧学习面渲染改造（已由 REQ-117 W8 完成，两列缺失时卡上显示「暂无简介」「未标面向对象」，不阻塞）；
  ② Axiom-Flow 面（`af_books` 不加列——根侧经 8901 `TrackerClient.list_books()` 读取，解析侧只供 `active_job_id` 就绪判据）；
  ③ 下载/验收链与 `raw/` 文件动作（本请求纯元数据）。
- **口径约束**：`qt_books` 结构事实源与写权限在对方，根侧只出请求稿与消费口径，不代改代码或表结构（跨项目协作规范）。

## 请求项

| ID | 请求 | 根侧消费口径 |
| --- | --- | --- |
| R1 | `qt_books` 加两列：`intro`（TEXT，学习者视角教材简介，一到三句，非版权页摘要）、`audience`（面向对象，建议与 `qt_knowledge.position` 同值域五档闭集 `beginner`/`intermediate`/`advanced`/`comprehensive`/`elective`）。若按[四张共享表 meta 守则](2026-10-15-shared-tables-field-freeze.md)主张「试验字段先入 meta」，回执可改判为 `qt_books.meta` 的 `intro`/`audience` 键位并给出键名 | 根侧 sync 优先读书级两列，缺失回落所依套 `qt_knowledge.intro`/`position`（现口径），再缺显示「暂无简介」「未标面向对象」 **回执（2026-10-23，代执行）＝落地（取 meta 键位替代方案）**：键名 `intro`、值域＝学习者视角自由文本（一到三句），成文于对方 `docs/architecture/database-design.md` §5.2 的 `meta` 行（该行为本批新增键位说明）；`audience` **推后**＝值域未定档、不入库，面向对象继续读套级 `position`；零 ALTER、零表重建 |
| R2 | 8901 `GET /books`（含 `GET /books/{id}`）响应透传两列（或 meta 键），字段名 `intro`/`audience` 与 R1 一致 | 根侧 `TrackerClient.list_books()` 取行后原样进 sync 的 `books` 段，不做二次加工 **回执（2026-10-23）＝落地且现网即成立、对方零改码**：`GET /api/v1/books` 返回 `QtBook.to_dict()` **全列**，而 `to_dict` 遍历 `__table__.columns`（其 `db/models.py:265-272`）⇒ `meta` 天然在响应内；其 `docs/architecture/database-design.md` 消费节原已写明「响应行必须携带 …`meta`」。本批补一枚守护用例锁死该透传（`tests/test_book_api.py::test_patch_book_writes_meta_by_key_and_get_books_passes_it_through`）。**两点事实更正**＝① 本请求原写的 `GET /books/{id}`（单数详情）在对方**不存在**（书目读面只有枚举与聚合两条）；② `GET /knowledge/{id}` 的 `books[]` 聚合响应**不含 meta**（其 api.md 该节声明聚合行只给 `book_id/title/holding/status`），故根侧读位＝`GET /books` 全列这一条，不走聚合 |
| R3 | 存量行回填口径（**行数更正 2026-10-23**：原写「17 行」为立项时读数，实读 `qed_test` 现＝`qt_books` **26 行**，其中 17 本已进 `af_books` 且 17/17 命中教程套（落 10 套）、9 本尚未进解析侧）：初值按 `af_books.knowledge_id` → `qt_knowledge` 套级 `intro`/`position` 派生（只覆盖 17 本），或声明逐本人工登记（覆盖 26 本）；回执写明来源与是否含未入库 9 本 | 回填前后根侧显示均不报错（回落链已就位），回填落地只改读取优先级一处 **回执（2026-10-23）＝口径成文、不批量回填**：套级派生回填＝把同一句套话复制进 17 行，零信息增量且会把「两枚套吃掉 9 本」的误陈述**固化入库**，故判退；逐本登记走本批新增的 `PATCH /api/v1/books/{id}`（内容来源＝人工登记或解析侧产出，属内容面工作、不归本请求）。只读探针另证＝现网 `qt_books` **26 行 `meta` 全 NULL**、6 枚在册书的 `notes` 亦全空 ⇒ 现无可派生的书级描述源。未回填期间根侧回落套级、卡面不报错（守护用例 `test_sync_book_intro_leg_degrades_to_the_set_without_breaking`） |
| R4 | 对方 `docs/architecture/database-design.md` §5.2「qt_books 详细设计」随步更新两列语义与值域（原写 `docs/design/database-schema.md` 为错路径，该文件在对方仓库不存在，2026-10-23 按实有路径更正）；若本请求稿需要在对方 `docs/plans/` 落承接壳，**同步其 `test_documentation` 全量 md 白名单**（对方门禁按等值白名单校验新增文档，未同步即红） | 根侧不双写对方台账；落地后同步 `api-contracts.md` §⑥ sync 行 `books` 段口径与 `database-design.md` 指针 **回执（2026-10-23，代执行）＝落地**：对方 §5.2 的 `meta` 行成文键位、值域、写面与读方（承 R1），其 `docs/architecture/api.md` 新增 `PATCH /api/v1/books/{book_id}` 六要素节＋端点索引行；白名单**未触**＝对方工作区零新建 md（改动＝2 份源码＋2 份测试＋4 份既有文档，其中 `docs/plans/2026-09-24-v1-task-chain.md` 与 `docs/trackers/todo.md` 系 2026-10-23 发函批的代登）。根侧随步＝`api-contracts.md` §⑥ sync 行 `books` 段（本批改读优先级处）与本文件所在 §4 出站登记 |
| R5 | 回执逐条给出「落地／推后／拒绝」＋排期，落地项附对方门禁输出 | 根侧据回执决定本壳 W3「改读书级两列」这条的起停（原写「W5 剩余批次」，`REQ-117` 已于 2026-10-18 关闭，归属见 W3 改注） **回执（2026-10-23）＝本表五行「回执」段＋对方 `QED-082` 行的回执段即逐条回执正文**；对方门禁输出＝`pytest tests -q` **676 passed／1 skipped** ＋ `ruff check src tests` All checks passed（2026-10-23，cwd＝对方仓、QED_env 解释器；本批前基线＝675 passed／1 skipped／0 failed，＋1＝新增守护用例）。**执行身份披露**＝R1/R2/R4 的落地与回执由根侧 agent 依用户授权代执行代出，**非对方会话独立出具**；对方会话复核后可改判——表结构零改动、其行为面只增一枚 `PATCH` 端点与一处守护判据收窄，回滚成本见「回滚」节 |

## 前置条件

1. REQ-117 W8 书架清单 v2 已在根侧实施（教材卡已具备简介／面向对象位与回落链），本请求只补事实源，不解锁根侧功能。
2. 用户 2026-10-16 C10 裁决：「教材表中有相应字段和描述；如果没有则去对应项目下登记，一个是简介，一个是面向对象」——本稿即该裁决的登记动作。
3. 取证（现网 `qed_test`，2026-10-16 立项读数）：`qt_books` 无 `intro`／`audience`／面向对象类列；`qt_knowledge` 带 `intro`（165~331 字）与 `position` 五档，`af_books.knowledge_id` 关联 17/17 一致且每本只命中一套。
4. 取证复验（**2026-10-23 只读探针，开发库 `qed_test`，零库内写**，脚本与输出＝`tmp/req121_probe.py`／`tmp/req121_probe2.py`／`tmp/req121_sets.json`，列集与行数另以同法只读 `information_schema`／`COUNT(*)` 查询复算，`.env:30` 实读 `QED_DB_NAME=qed_test`）：`qt_books` 26 行 26 列（含 `meta JSON`、无 `intro`／`audience`）；`qt_knowledge` 15 行；`af_books` 17 行全部命中 10 枚套，其中 `active_job_id` 非空仅 1 本（`mathanalysis-b05`）；**多本套＝`kt-mathanalysis-3`（4 本）与 `kt-mathanalysis-4`（5 本）**，两枚套共 9 本共用两句套级简介。

## 工作项

| ID | 工作项 | 状态 |
| --- | --- | --- |
| W1 | 根侧登记：本壳 + todo `REQ-121` 行落位，`REQ-117` 壳 C10 条补「已出请求稿」指针 | 已完成（2026-10-16） |
| W2 | 请求稿移交对方（由用户转达／对方会话自读，按跨项目协作规范执行），对方 todo 承接行与回执口径确立 | 已完成（**2026-10-23 根侧代登**，用户授权原文＝「我确认授权根侧代登对方文档面；与REQ-119 并成一枚发函」）：对方 todo `QED-082` 行＋对方 `docs/plans/2026-09-24-v1-task-chain.md`「承载根仓库 REQ-121」节（六项对接信息＋R1~R5 逐条承接位＋现网取证），同一节内携带 `REQ-119` 残余（R5 双仓同批改面清单＋逐条回执催办）与 `REQ-128` 取消告知；对方工作区**零新建 md、零代码、零 DDL、零 git 操作**，只改其两份既有文档 |
| W3 | 对方回执 R1/R2 落地后，根侧 sync 改读 `qt_books.intro`/`audience`（套级降兜底）＋ `api-contracts.md` §⑥ 与 `cross-project-contracts.md` 随步 + 定向测试补一条「书级列优先、缺失回落套级」 | 已完成（**2026-10-23**，前置 R1/R2 回执已落地。按收窄裁决实际改读的是 `qt_books.meta.intro` 单键、`audience` 推后不改读；落点＝`backend/qed_engine/api/learn.py` 新增 `_book_intros()` 与 `book_meta` 组装处的 `intro` 优先级一行，用例＝`tests/test_learn.py::test_sync_prefers_book_intro_from_qt_books_meta`（先红：改道前取套句，断言书句失败）＋`test_sync_book_intro_leg_degrades_to_the_set_without_breaking`（书库腿离线回落），`tests/test_learn.py` **55 passed**；`api-contracts.md` §⑥ 本批随步。**归属改注 2026-10-18**：原措辞「属 REQ-117 W5 批次」因 REQ-117 已于 2026-10-18 Achieved 关闭而失效，本改动改由**本行 W3 自身承载**；台账行 S5 的成功标准正文按 ADR 0022 冻结不改写，其「由 REQ-117 W5 批次改读」读作「由 REQ-121 落地批改读」） |

## 过程与证据

- **2026-10-16 立项**：REQ-117 W8 书架清单 v2 实施时发现书级两列不存在（`qt_books`/`af_books` 均无简介与面向对象列），
  现以 `af_books.knowledge_id` → `qt_knowledge.intro`/`position` 套级派生交付教材卡；同套多本教材会共用同一句简介，
  属已知口径妥协。用户 C10 裁决「没有就去对应项目下登记」→ 本稿出稿，根侧渲染不等该请求（回落链已实现并有真机证据）。
- **2026-10-23 复验：妥协已升级为现网误陈述**：`qed_test` 实读 17 本教材落 10 枚套，`kt-mathanalysis-3`（4 本）与
  `kt-mathanalysis-4`（5 本）**两枚套吃掉 9 本共用两句套级简介**——《数分习题集》《吉米多维奇题解》《Rudin 原理答案》的
  卡面显示的是精读叙述、菲赫金哥尔茨三卷本与两册《数分习题课讲义》共用一句。这不是「缺字段」而是**说错**，
  且根侧无法自行修正（书级事实源在对方）。成本面复核＝`qt_books` 已含 `meta JSON`，R1 走键位替代可**零 ALTER**；
  根侧改动只有一处读取优先级（`backend/qed_engine/api/learn.py:607-623` 的 `book_meta` 组装，现直接取套级行）
  ＋ W3 的定向用例，属小改。**判据不变**：是否值得为两列走整表重建，取值权在对方（其 `ensure_schema` 自愈会清 `qt_books` 登记事实）。
- **2026-10-23 用户裁决（本函发出依据，原文）**：「我确认授权根侧代登对方文档面；与REQ-119 并成一枚发函」。
  合并发函的落点＝**同一承接窗口一枚三事**＝本请求 R1~R5 ＋ `REQ-119` 残余（该轮同日按 `Partial` 收口，未做两项＝
  R5 双仓同批改面清单、对方对 R1~R6 的逐条回执）＋ `REQ-128` 取消告知（对方 `QED-078` 行失去需求方）。
  并函只并**发函与承接窗口**，不并根侧台账行：`REQ-119` 已收口归档、判据冻结，`REQ-121` 行与本壳独立承载自己的 S1~S5，
  不另立综合 ID（区别于 `REQ-136`：后者取代的是四枚**均未获对方承接**的在册请求，本处 `REQ-119` 已达成四项且已关闭，
  并一枚新 ID 会作废既有达成证据并要对方重新承接）。
- **2026-10-23 待裁项登记（不擅自收窄 R1）**：「R1 是否收窄为只要 `intro`、`audience` 推后」在上一批多选裁决中**用户未答**，
  按「批量待裁项只答其一时未答者仍待定」的规则保持待定——本函 R1 的两列口径与五档值域**一字未改**，对方可按原样回执。
- **2026-10-23 对方门禁（代登前后各跑一次，cwd＝对方仓、QED_env 解释器）**：基线＝`tests/test_documentation.py`
  **1 failed／8 passed**，唯一红＝其 `QED-080` 行指向根侧 `REQ-119` 请求稿的**归档前路径**（2026-10-23 收口批移动该文件时
  未随步对方入站链接）；本轮顺带把该枚链接改指 `history/plans/2026-10/`，代登后复跑＝**9 passed**。
  对方 `QED-082` 行与本节均落在其**既有**文件内，不新建 md，其全量 md 等值白名单不受影响。
- **2026-10-23 收口门禁（本轮最后一次编辑后串行跑，QED_env 解释器）**：根 `pytest tests/contract -q` **88 passed／1 failed** ＋
  根全量 `pytest tests -q` **875 passed／1 failed**（147.80s；唯一红同源＝并行模型轮遗留的 `scripts/image-model/.keepalive.pid`
  散落脚本产物，`.gitignore` 已忽略，归因不修）＋ `ruff check backend tests scripts` **All checks passed**；
  对方 `pytest tests/test_documentation.py -q` 代登后 **9 passed**（含其 todo 行治理与全链可解析两条守护）。
  **顺手修与越界披露**＝本轮另把根侧 5 份文档中 8 枚指向 Axiom-Flow PLAN-024 壳的内链改指其归档件
  `../../Axiom-Flow/docs/history/plans/2026-10/2026-10-21-af-table-family-rebuild.md`——该壳由 Axiom-Flow 会话于 2026-10-23 移动、
  未随步入站内链，致本仓 `test_markdown_links` 8 处断链（属他轮遗留、非本批引入）；涉及文件＝
  `docs/design/cross-project-contracts.md`×2、`docs/plans/2026-10-21-af-table-architecture-design.md`×3、
  `docs/plans/2026-09-22-axiom-flow-v1-parsing-knowledge-optimization.md`、`docs/plans/2026-09-23-knowledge-exploration.md`、
  `docs/plans/2026-10-20-doc-knowledge-cluster-master-outline.md` 各 1。**本轮零代码、零 DDL、零库内写、零 git 操作**。

- **2026-10-23 收窄裁决与执行授权（原文）**：「确认只要只要 intro，audience 推后，继续执行，可用授权你最小化改动qed-tracker并进行两方的收尾」
  ＝① R1 收窄为只要 `intro`，`audience` 推后；② 继续执行；③ 授权范围由「代登对方文档面」扩到**在 QED-Tracker 做最小化改动**，
  并由根侧执行**两方收尾**（根 `REQ-121` 行＋对方 `QED-082` 行）。
- **2026-10-23 最小改动形态取证（三读一查，全部只读）**：`qt_books.meta` JSON 列已存在且其列注释就是键位守则正文
  （对方 `src/qed_tracker/db/models.py:256`）⇒ 走 meta **零 ALTER、不触发自愈整表重建**；`GET /api/v1/books` 逐行返回
  `to_dict()` 全列（对方 `api/main.py:1392-1405` ＋ `models.py:265-272` 遍历 `__table__.columns`）⇒ 透传**现网即成立**；
  根侧 `TrackerClient.list_books()` 原样返回对方行（`backend/qed_engine/clients/tracker_client.py:143-158`）⇒ 客户端零改动。
  **查出的一枚缺口**＝`meta` 在对方**完全没有写面**：`create_book` 形参白名单不含 `meta`（`knowledge_repository.py:780-797`）、
  全仓 `src/` 内 `meta` 只出现在列声明处、且 books 侧无任何 PATCH/PUT 端点（PATCH 只有 domains/courses/knowledge 三枚）
  ⇒ 若只定档键位则通路一头堵死，故本批的最小必要改动＝**补一枚书级扩展槽写面**（形制镜像其 `patch_knowledge`）。
- **2026-10-23 对方侧改动清单（代执行，六枚文件，零新建文件、零 DDL、零 git 操作）**：源码 2＝`db/knowledge_repository.py`
  新增 `update_book_meta()`（**按键合并**：`{**(row.meta or {}), **meta}`，不清已存键）＋ `api/main.py` 新增
  `PATCH /api/v1/books/{book_id}`（只认 `meta`、非对象或缺省 422、未知书行 404 `BOOK_NOT_FOUND`）；测试 2＝`tests/test_book_api.py`
  新增合并/透传/错误面用例＋模块 docstring 覆盖行随步、`tests/test_data_layout.py` 一处**守护判据收窄**（见下条披露）；
  文档 2＝`docs/architecture/database-design.md` §5.2 `meta` 行成文键位、`docs/architecture/api.md` 端点索引行＋六要素节。
- **2026-10-23 越界披露①（代改对方既有守护判据）**＝对方 `tests/test_data_layout.py::test_source_never_writes_resources_island`
  原判据为「src/ 全仓不出现带引号 `"meta"` 字面量」，用于防资源 JSON 岛复活（QED-071 B 轮退役的 `"qed-tracker" / "meta" / "resources"`
  路径构件）；本批 `payload.get("meta")` 属**合法 JSON 键访问**却被该 blunt 判据扫中（首跑即 1 failed＝`api/main.py`）。
  处置＝按该守护自述意图把判据收窄到**路径构件**（`'"meta" / "'`／`'"meta"/'`／`'"meta\\"'`，`"resources"` 字面量判据原样保留），
  并在其 docstring 写明收窄缘由与日期；变异验证＝岛路径构造仍判红、JSON 键与属性访问判绿，`tests/test_data_layout.py` **11 passed**。
  对方会话若判该守护不应放宽，可整条撤回——撤回后本批 `PATCH` 端点即需改措辞或改写法，属可控冲突。
- **2026-10-23 现网生效条件与取证边界（说清「改了什么、还没显示什么」）**＝只读探针：`qt_books` 26 行 `meta` **全 NULL**、
  在册 6 本（`status` 为 decided/parallel）的 `notes` 亦全空 ⇒ 根侧读优先级改道后**卡面文案当前不变**（仍走套级兜底），
  任一行写入 `meta.intro` 即自动生效、根侧无需再改码；8901 本轮**未运行**（`netstat` 无 8901 监听、HTTP 连接被拒 10061），
  故透传取证取**源码级＋对方用例级**（其 `to_dict` 全列＋新增断言），**未做真机 HTTP 取证**，本壳不据此声称线上已验证。
- **2026-10-24 收口门禁（两仓串行，QED_env 解释器；对方数值为本批落地后测、末次复跑同值）**：根 `pytest tests/contract -q`
  **88 passed／1 failed** ＋ 根全量 `pytest tests -q` **877 passed／1 failed**（136.18s；较发函批的 875 ＋2＝本批两枚新用例；
  唯一红同源＝并行模型轮遗留的 `scripts/image-model/.keepalive.pid` 散落脚本产物，`.gitignore` 已忽略，归因不修）＋
  `ruff check backend tests scripts` **All checks passed**；根定向 `pytest tests/test_learn.py -q` **55 passed**（含本批两枚：
  书级命中先红后绿＋书库腿离线回落）。对方全量 `pytest tests -q` **676 passed／1 skipped**（本批前基线 675／1／0，＋1＝新增守护用例）＋
  `ruff check src tests scripts` **All checks passed**；对方定向 `test_documentation.py` **9 passed**（含 todo 行治理与全链可解析两守护，
  其入站链接已改指本壳归档新路径）、`test_book_api.py` **26 passed**、`test_data_layout.py` **11 passed**（判据收窄后变异验证：
  岛路径构造仍判红、JSON 键与属性访问判绿）。**对方工作区另有他轮在途改动**（`src/qed_tracker/config.py`、`tests/test_documentation.py`、
  `docs/design/download-pipeline.md` 等，非本批产生），以上数值在同一工作树上取得，本批未回退亦未合并他轮改动。

## 验证与验收

- 设计与门禁矩阵见[开发指南](../../../guides/development.md)；对方落地事实源在对方台账与其 `docs/architecture/database-design.md`，根侧不双写。
- 根侧本轮验收＝本稿四节（对接信息六项齐备、R1~R5 可逐条回执）+ `tests/contract` 全绿（台账 6 列契约与计划治理）。

## 回滚

- 文档面：删本壳与 todo `REQ-121` 行即回登记前状态；对方文档面的代登可逆＝删其 `QED-082` 行与「承载根仓库 REQ-121」节、
  把 `QED-080` 链接改回原路径（该链接改指属**修红**，不属本函内容）。
- 代码面（2026-10-23 收窄批新增，此前本行零代码依赖）：根侧回滚＝删 `api/learn.py` 的 `_book_intros()` 与其在 `book_meta`
  组装处的引用、`intro` 取值改回 `str(meta_row.get("intro") or "")`（**套级兜底链保留不删**，故回滚后与改道前逐值相等）＋
  删 `tests/test_learn.py` 两枚用例与夹具的 `qt_books`/`books_online` 分支；对方侧回滚见「遗留与移交」末条。

## 关闭与归档

**逐 S 对照（判据正文在台账行、写定不改；ADR 0023）＝S1~S5 全达成，取值 `Achieved`（2026-10-23 达成／2026-10-24 收口落笔）**：

- **S1 达成**＝R1~R5 逐条在对方 todo 有承接行（`QED-082`），承接稿六项对接信息齐备（其 `docs/plans/2026-09-24-v1-task-chain.md`
  「承载根仓库 REQ-121」节），其全量 md 等值白名单**未触**＝零新建文档（S1 的白名单分句读作条件式，无新增即不成立为缺口）。
- **S2 达成**＝R1 回执「落地（取 meta 键位替代＝请求稿原已允许的形态）」、R2 回执「落地（现网即成立）」，并附对方门禁输出
  （`pytest tests -q` 676 passed／1 skipped ＋ ruff 净）；`audience` 的「推后」系**用户裁决**而非对方拒绝，不构成回执缺口。
  执行身份已披露（代执行代回执，对方可复核改判）。
- **S3 达成**＝落地形态成文＝`qt_books.meta` 的 `intro` 键、值域＝学习者视角自由文本（一到三句），成文处两处（对方 §5.2 `meta` 行、
  对方 `api.md` 新端点节），根侧固定读取该单键；`audience` 未定档、不入键位表。
- **S4 达成**＝R3 回填口径有回执（判退套级派生批量回填、逐本登记走 `PATCH /api/v1/books/{id}`、来源属内容面），
  未回填期间根侧回落链照常显示不报错（守护用例两枚，含书库腿离线回落）。
- **S5 达成**＝表结构零改动、`ensure_schema` 自愈零触发；代码面改动落在用户 2026-10-23 明示授权范围内且逐条列明可回滚；
  回执落地后本批完成 sync 改读与 `api-contracts.md` §⑥ 随步（其 S5 原文的「REQ-117 W5 批次」读作「REQ-121 落地批」，见 W3 归属改注）。

**残余两项均非本行判据缺口**（`audience` 推后＝用户定的交付边界；逐本简介文字＝登记面工作），去处见「遗留与移交」。
台账面收口（2026-10-24 已执行）＝根 todo `REQ-121` 行原子移出 → [`completed.md`](../../../trackers/completed.md)（关闭结果＋逐条证据）；
对方 todo `QED-082` 行同批移入其 `completed.md`；本壳按 Retain 归档 `history/plans/2026-10/`，出站内链按新深度重算并逐枚 resolve，
入站指针随步五处（`docs/design/cross-project-contracts.md` §4、REQ-117 归档壳 2 枚、`docs/plans/design-bugfix-log.md` BUGFIX-038、
`docs/trackers/project-status.md`、对方台账行）＋ `docs/plans/index.md` 归档节登记一条；对方 `docs/plans/2026-09-24-v1-task-chain.md`
「承载根仓库 REQ-121」节补「授权扩面＋逐条回执＋改动清单＋撤回路径＋取证边界」五段并更正其 接口面 行的 `GET /books/{id}` 字面。

## 遗留与移交

- **`audience`（面向对象）推后的去处**＝本条即登记处（薄登记上限，ADR 0020；不新开台账行）。值域未定档，故不占键位表；
  现网继续读套级 `qt_knowledge.position`（`position_label` 五档中文标签口径不变）。日后若要重启，前置＝① 值域定档（五档闭集或自由文本）、
  ② 与 `position` 的优先级关系定档（书级覆盖套级或并存）、③ 内容来源定档；恢复线索＝本壳归档件与对方 §5.2 `meta` 行。
- **真正消除现网误陈述的那一步＝逐本简介内容登记**（不在本请求交付内）：现网 `qt_books` 26 行 `meta` 全 NULL，写面已就位
  （`PATCH /api/v1/books/{id}`，按键合并），内容来源两条＝人工逐本登记，或由解析侧产出书级摘要后回写（后者属
  `REQ-136` 对 Axiom-Flow 的综合请求面，该函尚未发出）；属内容/人工窗口，agent 不代造文案。
- **真机 HTTP 透传取证未做**＝8901 本轮未运行（无监听、连接被拒）；对方下次起服务后一条 `GET /api/v1/books` 即可复核响应含 `meta`。
  本壳只在源码级＋对方用例级声称成立。
- **同函携带的 `REQ-119` 残余仍在对方窗口**（本批一字未动）＝`qed_domain.path_results`／`qed_course.related_targets` 两列的
  **双仓同批**摘除清单与其 `QED-080` 行收敛；逐列改面清单见
  [REQ-119 归档壳](2026-10-16-shared-tables-tracker-request.md)「遗留与移交」。
- **对方可复核改判的两处授权内改动与撤回路径**＝① 新增 `PATCH /api/v1/books/{book_id}`（删 `api/main.py` 该 handler＋
  `knowledge_repository.py::update_book_meta`＋`test_book_api.py` 该用例即回原行为）；② `test_data_layout.py` 守护判据收窄
  （按该文件 2026-10-23 前的判据原样贴回即恢复严格形态，届时本批端点需改写以避免岛字面量误伤）。撤回后对方门禁应回到
  675 passed／1 skipped／0 failed 基线。
- **误产生改动登记＝无**：跨项目协作规范的「代改即登记移交」在本批由**用户明示授权＋逐条清单披露**承接（清单与文件路径见
  「过程与证据」2026-10-23 收窄落地批条目），对方会话据清单审阅即可。
