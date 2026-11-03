# ADR 0027：共享知识点主表落人工确认位与「已确认」口径落真

状态：Accepted
日期：2026-11-02
领域：架构与边界
决策阶段：v0.1
取代：—
被取代：—

## 背景

用户 2026-11-01 把知识探索面的核心定档为「把后台整理好的领域-课程-知识点结构给学习者一个
**确定的**全局概念」，并在同日裁 **P1-4「确实需要确认位」**、2026-11-02 裁其形态取**甲＝主表加列**
（裁定与两案代价登记在 [REQ-147 壳「待裁点」Q1](../history/plans/2026-11/2026-11-01-kp-explore-coverage-and-read-truth.md)）。

**为什么现在必须加**——「已确认」在现网不是一件事实。2026-11-02 只读探针
（`tmp/kp_confirm_probe.py` → `tmp/kp_confirm_probe.json`，全程 GET、零写库）：

| 读数 | 值 |
| --- | --- |
| Axiom-Flow 梳理侧人工位 `af_kp.confirmed` | b05 352 行、b07 184 行**全部为 0**；只给 `confirmed=1` 的 `GET …/kp/export` 两本均回 **0 行** |
| 共享主表 `qed_knowledge_point`（`math_analysis`） | 93 行＝11 章＋82 点，**93 行全带 `from_detail_id`**＝100% 机器提升、0% 人工背书 |
| 星图 `kp_confirmed` | 82（现义＝point 行数，与「人已确认」无关） |

三处正文因此是不实陈述：总纲 §三 总览行「一个**已确认**知识点」、§五 用途「**本表没有人工确认列
——能进本表即已确认**」、表注释「一行=一个人工确认的行」；界面与手册另有「该课程暂无已确认知识点」。
而提升通路已由 REQ-144 裁乙定为「在册＝`gen_status != rejected`」，`cross-project-contracts.md` §6
仍写「把 `confirmed=1` 的行单向提升」——**两份正本对「哪些行可进主表」给了不同判据**，且都没有
把「人是否核过」落成可查的事实。

可借的判例在族内已有两枚：Axiom-Flow `af_pages.confirm_state`＝VARCHAR(16) 三值闭集
`unconfirmed`/`confirmed`/`rejected` 的**页级**人工确认位；`af_kp` 把机器位 `gen_status` 与人工位
`confirmed` **分列**，并立红线「同一事实两处存是族内红线」「人工终态只由 `confirmed` 表达」。

## 决定

| ID | 决定 | 理由 | 落点 |
| --- | --- | --- | --- |
| D1 | 主表加一列 `confirm_state VARCHAR(16) NOT NULL DEFAULT 'unconfirmed'`，闭集 `unconfirmed`／`confirmed`／`rejected`；**列名与三值沿用 `af_pages.confirm_state` 既有判例**；声明序置于 `meta` 之后，物理列序因追加式 ALTER 落 `updated_at` 之后（同 §7.8 T2 既有形态）。主表 **25 → 26 列** | 确认态要「可按列筛」才担得起甲案；落脚本槽 `meta` 即触 R7「只读不筛」红线。同名同闭集＝族内一种语言，不再造第二形 | 总纲 §三 总览行、§五 逐列与 DDL 围栏、`services/learn/knowledge.py` 的 `CREATE_TABLE_SQL` 与 `_POINT_COLUMNS` |
| D2 | **置位权三条，且机器不得写 `rejected`**：① `POST /learn/knowledge-points` 人工直登记 → `confirmed`；② `PATCH` 白名单加 `confirm_state`，人工可 `unconfirmed→confirmed`、任一→`rejected`、`rejected→` 另两态（复核可翻案），闭集外取值 422；③ 提升腿按上游 `af_kp.confirmed` **镜像**（1→`confirmed`、0→`unconfirmed`）**只升不降** | 「人坐在键盘前登记／置位」是唯一能证「人已背书」的动作；③ 将 AF 侧的人工位平移过来，不新造第二条人工写路径（承 AF「人机分列」红线）。只升不降＝机器不得抹掉人的判定 | `knowledge.py` 的 `add_point`／`patch_point`、`api/learn.py` 的 `PointCreateBody`／`PointPatchBody`／`_sync_book_knowledge` |
| D3 | **学习面读判据＝排除 `rejected`、其余照画**（知识探索两级视图、课程学习序列、`GET /learn/search` 一律 `confirm_state != 'rejected'`），**不按 `confirmed` 过滤** | 实测现网 0 行人工确认：按 `confirmed` 过滤即整面清零，与「给学习者全局概念」直接对抗。「人尚未核过」由 D5 的措辞承载，而不是靠删掉内容来诚实 | `knowledge.py::list_points`／`list_outline` 与 `api/learn.py` 三个读端点 |
| D4 | 星图 course 对象**补 `kp_total`**（非 `rejected` 的 point 行数）并**保留键名 `kp_confirmed`、改其真义**＝`confirm_state='confirmed'` 的 point 行数（现网读数 0）；`counts_by_course` 同批按确认态分桶。8903 的整理度分档与悬停计数**改读 `kp_total`** | 键名从此名副其实（confirmed 只装确认数），而 REQ-147 W1 刚上屏的整理度图元继续用真数不熄灭；学习面不引入「人工确认」这一编辑侧概念（设计正本 §11 信息面收窄） | `api/learn.py` 的 `star_map`／`counts_by_course`、`api-contracts.md` §⑥、`web-ui/src/api/learn.ts`、`stores/starMap.ts`、`components/starMapLayout.ts`、`components/StarMapGraph.tsx` |
| D5 | 同批做**措辞与术语正名（P2-8）**：学习面可见文案与设计正本的图元称呼统一为**章节**（outline 行）与**知识点**（point 行），「大知识点／小知识点」登记为退役称呼；「已确认知识点」在 learner-facing 文案与端点描述里改「已整理知识点」，「已确认」一词此后**只在**指 `confirm_state='confirmed'` 时使用 | 「确认」一旦被界面随手使用，库里就永远需要一枚列来兜住它——本决定把词义一次性收到位上。两级称呼以学习者能懂的语言为准，`outline`/`point` 只留库侧与代码侧 | `pages/CourseKnowledge.tsx` 空态、`help/sections.ts`、`knowledge-point-exploration-ui.md` §8/§10/§11、`frontend-overview.md`、`learn.py`／`knowledge.py` 的 docstring 与响应描述 |
| D6 | **存量回填＝零回填脚本**：ALTER 的 `DEFAULT 'unconfirmed'` 让现网 93 行落 `unconfirmed`，与「上游人工位实测全 0」一致；日后重跑提升腿时按 D2③ 镜像升级。**禁止**以「这些行已经画出来了」为由把存量置 `confirmed` | 回填取值必须来自事实而非便利；置 confirmed 等于由代码替人签字，正是本 ADR 要消灭的那种不实 | 总纲 §7.8 新行、执行壳「过程与证据」的对拍读数 |
| D7 | 执行编排＝**逐列正本＋DDL 围栏＋代码 DDL＋`_POINT_COLUMNS`＋守护数值同批**（逐字对齐守护锁死，ADR 0025）；补列走幂等 ALTER（`information_schema` 探查存在性，§7.4 绝不隐式 DROP）；`qed_test` 执行前单表 dump 落 `dataset/backups/2026-11-02-req148/`（§7.5 第 1 步）；**生产 `qed` 库的补列属人工窗口**：agent 只出命令原文与核验判据，幂等补列只是兜底自愈，不得充当生产库的唯一执行路径（免了备份就是红线） | 表族冻结下唯一合法形状变更路径＝追加式 ALTER＋四步窗；把「生产何时执行」与「代码何时具备」分开，代码可先行而库不动 | §7.2／§7.5、`knowledge.py` 的 `ensure_columns()`、执行壳 W 序与「遗留与移交」 |
| D8 | 与 [ADR 0026](0026-v1-root-table-family-freeze.md) 的关系＝**部分改判，正文关联、不转旧 ADR 状态**（治理判据：只有完整取代才改状态）：撤销其「权威态＝存在性」取向中**被本列覆盖的那一半**——即「进表即已确认」；其 D6 的**不加 `is_canonical` 判定不动**（权威名与人工确认态是两件事，本列不表权威也不表合并）；D5 三列不动；D10 的产面平移不动，只是现在落 `confirmed`。与 `cross-project-contracts.md`「只提升 `confirmed=1`」的分歧由 D2③ 消化＝**提升范围仍按在册**（REQ-144 裁乙不改），提升时把上游人工位带下来 | 一次加列不必推翻整张定档表；把改判范围压到「存在性是否等于确认」这一条，旧决定其余部分继续有效 | 本文「关联」节、总纲 §五 注释节、`cross-project-contracts.md` §6 |

考虑过的替代方案与排除原因：① **乙・不加列，按来源键判确认态**——用户 2026-11-02 明确裁「选择甲」；
且 `from_detail_id` 非空只能证「这是机器提升的行」，证不了「人没核过」，判据不可 `WHERE` 即触 R7。
② **丙・先只改措辞、确认位后置**——同一令已否；且响应键 `kp_confirmed` 的名字仍是不实陈述。
③ **学习面只画 `confirmed`**——见 D3，现网会把刚点亮的整理度图元全部熄灭。
④ **列名取 `confirmed`（对齐 `af_kp`）**——排除：根侧同族已有 `af_pages.confirm_state` 的三值形态，
INTEGER 0/1 会造出第二种语言；且 `confirmed` 作列名与 `kp_confirmed` 作响应键在正文里极易混读。
⑤ **把 `exercise` 等更多行状态一并塞进本列**——排除：`node_kind` 与 `type` 已承载形态与分类，
本列只回答「人是否背书」一件事（承 AF「同一事实两处存是族内红线」的反面＝一个事实一个位）。

## 后果

- **正面**：三处不实陈述变真且可核验；「已确认／已整理」第一次有了词义分工；库内出现
  **待复核队列的落点**（`confirm_state='unconfirmed'` 且带 `from_detail_id` 的行＝机器提升等人核），
  为后续编辑面消费（后台管理·知识点复核）腾出真实筛选键；`rejected` 给了人工驳回一条不删行的通路，
  与 REQ-144 的「签认删除」相比留下可复核的判定史。
- **负面/代价**：① 主表列面 25 → 26，`tests/test_learn_knowledge.py` 的列数守护、D1/D10 退场守护
  （「`confirmed` 键不得出现」）、`PATCH` 白名单 422 用例，与 `tests/contract/test_architecture_documents.py`
  的逐列／逐字对齐守护**必须同批改数值**，分批改即红；② 生产 `qed` 库的补列落在人工红线窗，
  本行收口前「代码已具备、库未具列」的中间态里，生产读面必须靠幂等补列或降级，不得靠 SELECT
  不存在列报错；③ 8900 不热重载，`kp_total` 与 REQ-147 的 `truncated` 共用同一重启窗口；
  ④ 与在途的 REQ-145（承诺本轮零 DDL）触碰同一段 DDL 文本，两批须约定先后、不可并行改围栏；
  ⑤ D4 改了 `kp_confirmed` 的语义，凡按旧义消费它的文档与测试都要同批改读数。
- **中性**：本列对 8901/8902 是追加式、只读方零破坏，按 §6.1 走「改本文＋改接口契约＋跨项目登记」，
  **不发函**；AF 侧无需改码（其 `confirmed` 位已实存，只是首次被根侧消费）。

## 关联

- 被改判的正文（本 ADR 生效后须同批随步）：[数据库设计总纲](../architecture/database-design.md)
  §三 总览行／§五 `qed_knowledge_point` 用途·字段明细·DDL 围栏·注释节／§7.8（新行 T14）／§八 守护数值、
  [api-contracts.md](../architecture/api-contracts.md) §⑥、
  [cross-project-contracts.md](../design/cross-project-contracts.md) §6、
  [knowledge-point-exploration-ui.md](../design/frontend/knowledge-point-exploration-ui.md) §8／§10／§11、
  [frontend-overview.md](../design/frontend/frontend-overview.md)；
- 前序决策：[ADR 0025](0025-database-design-master-doc-and-ddl-ownership.md)（总纲承载建表语句、
  逐字对齐）、[ADR 0026](0026-v1-root-table-family-freeze.md)（D5 三列／D6 负面清单／D10 产面平移，
  本 ADR 对其「存在性＝确认态」取向作部分改判）、[ADR 0024](0024-preschema-rebuild-tiers-and-demo-gate.md)
  （重建档位与 demo 门）；
- 裁定与取证来源：[REQ-147 壳](../history/plans/2026-11/2026-11-01-kp-explore-coverage-and-read-truth.md)
  「用户令」与「待裁点」Q1、`tmp/kp_confirm_probe.py` 与其 JSON 读数；
- 执行承载：[REQ-148 壳](../plans/2026-11-02-kp-human-confirm-column.md)；
- 相邻决定：[ADR 0028](0028-exercise-out-of-kp-sequence.md)（同批用户令的另一半＝习题不入序列）；
- 治理判据正文：[任务生命周期](../standards/task-lifecycle.md)（一任务一行一壳、demo 门）、
  [文档治理规范](../standards/doc-governance.md)；
- 守护：`tests/test_learn_knowledge.py`（列数、白名单、确认态读写）、
  `tests/contract/test_architecture_documents.py`（逐列与 DDL 逐字对齐）。
