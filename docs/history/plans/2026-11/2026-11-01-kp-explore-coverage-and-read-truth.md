# 知识探索全局可信・整理度上屏与读量如实（kp-explore-coverage-and-read-truth）

状态：Completed
关闭结果：Achieved（2026-11-03 用户人工验收通过，原文＝「我基本同意验收，大体上没有什么问题（知识探索）」；S1~S5 逐条达成，8900 重启后现网复采 `kp_total`／`kp_confirmed`／`truncated` 三键全部就位，读数见「过程与证据」）
任务类型：B
最后更新：2026-11-03
关联 ADR：[ADR 0007](../../../history/adr/v0.1/0007-qed-engine-backend-gateway.md)（前端只连 8900；本行两腿均经 8900）、
[ADR 0016](../../../adr/0016-todo-registration-one-task-one-plan.md)（一任务一行一壳）、
[ADR 0023](../../../adr/0023-todo-row-carries-scope-and-criteria.md)（成功标准正本在台账行、进展只落本壳）、
[ADR 0024](../../../adr/0024-preschema-rebuild-tiers-and-demo-gate.md)（范围锁死＋B 类壳首工作项的 demo 门）、
[ADR 0025](../../../adr/0025-database-design-master-doc-and-ddl-ownership.md)（前缀即所有权：本轮零触碰 `af_*` 与 `qt_*`）、
[ADR 0026](../../../adr/0026-v1-root-table-family-freeze.md)（D5 主表不落确认位——本行不改该判据，确认位另立待裁）
关联设计：[frontend/knowledge-point-exploration-ui.md](../../../design/frontend/knowledge-point-exploration-ui.md)（本面正本，§8 计数段与 §10 状态矩阵随步）、
[api-contracts.md](../../../architecture/api-contracts.md) §⑥（`GET …/knowledge-points` 的读量判据）、
[database-design.md](../../../architecture/database-design.md)（`counts_by_course` 与主表行数口径正本）
关联 Tracker：docs/trackers/todo.md（REQ-147 任务行登记在学习设计轮节＝四段收口顺序 ④ 知识探索段的可信性承载行；分线归属＝ARCH-027 主链 M4）
归档判定：Retain（「后端已算出、前端未渲染」这类断链的定位过程，以及整理度上屏与既有「图上可直读的信息不再写成文字」裁决的正面冲突与改判理由，属不可替代的过程记录）

> **用户 2026-11-01 令（本壳口径正本）**：知识探索＝共享表整理好的**领域-课程-知识点全解**，本模块核心＝
> 把后台整理好的知识结构展示给学习者、让学习者有个**全局概念（确定的）**；按「先 P0-1＋P0-2（全局可信），
> 随即 P1-4＋P2-8（把不实的话收掉），再等 P0-3 随『开始执行』落地并带上 P2-7／P1-6 的写侧」的顺序执行，
> **现在开始执行**。同批追加一条令：**习题（教材中的习题段）与习题集都不入知识点序列**（细则见「待裁点」Q3）。

## 目标与成功标准

**目标**＝让知识探索面**担得起「全解」两个字**：领域层一眼可读哪几门课已整理、整理到多少；课程层读不全时
如实说读不全，而不是静默少画。成功标准条目化判据的正本在台账行（ADR 0023），本壳只承接拆解与执行；
行内 S1~S5 与本壳工作项的对应＝S1→W1、S2→W2、S3→W1＋W2、S4→W3、S5→W1。

## 范围与非目标

**范围内**：

- 领域层课程卡的**整理度承载**：`GET /learn/star-map` 已下发的 `kp_confirmed` 在渲染层落地（两档视觉分档＋
  悬停计数），§8「计数行不进提示框」按本次用户令改判；
- 课程读面的**读量如实**：`GET …/knowledge-points` 的每课取数上限由魔法数 `500` 改为在册常量，响应补
  `truncated` 判据，前端在**真截断**时出一行如实话术、未截断时零出现；
- 使用手册 knowledge 册随步，并把 knowledge 册纳入既有禁词守护（当前禁词表只扫 course／center 两册）；
- 上述牵动的契约（`api-contracts.md` §⑥ 该行）与设计正本（§8／§10）随步。

**非目标（各给指针）**：

- **多教材知识点融合＝REQ-145**（`merge_key` 归并与 `book_ref` 退役已在正本定档，本行不重复实现）；
- **确认位（P1-4）**：现网主表**无确认位列**，界面与手册的「已确认」措辞属不实陈述；用户已裁「确实需要确认位」，
  但加列＝`qed_knowledge_point` 的 DDL 改判（触 ADR 0026 D5 与生产库红线窗），归本壳 Q1 待裁＋另立 ADR，
  **本行不动 DDL、不改措辞**（措辞随 P1-4 批次一并收）；
- **知识点间关系线**（P1-6 读侧）与**归并后的序判据**（P2-7）＝随 REQ-145 落地批次；
- **术语「章节／大知识点」正名**（P2-8）＝随 P1-4 批次，本行不改；
- 星图课程腿对 8901 目录的依赖（8901 离线则整面降级）＝架构级问题，本行只登记不处置。

## 现网取证（2026-11-01，只读探针 `tmp/kp_explore_probe.py` → `tmp/kp_explore_probe.json`）

| 读数 | 值 |
| --- | --- |
| `star-map` 领域 / 轨迹 / 课程 / 先修边 | 1（math-advanced）／4／12／12 |
| 有内容的课程 | **仅 math_analysis**＝93 行（章行 11＋点行 82），`kp_confirmed=82` |
| 其余 11 门课 | `total=0`、章行 0（读面回 200 空集，不报错） |
| 82 条点行字段实填 | `anchors` 82／`summary` **7**／`type` **1**／`aliases` **0**／`meta` **0** |
| 学习面在册课程 | 2 门 |
| 断链位置 | `kp_confirmed` 经 `api/learn.ts:22` → `starMapLayout.ts:454` 进 `StarNode.kpConfirmed`，**渲染层零消费** |
| 截断位置 | `learn.py:1096-1098` `limit=500`；`stores/courseKnowledge.ts:37-40` 只取 `course`／`points`，`total` 弃用 |

## 待裁点（Q1~Q3，未答不默认采纳）

| # | 待裁 | 取值与代价 |
| --- | --- | --- |
| Q1 | 确认位怎么落（用户已裁「确实需要」，形态待定） | 甲・主表加 `confirm_state` 列（真 DDL：`qed_knowledge_point` 属冻结表族，触 ADR 0026 D5 改判＋生产库红线窗，读面可按列筛）；乙・不加列，按**产面**判定确认态（凡经人工批注/梳理屏确认通路的行＝已确认，机器提升行＝未确认，零 DDL 但判据依赖来源键）；丙・先只改措辞（把「已确认」改「已整理」），确认位后置到 v1.x。**未裁前本行不动 DDL、不动措辞** ／ **2026-11-02 已裁＝甲**（用户令原文「P1-4选择甲」）：决定落 [ADR 0027](../../../adr/0027-kp-human-confirm-column.md) D1~D8，执行承载另立 [REQ-148 壳](../../../plans/2026-11-02-kp-human-confirm-column.md)（含 P2-8 措辞与术语正名＝其 W5）；本行不再持有该项，W1 已上的「已整理」措辞按 ADR 0027 D4 由 `kp_total` 承载 |
| Q2 | 整理度上屏的形态边界 | 用户令「P0-1＝整理度上屏」与既有裁决「§8 计数行不进提示框」正面冲突。本壳取**甲＝悬停出计数行＋课程卡两档视觉分档**（改判 §8 一条），否掉乙（页头文字统计行——与「图上可直读的信息不再写成文字」直接对抗）；如需只留视觉分档不带数字，回一句话即可摘掉悬停行 |
| Q3 | 「习题不入知识点序列」由谁承载 | 用户 2026-11-01 追加令＝教材内习题段与整本习题集都不得进知识点序列（图上无框无点、学习面序列无条）。现网两道闸已覆盖一半：习题集整本由 `qt_books.roles` 判据在同步腿入口挡下（`learn.py:1374`＋`_is_textbook` `learn.py:590-596`，REQ-144 T5／W9 已达成），**教材内习题段的行级过滤缺位**。**冲突披露**＝并行窗口 REQ-146 的 S1 要把章末习题段**做成目录行**（`node_type=exercise`，父＝所属章）——若该批行进入共享主表提升池，就与本令直接对抗。归谁承载（REQ-146 侧只在 8902 结构面留习题行、根侧提升腿与读面一律过滤；还是本行加一枚 W）待用户裁 ／ **2026-11-02 已裁＝两个关口**（用户令原文「『习题不入序列』由两个关口把控：1、知识点梳理的时候本身就做区分；2、写共享表的时候再筛选一次」）：关口①＝梳理侧 `node_type=exercise` 派生键（已在现网成立，b05 出 23 枚）被升格为提升判据输入，关口②＝根侧写共享表前的行级闸——决定落 [ADR 0028](../../../adr/0028-exercise-out-of-kp-sequence.md) G1~G5，执行承载另立 [REQ-149 壳](2026-11-02-exercise-out-of-kp-sequence.md)；与 REQ-146 的冲突由该行 G4 消解（习题行只成在 8902 结构面、落闸先于其 S1 编码），本行不持有该项 |

## 前置条件

- **服务在跑**＝8900 与 8903（W1 的真机验证按 `qed-frontend-check`：改过源码须先 `npm run build`，
  再比对 8903 返回的 `assets/index-*.js` 哈希，导航加 `?v=` 破缓存）；
- **取证已取得**＝本壳「现网取证」节七项读数由只读探针得到，实施期不必再联 8901／8902；
- **不依赖 REQ-145**＝本行两腿都不改主表形状、不写库；`kp_confirmed` 与 `total` 按现表即读即得，
  课程级归并未落码不影响本行的整理度读数（归并前后每课的行数口径不变）；
- **零 DDL 前置**＝本行不改 `qed_knowledge_point` 任何列，故不进 ADR 0026 表族改判窗、不需红线 ALTER 窗；
- **待裁点不入前置**＝Q1（确认位形态）与 Q3（习题行承载方）未裁不阻塞 W1~W4，两问各归后续批次。
  **2026-11-02 两问均已裁并另立承载行**（见上表的收口注记），本行 W1~W5 不再持有待裁项。

## 工作项序

| # | 工作项 | 状态 |
| --- | --- | --- |
| W1 | **demo 门＝整理度上屏**：`StarMapGraph` 课程卡按 `kpConfirmed` 两档视觉分档（0 条＝降透明＋描边转暗，>0＝现行样式），悬停第三行出「已整理知识点 N」（空档出「尚无已整理知识点」），措辞不用「已确认」；用例先红后绿＝分档一枚＋悬停计数一枚＋`Knowledge.test.tsx` 既有禁现词守护不破；8903 真机三档宽度（1600/1200/860）实测「一眼看出哪几门课是空的」 | **已到门并人工验收通过 2026-11-03**（用例绿＋真机三档读数已取得；8900 重启后现网复采 `kp_total=82`／`kp_confirmed=0` 与 `truncated` 键在位，见「过程与证据」）。**手段偏离**：分档不用「降透明」＝课程框必须不透明才能遮住框下穿过的先修连线（既有不变量，`StarMapGraph.test.ts` 逐框钉 `opacity===1`），改走底色／描边／字色／发光四项，判据「两档一眼可辨」不变，理由与偏离记入「过程与证据」 |
| W2 | **读量如实**：`learn.py` 的魔法数 `500` 改在册常量 `KP_COURSE_READ_LIMIT`（取 3000＝单本同步腿上限 2000 的同数量级上界，且远低于渲染可用量），响应补 `truncated = total > 取回数`；`stores/courseKnowledge.ts` 留 `total`／`truncated`，`CourseKnowledge.tsx` 仅在 `truncated` 为真时于图区上方出一行如实话术；后端用例（常量＋判据双向）先红后绿，前端用例钉「未截断时该字样零出现」 | 已实施 2026-11-02（用例绿；8900 重启后现网响应 `truncated` 键在位——触顶支路仍不可达，单课最大 93 行 ≪ 3000，只有用例覆盖） |
| W3 | **手册与守护随步**：`help/sections.ts` knowledge 册补「怎么看整理度」一条（不写后台进度话术），并把 knowledge 册纳入 `helpPages.test.ts` 既有禁词表扫描（当前只扫 course／center） | 已随步 2026-11-02 |
| W4 | **契约与设计正本随步**：`api-contracts.md` §⑥ 的 `GET …/knowledge-points` 行补读量与 `truncated` 判据；`knowledge-point-exploration-ui.md` §8 计数段按 Q2 取值改判、§10 状态矩阵补「该课未整理＝课程卡置暗」一行 | 已随步 2026-11-02 |

## 过程与证据

- 2026-11-02｜立项落壳（用户令原文见开头引用块，令出 2026-11-01 深夜、落壳跨日至 00:01）：现网取证七项读数由
  只读探针 `tmp/kp_explore_probe.py` 取得（全程 GET，零写库、零 DDL、零 dataset 触碰）；
  两处断链（`kp_confirmed` 渲染层零消费、`total` 前端弃用）与两处魔法数（`limit=500`）已逐枚在源码行复核；
  Q2 的既有裁决冲突（§8「计数行不进提示框」＋`Knowledge.test.tsx:161` 禁「已确认知识点」字样）在立项时披露。

- 2026-11-02｜W1＋W2 落码（TDD 先红后绿）：W1 红＝4 枚（分档／悬停计数／整理度随布局／叙述空值形态），
  绿＝`StarMapGraph.test.ts` 9/9；W2 后端红＝1 枚（`AttributeError: KP_COURSE_READ_LIMIT`），
  绿＝`tests/test_learn_knowledge.py` 63/63；W2 前端红＝2 枚（store 与视图各一），
  绿＝`courseKnowledge.test.ts` 5/5＋`CourseKnowledge.test.tsx` 14/14。
  **手段偏离（S1 括号内「降透明」未采用）**：课程框的不透明度是本面既有不变量——框必须盖住从下方穿过
  的先修连线（`StarMapGraph.test.ts` 逐框钉 `opacity ?? 1 === 1`，旧用例即为此而写），
  用透明做分档会把连线透进框里、牺牲可读性换分档。改走**底色＋描边＋字色＋发光**四项
  （满亮＝`#0d1633`／轨色描边／`#eef3ff`／`shadowBlur 14`；空档＝`#0a0e1a`／`#3f4c66`／`#8496b6`／`shadowBlur 0`），
  S1 判据「两档一眼可辨」由该四项承载，守护用例同时钉住「两档三处属性互异」与「两档 opacity 恒 1」。
  措辞按用户令与 Q1 未裁态取「已整理知识点 N」／「尚无已整理知识点」，不写「已确认」。

- 2026-11-02｜W1 demo 门真机读数（8903，`qed-frontend-check` 路径）：8903 实际返回
  `assets/index-aaqN8Ulz.js`，与 `web-ui/dist/index.html` 同一哈希（非旧包）；
  领域层现场数据＝12 枚课程卡，其中**仅《数学分析》`kpCount=82` 走满亮档**，其余 11 门 `kpCount=0` 走空档；
  现场 option 的 `tooltip.formatter` 直读三态＝满亮出「…已整理知识点 82」、空档出「…尚无已整理知识点」、
  列框出空串。像素级取证（在星空画布上按色值取数）**三档内容区宽度各测一次**：
  1400px＝满亮底 210px／空档底 40556px、满亮字 199px／空档字 2599px；1100px＝850／58395、214／2648；
  800px＝3072／88516、197／2626——两档底色与字色在每一档都各自成块，「空课一眼可辨」成立
  （空档像素远多于满亮＝现网本就只有 1 门课有内容，非渲染缺陷）。
  课程层（`#/knowledge?course=math_analysis`）现场 95 个图元、无「本次只载入」行＝未触顶分支如实。
  请求侧＝资源全部指向 8903 与 8900（零 8901／8902 直连，ADR 0007 无回归），`learn/star-map` 与
  页面资源全 200；控制台除探针自身的 `getImageData` 提示外零报错。
  **两条如实限制**：① 内置浏览器视口 0×0，截图与指针悬停不可用，故提示行由现场 `option` 的 formatter
  直读、三档宽度以「内容区实宽 1400/1100/800」代替视口宽 1600/1200/860（同一 ResizeObserver 通路）；
  ② **8900 是旧进程、不热重载**，现网响应尚无 `truncated` 键（实测 `?include_outline=true` 只回
  course/points/sequence/total），界面按「未触顶」渲染，与新后端对 93 行的取值一致，故不阻塞本门；
  后端腿生效需重启 8900——**未擅自重启**（并行窗口可能正在驱动 8900／8902，重启归用户决定）。

- 2026-11-02｜W3＋W4 随步：knowledge 册概览补亮／暗分档、使用说明补「先分清哪些课已经有内容」一枚并改写
  悬停步骤（末行给出「已整理知识点 N」）、状态与限制段换掉「知识点在陆续整理」与引用界面「暂无已确认
  知识点」字面的旧话术，改为「内容缺位＋刷新可见＋内容很多时图上会写明本次载入多少、该课共多少」；
  `helpPages.test.ts` 新增 knowledge 册专属禁词守护（已确认／候选／待选／复习／解析／同步／入库／陆续）
  与「必须教整理度读法」正向判据——四册通用运维口径禁词扫描原已覆盖 knowledge 册，本轮补的是册内旧口径。
  契约 §⑥ 的 `GET …/knowledge-points` 行补 `truncated` 与 `KP_COURSE_READ_LIMIT=3000` 判据；
  设计正本 §8 表行改判为「课程名称／〔课程叙述〕／整理度」、§10 补两行（整理度为零＝空档、整课读量触顶）、
  §11 把「必不含计数段」改判为「必含整理度、必不含复习段」并新增「分档不得用透明度」守护、
  「学习面信息面收窄」显式豁免领域层整理度行（只禁课程层图元上的计数）。

- 2026-11-02｜门禁读数：`npx tsc -b` 净；`npx vitest run --no-file-parallelism`＝**70 文件 1071 用例全绿**；
  `npm run build` 成功（哈希 `index-aaqN8Ulz.js`）；`pytest tests -q`＝**910 passed**（原 909＋本轮后端新增 1）；
  `pytest tests/contract -q`＝**89 passed**；`ruff check backend tests`＝All checks passed。

- 2026-11-03｜**8900 重启窗口后现网复采＋人工验收通过**（用户原文「8900已重启」与「我基本同意验收，
  大体上没有什么问题（知识探索）」）：运行进程已载新码，`GET /learn/star-map` 逐课程复采到
  `kp_total`／`kp_confirmed` 两键（`math_analysis` 82／0，其余 11 门 0／0），
  `GET …/knowledge-points?include_outline=true` 回 `total=93`（82 point＋11 outline）且 `truncated` 键在位；
  同批复验确认位形状（26 列行带 `confirm_state`）与同步腿 `excluded` 四键可读，均为 REQ-148／REQ-149 的现网读数。
  8903 课程层真机复采＝11 虚框／82 条目、请求全指 8900、控制台零错。三档宽度此前受 0×0 视口限制不可达
  （2026-11-02 条已如实登记），本项由用户人工验收覆盖，不再留作绿色断言。据此 S1~S5 关闭。

## 验证与验收

- 后端：`D:/software/anaconda3/envs/QED_env/python.exe -m pytest tests/test_learn_knowledge.py -q` 先红后绿，
  收尾跑 `pytest tests -q`＋`pytest tests/contract -q`＋`ruff check backend tests`；
- 前端：在 `web-ui/` 内串行跑 `npx tsc -b`、`npx vitest run --no-file-parallelism`、`npm run build`；
- demo 门（ADR 0024 决定 2）＝W1 的 8903 三档实测读数与「空课可一眼辨出」的前后对照记入本壳「过程与证据」，
  到门暂停待人工验收；
- 真机验证按 `qed-frontend-check`：`npm run build` 后比对 8903 返回的 `assets/index-*.js` 哈希，加 `?v=` 破缓存。

## 回滚

- W1／W3 属前端形态与文案：revert 对应提交即回旧形态；W1 若被摘掉悬停计数行（Q2 改判回收），只删该一行与对应用例；
- W2 属响应补键＋常量：回滚＝恢复魔法数与键缺失态（前端读 `undefined` 落「不提示」分支，无数据面影响）；
- 本壳零 DDL、零库内写、零数据根迁移，无库结构回滚面。

## 关闭与归档

S1~S5 逐条对照台账行关闭（ADR 0023）；Q1（确认位）与 Q3（习题行承载方）**不在本行关闭前置内**，
未裁即随批移交——Q1 归另立的 ADR＋表族改判行，Q3 归用户裁定的承载行。**2026-11-02 移交条件已成立**：
两问均由用户裁定并各立承载行（Q1→[ADR 0027](../../../adr/0027-kp-human-confirm-column.md)＋[REQ-148 壳](../../../plans/2026-11-02-kp-human-confirm-column.md)、
Q3→[ADR 0028](../../../adr/0028-exercise-out-of-kp-sequence.md)＋[REQ-149 壳](2026-11-02-exercise-out-of-kp-sequence.md)），
本行不因这两问留尾；「W1 真机验收待人工」与「8900 重载出新键」两项已于 2026-11-03 兑现
（人工验收通过＋现网复采三键在位，见「过程与证据」）。关闭结果＝**Achieved**，归档判定 Retain，
壳按归档规则移入 `../history/plans/2026-11/`。
