# 学习设计轮 M5·知识点体系与知识梳理星图（knowledge-point-star-map）

状态：Completed
任务类型：B
最后更新：2026-10-01
关联 ADR：无新增（沿用 [ADR 0016](../../../adr/0016-todo-registration-one-task-one-plan.md) 一任务一行一壳；
共享表族约定见 [ADR 0009](../../../history/adr/v0.1/0009-shared-qed-tables.md)，所有权例外判例
`qed_llm_calls` 与 `qed_learn_*`——是否为此再立 ADR 属待裁项 D1）
关联设计：[database-design.md](../../../architecture/database-design.md)（qed_* 共享表族与学习表族节，
第四张共享表登记去处）、[api-contracts.md](../../../architecture/api-contracts.md) §⑥（学习域端点契约）、
[frontend-architecture.md](../../../architecture/frontend-architecture.md)（8903 视觉与服务架构）、
[learning-star-map.md](learning-star-map.md)（星图 UI 面已于 2026-09-30 晋升的事实源）
关联 Tracker：docs/trackers/todo.md（ARCH-027-M5 任务行；主链与 M1~M4 见
[学习设计轮主链壳](../../../plans/2026-09-22-learning-design-mainline.md)）
归档判定：Retain（设计稿 + 裁决过程 + DeepTutor 借鉴判定表为长期证据，收口时归档 history/plans/）

> 本壳是学习设计轮 **M5 模块**（知识点体系数据层 + 学习中心「知识梳理星图」导航层）的唯一固定
> 记录，2026-09-30 由用户发令立项：在qed类数据库设计中新增**第四张共享表 = 知识点表**与
> **一张 QED-Engine 私有表 = 知识点 detail 表**，把「领域 → 课程 → 知识点」三层体系补齐，
> 并据此设计学习中心星图界面。交付先按裁决 ④「只出设计与空态」，同日由裁决 ⑦ 放宽为
> **demo 先行实施**（建表 + 端点 + 界面，供用户审效果），契约冻结与收口仍待裁决 ①~⑦ 追认。

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
   [主链壳](../../../plans/2026-09-22-learning-design-mainline.md) 随步改写该非目标行并加指针。
6. **界面反馈轮（2026-09-30 用户四条 + 三项选择）**：demo 首版走查后用户裁定主流程界面按
   **「大气、简洁、可视化强」** 方向重做，四条为：①页面上能看图直接看出的东西不展示（「领域」
   字样标签、`4 条轨迹 · 12 门课程 · 已确认知识点 0` 统计行全部删除）；②图例与操作解释不写在界面上，
   **迁到使用手册**；③右上角固定 **使用手册 / 刷新 / 返回** 三枚按钮，文案精简达意即可；
   ④版式重排——轨迹不能挤在角落，**核心轨迹星云居中**、其余环绕，星云用**虚边框括起其下全部课程**，
   星云名要**大**（首版与背景同色、字号太小看不清），课程文字**放进框里**（框大无所谓，看清优先），
   星空要动但绘制从简。三项选择经问答定谳：星云几何＝**虚线圆角包围盒**、课程＝**发光小点 +
   带底框标签**、背景＝**继续纯 CSS 动效**（不引入图片资源、不加新依赖）。
7. **demo 先行实施（2026-09-30 用户发令，原话）**：「可以先按照
   `docs/plans/2026-09-30-knowledge-point-star-map.md` 初步建立一个 demo，建立表和学习中心界面，
   我审核下效果……我确认好方向后再深入推进」。据此 W5/W6 的表、端点与界面以 **demo 形态**先落地
   （走各自门禁 + 浏览器走查），但**契约冻结（W3/W4）与收口（W7）仍未启动**：D1~D6 未批复，
   demo 实现按我的推荐口径落地并标「待追认」，`architecture/` 契约面未替本模块认领承诺。
8. **星图版式二轮（2026-09-30 用户审阅四条 + 问答四项拍板，含对裁决 ⑥ 的三处改判）**：用户审阅
   原话＝「①没有背景星图（我需要贴一张星空的图像）；②如果连线效果不好不要瞎连线，连线的位置都不对，
   需要对准课程框进行连接，我们可以取消点，只连接课程的框，按照框进行连线；③学习方向虚框鼠标放上去
   不需要效果，只有放在课程上才需要效果；④连线最好是按照从基础到深度从上到下的方式，例如数学（高等
   数学）最基础是数学分析、高等代数、概率论与数理统计三门课，这三门应该是对齐的一排，然后从上往下的
   树（森林）的『星图』」。四项问答拍板：
   - **背景改用真实星空图像**（**改判 ⑥ 的「继续纯 CSS 动效、不引图片资源」**）；图像文件**由用户提供**
     （agent 不自行生成），落点 `web-ui/public/`，CSS 星点动效层保留在其上作呼吸层。
   - **版式＝「层＝行 × 轨迹＝列」的自上而下森林**（**改判 ⑥ 的「核心居中、其余沿椭圆环绕」**）；
     核心列居中、次要轨左右交替环绕。
   - **取消课程圆点，节点本体＝课程框**，连线一律对准框（父框底边→子框顶边），同轨实线、跨轨虚线，
     **星云之间不再画软链**。
   - **星云虚框 hover 无任何效果**，只有课程框响应悬停。
   事实支撑（本轮实测 `GET 8900/api/v1/learn/star-map`）：领域「数学（高等数学）」12 门课程、
   **12 条先修边**（7 条跨轨）、`sort_order` **全为 NULL**（旧版式无排序信号），但 `stage` 有真实三档
   且值域＝`qed_domain.stages`（基础/主干/分支/前沿，见 database-design.md:145）；其中「基础」恰为
   数学分析 / 高等代数 / 概率论与数理统计三门、分属三条轨迹——与用户举的对齐一排的例子完全一致。
9. **D1~D6 批复定谳 + 整行关闭（2026-10-01 用户发令，原话）**：「我批复 D1~D6，再整行关闭、
   不留尾，现在开始第 4 项和第 7 项」。六项**全部按本壳「待裁决清单」推荐口径采纳**（逐项
   结果见该节批复登记）；裁决 ⑦ 留下的「契约冻结（W3/W4）与收口（W7）未启动」状态自此解除，
   两表与端点契约转**正式冻结**，`design/learning-star-map.md` 转**已确认**。残余「知识点内容由
   谁写入候选池」按「范围与非目标」口径**移交主链 M-2 编译线与 M2 出题线**，本行不留待做项。

## 目标与成功标准

**目标**：让「领域 → 课程 → 知识点」三层体系在**共享数据面成立**（第三层从当前的无表可存
变为两表可存：候选明细 + 已确认主数据），并让学习中心首页从当前的「stage 分层泡泡图原型」
演进为**按学习方向（track）聚类、按学习顺序成图、可下钻到知识点掌握详情**的星图导航层。

**成功标准**：正本在台账行 [todo.md](../../../trackers/todo.md)「学习设计轮（第五轮：ARCH-027 主链
路径 + M1~M5 五模块）」节的 ARCH-027-M5 行 `成功标准` 列（S1 两表契约成文且与既有裁决不冲突／
S2 星图数据形状与端点面成文／S3 星图 UI 设计可实施／S4 本轮只出设计与空态不动码／
S5 待裁清单 D1~D6 逐项有用户裁决记录），本壳不复制判据条目（ADR 0023 [链接](../../../adr/0023-todo-row-carries-scope-and-criteria.md)）。各判据的验收手段见「验证与验收」节，判据正文所在的设计节
＝表契约草案（S1）、端点面草案（S2）、星图 UI 设计 + 借鉴判定表（S3）、工作项登记表（S4/S5）。

**S4 判据经上位裁决改判**：原口径「本轮只出设计与空态，`backend/` 与 `web-ui/src/` 无本任务
改动」由 2026-09-30 **裁决 ⑦**（demo 先行实施）取代，2026-10-01 批复随 D1~D6 一并追认；台账行
判据正文按 ADR 0023「写定不改」保持原样，收口在 completed.md 证据列与下方过程与证据行按
**改判后口径核销**，不据此记 Partial。

## 范围与非目标

**范围**：M5 的两表**设计契约**、星图与知识点详情页的 **UI 设计**、`#/knowledge` 现状原型
（[Knowledge.tsx](../../../../web-ui/src/pages/Knowledge.tsx) + CourseGraph.tsx（旧 stage 分层泡泡原型，2026-10-01 星图落地后判死原型删除））
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
   [database-design.md](../../../architecture/database-design.md) 学习表族节），M5 端点实施排在
   M-1 存储接入之后，或与本模块同批接入——**D1 批复定谳（2026-10-01）**：不等待，两表由首个
   知识点端点请求懒建挂载（判例 `qed_llm_calls`）。
4. 实施排期逐条经用户确认（本壳只立项与设计）。

## 表契约草案（两表，一行=语义；DDL 实施时定）

> 原则承接主链 0928「公共表已有的不重复」：领域/课程坐标只存 `ref_id` + `label` 快照；
> 新增的只有**第三层知识点**，且按裁决 ② 分「候选明细」与「已确认主数据」两张。

| 表 | 命名空间 | 一行= | 职责与关键列（语义级） |
| --- | --- | --- | --- |
| `qed_knowledge_point`（第四张共享表，**D2 批复定名**） | `qed_*` 共享，结构根侧定义 | 一个**已确认**的知识点（领域→课程→知识点第三层主数据） | `kp_id`（PK，服务端生成稳定键）；坐标 `domain_ref`/`course_ref`（→`qed_domain`/`qed_course`，ref+label 快照）；`name`（canonical 展示名）；`norm_key`（**去重键**，由 name 规范化生成，与 `course_ref` 组成唯一键——见 K/R 判定表 R3）；`type` 四分类闭集 `memory`/`procedure`/`concept`/`design`（沿用主链 L1）；`order_hint`（课程内学习顺序，可空）；`summary`（限长一句话）；`anchors` JSON（来源锚点列表，见 K1）；`from_detail_id`（提升到本表时的来源明细，溯源）；`confirmed`（**只能人工勾选**，机器永不写）；时间戳。**不存多条叙述正文、不存掌握态** |
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
- 前缀归属（`/learn/*` 内 vs 新 `/knowledge/*` 域）＝**D4 批复定谳**：留在 `/api/v1/learn/*` 同族，
  知识点检索面用子路径（鉴权与降级口径复用 §⑥）。

## 星图 UI 设计（学习中心 · 知识梳理星图）

> **本节已于 2026-09-30 晋升为 [design/learning-star-map.md](learning-star-map.md)**，设计态正文以该档为准；本节保留为裁决与演进过程的原始记录（W10）。

**形态**：**星空图像底 + 银河辉光与 CSS 星点动效层**之上的四级下钻——**领域（下拉）→ 轨迹列（星云
虚框）→ 课程森林（层级行 × 轨迹列，先修框间连线）→ 知识点详情**。
2026-09-30 两轮界面反馈按裁决 ⑥/⑧ 重排，本节正文即二轮后的口径（首版扇区环布局、页面内图例句、
「核心居中＋椭圆环绕」与「课程圆点」同时废止）。

1. **页面信息面（只留星图）**：左上大标题「学习中心 · 知识梳理星图」+ 其下领域切换器 + 星图本体。
   **不展示**任何能从图上直接看出的东西：「领域」字样标签、轨迹数 / 课程数 / 已确认知识点数统计行、
   页面内图例说明行全部删除（计数只在 hover 提示与课程知识点页出现）。
2. **右上角三枚按钮**：`使用手册` / `刷新` / `返回`（不带「星图」「主界面」后缀）——使用手册打开
   `HELP_SECTIONS` 手册弹窗（星图节列于第二节，打开即可见，不需锚点跳转），刷新重取 `star-map`，
   返回回 `#/`。手册弹窗与首页共用
   `components/HelpModal.tsx`，并渲染在星图页局部暗色 `ConfigProvider` **之外**（走浅色主题，
   正文黑字保证阅读对比）。
3. **图例与操作解释归使用手册**：`web-ui/src/help/sections.ts`「知识梳理星图」一节承载二轮读图口径
   ——竖虚线列框＝学习轨迹、框内矩形＝课程、自上而下行＝层级（基础→主干→分支→前沿）、实线＝同轨
   先修、虚线＝跨轨先修、点击课程进知识点梳理、滚轮缩放与拖拽平移；界面本体零解释文字。
4. **坐标系随容器算 + 套满系数预乘**：布局纯函数接收真实容器宽高（`ResizeObserver` 供给，只接受
   ≥480×360 的实测值，否则用 `STARMAP_VIEW` 缺省），图高按视口铺满；不再固定 1000×760，避免固定
   坐标被等比缩放后把星点挤在角落。**ECharts graph（`layout:'none'`）会等比把「成员点包围盒」铺满
   series 矩形，而符号尺寸（虚线框宽高）按 px 原样绘制**——布局侧因此先把该系数**预乘**进坐标与包围盒
   尺寸，并回传与之配对的 series 四边留白（`chartMarginX/Y`），使渲染侧系数恰为 1；否则点距被放大而
   框不变，课程会掉出星云框。盒的整体跨度另按画布 0.96 封顶，`VIEW_MARGIN=100`（≥ 单元半宽 + 内边距）
   保证放大后虚线框不被裁切。渲染组件在容器尺寸变化后**重放 option**（系数在 init 时算定，只 `resize()`
   会停在旧取景——容器从 0 长起来时表现为图挤在一角）。
5. **层＝行 × 轨迹＝列（自上而下森林，裁决 ⑧）**：**行＝层级 tier**，`tier = max(stage 档序, 先修拓扑
   深度)`——stage 档序取 `qed_domain.stages` 的值序（基础 0 / 主干 1 / 分支 2 / 前沿 3，未知值退回拓扑
   深度），拓扑深度由 `prerequisites` 逐层求出（成环不断链）；**同 tier 的课程共用一条 y**，因此「基础」
   三门（数学分析 / 高等代数 / 概率论与数理统计）天然对齐成一排、跨轨也对齐。**列＝学习轨迹**：列序按
   主次排（`kind=main` 优先 → 课程数降序 → `track` 字典序），**核心列居中、次要列按主次左右交替环绕**；
   列宽＝该轨最宽一行所需（同 tier 多门时并排占位），列间留 `NEBULA_GAP`。旧的「椭圆环绕 + 整圈同倍率
   外扩」与「扇区占比」全部废止（K3「小簇不被挤没」的意图改由列宽自适应保证）。
6. **星云＝竖长虚线列框 + 大字名 + 不响应悬停**：按本轨全部课程框的包围盒 + 内边距推 `x/y/w/h`（列框
   必然纵向长），graph 节点 `symbol:'roundRect'` 画**透明填充 + 同轨色 dashed 描边**；轨迹名 26/22px、
   粗体、亮白 + 深色文字描边，写在列框顶部标题带。**列框 hover 无任何效果**（裁决 ⑧④）：列框节点
   `emphasis:{disabled:true}`、tooltip 对 `nebula:` 前缀返回空、series 侧 `focus:'none'` 取消邻接淡出。
7. **课程＝矩形框本体（取消圆点）**：节点 `symbol:'roundRect'`，尺寸＝按课名估宽（CJK 按字号满宽计）×
   框高，**不透明**深底 + 同轨色描边 + 圆角，字号 ≥15px、框宽随文字自适应（宁可框大，不可字糊）；
   知识点计数**不进图**（只在 hover 提示与课程知识点页出现）。
8. **连线只连课程框、方向由上下行表达**：因 `tier` 严格递增，中心连线必然下行，端点语义即**父框底边 →
   子框顶边**；ECharts 的 link 端点在节点中心，课程框填充**不透明**且绘制在 link 之上，故**可见段恰好落在
   框边**——框底若半透明，线会穿框而过，这正是本轮「连线位置都不对」的根因。**同轨实线、跨轨虚线**；
   **不再画星云之间的软链**（`crossLinks` 语义取消）；**不放箭头**（上下即先后）。
9. **知识点详情页**：卡片列表（`type` 四分类徽章 + 掌握徽章 + 来源锚点数），支持展开候选明细
   抽屉看多条叙述与来源；无数据时沿用现有空态文案。徽章文案必须自带口径（多口径各一词），
   不依赖脚注小字。
10. **布局与渲染分离**：`starMapLayout(domain, edges, view) → {scale, chartMarginX, chartMarginY,
    trackOrder, tiers, nebulae, nodes(含 w/h/tier/slot), links(含 cross)}` **纯函数**（确定性：同输入同
    坐标；vitest 断言同 tier 共用一条 y、基础排对齐、列框包住本轨全部课程框、列间不压叠、连线必然下行、
    套满系数为 1 且整体落画布内），渲染层 `EChart` graph series（`layout:'none'` + `roam` 缩放，
    `focus:'none'` 只课程框高亮），`GraphChart` 按需注册；渲染层只做「按布局数据画图 + 用配对留白」，
    不含任何几何决策。
11. **背景层＝星空图像 + CSS 动效层**（裁决 ⑧ 改判 ⑥/③ 的「不引图片资源」）：用户提供的星空图放
    `web-ui/public/`（随 vite 构建拷进 `dist/`，不引 npm 依赖），作 `.kn-galaxy` 最底一层
    `background-image`；其上仍保留三团渐变辉光与双层 CSS 星点（细密漂移 + 亮星呼吸），
    `prefers-reduced-motion` 下关动效、星点层不接收指针事件；图片文件缺位时只显渐变层，不报错。
12. **暗色承载**：星图页局部 `ConfigProvider` 暗色，不动全局 token 与 admin 浅色——**D5 批复定谳**，
    例外口径已同步 [frontend-architecture.md](../../../architecture/frontend-architecture.md) 配色守则
    「暗色承载例外」条（例外只此一处，扩面须重新裁决）。
13. **约束**：8903 只连 8900（ADR 0007）；子项目离线时星图走既有降级（`listCatalog`/
    `listCourseSystem` 空态），不得白屏。

## DeepTutor 借鉴判定表（2026-09-30，知识点建模与图可视化切片）

> 续主链 L/R 编号，本切片用 K/R 前缀区分。根目录相对 `D:\coding\demo_program\DeepTutor`。
> 与主链 L1~L9/R1（掌握、判分、复习、编译、本地模型）无重叠，那批判定不变。

| # | 机制 | 判定 | 依据（DeepTutor 证据） | 落点 |
| --- | --- | --- | --- | --- |
| K1 | `SourceAnchor(kind, kb_name, ref, snippet≤300)` 统一来源锚形状，附 `position`/`available`（降级不删） | **吸收** | `deeptutor/book/models.py:216-236,425` | 两表 `anchors` JSON |
| K2 | `covered` 只由学习者手点、绝不从掌握度推断，证据摆在勾选框旁 | **同构**（我们已有 covered 人工位铁律） | `deeptutor/services/courses.py:83-102` | 主表 `confirmed` 人工位 |
| K3 | 自研 SVG 聚类图：同心环 + 扇区，簇张角按成员数比例 + 最小占比保底、clusterGap 留缝、组内摆放 | **改判为「层＝行 × 轨迹＝列」森林**（裁决 ⑧：同心环与扇区占比均废止；只保留「留缝」与「小簇不被挤没」两点意图） | `web/lib/memory-graph.ts:299-567`（`:421-434` 角度分配） | `starMapLayout` |
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
| W2 | 待裁项定谳 D1~D6（见下节） | **已定谳 2026-10-01**：六项全按推荐口径批复，逐项结果见「待裁决清单」节末批复登记 |
| W3 | 表契约冻结并进 `database-design.md` 四处（表清单总览、库与命名空间、读写矩阵、共享表族要点新小节）；architecture/ 面改动按 M-1 判例经用户裁决执行方式 | **已落地（工作区）**：表清单总览两行、读写矩阵两行、`qed_* 共享表族要点` 新增 `qed_knowledge_point` 小节、学习表族分工第四张——四处齐；D1~D6 批复后转正式冻结并补 D2 命名避让说明。提交时机随 `docs/architecture/` 共享文件批 |
| W4 | REST 契约冻结 + `api-contracts.md` §⑥ 扩表 + 契约测试先行（端点/错误码清单） | **已落地（工作区）**：§⑥ 标题与引言含 M5 知识点体系、端点清单七行、`tests/contract/test_api_endpoint_inventory.py` 域白名单加 ⑥、契约测试先红后绿；D4 批复定端点留 `/learn/*` 同族。提交时机同上 |
| W5 | 8900 实施：两表幂等建表（`services/learn/base.py` 补块或新表模块）+ 六个端点 + 星图数据聚合；生产库 DDL 执行属 D 类操作转人工 | **已落地并追认（2026-10-01 批复）**：两表幂等建表 + 七端点通（开发库 `qed_test`，MySQL 与内存双实现）；**生产库 DDL 属 D 类操作转人工**，未执行＝发布红线，随发布批次由用户执行 |
| W6 | 8903 实施：`starmapLayout` 纯函数 + vitest、`EChart` 按需注册 `GraphChart`、星图页与知识点详情页、领域下拉与返回按钮、背景层 | **已落地并追认（2026-10-01 批复）**：布局纯函数（16 项 vitest）+ 按需 `GraphChart` + 星图页与课程知识点页；三轮界面反馈（W8/W9）逐条落地，设计事实经 W10 晋升并已确认 |
| W7 | 晋升设计文档：星图 UI 面按 ADR 0011 晋升 design/（实落 `design/learning-star-map.md`）；两表与端点语义与主链「契约稿暂不晋升」议题（0929 裁决 ⑤）合并择时 | **UI 面已晋升 2026-09-30**（W10，`确认状态：暂定`）；两表与端点契约仍待 D1~D6 批复 |
| W8 | 界面反馈轮重做（裁决 ⑥）：页面信息面瘦身 + 右上角三按钮 + 图例迁 `HELP_SECTIONS` + 布局纯函数改「容器坐标系 / 套满系数预乘 / 核心居中环绕 / 虚线包围盒 / 带底框标签」。落点＝`starMapLayout.ts`、`StarMapGraph.tsx`、`EChart.tsx`、`components/HelpModal.tsx`、`pages/Knowledge.tsx`、`pages/Home.tsx`、`knowledge.css`、`help/sections.ts` | **已落地 2026-09-30**：本任务面门禁＝定向 vitest **22 绿**（`Knowledge`+`starMapLayout`+`Home` 三文件，`web-ui/` 内跑）+ 契约/web **95 绿** + 落地时点全量 `tsc -b` 清 / vitest 388 绿 / `npm run build` ✓；浏览器走查＝三按钮 DOM 文本、统计行与图例句已消失、canvas 1336×700 墨迹跨全部 10 列带、控制台仅一条来自取证脚本的 404、网络只 `GET 8900/api/v1/learn/star-map 200`。**当前全量 9 红 + tsc 2 错归并行「领域确认弹窗表单」轮 WIP，非本任务引入**（点名文件与复跑口径见「过程与证据」归因行）。**像素级视觉判定转用户自有浏览器**（内置视图 viewport=0×0 不能截图） |
| W9 | 星图版式二轮（裁决 ⑧）：布局纯函数重写为「层＝行 × 轨迹＝列」森林（tier=max(stage 档序, 先修深度)、核心列居中两侧交替）；课程节点改矩形框本体、连线改框间下行（同轨实线/跨轨虚线、取消圆点与星云软链）；列框取消悬停效果；星空图像背景层（用户提供文件入 `web-ui/public/`）。落点＝`starMapLayout.ts`、`StarMapGraph.tsx`、`knowledge.css`、`help/sections.ts` 及其测试 | **已落地 2026-09-30**：W9-1/W9-2 版式与连线（门禁与像素取证见「过程与证据」）+ W9-3 星空图背景层（用户图片 → `web-ui/public/starfield.jpg`，`knowledge.css` `.kn-galaxy` 最底层 + 50% 压暗层） |
| W10 | 星图 UI 设计晋升 `docs/design/learning-star-map.md`（ADR 0017 骨架 + 事实源唯一铁律：只写消费语义，端点/DDL 以指针代替复制）；落点＝新档 + `design/index.md` 新增「学习中心」组 + `tests/contract/test_design_documents.py` 白名单 | **已落地 2026-09-30**：新档十一节（定位与目标/范围与非目标/信息面/背景层/坐标系与套满系数/森林版式/图元/交互/课程知识点页/状态与降级矩阵/约束与维护），`确认状态：暂定` 待用户审阅；index 四组→五组；契约门禁 **82 绿** |
| W11 | 整行收口（2026-10-01 用户发令）：D1~D6 批复登记入壳并清除各节「待裁」措辞、S1~S5 逐条达成证据入「过程与证据」、`database-design.md` 三处定稿（含 D2 命名避让）、`frontend-architecture.md` 路由面与 D5 暗色例外同步、两档设计状态转 Implemented/已确认、todo 行移 completed、本壳 Retain 归档、主链壳与 project-status 随步 | **已执行 2026-10-01**：关闭结果 **Achieved**（S4 按裁决 ⑦ 改判后核销）；残余「知识点内容写入候选池」按非目标口径**移交主链 M-2 编译线 / M2 出题线**，本行不留待做项 |

## 待裁决清单（2026-09-30 提出，2026-10-01 全部批复定谳）

| # | 待裁项 | 我的推荐 | 影响 |
| --- | --- | --- | --- |
| D1 | 共享知识点表的**写权限矩阵**：裁决 ① 定为「三项目读写」，但 8901/8902 真要写需各自代码改动（本轮按裁决 ④ 不发请求） | 结构上开「三项目可写」口径（同 `qed_llm_calls`），**当前写者只有 8900**，子项目写入待其各自立项 | 读写矩阵一行措辞 + 是否要向 ARCH-024/025 线预埋指针 |
| D2 | 表名：`qed_knowledge_point`（共享）与 `qed_learn_kp_detail`（私有） | 采用该名；`qed_knowledge_point` 与既有 `qt_knowledge`（教程资料归类）语义不同，须在文档里显式避让说明 | 一旦登记改代价高 |
| D3 | `norm_key` 规范化口径（全角/半角、空白、大小写、别名表来源） | 先窄：去空白 + 全角转半角 + 小写；别名表复用 `qed_course.aliases` 思路后置 | 决定去重与合并行为 |
| D4 | 端点前缀：`/api/v1/learn/*` 内 vs 新 `/api/v1/knowledge/*` | 留在 `learn/*`（与 §⑥ 同族、鉴权与降级口径复用），知识点检索面用子路径 | api-contracts 分节与 code-map 归属 |
| D5 | 星图页暗色承载方式 | 该页局部 `ConfigProvider` 暗色，不动全局 token 与 admin 浅色 | 视觉规范与 frontend-architecture 是否需补节 |
| D6 | 是否为本模块新立 ADR（共享表结构由根定义的所有权例外） | 不新立（判例：`qed_learn_*` 方案② 未立 ADR，只在 database-design 登记） | 少一份 ADR；如你要求成文化则走 ADR |

**批复登记（2026-10-01，用户「我批复 D1~D6」＝六项全按推荐口径采纳）**：

- **D1** 结构上开「三项目可写」（同 `qed_llm_calls` 判例），**当前写者只有 8900**，8901/8902 写入待各自立项；读写矩阵行措辞已按此定稿（`database-design.md` 知识点行）。
- **D2** 定名 `qed_knowledge_point`（共享）/ `qed_learn_kp_detail`（根私有）；与既有 `qt_knowledge`（教程资料归类）的**语义避让说明**已写入 `database-design.md` 该表节。
- **D3** `norm_key` 采窄口径：去空白 + 全角转半角 + 小写；别名表（复用 `qed_course.aliases` 思路）后置，不在本轮实现。
- **D4** 端点留在 `/api/v1/learn/*` 同族，知识点检索面用子路径。
- **D5** 星图页局部 `ConfigProvider` 暗色，手册弹窗在 Provider 之外走浅色；例外只此一处。
- **D6** **不新立 ADR**，所有权例外在 `database-design.md` 登记成文即可。

## 过程与证据（滚动）

> 本节是本壳执行与取证的正本（[ADR 0023](../../../adr/0023-todo-row-carries-scope-and-criteria.md)
> 决定 5）；台账行只承载任务描述与固定成功标准，进展与裁决记录不写回 todo。

| 日期 | 条目 | 过程与证据 |
| --- | --- | --- |
| 2026-09-30 | 立项（用户发令） | 发令内容＝qed 类数据库新增第四张共享表（知识点）+ 一张根私有 detail 表，补齐「领域 → 课程 → 知识点」三层并设计学习中心星图；交付范围经裁决 ④ 收窄为「只出设计与空态，不动代码、不发跨项目请求」。 |
| 2026-09-30 | W1 设计草案成文 | 六项裁决（①~⑤ + 编号②两表语义分工）逐条落「裁决登记」节；事实核对＝`qed_course.track` 与 `qed_domain.classic_tracks` 存在且已透前端（`QED-Tracker/docs/architecture/database-shared-tables.md:72,94,158,193,218`、`web-ui/src/api/tracker.ts:49,104,119,335`，子仓库侧只读核对）；表契约草案 + 端点面草案（六个端点）+ 星图 UI 设计九条 + DeepTutor 借鉴判定表（K1~K6 吸收/移植、R2~R5 拒绝，逐条给证据路径）；主链壳「知识图谱暂不做」非目标按裁决 ⑤ 窄化为 GraphRAG 挖掘并加指针。 |
| 2026-09-30 | W2 待裁清单 | D1~D6 成文并附推荐与影响面，待用户逐项批复；批复前不动代码、不动 `architecture/`（行 S4/S5 的前置）。 |
| 2026-09-30 | 行形态迁移（ADR 0023 批次） | 本壳「目标与成功标准」判据表改指针（判据正文移入 ARCH-027-M5 台账行 `成功标准` 列，迁移时新增行 S5＝待裁清单逐项批复）；按新计划契约补本节。纯文档改动，无代码与表变更。 |
| 2026-09-30 | demo 先行实施（裁决 ⑦，W5/W6） | 按 TDD 先落契约测试再落地：`services/learn/knowledge.py` 两表 DDL（`qed_knowledge_point` 共享 + `qed_learn_kp_detail` 私有，MySQL + 内存双实现、`norm_key` 去重）+ 六端点（`star-map`/`knowledge-points`/`courses/{id}/knowledge-points`/`kp-details` GET·POST/`confirm`·`reject`）挂在 `/api/v1/learn/*`，数据源＝既有 `qed_domain.classic_tracks` 与 `qed_course.track`；契约登记进 `api-contracts.md` §⑥ 与 endpoint-registry、`code-map.md` 随步。8900 经 `POST /api/v1/self-restart` 重启后端到端通。**D1~D6 未批复**：实现按推荐口径落地并标待追认，`architecture/` 未替本模块认领超出 demo 的承诺。 |
| 2026-09-30 | W8 界面反馈轮（裁决 ⑥） | **信息面**：删「领域」字样标签、统计行与页面内图例句，右上角固定三按钮，图例口径写入 `help/sections.ts`「知识梳理星图」（第二节），手册弹窗抽为 `components/HelpModal.tsx` 与首页共用（首页原内联 Modal 退役）。**布局**：`starMapLayout` 改容器坐标系 + 椭圆环绕 + `ringDilate` 整圈外扩 + `fitToChart` 预乘套满系数与配对 `chartMarginX/Y`（`VIEW_MARGIN=100`、盒跨度 0.96 封顶）；旧的逐对互推与扇区占比方案删除。**渲染**：星云＝虚线 `roundRect` 包围盒 + 框内上沿大字描边标题（26/22px），课程＝发光小点 + 深底同轨色描边标签（15px）；`EChart` 尺寸变化后重放 option 修复「容器从 0 长起来时图挤一角」。**取证**：门禁用 QED_env 解释器跑契约/web（95 绿），web 门禁在 `web-ui/` 目录内跑 `tsc -b` + vitest 串行（落地时点全量 388 绿）+ build ✓；浏览器走查用 `evaluate_script` 读 DOM 文本与 canvas 墨迹包围盒（内置视图 viewport=0×0，无法截图/指针点击，故像素级审美判定移交用户在 `http://127.0.0.1:8903/#/knowledge` 自审）。demo 数据清理 SQL 已交用户。 |
| 2026-09-30 | W8 门禁复跑归因（两条，均非本任务缺陷） | ① **调用目录错误**：从仓库根 `npx vitest run src/pages/Home.test.tsx …` 会解析到项目外的 vitest（根无 `node_modules`，输出文件名带 `web-ui/` 前缀＝root 错位），项目 setup/jsdom 配置不生效 → 假红 4 枚（Home 全红）。已在 `web-ui/` 内按命令矩阵口径重跑，本任务三文件（`Knowledge.test.tsx`+`starMapLayout.test.ts`+`Home.test.tsx`）**22 绿**。② **并行会话 WIP**：全量此时 9 failed（3 文件）+ `tsc -b` 2 error，落点＝领域确认弹窗表单轮在途文件——未跟踪新文件 `components/DomainCard.test.tsx`、`components/DownloadsTree.domainForm.test.tsx`，已改动 `components/DomainConfirmModal.test.tsx`、`components/DownloadsTree.tsx`、`stores/downloads.ts`，与本任务面（`starMapLayout/StarMapGraph/EChart/Knowledge/Home/HelpModal/knowledge.css/help/sections`）零交集，按并发工作区守则**不修不提交他人 WIP**；连带 `npm run build`（=`tsc -b && vite build`）此刻被其 tsc 错误挡住，8903 上仍是本任务走查时构建的 dist 产物。 |
| 2026-09-30 | W9-1/W9-2 版式二轮落地（裁决 ⑧：森林版式 + 框间连线） | **布局**：`starMapLayout` 重写为「层＝行 × 轨迹＝列」——tier=max(stage 档序, 先修深度) 后有界松弛使每条边严格下行、稠密行号使行距恒等、行内按父辈重心定序、两遍重心排布、核心列居中其余左右交替（游标含 `COL_GAP`）、逐边弯曲度绕行（`CURVE_CANDIDATES` 采样挑不穿框者）；`fitToCanvas` 保留「预乘套满系数 + 配对 `chartMarginX/Y`」并把旧的 0.96 盒跨度换成按列框相对伸出量的封顶，导出 scale 先取整再套用（行距恰＝ROW_H×scale）。**渲染**：课程＝不透明 `roundRect` 框本体（`#0d1633`，去掉 0.96 透明度以免 shadow 透出）、连线锚框中心且画在框下层；列框＝虚线框 + 顶部名称带 + 逐项 `emphasis.disabled`；课程高亮态写在 series 级 `emphasis`（graph 符号的状态样式取自 series emphasis 模型，逐项写法靠继承同效）。**门禁**：`web-ui/` 内串行跑 vitest 全量 **42 文件 / 417 绿**（`starMapLayout` 16 + `StarMapGraph` 6 + `Knowledge` 12）、`npm run build`（含 `tsc -b`）✓ 产物已被 8903 托管；QED_env 解释器跑 `tests/contract` **82 绿** + `ruff` All checks passed。**取证**：`http://127.0.0.1:8903/?v=w9c#/knowledge` 容器撑到 1200×700 后读 canvas 像素——3 行课程（3/5/4 共 12 门）y≈195/340/483、4 列中心 x≈119/511/871/1080，用户举例的三门基础课（数学分析·高等代数·概率论与数理统计）确在同一排跨三列对齐；框内填充恰为 (13,22,51) 共 10041 px（不透明达标）；连线像素 3712 px 中落在任一课程框内的为 **0**（「连线对准课程框、不从框里穿过」成立）；控制台无消息，网络只有 8903 静态资源与 8900 `GET /api/v1/learn/star-map 200`。**悬停取证口径修正**：内置视图 viewport=0×0，合成 DOM 事件的 `offsetX` 恒为 0，zrender 由 `offsetX` 取 `zrX/zrY`（`zrender/lib/core/event.js:19`）→ 合成 hover/wheel/click 一律打在 (0,0)，上一轮「课程高亮无效」是取证假象而非缺陷；改用 echarts SSR（`tmp/w9_ssr_hover.mjs`，svg + `dispatchAction(highlight)`）证实高亮样式已解析生效：`.zr0-cls-3:hover { fill:#1c2c5c; stroke:#ffffff }`，列框因 `setAsHighDownDispatcher(el,false)`（`echarts/lib/util/states.js:581`）不派发悬停。**像素级审美判定仍移交用户自有浏览器**。 |
| 2026-09-30 | W9-3 星空图背景层 + W10 星图设计晋升 | **W9-3**：用户指定图片 `D:\My picture\喜欢的图绘\直播图2\id=44526375.jpg` → `web-ui/public/starfield.jpg`（2,644,886 B / 2460×1400；`public/` 为本轮新建目录，vite `publicDir` 缺省即拷进 `dist/`，不引 npm 依赖）；`knowledge.css` `.kn-galaxy` 背景层序改为「三档光晕 → `linear-gradient(rgba(4,8,22,.5))` 压暗层（保课程框与标题的可读对比）→ `url('/starfield.jpg') center / cover` → `#070b1c` 兜底」，图片缺位时只显渐变不白屏；CSS 双层星点动效与 `prefers-reduced-motion` 口径不变。**取证**：重建后 `dist/starfield.jpg` 就位；浏览器 `?v=w9d#/knowledge` 读 `getComputedStyle` → `backgroundImage` 含 `url("http://127.0.0.1:8903/starfield.jpg")`、`backgroundSize: "auto, auto, auto, auto, cover, auto"`；fetch 该资源 200 / 2,644,886 B，`Image` 解码 [2460,1400]；控制台无消息，网络仅两条 starfield 200，星图本体仍 3 行 12 门 + 连线在位（未做视觉截图验证，内置视图 viewport=0×0）。**W10**：新建 `docs/design/learning-star-map.md`（`设计状态：Accepted` / `实现状态：In Progress` / `确认状态：暂定`，ADR 0017 十一节骨架；§2 范围与非目标以指针代替端点表与 DDL，遵事实源唯一铁律；`关联代码` 只列 `web-ui/` 路径，不认领后端与 tests 的 DesignRef）；`design/index.md` 固定职责四组→五组（新增「学习中心」组 + 行）、「部分置空」说明改指本次晋升；`tests/contract/test_design_documents.py` 的 `CURRENT_DOCUMENTS` 白名单加行。**门禁**：QED_env 解释器跑 `tests/contract` **82 绿**（覆盖 design 头部元数据全集、code-map 关联代码/关联测试/关联 ADR 存在性、markdown 链接全仓扫）。 |
| 2026-10-01 | 收口（D1~D6 批复 + 整行关闭，Achieved） | **批复登记**：D1~D6 六项全部按本壳推荐口径采纳（见「待裁决清单」节批复登记与裁决登记 ⑨）。**S1 证据**＝两表契约在 `docs/architecture/database-design.md` 四处成文并与裁决 ①~⑤ 无冲突：表清单总览两行、读写矩阵两行（`qed_knowledge_point` 标 R 并注 D1「结构上开三项目可写、当前无写者」）、`### qed_knowledge_point` 节（含 D2 批复要求的**命名避让**说明：与 Tracker 私有 `qt_knowledge` 语义不同且无引用关系）＋ DDL 指针 `backend/qed_engine/services/learn/knowledge.py`，D6 批复＝所有权例外不新立 ADR、在该档登记成文即可。**S2 证据**＝星图数据形状与端点面成文于 `docs/architecture/api-contracts.md` §⑥（六端点）与 endpoint-registry，前端形状对齐 `web-ui/src/api/learn.ts`。**S3 证据**＝星图 UI 设计 13 条 + DeepTutor 判定表（K1~K6 / R2~R5）已按此落地并经 W8/W9 浏览器取证。**S4**＝按裁决 ⑦ 改判后核销（代码面已实现，非「只出设计与空态」，判据正文按 ADR 0023 不改）。**S5 证据**＝本壳批复登记 6 条 + 裁决登记 ⑨。**门禁**：QED_env 解释器 `tests/contract` **82 passed**、全量 `pytest` **641 passed**、`ruff check .` All checks passed；`web-ui/` 内 `tsc -b` 无错 + `vitest run` **42 文件 / 417 passed** + `npm run build` ✓（8903 托管的即此产物）。**收口文档动作**：`frontend-architecture.md` 路由与文案同步（第 4 项）＋ 暗色承载例外（D5）登记；`learning-star-map.md` 实现状态 Implemented、确认状态已确认，`design/index.md` 随步；本壳 mv 至 `history/plans/2026-10/` 并按 +2 层重算相对链接（含两处 `.tsx` 链接，由契约链接门禁 `test_markdown_links.py` 首轮 1 failed 捕出后修正，重跑 82 绿）、6 处入链更新；todo 移除 ARCH-027-M5 行、completed.md 新增 Achieved 行、`plans/index.md` 新建「已归档计划（2026-10）」节、主链壳模块行与 project-status 随步。**不留尾**：残余「知识点内容谁来写入候选池」以移交指针记于「关闭与归档」节，归主链 M-2 编译线与 M2 出题线；生产库 DDL 属 D 类转人工；提交锚点待补登。会话脚本（`tmp/closeout_*.py`、`tmp/relink_*.py`）已清理（第 7 项）。 |
| 2026-10-01 | 收口后清理（用户确认两项） | **① 死原型删除**：`web-ui/src/components/CourseGraph.tsx`（旧 stage 分层泡泡图）＋ `web-ui/src/stores/knowledge.ts` ＋ `web-ui/src/stores/knowledge.test.ts` 三文件删除（先 `rg` 全库确认除三者互引外无引用方、`code-map.md` 未登记，故无映射同步面）；`stores/courseMeta.ts` 两处指向已删组件的注释先改述为现状，随后按用户确认**一并删除**（`rg` 复核：删掉三文件后该文件无任何引用方，含 `courseOrderCmp`/`stageKey`/`STAGE_*` 全部导出），其唯一文档引用 `docs/design/downloads-ui.md` 关联代码行同步去引用（该文件属并行轮在途面，只删这一个路径条目、不动其正文）；本壳「范围与非目标」节对 CourseGraph.tsx 的链接改为纯文本注记（链接门禁全仓扫 history/，删文件即断链）。**② demo 数据清理**：`qed_test` 两表按精确主键删除 `qed_learn_kp_detail.detail_id=kpd-921a07579a28` 与 `qed_knowledge_point.kp_id=kp-20af971b3c28`（删前只读盘点确认两表**各仅此 1 行**，删除即清空 demo 面；行内容先 dump 到 `tmp/m5_demo_rows_backup.json` 留可恢复证据）；删除后计数 detail=0 / kp=0。**门禁**：`tsc -b` 无错、`vitest run` **41 文件 / 409 passed**（较删前 42/417 少 1 文件 8 测试，恰为被删的 `knowledge.test.ts`）、`npm run build` ✓（`dist/index.html` 时间戳随步）；QED_env 解释器 `tests/contract` **82 passed** + `ruff` All checks passed。**浏览器复验**（8903 走查）：`#/knowledge` 星图渲染在位（容器 1200×700 后 canvas 墨迹 386,591 px、包围盒 x 6→1096 / y 105→556，节点与连线未受影响）；`#/knowledge/c/real_analysis` 空态正确（《实变函数》知识点梳理／轨迹：分析学／已确认 0 · 待选 0，错误横幅随 503 消失）；控制台无消息，网络只有 8903 静态资源与 8900 `star-map`·`kp-details`·`courses/{id}/knowledge-points` 全 200，无 8901/8902 直连（ADR 0007）。**过程记录**：首两次浏览器取证见 `GET /kp-details` **503**（知识点存储懒挂载每进程只试一次，该进程首次请求时建表未成）——清理后同端点回 200，属进程态而非契约缺陷，复现口径见「遗留与移交」。 |
## 验证与验收

- 本壳交付（W1）验收＝用户审理裁决清单 D1~D6 并逐项批复；批复前不动代码、不动 architecture/。**（2026-10-01 已逐项批复，本条核销；demo 先行的代码面由裁决 ⑦ 授权）**
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

**2026-10-01 按用户发令「再整行关闭、不留尾」收口，关闭结果 Achieved**：W1~W11 全部达成（设计定稿 + 两表/端点契约正式冻结登记 + 8900/8903 落地并过各自门禁 + 设计晋升并确认），
S1~S5 逐条达成证据见「过程与证据」2026-10-01 行，S4 按裁决 ⑦ 改判后核销（判据正文不改）。
本壳 **Retain** 归档 `history/plans/2026-10/`（设计稿、裁决登记 ①~⑨ 与 DeepTutor 判定表为长期
证据）；todo 移除 ARCH-027-M5 行并写入 completed.md；主链壳「模块壳一览」与 project-status 随步
标注 M5 已收口。**不留尾**：「知识点内容谁来写入候选池」属本壳非目标（依赖 M-2 编译线与 M2
出题线），以移交指针形式记于此，不开新行；生产库 DDL 与提交锚点为转人工/待补登项。
