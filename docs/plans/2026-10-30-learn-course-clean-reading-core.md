# 课程学习面接梳理成品・最简核心阅读闭环（learn-course-clean-reading-core）

状态：In Progress
任务类型：B
最后更新：2026-10-31
关联 ADR：[ADR 0007](../history/adr/v0.1/0007-qed-engine-backend-gateway.md)（前端只连 8900；梳理成品经 ④ 透传面读，学习域读写经 ⑥ 自有面）、
[ADR 0016](../adr/0016-todo-registration-one-task-one-plan.md)（一任务一行一壳）、
[ADR 0023](../adr/0023-todo-row-carries-scope-and-criteria.md)（成功标准正本在台账行、进展只落本壳）、
[ADR 0024](../adr/0024-preschema-rebuild-tiers-and-demo-gate.md)（范围锁死＋B 类壳首工作项的 demo 门）、
[ADR 0025](../adr/0025-database-design-master-doc-and-ddl-ownership.md)（前缀即所有权：`af_kp` 归对方，本仓只经 HTTP 消费）、
[ADR 0026](../adr/0026-v1-root-table-family-freeze.md)（D2 `qe_unit` 退役＝序列读时投影；D5 主表三列与长文不落库；D10 主表唯一产面＝`POST /learn/knowledge-points`）
关联设计：[frontend/learning-course-ui.md](../design/frontend/learning-course-ui.md)（本面设计正本，§4／§5.1／§5.2／§6／§7／§9 随步）、
[api-contracts.md](../architecture/api-contracts.md) §④（④ 梳理透传面）与 §⑥（⑥ 学习域序列与落笔面）、
[database-design.md](../architecture/database-design.md)（`qed_knowledge_point` 与 `qe_learning` 列域正本）、
[frontend/knowledge-point-exploration-ui.md](../design/frontend/knowledge-point-exploration-ui.md)（梳理屏＝章点结构态的写入面，本轮不碰）、
[frontend/parsing-ui.md](../design/frontend/parsing-ui.md) §9（中栏正文渲染共用的渲染腿）、
[REQ-143 壳](2026-10-26-kp-generation-leg-and-one-click-summary.md)（第九／十令：章＝章节、节＝知识点与生成腿的在册口径）、
[REQ-141 壳](2026-10-24-kp-review-screen-and-kp-passthrough.md)（④ 七条透传与「`af_kp` 为章点结构态唯一事实源」的改判）
关联 Tracker：docs/trackers/todo.md（REQ-144 任务行登记在学习设计轮节＝四段收口顺序 ② 课程学习段的承载行；分线归属＝ARCH-027 主链 M-1）
归档判定：Retain（三案取舍的现网取证、`from_detail_id` 幂等锚的实核缺口、以及右栏由三段收敛为四段闭集的前后对照属不可替代的过程记录）

> **用户 2026-10-30 令（本壳口径正本，与其他条文冲突时以本令为准）**：继续课程学习部分的开发；
> 梳理部分已完成、本轮忽略，学习面**正式按梳理后的知识点目录**（只含梳理后纯净的章节与知识点）、
> **干净的正文**（不加「这一条读完了：点「下一条」接着学。」这类干扰语，正文最下只留三枚按钮且居中置底）、
> **批注**（只包含本章总结、本章学习导读、知识点是知识点时的知识点总结，最后一条 note 用作记录；
> 不写注释干扰、不写默认值，最多只有这四条）。按第一性原理**本轮只做最简核心功能实现**，
> 具体操作全在使用手册，正式页眉不得出现任何指导用户的东西。右下方聊天对话属后续，**本轮完全不做**。

## 目标与成功标准

**目标**＝把课程学习工作台从「读根侧一份几乎没有内容的投影」改成「读梳理成品、干净阅读、四段批注、
三枚推进」的最简核心闭环：一条课程链路＝目录（章 → 知识点两层纯净）→ 正文（原书页码派生的连续流，
零指导语）→ 批注（至多四段、缺位不渲染）→ 推进与记录（三枚按钮居中置底）。

成功标准条目化判据的正本在台账行（ADR 0023），本壳只承接其拆解与执行；行内 S1~S5 与本壳
工作项的对应＝S1→W2、S2→W4、S3→W5、S4→W2＋W7（T1 已裁乙，甲案的 W3 作废）、S5→W7。

## 范围与非目标

**范围内**：

- 学习面阅读单位的数据源通路（现网断层的确切处置，见「待裁点」T1）；
- 中栏正文的净化（删三句 secondary 话术）与推进三枚的位置形态（居中・置底）；
- 右栏由「学习交流三段＋提问入口」收敛为**批注闭集至多四段**（本章总结／本章学习导读／知识点总结／记录），
  缺位不渲染、不写默认值；
- 页眉与界面零指导语（具体操作全部迁到使用手册 `help/sections.ts` 课程学习册）；
- 上述改动牵动的守护（`learnPlaneCopy.test.tsx` 必含词与禁词表、`helpPages.test.ts`、
  设计正本 §4／§5.1／§5.2／§6／§7／§9 随步）。

**非目标（各给指针）**：

- **梳理与生成**：判章、剔前置后置、写 `summary`、写长文导读——一律归梳理屏与
  [REQ-143 壳](2026-10-26-kp-generation-leg-and-one-click-summary.md)（第九／十令），本轮不碰其代码与形态；
- **聊天／问答／RAG 对话**（用户令＝本轮完全不做）：现存的「提问」输入框＋置灰发送＋「暂未开放」段
  按本令**删除**，不保留入口，功能归 [ARCH-027-M4 壳](2026-09-23-knowledge-exploration.md)；
- **课后练习联动**＝[learning-practice-ui.md](../design/frontend/learning-practice-ui.md) 与 REQ-130 行；
- **判分与质性门**（M-3 的量化腿）＝练习面落地后才成立，本轮只保「已掌握」勾选与备注可持久，
  不接判分；
- **`af_kp` 的形状与列**＝对方 `docs/design/knowledge-analysis.md`；本轮零新列零 DDL；
- **脏页区间的数据修复**（见取证「脏数据两处」）＝写库动作，归人工发令，本壳不修数据。

## 前置条件

1. ~~用户对本壳 **T1（数据源三案）／T2（右栏生成入口去留）／T3（中栏摘要直排去留）** 出裁——未裁不动码~~
   **已满足＝2026-10-30 四问四答全部出裁**（T1 乙／触发点 页头刷新／T2 不留／T3 删，见「裁决回填」表）；
2. 8900 与 8902 在线且现网工作库＝`qed_test`（三服务同钉，见项目状态快照）；
3. 梳理成品已在册：`mathanalysis-b05` 与 `mathanalysis-b07` 各有一批 `candidate` 行（取证见下节）；
4. 若 T1 裁乙：契约 §⑥ 与 `tests/test_learn_knowledge.py` 的同步用例**先行**（先红后绿），
   `qed_knowledge_point` 零 ALTER（列域正本＝[database-design.md](../architecture/database-design.md)）。

## 现网取证（2026-10-30 只读，零改码）

**探针与读数**（脚本与产物在本仓 `tmp/`，逐条可复取）：

| 探针 | 产物 | 取到什么 |
| --- | --- | --- |
| `tmp/learn_probe.py` | `tmp/learn-probe.json` | ⑥ 面 `/learn/courses/{id}/knowledge-points` 的 `sequence` 与主表行形状 |
| `tmp/kp_live_probe.py` | `tmp/kp-live-report.json` | ④ 面 `/books/{id}/kp` 的在册行（`gen_status != rejected`）分布 |
| `curl /api/v1/learn/courses` | `tmp/courses.json` | 课程 ↔ 教材绑定与 `derived` 计数 |

**结论一・学习面现网几乎无内容可读**：`math_analysis` 绑四本（b05／b12／b11／b07）而 `derived.total = 1`，
`linear_algebra` 绑 `linearalgebra-b01` 而 `total = 0`——根侧 `qed_knowledge_point` 的投影序列只有一条。

**结论二・梳理成品在 `af_kp` 侧是齐的**（在册＝非 `rejected`）：

| 册 | 在册行 | 层分布 | `summary` 覆盖 | 页两键 | `narrative_ref` | `confirmed` | `toc_role` |
| --- | --- | --- | --- | --- | --- | --- | --- |
| b05 | 140（批次 `afkp-dc751909d316`＝118＋`afkp-4d163932193f`＝22） | outline d1＝20／outline d2＝98／point＝22 | 28（d1 层 0／d2 层 6／point 层 22） | 140/140 | **0** | 全 0 | knowledge 118／reference 22 |
| b07 | 92（单批次 `afkp-a75028bcd608`） | outline d1＝10／outline d2＝82 | 53（d1 层 5／d2 层 48） | 92/92 | **0** | 全 0 | knowledge 90／reference 2 |

由此三件硬事实：正文页区间可直接由 `page_start`／`page_end`（对方 KA-42）派生，覆盖率 100%；
「本章学习导读」盘上**暂无一篇正文**（`narrative_ref` 全空，章级导读属第九令 W25 未起步）；
在册行**全部 `confirmed=0`**——以确认位为消费门即整面空，与用户「梳理已完成、可以直接读」的判断不同形。

**结论三・「纯净」在数据上有明确可切的键**：`toc_role=reference` 者即前置后置——b05 的 22 行是
前言／重要符号表（页 5–310，明显是锚派生过宽）／习题×2／参考书目／附录，b07 的 2 行是前言×2。

**结论四・脏数据两处（本轮不修，只登记）**：b05「第6章 RIEMANN-STIEL. TJES积分」`page_start=7`、
b07「§ 2. 反函数的导数……隐函数的导数」`page_start=7 / page_end=95`＝第九令 DEFECT-027 的锚落目录页
残留在页两键上的形态；修它要重跑目录腿（写库，归人工发令）。

**结论五・断层的确切位置与在册的正本口径**：

- 学习面读源＝`_course_tree()`（`backend/qed_engine/api/learn.py:250`）＝根侧主表 outline×point 的读时投影；
- 落笔门＝`_tree_or_404()`（同文件 `:326`），`set_progress` 先过此门（`:698`）⇒ **投影序列里没有的键，
  勾选与备注一律 404**；派生进度、断点、结课判定的计数单位也全挂在投影行上；
- 提升腿在册但未落地：`POST /learn/knowledge-points` 的 `from_detail_id` 注为「提升幂等锚＝
  Axiom-Flow `af_kp.node_id`」，契约明写「AF 同步腿复用本端点」（`docs/architecture/api-contracts.md:1091`
  与 `:1121`，列域注释见 `backend/qed_engine/services/learn/knowledge.py:61`）；
- 实核缺口两处（乙案必须处理，不能只喊复用）：`add_point()` 不按 `from_detail_id` 查重、
  只按 `(course_id, norm_key)` 判 409（`knowledge.py:204-224`），且 INSERT 把 point 行的
  `depth`／`book_ref`／`source_ref` 恒写 NULL（`:228-236`）⇒ 同步腿取页窗只能走 `anchors`
  二级回落，而 `af_kp` 锚的 `ref_id` 现网是页 id（`p0005`）不是书 id，须在同步时归一。

**结论六・要清的干扰语与默认值已逐处定位**（源码行号为取证当日实况）：

| 位 | 现文 | 落点 |
| --- | --- | --- |
| 中栏未选中 | 「在左栏选中一条知识点，正文就排在这里。」 | `web-ui/src/pages/LearnWorkbench.tsx:325` |
| 中栏无页窗 | 「这一条还没有定位到书页：等这一章的知识点整理好就能读正文，也可以先在右栏记一条备注。」 | 同文件 `:340` |
| 中栏读到尽头 | 「这一条读完了：点「下一条」接着学。」 | 同文件 `:380`（设计条文＝`learning-course-ui.md` §5.2 第 7 款） |
| 右栏无注解 | 「这一条还没有注解：点「生成本条注解」先来一条。」＋未选中提示 | `web-ui/src/components/learning/AnnotationPane.tsx:109,125` |
| 右栏提问段 | 输入框＋置灰发送＋「提问功能暂未开放」 | 同文件 `:137-143`（用户令＝本轮完全不做） |
| 右栏章段 | 「这一章还没有总结：点下面生成一次就存下来。」＋生成钮 | `web-ui/src/components/learning/ChapterNotePane.tsx:41,59` |
| 右栏备注段 | 未选中提示 | `web-ui/src/components/learning/AnnotationForm.tsx:61` |
| 推进按钮位置 | 在正文滚动容器内 `marginTop:12`（不居中、不置底） | `web-ui/src/pages/LearnWorkbench.tsx` 的 `AdvancePane` 装配位 |
| 守护随步 | 必含词表与断言 | `web-ui/src/pages/learnPlaneCopy.test.tsx:47`、`helpPages.test.ts:74`、`LearnWorkbench.test.tsx:442,485,577,597`、`AnnotationPane.test.tsx:163,203` |

## 待裁点与裁决（T1~T3＋触发点・2026-10-30 四问四答；真机走查追加 T4~T6・2026-10-31 三问三答全部出裁）

**裁决回填（用户 2026-10-30 四问四答＋2026-10-31 真机走查追加三问三答，动码即按此定档）**：

| 问 | 裁值 | 后果 |
| --- | --- | --- |
| T1・阅读单位数据源 | **乙・补提升同步腿** | 8900 新增一枚同步端点（在册 `af_kp` 成品 → 共享主表）；甲案整段不采、W3 作废；学习面读源／进度／备注／结课判定零改 |
| 触发点（乙的前提） | **页头「刷新」＝同步＋重取** | 进面只读不写；「刷新」先同步该课教材的在册成品再重取目录与序列；操作正文写进使用手册，页眉零指导语 |
| T2・右栏生成入口 | **不留，纯只读四段** | 学习面「生成本章总结与学习要点」「生成本条注解」两枚钮与其话术删除；`POST /learn/annotations/generate` 的学习面消费腿退出（端点保留、消费面只剩梳理屏）；缺位整段不渲染、零默认值 |
| T3・中栏摘要直排 | **删，正文只留书页内容** | 设计正本 §4 中栏形态与 §5.2 第 1 款的摘要位随步改判；知识点总结只出现在批注段③ |
| T4・一门课多本教材时按什么单位读（2026-10-31 真机令） | **按书名读，只列所选这本** | 左栏目录／中栏序列／上一条下一条／断点落点全部按行自带 `book_ref` 切到书架带进来的那一本；换书＝回书架点另一本「进入学习」，本面**不加书切换控件**；进度口径不变（`derived` 仍课程级、教材卡进度仍按本计数） |
| T5・习题集（`exercises`/`solutions`）在课程学习面的去留 | **退出本面，判据落服务端一处** | 8900 直连共享库取 `qt_books.roles`：`GET /learn/courses` 的 `books` 元素附 `roles`，提升同步腿对非教材整本跳过（新增报数键 `skipped_role`），书架与工作台只列 roles 含 `textbook` 者；前端不再引第二个数据源做角色判断 |
| T6・b07《数学分析习题集》这次已被提升的 8 章 82 条 | **现在就清** | 按提升锚（`from_detail_id` 为 `afkp-*` 且 `book_ref=mathanalysis-b07`）反查删除该本的章行与其下 point 行；清理排在 W9 判据落码并重启 8900 **之后**执行，否则页头「刷新」会立刻把这批行再提升一次 |

**T1・阅读单位的数据源走哪条通路**（三案取证见结论五；已裁乙，甲／丙按原样存档备查）：

| 案 | 内容 | 代价 | 与在册文档的关系 |
| --- | --- | --- | --- |
| **甲・学习面直读 `af_kp`** | 8903 序列改吃 ④ 透传面 `GET /api/v1/books/{id}/kp`，主表在学习面退出 | `_tree_or_404()` 的落笔门须改判（键＝`afkp-*` 直写 kp 行），`derived` 计数／断点／结课全部要把 ⑥ 的投影源换成服务端读 `af_kp` 汇合 ⇒ ⑥ 学习域序列整段搬到 ④ 之上 | 与 ADR 0026 D5「主表只存已确认知识点」和 ARCH-025-L2 S5「确认后的知识点树写共享主表并可被课程学习段消费」正面冲突，须改判两处在册文档 |
| **乙・补提升／同步腿（推荐）** | 8900 侧新增一枚同步端点：逐本读在册 `af_kp` 行 → 章层走 `PUT …/outline`（整树幂等、带 `book_ref`＋`source_ref`＋`summary`）、知识点层走 `POST /learn/knowledge-points`（`from_detail_id`＝node_id，先按锚与 `norm_key` 查重跳过，`anchors` 的 `ref_id` 归一为书 id） | 一枚新端点＋契约 §⑥ 一行＋同步用例；主表多一批「机器直登记」行（写入即承载确认，正是 D10 的口径）；重跑时的覆写口径要定（`summary` 是否回灌、缺席者是否下线） | 承接 ARCH-025-L2 S5 与 ADR 0026 D10 的原设计，学习面读源、进度、备注、门与结课**零改** |
| **丙・前端编排（零后端码）** | 工作台刷新时由 8903 依次调 `getKpWorkspace` → `putOutline` → `POST /learn/knowledge-points` | 一次同步散成 N 次 HTTP，幂等与失败恢复全在浏览器里；翻页即写库、人工难归因 | 与「前端不编排生产、8900 是唯一门面」的取向相悖 |

推荐＝**乙**：判据是它本就写在两处正本的口径里（S5＋D10＋契约「AF 同步腿复用本端点」），
甲要改判文档、丙要把事务放错地方；乙的唯一新事实是「同步键与覆写口径」，属本壳可一次定清的范围。

**T2・右栏还留不留「生成」入口**（已裁＝**不留**）：盘上 `summary` 覆盖率＝章层 b05 0/20、b07 5/10（结论二），
裁值取「四段纯只读＋记录、缺位不渲染」，生成动作全部归梳理屏（REQ-143）。

**T3・中栏标题下要不要直排该条摘要**（已裁＝**删**）：设计正本 §4 现文「标题下先直排该条摘要再接正文」
与批注段③「知识点总结」重复，取「正文只留书页内容」。

**已裁（用户 2026-10-30 令，不再询问）**：目录只含纯净章节与知识点（切法＝在册非 `rejected` 且
`toc_role != reference`，层判定＝第十令的 `depth 1/2`）；正文零干扰语；推进三枚居中置底；
批注闭集至多四段且零默认值；提问与聊天本轮零承载（现段删除）。

## 纯净目录的过滤口径（T1 裁乙后的落笔细则）

交叉取证（`tmp/kp_xtab.json`，在册＝非 `rejected`）给出的真实层分布，是本轮过滤口径的唯一依据：

| 册 | 章层 outline d1 | 节层 outline d2 | 遗留 point 行 | 其中 `toc_role=reference` | d2 失父者 |
| --- | --- | --- | --- | --- | --- |
| b05 | knowledge 11／reference 9 | knowledge 85／reference 13 | 22（全部 knowledge，父级＝d2 为主，另有 2 枚直挂 d1） | 22 | 0 |
| b07 | knowledge 8／reference 2 | knowledge 82／reference 0 | 0 | 2 | 0 |

由此定三条口径（都是数据上可直接执行的一句话，不留解释空间）：

1. **纯净＝两道过滤**：`gen_status != 'rejected'` ∧ `toc_role != 'reference'`——b05 由此剔掉 9 枚章行与
   13 枚节行（前言／重要符号表／习题×2／参考书目／附录一类），b07 剔掉 2 枚前言章行；
2. **知识点层＝`depth=2` 的节行**（第十令「章＝章节、节＝知识点」），根侧落成 point 行挂在所属章下，
   **节层在界面上不显形**（沿用设计正本 §1 成功标准 ①「章＋知识点两级」）；
3. **b05 的 22 枚遗留 point 行不入目录**——它们的页区间与父节重合（实测同为 `9..9`、`18..18` 一类），
   进目录即同一段正文读两遍；且第十令已判「内容批次不再建点行」。其 `summary` 不随本轮丢失，
   仍留在 `af_kp` 侧，归梳理屏处置，本轮不搬。

同步落笔的其余细则（2026-10-30 W2 落地口径）：**读腿＝④ 整册工作区 `GET /api/v1/books/{book_id}/kp`，
不取 `kp/export`**——后者是 `confirmed=1` 视图，而现网 `af_kp.confirmed` 恒 0（取证结论一），走那扇门
同步结果永远为空。章行走 `replace_outline`（按 `(parent, norm_key)` 复用 kp_id，整树幂等，
缺席者删并把其下 point 行归未归档池）；知识点行**先按 `from_detail_id` 查重复用**（改走 `patch_point`
刷归属／序／页窗／锚／摘要）、无锚者再走 `add_point`（`from_detail_id`＝`afkp` node_id），
**撞课内同名则跳过并报数**（`add_point` 只按 `(course_id, norm_key)` 判 409，跨两本教材同名节会撞，
同步腿必须自己吞掉这一路而不是整批失败）；`anchors` 的 `ref_id` 在同步时归一为书 id（现网锚的
`ref_id` 是页 id `p0005`，直落会让 `_resolve_window` 取到错书）；章的 `from_detail_id`（＝`afkp`
node_id，既是幂等锚也是导读腿的取数键）经 `patch_point` 写。三枚**机器腿专用键**＝`from_detail_id`／
`source_ref`／`anchors` 只在进程内入参可达：`PointCreateBody` 未声明 `source_ref`、`PointPatchBody`
白名单不含这三键且 `extra=forbid` ⇒ 请求侧递进来即 422（守护用例
`test_machine_only_keys_stay_closed_on_human_faces`），零 ALTER、人工面零污染。
**根侧 `narrative_ref` 不由本腿复制**——对方该列是裸文件名，喂进根侧 jail 必 422（见下段），
复制过来只会造出一枚永远读不通的指针。

**批注段②「本章学习导读」的取数通路（2026-10-30 实核定档）**：导读长文**不落库**（ADR 0026 D5），
盘上只有 `af_kp.narrative_ref` 指向的 Markdown 文件，而对方 KA-20／KA-30 明写该列**只存单段文件名**、
完整路径 `<book_dir>/kp/<node_id>.md` 由对方读时现算。由此两条约束同时成立：

- 根侧 §⑥ 的 `GET /learn/knowledge-points/{kp_id}/narrative` 有 jail（只允许 `parsed/` 前缀，
  `backend/qed_engine/api/learn.py` 的 `_narrative_path`），**无法消费裸文件名**——直接喂 `afkp-*.md`
  即 422，这条路对导读段不可用；
- 唯一可用腿＝**④ 透传面** `GET /api/v1/kp/nodes/{node_id}/narrative`（`web-ui/src/api/kp.ts` 的
  `getKpNarrative` 已在册，路径由对方现算、对方侧自洽），故学习面章导读**经 ④ 读**、
  取数键＝章行的 `from_detail_id`。

因此本面导读段的门＝**章行 `from_detail_id` 非空**（W2 落地口径：门只挂这一枚键，`narrative_ref`
既不由同步腿复制、也就不作为门），取数交 ④、由对方现算路径，对方回 `available:false` 即整段不渲染。
盘上现状＝导读长文一篇都没有（结论二：`af_kp.narrative_ref` 全空），故段②在现网**整段不渲染**，
属设计内空位而非缺陷；产出归 REQ-143 第九令 W25。这条腿也是零 ALTER 前提下唯一不改对方表形状的取法。

## 工作项

| 条目 | 内容 | 状态 |
| --- | --- | --- |
| W1 | 四问四答交用户裁决并回填本壳（T1＝乙、触发点＝页头「刷新」、T2＝不留生成入口、T3＝删摘要直排） | **已达成 2026-10-30**（回填见「裁决回填」表） |
| W2 | 8900 同步腿落地＝`POST /learn/courses/{course_id}/knowledge-points/sync`：逐本读在册 `af_kp` 行→两道过滤→章层 `replace_outline`＋知识点层按提升锚复用或 `add_point`（`norm_key` 撞名跳过、`anchors.ref_id` 归一）；契约 §⑥ 行与端点清单守护**同批**改；`tests/test_learn_knowledge.py` 用例先红后绿 | **已达成 2026-10-30**（十枚用例绿，读数见「过程与证据」第三记） |
| W3 | 甲案（学习面直读 `af_kp`）与丙案（前端编排）的实现腿——T1 已裁乙 | 作废（不实施，仅留档备查） |
| W4 | 中栏净化：删 `LearnWorkbench.tsx:325,340,380` 三句、删标题下摘要直排（T3），推进三枚改居中・置底（滚动区外固定）；§5.2 第 6／7 款随步 | **已达成 2026-10-30**（居中置底＝`body-scroll`＋`body-advance` 双层；取证见「过程与证据」第四记） |
| W5 | 右栏收敛为批注闭集至多四段（本章总结／本章学习导读／知识点总结／记录）：缺位整段不渲染、零默认值零提示语，两枚生成钮与提问段删除，章段「学习要点」位退出；`learnPlaneCopy.test.tsx:47` 必含词与禁词表同批改判 | **已达成 2026-10-30**（段②取数键＝章行提升锚，走 8900 透传读腿；取证见「过程与证据」第五记） |
| W6 | 页眉与界面零指导语＋具体操作全迁使用手册（`help/sections.ts` 课程学习册随步、`helpPages.test.ts:74` 同批） | **已达成 2026-10-30**（手册改到批注四段口径并承接「刷新＝取过来＋重读」「记录先记位置」两条操作；取证见第五记） |
| W7 | demo 门真机走通＝数学分析一门课「纯净目录 → 点一条读干净正文 → 三枚推进 → 记录持久刷新仍在」，8903 三门禁＋根侧契约全绿，到门暂停待人工验收 | **已达成 2026-10-31・待人工验收**（通路全绿：刷新提升 19 章／163 条→点条读净正文→三枚推进→「已学」标记与记录刷新仍在，40 枚请求全 200 且只指 8900、控制台零报错；抓到两处并已修＝同步腿默认 8s 误报失败（实测 12.0s，改 `KP_SYNC_TIMEOUT_MS=120_000`）＋六处可见文案拼裸错误串（泄漏端口与超时，改固定话术＋两枚守护）；**另抓到两处形态缺陷按用户令改判，落 W8／W9**；三档宽度实测与三枚推进／记录持久的复验补齐见「过程与证据」第八记） |
| W8 | 按书名读（T4）：工作台把 `sequence.chapters`／`units` 按行自带 `book_ref` 切到书架带进来的那一本，左栏目录、上一条／下一条、断点落点与整章阅读只在过滤后的序列里走；`?book=` 缺席落首本教材；换书入口＝回书架，本面零书切换控件；`learnPlaneCopy.test.tsx`／`LearnWorkbench.test.tsx`／`learnWorkbench.test.ts` 用例先红后绿 | **已达成 2026-10-31**（判据落码修正一处事实＝主表 point 行**不带** `book_ref` 列（现网读数 0/90），故归本位由读时投影派生「点行自身→所属章行→课程首本」，前端切序只读这一枚；取证见第七／八记） |
| W9 | 习题集退出课程学习面（T5）：8900 直连共享库取 `qt_books.roles`，`GET /learn/courses` 的 `books` 元素附 `roles`；提升同步腿对 roles 不含 `textbook` 的教材**整本跳过**并报 `skipped_role:true`（与 `skipped_empty` 平行，零写入）；书架教材卡与工作台只列教材；8901／共享库角色取不到＝不过滤（独立性铁律降级，不误清书架）；契约 §⑥ 两行与设计正本 §3／§10 同批改，`tests/test_learn{,_knowledge}.py` 用例先红后绿 | **已达成 2026-10-31**（角色取用腿实现＝`TrackerClient.list_books()`（8901 书目 HTTP），非根侧直连共享库——`qt_books` 归对方库面，根侧既有通路只有这一条；同一批行同时供书级简介，一趟取用；取证见第七记） |
| W10 | b07《数学分析习题集》存量清理（T6）：按 `book_ref=mathanalysis-b07` ∧ `from_detail_id` 为 `afkp-*` 反查该本次第删除章行与其下 point 行（现网读数＝8 章／82 条），**排在 W9 落码并重启 8900 之后**，否则页头「刷新」再提升一次；删除前先出只读计数与逐条清单交用户签认，清理后复跑同步腿验证不再回来 | **已达成 2026-10-31**（章层按 `book_ref`＋`node_kind=outline` 反查、点层按 `parent_kp_id` 归本反查（点行无 `book_ref` 列）；只读清点＋备份在先、一条事务 DELETE 在后，`qed_test` 183→93 行；复跑同步腿 `skipped_role` 生效、序列回 11 章／82 条全 b05；取证见第八记） |

## 过程与证据

- **2026-10-30**：接用户令进场（qed-intake）。读 `AGENTS.md`、项目状态快照、任务生命周期与设计正本
  `learning-course-ui.md`；只读取证三支探针（`tmp/learn_probe.py`、`tmp/kp_live_probe.py`、
  `curl /api/v1/learn/courses`）与源码定位（`_course_tree`／`_tree_or_404`／`add_point` 的插入列、
  八处干扰语与默认值的行号）。结论＝学习面与梳理成品之间存在**数据源断层**，消费门（`confirmed`）
  与盘上事实（全 0）不同形，「本章学习导读」盘上无正文。定级＝**大修改**（读源通路＋右栏形态＋
  守护词表＋契约 §⑥ 可能新增一枚端点），故先立本行与本壳、T1~T3 交裁，**零改码零改在册文档**。
- **2026-10-30**：`tmp/` 探针件属本会话取证件，收口前按临时目录规范处置（不写数据根、不改库）。
- **2026-10-30（第二记）**：四问四答出裁＝**T1 乙・补提升同步腿／触发点 页头「刷新」＝同步＋重取／
  T2 不留生成入口・纯只读四段／T3 删中栏摘要直排**。补做第三支只读交叉探针 `tmp/kp_xtab.py`
  →`tmp/kp-xtab.json`，取到层分布与 `toc_role` 的交叉表（b05 章 11＋节 85＋遗留点 22、reference 共 22；
  b07 章 8＋节 82、reference 共 2；**两本的 depth2 全部有在册 d1 父级、零失父**），据此定「纯净目录」
  的三条过滤口径与同步落笔细则（新节）。另查明**端点清单守护 `tests/contract/test_api_endpoint_inventory.py`
  要求契约行与路由同批存在**，故「契约先行」在本仓的落地形态＝同一批改契约与端点，不能只先落一行契约。
  立项文件（todo 行 REQ-144＋本壳）跑 `tests/contract` 全绿（89 passed）。
- **2026-10-30（W2 落地）**：`POST /learn/courses/{course_id}/knowledge-points/sync` 落码
  （`backend/qed_engine/api/learn.py` 的「提升同步腿」段），**零 DDL**——存储侧只把三枚机器键的
  入参口子开在进程内（`add_point` 收 `source_ref`、`patch_point` 白名单加 `from_detail_id`／
  `source_ref`／`anchors`，MySQL 与内存两实现同形）。逐本隔离定档三条＝8902 连接失败 **503 且零写入**
  （整次同步不执行）、单本上游非 200 只在该本报告 `ok:false`＋原状态码（一本坏不拖全批）、
  **整本跳过判据＝「零纯净章 ∧ 本腿从未在这本书落过笔（`list_outline` 无提升锚）」**——第三判取
  「本腿的笔迹」而非「工作区是否空」，因为只出前言／符号表的半梳理态同样不该被抹掉人工目录子树
  （守护用例 `test_sync_leaves_half_reviewed_book_subtree_untouched`）。报数面＝逐本
  `{ok, skipped_empty, chapters{created,reused,dropped,orphaned_points}, points{created,reused,skipped},
  detached, excluded{rejected,reference,point_rows}}` ＋ `totals`，前端「刷新」只据此判成功与否、
  不把内部计数写进页眉。契约 §⑥ 行与端点清单同批改（28 枚），`tests/test_learn_knowledge.py`
  同步腿十枚用例先红（8 failed／1 passed）后绿，`tests/test_learn{,_knowledge}.py` 116 passed、
  `tests/contract` 89 passed、`ruff` 全绿。
- **2026-10-30（第四记・W4 落地）**：中栏删四句附加文字（「在左栏选中一条知识点…」／「正文按整章呈现」／
  「这一条还没有定位到书页…」／「这一条读完了：点「下一条」接着学。」）与标题下的摘要直排（T3），
  缺页窗＝`body-scroll` 空文本（§10 空白态）。版式改「定高卡片＋卡片内部滚动」两层：`body-scroll`
  以 `flex:1; minHeight:0; overflowY:auto` 独占剩余高度，推进三枚挪进滚动区之外的 `body-advance`
  （`display:flex; justifyContent:center`）——短正文时不再贴在文字尾；分隔线随之从 `AdvancePane`
  移到容器上（组件宽度随内容走才能居中）。裁乙的同步入口接上前端腿＝`api/learn.ts` 的
  `syncCourseKnowledge` ＋ store `refresh`＝同步→重取目录／序列／进度，进场不触发。
  **提示形态改判**：antd 静态 `notification` 在本仓 jsdom 环境不挂载（探针＝调用后
  `.ant-notification` 节点数 0、正文文本不在 DOM），不可守护，故落点改 store `syncError`
  ＋页头下方一条警告横条（与「工作台数据不可达」同位、下一次刷新开头清掉），§10 末二行与
  §11 复核 ② 随步；另把在册代码与设计 §10「进面不自动生成」的不同步登记为复核 ③
  （`reloadOutline` 仍调 `autoGenerateToc`，本轮按非目标「不碰梳理与生成」未动）。
  守护：`learnPlaneCopy.test.tsx` 禁词表补四句（回来即判红），`LearnWorkbench.test.tsx`
  新增／改写五枚用例（标题之下只有书页内容／滚到尽头不显提示语／三枚居中置底在滚动区外／
  刷新＝同步＋重取且进场不触发／同步失败只出一条横条三栏照常）——
  `LearnWorkbench.test.tsx` 35 passed、`learnPlaneCopy.test.tsx` 16 passed、`tsc -b` 无输出。
- **2026-10-30（第五记・W5＋W6 落地）**：右栏栏题改**批注**，段次收成闭集四段——段①「本章总结」＝章行
  `summary` 直读；段②「本章学习导读」的门与取数键同为章行提升锚 `from_detail_id`，正文经 8900 的梳理
  透传读腿 `GET /api/v1/kp/nodes/{node_id}/narrative` 取（`exists=false`、读腿失败、锚空三种缺位一律
  整段不渲染，零占位句）；段③「知识点总结」＝选中那一条 point 行的 `summary`，选中整章不出现；
  段④「记录」＝kp 行 `learner_note`，本面唯一可写段（正文框无 placeholder、无归属与下一步话术，
  没有 kp 行时靠按钮禁用承载、store `saveNote` 静默返回 false）。随段下线的是两枚生成钮与
  `generateChapter`／`generatePoint`＋`anglesOf`／`annotationFailure`／state `generating`／
  `generateError`／`generateTarget`、「详解」的 `angles` 渲染与条级长文读腿、「提问」输入位、
  章段「学习要点」位；store 不再引 antd `notification`。词表同批改判：`learnPlaneCopy.test.tsx`
  禁词补十枚（学习交流／学习要点／详解／长文正文／读这一条的正文／生成本条注解／生成本章／暂未开放／
  提问／备注）、必含词换成批注四段＋推进三枚；`AnnotationPane.test.tsx` 整篇重写为四段 18 枚，
  `LearnWorkbench.test.tsx` 右栏块改七枚并删提问用例（章行夹具补提升锚、路由补 `/kp/nodes/`），
  store 用例删五枚生成与 `anglesOf`、「刷新」改判为同步＋重取并新增同步不可达一枚。
  W6 文案随步＝`help/sections.ts` 课程学习册与总册换成批注口径，页头「刷新」＝先把整理好的内容取过来
  再重读三栏、记录要先记上位置这两条操作写进手册（界面零指导语），`helpPages.test.ts` 必含／禁现词表同批。
  门禁：`npx tsc -b` 无输出、`npx vitest run` 70 files／1040 passed、`npm run build` 成功。
- **2026-10-31（第六记・W7 真机走通与两处随步修复）**：8900／8901／8902／8903 四门全在听，8900 经
  `POST /api/v1/services/{name}/restart` 重载后 `openapi.json` 里查到本轮新腿
  （`/learn/courses/{course_id}/knowledge-points/sync`）；8903 托管产物＝`dist/assets/index-iE7G-e8H.js`
  与 8903 实际返回的 `script[src]` 哈希一致。真机走 `#/learn` → 《数学分析原理》「进入学习」 →
  点一条读净正文 → 页头「刷新」 → 目录由 0 行涨到 183 行（19 章＋164 条） → 「已掌握并下一条」标「已学」 →
  「上一条」回退 → 「记录」写入并保存 → 带 `?v=` 重载后记录仍回显（textarea 17 字）；
  全程 40 枚请求全 200、请求目标只有 8900（无 8901／8902 直连回归）、控制台零报错。抓到两处并已修：
  **① 同步腿超时口径**＝前端走 `DEFAULT_TIMEOUT_MS=8000`，同一次同步 curl 实测
  `http=200 total=12.025s`（逐本报数 b05 复用 11 章／81 条跳过 4 条、b07 复用 8 章／82 条、
  b11／b12 整本 `skipped_empty`，`totals`＝19 章／163 条），**跑成功的同步被报成失败并弹横条**
  ⇒ 新增 `KP_SYNC_TIMEOUT_MS = 120_000`（`api/learn.ts`）＋ `learn.test.ts` 两枚用例
  （路由与 POST 方法一枚、假定时器按常量值才判 timeout 一枚）。
  **② 裸错误串进可见文案**＝横条与中栏回落当时会显示
  `请求超时（8000ms）：http://127.0.0.1:8900/api/v1/learn/…`，同一形状还散在六处
  （工作台两枚 Alert、书架两枚 Alert、`AdvancePane` 的 `progressError`／`notice`、中栏页回落
  `第 N 页：${entry.error}`），违反设计正本 §8「不透传裸状态码文案」与 §9 禁现表（8900／服务／离线）
  ⇒ 可见文案一律改成固定话术（进度与记录各给一句带下一步的兜底），store 里被渲染的
  `notice`／`progressError` 不再接 `describeError`，`error`／`syncError` 退化为「是否失败」的标记；
  守护两枚新增＝`learnPlaneCopy.test.tsx` 源码级禁 `${error|syncError|syncNote|progressError|notice}`
  插值＋store 里 `notice|progressError: describeError(` 零命中，`LearnWorkbench.test.tsx` 行为级补一枚
  「同步失败只出固定话术，可见文案不含 8900／http／ms）／服务／超时」。
  门禁：`npx tsc -b` 无输出、`npx vitest run --no-file-parallelism` 70 files／1051 passed、
  `npm run build` 成功（新哈希 `index-iE7G-e8H.js`）、根侧 `pytest tests -q` 902 passed、`ruff` 全绿。
  **W7 未完项**＝版式三档宽度实测只跑了 1600（1200／860 未量，`qed-frontend-check` 第 5 步要求三档），
  且 1600 档的一次读数自相矛盾（`body-scroll` 高 0 而正文 1665 字在位），须重测后才能判「居中置底」达标。
- **2026-10-31（真机只读取证・形态两缺陷 ⇒ T4~T6 三问三答）**：
  **① 序列不按书**＝`GET /learn/courses/math_analysis/knowledge-points` 现网返回 19 章／164 条，
  两本教材按 `sort_order` **交错**排（第1章 实数系和复数系〔b05〕→ 第一章 极限〔b07〕→
  第2章 常数与序列〔b05〕→ 第二章 一元函数微分学〔b07〕…），store 按行 `source_ref.ref_id`
  逐条换 `bookId`（`stores/learnWorkbench.ts:293`），于是正文在两本书之间跳——即用户令
  「没有按照书籍名称进行学习」；裁值 T4＝只列所选这本、回书架换书。
  **② 习题集当教材列**＝`GET /learn/courses` 的 math_analysis 四枚 `kind=book` 资源
  （b05 数学分析原理／b12 微积分学教程／b11 吉米多维奇数学分析习题集题解／b07 数学分析习题集）
  与共享 `qt_books.roles` 联查后＝b05、b12 为 `textbook`，b11、b07 为 `exercises`；
  书架四张教材卡两张是习题集，提升腿也不看角色（b07 的 8 章 82 条正是这次被提升混进序列的那一本）。
  判据落点＝服务端一处（T5），存量清理＝现在就清、但排在 W9 落码与 8900 重启之后（T6）。
  取证件＝`tmp/kp_ma.json`、`tmp/lc.json`、`tmp/qb.json`（只读，本会话自产，收口前按临时目录规范处置）。
- **2026-10-31（第七记・W9 落地＝教材角色判据只落 8900 一处）**：`api/learn.py` 新增 `TEXTBOOK_ROLE`
  与三枚 helper（`_tracker_book_rows`／`_book_roles`／`_is_textbook`）——书目腿一趟取用，书级简介与角色
  判据共用同一批 `list_books()` 行；不可达按空表降级＝「未知」，学习面不做任何过滤（独立性铁律）。
  判据形状＝唯「`roles` 非空且不含 `textbook`」判 `false`，前端只读派生位、不重算。
  三面随步＝① `GET /learn/courses` 与 `POST /learn/courses/sync` 的 `books` 元素各附 `roles`＋`textbook`；
  ② 提升同步腿对非教材**整本跳过**（`skipped_role:true`、不起读腿、零写入、既有提升行不动）；
  ③ 投影序列行补出归本位 `book_ref`（点行自身→所属章行→课程首本，读时派生零写入）。
  用例先红后绿＝`tests/test_learn.py` 三枚（投影附位／同步 meta 附位／8901 不可达不过滤）、
  `tests/test_learn_knowledge.py` 三枚（两本混排各自归本／习题集整本跳过且 `list_outline` 为空／
  角色跳过不删既有提升行）；`_sync_client` 增 `book_roles` 形参并类级 patch `TrackerClient.list_books`
  （本机 8901 在听，不 patch 即用例不确定）。契约 §⑥ 两行随改（`books` 形状加 `roles,textbook`＋归本位条款）。
  落码中抓到一处自造回归＝`_book_intros` 改签名后批注提示腿仍传 `request`，`test_generate_prompt_...`
  红在 `learn.py:1544` ⇒ 改走 `_book_intros(_tracker_book_rows(request))`。
  门禁＝三枚学习模块 `pytest` 170 passed、`ruff` 全绿。
- **2026-10-31（第八记・W8 前端切序＋W10 存量清理＋W7 三档实测复验）**：
  **W8**＝`stores/learnWorkbench.ts` 出两枚纯函数（`nonTextbookRefs` 只读服务端 `textbook===false`、
  `withinBook` 按归本位切行），`fetchCourse` 用教材清单过滤（全隐藏者不回落到 8902 行）、`reloadPoints`
  按 `?book=` 切 `chapters`／`units`、`treeOf` 增第三参；`LearnShelf.splitBooks` 同判据只列教材；
  提示语按 T4 后果改口径＝条／章到界说「已经到这本最后一条：回书架选另一本。」「已经到这本第一条。」，
  课程级两枚 Alert 仍说「本课」。用例先红后绿＝store 四枚（按书切序／断点落别本＝不用它／`?book=` 缺席
  落首本教材／习题集不做首本也不进清单）＋书架一枚＋工作台断言随步。
  **W10**＝8900 经 `POST /api/v1/self-restart` 重载（config 单元不可经 `/services` 启停），重载后
  `GET /learn/courses` 现网回 `b05 textbook=true`／`b12 true`／`b11 false`／`b07 false`；
  只读清点＝b07 提升足迹 8 章／82 条＝90 行，全部带 `afkp-*` 锚、`created_by`／`updated_by` 只有
  `qed_engine`、`narrative_ref` 与 `meta` 全空、`qe_learning`（3 行）与 `qe_attempt`（6 行）零引用；
  备份＝`tmp/w10_b07_backup.json`（90 行全列，112,797 B）；删除＝一条事务 `DELETE` 按 90 枚 `kp_id`，
  守卫为行数不符即回滚，读数 `183 → 93`、b07 章层余 0；复跑同步腿报数＝b05 复用 11 章／81 条（跳过 4）、
  b12 零行、b11 与 b07 `skipped_role=true` 零写入，序列回读＝11 章／82 条且 `book_ref` 全为
  `mathanalysis-b05`（无一本混排）。
  **W7 三档实测**（`?v=w10b`，页面 `script[src]`＝`dist/assets/index-C-NvTlK_.js` 与构建产物一致）＝
  1600 三栏（目录＋正文＋批注，零抽屉钮）／1200 两栏＋「打开批注」／860 仅正文＋「打开目录」「打开批注」；
  正文文本左缘实测 79 px（中栏卡 x=54、w=560），三枚行中心 334 ＝ 中栏中心 334（居中达标）；
  「置底」在内置浏览器 0 高视口下不可量（`body-scroll` clientH=0 而 scrollH=918，第六记那次自相矛盾读数
  即此因），以 DOM 结构（`body-advance` 在滚动容器之外）＋用例承接，如实注明未取像素。
  纯净目录＝目录内零 `.ant-tag`、条目全为纯名（「已学」是进度后缀不是提示语）；净正文＝中栏 1185 字、
  零 Alert。批注面此点只出「知识点总结」「记录」两段——章级两段缺位的取证＝8902 b05 工作区 352 节点里
  `summary` 非空仅 6 枚且全是 `depth=2` 节层，11 枚已提升章锚对应节点 `gen_status=candidate` 且 `summary`
  为空 ⇒ 「只读段缺位整段不渲染」是设计内形态，章级总结／导读产出归 REQ-143 那条线，不在本行范围。
  推进与记录复验（写后已复原）＝「下一条」→有序集、「已掌握并下一条」→域，`progress` 由 done 1／
  mastered 1／percent 1.2 涨到 2／2／2.4；「上一条」回有序集后第三枚变「已掌握 · 点一下撤销」，撤销后
  回 1／1／1.2；「记录」写入→保存→页头「刷新」仍回显→清回空值再刷新复验为空；整本末条「下一条」出
  「已经到这本最后一条：回书架选另一本。」、首条「上一条」出「已经到这本第一条。」；
  全程 17 枚 XHR 全 200 且目标只有 8900（零 8901／8902 直连），控制台零 error／warn。
  收口前全量门禁＝`pytest tests -q` 909 passed、`pytest tests/contract -q` 89 passed、`ruff check backend tests`
  全绿；前端 `npx tsc -b` 无输出、`npx vitest run --no-file-parallelism` 70 files／1057 passed、
  `npm run build` 成功（哈希 `index-C-NvTlK_.js`）。真机取证件＝`tmp/kp_ma_after_w9.json`、
  `tmp/kp_ma_after_w10.json`、`tmp/afkp_b05.json`、`tmp/w10_b07_report.json`、`tmp/w10_sync_after.json`
  与 `tmp/w10_*.py` 脚本（只读探针＋一次签认删除的守卫脚本，收口前按临时目录规范处置）。
- **2026-11-01（随步指针・不改本壳判据）**：[REQ-145 壳](2026-11-01-kp-course-level-merge-and-explore-source.md)
  的四条裁决只改道归本位的**承载源**＝`qed_knowledge_point.book_ref` 语义退役（停写／停筛／不作判据），
  归本位改按 `anchors[].ref_id ∪ source_ref.ref_id` 读，第八记那枚「点行自身 → 所属章行 → 课程首本」
  三级回落随之删除（搬家由 REQ-145 W4 承接）。**本壳 T4「按书名读、换书回书架」的用户令一字未改**——
  变的只是「这一行属于哪本书」从哪里读；共行推论另加一条后果＝归本位从此是**多值**（同一行可出现在
  覆盖它的每一本序列里），进度口径仍课程级不变。`GET|PUT …/outline` 整树写面的去书化形态待裁（该壳 U4），
  未裁前本壳既有通路照常运行、不动码。

## 验证与验收

- **后端**：`D:/software/anaconda3/envs/QED_env/python.exe -m pytest tests -q`（契约与学习域用例先行）、
  同解释器 `ruff check backend tests`；
- **前端**：在 `web-ui/` 内串行跑 `npx tsc -b`、`npx vitest run`（禁用仓根 `npx vitest`）、`npm run build`；
- **契约守护**：`tests/contract/test_tracker_governance.py`（G1/G2/G5）与 `test_plan_governance.py`（G3/G7）绿；
- **demo 门**（ADR 0024 决定 2）＝W7 的真机读数、截图与「点一条读到一条」的前后对照记在本壳本节；
  到门暂停，人工验收通过才继续 W 序。

## 回滚

- W2/W3 属新增或改判通路：回滚＝停止调用同步端点并撤销该 commit，主表已有行为不受损；
  同步写入的行可按 `from_detail_id`（`afkp-*` 前缀可辨）反查清理，清理语句属写库动作、归人工逐条签认；
- W4~W6 属前端形态与文案：revert 对应 commit 即回旧形态，守护词表随 commit 一并回退；
- 本壳不引入任何 DDL 与数据根迁移，无库结构回滚面。

## 关闭与归档

按 ADR 0020 达成即收：W1~W7（或 W1/W3~W7，视 T1 裁值）全部达成并留真机读数后，本行状态转终态、
写入 `docs/trackers/completed.md`，本壳按「归档判定＝Retain」移入 `docs/history/plans/2026-10/`。
遗留面（不在本行关闭前置内）＝导读长文的产出归 REQ-143 第九令 W25、脏页区间的数据修复归人工发令、
判分与质性门归 ARCH-027 主链 M-3 与 REQ-130 练习段。
