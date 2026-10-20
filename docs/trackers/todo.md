# 任务台账

状态：Current
最后更新：2026-10-18

本文件登记根仓库未关闭任务，是活跃计划的镜像。详细计划见 [计划索引](../plans/index.md)；
已关闭任务见 [completed.md](completed.md)。

**行的承载口径**（ADR 0023）：每行只写**任务描述**（做什么 + 目标/效果 + 文档锚）与**成功标准**
（`S1…` 固定验收判据，正本在此、写定不改）。执行进展、取证细节、裁决记录与「待提交」占位一律
写在承载壳的 `## 过程与证据` 节——日常推进不改本表。

## 未关闭任务

### 学习设计轮（第五轮：ARCH-027 主链路 + M1~M5 五模块，各配固定壳；轮名沿革与重划裁决见主链壳）

| ID | 类别 | 优先级 | 状态 | 任务描述 | 成功标准 |
| --- | --- | --- | --- | --- | --- |
| ARCH-027 | 主线 | 高 | In Progress | [学习设计轮·主链路（课程注册·链路编译·判分推进）（learning-design-mainline）](../plans/2026-09-22-learning-design-mainline.md) —— 第五轮主任务：QED-Engine 只做学习链路的展示与编排（检索下载归 Tracker、知识整理归 Axiom-Flow），主链路＝课程注册→链路编译→块学习推进→判分与掌握门→派生进度结课；目标 = 一条课程链路端到端可用并向学习中心形态收敛 | S1 契约先行：学习域表 + 8900 REST 契约（课程引用式注册、syllabus 勾选权归人、进度派生）契约测试先行全绿；S2 链路编译：任一课程可产出「大纲（两级人工确认）→ 块序列（text/公式/图/quiz/flashcard）」，断点续编、源漂移可标记；S3 门与判分：四分类知识点 + 双门槛（量化 0.9 / 质性 Feynman）+ 确定性判分 + 服务端 expected_answer + 防蒙对权重，推进由门算出而非游标；S4 端到端：现有生效版本产物 + 本地模型下一门课「注册→编译→学习→判分→推进→结课」跑通（消费 M1 界面、M2 出题、M3 开关）；S5 M-1/M-2/M-3 三子壳各自收口 |
| REQ-131 | 支线 | 高 | Accepted | [文档知识生产线集群总纲（解析产物→语义成品→三面消费·范围整合与归属裁定·待审评审件）（doc-knowledge-cluster-master-outline）](../plans/2026-10-20-doc-knowledge-cluster-master-outline.md) —— 把散在三行的同一件事整合为一份总纲：生产段 REQ-116（课本目录／知识点候选／学习链路／习题关联四职责与确认唯一写面）、梳理段 ARCH-027-M4（按文档核对三态与块级溯源）、消费段 REQ-130（练习按领域与实际进度，其题源依赖生产段职责④）；定清模块唯一落点、后端归属三案（算法与候选归 Axiom-Flow 而门面与确认写面归根＝推荐；整块交对方写根侧两表＝撞前缀即所有权；留根侧＝需改判 REQ-116 行移交口径）、溯源数据承载三档与两阶段排期（阶段一不等 Axiom-Flow 的 V1.0 启动门槛），并附 ARCH-027-M3 归并进 ARCH-028 的合轮裁定；目标＝总体设计只写一次、三行判据不重复发明 | S1 集群成员与三段切线在总纲成表且与三行在册判据无冲突；S2 模块命名与落点唯一化（单屏合一或两屏并列）经用户裁决并把结论回填承载壳；S3 后端归属三案经用户裁决，选移交时给出阶段一切分与移交稿验收口径；S4 溯源数据承载三档与读面端点归属经用户裁决；S5 批复后按总纲产出物清单做总体设计且三行随步，各行成功标准列零改写 |
| ARCH-027-M4 | 支线 | 低 | Accepted | [学习设计轮 M4·知识探索（问答与召回消费面，后置）（knowledge-exploration）](../plans/2026-09-23-knowledge-exploration.md) —— 知识探索消费面：轻形态（知识体系浏览维持 + ask_questions 澄清访谈入主链提案）先行，对话式 RAG 问答后置；目标 = 学习链路旁路的问答与召回消费面 | S1 轻形态维持：知识体系浏览面可用、无回归，8903 只连 8900；S2 澄清访谈入主链提案：ask_questions 在课程/链路立项前做一次访谈式问答；S3（后置）对话式 RAG 问答：8902 检索端点打通后 chunk 级 self_ref 溯源可跳回原页原文，前置＝对方端点就绪 + 用户发令联调 |
| REQ-121 | 支线 | 中 | Accepted | [（请求：QED-Tracker）教材级「简介／面向对象」两列落 qt_books（book-intro-audience-tracker-request）](../plans/2026-10-16-book-intro-audience-tracker-request.md) —— 承 REQ-117 W8 书架清单 v2 的 C10 裁决：qt_books 现无书级简介与面向对象列，教材卡暂以 af_books.knowledge_id → qt_knowledge.intro/position 套级派生交付（同套多本共用一句简介，属已知妥协），请对方加两列（或按其 meta 守则给出 meta 键位替代）、8901 书目接口透传、存量 17 行给回填口径、其 database-schema.md 事实源随步（口径锚见本壳「请求项」R1~R5 与 REQ-117 壳 C10 条）；目标 = 教材卡两列有书级事实源，根侧 sync 改读书级列、套级降兜底 | S1 R1~R5 逐条在对方 todo 有承接行，对方承接稿声明需求方/目标项目/接口面/评审方/执行方/验收标准六项，且新增文档已同步其 test_documentation 全量 md 白名单；S2 R1/R2 回执为落地／推后／拒绝之一并附其门禁输出；S3 R1 落地形态明确＝两列或 meta 键位，键名与值域（五档或自由文本）成文可被根侧固定读取；S4 R3 回填口径有回执（派生来源或人工登记），未回填期间根侧回落链照常显示「暂无简介」「未标面向对象」不报错；S5 根侧不代改对方代码与表结构；R1/R2 回执落地后由 REQ-117 W5 批次改读 qt_books 并同步 api-contracts.md §⑥，误产生的改动即登记移交 |
| REQ-130 | 支线 | 中 | Accepted | [学习中心·课后练习面按领域与实际学习进度重组轮（practice-by-domain-and-progress）](../plans/2026-10-18-practice-by-domain-and-progress.md) —— 课后练习面（`#/practice`）组织轴重组：现面以「课程选择器＋该课全量题卡＋按课到期队列」为轴，既不按领域组织也**不读学习者在课程学习面的实际学习进度**（`qe_learn_unit` 的 point 行勾选态），且未按 REQ-117 定档的站点整体风格调整（页头缺「刷新」三面三件套不齐、进度与文案净化口径未随步，该缺口原登记在 REQ-117 归档壳 §V2.10「另登记」条）；其设计正本确认状态仍为**暂定**；本轮先立项与定范围（W1），形态分析＝调研已探明的参照项目 `D:\coding\demo_program\DeepTutor` 的课后练习做法并出吸收／改造／拒绝判定表（W2，待用户发令）；出题、判分阈值与间隔序列取值、知识点生产与确认腿均不入本轮；目标 = 练习按「领域 → 已学知识点实际进度」组织、三面风格一致，题量与到期队列由实际学过什么算出而非全课铺量 | S1 参照项目课后练习面机制在壳成 吸收／改造／拒绝 判定表（证据路径相对该仓库）并经用户评审；S2 设计正本 `learning-practice-ui.md` 按新轴重写（含原「不做跨课程合并队列」的处置）、元数据与 ADR 0017 骨架齐备、确认状态经用户评审转已确认；S3 demo 门真机走通一条黄金路径＝选领域 → 只列该领域已学知识点相关题 → 作答即判分回显 → 队列与错题本同口径回流 → 未学过知识点不进队列，全指 8900 且无 4xx/5xx，到门暂停待人工验收；S4 页头三面同位同序（使用手册／刷新／返回）、无进度徽章、左缘两档同常量口径、禁词表覆盖练习面在册源码，前端三门禁绿；S5 领域或进度读过滤先改 `api-contracts.md` §⑥ 与端点总表且双向等值守护绿，判分阈值与间隔序列取值零改动，根侧契约与全量绿；不扩 S 判据，新想法另登行 |
### 本地模型稳定性轮（ARCH-028）

| ID | 类别 | 优先级 | 状态 | 任务描述 | 成功标准 |
| --- | --- | --- | --- | --- | --- |
| ARCH-028 | 主线 | 高 | In Progress | [本地模型稳定性轮滚动记录（仪表盘状况卡·监督器·掉线根因·批次水位）（local-model-stability-round）](../plans/2026-09-23-local-model-stability-round.md) —— 本地模型服务稳定性轮：仪表盘「本地模型状况」卡（api 模式隐藏、单活守卫下跟踪当前在跑模型，互斥被绕过并列多跑时并列呈现不隐藏）+ 8900 常驻监督器（分级探测/防抖事件账/非在飞自动重启在飞只告警/显存水位门/掉线诊断包）+ 50 页/窗批次（根 .env 配 `AXIOM_PARSE_WINDOW_SIZE=50`）；目标 = 本地模型「看得见、管得住、喂不饱不死、等不到快挂」 | S1 状况卡按显隐/单卡规则实时反映状态（含降级态与失败原因），API 模式整卡隐藏；S2 监督器闭环：探针翻转防抖 + 事件账 + 非在飞自动重启（退避≤3 次）+ 在飞只告警，注入杀容器可观测恢复；S3 图像模型掉线三类假设定谳——移交 REQ-100 L1，不作本行关闭前置；S4 全本解析按 ≤50 页/窗执行且 OOM 不再现；S5 冷启动不误判掉线、恢复不叠发（宽限窗内不推进防抖、不耗恢复预算、不发诊断包；restart 闩锁单发）；S6 显存水位门：空闲显存低于阈值（默认 12GB）拒起并记事件，探针失败按不达标处理（fail-closed）；S7 请求侧熔断快挂（W11）有回归用例 |
| ARCH-027-M3 | 支线 | 高 | Accepted | [学习设计轮 M3·本地模型适配层（local-model-adaptation）](../plans/2026-09-23-local-model-adaptation.md) —— 网关本地降级组合移植（L7）：能力表、JSON 容错 + 一次 repair、thinking 清洗、饥饿降 effort 重试、task model 兜底；目标 = 本地模型下学习链路调用可靠且可一键回退 | S1 A-5/A-6 两项适配落地且对应开关全绿（A-2 工具协议段按裁决后置，不入本任务判据）；S2 能力表 + 降级路径：四类 binding 的 `supports_tools:False` 走文本协议段，JSON 模式渠道走 response_format + 降级；S3 容错三件套：JSON 修复 + 一次 repair、thinking/scratchpad 清洗、reasoning 预算饥饿降 effort 重试，各有单元用例；S4 真机冒烟：本地模型下出题与判分链路各跑通一次，且一键回退可验证 |

### QED-Tracker（V1.0）持续优化轮（ARCH-024）

| ID | 类别 | 优先级 | 状态 | 任务描述 | 成功标准 |
| --- | --- | --- | --- | --- | --- |
| ARCH-024 | 主线 | 中 | In Progress | [QED-Tracker V1.0 持续优化滚动记录（tracker-v1-continuous-optimization）](../plans/2026-09-22-tracker-v1-continuous-optimization.md) —— QED-Tracker（V1.0）持续优化轮：为其探索/下载链路的三线优化（本地模型链路、论文探索和下载、下载链路评估与 bug 修复）做逐条登记与跟踪，目标 = 8901 检索/下载链路持续改进并向 V1.0 收敛 | S1 三线（本地模型链路／论文探索与下载／下载链路与 bug 修复）的登记表条目状态与对方台账实际一致；S2 涉及子项目的工作按跨项目协作规范向 QED-Tracker 登记请求并可跟踪回执；S3 根侧修复类条目（8900 适配、前端消费面）回归门禁全绿并留证据 |
| REQ-101 | 支线 | 中 | Accepted | [（请求：QED-Tracker）论文链路领域/课程 scope 化与书本化采纳（paper-scope-books-adoption-request）](../plans/2026-09-30-req101-paper-scope-books-adoption-request.md) —— 跨项目请求、并入对方 QED-068 本期计划承接：8901 论文 recommend 增领域/课程 scope 与前沿/核心配方，显式 pick 产出 qt_books kind=paper 行纳入书本下载链（改判 QED-071 D2/D14 发现论文不进库口径，2026-09-30 用户裁决），目标 = 领域/课程可各自沉淀前沿/核心论文清单（探索仅领域级发起、pick 逐条落位领域或课程） | S1 R1~R4 逐条有对方回执（承接/后置/拒绝+排期）且 ARCH-024 壳线 2 条目可跟踪状态；S2 R1 落地：recommend 入参与选书报告含 domain_id/course_id、selections 查询支持 scope 过滤、不带参数时行为兼容；S3 R2 落地：pick 产出 kind=paper 书行（标识=arXiv ID）且下载/验收走书本五层态链、查重=书库命中；S4 R3 落地：recipe frontier/core 进任务请求体、非法值 422；S5 R4 存量回填口径有回执（补登记或声明只读）；S6 落地事实源在对方台账、根侧不双写 |
| REQ-103 | 支线 | 中 | 进行中 | [领域维护表单字段口径与默认值（downloads-ui §3.1）](../design/frontend/downloads-ui.md) —— 跨项目请求（目标=QED-Tracker 普通任务轮滚动缺陷台账 BUG-004）：8901 领域探索真读取表单的 description/scope/level/stages 四字段（现仅送领域名，且 description/stages 被探索输出就地覆盖），根侧三处表单同步改默认值与字段顺序，目标 = 用户填的领域描述/学科知识/探索范围/学习阶段真正决定探索输入与范围边界 | S1 对方台账 BUG-004 有承接状态与排期可跟踪；S2 domain 提示词入参含四字段、scope 非空时覆盖内置默认边界；S3 用户写过的 description 在探索回写中保留、仅空值取生成结果；S4 level 为空串时课程梳理的范围提示回退内置默认而非空值；S5 根侧三处表单的顺序/标签/默认值与设计 §3.1 一致并通过前端门禁与浏览器实测 |

### Axiom-Flow（V1.0）优化轮（解析 + 知识库）（ARCH-025）

| ID | 类别 | 优先级 | 状态 | 任务描述 | 成功标准 |
| --- | --- | --- | --- | --- | --- |
| ARCH-025 | 主线 | 中 | In Progress | [Axiom-Flow（V1.0）解析与知识库优化滚动记录（axiom-flow-v1-parsing-knowledge-optimization）](../plans/2026-09-22-axiom-flow-v1-parsing-knowledge-optimization.md) —— Axiom-Flow（V1.0）优化轮（解析 + 知识库）：对解析产物「大模型易消费 JSON」与知识库面（af_* 演进、RAG 切片和检索预留）两线优化做逐条登记与跟踪，目标 = 解析管线与知识库面向 V1.0 收敛 | S1 两线（解析产物 JSON／知识库面 af_* 与 RAG 预留）登记表条目状态与对方台账实际一致；S2 涉及子项目的工作按跨项目协作规范向 Axiom-Flow 登记请求并可跟踪回执；S3 根侧修复类条目（8900 消费适配、af_* 骨架文档）回归门禁全绿并留证据；S4 启动门槛＝对方达 V1.0 版本，未达前只预存承接行不实施；S5 渲染面归 ARCH-027-M1、知识图谱与对话问答不在本线判据内；S6 上游关联项（如 REQ-086/087）收口时同步回填本壳对应条目 |
| REQ-099 | 支线 | 中 | Accepted | [（请求：Axiom-Flow）解析页区域驱动重解析与块结构编辑（parsing-region-edit-request）](../plans/2026-09-26-req098-parsing-region-edit-typography-axiom-flow-request.md) —— 承 REQ-098 的跨项目请求（R1 区域驱动页解析/R2 块结构编辑 API/R3 页框图读取视图/R4 目录类型/R5 节题与多栏取字/R6 未完成页清单或 skip_parsed），目标 = 框图落库后「解析本页」按区域出字 | S1 R1~R6 逐条有对方回执（落地／推后／拒绝 + 排期）；S2 R1~R3 回执落地后根侧框图结构操作（画框/删除/合并）全量启用，且「画 N 框→解析本页→出 N 块且 bbox 与框一致」判据跑通；S3 R4/R5 可独立晚接不阻塞主判据；S4 实施与回执事实源在对方台账与承接壳 PLAN-018，根侧不双写 |

### 普通任务轮（ARCH-035）

| ID | 类别 | 优先级 | 状态 | 任务描述 | 成功标准 |
| --- | --- | --- | --- | --- | --- |
| ARCH-035 | 主线 | 中 | In Progress | [普通任务轮滚动记录（零散缺陷·小修·治理与规范化批次承载）（ordinary-tasks-round）](../plans/2026-09-29-ordinary-tasks-round.md) —— 台账的**默认承载轮**：零散缺陷、`design/` 小修、治理小批次、规范化批次与已关闭轮次残留支线一律在本壳登记表开条目，目标 = 小改动有条目、有回归测试、有收口证据，且不为此另立主线轮（ADR 0021 第 1 条） | S1 每条工作在承载壳登记表有条目行（缺陷 ID + 现象一句话 + 涉及文件）；S2 每条代码修复有回归测试、先红后绿，并同步受影响设计文档；S3 每条关闭写入 completed.md（关闭结果 + 门禁证据），todo 不留尾行；S4 滚动存续由登记表「（待登记）」占位行声明，占位行消失且条目全达成即须关闭本壳 |
| REQ-116 | 支线 | 中 | In Progress | [文档分析处理模块设计稿（解析产物→目录/知识点/学习链路/习题讲解·待晋升·细节移交 Axiom-Flow）（doc-analysis-processing）](../plans/2026-10-15-doc-analysis-processing.md) —— 后台管理侧新模块的前端可见设计稿：解析产物→①生成修正课本目录②登记确认知识点③编排课本学习链路④关联课后习题讲解，驱动=LLM 自动+人工确认，与 parsing-ui/学习中心边界不重叠；路由 #/admin/analysis 与中文名已由用户裁决，根侧持设计稿、后续细节由 Axiom-Flow 负责，承接口径回填后晋升 design/frontend/ | S1 前端可见视角设计稿落 plans/（定位+三职责+输入输出+与 parsing-ui/学习中心不重叠边界+驱动 LLM 自动+人工确认）；S2 路由与模块中文命名经用户确认；S3 后续细节（分析算法/后端端点/知识点两表写入/习题讲解来源）向 Axiom-Flow 移交并可跟踪回执；S4 确认后晋升 design/frontend/doc-analysis.md、补元数据并纳入 test_design_documents 守护 |
| REQ-119 | 支线 | 中 | In Progress | [四张共享表字段定档跨项目请求稿（QED-Tracker 承接）（shared-tables-tracker-request）](../plans/2026-10-16-shared-tables-tracker-request.md) —— （请求：QED-Tracker）领域表与课程表形状定档承接：加 meta 扩展槽、domain_id 32→64、level/scope 注释口径、两枚死列（path_results／related_targets）删列、qed_llm_calls 文档快照随步；目标 = 四张共享表形状一次定死，后续加字段不再改表结构 | S1 R1~R6 逐条在对方 todo 有承接行，且对方承接稿声明需求方/目标项目/接口面/评审方/执行方/验收标准六项；S2 对方逐条回执为落地／推后／拒绝之一并附其门禁输出；S3 R1/R2 回执落地后根侧 shared_tables.py 列清单与 database-design.md 消费语义同批随步；S4 根侧不代改对方代码，误产生的改动即登记移交 |
| REQ-120 | 支线 | 中 | In Progress | [根私有表前缀改名 qe_learn_* 与共享库总纲四段式重排（root-private-prefix-and-four-part-design）](../plans/2026-10-16-root-private-prefix-and-four-part-design.md) —— 把根自建的七张 `qed_learn_*` 表改名为独立前缀 `qe_learn_*`（消灭「居共享命名空间、仅根读写」的反向例外），并把总纲 database-design.md 按共享 `qed_*` → `qt_*` → `af_*` → 根私有 `qe_*` 的四段优先级重排登记，顺带修正 `af_*`/`qt_*` 表清单与读写矩阵的登记漂移；目标 = 前缀即所有权、阅读顺序即变更权重 | S1 总纲按四段顺序成文且每段表清单与所有权方文档一致（四段顺序判据以 ADR 0025 决定 3 为准，成文改判见承载壳）；S2 `af_*`/`qt_*` 表数与清单修正为五表（补 `af_page_regions`／`qt_selections`）且读写矩阵的降级直写列清单逐列写清不再「同上口径」；S3 现名 `qed_learn_*` 与目标名 `qe_learn_*` 在总纲并列声明，文档不领先库内事实；S4 代码批次落地后七张表在 `qed_test` 以新名实存、旧名不存在且逐表行数一致，全仓无存活旧名引用；S5 契约门禁的零 DDL 与 erDiagram 守护不回归 |
| REQ-123 | 支线 | 中 | Accepted | [af_books 书级三列回写与跨库分叉归一跨项目请求稿（Axiom-Flow 承接）（af-books-parse-status-request）](../plans/2026-10-17-af-books-parse-status-request.md) —— （请求：Axiom-Flow）按其 ADR 0007 三分语义把 `af_books` 三列写成自洽：R1 重新摄取复位 `active_job_id` 与 `pages_done` 时 `last_parse_result` 仍保留旧结局，致「completed 但无可读版本」行；R2 对 `qed`／`qed_test` 两库分叉行做只读对账并给归一口径；目标 = 8900 与 8903 只读消费时三列不再互相打脸 | S1 R1/R2 逐条有对方回执（落地／推后／拒绝之一 + 排期）并附其门禁输出；S2 对方按其 ADR 0011 在既有支线壳（ARCH-022／PLAN-019 一族）内加承接条目，不新立请求行；S3 回执落地后根侧 `GET /books` 三列复核通过＝`last_parse_result=completed` 的书其 `active_job_id` 非空或该结局被明确复位口径覆盖；S4 根侧不代改对方代码与文档，误产生的改动即登记移交 |
| REQ-128 | 支线 | 低 | 进行中 | （请求：QED-Tracker）`qt_tasks`／`qt_selections` 保留期口径自定：两张作业表全仓无清理与轮转规则，根侧总纲已把边界成文——保留窗取值与裁剪执行属所有权方，根侧不代设数值、不代执行，不可裁剪行（未终态与被指针引用）与触发阈值判据见 [普通任务轮壳 W5](../plans/2026-09-29-ordinary-tasks-round.md)；请对方就这两张表给出自定保留窗或「不清理」的明文口径并写入其库表事实源；目标 = 每张流水表有一个由其所有权方负责的保留期口径 | S1 对方台账有承接行或明确拒绝留档，其承接稿声明需求方/目标项目/接口面/评审方/执行方/验收标准六项；S2 对方两张表各有保留窗或「不清理」的明文口径且与其库表事实源一致；S3 回执为落地／推后／拒绝之一并附其门禁输出；S4 根侧不代改对方代码与库内数据，误产生的改动即登记移交 |
| REQ-129 | 支线 | 低 | 进行中 | （请求：Axiom-Flow）`af_parse_jobs` 保留期口径自定：解析作业表只增不删且删行等于抹掉一段解析版本史，根侧总纲已把它归入备份确认档并成文边界——保留窗取值与裁剪执行属所有权方，根侧不代设不代执行，触发阈值与不可裁剪行判据见 [普通任务轮壳 W5](../plans/2026-09-29-ordinary-tasks-round.md)；请对方就该表给出自定保留窗或「不清理」的明文口径并写入其库表事实源；目标 = 版本化作业表有一个由其所有权方负责的保留期口径 | S1 对方台账有承接行或明确拒绝留档，其承接稿声明需求方/目标项目/接口面/评审方/执行方/验收标准六项；S2 该表有保留窗或「不清理」的明文口径且与 `af_*` 事实源文档一致，且声明保留被 `af_books.active_job_id` 引用之行的不变量；S3 回执为落地／推后／拒绝之一并附其门禁输出；S4 根侧不代改对方代码与库内数据，误产生的改动即登记移交 |

### 长期任务

| ID | 类别 | 优先级 | 状态 | 任务描述 | 成功标准 |
| --- | --- | --- | --- | --- | --- |
| REQ-062 | 长期 | 中 | 进行中 | **AI 开发指引优化（收件箱机制）**：四段式——① **捕获**：大任务完成后把 agent 利用经验写入 [ai-agent-knowledge-inbox.md](../plans/ai-agent-knowledge-inbox.md)（长期滚动收件箱，不随任务归档）；② **审核**：三判据逐条过；③ **批量晋升触发**：达阈值或每月例行；④ **体系优化**：聚类产出结构性结论，修订正式文档乃至开发流程；目标 = 经验不重复踩、正式文档随实践收敛 | S1 大任务完成后经验条目进入收件箱；S2 入池三判据（复用价值／非瞬时状态／未被正式文档覆盖）逐条过，任一不满足不入池；S3 触发条件（待评审 ≥10 条、单主题聚集 ≥3 条或每月例行，先到为准）达成时产出聚类结论并修订正式文档；S4 每次入池/晋升后 `tests/contract` 门禁全绿 |
| REQ-046 | 长期 | 高 | 进行中 | API 接口开发：先确定接口类型，按类型写 API 文档落入各自项目——① QED-Engine 前端无 API（静态页面只连 8900，声明于 [api-contracts](../architecture/api-contracts.md)）；② QED-Engine 后端三类（控制域启停/重启/健康、QED-Tracker 透传及相关处理、Axiom-Flow 透传及相关处理）；③ QED-Tracker 三类（自身生命周期+健康、数据库知识查询传递、LLM 检索课程教程/选书业务）；④ Axiom-Flow 四类（生命周期+健康、数据查询、解析结果与 PDF 对照、未来 RAG/知识图谱预留）；检查是否有遗漏；关联 ARCH-012（全流程跑通 + Axiom-Flow 完成前端验收 + 流程完整走完为止） | S1 四类接口在 api-contracts 有归类且与真实实现一致、无遗漏项；S2 8901/8902 契约唯一事实源在子项目侧文档，根侧只留指针无副本；S3 子项目 API 文档的补充经请求由对方执行并可跟踪回执 |
| REQ-047 | 长期 | 高 | 进行中 | 数据库设计：QED-Engine [database-design](../architecture/database-design.md) 为**三项目数据库总设计正本**（ADR 0025：共享 `qed_*` 四表与根私有 `qe_learn_*` 七表逐列定义＋建表语句并与实现事实源机器对齐，含总览表清单、mermaid 关系视图与表×服务读写矩阵；`qt_*`/`af_*` 两族在总览登记与路由，逐列晋升属后续批次）；QED-Tracker 保有其库的实施事实源（`src/qed_tracker/db/models.py` 模型即 schema，无 Alembic），Axiom-Flow 保有 `af_*` 的 Alembic 迁移面；文档权威归属不产生运行时依赖，根项目未启动时 8901/8902 仍可独立运行 | S1 总览表、读写矩阵与表族小节三处表名与表数逐段一致并有守护；S2 表×服务读写矩阵随建表与权限变化同步更新；S3 根侧正本九表建表语句与代码逐字对齐、受托两表与对方 ORM 同列同序同型；S4 `qt_*`/`af_*` 结构变更走跨项目登记，根侧不代改对方代码与迁移面；S5 版本机制（ADR 0010）下的迁移与所有权变更可追溯 |
| REQ-050 | 长期 | 中 | 进行中 | 版本更新文档体系重新梳理：每次版本更新（用户确认升版本时）按 [文档治理规范](../standards/doc-governance.md) 的 ADR 0010 版本机制重新梳理三项目文档体系——architecture/ 固定化维护（总体/服务架构/API/数据库/code-map）、guides 操作与开发文档、trackers 主线归并（完成→completed.md）、design 三态梳理、plans 归档、子项目范本对齐跟进（REQ-048/049 同源）；目标 = 版本边界处文档体系与代码不漂移 | S1 每次版本收口触发一轮五面梳理（architecture/guides/trackers/design/plans）并留记录；S2 完成任务归并进 completed.md、todo 无滞留行；S3 design 三态梳理与 plans 归档执行到位、链接门禁全绿；S4 子项目范本对齐经请求由对方执行 |
| REQ-100 | 长期 | 中 | In Progress | [本地模型调试与优化（长期滚动）（local-model-debug-optimization-longterm）](../plans/2026-09-29-local-model-debug-optimization-longterm.md) —— 本地模型服务栈（LM Studio / llama.cpp / MinerU 容器）的持续调试、取证与参数标定长期线：掉线三类假设定谳、水位/宽限/退避阈值标定、空闲驱逐观察、吞吐与延迟画像；目标 = 稳定性轮交付的监督器与闸门有现场数据可依、默认值可调准 | S1 每次取证（命令／事件账／评分记录）落壳一行，含时间、命令与结论，结论回写设计文档已知约束（壳判据 J1）；S2 参数标定（水位阈值、宽限时长、退避节奏）改动默认值时带现场数据证据并同批改设计节（J2）；S3 移交承接项与原出处（ARCH-028 / DEFECT-005）口径一致、不双写事实（J3）；S4 观察窗发现新缺陷时按缺陷通道另登 DEFECT 行、不在本行直接覆盖（J4） |

## 规则

本节**只放指针，不复述判据正文**（同一规则有两处正文即视为漂移）。登记与收口细则的唯一正文是
[任务生命周期](../standards/task-lifecycle.md)（其「目的与边界」节载有全链路叙述分工表）；变更
分级判据在根 [AGENTS.md](../../AGENTS.md)，六步流程与门禁命令在[开发指南](../guides/development.md)，
跨项目请求行的「（请求：<目标项目>）」标注与回执口径在
[跨项目协作规范](../standards/cross-project-collaboration.md)。

| 本表条目 | 判据唯一正文（任务生命周期） | 机械守护 |
| --- | --- | --- |
| ID（格式与前缀清单） | 强制规则·任务台账结构 | `test_task_ids_are_stable_unique_and_rows_are_complete` |
| 类别（主线 / 支线 / 长期） | 强制规则·任务层级（todo 类别列） | `test_task_categories_follow_hierarchy_enum` |
| 优先级（高 / 中 / 低） | 强制规则·优先级规则 | 行完整性守护（同上） |
| 状态（只允许进行中态，终态词即移除本行） | 状态导航·todo 状态 | G1 `test_todo_status_column_uses_open_status_enum_only` |
| 任务描述（一句话「做什么 + 目标」 + 文档锚；镜像行整格链壳） | 任务台账结构 + 收口节拍、薄登记上限与承载归属 | G5 `test_todo_task_rows_carry_a_document_anchor`、`test_todo_plan_rows_exactly_mirror_active_plan_bodies` |
| 成功标准（S 条目化、≤400、禁日期与进展词；正本在行、写定不改） | 任务台账结构 + 状态导航·成功标准列格式 | G2 `test_todo_success_criteria_column_is_fixed_and_bounded` |
| 过程与证据（逐批进展、裁决、门禁输出、「待提交」占位的唯一落点） | 计划契约与状态·过程与证据落壳 | G7 `test_active_plans_carry_a_dated_process_log_section` |
| 分节标题（关闭轮不留节、归并不删壳） | 收口节拍、薄登记上限与承载归属 | G6 `test_todo_section_headings_point_at_live_rounds_or_generic_sections` |
| 收口与扩载（达成即收、长期线豁免、成功标准冻结、改判须用户裁决） | 收口节拍、薄登记上限与承载归属 | G3 / G4（`tests/contract/test_plan_governance.py`） |
| 活跃计划的状态事实源 | 状态导航·事实源规则 | `test_todo_plan_rows_exactly_mirror_active_plan_bodies` |
