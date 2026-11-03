# ADR 0028：习题不入知识点序列・两级闸

状态：Accepted
日期：2026-11-02
领域：架构与边界
决策阶段：v0.1
取代：—
被取代：—

## 背景

用户 2026-11-01 追加一条令：**习题（教材中的习题段）与习题集都不入知识点序列**；2026-11-02 裁其
承载方式＝**两个关口**——「1、知识点梳理的时候本身就做区分；2、写共享表的时候再筛选一次」
（裁定原文与冲突披露见 [REQ-147 壳](../history/plans/2026-11/2026-11-01-kp-explore-coverage-and-read-truth.md)
「待裁点」Q3）。

现网两道闸只覆盖了「整本」这一半：习题集整本由 `qt_books.roles` 判据在同步腿入口挡下
（`api/learn.py` 的 `_is_textbook`，REQ-144 T5 已达成），**教材内习题段的行级过滤缺位**。

2026-11-02 只读探针（`tmp/kp_exercise_leak_probe.py` → `tmp/kp_exercise_leak_probe.json`）给出
缺位的真实形状：

| 读数 | b05 | b07 |
| --- | --- | --- |
| 梳理侧工作区行 | 352 | 184 |
| 其中 `node_type=exercise` | **23** | 0 |
| 过完现有三道过滤（非 `rejected`／非 `reference`／depth 1→章、2→点）后幸存 | 章 11＋点 85 | 章 8＋点 82 |
| 幸存集里 `exercise` | **0** | 0 |
| 共享主表 `math_analysis` | 11 章＋82 点，名称形态扫描**无习题样条目** | — |

⇒ 今日污染行数＝0，但这是**巧合而非防线**：b05 的 23 枚习题行恰好都落在被现有过滤排除的档位上。
而并行行 [REQ-146](../plans/2026-11-01-practice-exercise-kp-association.md) 的 S1 正要把「章末习题段
做成目录行（`node_type=exercise`，父＝所属章）」——父为章即 depth 2，**正是会被提升成「知识点」的
形状**。先落闸再开 S1，是本决定的排他性动机。

## 决定

| ID | 决定 | 理由 | 落点 |
| --- | --- | --- | --- |
| G1 | **判据定义**：「知识点序列」＝共享主表 `qed_knowledge_point` 的 outline／point 行，以及由它们渲染的一切读面（知识探索两级视图、课程学习序列、`GET /learn/search`、练习面挂点表）。习题的承载位＝Axiom-Flow `af_kp` 结构面（`node_type=exercise`）＋练习面的页区间与答案配对；**共享主表永不含习题行** | 没有定义就谈不上「不入」：把边界钉在**表**与**读面**上，而不是钉在某个界面 | 总纲 §五 `node_kind` 行注释、`knowledge-point-exploration-ui.md` §11 |
| G2 | **关口①＝梳理侧区分，已由既有派生键兑现并被升格**：`toc_kind='exercise'` 或祖先为习题 ⇒ `node_type=exercise`（判序正本在 `cross-project-contracts.md`，实测 b05 已出 23 行）。本决定把它从「屏侧标签语言」升格为**提升判据的输入**，并要求该键语义在对方侧保持稳定；**不向对方发新增改码请求** | 用户令的第一关已在现网成立，缺的是根侧消费它；发函要求对方再改一次是重复建设 | `cross-project-contracts.md` §6（升格登记） |
| G3 | **关口②＝写共享表再筛一次**：提升腿 `_kp_split_workspace` 在现有两道过滤之后加第三道行级判据＝`node_type == 'exercise'` 排除，并计入 `excluded.exercise`；`node_type` 缺席时回落 `toc_kind == 'exercise'`。整本闸门（`qt_books.roles` 含 `textbook` ＋ `_is_textbook`）判据不动——**整本闸与行级闸是同一关口的两道**，缺一不可 | 只有行级判据能挡住「教材内的习题段」；保留两道是为了同一判据在两种粒度上各自成立，回落是为了在上游少发一枚键时仍不失效 | `api/learn.py` 的 `_kp_split_workspace`／`_sync_book_knowledge` 响应 `excluded` |
| G4 | **与 REQ-146 的分工裁定**（消解 Q3 冲突披露）：该行 S1 照做——习题行只成在 **8902 结构面**；其 S4「挂点／挂章」按名匹配主表的**章行与点行**，**永不匹配、也永不新建**习题行，主表无对应行时 `kp_id=null` 记未归档。据此两级闸与该行不冲突，该行 S 判据**不改**；落闸排在该行编码之前 | 冲突来自「习题行进入共享主表提升池」这一条路径，把它掐掉后双方各得其所：练习面有题可抽，知识点序列仍干净 | [REQ-146 壳](../plans/2026-11-01-practice-exercise-kp-association.md)「现网取证」随步注记、执行壳前置条件 |
| G5 | **学习面零可见**：不新增「习题计数」「习题层」图元或文字，`GET …/knowledge-points` 响应不出现 exercise 行；读面也不需要知道本闸存在 | 「图上没有的东西」不应以提示的形式回来（设计正本「图上可直读的信息不再写成文字」同源）；一旦给计数，习题就重新进了序列的视野 | `knowledge-point-exploration-ui.md` §11 |

考虑过的替代方案与排除原因：① **主表加第四枚 `node_kind='exercise'` 承载习题行**——排除：
`node_kind` 闭集是两级渲染的前提，第四值要在四处读面各写一次排除语句，把刚定档的「序列」语义
重新搅浑，且与用户令正面相反；② **只靠关口①**（信任上游永不误投）——排除：现网 0 污染恰是巧合，
REQ-146 S1 一落地即变必然；③ **只靠整本闸门**——排除：整本判据看不见「书内的一段」；
④ **名称关键词兜底**（名字含「习题」即不提升）——排除：数值／字面启发式不是判据，会误伤
「习题课」「练习技巧」一类正常知识点，且上游已有结构化标记，无须再猜。

## 后果

- **正面**：REQ-146 可以在无后顾之忧下开工；「习题—知识点」这条练习链路的数据源由此明确＝
  8902 结构面的习题行 ＋ 共享主表的章／点行，两者在库内**不同表、不同语义**；知识点序列的
  「全解」不再混入非知识点的结构行。
- **负面/代价**：① 本闸的正确性依赖上游 `node_type`／`toc_kind` 的语义稳定——对方改名或挪列即
  **静默失效**，故守护用例须同时钉主判据与回落判据两条路径，并以「现网复跑提升腿、污染行数对拍
  为 0」作为出口读数；② `excluded.exercise` 计数进入响应体，是编辑侧可见的第三枚排除计数，
  契约行随之变长；③ 闸落在提升腿，`add_point` 人工直登记**不加**同名判据（信任人工，但登记了习题
  就是人的决定，由 D3 的 `rejected` 位承担纠错）。
- **中性**：零 DDL、零库结构变更、零对方改码；存量主表无习题行故**无清洗工作项**。

## 关联

- 判据正文随步：[数据库设计总纲](../architecture/database-design.md) §五 `node_kind` 注释、
  [cross-project-contracts.md](../design/cross-project-contracts.md) §6（关口①升格＋两级闸分工）、
  [api-contracts.md](../architecture/api-contracts.md) §⑥（`excluded` 计数）、
  [knowledge-point-exploration-ui.md](../design/frontend/knowledge-point-exploration-ui.md) §11（G5）；
- 相邻决定：[ADR 0027](0027-kp-human-confirm-column.md)（同批用户令的另一半＝确认位落共享主表）；
- 执行承载：[REQ-149 壳](../history/plans/2026-11/2026-11-02-exercise-out-of-kp-sequence.md)；
- 被消解的冲突：REQ-147 壳「待裁点」Q3 与 [REQ-146](../plans/2026-11-01-practice-exercise-kp-association.md) S1；
- 取证：`tmp/kp_exercise_leak_probe.py` 与其 JSON 读数（只读、全程 GET）。
