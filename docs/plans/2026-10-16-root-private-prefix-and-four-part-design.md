# 根私有表前缀定档 qe_ 去 learn_ 段与共享库总纲四段式重排（root-private-prefix-and-four-part-design）

状态：In Progress
任务类型：B
最后更新：2026-10-21
关联 ADR：[ADR 0024](../adr/0024-preschema-rebuild-tiers-and-demo-gate.md)、[ADR 0017](../adr/0017-design-doc-structure-contract.md)（事实源唯一：总纲零 DDL）、[ADR 0009](../history/adr/v0.1/0009-shared-qed-tables.md)（共享 `qed_*` 表族）、[ADR 0011](../history/adr/v0.1/0011-pending-design-location.md)
关联设计：[database-design.md](../architecture/database-design.md)（本轮落点：四段式重排 + 前缀口径）、[cross-project-contracts.md](../design/cross-project-contracts.md)（schema 变更顺序）、[downloads-flow.md](../design/downloads-flow.md) §5.2/§5.4（降级直写口径）
关联 Tracker：docs/trackers/todo.md（REQ-120 登记，普通任务轮 ARCH-035 节）；**二次改名（摘除 `learn_` 段）与逐表重构由 [REQ-132 壳](2026-10-21-qe-family-rename-and-refactor.md) 承接**（2026-10-21 用户改判，见「过程与证据」）
归档判定：Retain（前缀改名的现名/目标名对照与四段式重排理由属不可替代口径）

> **demo 门不适用声明**（ADR 0024 决定 2）：本轮文档面为登记层重排与命名口径成文，无新增运行
> 行为；代码批次（W3/W4）的端到端验证由「黄金路径复核 + 门禁」承载，不设独立 demo 门。

## 目标与成功标准

**目标**：把根仓库自建的学习域表从「居共享 `qed_*` 命名空间、仅根读写」的**反向例外**改名为独立
前缀 `qe_` 且**不带 `learn_` 子域段**（2026-10-21 用户裁决定档；学习容器取 `qe_course_state` 以避开与共享
课程目录表 `qed_course` 的目标名撞车），使命名空间隔离规则回到「前缀＝所有权」的单一形态；同时把总纲
[database-design.md](../architecture/database-design.md) 按**共享 `qed_*` 四表 → 根私有 `qe_*` → `af_*` → `qt_*`**
（顺序判据以 ADR 0025 决定 3 为准）的优先级重排一次，让读者的阅读顺序与「先共享契约、后私有实现」的变更权重一致。

**承载分层**：本行只承载**文档与命名定档层**（总纲四段式重排、表清单与读写矩阵归位、目标名定档成文）；
改名代码批次与库内 `RENAME` 归 [REQ-132](2026-10-21-qe-family-rename-and-refactor.md)，`af_*` 族结构梳理归
[REQ-133](2026-10-21-af-family-table-refactor-request.md)。

**成功标准正本在台账行**（[ADR 0023](../adr/0023-todo-row-carries-scope-and-criteria.md)）：逐条对照
todo.md `REQ-120` 行「成功标准」列，本壳不复制判据。

## 范围与非目标

**范围**：
- W1/W2 文档面：总纲四段式重排、表清单与读写矩阵按四段归位、`af_*`/`qt_*` 表数与清单修正、
  前缀目标名与现名对照成文。
- W3/W4 代码面（一次改名 `qed_learn_*` → `qe_learn_*`，**已落地**）：`services/learn/` 四文件的 DDL 表名
  与内部引用改名、测试夹具随步、`qed_test` 库内 7 张表 `RENAME TABLE`。
  **二次改名（`qe_learn_*` → `qe_*`，摘除 `learn_` 段）与库内迁移移交 [REQ-132](2026-10-21-qe-family-rename-and-refactor.md)**；
  W4 的库内批次从未执行，故改判后只剩一跳 `RENAME`，代价最低。
- W5 收口：门禁 + 真机复核 + 全仓旧名引用清零核验——**随 REQ-132 的二次改名同批收口**。

**非目标**：
- **不改四张共享表形状**（`qed_domain`/`qed_course`/`qed_knowledge_point`/`qed_llm_calls` 由 REQ-118/119 承载）。
- **不动 `qt_*`/`af_*` 任何表名与代码**（属对方命名空间，本轮只在根侧文档修正其清单登记）。
  2026-10-21 起，`af_*` 族的结构梳理另立跨项目请求稿 [REQ-133](2026-10-21-af-family-table-refactor-request.md)（执行权归 Axiom-Flow）。
- **不动生产 `qed` 库**：根私有表在生产库从未建过，改名在生产侧零操作，DDL 仍随发布批次转人工。
- **不在代码批次放行前把旧名从文档里抹掉**：`qed_learn_*` 仍是盘上现名，删掉即造成文档与库内事实漂移。

## 前置条件

1. 用户裁决（2026-10-16）三条已生效：承载＝新行 REQ-120；范围＝**文档先行、代码下一批**；
   命名粒度＝`qe_learn_*`（保留 `learn` 子域段，非整族 `qe_*`）。**该第三条已于 2026-10-21 被改判**
   ＝前缀统一 `qe_` 且摘除 `learn_` 段、四张共享表保持 `qed_`、撞名处学习容器取 `qe_course_state`，
   执行承载＝新行 [REQ-132](2026-10-21-qe-family-rename-and-refactor.md)（裁决原文与本壳理由见「过程与证据」2026-10-21 条）。
2. REQ-118 W7（三仓共享表描述同步核验）产出偏差清单后，总纲重排才与核验结论同批落笔。
3. 代码批次（W3/W4）放行前须确认 8900/8902 无在跑任务，且与 REQ-118 的 `DROP COLUMN confirmed`
   一步排同一窗口，避免两次重启。

## 命名映射（现名 → 目标名）

七张根自建表全部落在共享命名空间的 `qed_learn_` 子段，改名只动前缀、不动表义。**本表目标名列已于
2026-10-21 被用户改判作废**（裁决＝前缀统一 `qe_` 且**摘除 `learn_` 子域段**、四张共享表保持 `qed_`、
学习容器表让名取 `qe_course_state`）；改判后的定档表以 [REQ-132 壳](2026-10-21-qe-family-rename-and-refactor.md)
「命名定档」节为唯一正本，本表只保留作「盘上现名 → 一次改名后代码现名」的事实登记：

| 现名（盘上事实） | 一次改名后的代码现名（本壳 W3 产物） | 定档目标名（**移交 REQ-132**，本壳原目标名列作废） | 结构事实源 |
| --- | --- | --- | --- |
| `qed_learn_course` | `qe_learn_course` | `qe_course_state` | `backend/qed_engine/services/learn/base.py` |
| `qed_learn_unit` | `qe_learn_unit` | `qe_unit` | 同上 |
| `qed_learn_unit_progress` | `qe_learn_unit_progress` | `qe_unit_progress` | 同上 |
| `qed_learn_kp_detail` | `qe_learn_kp_detail` | `qe_kp_detail` | `backend/qed_engine/services/learn/knowledge.py` |
| `qed_learn_question` | `qe_learn_question` | `qe_question` | `backend/qed_engine/services/learn/practice.py` |
| `qed_learn_attempt` | `qe_learn_attempt` | `qe_attempt` | 同上 |
| `qed_learn_review_task` | `qe_learn_review_task` | `qe_review_task` | 同上 |

**边界澄清（两条不随改名）**：
- `qed_knowledge_point` 是**四张共享表之一**（结构由根定义、三项目语义上可读写），保持 `qed_` 前缀不改。
- `qed_llm_calls` 有外部写方，保持 `qed_` 前缀不改。
- 2026-10-21 改判把该「不随改名」边界推广到**四张共享表全体**（`qed_domain`／`qed_course`／
  `qed_knowledge_point`／`qed_llm_calls`），R1「前缀即所有权」因此不被破坏，本批改判**不需新 ADR**。

## 工作项

| 条目 | 内容 | 状态 |
| --- | --- | --- |
| W1 | 总纲 [database-design.md](../architecture/database-design.md) 四段式重排：`qed_*` 共享表族要点节内按 qed_domain → qed_course → qed_knowledge_point → qed_llm_calls 归位（把误挂在共享节里的「`qed_learn_*` 学习域三表」小节移出并入根私有节）；`qt_*`／`af_*`／根私有依次随后；「库与命名空间」补前缀规则与目标名声明 | 已完成（2026-10-18 复核定稿：现读总纲已含 `af_*` 五表／`qt_*` 五表与 `qe_learn_*` 七表并列声明＋§7.8 直写越界标注，本项登记内容全部落定。**判据改判**＝四段顺序由 [ADR 0025](../adr/0025-database-design-master-doc-and-ddl-ownership.md) 决定 3 取代、落点形态改为「全库总览大表＋逐表详细设计」；台账行文本按 ADR 0023 冻结不动，理由记本壳） |
| W2 | 总纲登记表漂移修正（承 REQ-118 W7 核验结论）：`af_*` 四表→**五表**补 `af_page_regions`、`qt_*` 四张在用→**五张**补 `qt_selections`、元数据「需求方」行随步、读写矩阵 `qed_course` 降级直写列清单逐列写清不再「同上口径」并标注与对方白名单冲突处、`meta` 守则正例先例死引用 `qed_learn_practice_source.meta` 改 `qed_learn_question.meta` | 已完成（2026-10-18 复核同上：`af_page_regions`／`qt_selections` 已入清单、元数据需求方行随步、读写矩阵降级直写列清单逐列写清，均实存于新骨架） |
| W3 | 代码面改名（**待放行**）：`services/learn/base.py`／`knowledge.py`／`practice.py` 与 `api/learn.py` 的 DDL 表名、`_REQUIRED_COLUMNS` 补列清单、SQL 片段与注释同步，`tests/` 夹具随步；改动只做字符串层面的表名替换，不改列形状与语义 | 已完成（2026-10-16 用户裁决「现在就动码」）：批量替换 **88 处／9 文件**（旧前缀 `qed_learn_` 全部改为 `qe_learn_`，脚本逐文件计数见「过程与证据」节），根侧九张建表语句的排序规则声明 **9 处**由 `utf8mb4_unicode_ci` 改库默认 `utf8mb4_0900_ai_ci`（含共享命名空间的 `qed_knowledge_point`，按用户裁决「随 REQ-120 批次统一根侧表族为库默认」）；守护用例 `test_root_private_table_prefix_and_collation_match_database_design` 先红后绿；定向 `test_learn_knowledge`＋`test_learn_practice`＋`test_api`＋`test_web`＋`test_learn` **230 passed**。**2026-10-21 改判追加**＝该批只完成「一次改名」（前缀换 `qe_`、`learn_` 段保留），摘除 `learn_` 段的**二次改名移交 [REQ-132](2026-10-21-qe-family-rename-and-refactor.md)**（含根代码 103 处、根文档 125 处、web-ui 3 处、守护常量与总纲逐字 DDL 随步） |
| W4 | `qed_test` 库内迁移（**待放行**）：`RENAME TABLE qed_learn_x TO qe_learn_x` 七条 + 幂等自检脚本 + 改名前后行数核验；生产 `qed` 库零操作（七表从未建过），命令清单转人工随发布批次 | 待单独数据窗口（**2026-10-18 用户裁决＝本轮不动库**，排期/批准归人工）。原脚本 `tmp/req120_w4_db_batch.py` 的七条 `RENAME` 形态**作废**＝现网实测四对同名表主键零重叠且新名已实存，直接改名撞名；跨表 id 引用指向旧 id。两案（A 认新名为正本＋旧表留档废弃／B 旧行迁移＋id 重映射）与执行约束见「遗留与移交」；库内形状实测见「过程与证据」2026-10-18 条。**2026-10-21 改判追加**＝目标名由 `qe_learn_x` 作废改为 `qe_x`（学习容器取 `qe_course_state`），两案脚本与择窗清单**移交 [REQ-132](2026-10-21-qe-family-rename-and-refactor.md) W3**（其 W2 为改名代码批次、W4 为生产命令清单转人工）；本壳 W4 从未执行，故改判后库内只余一跳 `RENAME`（`qed_learn_x` → 定档名），不必两跳 |
| W5 | 收口：全仓旧名引用清零核验（文档 + 代码 + 测试）＋契约/全量 pytest/ruff＋8903 学习三面试探（知识点页、练习面、复习队列各一次读写）＋`code-map.md`/`api-contracts.md` 随步 | 移交 [REQ-132](2026-10-21-qe-family-rename-and-refactor.md) W6（旧名清扫与 8903 三链真机须随**二次改名**同批，随本壳单独收口无意义；命中数实测见「遗留与移交」） |

## 过程与证据
- **2026-10-16 用户追加两项裁决**：① 排序规则分裂＝「随 REQ-120 批次统一根侧表族为库默认」——根侧九张建表语句的
  `utf8mb4_unicode_ci` 声明全部改 `utf8mb4_0900_ai_ci`，与 `qed_domain`/`qed_course`/`qed_llm_calls`/`qt_*`/`af_*`
  同口径，此后跨命名空间 JOIN 不再 1267；② W3＝「现在就动码」，不等并行窗口收口。
- **2026-10-16 并行窗口事实（登记为风险，不归因缺陷）**：另一窗口 11:53 在写 `api/learn.py`、11:56 在写
  `tests/test_learn.py`（+199 行，REQ-117 sync 面）。本批改名落在那两个文件的只有注释行
  （`api/learn.py:534`／`:976`，M5 与 M2 分节标题），未触碰其函数体；其整文件重写若覆盖本行改名，
  守护用例会重新转红。该窗口的在飞编辑曾使 `test_api_endpoint_inventory` 假红两枚（文档先落、代码后落），
  复跑即自愈；`ruff` 亦曾报其 `tests/test_learn.py:531` 的 `SYNC_KNOWLEDGE` 未定义（F821），属其 WIP。
- **2026-10-16 W3 逐文件替换计数**（`tmp/req120_w3_rename.py` 输出）：`api/learn.py` 4／`api/main.py` 1／
  `services/learn/base.py` 26+3／`services/learn/knowledge.py` 13+2／`services/learn/memory.py` 1／
  `services/learn/practice.py` 38+3／`services/llm/call_log.py` 0+1／`tests/test_learn_knowledge.py` 2／
  `web-ui/src/api/learn.ts` 3（前数＝表名出现次数，后数＝排序规则声明处数）。守护用例文件按旧名做反向断言，
  脚本显式排除该文件以免自我破坏。
- **2026-10-16 W4 服务窗口说明**：运行中的 8900 进程持旧名 SQL（改码前加载），RENAME 一落地学习面即报
  `1146 Table ... doesn't exist`，**必须紧随其后重启 8900** 进新代码；旧名与新名不可能同时生效，窗口不可避免，
  故 W4 与 8900 重启必须同一口气执行（REQ-118 的 `DROP COLUMN confirmed` 已在上一窗完成，不重复占用）。

- **2026-10-16 立项依据（用户裁决四条）**：三仓共享表描述重新审核后——① 承载＝REQ-118 加 W7
  （三仓同步核验）+ 新行 REQ-120（改名与四段式重排）+ 立 `DEFECT-014`；② 范围＝**文档先行、代码
  下一批**；③ 命名粒度＝`qe_learn_*`；④ Tracker / Axiom-Flow 两家文档偏差由**根侧直接改其文档
  正文**（用户明确授权代改，不另发请求稿）。
- **2026-10-16 改名影响面实测**（只读 grep 计数）：文档面 `qed_learn_` 出现 62 处／10 个存活文件，
  代码面 81 处／8 个文件（`services/learn/base.py`、`knowledge.py`、`practice.py`、`knowledge_memory.py`、
  `api/learn.py` 与对应测试）；`qed_test` 库内**七张表实存**需 `RENAME TABLE`，生产 `qed` 库**一张都没有**
  （根私有表从未在生产建过），故生产侧改名零成本、DDL 仍按 D 类转人工随发布批次。
- **2026-10-16 四段式重排的既有缺陷取证**（实读总纲）：`### qed_learn_*（QED-Engine 学习域三表）`
  挂在「qed_* 共享表族要点」节内（与后文「QED-Engine 学习表族」节重复登记）；`af_*` 节与元数据需求方
  行均写「四表」而对方表清单实为五表；`qt_*` 节写「四张在用表」而对方清单实为五张；读写矩阵
  `qed_course` 行的降级直写写「同上口径」＝继承 `qed_domain` 的列清单，与 QED-Tracker
  `database-shared-tables.md` 白名单（课程允许 `stage`/`sort_order`/`description`/`aliases`，
  **禁止** `exploration_stage`/`explore_pending`）不一致；`meta` 守则正例引用
  `qed_learn_practice_source.meta`（该表已在 M2 三表收敛时取消，实存先例＝`qed_learn_question.meta`）。
- **2026-10-17 随 REQ-122 的判据与事实随步**：① 本行 S1 与 W1 的四段顺序判据（共享→`qt_*`→`af_*`→根私有）已由 [ADR 0025](../adr/0025-database-design-master-doc-and-ddl-ownership.md) 决定 3 取代，总纲现序＝共享 `qed_*` → 根私有 `qe_*` → `af_*` → `qt_*`；台账行文本不改，以 ADR 为准。② 本行 S5 的「零 DDL 守护」随 ADR 0025 决定 2/5 删除（改由建表语句逐字对齐守护承载），`erDiagram` 守护保留并更名 `test_database_design_keeps_er_diagram`。③ W4 的库内事实由 REQ-122 W1 取证补全：`qed_test` 内 `qe_learn_course`（2 行）／`qe_learn_unit`（95）／`qe_learn_unit_progress`（0）／`qe_learn_kp_detail`（1）四张目标名表已由重启后的新代码懒建，七张旧名 `qed_learn_*` 全部仍在，练习三表（`question` 2／`attempt` 6／`review_task` 3）**只有旧名**，`tmp/req120_bak/` 不存在＝改名批次从未执行；生产 `qed` 库七张根私有表一张都没有。④ 总纲四段式重排的落点形态已随 REQ-122 改为「全库总览大表 + 逐表详细设计」，本行 W1/W2 的表清单与读写矩阵修正事实全部被承接到新骨架里（`af_*` 五表、`qt_*` 五表、降级直写列清单逐列写清）。

- **2026-10-16 待办边界**：文档重排只改登记形态，不声称代码已改名——总纲同段必须并列声明
  「现名 `qed_learn_*`／目标名 `qe_learn_*`，改名待 W3/W4 放行」，否则文档领先库内事实。

- **2026-10-18 台账清理第⑦行复核（用户当令「只改判＋补事实，W4 留待单独窗口」，本轮零库内操作、零代码改动）**：**文档面定案**＝现读 [database-design.md](../architecture/database-design.md) 已是 `af_*` 五表／`qt_*` 五表＋`qe_learn_*` 七表「表名待确认」并列声明＋§7.8 直写越界标注，W1/W2 判据内容全部落定，两行按此改判为已完成。S1 的**四段顺序**判据由 [ADR 0025](../adr/0025-database-design-master-doc-and-ddl-ownership.md) 决定 3 取代、总纲落点形态改为「全库总览大表＋逐表详细设计」——台账行文本按 ADR 0023 冻结不动，改判理由只记本壳。**W4 现状实测（只读探针 `tmp/req120_probe.py`／`tmp/req120_overlap.py`）**＝`qed_test` 内根私有表 **11 张并存**：新名 4 张（`qe_learn_course` 2／`qe_learn_unit` 95／`qe_learn_unit_progress` 0／`qe_learn_kp_detail` 1，由重启后新代码懒建并重灌）＋旧名 7 张全在（`qed_learn_course` 2／`unit` 95／`unit_progress` 2／`kp_detail` 3／`question` 2／`attempt` 6／`review_task` 3）；四对同名表**主键零重叠**（`both=0`、列集一致），跨表 id 引用指向旧 id；`qed_learn_question`／`attempt`／`review_task` **只有旧名**而代码只读 `qe_learn_*` ⇒ 2 题／6 次作答／3 条复习任务现网学习面**当前不可见**（本行唯一用户可见缺口）；排序规则半张同样未落＝旧名七表＋`qed_knowledge_point` 库里仍 `utf8mb4_unicode_ci`（代码声明已改 `utf8mb4_0900_ai_ci`）；生产 `qed` 库零根私有表（与预期一致），`tmp/req120_bak/` 不存在＝改名批次从未执行。**结论**＝W4 属带数据语义的迁移决策而非机械改名（两案见「遗留与移交」），一次性数据窗口归人工排期，本行保持 In Progress。

- **2026-10-21 用户改判三条（REQ-120 调整轮，AskUserQuestion 多选原文＝「只改根私有七表」＋「学习侧改名 qe_course_state」＋「按推荐登记 REQ-132/133」）**：① **命名粒度改判**＝前缀统一 `qe_` 并**摘除 `learn_` 子域段**，本壳 2026-10-16 第三条裁决（保留 `learn`）作废；② **范围改判**＝只改根私有七表，四张共享表 `qed_domain`／`qed_course`／`qed_knowledge_point`／`qed_llm_calls` 保持 `qed_` 前缀——本条把「全量换 `qe_`」的设想挡在 R1 之前：共享四表改名等于取消「前缀即所有权」的共享／私有用前缀分开的语义，需 ADR 0025 的新修订版本才能承载，且触达对方代码 101 处／对方文档 455 处／AF 文档 30 处与生产库四张有数据的表（上线红线），故不采；③ **撞名处置**＝摘段后学习课程容器欲取的 `qe_course` 与共享课程目录表 `qed_course` 的目标名同名（两表形状完全不同：17 列目录 vs 16 列学习容器、主键 `course_id` vs `learn_course_id`），由**学习侧让名**取 `qe_course_state`，共享表名不动。**执行承载**＝新行 [REQ-132](2026-10-21-qe-family-rename-and-refactor.md)（B 类：二次改名代码批次 + 库内归一 + 逐表形状判定表，demo 门＝练习三表改名后现网 2 题／6 作答／3 复习任务在面可见）；`af_*` 族重构另立 [REQ-133](2026-10-21-af-family-table-refactor-request.md)（A 类跨项目请求稿，执行权归 Axiom-Flow）。**台账行文本按 ADR 0023 冻结不动**（本行描述列仍写 `qe_learn_*` 与四段式重排），改判理由与作废目标名只记本壳；本壳 W3/W4/W5 的状态格已显式写「移交 REQ-132」，故本行不提前关闭、保持 In Progress。**本轮零代码改动、零库内操作**（改判只落文档），取证脚本与形状快照见 REQ-132 壳「过程与证据」节。
- **2026-10-21 用户第二道令＝改写 REQ-120 台账行表述**（原文＝「REQ-120 先更改表述，现在已经确定好新的方向了」）：上一轮按 ADR 0023 把行文本冻结在旧方向（描述列仍写 `qe_learn_*`、S4/S5 仍持库内迁移与零 DDL 守护判据），本轮由用户明令解除冻结，行与壳标题一并改写为新方向。四处改动＝① 壳 H1 与 todo 行链接标题同步改为「根私有表前缀定档 qe_ 去 learn_ 段与共享库总纲四段式重排（root-private-prefix-and-four-part-design）」（文件名不变，`PLAN_FILE` 命名口径与外部指针零影响，仅 `docs/history/plans/2026-10/2026-10-15-shared-tables-field-freeze.md:110` 与 REQ-132 壳「关联 Tracker」按文件名指向本壳，链接仍有效）；② 描述列改写为「定档 `qe_` 且摘除 `learn_` 段＋四张共享表保持 `qed_`＋学习容器让名 `qe_course_state`＋执行移交 REQ-132＋`af_*` 另立 REQ-133」；③ 成功标准列 S3 改为「盘上现名 `qed_learn_*` 与定档目标名 `qe_*` 并列声明」、S4 由「库内七表以新名实存」改为**移交口径三处互指一致**（本行描述／本壳 W3~W5 状态格／去向 REQ-132 壳 W2/W3）、S5 由「零 DDL 与 erDiagram 守护」改为「表名逐字对齐守护与 erDiagram 守护」（零 DDL 守护早已随 ADR 0025 决定 2/5 删除，本行随步更正）；④ 「目标」段增写**承载分层**声明，把本行的职责边界钉在文档与命名定档层。**行状态保持 `In Progress`（关闭与否待用户发令）**：S1/S2/S3/S5 的判据内容均已达成，新 S4 只核「移交三处互指」也已成立；但按 ADR 0022 决定 3，移交型关闭需把逐条达成证据写入本节并经用户令，且改名执行实质仍未落地（在 REQ-132 手里），故本壳不自行提前关闭，W4/W5 状态格显式保留「移交」标记。**本轮仍零代码改动、零库内操作**（表述改写只落文档）。

## 验证与验收

- 文档面（W1/W2）：`tests/contract/` 全绿（含 `test_architecture_documents.py` 的零建表语句与
  `erDiagram` 守护、`test_code_document_mapping.py` 的 DesignRef 唯一性）＋链接门禁全绿。
- 代码面（W3）：`pytest -q` 全量 + `ruff check backend tests`；`tests/test_learn*.py` 与
  `tests/test_llm_call_log.py` 定向绿；库内 `SHOW TABLES` 七张 `qe_learn_*` 存在、旧名七张不存活、
  行数与改名前逐表一致。（2026-10-18 注：按**形态 A** 执行时旧名以 `*_legacy_<stamp>` 留档存在，该判据取值为「旧名不存活、仅留档表存在」；按**形态 B** 保持原判据。）
- 真机面（W5）：8900 重启后 8903 `#/knowledge`、`#/practice`、`#/learn` 三链各跑一次读写，
  `/learn/star-map` 计数与库内 `COUNT(*)` 一致。

## 回滚

- W1/W2（文档）：`git diff` 层面回退本轮总纲改动即可，无库内影响。
- W3（代码改名，已落地）：改动为纯表名字符串替换，回滚＝还原该批代码 diff，不涉及数据。
- W4（`RENAME TABLE`）：回滚＝反方向七条 `RENAME TABLE qe_learn_x TO qed_learn_x`（同名对象必须
  不存在）；`RENAME TABLE` 为原子操作且不改数据，回滚不需要备份数据行，但执行前仍按
  [ADR 0024](../adr/0024-preschema-rebuild-tiers-and-demo-gate.md) 备份确认档对整个 `qed_test`
  库这七表做整表 JSON 临时备份，验收确认后按 ADR 0019 决定 4 清理不留残留。

## 关闭与归档

- 关闭条件＝W1~W5 全达成且全仓旧名引用清零；任一工作项转交后续批次时本壳保持 In Progress，
  不以「文档已完成」提前关闭。**当前状态（2026-10-21）＝W4/W5 已显式移交 REQ-132，本行 S4（库内七表以
  定档名实存、旧名不存活且逐表行数一致）与 S5（契约门禁不回归）在 REQ-132 落地前不可达，本壳不关闭**；
  REQ-132 收口时按 todo 行 S 条目逐条对照决定 `Achieved`／`Partial`，证据写本壳「过程与证据」节。
- 关闭动作按 `qed-closeout`：todo 行原子移入 completed.md（关闭结果 + 门禁证据），本壳按归档判定
  Retain 留原位；若后续版本收口再迁 `history/plans/<year-month>/`。

## 遗留与移交

**W4 库内迁移＝本行唯一未执行项，2026-10-21 起整体移交 [REQ-132](2026-10-21-qe-family-rename-and-refactor.md) W3**（承 2026-10-18 用户裁决「只改判＋补事实，W4 留待单独数据窗口」）。原七条
`RENAME TABLE` 清单与脚本 `tmp/req120_w4_db_batch.py` **作废**：现网名冲突与跨表 id 引用使其必须先选形态。
**阅读口径**＝以下两案文本里的 `qe_learn_*` 一律读作 2026-10-21 定档名 `qe_*`（学习容器 `qe_course_state`），
逐表目标名以 REQ-132 壳「命名定档」表为唯一正本；两案判据本身不变。
两案共同的执行约束＝执行前逐表整表 JSON 备份进 `tmp/req120_bak/`、执行后**立刻重启 8900**（旧名与新名不可能
同时生效，窗口不可避免）、脚本只允许打 `qed_test`；**生产 `qed` 库零操作**（七表从未建过，DDL 仍按 D 类转
人工随发布批次）。

- **形态 A＝认新名为正本＋旧表留档废弃**（最快、可当轮收口）：练习三表 `qed_learn_question`／`qed_learn_attempt`
  ／`qed_learn_review_task` 直接 `RENAME`（新名不存在，无撞名，学习面缺口当场修复）；`qed_learn_unit_progress`
  先 DROP 同名**空**表 `qe_learn_unit_progress`（0 行）再 `RENAME` 旧表；`course`／`unit`／`kp_detail` 三对以
  懒建新名表为正本，旧表 `RENAME` 为 `*_legacy_<stamp>` 留档不 DROP。代价＝旧行中未进新名的内容（`kp_detail`
  旧 3 行 vs 新 1 行、`unit_progress` 旧 2 行、两侧各 95 行的 `unit` 是否同一批内容）只在留档表可见，执行前
  须逐表比对确认新名表已是现网真值。
- **形态 B＝旧行迁移＋id 重映射**（保数据，工作量与风险都在引用一致性）：旧行 `INSERT` 进新名表并重排自增 id，
  同步修 `unit_progress.unit_id` → 新 `unit_id`、`qe_learn_kp_detail` 与 `qed_knowledge_point.from_detail_id`／
  `parent_kp_id` 的跨表引用；须先出 id 映射表与逐表行数＋引用完整性断言，验收后再废弃旧名。四对同名表主键
  **零重叠**＝两案都可行，但 B 案必须处理「同一逻辑单元在两侧各有一套 id」。
- **执行侧归属**＝一次性数据窗口（D 类）：排期与批准归人工，agent 侧可交付的是两案的脚本＋回归取证与择窗清单。
- **W5 随 W4**：非 `history/` 存活文件实测旧名 34 处／12 文件（`todo.md` 行描述、本壳「命名映射」表、
  `completed.md` 留档与 `tests/contract/test_architecture_documents.py` 的反向断言属合法现名陈述，其余是描述
  「当前表名」的架构/设计文档处，须随改名清扫）＋8903 `#/knowledge`、`#/practice`、`#/learn` 三链各一次读写
  与 `/learn/star-map` 计数对齐。**2026-10-21 随改判更新**＝该 34 处／12 文件的口径只对**一次改名**（`qed_learn_`
  → `qe_learn_`）成立；摘除 `learn_` 段的二次改名影响面按 2026-10-21 只读复扫＝根代码 103 处、根文档 125 处、
  `web-ui` 3 处，清扫与三链真机同批工作**移交 REQ-132 W6**，本壳不再单独持有收口动作。

1. `DEFECT-014`（`shared_tables.py` 课程态恒直写 + 「已生成」越界值）已按裁决另立台账行，由普通任务轮
   壳 W22 承载，不在本壳执行。
2. Tracker `database-shared-tables.md` 的 `qed_course` 白名单与根侧读写矩阵冲突处由用户授权**根侧直接
   改文档正文**，改后仍需 REQ-119 请求稿跟踪对方代码是否真按白名单收口（对方代码不改）。