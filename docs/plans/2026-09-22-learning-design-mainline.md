# 学习设计轮·主链路（课程注册·链路编译·判分推进）（learning-design-mainline）

状态：In Progress
任务类型：B
最后更新：2026-10-25
关联 ADR：[ADR 0026](../adr/0026-v1-root-table-family-freeze.md)（2026-10-21 改判：本链第二环「链路编译」
整链退役，见「目标」节注记）、[ADR 0016](../adr/0016-todo-registration-one-task-one-plan.md)
（一任务一行一壳；重划分本身为台账裁决，无新增决策）
关联设计：[api-contracts.md](../architecture/api-contracts.md)（学习域契约承接位）、
[frontend-architecture.md](../architecture/frontend-architecture.md)（消费面指针；界面实施原归 M1 壳，M1 已收口归档后
的管理台梳理屏面归 REQ-141、版式面归 REQ-140）
关联 Tracker：docs/trackers/todo.md（ARCH-027 任务行＝主链路主任务；模块支线行 ARCH-027-M1~M6 各配固定壳，
M1／M2／M5／M6 已收口归档；2026-10-24 起本轮收口顺序的四段承载行＝**① REQ-141 知识点梳理屏 → ② 本行
M-1／M-3 剩余腿（课程学习）→ ③ REQ-130 课后练习 → ④ ARCH-027-M4 知识探索链路复核**，梳理段的相邻行＝
REQ-138（核查正本与判据来源）／REQ-139（对方面请求）／REQ-140（版式复刻）；本壳承接原 ARCH-022 第五轮、
原 ARCH-026/PLAN-051 渲染线与 REQ-089 第二批调研收口）
归档判定：Retain（滚动记录，轮次收口时按当时里程碑归档 history/plans/）

> 本壳是学习设计轮**主链路**（主架构主流程）的唯一滚动记录。轮名沿革：学习中心轮（2026-09-22
> 并轮立项）→ **学习设计轮**（2026-09-23 用户裁决重划）：主链路做主任务，其余按模块划分并各与
> 一份 plans/ 固定壳绑定（M1~M6，见「模块壳一览」；M1／M2／M5／M6 已收口归档）。切分裁决＝**掌握门与判分入主链**（推进由门
> 算出，状态机单一事实源），出题/复习/错题本剥离为 M2。
> **排期范围＝仅根仓库（8900/8903）**（用户裁决 2026-09-22）：不向 Axiom-Flow / QED-Tracker
> 发请求，实施中确有需要时再按跨项目协作规范另行提出。

## 目标与成功标准

**目标**：QED-Engine 在学习链路中的定位＝**只做数据展示与学习链路编排**（用户裁决 2026-09-22）：
课程素材的检索/下载归 QED-Tracker（ARCH-024 线）、知识整理归 Axiom-Flow（ARCH-025-L1／L2 两分线）。
主链路＝一门课从进到完的闭环驱动：**课程注册（引用式）→ 链路编译（两级确认→块序列）→
块学习推进 → 判分与掌握门 → 派生进度与结课**。本壳承载该状态机与 8900 学习域数据契约本身。

> **2026-10-21 主链第二环改判（[ADR 0026](../adr/0026-v1-root-table-family-freeze.md) D2／[REQ-137](../history/plans/2026-10/2026-10-21-v1-root-table-family-freeze.md)）**：
> 「链路编译（两级确认→块序列）」**整环退役**，其承载表 `qe_unit` 与编译／单元两端点族一并退出；
> 「块学习推进」随之改称「**知识点推进**」。学习序列的正本＝共享主表知识点树（`node_kind`／
> `parent_kp_id`／`depth`）＋课程行 `qe_learning.config.kp_path` 的 `kp_id` 有序数组。
> 判据＝`qe_unit.payload` 现网只装 M-1 骨架占位串、8903 零渲染点，且知识生产已归 Axiom-Flow。
> **M-1 的「课程注册（引用式）」与 M-3 的「判分与掌握门→派生进度与结课」两环保留**，只换读源
> （进度表改 `qe_learning` 的 kp 行、到期计数改作答流水重放）；M-2 的编译承接面随第二环退役失效，
> 出题与复习面不受影响。**本轮只落判定，代码与 DDL 未动**——M-1/M-2/M-3 三子壳在 REQ-137
> W1 之前不为退役表新增写入。

**成功标准正本在台账行**（ADR 0023）：验收判据逐条见[任务台账](../trackers/todo.md)
`ARCH-027` 行的「成功标准」列（行内 S1~S5；S5 于 2026-10-24 按用户裁定改为**四段收口顺序**，
逐项承载行见下节，本壳不复制判据条目）；各判据的验收手段见「验证与验收」节，执行进展与证据见「过程与证据」节。
本壳其余章节（含「关闭与归档」）出现的 S 编号即指行内同号判据。

## 轮次收口顺序（2026-10-24 用户裁定，替代原「M1~M4 四壳全关」口径）

> 用户裁定原文＝「首先将《知识点梳理》模块完成，然后做课程学习和课后练习，这两个是梳理完成知识点后的展示与
> 应用，还有一个知识探索部分重新梳理下链路是否能正常运行，完成了这几部分就可以任务该轮结束」。
> 由此本轮的结束判据不再是「模块壳全部关闭」，而是**下列四段按序各自收口**；顺序即排期，前段未收口不开后段实施。

| 序 | 段 | 收口判据（做什么算完成） | 承载行 / 壳 | 与主链 S 判据的关系 |
| --- | --- | --- | --- | --- |
| ① | **知识点梳理** | 8903 管理台新屏 `#/admin/kp-review` 三栏形态可用＋8900 七条 `af_kp` 透传一比一镜像＋demo 门黄金路径走通（含空态与拒绝态可见）；梳理四步（判章并互验 → 定知识点目录并剔前置后置 → 生成总结与导读 → 章下确认）在界面上各有唯一落点与唯一写入端点 | 实施＝[REQ-141 壳](2026-10-24-kp-review-screen-and-kp-passthrough.md)；核查正本与判据来源＝[REQ-138 壳](2026-10-23-admin-render-and-kp-review-workspace.md)；对方面（N1 文本适配器／N2 在网生效／N3 创建端点／C7 批量取页）＝[REQ-139 壳](2026-10-23-kp-review-af-request.md)；版式前置＝[REQ-140 壳](2026-10-24-parsing-layout-geometry-replica.md)（2026-10-25 T2 裁甲后升为**硬前置**＝本段先落地枚） | 兑现 S2 的「知识点树」生产侧——知识点树由梳理段产出并确认后写共享主表，主链只消费不再自建编译链路（S2 的编译退役半项已按 ADR 0026 D2 判退）。**承载行的登记面（2026-10-25 定形）**＝本段六枚小任务行一律登记在普通任务轮（ARCH-035）节，分线归属＝REQ-099→ARCH-025-L1、REQ-141／139／116→ARCH-025-L2、REQ-138／140→ARCH-025-L3；ARCH-025 轮侧只留总线行（本轮结束条件）与三枚分线行。同一事项按责任侧分行＝根侧屏与 8900 透传归根侧行（REQ-141），对方生成通路与端点形状归对方承接行（REQ-139） |
| ② | **课程学习** | 一门课在 8903 走通「注册（引用式）→ 读已确认知识点树 → 逐知识点推进 → 判分与掌握门 → 派生进度与结课」，且进度与门态由服务端算出而非手改游标；M-3 剩余腿收口＝W5 真机端到端＋门态展示 | 本壳 M-1／M-3 两流（`/learn/*` 自有面）＋归档的 M1／M6 界面面（消费其已交付组件） | S1／S3 的落地复核位＋S4 的学习半段；M-3b LLM 判读两腿前置＝ARCH-027-M3 行 S4 真机冒烟 |
| ③ | **课后练习** | 练习面按「领域 → 已学知识点实际进度」组织，题量与到期队列由②的实际学习进度算出；三面风格与页头三件套同口径 | [REQ-130 壳](2026-10-18-practice-by-domain-and-progress.md)（其 S1~S5 正本在该行） | S4 的练习半段——**依赖①②的产出**：知识点未确认则无题源关联，进度未落地则队列算不出 |
| ④ | **知识探索链路复核** | 复核而非新建：`#/knowledge` 知识体系浏览面在①②③改道后仍可用、无回归，8903 全指 8900；链路断点若有则登记缺陷另批处置 | [ARCH-027-M4 壳](2026-09-23-knowledge-exploration.md)（其 S1 轻形态维持判据） | 其 S2（澄清访谈入主链提案）与 S3（对话式 RAG 问答）仍按原口径后置，不作本轮结束前置 |

- **「梳理模块完成」的边界（用户 2026-10-24 已裁的硬取向的直接推论）**＝① 段的收口**不以对方 N1／N2 到位为前置**：
  屏与透传在「空态＋拒绝态可见」下即可交付并过 demo 门，生成腿到位后只换数据不改屏。对方缺口在 REQ-139 行跟踪，
  不阻塞本轮顺序推进；若 demo 门需「有数据」腿，按 REQ-141 壳前置条件 3 用人工直登记那条腿自造一行并如实标注来源。
- **段间依赖只有一条硬边**＝③ 读②的进度、② 读①的已确认知识点树；④ 是回归复核，与①②③的改动同批复核。
- **① 段内部先后已裁（2026-10-25）＝REQ-141 的 T2 采甲**（用户裁语原文＝「REQ-141 的 T2要同一渲染」）：梳理屏中栏与
  [REQ-140 壳](2026-10-24-parsing-layout-geometry-replica.md) 的版式改判**共用同一渲染腿** ⇒ 排期定形＝**REQ-140 先落地、REQ-141 的 demo 门（中栏段）排其后**；
  乙案（REQ-141 先以朴素段落流交付、REQ-140 落地后只做一次并腿）作废，两壳原建议不留。两壳的互斥边界不变＝REQ-141 不改
  `typography.ts`／`BlockList.tsx` 的版式判定、REQ-140 不改梳理屏装配。
- **① 段内部的开工批次（2026-10-25 用户再改序）**＝REQ-141 拆为**批次 F（前端展示与流程）→ 门 F（人工确认）→ 批次 B（后端链路＝8900 七条透传）→ 门 B＝demo 门**，
  指令原文＝「先做好前端展示和流程梳理，待人类确认后再动后端链路」。据此 ① 段的实际开工序＝
  **REQ-141 批次 F（W3／W4／W5／W6，中栏直接消费 `BlockList` 的版式分支）→ 门 F 交人工 → REQ-141 批次 B（W2 透传）→ 门 B**，REQ-140 与批次 F 并行开工、
  不再是门 F 的硬前置（同日放行原文＝「先做一版前端，需要后端配合但后端没做的先置灰」；置灰口径与共用出口的正文在 REQ-141 壳「批次 F 的放行开工口径」节）；
  原「REQ-141 的 8900 透传可与 REQ-140 同批并行」的措辞按本次改序作废。四段的**收口判据与各行 S 判据一字未动**（门 F 通过不关闭任何行），
  批次 F 之所以能独立交付是因现网 8900 已具备书目／逐页正文／页图／课程目录（含页区间）／知识点直登记与长文读回这些在册读腿，
  判据与数据源分档的正文在 REQ-141 壳「开工分批与两门验收」节，本壳不重述。
- 本壳的「工作项（主链滚动登记表）」继续按 M-1／M-2／M-3 三流承载实施事实，四段顺序只决定**开工与收口的先后**，
  不改写各流自身的判据内容。

## REQ-089 第二批调研承接：DeepTutor 学习面判定表（2026-09-22）

> 来源＝REQ-089 第二批（学习中心面）三切片调研（课程面 / 练习与掌握面 / 记忆与本地模型适配），
> 只读参照 `D:\coding\demo_program\DeepTutor`（第三方开源项目，不引入依赖）。证据路径相对该仓库。
> 用户裁决：最有意义＝Book 活书编译器 + 练习与掌握面（可基于其开发）+ 本地模型适配层。
> 2026-09-23 重划后各条**承接壳**见末列。

| # | 机制 | 判定 | 依据（DeepTutor 证据） | 承接壳 |
| --- | --- | --- | --- | --- |
| L1 | 掌握三件套：知识点四分类 memory/procedure/concept/design；双门槛（量化门近因加权正确率 ≥0.9 `learning/policy.py:35-38`；质性门 Feynman+`mastery_assess` 布尔 `policy.py:41-45`）；防蒙对权重上限（`learning/mastery.py:17-37`）；推进由门算出非游标（`policy.py:206-288`） | **吸收（基于其开发）** | 全为规则与服务端状态，不吃模型能力 | 主链 M-3 |
| L2 | 确定性判分（choice 全等/short SequenceMatcher≥0.85/open 关键词命中≥0.6，`learning/grading.py:13-49`）+ 服务端 expected_answer 不经模型（`learning/models.py:189-232`）+「出题即结束回合、下回合先判分再 seed 裁决」（`capabilities/mastery/loop.py:305-406`） | **吸收** | 判题不可被模型污染，本地模型下依然可靠 | 主链 M-3（回合语义）+ M2（出题侧协议） |
| L3 | 间隔复习（按类型间隔表+连对升档/连错降档+错题 kp 最高优先，`learning/scheduler.py:13-98`）+ 错题双写题库（best-effort upsert，`tools.py:304-351`；题库 schema 含 user_answer/correct_answer/is_correct/score_trend，`sqlite_store.py:323-350`） | **吸收（MySQL 化）** | 我们 af_*/qed_* 同库体系，结构直译 | M2 |
| L4 | Book 活书编译：提案→章节树（Spine，两级用户确认）→按 ContentType 静态模板出 block 计划（如 THEORY 章=正文×3+FIGURE+CALLOUT+CODE+QUIZ×3+FLASH_CARDS×5，`book/agents/page_planner.py:73-93`）→逐块生成每块落盘、断点续编、失败熔断；源指纹 drift 标过期页（`book/kb_health.py:55-101`）；进度派生重算非累加（`book/progress.py:19-67`） | **吸收（改造为学习链路编译器）** | 「为课程编译学习链路」的用户裁决承载；自动全书文采生成后置 | 主链 M-2 |
| L5 | 课程＝引用式注册表（资源 kind 闭集只存 ref_id+label 快照；syllabus covered 只能学习者勾选；instructions/agent_notes 双通道限长，`services/courses.py:44-52,83-104`）+ 每回合 ≤3200 字符状态摘要注入 + 闭集 handoff、course_id 服务端注入（`capabilities/course_study/capability.py:352-377,412-420`） | **吸收（改造为 8900 表）** | 数据结构轻；状态摘要模式适配本地小模型 | 主链 M-1 |
| L6 | 出题三向位 Explore→Plan→每题 loop + 严格 JSON + normalize/校验/一次 repair（`agents/question/pipeline.py:619-1013`）；mimic 试卷仿题 | **吸收（后置实施）** | 依赖主链门/题库地基；repair 策略照抄 | M2 |
| L7 | 本地模型降级：能力表硬编码 ollama/lm_studio/vllm/llama_cpp `supports_tools:False`（`services/llm/capabilities.py:229-256`）；禁原生 tool calling→文本工具协议；不支持 JSON→剥 response_format+运行时拉黑（`capabilities.py:489-535`）；JSON 容错三件套（`utils/json_parser.py`）+ thinking 清洗（`llm/utils.py:180-202`）+ 预算饥饿降 effort 单次重试（`llm/structured_retry.py`）+ task model 继承兜底（`model_selection/tasks.py`） | **吸收** | 证明 Ollama 级后端可行 | M3 |
| L8 | 三层文件记忆 L1 trace/L2 策展/L3 综合 + 手动触发整合（`services/memory/`）；Learner profile/persona＝一段 prompt block（`learner_profile.py:38-49`） | **移植思想，后置** | 不排期；需要时轻量复刻 | 暂不配壳（roadmap 预留） |
| L9 | Little Tutor（选区追问）、ask_questions（澄清访谈） | **并入界面/探索评估** | 交互思想，非独立流 | M1（选区追问）+ M4（澄清访谈/问答） |
| R1 | Partner/IM 15 渠道、多用户、MCP/CLI Apps、YouTube 沉浸、GraphRAG 系 | **拒绝** | 超出个人图书馆边界（判例同第一批 R6） | — |

## 模块壳一览（2026-09-23 重划，一模块一行一壳）

| 模块 | 台账行 | 固定壳 | 承载原工作项 |
| --- | --- | --- | --- |
| M1 学习面 UI 与渲染基线 | ARCH-027-M1 | [2026-09-23-learning-ui-rendering.md](../history/plans/2026-10/2026-09-23-learning-ui-rendering.md) | 原 W1（渲染基线，承接 PLAN-051）+ 原 W6（课程面 UI） |
| M2 练习与复习 | ARCH-027-M2 | [2026-09-23-practice-review.md](../history/plans/2026-10/2026-09-23-practice-review.md) | 原 W4 拆出：出题管线（L6）+ 间隔复习/错题本（L3） |
| M3 本地模型适配层 | ARCH-027-M3 | [2026-09-23-local-model-adaptation.md](2026-09-23-local-model-adaptation.md) | 原 W5（L7 全量） |
| M4 知识探索 | ARCH-027-M4 | [2026-09-23-knowledge-exploration.md](2026-09-23-knowledge-exploration.md) | 问答/召回消费面（后置；L9 澄清访谈 + ARCH-025 检索线对接预留） |
| M5 知识点体系与知识梳理星图 | ARCH-027-M5 | [2026-09-30-knowledge-point-star-map.md](../history/plans/2026-10/2026-09-30-knowledge-point-star-map.md) | 2026-09-30 用户发令新增模块：第三层知识点两表（共享主数据 + 根私有候选明细）+ 学习中心星图导航层；DeepTutor 第三切片（KP 建模与图可视化）判定表 K1~K6/R2~R5 在该壳。**2026-10-01 收口 Achieved**（用户发令「再整行关闭、不留尾」，D1~D6 全按推荐口径批复；S4 按裁决 ⑦ 改判核销）：星图 UI 面曾晋升 design/ 并确认，**2026-10-11 随三界面拆分轮回收**为待晋升归档稿 [learning-star-map.md](../history/plans/2026-10/learning-star-map.md)（设计本体拆分三份待晋升稿，见 REQ-070-LEARN 承载壳与 REQ-104/105/106），两表与端点契约正式冻结；残余「知识点内容写入候选池」按非目标口径移交本壳 M-2 编译线与 M2 出题线，不留待做项 |
| M6 书籍目录知识点树与三栏学习工作台 | ARCH-027-M6 | [2026-10-01-toc-knowledge-tree-and-learn-workbench.md](../history/plans/2026-10/2026-10-01-toc-knowledge-tree-and-learn-workbench.md) | 2026-10-01 用户发令新增模块（学习面板三栏形态）：知识点两表层级化重设计（**改判 M5 冻结的两表结构**，按「可删除重建」授权，无数据搬迁、不做 ALTER）+ 目录页文本纯函数解析与 outline 端点 + 8903 三栏工作台与批注登记闭环；M1 判据不改写，渲染组件与其 UI-1 共用 |

> **模块轴之外的一行说明（2026-10-24）**：M5／M6 收口后，「知识点生产与确认」这件事不再由 M 轴模块壳承载，
> 而由 REQ-138／139／140／141 四行按「核查正本 / 对方面请求 / 版式前置 / 屏与透传」分工承载，
> 即上节顺序的 ① 段；四行的归属与互斥边界见 [REQ-138 壳](2026-10-23-admin-render-and-kp-review-workspace.md)
> 的「与相邻行的交叠划清」表，本壳不双写。

## 范围与非目标

**范围（主链）**：8900 新增学习域端点与表（`qe_*` 族，根私有三张）——课程引用式注册表、
知识点树推进／掌握门／确定性判分／进度派生，以及贯穿其中的契约先行与状态机。
（原列「链路编译器」一环已按 [ADR 0026](../adr/0026-v1-root-table-family-freeze.md) D2 整环退役，见「目标」节注记。）

**非目标**：知识点生产与确认面（归 REQ-138／139／140／141 四行，即「轮次收口顺序」节的 ① 段，四行登记在普通任务轮（ARCH-035）节、分线归属＝ARCH-025-L2／L3；
根侧只消费其确认后写入共享主表的知识点树）、界面与渲染（M1、M6，两壳已收口归档）、出题/复习/错题本（M2，已收口归档）、
网关降级开关（M3）、问答与召回探索的**新建**（M4 只作 ④ 段链路复核）、知识点体系与星图导航层（M5，已收口归档）、
检索与下载（归 ARCH-024 线）、解析与知识整理（归 ARCH-025-L1／L2 两分线）、对本仓库外的代码改动（请求发起经 REQ-139 已按跨项目协作规范另行提出，
不改本行「实施只排根仓库」的口径）、三层记忆与 Learner profile 实施（L8 后置）、
自动整书生成、GraphRAG 式自动知识图挖掘（R1 拒绝项维持；原「知识图谱（暂不做）」经
2026-09-30 裁决**窄化为此口径**，星图类数据导航界面不在其列，见 M5 壳裁决登记 ⑤）。

## 前置条件

1. 本壳 + ARCH-027（主链）与 ARCH-027-M1~M4 共五行台账登记完成（2026-09-23 重划，判例
   ARCH-020 字母后缀支线行）。
2. M-1 契约设计先行（契约先行判例同对方 PLAN-008 口径，写入本壳后再实施）；M-2 编译前置
   M-1 表结构 + M3 开关。
3. M-2 输入面**不依赖检索、不依赖子项目新改动**（用户裁决）：v1 用现有生效版本产物
   （8900 透传既有 blocks/content_list）+ 人工圈定页窗。
4. 各流实施排期逐条经用户确认（本壳只立项登记）。

## 工作项（主链滚动登记表）

| 流 | 内容 | 归属 | 收口段 | 状态 |
| --- | --- | --- | --- | --- |
| M-1 | 学习域数据契约（L5 移植）：课程＝引用式注册表（资源 kind 闭集指向 qt_*/af_* 既有书目/版本，只存 ref + label 快照）、syllabus 勾选权归人、instructions/agent_notes 双通道限长、进度派生重算；8900 REST 契约 + 404/422 约定 + 契约测试先行；8903 只连 8900（ADR 0007） | 根 8900+8903 | ② 课程学习 | **M-1 骨架已实施（2026-09-28）**：契约测试先行 tests/test_learn.py 14 绿 + 8900 /learn/* 14 端点（api/learn.py + services/learn/，骨架编译=静态兜底，生产 MySQL 存储随 M-2 接入、当前 503）；当轮门禁＝全量 594 + 契约 68 + ruff 全绿；api-contracts.md 新增 §⑥；`database-design.md`「QED-Engine 学习表族」节 + 表清单总览 + 读写矩阵已登记（2026-09-29 收口动作，见上节裁决 6）；剩余＝生产 MySQL 存储接入（随 REQ-137 W1 已于 2026-10-22 落地）+ 进度面 covered/结课门语义（M-3，② 段） |
| M-2 | 链路编译器（L4 移植）：提案→章节树两级人工确认→块序列生成（静态模板兜底、块级落盘断点续编、失败熔断）→源指纹 drift 标记；输入＝现有 blocks + 人工页窗，**不依赖检索** | 根 8900 | 不占段（已退役） | **整环退役（[ADR 0026](../adr/0026-v1-root-table-family-freeze.md) D2，2026-10-21 改判；执行批＝已归档的 [REQ-137 壳](../history/plans/2026-10/2026-10-21-v1-root-table-family-freeze.md)）**：承载表 `qe_unit` 与编译／单元两端点族随 REQ-137 W1 一并退出，本行原列的编译／块序列／drift 三件事不再有根侧落点。知识点树的生产与确认改由「轮次收口顺序」① 段的 REQ-138／139／140／141 四行承载（知识生产归 Axiom-Flow，根侧持屏与透传）；下表本行的历史读数（0928 契约冻结、0929 调用面定型）只作裁决追溯，**不再是待做项** |
| M-3 | 门与判分（L1/L2 移植）：四分类知识点、双门槛（量化 0.9 近因加权 / 质性 Feynman+`mastery_assess`）、确定性判分（choice 全等 / SequenceMatcher≥0.85 / 关键词≥0.6）、服务端 expected_answer、防蒙对权重上限、「出题即结束回合、下回合先判分再裁决」回合语义、推进由门算出（进度游标禁止手改）；主观题单次 LLM 批改（判题不喂 RAG，判例 L2） | 根 8900 | ② 课程学习 | **W1~W4 已落地（2026-10-18，证据见「过程与证据」节；契约稿与 D-M3-1~5 批复正文见「M-3 门与判分契约设计稿」节）**：规则层 `services/learn/mastery.py`（近因加权＋置信钳制＋四分类门分流＋provenance 双通路＋门即游标，纯函数、无 LLM 无 DB 无网络）+ 进度表幂等补列四枚 + 两形同构门读入面（`attempts_by_kp`、`due_counts_by_kp`）+ 端点两枚与 `progress` 门游标扩字段 + api-contracts／code-map／database-design 随步（端点 34→36）。判分与 expected_answer 两项已随 M2 壳缝 1/2 实现（`services/learn/grading.py`）。**剩余＝W5 真机端到端、M-3b LLM 判读两腿（质性讲读＋主观题批改，前置＝ARCH-027-M3 行 S4 真机冒烟）、门态展示（D-M3-5 另批）、生产 `qed` 库 ALTER（D 类转人工）** |

## M-1/M-2 契约设计稿（**冻结版**，2026-09-28 用户审理通过并裁决执行）

> 范围＝M-1 全部 + M-2 编译契约（用户裁决 2026-09-28：一并起草）；M-3 表与回合语义另稿。
> 本节的**实施判据＝契约测试先行**（S1）：先落 `tests/contract` 端点/错误码清单，后落码。
> **登记现状（2026-09-29 分两处落，整节暂不晋升）**：表清单与所有权/读写矩阵已入
> [database-design.md](../architecture/database-design.md)（「QED-Engine 学习表族」节 +
> 表清单总览 + 读写矩阵，作为 **M-1 收口动作**直接改，用户裁决 2026-09-29，不另开 todo 行）；
> 端点契约已入 [api-contracts.md](../architecture/api-contracts.md) §⑥（端点总表随步）；
> **整节另立 `design/learning-flow.md` 的晋升暂不做**（用户裁决 2026-09-29）——本壳继续作为
> 契约设计稿与裁决过程的事实源，api-contracts §⑥ 为消费面双写，晋升时机＝M-1 存储接入 +
> M-2 落地实现收口时再议。

### 裁决登记（2026-09-28，用户）

1. **表族归属＝方案②根仓库自建**：新前缀 `qed_learn_*`，所有权 QED-Engine，落共享 `qed` 库；
   建表走根侧幂等（`CREATE TABLE IF NOT EXISTS` + 补列清单，判例 `qed_llm_calls` /
   `call_log.py:22,104`），**不引入根 Alembic**（根现状无 Alembic）。
   database-design.md「学习表族规划（暂缓）」节据此收口（**已改登记 2026-09-29**，见下节裁决 ③）。
2. **命名避让**：`qed_learn_course` ≠ 共享表 `qed_course`（后者=课程体系主数据，所有权
   QED-Tracker，只读引用）；学习课程可**引用** `qed_course`/`qed_domain`（kind 闭集内），
   不复制其行。
3. 读写矩阵新增一行：`qed_learn_*`＝8900 R/W（所有权，自建），8901/8902 不读（铁律不破：
   根对 qt_*/af_* 仍一律走 HTTP）。
4. **审理裁决（2026-09-28 用户）**：D1′＝kind 闭集三值（book/af_version/knowledge，knowledge
   保留）；D2＝复用双通道不加批注列；D3＝编译进度挂课程行自 carry；D4＝进度独立表（三表成立）。
   **实施修正（审理中用户裁定）**：初稿六表收缩为三表（公共表已有的坐标/素材一律只引用不
   重复建），单元树=章节树+块序列合一（最深三级 section→unit→block，确认门语义仍为两级）；
   端点面按实现收口为 14 个（补 GET/PATCH/DELETE 细分与学习事件记录 POST …/progress）。

### 裁决登记（2026-09-29，用户·学习设计轮现状盘点轮）

5. **契约稿暂不晋升独立设计文档**：不新建 `design/learning-flow.md`；本节冻结稿继续作为契约
   语义与裁决过程的事实源，消费面双写维持 `api-contracts.md` §⑥。晋升时机改判＝M-1 生产存储
   接入 + M-2 编译管线落地（实现收口）后另议。
6. **`database-design.md` 学习表族节＝M-1 收口动作，直接改**：architecture/ 面改动本属大修改，
   经用户明确裁决作为 M-1 收口的一部分直接执行、**不另开 todo 行**；已落四处（表清单总览三行、
   命名空间说明、读写矩阵一行、`qed_learn_*` 要点节 + 「QED-Engine 学习表族」节替代原
   「规划，暂缓」节）。
7. **todo 五行瘦身**：ARCH-027 与 ARCH-027-M1~M4 行按 [task-lifecycle](../standards/task-lifecycle.md)
   登记契约收敛为「做什么 + 目标/效果 + 下一条件指针」，进度、契约细节与裁决记录一律由本壳与
   各模块壳承载。
8. **M3 边界裁决联动**（正文见 [M3 壳](2026-09-23-local-model-adaptation.md) 过程与证据 0929）：
   `/llm/text` 暂不对外暴露 `response_format`、A-2 文本工具协议整块后置 → **主链 M-2 的 LLM
   调用面据此定型**＝纯结构化 JSON 调用（`gateway.call_text(..., response_format="json")` →
   `local_adapt.parse_json_reply` 三件套 + 一次 repair），不经工具回环。

### 裁决登记（2026-09-30，用户·M5 知识点体系与星图立项）

9. **主链「非目标」窄化 + 新增 M5 模块壳**：用户发令补「领域→课程→知识点」三层体系
   （新增第四张共享知识点表 + 根私有知识点 detail 表）并按银河/星光星图设计学习中心首页。原非目标
   行「知识图谱（暂不做）」按 R1 本意**窄化为 GraphRAG 式自动图挖掘**，数据导航类星图界面不受该项
   限制；四项批复（表归属、两表按确认态分工、渲染方案、本轮只出设计）见
   [M5 壳](../history/plans/2026-10/2026-09-30-knowledge-point-star-map.md) 裁决登记 ①~④（窄化项为其中 ⑤）。主链三表与 M-3
   「进度行扩列、无需第四张 learn 表」裁决**不变**——新增的第四张表在 `qed_*` 共享族
   （知识点主数据），不是 learn 族的掌握表。

### 表契约（三表，一行=语义；2026-09-28 按用户方向收缩重拟，替代初稿六表）

> 收缩原则：**公共表已有的不重复**——领域/课程坐标（qed_domain/qed_course）、书目
> （qt_books）、教程（qt_knowledge）、解析版本（af_books）全部只存引用+label 快照；
> 章节树与块序列合为一棵**单元树**（同表两级行）；编译作业并入课程行状态列。

| 表 | 一行= | 职责与关键列（语义级，DDL 实现时定） |
| --- | --- | --- |
| `qed_learn_course` | 一门学习课程（注册+坐标+编译作业+派生视图宿主） | `learn_course_id`（PK，服务端生成）、name；**坐标三引用**（只存 ref_id+label 快照）：`domain_ref`→qed_domain、`course_ref`→qed_course、direction（方向，现有共享表无层则存 label）；`resources` JSON 列表＝素材引用（kind 闭集 book/af_version/knowledge + ref_id + label 快照，L5 风格，应用层校验）；`compile_status`（null/proposed/confirmed/running/completed/failed）+ `compile_done`/`compile_total`/`failure_count`（作业进度自 carry，D3 裁决）+ `source_fingerprint`（drift 判定输入）；`instructions`/`agent_notes` 双通道限长；时间戳。课程态与进度**读时派生不落列** |
| `qed_learn_unit` | 单元树一个节点（**章节树+块序列合一**） | `unit_id`（PK）、`learn_course_id`、`level`∈{section,unit}（section=章节大纲节点，正文在 resources 素材里；unit=最小学习单元/块）、parent 自引用、title、order；unit 行扩展列：`type` 闭集（text/formula/figure/quiz/flashcard）、`payload` JSON（quiz/flashcard 只存**内容定义**不含判分，判分归 M-3）、`source_ref`（book+page+block_index 逻辑引用，溯源回原页）、`gen_status`（pending/generated/failed＝断点续编位）、`active`（当前编译版本位，重编不抹历史）；人工位：`confirmed`（两级确认）、`covered`（**只能学习者勾选**，agent/编译永不写） |
| `qed_learn_unit_progress` | 一个单元的派生进度行 | unit 引用、状态（pending/current/done/skipped）、时间戳；**读时派生重算非累加**（L4），结课位由 M-3 掌握门写入；与 unit 分表：编译重跑（active 版本切换）不丢学习记录。M-3 的知识点掌握行计划并入本表扩列（四分类/判分结果位），届时无需第四张表 |

- **初稿六表→三表收缩映射**：course_resource→并入 course `resources` JSON（判例：
  `qed_course.prerequisites` 即 JSON 引用）；syllabus_unit + block→合并 `qed_learn_unit`
  （章节=section 行、块=unit 行，天然父子）；compile→并入 course 状态列（一门课同时只跑
  一个编译，作业单行 carry 成立）；block_progress→`qed_learn_unit_progress`。
- **二表可选（D4）**：进度行并回 unit 行（状态列挂 unit）。省一表，但重编译换代时
  学习记录随旧 active 行作废或需迁移逻辑。**已定谳（0928 审理）：维持三表**（分表成本≈0，
  换重编安全）。

### REST 契约（`/api/v1/learn/*`，8900 自有域，非透传）

| 端点 | 语义 | 错误 |
| --- | --- | --- |
| `GET/POST /learn/courses` | 列表 / 注册（资源引用数组入库校验 kind 闭集） | 422（kind 非闭集、ref 空、通道超长） |
| `GET/PATCH/DELETE /learn/courses/{id}` | 详情聚合（syllabus+blocks 概要+派生进度）/ 改元数据与双通道 / 删除 | 404；409（有在跑编译禁删） |
| `GET/PATCH /learn/courses/{id}/syllabus` | 读章节树 / **整树草稿写入**（编译确认前可覆写） | 404；422（三级嵌套、缺 title） |
| `PATCH /learn/units/{id}` | 只改 `confirmed`/`covered`/title/order；**covered 仅学习者面写** | 404；422（其余字段） |
| `POST /learn/courses/{id}/compile/propose` | 提案：输入=现有生效版本 blocks+人工页窗，产出 syllabus 草稿树 | 422（页窗缺失/无 active 版本） |
| `POST /learn/courses/{id}/compile/start` | 两级确认齐备后异步编译 → **202**（作业挂课程行 compile_status，D3 裁决） | 409（未两级确认）；404 |
| `GET /learn/courses/{id}/compile` | 编译状态+断点位（compile_status/done/total/failure_count，读课程行） | 404（无编译=null 也 404 或 200 空态，契约测试定） |
| `GET /learn/courses/{id}/units` | 单元树消费（`?level=section\|unit` 过滤：章节视图 or 块序列视图，M1 UI-3 数据源），含 drift/gen_status/active 位 | 404 |
| `GET /learn/courses/{id}/progress` | 派生进度+结课位（只读，UI-4 看板数据源） | 404 |

- **实现形态指针**：本表是契约起草口径（九行归并写法）；**实际落地 14 端点**（补 `GET /learn/units/{unit_id}`
  回显、`POST …/progress` 学习事件，syllabus 整树写入＝`PUT`）——逐端点语义与错误码以
  [api-contracts.md §⑥](../architecture/api-contracts.md) 为消费面唯一事实源。
- **错误码约定（S1 契约测试清单主体）**：404=实体不存在（`learn_course_id`/`unit_id`/`resource_id` 未命中）；
  422=闭集越界（kind/type/level）、限长超限、结构非法（三级嵌套/空标题/缺页窗）；409=状态机
  非法转移（未确认即编译、在跑禁删）；202=异步作业（仅 compile/start）。响应不含密钥；全端点走
  8900（8903 只连 8900，ADR 0007 不变）。
- **M-2 边界重申**：编译消费输入=8902 透传既有 blocks/content_list + 人工页窗，不依赖检索、
  不依赖子项目新改动（前置条件 3 裁决）；LLM 调用全部经 M3 适配层开关。

### 待审理点核销（2026-09-28 审理：四点全部定谳）

| # | 悬而未决 | 状态 |
| --- | --- | --- |
| D1 | 素材 `kind` 闭集范围：内容源三值（book/af_version/knowledge）**已定**（0928 收缩，坐标不再走 kind，改课程行三引用 domain_ref/course_ref/direction）；knowledge 值是否保留 | **已定谳（0928 审理 D1′）：保留三值**（教程套是现成正文源，15 行在库） |
| D2 | propose 后人工补正文（节点批注）存哪 | **已定谳（0928 用户）：复用双通道**，节级补充挂 instructions/agent_notes 口径，不加平行列 |
| D3 | 编译作业进度承载 | **已定谳（0928 用户）：编译状态并入课程行自 carry**（三表收缩后 compile 表取消，done/total/failure_count 挂 `qed_learn_course`） |
| D4 | 进度行独立表 or 并回 unit 行（二表方案） | **已定谳（0928 审理）：三表维持**（重编译换代不丢学习记录，分表成本≈0） |

## M-3 门与判分契约设计稿（**冻结版**，2026-10-18 出稿并经用户批复 D-M3-1~5 全按推荐口径）

> 本稿兑现上文 M-1/M-2 契约稿引言的承诺（「M-3 表与回合语义另稿」）。规则正本＝只读参照仓库
> `D:\coding\demo_program\DeepTutor`；判定表 L1/L2 的证据路径相对该仓库根，实际文件在
> `deeptutor/` 包目录下（如 `learning/mastery.py` → `deeptutor/learning/mastery.py`），本稿按
> **实际行号**逐条对照，移植取一比一直译、改造点显式声明。
> **实施判据＝契约测试先行**（行 S3）：先落规则层纯单测与 `tests/contract` 端点清单，后落码；
> 规则层不依赖 LLM 与网络（判据见「验证与验收」节）。

### 规则正本对照（L1/L2 逐条，含已实现项）

| # | 参照事实（DeepTutor 实际路径:行） | 本仓库落位 | 移植口径 |
| --- | --- | --- | --- |
| 1 | 近因权重 `(0.5,0.7,0.85,0.95,1.0)`（老→新）取最近 5 次作答，加权正确率＝`Σw·c / Σw`，空序列 0.0（`deeptutor/learning/mastery.py:17,24-37`） | `services/learn/mastery.py::compute_mastery` | 一比一（权重已在 M2 壳缝 4 冻结） |
| 2 | 置信上限 `{1:0.5, 2:0.8}`，`n≥3` 无上限（同文件 21,37） | 同上 | 一比一；**推论＝单次蒙对永不过 0.9 门，≥3 次作答才可能过门** |
| 3 | 门阈按知识点类型取：`memory/procedure=0.9`（其余回落 0.9），`concept/design` 不走字符串判分（`deeptutor/learning/policy.py:35-45,73-78`） | `mastery.py::gate_threshold` / `is_mastered` | 一比一 |
| 4 | 质性门＝一条布尔记录 `qualitative_mastery[kp]`，由 tutor 经 `mastery_assess(passed, feedback)` 写入；工具侧对非质性类型直接 refusal（`policy.py:81-89`、`capabilities/mastery/tools.py:1147-1207`） | `qe_learn_unit_progress` 扩列 | **改造**：本仓库无工具回环（0929 裁决 A-2 整块后置），判定者取值见 **D-M3-2** |
| 5 | 学习者自主声称位 `learner_mastery_overrides` 可推进路线，但对外报告必须区分 provenance `system`／`learner`（`policy.py:92-110`） | 同一列族承载，`mastery_source` 三值 `system`/`learner`/`""` | 一比一——**与现 UI「已掌握并下一条」勾选位天然对齐**：门是新增的 system 通路，不取代 learner 通路 |
| 6 | 「门就是游标」：`next_objective` 优先级＝待问题（pending）→ 到期复习 → 第一个未掌握知识点（模块序 × KP 序）→ `complete`（`policy.py:206-288`） | `derived_progress.current_unit_id` 语义改判 + 新增 `next_step` | **改造**：pending 态按缝 5 已裁不移植 → 优先级＝到期复习 → 第一个未掌握 → `complete` |
| 7 | `objective_status` 三态 `mastered`/`learning`/`new`（`policy.py:121-128`） | 同三态 | 一比一（界面措辞仍按学习面禁现词表，不出现「单元」「游标」） |
| 8 | 确定性判分三型阈值（`learning/grading.py:13-49`） | **已实现**＝`services/learn/grading.py`（M2 壳缝 1 冻结） | 门只消费 `attempt.is_correct`，**不复制阈值** |
| 9 | `expected_answer` 只存服务端、题面投影剔除（`learning/models.py:189-232`） | **已实现**（缝 2） | 不动 |

### 数据面（扩列上限四列，零新表）

兑现 0928/0930 两处裁决——「M-3 的知识点掌握行并入 `qe_learn_unit_progress` 扩列，届时无需第四张表」。
（本节按**实现现名** `qe_learn_*` 书写；上文 M-1/M-2 契约稿的 `qed_learn_*` 是立项旧名，
2026-10-16 核心登记表轮已改名。）门的输入（attempt 序列）与输出（分数、掌握态、provenance）一律
**读时派生不落列**（L4 派生非累加），只有「人/机写入的事实」才落列：

| 列 | 类型 | 语义 | 谁写 |
| --- | --- | --- | --- |
| `qualitative_passed` | TINYINT(1) NULL | 质性门布尔结论（仅 `concept/design` 知识点有值；NULL＝未判） | `POST …/mastery/assess` |
| `qualitative_note` | VARCHAR(1000) | 判读证据一句话（自评理由或模型意见，不含密钥） | 同上 |
| `assessed_by` | VARCHAR(16) | provenance：`learner`（v1 唯一可写值）／`model`（M-3b 预留，本轮端点拒绝该值） | 同上 |
| `assessed_at` | DATETIME | 最近一次质性判定 UTC 时刻 | 同上 |

- 量化门不占列：`mastery = compute_mastery(该 kp 最近 5 次 attempt 的 is_correct 序列)`，
  `over_gate = mastery ≥ gate_threshold(kp_type)`。
- 知识点行（`level=point`，`source_ref.kp_id`）↔ 知识点是一对一，故扩列挂在进度行即等于挂在知识点上；
  `kp_id` 为 NULL 的旧节/块行不参与门（阅读单位口径见已归档
  [REQ-117 壳](../history/plans/2026-10/2026-10-15-learn-course-study-redesign.md) §V2.3）。
- DDL 走根侧幂等补列（判例 `qed_llm_calls` / `call_log.py`）；**生产 `qed` 库不 ALTER＝D 类转人工随发布批次**。

### REST 契约草案（`/api/v1/learn/*`，落码前先进 `tests/contract` 清单）

| 端点 | 语义 | 错误 |
| --- | --- | --- |
| `GET /learn/courses/{lc}/mastery` | 逐知识点门态：`{items:[{unit_id,kp_id,kp_type,gate,mastery,threshold,attempt_count,provenance,status,qualitative_passed,due_reviews}],next_step:{unit_id,action,reason},summary:{total,mastered,learning,new}}`；只出知识点行 | 404（课程不存在）；503（存储未接入） |
| `POST /learn/courses/{lc}/mastery/assess` | 质性门记录 `{unit_id,passed:bool,note?≤1000,by:'learner'}`（v1 只有 `learner`）→ 回显该行门态 + `next_step` | 404（unit/课程）；409（该知识点非 `concept/design`——参照正本同款 refusal 语义：量化型不许走质性门）；422（`passed` 缺失/非布尔、`by` 越界、note 超长） |
| `GET /learn/courses/{lc}/progress`（扩字段） | 原五字段不动，增 `mastered`、`next_unit_id`、`provenance` 分布；`current_unit_id`＝**第一个未掌握知识点行**（D-M3-1 批复 A「门就是游标」） | 404；503 |
| `POST /learn/courses/{lc}/progress`（不动） | 学习者勾选位＝learner provenance 通路，界面文案不变 | 同上 |

- 存储侧新增两个读方法（`MySQLPracticeStore` 与 `InMemoryPracticeStore` 同形）：
  `attempts_by_kp(course_id) -> dict[kp_id, list[is_correct]]`（按 `answered_at` 升序，全量取回后由规则层截最近 5 次）。
- 缝 3（open 题 LLM 批改 `method='llm'`）与缝 5（pending/session/turn）维持关闭，本稿不重开；
  主观题批改 prompt 与质性讲读 prompt 同属 **M-3b**（依赖 ARCH-027-M3 行 S4 真机冒烟）。

### 裁决核销（2026-10-18 用户批复，五项全按推荐口径）

| # | 悬而未决 | 批复 |
| --- | --- | --- |
| D-M3-1 | 断点/游标 | **A 门就是游标**：`current_unit_id`＝第一个「未掌握」知识点行（既无 learner 勾选、也未过 system 门），勾选仍是推进通路之一，界面零改动；C（服务端自动写 `done`）不采，R6 铁律不动 |
| D-M3-2 | 质性门判定者 | **A v1＝学习者自评位**（`assessed_by=learner`），LLM 讲读判腿（`model`）随 M-3b 接结构化 JSON 调用；本轮规则层可在无 LLM、无网络条件下闭环 |
| D-M3-3 | 门分流取型 | **A 读主表 `qed_knowledge_point.type` 现值**，空值按 0.9 量化门回落（与参照 `gate_threshold` 默认值同构）；不加快照列 |
| D-M3-4 | 无题源/未归档题 | **A 不猜**：零 attempt → `mastery=0.0`、`status=new/learning`、`gate=quantitative`、`threshold=0.9`，推进只由 learner 勾选达成；`kp_id` 为 NULL 的作答不参与任何门（同 `grading.py` 未知型口径）；不给「零题降级为质性门」开旁路 |
| D-M3-5 | 界面消费面 | **A 本轮只出后端**（规则层 + 端点）；门态徽章与 provenance 文案另批，本轮不触发 8903 改动与 `qed-frontend-check` |

### 实施序（2026-10-18 批复已下，按序执行）

| 步 | 内容 | 门禁 |
| --- | --- | --- |
| W1 | 规则层先红：`tests/test_learn_mastery.py`（空序列／单次与两次上限／窗口滑动／三态／门阈／质性旁路／非质性型 refusal／混合 provenance）→ 落 `services/learn/mastery.py`（纯函数，无 LLM 无 DB） | 定向 pytest 全绿 |
| W2 | 存储读方法（两形同构）+ 进度表幂等补列 | `tests/test_learn.py`、`tests/test_learn_practice.py` |
| W3 | 端点两枚 + `progress` 扩字段，**契约测试先行**；`api-contracts.md` §⑥ 端点总表随步 | `tests/contract` + 定向 pytest |
| W4 | code-map / database-design 随步（`mastery.py` 行 + 进度表四列 + 读写矩阵）；本壳 M-3 行状态与核销 | 契约门禁全套 |
| W5 | 端到端（真机 + 本地模型）随主链 S4，与 M-2 生成腿同批；M-3b（LLM 判读两腿）另批 | 行 S3/S4 |

## 过程与证据

- **2026-09-22 立项**：第五轮学习设计轮建立本主链壳；用户裁决＝QED-Engine 只做数据展示与
  链路编排（检索/下载归 QED-Tracker、知识整理归 Axiom-Flow）。轮次沿革、M-1~M-3 拆解、
  L1~L9/R1 判定表、契约冻结稿与范围边界全部由本壳承载（见「模块一览」「契约设计稿」两节）。
- **2026-09-23 重划**：一模块一壳一星，M1~M5 分壳，本壳只承载主链。
- **2026-09-28**：M-1 契约冻结稿经用户评审通过后开始实施（表侧）。
- **2026-09-29**：M-1 表侧与端点侧登记收口；同日 M3 边界裁决联动（正文见
  [M3 壳](2026-09-23-local-model-adaptation.md) 过程与证据 0929）。
- **2026-09-30 台账结构改判（[ADR 0023](../adr/0023-todo-row-carries-scope-and-criteria.md)）**：
  S1~S4 判据正本移入 todo 行「成功标准」列（行另加 S5 关闭前置），本壳保留目标陈述、蓝图与
  登记表；原行内「当前/下一条件」叙述迁入本节。
- **2026-09-30 现状与下一条件**：M-2 LLM 生成管线待启动，前置＝M3 剩余两流（A-5/A-6）开关全绿。
- **2026-10-11 三界面拆分轮（docs-only）**：用户四项裁决（承载＝改造 REQ-070-LEARN 行／
  design/ 两份学习文档回收至待晋升态／课后练习同步设计独立面 `#/practice`／星图面全部移除
  跨界跳转）落 `2026-09-10-learning-center-current-state.md` 承载壳；三份待晋升设计稿
  （知识点探索／课程学习／课后练习）各配开发行 REQ-104/105/106。本壳 M5 行与模块壳的
  设计指针随之改指回收归档稿；主链 M-1/M-2/M-3 判据与状态不变。
- **2026-10-18 M-3 契约稿出稿（docs-only，未动码）**：ARCH-027-M3 行 A-6 落地后 M3 剩余判据
  只剩其 S4 真机冒烟，主链「下一条件」解除，按 M-1/M-2 先例出 M-3 契约稿待审。取证口径＝
  在只读参照仓库把 L1/L2 规则读到**实际文件行号**（判定表证据路径缺 `deeptutor/` 包名前缀，
  本稿对照表已补正）：近因权重与置信上限＝`deeptutor/learning/mastery.py:17,21,24-37`，
  门阈与三态与 provenance 双通路＝`deeptutor/learning/policy.py:35-45,73-128`，
  「门就是游标」＝`policy.py:206-288`，质性判定写入面＝`capabilities/mastery/tools.py:1147-1207`。
  三条取自本仓库现状的硬约束：① 门是**新增 system 通路**，不取代 learner 勾选（参照侧
  `learner_mastery_overrides` 与 R6「勾选权归学习者」同构，故 D-M3-1 推荐 A 而非 C）；
  ② 扩列上限四列、分数与掌握态一律读时派生（兑现 0928/0930「无需第四张表」与 L4）；
  ③ pending/session/turn 与 LLM 两腿（质性讲读、主观题批改）不入本轮（缝 3/缝 5 维持关闭），
  使规则层可在无 LLM、无网络条件下纯单测闭环。裁决点 D-M3-1~5 已列选项与推荐口径，
  **未批复不动码**（实施序 W1 起于 `tests/test_learn_mastery.py` 先红）。
- **2026-10-18 M-3 契约稿审理（用户批复五项，全按推荐口径）**：D-M3-1「门就是游标」＝
  `current_unit_id` 改判为第一个未掌握知识点行，learner 勾选通路保留、C 案（服务端自动写 `done`）
  不采，R6 铁律不动；D-M3-2 质性门 v1＝学习者自评位（`assessed_by=learner`），LLM 讲读判腿留 M-3b；
  D-M3-3 门分流读主表 `type` 现值、空值回落 0.9 量化门（不加快照列）；D-M3-4 无题源与未归档题按
  「不猜」定档（`mastery=0.0`、推进只由勾选达成、`kp_id` NULL 的作答不参与任何门，不为零题开质性旁路）；
  D-M3-5 本轮只出后端规则层与端点，门态展示另批（不触发 8903 改动与前端实测门）。
  本节批复即构成动码授权，实施按 W1→W4 推进，W5（端到端 + M-3b）随主链 S4 另批。
- **2026-10-18 M-3 W1→W4 实施落地（本轮只出后端，D-M3-5；无 LLM、无网络、无真库）**：按批复实施序四步走完，
  全程契约测试先行（W3 端点先写红再接绿）。
  - **W1 规则层**：`tests/test_learn_mastery.py` 先红 → 落 `backend/qed_engine/services/learn/mastery.py`
    （一比一直译只读参照 DeepTutor，19 例全绿）：近因加权正确率取最近 5 次、按作答次数钳置信上限
    `{1:0.5, 2:0.8}`、门阈按 `qed_knowledge_point.type` 现值分流（空值回落 0.9 量化门，D-M3-3）、
    `assessed_mastered` 与 `mastered` 分离使自评不冒充系统判定、pending 态按 M2 壳缝 5 不移植。
  - **W2 存储面**：`qe_learn_unit_progress` 走 information_schema 差集幂等补列四枚
    （`qualitative_passed`／`qualitative_note`／`assessed_by`／`assessed_at`，判例 `call_log.ensure_columns`），
    新增 `progress_rows`／`assess_qualitative`／`ensure_point_unit` 读写面，内存与 MySQL 两实现同形
    （既有接口 parity 测试守护）；练习侧门读入面 = M2 已有 `attempts_by_kp` + 本轮新增 `due_counts_by_kp`
    （题行归所属知识点 ∪ 裁决 ⑧ 的 kp 粒度行，`status='active' AND due_at<=now` 与 `review_due` 同口径，
    未归档题不进门，D-M3-4）。
  - **W3 端点与扩字段**：`GET /api/v1/learn/courses/{lc}/mastery`（items／next_step／summary 三键、
    只出知识点行、纯读派生不物化）+ `POST …/mastery/assess`（v1 只有 `by=learner` 自评位；
    非 `concept/design` 返 409；首次落笔才 `ensure_point_unit` 物化投影行且不抹勾选位，§V2.3）；
    `GET/POST …/progress` 与课程列表 `derived` 三处同源扩 `mastered`／`next_unit_id`／`provenance`，
    `current_unit_id` 由「第一个未勾选行」改判为「第一个未掌握知识点行」（D-M3-1，`skipped` 不停靠），
    原五字段口径与勾计算数不动。练习腿不可达按零作答派生而非 503（D-M3-4），学习存储不可达仍 503。
    `api-contracts.md` §⑥ 正文两行 + progress 行扩字段改判 + `endpoint-registry` 哨兵区两行随步。
  - **W4 文档随步**：`code-map.md` 学习域六行改注（`api/learn.py` 四源汇成与降级口径、`base.py` 补列与
    读写面、`memory.py` 同形承载、`practice.py`／`practice_memory.py` 门读入面、`tests/test_learn.py`
    守护面）+ `services/learn/mastery.py` 新行（W1 已挂）；`database-design.md` 进度表涉及模块与注释补
    四源口径、`qe_learn_attempt` 与 `qe_learn_review_task` 各补门读入面指针；§4.4 读写矩阵为表级、
    本轮零新表故不改。
  - **门禁取证**：`tests/test_learn_mastery.py` 单跑 19 passed；`tests/test_learn.py` +
    `tests/test_learn_practice.py` + `tests/test_learn_mastery.py` 定向合跑 123 passed（M-3 W3 新增 10 例：
    门态列举与无练习降级、404/503/409/422 四码、自评写回与游标推进、量化型 refusal、过门置 system、
    单次蒙对不过门、到期复习抢位、`skipped` 不停靠、`due_counts_by_kp` 双粒度归集）；
    `tests/contract` 89 passed（W4 文档随步后复跑仍绿）；全量 `pytest` 858 passed（末次跑含并行会话
    在途新增例）；整仓 `ruff check backend tests` All checks passed。
- **2026-10-24 轮次收口顺序定档（docs-only，未动码）**：用户裁定原文＝「首先将《知识点梳理》模块完成，
  然后做课程学习和课后练习，这两个是梳理完成知识点后的展示与应用，还有一个知识探索部分重新梳理下链路
  是否能正常运行，完成了这几部分就可以任务该轮结束」，并授权「如果验收有变允许最小化变更」「文档整理好后再放行开工」。
  据此本壳改动六处＝① 新增「轮次收口顺序（2026-10-24 用户裁定）」节（四段各给收口判据、承载行与与 S 判据的关系，
  并写明 ① 段不以对方 N1／N2 为前置这一边界）；② 「关闭与归档」的轮次整体收口口径由「本壳 + M1~M4 四壳全部关闭」
  改判为四段按序收口；③「模块壳一览」补 M6 之后的四行说明（梳理段分工指向 REQ-138 壳的交叠划清表，不双写）；
  ④「范围与非目标」把「链路编译器」从范围移出并按 ADR 0026 D2 标注退役、非目标首条改为知识点生产与确认面归
  REQ-138／139／140／141；⑤ 工作项登记表新增「收口段」列（M-1／M-3＝②，M-2＝不占段·已退役）并把 M-2 行状态
  由待做口径改判为退役口径（历史读数只作裁决追溯）；⑥ M-1 行「剩余」更正——生产 MySQL 存储接入已随 REQ-137
  落地（`services/learn/base.py:196` `MySQLLearnStore` 在位，503 只在未配置库口令时出现）。
  台账侧同批＝todo 的 ARCH-027 行任务描述补顺序指针、成功标准列 S5 一项按授权做最小改判（S1~S4 一字未动）。
  本轮零代码、零 DDL、零库内写、零 git；门禁见本节末「验证与验收」执行位。
- **2026-10-24 按 ARCH-025 三向新结构随步（docs-only，未动码）**：用户同日两裁＝① 「当前主要任务有三项：解析与知识库优化／
  知识点梳理后端部分开发／解析后的文档渲染」，ARCH-025 轮按三向重划承载归属；② 「ARCH-025 主线本身和方向 2 重叠，只是我们负责 QED-Engine、对方负责子项目……或者说 ARCH-025 下的是具体事项」，该轮主线行由此退为**承载轮**（只登记与跟踪，具体事项与其验收判据在各方向支线行，同一事项按责任侧分根侧行与对方承接行）。本壳四处据此随步＝「轮次收口顺序」表 ① 段  承载行加方向归属与责任侧划分、「非目标」两处与「目标」一处把旧「ARCH-025 线」措辞改指方向 1／方向 2、与 todo 学习设计轮节标题及 ARCH-027 行描述同批改写（**本行成功标准列 S1~S5 一字未改**）。
  **本轮的排期与段间依赖不受影响**＝① 段仍由 REQ-141（根侧屏与透传）＋REQ-139（对方生成通路）＋REQ-138（核查正本）＋REQ-140（版式）承载，
  T2 待裁点原样待定、不按建议默认采纳。同批＝方向 1 的 REQ-134（`af_*` 承载设计稿）以 `Achieved` 收口归档，`af_*` 逐列形状的正本仍在对方 PLAN-024，本壳涉及 `af_kp` 的引用一律指该正本。零代码、零 DDL、零 git，对方工作区只读。
- **2026-10-25 ARCH-025 定形为一总线＋三分线，本壳四处随步（docs-only，未动码）**：用户裁语＝「该轮一个总线写明本轮结束条件＋三个分线写具体的三个大任务，大任务分下来的小任务都在普通轮」，并先裁台账节内不得用 `####` 分方向子标题（人读会断表）。本壳随步＝「轮次收口顺序」表 ① 段的承载行登记面改指普通任务轮节＋分线归属（REQ-099→ARCH-025-L1、REQ-141／139／116→L2、REQ-138／140→L3）、「非目标」与「目标」两处旧「ARCH-025 方向 1／方向 2」措辞改指 L1／L2 两分线、与 todo 学习设计轮节标题及 ARCH-027 行描述同批改写。**本行成功标准列 S1~S5 一字未改**；① 段的排期、段间依赖（③ 读 ② 的进度、② 读 ① 的已确认知识点树）与 **T2 待裁点**全部原样待定、不按建议默认采纳（T2 已于同日下一批裁决，见下条）。本轮零代码、零 DDL、零 git，对方工作区只读。
- **2026-10-25 T2 裁决＝甲・共用同一渲染腿，① 段内部先后定形（docs-only，未动码）**：用户裁语原文＝「REQ-141 的 T2要同一渲染」，采甲案、否掉 REQ-141 壳与 REQ-140 壳原共同建议的乙案。本壳随步＝「轮次收口顺序」① 段的「段内先后待裁」条目改为已裁定形（**REQ-140 先落地、REQ-141 的 demo 门中栏段排其后**；REQ-141 的 8900 透传／api 与 store／三栏装配三腿不依赖版式，可与 REQ-140 同批并行），① 段承载行的「版式前置」加注为硬前置；REQ-141 壳 T2 条目与 W1／W5、REQ-140 壳「关联设计」与 W3（消费面由两枚增至三枚）同批改判，todo 的 REQ-141／REQ-140 两行「任务描述」列各加一枚同源短句。**未随之解锁**＝REQ-140 壳自身的 Q1~Q4 四枚待裁点、REQ-141 壳的 T1／T3 两枚待定项逐条保持待定（用户只答了 T2，未答者不默认采纳）；两行的「成功标准」列一字未改。本轮零代码、零 DDL、零 git，对方工作区只读。
- **2026-10-25 ① 段拆为批次 F／门 F／批次 B／门 B（docs-only，未动码）**：用户指令原文＝「首先我们按照顺序做《知识点梳理》前端界面和后端这个前置任务，梳理现在已经登记的任务，列个详细计划和验收标准，**先做好前端展示和流程梳理，待人类确认后再动后端链路**」。本壳随步＝「轮次收口顺序」节的 ① 段内部序改按批次承载（REQ-140 版式腿 → REQ-141 批次 F → 门 F 交人工 → REQ-141 批次 B 透传 → 门 B），并作废原「REQ-141 的 8900 透传可与 REQ-140 同批并行」那句。两枚实施壳的同批改判＝REQ-141 壳新增「开工分批与两门验收」节（含批次 F 的三档数据源逐条端点指认与门 F 的 F1~F7 判据）＋工作项批次归属＋待裁点 T4／T5 两枚新增；REQ-140 壳的轮次归属把前置位由门 B 前移到门 F 的 F2。**四段的收口判据与各行的 S 判据一字未动**（门 F 不关闭任何行，本轮也不适用成功标准冻结的最小化改判）；② 段 M-1／M-3 的剩余腿、③ 段 REQ-130、④ 段 M4 复核的排期与段间硬边全部原样。本轮零代码、零 DDL、零库内写、零 git，对方工作区只读。

## 验证与验收

- 各判据的验收手段（判据正文见 todo 行 `ARCH-027` 的「成功标准」列）：
  行 S1＝`tests/contract` + 8900 定向测试；S2＝8900 定向测试 + 真机一书贯通；
  S3＝规则层纯单测（不依赖 LLM）+ 端到端契约测试；S4＝真机走查 + M3 冒烟复跑。
- 每流收口：8900 侧跑定向测试 + `tests/contract`；契约变化同步 api-contracts.md。
- **四段收口的取证位（2026-10-24 补，判据正文仍在本行「成功标准」列 S5）**＝① 段＝REQ-141 壳 W1 demo 门的 DOM 读数
  （本壳不重复跑门）；② 段＝M-3 剩余腿 W5 真机端到端 + `tests/test_learn*.py` 定向复跑；③ 段＝REQ-130 行自身
  S1~S5（该壳为其唯一取证正文）；④ 段＝ARCH-027-M4 行 S1 的回归读数（浏览器实测 + 请求账全指 8900）。
  四段各自的门禁数值只写在该段承载壳的「过程与证据」节，本壳只登记收口结论与顺序偏差。
- M-3 规则层（判分/门槛/推进派生）为纯单测，不依赖 LLM 与网络；S4 端到端验收在本地模型下复跑
  （前置＝M3 开关全绿）。
- 本壳随条目增改更新「最后更新」，不要求单次全壳门禁事件。

## 回滚

纯记录文档：删除本文件不影响代码与测试；登记表条目对应的代码改动按各自提交独立回滚。

## 关闭与归档

关闭条件＝**「轮次收口顺序」节的四段按序收口**且 S1~S4 验收通过（S4 需 M1/M2/M3 界面、出题与开关协同到位，
四段中 ②③ 两段共同构成其真机证据），由用户裁决收口；关闭时本壳 Retain 归档 `history/plans/<year-month>/`，
todo 移除 ARCH-027 任务行。
轮次整体收口口径（2026-10-24 用户裁定改判，替代原「本壳 + M1~M4 四壳全部关闭」写法）＝
**① 知识点梳理 → ② 课程学习 → ③ 课后练习 → ④ 知识探索链路复核 四段各自收口即本轮结束**；
M1／M2／M5／M6 四壳已先行收口归档，M3 挂在 ARCH-028 轮节、其 S4 真机冒烟是 ② 段 M-3b 两腿的前置而非本轮结束判据；
原第五轮「学完一个教程」口径由 S1~S4 + 各承载行标准承接。
M-2 编译承接面按 ADR 0026 D2 判退，不占四段之一，也不作关闭前置。
