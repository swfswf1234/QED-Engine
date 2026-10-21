# 四张共享表字段定档跨项目请求稿（QED-Tracker 承接）（shared-tables-tracker-request）

状态：In Progress
任务类型：A
最后更新：2026-10-18
关联 ADR：[ADR 0009](../history/adr/v0.1/0009-shared-qed-tables.md)（`qed_*` 共享表所有权与命名空间）、[ADR 0003](../history/adr/v0.1/0003-shared-qed-database-independence.md)（共享 qed 库＝独立性铁律的明确例外）、[ADR 0017](../adr/0017-design-doc-structure-contract.md)（事实源唯一）、[ADR 0024](../adr/0024-preschema-rebuild-tiers-and-demo-gate.md)（1.0 前 schema 重建档位）、[ADR 0023](../adr/0023-todo-row-carries-scope-and-criteria.md)（成功标准正本在台账行）
关联设计：[cross-project-contracts.md](../design/cross-project-contracts.md) §4（`qed_*` 共享表 schema 变更顺序）、[database-design.md](../architecture/database-design.md)（总纲，零 DDL）、[REQ-118 审理壳](../history/plans/2026-10/2026-10-15-shared-tables-field-freeze.md)（四表逐列定档结论的唯一出处）、QED-Tracker [database-design.md](../../QED-Tracker/docs/architecture/database-design.md)（`qed_domain`/`qed_course` 结构事实源，**只读**）
关联 Tracker：docs/trackers/todo.md（REQ-119 登记，普通任务轮 ARCH-035 节）
归档判定：Retain（跨项目请求原文、证据锚点与回执口径属不可替代过程证据）

## 对接信息（跨项目协作规范·计划文档模板）

| 项 | 值 |
| --- | --- |
| 需求方 | QED-Engine 根仓库（REQ-118 四表定档轮） |
| 目标项目 | QED-Tracker（8901） |
| 接口面 | MySQL 共享库 `qed_domain`／`qed_course` 两表形状（结构事实源与写权限在对方）＋对方 `database-shared-tables.md` 表3 `qed_llm_calls` 快照口径；无端口／协议／`.env` 变量变化 |
| 评审方 | 用户 |
| 执行方 | QED-Tracker 会话（其 `db/models.py` + `ensure_schema` 自愈 + 其 docs 与门禁） |
| 验收标准 | 逐条对照 todo.md `REQ-119` 行「成功标准」列（S1~S4） |

## 目标与成功标准

**目标**：把 REQ-118 对四张共享表的逐列定档结论中**属于 QED-Tracker 的两张表**（`qed_domain`／`qed_course`）
以请求稿形式交给结构事实源与写权限的持有方执行，并顺带请对方裁决一枚空转列与一处文档快照漂移；
目标效果＝四张共享表形状一次定死，此后新增试验字段一律进 `meta`，不再改表结构。

**成功标准正本在台账行**（ADR 0023）：逐条对照 todo.md `REQ-119` 行「成功标准」列，本壳不复制判据。

## 范围与非目标

**范围**：R1~R6 六项请求成文、逐条带证据锚点与兼容性判定，并按[跨项目协作规范](../standards/cross-project-collaboration.md)
登记到根台账请求行；回执跟踪口径写本壳。

**非目标**：
- **不改对方代码，也不改对方文档**（本壳只写在根仓库侧）：对方 `models.py`、`ensure_schema`、其 docs 与
  其 todo 承接行一律由对方会话执行；若经用户放行由根侧代登对方文档面，须把「其
  `tests/test_documentation.py` md 清单同步」列为对方承接第一步（该测试是文档全集等值白名单，
  新增 md 不同步即红）——**2026-10-18 按该条件代登时采取「只改其既有文件、不新建 md」形态，白名单因此未触**，
  义务转为对方若另建专稿时的第一步（已写进其承接节条款）。
- **不动生产 `qed` 库 DDL**：属 D 类转人工，本壳只提供语句清单与影响面。
- **不改 8901 API 响应字段**：R5 两列的删除已由用户 2026-10-18 复裁定案，但响应字段与其 `api.md` 的摘除仍归对方契约变更流程，根侧不代为执行。
- 不涉 `qt_*` 私有表，不涉 Axiom-Flow（`af_*` 与 8902 侧本轮无请求）。

## 请求项

| ID | 对象 | 请求 | 证据锚点（实读，非推断） | 兼容性 |
| --- | --- | --- | --- | --- |
| R1 | `qed_domain`、`qed_course` | 各加一枚扩展槽 `meta JSON COMMENT '扩展槽：未定档字段先入本列（只读不筛）；定档后升为实体列并清空对应键'`，与四表同口径 | 现两表**无该列**（[database-design.md 表1/表2 DDL](../../QED-Tracker/docs/architecture/database-design.md)）；根侧同族先例 `qed_learn_practice_source.meta`（[practice.py:84](../../backend/qed_engine/services/learn/practice.py#L84)）；定档理由见 REQ-118 壳「审理与定档」节 | 加法；但对方「模型即 schema」自愈把列集不一致判为**整表 DROP+CREATE 重建**（[其文档 §Schema 自愈](../../QED-Tracker/docs/architecture/database-design.md)），重建会清 `path_results`/`explore_pending` 探索产物——**请择窗执行并先备份**，或按其 ADR 0006 流程处置 |
| R2 | `qed_domain.domain_id`（PK）、`qed_course.domain_id` | 宽度 VARCHAR(32) → **VARCHAR(64)** | 对方现声明 [models.py:74-80](../../QED-Tracker/src/qed_tracker/db/models.py#L74)（`domain_id` String(32)）、其 DDL 表2 `domain_id VARCHAR(32)`；根侧引用列已是 VARCHAR(64)（[knowledge.py 主表 DDL](../../backend/qed_engine/services/learn/knowledge.py#L40)）——同一逻辑引用两档宽度 | 放宽，无数据截断风险（现网最长领域标识 `math-advanced` 远小于 32） |
| R3 | 两表主键 | 把「**主键不可变**」写进对方文档的写权限节：`domain_id`／`course_id` 创建后不得改值 | 根侧 `qed_knowledge_point` 以 `domain_id`/`course_id` 为坐标列并建 `idx_kp_domain` 检索（[knowledge.py:44-46](../../backend/qed_engine/services/learn/knowledge.py#L44)）；改值即碎引用且无级联约束 | 纯文档登记，零 schema 变更 |
| R4 | `qed_domain.level`、`qed_domain.scope` | 只改**注释口径**（不改列名）：`level`＝默认学习层级（如「本科」，管线 domain@v4 输出）、`scope`＝学科知识边界描述（当前管线不输出，恒空） | 现注释交叉：[models.py:79](../../QED-Tracker/src/qed_tracker/db/models.py#L79) `comment="探索范围"`、[:80](../../QED-Tracker/src/qed_tracker/db/models.py#L80) `comment="学科知识"`，而其提示词把 level 定义为「默认学习层级（如 本科）」（[templates.py:227](../../QED-Tracker/src/qed_tracker/prompt_lab/templates.py#L227)）、`prior_knowledge = scope 整理 + 学习建议`（[templates.py:11](../../QED-Tracker/src/qed_tracker/prompt_lab/templates.py#L11)） | 注释级；改列名会破坏其 API 面，故明确**不改名**（REQ-118 壳表1 定档） |
| R5 | `qed_domain.path_results` ＋ `qed_course.related_targets` | **用户 2026-10-18 复裁＝两列都删**（原裁决 ③ 恢复生效，2026-10-15 的「请对方裁决去留」收回）。取证事实不变：该列有读方（[courses.py:59](../../QED-Tracker/src/qed_tracker/courses.py#L59)、[api/main.py:803](../../QED-Tracker/src/qed_tracker/api/main.py#L803)）与响应透出，但全仓无生产者写入非空值（唯一写点＝建课时 `related_targets=[]`，[knowledge_repository.py:261](../../QED-Tracker/src/qed_tracker/db/knowledge_repository.py#L261)）→ `related_targets` 属**空转列**、`path_results` 属活列。删除须连同 8901 响应字段与其 `api.md` 同批摘除；根侧不代为执行 | 同左（REQ-118 壳「裁决 ③ 的两处证据改判」节登记全量取证） | 删列＝对方契约变更（破坏性），按其 §Schema 变更流程走；响应字段与其文档须同批摘除，否则其文档门禁与根侧消费面同时漂移 |
| R6 | 对方文档表3 `qed_llm_calls` 快照 | 该节自称「下列 DDL 即真实建表语句」，现缺 `meta` 列与三条二级索引、`provider` 注释仍是旧口径（`qwen/deepseek/glm/lmstudio/gateway`）。两个选项：① 随步更新快照；② **改为指针**——结构事实源是本表建表方根仓库 [call_log.py](../../backend/qed_engine/services/llm/call_log.py)（ADR 0017 事实源唯一），对方文档只登记消费语义与「绝不 DROP 重建」约束 | 根侧定档：`CREATE_TABLE_SQL` 已含 `meta`＋`idx_llm_created`／`idx_llm_service_created`／`idx_llm_task_step`，provider 注释含 lmstudio/llamacpp/mineru（[registry.py:386](../../backend/qed_engine/services/llm/registry.py#L386) 实际写 runtime 名）；对方文档快照停在 2026-08-28 注释补齐轮 | 纯文档；根侧启动 `ensure_columns`/`ensure_comments`/`ensure_indexes` 已把真实表补齐，快照不改即漂移 |

**根侧使用守则（随请求一并登记，请对方遵守）**：`meta` 不进 `WHERE`、不建函数索引；不放密钥与个人信息；
不放跨项目契约字段——需要过滤或参与唯一键即为该字段**定档**之时。

## 前置条件

1. REQ-118 四表逐列定档结论已成文（[审理壳](../history/plans/2026-10/2026-10-15-shared-tables-field-freeze.md)「审理与定档」节），根所属两表
   的形状已在 `qed_test` 代码侧落地——请求稿不得与其口径相反。
2. `qed_domain`/`qed_course` 结构事实源与写权限在 QED-Tracker（[其 §命名空间与写权限](../../QED-Tracker/docs/architecture/database-design.md)），
   根侧 `shared_tables.py` 只在 8901 离线时按白名单降级直写维护字段，**不含**本轮 R1/R2 涉及的形状。
3. 生产 `qed` 库（8902 侧连接）执行时机与红线归对方与人工，本壳不排窗。

## 工作项

| 条目 | 内容 | 状态 |
| --- | --- | --- |
| W1 | 请求稿成文（本壳，R1~R6 逐条带证据锚点与兼容性判定）+ 根台账 `REQ-119` 请求行登记 + [cross-project-contracts.md](../design/cross-project-contracts.md) §4 加请求登记指针 | 已完成（2026-10-16 成文并登记） |
| W2 | 移交对方文档面：经用户放行后把本稿转写为 QED-Tracker `docs/plans/` 承接稿与其 todo 请求行；**对方承接第一步＝其 `tests/test_documentation.py` md 清单同步**（否则其文档门禁即红），代码面（`models.py`＋`ensure_schema`）一律归对方会话 | 已完成（2026-10-18 经用户放行由根侧代登对方**文档面**：其 `docs/trackers/todo.md` 长期任务表加 `QED-080` 承接行、其 `docs/plans/2026-09-24-v1-task-chain.md` 加「承载根仓库 REQ-119」节（六项对接信息＋R1~R6 逐条承接位）。**代登形态＝只改其既有两份文件、不新建 md**，故其 `test_documentation.py` 文档白名单未触、无需同步；该「新建专稿须先同步白名单」义务已在承接节内写成条款留给对方。其门禁代跑＝`tests/test_documentation.py` 9 passed、全量 667 passed／1 skipped、ruff All checks passed（含其窗口在树改动，本会话不代提交）。代码面一律未动 |
| W3 | 回执跟踪：对方逐条回执（落地／推后／拒绝 + 其门禁输出）记入本壳「过程与证据」节，并按回执同步根侧 [database-design.md](../architecture/database-design.md) 的读写矩阵与消费语义 | 待对方回执 |

## 过程与证据

- **2026-10-16 登记依据（用户裁决 ④）**：REQ-118 本轮做到「审理稿 + 根侧两表落地」，`qed_domain`／`qed_course`
  属 QED-Tracker，故其形状变化以跨项目请求稿形式发出并登记，不由根侧代改代码
  （[REQ-118 壳「过程与证据」节](../history/plans/2026-10/2026-10-15-shared-tables-field-freeze.md)四项裁决登记）。
- **2026-10-16 取证方式**：R1~R6 每条锚点均为当轮实读对方源码/文档行号（`models.py`、`knowledge_repository.py`、
  `courses.py`、`api/main.py`、`prompt_lab/templates.py`、`database-shared-tables.md`），符合
  [跨项目协作规范](../standards/cross-project-collaboration.md)「诊断三必查·禁止无证据归因」；
  根侧引用列宽度与 `meta` 先例取自本仓库实读（`knowledge.py`、`practice.py`）。
- **2026-10-16 裁决 ③ 的两处死列改判在本稿中的处置**：`path_results` **撤回删列请求**（对方真在写，
  见其 `knowledge_repository.py:295`）；`related_targets` **改为请对方裁决去留**（R5），根侧不单方删。
- **2026-10-16 移交通道未启动**：本稿暂只落根仓库侧；对方 `docs/` 与 todo 的承接登记待用户放行（W2）。
- **2026-10-18 W2 移交执行（用户当令「本轮移交＋六项同批发出」，根侧代登对方文档面）**：对方承接位两处＝其 `QED-Tracker/docs/trackers/todo.md` 长期任务表新增 `QED-080`（Candidate／待开始，事项内 R1~R6 逐条列出）、其 `QED-Tracker/docs/plans/2026-09-24-v1-task-chain.md` 在「跨项目接口」节后新增「承载根仓库 REQ-119」节，该节含**六项对接信息表**（需求方／目标项目／接口面／评审方／执行方／验收标准）与 **R1~R6 逐条承接表**（对象／请求／本仓执行位／兼容性）。**S1 判据的读法在此声明**＝对方 todo 有承接行（QED-080）＋承接稿逐 R 一行且六项齐备；若按「六条 todo 行」的严格读法，S1 仍差五条，本轮按前者成文并在此留痕待用户复核。**形态纪律**＝只改其既有两份文件、**不新建 md**（其 `test_documentation.py` 是全量 md 等值白名单，新建专稿必须同步其清单，而那是代码改动、根侧不做），故其文档门禁天然不红；该义务作为条款写入其承接节。**代登取证（其门禁，本会话代跑）**＝`tests/test_documentation.py` **9 passed**、`pytest tests -q` **667 passed／1 skipped**、`ruff check src tests scripts` **All checks passed**；其工作树本已含其窗口的在飞改动（`docs/plans/2026-09-14-bugfix-ledger.md`、`docs/plans/index.md`、`tests/test_documentation.py` 与其新增未跟踪的 QED-079 专稿），本会话不代提交、不改其代码。根侧随步三处＝本壳 W2 与「范围与非目标」白名单条款、`cross-project-contracts.md` §4 REQ-119 登记行补承接状态、`project-status.md` 主线一条。**S2/S3 未动**＝对方逐条回执与根侧 `shared_tables.py`／总纲消费语义随步仍在对方侧，本行保持 In Progress。
- **2026-10-18 用户复裁随步（承 REQ-118 关闭轮）**：两枚死列都删 → R5 形态由「请对方裁决去留」改「请删列并连响应字段与 `api.md` 同批摘除」，对象扩为 `qed_domain.path_results` ＋ `qed_course.related_targets`。R1~R6 编号与条数**不变**（REQ-119 行的成功标准按 ADR 0023 冻结，S1 的「R1~R6 逐条有承接行」判据不因此扩容而失效）。库内实测两列仍在（`qed_test`，只读 `information_schema`），故根侧文档只登记「已裁删除、执行待对方」，不领先库内事实；REQ-118 壳同日按 Achieved 关闭并归档 `../history/plans/2026-10/`（本稿四枚指针随之改道）。

## 验证与验收

- 请求稿自身：R1~R6 每条都有「对象／请求／证据锚点／兼容性」四列且锚点可点开核实；`tests/contract/` 全绿
  （含 `test_cross_project_collaboration` 的请求行标注与承载壳回执标记守护、`test_tracker_governance` 的镜像与文档锚守护）。
- 对方侧验收由其仓库门禁负责（其 pytest 全量 + ruff + 文档白名单），根仓库不代跑、不代声明。
- 根侧随步：对方回执落地后，[database-design.md](../architecture/database-design.md) 四表消费语义与读写矩阵、
  `shared_tables.py` 的 SELECT/INSERT 列清单在同窗收口前完成（[cross-project-contracts.md §4](../design/cross-project-contracts.md) 消费方不得先于所有权方依赖未发布列）。

## 回滚

- 本壳与请求行：`git revert` 即撤稿；已发给对方的「撤回说明」写回对方台账，根侧不代改对方代码或文档。
- R2/R5 若对方已执行后需回退，属其自身 schema 自愈范围（模型改回即重建），根侧不承担。

## 关闭与归档

- 关闭取值 `Achieved` 需 W1 达成且 **R1~R6 逐条有对方回执**（落地／推后／拒绝）；仅发出请求而回执未到 →
  状态保持 `In Progress`，长期挂起时按 `Blocked` 三要素（阻塞证据／恢复条件／责任位置）声明。
- 若对方选择推后或拒绝，本行以 `Achieved` 关闭并把结论并入 [cross-project-contracts.md](../design/cross-project-contracts.md)
  §4 与 [database-design.md](../architecture/database-design.md) 消费语义（请求已裁决即请求生命周期结束）。
- 归档判定 `Retain` → `history/plans/2026-10/`（请求原文与取证锚点不可替）。

## 遗留与移交

- **交 QED-Tracker（W2 已随 2026-10-18 放行完成，剩 W3 执行与回执）**：本稿全文 R1~R6 已代登进其文档面（其 todo `QED-080` ＋
  其 `2026-09-24-v1-task-chain.md` 承接节）。对方 `qed_*` 形状变更须走其 `ensure_schema` 重建自愈，**择窗并先备份**（重建清
  探索产物）；R5 属破坏性契约变更，删除须连 8901 响应字段与其 `api.md` 同批摘除，落地后同批通知根侧随步。
- **交人工（D 类）**：生产 `qed` 库对 `qed_domain`/`qed_course` 的 ALTER 语句清单随 R1/R2 定稿后一并给出；
  根所属表的语句见 [REQ-118 壳「遗留与移交」节](../history/plans/2026-10/2026-10-15-shared-tables-field-freeze.md)。
- **已复裁（2026-10-18，REQ-118 侧）**：`path_results`／`related_targets` 两列**都删**，2026-10-15 的改判收回；本稿 R5 已按该裁决改写（对象扩为两列、请求改「请删列并连响应字段与 `api.md` 同批摘除」，R1~R6 编号不变）。
