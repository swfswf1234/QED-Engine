# 四张共享表字段定档与 meta 扩展槽轮（领域·课程·知识点·LLM 记录）（shared-tables-field-freeze）

状态：Completed
关闭结果：Achieved（S1~S5 逐条达成并留证；两枚死列改判经用户 2026-10-18 复裁收回、维持原裁决 ③＝两列都删，执行归 QED-Tracker（其请求口径随 REQ-119 R5 扩容）；S5「生产库 DDL 零执行」与 2026-10-17 用户授权在本窗口执行完毕的事实按**改判**记录；收口门禁＝契约 89 passed＋全量 819 passed＋ruff All checks passed（同批 REQ-116 轮记的 814 之后，并行窗口新增 5 枚用例随批入数））
任务类型：B
最后更新：2026-10-18
关联 ADR：[ADR 0024](../../../adr/0024-preschema-rebuild-tiers-and-demo-gate.md)（1.0 前 schema 重建档位 + demo 门 + 范围锁死）、[ADR 0017](../../../adr/0017-design-doc-structure-contract.md)（事实源唯一：根 database-design.md 零 DDL）、[ADR 0011](../../../history/adr/v0.1/0011-pending-design-location.md)（待评审设计先入 plans/，定稿后晋升）、[ADR 0023](../../../adr/0023-todo-row-carries-scope-and-criteria.md)（成功标准正本在台账行）
关联设计：[database-design.md](../../../architecture/database-design.md)（四表消费语义·读写矩阵·重建档位）、[api-contracts.md](../../../architecture/api-contracts.md)（⑥ 学习域端点响应形状）、[llm-gateway.md](../../../design/llm-gateway.md)（qed_llm_calls 归属与写方）、[cross-project-contracts.md](../../../design/cross-project-contracts.md)（共享表写权限白名单与请求登记面）、QED-Tracker [database-design.md](../../../../QED-Tracker/docs/architecture/database-design.md)（qed_domain/qed_course 结构事实源，**只读**）
关联 Tracker：docs/trackers/todo.md（REQ-118 登记，普通任务轮 ARCH-035 节）
归档判定：Retain（四表逐列定档结论、跨项目请求稿与两处证据改判属不可替代过程证据）

## 目标与成功标准

**目标**：把四张共享表（`qed_domain`／`qed_course`／`qed_knowledge_point`／`qed_llm_calls`）的字段
逐列审理一次并**定档**（写清每列语义、可空性与索引，之后不再随意动形状），并给四表统一加一枚
`meta JSON` **扩展槽**——后续要新增或试验的字段先落进本列（只读不筛），确认定档后再升为实体列，
从而把「加字段＝改表结构」的节奏从开发链路上摘掉。

**成功标准正本在台账行**（ADR 0023）：逐条对照 todo.md `REQ-118` 行「成功标准」列，本壳不复制判据。

## 范围与非目标

**范围**：① 四表逐列审理与定档（本壳「审理与定档」节即审理稿）；② `meta` 扩展槽的形状与使用守则成文；
③ **根所属两表落地**（`qed_knowledge_point` 在 `qed_test` 可重建、`qed_llm_calls` 只 ALTER 加列加索引不重建）；
④ `qed_domain`/`qed_course` 出**跨项目请求稿**（结构事实源与写权限在 QED-Tracker）；
⑤ [database-design.md](../../../architecture/database-design.md) 定档同步（零 DDL 铁律不破，只写消费语义）。

**非目标**：
- **不拆知识点两张表**、不改「章节＝课程级唯一树」形态（用户裁决见「过程与证据」节 ①）。
- **不动生产 `qed` 库 DDL**：属 D 类（发布/数据操作）转人工，本壳只出命令清单与影响面（**2026-10-17 改判**：用户授权在本窗口执行，红线已解除，执行与复核证据见「过程与证据」末两条与「遗留与移交」执行留痕条）。
- **不改对方代码**：QED-Tracker / Axiom-Flow 工作区只读 + 写文档；`models.py` 与 `ensure_schema` 重建归对方会话。
- **不碰 `qt_*` / `af_*` 私有表**，不碰 `qed_learn_*` 其余根自建表（练习域三表已按 J1 口径有 meta，本轮只作先例引用）。
- **不新增实体列承载试验字段**：一切未定档字段一律先进 `meta`（这正是本轮要立的规矩）。

## 审理与定档

四表共同新增列（用户裁决 ②，形状一次定死、四表同口径）：

```
meta JSON COMMENT '扩展槽：未定档字段先入本列（只读不筛）；定档后升实体列并清对应键'
```

**使用守则（三条红线，随定档写进 database-design.md）**：① `meta` 不进 `WHERE`、不建函数索引——
一旦需要过滤或参与唯一键，就是该字段**定档**之时；② 不放密钥、不放个人信息；③ 不放跨项目契约字段
（共享表的读方需要先约定形状，那属于定档而非试验）。正例先例＝`qed_learn_practice_source.meta`
（[practice.py:84](../../../../backend/qed_engine/services/learn/practice.py#L84)，J1 口径「只读不筛的字段一律进本列」）。

### 表1 `qed_domain`（领域 · 事实源与写权限在 QED-Tracker，根侧 `shared_tables.py` 降级直写）

| 列 | 定档 | 说明 |
| --- | --- | --- |
| domain_id | 保留，**宽度改 VARCHAR(64)** | 现 VARCHAR(32)（[models.py:74](../../../../QED-Tracker/src/qed_tracker/db/models.py#L74)）与 `qed_knowledge_point.domain_id VARCHAR(64)` 逻辑引用宽度不一致 |
| name / description / level / scope / exploration_stage / classic_tracks / stages / explore_pending / created_by / updated_by / created_at / updated_at | 保留 | `level`（注释「探索范围」）与 `scope`（注释「学科知识」）**列名与注释交叉**，只改注释口径不改列名（改名破坏对方 API 面） |
| path_results | **删除（2026-10-18 用户复裁＝维持原裁决 ③）** | 原判「死列」**被证据推翻**：对方写它（[knowledge_repository.py:295](../../../../QED-Tracker/src/qed_tracker/db/knowledge_repository.py#L295) 探索产物落库）、对方 API 透出（[main.py:793](../../../../QED-Tracker/src/qed_tracker/api/main.py#L793)）、根侧 SELECT 并透传（[shared_tables.py:84,95](../../../../backend/qed_engine/services/shared_tables.py#L84)）。**死的是根前端那枚声明**（[stores/index.ts:382](../../../../web-ui/src/stores/index.ts#L382) `path_results?: unknown`）。**2026-10-18 复裁处置**：改判结论收回、原裁决 ③ 恢复生效＝本列删除，须连同 8901 响应字段与其 `api.md` 同批摘除，执行与门禁归 QED-Tracker（REQ-119 R5 已按此扩容）；上列「活列」所述为删除前的库内现状 |
| meta | **新增** | 见上 |

### 表2 `qed_course`（课程 · 同上归属）

| 列 | 定档 | 说明 |
| --- | --- | --- |
| course_id / domain_id / sort_order / name / aliases / track / stage / prerequisites / description / exploration_stage / explore_pending / created_by / updated_by / created_at / updated_at | 保留 | `domain_id` 宽度随表1 统一 VARCHAR(64)；`stage` 取值以 `qed_domain.stages` 四档为准（应用层约束） |
| related_targets | **删除（2026-10-18 用户复裁＝维持原裁决 ③）** | 原判「死列」**被证据推翻**：有读方（[courses.py:59](../../../../QED-Tracker/src/qed_tracker/courses.py#L59)、[main.py:803](../../../../QED-Tracker/src/qed_tracker/api/main.py#L803)）与 API 透出，**但全仓无生产者写入非空值**（唯一写点＝建课时 `related_targets=[]`，[knowledge_repository.py:261](../../../../QED-Tracker/src/qed_tracker/db/knowledge_repository.py#L261)）。删除＝对方契约变更（其 api.md §课程响应有此字段），本壳只登记空转事实与「删列须连响应字段一起删」的判据。**2026-10-18 复裁处置**＝本列删除（与 `path_results` 同批），去留不再由对方单方裁量，但 `models.py`＋`ensure_schema`＋响应字段＋其文档的执行仍归 QED-Tracker（REQ-119 R5） |
| meta | **新增** | 见上 |

### 表3 `qed_knowledge_point`（知识点主数据 · 结构由根定义，四表里唯一「根所属」的共享表）

单表两维（用户裁决 ①）：`node_kind`＝`outline`（章节/大知识点，课程级唯一树）与 `point`（细知识点）同行不同形；
候选叙述仍留根私有池 `qed_learn_kp_detail`（两段式不变）。

| 项 | 定档 | 证据与理由 |
| --- | --- | --- |
| **D1 坐标列恒空（真缺陷）** | 修 | 整树写入把 `domain_id`/`domain_label`/`course_label` 硬编码成 `''`（[knowledge.py:529](../../../../backend/qed_engine/services/learn/knowledge.py#L529)），而提升写入的 point 行从 detail 带全坐标（[:348-357](../../../../backend/qed_engine/services/learn/knowledge.py#L348)）→ 同表两套口径、`idx_kp_domain` 对 outline 行恒空失效、跨领域检索不可信。修向＝写入前由课程行补全（`_course_index` 已附 `domain_id`/`domain_label`，[learn.py:495-509](../../../../backend/qed_engine/api/learn.py#L495)） |
| **D2 `confirmed` 恒真列** | **删（主表）** | 主表口径＝「一行＝一个人工确认的行」，两个写点一律置 1（[:366](../../../../backend/qed_engine/services/learn/knowledge.py#L366)、[:549](../../../../backend/qed_engine/services/learn/knowledge.py#L549)），全仓**无任何 `WHERE confirmed` 消费**（星图计数按 `node_kind` 数行，[:450-469](../../../../backend/qed_engine/services/learn/knowledge.py#L450)），PATCH 白名单也不开放该位（[learn.py:405](../../../../backend/qed_engine/api/learn.py#L405)）。常量列＝形状噪声。`qed_learn_kp_detail.confirmed` **保留**（真语义＝置位才提升） |
| **D3 `book_ref` 空串哨兵** | **清哨兵** | point 行用 `''` 表「一课一名」，其成立前提是同表唯一键 `(course_id, book_ref, norm_key)`；DEFECT-011 已把唯一键降级为普通索引（见 database-design.md 要点），哨兵理由随之消失。定档＝point 行 `book_ref` 改可空（NULL），去重键改 `(course_id, node_kind, norm_key)`，outline 去重仍由应用层「父级 + norm_key」映射承载（[:510-521](../../../../backend/qed_engine/services/learn/knowledge.py#L510)） |
| **D4 缺审计列** | 补 `created_by` / `updated_by` | 另三表均有 VARCHAR(16) NOT NULL DEFAULT ''，本表无 → 同表族口径统一 |
| kp_id / domain_id / domain_label / course_id / course_label / node_kind / parent_kp_id / depth / book_ref / name / norm_key / type / order_hint / summary / source_ref / anchors / from_detail_id / created_at / updated_at | 保留 | 语义与注释按现 DDL 定档（[:40-66](../../../../backend/qed_engine/services/learn/knowledge.py#L40)） |
| 应用层约束（不建 DB CHECK） | 登记 | `type` 仅 point 行、`depth` 仅 outline 行（1=章 2=节）、树最深两级由 `_validate_outline_tree` 守（[learn.py:416](../../../../backend/qed_engine/api/learn.py#L416)）、`parent_kp_id` 只指 outline 且不成环（[:577-600](../../../../backend/qed_engine/api/learn.py#L577)）。DB 层不建 CHECK：存量库加 CHECK 的迁移面大于收益 |
| meta | **新增** | 见上 |

### 表4 `qed_llm_calls`（LLM 调用审计 · 表在共享命名空间、三项目均写）

**永不 DROP 重建**（护三项目审计历史），本轮只走 ALTER 加列加索引——与 ADR 0024「纯日志账目表＝自由
重建档」的例外：**建档位说的是根自建表，本表有外部写方，按不可重得对待**。

| 项 | 定档 | 证据与理由 |
| --- | --- | --- |
| **D5 零二级索引** | 补三条索引 | 现表除主键外**无任何索引**（[call_log.py:22-42](../../../../backend/qed_engine/services/llm/call_log.py#L22)），而检索固定按 `created_at` 倒序分页并按 service/task/step/review_status 过滤（[:268-300](../../../../backend/qed_engine/services/llm/call_log.py#L268)）。定档＝`idx_llm_created(created_at)`、`idx_llm_service_created(service, created_at)`、`idx_llm_task_step(task, step)`；补齐走 `information_schema.STATISTICS` 幂等自检（与 `_REQUIRED_COLUMNS`/`ensure_comments` 同族，新增 `ensure_indexes`），**不重建表** |
| **D6 `provider` 注释过期** | 改注释 | 现注释 `qwen/deepseek/glm/gateway`，实际 local 模式写 runtime 名（[registry.py:386](../../../../backend/qed_engine/services/llm/registry.py#L386)：`provider = "mineru" if slot == "vision" else rt`）→ 补 lmstudio/llamacpp/mineru，`_COLUMN_COMMENTS` 与对方 shared-tables.md 表3 随步 |
| **D7 token/费用不采集** | **进 `meta`，不加实体列** | 全链无用量列（`duration_ms` 只有耗时），思考型模型的 token 成本目前**全丢**。按本轮规矩：先落 `meta.usage = {prompt_tokens, completion_tokens, ...}` 试验，确认要过滤/聚合再定档为实体列 |
| id / service / mode / provider / model / endpoint / prompt_template / prompt / response / duration_ms / status / error / created_at / task / step / review_status / review_note | 保留 | 语义与注释按现 DDL 定档；`created_at` 维持 naive-UTC 口径不动 |
| meta | **新增** | 见上 |

## 前置条件

1. 用户 2026-10-15 四项裁决已登记本壳「过程与证据」节（本轮立项依据）；其中两枚死列曾被证据改判（见下表1/表2），**2026-10-18 用户复裁收回改判、维持原裁决 ③＝两列都删**，执行归 QED-Tracker。
2. 双 `.env` 拓扑：8900 连 `qed_test`、8902 连生产 `qed`——知识点表重建只影响 8900 侧；`qed_llm_calls` 只 ALTER 不加锁重建，两侧安全。
3. 生产 `qed` 库的 DDL（四表 `meta`、表3/表4 的形状变化）＝ D 类转人工，本轮只出清单与影响面，不执行。
4. 表1/表2 的形状变化经请求稿由对方 `models.py` + `ensure_schema` 落地（根侧不代改代码）。

## 工作项

| 条目 | 内容 | 状态 |
| --- | --- | --- |
| W1 | **demo 门**（ADR 0024 决定 2）：`knowledge.py` 最小定档落地（加 `meta`、删主表 `confirmed`、D1 坐标补全）后，在 `qed_test` 重建并端到端跑通一条黄金路径＝真书目录整树写入→候选提升→星图计数→8903 知识点页出讲解，留请求账与库内行核验（`COUNT(*)`＋坐标非空）；到门暂停待人工验收 | 已完成（2026-10-18 demo 门复跑达成。代码侧 219 绿；库内第一步脚本已合并 W1+W3 全部形状并在 `qed_test` 实跑完成，用户 2026-10-16 放行；生产 `qed` 侧同形状随 2026-10-17 阶段二对齐；S4 黄金路径真机取证已留痕；8900 已进新代码并于 2026-10-18 复跑三链确认，取证脚本 `tmp/req118_recheck.py`） |
| W2 | `call_log.py` 落地：加 `meta JSON` + 三条二级索引 + `ensure_indexes` 幂等自检 + provider 注释修正；`meta.usage` 试验位写入与读回有先红后绿用例（**不 DROP 重建**） | 已完成（代码侧＋启动自迁移：8900 重启即补齐 `qed_test`） |
| W3 | 其余定档项落地：D3（point 行 `book_ref` 可空 + 去重键改 `(course_id, node_kind, norm_key)`）、D4（`created_by`/`updated_by`）、根前端清理两枚死声明（[stores/index.ts:328,382](../../../../web-ui/src/stores/index.ts#L328)）与 `api/learn.ts` 类型随步 | 已完成（代码侧与前端三门绿；库内 ALTER 已随 W1 一步在 `qed_test` 落地，并按阶段二对齐生产 `qed`，两库逐列零差） |
| W4 | 跨项目请求稿成文并登记：四表 `meta`、`domain_id` 32→64 与主键不可变、`level`/`scope`/`provider` 注释口径、`related_targets` 空转列的删除判据；落 [cross-project-contracts.md](../../../design/cross-project-contracts.md) 请求清单，对方承接第一步含其文档白名单同步 | 已完成（2026-10-16 请求稿成文 [REQ-119 壳](2026-10-16-shared-tables-tracker-request.md)，台账行 REQ-119 登记，[cross-project-contracts.md](../../../design/cross-project-contracts.md) §4 加在途请求登记；对方文档面移交待放行） |
| W5 | 定档文档同步：[database-design.md](../../../architecture/database-design.md) 四表列清单与读写矩阵、`meta` 守则三条红线、重建档位表按「本表有外部写方」补一行（零 DDL 铁律不破）；[api-contracts.md](../../../architecture/api-contracts.md) ⑥ 响应形状随步 | 已完成（2026-10-16 六处随步 + §⑥ 形状段 + llm-gateway.md 字段表补齐；契约 82 绿、定向 125 绿，证据见「过程与证据」节） |
| W6 | 收口：定向（`test_learn_knowledge.py`／`test_llm_call_log.py`／`test_api.py`）+ 契约 + 全量 pytest（QED_env 解释器）+ ruff + `tsc -b`／vitest 串行 + build；8900 重启后真机复核（星图计数、目录写入、账检索）；生产库 DDL 命令清单转人工写「遗留与移交」 | 已完成（收口 2026-10-18；2026-10-16 门禁首跑全绿＝全量 pytest 757 passed／契约 82 passed／ruff All checks passed，前端三门沿用 W3 结果；生产 `qed` 库 DDL 已随 2026-10-17 阶段二由用户授权执行完毕、转人工条目撤销，执行与复核留痕见「遗留与移交」；8900 重启后真机复核三链（W1 条实测原文）与收口归档已于 2026-10-18 完成） |
| W7 | 三仓共享表描述同步核验（用户指令「重新审核三个项目中关于共享表的描述是否已经全部修正和同步」）：根 [database-design.md](../../../architecture/database-design.md) + 对方`database-shared-tables.md`/`database-private-tables.md`/`architecture/index.md`/`design/index.md` + AF `database-design.md` 逐篇对齐四表定档口径；两家子仓**文档正文**经用户授权由根侧直接代改（不走请求稿）；核验出的偏差分流——命名/结构叙述类改判入 [REQ-120 壳](2026-10-16-root-private-prefix-and-four-part-design.md)，跨项目契约越界入 DEFECT-014 | 已完成（2026-10-16 三仓文档对齐；偏差清单与逐处证据见「过程与证据」节） |

- **2026-10-17 本轮文档收尾（并库取证 + `qed` 结构对齐 + 两笔登记；未动业务代码、未跑 8900 重启复核）**：① 取证结论——8903 两页空数据归因＝**库名分叉**（写入落 `qed`、读出连 `qed_test`），不是界面缺陷；三份 `.env` 实测钉库（根 `.env:30`、`QED-Tracker/.env:19`、`Axiom-Flow/.env:12`）与逐行读数存 `tmp/req123_probe{,2,3}.txt`（probe3＝active 版本口径的权威快照）。② `qed` 库结构对齐与关键数据回灌结果随步进工作项格（W1/W3/W6），生产 DDL 转人工条目撤销。③ 两笔登记：`DEFECT-015`（跨服务配置一致性，普通任务轮壳 W23 承载登记）与 `REQ-123`（`af_books` 书级三列回写与跨库分叉归一，壳 [2026-10-17-af-books-parse-status-request.md](2026-10-17-af-books-parse-status-request.md)，停在 W3 待用户评审放行移交）。④ 撤回的原假设：「8902 不回写 `parse_status`」经复验不成立——`pending`/`parsing` 表进度、`last_parse_result` 表结局是对方 ADR 0007 决定 3 的设计口径，根侧解析界面已按此实现；库内一度读到的越枚举 `completed` 由对方启动期归一自动收敛。⑤ 文档同步：[parsing-flow.md](../../../design/parsing-flow.md) §9 补 `GET /parsing/tree` 降级例外与同形空态（登 [design-bugfix-log.md](../../../plans/design-bugfix-log.md) BUGFIX-032）、[cross-project-contracts.md](../../../design/cross-project-contracts.md) §3 库名现状列改口径（BUGFIX-031）＋§4 在途请求加 REQ-123 行、[project-status.md](../../../trackers/project-status.md) 当前主线加 2026-10-17 条。

## 过程与证据

- **2026-10-15 用户四项裁决登记（本轮立项依据）**：
  ① 知识点面落地形态＝**单表保留 + 清哨兵**（不拆两张表、不改章节课程级唯一树）；
  ② 扩展槽＝**`meta JSON`，四表全加**（用户原话「加一个 message 或 note 的 JSON 字段……后续要加要尝试单独先放这个字段」，命名取 `meta` 与练习域先例一致）；
  ③ 死列处置＝**直接删**（清单：`qed_course.related_targets`、`qed_knowledge_point.confirmed`、`qed_domain.path_results`）；
  ④ 本轮做到哪一步＝**审理稿 + 根侧两表落地**（Tracker 所属两表出跨项目请求稿）。
- **2026-10-15 裁决 ③ 的两处证据改判（待用户复裁，本轮不动这两列的 schema）**：
  - `qed_domain.path_results`：非死列。对方写（探索产物落库，`knowledge_repository.py:294-295`）、对方 API 透出（`api/main.py:793/855`，其 api.md §领域响应列清单含该键）、根侧 SELECT 并透传（`shared_tables.py:84/95/118/130/254`）。真正死的是根前端声明 `stores/index.ts:382`（`unknown` 类型、零渲染）。
  - `qed_course.related_targets`：非死列但**空转**——读方齐备（`courses.py:59`、`api/main.py:803`、`shared_tables.py:176/211/268`），写方只有建课时的 `[]`（`knowledge_repository.py:261`），无任何生产者写过非空值。删除须连带对方响应字段，属其契约变更。
  - 唯一维持原判的是 `qed_knowledge_point.confirmed`：恒真、零 `WHERE` 消费、PATCH 不开放，主表删除成立（候选池同名列保留）。
- **2026-10-15 审理取证锚点**（全部为当轮实读，非推断）：坐标恒空 `knowledge.py:529` vs point 行带坐标 `:348-357`；
  星图计数不读 `confirmed` `:450-469`；`qed_llm_calls` 建表 SQL 除 PK 零索引 `call_log.py:22-42`；
  provider 实际取值含 runtime 名 `registry.py:386`；`meta` 扩展槽先例 `practice.py:84`；
  根前端死声明 `stores/index.ts:328,382`；知识点主表 DDL `knowledge.py:40-66`。


- **2026-10-16 W1 代码侧落地（TDD 先红后绿）**：四枚定档用例先红（`test_put_outline_fills_domain_and_course_coords`
  ／`test_promoted_point_and_outline_share_coords`／`test_main_table_shape_drops_confirmed_keeps_detail_flag`／
  `test_point_rows_carry_meta_extension_slot`），并把两枚既有断言改口径（`point["confirmed"] is True` →
  `"confirmed" not in point`；outline 行同理）。随后改 `knowledge.py`（DDL 删主表 `confirmed`、加 `meta JSON`、
  `_POINT_COLUMNS` 随步、`_row_to_dict` 解码 meta、`replace_outline` 收 `domain_id/domain_label/course_label`
  关键字参数并在复用分支刷新坐标、提升写入去 `confirmed`）、`knowledge_memory.py`（同形）、`api/learn.py`
  （`put_outline` 用 `_require_catalog_course` 返回目录行传坐标、`_point_out` 去确认位）。
  定向 `test_learn_knowledge.py`＋`test_learn.py`＋`test_learn_practice.py`＋`test_api.py`＋`test_web.py` **219 passed**。
- **2026-10-16 库内取证：D1 在真实数据上成立**（`qed_test`，只读探查，非推断）：`qed_knowledge_point` 现有
  97 行＝`outline` 95 行 + `point` 1 行 + （detail 池 3 行另表）；`SUM(domain_id<>'')` 对 outline 行＝**0**
  （`course_label` 同样全空），而唯一的 point 行 `domain_id='math-advanced'` 有值——同表两套口径坐实；
  `SHOW INDEX` 为 PRIMARY＋`idx_kp_course_book_norm`／`idx_kp_course_kind`／`idx_kp_domain`／`idx_kp_parent`
  （`idx_kp_domain` 因恒空而对多数行无效）。列清单实读仍含 `confirmed`、**无 `meta`**（本轮 DDL 尚未执行）。
- **2026-10-16 库内并发观察（未归因，登记为风险）**：同库同一表在两次只读探查之间由 191 行（outline 190 + point 1）
  变为 97 行（outline 95 + point 1），即**有一棵 95 行的 outline 子树被删除或重写**；剩余行 `MAX(updated_at)`
  停在 `2026-10-15 07:42:35`，连续 3 个采样点（间隔 3s）行数稳定、`information_schema.PROCESSLIST` 全为 Sleep。
  四端口 8900/8901/8902/8903 均在听，且运行中的 8900 **仍是改码前进程**（不热重载），其 `INSERT` 显式写 `confirmed` 列。
- **2026-10-16 落地方式改判（用户裁决）**：由壳原写「DROP + CREATE 重建」改为**就地 ALTER + 坐标回填**——
  理由：`qed_test` 这 95 行是 M6/REQ-117 真机跑出的 b05 目录树，重建即空窗；且生产 `qed` 库最终只能走 ALTER，
  在测试库先验同一份迁移脚本更省一遍风险。ALTER 与回填 SQL 原文见「遗留与移交」节。
- **2026-10-16 库内迁移暂停待人工放行**：零破坏时序已定（① `ADD COLUMN meta` → ② 8900 重启进新代码 →
  ③ `DROP COLUMN confirmed` → ④ 坐标回填 → ⑤ 黄金路径留证）。② 是共享服务重启、③ 早于②会让并行窗口的写入
  撞 `1054 Unknown column`，两步均须用户明确放行后才执行。


- **2026-10-16 W2 代码侧落地（TDD 先红后绿）**：七枚用例先红（`test_create_table_sql_has_meta_slot_and_indexes`／
  `test_provider_comment_covers_local_runtime_names`／`test_record_call_writes_meta_as_json`／
  `test_record_call_meta_defaults_to_null`／`test_search_calls_decodes_meta`／
  `test_ensure_indexes_adds_only_missing`／`test_ensure_indexes_idempotent`）。随后改 `call_log.py`：
  `CREATE_TABLE_SQL` 加 `meta JSON` 与三枚 `KEY idx_llm_created`／`idx_llm_service_created`／`idx_llm_task_step`、
  `_COLUMN_COMMENTS` 的 provider 改口径（api 渠道为厂商名、local 模式为 runtime 名）并登记 `meta`、
  `_REQUIRED_COLUMNS` 补 `meta`（1054 自愈通道）、`INSERT_SQL`/`record_call(meta=…)` 走 `_to_json`、
  `search_calls` 经 `_with_decoded_meta` 解码、新增幂等 `ensure_indexes`（information_schema 对比，只补缺失）。
  `api/main.py` 启动补齐串上 `ensure_columns` + `ensure_indexes`（同一 try 块，数据库不可达仍降级不阻塞启动）。
  **表4 绝不 DROP 重建**：全部改动是加法（加列/加索引/改注释）。
- **2026-10-16 W2 实现坑登记**：`CREATE_TABLE_SQL` 为引用注释常量改成 f-string 后，`prompt_template` 注释里的
  `{task}/{step}@v{n}` 被当占位符求值（`NameError: name 'task' is not defined`），须转义为双花括号。
  定档说明留此一句，免得后人以为注释里的花括号是模板语法。
- **2026-10-16 W2 门禁**：`tests/test_llm_call_log.py` **21 passed**；定向
  `test_llm_call_log + test_llm_gateway + test_llm_endpoints + test_llm_local_adapt + test_api` **208 passed**；
  `ruff check backend tests` All checks passed。
- **2026-10-16 W2 范围裁决（不扩范围）**：本轮**不接 gateway 的 token usage 采集**——
  `backend/qed_engine/services/llm/` 全层零 `usage` 字段（grep 核实），补采集属新功能、超出四表定档范围；
  `meta.usage` 只作为扩展槽试验位存在，写入方与是否定档待后续裁决。
- **2026-10-16 W3 代码侧落地（TDD 先红后绿）**：四枚用例先红
  （`test_main_table_ddl_drops_book_ref_sentinel_and_adds_audit_columns`／
  `test_promoted_point_row_carries_null_book_ref_not_empty_sentinel`／`test_point_dedup_key_ignores_book_ref`／
  `test_outline_and_point_rows_carry_audit_columns`），并把既有断言 `point["book_ref"] == ""` 改口径为 `is None`。
  随后改 [knowledge.py](../../../../backend/qed_engine/services/learn/knowledge.py)：主表 `book_ref` 去
  `NOT NULL DEFAULT ''`（point 行＝NULL，空串哨兵随 DEFECT-011 唯一键降级撤销）、去重索引
  `idx_kp_course_book_norm` → `idx_kp_course_kind_norm (course_id, node_kind, norm_key)`、`meta` 之后补
  `created_by`/`updated_by VARCHAR(16) NOT NULL DEFAULT ''`（新常量 `WRITER = "qed_engine"`，与
  `qed_domain`/`qed_course` 同口径＝写入方服务标识，非人名）；`confirm_detail` 去重查询去掉 `book_ref=''`，
  提升 INSERT、`replace_outline` 新行与复用分支、`patch_point` 同步审计位；
  [knowledge_memory.py](../../../../backend/qed_engine/services/learn/knowledge_memory.py) 同形。
  定向 `test_learn_knowledge`＋`test_learn`＋`test_learn_practice` **104 passed**；`ruff check backend tests`
  All checks passed；`tests/contract/` **82 passed**。
- **2026-10-16 W3 根前端随步（三门绿）**：删两枚死声明 [stores/index.ts:328,382](../../../../web-ui/src/stores/index.ts#L328)
  的 `related_targets?`／`path_results?`（改判见上：服务端仍透出，死的是根前端零读取的声明）；
  [api/learn.ts](../../../../web-ui/src/api/learn.ts) 随形状两处——`KnowledgePoint.confirmed` 随主表删列移除、
  `OutlineRow.book_ref` 由 `string` 改 `string | null`（point 行 NULL；`KpDetailRow.book_ref` 保持 `string`，
  候选池仍用空串表「未选书」）；四处 fixture 去 `confirmed: true` 并把 point 行 `book_ref: ''` 改 `null`
  （`pages/CourseKnowledge.test.tsx`、`stores/courseKnowledge.test.ts`、`pages/LearnWorkbench.test.tsx`、
  `stores/learnWorkbench.test.ts`）与 `stores/downloads.test.ts` 的 `related_targets: []`。
  门禁：`tsc -b` 无输出；`vitest run --no-file-parallelism` **764 passed（63 files，串行）**；`npm run build` 成功。
- **2026-10-16 W1＋W3 库内迁移合并为一步**（`tmp/req118_migrate_step1.py`，`qed_test` 专属断言护栏）：
  整表 JSON 备份 → `ADD COLUMN meta` → `ADD created_by/updated_by` → `MODIFY book_ref NULL` ＋
  `UPDATE` 把 point 行置 NULL → `DROP INDEX idx_kp_course_book_norm`／`ADD INDEX idx_kp_course_kind_norm` →
  D1 坐标回填 → 形状与分组计数核验。这些全是加法或放宽，**旧进程照样能写**（`confirmed` 此步保留），
  故与重启时序无耦合；仍受时序约束的只剩 `DROP COLUMN confirmed`（旧代码 INSERT 显式带该列，先删即 1054）。
- **2026-10-16 残余窗口风险登记**：本步执行后、8900 重启进新代码前，旧进程仍按
  `WHERE course_id=%s AND book_ref='' AND norm_key=%s` 去重（`git show HEAD` 核实原码），而 point 行
  `book_ref` 已被置 NULL → 该谓词恒不命中，且新索引非唯一，**期间做候选提升可能立重名行**。
  处置＝窗口内不执行候选提升，重启进新代码后再验 409 与合并路径。
- **2026-10-16 W4 请求稿成文并登记**：R1~R6（两表 `meta`、`domain_id` 32→64、主键不可变入文档、
  `level`/`scope` 注释口径、`related_targets` 空转列交对方裁决、对方文档 `qed_llm_calls` 快照随步或改指针）
  逐条带对方源码/文档行号取证，落 [2026-10-16-shared-tables-tracker-request.md](2026-10-16-shared-tables-tracker-request.md)，
  并以台账行 `REQ-119`（支线，普通任务轮 ARCH-035 节）镜像该壳；
  [cross-project-contracts.md](../../../design/cross-project-contracts.md) §4 增「在途跨项目请求登记」一行。
  裁决 ③ 的两处改判在稿内落到形态＝`path_results` **撤回删列请求**、`related_targets` **改请对方裁决去留**。
- **2026-10-16 W5 定档文档同步（零 DDL 铁律不破）**：
  [database-design.md](../../../architecture/database-design.md) 六处随步——①「库与命名空间」新增四表定档声明
  并指向本轮壳与 REQ-119 请求稿；②表清单总览 `qed_domain`/`qed_course`/`qed_llm_calls`/`qed_knowledge_point`
  四行的状态列改写定档结论（含 `path_results` 改判、`related_targets` 空转、`confirmed` 删列、索引交换）；
  ③新增「meta 扩展槽守则」节（三条红线：只读不筛／不放密钥与个人信息／不放跨项目契约字段）＋读写矩阵下
  补「`meta` 的写方口径」一条（8900 降级直写白名单不含本列）；④`qed_domain`/`qed_course` 两节各加定档结论
  段（`domain_id` 32→64、`level`/`scope` 只改注释不改列名）；⑤`qed_knowledge_point` 消费要点重写——
  `book_ref` point 行 NULL、去重索引 `idx_kp_course_kind_norm (course_id, node_kind, norm_key)`、
  **本表无人工确认列**（确认位只在候选池）、`created_by`/`updated_by`＝写入方服务标识、M6「可删除重建」
  补注本轮改判为就地 ALTER + 坐标回填；⑥`qed_llm_calls` 节登记三枚二级索引 + provider 注释口径 +
  **有外部写方绝不 DROP 重建**，并在「1.0 前 schema 重建档位」表新增**有外部写方例外档**一行。
  [api-contracts.md](../../../architecture/api-contracts.md) §⑥ 增「知识点主表行序列化形状（REQ-118 定档）」段
  （22 列清单、无 `confirmed` 键、point 行 `book_ref=null`、`meta` 只读不筛）并随步两处端点表述
  （confirm 的确认位归属、PUT outline「写入即 `confirmed=1`」→「写入即视为已确认」）；
  [llm-gateway.md](../../../design/llm-gateway.md) 字段表补 `meta` 行 + 三枚索引 + 永不重建例外，顺带纠正存量
  错述「表结构以根仓库 Alembic 迁移落地」（根不引入 Alembic，实为 `call_log.py` 幂等建表 + 追加式补齐）。
  代码侧一处随步注释：`api/learn.py` `PointPatchBody` docstring 去掉已删列 `confirmed` 的表述。
  门禁：`tests/contract/` **82 passed**（含台账与计划治理、零建表语句自证守护）；
  `test_learn.py`＋`test_learn_knowledge.py`＋`test_learn_practice.py`＋`test_llm_call_log.py` **125 passed**。
  踩坑留痕：`database-design.md`「关联代码」一度认领 `call_log.py` 与 `shared_tables.py`，被
  `test_code_document_mapping` 判红（二者 DesignRef 分别是 llm-gateway.md／downloads-flow.md，
  一个代码路径只能认一份设计文档），已改为只认领 `learn/knowledge.py`＋`learn/base.py`。
- **2026-10-16 W5 库内形状实测（`information_schema` 只读探查，连接目标＝8900 配置的 `qed_test`）**：
  `qed_llm_calls` **已带 `meta` 列与三枚二级索引**（`idx_llm_created`／`idx_llm_service_created`／
  `idx_llm_task_step`）＝W2 的启动自迁移确已在库内生效，故文档登记为「已就地落地」；
  `qed_knowledge_point` **仍是旧形状**（`confirmed` 在列、无 `meta`/`created_by`/`updated_by`、
  索引仍 `idx_kp_course_book_norm(course_id,book_ref,norm_key)`）＝W1 第一步脚本尚未跑，
  文档相应改为「迁移脚本已就绪、库内落地待放行」。现存量＝outline 95 行 + point 1 行（回填与
  核验的基线数）。
- **2026-10-16 W1 迁移脚本收口为可安全手跑形态并 `--dry-run` 预演通过**（`tmp/req118_migrate_step1.py`）：
  连接参数改取 `.env` 的 `QED_DB_*`（原硬编码 127.0.0.1/root 与 8900 拓扑脱钩）；四列注释不再复制字面量，
  改为**从代码 DDL 正则抽取**（`knowledge.py` 的 `qed_knowledge_point` 块），代码与库内形状不可能漂移；
  新增 `--dry-run` 纯只读预演（不备份、不 ALTER、只打印计划与现状）。预演输出：现有 96 行，
  outline 95 行 `domain_id` 全空（D1 硬编码实证）、point 1 行 `book_ref=''`；待执行动作＝ADD meta →
  ADD created_by/updated_by → MODIFY book_ref NULL + point 行置 NULL → DROP/ADD 去重索引 → outline 坐标回填。
- **2026-10-16 W6 门禁首跑（文档轮后全量）**：`pytest -q` **757 passed**；`tests/contract/` **82 passed**；
  `ruff check backend tests` All checks passed；前端三门沿用 W3 结果（本轮无前端改动，`tsc -b` 静默 /
  vitest 串行 764 passed / build 成功）。真机复核与 `DROP COLUMN confirmed` 仍等 W1 库内一步放行。
- **2026-10-16 W1 库内第一步实跑完成（用户放行，目标库 `qed_test`）**：`tmp/req118_migrate_step1.py` 首跑在第 5 步
  （坐标回填）抛 `OperationalError(1267, "Illegal mix of collations (utf8mb4_0900_ai_ci,IMPLICIT) and
  utf8mb4_unicode_ci,IMPLICIT)")`——前四步（`meta`、`created_by`/`updated_by`、`book_ref` 可空 + point 行置 NULL、
  索引换 `idx_kp_course_kind_norm`）已生效；修向＝回填 JOIN 谓词加显式 `COLLATE utf8mb4_0900_ai_ci`，脚本幂等复跑
  只补剩余两步。**根因是一处真实结构漂移（非本轮引入）**：库默认与 Tracker/AF 所属表为 `utf8mb4_0900_ai_ci`
  （`qed_course`/`qed_domain`/`qed_llm_calls`/`qt_*` 全部），根侧表族 DDL 显式声明 `utf8mb4_unicode_ci`
  （[learn/base.py:39](../../../../backend/qed_engine/services/learn/base.py#L39)、
  [knowledge.py:69](../../../../backend/qed_engine/services/learn/knowledge.py#L69)、practice.py 三处、`call_log.py:47`）
  → 任何跨命名空间 JOIN 一律 1267。现网代码无此类 JOIN（唯一 JOIN 是根内 `qed_learn_question`↔`qed_learn_*`，
  见 [practice.py:932](../../../../backend/qed_engine/services/learn/practice.py#L932)），故属**潜在**缺陷；附带发现＝
  库内 `qed_llm_calls` 实为 `utf8mb4_0900_ai_ci`，与根 `call_log.py` 声明的 unicode_ci 不一致（表由早期建过、
  根 DDL 只在缺表时生效）＝根 DDL 与库内形状的一处漂移。是否随 REQ-120 改名批次把根侧表族排序规则统一为库默认，
  交用户裁决（本轮不擅自动 8 张表的 collation）。
- **2026-10-16 W1 形状核验**：`qed_knowledge_point` 列集＝代码 DDL 22 列（`confirmed` 已 `DROP COLUMN`、
  `meta`/`created_by`/`updated_by` 齐备且物理列序对齐代码 DDL）；索引集＝PRIMARY + `idx_kp_course_kind_norm` +
  `idx_kp_course_kind`/`idx_kp_domain`/`idx_kp_parent`（旧 `idx_kp_course_book_norm` 已删）；行数不变 96
  （outline 95 + point 1），outline 的 `domain_id=''` 由 **95 → 0**（D1 坐标回填达成）。整表备份两份留在
  `tmp/req118_bak/qed_knowledge_point.before-20261016T034557Z.json` 与 `...T034740Z.json`（各 96 行全量）。
- **2026-10-16 W1 换代时序证据**：用户重启 8900 后首探 `/api/v1/learn/knowledge-points` **500**（新代码 SELECT
  `meta` 而库内尚未加列，反证进程已换代），加列后转 **200** 且响应**无 `confirmed` 键**、含
  `meta`/`created_by`/`updated_by` → 才执行 `ALTER TABLE qed_knowledge_point DROP COLUMN confirmed`（唯一受时序
  约束的一条）。
- **2026-10-16 S4 黄金路径真机取证**（8900 在线链，`qed_test`）：登记候选 → `POST /learn/kp-details/{id}/confirm`
  提升成功，新 point 行 `created_by`=`updated_by`=`qed_engine`、`book_ref`=**NULL**、`meta`=NULL；同 `norm_key`
  的第二枚候选 confirm 返回 **409**（新去重键 `(course_id, node_kind, norm_key)` 在 `book_ref` 已为 NULL 的真库上
  生效，正面回答「残余窗口风险」那条）；`GET /learn/star-map` 该课程 `kp_confirmed` 由 1 → **2**，
  `GET /learn/knowledge-points?course=math_analysis` 的 `total` 同步为 2。三枚冒烟行
  （`kpd-41f27303e7b4`／`kp-9f624378f969`／`kpd-415d28d1fe99`）的清理属数据删除动作（分类器要求逐次人工确认），
  原文命令见「遗留与移交」节。
- **2026-10-16 附带发现（登记，不扩本轮范围）**：`GET /api/v1/llm/calls` 的响应模型 `CallLogItem`
  （[api/control.py:537](../../../../backend/qed_engine/api/control.py#L537)）未列出 `meta` 键——`search_calls` 已解码，
  但端点白名单不透出，故 `qed_llm_calls` 扩展槽目前**库内可读、8900 API 不可读**。S3 判据只要求库内加列与索引，
  属满足；是否补端点透出待用户裁决。
- **2026-10-16 W7 三仓核验结论（逐篇实读，非推断）**：定档口径**已同步**的部分＝四表列清单/`meta` 守则/
  索引集合/`confirmed` 删列/`book_ref` NULL 口径，在 Tracker `database-shared-tables.md`（表1/表2 DDL 快照
  仍为 `VARCHAR(32)` 与无 `meta`，按「文档不得领先库内事实」保留现状 + 新增「REQ-118 四表定档同步」表逐行标
  待承接）与 AF `database-design.md`（只读边界）均已对齐；`qed_llm_calls` 快照来源改为根 `call_log.py` 并补齐
  `meta` + 三条 `KEY`、列说明 3/4 行口径修正、新增第 18 行、写入路径 17→18 列。
- **2026-10-16 W7 偏差清单与分流**：① 根总纲四段式叙述缺陷（`### qed_learn_*` 误挂共享表节下、af 表清单写四张
  实为五张、qt 写四张实为五张、`qed_course` 读写矩阵以「同上口径」继承了 `qed_domain` 的降级直写白名单、
  `meta` 先例引用指向不存在的 `qed_learn_practice_source.meta`）→ 由 REQ-120 W1/W2 承载；② 根私有表族前缀仍为
  `qed_learn_*`（与共享前缀撞名，违反命名空间隔离）→ REQ-120 W3/W4；③ `shared_tables.py:662-671` 的 `del tracker`
  丢弃 `online` 字段并写 `exploration_stage='已生成'`（对方文档 431 行禁止列，属探索产物只归 8901 写）→ DEFECT-014，
  白名单**不放宽**，登记为违规。
- **2026-10-16 W7 代改授权留痕**：用户裁决「根侧直接改其文档正文」，本轮在 QED-Tracker 改
  `database-shared-tables.md` + `architecture/index.md:18` + `design/index.md:44`，在 Axiom-Flow 改
  `database-design.md` 的「入库边界/共享表所有权」条；**均为文档面**，两仓零代码改动、零 git 操作（AGENTS.md 铁律）。
- **2026-10-16 W7 根总纲重排**：`database-design.md` 按用户指定顺序重排为四段式（第一段 `qed_*` 共享四表 →
  第二段 `qt_*` → 第三段 `af_*` → 第四段根私有表族），表清单总览按段落拆分并补齐 qt 五表 / af 五表，读写矩阵
  加「段」列与逐列白名单；零 `CREATE TABLE` 铁律与 mermaid ER 视图保持（`test_architecture_documents.py` 守护）。

- **2026-10-17 双库分裂根因与并库（阶段一）**：8903 文档下载管理／文档解析管理空数据**不是**本轮字段定档引入，
  而是 2026-09-11 起的双 `.env` 分库拓扑（8900→`qed_test`、8902→`qed`，8901 经兜底亦落 `qed`）把两套数据分别写进
  两个库；且两页都挂在「领域」根行之下——`GET /parsing/tree` 以共享表 `qed_domain` 为骨架
  （[api/axiom.py:348](../../../../backend/qed_engine/api/axiom.py#L348)），无领域行即返空列表，而领域行只存在于 `qed`。
  按用户裁决收敛为**单一工作库 `qed_test`**：`qed`→`qed_test` 全量并入 9 张表（共有列 `INSERT IGNORE` +
  `af_*`/`alembic_version` 整表 `LIKE` 克隆），逐表反连接核验「源行未命中＝0」；`QED-Tracker/.env:19` 与
  `Axiom-Flow/.env:12` 各改一行钉 `qed_test`（不新增环境变量键、保留根配置启停 8901/8902 的既有行为）；两服务经
  8900 控制接口重启，重启前只读 drift 探针核验 `qed_test` 漂移 0（`qed` 当时漂移 5 张，见下条）。真机复核：
  `/domains`=1、`/knowledge`=15、`/parsing/tree`=19 节点、`/books`=17，8903 两页数据齐备、控制台零报错。
- **2026-10-17 生产 `qed` 库 ALTER 窗口（阶段二，用户授权执行）**：备份 `tmp/backup/qed_prephase2_20261017.sql`
  （422 KB，`mysqldump --single-transaction --routines`，与并库前 `qed` 等值＝期间无写入方）→ 只读生成清单
  `tmp/req122_backsync.sql`（50 条；列定义原文逐字取自 `qed_test` 的 `SHOW CREATE TABLE`，杜绝与模型形状漂移）→
  执行器 `tmp/req122_backsync_apply.py --apply`（护栏：写目标 schema 只允许 `qed`，任何写 `qed_test` 的语句直接退出）
  → 50/50 OK。动作构成：`qed_domain`／`qed_course`／`qed_llm_calls`／`qt_knowledge` 加 `meta`；`qt_books` 加 7 列，
  其中 `kind`／`download_state`／`course_id` 走「可空加入 → 按主键从 `qed_test` 回填 → `MODIFY ... NOT NULL`」三步，
  避开 `STRICT_TRANS_TABLES` 把存量 26 行写成隐式默认值；6 列 `varchar(32)→(64)` 放宽＋注释定档；补 7 条索引；
  `qed_knowledge_point` 整表 `LIKE` 新建＋96 行（一步覆盖本壳 ①③③′② 四段生产清单：新表天然无 `confirmed`、
  `book_ref` 可空、`created_by`/`updated_by` 与 `idx_kp_course_kind_norm` 齐备）；`qt_selections` 走重建窗口
  （两侧 0 行，无损删 12 空转列）；补 `qed_llm_calls` 93／`qt_sources` 13／`qt_tasks` 28 行主键缺失行。
  只读复核：14 张表逐列 diff **零差**、行数两库全等、同主键存量行内容分歧 **0 行**；`ensure_schema` 只读 drift 探针
  对 `qed`＝**0 DROP / 0 CREATE**（7 张模型表全部匹配不动）→ **本壳生产库红线解除**：任一服务此后指回 `qed` 启动
  不再触发自愈重建，26 本书／15 套教程／1 领域／12 课程的清空风险归零。
  **未做（归属他线，不扩本轮）**：`qe_learn_*`／`qed_learn_*` 私有表族**未**回灌 `qed`——REQ-120 W4 双前缀尚未统一
  （`qed_test` 内 `qed_learn_unit` 与 `qe_learn_unit` 各 95 行并存，候选池／题目／attempt 仅旧前缀有数据），
  此刻复制等于把双前缀并存状态写进生产库；W4 改名落地后做一次整族快照即可。新列取值分布两库一致
  （`kind`／`download_state` 全空串、`sha256`／`meta` 全 NULL）＝源库本就未填充，属 Tracker 侧数据富化待办，非本窗口漏项。

- **2026-10-18 三链与库内形状复核（只读，零写操作；8900 已跑新代码）**：HTTP＝`GET /learn/knowledge-points?course=math_analysis` 200（`total` 1，行 22 列**无 `confirmed`**、含 `meta`/`created_by`/`updated_by`）；`GET /learn/star-map` 200（域 1 条）；`GET /llm/calls?limit=1&service=qed_engine` 200（`total` 116，按 `created_at` 倒序走三枚新索引）。库内（`qed_test`，`information_schema`＋`COUNT(*)` 只读）＝`qed_knowledge_point` outline 95 行 `domain_id` 非空 **95/95**（D1 回填不回归）、point 行 `book_ref IS NULL` 且无空串哨兵、审计与 `meta` 三列齐备（`confirmed` 不在列集）、索引集合＝PRIMARY＋`idx_kp_course_kind_norm`／`idx_kp_course_kind`／`idx_kp_domain`／`idx_kp_parent`（旧 `idx_kp_course_book_norm` 已删）；`qed_llm_calls` 116 行带 `meta` 与三枚二级索引。**两枚死列库内仍在**（`qed_domain.path_results`／`qed_course.related_targets`，实测 `qed_test`），故文档只记「已裁删除、执行待对方」，不领先库内事实。
- **2026-10-18 用户复裁（本轮收口第⑤行，处置＝补复核＋收尾归档）**：两枚死列**都删**，2026-10-15 的改判收回。随步三处＝本壳表1/表2 定档与前置条件、[REQ-119 请求稿](2026-10-16-shared-tables-tracker-request.md) R5（对象扩为两列、请求由「请对方裁决去留」改「请删列并连响应字段与 `api.md` 同批摘除」，R1~R6 编号不变以免动已冻结的台账判据）、[database-design.md](../../../architecture/database-design.md) 两列行与 7.8 T9。另裁 `GET /llm/calls` 的 `meta` 透出**本轮不补**（无消费方，补透出属改响应形状的新增面，ADR 0024 范围锁死），写进「遗留与移交」。

## 验证与验收

- 先红后绿：形状类改动（删列、`book_ref` 可空、去重键、`meta` 读写、索引存在性）各有一枚回归用例先落在测试里。
- 门禁矩阵按 [development.md](../../../guides/development.md)：`tests/test_learn_knowledge.py`、`tests/test_llm_call_log.py`、`tests/test_api.py` + `tests/contract/`（含台账与计划治理）+ 全量 pytest（`D:/software/anaconda3/envs/QED_env/python.exe`）+ ruff；前端改动跑 `tsc -b` + `web-ui/` 内串行 vitest + build。
- 真机复核：8900 重启后 `GET /learn/knowledge-points`、`GET /learn/star-map`、`GET /llm/calls` 三链各自验证；库内侧用 `COUNT(*)` 与列存在性核验（MySQL CLI 需全路径 + `--binary-mode`）。
- 默认测试不连生产 `qed` 库、不读写 `dataset/`。

## 回滚

- 表3（`qed_knowledge_point`）：改判就地 ALTER 后回滚**不走重建**——代码侧 `git revert` + 8900 重启；库侧以迁移第一步的
  整表 JSON 备份（`tmp/req118_bak/qed_knowledge_point.before-<stamp>.json`）为唯一可逆锚点逐列还原（DROP 新增三列、
  `book_ref` 改回 `NOT NULL DEFAULT ''` 并把 point 行 NULL 回填 `''`、索引换回 `idx_kp_course_book_norm`）；
  `confirmed` 该步不删，故无需还原。坐标回填是单向修正（空串→真值），不在回滚面。
- 表4（`qed_llm_calls`）：`git revert` 代码提交即可停掉新写入；已加的 `meta` 列与三条索引**保留不回滚**（对旧代码无害），主动 DROP 属 D 类人工操作。
- 文档：随同一提交 `git revert`；跨项目请求稿以「撤回说明」写回对方台账，不由根侧代改对方代码。

## 关闭与归档

- 关闭取值 `Achieved` 需 W1~W6 全达成、门禁绿、真机复核通过；`Retain` 归档 `history/plans/2026-10/`（四表定档与两处改判为不可替代证据）。
- 跨项目请求稿**等待对方回执不阻塞本行关闭**：请求发出并登记即视为 W4 达成（2026-10-16 达成），回执生命周期由
  [REQ-119 行与其壳](2026-10-16-shared-tables-tracker-request.md)承接跟踪，登记面见
  [cross-project-contracts.md](../../../design/cross-project-contracts.md) §4。
- 遗留与移交（收口时写全）：生产 `qed` 库 DDL 命令清单原文、`related_targets`/`path_results` 复裁结果、`meta.usage` 试验位是否定档。
- **2026-10-18 已按上述执行完毕**：todo REQ-118 行摘除 → `completed.md` 登记 Achieved；本壳按 Retain 归档 `history/plans/2026-10/`（出站链接 63 处按新深度重算并逐枚核到文件存在）；入站链接四处（`project-status.md`、`cross-project-contracts.md`、REQ-119 壳四枚、REQ-121 壳一枚）与 `plans/index.md` 同批改道；S5「生产库 DDL 零执行」按 2026-10-17 用户授权执行的事实以改记入关闭结果，不改写台账判据正文。

## 遗留与移交

**库内迁移 SQL 原文**（`qed_test` 待放行执行、生产 `qed` 库转人工择窗；换库名即可，逐条幂等；顺序不可颠倒——
② 必须在 8900 重启进新代码之后）：

```sql
-- ① 扩展槽（MySQL 8 元数据级变更，旧代码不受影响）
ALTER TABLE qed_knowledge_point
  ADD COLUMN meta JSON COMMENT '扩展槽：未定档字段先入本列（只读不筛）；定档后升为实体列并清空对应键'
  AFTER from_detail_id;

-- ②（先重启 8900 进新代码，再执行）删恒真确认位
ALTER TABLE qed_knowledge_point DROP COLUMN confirmed;

-- ③ D1 坐标回填（outline 行历史上被硬编码成空串）
UPDATE qed_knowledge_point kp
  JOIN qed_course c ON c.course_id = kp.course_id
  JOIN qed_domain d ON d.domain_id = c.domain_id
   SET kp.domain_id = d.domain_id, kp.domain_label = d.name, kp.course_label = c.name
 WHERE kp.node_kind = 'outline';

-- ③′ W3 形状（D3 去空串哨兵 + D4 审计列；加法或放宽，旧进程也能写，不占重启窗口）
ALTER TABLE qed_knowledge_point
  ADD COLUMN created_by VARCHAR(16) NOT NULL DEFAULT '' COMMENT '创建写入方标识（qed_engine）' AFTER meta,
  ADD COLUMN updated_by VARCHAR(16) NOT NULL DEFAULT '' COMMENT '最近写入方标识（qed_engine）' AFTER created_by;
ALTER TABLE qed_knowledge_point
  MODIFY COLUMN book_ref VARCHAR(64) NULL COMMENT 'outline：来源书（qt_books.book_id，版本换代不碎树）；point 行 NULL（空串哨兵随 DEFECT-011 唯一键降级后撤销）';
UPDATE qed_knowledge_point SET book_ref = NULL WHERE node_kind = 'point' AND book_ref = '';
ALTER TABLE qed_knowledge_point DROP INDEX idx_kp_course_book_norm;
ALTER TABLE qed_knowledge_point ADD INDEX idx_kp_course_kind_norm (course_id, node_kind, norm_key);

-- 表4 只做加法，绝不 DROP 重建（三项目共用审计史；代码侧由 ensure_indexes 幂等自检）
ALTER TABLE qed_llm_calls ADD COLUMN meta JSON COMMENT '扩展槽（同上）' AFTER review_note;
ALTER TABLE qed_llm_calls ADD INDEX idx_llm_created (created_at);
ALTER TABLE qed_llm_calls ADD INDEX idx_llm_service_created (service, created_at);
ALTER TABLE qed_llm_calls ADD INDEX idx_llm_task_step (task, step);
ALTER TABLE qed_llm_calls MODIFY COLUMN provider VARCHAR(32) NOT NULL
  COMMENT '模型提供方：api 渠道为厂商名（qwen/deepseek/glm/gateway），local 模式为 runtime 名（lmstudio/llamacpp/mineru）';
```

> **2026-10-16 更新（W2 落地后）**：上面 `qed_llm_calls` 的四条加法语句已由代码自迁移覆盖——
> 8900 启动路径 `ensure_columns`（补 `meta`）＋`ensure_comments`（provider 注释）＋`ensure_indexes`（三条索引）
> 逐项幂等自检。因此 `qed_test` 侧**不需要**手工执行表4 语句，随 8900 重启即完成；
> 生产 `qed` 库同样在其写方进程加载新代码后自愈，本段原文保留作人工兜底与对照。
> 表3（`qed_knowledge_point`）无代码自迁移通道，仍需人工放行；上文 ①③③′ 三段（加列、坐标回填、W3 形状）已由
> `tmp/req118_migrate_step1.py` 合并成一步（`qed_test` 专属断言护栏＋整表 JSON 备份＋幂等自检），与重启时序无关；
> 只剩 ② `DROP COLUMN confirmed` 必须等 8900 重启进新代码后单独执行。

**2026-10-17 生产库执行留痕（红线解除）**：上面 `qed_test` 迁移 SQL 原文所对应的生产 `qed` 库清单，已由用户授权在本窗口执行完毕——执行物＝由 `qed_test` 现形状反向生成的 `tmp/req122_backsync.sql`（50 条，dry-run 先予用户过目），备份＝`tmp/backup/qed_prephase2_20261017.sql`，复核与 `(0, 0)` 核验见「过程与证据」2026-10-17 条。此后**不再需要人工择窗执行本清单**；脚本与 SQL 保留作对照与再对齐入口（`req122_backsync_gen.py` 幂等只读，重跑即出增量清单）。

**已复裁（2026-10-18）**：用户裁「坚持原裁决 ③＝两列都删」，2026-10-15 的改判收回。两列属 QED-Tracker 所属表，根侧不代改代码与库内形状——删除须连同 8901 响应字段与其 `api.md` 同批摘除，**执行归对方**，请求口径已按此写回 [REQ-119 请求稿](2026-10-16-shared-tables-tracker-request.md) R5；实测两列在 `qed_test` 仍在，故 [database-design.md](../../../architecture/database-design.md) 的列行与 7.8 T9 记「已裁删除、执行待对方」。
**端点透出已裁（2026-10-18）**：`GET /llm/calls` 的 `CallLogItem` 仍不透出 `meta`（实测响应无该键），用户裁本轮不补——`meta` 属只读不筛的扩展槽且暂无消费方，补透出＝改响应形状属新增面，待有真实消费需求另批。
**W2 已裁（2026-10-16）**：本轮不接 gateway 的 token usage 采集（llm 层零 `usage` 字段，属新功能）；`meta.usage` 保持扩展槽试验位，是否升为实体列待有真实采集与统计需求再裁。

**库内一步的执行入口与顺序**（`qed_test`，脚本＝上面 ①③③′ 的唯一正本，SQL 段仅作对照与人工兜底）：

```
# 1) 预演（纯只读，打印计划动作与现状；已跑过：96 行、outline 坐标全空、point 行 1 条空串 book_ref）
D:/software/anaconda3/envs/QED_env/python.exe tmp/req118_migrate_step1.py --dry-run
# 2) 实跑（自动整表 JSON 备份到 tmp/req118_bak/ 后再 ALTER）
D:/software/anaconda3/envs/QED_env/python.exe tmp/req118_migrate_step1.py
# 3) 重启 8900 进新代码（控制台或服务启停接口，需用户授权）
# 4) 重启后单独执行唯一受时序约束的一条：
ALTER TABLE qed_knowledge_point DROP COLUMN confirmed;
```

> 脚本已改为**连接参数取 `.env` 的 `QED_DB_*`**、**四列注释从 `knowledge.py` 代码 DDL 抽取**（不再复制字面量，
> 代码与库内形状不可能漂移），且只允许目标库 `qed_test`（其他库直接 assert 退出）。

**S4 冒烟行清理命令**（`qed_test`，只删本轮三枚取证行；**2026-10-16 已按用户授权执行完毕**：删前 SELECT 核验＝主表 1 行＋候选池 2 行且均为当日新建，删后回到基线 96／3，`tmp/req118_s4_cleanup.py` 留痕；命令原文保留作对照）：

```sql
SELECT kp_id, name, created_at FROM qed_knowledge_point WHERE kp_id = 'kp-9f624378f969';
SELECT detail_id, name, gen_status FROM qed_learn_kp_detail
 WHERE detail_id IN ('kpd-41f27303e7b4', 'kpd-415d28d1fe99');
DELETE FROM qed_knowledge_point WHERE kp_id = 'kp-9f624378f969';
DELETE FROM qed_learn_kp_detail WHERE detail_id IN ('kpd-41f27303e7b4', 'kpd-415d28d1fe99');
-- 核验回到基线：主表 96 行（outline 95 + point 1）、候选池 3 行、star-map 该课程 kp_confirmed 回到 1
```

**收口时清理**：本轮 `tmp/` 落下的脚手架（`req118_w1_impl.py`／`req118_w1_tests.py`／`req118_w2_*.py`／
`req118_w3_*.py`／`req118_db_probe*.py`／`req118_probe*.py`／`req118_db_volatility.py`／`req118_doc_shape_note.py`
与备份目录 `req118_bak/`）属会话自用产物，验收确认后按 ADR 0019 决定 4 一并清理、不留残留；
删除动作待用户明确要求后执行。
