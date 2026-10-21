# `qe_*` 族表名定档去 `learn_` 段与逐表重构梳理轮（qe-family-rename-and-refactor）

状态：In Progress
任务类型：B
最后更新：2026-10-21
关联 ADR：[ADR 0025](../adr/0025-database-design-master-doc-and-ddl-ownership.md)（前缀即所有权、根侧九表建表语句进总纲并逐字对齐守护）、[ADR 0024](../adr/0024-preschema-rebuild-tiers-and-demo-gate.md)（demo 门与 1.0 前 schema 分档）、[ADR 0009](../history/adr/v0.1/0009-shared-qed-tables.md)（共享 `qed_*` 表族边界）
关联设计：[database-design.md](../architecture/database-design.md)（表名与建表语句正本、R1 前缀规则）、[cross-project-contracts.md](../design/cross-project-contracts.md)（schema 变更顺序）、[frontend-architecture.md](../architecture/frontend-architecture.md)（8903 学习三面读面）
关联 Tracker：docs/trackers/todo.md（REQ-132 登记，普通任务轮 ARCH-035 节）；前序＝[REQ-120 壳](2026-10-16-root-private-prefix-and-four-part-design.md)（其 W3 一次改名与 W4 目标名按本壳改判）
归档判定：Retain（目标名定档表、撞名处置理由与逐表判定表属不可替代口径）

> **demo 门（ADR 0024 决定 2，一壳一门）**：本壳 W1 即门＝练习三表改名后，8903 `#/practice` 与
> `#/learn` 在真机读到现网实存而当前不可见的那批数据（`qed_learn_question` 2 行／
> `qed_learn_attempt` 6 行／`qed_learn_review_task` 3 行）。到门暂停待人工验收，通过才进 W2~W6。

## 目标与成功标准

**目标**：按用户 2026-10-21 裁决，把七张根私有表的前缀口径统一为 `qe_` **且不带 `learn_` 子域段**，
其中学习课程容器取 `qe_course_state` 以避开与共享课程目录表 `qed_course` 的目标名撞车；并借此一次
改名窗口，把该族累积的形状问题（新旧名 11 张并存、排序规则分裂、两表列级高度重叠、两处 `confirmed`、
`learn_course_id` 列名归属、死列未删）逐表给出判定。目标效果＝根私有族一名一表、库内只有一套名字、
现网学习面数据全部可见。

**成功标准正本在台账行**（[ADR 0023](../adr/0023-todo-row-carries-scope-and-criteria.md)）：逐条对照
todo.md `REQ-132` 行「成功标准」列，本壳不复制判据。

## 命名定档（用户裁决承载）

| 库内现名（`qed_test`） | 代码现名 | **目标名** | 行数实测 | 定档理由 |
| --- | --- | --- | --- | --- |
| `qed_learn_course` | `qe_learn_course` | **`qe_course_state`** | 新 2／旧 2 | 去 `learn_` 后本表欲取 `qe_course`，与共享课程目录表 `qed_course` 的目标名同名；两表形状完全不同（17 列目录 vs 16 列学习容器），故学习侧让名、取 `qe_course_state` |
| `qed_learn_unit` | `qe_learn_unit` | `qe_unit` | 新 95／旧 95 | 直接去段，无撞名 |
| `qed_learn_unit_progress` | `qe_learn_unit_progress` | `qe_unit_progress` | 新 0／旧 2 | 同上 |
| `qed_learn_kp_detail` | `qe_learn_kp_detail` | `qe_kp_detail` | 新 1／旧 3 | 与共享 `qed_knowledge_point` 的目标名 `qe_knowledge_point` 不撞名，但列级高度重叠，重叠判定见 W5 |
| `qed_learn_question` | `qe_learn_question` | `qe_question` | 仅旧名 2 | **只有旧名**，代码只读新名 ⇒ 现网不可见（W1 demo 面对象） |
| `qed_learn_attempt` | `qe_learn_attempt` | `qe_attempt` | 仅旧名 6 | 同上 |
| `qed_learn_review_task` | `qe_learn_review_task` | `qe_review_task` | 仅旧名 3 | 同上 |

**不随改名**：四张共享表 `qed_domain`／`qed_course`／`qed_knowledge_point`／`qed_llm_calls` 保持 `qed_`
前缀（用户当轮裁决「只改根私有七表」），R1「前缀即所有权＝`qed_*` 共享／`qe_*` 根私有」不破坏，
**本批改判不需新 ADR**；[ADR 0025](../adr/0025-database-design-master-doc-and-ddl-ownership.md) 决定 2
点名「七张 `qe_learn_*`」处只作**表名随步注记**（判据不变，照 W29 对 ADR 0022 的注记判例）。

## 范围与非目标

**范围**：
- W1 demo 门（练习三表改名 + 库内三张 `RENAME` + 8900 重启 + 三链真机读到旧数据）。
- W2 二次改名批次：代码 DDL 与内部引用 `qe_learn_*` → 目标名（实测 103 处／根代码）、根文档 125 处、
  契约守护 `ROOT_PRIVATE_TABLES` 七枚常量与逐字 DDL 对齐、`web-ui` 3 处。
- W3 库内迁移：四张已懒建新名表与七张旧名表的归一（形态两案承接 REQ-120「遗留与移交」，本壳按新目标名重写）。
- W4 生产 `qed` 库：建表与改名命令清单成文转人工（七表在生产从未建过，零操作）。
- W5 逐表判定表：11 张现名表逐表给 保留／改列／并表／废弃 判定与依据，至少覆盖下表六个在册问题。
- W6 收口：全仓旧名引用清零核验 + 门禁 + 真机三链 + 总纲与 `code-map.md` 随步。

**非目标**：
- 不改共享四表前缀，不改 `qt_*`／`af_*` 任何表名（`af_*` 族另见 [REQ-133](2026-10-21-af-family-table-refactor-request.md)）。
- 不在本批改列形状：`qe_kp_detail` 与 `qed_knowledge_point` 的重叠列收敛、两枚死列删除
  （`qed_domain.path_results`／`qed_course.related_targets`，归 REQ-119 R5 由 Tracker 执行）与
  `learn_course_id` 列名是否随动，均由 W5 出判定、执行另批。
- 不在生产库执行任何 DDL；库内迁移窗口（D 类）的排期与批准归人工。

## 在册问题（W5 判定表的既有输入，2026-10-21 探索取证）

| # | 问题 | 实测事实 |
| --- | --- | --- |
| P1 | 新旧名 11 张并存 | `qed_test` 内 `qe_learn_*` 四张由重启后新代码懒建，`qed_learn_*` 七张全在；`tmp/req120_bak` 不存在＝一次改名批次从未执行 |
| P2 | 练习三表数据不可见 | `qed_learn_question` 2／`qed_learn_attempt` 6／`qed_learn_review_task` 3 只有旧名，代码只读新名 ⇒ 本族唯一用户可见缺口 |
| P3 | 排序规则分裂 | 旧名七表与 `qed_knowledge_point` 库里仍 `utf8mb4_unicode_ci`，代码声明已改 `utf8mb4_0900_ai_ci` |
| P4 | 两表列级高度重叠 | `qe_learn_kp_detail` 23 列与 `qed_knowledge_point` 22 列共用 `domain_id`/`course_id`/`kp_id`/`parent_kp_id`/`norm_key`/`anchors`/`book_ref`/`type`/`name`，并互为 `from_detail_id` ↔ `dedup_of` 双向引用 |
| P5 | `confirmed` 两处并存 | `qe_learn_unit.confirmed` 与 `qe_learn_kp_detail.confirmed` 皆 `tinyint`，与「主表只存已确认知识点」口径的分工需成文 |
| P6 | 主键列名带子域 | `learn_course_id` 在四张表出现（`qe_learn_course`/`unit`/`unit_progress`/`question`），去 `learn_` 后列名是否随动待裁 |
| P7 | 生产库零根私有表 | 生产 `qed` 库七张一张都没有 ⇒ 上线面是全量建表清单而非改名清单 |

## 前置条件

1. 用户已裁决三条（2026-10-21）：范围＝只改根私有七表；撞名处置＝学习侧取 `qe_course_state`；
   台账形态＝另立 REQ-132/133 两行。
2. W1/W3 需 8900 停机重启窗口（旧名与新名不可能同时生效），且与 REQ-119 R5 死列删除排同一窗口。
3. 库内操作执行前逐表整表备份进 `tmp/req132_bak/`（W1 实测形态＝`mysqldump` 单文件三表 SQL，含建表与全部行；原写「JSON」是取证形态笔误），验收后按 ADR 0019 决定 4 清理不留残留。
4. 探针脚本只允许打 `qed_test`；生产 `qed` 库在本轮零接触。

## 工作项

| 条目 | 内容 | 状态 |
| --- | --- | --- |
| W1 | **demo 门**：练习三表按目标名改名（代码侧三枚表名 + 库内三张 `RENAME TABLE`）→ 重启 8900 → 8903 `#/practice`、`#/learn`、`#/knowledge` 三链真机各读一次，验证 2 题／6 作答／3 复习任务在面可见且 `/learn/star-map` 计数与库内 `COUNT(*)` 一致 | 已过门（2026-10-21 本会话执行），**待人工验收**——验收前不进 W2；取证见「过程与证据」2026-10-21 W1 三行 |
| W2 | 二次改名批次：根代码 `qe_learn_*`→目标名（103 处）、根文档 125 处、`web-ui` 3 处、守护 `ROOT_PRIVATE_TABLES` 与逐字 DDL 对齐随步，ADR 0025 决定 2 加表名注记 | 未开始（W1 已过门，待人工验收放行） |
| W3 | 库内迁移归一：其余四张（`course_state`/`unit`/`unit_progress`/`kp_detail`）的新旧名处置，按「认新名为正本＋旧表留档废弃」或「旧行迁移＋id 重映射」两案择一执行 | 未开始（待 W2） |
| W4 | 生产 `qed` 库建表与改名命令清单成文，转人工随发布批次（D 类） | 未开始 |
| W5 | 逐表判定表：P1~P7 逐条给 保留／改列／并表／废弃 判定与依据，输出进本壳并回填总纲备注列 | 未开始 |
| W6 | 收口：全仓旧名引用清零核验（文档 + 代码 + 测试，`history/` 除外）＋契约/全量 pytest/ruff＋`code-map.md` 随步 | 未开始（待 W5） |

## 过程与证据

- **2026-10-21 立项探索取证（零代码、零库内写操作）**：库面＝`information_schema` 全表清点，`qed_test`
  26 张（`qed_` 11／`qe_learn_` 4／`af_` 5／`qt_` 5／`alembic_version` 1）、生产 `qed` 15 张；逐表
  `COUNT(*)` 与 `TABLE_COLLATION` 同批取。列面＝12 张关注表的有序列名（撞名判定与 P4 重叠比对的依据）。
  引用面＝`grep -rn -w` 逐名计数：根代码 258／根文档（非 `history/`）412／Tracker 代码 101／Tracker
  文档 455／AF 代码 0／AF 文档 30，其中根私有七表＝代码 103 + 文档 125 且**跨仓为零**，共享四表＝代码
  155 + 根文档 251 + Tracker 代码 101 + Tracker 文档 455。取证脚本 `tmp/req120x_inventory.py`、
  `tmp/req120x_cols.py` 与输出 `tmp/req120x_inv.txt`、`tmp/req120x_cols.txt`、`tmp/req120x_sweep.txt`。
- **2026-10-21 用户裁决三条**：① 「全部换成 `qe_`」**不含**四张共享表——共享表留 `qed_`，理由是共享表
  形状事实源两枚在 Tracker ORM、`qed_llm_calls` 有外部写方，且改前缀会击穿 R1「前缀即所有权」；
  ② `qe_course` 撞名取**学习侧改名 `qe_course_state`**（共享课程目录表让位方案与「仅该表保留 `learn_`」
  方案均未采）；③ 台账形态＝另立 REQ-132（本行）与 REQ-133（`af_*` 族梳理请求稿），不挂 REQ-120 壳内条目。
- **2026-10-21 定级**：按 `AGENTS.md`「变更分级与边界」表，本任务改的是 `architecture/database-design.md`
  的表名与建表语句（大修改）＋根侧代码 DDL 与库内数据（B 类实现 + D 类数据操作），故 todo 行 + 本壳 +
  门禁先行；因用户裁决只动根私有族，不动 R1 与 ADR 0025 的判据，**不立 ADR**，仅加表名随步注记。

- **2026-10-21 W1 代码与总纲改名（练习三表）**：改名范围＝`qed_learn_question`→`qe_question`、
  `qed_learn_attempt`→`qe_attempt`、`qed_learn_review_task`→`qe_review_task`（一次改名轮在代码里的
  `qe_learn_*` 形一并摘除 `learn_` 段）。实测替换计数＝`backend/qed_engine/services/learn/practice.py`
  38 处（含三枚 `CREATE TABLE IF NOT EXISTS`、全部 SQL 字面量、模块 docstring 与列 COMMENT 文本）、
  `backend/qed_engine/api/learn.py` 4 处（注释与分节标题）、`docs/architecture/database-design.md`
  33 处（§一 类目行、§三 全库总览七行、§四 跨族主线／拓扑图节点／erDiagram 边／读写矩阵／表角色分类、
  §五 三枚小节标题与其逐字建表语句、§六 门态叙述）、守护常量 `ROOT_PRIVATE_TABLES` 三枚改名
  （`tests/contract/test_architecture_documents.py:111-117`）。**TDD 顺序**＝先只改守护常量取证五枚红
  （`test_root_private_table_prefix_and_collation_match_database_design` 与四枚 DDL/总纲一致性守护），
  再改代码（红收敛到文档侧四枚），最后随步总纲转绿。总纲同批随步的口径三处：§7.6 改名批次形态改为
  按「目标名是否已由懒建实存」分流（未实存＋旧表有数据＝直接一条 `RENAME TABLE`，本次即此形态；
  已实存＝迁移后删旧／空表直删由懒建重建）；§7.8 T1 记七表定档目标名全列并声明练习三表已落地、余四张待
  W2；§7.8 T2 记 `qed_test` 双前缀现状只剩四张。全仓余值清扫见 W6，本批不动四张 `qe_learn_*` 现名。
- **2026-10-21 W1 库内窗口（只打 `qed_test`，生产 `qed` 零接触）**：改前只读探针
  （`tmp/req132_probe.py`）＝旧名三表 2／6／3 行且 collation 仍 `utf8mb4_unicode_ci`、目标名三张
  `ABSENT`⇒按新 §7.6 走 `RENAME` 分流。备份＝`mysqldump`（`mysqldump.exe` 不在 Git Bash PATH，须用 Program Files 全路径； 经 backend `Settings` 注入不外显）单文件三表进
  `tmp/req132_bak/req132_w1_practice_three.sql`（14,932 字节，建表三段齐、INSERT 行合计 2+6+3）。
  执行＝`tmp/req132_rename.py`（前置断言＝目标库必须 `qed_test`、旧名在位且行数等于备份行数、目标名
  必须不存在）三条 `RENAME TABLE` 后复验＝新名 2／6／3 行、旧名零存活；库内 `qed_learn_*` 余四张
  （`course`／`kp_detail`／`unit`／`unit_progress`）留 W3。重启＝8900 `POST /api/v1/self-restart`
  → `{"status":"restarting"}`，4 秒后 `/api/v1/health` 200。
- **2026-10-21 W1 过门取证（真机三链）＋ DEFECT-021 发现与顺带修复**：改名后首次真机访问
  `GET /api/v1/learn/courses` 返 **500**，`logs/config.log` 末段根因＝
  `pymysql.err.OperationalError (1055, "…nonaggregated column 'qed_test.t.target_kind'…incompatible with sql_mode=only_full_group_by")`，
  落点＝`services/learn/practice.py:due_counts_by_kp` 的 `… AS kp_id … GROUP BY kp_id`（按计算列别名分组）。
  **该缺陷先前不可见**＝旧名表在 `qed_test` 里叫 `qed_learn_review_task`，代码读新名，这条聚合从未被真机
  执行到（P2 缺口的连带效应）。修向＝`GROUP BY` 重复表达式本体（`GROUP BY IF(t.target_kind='kp',
  t.target_id, q.kp_id)`），到期口径 `status='active' AND due_at<=now` 与判分语义零改动。
  **先红后绿**＝新增 `tests/test_learn_practice.py::test_due_counts_by_kp_groups_by_expression_not_alias`
  红实录（断言表达式形态缺失，`1 failed`）→ 改 SQL 后 `tests/test_learn_practice.py`＋`tests/test_learn.py`
  **105 passed**。同语句双形态真机对照（只读，`qed_test`）＝别名分组 `ERR (1055…)`、表达式分组
  `OK rows=1`。重启 8900 后 `GET /learn/courses` **200**、`GET /learn/star-map` **200**。
  真机三链（8903，`?v=` 破缓存 ＋ 内置浏览器只读）＝`#/practice?course=math_analysis` 出「今日到期 3／
  错题 2 未解决（共 2）」、到期复习（3）、错题本（2）、本课题（2）与库内 `COUNT(*)` 2／6／3 对齐；
  `#/learn?course=math_analysis` 出书架清单（数学分析四本教材、节数计数在面）；`#/knowledge?course=math_analysis`
  面包屑与课程描述在面，该页两枚请求 `/learn/courses/math_analysis/knowledge-points?include_outline=true`
  与 `/learn/star-map` 均 **200**、无 4xx/5xx。star-map 与库内逐课程对账＝12 门课
  `kp_confirmed`／`kp_candidates` 全 `match=True`（`math_analysis`＝1／1，其余 0／0），取证快照
  `tmp/req132_w1_star.txt`。**登记去向**＝本缺陷按 task-lifecycle「缺陷处理」通道记 `DEFECT-021`
  （todo 行 ＋ 承载条目 [普通任务轮壳 W30](2026-09-29-ordinary-tasks-round.md) ＋ 上述回归测试），
  不为本壳另立计划。

## 验证与验收

- 代码面：`pytest tests/contract -q`（含 `test_root_private_table_prefix_and_collation_match_database_design`
  与 DDL 逐字对齐守护）＋根全量＋`ruff check backend tests scripts`；`tests/test_learn*.py` 定向绿。
- 库面：`SHOW TABLES` 目标名七张实存、`qed_learn_*` 与 `qe_learn_*` 两组旧名不存活（留档表另按 W3 择案声明）、
  逐表行数与改名前一致。
- 真机面：8900 重启后 8903 `#/knowledge`、`#/practice`、`#/learn` 三链各一次读写，练习与复习队列计数
  与库内 `COUNT(*)` 对齐。
- 清扫面：全仓（`docs/history/` 除外）`qed_learn_` 与 `qe_learn_` 命中为零，或余值逐枚声明为「现名／旧名
  陈述」合法处。

## 回滚

- W2（代码与文档改名）：纯字符串层面替换，回滚＝还原该批 diff，不涉及数据。
- W1/W3（库内 `RENAME`）：反方向 `RENAME TABLE` 即回滚（同名对象必须不存在）；执行前按 ADR 0024 备份档
  做整表 JSON 临时备份，验收后按 ADR 0019 清理。
- W5 判定表：文档面输出，`git diff` 层面回退，无库内影响。

## 关闭与归档

- 关闭条件＝W1~W6 全达成（S 判据逐条对照 todo 行）；W1 到门后人工验收未通过则本壳停在该门，不推进 W2。
- 关闭动作按 `qed-closeout`：todo 行原子移入 completed.md（关闭结果 + 门禁证据），本壳按 Retain 留原位。

## 遗留与移交

- 列形状变更（P4 重叠列收敛、P5 两处 `confirmed` 分工、P6 `learn_course_id` 列名、REQ-119 两枚死列）
  一律只出判定、不在本壳执行；执行另批，并等 Tracker 的 R5 回执窗口。
- 库内一次性数据窗口（W1/W3 的 `RENAME` 与备份）排期与批准归人工，本壳可交付的是脚本、两案择窗清单与回归取证。
- 生产 `qed` 库的七表建表清单随发布批次转人工（W4）。
