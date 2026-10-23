# ADR 0026：v1.0 根私有表族定档为三张与编译链路退役

状态：Accepted
日期：2026-10-21
领域：架构与边界
决策阶段：v0.1
取代：—
被取代：—

## 背景

2026-10-21 用户从**功能面**发问定档 v1.0 数据库设计：`qe_*` 只负责「课程学习」与「课后练习」
两块，按此划分预想三张表（学习内容记录 + 题库 + 练习进度记录），而现实是七张（同日 W5 判定后
六张）——**比预想多一倍**，遂授权大改。逐表取证查出三处结构性冗余：

1. **调度态是派生量却落了列**：`qe_review_task` 的四枚状态列（`interval_index`／
   `consecutive_correct`／`consecutive_wrong`／`due_at`）全部是 `qe_attempt` 全量流水的确定性
   重放结果——作答表明文「全量保留逐次行不做只留终态的合并」，`status=archived` 由
   `qe_question.retired` 承载，`kp_type`／`course_id` 由题库快照承载，故该表**零独有信息**。
   而总纲自己在 `qe_unit_progress` 注释里写明「派生非累加：分数不落列」——掌握分不落列，
   却把**决定掌握分的调度档位**落了列，同一原则自相矛盾。
2. **`qe_unit` 在 v1.0 是空壳**：`finish_compile` docstring 自陈「M-1 **骨架**编译」，写入的
   `payload` 是字面占位串 `「{title}」骨架正文（M-1 占位，M-2 接生成管线）`
   （`backend/qed_engine/services/learn/base.py:494`），M-2 生成管线从未接线；`payload` 在 8903
   **零渲染点**（只有 `web-ui/src/api/learn.ts:564` 的类型声明）；`type` 闭集五值中
   `quiz`／`flashcard` **全仓零产出点**（只活在 DDL 注释），题目唯一落 `qe_question`；三层里
   `section` 已判与主表 `node_kind='outline'` 重复承载（REQ-132 W5）、`point` 已裁退出
   （2026-10-21 用户裁决）⇒ 剩下的唯一真事是「学习路径顺序」，而它是一串 `kp_id`。
3. **两张表同属一件事**：`qe_course_state`（1 行/课）与 `qe_unit_progress`（N 行/课）都是
   「学习者 × 目标 × 状态」，只目标粒度不同；且前者的 `name`／`domain_ref`／`course_ref`／
   `direction` 四枚快照列违总纲 R5「只引用不复制」取向。

前置分工已改判：W5 把知识生产与候选池正本判归 Axiom-Flow `af_kp`，根侧只留「拉取确认行 →
提升进共享主表」；对方 PLAN-024 KA-20 已把长文落点定为 `<book_dir>/kp/<node_id>.md`，即
`parsed/<domain>/<course>/<book_id>/kp/`——**在 ADR 0018 白名单既有区 `parsed/` 内**。故长文
文件指针方案（甲案）不需要新增数据根顶层目录，ADR 0018 决定 1 的白名单清单不动。

执行成本的关键缓解：生产 `qed` 库**未建**根私有七表（总纲 §7.8 T3），生产侧零迁移；
`qed_test` 属备份确认档（§7.3），本来就要在 REQ-132 W3 归一窗口重建。

## 决定

| ID | 决定 | 理由 | 落点 |
| --- | --- | --- | --- |
| D1 | 根私有表族定档为**三张**：`qe_learning`（学习记录：owner × 目标 × 状态）、`qe_question`（题库）、`qe_attempt`（作答事实） | 与用户功能划分一一对上；列数 116 → **51**（含 D9 三处） | 总纲 §三 表数、§4.5 角色分类、§五 逐列与 DDL |
| D2 | `qe_unit` 整表退出＝**编译链路退役**；学习序列改由共享主表知识点树 + 课程行 `config.kp_path` 驱动 | 块内容生产已归 AF（W5 分工），根侧块行现网只有占位串与零渲染点 | `api-contracts.md` §⑥ 端点族退役清单、8903 学习面改造 |
| D3 | `qe_review_task` 整表退出，调度态改**作答流水重放派生**（到期队列与档位由 `qe_attempt` 全量行按 `schedule_next` 规则 fold 得到） | 零独有信息；与「分数不落列」同一原则，消解自相矛盾 | `services/learn/practice.py` 重放实现 + 黄金样本对拍回归 |
| D4 | 「学习课程」**取消独立实体 ID**：`target_kind='course'` 行以共享 `qed_course.course_id` 为 `target_id`，课程名/领域名读时从共享表取，四枚快照列退出 | R5 只引用不复制；「开一门课」＝插一条 course 行 | `qe_learning` 逐列、`LearnShelf.tsx` |
| D5 | 共享主表 `qed_knowledge_point` **加三列**：`aliases JSON`（同物异名，检索可命中）、`narrative_ref VARCHAR(500)`（已确认长文的数据根相对路径，`''`＝无正文）、`angles JSON`（正文内已承载角度索引） | 多教程整合的别名与多角度叙述是用户明确需求；别名与角度都要可筛，进 `meta` 即触 R7「只读不筛」 | 总纲 §五 主表逐列与 DDL、`api-contracts.md` |
| D6 | **负面清单**（防回流）：不加 `is_canonical`（权威态＝存在性、权威名＝`name`）；不加合并/拆分谱系列（正本在 AF `af_kp.dedup_of`／`links`）；不加用户表、笔记表、错题本表、知识点关系边表 | 用户维度用 `owner` 列、笔记用 `learner_note` 列即可；错题本与关系边读时派生 | 总纲 §五 注释节 + 执行壳禁止条款 |
| D7 | **用户维度**：`qe_learning` 与 `qe_attempt` 加 `owner VARCHAR(64) NOT NULL DEFAULT 'admin'`，唯一键一律以 `owner` 为前缀（作答幂等键 → `(owner, question_id, review_date, origin)`）；`qe_question` 不加 owner | 现网全域零 `user_id`／`owner`，三枚唯一键形态会**静默吃掉**第二用户的数据；题库是内容、跨学习者共享 | 总纲 §五 DDL、`services/learn/*.py` |
| D8 | **执行编排**：与 REQ-132 W3 库内归一窗口同批（备份确认档三步：dump → 用户确认 → 重建）；生产库首次建表属人工窗口，agent 只出命令原文与核验判据；执行壳 W1 为 demo 门 | 两批都要触库、都要重启 8900，同窗最省；ADR 0024 决定 2 | [REQ-137 执行壳](../history/plans/2026-10/2026-10-21-v1-root-table-family-freeze.md) |
| D9 | **列级三处简化（C1~C3，2026-10-21 同日裁决采纳）**：C1 `qe_attempt.score_trend` 退列（趋势是作答流水的确定性重放，与 D3 同一原则）；C2 `qe_attempt.resolved` 改判**纯人工位**（机器判分只写 `is_correct`，人工处置不得被同事务回写覆盖，归 R6）；C3 `qe_question.course_label` 退列（课程名读时从 `qed_course` 取，R5） | 三处均**不改端点响应字段名**——`score_trend`／`resolved` 仍出现在响应里，只是由读时派生，前端契约零变化 | 总纲 §三 备注列与 §五 逐列、执行壳 W2/W3 |
| D10 | **两处产面缺口的处置（2026-10-22 第六批「A 全批同改」同批裁）**：`POST /learn/annotations/generate` **端点保留**、条级腿改落主表 `angles` 数组追加元素；主表 point 行的产面由候选池 `confirm` **平移为 `POST /learn/knowledge-points` 直登记**（校验 outline 父级），AF `af_kp` 拉取腿落地后成为同一张主表的另一个产面 | 表退即腿断＝功能消失，取「功能不退」一侧；零新表零新列，代价是 D6 负面清单边界扩至「只写 JSON 列的生成端点」 | 总纲 §五 主表注释节、`api-contracts.md` §⑥、执行壳「遗留与移交」第 1 项 |

`angles` 的 `angle` 闭集**复用退役池既有六词**（`intent` 的 `summary`／`explanation` 与
`payload` 分栏的 `definition`／`theorem`／`proof`／`example`），不新造词；新增取值须回本文改闭集。
`narrative_ref` 存**数据根相对路径全串**而非 AF 的单段文件名——根侧必须在 Axiom-Flow 离线时
独立解析出正文（独立性铁律），单段名的路径派生规则在对方文档、复制过来即第二事实源。其失效
口径与对方 KA-19 同形：**指针悬空＝可见降级**（正文区标「待复核」），不静默改写、不静默删。

考虑过的替代方案与排除原因：① 保留五~六张（只退 `qe_kp_detail` 与 `qe_review_task`）——排除，
`qe_unit` 在 v1.0 是占位空壳，留它等于留一张无消费方的表与一族无内容的端点；② 调度态继续落列
——排除，与「分数不落列」矛盾，且重编译或补录作答后档位与流水无对账机制；③ 长文入库
（`MEDIUMTEXT`）——排除，用户 2026-10-21 明确坚持文件指针，且 AF 已定同形落点，入库即两处正文；
④ 长文另立数据根顶层 `knowledge/` 目录——排除，对方 KA-20 已定 `<book_dir>/kp/`，另立顶层即
第二落点且要改 ADR 0018 白名单；⑤ 课程行与知识点行分两张表（四张方案）——排除，用户裁决取三张，
两行同属「学习者 × 目标 × 状态」，分表只多一处 owner 唯一键与一份 DDL 逐字对齐守护。

## 后果

- **正面**：根私有 7 → 3 张、列数 116 → **51**（`qe_learning` 13 + `qe_question` 24 +
  `qe_attempt` 14；D9 三处已裁，**列面定稿**，执行批不再有待确认摘除项）；消解三处「派生量落列」
  与一处「重复承载」；表角色与用户的功能划分一一对上；
  生产库零迁移；`owner` 前缀唯一键使多学习者扩展不再静默吃数据。全库表数 21 → **16**
  （共享 4 ＋ 根私有 3 ＋ `af_*` 4 ＋ `qt_*` 5；AF 五→四的形状已由对方 PLAN-024 定档并落迁移，
  根侧总纲据此同批改登记，其**库内重建**仍归对方窗口）。
- **负面/代价**：① `qe_learning` 是**单表继承**——`config` JSON 只对 course 行有意义、质性门
  四列只对 kp 行有意义，总纲 §4.5 表角色分类须写跨角色例外；② 编译链路退役是 ARCH-027
  M-1/M-2 **已确认设计的改判**，`api-contracts.md` §⑥ 端点族与 8903 学习面
  （`LearnShelf.tsx`／`LearnWorkbench.tsx`）须同批改造；③ 到期队列每次取须重放全课题目流水
  （个人规模千题万答＝一次索引查询 + 内存 fold），须用现网 `qe_review_task` 行做黄金样本对拍；
  ④ `qe_unit` 现网 95 行（§7.8 T2 文档读数，本轮未实测）与练习数据属备份确认档，重建前必须
  备份 + 用户确认；⑤ v2 若要恢复「课程自定义块内容」或「按知识点整体节律推题」，须重新引入
  对应表（1.0 前重建档位，代价低）；⑥ 文档面判定批查出的**两处缺口已由 2026-10-22 第六批裁决
  「A 全批同改」给出处置并同批执行**——其一，`POST /learn/annotations/generate` 的**条级注解腿**
  随 `qe_kp_detail` 退出而断（章级两腿写主表 `summary`／`meta.chapter_key_points`，不受表退影响），
  处置＝**端点保留**、条级腿改落 `angles` 数组追加一元素（`angle` 取既有六词闭集），代价＝本决策
  扩了 D6 负面清单的边界（「保留一个只写 JSON 列的生成端点」）；其二，`…/kp-details/confirm` 原是
  共享主表 point 行的**唯一产面**，而替代它的「从 AF `af_kp` 单向拉取已确认知识点」同步腿依赖对方
  PLAN-024 消费面落地（其导出端点目前仅声明必须存在），本批不可依赖，处置＝**产面平移为
  `POST /learn/knowledge-points` 直登记**，AF 拉取腿日后成为同一张主表的另一个产面。两项登记在
  [REQ-137 壳「遗留与移交」](../history/plans/2026-10/2026-10-21-v1-root-table-family-freeze.md)第 1 项并附回退路径；
  ⑦ **ARCH-027 主链行 S 判据与 D2 的正面冲突亦由第六批裁为「改判该行 S2／S4」**＝该行 S2 原文
  「链路编译……产出块序列（text/公式/图/quiz/flashcard）」、S4 端到端亦含「注册→编译→学习→判分→
  推进→结课」，而 D2 判编译整链退役等于抽掉承载物。第六批用户答复原文＝「A 全批同改」，其定义
  明列编译／单元／候选池三端点族退役，据此改判；[todo](../trackers/todo.md) 该行与
  [主链壳](../plans/2026-09-22-learning-design-mainline.md)「目标」节、
  [roadmap](../trackers/roadmap.md) 第五轮行同批随步。
- **中性**：`qed_test` 内三名并存（T2）在本批一并归一；`qed_knowledge_point` 加三列对
  8901/8902 是追加式、只读方零破坏，按 R3 走「改本文 + 改接口契约 + 跨项目契约登记」，不发函。
- **两级正本的分离与合并（2026-10-22 第六批后）**：判定批阶段受总纲两组守护（DDL 围栏逐字相等、
  总览↔矩阵↔角色同集合且表数硬编 21）锁定，目标态建表语句**不能**先行内联，故按既有
  `qe_kp_detail` 判例采「**判定不领先执行**」范式——判定以 blockquote ＋ §三 备注列 ＋ §7.8 T12
  承载，逐列正本**暂居**执行壳。**执行批开工即解除该分离**：第六批「A 全批同改」授权下，
  逐列正本由执行壳迁入总纲 §五，代码 DDL 与四处守护数值（`len(inventory)` 21→**16**／
  `MASTER_TABLES` 11→7／`ROOT_PRIVATE_TABLES` 七枚→三枚／`COLLATE` 计数 9→5）**同批**改，
  本文只留规则级判据、不再持有第二份列面。

## 关联

- 正本随步面：[数据库设计总纲](../architecture/database-design.md)（§一 表族定档、§三 表数与
  备注列、§4.2 血缘、§4.3 关系视图、§4.4 读写矩阵、§4.5 角色分类、§五 逐列与 DDL、§6.1／§6.4、
  §7.3／§7.6、§7.8 T2/T3/T10/**T12**、§八 守护清单）、
  [api-contracts.md](../architecture/api-contracts.md) §⑥、
  [cross-project-contracts.md](../design/cross-project-contracts.md) §4／§6、
  [dataset-conventions.md](../design/dataset-conventions.md) 单一事实源表、
  [learning-practice-ui.md](../design/frontend/learning-practice-ui.md) 与
  [knowledge-point-exploration-ui.md](../design/frontend/knowledge-point-exploration-ui.md)、
  [code-map.md](../architecture/code-map.md)（映射现状代码，随步归执行壳 W7）；
- 前序决策：[ADR 0018](0018-data-root-whitelist-and-meta-json-ban.md)（数据根白名单——本 ADR
  明确**不新增条目**，其决定 1 不动）、[ADR 0024](0024-preschema-rebuild-tiers-and-demo-gate.md)
  （重建档位与 demo 门）、[ADR 0025](0025-database-design-master-doc-and-ddl-ownership.md)
  （总纲为三项目总正本并承载建表语句）；
- 判定链：[REQ-132 壳 W5 逐表判定表](../history/plans/2026-10/2026-10-21-qe-family-rename-and-refactor.md)
  （前序七→六张判定，本 ADR 在其上再收三张）；Axiom-Flow PLAN-024
  （`Axiom-Flow/docs/plans/2026-10-21-af-table-family-rebuild.md`，`af_kp` 逐列正本与 KA-20
  长文落点）；
- 执行壳：[REQ-137 v1.0 根私有表族定档与库内重建](../history/plans/2026-10/2026-10-21-v1-root-table-family-freeze.md)；
- 守护：`tests/contract/test_architecture_documents.py`（DDL 与文档逐字对齐、
  `ROOT_PRIVATE_TABLES` 常量须随批由七枚改三枚、`stale` 判据）。
