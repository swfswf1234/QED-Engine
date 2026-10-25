# QED-Tracker V1.0 持续优化滚动记录（tracker-v1-continuous-optimization）

状态：In Progress
任务类型：A
最后更新：2026-10-25
关联 ADR：无新增（治理沿用 [ADR 0011](../history/adr/v0.1/0011-pending-design-location.md) 不确定文档暂居 plans/；跨项目执行边界见 standards/cross-project-collaboration.md）
关联设计：[downloads-flow.md](../design/downloads-flow.md)（下载/探索全链路）、
[api-contracts.md](../architecture/api-contracts.md)（8900↔8901 契约）、
[llm-gateway.md](../design/llm-gateway.md)（本地模型链路消费面）
关联 Tracker：docs/trackers/todo.md（ARCH-024 任务行，一任务一行一壳，ADR 0016）
归档判定：Retain（滚动记录，关闭时按当时里程碑归档 history/plans/）

## 目标与成功标准

**目标**：承载 ARCH-024「QED-Tracker（V1.0）持续优化轮」的**同步优化记录**——三线发现的
每一个优化项/bug 在本壳登记（现象、定位、方案、责任侧、状态），与 QED-Tracker 侧台账同步；
本壳是根侧唯一滚动记录，不为单项优化另立计划。

**成功标准正本在台账行**（ADR 0023）：验收判据逐条见[任务台账](../trackers/todo.md)
`ARCH-024` 行的「成功标准」列，本壳不复制判据条目；收口手段见「验证与验收」节，
执行进展与证据见「过程与证据」节。

**范围边界（2026-09-22 用户裁决）**：QED-Tracker 只负责**知识/教材等探索与下载**；线 1 的
「本地模型链路」仅限服务其 LLM 检索/选书业务的模型调用环节，不外延到 8900 网关或渲染。

## 范围与非目标

**范围**：三线优化项的登记、评估与根侧承接修复记录——① **本地模型链路**（**仅限服务其
LLM 检索/选书业务**的模型调用：配置、稳定性与降级，是探索链路的内部环节）、② **论文探索
和下载**（arXiv/论文源适配器、批量探索与下载质量）、③ **下载链路评估与 bug 修复**（下载
校验/重试/失败面复盘）；8901 透传链路与 8903 下载管理界面消费面。优化项逐条发现即在本壳
登记，实施经用户确认排期。

**非目标**：解析与知识库面（归 [ARCH-025 滚动壳](2026-09-22-axiom-flow-v1-parsing-knowledge-optimization.md)）；
渲染优化（归 [学习设计轮 M1 壳](../history/plans/2026-10/2026-09-23-learning-ui-rendering.md)）；
不做第四/五轮主线功能（归 ARCH-027 重设计）；不代替 QED-Tracker 子仓库自身计划（其侧实施
在其仓库立项）。

## 前置条件

1. ARCH-024 任务行已在 todo 登记（2026-09-22，ADR 0016 改单行单壳）。
2. QED-Tracker 服务（8901）可达或其离线降级路径已知。

## 工作项（滚动登记表）

### 线 1：本地模型链路（8901 LLM 检索/选书）

| 条目 | 现象/动机 | 方案要点 | 责任侧 | 状态 |
| --- | --- | --- | --- | --- |
| 论文检索计划质量三因（四方向真机各跑一次、三份 `no_candidates`） | 2026-10-14 四方向各发起一次探索，仅「前沿」出候选，核心／深度／匹配三份 `no_candidates`；三条归因全在 8901 与模型服务侧＝① 检索计划给出不在 `allowed_categories` 内的分类（`math.RA`／`math.GR`）② 计划响应在 577 字符处截断且修复重试与首发 `response_sha256` 相同（`qed_llm_calls` id 106／107）③ 兜底计划改用中文整句检索致 `fetched=0` | 根侧不绕过宿主容量去调业务参数（判例＝机器侧问题归口）。三条处置口径**待用户裁**＝(a) 向 QED-Tracker 发跨项目请求，并入其 QED-074「LLM 双链路口径 + prompt 资产台账」W-2 论文 prompt 迁注册表／W-3 本地×API 同 payload 双跑对比；(b) 归 ARCH-028 稳定性轮与 REQ-100 本地模型长期线做截断与掉线取证；(c) 只留指针不处理 | 根→Tracker（归口已裁＝ARCH-028 承接） | 待裁决（2026-10-24 登记）：来源＝[REQ-109 归档壳](../history/plans/2026-10/2026-10-11-paper-ui-iteration-2.md)「遗留与移交」第 4 条，该条当时写「由本壳线 2 滚动条目跟踪」而线 2 从未落条目；本批改登**线 1**——三条归因的性质是「服务其 LLM 检索/选书业务的模型调用环节」，正落在本线定义内（归档壳正文按当时口径保留、不回改）。**2026-10-24 晚批已裁＝取上文 (b) 案，移交 [ARCH-028 本地模型稳定性轮](2026-09-23-local-model-stability-round.md)**，其壳新登记 W15 条目是本条的现承载；截断/掉线取证与参数标定腿按该壳 W6 同型随 [REQ-100 长期线](2026-09-29-local-model-debug-optimization-longterm.md) 滚动；本条在本线**退为指针**、不再作在途判据 |
| （待登记） | — | — | — | — |

> **线 1 现状（2026-10-24 移交后）**：本线唯一条目（论文检索计划质量三因）已按用户裁决移交 ARCH-028
> 稳定性轮 W15 承接，**本线无开放条目**；「（待登记）」占位行保留＝8901 LLM 检索/选书的模型调用环节
> 若再有新发现仍即登本线。2026-09-22 范围边界裁决（线 1 不外延到 8900 网关或渲染）不变，本次移交
> 只改**承接轮**、不改本线定义。

### 线 2：论文探索和下载

| 条目 | 现象/动机 | 方案要点 | 责任侧 | 状态 |
| --- | --- | --- | --- | --- |
| REQ-101 论文链路 scope 化与书本化采纳请求（R1~R4） | 根侧设计需求：8903 领域/课程各挂前沿/核心论文展示行、探索由领域入口发起（2026-09-30 入口收敛裁决）；8901 现状无领域/课程维度、recommend/download 仅 CLI、发现论文不落库（QED-071 D2/D14 口径，2026-09-30 用户裁决改判） | 请求稿正文=根侧 [REQ-101 壳](../history/plans/2026-10/2026-09-30-req101-paper-scope-books-adoption-request.md) + 对方 068 壳「根侧需求扩展」节；并入 QED-068（068-5 扩展 scope + 新增 068-6 书本化采纳） | 根→Tracker | 已收口 2026-10-24（根侧整行 `Achieved`，见 [REQ-101 归档壳](../history/plans/2026-10/2026-09-30-req101-paper-scope-books-adoption-request.md)「关闭与归档」节）：需求稿与链路复审三步序列已落对方 068 壳（2026-09-30）；**A 步 2026-10-01** 交付 R2 枚举面（8901 `GET /books` + `qt_books.kind`/`course_id`）与细节 #1/#4；**B 步同日**交付 R1／R3 与 R2 采纳面及细节 #2／#3／#5；**C 步 2026-10-15** 交付 068-4 安全件与论文进库表述改写；**D 步 2026-10-15** 由用户裁决按「声明只读、存量不回填」给出 R4 答卷。真机联调 2026-10-09 过（`mathadvanced-b19` 至 `verified`）；对方 QED-068 行同日按 A~D 全序列自关，逐条答卷正本在其归档计划 |
| REQ-102 根侧消费面实现（8900 透传 + 8903 展示行） | 8900 契约无任何 papers 端点；8903 四层展示无论文挂载位 | [REQ-102 壳](../history/plans/2026-10/2026-09-30-req102-paper-display-row-root-impl.md) W1~W5：设计五面晋升→papers 透传→静态清单行→探索管理弹窗→真机回归；静态清单行组件形态先行（数据挂点=规划端点 /papers/books，未实装静默空态） | 根 | 已收口 2026-10-09（Achieved，S1～S5 全达成）：W1~W5 全落＝设计五面晋升 + 8900 papers 透传五端点 + 8903 两级展示行与探索管理弹窗 + 真机端到端（`mathadvanced-b19` 至 `verified`）；壳 Retain 归档，取证见归档壳「过程与证据」2026-10-09 两条 |
| REQ-107 论文线合并设计与实施基准（E1~E5 设计本体 + 实施清单 I1~I7） | 用户 2026-10-11 梳理需求：现探索弹窗「设置→轮询→候选勾选」把模型检索计划藏在中段之后（用户要求先看怎么检索再谈采纳）；入口按钮靠左未与同排按钮平齐；无「4 分以上高相关才进待选」的成文判据；候选只有理由没有摘要/总结视图；已采纳论文只在领域/课程行内以文本条目呈现、左树无独立栏位 | 合并基准正文=[REQ-107 壳](../history/plans/2026-10/2026-10-11-paper-explore-ui-and-papers-column.md)（E1 入口形态、E2 弹窗五段含新增「检索口径」段、E3 待选区间判据 `recommended` ∧ `goal_fit≥4`、E4 详情标题/摘要/评审小结（已入库走 sources→selection 按需回源，零新端点）、E5 左树派生「论文」节点 + 右栏卡片列）；两个事实缺口「权威」「总结」上游无字段，处置已裁定（R3 界面不出现「权威」字样、R4 第三段定名「评审小结」）；引用数亦无数据源，Q1 已裁＝暂不做、界面仅预留展示位，**不提跨项目请求** | 根（本轮只出基准文档，不动码；实施按 I1~I7 另立 REQ-108 开发行） | 已收口 2026-10-14（Achieved，随 REQ-107／108／109 三行同批关闭）：正文按 R1~R12＋Q1 定稿并按用户 2026-10-11 裁定在 plans/ 合并为论文线唯一执行基准（实施清单 I1~I14）；I1~I7 由 REQ-108、I8~I14 由 REQ-109 实施完毕，按用户 2026-10-14 晋升令并入 `design/`（[downloads-ui.md](../design/frontend/downloads-ui.md) §4.4 整节重写＋§3/§4.1/§4.2/§5/§6/§8 与 [downloads-flow.md](../design/downloads-flow.md) §7 对齐）；三壳 Retain 归档 `history/plans/2026-10/` |
| REQ-108／REQ-109 论文线界面两轮实施（I1~I7 + I8~I14） | REQ-107 基准定稿后需按清单落地；第一轮后用户追加四项界面反馈（历史清单要成一个按钮、旧论文展示行删除、只留领域论文栏卡片列、四方向各真跑一次） | [REQ-108 壳](../history/plans/2026-10/2026-10-11-paper-ui-implementation.md) I1~I7（入口同排右靠齐／弹窗五段含检索口径段／待选区间双门槛与逐条归因／详情与按需回源／左树「论文」节点与卡片列）＋ [REQ-109 壳](../history/plans/2026-10/2026-10-11-paper-ui-iteration-2.md) I8~I14（检索方向四值根侧参数映射、段①不露推荐上限且恒 `top=5`、历史探索清单单按钮直达段④、段④只列未采纳且达线、旧展示行整行删除＋徽标进汇总行）；纯前端零新端点、8901 `RECIPES` 与 8900 端点零改动 | 根 | 已收口 2026-10-14（Achieved）：四方向真机探索已发起并取证（仅前沿 `ranked`，核心／深度／匹配三份 `no_candidates` 归因在对方检索计划分类越界与模型响应截断）；两枚界面口径缺口按用户裁决不登行、写在 REQ-109 归档壳「遗留与移交」；「采纳＋取书」腿按裁决不补，沿用 REQ-102 W5 |
| （待登记） | — | — | — | — |

> **线 2 现状（2026-10-24 梳理）**：五枚条目（REQ-101／102／107／108／109）**全部收口**，本线
> 无开放条目、无待裁判据；论文链路的**遗留三项已改登本壳线 1 与线 3**（检索计划质量三因、
> BUG-005 加密拒收、REQ-103 四字段真读取），不在本线重复占位。表内「（待登记）」占位行保留＝
> 本线仍随论文链滚动（新发现即登本线）。

### 线 3：下载链路评估与 bug 修复

> **范围注记（2026-10-24 补）**：本线除「下载校验/重试/失败面复盘」外，同时承载 8901 **探索与
> 下载链路的在册缺陷跟踪**（REQ-103／BUG-004 这类「用户输入不进探索」的缺陷在三线定义里无落点，
> 按「bug 修复」一侧归本线），以及对方下载链路评估计划（其 QED-069）的排期跟踪。

| 条目 | 现象/动机 | 方案要点 | 责任侧 | 状态 |
| --- | --- | --- | --- | --- |
| REQ-103 领域维护表单四字段真读取（对侧 BUG-004） | 用户填的 `description`／`scope`／`level`／`stages` 对探索结果毫无影响：8901 `_domain_explore_handler` 只把领域名送入 domain 提示词、`scope_hint` 取模板内置默认 `_DEFAULT_SCOPE`，回写按「输出优先」无条件覆盖用户已写的 `description`、`stages` 恒被 `STAGES` 常量替换、`level` 仅输出缺失时回退（空串不兜底） | **对方腿（S2~S4）**＝四字段进 domain 提示词且 `scope` 非空时覆盖内置边界／用户写过的 `description` 保留、仅空值取生成结果／`level` 空串回退内置默认范围；**根侧腿（S5）**＝三处领域表单（添加／编辑领域知识／领域确认弹窗）五字段顺序与标签统一＋默认句预填，措辞正本 [`web-ui/src/components/domainFormDefaults.ts`](../../web-ui/src/components/domainFormDefaults.ts)、口径正文 [downloads-ui.md §3.1](../design/frontend/downloads-ui.md)，守护用例 `DownloadsTree.domainForm.test.tsx` 五例（2026-10-24 实跑读数＝5 tests，此前本行写「六例」系我方文档面事实错，随本条更正） | Tracker（BUG-004 承接与修复归对方）＋根（S5） | 根侧腿**已实施并完成 S5 取证**（2026-10-24 前端门禁＋8903 浏览器实测，逐项读数见下方「2026-10-24 REQ-103 S5 取证批」；同轮实测**测出一处新缺陷 DEFECT-024**，已登记本线下一行——它不属于 S5 判据、是取证的实际产出）；对方腿**待分析且无排期**（其 BUG-004 行 2026-10-24 实读状态＝待分析，S1 判据「有承接状态**与排期**可跟踪」的排期半句未兑现）⇒ 本行**已随 2026-10-24 晚批按 `Partial` 收口**（用户裁「REQ-103 应该基本完成可以收尾」）：S5 判绿取值＝两枚入口真机过＋第三枚入口按共用常量与八例单测覆盖、如实记半腿；S2~S4 与 S1 的排期半句属**对方腿未做**，随收口移交其缺陷台账 BUG-004 继续滚动。todo 行已原子摘除、逐 S 证据入 completed.md；**本条保留为本线对 BUG-004 的跟踪指针**，其状态由对方改写后可跟踪（本行 S1 判据一致性面） |
| BUG-005 论文下载在机器验收被「PDF 已加密」拒收 | 2026-10-15 真机冒烟：arXiv `2504.15268`（书行 `mathadvanced-b20`）下载与字节校验全通过，却在机器验收判 `('PDF 已加密',)` 拒落盘、书行转 `failed`／`holding=missing`；直连探针复核同一论文 200／2,234,089 B／`is_encrypted=True` 且 `decrypt("")` 成功、50 页、可抽正文 121,239 字符。arXiv 以权限位加密发布是常见形态 ⇒ 该口径在现网有已知误伤面（同轮 `b21` 正常 `downloaded`／`owned`） | 对方三选一**待裁**＝① 空密码可解即放行并在 `qt_sources.note` 留加密标记；② 维持拒绝但补人工指引文案（说明属主权限加密而非真口令）；③ 仅 `kind=paper` 通路放行、教材通路保持严格（冻结目录严格匹配约束不受影响）；口径变更须同步其 `design/download-pipeline.md` 与测试 | Tracker（其 QED-070 滚动缺陷台账 `BUG-005`） | 待裁决（2026-10-24 登记跟踪）：根侧**不发函**、验收口径属对方所有权面；REQ-101 整行收口时已把本条列为不占判据的相邻尾账，本批把它从「尾账叙述」升为在册条目（S1 一致性） |
| QED-069 下载链路评估落地（对方侧本线本尊，含 QED-079／079-A 实做腿） | 对方 v1.0 主线的「下载链路评估」计划行至今 `待开始`＝`qt_sources` 渠道表现细化评审 → 找得率／渠道成功率统计口径落地 → 基线首批采集回填来源评估矩阵 → REQ-020② 根侧回执；其 `QED-079`（教材检索词与下载途径探索轮）与 `QED-079-A`（四门课程 26 条书目按 `libgen_li`→`internet_archive`→`open_library`→GitHub 四档逐档实测）进行中，是同题的实做腿 | 根侧动作＝跟踪其排期与逐档实测账；若其统计口径要进 8900／8903 消费面（如下载成功率进文档下载管理界面），届时按[跨项目协作规范](../standards/cross-project-collaboration.md)另发请求，**不在本条目预设形状**（避免替对方定口径） | Tracker（QED-069 待开始）＋根（消费面待判） | 待排期（2026-10-24 登记）：本线此前为空登记，而「下载链路评估」四步在对方侧从未落根侧可跟踪条目＝S1 判据的漂移面；根侧自己的评估消费面（8903 文档下载管理四形态＋8900 透传）已随 REQ-102／103／107~109 交付，本条只跟对方侧 |
| DEFECT-024 「编辑领域知识」丢 `scope`，且保存会把库中非空值覆写成空串（由 REQ-103 S5 浏览器实测暴露） | 现网实测＝8903 文档下载管理右键「编辑领域知识」弹窗里「学科知识」栏显示为空，而库里该域（`math-advanced`）的 `scope` 有 185 字符正文。取证（2026-10-24，全部只读）＝`GET /domains` 返 `scope` 185 字符；`GET /courses` 领域层键集合只有 `classic_tracks／courses／description／domain_id／exploration_stage／level／name／path_results／stages`，**无 `scope`**；直连 8901 与经 8900 各取一次得同一份 8,916 B 响应 ⇒ 根侧未过滤，缺字段发生在对方 `GET /courses` 载荷面。根因链四段（均为代码路径实证，未真跑保存）＝① 左树领域对象来自 `GET /courses`，缺 `scope`；② 表单初值 [`DownloadsTree.tsx:224`](../../web-ui/src/components/DownloadsTree.tsx) `scope: action.domain.scope ?? ''` 落到空串；③ 提交体 [`DownloadsTree.tsx:282`](../../web-ui/src/components/DownloadsTree.tsx) `String(values.scope ?? '')` 仍空串，经 [`api/tracker.py:188`](../../backend/qed_engine/api/tracker.py) 透传、[`clients/tracker_client.py:405`](../../backend/qed_engine/clients/tracker_client.py) 的「非 `None` 才入 body」把 `""` 原样发出；④ 对方 [`knowledge_repository.py:300`](../../QED-Tracker/src/qed_tracker/db/knowledge_repository.py) `if scope is not None: row.scope = scope` ⇒ 用户写过的 `scope` 被空串清除。同形口径也存在于领域确认弹窗 [`DomainConfirmModal.tsx:61`](../../web-ui/src/components/DomainConfirmModal.tsx)（`scope: domain.scope \|\| ''`，其 `domain` 同样来自 `/courses`），该腿未单独实证。**测试为何没拦住**＝`DownloadsTree.domainForm.test.tsx` 用手工构造的 domain fixture（内含 `scope`），夹具形状覆盖了 `/courses` 真实载荷的缺口 | 修复口径三选一（2026-10-25 落**甲腿**）＝甲（根侧自足）＝弹窗打开时补读 `GET /domains` 取 `scope`，并把「初值缺失即不发送该字段」写进提交体（`undefined` 而非 `''`）；乙（对方侧）＝请其在 `GET /courses` 领域层补 `scope`，按跨项目协作规范发函、形状由对方定；丙＝甲＋乙都落（回填与防御各自成立）。无论取哪一腿，根侧「空串不得覆写用户已写值」的防御都应独立成立（与 [downloads-ui.md §3.1](../design/frontend/downloads-ui.md)「用户写过的描述是权威内容」同口径） | 根（前端初值与透传腿）＋Tracker（`GET /courses` 载荷腿，仅乙案涉及） | **已落地（2026-10-25 根侧甲腿）**＝「学科知识」初值由同步腿 `GET /domains` 补齐，且「取不到（`undefined`）不进提交体」的防御同时成立；实现四枚源文件＋八枚定向用例，前端三门禁与 8903 真机读数见下方「2026-10-25 DEFECT-024 根侧同步腿落地」。**待裁沿革**＝2026-10-24 登记时用户「倾向乙案」；2026-10-25 用户改判「我理解是同步问题，再同步一次即可（如果同步不全解决同步不全的问题）」并授权按其方法做。只读探针把该直觉**证实为读面不全**（库 `math-advanced.scope` 185 字符完好）并**拧正两处**＝① 反复刷 `GET /courses` 永远取不到（该端点领域层结构性不返 `scope`），真正的「同步一次」＝补读 `GET /domains`；② 「同步不全」的代价必须由防御腿承担（取不到不发该字段），否则读面缺口就成真写坏数据。由此**乙案降级为可选上游改进**（该判语属 2026-10-25 早批）；**同日用户复裁「乙案要做」⇒ 乙案升为正式出站请求并发函 QED-Tracker**（代登其文档面两面＝其 `docs/trackers/todo.md` 的 `QED-083` Candidate 行＋其 `docs/plans/2026-09-24-v1-task-chain.md`「承载根仓库 DEFECT-024」节，只改其两份既有文档、零新建 md），并同批在根侧 todo **普通任务轮**登 `DEFECT-024` 专行作判据正本（S1~S4 在该行；本行降为本线跟踪指针，登记全貌见 [普通任务轮壳 W31](2026-09-29-ordinary-tasks-round.md)、去处登记见 [cross-project-contracts.md §4](../design/cross-project-contracts.md)）；实现做成对方一旦补齐 `/courses` 即自动让位（`withDomainScopeFields` 只填缺键行），不产生二次返工。**乙案覆盖面写清**＝补载荷只消掉「回填取不到值」这一现网故障面，**不消掉防御缺口**（`undefined` 与 `''` 在对方 `is not None` 判定下不同命中的那半句仍成立，甲腿属独立防御、按本格末句应各自成立）。**写侧已实证（2026-10-25 用户发令后真机保存一次）**＝「编辑领域知识」弹窗「学科知识」初值 185 字符 → 点「保 存」→ 抓到 `PATCH /api/v1/domains/math-advanced` 提交体 837 B **内含 `scope` 185 字符全文（非空串）**、UI 提示「领域已更新」，保存前后 `qed_domain` 九字段指纹**逐字段相同**（`scope` sha8 `f1423694`、长度 185），经 8900 与直连 8901 两腿读数一致，末态 `changed_fields` 为空集 ⇒「保存即清空」已由真机否证、「保存即带 185 字符正文」已由真机证实（取证全程见 [普通任务轮壳](2026-09-29-ordinary-tasks-round.md) 2026-10-25「DEFECT-024 写侧真机验收」条）。**仍未实证的两处如实保留**＝① 防御腿（`undefined` 不进提交体）只有单测＋变异验证证据，真机上初值补齐后不会走到该分支；② S4 的另两枚领域表单（添加领域＝POST 新建行、领域确认弹窗需探索态在场）本轮只做到读面非空、未做写侧 |
| （待登记） | — | — | — | — |

## 过程与证据

- **2026-09-22 立项**：QED-Tracker（V1.0）持续优化轮登记为 ARCH-024 主线行；同轮按
  [ADR 0016](../adr/0016-todo-registration-one-task-one-plan.md) 改单行单壳（原 ARCH-024 主线行 +
  PLAN-049 镜像行合并为本壳）。
- **2026-09-22 范围边界裁决**：QED-Tracker 只负责知识/教材的探索与下载，线 1「本地模型链路」
  不外延到 8900 网关或渲染。
- **2026-09-30 台账结构改判（[ADR 0023](../adr/0023-todo-row-carries-scope-and-criteria.md)）**：
  验收判据正本移入 todo 行「成功标准」列，原行内立项与合并叙述迁入本节。
- **2026-09-30 现状**：线 1/线 3 登记表仍为「（待登记）」占位，无条目落地；子项目侧实施归
  QED-Tracker 仓库，根侧只登记请求与跟踪（见[跨项目协作规范](../standards/cross-project-collaboration.md)）。
- **2026-09-30 线 2 首批条目立项（论文链路对齐轮）**：用户三项裁决——① 展示行数据来源=
  回归 `qt_books` kind=paper 书本化采纳（推翻 QED-071 D2/D14「发现论文不进库」口径）；
  ② 课程级论文落盘=逻辑分组（物理维持领域级 `raw/<domain>/_general/papers/`，不开课程级
  papers 目录）；③ 排期=并入对方 QED-068 本期计划（v1.0 主线②），对方不另开承接 ID。
  据此立项 [REQ-101（请求：QED-Tracker）](../history/plans/2026-10/2026-09-30-req101-paper-scope-books-adoption-request.md)
  与 [REQ-102（根侧实现）](../history/plans/2026-10/2026-09-30-req102-paper-display-row-root-impl.md)两行两壳，
  需求稿正文已写入对方 `docs/plans/2026-09-14-paper-pipeline-alignment.md`「根侧需求扩展」节
  （对方 git 提交留对方窗口）。裁决全文另见 REQ-101 壳「过程与证据」节。
- **2026-09-30 线 2 后续（入口收敛裁决 + REQ-102 W1 落笔）**：用户裁决论文探索**仅领域级
  发起**（领域右键＋汇总行 [论文探索] 按钮 → 管理弹窗），pick 评审时逐条落位领域或课程，
  课程行只展示；据此完成 REQ-102 W1 设计五面晋升（downloads-flow §7、downloads-ui §4.4、
  dataset-conventions、api-contracts §③ 规划契约、cross-project-contracts §5），
  REQ-101 R1/R2 与对方 068-6a/6b 同步口径；门禁根契约 82 绿、对方 test_documentation 9 绿。
- **2026-09-30 线 2 再后续（REQ-102 W3 静态展示行交付）**：W3 前置勘验证实「books 链现成」
  premise 不成立（8900 GET /books=Axiom af_books 代理，8901 无域级枚举端点），口径修正为
  规划端点 `GET /api/v1/papers/books`（W2 实装、上游=REQ-101 R2），已同步 downloads-ui §4.4
  数据源句与 api-contracts §③（新增第五行）；随后 TDD 交付 8903 论文展示行
  （groupPaperBooks/PaperBooksRow/store paperBooks+refreshPapers/四点位挂载+BookDetailModal 复用），
  vitest 定向 22 绿、全量 407 绿（唯一红与 tsc 两红均属并行 WIP 文件）、vite build 成功、
  浏览器实测空态静默+注入态分桶/排序/详情弹窗通过；取证全文见 REQ-102 壳「过程与证据」。
- **2026-09-30 线 2 复审（对方全链勘察 + 执行序列精简裁决）**：用户授权查阅并操作
  QED-Tracker，对其论文链做全链复审——检索/计划/报告三环已由其 S1~S3 交付，**入口/落盘/
  入库三环仍断**，八条代码事实（8901 论文面仅一条即时端点、HTTP 侧未注入 advisor、
  CLI 报告落 in-memory SQLite 进程退出即失、论文直写不进 `qt_books`/`qt_sources`、
  落盘 domain 硬编码 `math`、`qt_books` 无 `kind`/落位列、8901 无 books 枚举端点、
  论文 `book_id` 无 abbr 来源）与精简序列正本写入对方 068 壳
  「链路复审与执行序列精简」节（不新建其 md，规避文档白名单坑）。用户三裁决：
  ① 对方序列改 **A~D 三步**（A 最小出数=ALTER 加列+books 枚举端点+修 CLI 持久化与
  domain 传参；B 探索服务化+书本化一次到位=adopt 建书行并复用 `/books/{id}/fetch`，
  **不实现短命的 `paper_download` 直写端点**；C=068-4 安全件与文档收口；D=存量回填）；
  ② CLI 报告不落库缺陷并入 A 步修，不另开 DEFECT；③ 结论两侧都落笔。
  红线登记：`qt_books` 属对方私有表、列集漂移触发其 `db/schema.py` DROP+CREATE 自愈，
  加列必须先手工 ALTER 生产库（先例=QED-071 三列）。根侧随之把 REQ-102 W2 拆
  W2a（枚举透传，依赖 A 步，落地即让 W3 展示行出数）/W2b（探索面，依赖 B 步），
  REQ-101 R2 判据补「枚举响应行必须携带 `kind` 与落位字段」，api-contracts §③ 同步。
  门禁：对方 `tests/test_documentation.py` **9 passed**、根 `pytest tests/contract` **82 passed**。
- **2026-10-01 线 2 口径复确认（用户）**：论文链路=「搜索→确认→下载→验证」四步、单独主动
  探索触发、经「论文探索」界面进入一轮搜索与确认；「并非和领域书籍一块」经追问明确=
  **只指入口与状态机独立**（不共用领域 6 态/课程 5 态 `exploration_stage`，即
  downloads-flow §7.2 现状），**存储仍书本化**（`qt_books` kind=paper + 复用书本五层态链）、
  领域/课程沉淀展示行**保留现状**。故 0930 裁决①不改判，A~D 序列与根侧 W2a/W2b~W5
  口径继续有效，W3 交付物零返工。
- **2026-10-01 线 2 对方 A 步交付（用户发令「进行 A 步」，根会话在 QED-Tracker 内执行）**：
  按红线顺序完成四项——① `qt_books` 加列在 `qed_test` 执行（新增迁移件
  `scripts/qed068_alter_book_kind.py`：勘查 → `--dry-run` 出 SQL → 备份 26 行可重放 INSERT →
  ALTER → 复核；22→24 列、行数不变、两索引齐备、存量 `kind` 全 `book`），模型同步
  `BookKind`+`kind`/`course_id` 后 `ensure_schema → (0, 0)`；**生产 `qed` 库未执行**，
  未 ALTER 前不得启动新版服务（否则私有表自愈清空书库）；② 8901 新增 `GET /api/v1/books`
  （三参数 AND 过滤、行含 `kind`/`course_id`、非法 kind 422、无命中空数组），真库只读冒烟
  26 行全携带两新列、`kind=paper` 空集（B 步 adopt 前属正常）；③ F3 修复（CLI 在
  `db_configured` 时传 `session_factory`，引擎由 `PaperService.close()` 释放，无库仍
  in-memory 回落）；④ F5 修复（`download`/`download_selection` 增 `domain_id`，CLI `--domain`）。
  对方门禁：`ruff` 全绿、`pytest tests -q` **586 passed | 1 failed**（唯一红=存量
  `orchestration/evidence` 断言，该模块与其测试均未在本轮改动内）、`test_documentation.py` 9 绿。
  回执落定：落位字段=`course_id`（空串=领域级）+`domain_id`、类别=`kind`（`book`/`paper`），
  发现论文=`kind=paper` 且无 `knowledge_id` → 与 8903 W3 现实现一致、**W3 零改动**，
  REQ-102 W2a 上游依赖解除。新记 **F9**：真库唯一领域 `math-advanced`（书行落
  `raw/math-advanced/<course>/`）而论文默认桶 `DEFAULT_DOMAIN_ID='math'`，两者目录分裂——
  A 步只让 domain 显式可传、未改默认值，裁定留对方 B 步。证据正本=对方 068 壳
  「A 步交付（2026-10-01）」节。
- **2026-10-01 线 2 同日追加两裁决（改判上一条的两处口径）**：① **论文没有默认桶**——上一条
  留 B 步裁的 F9 就此裁定：取消论文链路一切 `DEFAULT_DOMAIN_ID` 兜底，`domain_id` 必填且须在
  `qed_domain` 已存在，缺失/不存在即拒绝落盘与建书行；对方 A 步随即落地 ⑤′（`PaperService`
  必填关键字参数 + `_require_domain` 校验、可注入 `domain_exists` 由 `KnowledgeRepository.get_domain`
  装配、CLI `--domain` 默认空串且落盘分支缺参返回码 2），对方门禁复跑 `ruff` 全绿 +
  `pytest tests -q` **589 passed | 1 failed**（唯一红不变）+ `test_documentation.py` 9 绿；
  ② **生产 `qed` 库不做本次 ALTER**（取代上一条「未 ALTER 前不得启动新版服务」的上线红线口径）
  ——等 1.0 整体完成后走**重建**窗口（重建后重导书目 + D 步处置论文存量），在此之前不得把本版
  代码指向 `qed` 长期运行；根侧 8900/8903 走 `qed_test`（已加列）不受影响。
  根侧同步=downloads-flow §7.1 无默认桶守则、dataset-conventions 发现论文条目、
  api-contracts §③ `recommend`/`adopt` 必填与存在性、REQ-101 R2 条目与两壳证据节。
  正本=对方 068 壳「F9 裁定」「生产库口径（2026-10-01 用户裁决改判）」两段。

- **2026-10-01 线 2 对方 B 步交付（用户裁五项实现细节后发令「开始执行」）**：论文探索服务化
  与书本化采纳一次到位——8901 新增四端点（`GET /papers/selections`、`GET /papers/selections/{id}`、
  `POST /papers/recommend` 202 `paper_recommend`、`POST /papers/selections/{id}/adopt` 202
  `paper_adopt`），scope 折 `qt_selections.model.scope`（零表结构改动），新增 `paper_recipes.py`
  配方层（`frontier`/`core` → arXiv 分类封闭映射，映射不到即 422），`adopt_paper` 建 `candidate` 态
  `kind=paper` 书行 + `qt_sources(channel=arxiv)` 身份（同 arXiv ID 二次采纳 `duplicated`），
  `book_fetch._fetch_paper` 分叉直取（不跑书名检索，内容校验＝ID 解析到的即匹配），落盘
  `raw/<domain>/_general/papers/<year>/<arxiv_id>_<sha8>.pdf` 且领域缺失即拒；CLI
  `papers recommend`/`selections list|show|adopt` 转 8901 HTTP，`selections download` 与
  `PaperService.download_selection` 退役（下载唯一路径＝`books fetch`）。五项裁决：#1 B 案分叉、
  #2 领域 abbr + 域内 `-bNN`、#3 评分理由只留 `qt_selections`、#4 配方封闭映射、
  #5 **adopt 不自动下载**（→ REQ-102 W4 pick 后须显式 `/books/{id}/fetch`）。
  对方门禁：`ruff` 全绿 + 论文链定向 114 passed + `pytest tests -q` **629 passed | 1 failed**
  （唯一红仍=存量 `orchestration/evidence`，QED-067 线在途）+ `test_documentation.py` 9 绿；
  对方文档同步 README/`api.md`「⑥ 论文探索」/`code-map.md` 八行。
  正本=对方 068 壳「B 步交付（2026-10-01，本仓执行）」节 + REQ-101 壳同日证据条。

- **2026-10-11 线 2 追加（论文界面梳理轮，REQ-107 立项）**：用户要求把论文探索从「一键出候选」改为「先看怎么检索、再谈采纳」并给已采纳论文独立栏位，本轮只梳理文档。勘查定住的事实基座（带行号，详见 REQ-107 壳「过程与证据」）：入口实有三处（树右键／汇总行／行内链接）且 `.dl-summary` 无 flex 致按钮未右靠齐；`GET /papers/selections/{id}` 经 8900 纯透传已带回 `search_plan`（terms·category·reason·fetched·kept）、`plan_source`、`profile`、`candidates[].abstract` 与三维分，故「检索口径段」与「摘要详情」均为纯前端可达；`top`/`limit`/`years_limit` 请求可覆盖（top 1..20）⇒ 待选区间容量不需向对方提 REQ；两处上游缺口——arXiv 适配器未映射 `journal_ref`/`doi`/`comment`/`primary_category`（无权威信号）、报告无总结生成节（只有 `assessment.reason`+`risks`）；`qt_books` 无 arXiv 列、身份在 `qt_sources(channel=arxiv)`，8900 已透传 `GET /books/{id}/sources` ⇒ 已入库论文详情按需回源可行。设计稿与待裁 R1~R6 见 REQ-107 壳；`design/` 本轮未动，晋升待用户裁定。
- **2026-10-11 线 2 六项裁定（REQ-107 设计本体按此定稿）**：R1 汇总行内右靠齐且与「当前选择：领域／课程名」文本行同一排（页头动作组形态作废；补充勘查＝该行文本实态为 `领域：X`/`课程：Y`/`教程：Z`，`Downloads.tsx:1003-1010`）；R2 课程语境保持取所属领域、无则置灰；R3 「权威」不进门槛、界面不出现该字样，引用数改「只展示不筛选」——但全仓复核无任何论文计数数据源（`rg -i citation|引用数|semantic_scholar|openalex` 只命中教材资源引用数组与编排 evidence_refs），故记为悬留项 Q1、界面仅预留展示位；R4 详情第三段定名「评审小结」（`reason` + `risks`）；R5 论文栏与行内展示行并存（栏＝领域全量含课程落位）；R6 双门槛 `goal_fit ≥ 4` ∧ `score ≥ 80` ∧ 服务端 `recommended`（用户口径「先只要少部分」），未入选区逐条唯一归因、段① `top`（≤20）给容量出口。
- **2026-10-11 线 2 合并基准裁定（REQ-107 由设计稿升为论文线唯一执行基准）**：用户裁「现在还不到晋升的程度，先在 plans/ 文档合并并梳理成一个文档，按照这个文档做完然后等确认后再晋升；Q1 引用数——① 暂不做、只留位」。据此 REQ-107 壳改为「文档下载管理·论文线合并设计与实施基准」：新增「合并说明」表（REQ-102 归档壳只并「不可回退面」清单、`downloads-flow.md` §7 与 `downloads-ui.md` §4.4 走**指针引用不复制**、REQ-101 请求壳**不并**只在「上游与遗留指针」挂未决项）、「已交付现状基线」表（8900 五端点透传 / 行内展示行与五档徽标保留 / 弹窗三段扩五段 / 采纳链不自动下载 / 真机数据面 b19·b20·b21 / stores 单一轮询沿用）与「实施清单 I1~I7」（每项带涉及文件与可观察完成判据，动码前按 ADR 0016 另立唯一开发行 REQ-108）；Q1 关闭口径＝界面仅预留引用数展示位、字段缺失整位不显示（不显示 0）、不取数、不提跨项目请求，本文档无悬留项；`design/` 全程未动，晋升＝I1~I7 实施完成 + 用户确认之后的动作（W2）。

- **2026-10-14 线 2 论文界面两轮收口＋设计晋升（REQ-107／108／109 三行 Achieved）**：用户令「将文档确定内容晋升，本任务阶段性完成，现在开始收尾」，四项裁决＝① 晋升落点按 REQ-107 壳「晋升清单」全表（`downloads-ui.md` §3／§4.1／§4.4 整节重写、`downloads-flow.md` §7.2 补派生视图口径；经核 `code-map.md` 无需增行），② 三行全 Achieved 收口且三壳 Retain 归档 `history/plans/2026-10/`，③ 两枚界面口径缺口（段③年窗读配方缺省值、汇总行徽标只按最新一份报告派生）都不登 todo 只留归档壳「遗留与移交」，④ 不补「采纳＋取书」真机腿（端到端证据沿用 REQ-102 W5 的 `mathadvanced-b19` 至 `verified`）。台账连锁＝todo 三行移除并写 `completed.md`、`plans/index.md` 补三条已归档行、本壳 REQ-107 条目状态格改判并加上表实施条目、`project-status.md` 当前主线加论文线收口条；**本批未提交 git**（用户未要求，改动全在工作树）。
- **2026-10-24 线 2 论文线末枚开放行收口（REQ-101 整行 `Achieved`）**：本壳线 2 的 REQ-101 条目状态格停在 2026-10-01 的 A 步读数，而 R4（存量回填口径）的对方答卷已于 2026-10-15 随其 068 轮收尾给出＝按判据二选一的另一支**声明只读、存量不回填、不搬迁、不注销**（正本＝QED-Tracker `docs/history/baselines/2026-09-14-paper-pipeline-alignment.md`「D 步裁决：存量不回填（2026-10-15，用户裁决）」节，其台账 `QED-068` 行同日自关）。故本批是**登记补齐**而非新工作：R1／R2／R3 由 A＋B 步交付、2026-10-09 真机联调过（`mathadvanced-b19` 至 `verified`），S1~S6 逐条核对全达成；两处**经上游改判成立**的口径随批留痕＝`domain_id` 由「可选」改判为必填且须存在（论文无默认桶）、生产 `qed` 库由「先手工 ALTER」改判为 1.0 完成后走重建窗口重导书目。台账连锁与上一条同型＝todo 行移除并写 `completed.md`、`plans/index.md` 补一条已归档行、REQ-101 壳 W3／W4 状态格终态化并按 Retain 归档 `history/plans/2026-10/`、REQ-107 归档壳「上游与遗留指针」节的 R4 未决项随步改判、`project-status.md` 当前主线加一条；三笔相邻尾账（8900 fetch 状态码 200／202 待裁是否立 DEFECT、生产库重建窗口属人工、对方 `BUG-005` 在其缺陷台账滚动）不占本行判据、不另立轮次。本批零代码、零 DDL、零库内写、零 git 提交，对方工作区只读；**门禁**（2026-10-24 收口末次串行跑，QED_env 解释器）＝`pytest tests/contract -q` **89 passed／0 failed** ＋ 根全量 `pytest tests -q` **878 passed／0 failed** ＋ `ruff check backend tests scripts` All checks passed；与 REQ-136 收口批的 877 passed／1 failed 的差值＝同一枚既存红（并行模型轮遗留的 `scripts/image-model/.keepalive.pid`）已由并行窗口清除，非本批引入亦非本批修复。
- **2026-10-24 三线梳理与 S1 漂移修正批（纯文档面，零代码、零 DDL、零库内写、零 git）**：用户指令原文＝「现在我们整个看QED-Tracker（V1.0）持续优化轮（ARCH-024）下面的任务，现在论文探索和下载、下载链路评估基本完成，重新梳理一些当前完成了哪些任务，哪些任务待做，这次我们更新一些，如果剩余任务不多就往下做」。**只读取证＝对方工作树与台账实读**（`QED-Tracker/docs/trackers/todo.md` 开放行＋其 `docs/plans/2026-09-14-bugfix-ledger.md` 七枚在册缺陷），未改其任何文件。梳理结论＝① **线 2 无开放条目**（五枚全收口，末枚 REQ-101 于本日收口）；② 但**线 1 与线 3 长期空登记**，而两处各有在册实体＝线 1 缺 REQ-109 归档壳「遗留与移交」第 4 条的三条归因（该条写「由本壳线 2 跟踪」而线 2 从未落条目，本批改归**线 1**并说明性质），线 3 缺三枚在册项＝REQ-103／BUG-004（todo 有行、壳内无条目）、BUG-005（只在 REQ-101 关闭叙述里当尾账）、对方 **QED-069「下载链路评估落地」至今 `待开始`**（本线名字的本尊却无跟踪条目）——四者都触本行 S1「登记表条目状态与对方台账实际一致」的漂移面，本批一次补齐；③ **新查出一处根侧半句未取证**＝REQ-103 的 S5 判据两半里，「顺序/标签/默认值与设计 §3.1 一致」已落码并有五枚守护用例（数目按本批实跑读数校正，原写「六枚」是我方文档面事实错，见线 3 REQ-103 条目）（`web-ui/src/components/domainFormDefaults.ts` ＋ `DownloadsTree.domainForm.test.tsx`，2026-09-30 实施、记在 `project-status.md` 前端行），但同半句要求的**「前端门禁与浏览器实测」取证在根侧文档面查无**（全仓检索 `REQ-103` 只命中 todo 行与状态快照两处），本批列为唯一可立即往下做的根侧腿；④ **对方腿现状**＝BUG-004 状态 `待分析`、无排期（S1 判据「有承接状态与排期可跟踪」的排期半句未兑现），BUG-005 三选一待其用户裁，QED-079／079-A 逐档实测进行中。**待用户裁三项**（本批不代决定）＝检索计划质量三因的归口（发函 QED-074／归 ARCH-028 与 REQ-100 长期线／只留指针）、BUG-005 是否由根侧向对方提口径请求、是否催 BUG-004 的排期与 QED-069 的统计口径消费面需求。**登记形态守约**＝滚动壳内条目不新建 todo 行、不另立轮次（ADR 0021 第 1 条）；REQ-103 行与 ARCH-024 行的判据正文一字未改（成功标准冻结，ADR 0022 决定 4）；线 3 加一句**范围注记**承载「探索链路缺陷也归本线」的读法依据（壳自身范围叙述，非 standards 变更）。
- **2026-10-24 REQ-103 S5 取证批（前端门禁＋8903 真机实测；零代码、零库内写、零 git）**：承上一条「唯一可立即往下做的根侧腿」，用户令原文＝「……这次我们更新一些，如果剩余任务不多就往下做」。**前端门禁（串行，均在 `web-ui/` 内跑）**＝`npx tsc -b` **exit 0**；`npx vitest run --no-file-parallelism` 全量 **67 files／847 tests passed**；定向三枚＝`DownloadsTree.domainForm.test.tsx` **5 passed**、`DomainConfirmModal.test.tsx` **8 passed**、`DomainCard.test.tsx` **2 passed**。**产物核对**＝8903 实际返回 `assets/index-CbOR7_FC.js`（2,537,245 B，2026-10-23 04:34 构建）与 `web-ui/dist/index.html` 引用一致，且晚于全部相关源码（`domainFormDefaults.ts` 2026-09-30、`DownloadsTree.tsx` 2026-10-11）⇒ 本批未改源码、不需重建；包内默认措辞命中数＝「学科知识」6、「探索范围」2、「本科-硕士」4、「基础,主干,分支,前沿」3、「本次新增的待探索领域」1、「参照美国主流高校」3。**真机实测**（`#/admin/downloads?v=req103s5`，内置浏览器 `evaluate_script`）＝① **添加领域**弹窗五字段序与标签＝领域名（必填；创建后不可改）→ 领域描述（可选）→ 学科知识（可选）→ 探索范围（可选）→ 学习阶段（可选，逗号分隔）；默认值侧＝学科知识预填 §3.1 默认句（98 字符）、探索范围＝本科-硕士、学习阶段＝基础,主干,分支,前沿，领域描述留空且 placeholder 为默认句 ⇒ 与 §3.1 表一致。② **描述插值与手改不覆盖**＝键入领域名「拓扑学」→ 描述自动填默认句；改手写「我自己写的描述」后再把名称改成「拓扑学与图论」，描述保持手改值（`handEditKept=true`）。③ **编辑领域知识**弹窗＝五字段同序、领域名只读（`readonly=true`，值回填「数学（高等数学）」）、探索范围回填库值 `level`＝本科、学习阶段回填 `stages`＝基础, 主干, 分支, 前沿 ⇒ 标签唯一口径成立（`scope` 称学科知识、`level` 称探索范围，两处不互换）；该弹窗在五字段之后另带「课程方向（classic tracks）」列表块，不影响 §3.1 的五字段口径，本批只如实记形。④ **三档宽度** 1600／1200／860 下五字段序与默认值稳定；但内置浏览器视口 0×0 ⇒ `getBoundingClientRect` 宽度恒 0，只能取 top 单调序（232／472／668／842／994）作形态证据，取不出对齐像素结论——本项属字段口径核对而非版式改动，故不据此判红。⑤ **领域确认弹窗（第三处入口）本轮不可达**＝其按钮只在 `exploration_stage=已生成` 出现，而现网唯一域 `math-advanced` 实读 `exploration_stage=已完成`、`explore_pending=null`（`GET /domains/math-advanced/explore-status` 取证）；进入该态需真跑一次领域探索＝模型调用＋库内写，越出本轮零写约束 ⇒ 该入口只有**共用常量**（`DomainConfirmModal.tsx:245-271` 用同一组 `DOMAIN_LABELS` 与默认句）＋`DomainConfirmModal.test.tsx` 8 例（含「字段顺序与添加弹窗一致，探索范围回填 level、学科知识回填 scope」）两重覆盖，**未做真机实测，如实标为半腿**。**网络与控制台面**＝请求（面板 238 条、末次复核 248 条）全部指向 8900、无一直连 8901／8902（ADR 0007 成立）、状态码全 200、控制台零消息；方法面只有 GET／OPTIONS，无 POST／PATCH／PUT／DELETE（两枚弹窗均以「取消」关闭，末态停在 `ant-zoom-leave` 属隐藏视口下动画不收敛的已知形态）；`GET /domains` 七字段 sha256 快照 before＝after 逐枚相同 ⇒ **零库内写实证**。附带一条与本轮无关的观察＝`/courses` 轮询实测间隔 60,000 ms 一档、本会话累计 219 次是长开标签页所致，非缺陷。**产出＝测出 DEFECT-024**（`scope` 回填缺口＋空串可覆写用户已写值，已登线 3，修复口径甲／乙／丙待裁）。**S5 判据状态**＝两枚入口真机过＋一枚入口降级为源码与单测覆盖，是否据此判 S5 达成**待用户认**（本批不自行判绿、不改 todo 行判据正文）。**根侧门禁**（本壳写定后串行跑，QED_env 解释器）＝`pytest tests -q` **878 passed／0 failed**（含 `tests/contract`）＋`pytest tests/contract -q` **89 passed**＋`ruff check backend tests scripts` All checks passed；同窗口内曾两次采到**非本批文件**的瞬时红（一次＝ARCH-025 行与其壳标题镜像不一致，一次＝`2026-09-22-learning-design-mainline.md` 出链指向尚未改名的计划壳），均为并行窗口在途改名的中间态，复跑即净，本批未代其修亦不碰其文件。
- **2026-10-24 晚批（三项裁决落地：线 1 移交／REQ-103 收口／DEFECT-024 口径；纯文档面，零代码、零 DDL、零库内写、零 git）**：用户指令原文＝「现在主要还有哪些任务，按照条目（人类易读易理解的说法）还有什么需要完成的部分，我理解ARCH-024本地模型链路后续可放在本地模型稳定性轮（ARCH-028）中进行优化，其他部分基本完成，REQ-103应该基本完成可以收尾；DEFECT-024 需要登记先给我解释是什么问题，目前我倾向乙方案」。三项落地＝① **线 1 移交 ARCH-028**（取上一批待裁三项里的 (b) 案）：本壳线 1 唯一条目「论文检索计划质量三因」状态格改判为**已改判移交**、退为指针，现承载＝[ARCH-028 壳新工作项 W15](2026-09-23-local-model-stability-round.md)（承接面只取②截断/修复重试同哈希的取证与参数标定，随 REQ-100 L2 型滚动；①分类越界与③兜底中文整句检索仍属对方业务/prompt 所有权面，其 QED-074，本壳不代定口径）；ARCH-028 的 S1~S7 判据零改写、W15 不入其关闭前置（与 W14 同处置）；线 1 表下加「现状」注记＝本线无开放条目，2026-09-22 范围边界裁决不变。② **REQ-103 整行收口，取值 `Partial`**（不是 Achieved）：逐 S 对照＝S5 达成（2026-10-24 取证批，取值口径见下），S1 的排期半句与 S2~S4 全属**对方腿未做**且是本轮目标本体（「用户填的四字段真正决定探索输入与范围边界」），按 task-lifecycle「有未做的核心项记 `Partial`，无论其去向（移交、后置、放弃）」与 ADR 0022 决定 3 取值（判例＝同日 REQ-119 的 S2 未兑现）；**S5 判绿取值**＝两枚入口真机过（添加领域／编辑领域知识）＋第三枚入口（领域确认弹窗）按共用常量与 `DomainConfirmModal.test.tsx` 八例覆盖、如实记半腿（其态需真跑探索＝模型调用＋库内写，越出零写约束）。**S 判据正文一字未改**（ADR 0022 决定 4／0023 冻结）。台账连锁＝todo `REQ-103` 行原子摘除并写 completed.md `Partial` 行（逐 S 证据）；本壳线 3 该条目状态格随步改为「已收口、保留为 BUG-004 跟踪指针」（对方腿仍在 ARCH-024 可跟踪面内，S1 一致性不漂）；REQ-103 **无独立计划壳**（行锚指 `design/frontend/downloads-ui.md`）⇒ 不涉及 `plans/index.md` 与归档 mv。③ **DEFECT-024 维持待裁、口径写清**：用户「倾向乙方案」为**倾向而非终裁**（原话带「目前」限定，且要求先解释问题），故登记面只补三条事实＝乙案覆盖面（补 `GET /courses` 载荷只消掉现网回填故障，**不消掉空串可覆写的防御缺口**）、发函与代登对方文档面**待用户明确授权**（既往授权只覆盖 REQ-119／REQ-121 那两函、不外延）、甲腿（根侧「初值缺失即不发送该字段」防御＋夹具改真载荷形状）独立成立与否待一并裁；**裁前不动码**，本批未加 todo 专行（缺陷按 task-lifecycle 允许「承载轮壳登记表里的条目」形态，判例＝DEFECT-022／023 记在 REQ-138 壳；终裁后再按所选案写定不改的 S 判据决定是否登行）。**本轮新查出的盘点事实（只读取证）**＝对方 `QED-Tracker/docs/trackers/todo.md` 与本壳三条在册开放项的对应关系未变（BUG-004 待分析无排期、BUG-005 三选一待其裁、QED-069 待开始），故 ARCH-024 收口条件（三线连续一个版本周期无新增条目）在 DEFECT-024 于本日新登的前提下**未到**，本轮不关闭该轮、只把根侧无在途腿这一事实写进三条状态格。**门禁**（本批写定后串行跑，QED_env 解释器）＝`pytest tests/contract -q` **89 passed／0 failed** ＋ 根全量 `pytest tests -q` **878 passed／0 failed** ＋ `ruff check backend tests scripts` All checks passed；本批后 `todo.md` 的 ID 行 **19** 枚（并行窗口同夜收口 REQ-134 与本批摘 REQ-103 共同落到该读数），前端零改动故未跑 web 门禁。

- **2026-10-25 线 3 DEFECT-024 根侧同步腿落地（前端四枚源文件＋八枚用例；零 DDL、零库内写、零 git）**：用户指令原文＝「继续执行，准备处理DEFECT-02问题，看我说的对不对，如果我说的没错就按照我的方法做」。定性核实＝**部分成立并拧正两处**（正文见 DEFECT-024 条目状态格）：库数据未丢（`qed_test.qed_domain` 的 `math-advanced` `scope_len=185`）、`GET /domains` 经 8900 与直连 8901 均带 `scope` 185、`GET /courses` 两处均**无 `scope` 键** ⇒ 属读面不全，故「再同步一次」只能落在补读 `/domains`，而「同步不全」那半由「取不到不发该字段」的防御腿承接。取证＝只读脚本 `tmp/d024_sync_check.py`（SELECT 长度 ＋ httpx `trust_env=False` 取键集合）。改动＝`web-ui/src/api/tracker.ts` 新增 `listDomains()`；`stores/downloads.ts` 新增 store 状态 `domainFields` 与两枚纯函数 `withDomainScopeFields`（只填缺键行、已有值不覆盖）／`mergeDomainScopeFields`，`fetchAll` 在 `/courses` 之后挂同步腿（失败静默沿用已知值、不改既有错误口径），5s 轮询只换树不清补齐值；`DownloadsTree.tsx` 初值改 `scope: action.domain.scope`（原 `?? ''`）、`DomainConfirmModal.tsx` 初值改 `scope: domain.scope`，两处提交体改为 `undefined` 时**省略 `scope` 键**、空串照常发送。TDD＝先红 2 枚（正是未实现的两件事）→ 实现 → 定向 41 passed；变异验证＝摘掉补齐腿／把 `undefined` 判定改回空串，两条守护各自判红且不多伤，验后精确回退。门禁＝`tsc -b` exit 0、vitest 串行 67 files／855 tests passed、`vite build` exit 0（`dist/assets/index-W77EQg5i.js`）。真机（8903，`?v=` 破缓存并比对 `script[src]` 哈希＝新包）＝请求主机仅 8903＋8900（ADR 0007 未破）、`GET /api/v1/domains` 200、控制台零消息、失败响应零条、右键「编辑领域知识」弹窗「学科知识」实读 **185 字符**、首句「以数学系本科至硕士阶段的研究水平为基准。基础课程为数学分析、高等代数、概率论与数理统计三门」，五字段顺序仍合 §3.1；**以「取消」关闭，未点保存**。文档随步＝[downloads-ui.md](../design/frontend/downloads-ui.md) §3.1 两条新要点＋§6 一行降级矩阵，设计侧缺漏登记 [BUGFIX-039](design-bugfix-log.md)。**遗留**＝写侧真机未验（防御腿由单测覆盖）；乙案（请对方补 `/courses` 载荷）降级为可选上游改进，发函须用户另行授权；DEFECT-024 是否另登 todo 专行待裁。**（本行三条遗留同日后续批次全部收口，本行原表述保留作当轮快照）**＝① 写侧真机验收于用户发令「开始推进：写侧真机验收」后**通过**（真机保存一次＝提交体 837 B 内含 `scope` 185 字符全文、非空串，提示「领域已更新」，保存前后 `qed_domain` 九字段 sha8 指纹逐字段相同、末态 `changed_fields` 空集，过程证据见 [普通任务轮壳](2026-09-29-ordinary-tasks-round.md) 2026-10-25「写侧真机验收」条）；② 用户复裁「乙案要做」⇒ 已发函（代登对方 `QED-083` 行与其承接节）；③ 已在根侧 todo 普通任务轮节登 `DEFECT-024` 专行作判据正本。

## 验证与验收

- 每条目修复/优化收口时：根侧改动跑对应定向测试与 `tests/contract`；子项目侧以对方回执为据。
- 本壳随条目增改更新「最后更新」，不要求单次全壳门禁事件。

## 回滚

纯记录文档：删除本文件不影响代码与测试；登记表条目对应的代码改动按各自提交独立回滚。

## 关闭与归档

关闭条件：三线连续一个版本周期无新增条目且遗留条目全部移交/关闭，由用户裁决收口；
关闭时本壳 Retain 归档 `history/plans/<year-month>/`，todo 移除 ARCH-024 任务行。
