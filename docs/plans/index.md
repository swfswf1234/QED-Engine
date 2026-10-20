# 计划索引

状态：Current
最后更新：2026-10-18

本目录保存对应**进行中任务的讨论与计划**（不确定文档，ADR 0010）；待评审设计随计划承载，
确定后按 [ADR 0011](../history/adr/v0.1/0011-pending-design-location.md) 迁入 `design/` 或合并固定文档。
完成后归档（`../history/plans/<year-month>/`）。文档分类与元数据规则见
[文档治理规范](../standards/doc-governance.md)。

## 目录边界

- 本索引只解释目录边界并链接任务台账，不维护第二张计划状态表。
- 活跃计划状态与任务清单见[任务台账](../trackers/todo.md)；关闭计划在事实
  同步且 Git 锚点有效后删除，或按归档规则进入 `../history/plans/<year-month>/`。

## 活跃计划

### 持续优化滚动记录（2026-09-22）
- ARCH-024 任务行承载壳（QED-Tracker V1.0 持续优化轮三线滚动优化记录），状态见任务台账
- ARCH-025 任务行承载壳（Axiom-Flow（V1.0）优化轮解析+知识库两线滚动优化记录，
  启动门槛＝对方达 V1.0，启动前预承接 REQ-089 调研），状态见任务台账

### 学习设计轮（2026-09-22 并轮、2026-09-23 重划、2026-09-30 增 M5、2026-10-01 增 M6：主链路 + M1~M6 模块；原 ARCH-022 + ARCH-026）
- ARCH-027 主链任务行承载壳（课程注册·链路编译·判分推进，含 L1~L9/R1 判定表与模块壳一览），状态见任务台账
- ARCH-027-M2~M5 模块任务行各配固定壳（练习与复习 / 本地模型适配层 / 知识探索 /
  知识点体系与知识梳理星图），状态见任务台账；M1（学习面 UI 与渲染基线）已 2026-10-09 收口归档（见下方已归档节）

### 其他
- [AI Agent 知识收件箱](ai-agent-knowledge-inbox.md)（REQ-062，**长期滚动收件箱**：agent
  利用经验捕获 → 审核三判据 → 批量晋升正式文档 → 体系优化；**不随任务归档**，例外依据见其头部声明）
- REQ-099 请求承载壳（（请求：Axiom-Flow）解析页区域驱动重解析与块结构编辑讨论稿，R1~R6），状态见任务台账；
  其来源任务 REQ-098 承载壳已 2026-09-29 收口归档（见下方「已归档计划」）
- REQ-101 请求承载壳（（请求：QED-Tracker）论文链路领域/课程 scope 化与书本化采纳，R1~R4，
  并入对方 QED-068），状态见任务台账

### 普通任务轮（2026-09-29 立项，2026-09-30 定为默认承载轮）
- ARCH-035 任务行承载壳（普通任务轮滚动记录：零散缺陷、`design/` 小修与治理/规范化批次的条目登记表；
  ADR 0021 起为新增小任务的**默认落点**，并入的已关闭轮残余支线在本壳加条目），状态见任务台账

## 已归档计划（2026-10）
- [子仓库技能正本治理跨项目请求稿·QED-Tracker 承接（subproject-skills-canon-tracker-request）](../history/plans/2026-10/2026-10-17-subproject-skills-canon-tracker-request.md)（REQ-124，Achieved 2026-10-20：R1 取形态②白名单（`.qoder/*` ＋ `!.qoder/skills/` ＋ `!.qoder/settings.json`，目录模式必须改内容模式否则子项无法重新纳入）、R2 其 `description` 值长 393→188 与 212→190 且主触发词保留、R3 四件套逐枚骨架对齐＋三类允许差异声明；三条均由**对方会话自写回执**为「落地」并附其门禁 667 passed／1 skipped＋ruff 净；其 opencode 接线层同批删除（可逆备份改名停用），残余仅其 `.qoder/` 提交动作属承接方在途工作；Retain 归档）
- [子仓库技能正本治理跨项目请求稿·Axiom-Flow 承接（subproject-skills-canon-af-request）](../history/plans/2026-10/2026-10-17-subproject-skills-canon-af-request.md)（REQ-125，**Partial** 2026-10-20：R1 同形白名单落地（实测四枚 `SKILL.md`＋`settings.json` 放行、`scratch`／`tmp` 仍忽略）＋其 `.opencode/skills` 联接删除、R2 其 `qed-intake:8` 端专有名改「询问用户」且 `description` 212→190、端无关复扫命中 0，其门禁 640 passed／10 skipped＋ruff 净（根侧代跑取证）；**R3 骨架对齐与自查声明未做**，前置＝根侧「技能最小契约」未定档，且 R1／R2 的取值身份是根侧代执行而非对方回执——按 task-lifecycle「有未做的核心项记 Partial」取该值，尾巴在壳「遗留与移交」第 3 条；Retain 归档）
- [四张共享表字段定档与 meta 扩展槽轮（领域·课程·知识点·LLM 记录）（shared-tables-field-freeze）](../history/plans/2026-10/2026-10-15-shared-tables-field-freeze.md)（REQ-118，Achieved 2026-10-18：四张共享表逐列定档＋四表统一 `meta JSON` 扩展槽与三条使用红线；根所属两表在 `qed_test` 就地 ALTER＋坐标回填、LLM 账表绝不重建只加列加索引，`qed_llm_calls` 三枚二级索引幂等补齐；知识点主表删恒真 `confirmed`、point 行 `book_ref` 去空串哨兵、去重键改 `(course_id, node_kind, norm_key)`、补审计两列；Tracker 所属两表出跨项目请求稿 REQ-119；两枚死列经用户 2026-10-18 复裁收回改判＝两列都删、执行归对方（随 REQ-119 R5）；2026-10-17 生产 `qed` 库结构对齐与回灌由用户授权在本窗口执行完毕（原「转人工」条目撤销）；收口前补三链与库内形状只读复核（outline 坐标 95/95、point `book_ref` NULL、账表 116 行走新索引）；门禁 契约 89＋全量 819 passed＋ruff 净；Retain 归档）
- [开发流程演进轮（schema 重建档位·demo 门·范围锁死）（dev-process-evolution-round）](../history/plans/2026-10/2026-10-14-dev-process-evolution-round.md)（REQ-112，Achieved 2026-10-18：三项 2026-10-14 流程裁决全部落进标准正文——ADR 0024 立档、`database-design.md` §7.3 四档重建档位表（自由重建档／有外部写方例外档／备份确认档／生产红线）＋备份临时制验收即清、`task-lifecycle.md` demo 门（一壳一门默认、壳过大按 S 分里程碑、到门暂停待人工验收）＋`development.md` 六步第 4 步人类决策点＋`AGENTS.md` 第一性原理半句、`code-standards.md` 范围锁死禁止行、根三技能（intake/plan/implement）各补 ADR 0024 指针句；不新增机械守护（ADR 0024 明文），零代码改动；W2~W6 由用户 2026-10-18 人工验收通过；唯一遗留＝QED-Tracker `qed-db-alter-redline-window` 档位指针移交单未回执（记在归档壳「遗留与移交」，可并入 REQ-124 附带处理）；Retain 归档）
- [学习中心·课程学习面重设计轮（消费成品·与文档分析处理划界）（learn-course-study-redesign）](../history/plans/2026-10/2026-10-15-learn-course-study-redesign.md)（REQ-117，Achieved 2026-10-18：三方生产者/消费者划界逐条有裁决（C1~C6）并回写文档，目录生成·链路准备·知识点确认三生产职责移交 REQ-116，学习面按「章 ＋ 知识点」两级逐条阅读与推进；v2 设计本体一次晋升 [learning-course-ui.md](../design/frontend/learning-course-ui.md)（确认状态＝暂定）并收敛全仓指针七处；demo 门 2026-10-16 真机走通、请求账全指 8900；孤儿 `TocConfirmPanel.tsx` 删除、`tocParse.ts` 经消费者取证保留；门禁 契约 88＋全量 813 passed（1 枚红＝并行共享表轮的 QED-Tracker 死链）＋ruff＋`tsc -b`＋vitest 串行 66 files/843 tests＋build；LLM 生成/点赞两腿取证与知识点生产腿移交，不留尾；Retain 归档）
- [学习中心三界面拆分与设计稿轮（原学习功能现状基座）（learning-center-current-state）](../history/plans/2026-10/2026-09-10-learning-center-current-state.md)（REQ-070-LEARN，Achieved 2026-10-18：三界面在**设计层**拆净——A 知识探索／B 课程学习／C 课后练习三份独立设计稿全部晋升 `design/frontend/`（C 2026-10-14、A 2026-10-15、B 由 REQ-117 以 v2 本体 2026-10-18），原 `design/` 两份学习文档回收与全仓引用清扫完成，跨界口径（星图面移除学习/复习跳转、练习独立面新路由、首页三卡各指独立面）写入各自正本；v1 课程学习稿按用户 2026-10-15 裁决留改不晋升、随壳归档；Retain 归档）
- [数据库设计总纲升为三项目数据库总正本（共享四表与根私有七表逐列定义＋建表语句）（database-design-core-registry）](../history/plans/2026-10/2026-10-16-database-design-core-registry.md)（REQ-122，Achieved 2026-10-17：八段骨架重写＝前言与 R1~R12 规则／全库 21 表总览／整体架构五节（访问拓扑＋跨族数据主线＋双 ER 关系视图＋读写矩阵＋表角色分类）／本文所辖 11 表逐列定义与建表语句／他项目表族与同步契约／变更与运维规范／守护与验证；根侧九表 DDL 与代码渲染结果逐字注入并对齐、受托两表按对方 ORM 等价展示，`qt_*`／`af_*` 只在总览登记与路由；正文去过程化且去任务编号引用，一次性事实落备注列与 7.8 T1~T9；四枚守护新增并逐枚变异验证打红后还原；同日曾按 Achieved 关闭后因用户五点优化裁决收回、W10 落地后二次关闭；门禁 契约 89＋全量 805 passed（5 枚失败归属并行窗口新增用例）＋ruff 净；R1~R5 请求稿待转达（壳 W7 跟踪）；Retain 归档）
- [学习中心·课程学习界面设计稿（learning-course-ui）](../history/plans/2026-10/2026-10-11-learn-ui-course-study.md)（REQ-105，Achieved 2026-10-16：单屏三栏工作台＋自动目录＋多教材顺序学＋批注闭环＋勾选推进/断点/结课，S1~S5 逐条真机与门禁取证；设计本体按用户 2026-10-15 裁决**留改不晋升**随壳归档，晋升义务与三项冒烟新发现、两处实现/设计漂移一并移交 REQ-117；门禁 契约 82＋全量 746＋ruff＋`tsc -b`＋vitest 串行 63 files/762 tests）
- [前端设计整合轮（frontend-design-consolidation）](../history/plans/2026-10/2026-10-15-frontend-design-consolidation.md)（REQ-115，Achieved 2026-10-15：design/frontend/ 子目录 + 前端总设计文档（视觉单一正本自 frontend-architecture 迁入）+ 六份 UI 文档迁入 + 全仓 md 引用改道 + test_design_documents 递归守护改造 + frontend-architecture 收敛纯技术架构；文档分析处理拆出 REQ-116，课程学习（REQ-105）与 web-ui DesignRef 注释为移交遗留；门禁 契约 82 + test_web 13 + pytest 742 + ruff + tsc + vitest 760；Retain 归档）
- [论文展示行与行内探索·根侧实现（paper-display-row-root-impl）](../history/plans/2026-10/2026-09-30-req102-paper-display-row-root-impl.md)（REQ-102，Achieved 2026-10-09：8900 papers 透传五端点 + 8903 领域/课程论文展示行与探索管理弹窗 + 设计五面晋升；真机端到端 ranked→adopt→取书→验收（`mathadvanced-b19` 至 `verified`），浏览器实测只连 8900；门禁 vitest 624 + tsc/build 零错 + 全量 734；Retain 归档）
- [学习设计轮 M1·学习面 UI 与渲染基线（learning-ui-rendering）](../history/plans/2026-10/2026-09-23-learning-ui-rendering.md)（ARCH-027-M1，Achieved 2026-10-09：8903 学习面书架 + 三栏工作台「阅读／链路」双模式 + 块序列页窗渲染 + 看板/结课只读派生进度，真实课程数据端到端真机跑通；S1 四面核销含图片面按用户裁决 ① 纯前端页图 `bbox` 裁切交付；D1~D4 全按推荐口径批复；本轮内关闭 BUGFIX-026；错题本移交 M2、生成正文归 M-2、掌握门归 M-3，UI-5 选区追问归属待裁；门禁 契约 82 + 全量 655 + ruff 绿 + vitest 624 + tsc/build 零错；Retain 归档）
- [学习设计轮 M2·练习与复习（practice-review）](../history/plans/2026-10/2026-09-23-practice-review.md)（ARCH-027-M2，Achieved 2026-10-09：练习域三表 + 8900 八端点 + 抽取式题源纯函数与确认面板 + 间隔复习调度双粒度 + 错题本读时派生，8903「课后练习」全链真机端到端跑通（b05 页 45–47 → 抽取 29 → 确认入库 → 作答判分 → 右栏到期/错题 → 复习入口回跳）；期间关闭 DEFECT-012/013 两枚语义缺陷；v1 只走现成题源，v2 两段式生成另立任务行；题源书 7 本未解析属人工批准的数据窗口；生产 `qed` 库 DDL 属 D 类转人工；门禁 契约 82 + 全量 655 + ruff 绿 + vitest 串行 626/0 + tsc/build 零错；Retain 归档）
- [知识点体系与知识梳理星图（knowledge-point-star-map）](../history/plans/2026-10/2026-09-30-knowledge-point-star-map.md)（ARCH-027-M5，Achieved 2026-10-01：两表契约正式冻结 + 8900 两表七端点 + 8903 星图页与课程知识点页三轮反馈落地；D1~D6 全按推荐口径批复；设计晋升并确认 [learning-star-map.md](../history/plans/2026-10/learning-star-map.md)；「知识点内容写入」移交主链 M-2/M2，不留尾；Retain 归档）
- [书籍目录知识点树与三栏学习工作台（toc-knowledge-tree-and-learn-workbench）](../history/plans/2026-10/2026-10-01-toc-knowledge-tree-and-learn-workbench.md)（ARCH-027-M6，Achieved 2026-10-05：知识点两表 v2 层级化（outline＝目录章／point＝细知识点同表）+ 目录页文本纯函数解析与整树写入 + 8903 三栏工作台批注→候选→确认闭环，8902 恢复后浏览器黄金路径真机通过；R7~R10 与 DEFECT-011 修法（唯一键降级为普通索引）全按推荐口径批复；期间关闭 DEFECT-010/011 两枚；设计晋升 [learning-workbench-ui.md](../history/plans/2026-10/learning-workbench-ui.md)；LLM 生成叙述与掌握态分别移交 M3/M-3，不留尾；Retain 归档）
- [学习中心·课后练习独立面设计稿（learning-practice-ui）](../history/plans/2026-10/2026-10-11-learn-ui-practice.md)（REQ-106，Achieved 2026-10-14：`#/practice` 独立面上线（课程选择器＋今日面板单请求 `max_tasks=100`＋题源抽取→人工确认入库→题卡作答判分＋错题本人工位），归属改课级全量、`gen_batch` 保持 `workbench-extract`、面间零跳转且入口唯一＝首页卡；真机 b05 页 45–47 抽取 29→入库跳重→作答持久行，28 请求全指 8900；**设计晋升 [learning-practice-ui.md](../design/frontend/learning-practice-ui.md)（确认状态＝暂定，§7 抽取规格为唯一正本）**，`frontend-architecture.md` 与两份代码 docstring 指针同批改指；三面同批晋升裁决部分改判＝REQ-104/105 两面仍待晋升；门禁 契约 82 + 全量 737 + ruff + tsc/build + vitest 串行 748；Retain 归档）
- [文档下载管理·论文线合并设计与实施基准（paper-explore-ui-and-papers-column）](../history/plans/2026-10/2026-10-11-paper-explore-ui-and-papers-column.md)（REQ-107，Achieved 2026-10-14：论文线在 plans/ 合并为**单一执行基准**（已交付现状基线＋设计本体五面＋实施清单 I1~I14＋晋升清单），R1~R12 与 Q1 逐条有裁定并写回壳；I1~I7 由 REQ-108、I8~I14 由 REQ-109 实施完毕，按用户晋升令把正文并入 [downloads-ui.md](../design/frontend/downloads-ui.md) §3／§4.1／§4.4（整节重写）与 [downloads-flow.md](../design/downloads-flow.md) §7；`code-map.md` 经核无需增行；三壳同批 Retain 归档）
- [文档下载管理·论文线界面实施（paper-ui-implementation）](../history/plans/2026-10/2026-10-11-paper-ui-implementation.md)（REQ-108，Achieved 2026-10-14：按 REQ-107 壳 I1~I7 改造 8903 论文线界面（入口按钮同排右靠齐／探索弹窗五段含检索口径段／待选区间双门槛与逐条归因／论文详情与按需回源／左树论文节点与卡片列），纯前端零新端点；浏览器实测 E1~E5 全过、36 条请求只指 8900，vitest 串行 691 + `tsc -b`／build 零错；「采纳＋取书」真机腿按用户裁决不补，端到端证据沿用 REQ-102 W5（`b19` 至 `verified`）；Retain 归档）
- [文档下载管理·论文线界面第二轮迭代（paper-ui-iteration-2）](../history/plans/2026-10/2026-10-11-paper-ui-iteration-2.md)（REQ-109，Achieved 2026-10-14：REQ-107 壳 §11＋I8~I14 落地——检索方向四值根侧参数映射（`paperDirections.ts`：深度复用 `core`、匹配复用 `frontier`）、段①不露推荐上限且恒 `top=5`、历史探索清单单按钮直达段④、段④只列未采纳且达线并剔除已采纳／已在库、旧论文展示行整行删除＋徽标进汇总行；四方向各发起一次真实探索留证（仅前沿 `ranked` 推荐 5 篇，核心／深度／匹配三份 `no_candidates`，归因在 8901 检索计划的分类越界与模型响应 577 字符截断、兜底检索词为中文整句）；两枚界面口径缺口按裁决不登行、写在壳「遗留与移交」；零新端点零契约变化；Retain 归档）
- [学习中心·知识点探索课程层关系星图改造（learn-ui-course-star-graph）](../history/plans/2026-10/2026-10-14-learn-ui-course-star-graph.md)（REQ-111，Achieved 2026-10-15：课程层由浅色卡内层级框图改为**同一暗色星空层上的发光圆点＋名称标签＋层级关系线**（几何沿用 `kpTreeLayout` 分层阶梯坐标，只换视觉图元），节点悬停＝知识点介绍、关系线悬停＝一句归属说明，左上只显《课程名》、领域切换只经面包屑；真机 96 行取证（`.kn-course-card` 0／combobox 0／96 个 path 符号／边悬停命中 `ec-line`）＋ vitest 串行 756／`tsc -b`／build／pytest 737／ruff／契约 82 全绿；同日六审补判＋七审改判——三列阶梯形态作废，宽度跟随容器与去编辑侧字段两项**移交 REQ-113**、outline 摘要通道**移交 REQ-114**；Retain 归档）
- [学习中心·知识点探索界面设计稿（learn-ui-knowledge-point-exploration）](../history/plans/2026-10/2026-10-11-learn-ui-knowledge-point-exploration.md)（REQ-104，Achieved 2026-10-15：设计稿 A 实施轮＋四行合一份晋升——独立面边界（删全部跨界学习／复习出口、总标题统一、首页 Hero 去「建设中」行、课程下钻改层级图）落地；设计本体整篇去过程化晋升 [knowledge-point-exploration-ui.md](../design/frontend/knowledge-point-exploration-ui.md)）
- [学习中心·知识点探索同页化与星图悬停叙述（learn-ui-knowledge-single-page）](../history/plans/2026-10/2026-10-11-learn-ui-knowledge-single-page.md)（REQ-110，Achieved 2026-10-15：`#/knowledge` 单页两视图（深链 `?course=`、面包屑不显领域名、删 `#/knowledge/c/:courseId` 独立页）＋ 课程卡悬停两行＝课名＋叙述（`star-map` course 补 `description`、计数段删除），设计口径随四行合一份晋升）
- [学习中心·知识点探索课程层大小知识点重设计（learn-ui-course-kp-boxmap）](../history/plans/2026-10/2026-10-15-learn-ui-course-kp-boxmap.md)（REQ-113，Achieved 2026-10-15：七审课程层＝大知识点虚框纵向堆叠（＝学习顺序）＋框内小知识点条目行优先网格、归属由虚框承载不画层级线，画布宽＝内容区实测宽＋取景锚使系数恒 1，悬停只名称＋摘要，学习面去「未归档」，真机 9 框／87 条目验收通过）
- [学习中心·知识点摘要写入通道（learn-outline-summary-channel）](../history/plans/2026-10/2026-10-15-learn-outline-summary-channel.md)（REQ-114，Achieved 2026-10-15：8900 开放 outline/point `summary` 写入（PUT 树节点可选 `summary`≤1000、PATCH 白名单补该字段、整树重写不抹原值，零迁移零新增查询），真机冒烟含 422 守卫不脏数据与 8903 悬停出摘要）

## 已归档计划（2026-09）
- [运行时产物与备份面规范化（logs/tmp/scripts/backups 落点收口）（runtime-artifact-placement-round）](../history/plans/2026-09/2026-09-29-runtime-artifact-placement-round.md)（ARCH-036，Achieved 2026-10-17：ADR 0019 立档 + `storage-conventions.md`「仓库根运行时产物与备份面」节含长期哨兵区 + 契约四枚守护先红后绿；DEFECT-007 日志路径按实际写入点解析并经 8900 重启真机复核；`scripts/` 一次性面清理、根 `backups/` 与 `backend/database/backups/` 物理删除、`.gitignore` 退役条目移除；`logs/` 两批清理（19 个四代命名遗留 + 61 枚零引用件），7 枚被文档认领的证据件按用户裁决保留作例外并登记名单；W7 日志轮转属范围外登记项；壳 Retain 归档）
- [解析页框图编辑与版式重排版设计（parsing-region-edit-typography）](../history/plans/2026-09/2026-09-26-req098-parsing-region-edit-typography.md)（REQ-098，Achieved 2026-09-29：框图工作台＋版式重排版＋W8 顶栏四行重排＋W9 撤销缩放落地，W5 按降级稳态移交 ARCH-025 线 1）
- [解析产物存储单一事实源优化（parsing-storage-single-truth）](../history/plans/2026-09/2026-09-26-parsing-storage-single-truth.md)（REQ-097，2026-09-26 收口：Axiom-Flow PLAN-017 实施回执 + 根侧 S6 真机回归通过；设计晋升与目标态正文见 parsing-flow.md §5 / dataset-conventions.md）
- [本地模型启动参数配置（model-startup-params）](../history/plans/2026-09/2026-09-24-model-startup-params-round.md)（ARCH-033，Achieved 2026-09-24：加载层参数挂 registry 身份表全链路生效——lms load 带参 + `-y` 非交互、llamacpp 通道真做（LM Studio 自带二进制与 GGUF）+ 5001 双向互斥让位（unload --all + server stop）；27B@8192/9B@16384 真机读回、三缺陷 TDD 修复；设计事实晋升 [local-model-management.md](../design/local-model-management.md)「本地模型启动参数契约（加载层）」节；收口门禁 569 + 契约 68 绿；壳 Retain 归档）
- [管理台展示优化（admin-display-optimization）](../history/plans/2026-09/2026-09-24-req033-admin-display-optimization.md)（REQ-033，Completed 2026-09-24：用户五改验收发令收尾——S1~S5 全达（GPU SWR 提速/增量刷新/在跑标注/三块制五改形态/设计收口），门禁 vitest 239 + tsc -b + build + 全量 pytest 569 + 契约 81 绿 + 浏览器实测；设计事实晋升 [admin-dashboard.md](../design/frontend/admin-dashboard.md) 与 [local-model-management.md](../design/local-model-management.md)；壳 Retain 归档）
- [架构文档契约形态轮（architecture-contract-shape-round）](../history/plans/2026-09/2026-09-24-architecture-contract-shape-round.md)（ARCH-031，Achieved 2026-09-24：api-contracts/database-design 收口为只写当前契约+事实源唯一+门禁防漂移形态，端点总表↔app.routes 85 条双向守护、qed_* 零 DDL+ER 图+读写矩阵，两文档转已确认；收口复跑契约 68 + 全量 483 绿；壳 Retain 归档）
- [存储链路规范化轮（storage-chain-governance-round）](../history/plans/2026-09/2026-09-24-storage-chain-governance-round.md)（ARCH-032，Achieved 2026-09-26：W1~W8 全达成——ADR 0018 立档、dataset-conventions/storage-conventions 实况化（白名单哨兵/active_job_id 指针/tmp 规则）、契约守护 3 新增、缺口台账 REQ-091~096、两端存储链路设计约束固化（dataset-conventions 新增原则节/exploration-pipeline/download-pipeline 约束注记）；QED-Tracker A 轮回执已收（QED-071：D3 留痕判废+R2 年龄清扫+B 轮设计契约定稿）；门禁 W7：契约 68 + 全量 483 绿；壳 Retain 归档）
- [跨项目契约总指引轮滚动记录（运行矩阵·契约演进·错误透传·归属指引）（cross-project-contract-guide-round）](../history/plans/2026-09/2026-09-24-cross-project-contract-guide-round.md)（ARCH-030，Achieved 2026-09-24：总指引内容并入 [cross-project-contracts.md](../design/cross-project-contracts.md) §9~§12 与 [four-service-architecture.md](../architecture/four-service-architecture.md) 改动归属判定表；8901/8902 只留能力面（端点详表收回子仓库，ADR 0017 铁律）；壳 Retain 归档）
- 设计文档结构契约轮（design-doc-structure-contract）（PLAN-053 / ARCH-029，Achieved 2026-09-24：按归档判定 Delete 移除——规范正文并入 [ADR 0017](../adr/0017-design-doc-structure-contract.md) 与 [doc-governance.md](../standards/doc-governance.md)「设计文档结构契约」节，六篇现状以各自文档为准，关闭证据见 completed.md ARCH-029 行）
- [文档解析管理·与 Axiom-Flow 交互全链路（parsing-flow）](../history/plans/2026-09/2026-09-14-parsing-management-axiom-flow-chain.md)（PLAN-044，Achieved 2026-09-23：用户裁决晋升收口——**独立晋升 [design/parsing-flow.md](../design/parsing-flow.md)**（与 parsing-ui.md 合并评估裁决＝不合并、互链分工）；af_* 全量 DDL 根侧快照吸收版本作用域与结局分列迁移演进；剩余端点（GET /parse-jobs 列表）实现与登记随收口并入；Retain 归档）
- [根仓库前端（8903）渲染优化滚动记录（web-ui-rendering-optimization）](../history/plans/2026-09/2026-09-22-web-ui-rendering-optimization.md)（PLAN-051 / ARCH-026，Not Applicable 2026-09-22：2026-09-22 并轮裁决——渲染线成为学习设计轮 W1 前置（2026-09-23 重划后由 M1 学习面 UI 与渲染基线壳承接），壳 Superseded；登记表为空、无遗留条目迁入；Retain 归档）
- [learning/ 类目退役改造计划（learning-retirement）](../history/plans/2026-09/2026-09-22-learning-retirement.md)（PLAN-052 / REQ-090，Achieved 2026-09-22：ADR 0015 类目退役——docs/learning/ 8 份文件整体删除、doc-governance 三条目与契约目录清单摘除、现行引用改道正式稳定文档；Retain 归档）
- [b05 全本解析止血与根治轮（b05-fullbook-remediation）](../history/plans/2026-09/2026-09-21-arch020e-b05-fullbook-remediation.md)（PLAN-048 / ARCH-020-E，Completed 2026-09-22：600s 墙根因取证 + 逐页止血 312/317 + 补跑证伪 + 空白页判失败根因（REQ-087 登记）；用户裁决**部分验收**收口 E，验收实测证据全在壳内 W4 行）
- [design 文档整合轮（design-docs-consolidation）](../history/plans/2026-09/2026-09-21-design-docs-consolidation.md)（PLAN-047，Achieved 2026-09-21：design/ 13 份去过程化重写 + document-chunking-recall 按 ADR 0011 移回 plans/（REQ-082）+ design/index 三矛盾修正；契约 63 + 全量 500 + ruff 全绿；用户终验裁决全部晋升「已确认」）
- [模型注册表与三接口统一轮（llm-registry-unification）](../history/plans/2026-09/2026-09-16-llm-registry-unification.md)（PLAN-046 / ARCH-023，Achieved 2026-09-21：registry/runtimes + 四段式 env + 控制台三卡 W1~W9 落地，W7/W10 真实冒烟全绿（含 BUGFIX-008 api 回退链尊重 .env）；设计事实并入 [design/llm-gateway.md](../design/llm-gateway.md) 与 [design/local-model-management.md](../design/local-model-management.md)，壳归档）
- [解析界面单屏回调轮（parsing-sidebar-single-view）](../history/plans/2026-09/2026-09-20-parsing-sidebar-single-view.md)（ARCH-020-G，Achieved 2026-09-20：单屏「左树纯选择+右对照」定档，R1~R5 全段+复审修正 BUGFIX-007；裁决并入 [design/parsing-ui.md](../design/frontend/parsing-ui.md)，壳归档）
- [解析界面工作台重设计轮（parsing-workbench-redesign）](../history/plans/2026-09/2026-09-20-parsing-workbench-redesign.md)（ARCH-020-WB，Partial 2026-09-20：设计并入 parsing-ui.md、D 轮实现成果保留；两级界面形态被 G 轮裁决取代，壳归档）
- [解析界面展示优化轮（parsing-display-round）](../history/plans/2026-09/2026-09-20-parsing-display-round.md)（ARCH-020-UI，Achieved 2026-09-20：大屏/A4 基准/原始文件优先并入 parsing-ui.md（BUGFIX-006），产物版本划分归 dataset-conventions/REQ-080；壳归档）
- [本地模型部署轮（local-model-deployment）](../history/plans/2026-09/2026-09-14-local-model-deployment.md)（PLAN-045，Achieved 2026-09-14：MinerU 去模型化镜像重建 + 卷挂载 + mineru.json 路径校准 + 探针端点校准 + 8900 集成 + 真实解析冒烟；事实并入 [design/local-model-management.md](../design/local-model-management.md) 与 `scripts/image-model/README.md`）
- [文档解析管理·前端设计（parsing-ui）](../history/plans/2026-09/2026-09-14-parsing-management-frontend-design.md)（PLAN-043，Achieved 2026-09-14：设计定稿并经用户评审确认，晋升 [design/parsing-ui.md](../design/frontend/parsing-ui.md)；实现归 ARCH-020-D，后端全链路归 PLAN-044）
- [本地模型管理整理轮（local-model-management-reorg）](../history/plans/2026-09/2026-09-14-local-model-management-reorg.md)（PLAN-042，Achieved 2026-09-14：TEXT_SCRIPT 硬伤修复 + Qwen 切 llama.cpp + 槽位目录/manifest + 全量去 LM Studio + MinerU 清理核查；设计事实并入 [design/local-model-management.md](../design/local-model-management.md)，部署另起 PLAN-045）
- [文档解析管理界面优化（ARCH-020 前端部分）](../history/plans/2026-09/2026-09-14-arch020-parsing-ui-redesign.md)（Superseded，2026-09-14 随 ARCH-020 重构归档：内容并入 [design/parsing-ui.md](../design/frontend/parsing-ui.md)）
- [文档解析管理现状（Parsing）](../history/plans/2026-09/2026-09-10-parsing-management-current-state.md)（REQ-070-PARS，Achieved 2026-09-14：现状事实并入 [design/parsing-ui.md](../design/frontend/parsing-ui.md) 与 PLAN-044 后退役归档）
- [REQ-032 meta/ JSON 退役计划](../history/plans/2026-09/2026-09-01-req032-meta-json-retirement.md)（REQ-032，已归档：Phase 1+2 完成，Phase 3 暂缓）
- [文档探索+下载全流程计划（exploration-download-flow）](../history/plans/2026-09/2026-08-27-exploration-download-flow.md)（PLAN-022，Achieved 2026-09-11：B1-B5/F1-F5 全量执行，状态机/交互事实源迁 [design/downloads-flow.md](../design/downloads-flow.md)；随 ARCH-019 收尾归档）
- [文档下载管理页面交互规范（downloads-interaction-spec）](../history/plans/2026-09/2026-09-10-downloads-interaction-spec.md)（PLAN-037，Achieved 2026-09-11：课程详情弹窗状态机 + 书目详情确认下载链路；实现落地，随 ARCH-019 收尾归档）
- [文档下载管理全链路文档对齐轮（downloads-doc-alignment）](../history/plans/2026-09/2026-09-11-downloads-doc-alignment.md)（PLAN-038，Achieved 2026-09-11：领域 6 态/课程 5 态/书籍 8 值/UI 5 档口径统一；契约 63 passed）
- [统一上传与书目详情界面优化（unified-upload-book-detail）](../history/plans/2026-09/2026-09-11-unified-upload-book-detail.md)（PLAN-039，Achieved 2026-09-11：multipart 上传 + 书目详情重设计；门禁全绿）
- [8900 书籍路由集对齐（book-route-alignment）](../history/plans/2026-09/2026-09-11-book-route-alignment.md)（PLAN-040，Achieved 2026-09-11：`POST /books` 目标契约/201 + `cancel` + 删旧端点；门禁全绿）
- [领域探索阶段修正与第二轮主线收尾（arch019-stage-fixes-closeout）](../history/plans/2026-09/2026-09-11-arch019-stage-fixes-closeout.md)（PLAN-041，Achieved 2026-09-11：`已生成` 可探索 + 离线默认 `未开始` + 导入 409 修复；随 ARCH-019 收尾归档）
- [联调问题解决清单（QED-Engine ↔ QED-Tracker）](../history/plans/2026-09/2026-09-08-integration-issues-checklist.md)（REQ-068-PLAN，Achieved 2026-09-11：ISSUE-001~008 全部 Closed，随 ARCH-019 收尾归档）
- 根开发指南重整（dev-guide-rework，已删除：REQ-072 关闭，事实并入 `docs/guides/development.md`、`docs/guides/index.md`、`docs/standards/local-dev.md`；Delete 判定）
- Agent 开发流程规范体系（agent-doc-governance，已删除：REQ-071 关闭，事实并入新增 `standards/code-standards.md`、`standards/storage-conventions.md`、`AGENTS.md` 骨架与 ADR 0013；Delete 判定）
- [课程详情弹窗状态机优化（course-detail-state-machine）](../history/plans/2026-09/2026-09-09-course-detail-state-machine.md)（PLAN-035，已归档：合并入 PLAN-037 文档下载管理页面交互规范，DEFECT-002 治理合规化）
- [书目详情"确认下载"链路重构（book-detail-download-flow）](../history/plans/2026-09/2026-09-09-book-detail-download-flow.md)（PLAN-036，已归档：合并入 PLAN-037 文档下载管理页面交互规范，DEFECT-002 治理合规化）
- 知识 API 对接与 exploration_stage 修复（knowledge-api-and-exploration-stage，已删除：实现事实并入 [architecture/api-contracts.md](../architecture/api-contracts.md) 的 PATCH/DELETE knowledge 端点登记，Git 锚点 fc7a94c）
- [design/ 文档体系固定化重构计划（REQ-070）](../history/plans/2026-09/2026-09-10-req070-design-restructure.md)（REQ-070，Achieved 2026-09-10：design/ 20 份 → 12 份语义名五组固定 + 2 份 plans/ 现状文档（REQ-070-PARS/070-LEARN）+ 6 份过时文档删除靠 git 恢复 + DesignRef 全量同步；契约 52 + 全量 401 passed；计划壳 Retain 归档）
- [AI 开发守则整合轮（REQ-069）](../history/plans/2026-09/2026-09-10-req069-ai-dev-conduct.md)（REQ-069，Achieved 2026-09-10：守则落位——AGENTS.md 变更分级边界节 + development.md 六步流程节 + design-bugfix-log 台账，ADR 0012；同轮治理 superpowers/ 违规目录删除 + PLAN-035/036 迁正 + api-contracts 端点补登记；计划壳 Retain 归档）
- [文档下载管理界面共享表优化（REQ-067 综合计划补充）](../history/plans/2026-09/2026-09-02-req067-shared-tables-optimization.md)（PLAN-028，已归档：成功标准 8/8 达成、门禁全绿（pytest 353 + ruff + vitest 160 + build + 契约 52）；浏览器手动导入轮验收由用户清库后执行）
- [文档下载管理领域探索 UI 逻辑与展示规范（arch019-explore-ui-logic）](../history/plans/2026-09/2026-09-08-arch019-explore-ui-logic.md)（PLAN-033，已归档：实现完成（2026-09-08 用户裁决四项 UI 改造 R1~R4 + 前端 F1~F6，门禁全绿），设计事实迁入 [design/downloads-flow.md](../design/downloads-flow.md)）
- [领域探索后端链路与端点契约（arch019-explore-backend-chain）](../history/plans/2026-09/2026-09-08-arch019-explore-backend-chain.md)（PLAN-034，已归档：5 端点实装 + 写点矩阵落地 + test_domain_explore.py 14 用例 + 契约登记（2026-09-08），设计事实迁入 [design/downloads-flow.md](../design/downloads-flow.md)；8901 移交清单为 REQ-068 持续跟踪）
- [领域探索状态机设计（exploration-state-machine）](../history/plans/2026-09/2026-09-07-exploration-state-machine.md)（已归档：被 PLAN-033 吸收合并，失败态口径由 PLAN-033 补齐）
- [领域探索状态机实施计划（exploration-state-machine-plan）](../history/plans/2026-09/2026-09-07-exploration-state-machine-plan.md)（已归档：Task 1~5 已落地，残余缺口由 PLAN-033 §4 承接）
- [控制台（Console）设计快照](../history/plans/2026-09/2026-09-01-console-design-snapshot.md)（PLAN-030，已归档：设计迁入 [design/admin-console.md](../design/frontend/admin-console.md)，内容被 PLAN-032 承接）
- [控制台重构与资源监控改造（console-refactor）](../history/plans/2026-09/2026-09-06-console-refactor.md)（PLAN-032，已归档：设计迁入 [design/admin-console.md](../design/frontend/admin-console.md) + [design/local-model-management.md](../design/local-model-management.md)）
- [文档下载管理界面修复计划（downloads-tree-fixes）](../history/plans/2026-09/2026-09-07-downloads-tree-fixes.md)（已归档：修复问题1-3，测试通过，构建成功）
- [仪表盘（Dashboard）设计快照](../history/plans/2026-09/2026-09-01-dashboard-design-snapshot.md)（PLAN-031，已归档：设计迁入 [design/admin-dashboard.md](../design/frontend/admin-dashboard.md)）

## 已归档计划（2026-08）
- [文档切分与召回草案（document-chunking-recall）](../history/plans/2026-08/2026-08-18-document-chunking-recall.md)（REQ-082，Not Applicable 2026-09-22：随 ARCH-021 整合关闭——有效内容（块级切分/页块溯源/BM25→混合检索/探索界面 v0~v2 三阶段）被 ARCH-025 滚动壳「REQ-089 第一批调研承接」节吸收，壳 Retain 归档）
- [文档下载全流程交互规范（ARCH-019）](../history/plans/2026-08/2026-08-27-download-ux-flow.md)（PLAN-023，已归档：Superseded——旧 8 态按钮矩阵、教程 reject/supersede/complete、探索弹窗流与 mock 与现行设计冲突；状态机与交互事实源迁 [design/downloads-flow.md](../design/downloads-flow.md) / [downloads-ui.md](../design/frontend/downloads-ui.md)）
- [文档下载管理界面优化（REQ-067 综合计划）](../history/plans/2026-08/2026-08-29-req067-downloads-optimization.md)（PLAN-025，已归档：§A/§B 全量完成（B1~B8 经 PLAN-033/034），设计事实迁入 [design/downloads-flow.md](../design/downloads-flow.md)；浏览器验收由用户手动导入轮执行）
- [课程探索界面设计计划（探索界面）](../history/plans/2026-08/2026-08-23-arch019-exploration-ui.md)（PLAN-020，已归档：有效交互裁决并入 PLAN-023/REQ-067，探索流程基于废弃契约）
- [文档下载管理界面术语统一与排序优化计划](../history/plans/2026-08/2026-08-28-downloads-terminology-sorting.md)（PLAN-024，已归档：全部 6 项并入 REQ-067 §A）
- [教材下载轮计划（textbook-download-round）](../history/plans/2026-08/2026-08-05-textbook-download-round.md)（ARCH-002，已归档：概念被 ARCH-019 继承，数据模型已过时）
- [REQ-067 领域探索优化（B9-B12）](../history/plans/2026-08/2026-08-31-req067-explore-optimizations.md)（Draft，B10 Not Applicable / B12 Achieved，计划壳归档）
- [导入领域知识 API 契约（REQ-067-A 配套）](../history/plans/2026-08/2026-08-30-req067-import-api.md)（PLAN-026，Achieved 2026-09-01；契约确定后并入 architecture/api-contracts.md，计划壳归档）
- 课程探索 API 契约（arch019-exploration-api）（PLAN-021，Completed 2026-08-25；按归档判定 Delete 移除——事实并入 architecture/api-contracts.md，Git 锚点 0517e5d）
- [REQ-060 模型调用记录扩展与审核 UI（req060-llm-call-review）](../history/plans/2026-08/2026-08-req060-llm-call-review.md)（REQ-060，Completed 2026-08-24）
- [数据前置轮计划：数据库清理重置与统一数据根规范（arch019-data-foundation）](../history/plans/2026-08/2026-08-arch019-data-foundation.md)（ARCH-019 前置 PLAN-019，Completed 2026-08-23）
- [2026-08 LLM 网关与模型管理实施轮（llm-gateway-and-model-management）](../history/plans/2026-08/2026-08-llm-gateway-and-model-management.md)（ARCH-016，Completed 2026-08-23）
- [2026-08 文档规范与架构确定轮（docs-restructure-round）](../history/plans/2026-08/2026-08-docs-restructure-round.md)（ARCH-018，Completed 2026-08-21）
- [2026-08 后端三域拆分轮（backend-domain-refactor）](../history/plans/2026-08/2026-08-backend-domain-refactor.md)（ARCH-012，Completed 2026-08-21）
- [2026-08 文档与数据边界整理轮（docs-data-boundary-round）](../history/plans/2026-08/2026-08-docs-data-boundary-round.md)（ARCH-013，Completed 2026-08-21）
- [2026-08 LLM 状态收敛与 DB 启动快照轮（llm-status-convergence）](../history/plans/2026-08/2026-08-llm-status-convergence.md)（ARCH-014，Completed 2026-08-21）
- [2026-08 前端重构主轮（frontend-react-refactor）](../history/plans/2026-08/2026-08-frontend-react-refactor.md)（ARCH-011，Completed 2026-08-21）
- [2026-08 下载管理界面重构轮（downloads-manage-redesign）](../history/plans/2026-08/2026-08-downloads-manage-redesign.md)（ARCH-015，Completed 2026-08-21）
- [文档与代码双向追溯规范精简计划（traceability-refactor）](../history/plans/2026-08/2026-08-30-traceability-refactor.md)（PLAN-027，已归档：内容确定后移出的规则已并入 standards/code-document-traceability.md）
- [架构文档 Mermaid 图设计计划（architecture-diagrams）](../history/plans/2026-08/2026-08-31-architecture-diagrams.md)（PLAN-029，已归档：合并至 architecture/ 三份固定文档）

