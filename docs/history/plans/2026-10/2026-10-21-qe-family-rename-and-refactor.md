# `qe_*` 族表名定档去 `learn_` 段与逐表重构梳理轮（qe-family-rename-and-refactor）

状态：Closed（Achieved，2026-10-23 收口：S1~S5 逐条全达成，其中 S2／S5 的达成经**上游改判**（ADR 0026 D1~D3 三张定档＋生产库零表）成立，取代关系已在「过程与证据」2026-10-23 条写明；判 Retain 归档）
任务类型：B
最后更新：2026-10-23
关联 ADR：[ADR 0025](../../../adr/0025-database-design-master-doc-and-ddl-ownership.md)（前缀即所有权、根侧九表建表语句进总纲并逐字对齐守护）、[ADR 0024](../../../adr/0024-preschema-rebuild-tiers-and-demo-gate.md)（demo 门与 1.0 前 schema 分档）、[ADR 0009](../../adr/v0.1/0009-shared-qed-tables.md)（共享 `qed_*` 表族边界）
关联设计：[database-design.md](../../../architecture/database-design.md)（表名与建表语句正本、R1 前缀规则）、[cross-project-contracts.md](../../../design/cross-project-contracts.md)（schema 变更顺序）、[frontend-architecture.md](../../../architecture/frontend-architecture.md)（8903 学习三面读面）
关联 Tracker：docs/trackers/todo.md（REQ-132 登记，普通任务轮 ARCH-035 节；**2026-10-23 该行已原子移出 todo、关闭结果 `Achieved` 写入 [completed.md](../../../trackers/completed.md)**）；前序＝[REQ-120 壳](2026-10-16-root-private-prefix-and-four-part-design.md)（其 W3 一次改名与 W4 目标名按本壳改判；该壳同日同批收口）
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

**成功标准正本在台账行**（[ADR 0023](../../../adr/0023-todo-row-carries-scope-and-criteria.md)）：逐条对照
todo.md `REQ-132` 行「成功标准」列，本壳不复制判据。

## 命名定档（用户裁决承载）

| 库内现名（`qed_test`） | 改名前代码名 | **目标名** | 行数实测 | 定档理由 |
| --- | --- | --- | --- | --- |
| `qed_learn_course` | `qe_learn_course` | **`qe_course_state`** | 新 2／旧 2 | 去 `learn_` 后本表欲取 `qe_course`，与共享课程目录表 `qed_course` 的目标名同名；两表形状完全不同（17 列目录 vs 16 列学习容器），故学习侧让名、取 `qe_course_state` |
| `qed_learn_unit` | `qe_learn_unit` | `qe_unit` | 新 95／旧 95 | 直接去段，无撞名 |
| `qed_learn_unit_progress` | `qe_learn_unit_progress` | `qe_unit_progress` | 新 0／旧 2 | 同上 |
| `qed_learn_kp_detail` | `qe_learn_kp_detail` | `qe_kp_detail` | 新 1／旧 3 | 与共享 `qed_knowledge_point` 的目标名 `qe_knowledge_point` 不撞名，但列级高度重叠，重叠判定见 W5 |
| `qed_learn_question` | `qe_learn_question` | `qe_question` | 仅旧名 2 | **只有旧名**，代码只读新名 ⇒ 现网不可见（W1 demo 面对象） |
| `qed_learn_attempt` | `qe_learn_attempt` | `qe_attempt` | 仅旧名 6 | 同上 |
| `qed_learn_review_task` | `qe_learn_review_task` | `qe_review_task` | 仅旧名 3 | 同上 |

**本表的效力状态（2026-10-23 收口时补，原文逐行不改写）**：表内七枚目标名只有练习两枚（`qe_question`／
`qe_attempt`）最终以本表所定之名实存；其余五枚的去向＝`qe_course_state`／`qe_unit`／`qe_unit_progress`／
`qe_kp_detail` **四枚从未实存即随 ADR 0026 D1~D3 的三张定档整表退役**（其有效信息合并进 `qe_learning` 单表），
`qe_review_task` 曾按本表于 2026-10-21 `RENAME` 实存、后随 D3（调度态改作答流水重放派生）`DROP`。
本表因此**不再是命名正本**，v1.0 命名正本＝总纲 §三 与 [REQ-137 归档壳](2026-10-21-v1-root-table-family-freeze.md)；
本表保留的价值＝登记「一次改名 → 二次改名 → 三张定档」这条改判链上每一跳当时的定档理由与撞名处置。

**不随改名**：四张共享表 `qed_domain`／`qed_course`／`qed_knowledge_point`／`qed_llm_calls` 保持 `qed_`
前缀（用户当轮裁决「只改根私有七表」），R1「前缀即所有权＝`qed_*` 共享／`qe_*` 根私有」不破坏，
**本批改判不需新 ADR**；[ADR 0025](../../../adr/0025-database-design-master-doc-and-ddl-ownership.md) 决定 2
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
- 不改共享四表前缀，不改 `qt_*`／`af_*` 任何表名（`af_*` 族另见 [REQ-136](../../../plans/2026-10-21-af-family-rebuild-consolidated-request.md)，原 REQ-133 已并入该综合请求）。
- 不在本批（W1~W6 改名轮）动列与表的存在性：**判定已于 W5 出**（见「W5 逐表判定表」节），但执行不落在
  本壳判据内——本行 S1~S5 只覆盖改名、逐字随步与判定表成文，**废表／并层／删列的执行须另立一行承载**
  （成功标准冻结，ADR 0023；扩载须改判，故不擅自并入本行）。两枚共享表死列
  （`qed_domain.path_results`／`qed_course.related_targets`）仍归 REQ-119 R5 由 Tracker 执行；
  `learn_course_id` 列名是否随动本轮未裁，继续挂待裁。
- 不在生产库执行任何 DDL；库内迁移窗口（D 类）的排期与批准归人工。

## 在册问题（W5 判定表的既有输入，2026-10-21 探索取证）

| # | 问题 | 实测事实 |
| --- | --- | --- |
| P1 | 新旧名 11 张并存 | **2026-10-21 W2 后复测**＝`qed_test` 内本族 11 张：旧名四张（`qed_learn_course` 2／`qed_learn_unit` 95／`qed_learn_unit_progress` 2／`qed_learn_kp_detail` 3 行）＋作废名四张（`qe_learn_course` 2／`qe_learn_unit` 95／`qe_learn_unit_progress` 0／`qe_learn_kp_detail` 1 行）＋目标名三张（练习三表 W1 已归一）；目标名四张尚未实存。`tmp/req120_bak` 不存在＝一次改名批次从未执行 |
| P2 | 练习三表数据不可见 | **已消**（W1）＝`qed_learn_question` 2／`qed_learn_attempt` 6／`qed_learn_review_task` 3 由 `RENAME TABLE` 改为目标名，2026-10-21 真机三链读到 2／6／3 行在面可见 |
| P3 | 排序规则分裂 | 旧名四张与 `qed_knowledge_point` 库里仍 `utf8mb4_unicode_ci`，代码声明已改 `utf8mb4_0900_ai_ci`；**新事实**＝`RENAME TABLE` 不改存量表 collation，故练习三表虽已是目标名，物理 collation 仍是 `utf8mb4_unicode_ci` ⇒ 「改名完成」不等于「形状归一完成」 |
| P4 | 两表列级高度重叠 | `qe_learn_kp_detail` 23 列与 `qed_knowledge_point` 22 列共用 `domain_id`/`course_id`/`kp_id`/`parent_kp_id`/`norm_key`/`anchors`/`book_ref`/`type`/`name`，并互为 `from_detail_id` ↔ `dedup_of` 双向引用 |
| P5 | `confirmed` 两处并存 | `qe_learn_unit.confirmed` 与 `qe_learn_kp_detail.confirmed` 皆 `tinyint`，与「主表只存已确认知识点」口径的分工需成文 |
| P6 | 主键列名带子域 | `learn_course_id` 在四张表出现（`qe_learn_course`/`unit`/`unit_progress`/`question`），去 `learn_` 后列名是否随动待裁 |
| P7 | 生产库零根私有表 | 生产 `qed` 库七张一张都没有 ⇒ 上线面是全量建表清单而非改名清单 |

P1~P7 的逐条判定见「W5 逐表判定表」节（2026-10-21 用户裁决定档）：**P4 与 P5 由知识点池整表废弃一并消解**
（重叠列不再收敛，而是随池退出；确认位归 `qe_unit.confirmed` 与 AF 侧 `confirmed` 两处、各处一域）；
P2 已消（W1）；P1 的归一批次随退表简化——`qed_learn_kp_detail`／`qe_learn_kp_detail` 两组**不迁不重命名，
直接备份后退出**；P6（`learn_course_id` 列名）本轮未裁；P3 的 collation 归一仍待排；P7 的上线清单按六表出。

## W5 逐表判定表（2026-10-21 用户裁决定档）

> **本节读法（2026-10-21 同日升级）**：本表的**逐枚取证读数与分工前提仍然有效**，但表数结论已被
> [ADR 0026](../../../adr/0026-v1-root-table-family-freeze.md) 吸收并升级——四枚判定中三枚升为**整表退出**，
> 本族定档由「六张」改判为**三张**（`qe_learning`／`qe_question`／`qe_attempt`），执行归
> [REQ-137](2026-10-21-v1-root-table-family-freeze.md)。逐列级新正本在 REQ-137 壳，本表不再更新。

**判定前提（分工改判）**：知识点梳理的工作区与候选池正本**整体归 Axiom-Flow**（其 `af_kp` 单表已自持
`gen_status`／`confirmed`／`gen_batch`／`anchors`／`narrative_ref`，覆盖本族池的全部职责）；根侧只保留
「**拉取确认行 → 提升进共享主表**」这一段与管理台的读面门面。第一性原理下根侧不可约的四件事实＝已确认
知识点的读面正本（共享 `qed_knowledge_point`）、学习者侧事实、练习侧事实、调用账；**知识的生产和候选不属于根侧**。

| 表 | 新分工下的职责 | 判定 | 依据（取证锚点） | 代价 |
| --- | --- | --- | --- | --- |
| `qe_kp_detail` | 无 | **废弃整表**（根私有七表 → 六表） | 池的每一项职责都在 `af_kp` 有对应列；提升作业丢弃 8 列（`intent`／`payload`／`gen_batch`／`map_seed`／`model_ref`／`gen_status`／`dedup_of`／`confirmed`，见 `services/learn/knowledge.py:349-375`）；`map_seed`／`dedup_of`／`book_ref` 全仓零读、`confirmed` 从无 `WHERE` 命中；`qed_test` 内两组 3／1 行、生产 `qed` 库零行 | 8903 右栏「批注与候选」闭环失去落点：`POST /learn/kp-details`、`/kp-details/{id}/like`、`/annotations/generate` 三端点与 `components/learning/AnnotationPane.tsx` 须改读 8902 透传或随梳理屏重建（属界面改判，不属数据丢失） |
| `qed_knowledge_point`（共享，列在此只为锚定提升面） | 已确认知识点唯一读面正本 | **保留**，`from_detail_id` 语义改指 AF 节点 | 该列现注释「溯源 `qe_kp_detail`」；池退出后其语义（提升来源明细）直接平移到 AF 的 `node_id` | 列注释与代码 DDL **逐字对齐**，须与代码同批改（W2 判例）；执行前本文不改注释原文 |
| `qe_unit` | 学习序列（`unit` 块行 + `point` 勾选锚行） | **保留，`level='section'` 层收敛到知识点层级** | `section` 与主表 `node_kind='outline'` 行存同一章节结构＝重复承载而非引用（违总纲 R5「只引用不复制」的取向）；`point` 行职责不同、不是第二份内容——它只在首次落笔时物化勾选/判定锚（`services/learn/base.py:428-467`） | 改判触达三处：`PUT /learn/courses/{id}/syllabus` 写整树、编译产树、`GET …/units` 读面；且 `putSyllabus`／`patchLearnUnit` 在 8903 **已无调用方**（`web-ui/src/api/learn.ts:667/688` 只有定义），改判不受现网扰动 |
| `qe_unit_progress` | 一单元终态 + 质性门判定四列 | **保留独立**（并表一问本轮未裁） | 分表理由「重编译换代不丢学习记录」仍成立（`qe_unit.active` 位会换代）；本轮四问未含此项，不作默认采纳 | 若后续并表，须先把作用域键从 `unit_id` 改到跨编译稳定的 `kp_id`，否则换代即丢判定 |
| `qe_question` | 一道题或一张卡 | **保留** | 题/事实/调度三种生命周期不同，压缩无收益；`kp_id` 只作归属标签（REQ-106 裁决） | — |
| `qe_attempt` | 一次作答事实 | **保留** | 掌握门唯一数据源，全量保留不合并 | — |
| `qe_review_task` | 调度态 | **保留，`target_kind='kp'` 粒度删** | kp 粒度行到前端只渲染**不可作答的占位卡**（`web-ui/src/components/practice/ChapterPractice.tsx:43-50`），`due_counts_by_kp` 的复习腿因此是空转计数 | v2 若要「按知识点推题」需重新引入该粒度；现网仅 1 行 kp 目标（`tmp/backup/qed_test_premerge_20261017.sql:469` 快照） |
| `qe_course_state` | 一门学习课的注册 + 编译作业态 | **保留，八枚死列删** | `failure_count` 只写初值与复位、全仓无累加点；`instructions`／`agent_notes`／`direction` 只写不读、仅随整行透传无渲染点；`page_windows`／`compile_fingerprint` 的读面 drift 只贴 `level='unit'` 行而 8903 只请求 `point`；`compile_done`／`compile_total` 唯一读端点（`api/learn.py:669-670`）在前端无调用方 | 删列即删预留：真接双通道指令与熔断计数时要走 ALTER（1.0 前重建档位，代价低，本文 7.3） |

**净结果**：根私有 **7 → 6 张**（`qe_kp_detail` 退出）、列级摘除 **8 枚**（全在 `qe_course_state`）、
层级面 `qe_unit` 去 `section` 层、调度面 `qe_review_task` 去 `kp` 粒度；总纲 §三 正本表数 21 → 20
（那是**本文表集合陈述**的数值，不是 `qed_test` 库内 `SHOW TABLES` 读数——库内三组名并存见 7.8 T2）。

**「判定＋执行同批」的读法（用户裁决原选项，此处定义死）**：＝判定与执行**排同一窗口、不分两轮评审**，
**不是**「本壳就地执行」。执行交付物仍须另立 todo 行承载——本行成功标准 S1~S5 只覆盖改名，扩载须改判
（ADR 0023），清单与并窗要求见「遗留与移交」第 5 条。

**同步回来的最小契约（本轮定档，四条）**：

| ID | 守则 | 理由 | 落点 |
| --- | --- | --- | --- |
| K1 | 根侧**只读** AF 的只读导出端点取确认行，端点形状归 Axiom-Flow 定 | `af_*` 列级正本在对方文档（ADR 0025）；本文两份正文并存即漂移（REQ-134 与对方 PLAN-024 已撞过一次） | [REQ-134 壳](../../../plans/2026-10-21-af-table-architecture-design.md) 退为指针 |
| K2 | 提升＝8900 单向写共享主表，`confirmed` 行按 outline→point 两层落，`summary` 原样平移 | 主表当前唯一写者是 8900、AF 明文只读不写 | 同上「提升契约」节 |
| K3 | **幂等锚用主表标量列 `from_detail_id` 存 AF `node_id`**，不再落 `anchors` JSON | 立论不借 R7（R7 只管 `meta`，`anchors` 不在其内）＝幂等锚要**可 `WHERE`、可建唯一约束**，JSON 路径表达式反查要扫全表；主表已有这枚语义完全对口的标量列，零新列即得 | 执行批次改列注释 + 逐字 DDL 守护同批 |
| K4 | 人工确认位**经 8902 写回**，根侧不直写 `af_*`；AF 不回写提升结果 | R6 人工位机器不写；跨仓回写即第二条写路径 | 与 REQ-136 R3 回执同批成文 |

**未裁项（不得按本壳推荐默认采纳）**：① `qe_unit_progress` 是否与 `qe_unit` 并表；② P6 的
`learn_course_id` 列名是否随摘段而改名（本轮裁决只覆盖表名与死列，未覆盖该列名）；③ P3 的排序规则
分裂在退出六张之外的存续表上何时归一。三处继续在 7.8 T2／P 表挂待裁。
> **上述三处未裁项已于同日由 [ADR 0026](../../../adr/0026-v1-root-table-family-freeze.md)／[REQ-137](2026-10-21-v1-root-table-family-freeze.md) 一并解答**：
> ① 不是并表而是**两张都整表退出**，`qe_unit_progress` 的 kp 终态位与质性门四列进 `qe_learning` 的
> `target_kind='kp'` 行；② `learn_course_id` **直接退列**（学习课程取消独立 ID，ADR 0026 D4），列名归属
> 问题随之消失；③ 排序规则归一随 REQ-137 W1 的**备份确认档重建窗口**一次做完（重建即按
> `utf8mb4_0900_ai_ci` 出，R9），不再单列待裁。本壳 W3 窗口与 REQ-137 W1 合并排期。

**独立性核验**：池退出**不违反独立性铁律**——已确认知识点在共享主表、8900 直连库读，Axiom-Flow 离线时
`#/learn`／`#/practice`／`#/knowledge` 三链照常；只有梳理屏（管理台）在上游离线时不可用，而管理功能对用户透明。

## 前置条件

1. 用户已裁决四条（2026-10-21）：范围＝只改根私有七表；撞名处置＝学习侧取 `qe_course_state`；
   台账形态＝另立 REQ-132/133 两行；**同日第四批（W5 判定）四条裁决**＝知识点池整表废弃、
   `qe_unit` 的 `section` 层并到知识点层级、死列与空转粒度「判定＋执行同批」、结论落点＝本壳 W5 与
   REQ-134 退指针（不另立计划壳）。判定正文见上节，裁决记录见「过程与证据」。
2. W1/W3 需 8900 停机重启窗口（旧名与新名不可能同时生效），且与 REQ-119 R5 死列删除排同一窗口。
3. 库内操作执行前逐表整表备份进 `tmp/req132_bak/`（W1 实测形态＝`mysqldump` 单文件三表 SQL，含建表与全部行；原写「JSON」是取证形态笔误），验收后按 ADR 0019 决定 4 清理不留残留。
4. 探针脚本只允许打 `qed_test`；生产 `qed` 库在本轮零接触。

## 工作项

| 条目 | 内容 | 状态 |
| --- | --- | --- |
| W1 | **demo 门**：练习三表按目标名改名（代码侧三枚表名 + 库内三张 `RENAME TABLE`）→ 重启 8900 → 8903 `#/practice`、`#/learn`、`#/knowledge` 三链真机各读一次，验证 2 题／6 作答／3 复习任务在面可见且 `/learn/star-map` 计数与库内 `COUNT(*)` 一致 | 已过门并经人工放行（2026-10-21 用户当令「放行 W2（纯改名，不动库）」＝本门验收通过）；取证见「过程与证据」2026-10-21 W1 三行 |
| W2 | 二次改名批次：根代码 `qe_learn_*`→目标名（103 处）、根文档 125 处、`web-ui` 3 处、守护 `ROOT_PRIVATE_TABLES` 与逐字 DDL 对齐随步，ADR 0025 决定 2 加表名注记 | 已落地（2026-10-21，**纯改名不动库、不重启 8900**）——库内目标名四张尚未实存，重启才会懒建空表，故 W3 之前不可重启（红线见「遗留与移交」第 1 条） |
| W3 | 库内迁移归一：其余**三张**（`course_state`／`unit`／`unit_progress`）的新旧名处置，按「认新名为正本＋旧表留档废弃」或「旧行迁移＋id 重映射」两案择一执行；`kp_detail` 两组现名**不迁不重命名**，随退出批次备份后整表 DROP | **已达成（对象由上游批次吸收，2026-10-23 收口判定）**＝2026-10-21 第三批裁决（ADR 0026 D1~D3）把本项四枚对象全部判为整表退出，「两案择一」因此**无对象可选**；其库内动作由 REQ-137 在同一窗口以**零迁移清空重建**兑现＝备份 119,296 字节 → 建三张 `qe_learning`／`qe_question`／`qe_attempt` → 按列名交集回灌 → `DROP` 九张（含本项四枚与两组 `kp_detail` 现名），`qed_learn_%` 与 `qe_learn_%` 双双零存活。证据＝REQ-137 归档壳 2026-10-22 P2～P4 条与收尾批条、总纲 §7.8 T2 |
| W4 | 生产 `qed` 库建表与改名命令清单成文，转人工随发布批次（D 类） | **本项字面对象不存在**（在册问题 P7 实测＝生产 `qed` 库七张根私有表**一张都没建过** ⇒ 上线面是**全量建表清单**而非改名清单，改名在生产侧零操作）；S5 判据「只出文档不代执行」因此达成（生产全程零接触，见「过程与证据」）。余下的**全量建表命令原文**已随 REQ-137 成文并按 D 类转人工＝其归档壳「遗留与移交」第 5 条 B 段＋本壳下方第 5 条；**清单成文属工作项而非本行 S 判据，且窗口归人工排期，不构成本行未做核心项** |
| W5 | 逐表判定表：P1~P7 逐条给 保留／改列／并表／废弃 判定与依据，输出进本壳并回填总纲备注列 | **判定已出**（2026-10-21 用户裁决定档，正文见「W5 逐表判定表」节；总纲备注列与 §7.8 T10 同批回填）——**执行不属本壳判据**，废表／并层／删列须另立一行承载 |
| W6 | 收口：全仓旧名引用清零核验（文档 + 代码 + 测试，`history/` 除外）＋契约/全量 pytest/ruff＋`code-map.md` 随步 | **已达成（2026-10-23 收口判定）**＝清零核验与三件套由 REQ-137 的 W4／门禁同批承接并绿：`qed_learn_%` 与 `qe_learn_%` 库内零存活；`backend`＋`web-ui/src`＋`tests` 源码内旧名命中数实测 **1**＝`tests/contract/test_architecture_documents.py:121` 守护自己的反向禁串（属「遗留与移交」第 2 条合法余值）；`code-map.md` 与总纲逐字 DDL 守护随步（收尾批复跑契约 **88 passed／1 failed**，唯一红＝并行模型轮 `scripts/image-model/.keepalive.pid`） |

## 过程与证据

- **2026-10-23（收尾批＝用户裁定关闭取值并收口，承 REQ-137 收尾批带出的本行状态事实）**：
  **用户裁决原文（AskUserQuestion 多选）＝「Achieved＋取代关系注记（推荐）」**（同批第二问答「同批一并裁定并收尾（推荐）」裁的是前序行
  [REQ-120](2026-10-16-root-private-prefix-and-four-part-design.md)，两行同窗口收口）。裁前事实登记如下（原文照留，
  不改写为结论）：REQ-137（ADR 0026 D1~D3）已于 2026-10-22 在同一库内窗口把本行 **W3 的四枚对象整表退役**＝
  `qe_course_state`／`qe_unit`／`qe_unit_progress`／`qe_kp_detail` 随 `DROP` 消失（有效信息合并进
  `qe_learning` 单表、候选池那行手写体会折进主表 `angles`），本行 W3 交付物所述「新旧名处置两案择一」
  与「`kp_detail` 备份后整表 DROP」**已无对象可选**；W6 的「全仓旧名引用清零核验」在本族口径下已由
  REQ-137 W4 承接并绿（`qed_learn_%` 与 `qe_learn_%` 双双零存活）。**未动的两处**＝W1 的 S1 判据原文仍写
  「读到 `question` 2 行／`attempt` 6 行／**`review_task` 3 行**现网实存」，而 `qe_review_task` 已整表退出
  （D3 改作答流水重放），该枚判据的**字面**已不可原样复现（等价事实＝到期队列 2 行由重放派生，已取证）；
  W4 的生产 `qed` 命令清单仍属人工窗口、未做。

- **逐条达成核对（2026-10-23，对照 todo 行 `REQ-132`「成功标准」列；判据正本在行、写定不改）**：
  - **S1＝达成**（2026-10-21 直接达成，非事后追认）：demo 门三链真机读到 `question` 2／`attempt` 6／`review_task` 3
    与库内 `COUNT(*)` 对齐、star-map 逐课程 12 门全 `match=True`、两枚 500 归零（顺带发现并修复 `DEFECT-021`
    的 `only_full_group_by` 分组缺陷）；人工放行＝用户当令原文「放行 W2（纯改名，不动库）」。**注**＝该判据字面的
    `review_task` 三行其表已随 ADR 0026 D3 退出，达成事实不因此追溯失效。
  - **S2＝达成，但经上游改判后的形状兑现**（这是本行唯一需要「取代关系注记」的判据）：不变式两半今日皆成立＝
    ① 库内一套名且与代码名一致＝`qed_test` 内 `qe_%` **恰三张**（13／24／14 列）与代码 DDL 逐字对拍 `fails=0`；
    ② 源码内旧名零存活＝`backend`＋`web-ui/src`＋`tests` 命中 **1**，且那一枚是守护自身的反向禁串
    （`tests/contract/test_architecture_documents.py:121`，属「遗留与移交」第 2 条合法余值）。
    **但本行定档表七枚目标名中四枚（`qe_course_state`／`qe_unit`／`qe_unit_progress`／`qe_kp_detail`）从未实存**，
    `qe_review_task` 实存过又退出；**不得把 S2 读作「七枚目标名落库完成」**，正本见上方「命名定档」效力状态段。
  - **S3＝达成**：逐字 DDL 对齐守护、`ROOT_PRIVATE_TABLES` 常量、总纲表清单与读写矩阵同批随步，
    收尾批复跑 `test_architecture_documents` 全绿；常量现值已由七枚改判为三枚（REQ-137 S2），本行的随步义务
    在其每一步都成立。
  - **S4＝达成**：「W5 逐表判定表」成文且逐枚带取证锚（池 8 列丢弃／零读列点名、死列写点行号、`section` 层与
    主表 `node_kind='outline'` 重复承载），未扩本轮范围；该表是 [ADR 0026](../../../adr/0026-v1-root-table-family-freeze.md)
    D1~D3 三张定档的**直接输入**（其「读法」节已声明表数结论被吸收升级）。
  - **S5＝达成**（字面即边界判据）：生产 `qed` 库全程零接触（P1／P7 只读探针与 W1／W3 脚本的前置断言均锁
    `qed_test`），误产生的库内改动＝无，故无需登记移交。其「清单成文」面在本行**无对象**——生产七张一张都没
    建过（在册问题 P7），真正的上线面是**全量建表清单**，已由 REQ-137 归档壳「遗留与移交」第 5 条 B 段出原文并
    转人工窗口（属工作项与跨行残余，不属本行 S 判据，按 task-lifecycle「移交型关闭」判例 REQ-098 不降级）。

  **关闭结果＝Achieved**。取值理由＝残余（W3 归一、W4 生产清单）不是「本行未做的核心项」而是**对象已被用户自己的
  上游改判吸收或从未存在**，且残余的承接方 REQ-137 本身已于 2026-10-22 关成 Achieved——符合
  [task-lifecycle](../../../standards/task-lifecycle.md)「移交型关闭的取值」中「残余仅为承接方在途工作记 `Achieved`」；
  若按「W3 未做」的严格读法可记 `Partial`，已由用户在两案中裁定采 `Achieved`＋取代关系注记，本壳不再自处。
  证据指针＝[REQ-137 归档壳](2026-10-21-v1-root-table-family-freeze.md)
  「过程与证据」2026-10-22 P2～P4 条与收尾批条、总纲 §7.8 T2/T12 现状行。
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
  **同日随步注记**＝REQ-133 已按用户同日第三道令（范围答复「并 123+129+133+135 四枚（推荐）」）并入综合请求
  [REQ-136](../../../plans/2026-10-21-af-family-rebuild-consolidated-request.md)，上方裁决原文按记录不改写。
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
  （todo 行 ＋ 承载条目 [普通任务轮壳 W30](../../../plans/2026-09-29-ordinary-tasks-round.md) ＋ 上述回归测试），
  不为本壳另立计划。

- **2026-10-21 W2 二次改名（纯改名，不动库、不重启）**：**TDD 顺序**＝先只改守护取证红——`ROOT_PRIVATE_TABLES`
  四枚改到目标名，并把该守护的 `stale` 判据由「代码无 `qed_learn_`」扩为「`qed_learn_` 与 `qe_learn_` 两种旧形
  皆零残留」（同族形变，不另立新守护），契约先红 **5 枚**（前缀与排序规则＋逐字 DDL＋逐列定义＋四件套＋
  总览↔矩阵↔角色）；再改代码，红收敛到文档侧；最后随步文档转绿（契约复跑 **88 passed／1 failed**，唯一红＝
  `scripts/image-model/.keepalive.pid` 既存违规）。**代码面 56 处**＝`services/learn/base.py` 31（course 8／
  unit 12／unit_progress 11）、`knowledge.py` 14、`practice.py` 2、`api/learn.py` 1、`api/main.py` 1、
  `services/learn/memory.py` 1（后两枚是 docstring 里的族通配 `qe_learn_*`，**清点教训**＝按词边界 `\b` 清点会漏掉
  通配形与 `idx_` 前缀形，只有子串扫描与守护的新判据能检出），`tests/test_learn.py` 1、`tests/test_learn_knowledge.py` 2、
  `web-ui/src/api/learn.ts` 3。列名 `learn_course_id` **不随动**（P6 归 W5）；四张表索引名未嵌表名（全量扫描
  `[A-Za-z_0-9]*_learn_*` 仅两枚 docstring 命中）故零改动。**文档面**＝总纲 51 处（§五 四枚小节标题与其逐字
  建表语句、§4.2 阶段表、§4.3 erDiagram 七条边、§三 总览四行备注、§五 引言、§7.6 改名分流、§7.8 T1/T2、§八 守护行）
  ＋`api-contracts.md` 4＋`code-map.md` 3＋`design/frontend/learning-practice-ui.md` 3＋`design/frontend/knowledge-point-exploration-ui.md` 1
  ＋`project-status.md` 3＋`todo.md`（REQ-047 长期行与 REQ-130 行各 1）＋REQ-130 壳「事实盘点」表现况行 5，
  **本批文档面合计 72 处**（与 W1 的 33 处相加＝105，余 20 处差额属库内现名与当时叙事，逐枚声明见「遗留与移交」第 2 条）；
  [ADR 0025](../../../adr/0025-database-design-master-doc-and-ddl-ownership.md) 决定 2 加**表名随步注记**（判据不动，照 W29 对
  ADR 0022 的注记判例）。**库面零操作实测**（只读 `information_schema`＋`COUNT(*)`，快照 `tmp/req132_w2_dbstate.txt`）＝
  目标名四张 `ABSENT`、旧名四张 2／95／2／3 行且仍 `utf8mb4_unicode_ci`、作废名四张 2／95／0／1 行且 `utf8mb4_0900_ai_ci`；
  新事实随步入 P3 与 7.8 T2＝**`RENAME TABLE` 不改存量表 collation**，练习三表虽已是目标名，物理 collation 仍分裂。
  **8900 未重启**＝运行进程仍持 W1 后代码（读写 `qe_learn_*` 四张），现网学习面零扰动；重启窗口归 W3 与人工排期
  （红线见「遗留与移交」第 1 条）。

- **2026-10-21 W5 判定表定档（用户四问四裁，零代码、零 DDL、零库内操作）**：起因＝用户令「目标聚焦管理台
  知识点梳理（待建）模块，具体事项交 Axiom-Flow，根侧只负责同步回来知识点共享表，按第一性原理先简化
  `qe_*` 族」。取证四处：① **模块确实未建**——`web-ui/src/components/AdminLayout.tsx:14-18` 导航仅五格，
  既无 `#/admin/analysis` 也无「文档知识梳理」，REQ-116 与 ARCH-027-M4 两屏形态仍挂总纲 C-1 待裁；
  ② **对方形状已定档为单表**——Axiom-Flow `docs/plans/2026-10-21-af-table-family-rebuild.md:144-175` 的
  `af_kp` 21 列（层级 `parent_id`、关系 `links` JSON、`gen_status`/`confirmed`/`gen_batch` 齐备、长文落文件只留
  `narrative_ref`），其 :214-226 已自定「8900 拉取式单向、AF 不直写共享表、AF 不回写提升结果」，与本壳
  K1~K4 契约一致；据此本壳 K1 采「根侧只读对方导出端点」，**不再持 `af_*` 列级形状**（REQ-134 退指针）。
  ③ **池的消费面实测**——`services/learn/knowledge.py:349-375` 提升时丢弃 8 列，`map_seed`/`dedup_of`/`book_ref`
  全仓零读、`confirmed` 从无 `WHERE` 命中（`grep -w` 逐名列点清点），`kp-details/confirm|reject` 与
  `PATCH /knowledge-points/{kp_id}` 在 8903 只有 `api/learn.ts:157/162/263` 的封装而无调用方。④ **死列与空转粒度
  实测**——`failure_count` 仅 `base.py:255/480` 写初值与复位、无累加点；`instructions`/`agent_notes`/`direction`
  只写不读；`page_windows`/`compile_fingerprint` 的 drift 判定（`learn.py:577-583`）只贴 `level='unit'` 而前端
  只请求 `point`（`stores/learnWorkbench.ts:524`）；`compile_done`/`compile_total` 唯一读点 `learn.py:669-670` 无调用方；
  `qe_review_task` 的 kp 粒度到前端只出不可作答占位卡（`components/practice/ChapterPractice.tsx:43-50`）。
  **用户四问四裁（原文选项）**＝池「废弃整表（推荐）」、`section` 层「并到知识点层级（推荐）」、
  清扫力度「判定＋执行同批（推荐）」、落点「写进 REQ-132 W5 + REQ-134 退指针（推荐）」。
  **本轮执行面为零**：判定与契约只落文档，废表／并层／删列因本行 S 判据不含该项而未动（扩载须改判，
  ADR 0023），去向见「遗留与移交」第 5 条。库内读数沿用 W2 快照 `tmp/req132_w2_dbstate.txt`，本轮未再触库。
- **2026-10-21（同日第二批）判定落档后的五面随步**：本壳 W5 之外同批改了四份文档，全部是**指针与定档陈述**，
  零列面、零 DDL、零表数改动——① 总纲 [database-design.md](../../../architecture/database-design.md)：§三 四行备注
  （`qe_course_state`／`qe_unit`／`qe_kp_detail`／`qe_review_task`）、§五 引言加「判定不领先执行」声明、
  `qe_kp_detail` 小节引言加定档引用块、共享主表 `from_detail_id` **备注列**记语义平移（DDL 注释原文未动）、
  §7.6 加两条（简化批次归属＋退表形态与改名分流相反）、§7.8 新增 **T10／T11**；② [REQ-134 壳](../../../plans/2026-10-21-af-table-architecture-design.md)
  退为指针（新增「逐列形状的地位」节与七行差异表、裁决点 R-1~R-7 定档、**自陈两处事实错**＝长叙述归根侧池、
  「档 B 消解裁决点＝零」）；③ [REQ-131 总纲壳](../../../plans/2026-10-20-doc-knowledge-cluster-master-outline.md) 回填 C-2／C-3
  并声明 C-1／C-4／C-5／C-6 仍未裁；④ [ARCH-027-M4 壳](../../../plans/2026-09-23-knowledge-exploration.md) 案 C
  `qe_learn_kp_source` 作废注记＋过程与证据条；⑤ [cross-project-contracts.md](../../../design/cross-project-contracts.md)
  §4 在途登记随步（REQ-134 退指针＋**对方台账已自成 REQ-136 承接行的观察**）与 §6 新增「知识点梳理工作区」能力组行。
  随步时新查到的对方事实＝其 `docs/trackers/todo.md` 的 PLAN-024 行自陈「请求接收（根仓库 REQ-136，并入 REQ-123／REQ-129）」，
  与根侧原登记的「待发函、尚无承接行」不符——只登记观察不改判，REQ-136 的关闭仍以其逐条回执为准。
  **指针清扫面（同批第三条）**：全仓 `rg "逐列形状.{0,12}正本"` 复核后改了指向**当前事实**的五处＝[REQ-134 壳](../../../plans/2026-10-21-af-table-architecture-design.md)
  「目标」段（原句仍写「交用户一次裁死」，与本壳退指针并存属自相矛盾，已补定档尾句）、[REQ-136 壳](../../../plans/2026-10-21-af-family-rebuild-consolidated-request.md)
  的关联设计行／目标段／过程与证据条、[项目状态快照](../../../trackers/project-status.md) 当前主线、
  [design-bugfix-log.md](../../../plans/design-bugfix-log.md) BUGFIX-037（追加「同日第二批随步」条，原「修复与验证」记录不改写）。
  按治理豁免、**留作当时叙事**的三处＝ARCH-025 壳「线 2 收拢为一枚综合请求」过程行、普通任务轮壳 W5 行、
  `docs/trackers/completed.md` 历史行（其表述在各自批次落笔时为真，改写会伪造过程证据）。
  **本轮门禁实跑（docs-only 批后，2026-10-21）**＝`pytest tests/contract -q` **88 passed／1 failed**、
  根全量 `pytest tests -q` **869 passed／1 failed**（同一枚既存红 `scripts/image-model/.keepalive.pid`，
  与 W2 落地时的基线完全一致、非本批引入）、`ruff check backend tests scripts` All checks passed（本批零 Python 改动）。
  `qed_learn_`／`qe_learn_` 的新增命中全部落在已声明的合法余值处（见「遗留与移交」第 2 条，本批已把
  REQ-134 壳与本壳证据条补入清单）。

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
- 关闭动作按 `qed-closeout`：todo 行原子移入 completed.md（关闭结果 + 门禁证据），本壳按 Retain 归档。
- **关闭记录（2026-10-23）**＝关闭结果 **Achieved**（用户裁定取值，原文见「过程与证据」2026-10-23 收尾批条）。
  S1~S5 逐条核对全达成，其中 **S2 由 ADR 0026 三张定档后的形状兑现、S5 的清单面因生产库零表而无对象**，
  两处取代关系已在证据中显式写明，避免「七枚目标名已落库」的误读。工作项终值＝W1 过门并人工放行、
  W2 落地（码与文档改名）、W3 达成（对象由 REQ-137 吸收）、W4 无对象（建表清单转人工）、W5 判定成文并升级为
  ADR 0026、W6 达成（清零核验由 REQ-137 W4 承接并绿）。台账两动作＝todo 行移除＋`completed.md` 新增行；
  壳按 **Retain** 物理移出 `docs/plans/` 至 `docs/history/plans/2026-10/`（`test_plan_governance.py` 的
  `_active_plans()` 对该目录每枚文件都断言在途态，Closed 留原位必红，归档移动是守护要求），链接按新深度重算，
  入站指针随步（复算实数＝**9 枚**文件含指向本批两壳的新归档路径：ADR 0026、`database-design.md`、`cross-project-contracts.md`、
  `plans/2026-09-23-knowledge-exploration.md`、`plans/2026-10-20-doc-knowledge-cluster-master-outline.md`、
  `plans/2026-10-21-af-table-architecture-design.md`、`plans/index.md`、`trackers/completed.md`、`trackers/project-status.md`；
  另＝两壳互指按同目录短名随步）。全程零 git 提交（HEAD 仍 `1a0e14c`）。

## 遗留与移交

1. **重启红线（W2 已落地、W3 未执行的窗口内）**：代码侧已只认目标名四张，而 `qed_test` 内这四张**尚未实存**。
   一旦重启 8900（含 `/self-restart`、机器重启、控制中心启停任一形态），学习域三表与知识点候选池会被懒建为
   **空表**，现网在面的学习进度／单元树／候选明细（旧名 2／95／2／3 行、作废名 2／95／0／1 行）立即不可见，
   直到 W3 归一完成。故 **W3 的库内窗口与 8900 重启必须同批**，窗口排期与批准归人工；在此之前不为任何原因重启 8900。
   W5 判定落档后本族定档六张，但**判定不领先执行**：废表批次入库前代码与库面仍按七张出，两条窗口必须同批见第 5 条。
   **同日再收（2026-10-21，[ADR 0026](../../../adr/0026-v1-root-table-family-freeze.md)／[REQ-137](2026-10-21-v1-root-table-family-freeze.md)）＝本族定档三张**
   （`qe_learning`／`qe_question`／`qe_attempt`），W5 四枚判定中三枚升为整表退出，故本条「六张」读法**作废**；
   判定仍不领先执行，且本壳 W3 库内窗口须与 REQ-137 W1 **合并排期**（两批都触库、都要重启 8900）。
   **2026-10-23 收口时补＝本条红线已解除**：REQ-137 于 2026-10-22 在同一窗口完成三张重建与九张 `DROP`，
   8900 已重启并走完端点走查与真机黄金路径（`qed_test` 内 `qe_%` 恰三张＝代码声明形状），
   「W3 未执行前不得重启 8900」的窗口约束随 W3 对象一起消失；生产 `qed` 库仍未建表，见第 5 条 B 段。
2. **余值声明（W6 清扫面的合法处，逐枚点名不改写他轮记录）**＝`docs/plans/` 各轮壳的当时叙事与提案名
   （REQ-120 壳定档表、REQ-130 壳「过程与证据」行的三枚练习表旧代码名、`2026-09-22-learning-design-mainline.md`、
   `2026-09-23-knowledge-exploration.md` 与 `2026-10-20-doc-knowledge-cluster-master-outline.md` 的提案表
   `qe_learn_kp_source`、`2026-10-15-doc-analysis-processing.md`、普通任务轮壳 W-行、**本壳「过程与证据」同日第二批条
   与 [REQ-134 壳](../../../plans/2026-10-21-af-table-architecture-design.md)（其「交叠划清」表与本壳 2026-10-21 随步在其
   「过程与证据」「裁决点」两处新增的引用）对旧族名与作废草案名的陈述**）、`docs/trackers/completed.md`
   历史行、本壳定档表的「改名前代码名」列、库内现名与禁串字面量（总纲 §三 备注列、§7.6、7.8 T2、§八 守护行，
   及 `tests/contract/test_architecture_documents.py` 的 `stale` 判据）；`docs/history/` 14 枚按治理规则豁免。
3. **跨仓残留转告**＝`QED-Tracker/docs/architecture/database-design.md` 两处（第 16、40 行）仍把根私有族写作
   `qe_learn_*`；那是对方仓库文档，根侧只读不代改，随 REQ-119／REQ-136 的回执窗口转告对方随步。
4. **W2 批次尚未入库（2026-10-21，落地后 `pytest tests/contract -q`＝88 passed／1 failed，唯一红＝
   `scripts/image-model/.keepalive.pid` 既存违规）**：用户的提交授权只覆盖 W1（`1a0e14c`）。W2 落地后按「提交保持
   单一目的」复核，本批 18 枚文件里有 8 枚同时携带其余各轮的未入库改动，文件粒度切不出干净提交＝
   `services/learn/knowledge.py`（REQ-118 列形状：`meta`／`created_by`／`updated_by`、去 `confirmed`、collation 改
   `utf8mb4_0900_ai_ci`、索引改名；129 增／47 删，本批仅 14 处改名）、`api/main.py`（`llm_call_log.ensure_columns`
   与 `ensure_indexes`）、`tests/test_learn_knowledge.py`（268 增／9 删，本批 2 处）、`web-ui/src/api/learn.ts`
   （148 增／21 删，本批 3 处注释）、`project-status.md`（126 增／16 删，本批 3 处）、`todo.md`（REQ-134 新行与其
   未入库壳）、`api-contracts.md`（DEFECT-017 一行）、`docs/design/frontend/` 整目录未入库（另轮前端设计拆分产物，
   本批在其中改 4 处）。只提「干净子集」（`base.py`／`memory.py`／`practice.py`／`api/learn.py`／守护／`test_learn.py`
   ／`code-map.md`／总纲／ADR 0025／两枚壳）会让 HEAD 转红——守护的 `stale` 判据与逐字 DDL 对齐要求 `knowledge.py`
   同批改名。故只有两案且均待用户裁决：① 上述各轮各自收口入库后 W2 随之提交；② 明确授权把交错文件连同他轮改动
   一并入库（放弃单一目的）。
5. **W5 判定的执行批次不在本行判据内（须另立 todo 行）**：本行成功标准 S1~S5 只覆盖**改名**（七表目标名落地 +
   代码文档随步），不含**废表／并层／删列**；按 ADR 0023 成功标准列冻结、扩载须改判，判定表不得就地变执行授权。
   故 W5 交付物止于判定，执行另批，且**必须与第 1 条的 W3 库内归一窗口同批排期**——两批都要触库、都要重启 8900、
   都要走 ADR 0024 备份档，拆成两窗会把「改名撞旧名」与「退表 DROP」的回滚面叠在不安全的一侧。执行批次的清单上限
   （只写判据、不预先给 SQL）＝① `qe_kp_detail` 两组旧名表不迁不重命名，备份后整表 DROP，四张目标名表其中一张
   随之退出；② `qe_unit` 的 `level='section'` 行与共享主表 `node_kind='outline'` 行的归并口径与迁移脚本；③
   `qe_course_state` 八枚死列的摘除（含 8900 响应字段与前端封装同批）；④ `qe_review_task` 的 `target_kind='kp'`
   粒度删除；⑤ 逐字 DDL 对齐守护与 `ROOT_PRIVATE_TABLES` 随步、总纲 **§三 备注列与 §五 全列面的改写**（本轮已落的
   只是**定档指针**：§三 四行备注、§五 引言与 `qe_kp_detail` 小节引言、§7.6 两条、§7.8 T10／T11——列面、DDL 与
   表数 21 **均未改**，改它们属本项）、`from_detail_id` 列注释改文与代码 DDL 同批；⑥ 代码面摘除与改读＝
   `api/learn.py` 的 `kp-details`／`annotations/generate`／`like` 三端点族与 `services/learn/knowledge.py`、
   `knowledge_memory.py` 的池读写，8903 右栏「批注与候选」闭环（`components/learning/AnnotationPane.tsx`）改读
   8902 透传或随梳理屏重建；⑦ `code-map.md`、`api-contracts.md` §⑥ 端点清单与 `test_api_endpoint_inventory`
   双向等值同批。本壳不为该批次建壳或写 SQL；建行的动作归用户或 `qed-intake`。
- 列形状变更（P4 重叠列收敛、P5 两处 `confirmed` 分工、P6 `learn_course_id` 列名、REQ-119 两枚死列）
  一律只出判定、不在本壳执行；执行另批，并等 Tracker 的 R5 回执窗口。
- 库内一次性数据窗口（W1/W3 的 `RENAME` 与备份）排期与批准归人工，本壳可交付的是脚本、两案择窗清单与回归取证。
- 生产 `qed` 库的七表建表清单随发布批次转人工（W4）。
