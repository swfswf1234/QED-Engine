# （请求：QED-Tracker）教材级「简介／面向对象」两列落 qt_books（book-intro-audience-tracker-request）

状态：Accepted
任务类型：A
最后更新：2026-10-16
关联 ADR：[ADR 0017](../adr/0017-design-doc-structure-contract.md)（事实源唯一）、[ADR 0023](../adr/0023-todo-row-carries-scope-and-criteria.md)（成功标准正本在台账行）、[ADR 0024](../adr/0024-preschema-rebuild-tiers-and-demo-gate.md)（1.0 前 schema 重建档位）、[ADR 0003](../history/adr/v0.1/0003-shared-qed-database-independence.md)（共享 qed 库＝独立性铁律的明确例外）
关联设计：[cross-project-contracts.md](../design/cross-project-contracts.md)（跨项目口径）、[api-contracts.md](../architecture/api-contracts.md) §⑥ 学习域（`POST /learn/courses/sync` 的 `books` 元数据段）、[REQ-117 壳](../history/plans/2026-10/2026-10-15-learn-course-study-redesign.md)（需求方轮，W8 书架清单 v2 的 C10 裁决）、QED-Tracker `docs/design/database-schema.md`（`qt_books` 结构唯一事实源，**只读**）
关联 Tracker：docs/trackers/todo.md（REQ-121 登记，学习设计轮）
归档判定：Retain（跨项目请求原文、现网取证与回执口径属不可替代过程证据）

## 对接信息（跨项目协作规范·计划文档模板）

| 项 | 值 |
| --- | --- |
| 需求方 | QED-Engine 根仓库（REQ-117 W8 书架清单 v2） |
| 目标项目 | QED-Tracker（8901） |
| 接口面 | MySQL 共享库 `qt_books` 两列（书级「简介」「面向对象」）＋ `GET /books` 响应透传；无端口／协议／`.env` 变量变化 |
| 评审方 | 用户 |
| 执行方 | QED-Tracker 会话（其 `db/models.py` + `ensure_schema` 自愈 + 其 docs 与门禁） |
| 验收标准 | 逐条对照 todo.md `REQ-121` 行「成功标准」列（S1~S5） |

## 目标与成功标准

**目标**：把教材卡要向学习者展示的两句信息——这本书**讲什么**（简介）与**面向谁**（入门／进阶／深入等）——
落到书级事实源 `qt_books`，使书架清单的教材卡不必再从教程套（`qt_knowledge`）借这两项。
目标效果＝根侧 sync 的 `books` 元数据改读 `qt_books.intro`/`audience`（套级派生降为兜底），同套多本教材各说各话。

**成功标准正本在台账行**（ADR 0023）：逐条对照 todo.md `REQ-121` 行「成功标准」列，本壳不复制判据。

## 范围与非目标

- **在范围**：`qt_books` 两列（或其 `meta` 键位替代方案）、8901 书目接口透传、存量回填口径、对方 schema 事实源随步。
- **不在范围**：① 根侧学习面渲染改造（已由 REQ-117 W8 完成，两列缺失时卡上显示「暂无简介」「未标面向对象」，不阻塞）；
  ② Axiom-Flow 面（`af_books` 不加列——根侧经 8901 `TrackerClient.list_books()` 读取，解析侧只供 `active_job_id` 就绪判据）；
  ③ 下载/验收链与 `raw/` 文件动作（本请求纯元数据）。
- **口径约束**：`qt_books` 结构事实源与写权限在对方，根侧只出请求稿与消费口径，不代改代码或表结构（跨项目协作规范）。

## 请求项

| ID | 请求 | 根侧消费口径 |
| --- | --- | --- |
| R1 | `qt_books` 加两列：`intro`（TEXT，学习者视角教材简介，一到三句，非版权页摘要）、`audience`（面向对象，建议与 `qt_knowledge.position` 同值域五档闭集 `beginner`/`intermediate`/`advanced`/`comprehensive`/`elective`）。若按[四张共享表 meta 守则](../history/plans/2026-10/2026-10-15-shared-tables-field-freeze.md)主张「试验字段先入 meta」，回执可改判为 `qt_books.meta` 的 `intro`/`audience` 键位并给出键名 | 根侧 sync 优先读书级两列，缺失回落所依套 `qt_knowledge.intro`/`position`（现口径），再缺显示「暂无简介」「未标面向对象」 |
| R2 | 8901 `GET /books`（含 `GET /books/{id}`）响应透传两列（或 meta 键），字段名 `intro`/`audience` 与 R1 一致 | 根侧 `TrackerClient.list_books()` 取行后原样进 sync 的 `books` 段，不做二次加工 |
| R3 | 存量 17 行回填口径：初值按 `af_books.knowledge_id` → `qt_knowledge` 套级 `intro`/`position` 派生（真机 17/17 关联一致），或声明逐本人工登记；回执写明来源 | 回填前后根侧显示均不报错（回落链已就位），回填落地只改读取优先级一处 |
| R4 | 对方 `docs/design/database-schema.md` 随步更新两列语义与值域；若本请求稿需要在对方 `docs/plans/` 落承接壳，**同步其 `test_documentation` 全量 md 白名单**（对方门禁按等值白名单校验新增文档，未同步即红） | 根侧不双写对方台账；落地后同步 `api-contracts.md` §⑥ sync 行 `books` 段口径与 `database-design.md` 指针 |
| R5 | 回执逐条给出「落地／推后／拒绝」＋排期，落地项附对方门禁输出 | 根侧据回执决定 W5 剩余批次里「改读书级两列」这条的起停 |

## 前置条件

1. REQ-117 W8 书架清单 v2 已在根侧实施（教材卡已具备简介／面向对象位与回落链），本请求只补事实源，不解锁根侧功能。
2. 用户 2026-10-16 C10 裁决：「教材表中有相应字段和描述；如果没有则去对应项目下登记，一个是简介，一个是面向对象」——本稿即该裁决的登记动作。
3. 取证（现网 `qed_test`）：`qt_books` 无 `intro`／`audience`／面向对象类列；`qt_knowledge` 带 `intro`（165~331 字）与 `position` 五档，`af_books.knowledge_id` 关联 17/17 一致且每本只命中一套。

## 工作项

| ID | 工作项 | 状态 |
| --- | --- | --- |
| W1 | 根侧登记：本壳 + todo `REQ-121` 行落位，`REQ-117` 壳 C10 条补「已出请求稿」指针 | 已完成（2026-10-16） |
| W2 | 请求稿移交对方（由用户转达／对方会话自读，按跨项目协作规范执行），对方 todo 承接行与回执口径确立 | 待用户转达 |
| W3 | 对方回执 R1/R2 落地后，根侧 sync 改读 `qt_books.intro`/`audience`（套级降兜底）＋ `api-contracts.md` §⑥ 与 `cross-project-contracts.md` 随步 + 定向测试补一条「书级列优先、缺失回落套级」 | 未开始（前置＝R1/R2 回执落地。**归属改注 2026-10-18**：原措辞「属 REQ-117 W5 批次」因 REQ-117 已于 2026-10-18 Achieved 关闭而失效，本改动改由**本行 W3 自身承载**（sync 改读 `qt_books.intro`/`audience` ＋ `api-contracts.md` §⑥ 随步 ＋ 定向用例「书级优先、缺失回落套级」同批做完）；台账行 S5 的成功标准正文按 ADR 0022 冻结不改写，其「由 REQ-117 W5 批次改读」读作「由 REQ-121 落地批改读」） |

## 过程与证据

- **2026-10-16 立项**：REQ-117 W8 书架清单 v2 实施时发现书级两列不存在（`qt_books`/`af_books` 均无简介与面向对象列），
  现以 `af_books.knowledge_id` → `qt_knowledge.intro`/`position` 套级派生交付教材卡；同套多本教材会共用同一句简介，
  属已知口径妥协。用户 C10 裁决「没有就去对应项目下登记」→ 本稿出稿，根侧渲染不等该请求（回落链已实现并有真机证据）。

## 验证与验收

- 设计与门禁矩阵见[开发指南](../guides/development.md)；对方落地事实源在对方台账与 `database-schema.md`，根侧不双写。
- 根侧本轮验收＝本稿四节（对接信息六项齐备、R1~R5 可逐条回执）+ `tests/contract` 全绿（台账 6 列契约与计划治理）。

## 回滚

- 文档面：删本壳与 todo `REQ-121` 行即回登记前状态；根侧代码零依赖本请求（回落链保留，不随请求落地而删除）。

## 关闭与归档

S1~S5 全达成并经用户确认后：todo `REQ-121` 行原子移出 → `completed.md`（关闭结果＋逐条证据）；
本壳按 Retain 归档 `history/plans/2026-10/`，`REQ-117` 壳 C10 条把「待出稿」措辞改为指回本壳归档路径。

## 遗留与移交

- 移交对象＝QED-Tracker 会话，移交物＝本稿 R1~R5；转达由用户执行（根仓库 agent 不在对方工作区产生代码改动与 git 操作）。
- 对方承接第一步须同步其 `test_documentation` 全量 md 白名单，否则新增文档即红。
