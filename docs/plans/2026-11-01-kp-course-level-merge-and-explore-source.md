# 共享知识点表课程级归并与知识探索去书化（kp-course-level-merge-and-explore-source）

状态：In Progress
任务类型：B
最后更新：2026-11-01
关联 ADR：[ADR 0007](../history/adr/v0.1/0007-qed-engine-backend-gateway.md)（前端只连 8900）、
[ADR 0016](../adr/0016-todo-registration-one-task-one-plan.md)（一任务一行一壳）、
[ADR 0023](../adr/0023-todo-row-carries-scope-and-criteria.md)（成功标准正本在台账行、进展只落本壳）、
[ADR 0024](../adr/0024-preschema-rebuild-tiers-and-demo-gate.md)（范围锁死＋B 类壳首工作项的 demo 门）、
[ADR 0025](../adr/0025-database-design-master-doc-and-ddl-ownership.md)（前缀即所有权：`af_kp` 归对方，本轮零改动、只经 HTTP 读）、
[ADR 0026](../adr/0026-v1-root-table-family-freeze.md)（D2 序列读时投影、D5 主表三列与长文不落库、D10 主表唯一产面）
关联设计：[frontend/knowledge-point-exploration-ui.md](../design/frontend/knowledge-point-exploration-ui.md)（知识探索面正本，§9／§10／§11 随步）、
[frontend/learning-course-ui.md](../design/frontend/learning-course-ui.md)（课程学习面正本，§5.1 归本位派生链与 §10 表随步）、
[api-contracts.md](../architecture/api-contracts.md) §⑥（提升同步腿与序列投影的契约事实源）、
[database-design.md](../architecture/database-design.md)（`qed_knowledge_point` 列域与承载语义正本）
关联 Tracker：docs/trackers/todo.md（REQ-145 任务行登记在学习设计轮节＝四段收口顺序 ④ 知识探索段的承载行；分线归属＝ARCH-027 主链 M4）
归档判定：Retain（两本 af 真 payload 的归并覆盖面实测、`book_ref` 退役的现网前后对照、以及「字面归一吃不掉称谓差」的量化证据属后续合并梳理功能的不可替代输入）

> **用户 2026-11-01 令（本壳口径正本）**：详细梳理知识探索部分的改造，**全部信息都可以基于共享表实现**
> （不能一个课程几本书没有整理就把多本书的知识点混在一起），整理「详细流程 → 展示的详细流程」，
> **确认好流程落文档，然后再实现**。四问四答出裁四条（R1~R4，原文见「裁决」节）。

## 目标与成功标准

**目标**＝把共享知识点表由「按书切片、两本书即两套并列结构」改造成**课程级一套结构**：一行＝课程级的
一个「物」，异名进 `aliases`、多来源进 `anchors`；提升腿在落笔前先按课程级归并一次；`book_ref` 退役；
知识探索面只从共享表取数、结构上不再可能出现第二套骨架、界面上书完全透明。

成功标准条目化判据的正本在台账行（ADR 0023），本壳只承接其拆解与执行；行内 S1~S5 与本壳工作项的
对应＝S1→W2、S2→W3、S3→W2＋W3、S4→W4、S5→W1。

## 范围与非目标

**范围内**：

- `qed_knowledge_point` 的**承载语义**改道（课程级一套结构、`aliases`／`anchors`／`meta` 三处承载位、
  `book_ref` 退役）与 `merge_key` 归并判据成文；
- 提升同步腿 `_sync_book_knowledge` 的落笔方式：章层由「按书整片替换」改「课程级骨架 upsert」，
  点层由「同名跳过、异名建行」改「命中即合、未命中才建」；
- 学习面「归本位」的派生链搬家（可观察行为不变）；
- 知识探索面的读源与形态加固（一套骨架判据、书透明的源码级守护）；
- 上述改动牵动的契约与设计正本随步（`api-contracts.md` §⑥、`database-design.md`、两份 design 正本）。

**非目标（各给指针）**：

- **不动 `af_kp`**：本轮零改动对方表与端点，只读现成工作区（用户 R1 原文「我们本轮不动af表」）；
  对方形状正本＝其 `docs/design/knowledge-analysis.md`，根侧只经 ④ 透传面消费；
- **「知识点合并梳理功能」不属本轮**：字面归一吃不掉的**称谓差**（如《第9章 多元函数》↔《第六章
  多元函数微分学》）留给后续那枚功能（在册归属＝梳理屏，见 [REQ-138 行](2026-10-23-admin-render-and-kp-review-workspace.md)
  「课程有两本以上教材梳理完毕后在该屏做跨书知识点合并」与 [REQ-143 壳](2026-10-26-kp-generation-leg-and-one-click-summary.md)
  第三行「知识点合并梳理」钮）；本轮只保证**不再新增按书并行的机制**，不假装解决称谓差；
- **梳理与生成腿**（判章、剔前置后置、写 `summary`、写导读）＝REQ-143／REQ-141，本轮不碰；
- **课后练习面**＝[learning-practice-ui.md](../design/frontend/learning-practice-ui.md) 与 REQ-130 行；
  `qe_question.book_ref`（题目来源书）**不在退役范围**——那是题源列，与知识点表无关；
- **数据修复类写库动作**（现网 93 行的任何重写）＝D 类人工发令窗口，本壳只出只读清单与备份；
- **列的物理 DROP**＝生产库 ALTER 红线窗，取值见待裁点 U3。

## 前置条件

- 8900／8902 在跑且**改码后须重启 8900**（不热重载；`POST /api/v1/self-restart` 属用户操作）；
  8903 走 `web-ui/dist` 托管，前端实测前须 `npm run build` 并比对 `assets/index-*.js` 哈希。
- 库＝`qed_test`（2026-10-17 起三服务同钉该库，`qed` 生产库不在本轮范围）；本轮**零 DDL**（用户 R1：
  补充结构先记备用 JSON 列＝`qed_knowledge_point.meta`，其 DDL 注释已写明该用处）。
- 现网第二本教材 b12 的 af 工作区 0 行（实测），故真机双本段的前置＝b12 梳理完成（人工发令窗口）；
  demo 门 W1 先用真 payload 驱动合并腿，取替代与代价如实登记在 W1。
- 写库前须 dump `qed_knowledge_point` 全表到 `tmp/req145_kp_backup.json`（见「回滚」）。

## 现网取证（2026-11-01 只读，零改码）

**共享表形态**（脚本 `tmp/kp_course_shape.py` → `tmp/kp_course_shape.json`，库 `qed_test`）：

| 读数 | 值 |
| --- | --- |
| `qed_knowledge_point` 全表行数 | 93（**全部**属 `math_analysis`） |
| outline 行 | 11 枚，`book_ref` 恒 `mathanalysis-b05` |
| point 行 | 82 枚，`book_ref` 全 NULL |
| 一行带多来源（`anchors`∪`source_ref` 的 `ref_id` > 1） | 0 |
| `norm_key` 重复 / 强化键重复 | 0 / 0 |
| `aliases` 非空 / `meta` 非空 | 0 / 0 |

**课程在册四本**（`GET /learn/courses/math_analysis` 的 `derived.books`）＝
`b05 textbook(true, 82 条)`／`b12 textbook(true, 0 条)`／`b11 exercises(false)`／`b07 exercises(false)`。

⇒ **今日屏上没有两套结构**：b07 的提升行已按 T6 清除、习题集已被 T5 挡在门外。病灶是**潜伏的**，
它由提升腿的形状决定——第二本教材（b12）一梳理并提升就必然复现。三条机制锚：

1. [learn.py:1373](../../backend/qed_engine/api/learn.py#L1373) 逐本循环：每本各跑一次 `_sync_book_knowledge`；
2. [learn.py:1252](../../backend/qed_engine/api/learn.py#L1252) `replace_outline(course_id, book_ref, tree)`
   ＋作用域 [knowledge.py:378-380](../../backend/qed_engine/services/learn/knowledge.py#L378-L380)
   `WHERE node_kind='outline' AND course_id=%s AND book_ref=%s` ⇒ 章层**按书分片整片替换**，
   两本书＝两套并列章骨架（b05 11 章＋b07 8 章＝19 章同屏）；
3. [learn.py:1315-1318](../../backend/qed_engine/api/learn.py#L1315-L1318) 点层 `norm_key` 精确撞名者
   记 `skipped` 跳过、不撞名者各建行 ⇒ 同一个物在两本书里＝两行，**合并不发生**。

**归并覆盖面实测**（脚本 `tmp/kp_merge_sim.py` → `tmp/kp_merge_sim.json`，两份真 af 工作区
`tmp/afkp_b05.json` 352 行／`tmp/afkp_b07.json` 184 行，按现网纯净判据过滤后 b05＝11 章＋85 点、
b07＝8 章＋82 点）：

| 档位 | 章命中 | 点命中 | 合并后规模 |
| --- | --- | --- | --- |
| `norm_key` 原样精确（现腿） | 0/8 | 0/82 | 19 章＋167 点 |
| **强化字面键**（剥 `第X章`/`§ n.`/编号/标点） | **0/8** | **7/82** | 19 章＋157 行 |
| 模糊候选（字符集重合，供后续合并梳理功能用） | 2/8 | 75 对（涉 41/82 行） | — |

命中的 7 对全部是**写法差**（同一物、差在 `§ 编号`与标点）：`函数的极限`↔`§ 5. 函数的极限`、
`中值定理`↔`§ 3. 中值定理`、`泰勒公式`↔`§ 6. 泰勒公式`、`幂级数`↔`§ 5. 幂级数`、
`变量代换`↔`§ 4. 变量代换`、`面积的计算法`↔`§ 2. 面积的计算法`、`体积的计算法`↔`§ 3. 体积的计算法`。

⇒ 如实结论：**「字面归一命中即合」这一档能吃掉写法差，吃不掉称谓差**（《第9章 多元函数》与
《第六章 多元函数微分学》不同键，永不命中）。本轮的交付边界因此是**机制改道＋写法差归并**，
称谓差留给后续的合并梳理功能（非目标第二节）；这条限制必须写进设计正本，不许在界面上留下
「已合并完成」的误导表达。

**知识探索面现状**：`CourseKnowledge.tsx`／`kpTreeLayout.ts`／`KpTreeGraph.tsx` 三文件源码
`book` 字样**零命中**（实测 grep 无输出）⇒ 书透明在屏侧**已成立**，本轮做的是把它从「巧合」
升级为**守护断言**，并把读源的结构保证落在共享表侧。

## 裁决（2026-11-01 四问四答，用户原文）

- **R1 归并判据与范围**：「这里本身后续会有一个知识点合并梳理功能，我们本轮不动af表，只对共享知识点表
  进行梳理，其不依赖书籍和教程，直接对接课程，如果需要补充结构可以先记在备用的json列中，当前先
  **字面归一命中即合**，原理是第一个知识点梳理完毕后，第二本的梳理要合一次才到共享知识表中」。
- **R2 章层骨架**：「首本教材为骨架，异名进 aliases」。
- **R3 来源承载**：「**`book_ref` 完全退役**」。
- **R4 学习面按书推进**：「这条路还是按照之前的来」（＝上一轮 T4 口径一字不改：只列所选这本、
  换书回书架、到界提示说「这本」）。
- 另两条先前已答（同一轮问答）：「书要透明，不要在知识探索中出现」；「不做展示，没有梳理就是空，
  而且共享表不关心具体的教材」。

## 目标形态：共享表＝课程级一套结构（承载语义）

一行＝**课程级的一个「物」**（一个章或一个知识点），不是一本书的目录条目。逐列用处：

| 列 | 去书化后的用处 | 守护 |
| --- | --- | --- |
| `name` | 权威名＝**骨架本**（该课 `resources` 声明序第一本教材）的写法 | 后本不得改写（现状已如此） |
| `aliases` | 同物异名＝其他书／其他写法的称谓（幂等追加、按字面去重） | 重跑不增长 |
| `norm_key` | 原口径不动（全角转半角＋空白折叠＋小写），同父唯一由服务端校验承载 | 已有用例 |
| `meta.merge.key` | **强化字面归一键**＝本轮归并命中判据的落点（R1：补充结构先进备用 JSON 列，**零新列**） | 纯函数有单元用例 |
| `meta.merge.sources` | 该共享行对应的各本 `af_kp.node_id` 清单（`from_detail_id` 只留首建发放的那一枚） | 幂等 |
| `meta.merge.source_outline` | 点行所属的**来源书原章名**（骨架未命中该章时保留其信息，见待裁点 U1） | 只读不筛 |
| `anchors[]` | 多来源承载位：`{kind, ref_id=书id, page, snippet}`，来源书与页区间都在这里 | 按 `(ref_id,page)` 去重 |
| `source_ref` | 该物的**首来源**页窗（骨架本）；后本的页窗只进 `anchors` 不覆写 | 现状保持 |
| `book_ref` | **退役**（R3）：停写、停筛、停作归本判据 | 断言全表该列恒 NULL |
| `from_detail_id` | 提升幂等锚＝首建那一本的 `afkp-*`（一经发放不可变，ADR 0026 D10） | 已有用例 |
| `order_hint`／`kp_path` | 章骨架序＝骨架本目录序；课程级人工编排优先级不变 | 现状保持 |

「不依赖书籍和教程、直接对接课程」的机械含义＝**共享表的读写面里不再出现书维度的筛选键、分片作用域
与并列行**；`qt_books.roles` 的教材判据（T5）只在提升入口决定「哪本书有资格被梳理」，落进共享表后
书身份只以 `anchors[].ref_id` 存在，不再以列、不再以作用域、不再以并列行存在。

## 归并流程：梳理一次＝合一次（落笔前先合）

```
POST /learn/courses/{course_id}/knowledge-points/sync      （唯一入口，页头「刷新」即它）
  └─ Step1 取该课 textbook 角色书（_is_textbook 判据不动）按 resources 声明序 → books[]
             books[0] ＝ 骨架本（R2）
  └─ Step2 逐本读 ④ 工作区纯净层（_kp_split_workspace 判据不动）；非教材／零纯净章且本腿无笔迹
             → 整本跳过并逐本报数（现状保持）
  └─ Step3 章层「课程级骨架 upsert」（替换按书整片替换）：
             merge_key(章名) 命中骨架章 → 复用行：name 不改；异写法进 aliases；
                                        该书页窗与锚进 anchors；af 节点 id 进 meta.merge.sources
             未命中 → 取值见待裁点 U1（甲＝不建行、其下点挂最近前序骨架章并记
                     meta.merge.source_outline；乙＝建行；丙＝建行但打 provisional 不画）
  └─ Step4 点层「命中即合」：
             课程内按 merge_key 建桶（不再按书建桶、不再用 norm_key 精确桶）
             命中在册点 → 复用行：异名进 aliases；页窗进 anchors；parent_kp_id 保持原值不改；
                            summary 只补空不覆写；order_hint 不改值
             未命中     → 新建 point 行挂 Step3 解析出的骨架章；解析不出 → 报 detached、不建行
  └─ Step5 逐本报数：{book_ref, ok, chapters:{hit, aliased, anchored, created, detached},
             points:{hit, aliased, anchored, created, skipped, unmatched_outline}}
             created 只在真新建时非零 ⇒ 「又写了一套并行结构」在账面上可直接指认
  └─ Step6 幂等防线：同一本重跑 N 次，aliases 与 anchors 长度不增（按字面与 (ref_id,page) 去重）
```

流程里**没有**「先清后写」的整片替换动作，也**没有**按书的第二套骨架：这是本轮对病灶的正面处置。

## 展示流程：知识探索面（书透明、只从共享表取数）

```
#/knowledge                       领域层＝星图（不动）
#/knowledge?course={course_id}    课程层＝层级星图
  读源  GET /learn/courses/{course_id}/knowledge-points?include_outline=true
        ⇒ 只出共享主表行；sequence 不参与（它只在已加入学习时非空，本面是只读浏览面）
  画    node_kind=outline ∧ depth=1 → 虚框，纵向堆叠序＝order_hint（骨架本目录序）
        其余行按 parent_kp_id 归框（父为节行时归到该节所在框，现状规则不动）
  「一套骨架」的判据搬家  由「行的 book_ref 不同」变成「merge_key 不同」
        ⇒ 去书化后同一课程只可能有一套 depth=1 序；两本书的章要么同一行（异名进 aliases），
          要么按待裁点 U1 处置，不再有「整片并行的第二套」
  悬停  名称＋summary（摘要空只显名称）；aliases 进不进提示＝待裁点 U2
  空态  「没有梳理就是空」＝该课零 outline 行时图区空态文案不变，
        不出现「整理中／几本书未梳理／来源书」一类说明（现有 §10 已定，本轮加守护）
  禁现  三文件源码级零 `book` 字样（含 book_ref／?book=／书名）＝新守护用例；
        `?course=` 之外不引入任何书参数
```

## 学习面读法随步（R4 口径不变、承载位搬家）

- 可观察行为**一字不变**：T4「只列所选这本、换书回书架」、到界提示「已经到这本最后一条：回书架选
  另一本。」、书架教材卡 `N/M 条` 按本归集。
- 机制搬家：归本位派生链由 [learn.py:306／320](../../backend/qed_engine/api/learn.py#L306)
  的「点自身 `book_ref` → 父章 `book_ref` → 课程首本」改为
  **「`anchors[].ref_id` ∪ `source_ref.ref_id` 覆盖这本 ⇒ 该行属于这本」**；父章 `book_ref` 回落随之删除。
- 必然推论（须写进设计正本，不隐藏）：归并后的同一行会**同时出现在覆盖它的每一本的序列里**。
  今天不会（两本书不共行）。这与 T4 不冲突——列的是「这本覆盖的行」，不是「这本独有的行」；
  进度仍课程级（`derived` 口径不变），因此一本读完的行在另一本里也显示为已学。

## 待裁点（U1~U4，未答不默认采纳）

- **U1 骨架未命中章的处置**（R2「首本教材为骨架」的严格度）：
  甲＝**不新建章行**，该书该章下的点挂到页序最近的骨架章，原章名记在点行
  `meta.merge.source_outline`。骨架恒一套，代价＝后本书独有的内容被并进邻章、屏上看不到该书的结构；
  乙＝新建章行（骨架变并集），代价＝探索面可能出现非骨架章并列，仍要后续合并梳理功能收；
  丙＝新建并打 `meta.merge.provisional=true`，探索面**不画**未确认章，代价＝后本书的点暂无框可挂、
  图区可能空。
- **U2 `aliases` 进不进探索面悬停**：甲＝不进（守 design §11「学习面信息面收窄」，异名属编辑侧信息，
  且书透明原则下不能写书名）；乙＝进（学习者可见另一写法，但不注明出处）。
- **U3 `book_ref` 退役的物理形态**：甲＝本轮只**语义退役**（停写停筛＋守护断言恒 NULL），
  物理 DROP 另批走红线窗；乙＝本轮连列一起 DROP（需 `qed` 生产库 ALTER 窗与
  `database-design.md`／ADR 0026 随步，代价＝回滚窗口窄）。
- **U4 人工整树写面（`GET|PUT /learn/courses/{course_id}/outline`）的去书化形态**（本轮晋升文档时**新识别**）：
  该端点对里 `book_ref` 既是**分片作用域**也是必填请求键（`min_length=1`），消费者＝前端
  `getOutline(courseId, bookRef)` 与 `putOutline(body.book_ref)`，而整树写入正被学习面 §11「待用户复核 ③」
  的自动生成旧通路调用。`book_ref` 退役后一次整树重写的作用域＝**全课骨架**，会覆写归并结果。
  甲＝请求键摘除（`extra=forbid` 下旧调用方 422，前端与自动通路同批改）；
  乙＝请求键留作**来源快照**（只记不筛、不作分片），需另定命中与覆写规则；
  丙＝该端点对随自动生成通路的裁决一并退役。**未裁前不动码**；文档侧只在 `api-contracts.md` §⑥
  的 PUT 行与 `learning-course-ui.md` §11 待复核 ④ 各留一处指针，不预设取值。

## 工作项

| 条目 | 内容 | 状态 |
| --- | --- | --- |
| W1 | **demo 门**＝核心场景最小可跑：以 `qed_test` 现网 `math_analysis` 为场，b05 作骨架本提升（现网已在册），再取**第二本真 payload**（`tmp/afkp_b07.json` 的 8 章＋82 点真行）走同一条归并腿，断言＝章骨架仍 11 行、命中的 7 对合成一行且 `aliases` 有值、`anchors` 两本都在、`created` 只等于真新建数、重跑一次零增长；8903 `#/knowledge?course=math_analysis` 仍只一套虚框、三档宽度（1600/1200/860）零书影读数。到门暂停待人工验收。**真数据双本的现网段**（b05＋b12 两本真教材）前置＝b12 梳理完成，登记在 W6 补测，不作本门前置 | 未开始（待「开始执行」＋写库人工发令） |
| W2 | 归并判据成文与落点：`merge_key` 纯函数落 `services/learn/knowledge.py`（`norm_key` 口径不改），`meta.merge.{key,sources,source_outline}` 三键契约与承载表进 `database-design.md`；单元用例含实测 7 对真数据样本与「称谓差不命中」反例 | 成文段**已达成**（2026-11-01 四正本随步）；函数与用例段未开始（待「开始执行」） |
| W3 | 提升腿改道：`_sync_book_knowledge` 章层课程级骨架 upsert＋点层 `merge_key` 命中即合；`replace_outline` 作用域改道（或另立课程级 upsert 腿）；逐本报数扩键；`tests/test_learn_knowledge.py` 契约用例先行 | 未开始 |
| W4 | `book_ref` 退役：写入面停写（`flatten_outline`／`add_point`／`replace_outline`）、读面停筛（`list_outline` 的 `book_ref` 过滤、`owned` 判定改按 `meta.merge.sources`）、`_course_tree` 归本位改 `anchors` 派生；**响应键随步**＝`…/knowledge-points` 的 `chapters[]` 与 `…/outline` 顶层及行内该列；**`GET|PUT …/outline` 端点对的去书化按 U4 取值落地**（含前端 `getOutline`／`putOutline` 与自动生成旧通路，一次整树重写＝覆写全课骨架的风险在此收）；守护断言该列恒 NULL；U3 取值落地 | 未开始（契约与设计侧的**登记段**已于 2026-11-01 随步，含 U3／U4 指针） |
| W5 | 探索面与学习面正本随步＋守护：源码级零 `book` 断言（三文件）、`knowledge-point-exploration-ui.md` §9／§10／§11 补「一套骨架来自课程级归并」与「写法差可合、称谓差留后续」的可见口径，`learning-course-ui.md` §5.1／§10 改归本位派生链与「共行同现于两本」推论 | 正本随步段**已达成**（2026-11-01，含 §11 三条新守护规则与降级矩阵新行）；源码级守护用例未开始（待「开始执行」） |
| W6 | 现网真双本复跑（b05＋b12，b12 梳理完成后）：只读清单 → 备份 → 提升 → 读数回填壳；写库归人工发令 | 后置（待 b12 梳理与人工窗口） |

## 过程与证据

- 2026-11-01｜用户令「详细梳理知识探索部分的改造……整理详细流程进行展示的详细流程，确认好流程落文档，
  然后再实现」。按 `qed-intake` 定级＝**大修改**（改 `docs/design/` 两份正本的行为口径＋
  `docs/architecture/` 两张正本的承载语义），前置动作＝本行＋本壳，评审确认后才动文档正本与代码。
  承载选择＝**新建支线行 REQ-145**（先找承载已做：REQ-144 行 S 判据冻结且范围是学习面，
  ARCH-027-M4 行判据是「轻形态维持」，加条目即扩载；本轮需独立设计评审，按 ADR 0021 立行不挤既有行）。
- 2026-11-01｜只读取证三件（脚本与产物均 gitignore 内的 `tmp/`）：
  `tmp/kp_course_shape.py`→`tmp/kp_course_shape.json`＝共享表 93 行全貌（11 outline 全带
  `book_ref=mathanalysis-b05`、82 point 全 NULL、`aliases`/`meta` 全零、单源、`norm_key` 与强化键重复 0）；
  `tmp/roles_now.json`＝`derived.books` 四本读数（b05/b12 textbook、b11/b07 exercises）；
  `tmp/kp_merge_sim.py`→`tmp/kp_merge_sim.json`＝两本真 payload 的归并覆盖面（章 0/8、点 7/82，
  合并后 19 章＋157 行；`short_key_count`＝0 即无「两字短键误合」风险）。
- 2026-11-01｜`grep -n "book\|Book"` 对 `CourseKnowledge.tsx`／`KpTreeLayout`／`KpTreeGraph` 零命中，
  确认书透明在屏侧已成立，W5 只做守护加固。
- 2026-11-01｜四问四答出裁 R1~R4（原文见「裁决」节），流程稿 v2 按此重写：v1 曾提议「把书做成一层」，
  被用户「书要透明，不要在知识探索中出现」整案判退，已作废不落文档。
- 2026-11-01｜本壳建立，状态 Accepted，等用户评审流程与 U1~U3 裁决；未获「开始执行」前零改码、
  零设计正本改写、零写库。
- 2026-11-01｜用户裁「这条推论可以，学习中心·知识探索部分没有什么问题，可以先确定文档并梳理一致性
  问题，然后提交git」⇒ R3×R4 的**共行推论成立、流程通过**；据此把流程晋升进四张正本——
  `database-design.md`（§五 该表小节加「归并键与课程级承载」段与逐列用处改写、4.2 血缘行、
  7.8 新行 T13 登记列仍实存与物理 DROP 归人工窗）、`api-contracts.md` §⑥（序列化段两枚键位、
  sync 行的骨架 upsert 与命中即合与扩键报数、`…/knowledge-points` 的 `chapters[]`、
  `GET|PUT …/outline` 两行、归本位条）、`knowledge-point-exploration-ui.md` §9／§10／§11、
  `learning-course-ui.md` §5.1／§10／§11；固定文档守 R12（正文只写事实与规则，一次性事实落备注列
  与 7.8），未落码段在契约与设计行内**显式标注「现网腿仍…、改道由 REQ-145 W3／W4 承接」**，
  不许读者把目标形态当已实现。**本轮零改码、零写库。**
- 2026-11-01｜一致性清扫四处发现并随步处置：① `api-contracts.md` 的 `meta` 指针指向
  `database-design.md`「meta 扩展槽守则」**该节不存在**（实际落点＝二章 R7 与 §五 该表小节）→ 改指；
  ② `design/index.md` 学习面行描述陈旧到 REQ-144 之前（仍写「右栏『学习交流』三段／按需生成与点赞」）
  → 按现形态重写为四段批注＋三枚居中置底＋按书切序列，知识探索行实现状态随步改 `In Progress`；
  ③ `…/knowledge-points` 的 `chapters[]` 与 `…/outline` 响应仍带 `book_ref` → 登记进 W4 的响应键随步项；
  ④ **新识别 U4**（人工整树写面 `GET|PUT …/outline` 的分片键退役形态；退役后一次整树重写＝覆写全课骨架、
  会抹掉归并结果）→ 壳内待裁点＋契约 PUT 行＋学习面 §11 待复核 ④ 各留指针，不预设取值。
- 2026-11-01｜壳状态 Accepted → In Progress（成文与随步段随本次文档晋升达成，函数／用例／改码段仍等
  「开始执行」）；**U1~U4 全部未裁**，未答者不默认采纳。
- 2026-11-01｜收尾随步＝① 在途的 [REQ-144 壳](2026-10-30-learn-course-clean-reading-core.md)「过程与证据」
  补一枚指针（归本位承载源改道、三级回落随之删除，但 T4「按书名读、换书回书架」的用户令一字未改；
  共行推论使归本位成为**多值**；U4 未裁前该壳既有通路照常运行），防后来者照旧判据重做回落腿；
  ② [project-status.md](../trackers/project-status.md)「当前主线」新增本轮定档条目。
  门禁＝`pytest tests/contract -q` **89 passed**／`pytest tests -q` **909 passed**／`ruff check backend tests` 净；
  前端本轮零改动，三门禁未跑。

## 验证与验收

- 后端：`D:/software/anaconda3/envs/QED_env/python.exe -m pytest tests/test_learn_knowledge.py tests/test_learn.py -q`
  先行红后绿，收尾跑 `pytest tests -q`＋`pytest tests/contract -q`＋`ruff check backend tests`。
- 前端：`web-ui/` 内 `npx tsc -b`、`npx vitest run --no-file-parallelism`、`npm run build`；
  8903 真机按 `qed-frontend-check` 三档宽度（1600/1200/860）实测探索面与学习面各一次，
  请求全部指向 8900、零 4xx/5xx、零跨界跳转。
- 数据侧判据（可指认读数，回填本节）：归并前后共享表行数与 `aliases`／`anchors` 非空计数、
  逐本 `created` 计数、重跑幂等差值、`book_ref` 非 NULL 计数＝0。
- 人工验收：W1 到门暂停；写库动作逐条发令，先只读清单＋备份。

## 回滚

- 写库前 dump `qed_knowledge_point` 全表（现网 93 行）到 `tmp/req145_kp_backup.json`，
  回滚＝按备份整表重写；**上一轮的 `tmp/w10_b07_backup.json` 不得先删**（REQ-144 收口仍在等人工验收）。
- 代码回滚保持单提交粒度；本轮零 DDL，U3 取甲时列不动 ⇒ 读面回滚＝恢复 `book_ref` 回落那一处。
- 设计正本与契约回滚＝git revert 单提交。

## 关闭与归档

- S1~S5 逐条对照台账行关闭（ADR 0023 决定 6）；W6 属后置补测，按「移交型关闭的取值」判定：
  S 条目全达成、残余仅为 b12 梳理窗口时记 `Achieved`，否则 `Partial` 并列未达成项。
- 关闭结果与门禁输出写 `completed.md` 证据列，过程留本壳；归档判定 Retain。
