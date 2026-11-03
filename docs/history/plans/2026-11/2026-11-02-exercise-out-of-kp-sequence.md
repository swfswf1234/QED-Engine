# 习题不入知识点序列・两级闸（exercise-out-of-kp-sequence）

状态：Completed
关闭结果：Achieved（2026-11-03 用户人工验收通过；S1~S5 逐条达成，8900 重启后现网复跑提升腿幂等、`excluded` 四键可读，读数见「过程与证据」）
任务类型：B
最后更新：2026-11-03
关联 ADR：[ADR 0028](../../../adr/0028-exercise-out-of-kp-sequence.md)（本行唯一决定来源：G1 序列定义／
G2 关口①升格／G3 关口②行级闸／G4 与 REQ-146 分工／G5 学习面零可见）、
[ADR 0024](../../../adr/0024-preschema-rebuild-tiers-and-demo-gate.md)（范围锁死＋B 类壳首工作项 demo 门）
关联设计：[cross-project-contracts.md](../../../design/cross-project-contracts.md) §6（`node_type` 派生
判序与提升通路正本）、[database-design.md](../../../architecture/database-design.md) §五
`node_kind` 注释、[knowledge-point-exploration-ui.md](../../../design/frontend/knowledge-point-exploration-ui.md)
§11（学习面零可见）、[api-contracts.md](../../../architecture/api-contracts.md) §⑥（`excluded` 计数）
关联 Tracker：docs/trackers/todo.md（REQ-149 任务行登记在学习设计轮节；**是并行行 REQ-146 S1 的
前置防线**，分线归属＝ARCH-027 主链 M4 与课后练习段的交界）
归档判定：Retain（「今日 0 污染属巧合而非防线」这一取证结论，以及与 REQ-146 的分工裁定，
属不可替代的过程记录）

> **用户 2026-11-02 令（本行口径正本）**：「『习题不入序列』由两个关口把控：1、知识点梳理的时候
> 本身就做区分；2、写共享表的时候再筛选一次。」关口①在现网已由梳理侧派生键成立，本行承载关口②。

## 目标与成功标准

**目标**＝共享主表与由它渲染的一切读面**永不含习题行**，同时不削减排习题的结构面——习题在
8902 `af_kp` 里成行、在练习面被抽题，两条路都不经过知识点序列。
条目化判据正本在台账行（ADR 0023）；行内 S1~S5 与本壳工作项的对应＝S1→W1、S2→W2、
S3→W4、S4→W3、S5→W1＋W4＋门禁。

## 范围与非目标

**范围内**：

- 提升腿 `_kp_split_workspace` 的第三道行级过滤＝`node_type == 'exercise'` 排除，缺席时回落
  `toc_kind == 'exercise'`，排除数计进响应 `excluded.exercise`；
- 整本闸门（`qt_books.roles` 含 `textbook` ＋ `_is_textbook`）判据不动并复验零回归；
- 分工与「学习面零可见」在 `cross-project-contracts.md` §6 与设计正本 §11 成文；
- 现网复跑提升腿的污染行数对拍（前后逐值相等）。

**非目标（各给指针）**：

- **确认位＝REQ-148**（同批用户令的另一半，触 DDL，单独承载）；
- **习题行的产出与页区间＝REQ-146**（其 S1 在 8902 结构面成目录行，本行不改其 S 判据；
  G4 的分工裁定消解 REQ-147 壳 Q3 披露的冲突）；
- **答案配对与闪卡**＝REQ-146 承载，本行不碰；
- 名称关键词启发式（名字含「习题」即排除）＝ADR 0028 已否决，不落码；
- 主表加第四枚 `node_kind='exercise'`＝ADR 0028 已否决，不建列不扩闭集（**本行零 DDL**）。

## 现网取证（2026-11-02，只读探针 `tmp/kp_exercise_leak_probe.py` → `tmp/kp_exercise_leak_probe.json`）

| 读数 | b05 | b07 |
| --- | --- | --- |
| 梳理侧工作区行 | 352 | 184 |
| 其中 `node_type=exercise` | **23** | 0 |
| `gen_status` | candidate 118／rejected 234 | candidate 92／rejected 92 |
| `toc_kind` | exercise 23／bibliography 9／back_matter 8／front_matter 6／symbol_table 3／appendix 1／空 302 | front_matter 4／空 180 |
| 过完现有三道过滤后幸存 | 章 11＋点 85 | 章 8＋点 82 |
| 幸存集里 `exercise`／`other` | **0／0** | **0／0** |
| 共享主表 `math_analysis` | 11 章＋82 点，名称形态扫描无习题样条目 | — |

**结论**＝今日污染 0 行是**巧合**：b05 的 23 枚习题行恰好全落在被现有过滤排除的档位上。
REQ-146 S1 把章末习题段做成「父＝所属章」的目录行，即 depth 2 ——**正是会被提升成知识点的形状**。

## 前置条件

1. **上游键实存**＝`node_type`／`toc_kind` 由 8902 导出并已被根侧透传消费（实测 b05 出 23 枚
   exercise），本行只新增消费，不要求对方改码；
2. **零 DDL**＝不触表族冻结、不进红线窗、不需备份；
3. **排在 REQ-146 编码之前**＝该行 S1 一旦落地，缺闸即必然污染（现网取证结论）；
4. **不依赖 REQ-148**＝两行无交叠：本行只改过滤判据与响应计数，确认位只改列与置位；
5. **8900 不热重载**＝`excluded.exercise` 新键要重启才出，与 REQ-147 的 `truncated`、REQ-148 的
   `kp_total` 共用同一重启窗口（重启归人工批准）。**2026-11-03 已重启**，四键现网可读。

## 工作项

| # | 工作项 | 状态 |
| --- | --- | --- |
| W1 | **demo 门＝闸在真实形状前拦住**：用 b05 形态的工作区样本（含 depth2 且 `node_type=exercise` 的行——即 REQ-146 S1 将产出的形状）构造一条端到端：提升后共享主表**无该行**、`excluded.exercise` 计数正确、章与点幸存数不因过滤而少算；用例先红后绿（主判据一枚＋回落判据一枚＋端到端一枚），到门暂停待人工验收 | **三枚用例先红后绿（2026-11-02 红＝`excluded` 无 `exercise` 键；绿＝见「过程与证据」），2026-11-03 人工验收通过** |
| W2 | **行级闸落码**：`_kp_split_workspace` 在 `rejected`／`reference` 两道之后加第三道 `node_type=='exercise'`（缺席回落 `toc_kind=='exercise'`）并计 `excluded.exercise`；`_sync_book_knowledge` 的逐本响应随步；整本闸门既有用例复验零回归（`qt_books.roles` 判据与 `_is_textbook`） | **已实施 2026-11-02**（`tests/test_learn_knowledge.py`＋`tests/test_learn.py` 127 passed、`ruff check backend tests` 全绿；整本闸用例 `test_sync_skips_exercise_book_whole_and_writes_nothing` 零回归；既有两枚 `excluded` 形状断言按四键同批改值；8900 已于 2026-11-03 重启，`excluded` 四键现网可读） |
| W3 | **分工与零可见成文**：`cross-project-contracts.md` §6 登记「习题行的消费面＝练习抽题，永不进共享主表；关口①由派生键承载、根侧消费」；设计正本 §11 补一条「习题不入序列＝图上无习题、无习题计数、无习题文字」；总纲 §五 `node_kind` 注释补 G1 的序列定义指针 | **已实施 2026-11-03**（§6 两级闸条目＋设计正本 §11 已成文；总纲 §五 `node_kind` 逐列句、DDL 围栏注释与代码 `CREATE_TABLE_SQL`／`web-ui` 注释已随 REQ-148 W2 同批改到「序列永不含习题行，见 ADR 0028 G1」，逐字对齐守护绿） |
| W4 | **现网对拍收口**：只读复跑提升腿（或按只读读数复算），出「共享主表习题污染行数＝0（前后逐值相等）＋ `excluded` 三枚计数读数」记入本壳；`api-contracts.md` §⑥ 的 `excluded` 形状随步 | **已实施 2026-11-03**（8900 重启后对 `math_analysis` 复跑同步腿：200、幂等＝新增／删除均 0，`excluded={rejected:234,reference:22,exercise:0,point_rows:0}`；现网无习题行故 `exercise=0`，闸的效果由 W1 三枚用例覆盖；`api-contracts.md` §⑥ 四键形状已随步） |

## 过程与证据

- 2026-11-02｜立项（用户令原文见开头引用块）：决定已落
  [ADR 0028](../../../adr/0028-exercise-out-of-kp-sequence.md)；取证由只读探针取得（全程 GET，零写库、
  零 DDL、零 dataset 触碰）；与 REQ-146 的冲突披露原登在
  [REQ-147 壳「待裁点」Q3](2026-11-01-kp-explore-coverage-and-read-truth.md)，本行成立后由 G4 消解。
- 2026-11-02｜**正本随步先于动码（W3 的成文部分与 W4 的契约部分已落）**：
  `cross-project-contracts.md` §6 两处＝提升通路的旧表述「把 `confirmed=1` 的行单向提升」作废、
  改为「提升范围按在册 ∧ 非习题行，人工位以镜像带入」（与 ADR 0027 D8 同一处分歧的消解），
  并新增一枚「习题的两级闸」条目（关口①＝`node_type=exercise` 升格为提升判据输入、零对方改码；
  关口②＝根侧写共享表前的行级过滤，排除数进 `excluded.exercise`；整本闸与行级闸缺一不可；
  对本键的依赖＝语义稳定，两侧守护各钉主判据与回落判据）；
  `knowledge-point-exploration-ui.md` §11 补 G5「知识点序列里没有习题＝图上无习题、无习题计数、无习题文字」；
  `api-contracts.md` §⑥ 提升腿的过滤由两道改三道、`excluded` 补第四枚计数并注「落码状态＝REQ-149 W2」。
  **未动**＝总纲 §五 `node_kind` 注释的序列定义指针（与逐列／DDL 围栏同属逐字对齐守护块，随 REQ-148 W2
  同批改，避免两次触碰同一段文本）。契约门禁 `pytest tests/contract -q` 89 passed。
- 2026-11-02｜**W1＋W2 落码（TDD 先红后绿）**：`backend/qed_engine/api/learn.py` 加常量
  `KP_EXERCISE` 与 `_kp_is_exercise_row()`（主判据＝`node_type`，该键**有值即以其为准、不再回落**，
  缺席时才回落 `toc_kind`——否则上游发 `chapter`／`point`／`other` 的行会被 `toc_kind` 误判），
  `_kp_split_workspace` 的过滤由两道改三道（`rejected`→`reference`→**exercise**），响应 `excluded`
  出第四枚计数；`knowledge` 变量名保留给第三道之后的集合，下游 `point_rows`／章点分流零改写。
  红＝`KeyError` 级形状缺键（`excluded` 三枚），绿＝三枚新用例＋整本闸用例全过：
  ① 主判据（depth2 且 `node_type=exercise` 的「习题 1.2」不进主表，同章 `other` 行照升）——
  这正是 REQ-146 S1 将产的父＝章形状；② 回落判据（无 `node_type`、`toc_kind=exercise` 仍拦住，
  `_promoted_points() == set()`）；③ 端到端（`excluded == {rejected:1, reference:1, exercise:1,
  point_rows:0}` 且章 `created=1`／点 `created=1` 不减）。既有两枚 `excluded` 形状断言
  （`test_sync_promotes_only_clean_chapters_and_points`、`test_sync_leaves_half_reviewed_book_subtree_untouched`）
  同批补 `"exercise": 0`——属响应形状变更而非判据放宽。

- 2026-11-03｜**W4 现网对拍＋人工验收（关闭批）**：8900 重启后对 `math_analysis` 复跑同步腿，
  响应 200 且**幂等成立**＝新增 0／删除 0；`excluded` 四键现网可读＝
  `{rejected: 234, reference: 22, exercise: 0, point_rows: 0}`。`exercise=0` 的成因经两处取证判定：
  ① b05 工作区现网 23 枚习题行全落在既有 `rejected`／`reference` 档位（2026-11-02 取证同结论），
  ② 闸的位置在 `_kp_split_workspace` 的章点分流**之前**，故 REQ-146 S1 产出的 depth2 习题行必过此闸；
  闸的有效性由 W1 的三枚用例（主判据／回落／端到端）承担，不以现网 0 读数替代。同批复核共享主表仍为
  11 outline＋82 point、零习题样条目。**REQ-146 互读注记已留**（其壳 2026-11-03 条：习题行只成在 8902
  结构面、落共享表前经本行行级闸）。用户人工验收通过；S1~S5 关闭。

## 验证与验收

- 后端：`D:/software/anaconda3/envs/QED_env/python.exe -m pytest tests/test_learn_knowledge.py -q`
  先红后绿（主判据＋回落判据＋端到端各一枚）；收尾跑 `pytest tests -q` ＋ `pytest tests/contract -q`
  ＋ `ruff check backend tests`；
- 前端：本行零前端改动，只跑 `npx tsc -b` 与 `npx vitest run --no-file-parallelism` 证零回归，
  `npm run build` 后按 `qed-frontend-check` 抽查 8903 知识探索课程层**图元数与改前相等**（95 图元）；
- demo 门（ADR 0024 决定 2）＝W1 到门暂停待人工验收；
- 出口读数＝W4 的污染行数对拍 0 与 `excluded` 计数。

## 回滚

- 本行只改一处判据与一处响应计数：revert 对应提交即回旧过滤（三道变两道）；
- `excluded.exercise` 键缺失时前端与契约只读旧键，无数据面影响；
- 零 DDL、零库内数据搬迁，无库结构回滚面；存量若已含误入的习题行（现网实测 0）按
  「人工驳回」位处理而非删行——该通路由 REQ-148 的 `confirm_state='rejected'` 承载。

## 关闭与归档

S1~S5 逐条对照台账行关闭（ADR 0023）；本行**不替 REQ-146 判 S 判据**（G4 已裁定其 S1 照做），
REQ-146 壳已留「习题行只成在 8902 结构面」的互读注记（2026-11-03）。关闭结果＝**Achieved**，
归档判定 Retain，壳移入 `../history/plans/2026-11/`。
