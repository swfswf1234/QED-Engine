# 数据库设计总纲升为三项目数据库总正本（共享四表与根私有七表逐列定义＋建表语句）（database-design-core-registry）

状态：Completed
关闭结果：Achieved（行 S1~S6 逐条达成并留证，W1~W6 与 W10 全部完成；本轮纯文档＋契约守护，零代码零库内改动；门禁＝契约 89 passed＋ruff 净＋全量 805 passed（另 5 枚失败归属并行窗口新增用例，见「过程与证据」节末条）；W7 对方回执与 W9 两族逐列晋升按判例不阻塞关闭，分别由本壳 W7 条目与 `cross-project-contracts.md` §4 承接跟踪）
任务类型：B
最后更新：2026-10-17
关联 ADR：[ADR 0025](../../../adr/0025-database-design-master-doc-and-ddl-ownership.md)（本文升为三项目总正本、承载建表语句、顺序与去过程化改判）、[ADR 0017](../../../adr/0017-design-doc-structure-contract.md)（事实源唯一：根 architecture/ 是根侧 surface 事实源）、[ADR 0009](../../../history/adr/v0.1/0009-shared-qed-tables.md)（共享 `qed_*` 表族 schema 变更先经根仓库登记）、[ADR 0024](../../../adr/0024-preschema-rebuild-tiers-and-demo-gate.md)（1.0 前 schema 重建档位）、[ADR 0023](../../../adr/0023-todo-row-carries-scope-and-criteria.md)（成功标准正本在台账行）
关联设计：[database-design.md](../../../architecture/database-design.md)（本轮唯一落点）、[api-contracts.md](../../../architecture/api-contracts.md) §⑥（行序列化形状）、[cross-project-contracts.md](../../../design/cross-project-contracts.md) §4（共享表 schema 变更顺序与在途请求登记）、[llm-gateway.md](../../../design/llm-gateway.md)（`qed_llm_calls` 字段语义）
关联 Tracker：docs/trackers/completed.md（REQ-122 行，2026-10-17 Achieved 关闭并移出 todo）
归档判定：Retain（权威模型改判与逐列定义正本的落点判据属不可替代口径）

> **demo 门不适用声明**（ADR 0024 决定 2）：本轮是文档权威模型改判与逐列定义成文，零运行行为
> 变更（代码 DDL 不动、库内不动）；正确性由「文档列定义 ↔ 实现事实源」的机器对齐守护承载，
> 不设独立 demo 门。

## 目标与成功标准

**目标**：把 [database-design.md](../../../architecture/database-design.md) 从「纯登记层（全部表结构
指针到所有权方文档）」升为**三项目共用的数据库总设计正本**（ADR 0025）——共享 `qed_*` 四表与
QED-Engine 专业表 `qe_learn_*` 七表**以本文为设计正本**（逐列定义与建表语句都在本文；根侧九表与
代码渲染结果逐字对齐，受托两表按对方 ORM 写等价展示），QED-Tracker `qt_*` 与 Axiom-Flow `af_*`
两族**只在本文登记与路由**（列级正本暂留各自仓库）。同时把排版收敛为「前言 → 遵循的规则 →
全库总览 → 整体架构（访问拓扑 + 跨族数据主线 + 关系视图 + 读写矩阵 + 表角色分类）→ 详细设计 →
他项目表族与同步契约 → 变更与运维规范 → 守护与验证」的单一骨架，去掉同一事实的多处重述，
正文不留过程性叙述、不留任务编号引用（W10 用户裁决）。

**成功标准正本在台账行**（[ADR 0023](../../../adr/0023-todo-row-carries-scope-and-criteria.md)）：逐条对照
todo.md `REQ-122` 行「成功标准」列，本壳不复制判据。

## 范围与非目标

**范围**：

- 文档面：`database-design.md` 整篇重写为八段骨架（前言 → 遵循的规则 → 全库总览大表 → 整体架构
  （访问拓扑 + 跨族数据主线 + 关系视图 + 读写矩阵 + 表角色分类）→ 详细设计（11 张表逐列定义 ＋
  建表语句）→ 他项目表族与同步契约 → 变更与运维规范 → 守护与验证）；
  `qt_*`/`af_*` 在总览大表登记与路由；`architecture/index.md` 的一句话描述随步。
- 守护面：同文件增「文档列定义 ↔ 代码 DDL／对方 ORM」机器对齐守护、他项目私有表越界守护，并按
  ADR 0025 决定 5 删除零建表语句断言、改为文档 DDL ↔ 代码渲染结果**逐字对齐**守护，另增
  「每表小节四件套齐备」与「总览↔矩阵↔角色分类表集合一致」两枚守护（先红后绿）。
- 登记面：`cross-project-contracts.md` §4 在途请求登记一行；REQ-120 壳登记本轮探明的库内事实。

**非目标**：

- **不改任何代码 DDL、不改库内形状**：列名/类型/注释一律照实现事实源抄录，发现形状问题另立行。
- **不代改 QED-Tracker / Axiom-Flow 文档正文**（用户裁决 2026-10-16＝只出请求稿等对方承接）。
- **不动 `qt_*`/`af_*` 的列级内容**：两族在本文只有「一行＝什么 + 路由指针」。
- **不改 REQ-120 的四段顺序判据**——2026-10-17 用户裁决反转：本文段落顺序改为
  **共享 `qed_*` → 根私有 `qe_*` → `af_*` → `qt_*`**（ADR 0025 决定 3）。
- **建表语句进文档**：原「零建表语句原文的守护保留、不新立 ADR」两条非目标被用户 2026-10-17
  裁决反转，改判正文见 ADR 0025 决定 2（建表语句）、决定 4（固定文档去过程化）；台账 REQ-122 与
  REQ-047 两行的成功标准列同批改判。
- **`qt_*`/`af_*` 本轮仍不写列级内容与建表语句**：两族逐列晋升为正本属后续批次（同批裁决把本轮
  「详细设计」范围定为 11 表）。

## 前置条件

1. 用户裁决（2026-10-16）三条中的①权威粒度＝**逐列定义表 + 机器对齐**已被 2026-10-17 裁决扩为
   「逐列定义表 + 建表语句 + 机器对齐」（ADR 0025 决定 2）；② 共享两表的正本反转对对方**只出请求稿、
   等其承接**；③ 承载＝**新行**（REQ-120 成功标准已冻结，本轮不改写其行文本）。
2. REQ-118 四表逐列定档结论已成文（本文抄录其结论，不重开审理）。
3. REQ-120 W3 代码批次已落地（根代码 DDL 表名为 `qe_learn_*`、排序规则统一库默认），
   故本文的列定义有唯一可对齐的代码事实源。

## 工作项

| 条目 | 内容 | 状态 |
| --- | --- | --- |
| W1 | 探明实现事实源现状：根代码九张表 DDL 列序、QED-Tracker ORM 的 `qed_domain`/`qed_course` 列序、两库（`qed_test`/`qed`）共享两表的实际列形状与根私有表族的双前缀并存事实 | 已完成（证据见「过程与证据」节） |
| W2 | 机器对齐守护先红：`test_database_design_carries_column_definitions_for_tables_it_owns`（11 表列名与列序逐一对齐）＋`test_database_design_does_not_define_other_projects_private_tables`（`qt_*`/`af_*` 不得有逐列小节） | 已完成（红→绿随 W3） |
| W3 | 文档重写：八段骨架 + 11 张表逐列定义与建表语句 + 两族总览登记路由 + 既有守则按备注态迁移（去过程化） | 已完成（2026-10-17，证据见「过程与证据」节） |
| W4 | 随步登记：`architecture/index.md` 描述、`cross-project-contracts.md` §4 在途请求行、REQ-120 壳补登双前缀与 W4 `RENAME` 脚本过期事实 | 已完成（2026-10-17 三处落笔） |
| W5 | 跨项目请求稿成文并发出（对方 `database-shared-tables.md` 的「设计唯一事实源」声明改为实现镜像并指回本文；其 DDL 快照随 `meta`/64 宽/注释口径同步） | 已完成（2026-10-17 请求稿见本节末「跨项目请求稿」节，§4 已登记；根侧不代改对方正文，转达由用户执行） |
| W6 | 门禁：契约 + 全量 pytest + ruff，输出留证 | 已完成（2026-10-17 收口复跑契约 89 passed ＋ 全量 805 passed／5 failed 归属并行窗口 ＋ ruff All checks passed） |
| W7 | 对方回执随步（承接／推后／拒绝），回执落地后本文「实现状态」行同批更新 | 移交跟踪（待对方回执） |
| W8 | 建表语句进文档与顺序改判的守护面随步（ADR 0025 决定 5）：删零 DDL 断言、加逐字对齐＋四件套＋行数一致三枚守护，先红后绿 | 已完成（2026-10-17 四枚守护落地并逐枚变异验证打红，见「过程与证据」节） |
| W9 | 两族逐列晋升为总本的后续批次（`qt_*`/`af_*` 详细设计与对方文档正本声明改镜像） | 未开始（待用户排期） |
| W10 | 用户五点优化裁决（2026-10-17）：一二章精简（无编号前言＋功能域两列表＋12 条规则，删守护列与「已确认项」表）；四章扩为五节（访问拓扑／跨族数据主线／双 ER 关系视图／读写矩阵／表角色分类）；六章改为「他项目表族与同步契约」（正本关系＋同步矩阵＋路由＋验收）；七章补追加式演进与四步迁移窗口两节；全文正文去任务编号引用（sql 围栏与 7.8 归属列除外）；守护随步并变异验证 | 已完成（2026-10-17，证据见「过程与证据」节） |

## 过程与证据

- **2026-10-16 W1 实现事实源探查（只读）**：
  - 根代码九张表 DDL 与列序取自 `services/learn/base.py`（三表）、`services/learn/knowledge.py`
    （`qed_knowledge_point` 22 列 + `qe_learn_kp_detail` 22 列）、`services/learn/practice.py`
    （`qe_learn_question` 27 列 / `qe_learn_attempt` 15 列 / `qe_learn_review_task` 12 列）、
    `services/llm/call_log.py`（`qed_llm_calls` 18 列）；九张建表语句排序规则均为库默认
    `utf8mb4_0900_ai_ci`（REQ-120 W3 已统一）。
  - **QED-Tracker ORM 已先于其文档承接 REQ-119**：`src/qed_tracker/db/models.py` 的 `QedDomain`
    已含 `meta` 且 `domain_id` 为 `String(64)`、注释改「领域标识（主键，创建后不可改值）」，
    `QedCourse` 同形（17 列）；两个类的 docstring 已写「共享，**QED-Engine 拥有、QED-Tracker
    受托建表**」——与本轮权威改判同向。其台账 `QED-076`（进行中）载「共享表受托建表对齐
    （补 meta、domain_id 放宽 64）」。
  - **两库共享两表尚未落地该形状**：`qed_test` 与生产 `qed` 的 `qed_domain` 均 14 列
    （`domain_id varchar(32)`、无 `meta`）、`qed_course` 均 16 列（同）——对方 `ensure_schema`
    自愈未跑过，故本文逐列定义按**定档形状**（15/17 列）写，并逐表标「库内现状」以免文档领先事实。
  - **根私有表族在 `qed_test` 双前缀并存**：`qe_learn_course`（2 行）/`qe_learn_unit`（95 行）/
    `qe_learn_unit_progress`（0 行）/`qe_learn_kp_detail`（0 行）由重启后的新代码于 12:12–12:13
    懒建，七张旧名 `qed_learn_*` 仍在且练习三表（question 2 / attempt 6 / review_task 3）
    **只有旧名**；`tmp/req120_bak/` 不存在＝REQ-120 W4 脚本从未执行。
  - **推论（移交 REQ-120）**：W4 的 `RENAME TABLE` 清单已过期——四张目标名实存，`RENAME` 必撞
    1050/1080；该步需改为「旧名数据迁移或先删空表再改名」的合并形态，属 REQ-120 W4 的改判，
    本轮不动库。
- **2026-10-16 W2 守护先红**：新增两枚守护后 `pytest tests/contract/test_architecture_documents.py -q`
  ＝**1 failed, 9 passed**，失败点正是「database-design.md 缺 `qe_learn_course` 的逐列定义小节」，
  红因与预期一致（文档尚未重写）。

- **2026-10-17 用户裁决四项（本轮改判来源）**：① 本文后续作为**三项目数据库总设计文档**，
  QED-Tracker 的库根侧也负责，且 Tracker 保持保守性（根项目未启动时 8901 可独立运行——故权威归属
  只是文档面，不产生运行时依赖）；② 每表写建表语句；③ 表族顺序改为本项目自视角（共享→`qe_*`→
  `af_*`→`qt_*`）；④ 稳定文档正文不得出现过程性描述。本轮「详细设计」覆盖范围经问答定为
  **11 表**（共享四 + `qe_learn_*` 七），`qt_*`/`af_*` 留总览登记与路由。据此立 ADR 0025，
  同批改判 REQ-122 行的 S1/S2/S3/S4 与 REQ-047 长期行的 S1/S3。表名是否再改（用户：「后续我
  可能会改表名」）在本文一律以**备注列「表名待确认」**承载，不写成裁决叙述。
- **2026-10-17 W8 前置取证（只读，两库 `information_schema` 实查）**：
  - 生产 `qed`：共享四表已是定档形状（`qed_domain` 15／`qed_course` 17／`qed_knowledge_point` 22／
    `qed_llm_calls` 18），但 `qed_domain`/`qed_course` 的 `meta` 落**物理末位**（追加式 ALTER），
    与 ORM 声明序（`meta` 在第 11／13 位）**同集合不同序**；七张 `qe_learn_*` 一张都没有
    （该库从未建过根私有表，与改名批次无关）。
  - `qed_test`：`qed_domain`/`qed_course` 与 ORM **逐列同序一致**；`qe_learn_course`(2 行)/
    `qe_learn_unit`(95)/`qe_learn_unit_progress`(0)/`qe_learn_kp_detail`(1) 四张新名表已由懒建落地，
    七张旧名 `qed_learn_*` 全部仍在且练习三表（`question` 2／`attempt` 6／`review_task` 3）**只有旧名**
    ——REQ-120 W4 的改名批次至今未执行，本文据此在备注列写现状。
  - Axiom-Flow 侧（本轮不接管列级）：生产 `qed` 的 `af_page_regions`（11 列）与 `af_parse_jobs.
    parser_signature` 实存＝其迁移已到 `20260928_0001`，**与其文档 `database-design.md` 自陈的
    「业务库停在 `20260926_0001`」不符**；`af_books` 生产库 21 列含 `last_parse_result`／
    `ingested_at`（物理序 19/20/21 追加态）。该偏差随 W5 请求稿一并告知对方，根侧不改其正文。
  - QED-Tracker 侧形状事实源：**本仓库无 Alembic 迁移链**（`alembic.ini`/`versions/` 均不存在，
    唯一残骸是 `docs/history/qed-030-retire-qt_resources/alembic_version.txt`），ORM `models.py`
    为唯一形状源（其 ADR 0006 模型即 schema）；`ensure_schema` 只 DROP+CREATE 且**只比列名集合**，
    故类型/注释/索引漂移不会被自愈修正；全仓 ORM 无 COLLATE 声明、无 ENUM（文档 DDL 里的
    `ENUM(...)` 实际都是 `VARCHAR(n)`）、无 `server_default`（默认值全在应用层）。
    `qed_domain`/`qed_course` 建表语句因此按 ORM 派生写为**等价展示**，守护只比列名·列序·类型·可空。

- **2026-10-17 W3 文档重写落地**：`database-design.md` 整篇改为八段骨架（1013 行）——前言（目的／功能／
  负责范围／边界）、规则 R1~R12 与已确认项清单、全库总览 21 表（列＝表名｜表类型｜表功能与负责范围｜
  备注｜结构事实源指针）、关系视图（mermaid `erDiagram`，根私有表已用 `qe_learn_*` 名）与读写矩阵
  （增 8903 一列，全为「–（经 8900）」）、详细设计 11 表（每节四件套：用途／涉及模块／字段明细六列
  表含「键」列／建表语句）、他项目表族路由、变更与运维规范（7.1 变更顺序、7.2 重建档位四档＋例外档、
  7.3 建表与幂等、7.4 命名与迁移窗口、7.5 敏感字段与连接配置、7.6 待确认与库内现状 T1~T9）、守护与验证。
  九张根侧表的建表语句由 `tmp/req122_ddl_inject.py` **从代码渲染结果逐字注入**（不手抄），
  `qed_domain`/`qed_course` 两份为按 ORM 派生的等价展示语句。既有守则零丢失对照：`meta` 三条红线→R7、
  重建档位四档→7.2、`qt_knowledge` 命名避让→`qed_knowledge_point` 注释、主键不可变→R8、DEFECT-014→
  读写矩阵备注 + T6、排序规则统一→R9、敏感字段与变量来源→7.5、改名清单→7.4 + T2、双前缀并存→备注列 + T2。
- **2026-10-17 W8 守护与变异验证**：`tests/contract/test_architecture_documents.py` 增
  `test_database_design_ddl_matches_code_verbatim`（文档 sql 围栏 ↔ 代码渲染后语句逐字相等）、
  `test_database_design_display_ddl_matches_tracker_orm`（列名·列序·类型·可空性，对方仓库不在位则跳过）、
  `test_database_design_table_sections_carry_four_parts`、`test_database_design_inventory_and_matrix_cover_same_tables`
  （21 表集合与表数一致）；四枚守护各施一处漂移变异（根侧列宽 64→63、受托列宽 64→32、小节件名改「涉及面」、
  矩阵 `qt_selections`→`qt_selectionx`）**全部打红**，脚本 `tmp/req122_mutation_check.py` 执行后原文还原
  （`restored: True`）。过程性事实一律不写进正文，只落备注列与 7.6 的 T 条目（ADR 0025 决定 4）。
- **2026-10-17 门禁**：`tests/contract` **89 passed**；全量 `pytest -q` **798 passed in 146.47s**；
  `ruff check backend tests` **All checks passed**。两处随步红因与处置：① 本文「关联代码」原以反引号声明
  `services/llm/call_log.py`，被 `test_active_architecture_and_design_documents_declare_metadata` 判为认领
  他文档 DesignRef 的模块——改为不带路径的说明文字（该表 DDL 归属 LLM 网关模块）；②「关联测试」声明了
  不存在的 `tests/test_learn_service.py`，改为 `tests/test_learn.py`。

- **2026-10-17 收口复跑与文档事实核验**：本轮最后两处正文修正（R6 机械守护列的 `tests/test_learn_service.py` → `tests/test_learn.py`、`tests/test_learn_practice.py`；「关联代码」的 `QED-Tracker/src/qed_tracker/db/bootstrap.py` → `db/schema.py`，实读 `ensure_schema`:138／`create_all`:166 确认）后重跑门禁＝`tests/contract` **89 passed**、全量 `pytest -q` **805 passed in 144.55s**、`ruff check backend tests` **All checks passed**（较 W6 首跑的 798 多出 7 例，属并行窗口新增用例，非本行引入）。文档全部反引号路径 token 经脚本实存核验（`tmp/req122_path_check2.py`、`tmp/req122_crossrepo_check.py`）：跨仓 6 枚（`QED-Tracker/src/qed_tracker/db/models.py` 及 `::QedDomain`/`::QedCourse`、`db/schema.py`、`QED-Tracker/docs/architecture/database-private-tables.md`、`Axiom-Flow/docs/architecture/database-design.md`）全部解析；不解析的仅 5 枚且均为**退役或占位引用**——`courses/math.json`（REQ-032 前的旧课程体系 JSON，文中写「取代」）、`meta/`／`meta/selections/`／`meta/tasks/`（REQ-032 退役的 JSON 事实源，文中写「承接自」）、`dataset/backups/YYYY-MM-DD-<任务标识>`（ADR 0019 决定 4 的备份目录命名式）。据此文档面事实源核验完成，本壳曾于同日转 Completed；随后用户给出五点优化裁决，关闭收回、壳回 In Progress（下一条 W10 承载；归档 `mv` 尚未执行、当轮亦未提交，故不新开任务行）。

- **2026-10-17 W10 用户五点优化裁决落地（壳收回关闭）**：用户复评前稿给出五点（前言与规则章未领会＝
  要简介式、不分「点几」子模块、精简且核心前置、细则后置、不稳定指针不写；总览满意；整体架构可再专业化；
  详细设计挺好；他项目路由要写明共享表以此为准与双向同步口径）。据此四处改判：
  ① **一二章精简**：前言改为无编号四段（目的／功能／负责范围与边界）＋「功能域｜承载表」两列表；
  规则章只留 12 条三列表（编号｜规则｜内容），**删「机械守护」列与整张「已确认项」表**——已确认项的
  实质条目零丢失核验：共享表变更先登记→R3、只引用不复制→R5、人工位→R6、`meta` 三红线→R7、
  主键不可变→R8、重建档位→7.3、解析归属与生产库人工窗口→7.6、事实源唯一→前言段 4、
  知识点层级化与 `book_ref` 稳定 ID→五章对应表小节、练习三表收敛与无答案转自评→五章备注列、
  唯一键降级为普通索引→五章 `qed_knowledge_point` 备注、直写课程态属越界→4.4 矩阵备注＋7.8 T6。
  ② **四章扩为五节**：4.1 命名空间与访问拓扑（mermaid `flowchart LR`，实线＝直连 MySQL、
  虚线＝HTTP 透传）、4.2 跨族数据主线（六阶段｜写入表｜引用键｜只引用不复制）、4.3 关系视图
  （拆双 `erDiagram`：图 A 本文正本 11 表、图 B 他项目两族＋四条跨界边）、4.4 读写矩阵（内容不变）、
  4.5 表角色分类（六角色｜判据｜表｜架构后果，与 7.3 重建档位对齐）。
  ③ **六章改为「他项目表族与同步契约」**：6.1 正本关系（共享 `qed_*` 以本文为准、两族列级正本在对方）、
  6.2 同步矩阵（六类变更｜发起方｜是否同步｜同步内容与路径：根改共享表→通知两方随步、对方改共享表→
  先通知根登记再执行、专用表只在**表级**变更（改名／新增／删除）时同步表信息、列级细则与运维规范不同步）、
  6.3 两族路由、6.4 同步的验收。七章补 7.2 追加式演进与列序口径、7.5 四步迁移窗口两节，
  原「待确认与库内现状」顺延为 7.8。
  ④ **全文正文去任务编号引用**（用户裁决「一并去引用化」）：三章备注列与五章字段明细备注列一律只写
  事实与规则本身（如「判分归判分层 `grading.py`」代替「判分归主链 M-3」、「优先级不落列（读时派生）」
  代替「（读时派生，J5）」），章内交叉引用改指本文小节号（7.2→7.3、7.6→7.8）；
  **两处例外刻意保留编号**——```sql 围栏内的列注释属代码／对方 ORM 所有（逐字对齐守护锁死，改文档即红）、
  7.8 的「归属」列是台账路由键。脚本 `tmp/req122_polish.py`（一～四、六～七章整块替换）与
  `tmp/req122_decite.py`（35 处逐条替换＋残留扫描断言）分两批落地，均以「先断言命中次数、末尾单次写盘」
  形态执行；残留扫描口径＝剥掉 sql 围栏与 7.8 小节后，正文不得再出现 `(REQ|DEFECT|ADR|BUGFIX|OPS|ARCH)-\d+`
  与 `M-1/M-2/M-3/M6 裁决/M1 UI-1/J1/J5/缝 N/D2 批复/D3：/W5 §/R-4/R-6/⑨/决定 2·3·4` 任一 token。
  文档行数 1013 → 1092。
- **2026-10-17 W10 守护随步与变异验证**：4.4 节号变动使原
  `test_database_design_inventory_and_matrix_cover_same_tables` 硬编码的 `### 4.2 读写矩阵` 失配而红
  （＝预期先红）。改造为**节号无关**并扩面：新增 `_doc_section`（按标题正则切小节，到下一个 `##`/`###`
  为止）与 `_table_cell_names`（取表格指定列内的库表名）两个辅助函数，守护更名
  `test_database_design_inventory_matrix_and_roles_cover_same_tables`，断言总览↔矩阵↔角色分类
  **三方表集合相等**且为 21 表。扩面当即捕获真实漂移：4.5 角色分类漏列 `qe_learn_course` 与
  `qe_learn_question`——已补（前者归主数据、后者归版本化产物，并把 7.1 首行/次行顺序与「出题批次」
  作用域写进架构后果列）。变异验证三处（总览 `qt_selections`→`qt_selectionx`、矩阵
  `qe_learn_kp_detail`→`qe_learn_kp_detailx`、角色分类删 `qe_learn_review_task`）**全部打红**，
  脚本 `tmp/req122_mutation_w10.py` 执行后原文还原（`restored: True`）。
  `architecture/index.md` 的一句话描述随新骨架改写（并去掉 ADR 编号指针）。

- **2026-10-17 W10 治理面随步（壳收回关闭的连锁）**：壳由 Completed 回 In Progress 后，
  `docs/plans/index.md` 的 REQ-122 条目原为「已 Achieved 关闭 + 归档路径待放行」的**具名链接行**，
  与 `test_plan_index_is_navigation_only_and_routes_status_to_todo`「活跃壳文件名不得出现在索引」冲突
  而红（＝本行自因，非并行窗口）。改为无链接的一行导航条目（承载内容一句话 + 归档判定 + 「状态见任务台账」），
  归档 `mv` 待本行再次收口时执行。同批随步：`todo.md` 恢复 REQ-122 行（行文本按 ADR 0023 冻结原样恢复，
  原文自本会话 transcript 取回，见 `tmp/req122_recover_todo_row.py`）、`completed.md` 撤回其关闭行、
  `project-status.md` 当前主线由「已完成」改回「进行中」并注明「同日曾按 Achieved 关闭、因用户五点优化裁决收回」。
- **2026-10-17 W10 门禁复跑与红因归属**：`tests/contract` **89 passed**、`ruff check backend tests`
  **All checks passed**；全量 `pytest -q` **805 passed, 5 failed**——五枚失败全部落在
  `tests/test_api.py`（4 枚 `*_via_script_*` tolerant-decode / None-stdout 用例）与
  `tests/test_qed_qwen_service.py`（`test_qwen_stop_declares_tolerant_decode_and_survives_none_stdout`），
  经 `git diff` 核验五枚均为**并行窗口新增的 `+def test_...`**，而 `scripts/text-model/qed_qwen_service.py`
  未被修改（＝对方 TDD 先红阶段，实现尚未落）。本行为纯文档 + 契约守护轮，不触碰 `services/`
  与生命周期脚本，故归属并行窗口、不代改其 WIP。

- **2026-10-17 W10 落地后二次收口**：五点优化批全部落笔（一二章精简＝无编号前言四段＋功能域两列表＋R1~R12 规则表删守护列并删「已确认项」表；四章扩为五节；六章改为「他项目表族与同步契约」四节（正本关系／同步矩阵／列级路由／同步验收）；七章补 7.2 追加式演进与列序口径、7.5 四步迁移窗口，原 7.6 待确认节顺延为 7.8 T1~T9；全文正文去任务编号引用，`sql` 围栏与 7.8 归属列按裁决保留），治理面连锁四处随步（壳收回关闭→再次关闭、`todo.md` 行、`completed.md` 行、`project-status.md` 当前主线）＋`plans/index.md` 条目由具名链接行改为归档条目。门禁复跑＝`tests/contract` **89 passed**、`ruff check backend tests` **All checks passed**、全量 `pytest -q` **805 passed, 5 failed**，五枚失败经 `git diff` 核验全部是并行窗口新增的 `+def test_...`（`tests/test_api.py` 四枚 `*_via_script_*` tolerant-decode／None-stdout 用例、`tests/test_qed_qwen_service.py` 一枚），对应实现 `scripts/text-model/qed_qwen_service.py` 未被修改＝对方 TDD 先红阶段，与本行无关、不代改。归档判定 Retain，壳已移入 `docs/history/plans/2026-10/`（用户 2026-10-17 放行）。

## 跨项目请求稿（W5，2026-10-17 成文）

根侧**不代改**对方文档正文（用户裁决 2026-10-16），以下条目待转达由对方各自立项承接；
判据正本＝本文五章对应表小节与 `docs/architecture/database-design.md` 总览行。

| 编号 | 接收方 | 请求内容 | 去处与现状 |
| --- | --- | --- | --- |
| R1 | QED-Tracker | `docs/architecture/database-shared-tables.md` 开篇「本文是 `qed_domain`/`qed_course` 设计的唯一事实源」声明改为**根总纲的实现镜像**并指回 `QED-Engine/docs/architecture/database-design.md`（ADR 0025 决定 2）；其 DDL 快照随 `meta` 列／ID 宽度 64／列注释口径同步 | 该同步的表形状部分已由 REQ-119 R1/R2/R6 承接（其 ORM 与 `qed_test` 已一致），本条只剩**声明与指针**改镜像 |
| R2 | QED-Tracker | `qt_*` 五表列级正本暂留其仓库；后续任何增删列／改类型须先在根总纲 §7.1 与总览行登记，根侧文档随步；顺带裁决 `qt_sources.book_id` VARCHAR(100) 与 `qt_books.book_id` 主键 VARCHAR(32) 宽度不匹配（MySQL 重建外键有 3780 风险） | 宽度事实已落根总纲 7.8 T5，等其裁决 |
| R3 | QED-Tracker | `qed_course.related_targets` 为空转列（唯一写点恒写空数组），删列与否交所有权方裁决 | REQ-119 R5 延续，根总纲 7.8 T9 |
| R4 | Axiom-Flow | `af_*` 五表的逐列内容与建表语句本轮**不**进根总纲（只登记与路由）；待后续批次晋升为正本时，其 `docs/architecture/database-design.md` 的「唯一事实源」声明同步降级为镜像 | 根总纲 7.8 T7，后续批次待用户排期 |
| R5 | Axiom-Flow | 其文档自陈业务库 Alembic 停在 `20260926_0001`，与生产 `qed` 库实存 `af_page_regions`（11 列）／`af_parse_jobs.parser_signature` 不符（＝迁移已到 `20260928_0001`）；请更正自陈的迁移位置与 `af_books` 列清单 | 根总纲 7.8 T8，本轮根侧未改其正文 |


## 验证与验收

- 守护先红后绿：W2 两枚守护在文档重写前红、重写后绿；原 `test_database_design_is_registry_only_with_er_diagram`
  更名 `test_database_design_keeps_er_diagram`，erDiagram 断言保留，零建表语句断言按 ADR 0025 决定 2/5 删除
  并由逐字对齐守护取代（W8）；四枚新守护各以一处故意漂移验证能打红（变异清单见「过程与证据」节）。
- 总览↔矩阵↔角色分类一致守护按**标题正则**定位小节，不硬编码节号（W10 节号变动即其红因）。
- 逐字对齐守护的比对面＝代码**渲染后** DDL（`qed_llm_calls` 的 `{PROVIDER_COMMENT}`／`{META_COMMENT}`
  占位与 `{{task}}` 转义须先渲染，否则文档永远对不上）。
- 内容零丢失核验：重写前的既有守则条目（`meta` 三条红线、1.0 前重建档位表四档、`qt_knowledge`
  命名避让、主键不可变、DEFECT-014 偏差、排序规则统一、敏感字段与配置指针、迁移窗口与改名清单）
  逐条在新骨架里有落点——按 ADR 0025 决定 4，偏差与未完迁移一律以**表格备注**或一行条目承载，
  不成段叙述；逐条对照记在本节。
- 门禁矩阵按 [development.md](../../../guides/development.md)：`tests/contract/` + 全量 pytest
  （`D:/software/anaconda3/envs/QED_env/python.exe`）+ `ruff check backend tests`；本轮无前端改动，
  不跑 vitest/`tsc -b`/build。
- 链接门禁：跨仓引用一律写纯路径（不做相对链接、不猜 URL），仓库内相对链接全部可解析。

## 回滚

- 文档：`git revert` 本轮提交即恢复原「纯登记层」形态；重写前原文完整保留在 git 历史
  （本轮不改代码、不改库，无数据面回滚）。
- 守护：随同一提交回滚；守护是加法，去掉不影响其他用例。
- 跨项目请求稿：以「撤回说明」写回对方台账，不由根侧代改对方文档。

## 关闭与归档

- 关闭取值 `Achieved` 需 W1~W6 与 W10 全达成且门禁绿；W7（对方回执）**不阻塞本行关闭**——请求发出并
  登记即视为达成，回执生命周期由本壳 W7 条目与 `cross-project-contracts.md` §4 登记行承接跟踪
  （判例＝REQ-118 W4 / REQ-119）。
- 归档 `Retain` 至 `history/plans/2026-10/`：权威模型改判理由、双前缀并存的库内实测与
  「逐列定义 + 机器对齐」的守护形态属不可替代证据。
- 遗留与移交（收口时写全）：① REQ-120 行 S1 的四段顺序判据与 S5 的「零 DDL 守护」判据已被 ADR 0025
  决定 3／决定 2·5 取代，**行文本未改、以 ADR 为准**（该轮收口时按其原判据不得判未达）；
  ② REQ-120 W4 的 `RENAME TABLE` 清单过期，需改为「旧名数据迁移或先删空表再改名」的合并形态（D 类转人工）；
  ③ 本文 R1~R5 请求稿待转达与对方回执（W7 跟踪）；④ 七张根私有表名仍待用户确认（本文 7.8 T1），
  改名时总览、详细设计、代码 DDL 与库内表同批随步；⑤ `qt_*`/`af_*` 逐列晋升为总本属后续批次（W9）；⑥ **行文本冻结未改**：W10 的四章五节／六章同步契约／全文去引用化属用户 2026-10-17 裁决改判，台账行 S3「总览、读写矩阵与详细设计三处一致」由守护扩面为「总览↔矩阵↔角色分类↔详细设计」四处承载（判据的超集，不判未达），改判正文以本壳 W10 条目为准。
