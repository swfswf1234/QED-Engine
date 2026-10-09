# 任务台账

状态：Current
最后更新：2026-10-09

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
| ARCH-027-M3 | 支线 | 高 | Accepted | [学习设计轮 M3·本地模型适配层（local-model-adaptation）](../plans/2026-09-23-local-model-adaptation.md) —— 网关本地降级组合移植（L7）：能力表、JSON 容错 + 一次 repair、thinking 清洗、饥饿降 effort 重试、task model 兜底；目标 = 本地模型下学习链路调用可靠且可一键回退 | S1 A-5/A-6 两项适配落地且对应开关全绿（A-2 工具协议段按裁决后置，不入本任务判据）；S2 能力表 + 降级路径：四类 binding 的 `supports_tools:False` 走文本协议段，JSON 模式渠道走 response_format + 降级；S3 容错三件套：JSON 修复 + 一次 repair、thinking/scratchpad 清洗、reasoning 预算饥饿降 effort 重试，各有单元用例；S4 真机冒烟：本地模型下出题与判分链路各跑通一次，且一键回退可验证 |
| ARCH-027-M4 | 支线 | 低 | Accepted | [学习设计轮 M4·知识探索（问答与召回消费面，后置）（knowledge-exploration）](../plans/2026-09-23-knowledge-exploration.md) —— 知识探索消费面：轻形态（知识体系浏览维持 + ask_questions 澄清访谈入主链提案）先行，对话式 RAG 问答后置；目标 = 学习链路旁路的问答与召回消费面 | S1 轻形态维持：知识体系浏览面可用、无回归，8903 只连 8900；S2 澄清访谈入主链提案：ask_questions 在课程/链路立项前做一次访谈式问答；S3（后置）对话式 RAG 问答：8902 检索端点打通后 chunk 级 self_ref 溯源可跳回原页原文，前置＝对方端点就绪 + 用户发令联调 |
| REQ-070-LEARN | 支线 | 高 | In Progress | [学习功能现状（知识探索/课程学习/课后练习）](../plans/2026-09-10-learning-center-current-state.md) —— 学习三功能现状基座承载行，为学习设计轮（ARCH-027 及 M1~M5）重设计提供现状事实源；目标 = 现状描述可被设计直接引用，设计定稿后按 ADR 0011 晋升 design/ 并退役本壳 | S1 现状描述与真实代码一致（`#/knowledge` 框架、课程学习在探索、课后练习无设计声明三点）；S2 相关功能变化时本壳同步更新，不留过期描述；S3 设计定稿时文档内容可直接迁入 design/ 固定文档，本壳随之退役 |

### 本地模型稳定性轮（ARCH-028）

| ID | 类别 | 优先级 | 状态 | 任务描述 | 成功标准 |
| --- | --- | --- | --- | --- | --- |
| ARCH-028 | 主线 | 高 | In Progress | [本地模型稳定性轮滚动记录（仪表盘状况卡·监督器·掉线根因·批次水位）（local-model-stability-round）](../plans/2026-09-23-local-model-stability-round.md) —— 本地模型服务稳定性轮：仪表盘「本地模型状况」卡（api 模式隐藏、单活守卫下跟踪当前在跑模型，互斥被绕过并列多跑时并列呈现不隐藏）+ 8900 常驻监督器（分级探测/防抖事件账/非在飞自动重启在飞只告警/显存水位门/掉线诊断包）+ 50 页/窗批次（根 .env 配 `AXIOM_PARSE_WINDOW_SIZE=50`）；目标 = 本地模型「看得见、管得住、喂不饱不死、等不到快挂」 | S1 状况卡按显隐/单卡规则实时反映状态（含降级态与失败原因），API 模式整卡隐藏；S2 监督器闭环：探针翻转防抖 + 事件账 + 非在飞自动重启（退避≤3 次）+ 在飞只告警，注入杀容器可观测恢复；S3 图像模型掉线三类假设定谳——移交 REQ-100 L1，不作本行关闭前置；S4 全本解析按 ≤50 页/窗执行且 OOM 不再现；S5 冷启动不误判掉线、恢复不叠发（宽限窗内不推进防抖、不耗恢复预算、不发诊断包；restart 闩锁单发）；S6 显存水位门：空闲显存低于阈值（默认 12GB）拒起并记事件，探针失败按不达标处理（fail-closed）；S7 请求侧熔断快挂（W11）有回归用例 |

### QED-Tracker（V1.0）持续优化轮（ARCH-024）

| ID | 类别 | 优先级 | 状态 | 任务描述 | 成功标准 |
| --- | --- | --- | --- | --- | --- |
| ARCH-024 | 主线 | 中 | In Progress | [QED-Tracker V1.0 持续优化滚动记录（tracker-v1-continuous-optimization）](../plans/2026-09-22-tracker-v1-continuous-optimization.md) —— QED-Tracker（V1.0）持续优化轮：为其探索/下载链路的三线优化（本地模型链路、论文探索和下载、下载链路评估与 bug 修复）做逐条登记与跟踪，目标 = 8901 检索/下载链路持续改进并向 V1.0 收敛 | S1 三线（本地模型链路／论文探索与下载／下载链路与 bug 修复）的登记表条目状态与对方台账实际一致；S2 涉及子项目的工作按跨项目协作规范向 QED-Tracker 登记请求并可跟踪回执；S3 根侧修复类条目（8900 适配、前端消费面）回归门禁全绿并留证据 |
| REQ-101 | 支线 | 中 | Accepted | [（请求：QED-Tracker）论文链路领域/课程 scope 化与书本化采纳（paper-scope-books-adoption-request）](../plans/2026-09-30-req101-paper-scope-books-adoption-request.md) —— 跨项目请求、并入对方 QED-068 本期计划承接：8901 论文 recommend 增领域/课程 scope 与前沿/核心配方，显式 pick 产出 qt_books kind=paper 行纳入书本下载链（改判 QED-071 D2/D14 发现论文不进库口径，2026-09-30 用户裁决），目标 = 领域/课程可各自沉淀前沿/核心论文清单（探索仅领域级发起、pick 逐条落位领域或课程） | S1 R1~R4 逐条有对方回执（承接/后置/拒绝+排期）且 ARCH-024 壳线 2 条目可跟踪状态；S2 R1 落地：recommend 入参与选书报告含 domain_id/course_id、selections 查询支持 scope 过滤、不带参数时行为兼容；S3 R2 落地：pick 产出 kind=paper 书行（标识=arXiv ID）且下载/验收走书本五层态链、查重=书库命中；S4 R3 落地：recipe frontier/core 进任务请求体、非法值 422；S5 R4 存量回填口径有回执（补登记或声明只读）；S6 落地事实源在对方台账、根侧不双写 |
| REQ-103 | 支线 | 中 | 进行中 | [领域维护表单字段口径与默认值（downloads-ui §3.1）](../design/downloads-ui.md) —— 跨项目请求（目标=QED-Tracker 普通任务轮滚动缺陷台账 BUG-004）：8901 领域探索真读取表单的 description/scope/level/stages 四字段（现仅送领域名，且 description/stages 被探索输出就地覆盖），根侧三处表单同步改默认值与字段顺序，目标 = 用户填的领域描述/学科知识/探索范围/学习阶段真正决定探索输入与范围边界 | S1 对方台账 BUG-004 有承接状态与排期可跟踪；S2 domain 提示词入参含四字段、scope 非空时覆盖内置默认边界；S3 用户写过的 description 在探索回写中保留、仅空值取生成结果；S4 level 为空串时课程梳理的范围提示回退内置默认而非空值；S5 根侧三处表单的顺序/标签/默认值与设计 §3.1 一致并通过前端门禁与浏览器实测 |

### Axiom-Flow（V1.0）优化轮（解析 + 知识库）（ARCH-025）

| ID | 类别 | 优先级 | 状态 | 任务描述 | 成功标准 |
| --- | --- | --- | --- | --- | --- |
| ARCH-025 | 主线 | 中 | In Progress | [Axiom-Flow（V1.0）解析与知识库优化滚动记录（axiom-flow-v1-parsing-knowledge-optimization）](../plans/2026-09-22-axiom-flow-v1-parsing-knowledge-optimization.md) —— Axiom-Flow（V1.0）优化轮（解析 + 知识库）：对解析产物「大模型易消费 JSON」与知识库面（af_* 演进、RAG 切片和检索预留）两线优化做逐条登记与跟踪，目标 = 解析管线与知识库面向 V1.0 收敛 | S1 两线（解析产物 JSON／知识库面 af_* 与 RAG 预留）登记表条目状态与对方台账实际一致；S2 涉及子项目的工作按跨项目协作规范向 Axiom-Flow 登记请求并可跟踪回执；S3 根侧修复类条目（8900 消费适配、af_* 骨架文档）回归门禁全绿并留证据；S4 启动门槛＝对方达 V1.0 版本，未达前只预存承接行不实施；S5 渲染面归 ARCH-027-M1、知识图谱与对话问答不在本线判据内；S6 上游关联项（如 REQ-086/087）收口时同步回填本壳对应条目 |
| REQ-099 | 支线 | 中 | Accepted | [（请求：Axiom-Flow）解析页区域驱动重解析与块结构编辑（parsing-region-edit-request）](../plans/2026-09-26-req098-parsing-region-edit-typography-axiom-flow-request.md) —— 承 REQ-098 的跨项目请求（R1 区域驱动页解析/R2 块结构编辑 API/R3 页框图读取视图/R4 目录类型/R5 节题与多栏取字/R6 未完成页清单或 skip_parsed），目标 = 框图落库后「解析本页」按区域出字 | S1 R1~R6 逐条有对方回执（落地／推后／拒绝 + 排期）；S2 R1~R3 回执落地后根侧框图结构操作（画框/删除/合并）全量启用，且「画 N 框→解析本页→出 N 块且 bbox 与框一致」判据跑通；S3 R4/R5 可独立晚接不阻塞主判据；S4 实施与回执事实源在对方台账与承接壳 PLAN-018，根侧不双写 |

### 普通任务轮（ARCH-035）

| ID | 类别 | 优先级 | 状态 | 任务描述 | 成功标准 |
| --- | --- | --- | --- | --- | --- |
| ARCH-035 | 主线 | 中 | In Progress | [普通任务轮滚动记录（零散缺陷·小修·治理与规范化批次承载）（ordinary-tasks-round）](../plans/2026-09-29-ordinary-tasks-round.md) —— 台账的**默认承载轮**：零散缺陷、`design/` 小修、治理小批次、规范化批次与已关闭轮次残留支线一律在本壳登记表开条目，目标 = 小改动有条目、有回归测试、有收口证据，且不为此另立主线轮（ADR 0021 第 1 条） | S1 每条工作在承载壳登记表有条目行（缺陷 ID + 现象一句话 + 涉及文件）；S2 每条代码修复有回归测试、先红后绿，并同步受影响设计文档；S3 每条关闭写入 completed.md（关闭结果 + 门禁证据），todo 不留尾行；S4 滚动存续由登记表「（待登记）」占位行声明，占位行消失且条目全达成即须关闭本壳 |
| REQ-091 | 支线 | 中 | 待开始 | 探索会话持久化（8900）：会话纯内存态重启即丢、课程侧探索失败无列落库（与领域侧不对称）；根因与落点见 [普通任务轮壳 W4](../plans/2026-09-29-ordinary-tasks-round.md) | S1 探索会话按 session_id 持久化，8900 重启后可取回会话；S2 课程侧探索失败与领域侧对称落库（有列可查）；S3 重启恢复路径有回归测试且门禁全绿 |
| REQ-092 | 支线 | 低 | 待开始 | 账本保留期策略：LLM 调用账本与任务/选书/解析作业表均无清理或轮转规则，需成文保留期与归档口径；范围与跨项目约束见 [普通任务轮壳 W5](../plans/2026-09-29-ordinary-tasks-round.md) | S1 保留期与归档口径成文（调用账本 + 任务/选书/解析作业表逐一有规则）；S2 落点与 storage-conventions 口径一致、无冲突表述；S3 涉及跨项目表的约束已向对方登记请求并可跟踪 |
| REQ-096 | 支线 | 低 | 待开始 | 存储对账 doctor（前瞻）：库↔盘双向只读核验（幻影记录、孤儿文件、哈希失配、file_path 三处漂移），实施另立设计；登记缘由与判据见 [普通任务轮壳 W6](../plans/2026-09-29-ordinary-tasks-round.md) | S1 四类漂移（幻影记录／孤儿文件／哈希失配／file_path 漂移）各有检出路径与判据；S2 只读核验设计与实施范围成文并经用户评审；S3 默认不写数据根，纯只读且有测试 |
| OPS-001 | 支线 | 低 | 待开始 | 服务域 stop 对外部实例失效：非经服务域启动的 8901 被 stop 时 pid=null 杀不到真进程，修向＝stop 前端口探测补全 pid；复现记录与修复方向见 [普通任务轮壳 W7](../plans/2026-09-29-ordinary-tasks-round.md) | S1 stop 前按端口探测补全 pid，非经服务域启动的实例可被 stop 命中；S2 「pid=null 但端口在听」场景有回归测试且门禁全绿；S3 四单元 stop 行为经真机复核 |
| REQ-031 | 支线 | 低 | 待开始 | 使用手册完善（8903）：HELP_SECTIONS 六节内容粗略，待学习中心功能稳定后逐界面细化（截图/分步图文/FAQ/五阶段配图）；细化面见 [普通任务轮壳 W8](../plans/2026-09-29-ordinary-tasks-round.md) | S1 HELP_SECTIONS 六节逐节有实质内容（截图或分步图文）；S2 覆盖五阶段配图与 FAQ；S3 描述与当前界面对应，无过期说法 |
| ARCH-036 | 支线 | 中 | In Progress | [运行时产物与备份面规范化（logs/tmp/scripts/backups 落点收口）（runtime-artifact-placement-round）](../plans/2026-09-29-runtime-artifact-placement-round.md) —— 仓库根运行面落点收口：日志只写 `logs/`、临时产物只写 `tmp/`、`scripts/` 只留必要面、仓库内不设备份位；目标 = 散落可判定、长期日志清单正向声明、备份不再沉积 | S1 ADR 0019 立档 + 标准补节 + adr/index 登记；S2 契约守护先红后绿：哨兵区与正文 ADR 引用双向一致、`*.log`/`*.pid` 只在 `logs/`+`tmp/`、仓库内备份位不存在；S3 8900 日志读取按实际写入点，四单元 `log_path` 指向真实文件；S4 存量清理：`logs/` 只剩长期清单、`scripts/` 只留必要面、`.gitignore` 相关条目移除；S5 文档（设计/契约/运维/code-map）日志口径与实际一致；S6 `dataset/backups/` 清空与 8900 重启后日志视图真机复核 |
| DEFECT-007 | 支线 | 中 | 待验收 | 8900 日志视图读到陈旧/不存在文件：`/logs/{service}` 与 `/services` 的 `log_path` 按 `logs/<log_name>.log` 猜测命名，tracker/axiom/web 三单元实写各自生命周期脚本产物（`qed-*-serve.log`，8901/8902 在子仓库 `logs/`）；修向＝按 spec workdir 派生实际写入点、缺失文件空态返回（随 [ARCH-036 壳 W2](../plans/2026-09-29-runtime-artifact-placement-round.md) 承载，不另立计划） | S1 tracker/axiom/web/qed 四单元的日志路径按 spec workdir 派生且指向真实存在的文件；S2 目标文件缺失时返回空态而非猜测路径；S3 `tests/test_log_viewer.py` 与 `tests/test_api.py` 有先红后绿的回归用例；S4 8900 重启后经 `GET /services` 与 `GET /logs/` 三口真机复核通过 |
| DEFECT-009 | 支线 | 中 | 进行中 | 8900 知识点两表懒挂载失败后永久锁死：`backend/qed_engine/api/learn.py:_mount_knowledge_store` 首个请求建表失败即置 `knowledge_store_attempted`，此后 `/kp-details`／`/knowledge-points` 恒 503，须重启进程才恢复；同处 `/learn/star-map` 直读 `app.state.knowledge_store` 不触发挂载，知识点计数长期假 0。修向＝失败只按短窗（60s）降级、挂载成功才长驻缓存，星图与其余知识点端点走同一挂载入口。根因与取证见 [普通任务轮壳 W14](../plans/2026-09-29-ordinary-tasks-round.md)，不另立计划 | S1 建表失败仅在重试窗口内降级，窗口过后数据库恢复即自愈，回归用例先红后绿；S2 重试窗口内不重复打库（每请求吃一次建表超时的形态被消除）；S3 `/learn/star-map` 触发懒挂载且库可用时知识点计数不再恒 0；S4 8900 重启后真机复核 `/kp-details` 返回 200 且星图计数与库内行数一致 |
| OPS-002 | 支线 | 中 | 待验收 | 服务启停失败原因被「连接失败」掩盖（8900 控制域）：生命周期脚本单元秒崩时 `_op_status` 仍在 15s 过渡窗口内报 `starting`（前端干等），窗口过后 `service_status` 又对已不存在的托管 PID 回中性的 `连接失败`，真实原因只在子仓库 serve 日志里；修向＝托管 PID 存活判定进状态判定，进程已退出即提前结束窗口并回带日志指针的原因（与 OPS-001 同族）。根因取证与落点见 [普通任务轮壳 W15](../plans/2026-09-29-ordinary-tasks-round.md) | S1 脚本单元启动后进程已退出时 `/services` 在 15s 窗口内即返回 offline 且 `reason` 含「进程已退出」；S2 进程存活而端口未起时 `starting`→`连接失败` 原语义不变；S3 `tests/test_api.py` 两分支先红后绿有回归用例；S4 真机复核 8902 控制台显示启动失败原因；S5 service-hosting.md 的 `reason` 取值与过渡窗口口径随步 |
| ARCH-037 | 支线 | 中 | 待验收 | 控制台资源监控改「占用视角」（8903 GpuOverview）：现卡只有三色饼图 + 「当前在跑（API/本地）」一行，看不出谁在吃显存；修向＝删在跑行，增「本地模型显存占用（未启用不显示）」+「逐应用显存大户清单（≥10% 全部照实列，含系统进程）」+「总显存 ≥95% 高位提示（仅提示不处置）」。落点与判据见 [普通任务轮壳 W16](../plans/2026-09-29-ordinary-tasks-round.md) 与 [admin-console.md](../design/admin-console.md) §3.3 | S1 本地模型未启用时占用行整行不渲染；S2 启用时占用行给出模型身份与占总显存比例，数据源为既有 `/monitor/gpu` 逐进程明细；S3 ≥10% 显存大户逐条列出（名/占用/比例）且阈值与 95% 高位线为具名常量；S4 总显存 ≥95% 出提示、<95% 不出现，无任何自动处置；S5 纯函数有 vitest 用例且 admin-console.md §3.3 与实现一致 |
| ARCH-038 | 支线 | 中 | 待验收 | 控制台分批刷新（8903 runtime store + Console）：八路并发拉取只有一个全局 `loading`，「刷新」要等最慢路（真机 `/models/vision` 1.07s、超时上限 8s）才停，且槽位/服务启停的 15s 收敛窗口内 `fetchAll` 被防重入挡住整页不刷新；修向＝store 暴露分路 pending 集合，Console 三分区（服务管理／基础设施／资源监控含三槽位卡）按各自分区 Spin 呈现，快路先显示慢路转圈。取证与落点见 [普通任务轮壳 W17](../plans/2026-09-29-ordinary-tasks-round.md) | S1 store 有分路 pending 状态且各路落定即清；S2 Console 三分区各自转圈，已回分区不被慢路拖累；S3 「刷新」按钮不再等最慢路；S4 防重入语义保持（操作收敛期不叠加拉取）且有 vitest 用例；S5 admin-console.md §5 Store 设计随步 |
| ARCH-039 | 支线 | 低 | 待验收 | 控制台不再显示向量槽位卡（8903）：用户裁决向量模型暂无必要，资源监控区只留文字/图像两卡；数据面不动（`/models/embedding` 仍随 `fetchAll` 轮询入 store，`POST /llm/test/embedding` 端点与 store 动作保留）。落点与判据见 [普通任务轮壳 W18](../plans/2026-09-29-ordinary-tasks-round.md)，口径正文见 [admin-console.md](../design/admin-console.md) §3.3 | S1 控制台不渲染向量卡、无向量「验证」入口；S2 store 仍拉取三槽位且 `slots.embedding` 有值；S3 `Console.test.tsx` 有向量卡不出的用例且既有槽位用例不改语义；S4 admin-console.md §3.3 槽位卡表与 help 文案随步 |
| ARCH-040 | 支线 | 中 | 待验收 | [槽位「启动受限」＝先停对方再启动（8903 控制台，文字↔图像双向）](../plans/2026-09-29-ordinary-tasks-round.md) —— 现状点「启动」由后端 `backend/qed_engine/services/llm/model_manager.py:stop_other_local_slots` 静默停掉对方槽位（单活仲裁），界面不预告、用户看不到显存被谁夺走；修向（用户裁决 2026-10-03＝前端预检 + 确认两段式）＝对方在跑时点「启动」先出「受限：需先停止 <对方槽位>」确认框，确认后 `stop`(对方)→`start`(本槽位) 两段派发，取消不发请求；后端仲裁不改行为、保留兜底。落点与判据见 [普通任务轮壳 W19](../plans/2026-09-29-ordinary-tasks-round.md)；口径文件 [admin-console.md](../design/admin-console.md) §3.3 | S1 对方槽位在跑时点「启动」不直接派发，先出含「受限」与对方槽位中文名的确认框；S2 确认后按 stop(对方)→start(本槽位) 顺序各发一次并走既有收敛轮询，取消则请求数为 0；S3 对方未在跑时「启动」维持单击直发且无确认框；S4 文字/图像双向同一规则，`Console.test.tsx` 覆盖三分支；S5 `admin-console.md` §3.3 与 `local-model-management.md` 单活仲裁口径随步且后端行为不变 |
| ARCH-041 | 支线 | 中 | 待验收 | [四服务启停互不受限＝去掉 8903 前端全域操作互斥](../plans/2026-09-29-ordinary-tasks-round.md) —— 判定＝后端 `backend/qed_engine/api/control.py` 四服务单元各自独立派发、无跨服务互斥与资源守卫（仅 `config` 固定 409 不许自启停，守卫只作用本地模型槽位），受限只出在前端 `web-ui/src/stores/runtime.ts:201` 的单旗标 `operating`：服务启停与模型槽位启停共用一把锁，任一在飞即对其余全部回 `busy`（服务收敛窗 15s、槽位收敛窗 300s 期间四服务卡全部白点）；修向（用户裁决 2026-10-03＝四服务可任意并发启停重启）＝操作态按单元拆分，服务每单元一键、模型槽位保持整域互斥、两域互不阻塞，后端零改动。落点与判据见 [普通任务轮壳 W20](../plans/2026-09-29-ordinary-tasks-round.md)；口径文件 [admin-console.md](../design/admin-console.md) §5 | S1 一个服务操作在飞时，另一服务（tracker/axiom/web 任一）点启停正常派发而非 `busy`；S2 同一单元重复点击仍被挡（busy 语义保留）；S3 模型槽位操作仍整域互斥，且槽位在飞不挡服务、服务在飞不挡槽位；S4 `runtime.test.ts` 与 `Console.test.tsx` 三形态用例先红后绿；S5 [admin-console.md](../design/admin-console.md) §5 操作互斥口径随步且后端零改动 |

### 长期任务

| ID | 类别 | 优先级 | 状态 | 任务描述 | 成功标准 |
| --- | --- | --- | --- | --- | --- |
| REQ-062 | 长期 | 中 | 进行中 | **AI 开发指引优化（收件箱机制）**：四段式——① **捕获**：大任务完成后把 agent 利用经验写入 [ai-agent-knowledge-inbox.md](../plans/ai-agent-knowledge-inbox.md)（长期滚动收件箱，不随任务归档）；② **审核**：三判据逐条过；③ **批量晋升触发**：达阈值或每月例行；④ **体系优化**：聚类产出结构性结论，修订正式文档乃至开发流程；目标 = 经验不重复踩、正式文档随实践收敛 | S1 大任务完成后经验条目进入收件箱；S2 入池三判据（复用价值／非瞬时状态／未被正式文档覆盖）逐条过，任一不满足不入池；S3 触发条件（待评审 ≥10 条、单主题聚集 ≥3 条或每月例行，先到为准）达成时产出聚类结论并修订正式文档；S4 每次入池/晋升后 `tests/contract` 门禁全绿 |
| REQ-046 | 长期 | 高 | 进行中 | API 接口开发：先确定接口类型，按类型写 API 文档落入各自项目——① QED-Engine 前端无 API（静态页面只连 8900，声明于 [api-contracts](../architecture/api-contracts.md)）；② QED-Engine 后端三类（控制域启停/重启/健康、QED-Tracker 透传及相关处理、Axiom-Flow 透传及相关处理）；③ QED-Tracker 三类（自身生命周期+健康、数据库知识查询传递、LLM 检索课程教程/选书业务）；④ Axiom-Flow 四类（生命周期+健康、数据查询、解析结果与 PDF 对照、未来 RAG/知识图谱预留）；检查是否有遗漏；关联 ARCH-012（全流程跑通 + Axiom-Flow 完成前端验收 + 流程完整走完为止） | S1 四类接口在 api-contracts 有归类且与真实实现一致、无遗漏项；S2 8901/8902 契约唯一事实源在子项目侧文档，根侧只留指针无副本；S3 子项目 API 文档的补充经请求由对方执行并可跟踪回执 |
| REQ-047 | 长期 | 高 | 进行中 | 数据库设计：QED-Engine [database-design](../architecture/database-design.md) 为总纲（纯登记层：零 DDL，全部表结构指针到所有权方文档，含 mermaid 关系视图与表×项目读写矩阵，ARCH-031）；QED-Tracker 定义自身完整数据库定义（docs/architecture/database-private-tables.md（qt_*）与 database-shared-tables.md（qed_*）为其结构唯一事实源）；Axiom-Flow 定义 af_* 完整数据库定义（database-design.md 为 af_* 结构唯一事实源），通过文档 + 单独数据库管理体系管理 | S1 总纲保持零 DDL 纯登记层，表结构指针与实际表一致；S2 表×项目读写矩阵与关系视图随建表同步更新；S3 af_*/qt_* 结构唯一事实源在各自仓库，根侧无 DDL 快照副本；S4 版本机制（ADR 0010）下的迁移与所有权变更可追溯 |
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
