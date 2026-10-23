# 学习设计轮 M4·知识探索（问答与召回消费面，后置）（knowledge-exploration）

状态：Accepted
任务类型：B
最后更新：2026-10-18
关联 ADR：无新增（重划登记沿用 [ADR 0016](../adr/0016-todo-registration-one-task-one-plan.md) 一任务一行一壳）
关联设计：[frontend-architecture.md](../architecture/frontend-architecture.md)（8903 消费面）、
[api-contracts.md](../architecture/api-contracts.md)（8900 门面契约承接位）
关联 Tracker：docs/trackers/todo.md（ARCH-027-M4 任务行；现状基座见 REQ-070-LEARN 现状壳；检索/知识库侧规划见 ARCH-025 滚动壳）
归档判定：Retain（滚动记录，模块收口时按当时里程碑归档 history/plans/）

> 本壳是学习设计轮 **M4 模块**（知识探索：问答与召回消费面）的唯一固定滚动记录，**后置启动**。
> 后置依据（用户裁决 2026-09-22/23 两并）：① 本轮不向子项目发请求，而知识探索的重形态（对话式
> RAG 问答）依赖 Axiom-Flow 检索端点（其 R1~R4 在其 1.0 线，对方 PLAN-009 登记）；② 主链闭环
> （注册→编译→门→推进）不依赖探索面。轻形态（既有知识体系浏览、澄清访谈 ask_questions）可先行。

## 目标与成功标准

**目标**：在不阻塞主链的前提下，把「知识探索」从现状固定形态演进为学习链路旁路的问答与召回面。

**成功标准正本在台账行**（ADR 0023）：验收判据逐条见[任务台账](../trackers/todo.md)
`ARCH-027-M4` 行的「成功标准」列，本壳不复制判据条目；判据的验证手段见「验证与验收」节，
执行进展与证据见「过程与证据」节。原 E1~E3 编号由行内 S1~S3 按序承接，本壳其余章节出现的
E 编号即指对应判据（与工作项 K-1~K-3 一一对应）。

## 范围与非目标

**范围**：8903 探索/问答消费界面、8900 门面侧的问答会话编排（转调 8902 的部分只做适配）。

**非目标**：检索/切片/rerank 本体（归 ARCH-025 线与 Axiom-Flow 侧）、知识库表演进（同上）、
知识图谱（暂不做，判例同第一批）、课程内练习问答（判分归主链 M-3）。

## 前置条件

1. E1/E2 无子项目依赖，可随主链契约（M-1）冻结后滚动。
2. E3 **启动条件**＝Axiom-Flow 检索端点（其 PLAN-009 线）就绪且用户发令向根侧联调；
   届时按跨项目协作规范另发请求，不在本轮排期内。

## 文档知识梳理与探索·契约设计稿（2026-10-18 出稿，**待审**，未批复不动码）

> 出稿起因＝用户裁决 2026-10-18：本行改判为承载「文档知识梳理与探索」（管理中心新模块），
> 本轮只出设计稿评审。**本壳是设计稿正本**；评审通过后再落三处：① `docs/design/frontend/`
> 新建设计文档，② `docs/trackers/todo.md` ARCH-027-M4 行正文改判（草案见末节），③ 实施。
> 原 K-1/K-2/K-3 三条工作项与 S1~S3 判据不因本稿作废：K-1（学习中心知识面维持）已由各收口轮
> 兑现，K-3（对话式 RAG 问答）保持后置并顺延为新行 S5。
>
> **2026-10-20 冲突收敛（随[文档知识生产线集群总纲](2026-10-20-doc-knowledge-cluster-master-outline.md)）**：本稿与 REQ-116 已裁事实三处相撞——X1 模块名与路由（本稿 `/admin/doc-knowledge`「文档知识梳理」对已裁 `#/admin/analysis`「文档分析处理」，两条同日裁决需择一）、X2 后端归属（本稿根侧建表建端点，对「根侧不实现分析算法与后端端点」及行 S3 的移交口径）、X3 把已裁事项当待裁。处置＝本稿**降级为集群总纲的输入件**：命名与边界正本在 REQ-116 壳，本稿只保留「按文档核对三态 + 块级溯源」的读面需求、数据承载三档与现状取证表。据此作废 D-M4-1／D-M4-2 两枚待裁点——前者并入总纲 C-3（溯源承载），后者本已是 REQ-117 移交、REQ-116 壳在册的「确认／驳回唯一写面在管理屏」，不再提问。


### 结论先行

**要解决的问题**：知识点目前只有「按课程/领域看」的通路，**没有「按文档看」的通路**——一本书解析完
之后，它抽出过哪些大知识点（目录节点）、哪些候选叙述待确认、哪些已提升为正式知识点、每条的证据在
哪一页哪一块，在管理中心侧**一处都看不到**，也点不回去。学习中心的 `#/knowledge` 是消费视图且
零写面，梳理与确认动作散落在课程工作台里，与「文档」这个内容生产入口断链。

**本稿主张**：在 8903 管理中心「文档解析管理」之后新增**「文档知识梳理」**模块，以文档（书目/解析版本）
为唯一入口，一屏内完成「原文 ↔ 知识点」双向核对与三态推进（目录树 / 候选池 / 已确认），溯源精度到块。
**数据承载走新建根私有映射表**（案 C，见下节），共享主表 `qed_knowledge_point` 与候选池
`qe_learn_kp_detail` 均不动列、不撞共享表字段冻结与生产 ALTER 红线。

### 一、现状资产与缺口（逐条取证）

| 面 | 已有（证据） | 缺口 |
| --- | --- | --- |
| 表·主数据 | `qed_knowledge_point`（共享，8901/8902 可读）：outline 行带 `book_ref` + `source_ref{kind,ref_id,page_start,page_end}` + `depth/order_hint`；point 行 `book_ref` 恒 NULL、文档归属只活在 `anchors` JSON（`knowledge.py:42-70`） | point 行**无任何可按文档/页反查的实体列**；一书共证多知识点、一知识点跨多书都无从表达 |
| 表·候选池 | `qe_learn_kp_detail`（根私有）：`book_ref VARCHAR(64) NOT NULL DEFAULT ''` 实体列在（`knowledge.py:81`）、`anchors` JSON、`gen_status` 四态 + `confirmed` 位 + `gen_batch` 版本组 | 列在但**无索引、无过滤入参**（索引只有 course/batch/parent，`knowledge.py:97-99`） |
| 端点·读 | `GET /learn/courses/{id}/outline?book=`（book 过滤已存在，`api/learn.py:1412-1423`）；`GET /learn/kp-details?course／gen_status／batch／parent`（`:1184-1206`）；`GET /learn/knowledge-points?domain／course／type／q`（`:1127-1144`） | 三枚都**不能以文档为主键取数**：候选池无 `book` 参、主表无 `book/page` 参、无「本文档聚合」端点、无「一知的全部来源锚点」端点 |
| 端点·写 | `POST /kp-details`（登记）/`{id}/confirm`（提升，`knowledge.py:356-370` 把 detail 的 anchors 平移到主表 point 行）/`{id}/reject`/`{id}/like`；`PUT /courses/{id}/outline`（整树幂等替换）；`POST /learn/annotations/generate`（章/知识点粒度按需生成，源文＝页 blocks，`annotations.py:24,82`） | 锚点**没有人工纠错写面**（写错页/写错块只能整条重登）；无「从整本文档批量出候选」的生成腿 |
| 文档内容腿 | 8900 透传齐全：`/axiom/books`、`/axiom/books/{id}/pages/{n}`（blocks）、`…/pages/{n}/image`（页图）、`/axiom/books/{id}/manifest`、`/axiom/parsing/tree`、块级 review/edit（`api/axiom.py:138-349`） | 消费侧无人把「知识点锚点」接成「跳原文 + 高亮块」 |
| 界面 | 学习中心 `#/knowledge`＝领域星图 + 课程层大知识点虚框，**零写面**（`CourseKnowledge.tsx` 头注 §11：候选确认/驳回/登记归工作台批注闭环）；解析管理面有书目树 + 页块 + 页图对照 | `/admin` 导航五项＝控制台/仪表盘/文档下载管理/文档解析管理/模型调用记录（`AdminLayout.tsx:17`），**管理中心零知识点入口** |

### 二、目标与非目标

**目标**：让「一本书解析完 → 它的知识梳理」成为管理中心的常态动作：以文档为入口取全三态、双向溯源、
人工推进（候选→确认→归档），并把知识点↔原文的对应关系沉淀成**有索引、到块粒度**的独立事实源。

**非目标**（本轮一律不碰）：① 检索/切片/embedding/rerank 本体（归 ARCH-025 线与 Axiom-Flow 1.0 侧，
其 PLAN-009 的 R1~R4）；② 对话式 RAG 问答消费面（原 K-3，仍后置＝新行 S5）；③ 知识图谱与 GraphRAG
挖掘（窄化后仍在对方侧）；④ 学习中心的门与判分（主链 M-3，已收口）；⑤ 从整本书自动抽候选的 LLM 腿
（裁决点 D-M4-3，本稿默认不入本轮）；⑥ 生产 `qed` 库 ALTER（案 C 零 ALTER，若改判案 A 则转人工）。

### 三、数据承载：文档 ↔ 知识点的三种摆法

| # | 方案 | 形状 | 代价 | 判定 |
| --- | --- | --- | --- | --- |
| A | 主表补 `book_ref` 列 + 索引 | point 行也写来源书 | 撞三重红线：共享表（`qed_` 前缀，8901/8902 可读）字段冻结（2026-10-15 轮）、生产 `qed` 库 ALTER＝D 类转人工、语义错（一知多书/一书多知都表达不了，现注释已声明「提升后来源书只在 detail 侧」`knowledge.py:81`） | **不采** |
| B | 零改表，读时派生 | `detail.book_ref` ∪ `outline.book_ref` ∪ `anchors` JSON_SEARCH 三源并集 | 不动任何表；但 anchors 无索引、形状不统一（`page` 可选、无块序号），文档量大后反查退化，且人工纠错无写位 | 兜底可，不作主案 |
| C | 新建根私有映射表 `qe_learn_kp_source` | 一行＝一条锚点（kp 或候选 × 来源 × 页 × 块） | 新表一枚（根私有、`qe_` 前缀不进共享面，零 ALTER 既有表、零跨项目请求）；确认提升时由 detail.anchors 展开写入，人工可整表替换纠错 | **推荐** |

**案 C 作废注记（2026-10-21，不删原文）**：案 A／B／C 三档的**共同前提已消失**——三案都以根侧候选池 `qe_kp_detail`（定档目标名，库内归一前旧名见 REQ-132 定档表）为落点，而该表于 2026-10-21 由 [REQ-132 W5 判定表](../history/plans/2026-10/2026-10-21-qe-family-rename-and-refactor.md) 判**整表废弃**（知识点梳理工作区与候选池正本整体归 Axiom-Flow `af_kp`，根侧只保留共享主表提升面；后端归属＝[REQ-131](2026-10-20-doc-knowledge-cluster-master-outline.md) C-2 同日定档案 甲）。溯源承载据此定档为**两处**：`af_kp.anchors`（对方侧，页码＋块序号，随梳理结论落库）与共享主表标量列 `from_detail_id`（根侧提升幂等锚，列语义由「溯源本池」平移为「溯源 `af_kp.node_id`」）。`qe_learn_kp_source` 建表草案**作废**，下方案 C 逐列契约一并作废、留作当时判据证据；对方侧形状正本见 [AF PLAN-024](../../Axiom-Flow/docs/plans/2026-10-21-af-table-family-rebuild.md)。

**案 C 完整列契约**（评审重点，逐列写用处；与既有表的关系与生命周期同表）：

| 列 | 类型/键 | 空与默认 | 用处 |
| --- | --- | --- | --- |
| `source_id` | VARCHAR(64) PRIMARY KEY | 服务端生成 | 行 ID（`kps-<hex12>`，与 kp/detail 不同族，便于整表替换时定位） |
| `target_kind` | VARCHAR(16) | NOT NULL '' | 闭集 `point`（主表已确认）/`detail`（候选池待确认）：同一张表承载两态，梳理时才能一次取全 |
| `target_id` | VARCHAR(64) | NOT NULL '' | 指向 `qed_knowledge_point.kp_id` 或 `qe_learn_kp_detail.detail_id`（逻辑引用，不建物理外键，与学习表族既有口径一致） |
| `course_id` | VARCHAR(64) | NOT NULL '' | 课程坐标快照：候选可悬空、课程删除后仍能按文档清点，避免孤儿行无处归 |
| `ref_kind` | VARCHAR(16) | NOT NULL '' | 闭集 `af_version`/`book`：来源版本换代不碎链（对齐 outline 行 `book_ref` 的「版本换代不碎树」口径） |
| `ref_id` | VARCHAR(64) | NOT NULL '' | 书目/版本 ID（指向 `af_books`/`qt_books`），**文档反查主键** |
| `page` | INT | NULL | PDF 页序（与 `source_ref.page_start`、解析面页序同口径）；NULL＝整书级来源 |
| `block_index` | INT | NULL | 块序号（`blocks.json` 下标，R2 判例的 `self_ref="blocks.json#/{index}"` 形状）；NULL＝回落页级 |
| `snippet` | VARCHAR(1000) | DEFAULT '' | 锚点原文摘句（限长，前端高亮与人工核对用；降级不删，同 anchors 口径） |
| `origin` | VARCHAR(16) | NOT NULL '' | 闭集 `manual`（人工登记/纠错）/`promoted`（confirm 时自 detail.anchors 展开）——两态来源分账，重算时可只覆盖 promoted |
| `created_at`/`updated_at` | DATETIME | NOT NULL | UTC 时间戳 |
| 索引 | `KEY (ref_id, page)`、`KEY (target_kind, target_id)`、`KEY (course_id)` | — | 文档反查与一知多源两条读路的唯一支撑，也是弃 B 取 C 的理由 |

**生命周期**：登记候选→可带 anchors（写 detail 行）；确认提升→主表 point 行照旧存 anchors 快照（不动
既有行为），同时展开写入映射表 `origin=promoted`；人工在梳理面改锚→整表替换该 target 的 promoted 行并
写 `origin=manual`；候选驳回→不删映射行（留核对痕迹）；知识点删除→按 `target_kind/target_id` 级联清。
主表与候选池**一列不改**，映射表整体可删可重建（派生数据，不承载用户勾选权）。

### 四、读面端点草案（`/api/v1/learn/*`，落码前先进 `tests/contract` 清单）

| 端点 | 语义 | 错误 |
| --- | --- | --- |
| `GET /learn/documents/{ref_id}/knowledge` | 以文档为主键的聚合：`{ref_id, outline:[…子树], points:[…带锚点], candidates:[…候选], counts:{outline,point,candidate}}`；分页参数 `limit/offset`；跨课程取全（同一本书可被多课引用） | 404（ref_id 形态合法但解析面不可达时返空聚合，不 404——文档腿与知识腿各自判定）；503（知识存储未挂载）；422（limit 越界） |
| `GET /learn/knowledge-points?book=&page=` | 主表反查扩两维（走映射表 JOIN，`kind=point` 默认不变）；与既有 domain/course/type/q 四维可叠 | 422（page 非正整数）；503 |
| `GET /learn/kp-details?book=` | 候选池按文档过滤（`book_ref` 列已在，补齐入参 + `KEY`） | 422/503 同上 |
| `GET /learn/knowledge-points/{kp_id}/sources` | 一知的全部来源锚点（含候选期锚点），供前端「跳到原文并高亮块」 | 404（kp 不存在）；503 |
| `PUT /learn/knowledge-points/{kp_id}/sources` | 锚点整表替换（人工纠错唯一写面，幂等替换 `origin=manual`，保留 promoted 痕迹按裁决 D-M4-4 定） | 404；422（数组越界/闭集值非法/超长）；503 |

- 零新表以外的读面改动：`MySQLKnowledgeStore`/`InMemoryKnowledgeStore` 同形增 `sources_of()`、
  `replace_sources()`、`list_points` 增 `ref_id/page` 两参、`list_details` 增 `book_ref` 参（接口 parity
  测试守护，判例 `test_mysql_practice_store_interface_matches_memory_store`）。
- 文档内容腿**不新增**：页 blocks 与页图继续走 8900 透传的 `/axiom/books/{id}/pages/{n}` 与
  `…/image`（ADR 0007：8903 只连 8900）。

### 五、界面形态草案（8903 管理中心）

**落点**：`/admin` 导航在「文档解析管理」之后插入**「文档知识梳理」**（route `/admin/doc-knowledge`，
`AdminLayout.tsx:17` 数组随步）。理由：本模块面向内容治理（书目→解析→梳理→确认），与解析管理同一
受众；学习中心 `#/knowledge` 维持消费视图与零写面不动。

**一屏三区**（主从结构，不二级导航）：
- **文档选择区**：书目/版本下拉 + 解析状态提示（复用 `/axiom/parsing/tree` 与 `af_books` 元数据口径）；
  切文档＝整屏重取聚合端点，URL 带 `?book=` 深链可分享。
- **原文区**（中）：页块列表 + 页图（复用解析面既有渲染件），接收右区跳转指令后滚到目标页/块并高亮；
  块级缺失时回落页级并在页图上标注（案 C 的 `block_index` NULL 语义）。
- **知识点区**（右）：三态一页摊开＝目录子树（outline，带每节点候选/已确认计数）→ 待确认候选（可确认/
  驳回/点赞，动作复用既有 `POST /kp-details/{id}/…`）→ 已确认知识点（含四分类 type 徽标与锚点列表，
  可「定位原文」与「编辑锚点」）。写面只在此区与锚点弹层，不弹窗套弹窗。

**与既有界面的分工**（避免双写）：学习中心工作台保留学习者侧的候选登记（学习者独占语义不动），**确认/
驳回主入口**是否从工作台迁入管理中心＝裁决点 D-M4-2。

### 六、裁决点（选项与推荐口径，未批复不动码）

| # | 悬而未决 | 选项 | 推荐 |
| --- | --- | --- | --- |
| D-M4-1 | 文档↔知识点数据承载 | A 主表补列 / B 读时派生 / C 新建根私有映射表 | **已并入总纲 C-3，本处不再单独裁**（原推荐 C：零共享表改动、零生产 ALTER、到块粒度、可整表重建） |
| D-M4-2 | 确认/驳回写面归属 | 管理中心为唯一主入口（工作台改只读）/ 两处同开 / 工作台保持主入口、管理中心只读 | **已裁在册（REQ-116 壳「确认／驳回的唯一写面在此屏」），本处不再提问** |
| D-M4-3 | 「从整本文档批量出候选」的 LLM 生成腿 | 入本轮（按章批量生成候选）/ 不入本轮，随主链 M-2 生成腿与真机档位另批 | **不入本轮**：本轮先把人工闭环 + 溯源跑直；批量抽取依赖 M3 真机冒烟与限长档位 |
| D-M4-4 | 锚点粒度与人工纠错写面 | 只到页（`block_index` 恒 NULL）/ 到块 + 整表替换且保留 promoted 痕迹 / 到块且人工即覆盖 | **到块 + 整表替换保留痕迹**：块粒度才能高亮原文；promoted/manual 分账使重算不冲掉人工纠错 |
| D-M4-5 | 原文视图落点 | 新模块内嵌原文区（本稿形态）/ 深链跳回 `/admin/parsing?book=&page=` 复用解析面 | **内嵌**：梳理是高频来回动作，跨面往返会打断核对；解析面保持其自身职责不扩 |
| D-M4-6 | 原 K-3 对话式 RAG 问答处置 | 留在本行作 S5（后置，前置＝8902 检索端点就绪 + 用户发令联调）/ 移出本行另立请求 | **留作 S5**：它消费正是本模块沉淀的锚点与映射表，同属一条知识探索链 |

### 七、实施序草案（批复后按序执行）

| 步 | 内容 | 门禁 |
| --- | --- | --- |
| W1 | 映射表 `qe_learn_kp_source` DDL + 两形存储同构读写（`sources_of`/`replace_sources`）+ 单测 | 定向 pytest |
| W2 | 读面四枚 + 写面一枚（**契约测试先行**），`api-contracts.md` §⑥ 与 `endpoint-registry` 随步 | `tests/contract` + 定向 pytest |
| W3 | confirm 展开写入锚点（`origin=promoted`）+ 存量 anchors 一次性回填脚本 | 定向 pytest |
| W4 | 8903 管理中心「文档知识梳理」三区界面 + `AdminLayout` 导航随步（此步起触发 `qed-frontend-check` 浏览器实测） | web 门禁 + 实测 |
| W5 | code-map / database-design（新表行 + 读写矩阵）/ `docs/design/frontend/` 设计文档晋升 + 台账行改判收口 | 契约门禁全套 |

### 八、台账行改判草案（评审通过后落 `todo.md`，本轮不落）

- **描述列**改为：学习设计轮 M4·文档知识梳理与探索（知识探索消费面）——以文档为入口的知识点三态梳理与
  溯源（管理中心「文档知识梳理」模块）+ 澄清访谈入主链提案 + 对话式 RAG 问答（后置）。
- **成功标准列**改为：S1 文档主键读面可用（四枚端点 + 映射表到块锚点，8903 只连 8900）；S2 管理中心
  「文档知识梳理」三区界面可用且确认/驳回主入口归位；S3 澄清访谈 ask_questions 入主链提案（原 K-2 不变）；
  S4 溯源跳回原页原块真机走查一次通过；S5（后置）对话式 RAG 问答，前置＝8902 检索端点就绪 + 用户发令联调。
- 优先级按用户「这是一个重要模块」的判断上调（低→中），随改判一并落。

## 工作项（滚动登记表）

| 流 | 内容 | 状态 |
| --- | --- | --- |
| K-1 | 现状维持与收编：知识体系浏览界面归入学习设计轮资产清单，回归核验 | 待滚动 |
| K-2 | 澄清访谈 ask_questions（L9）：访谈→结构化补参→注入主链 M-2 提案 | 待开始 |
| K-3 | 对话式 RAG 问答消费面（v0 切分校验 → v1 BM25 简易召回 → v2 向量混合召回，探索验证界面三阶段承自 ARCH-025 滚动壳「验证界面承接」段） | 后置（启动条件＝前置 2） |

## 过程与证据

- **2026-09-23**：学习设计轮重划建壳，工作项 K-1~K-3 在本壳登记；后置依据＝检索/切片/rerank
  本体归 ARCH-025 线与 Axiom-Flow 侧，知识图谱暂不做（同第一批判例）。
- **2026-09-22**：用户裁决本轮不向子项目发请求；E3 启动时按跨项目协作规范另发请求。
- **2026-09-30**：台账结构改判（[ADR 0023](../adr/0023-todo-row-carries-scope-and-criteria.md)）——
  验收判据正本移入 todo 行「成功标准」列，原行内「未启动／E3 启动条件」叙述迁入本节。
- **2026-09-30**：现状＝未启动；K-1 待滚动，K-3 后置（前置＝8902 检索端点就绪 + 用户发令联调）。
- **2026-10-18 M4 改判与契约稿出稿（docs-only，未动码）**：用户裁决本行改判承载「文档知识梳理与探索」并在管理中心新建模块（落点＝「文档解析管理」之后），本轮只出设计稿评审。取证口径＝把现状读到实际文件行号：主表 point 行文档归属只在 `anchors` JSON、`book_ref` 恒 NULL（`services/learn/knowledge.py:42-70`），候选池 `book_ref` 实体列在但无索引无入参（`knowledge.py:81,97-99`、`api/learn.py:1184-1206`），outline 的 `book` 过滤已存在（`api/learn.py:1412-1423`），confirm 提升时 anchors 平移到主表（`knowledge.py:356-370`），管理中心导航五项无知识点位（`web-ui/src/components/AdminLayout.tsx:17`），学习中心知识面零写面（`web-ui/src/pages/CourseKnowledge.tsx` 头注 §11）。裁决点 D-M4-1~6 已列选项与推荐口径，数据承载推荐新建根私有映射表 `qe_learn_kp_source`（不动共享表、不触生产 ALTER）；**未批复不动码**，实施序 W1 起于映射表 DDL 与两形存储读写单测。

- **2026-10-20 范围整合（用户裁决「先确定好范围将其集中起来，然后再做总体设计」）**：本行与本会话 2026-10-18 的契约稿一并纳入[文档知识生产线集群总纲](2026-10-20-doc-knowledge-cluster-master-outline.md)——集群三段切线（生产段 REQ-116 / 梳理段本行 / 消费段 REQ-130 与主链），三处冲突的收敛方式、后端归属三案（甲＝算法与候选归 Axiom-Flow、门面与确认写面归根；乙＝整块连两表写入交对方，撞 ADR 0025 前缀即所有权与跨项目写他人表，不采；丙＝后端留根侧，需改判 REQ-116 行 S3）与两阶段排分（阶段一不等对方，绕开 ARCH-025 的「AF 达 V1.0 才启动」门槛）。本壳状态不变（设计稿待审），待裁点收敛为总纲 C-1~C-6；行「成功标准」列一字未改。

- **2026-10-21 溯源承载定档（docs-only，本行未启动故零代码）**：随 [REQ-132 W5 判定表](../history/plans/2026-10/2026-10-21-qe-family-rename-and-refactor.md) 与 [REQ-134 退指针](2026-10-21-af-table-architecture-design.md)，本壳「三」节的案 A／B／C 共同前提（根侧候选池）消失，**案 C 的 `qe_learn_kp_source` 建表草案作废**（原文与逐列契约留档，注记见该节）；C-2 后端归属同日定档案 甲＝梳理工作区与候选池正本归 Axiom-Flow 单表 `af_kp`，根侧只保留共享主表 `qed_knowledge_point` 的提升面（拉取式单向、唯一人门＝`af_kp.confirmed`、幂等锚＝主表 `from_detail_id`）。本行本壳**状态与「成功标准」列一字未改**（S1~S3 属消费面问答与召回，与存储承载正交）；若后续为「梳理段执行批次」立项，须按 ADR 0016 另新一行一壳，不扩载本行。

## 验证与验收

- E1/E2 收口：web 门禁 + qed-frontend-check 实测；E3 联调另计（届时随请求立项更新本壳）。
- 本壳随条目增改更新「最后更新」。

## 回滚

纯记录文档；界面代码改动按各自提交独立回滚。

## 关闭与归档

关闭条件＝E1~E2 验收通过且 E3 已移交或明确不做（用户裁决），关闭时本壳 Retain 归档
`history/plans/<year-month>/`，todo 移除 ARCH-027-M4 行。
