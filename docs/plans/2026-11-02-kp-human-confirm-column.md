# 知识点人工确认位落共享主表・「已确认」口径落真（kp-human-confirm-column）

状态：Accepted
任务类型：B
最后更新：2026-11-03
关联 ADR：[ADR 0027](../adr/0027-kp-human-confirm-column.md)（本行唯一决定来源）、
[ADR 0025](../adr/0025-database-design-master-doc-and-ddl-ownership.md)（总纲承载建表语句、逐字对齐）、
[ADR 0024](../adr/0024-preschema-rebuild-tiers-and-demo-gate.md)（重建档位＋B 类壳首工作项 demo 门）、
[ADR 0026](../adr/0026-v1-root-table-family-freeze.md)（本行对其「存在性＝确认态」取向作部分改判，
其 D5 三列与 D6 的 `is_canonical` 判定不动）
关联设计：[database-design.md](../architecture/database-design.md) §五 `qed_knowledge_point`、
[api-contracts.md](../architecture/api-contracts.md) §⑥、
[knowledge-point-exploration-ui.md](../design/frontend/knowledge-point-exploration-ui.md) §8／§10／§11、
[cross-project-contracts.md](../design/cross-project-contracts.md) §6
关联 Tracker：docs/trackers/todo.md（REQ-148 任务行登记在学习设计轮节＝四段收口顺序 ④ 知识探索段的
口径落真承载行；分线归属＝ARCH-027 主链 M4）
归档判定：Retain（确认位列的取值与置位权、存量回填的判据取舍、以及「按 confirmed 过滤会熄灭整面」
这条否决理由，属不可替代的过程记录）

> **用户 2026-11-02 令（本行口径正本）**：「P1-4选择甲」——确认位以共享主表的实列承载；
> 同批令「现在开始梳理并推进任务」。P2-8（措辞与术语正名）按 2026-11-01 的顺序紧随 P1-4 同批做。

## 目标与成功标准

**目标**＝让「已确认」成为一个库内可查、可按列筛的事实，并让学习面的措辞与之对齐：学习者拿到的
全局概念里，「机器整理出来了」与「人已核过」是两件可以被区分、也可以被如实合讲的事。
条目化判据正本在台账行（ADR 0023），本壳只承接拆解与执行；行内 S1~S5 与本壳工作项的对应＝
S1→W2、S2→W3、S3→W4＋W5、S4→W2＋W3、S5→W6（生产交付）＋W1（demo 门）＋门禁。

## 范围与非目标

**范围内**：

- `qed_knowledge_point` 加 `confirm_state`（VARCHAR(16) NOT NULL DEFAULT 'unconfirmed'，闭集
  `unconfirmed`／`confirmed`／`rejected`）——本文逐列、DDL 围栏、代码 DDL、`_POINT_COLUMNS`、
  幂等补列与守护数值**同批**；
- 置位三通路＝`add_point` 直登记落 `confirmed`／`patch_point` 白名单加本列／提升腿按上游
  `af_kp.confirmed` 镜像**只升不降**；机器路径不写 `rejected`；
- 读面口径＝学习面一律排除 `rejected` 其余照画；`counts_by_course` 与星图按确认态分桶，
  星图 course 补 `kp_total`、`kp_confirmed` 改真义；8903 整理度图元改读 `kp_total`；
- P2-8 措辞与术语正名（learner-facing 文案与设计正本）＋ 手册与禁词守护随步；
- 生产 `qed` 库的补列**交付**（命令原文＋核验判据），执行归人工窗口。

**非目标（各给指针）**：

- **习题不入序列的两级闸＝REQ-149**（同批用户令的另一半，零 DDL，单独承载）；
- **多教材知识点融合＝REQ-145**（在途，与本行共触同一段 DDL 文本，须按「前置条件」第 5 条排序）；
- **后台管理·待复核队列的界面**＝本行只把筛选键与计数落到位，队列 UI 另登行（不占用本行 S 判据）；
- `book_ref` 的物理 `DROP COLUMN`＝总纲 §7.8 T13 已定档归人工红线窗，本行不碰；
- 主表 collation 归一（现 `utf8mb4_unicode_ci`）＝总纲 T2 明写另批，本行不碰。

## 现网取证（2026-11-02，只读探针 `tmp/kp_confirm_probe.py` → `tmp/kp_confirm_probe.json`）

| 读数 | 值 |
| --- | --- |
| 梳理侧人工位 `af_kp.confirmed` | b05 352 行、b07 184 行**全部为 0**；`GET …/kp/export`（只给 `confirmed=1`）两本均回 **0 行** |
| 共享主表 `math_analysis` | 93 行＝11 章（outline）＋82 点（point），**93 行全带 `from_detail_id`**＝100% 机器提升 |
| 其余 11 门课 | `total=0` |
| 星图 `kp_confirmed` | 82（现义＝point 行数，与人工确认无关） |
| 提升腿实际消费的键 | `gen_status != 'rejected'` ＋ `toc_role != 'reference'` ＋ depth 分流；**未消费 `confirmed`** |
| 不实陈述落点 | 总纲 §三 总览行「一个**已确认**知识点」、§五「**本表没有人工确认列——能进本表即已确认**」、表注释「一行=一个人工确认的行」、`CourseKnowledge.tsx` 空态「该课程暂无已确认知识点」、`learn.py:806`／`knowledge.py:5-6` docstring |

## 前置条件

1. **库内形状**＝本行只在 `qed_test` 做追加式 ALTER（§7.2），执行前先单表 dump 落
   `dataset/backups/2026-11-02-req148/`；生产 `qed` 库零执行（W6 只交付命令原文）。
2. **表族冻结下的合法路径**＝ADR 0026 D5 已为共享主表追加过三列，形成本行可复用的判例；
   逐字对齐守护要求「本文逐列＋DDL 围栏＋代码」在同一次改动内一致，**分批改即红**。
3. **8900 不热重载**＝新响应键要重启才出；REQ-147 的 `truncated` 同样在等重启窗口，两枚共窗，
   重启归人工批准（不擅动并行窗口的共享服务）。**2026-11-03 用户已重启**，复采读数见「过程与证据」。
4. **并行行 REQ-146 未编码**＝本行与它在提升腿无交叠（本行只加列与置位，其 S1 在 8902 结构面）。
5. **与 REQ-145 的先后**＝REQ-145 承诺本轮零 DDL、只写 `meta` 三键；本行改 DDL 文本。
   两批不得同时改 `CREATE_TABLE_SQL`——**谁先合入谁改围栏，另一批 rebase 后同批复验逐字对齐**。
6. **待裁点**＝本壳无待裁项：形态、取值、回填与生产窗口归属已由 ADR 0027 D1~D8 写定。

## 工作项

| # | 工作项 | 状态 |
| --- | --- | --- |
| W1 | **demo 门＝一行从机器提升到人工背书的端到端最小通路**：临时库内跑一次提升（或直登记）使行落 `unconfirmed` → `PATCH` 置 `confirmed` → `GET /learn/star-map` 的 `kp_total` 与 `kp_confirmed` 各读出真值 → `GET …/knowledge-points` 里 `rejected` 行不出现；用例先红后绿（一条端到端＋两枚读数），到门暂停待人工验收 | **已到门并人工验收通过 2026-11-03**（`test_demo_gate_machine_to_human_end_to_end` 全链绿＋突变验证见「过程与证据」；8900 重启后现网复采 `math_analysis` 的 `(kp_total, kp_confirmed)=(82, 0)`，与库内 82 个 point 行全 `unconfirmed` 对拍一致） |
| W2 | **形状与守护同批**：总纲 §三 总览行（25→26 列、删「不存确认位」句）＋§五 逐列新增 `confirm_state` 行＋DDL 围栏＋注释节改判，代码 `CREATE_TABLE_SQL`／`_POINT_COLUMNS`／`ensure_columns()`（`information_schema` 探查后幂等 ALTER ADD COLUMN，绝不隐式 DROP）同批改；`qed_test` 备份→ALTER→`information_schema` 实查读数记入本壳；存量 93 行落 `unconfirmed` 的读数与上游 `confirmed` 全 0 对拍（零回填脚本） | **已实施 2026-11-03**（S1＋S4 取证见「过程与证据」） |
| W3 | **写侧三通路**：`add_point` 落 `confirmed`；`patch_point` 白名单加本列（闭集外 422，且 `confirmed`→…→`rejected` 人工可翻案）；`PointCreateBody`／`PointPatchBody` 随步；提升腿按 `af_kp.confirmed` 镜像且**只升不降**（`confirmed` 不被机器降回 `unconfirmed`），机器路径永不算 `rejected`；`tests/test_learn_knowledge.py` 的列数守护（25→26）、D1/D10 退场守护（「`confirmed` 键不得出现」的旧断言按新形状重写）、白名单用例同批改值，先红后绿 | **已实施 2026-11-03**（S2 取证见「过程与证据」；端到端 demo 门仍属 W1，待 W4 出键） |
| W4 | **读面口径与分桶**：`list_points`／`list_outline` 学习面判据＝`confirm_state != 'rejected'`；`counts_by_course` 按确认态分桶；星图 course 补 `kp_total` ＋ `kp_confirmed` 改真义（现网读数 0）；`GET /learn/search` 同步排除；`api-contracts.md` §⑥ 随步（含 `PATCH` 白名单取值与两键语义）；`cross-project-contracts.md` §6 登记「提升范围按在册、人工位以镜像带入」以消解与「只提升 `confirmed=1`」的表述分歧 | **已实施 2026-11-03**（S3 取证见「过程与证据」。落码时更正本行一处事实错＝本仓无 `/learn/search` 端点，检索面实为 `GET /learn/knowledge-points?q=`，按该端点落 `exclude_rejected`） |
| W5 | **8903 消费与措辞正名（P2-8）**：整理度图元与悬停计数改读 `kpTotal`；空态「该课程暂无已确认知识点」→「该课程暂无已整理知识点」；学习面图元称呼统一「章节／知识点」，「大知识点／小知识点」在设计正本 §8／§10／§11 与代码注释里退为历史称呼；`help/sections.ts` 与 `helpPages.test.ts` 禁词表随步（knowledge 册已纳入扫描，改钉新词）；`Knowledge.test.tsx`／`CourseKnowledge.test.tsx` 既有禁现词用例同步 | **已实施 2026-11-03**（真机读数见「过程与证据」；三档宽度真机不可达，已如实登记） |
| W6 | **生产库交付（不执行）**：按 §7.5 四步出命令原文——单表 dump（`mysqldump` 需全路径＋`MYSQL_PWD`）→ `ALTER TABLE qed_knowledge_point ADD COLUMN confirm_state VARCHAR(16) NOT NULL DEFAULT 'unconfirmed' COMMENT '…'` → `information_schema.COLUMNS` 核验名称·类型·可空性·默认值 → 冒烟（三端点 200＋行数与分桶读数）；判据与「谁执行」写进本壳「遗留与移交」 | **交付已优化 2026-11-03**（六步：前置探查→先停 8900→dump 先行→按需 ALTER→动态行数对拍→起服冒烟；含幂等重跑判据，落「遗留与移交」；**执行归人工窗口，本行关闭不前置实际执行**） |
| W7 | **正本收口随步**：`frontend-overview.md` 与 `knowledge-point-exploration-ui.md` 的确认态表述、`code-map.md` 映射行、`docs/design/index.md` 描述句；总纲 §八 守护数值与 §7.8 新行 T14 定档 | **已实施 2026-11-03**（三面随步与 `frontend-architecture.md` 描述句见 W5 证据条；§八 守护数值由 `pytest tests/contract` 的逐字对齐与列数守护覆盖，T14 措辞按实际窗口进度定档） |
| W8 | **梳理屏确认入口（F1-1，用户 2026-11-03 裁由本行承载）**：知识点详情面加一枚「确认知识点」与一枚「撤回确认」，按下经 8900 **已在册**的 `POST …/kp/nodes/{node_id}/confirm` 透传写 `af_kp.confirmed`（零新端点、零新列），成功后回读工作区并在目录行与详情面各出确认态；共享表的 `confirm_state` 仍只由 W3 的镜像腿只升不降带入，屏侧不直写共享表。落点前置实核＝该枚 confirm 端点在现网路由在册且未被 8900 透传降级；缺入口的四段断链取证正文见 [REQ-151 壳](2026-11-03-kp-curation-module-master-task.md) 的「现网取证」F1-1 行 | 未开始（前置＝W1 人工验收，2026-11-03 已满足；`kpReview.ts` 本批放行范围外，待下一批次） |
| W9 | **未定位目录行的改锚入口（F1-4，同批裁决）**：锚落在书自身目录页的目录行（DEFECT-027 那批现网读数）在屏上选中时中栏显示目录页而非正文，唯一修法今天挂在已被撤下入口的编辑态里＝不可达。本件给一枚**人工补锚**通路＝详情面「所属页」可改。落点已由只读实核定死＝`PATCH …/kp/nodes/{node_id}` 的请求模型 `KpNodePatch` 里有 `anchors`（`Axiom-Flow/src/axiom_flow/schemas.py:813`，整节点声明语义＝该键出现即替换该行的锚集合），锚形状＝`{kind, ref_id, page, block_indexes, snippet}`（`KA-18`：`page` 用 PDF 页序、`block_indexes` 属该行 `job_id` 那一版的块序空间）；根侧该条透传已在册（`backend/qed_engine/api/axiom.py` 的 kp 面）⇒ **零新端点、零 DDL、不改对方请求模型**。并发按同口径带 `if_rev`，撞号 409 不静默覆盖。改后中栏按新锚派生页区间，落共享表时由提升腿按新锚重算页窗。判据边界＝「印刷页码永不进锚」与对方 `KA-33` 一字不动、零写库批量重跑；补锚后是否仍需目录腿重跑才刷新属对方读面，若成立由 REQ-151 出函登记 | 未开始（落点与请求模型已实核定死，零新端点／零 DDL；待下一批次放行） |

## 过程与证据

- 2026-11-02｜立项（用户令「P1-4选择甲」＋「现在开始梳理并推进任务」）：决定已落
  [ADR 0027](../adr/0027-kp-human-confirm-column.md)（D1 列形／D2 置位权／D3 读面判据／
  D4 两键分桶／D5 措辞与术语正名／D6 零回填脚本／D7 执行编排／D8 对 ADR 0026 的部分改判）；
  现网取证三项由只读探针取得（全程 GET，零写库、零 DDL、零 dataset 触碰）；
  **关键取证**＝上游 `af_kp.confirmed` 现网全 0 且 `/kp/export` 回 0 行，这是 D3「不按 confirmed
  过滤学习面」与 D6「存量落 unconfirmed、零回填」两条的直接依据——若按 confirmed 过滤，
  REQ-147 W1 刚点亮的整理度图元会整体熄灭（82→0）。
- 2026-11-02｜**正本随步（先于动码，D5/D4 的口径落三份非 DDL 正本）**：
  `api-contracts.md` §⑥ 五处改完（序列化形状 25→26 列并出 `confirm_state`／星图两键分桶／
  `POST` 直登记落 `confirmed`／`PATCH` 白名单加本列／`GET` 检索与 `PUT outline` 的「写入即已确认」旧口径作废），
  每处带「落码状态＝REQ-148 W2/W4 前仍出旧形状」的注记；`knowledge-point-exploration-ui.md` §8 整理度
  承载键改 `kp_total`＋词义分工、§10 空态行改「已整理」并钉 D3 判据、§11 悬停回归判据随步＋§9 称呼对照
  （「大知识点／小知识点」登记为历史称呼，正文统一改写留 W5 与代码同批）；
  `cross-project-contracts.md` §6 消解「只提升 `confirmed=1`」旧表述＝提升范围按在册、人工位以镜像带入。
  **总纲 `database-design.md` 的 §三 总览行／§五 逐列与 DDL 围栏／§八 守护数值未动**——逐字对齐守护
  （ADR 0025）要求本文逐列＋围栏＋代码 DDL＋`_POINT_COLUMNS`＋守护数值在同一次改动内一致，
  分批改即红，故整块随 W2 落；契约门禁 `pytest tests/contract -q` 在随步后 89 passed 全绿。
- 2026-11-03｜**W2 落码＋`qed_test` 补列窗口执行**（用户点名授权「授权 agent 在 qed_test 执行」，
  目标库经脚本内 `qed_db_name != "qed_test"` 即拒的守卫确认，生产 `qed` 零触碰）：代码侧
  `CREATE_TABLE_SQL` 以**字面量**追加本列（ADR 0025 的逐字渲染守护只替换 `PROVIDER_COMMENT`／
  `META_COMMENT`，第三枚占位符即红）、`_POINT_COLUMNS` 25→26、新增 `_create_column_ddl()` 从建表
  语句反取列原文作 ALTER 片段（建表与补列不各写一份）、`ensure_columns()` 按 `information_schema.COLUMNS`
  探查后幂等 `ADD COLUMN`（绝不隐式 DROP），`ensure_tables()` 建表后调它；本文 §三 总览行／§五 逐列／
  DDL 围栏／注释节存量与列序／§6.1 跨项目口径／§7.8 T14 同批随步。
  **库内取证**（`tmp/req148_probe_confirm_col.py` → `.md`）：补列前 25 列且无本列、93 行 →
  `mysqldump` 单表备份 `dataset/backups/2026-11-02-req148/qed_test-qed_knowledge_point.sql`
  （55585 字节、含 `CREATE TABLE` 与 `Dump completed`、行元组 93＝库内 93，见同目录 `dump-verify.md`）→
  `ensure_columns()` 返回 `['confirm_state']` → 补列后 **26 列**，`confirm_state` 落 ORDINAL_POSITION 26
  （声明序在 `meta` 之后、物理序在 `updated_at` 之后，与本文注释节口径一致）、`varchar(16)`、`null=NO`、
  `default='unconfirmed'`、列注释与 DDL 逐字一致；**分布读数 `unconfirmed`×outline=11＋`unconfirmed`×point=82
  ＝93 行全未确认，零回填脚本成立**；紧随的第二次 `ensure_columns()` 返回 `[]`＝幂等。
  **上游对拍**（`tmp/req148_probe_upstream_confirmed.py`，8902 只读 HTTP、零写库）：17 本中 b05 352 行＋
  b07 184 行在册节点，`confirmed` 非零 **0 枚**，与主表 93 行全 `unconfirmed` 同向（S4）。
- 2026-11-03｜**W3 写侧三通路落码**：`add_point` 默认落 `confirmed`（直登记＝人点这一枚，闭集外抛
  `LearnConflict`）；`patch_point` 白名单加本列，`PointPatchBody` 校验器闭集外 422、显式 `null` 视为不改；
  `PointCreateBody` 不收本字段（置位由动作本身承载，D2①）；提升腿 `_kp_confirmed_upstream()`＋
  `_kp_confirm_mirror()` 只在「上游已背书且主表这行还没背书」时发 `confirmed` 键——不满足即**整键不发**，
  机器永不写回 `unconfirmed`、更不产 `rejected`（D2③ 只升不降）。用例先红后绿（7 failed → 69 passed）：
  列数守护改 26＋本列 DDL 片段断言＋`DROP` 不出现、`test_ensure_columns_backfills_confirm_state_idempotently`
  （假连接核 ALTER 恰一条且片段与 `CREATE_TABLE_SQL` 该行相等）、
  `test_patch_confirm_state_is_the_human_signing_path`（rejected→unconfirmed→confirmed 三段翻案＋`approved` 422）、
  `test_sync_mirrors_upstream_confirm_flag_up_only`（上游置 1 即镜像、二次同步上游清零仍 `confirmed`、
  全程无 `rejected`）。**门禁**：`pytest tests/contract -q` 89 passed（两枚逐字对齐守护由红转绿）、
  `pytest tests/test_learn_knowledge.py tests/test_api.py -q` 203 passed、`ruff check backend tests` 全绿。
- 2026-11-03｜**总纲残留不实陈述清扫**（D5 的文档侧，与 W5 的 UI 侧分头）：`database-design.md` 五处
  「根侧拉取**已确认**行／人工确认后才提升」改判为「拉取**在册**行提升＋人工位随行镜像」——§一 提升面句、
  §三 `af_kp` 总览行、§4.2 知识体系行与血缘段、§4.5 表角色分类行（该行判据同改为「机器写、人可驳回；
  在册且未被驳回即提升」）。`narrative_ref` 注释中的「已确认长文正文」是 AF 侧正文产出语义、改动需两侧
  围栏同步，不在本行范围。§7.8 T14 的承担者措辞按实际窗口进度写为「列形与幂等补列已落码」。
- 2026-11-03｜**W4 读面分桶落码**（取向＝**store 层默认 raw、API 学习面显式排除**）：`list_points`／
  `list_outline` 加 `exclude_rejected` 形参（MySQL 侧 `WHERE confirm_state<>%s`、内存实现逐行同形过滤，
  parity 守护 `_api(InMemory) - _api(MySQL) == set()` 仍绿），`counts_by_course` 改 `SUM(bool)` 双桶出
  `total`／`confirmed`（只数 point 行，章名不数），星图 course 对象补 `kp_total` 并把 `kp_confirmed` 改真义；
  `api/learn.py` 四处学习面读端点（跨课程检索、课内总览、`include_outline`、课程目录树）显式传
  `exclude_rejected=True`，**同步腿三处读保持 raw**——看不见驳回行就无法复用行、也无法做只升不降镜像。
  用例先红后绿（新三枚 `test_star_map_two_keys_tell_two_different_facts`／
  `test_rejected_rows_leave_the_learner_reads`／`test_rejected_points_leave_the_course_sequence`）。
  **契约取证**＝`pytest tests/contract -q` 与 `pytest tests/test_learn_knowledge.py tests/test_api.py` 读数见下一条。
- 2026-11-03｜**W5 前端消费与称呼正名**：`api/learn.ts` 的 course 形状加 `kp_total?`，`starMapLayout.ts`
  取 `kpTotal = course.kp_total ?? course.kp_confirmed`（8900 未重载期回落旧键，整面不熄灭，与「回滚」节一致），
  `StarMapGraph.tsx` 的亮暗分档与悬停计数改读 `kpTotal`；空态文案改「该课程暂无已整理知识点」；
  「大知识点／小知识点」在 `kpTreeLayout.ts`／`KpTreeGraph.tsx`／`CourseKnowledge.tsx`／`api/learn.ts` 与
  三枚测试文件（`KpTreeGraph.test.ts`／`kpTreeLayout.test.ts`／`CourseKnowledge.test.tsx`）全部改为
  「章节／知识点」，设计正本 `knowledge-point-exploration-ui.md` §1／§2／§3／§8／§9／§10／§11 同批改写、
  §9 保留唯一一处历史称呼对照；`frontend-overview.md` 三处「已确认知识点」改「已整理／在册知识点（排除驳回行）」、
  `design/index.md` 与 `frontend-architecture.md` 的课程层描述句随步、`code-map.md` 的 `knowledge.py` 行
  改「在册知识点主数据」并补 `confirm_state`／`ensure_columns()`／两键分桶／`exclude_rejected` 与同步腿保持 raw 的口径。
  `help/sections.ts` 与 `helpPages.test.ts` 经核查**已符合**（正文已是「已整理知识点 N」、禁词表已含「已确认」），零改动。
  **前端门禁**：`npx tsc -b` 无诊断、`npx vitest run --no-file-parallelism` **70 files / 1073 tests passed**、
  `npm run build` 出 `dist/assets/index-DeebX-qa.js`。
  **真机读数**（8903＋8900 在跑，新开页面加 `?v=req148w5` 破缓存，`script[src]` 实测＝
  `/assets/index-DeebX-qa.js` 与 dist 一致）：领域层 12 枚课程节点经 React fiber 实读 `kpTotal`＝
  `math_analysis` **82**、其余 11 门 **0**（旧进程无 `kp_total` 键，走回落腿）——**与改前逐门相等，
  课程卡未变暗**；课程层 `math_analysis` 实读 `layout`＝**11 虚框／82 条目**、canvas 渲染尺寸 1065×1842 CSS px；
  空态以 `?course=complex_analysis` 真机命中，`.kn-empty` 文本＝「该课程暂无已整理知识点」，无图元、无封顶行；
  控制台 error/warn **零条**，XHR 两枚（`/learn/star-map`、`/learn/courses/complex_analysis/knowledge-points`）
  **全部指向 8900 且 200**（ADR 0007 合规，无 8901/8902 直连）。
  **未做真机三档宽度（1600／1200／860）——如实登记**：本视图画布宽的唯一来源是 `Knowledge.tsx` 对
  `.kn-course-body` 的 `ResizeObserver` 实测，内置浏览器视口隐藏时不再投递 RO 回调；实测覆盖
  （`Object.defineProperty(window,'innerWidth')` 三档、以及内联 `el.style.width` 把被观测元素强推到
  1360／1025／720 并 `getBoundingClientRect` 确认已变宽）后 `layout.width` 恒为 1025 **不随之重算**，
  故宽度腿在真机不可验证。宽度行为由单测覆盖（`CourseKnowledge.test.tsx` 断 `data-width=1360` 于
  contentWidth 1400、`kpTreeLayout.test.ts` 按宽推框宽）。本行零几何改动，此项不留作绿色断言。
- 2026-11-03｜**门禁归因（并行会话的在途治理轮，不代改）**：本轮收尾跑 `pytest tests/contract -q` 得
  **6 failed / 88 passed**，六条全部指向另一会话正在推进的 ADR 0029（未跟踪新文件
  `docs/adr/0029-tracker-round-hierarchy-and-row-scope-cap.md` ＋已改的 `test_tracker_governance.py`／
  `task-lifecycle.md`／`todo.md`）＝① `test_local_markdown_links_resolve`（该 ADR 链向尚未存在的
  `plans/2026-11-03-kp-curation-module-master-task.md`）；② `test_todo_plan_rows_exactly_mirror_active_plan_bodies`
  （盘上有两枚 2026-11-03 新壳而无对应 todo 行）；③④⑤ 分层轮／承载轮节与轮次标题叙述的新守护；
  ⑥ 新 `TASK_DESC_MAX_CHARS = 500` 行描述上限同时命中 REQ-130／144／145／148／149／**150**（含非本会话创建的行）。
  本行不代其压缩台账行、不建其缺壳、不改其守护。本会话自身改动面全绿＝
  `pytest tests -q --ignore=tests/contract` **830 passed**、`ruff check backend tests` All checks passed
  （顺手清掉本会话新写用例里一枚未用变量 `kept`，改断 `kp_id` 相等，断言更强）、
  `tests/test_learn_knowledge.py` **72 passed**。
- 2026-11-03｜**W1 demo 门到门**：`test_demo_gate_machine_to_human_end_to_end` 以一次提升腿起链，
  五段读数全经端点取（不读 store 内部）＝提升后 `unconfirmed` 且星图 `(kp_total, kp_confirmed)=(1, 0)`
  → `PATCH confirmed` 后 `(1, 1)` → `PATCH rejected` 后跨课程检索 `total=0` 且 `(0, 0)`
  → `PATCH unconfirmed` 翻案回 `(1, 0)` 且 `kp_id` 全程不变（只动一列，行身份不换）。
  **突变验证**（证明该用例非空转）：把 `api/learn.py:1083` 的 `exclude_rejected=True` 改 `False`
  即 **FAILED**，改回后 `diff` 与备份逐字相等（`RESTORED_IDENTICAL`）、
  `pytest tests/test_learn_knowledge.py tests/test_api.py -q` **207 passed**。
  备份件 `tmp/learn.py.bak-req148` 留本机面不入库。

- 2026-11-03｜**整链审计三条裁决落位（F1-1／F1-4 入本行，F1-2 另登，F2-5 转只读取证）**：
  用户令原文＝「知识点详情有 node_type（章／知识点／习题／其他）F1-1 确认入口 + F1-4 改锚入由
  REQ-148 承载；F1-2 允许修改；F2-5 允许你先出一枚只读探针取证再决定归属」。由此本行新增两枚工作项＝
  **W8**（梳理屏确认入口：走已在册 `POST …/kp/nodes/{node_id}/confirm` 透传写 `af_kp.confirmed`，
  零新端点、零新列、屏侧不直写共享表）与 **W9**（未定位目录行的人工补锚通路：详情面「所属页」可改，
  写入复用已在册工作区写腿；落点已由只读实核定死＝`PATCH …/kp/nodes/{node_id}` 的请求模型 `KpNodePatch` 含 `anchors`（`Axiom-Flow/src/axiom_flow/schemas.py:813`，该键出现即整批替换该行的锚集合）⇒ 零新端点、零 DDL、不改对方请求模型）。
  F1-2（四分类键 `type` 无生产者：AF 内容批把回包里的 `type` 随「不新建点行」一并丢弃、根侧提升字段集也不带它，质性门因此对现网点行永不生效；`node_type` 那枚四值标签另形，已由对方 `KA-44` 读时派生并在屏上出）由用户「允许修改」另登
  [REQ-152 壳](2026-11-03-kp-type-production-and-carry-chain.md)，不在本行扩写；
  F2-5（重解析 `supersede` 与 `confirmed` 是否并存）转只读探针取证，归属待裁，
  取证落 [REQ-151 壳](2026-11-03-kp-curation-module-master-task.md)；
  缺入口的四段断链正文同见该壳「现网取证」。
  **S 列不扩写**＝本行「成功标准」列逐字节不动（ADR 0029 L6，一列两正文即漂移），W8／W9 的判据
  只落本壳 W 行；先例＝REQ-143 行「新判据只进壳的 W 行、不挤行内固定判据列」。
  本轮零代码改动（docs-only）：动码待「开始执行」，AF 侧改码授权不随本裁决自动延伸。

- 2026-11-03｜**后端纪律审计＋8900 重启后现网复采（关闭批）**：按 ADR 0027 D1~D8 与 ADR 0028 G1／G3
  逐条核对实现，结论＝纪律成立，另修正一处 D3 漏项：
  ① **D1 列形**＝`COMMENT` 与列定义以字面量写在 `CREATE_TABLE_SQL`，`_create_column_ddl()` 从建表语句
  反取 ALTER 片段（不各写一份），`ensure_columns()` 只做 `information_schema` 探查＋`ADD COLUMN`，
  全仓无本列 `DROP`；契约逐字对齐守护绿。② **D2 置位三通路**＝`add_point` 默认 `CONFIRM_CONFIRMED`、
  `patch_point` 白名单＋闭集外 422、提升腿 `_kp_confirm_mirror()` 仅在上游已背书且本行未背书时发键
  （只升不降，机器零 `rejected`）；三路各有回归用例。③ **D3 学习面**＝四处学习面读端点显式
  `exclude_rejected=True`、同步腿三处保持 raw；`_course_tree()` 的章下计数因读的是已过滤集合同向成立。
  **审计修出的漏项**＝`GET …/outline` 的 `point_count` 在 MySQL 与内存两个 store 里原按全量 point 行计数，
  驳回行会残留在章节计数里（列表已不画、计数仍数）——两处同批改为 `confirm_state<>'rejected'`，
  补回归用例（驳回后章计数 1→1、驳回行不计），`api-contracts.md` §⑥ 该行同步写明判据。
  **边界观察（不改）**＝`GET …/knowledge-points/{kp_id}/narrative` 按 ID 直取无驳回闸，属 D3 枚举三面
  （两级视图／课程序列／检索）之外的单行取用面，且驳回 ID 从任何学习面不可发现，保持原样并在此留痕。
  ④ **D4 分桶**＝`counts_by_course` 只数 point 行并双桶，星图 course 出 `kp_total`／`kp_confirmed`。
  ⑤ **D6 零回填**＝`qed_test` 93 行全 `unconfirmed`。⑥ **D7 生产归人工**＝本壳只交付命令，见「遗留与移交」。
  **现网复采（8900 已于本次重启）**＝学习面行 26 列且带 `confirm_state`；`math_analysis` 列表
  `total=93`（82 point＋11 outline）与星图 `(kp_total, kp_confirmed)=(82, 0)` 互洽；同步腿幂等
  （新增／删除 0）且 `excluded` 四键可读（与 REQ-149 W4 同一批读数）。
  **门禁**＝根全量 925 passed、`tests/contract` 94 passed、`ruff check backend tests`
  全绿；前端 `npx tsc -b` 净、`npx vitest run --no-file-parallelism` 1073 passed、`npm run build`
  出 `index-DeebX-qa.js` 并经 8903 真机复采（课程层 11 虚框／82 条目、请求全指 8900、控制台零错）。
  用户人工验收通过（「我基本同意验收，大体上没有什么问题（知识探索）」）。
## 遗留与移交

- **W6＝生产 `qed` 库补列，归人工窗口执行（agent 零执行）**。口令只经环境变量注入子进程，
  不进命令行、不进日志、不落文件；六步按**先探查、先停服、先备份**的次序执行（次序本身是 D7 判据，
  见第 1 步的成因）：
  0. **前置探查（只读）**——列是否已在、存量行数 N、以及 8900 是否已停：
     `SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='qed' AND TABLE_NAME='qed_knowledge_point' AND COLUMN_NAME='confirm_state';`
     `SELECT COUNT(*) FROM qed.qed_knowledge_point;`
     停服判定＝`netstat -ano | findstr :8900` 无监听（或 `GET http://127.0.0.1:8900/services` 不可达）。
     **列已存在** ⇒ 跳过第 2、3 步，只做第 4、5 步（幂等重跑口径）。
  1. **先停 8900**——新代码的 `ensure_columns()` 在首个知识点请求时自愈补列；若先起新进程，
     补列会在**没有备份**的情况下自动发生（免了备份就是红线，ADR 0027 D7）。停服归人工窗口。
  2. **备份**（先建目录再 dump，dump 完必须看到 `CREATE TABLE` 与收尾 `Dump completed`，
     行元组数与第 0 步的 N 相等）：
     `mkdir dataset\backups\2026-11-03-req148-prod` ＋ PowerShell `$env:MYSQL_PWD = '<生产库口令>'` ＋
     `"C:/Program Files/MySQL/MySQL Server 8.0/bin/mysqldump.exe" --host=127.0.0.1 --port=3306 --user=root --single-transaction --no-tablespaces --default-character-set=utf8mb4 qed qed_knowledge_point > dataset\backups\2026-11-03-req148-prod\qed-qed_knowledge_point.sql`；
  3. **补列**（追加式，`AFTER` 不写＝落物理末位，与 `qed_test` 已执行形状一致；注释必须与
     `CREATE_TABLE_SQL` 该行**逐字**一致，否则总纲 DDL 围栏逐字对齐守护即红）：
     `ALTER TABLE qed_knowledge_point ADD COLUMN confirm_state VARCHAR(16) NOT NULL DEFAULT 'unconfirmed' COMMENT '人工确认位 闭集 unconfirmed/confirmed/rejected（人背书位；提升腿按上游 af_kp.confirmed 镜像只升不降，机器路径不写 rejected）';`；
  4. **核验（五项齐读＋动态对拍）**：
     `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='qed' AND TABLE_NAME='qed_knowledge_point' AND COLUMN_NAME='confirm_state';`
     ＋ 存量分布 `SELECT confirm_state, node_kind, COUNT(*) FROM qed.qed_knowledge_point GROUP BY 1,2;`
     判据＝**总行数等于第 0 步的 N 且逐行落 `unconfirmed`**，`outline`／`point` 两组行数与补列前逐值相等
     （零回填；不写死 93，生产库行数可能与 `qed_test` 不同）；
  5. **起 8900 并冒烟**：`GET /api/v1/learn/star-map` 出 `kp_total` 与 `kp_confirmed` 两键
     （判据＝`kp_total` 等于该课 point 行数、`kp_confirmed=0`）、`GET /api/v1/learn/knowledge-points` 200、
     `PATCH …/{kp_id}` 闭集外取值 422。
  **谁执行**＝用户（人工窗口）；**何时**＝在 8900 重启到新代码**之前**完成第 2~4 步，再起服走第 5 步
  （新键 `kp_total`／REQ-147 的 `truncated` 与新代码同批出）。`ensure_columns()` 的幂等补列只是兜底自愈，
  不得充当生产库的唯一执行路径。
- **8900 重启窗口已于 2026-11-03 打开**：运行进程已载新码，学习面行 26 列带 `confirm_state`、
  星图两键与 `truncated`、`excluded` 四键均现网可读（读数见「过程与证据」）。8903 的
  `kp_total ?? kp_confirmed` 回落腿保留为降级防御，不再是常态路径。
- **总纲 §7.8 T14 已随步**，生产执行完成后由人工把该行状态改到「已执行」，本壳关闭时只认领「交付已成型」。
- `database-design.md` 的 `node_kind` 逐列句、DDL 注释与代码 DDL 已于 2026-11-03 同批改到
  「outline＝目录节点（章节）／point＝知识点（序列永不含习题行，ADR 0028 G1）」，逐字对齐守护绿；
  两侧围栏同步完成，此条不再留尾。

## 验证与验收

- 后端：`D:/software/anaconda3/envs/QED_env/python.exe -m pytest tests/test_learn_knowledge.py -q`
  先红后绿；收尾跑 `pytest tests -q` ＋ `pytest tests/contract -q` ＋ `ruff check backend tests`
  （逐字对齐守护在 W2/W3 同批改后必须绿）；
- 库内：`information_schema` 实查读数（列名·类型·可空性·默认值）＋ 存量 93 行的 `confirm_state`
  分布计数，记入本壳「过程与证据」；
- 前端：在 `web-ui/` 内串行跑 `npx tsc -b`、`npx vitest run --no-file-parallelism`、`npm run build`；
- demo 门（ADR 0024 决定 2）＝W1 的端到端读数到门暂停待人工验收；
- 真机验证按 `qed-frontend-check`：`npm run build` 后比对 8903 返回的 `assets/index-*.js` 哈希，
  加 `?v=` 破缓存，1600／1200／860 三档实测整理度图元**读数与改前相等**（本行不得让课程卡变暗）。

## 回滚

- W2 属形状：列可留不读（追加式，读侧回旧 SELECT 即回旧行为）；代码侧 revert 对应提交即回旧 DDL，
  库内列残留无害（默认值恒定 `unconfirmed`，零消费方）；`DROP COLUMN` 属破坏性变更，不做；
- W3／W4 属写侧与读侧判据：revert 即回「存在性＝确认态」旧口径；`kp_total` 键缺失时前端读
  `undefined` 落旧 `kpConfirmed` 分支（不静默熄灭）；
- W5 属文案：revert 回旧措辞；
- 本行不做数据搬迁、不删行、不动 `book_ref` 与 collation，无库内容回滚面。

## 关闭与归档

S1~S5 逐条对照台账行关闭（ADR 0023）：S1~S4 由 2026-11-03 的库内与现网读数逐条兑现（见「过程与证据」），
S5 的判据是「命令原文与核验判据已交付并登记」——**W6 生产库执行不在本行关闭前置内**，实际执行属人工窗口，
未执行即随批移交（登记在「遗留与移交」，并同步总纲 §7.8 新行）。
**本行当前不关闭**：W8（梳理屏确认入口）与 W9（未定位目录行的补锚入口）在册且未开始，行状态保持
`Accepted`；其前置（W1 人工验收）已于 2026-11-03 满足，待下一批次放行后实施，
两件的判据只落本壳 W 行、不挤行内固定 S 判据（ADR 0029 L6，先例 REQ-143）。归档判定 Retain。
