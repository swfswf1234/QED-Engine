# 学习设计轮 M5·知识点体系与知识梳理星图（knowledge-point-star-map）

状态：In Progress
任务类型：B
最后更新：2026-09-30
关联 ADR：无新增（沿用 [ADR 0016](../adr/0016-todo-registration-one-task-one-plan.md) 一任务一行一壳；
共享表族约定见 [ADR 0009](../history/adr/v0.1/0009-shared-qed-tables.md)，所有权例外判例
`qed_llm_calls` 与 `qed_learn_*`——是否为此再立 ADR 属待裁项 D1）
关联设计：[database-design.md](../architecture/database-design.md)（qed_* 共享表族与学习表族节，
第四张共享表登记去处）、[api-contracts.md](../architecture/api-contracts.md) §⑥（学习域端点契约）、
[frontend-architecture.md](../architecture/frontend-architecture.md)（8903 视觉与服务架构）
关联 Tracker：docs/trackers/todo.md（ARCH-027-M5 任务行；主链与 M1~M4 见
[学习设计轮主链壳](2026-09-22-learning-design-mainline.md)）
归档判定：Retain（设计稿 + 裁决过程 + DeepTutor 借鉴判定表为长期证据，收口时归档 history/plans/）

> 本壳是学习设计轮 **M5 模块**（知识点体系数据层 + 学习中心「知识梳理星图」导航层）的唯一固定
> 记录，2026-09-30 由用户发令立项：在qed类数据库设计中新增**第四张共享表 = 知识点表**与
> **一张 QED-Engine 私有表 = 知识点 detail 表**，把「领域 → 课程 → 知识点」三层体系补齐，
> 并据此设计学习中心星图界面。本轮交付＝**只出设计与空态**（用户裁决 ④），不动代码、不发跨项目请求。

## 裁决登记（2026-09-30，用户）

1. **第四张共享表所有权＝根定义建表、三项目读写**：结构由根仓库幂等建表维护（判例
   `qed_llm_calls` / `services/llm/call_log.py`），表结构在 QED-Tracker
   `database-shared-tables.md` 登记一行；具体写权限矩阵见待裁项 D1。
2. **两表语义分工（用户原话定型）**：**知识点表＝已确认（整理好后）的知识点**，
   **detail 表＝生成待选的明细池，可多版本、多叙述**——即「候选池 → 人工确认 → 提升到主表」
   的两段式，主表只存采纳结果，正文与多条叙述留在 detail 表。
3. **星图渲染方案＝布局纯函数 + ECharts graph**：布局（track 聚类 + 学习顺序拓扑分层 +
   跨 track 边）写成可 vitest 断言的纯函数，渲染用既有 `echarts@6.1` 的 graph series
   （`layout:'none'` 喂坐标，补按需注册）；不引入新图可视化依赖。
4. **本轮范围＝只出设计 + 空态**：不发跨项目请求、不做知识点生成管线实施；界面按现有
   `qed_domain`/`qed_course` 数据渲染真实星图，知识点层走空态。
5. **主链「非目标」窄化**：主链壳原「知识图谱（暂不做）」指的是 GraphRAG 式自动图挖掘
   （R1 拒绝项），本模块的星图＝**既有课程体系数据的导航层**，不属于该项范围；已在
   [主链壳](2026-09-22-learning-design-mainline.md) 随步改写该非目标行并加指针。

## 目标与成功标准

**目标**：让「领域 → 课程 → 知识点」三层体系在**共享数据面成立**（第三层从当前的无表可存
变为两表可存：候选明细 + 已确认主数据），并让学习中心首页从当前的「stage 分层泡泡图原型」
演进为**按学习方向（track）聚类、按学习顺序成图、可下钻到知识点掌握详情**的星图导航层。

**成功标准**：正本在台账行 [todo.md](../trackers/todo.md)「学习设计轮（第五轮：ARCH-027 主链
路径 + M1~M5 五模块）」节的 ARCH-027-M5 行 `成功标准` 列（S1 两表契约成文且与既有裁决不冲突／
S2 星图数据形状与端点面成文／S3 星图 UI 设计可实施／S4 本轮只出设计与空态不动码／
S5 待裁清单 D1~D6 逐项有用户裁决记录），本壳不复制判据条目（ADR 0023 [链接](../adr/0023-todo-row-carries-scope-and-criteria.md)）。各判据的验收手段见「验证与验收」节，判据正文所在的设计节
＝表契约草案（S1）、端点面草案（S2）、星图 UI 设计 + 借鉴判定表（S3）、工作项登记表（S4/S5）。

## 范围与非目标

**范围**：M5 的两表**设计契约**、星图与知识点详情页的 **UI 设计**、`#/knowledge` 现状原型
（[Knowledge.tsx](../../web-ui/src/pages/Knowledge.tsx) + [CourseGraph.tsx](../../web-ui/src/components/CourseGraph.tsx)）
向星图演进的**改造面清单**、DeepTutor 学习面第三切片（知识点建模与图可视化）的借鉴判定。

**非目标**：
- 知识点**生成管线**实施（依赖主链 M-2 编译线与 M3 剩余 A-5/A-6 开关；本壳只定「候选池」的
  数据形状，使其可被 M-2 或人工写入）；
- 掌握门与判分（主链 M-3：`qed_learn_unit_progress` 扩列，0928 裁决「无需第四张 learn 表」
  **不变**——本模块的 detail 表是内容候选池，不是掌握记录）；
- 出题/复习/错题本（M2）、问答与召回（M4）、块学习操作面与渲染基线（M1 UI-2/3/4）；
- 解析与知识整理的**子项目侧**改动（归 ARCH-025 线；本轮按裁决 ④ 不发请求）；
- GraphRAG / LLM 自动图挖掘（R1 拒绝项维持）。

**与 M1 的边界**：M1 承载「学什么」——课程书架、链路视图（块序列）、掌握看板；M5 承载
「体系在哪、走到哪了」——领域/track/课程/知识点四级导航与知识点级总览。三层下钻链路为
**星图（M5）→ 知识点详情（M5）→ 块学习（M1）**，M5 不复制块渲染。

## 前置条件

1. `qed_course.track`（VARCHAR(50)，学术方向）与 `qed_domain.classic_tracks`
   （`[{name,summary,kind=main/branch}]`）为星图聚类的**既有真实数据源**，已核：
   `QED-Tracker/docs/architecture/database-shared-tables.md:72,94,158,193,218`，且已透到前端
   （`web-ui/src/api/tracker.ts:49,104,119,335`）——星图实施无需子项目新改动。
2. 两表 DDL 落点为根侧幂等建表（判例 `services/learn/base.py` 与 `services/llm/call_log.py`），
   **根不引入 Alembic**（2026-09-28 方案②裁决沿用）。
3. 学习域端点当前在生产库上返回 503（M-1 存储类未接入，见
   [database-design.md](../architecture/database-design.md) 学习表族节），M5 端点实施排在
   M-1 存储接入之后，或与本模块同批接入（待裁 D1 连带）。
4. 实施排期逐条经用户确认（本壳只立项与设计）。

## 表契约草案（两表，一行=语义；DDL 实施时定）

> 原则承接主链 0928「公共表已有的不重复」：领域/课程坐标只存 `ref_id` + `label` 快照；
> 新增的只有**第三层知识点**，且按裁决 ② 分「候选明细」与「已确认主数据」两张。

| 表 | 命名空间 | 一行= | 职责与关键列（语义级） |
| --- | --- | --- | --- |
| `qed_knowledge_point`（第四张共享表，名待裁 D2） | `qed_*` 共享，结构根侧定义 | 一个**已确认**的知识点（领域→课程→知识点第三层主数据） | `kp_id`（PK，服务端生成稳定键）；坐标 `domain_ref`/`course_ref`（→`qed_domain`/`qed_course`，ref+label 快照）；`name`（canonical 展示名）；`norm_key`（**去重键**，由 name 规范化生成，与 `course_ref` 组成唯一键——见 K/R 判定表 R3）；`type` 四分类闭集 `memory`/`procedure`/`concept`/`design`（沿用主链 L1）；`order_hint`（课程内学习顺序，可空）；`summary`（限长一句话）；`anchors` JSON（来源锚点列表，见 K1）；`from_detail_id`（提升到本表时的来源明细，溯源）；`confirmed`（**只能人工勾选**，机器永不写）；时间戳。**不存多条叙述正文、不存掌握态** |
| `qed_learn_kp_detail`（根私有，入 `qed_learn_*` 子族） | `qed_learn_*`，8901/8902 不读 | 一条**候选叙述/版本**（生成待选明细池） | `detail_id`（PK）；坐标同上（`domain_ref`/`course_ref`）+ 可空 `kp_ref`（未采纳前允许悬空候选）；`name`、`type`；`narrative`（正文，**同一知识点多条并存**）；`payload` JSON（定义/定理/证明思路/例题分栏，只存内容不含判分）；`anchors` JSON；`gen_batch`（一次生成＝一个版本组，含确定性种子 `map_seed`，见 K5）；`model_ref`（生成模型标识，不含密钥）；`gen_status` 闭集 `draft`/`candidate`/`adopted`/`rejected`；`dedup_of`（指向既有 canonical `kp_id`，供合并）；`confirmed`（人工位，置位才提升）；时间戳 |

- **三段关系澄清**（避免与主链三表抢语义）：`qed_learn_unit`＝课程内**学习块**（编译产物，
  私有）；`qed_knowledge_point`＝课程体系**知识点主数据**（共享，可被 8901/8902 读、被 M2/M3
  引用）；两者通过 unit 的可选 `kp_ref` 列逻辑关联（实施时定，不建跨命名空间外键）。
  掌握与判分一律挂 `qed_learn_unit_progress`（M-3）。
- **读写矩阵新增**（W3 登记面）：`qed_knowledge_point`＝8900 R/W（结构定义方），8901/8902
  R（+ W 口径见 D1）；`qed_learn_kp_detail`＝仅 8900 R/W。
- **晋升路径**：本表族定稿后按 M-1 判例进 `database-design.md`（表清单总览 + 读写矩阵 +
  「qed_* 共享表族要点」新增小节），**不新建 DDL 快照**（ADR 0017 事实源唯一铁律）。

## 端点面草案（设计级，暂不进 api-contracts）

| 端点 | 用途 | 备注 |
| --- | --- | --- |
| `GET /api/v1/learn/star-map?domain={id}` | 星图一次取全：领域 → track 簇 → 课程节点 + 先修边 | 数据源＝`qed_domain`/`qed_course`（既有），**不依赖新表**，可先于建表实施空态联调 |
| `GET /api/v1/learn/courses/{course_ref}/knowledge-points` | 某课程的已确认知识点列表 + 掌握摘要 | 依赖 `qed_knowledge_point`；未建表期 503 |
| `GET /api/v1/learn/knowledge-points?domain=&course=&type=&q=` | 跨课程检索（管理面/后续消费） | 分页 + 过滤 |
| `GET /api/v1/learn/kp-details?course_ref=&gen_status=&batch=` | 候选明细池浏览 | 依赖 detail 表 |
| `POST /api/v1/learn/kp-details/{detail_id}/confirm` | **人工确认并提升**到共享主表 | 重复 `norm_key` 返回 409（合并走 `dedup_of`） |
| `POST /api/v1/learn/kp-details/{detail_id}/reject` | 候选驳回 | 不落主表 |

- 错误码沿用 §⑥ 口径（404 未知资源 / 409 人工位与唯一键 / 422 参数 / 503 存储未接入）。
- **知识点生成类端点本轮不设计**（裁决 ④）；候选池只约定「谁能写、写进来长什么样」。
- 前缀归属（`/learn/*` 内 vs 新 `/knowledge/*` 域）＝待裁 D4。

## 星图 UI 设计（学习中心 · 知识梳理星图）

**形态**：银河/星光背景下的四级下钻——**领域（下拉）→ track 星云 → 课程有向图 → 知识点详情**。

1. **页面与路由**：现有 `#/knowledge`（标题「学习中心 · 知识结构浏览」原型）升级为
   「学习中心 · 知识梳理星图」；课程知识点页为路由级 `#/knowledge/c/{course_ref}`
   （URL 可直达、可分享），**右上角返回按钮**走 `navigate(-1)` 且提供「返回星图」兜底
   （直达 URL 无历史时回 `#/knowledge`）。
2. **左上领域下拉**：位于大标题**之下**，默认第一个领域（现状 `KNOWLEDGE_DOMAINS[0]` 判例），
   切换只重算星图不跳页。
3. **track 星云**：按 `qed_course.track` 聚类；簇的张角按成员数比例分配并留**最小占比保底**，
   主干方向（`classic_tracks.kind=main`）走内环、分支走外环，簇间留缝（K3）。簇标签＝方向名 +
   课程数。
4. **课程有向图**：簇内节点按**学习顺序**排布——`sort_order` 拓扑分层 + `prerequisites`
   先修→后修边（分层判例 `CourseGraph.tsx:21 layoutBubbles`，边路径判例同文件 `edgePath`）；
   **跨 track 边**只连簇质心（soft 线），同 track 边连节点（strong 线），避免跨簇 spaghetti（K4）。
5. **知识点详情页**：卡片列表（`type` 四分类徽章 + 掌握徽章 + 来源锚点数），支持展开候选明细
   抽屉看多条叙述与来源；无数据时沿用现有空态文案（「知识点结构等待解析产物管线就绪后填充」）。
   徽章文案必须自带口径（多口径各一词），不依赖脚注小字。
6. **布局与渲染分离**：`starmapLayout(graph) → {clusters, nodes, edges}` **纯函数**（确定性：
   同输入同坐标，含种子；vitest 断言坐标与簇划分），渲染层 `EChart` graph series
   （`layout:'none'` + `categories` 配色 + `edgeSymbol` 箭头 + `roam` 缩放 + `emphasis` 邻接高亮），
   需在 `web-ui/src/components/EChart.tsx` 按需补注册 `GraphChart`（现只注册 Bar/Pie）。
7. **背景层**：独立 CSS/canvas 装饰层（`prefers-reduced-motion` 下关闭动效；星点不接收指针事件），
   与图表层解耦；**不引入** framer-motion/three/cytoscape 等新依赖（裁决 ③；DeepTutor 的
   vendor thinking-orbs 只作视觉参考，不搬代码）。
8. **暗色承载**：星图页需暗底，与现 admin 浅色主题并存方式＝待裁 D5（推荐该页局部
   `ConfigProvider` 暗色，不动全局 token）。
9. **约束**：8903 只连 8900（ADR 0007）；子项目离线时星图走既有降级（`listCatalog`/
   `listCourseSystem` 空态），不得白屏。

## DeepTutor 借鉴判定表（2026-09-30，知识点建模与图可视化切片）

> 续主链 L/R 编号，本切片用 K/R 前缀区分。根目录相对 `D:\coding\demo_program\DeepTutor`。
> 与主链 L1~L9/R1（掌握、判分、复习、编译、本地模型）无重叠，那批判定不变。

| # | 机制 | 判定 | 依据（DeepTutor 证据） | 落点 |
| --- | --- | --- | --- | --- |
| K1 | `SourceAnchor(kind, kb_name, ref, snippet≤300)` 统一来源锚形状，附 `position`/`available`（降级不删） | **吸收** | `deeptutor/book/models.py:216-236,425` | 两表 `anchors` JSON |
| K2 | `covered` 只由学习者手点、绝不从掌握度推断，证据摆在勾选框旁 | **同构**（我们已有 covered 人工位铁律） | `deeptutor/services/courses.py:83-102` | 主表 `confirmed` 人工位 |
| K3 | 自研 SVG 聚类图：同心环 + 扇区，簇张角按成员数比例 + 最小占比保底、clusterGap 留缝、组内摆放 | **吸收为纯函数** | `web/lib/memory-graph.ts:299-567`（`:421-434` 角度分配） | `starmapLayout` |
| K4 | 跨层边分 `strong`（连具体节点）/`soft`（只连簇质心） | **吸收** | `web/lib/memory-graph.ts:71-77` | 跨 track 边视觉 |
| K5 | `map_seed` 持久化使同一主题每次画出同一张图 | **吸收（前端确定性种子）** | `deeptutor/learning/models.py:352`、`storage.py:442,978` | 布局可断言、观感稳定 |
| K6 | 概念图渲染零 LLM：结构化 → Mermaid；删节点后确定性剪枝悬空边 | **移植思想**（我们零图渲染库，剪枝在纯函数做） | `book/blocks/concept_graph.py:39-80`、`book/engine.py:142-167` | 边剪枝归 `starmapLayout` |
| R2 | 整学习状态塞单 JSON 列 + revision CAS 存储 | **拒绝** | `learning/storage.py:377-384` | 共享表需行级可 JOIN 可查 |
| R3 | 知识点内嵌 module JSON、**无唯一键**、跨课程零复用（ID 由生成序或 uuid，注释称 position 非 identity） | **拒绝并反向自加** | `learning/models.py:80-104`、`topic_generation.py:287-294,402-413` | `norm_key` + `(course_ref, norm_key)` 唯一键 |
| R4 | 生成走 draft→critique→revise 三趟 LLM + RAG grounding（llama-index/faiss）；截断预算 ≤16 源/单源 4000 字 | **拒绝（本轮）** | `book/prompts/zh/spine_synthesizer.yaml`、`learning/topic_generation.py:59-83,144-238` | 违背离线优先与裁决 ④；预算口径可在 M-2 复用 |
| R5 | `cytoscape@^3.33.1`（依赖里但源码零引用）、mermaid、chart.js | **拒绝** | `web/package.json:39` 等 | echarts 已够（裁决 ③） |

## 工作项（滚动登记表）

| 条目 | 内容（根因一句话 + 落点） | 状态与证据 |
| --- | --- | --- |
| W1 | 设计草案成文：两表契约 + 端点面 + 星图 UI + DeepTutor 借鉴判定表。落点＝本壳 | 已落地 2026-09-30（用户四项裁决 ①~⑤ 落档；事实核对：`qed_course.track` 与 `classic_tracks` 存在且已透前端） |
| W2 | 待裁项定谳 D1~D5（见下节） | 待用户 |
| W3 | 表契约冻结并进 `database-design.md` 四处（表清单总览、库与命名空间、读写矩阵、共享表族要点新小节）；architecture/ 面改动按 M-1 判例经用户裁决执行方式 | 待开始（前置 W2） |
| W4 | REST 契约冻结 + `api-contracts.md` §⑥ 扩表 + 契约测试先行（端点/错误码清单） | 待开始（前置 W3） |
| W5 | 8900 实施：两表幂等建表（`services/learn/base.py` 补块或新表模块）+ 六个端点 + 星图数据聚合；生产库 DDL 执行属 D 类操作转人工 | 待开始（前置 W4 + M-1 存储接入 + 排期确认） |
| W6 | 8903 实施：`starmapLayout` 纯函数 + vitest、`EChart` 按需注册 `GraphChart`、星图页与知识点详情页、领域下拉与返回按钮、背景层 | 待开始（前置 W4；星图骨架可先于建表用 `star-map` 数据走查，知识点层空态） |
| W7 | 晋升设计文档：星图 UI 面按 ADR 0011 晋升 `design/learning-starmap-ui.md`；两表与端点语义与主链「契约稿暂不晋升」议题（0929 裁决 ⑤）合并择时 | 待裁决时机（判据＝W5/W6 落地收口） |

## 待裁决清单（2026-09-30）

| # | 待裁项 | 我的推荐 | 影响 |
| --- | --- | --- | --- |
| D1 | 共享知识点表的**写权限矩阵**：裁决 ① 定为「三项目读写」，但 8901/8902 真要写需各自代码改动（本轮按裁决 ④ 不发请求） | 结构上开「三项目可写」口径（同 `qed_llm_calls`），**当前写者只有 8900**，子项目写入待其各自立项 | 读写矩阵一行措辞 + 是否要向 ARCH-024/025 线预埋指针 |
| D2 | 表名：`qed_knowledge_point`（共享）与 `qed_learn_kp_detail`（私有） | 采用该名；`qed_knowledge_point` 与既有 `qt_knowledge`（教程资料归类）语义不同，须在文档里显式避让说明 | 一旦登记改代价高 |
| D3 | `norm_key` 规范化口径（全角/半角、空白、大小写、别名表来源） | 先窄：去空白 + 全角转半角 + 小写；别名表复用 `qed_course.aliases` 思路后置 | 决定去重与合并行为 |
| D4 | 端点前缀：`/api/v1/learn/*` 内 vs 新 `/api/v1/knowledge/*` | 留在 `learn/*`（与 §⑥ 同族、鉴权与降级口径复用），知识点检索面用子路径 | api-contracts 分节与 code-map 归属 |
| D5 | 星图页暗色承载方式 | 该页局部 `ConfigProvider` 暗色，不动全局 token 与 admin 浅色 | 视觉规范与 frontend-architecture 是否需补节 |
| D6 | 是否为本模块新立 ADR（共享表结构由根定义的所有权例外） | 不新立（判例：`qed_learn_*` 方案② 未立 ADR，只在 database-design 登记） | 少一份 ADR；如你要求成文化则走 ADR |

## 过程与证据（滚动）

> 本节是本壳执行与取证的正本（[ADR 0023](../adr/0023-todo-row-carries-scope-and-criteria.md)
> 决定 5）；台账行只承载任务描述与固定成功标准，进展与裁决记录不写回 todo。

| 日期 | 条目 | 过程与证据 |
| --- | --- | --- |
| 2026-09-30 | 立项（用户发令） | 发令内容＝qed 类数据库新增第四张共享表（知识点）+ 一张根私有 detail 表，补齐「领域 → 课程 → 知识点」三层并设计学习中心星图；交付范围经裁决 ④ 收窄为「只出设计与空态，不动代码、不发跨项目请求」。 |
| 2026-09-30 | W1 设计草案成文 | 六项裁决（①~⑤ + 编号②两表语义分工）逐条落「裁决登记」节；事实核对＝`qed_course.track` 与 `qed_domain.classic_tracks` 存在且已透前端（`QED-Tracker/docs/architecture/database-shared-tables.md:72,94,158,193,218`、`web-ui/src/api/tracker.ts:49,104,119,335`，子仓库侧只读核对）；表契约草案 + 端点面草案（六个端点）+ 星图 UI 设计九条 + DeepTutor 借鉴判定表（K1~K6 吸收/移植、R2~R5 拒绝，逐条给证据路径）；主链壳「知识图谱暂不做」非目标按裁决 ⑤ 窄化为 GraphRAG 挖掘并加指针。 |
| 2026-09-30 | W2 待裁清单 | D1~D6 成文并附推荐与影响面，待用户逐项批复；批复前不动代码、不动 `architecture/`（行 S4/S5 的前置）。 |
| 2026-09-30 | 行形态迁移（ADR 0023 批次） | 本壳「目标与成功标准」判据表改指针（判据正文移入 ARCH-027-M5 台账行 `成功标准` 列，迁移时新增行 S5＝待裁清单逐项批复）；按新计划契约补本节。纯文档改动，无代码与表变更。 |

## 验证与验收

- 本壳交付（W1）验收＝用户审理裁决清单 D1~D6 并逐项批复；批复前不动代码、不动 architecture/。
- W3 之后每次文档改动跑契约门禁（QED_env 解释器，串行）：`tests/contract/` 全量 +
  受影响定向（`tests/test_learn.py`、`tests/test_api.py`、`tests/test_tracker_client.py`）。
- W5 表与端点：契约测试先行（先红后绿），默认测试不写运行库、只用临时目录（隔离铁律）。
- W6 界面：web 门禁（`tsc -b` + vitest + build）+ `qed-frontend-check` 真实浏览器走查
  （星图渲染、领域切换、进入课程、返回按钮、空态与离线降级各一遍）。

## 回滚

- 纯文档改动按文件还原；本壳未落地任何代码与表，无数据回滚面。
- 契约冻结后如需推翻，按主链判例「先改壳内设计稿与裁决登记，再改 architecture/ 与代码」，
  已建表列变更走幂等补列清单，不删列。

## 关闭与归档

关闭条件＝W1~W7 全部达成（设计定稿 + 文档登记 + 8900/8903 落地并通过各自门禁），由用户裁决收口；
本壳 Retain 归档 `history/plans/<year-month>/`（设计稿与 DeepTutor 判定表为长期证据），
todo 移除 ARCH-027-M5 行，并在主链壳「模块壳一览」随步标注 M5 已收口。
