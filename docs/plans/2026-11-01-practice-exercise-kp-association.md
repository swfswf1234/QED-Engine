# 课后练习与梳理习题打通・习题—知识点归档与答案配对（practice-exercise-kp-association）

状态：Accepted
任务类型：B
最后更新：2026-11-01
关联 ADR：[ADR 0007](../history/adr/v0.1/0007-qed-engine-backend-gateway.md)（前端只连 8900）、
[ADR 0016](../adr/0016-todo-registration-one-task-one-plan.md)（一任务一行一壳）、
[ADR 0021](../adr/0021-round-proliferation-cap-and-per-row-doc-anchor.md)（薄登记与行级文档锚）、
[ADR 0023](../adr/0023-todo-row-carries-scope-and-criteria.md)（成功标准正本在台账行、进展只落本壳）、
[ADR 0025](../adr/0025-database-design-master-doc-and-ddl-ownership.md)（前缀即所有权：`af_kp` 归对方，本仓只经 HTTP 消费）、
[ADR 0026](../adr/0026-v1-root-table-family-freeze.md)（D10 主表唯一产面与 `from_detail_id` 提升锚）
关联设计：[frontend/learning-practice-ui.md](../design/frontend/learning-practice-ui.md)（练习面设计正本，§7 抽取规格）、
[api-contracts.md](../architecture/api-contracts.md) §④（梳理透传面）与 §⑥（学习域与练习域）、
[database-design.md](../architecture/database-design.md)（`qe_question` 的 `source_kind`／`answer_source`／`source_ref`／`kp_id` 列域）、
[frontend/knowledge-point-exploration-ui.md](../design/frontend/knowledge-point-exploration-ui.md)（习题行在梳理屏的可见面）、
[frontend/learning-course-ui.md](../design/frontend/learning-course-ui.md)（纯净目录的过滤口径，习题行的排除面）
关联 Tracker：docs/trackers/todo.md（REQ-146 任务行，登记在学习设计轮节＝四段收口顺序 ③ 课后练习段的第二枚承载行）
归档判定：Retain（三形态同一条流程的对照读数、习题行与在册目录行去重的取值、以及「习题不需要 summary」这条口径的取舍属不可替代的过程记录）

> **用户 2026-11-01 令（本壳口径正本，与其他条文冲突时以本令为准）**：理论上是「教材上的习题 ＋ 习题集中的答案」，
> 或者「习题集中本身有习题 ＋ 答案」，这才算梳理完整；**我们只需要梳理习题属于哪个知识点，不需要 summary**，
> 只需要对应好「习题 ＋ 答案」。同轮两裁＝「**AF 补结构腿（推荐）**」（结构归 Axiom-Flow）与
> 「**沿用人工选页（推荐）**」（答案仍由人在练习面选书与选页）。

## 目标与成功标准

**目标**＝把「习题」两侧都缺位的一件事接成一条链，让一条课程链路在「读完一章」之后能直接练这一章：
结构由 Axiom-Flow 用确定性规则派生（章末的习题段成为目录行，不再靠模型偶发产出），内容由根侧既有抽题腿消费
（页区间与归属直接从习题行取，人不再猜「习题在哪几页」），答案仍由人配对（沿用现成的「选答案书 ＋ 答案页范围」），
习题挂到它所属的知识点上（能对上节的挂该点、否则挂章，未归档记未归档），完成度按「N 题里 M 题有答案」显示。

用户可见的四个变化：

- **看得见习题**：梳理屏的目录里出现「习题」这类行，带它自己的页区间；课程学习面的纯净目录不列它（它不是知识点）；
- **抽得准**：练习面多一条「按本章习题抽题」的入口，页范围与所属章由行带入，不再靠人选页碰运气；
- **配得齐**：答案侧三条路（同页答案／章末答案段／另一本的答案页）沿用现成规则，同一条流程不再按书的种类分叉；
- **挂得住**：习题的 `kp_id` 指向它所属章（或编号唯一对得上的那一节）的知识点，主表里没有那一行时记「未归档」而不是造假行。

成功标准条目化判据的正本在台账行（ADR 0023），本壳只承接拆解与执行；行内 S1~S5 与本壳工作项的对应＝
S1→W2、S2→W3、S3→W3＋W5、S4→W4、S5→W6，文档随步＝W7。

## 范围与非目标

**范围内**：

- **结构侧（Axiom-Flow）**：章末习题段的确定性成行腿——证书式规则识别、父＝所属章、带块锚点与树序页区间、
  复用既有 `meta.toc_kind='exercise'`／四值 `node_type`，零模型调用、零 summary、零正文、零产物改动；
- **内容侧（根仓库）**：练习面「按梳理习题行抽题」入口、`source_kind`／`answer_source` 的取值切换、
  完成度口径与未归档态显示；
- **归属**：⑥ 学习域投影补一枚只读键（`from_detail_id`），供屏侧把习题行落到主表 `kp_id`；零 DDL；
- **文档随步**：`api-contracts.md` §④／§⑥、`database-design.md` 的 `source_ref` 字段表、
  `learning-practice-ui.md` §7 抽取规格、以及 Axiom-Flow 的 `knowledge-analysis.md` 与 `PLAN-026`。

**非目标（各给指针）**：

- **不给习题写 `summary`、不生成习题正文、不写详解长文**（用户令明写）——习题行只承载「它是哪一章的习题、
  在哪几页」；总结与导读仍只属于章与知识点（[REQ-143 壳](2026-10-26-kp-generation-leg-and-one-click-summary.md)）；
- **不新增练习域端点、不新增表、不加列**——`POST /learn/questions` 与练习域三表冻结，
  `source_ref` 只加一枚 JSON 键（[database-design.md](../architecture/database-design.md) 列域正本随步）；
- **不改判分规则与间隔序列**（`services/learn/grading.py`／`services/learn/practice.py` 的判分与调度语义冻结，
  本壳只消费结论字段）；
- **不做自动配对答案**（用户裁「沿用人工选页」）：答案页区间仍由人选，机器不猜；
- **不碰课程学习面的纯净目录**：习题行 `toc_role='reference'` 已被该面过滤掉
  （[learning-course-ui.md](../design/frontend/learning-course-ui.md) 的六条口径与 REQ-144 的 W2 同步腿），
  也不进知识点主表；
- **不做跨书合并**：两本书各自的习题行只挂各自课上已提升的知识点，`kp_id` 不跨书推断；
- **Axiom-Flow 侧改码凭逐轮明示授权**；子仓库 git 提交与推送归对方或人工，本壳不执行。

## 前置条件

1. Axiom-Flow 的四值 `node_type` 读键（`KA-44`）与树序派生区间（`KA-42` 经 W23 改判）已在册；
2. 根侧练习面的既有抽题腿可用：`web-ui/src/exerciseParse.ts` 的三条答案通路（`same_page`／`solution_section`／
   `sibling_book`）与 `none`→闪卡的分支都在册，`web-ui/src/stores/practice.ts` 已有 `range`／`answerRange`／
   `sourceBookId`／`answerBookId` 与 `EXTRACT_MAX_PAGES=40`；
3. 至少一门课有一册生效版本的梳理成品，且该册的章行在册（`gen_status` 为 `candidate` 及以上）；
4. 若要把 `kp_id` 真正挂上，该章须有主表提升行（`qed_knowledge_point.from_detail_id` 非空）；
   无提升行时 `kp_id=null` 属合法「未归档」态，**不阻塞抽题**；
5. 本壳不动用户数据根（`dataset/`），任何真机取证只读不写。

## 现网取证（2026-11-01 只读，零改码）

| 事实 | 读数与落点 | 推论 |
| --- | --- | --- |
| 「习题」这个概念结构侧已在册 | `Axiom-Flow/src/axiom_flow/normalize/toc.py` 的 `TOC_REFERENCE_KINDS` 七值内含 `exercise`；`_REFERENCE_NAME_SHAPES` 已有 `^\s*习\s*题`／`^\s*练\s*习`／`习题解答`／`习题提示` 四条形态；`node_type_of` 已按本行或祖先 `toc_kind` 派生 `exercise`（`KA-44`） | 缺的不是概念与标签，是**成行**：现网只有模型整理腿偶尔给出习题行时才落行 |
| 教材章末习题段多数不成行 | `mathanalysis-b05` 在册 140 行里 `toc_role=reference` 22 行（含 2 枚「习题」），`mathanalysis-b07` 92 行 reference 2 行（两枚前言、零习题行）——读数见 REQ-144 壳的「现网取证」第二节 | 习题行产出不稳定且不成体系；b07 的习题段完全在册外 ⇒ 结构腿必须是确定性规则，不能继续靠模型 |
| 区间口径有一处要开例外 | `section_spans_of` 已改树序（`KA-42` 经 W23 改判）：`toc_role='reference'` 行只发起点＝终点 | 前置后置的正文不在条目页，单页是对的；习题段的正文就在标题页起向下延伸，照单页发会让练习面只抽到一页 ⇒ 本轮唯一一条改判＝习题行按知识行的树序算式给真区间 |
| 根侧抽题腿已具备 | `exerciseParse.ts` 三条答案通路全在册；`stores/practice.ts` 的页区间与答案书状态齐全；`confirmImport` 恒写 `kp_id: null`（课级归属，裁决 R2） | 三形态**同一条流程**，差的只有两样：页区间从哪来、`source_kind`／`answer_source` 取什么值 |
| 归属缺的是一枚只读键 | `backend/qed_engine/api/learn.py` 的 `_course_tree()` 不发 `from_detail_id`，而主表该列自 REQ-144 的同步腿起已有值 | 屏侧拿不到 Axiom-Flow 的 `node_id` → 主表 `kp_id` 的映射；补读键即可，零 DDL、零新表 |
| 列域已够 | `qe_question.source_kind` 五值（`exercise_book`／`textbook_chapter`／`solutions_book`／`manual`／`generated`）、`answer_source` 六值（`same_page`／`solution_section`／`sibling_book`／`manual`／`llm`／`none`） | 教材习题／自带答案的习题集／独立答案本三形态零 DDL、零新列 |

## 待裁点与裁决

**四问已裁（W1 回填，2026-11-01）**：取值依据＝用户审阅本壳后之令「开始执行，先做 W1 回填 T1~T4」，
四问按下方「裁决取值」列成文；若某条与您的本意不同，请在 W2 动码前指出，我按您的取值改本表再动码。

| 问 | 裁决取值 | 后果与代价 |
| --- | --- | --- |
| T1・结构腿挂在哪一批 | **挂在既有目录腿的同一批**（`stage=full` 的成行阶段与 `stage=outline` 都跑），零新增入参、零新端点 | 已在册的书要重跑一次目录腿才出习题行（写库动作，归人工发令）；不单开批次＝不让一本书的习题行与目录行分属两批而互相覆盖 |
| T2・习题行在屏上的可见范围 | **梳理屏左栏可见并标「习题」，课程学习面与知识点主表均不列** | 课程学习面的纯净目录已被 `toc_role='reference'` 天然排除，零新增开关；练习面按行选，不另造「习题目录」第二张表 |
| T3・章未提升到主表时的 `kp_id` | **记 `null`（未归档），照常允许抽题**，屏上按「未归档」显示 | 不阻断练习；也不为凑归属去新建 `qed_knowledge_point` 行（ADR 0026 D10 的唯一产面是提升端点） |
| T4・习题挂到哪一级知识点 | **习题行名里的编号唯一对得上某一节行 ⇒ 挂该节；否则挂所属章；对不上任何行 ⇒ `null`** | 编号对上就细、对不上就退到章，不猜；错挂比不挂更难查，故宁可退到章 |

T1~T4 全部回填完毕，W1 关闭；其后工作项按上表取值动码，不再逐条回问。

## 工作项

| 条目 | 内容 | 状态 |
| --- | --- | --- |
| W1 | 四问四答交用户裁决并回填上表（T1~T4），回填前不动码 | 已完成（2026-11-01；用户令「开始执行，先做 W1 回填 T1~T4」，四问按推荐取值回填） |
| W2 | **Axiom-Flow 结构腿**（跨项目，对方工作区）＝`normalize/toc.py` 新增纯函数 `is_exercise_label`／`exercise_entries`（整块短标签匹配 `习题／练习／Exercises／Problems` ＋可选编号，排除含 `解答／答案／提示` 者与目录页）＋ `orchestrator/knowledge.py:build_outline` 成行阶段追加一趟（逐章在章区间内扫描，命中页以该块为锚成一枚 `depth=2` 行，父＝所属章、`meta.toc_kind='exercise'`、`meta.toc_role='reference'`、`summary` 空、`model_ref='rule:exercise'`）＋ `orchestrator/knowledge.py:_outline_identity` 两趟同判：正腿／回落腿抄进的整块习题标签同样归 `reference`／`exercise`，逐页早落与定稿重算身份位一致 ＋ `section_spans_of`／`SpanRow.toc_kind`／读面 `_kp_page_spans` 给习题行真区间（树序，不复用 reference 单页退化）＋ **同页已有习题行**才跳过（其他身份的行不影响，节标题与习题段同页是常态）；**零模型调用、零 summary、零正文、零产物改动、零 DDL**；识别不出即零行。判据正文＝`KA-46`，`PLAN-026` W26 与「承载 REQ-146」节同批 | 已完成（2026-11-01；用户「开始执行」并逐轮授权 AF 动码。AF 全量 `pytest tests -q` 1231 passed／18 skipped、`ruff check src tests` 干净、`tests/contract` 289 passed；`KA-46` 与验收第 18 条已随步对齐实现口径；AF 侧零 git，提交归另一 AGENT） |
| W3 | **练习面按习题行抽题**（8903）＝练习面新增一条入口列该书在册习题行（章名＋习题行名＋页区间，读 ④ 整册工作区 `getKpWorkspace`）；选行即带入 `sourceBookId`＋`range`，`source_kind` 按 `qt_books.roles` 判（教材→`textbook_chapter`、习题集→`exercise_book`），答案仍走既有三条通路与人工选书选页；区间超 `EXTRACT_MAX_PAGES=40` 的行不自动带入、退回人工选页 | 待开始 |
| W4 | **归属接通**＝⑥ 投影 `_course_tree()` 每行补只读 `from_detail_id`（零 DDL）；前端按「习题行 → 所属章行（或编号唯一对上的节行）→ 主表 `kp_id`」灌进 `confirmImport`（现恒 `null`），对不上＝`null`；`source_ref` 加一枚 `outline_node_id`（只进 JSON，零列）以指认该题出自哪枚习题行 | 待开始 |
| W5 | **完成度口径**＝练习面显示「N 题里 M 题有答案」，`N`＝本轮入库题数、`M`＝`answer_source != 'none'` 的题数；不新建统计端点，前端按已取题卡算；`summary` 不参与 | 待开始 |
| W6 | **demo 门真机**＝数学分析一门课：从习题行抽题 → 人工配对答案（含一本独立答案书的 `sibling_book` 腿）→ 作答判分回显 → 刷新后题卡与归属仍在；8903 三门禁＋根侧契约与全量全绿，到门暂停待人工验收 | 待开始 |
| W7 | **文档随步**＝`api-contracts.md` §④（`node_type`／两枚区间键在练习面的消费口径）与 §⑥（`kp_id` 归档语义＋`source_ref.outline_node_id`）、`database-design.md` 的 `source_ref` 字段表、`learning-practice-ui.md` §7 抽取规格补「按梳理习题行」入口、`Axiom-Flow/knowledge-analysis.md` 的 `KA-46` 与验收判据第 18 条 | 待开始 |

## 过程与证据

- **2026-11-01**：接用户令进场（qed-intake）。用户先给口径（习题＋答案两半才算梳理完整、只要归属不要 summary、
  只需把习题与答案对应好），随后两裁＝结构归 Axiom-Flow 补一条确定性结构腿、答案侧沿用人工选页。本批只读取证：
  Axiom-Flow 的 `normalize/toc.py`（七值 `TOC_REFERENCE_KINDS` 含 `exercise`、四条习题名形态、`node_type_of` 的
  祖先判定）、`orchestrator/knowledge.py`（`build_outline` 的成行阶段、`section_spans_of` 的树序算式），
  根侧的 `web-ui/src/exerciseParse.ts`（三条答案通路与 `none`→闪卡）、`web-ui/src/stores/practice.ts`
  （页区间状态与 `confirmImport` 的 `kp_id: null`）、`backend/qed_engine/api/learn.py`（`_course_tree()` 不发
  `from_detail_id`）、`backend/qed_engine/services/learn/practice.py`（`SOURCE_KINDS`／`ANSWER_SOURCES` 两个闭集）。
  定级＝**大修改**（跨两侧结构＋消费面），故先立 REQ-146 行与本壳、四问交裁，**零改码零改在册文档**。
- **2026-11-01**：本批另写成 Axiom-Flow 的 `PLAN-026` W26 与「承载 REQ-146」节、`knowledge-analysis.md` 的
  `KA-46` 与验收判据第 18 条（跨项目承接的文档面，对方工作区只写文档、零代码、零 git）。
- **2026-11-01**：W1 关闭。「待裁点与裁决」节由「推荐口径」改为「裁决取值」并留取值依据（用户令
  「开始执行，先做 W1 回填 T1~T4」，四问按推荐取值：T1 挂既有目录腿同批／T2 仅梳理屏可见／
  T3 `kp_id=null` 照常抽题／T4 编号唯一对上节则挂节否则挂章）；W2 判据口径同步为「`KA-46` 已成文、
  AF 动码待逐轮明示授权」。本轮零改码、零改 Axiom-Flow 代码、零 git。
- **2026-11-01**：W2 关闭。用户令「授予你权限进行改动」（AF 工作区逐轮授权，前一轮不沿用）后按 TDD 动码：
  先写四组红用例（`TestExerciseLabels`／`TestExerciseRows`／`TestSectionSpansOf` 新用例／
  `TestDerivedPageRange` 新用例），再落 `normalize/toc.py` 两枚纯函数与 `build_outline` 结构趟。
  实现中改判两处口径并同步 `KA-46`：① 同页去重只对**习题行**（原稿写「同页任一在册行」——那样会把与
  节标题同页的习题段整段吞掉）；② 模型正腿抄进的整块习题标签也归 `reference`／`exercise`，身份位收进
  `_outline_identity` 供逐页早落与定稿两趟共用（`KA-40` 改写面不含身份列，两趟不一致会永久留在行里）。
  门禁：AF `pytest tests -q` 1231 passed／18 skipped、`tests/contract` 289 passed、`ruff check src tests`
  干净。AF 侧零 git 操作，代码提交由用户指派的另一 AGENT 执行。

## 验证与验收

- 文档面：根侧 `pytest tests/contract -q`（计划／台账／链接三类）全绿；Axiom-Flow 的文档类契约测试全绿。
- 实现面（动码后）：Axiom-Flow `pytest tests -q`＋`ruff check src tests scripts`；根侧 `pytest tests -q`＋
  `ruff`；`web-ui/` 内 `npx tsc -b`、`npx vitest run --no-file-parallelism`、`npm run build`。
- 真机：W6 的 demo 门读数（请求全 200、只指 8900、控制台零报错、三档宽度）。

## 回滚

- 结构腿是**新增行**，回滚＝按 `model_ref='rule:exercise'` 反查本腿产出的行并逐条删除（与在册行去重过，
  不会误伤模型行）；删除前先出只读计数与逐条清单交用户签认。
- 根侧改动集中在练习面一处入口与 `kp_id` 的写入值，回滚＝入口下线、`confirmImport` 退回恒 `null`；
  已入库题卡不受影响（`kp_id` 只是可空归属列）。
- 两侧均零 DDL、零迁移，无不可逆的数据形状变化。

## 关闭与归档

- 关闭前置＝S1~S5 逐条达成（Axiom-Flow 侧结构与根侧消费面各有取证读数），文档随步完成，三门禁全绿。
- 若对方（Axiom-Flow）侧结构腿未落地而根侧消费面已就绪，按任务生命周期取 `Partial` 或移交型 `Achieved`，
  由用户裁定后回填；不静默关闭。
- 归档判定 `Retain`：过程记录（三形态对照、去重取值、区间例外的前后对照）不可再生。
