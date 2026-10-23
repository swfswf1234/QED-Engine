# 学习中心·课程学习面重设计轮（消费成品·与文档分析处理划界）（learn-course-study-redesign）

状态：Completed
关闭结果：Achieved（行 S1~S5 逐条达成并留证；S3 阅读单位口径按 C15／W11 改判核销；门禁＝契约 88＋全量 813 passed（1 枚红＝并行共享表轮的 QED-Tracker 死链，非本轮）＋ruff 净＋`tsc -b`＋vitest 串行 66 files/843 tests＋build；LLM 生成／点赞两腿真机取证与知识点生产腿按用户 2026-10-18 裁决**不阻塞达成**，分别留挂主链 M-2/M-3 与 REQ-116，见「遗留与移交」）
任务类型：B
最后更新：2026-10-18
关联 ADR：[ADR 0011](../../adr/v0.1/0011-pending-design-location.md)（待评审设计先入 plans/，定稿后晋升 design/）、[ADR 0017](../../../adr/0017-design-doc-structure-contract.md)（晋升稿骨架与事实源唯一铁律）、[ADR 0022](../../../adr/0022-task-chain-clarifications.md)（成功标准冻结与不扩载）、[ADR 0024](../../../adr/0024-preschema-rebuild-tiers-and-demo-gate.md)（demo 门 + 范围锁死）
关联设计：[前端总设计](../../../design/frontend/frontend-overview.md) §3/§4/§5/§6（学习中心零过程性与全流程 ③→④ 分工）、[文档分析处理设计稿](../../../plans/2026-10-15-doc-analysis-processing.md)（REQ-116，三职责归属方）、[知识点探索界面](../../../design/frontend/knowledge-point-exploration-ui.md)（REQ-104/110/113/114 合一份，其 §边界声明把知识点写操作归工作台）、[课后练习界面](../../../design/frontend/learning-practice-ui.md)（REQ-106，面间零跳转）、[课程学习 v1 稿](2026-10-11-learn-ui-course-study.md)（REQ-105 现形态，本轮改判对象）、[parsing-ui.md](../../../design/frontend/parsing-ui.md) §9/§9.1（中栏渲染复用源）
关联 Tracker：docs/trackers/completed.md（REQ-117 行，2026-10-18 Achieved 关闭并移出 todo；同批关闭其 W10 承载的 DEFECT-016 与上游 REQ-070-LEARN）
归档判定：Retain（边界改判与迁移表属不可替代过程证据）

## 目标与成功标准

**目标**：把「学习中心·课程学习」面（书架 `#/learn` ＋ 单屏工作台 `#/learn/c/:courseId`）按
[前端总设计](../../../design/frontend/frontend-overview.md) 的**生产者/消费者分工**重新设计——学习面只
消费成品（目录就绪的正文、已确认知识点与讲解、进度），把「自动目录＋链路后台准备＋批注→候选→
确认知识点」三件生产性职责按迁移表移交后台管理·文档分析处理（REQ-116 的 ③），同时新增**知识点讲解
内容的呈现**作为学习面的核心消费面；并同步消灭学习面的过程性技术文案与三方文档口径打架。

**成功标准正本在台账行**（ADR 0023）：逐条对照 todo.md `REQ-117` 行「成功标准」列，本壳不复制判据。

## 范围与非目标

**范围**：① 三方边界对表与逐条裁决；② 课程学习面 v2 设计本体（三栏信息面、讲解呈现规格、能力迁移表、
空窗登记、学习面文案净化词表与降级话术）；③ demo 门（核心场景端到端最小可跑，真机留证）；
④ 按 v2 实施学面改造；⑤ 设计稿一次晋升 `design/frontend/learning-course-ui.md` 并收敛全仓指针；⑥ **书架清单 v2**（`#/learn` 入口面重做，用户 2026-10-16 指示先于 W4 起，落 W8）。

**非目标**：
- **不实现内容生成 → 2026-10-17 用户裁决 C18 部分改判**：原口径「LLM 自动抽取知识点与生成叙述/讲解归主链
  M-2 与 REQ-116 ③，本轮只设计消费与降级」在**细知识点的产生与确认入库**上保持不变（C14/C19 不松）；
  但学习面的「这一条还没有总结/注解 → 点生成」必须由 8900 提供**按需生成腿**（现网无任何业务级生成端点，
  `services/llm/gateway.call_text` 的调用方只有控制域 `/llm/*`），故新增两个根侧端点由本行 REQ-117 承载
  （契约形状见 §V2.11，实施挂 W9）。**仍属非目标**：自动抽取知识点、批量生产管线、确认入库写面。
- **学习域服务端契约＝原非目标，2026-10-16 用户裁决 C9 改判入范围**：原口径「`api-contracts.md` §⑥ 端点形状与两表结构保持；确需改契约属大修改，另立任务行」——书架清单 v2（W8）的「解析好即同步、刷新即可、不要新建」必须由 8900 提供物化通路（进度只能落 `qed_learn_unit_progress`，纯前端拼不出），故该大修改经用户裁决由本行REQ-117 承载、不另立行。改动面收在三处：`POST /learn/courses/sync` 新端点、`PATCH …/courses/{id}` 白名单扩 `resources`、`GET /learn/courses` 的 `derived` 加 per-book 进度；**两表 DDL 不动**（教材级忽略位落 `resources` JSON 键位，避开 ALTER 窗口与 REQ-120 改名线的表名冲突）。
- **不实现 ③ 文档分析处理屏本体**：迁移目标屏由 REQ-116 承载（路由与命名尚待用户确认）。
- **不新增跨界跳转**：三面互切只经首页三卡（与 REQ-104/106 已晋升稿一致）。
- **不提交他人并行 WIP**：工作树现含多线未提交改动，本壳只认领自有文件。

## 前置条件

1. REQ-105 现轮先收口（真机端到端冒烟补证 + 壳回填 + 两处实现/设计漂移裁定）**已满足（2026-10-16）**：本会话接管收口，S1~S5 逐条真机与门禁取证达成、行移入 completed.md、壳 Retain 归档 `history/plans/2026-10/`；两处漂移按裁决不在 v1 归档稿内改措辞，改由本轮 W2 对表裁定。两行不并行改同一批文件。
2. 讲解来源现状＝已确认知识点的 `narrative`（批注正文）与 `summary`（摘要通道），经
   `GET /learn/courses/{course_ref}/knowledge-points` 一次取回；生成通道未落地前讲解面按设计降级，不白屏。
3. 用户 2026-10-15 四项裁决已登记本壳「过程与证据」节（边界分两步、晋升暂缓待定稿、核心功能三件、收口权移交本会话）。

## 工作项

| 条目 | 内容 | 状态 |
| --- | --- | --- |
| W1 | 立项：本壳 ＋ todo REQ-117 镜像行 ＋ 四项裁决登记 ＋ REQ-105 壳收口权移交注记 | 已完成（2026-10-15） |
| W2 | 三方边界对表与逐条裁决：`REQ-104 稿`「知识点写操作全部归工作台批注闭环」／`REQ-106 稿`「面间零跳转、入口唯一」／`REQ-116 稿`「①登记确认知识点 ②编排学习链路 ③关联习题讲解属后台管理」／`总设计 §5`「按已编排链路推进章节单元」「与课后练习联动」四组冲突逐条取裁决并回写各自文档（含 §5 与 R7「链路不出界面」的措辞改判） | 已完成（2026-10-16：对表 C1~C6 取用户四项裁决并回写各自文档，见「过程与证据」） |
| W3 | **demo 门**（ADR 0024 决定 2）：核心场景端到端最小可跑＝真机走通「书架→目录就绪→选节阅读→该节知识点讲解呈现（缺位时明确降级）→勾选推进→结课」并留请求账；到门暂停待人工验收 | 已完成（2026-10-16 到门，**暂停待人工验收**；取证见「过程与证据」） |
| W4 | 重设计稿设计本体（v2，按 ADR 0017 骨架）：三栏信息面新形态、能力迁移表（三职责的去向与承接条件）、讲解呈现规格与来源依赖、先拆后立的空窗登记、学习面文案净化词表与降级话术 | 进行中（2026-10-16 用户裁决「这份优化稿落在哪个承载体上＝并入 REQ-117 W4/W5/W7」→ B1~B6 六组正文见本节末条；人工审理确认后按其骨架成 v2 设计本体；2026-10-16 用户令「开始执行」，B1~B5 已按出稿实施落码（见「过程与证据」W5 条），v2 本体成文仍待审理）→ **已完成（2026-10-16）**：v2 本体成文＝本壳「设计本体 v2」节，裁决 C14~C17 入 §V2；实现批待用户审理后起，三条待裁项见 §V2.10 |
| W5 | 实施批次（TDD 先红后绿）：学面按 v2 改造、迁移项的下线/降级路径、用例与断言改口径；前端门禁（`tsc -b` / vitest 串行 / build）＋ 根侧契约不回归 | 已完成（2026-10-16 实施批起、2026-10-17 随 W9 界面批同批收口：B1~B5 全部落码，前端门禁与真机浏览器实测绿，B6 按裁决随 REQ-116 线本批不摘；W3 最小切片已随 demo 门落地，W7④ 文档行回写与本行 v2 定稿待 W6。**2026-10-17 用户四裁 C18~C21 后重排**：本行的页头／左栏／中栏改造与 W9 的注解面改同一批页面文件，故本行只保留排版层止血与数据口径腿已落码部分，界面批并入 W9 一起实施（避免两轮改同一文件）；界面批实施证据见「过程与证据」W9 条 |
| W6 | 晋升与收口：设计稿一次晋升 `design/frontend/learning-course-ui.md`（元数据齐备 + `test_design_documents.CURRENT_DOCUMENTS` + `design/index.md` + 总设计 §5 指针 + `code-map.md` DesignRef + `frontend-architecture.md` 信息架构行），并联动关闭 REQ-105 与 REQ-070-LEARN | **已完成（2026-10-18）**：正本落 `docs/design/frontend/learning-course-ui.md`（设计状态 Accepted／实现状态 In Progress／确认状态 暂定，ADR 0017 五段骨架 + 元数据七项齐备）；`CURRENT_DOCUMENTS` 加行、`design/index.md` 三面全晋升改写与待晋升段只剩 REQ-116、总设计 §5 指针与 §7 节奏行收敛、`frontend-architecture.md` 两条信息架构行按实态重写（含 W7④ 陈旧行）、`roadmap.md` 前端行「链路双模式」措辞改正。**`code-map.md` DesignRef 一项经取证＝不适用**：`test_code_document_mapping.py:15` 受管面只扫 `.py`，前端无 code-map 行可挂（同 W10 落点④ 判例）。联动关闭＝REQ-070-LEARN（其 W8 三面全晋升后达成）与 `DEFECT-016`，**已于 2026-10-18 用户给权后随收口批执行**；本壳归档 mv 同批完成。取证见「过程与证据」2026-10-18 晋升批条与收口批条 |
| W7 | 承接 REQ-105 收口批移交的三项冒烟发现并定 v2 口径（用户 2026-10-16 裁决并入本轮，不扩 S 判据）：① 首页「课程学习」卡副标题「或按编译链路逐块推进」违反 R7 与总设计 §3/§6 去过程化；② 工作台对 `GET /learn/courses/{id}/units` 重复取数（真机 4 次）＋进场逐节 `PATCH` 86 次的重复读与写放大；③ 一门共享课程注册第二门学习课程时工作台静默绑定第一门（路由参数＝`course_ref`，`web-ui/src/api/learn.ts:624` 的 `findLearnCourseFor` 取首个匹配，服务端不强制唯一）；④ [前端架构信息面](../../../architecture/frontend-architecture.md) 的 `#/learn/c/:courseId` 行仍写「阅读／链路双模式（Segmented）」「`POST …/compile/propose`＋`compile/start` 链路通路」，与工作树实态（单屏无模式切换、自动目录走 `PUT …/outline`＋`PUT …/syllabus`＋`PATCH …/units/{id}`）不符 | 未开始（取证见 REQ-105 壳「过程与证据」2026-10-16 条；W6 晋升时按 v2 一并回写该信息架构行。2026-10-16 承接进度＝① 已由 REQ-031 二批的首页三卡定稿句消解（`Home.tsx` 卡 `desc` 取 `HELP_PAGES.center.entries`，全文件已无「编译／链路」字样）；②③④ 分别由 B2／B3／W4 版式断点承接。2026-10-16 复验＝② 真机 `math_analysis` 进面零 `PUT syllabus`、零 `PATCH`；③ `resolveLearnCourse` 多条命中交出选择权且零写入；④ 尚未回写（属文档陈旧行，随 W6 晋升批处理）） |
| W8 | **书架清单 v2（先行于 W4，用户 2026-10-16 指示与四项裁决）**：① 页面改名「书架清单」，领域框移到标题行右侧且默认选中第一个领域；② 课程行只写**正式名称**（取共享表 `qed_course.name`——af_books 冗余 `course_name` 与正式名不一致，`linear_algebra` 实显「高等代数」非「线性代数」）；③ 课程下教材**排成一排的小卡片**＝书名＋面向对象徽章＋该教材学习进度＋教材简介；④ 卡上动作「进入学习」（深链到该教材）与「忽略／按回来」，教材级忽略位落 `resources` JSON；⑤ 数据面＝解析好（`af_books.active_job_id` 非空）才同步展示、未解析好即 PASS，「新建学习课程」表单与删除入口整体摘除，页头改「使用手册／刷新／返回」三键；⑥ 简介与面向对象取教材所依教程套的 `intro`/`position`（书级两列不存在，已按用户裁决出跨项目登记条目）；⑦ 使用手册弹窗改深蓝底白字（总设计 §2 暗色例外扩面改判） | 已完成（2026-10-16 改造批：裁决 C9~C13 落码＋真机全链绿，证据见「过程与证据」W8 完成条；书级两列跨项目请求稿另立 REQ-121；讲解腿复验归 W3 demo 门人工验收批） |
| W9 | **注解面与按需生成腿**（用户 2026-10-17 四裁 C18~C21 的实施批）：右栏改「注解」三段（章级总结＋学习要点 / 条级总结与注解 / 推进＋批注）、`POST …/annotations/generate` 与 `POST …/kp-details/{id}/like` 两端点、章行 `summary`＋`meta.chapter_key_points` 持久、`api-contracts.md` 两表随步、`llm-gateway.md` 前端能力边界随步 | 已完成（2026-10-17 码批＋门禁＋真机复验，证据与四条实现差见「过程与证据」W9 条；**两腿成功路径的真机取证待 8900 重启**——运行中后端为旧进程无此两端点，端点代码与 9 例定向测试已绿；复验残留候选行 `kpd-122bd665e6ad` 待人工处置） |
| W10 | **界面形态三处改判（用户 2026-10-17 现场验收后令，编号 C22~C24）**：① C22 页头＝导航最左「返回」回根页面 ＋ 导航右侧「使用手册／刷新」＋ 课程名右侧「返回书架」（`AppHeader` 加 `leading` 槽）；② C23 目录摘除四类当前情况说明（整理中／整理失败／无可读教材／章内零知识点），只列名称与自己的「已学」标记，处理进度归后台；③ C24 目录两档左缘对齐（`outlineRowStyle` 常量函数，修 DEFECT-016 的 antd Button flex 居中致 `textAlign:'left'` 失效）；三项均补设计正本行＋回归与源码扫描守护 | 已完成（2026-10-17 码批＋真机三档（1600／1200／860）实测＋门禁绿，证据见「过程与证据」C22~C24 条；防复发落点④「code-map 补前端行」经取证**改判为不可行**（`test_code_document_mapping.py:15` 受管面只扫 `.py` 且集合等值），替代落点由 `tests/test_web.py` 两枚互指守护承接，落点⑤＝`qed-frontend-check` 技能补三档实测与旧包／旧进程判定条；`DEFECT-016` 行收口随 W6／W11 收口批。**C29 改判随批（2026-10-17 二次验收后令「返回按钮放在页面右上角，与其他页面一致」）**：返回挪导航右上角末位（使用手册／刷新／返回），课程名右侧「返回书架」保留，`AppHeader.leading` 槽作废并删除，详见「过程与证据」C29 条） |
| W11 | **右栏改判为「学习交流」三段＋推进换位置（用户 2026-10-17 口头裁决，编号 C25~C28）**：① 段题与命名改造（注解→学习交流，三段＝本章总结与学习要点／详解／备注）；② 段 ②「详解」由中栏正文块驱动（`anchors` 补 `block_index`，页码＋块序精确匹配，生成粒度仍条级）＋点赞在此＋LLM 提问入口（输入框＋置灰发送，零请求）；③ 段 ③「备注」＝候选池打标（`payload.kind='note'`＋`gen_batch='learn-note'`＋`gen_status='draft'`），「保留为候选」批注腿移出学习面；④ 右栏推进段下线，改正文末尾「上一条／下一条／已掌握并下一条」三枚（`skipped`／撤销勾选／回到断点下线，后端状态闭集不动）；⑤ 契约随步＝`api-contracts.md` 的 `anchors` 元素形态与 `GET /learn/kp-details` 边界行，REQ-116 承接稿增「学习者备注不作提升来源」 | **已完成（2026-10-18，按用户裁决「现形态认定达成，除了 LLM 之外的完成即可」）**：① ~ ⑤ 形态与码批全部在树（§V2.12 正文 + `LearnWorkbench.tsx`／`ChapterNotePane.tsx`／`AnnotationPane.tsx`／`AdvancePane.tsx`／`learnPlaneCopy.test.tsx` 禁词与必含词双守护），设计正文见 §V2.12，取证见「过程与证据」2026-10-18 条。**不阻塞达成的两项**＝LLM 提问腿（本轮有意零请求，属后续轮承接）与生成／点赞两腿成功路径的真机取证（待 8900 重启，同 W9 条遗留口径） |

## 过程与证据

- **2026-10-15 用户四项裁决登记（本轮立项依据，ADR 0022 决定 4 的范围裁决记录）**：
  ① **职责边界＝分两步**——先把 REQ-105 已实施形态收口（不扩判据），再由本行把「自动目录＋链路后台准备＋
  批注→候选→确认知识点」移交后台管理·文档分析处理（③），避免学面一次性失去登记能力。
  ② **晋升节奏＝暂缓**——课程学习设计稿**不在现形态晋升** `design/`，等 v2 重设计稿定稿后一次晋升到位
  （据此 REQ-105 壳「设计本体」的处置＝留改不晋升，随该壳归档 `history/plans/`；总设计 §5 指针在本轮
  改指本壳）。
  ③ **核心功能锚定三件**＝逐节阅读＋勾选推进/断点/结课、自动目录＋多教材顺序学、**知识点讲解内容的呈现**
  （第三件为本轮新增范围，v1 稿明确列为非目标，故属改判项，随本条裁决生效）。
  ④ **收口权＝本会话接管 REQ-105**（真机冒烟、壳回填、漂移修正与关闭），他人并行 WIP 不代提交。

- **2026-10-15 立项前勘察（冲突与实态取证，逐条可复核）**：
  - **代码实态领先于台账**：REQ-105 壳把 W8~W12 全标「未开始」，工作树实为已实现——单屏无模式切换
    （`web-ui/src/pages/LearnWorkbench.tsx` 已无 `Segmented` 与模式态，`components/learning/ChainPanes.tsx`、
    `stores/learnChain.ts`、`pages/LearnWorkbenchChain.test.tsx` 三文件已删除）；自动目录
    （`stores/learnWorkbench.ts` 的 `TOC_SCAN_PAGES`/`tocPhase` 三态 + `tocParse.ts` 自动定位）；
    多教材按序（`pages/LearnShelf.tsx` 注册多选按序写 `resources`，逐书取 outline 拼接）；
    书架信息面（领域下拉 + stage/主轨/sort_order 竖排 + 「学习进度 XX%」徽章）。
    对应单测与回归用例在位（`LearnWorkbench.test.tsx` 14 例、`LearnShelf.test.tsx` 12 例、
    `tocParse.test.ts`「目录进场自动定位」7 例、`learnWorkbench.test.ts` 10 例）。
    REQ-115 壳 W6 于 2026-10-15 在本树跑绿（`tsc -b` 无错、vitest 串行 63 files / 760 tests）。
  - **两处实现与设计漂移**（本轮 W1 前置裁定项）：进度映射设计写「同一父级下同名同序节」而实现按
    拼接顺序位置对位（`stores/learnWorkbench.ts:mapUnits`）；设计 §3 要求左栏节行尾带「已确认知识点计数」，
    实现未出。
  - **未提交面**：REQ-105 壳文件本身未入库（`git status` 显 `??`）；工作树 163 个未提交文件跨多线，
    其中 `backend/qed_engine/api/learn.py` 的 `summary`/`description` 改动归知识点探索线（REQ-113/114），
    不属 REQ-105。

- **2026-10-15 立档（W1 完成）**：本壳建立，todo REQ-117 行登记于学习设计轮节（紧随 REQ-105 之后），
  [计划索引](../../../plans/index.md) 学习设计轮节加承载条目；REQ-105 壳同批回填（`最后更新` 改 2026-10-15、
  W8~W11 按实态改「已完成」、W12 改「进行中·S3 真机冒烟待补」、`## 过程与证据` 追加收口权移交与
  实态复核两条）。门禁：`pytest tests/contract -q` → 82 passed（G1~G7 全绿）。

- **2026-10-16 REQ-105 收口批完成（本会话执行，前置条件解除）**：真机端到端冒烟以临时演示课程 `lc-c71bbd752718`（`real_analysis` ＋ `mathanalysis-b05`）走完 S3 全链并逐腿留证，真实课程零写入；行判据 S1/S2/S4/S5 同批复核（首页卡可进且无「建设中」、右栏无 Tabs 零练习组件、页头唯一「返回书架」、请求账全指 8900）。关闭门禁自跑＝契约 82 · 全量 746 · ruff · `tsc -b` exit 0 · vitest 串行 63 files/762 tests。冒烟残留 95 行 outline 无 API 清空通路（空树 PUT 实测 422 `too_short`），按用户裁决备份后外科 DELETE 清退，备份件 `logs/req105-smoke-residue-real-analysis.json`。REQ-105 壳 Retain 归档，总设计 §5 指针改指本壳并登 BUGFIX-030；三项发现落 W7。
- **2026-10-16 冒烟新发现三项并入 W7**（用户裁决「并入 REQ-117 工作项」）；另核实一项预期行为：`linearalgebra-b01` 仅第 1–3 页有解析产物，自动目录按设计降级为「点『修改目录』补页码」，不入缺陷。
- **2026-10-16 W2 三方边界对表（C1~C6，逐条带正本行号）**：
  - **C1 知识点写面归属**：本面（REQ-104 已晋升稿）六处「工作台批注闭环」把候选登记/确认/驳回钉在
    课程学习工作台（`knowledge-point-exploration-ui.md:210/221/241/266/270/280`），与 REQ-116 三职责①
    「登记／确认知识点属后台管理」及总设计 §1/§4/§6「学习中心零过程性·只消费成品」直接冲突。
  - **C2 目录与链路编排**：v1 R8 由**前端**进场扫 1–20 页并整树写入（真机取证＝`PUT …/outline` 95 行＋
    逐节 `PATCH` 86 次＋`GET …/units` 重复 4 次），与 §4「③ 编排课本学习链路属后台管理」冲突；
    同时你锚定的核心功能含「自动目录＋多教材顺序学」，能力不得消失。
  - **C3 「链路」字样**：v1 R7 硬边界「『链路』不出界面」对上总设计 §5 自身「按已编排**链路**推进章节单元」
    与首页卡副标题「或按编译**链路**逐块推进」（W7 ①）。
  - **C4 面间联动**：REQ-106 已落地「面间零跳转、入口唯一＝首页卡、不放『去学这本书正文』」
    （`learning-practice-ui.md:30/75`）对上 §5 两行互写「与课后练习联动」「与课程学习联动」。
  - **C5 讲解呈现**：你新增的核心功能（v1 明列为非目标＝改判项）；写侧通道已存在——
    `POST /learn/kp-details`（`intent: summary|explanation`，永不写 confirmed）与
    `POST /learn/kp-details/{id}/confirm|reject`（`api-contracts.md:1024-1026`），属生产动作。
  - **C6 多学习课程**：书架允许多门，路由参数＝`course_ref` 且 `web-ui/src/api/learn.ts:624`
    `findLearnCourseFor` 取首个匹配、服务端不强制唯一——真机复现静默绑定第一门。
- **2026-10-16 用户四项裁决（W2 产物，逐条对应上表）**：
  ① **C1＋C5＝全消费·写面整体迁出**：学习面只读呈现已确认知识点的讲解，批注表单/候选登记/确认驳回
    全套从学面摘除归后台分析屏；**空窗登记**＝REQ-116 分析屏（其 W2~W4 待确认/待移交）落地前，
    新知识点无确认通路，本批以「讲解缺位即明确降级」承接，不为此保留写面。
  ② **C2＝服务端化·能力不迁出**：目录生成从前端搬到 8900 单请求（一次写入整树含 `confirmed`），
    消除重复取数与 86 次 PATCH；界面保留「目录已就绪/未就绪」结果态、去扫页与置信话术；
    整体迁 REQ-116 后台屏列为**第二批**（迁移表登记承接条件，不代对方实施）。
  ③ **C3＋C4＝三处全改判**：§5 去「链路」字样、联动改「只在数据层、界面无出口」、首页卡副标题删
    「或按编译链路逐块推进」；§3 禁词表补「链路／编译」。
  ④ **C6＝学面路由改学习课程 id**：`#/learn/c/:learn_course_id`，一门共享课程可并存多门学习课程，
    `findLearnCourseFor` 退役。
  另有两条按事实直接处置、不取裁决：**C7** REQ-116 侧「后端端点／两表写入移交 Axiom-Flow」与
  ADR 0007 的衔接——迁移表只登记「8900 落点＋承接条件」，写入能力留 8900；**C8**
  `frontend-architecture.md` 的 `#/learn/c/:courseId` 行仍写双模式（Segmented）与 compile 通路，
  属文档陈旧，随 W5/W6 按实态回写。
- **2026-10-16 W2 文档回写清单**：`knowledge-point-exploration-ui.md` 六处归属句改指
  「后台管理·文档分析处理（REQ-116）」；`frontend-overview.md` §3 禁词＋§4 ④＋§5 课程学习行/
  课后练习行/前言指针共五处改判；REQ-116 稿**不动**（其 W2~W4 在途，承接条件以本轮迁移表为请求，
  由对方窗口审理）。`pytest tests/contract -q` 绿。
- **2026-10-16 W3 demo 门到门（真机 8903＋真实课程，讲解腿最小切片先红后绿）**：
  - **讲解腿此前无承载位**：改造前请求账为 `star-map`/`books`/`courses`/`outline?book=`/`units`×4/`progress`，
    **不含 `knowledge-points`**，工作台完全不取知识点——「缺位时明确降级」连降级载体都没有，故按 ADR 0024
    决定 2 先补核心场景最小可跑切片，再谈其余改造。
  - **TDD**：先落两枚红测试（`LearnWorkbench.test.tsx`「选节呈现该节已确认知识点的讲解（名称＋摘要），
    且知识点一次取数」「该节没有已确认知识点时讲解区明确降级，不空白」→ `Unable to find [data-testid="section-explanations"]`），
    再实现转绿＝`stores/learnWorkbench.ts` 进场一次 `GET /learn/courses/{course_ref}/knowledge-points`
    （取 `node_kind=point` 行入 `points`）＋`LearnWorkbench.tsx` 中栏底部「本节讲解」只读区块
    （该节下辖知识点的 名称＋`summary`，经 `renderInlineMath` 走 KaTeX；无则「本节暂无讲解内容」）。
    无任何写操作控件（C1 只读消费）。该文件 19 例全绿（17 旧＋2 新）。
  - **真机逐腿**（`#/learn/c/math_analysis` → `lc-3e6a94085b80`，浏览器强刷 `?v=w3demo` 后取新 dist）：
    ① 书架＝2 门（「数学分析（教材主线）」徽章「学习进度 1.2%」、「高等数学 M6」徽章「目录未就绪」）；
    ② 目录就绪＝95 行树直接可用，**本轮零目录写入**（`tocPhase` 已 ready，不触发 `PUT outline`，无残留）；
    ③ 选节阅读＝「第3章 数列与级数」→ 中栏「正文 · 第 49–80 页」逐页版式渲染；
    ④ **讲解呈现**＝「本节讲解 收敛序列｜度量空间中序列 {p_n} 收敛于 p 的定义：对每个 ε>0 存在 N，
    使 n≥N 时 d(p_n, p)<ε。定义依赖于空间 X 与距离 d。」（该课唯一已确认知识点，挂在章级）；
    ⑤ **讲解缺位降级**＝选「有序集」→「本节讲解 本节暂无讲解内容」，不空白；
    ⑥ 勾选推进＝「已学 1/86 节」→勾「本节学完」→「已学 2/86 节」→「撤销勾选」→回到「1/86 · 学习进度 1.2%」，
    真实课程状态零残留；⑦ 结课腿复用 REQ-105 收口批同日同码路真机取证（临时课程 86/86＋「已结课」Alert＋
    书架徽章「已结课」），本轮不在真实课程上推满 86 节。
  - **请求账**：全程 fetch 只指 8900（ADR 0007），无 8901/8902 直连；讲解数据一次取数（`knowledge-points` 1 次）。
    仍存的重复取数与写放大（W7 ②）实测在册：一次勾选＝`POST progress`＋`PATCH units/{id}`＋`GET units`＋`GET progress`，
    撤销再来 4 条；进场 `GET …/units` 仍 4 次——按裁决归 C2「服务端化」批次处理，不在 demo 门内顺手改。
  - **到门暂停**：ADR 0024 与本轮 W3 行均要求 demo 门后人工验收，故 W4（v2 设计本体）待验收放行再起。
  - **并行面提示**：`LearnWorkbench.test.tsx` 本轮首次写入被同工作树另一会话的保存覆盖（mtime 回落 22:37），
    重落笔后即刻跑测通过；后续对该文件的改动保持「写→测」同命令闭环。

- **2026-10-16 W8 立项：书架清单 v2 五项裁决（C9~C13，用户裁决，先行于 W4）**：
  - **C9 同步落点＝8900 服务端**：新增 `POST /api/v1/learn/courses/sync`——读 8902 透传书目，取 `active_job_id` 非空且 `course_id` 非空的书，按 `course_id` 分组，回查共享表 `qed_course` 取领域与正式名称；已存在学习课程（`course_ref.ref_id` 命中，多门时取 `created_at` 最早一门）只**并集补入**新书并保留人工 `dismissed` 位，不存在则建行（`name`＝正式名称）。查不到课程坐标的书即 PASS（不猜归属）。8902 离线 → 503，书架降级为列既有课程。「新建学习课程」表单与课程删除入口从学面摘除（写面迁出，与 C1 同口径），端点保留归后台。
  - **C10 简介与面向对象＝教程套派生**：教材级两列在 `qt_books`/`af_books` 均不存在，但 `af_books.knowledge_id` → `qt_knowledge` 的关联真机 17/17 一致（且每本只命中一套），套级带 `intro`（165~331 字散文，正文即写明适用对象）与 `position` 五档 → 卡片简介取所依套 `intro`（同套多本共用，口径登记），徽章＝`position` 中文档位（beginner=入门 / intermediate=进阶 / advanced=深入 / comprehensive=综合 / elective=选修）。**跨项目登记**：书级「简介」「面向对象」两列属 QED-Tracker 面，按用户裁决「没有就去对应项目下登记」出请求稿 → [REQ-121 请求稿](../../../plans/2026-10-16-book-intro-audience-tracker-request.md)（R1~R5；回执落地后由本行 W5 批次改读书级列，套级降兜底）。
  - **C11 忽略＝教材级**：位落 `resources` 元素内 `dismissed` 键（**零 DDL**，JSON 列内键位），`PATCH …/courses/{id}` 白名单扩 `resources` 承载写入；sync 并集补入时不覆盖该位，忽略后卡置灰、按钮改「按回来」。
  - **C12 使用手册弹窗＝深蓝底白字**（用户明确选择）：总设计 §2「暗色承载例外只此一处」按裁决扩面——页面本体的暗色承载仍只星图一处，例外新增「使用手册弹窗」全站统一深蓝底白字；§2 与弹窗组件同批改写。
  - **C13 领域框默认第一个领域**：不再默认「全部领域」（「全部领域」仍作可选项）；标题改「书架清单」。
  - **W3 demo 门状态**：用户未宣告验收即转入书架改造，故 demo 门取证维持「到门暂停」记录，W8 完成后的真机回归一并复验讲解腿（书架→进入学习→讲解呈现→勾选推进）。
  - **路由口径**：教材卡「进入学习」深链 `#/learn/c/{learn_course_id}?book={book_id}`（承载 C6 改路由 + 定位教材）；工作台参数先按 `lc-` 前缀直取学习课程行，未命中回退 `course_ref` 匹配以保住 W3 取证链接，回退分支随 W5 退役。


- **2026-10-16 W8 改造批完成（门禁＋真机全链）**：
  - **后端**（C9/C10/C11）：`POST /api/v1/learn/courses/sync` 新端点（解析就绪判据＝`af_books.active_job_id` 非空，
    按 `course_id` 分组回查 `qed_course` 取领域与正式名称；命中既有学习课程只并集补入并保留 `dismissed` 位，
    未命中建行；无坐标书 PASS；8902 离线 → 503）、`PATCH …/courses/{id}` 白名单扩 `resources`、
    `GET /learn/courses` 的 `derived.books` 教材级进度（`books_progress()` 在 Memory/MySQL 两存储各一实现）；
    sync 响应 `books` 段带 `intro`/`position`/`position_label`/`page_count`（套级派生，书级两列另出请求稿）。
  - **前端**（C11/C13）：`LearnShelf.tsx` 重写为书架清单 v2——领域框在标题行右侧且默认第一个领域、
    课程行标题只写正式名称（`course_ref.label`）、课下教材横排小卡片（书名＋面向对象徽章＋简介 60 字截断＋
    `已学/总节数 节`进度条＋「进入学习」「忽略」），「已忽略」区按书名点回；「新建学习课程」表单与课程删除入口摘除；
    工作台 `?book=` 定位教材（`fetchCourse(courseId, initialBookId)`）。
  - **手册随步**（C12）：`HelpModal.tsx` 深蓝底白字全站统一（面板 `#0b2472`，标题字与关闭钮一并给浅色——
    默认 `.ant-modal-title` 黑字在深蓝底不可读，真机复验时发现并修）；`help/sections.ts` 课程学习册按 v2 口径重写
    （删「新建学习课程／注册」「课程卡删除」与「未激活解析版本」措辞，加「刷新即列出／领域下拉／教材卡进入学习／忽略与按回来」），
    `helpPages.test.ts` 增一条守护：旧流程词与过程性术语禁入且必含「刷新」「忽略」「领域」。
  - **门禁**：全量 pytest 765 · 契约 83 · ruff exit 0 · `tsc -b` exit 0 · vitest 串行 65 files / 774 tests · `npm run build` 通过（同批含并行线在树改动，红绿归因按本行自跑输出）。
  - **跨项目登记**：书级「简介」「面向对象」两列请求稿已出 → [REQ-121 壳](../../../plans/2026-10-16-book-intro-audience-tracker-request.md)，todo `REQ-121` 行同批落位（学习设计轮，状态 Accepted，转达由用户执行）。
  - **真机（8903 构建产物，`#/learn`）**：sync 首跑 `created=[linear_algebra, math_analysis]`、二次幂等
    （`created`/`updated` 均空、`qed_learn_course` 行数恒 2）；`mathanalysis-b09`（无激活版本）与 `quantum-b01`（无课程坐标）
    PASS 未入库；领域框默认「数学（高等数学）」；课程行标题只有「数学分析」「高等代数」两枚正式名称；
    教材卡两本＝「数学分析原理／深入」「线性代数及其应用／入门」，简介真机可见、进度显示 `0/0 节`；
    点「忽略」→卡片收起、该课程体显「该课程下的教材都已忽略…」并进「已忽略」区，点书名按回来→卡片还原（`dismissed:false` 落库）；
    「进入学习」→ `#/learn/c/math_analysis?book=mathanalysis-b05` 且工作台左栏即落该书目录（首组「1 · 数学分析原理」、86 节树）；
    使用手册弹窗 `content`/`header` 背景 `rgb(11,36,114)`、标题与正文白字。
  - **现网数据事实**：本轮 sync 前 `qed_test` 已无既有学习课程行（REQ-105 冒烟课程 `lc-c71bbd752718` 不在库内，
    **非本轮删除**，本轮只做建行与 PATCH）；sync 后仅两行，均由解析就绪书物化。教材级进度恒 `0/0`＝真实课程尚无已确认单元树，
    结课腿复验归 W3 demo 门人工验收批。

- **2026-10-16 页头三键与 2026-10-11「面间零跳转」裁决的关系（登记，不改判他行）**：用户本轮明示书架页头＝
  「使用手册／刷新／返回」三键。2026-10-11 R2/R5 删除的是**子面互跳**两枚（工作台「返回星图」、书架通往练习/星图），
  本条不触碰该禁令；新增「返回」落点＝学习中心首页 `/`，与知识探索面既有页头同口径（该面手册第 8 步已写「页头…『返回』回首页」）。
  W4 v2 设计本体须把「子面 → 总入口的返回腿」与「子面 ↔ 子面互跳」区分成文，防后续误读为禁令扩大；
  REQ-105 行 S4 判据（工作台唯一返回落点＝`#/learn`）不变。


- **2026-10-16 学习工作台优化稿 B1~B6（用户令「完成后继续规划学习工作台，按照目前的设计优化现有设计」；本轮只出稿与取证，未动工作台代码）**：
  - **承载裁决**＝并入本壳 W4（设计本体输入）/W5（实施批次）/W7（三项冒烟承接），不另立 todo 行；  **B6 裁决**＝学习面批注**保留「保留为候选」**，「确认入库／驳回」移到后台管理·文档分析处理模块，  学习面对候选只读显示状态——落实 W1 裁决①「分两步」的第二步起点，管理面未承接前该确认腿空窗（随 REQ-116 线）。
  - **B1 文案净化（零行为改动，纯前端话术）**：工作台现含 13 处过程性/死口径文案——  `pages/LearnWorkbench.tsx` :175「8900 / 解析服务离线时逐栏降级」、:194「先在书架登记课程并挂书」  （**死口径**：书架 v2 已无登记入口）、:199「（未激活解析版本）」、:206「自动生成未完成，请点「修改目录」补页码」、  :225「无页窗」、:245「该章节没有页范围（source_ref 缺失），请在管理面补录」、:254「无解析产物」、  :140「目录页没有可用文本块（确认页码或先完成解析）」；`stores/learnWorkbench.ts` :245「本课未在学习书架登记，  进度不可用：先在书架注册课程。」（同为死口径）、:254「目录未就绪…自动生成未完成时…补录」、:503、:534；  `components/learning/AnnotationPane.tsx` :21 状态词「草稿／待确认／已入库／已驳回」、:54「不选＝无锚点登记」、  :84 placeholder「本轮人工书写，不出 LLM 生成」。改法＝逐条换学习者口径＋一句下一步；  守护＝学习面文案禁现词表用例（解析／链路／编译／单元／登记／管理面／source_ref／未激活／无页窗／离线／服务／LLM），  与总设计 §3「两侧语气分离」同判据。
  - **B2 进面取数与写放大（承 W7②）**：`stores/learnWorkbench.ts:259-268` `prepareUnits` 串行   `listLearnUnits` → `putSyllabus` → **逐节 await `patchLearnUnit(confirmed)`** → 再 `reloadUnits` → `refreshProgress`，  真机 86 节即 86 次 PATCH（W7② 取证重复取数 4 次）。改法＝树签名未变即不写；确认位一次性批量落  （若需 8900 批量端点，先按跨项目契约成文再改码）；`listLearnUnits` 结果复用不重取。
  - **B3 课程绑定正确性（承 W7③）**：`api/learn.ts:624` `findLearnCourseFor` 取首个匹配、服务端不强制唯一，  同一共享课注册第二门时静默落到第一门。改法＝只认 URL `learn_course_id`，匹配不到给明确空态，不回落首门。
  - **B4 版式自适应（承 W7 与总设计 §2）**：`LearnWorkbench.tsx:33-39` 三栏固定 300／`1px` flex／340、  高度 `calc(100vh - 56px)`，窄屏正文被压成一条。改法＝断点 ≥1400 三栏／1000~1400 目录+正文、推进区改抽屉／  <1000 单栏切换；正文列给最小宽；`100dvh`。
  - **B5 推进动线**：现只能点目录换节、页尾手点「继续加载 N 页」、讲解缺位后无指引（:293「本节暂无讲解内容」）。  改法＝「下一节／上一节」＋讲解缺位时给下一步话术（自动续载列为可裁项，不默认开）。
  - **非目标**：不动数据表与既有端点契约（B2 需批量端点时先成文）、不做 LLM 生成批注、不引新依赖、  不再碰书架面（W8 由本壳并行执行中）。
  - **归因与协作（不改判他行）**：① 本会话对 `LearnShelf.tsx` 只改一行页头 flex（去 `space-between`、`gap: 14`、  `flexWrap: wrap`），W8 ①「领域框在标题行右侧」的裁决形态不变；② W8 手册文案 v2、深蓝弹层（C12）与该壳的   `courses/sync` 均出自并行窗口，本会话未重写其组件，只补 `components/HelpModal.test.tsx` 深蓝底白字守护  （判据取性质：底色最亮通道 <0x80 且蓝高于红、正文纯白、体内无浅底深字残留），并把两处随 v2 文案失效的旧断言  （`Home.test.tsx`／`LearnWorkbench.test.tsx` 的「管理员推荐的学习路线落到两座面上」）改为新句；  ③ 契约新红一枚＝`database-design.md` 缺 `qe_learn_course` 逐列定义小节，来自本壳 W8 的服务端建表 DDL  （`services/learn/base.py:22`），**表名前缀 `qe_` 疑为 `qed_` 笔误**，随 W8 一并请该窗口确认，本会话未动。
- **2026-10-16 W5 实施批：学习工作台优化稿 B1~B5 落地（用户令「开始执行」）**：
  - **B1 文案净化**：工作台／store／批注面板的过程性与死口径逐条改学习者话术并带下一步（「（未激活解析版本）」→「（正文还没准备好）」、「该章节没有页范围（source_ref 缺失），请在管理面补录」→「这一节还没有对应的书页范围：点「修改目录」补上页码就能读。」）。守护＝新用例 `pages/learnPlaneCopy.test.tsx`：词表 `BANNED_BACKEND_TOKENS`（解析／链路／编译／单元／登记／注册／管理面／source_ref／未激活／无页窗／离线／服务／LLM／8900／8902）对五份学习面在册文件的**剥注释后可见字面量**（引号与反引号串＋JSX 文本）逐条断言；源码经 `?raw` 在编译期载入，故 `tsconfig.app.json` 的 `types` 增列 `vite/client`。
  - **B2 进面取数与写放大**：树签名未变即零写入；确认位改**随整树一次 `PUT …/syllabus` 落定**——取证＝`backend/qed_engine/services/learn/base.py` 与 `services/learn/memory.py` 的 `replace_tree` 读节点 `confirmed`，**无需新增 8900 批量端点**，「不动端点契约」非目标保持；`listLearnUnits` 拆出 `applyUnits` 复用（首进＝比对一次＋写后回读一次，稳态一次）；`markSelected` 仅在该行未确认时补一笔 `PATCH {confirmed:true}`，补确认与落勾选分两笔（`patch_unit` 对 `covered` 按行现值判冲突）。真机 86 节课进面请求账＝`GET units`×1＋`GET progress`×1，零 `PUT`、零 `PATCH`。
  - **B3 课程绑定正确性**：`api/learn.ts` 的 `findLearnCourseFor` 改 `resolveLearnCourse`＝`learn_course_id` 精确优先 → 共享课 id **唯一命中**才采用 → 多条命中把 `courseChoices` 交给界面选门并**零写入**（页头进「先选定要接着学的那一条」）。与出稿口径的实现差＝共享课 id 唯一命中仍可用（保 W3 取证链与书架深链不断），消除的是「多条命中静默落首门」。
  - **B4 版式断点**：`pages/LearnWorkbench.tsx` 导出纯函数 `workbenchModeFor(width)`（≥1400 three／1000~1400 side／<1000 single）＋ `Pane` 组件（inline＝定宽卡片，off-canvas＝`Drawer` 装同一份内容，「修改目录」入口随 `extra` 进抽屉标题栏）；页头按模式出现「打开目录」「打开推进与批注」；正文列 `minWidth: 560`，栏高 `calc(100dvh - 56px)`；抽屉内选节即自动收起。
  - **B5 推进动线**：新增 `outlineGroupsOf(texts, outline)` 作左栏渲染序＝推进序的单一事实源；`stepSection(±1)` 跨教材续走，未选节给归属提示、到头尾给明确提示（「已经到本课最后一节：回书架选下一门。」）；讲解缺位话术改带下一步。
  - **B6 未落码（按裁决随 REQ-116 线）**：学习面「确认入库／驳回」本批**保留**——后台管理·文档分析处理未承接前先摘即空窗，承接批再摘；候选状态词已按 B1 改「草稿／待整理／已加入知识星图／未采纳」。
  - **门禁**：`npx tsc -b` exit 0；`npx vitest run --no-file-parallelism` **66 files／792 tests 全绿**；`npm run build` 通过；根侧 `pytest tests/contract` 84 passed／1 failed、全量 766 passed／1 failed（唯一红＝`database-design.md` 缺 `qe_learn_course` 逐列定义小节，属 W8 服务端 DDL 遗留、非本批引入），`ruff check backend tests` All checks passed。
  - **真机浏览器实测（8903 dist，`qed-frontend-check`）**：`#/learn/c/math_analysis?book=mathanalysis-b05` 走通进面→自动目录（95 个节点）→选节「有序集」（正文·第 10–11 页，KaTeX 生效）→讲解缺位降级话术→「下一节」到「域」（第 12–14 页）→推进抽屉六动作齐备（已学 0/86 节）；断点复验 860＝单栏＋两枚触发、1600＝三栏无触发、1180＝目录＋正文＋推进触发，正文 `min-width: 560px`；`#/learn/c/lc-ee077e0f7e58` 精确命中同一门课且无选择面板；控制台零消息，网络账 28 条除静态资源外全部指向 8900，无 4xx/5xx。**截图未留存**＝内置浏览器视口 1600×0（`NATIVE_BROWSER_VIEWPORT_UNAVAILABLE`），本轮版式判定以 DOM＋computed style＋请求账为据。
  - **真机附带发现（不立项，登记归因）**：`mathanalysis-b05` 第 10 页公式块残留 `\frac{...}\tag{3}` 定界符老代产物原样显示，与既有「公式定界符老代产物」口径一致（渲染侧 BUGFIX-011 已防、数据侧待 W6 复测自愈），非本批引入。

- **2026-10-16 W4 四问裁决 C14~C17（学习工作台重设计，用户裁定，四项全取推荐项）**：
  - **C14 知识点生产腿归后台**：本轮工作台只消费已确认知识点，不在学面生成候选也不做确认入库；
    批量生产归文档分析处理面（REQ-116 职责①②，细节移交 Axiom-Flow）。章内零知识点即显「还在整理」空态。
  - **C15 阅读单元＝两级（章 ＋ 知识点）**：节层从界面消失；中栏为单条知识点正文；勾选、跳过、断点、步进器全部以知识点为步长。
  - **C16 推进单位复用单元表承载**：`level` 闭集加 `point` ＋ `kp_id` 引用列，进度表 `UNIQUE(unit_id)` 与写路径不动，
    读时投影、首次落笔才物化；不新建第三张进度表，也不往知识点主表打进度列。
  - **C17 块切分改进落在排版层**：跨页段合并、标题归位去重、页眉页脚剔除、层级左对齐映射本轮在前端做；
    块结构本身（解析侧粒度）并入既有 [REQ-099 请求线](../../../plans/2026-09-26-req098-parsing-region-edit-typography-axiom-flow-request.md) R2/R5，不另出请求稿。
  - **页头按钮＝三枚**（用户问「看下需要几个按钮」的答复，非独立裁决）：使用手册／刷新／返回书架 ＋ `headerButtonStyle`，
    与知识探索面、书架清单同款；返回落点仍 `#/learn`（REQ-105 行 S4 判据不变）。练习面缺「刷新」另登记为待裁项（§V2.10）。

- **2026-10-16 W4 取证（改造前提事实，均实查）**：
  - **知识点现网条数**＝`math_analysis` **1** 条、`linear_algebra` **0** 条（`GET /api/v1/learn/courses/{ref}/knowledge-points` 的 `total`/`points`，
    临时件 `tmp/kp_ma.json`、`tmp/kp_la.json`）；那条唯一点位的 `order_hint`/`source_ref`/`book_ref` 均 NULL、父级为 depth=1 章行。
    结论＝按知识点推进在现网必空跑，故 §V2.6 把「零知识点章」的降级形态与 §V2.10 待定③「整章阅读」次级入口写进设计。
  - **「没按目录样式左对齐」根因**＝`web-ui/src/components/parsing/typography.ts:141` `roleTypography` 只返回 `fontSizePx/fontFamily/fontWeight`，
    `web-ui/src/components/parsing/BlockList.tsx:243` `boxStyle` 无任何左偏移项，全仓唯一层级缩进在左栏目录
    `web-ui/src/pages/LearnWorkbench.tsx:294`（`depth===2 → marginLeft:14`）——正文侧从未映射目录层级。
  - **块切分实态**＝正文块全部来自解析侧页产物（`backend/qed_engine/api/axiom.py:191` `/books/{id}/pages/{no}` 透传 8902 块），
    前端只按页窗以 `PAGE_BATCH=8` 分窗取（`web-ui/src/stores/learnWorkbench.ts:27,194`），`CompareView.blocksOf` 仅归一不做跨页合并/标题去重。
  - **单元表既有约束**＝`level` 闭集只有 `section`/`unit`（`backend/qed_engine/api/learn.py:416`）、进度表 `UNIQUE KEY uq_learn_progress_unit (unit_id)`
    且 `set_progress` 拒绝非单元行（`backend/qed_engine/services/learn/base.py:431`）；知识点主表 `node_kind` 闭集 `outline`/`point`
    （`backend/qed_engine/services/learn/knowledge.py:35`），`_validate_parent` 只要求父为 `outline` 行（`api/learn.py:958`）——章行可直接挂知识点。
  - **并行线冲突提示**＝`qed_learn_* → qe_learn_*` 改名由 REQ-120 线在途（代码已用新名，`database-design.md` 的 `### qe_learn_course` 逐列小节待补，
    其新守护 `test_database_design_carries_column_definitions_for_tables_it_owns` 现为一枚红，非本行引入）；
    实现批新增 `kp_id`/`level='point'` 时须与该线口径对齐并避开其 ALTER 窗口。

- **2026-10-16 C12 改判（用户当令，撤销同日「手册弹窗＝全站统一深蓝底白字」）**：使用手册弹窗改**蓝框白底深字**——文字一律落在白底上，深蓝只作外框与标题/强调；`frontend-overview.md` §2 的「暗色承载例外」由两处收缩为**一处**（只剩星图页本体 `ConfigProvider` 暗色），手册弹窗在星图页内也不随页面本体转暗。同批改判手册形态：**总册三条入口卡移到「使用说明」之后**（概览→使用说明→入口→限制），入口卡两列栅格左缘齐平；四册「使用说明」按「做什么→看到什么→下一步」逐册展开（用户裁定范围＝四册一起展开），正文仍受 `help/helpPages.test.ts` 守护（节次同构、无运维口径词、课程册不残留旧流程术语）。守护用例 `HelpModal.test.tsx` 判据同批反写（白底＋蓝框＋深字，禁浅字残留），入口位置与对齐另立断言。

- **2026-10-16 手册承载改判批（用户当令撤销同日 C12「深蓝底白字」）**：`web-ui/src/components/HelpModal.tsx`
  改**蓝框白底深字**（面板 `#ffffff` + `2px solid #0b2472`，正文 `#14253f`，节标题/入口名 `#0b2472`，
  次级字 `#4a5a78`，链接/箭头 `#1677ff`）；总册三条入口**移到「使用说明」之后**，入口卡版面＝
  `grid-template-columns: 18px minmax(0, 1fr)` 两列栅格，名称行与说明行同列左缘齐平；卡面与悬停样式
  新建 `web-ui/src/components/helpModal.css`（白底＋蓝细边＋悬停浅蓝底）。四册「使用说明」按
  **做什么→看到什么→下一步**展开＝总册 9 步／知识探索 8 步／课程学习 13 步／课后练习 10 步（原步数不砍、
  信息只增不减），`help/sections.ts` 整册重写并去掉「无页窗」等后台口径与按序号互引。
  守护：`HelpModal.test.tsx` 判据反写（浅底必为白系 min 通道 > 0xc0、框必属深蓝家族、正文深字、
  禁内联纯白字残留）＋新增节序断言 `['功能概览','使用说明','steps','entries','状态与限制']` 与栅格对齐断言；
  `help/helpPages.test.ts`、`Home.test.tsx` 原断言不动即通过。
  门禁：`tsc -b` 0 错、`vitest run --no-file-parallelism` **796 passed / 67 files**、`npm run build` 出
  `index-aji30QwY.js`；根侧契约 **84 passed + 1 既存红**（`database-design.md` 缺 `qe_learn_course` 逐列小节，
  并行 W8 线遗留，非本批）、全量 **766 passed + 同 1 红**、`ruff` All checks passed。
  真机 8903 四页实测（`?v=` 穿透并比对 `script[src]`＝`index-aji30QwY.js`）：总册 `panelBg=rgb(255,255,255)`、
  `panelBorder=2px solid rgb(11,36,114)`、`bodyColor=rgb(20,37,63)`，节序＝概览→使用说明(steps:9)→entries→限制，
  三张入口卡 `left` 同值、名称行与说明行 `left` 同为 14；`#/knowledge`(steps:8)／`#/learn`(steps:13)／
  `#/practice`(steps:10) 各直落本面册、`entries=0`、「学习中心总手册」返回后总册入口照常出现在步骤之后；
  控制台零报错，资源账只有 8903 静态 + 8900 `/api/v1/learn/courses`（无 8901/8902 直连，ADR 0007 保持）。
  **环境注记（非产品缺陷）**：内置浏览器视口 1600×0，截图不可得（`NATIVE_BROWSER_VIEWPORT_UNAVAILABLE`），
  版面数值靠内联 `width:720px` 复测；antd `ant-zoom-appear` 在 rAF 被节流时卡在 prepare 不挂载弹层内容，
  取证时注入 `requestAnimationFrame` setTimeout shim 后正常。

- **2026-10-17 W4 v2.1 修订（用户令「可以进 W4，包括设计的统一」＋四问裁定 C18~C21，文档先行、码后批）**：
  用户指令逐条＝页头三枚统一样式（使用手册／刷新／返回）／标题去「· 学习工作台」后缀／不显示学习进度／
  删「修改目录」按钮／右栏「推进与批注」改「注解」／选中知识点或区域时显示其总结或注解（已有直读、
  没有可生成、生成后可点赞保留）／其上位显示整章总结与学习要点。
  - **C18 生成腿承载**＝**根侧新端点**（勘察证据：现网业务级生成端点零个——`services/llm/gateway.call_text`
    的调用方只有 `api/control.py` 与测试，`/llm/*` 属控制域诊断面，前端不直调网关）→ 新立
    `POST /api/v1/learn/annotations/generate` ＋ `POST /api/v1/learn/kp-details/{detail_id}/like`（契约 §V2.11）。
    据此「范围与非目标」节的「不实现内容生成」按用户裁决**部分改判**（E1 注记）：知识点产生与确认入库仍归
    后台（C14/C19 不松），学习面新增**按需生成发起腿**。
  - **C19 点赞语义**＝`qe_learn_kp_detail.payload.liked` 置位（保留、跨会话优先展示），**不入库**；
    不复用 `confirmed`（避免「置位即待提升」误读）。
  - **C20 章级持久**＝章行 `qed_knowledge_point.summary` ＋ `meta.chapter_key_points`（扩展槽，零 DDL），
    进场一次直读、缺失才生成、生成即持久。
  - **C21 进度摘除范围**＝只摘工作台页头，书架教材卡进度保留（W8 形态不回退）。
  - 改动落点＝本壳 §V2.2／§V2.5／§V2.6／§V2.7／§V2.8／§V2.9／§V2.10 重写与 §V2.11 新立，
    工作项新增 **W9**（注解面与按需生成腿，未开始），W5 状态补「界面批并入 W9 同批实施」重排注记
    （理由＝两轮改同一批页面文件，`pages/LearnWorkbench.tsx` 与 `stores/learnWorkbench.ts` 不可并行改）。
  - 同批修正四处 v2 草稿自相矛盾：§V2.7「修改目录＝保留（随 B4 进抽屉）」陈旧行删除（以摘除行为准）；
    §V2.7 进度口径行改判（书架 `N/M 知识点`＋右栏计数默认不保留）；§V2.9 界面断言删 `已学 X/Y 知识点`
    并注明由 W9「注解」三段断言承接；工作项 W9 行改回编号升序（W8 之后）。
  - **待用户审理项**＝§V2.10 待定④（要点持久槽 扩展槽 vs 实体列）⑤（点赞位 liked vs confirmed）
    ⑥（生成同步一次一条 vs 作业表异步）⑦（`chainFromOutline.ts` 与其测试删除；`api/learn.ts` 四个
    `compile_*`/`putSyllabus` 封装保留）⑧（右栏是否保留计数）——**④~⑧ 未答前不起 W9 码批**。
    另登记 `pages/Practice.tsx:75` 页头缺「刷新」与 §V2.2 三件套不一致，属 REQ-106 练习面线，本行不代改。

- **2026-10-17 W9 实施批（用户令「按默认配置开始实施 W9」＝§V2.10 ④~⑧ 全按默认落定）**：
  - **裁决落定逐条**：④ 章级要点持久槽＝`qed_knowledge_point.meta.chapter_key_points`（扩展槽、零 DDL）；
    ⑤ 点赞位＝`qe_learn_kp_detail.payload.liked`（`gen_status`／`confirmed`／主表不动）；⑥ 生成＝同步一次一条，
    前端 `timeoutMs=180000`；⑦ 删 `web-ui/src/chainFromOutline.ts` 与其测试（本批后零消费者，已核实无 md 链接
    与代码引用），`api/learn.ts` 的 `putSyllabus`/`proposeCompile`/`startCompile`/`getCompileStatus` 四枚封装保留；
    ⑧ 右栏不保留「已学 X/Y 知识点」计数。
  - **后端腿**（`backend/qed_engine/api/learn.py`，端点契约见 §V2.11，文档随步已落 `api-contracts.md:193-194`
    总表两行＋`:1045-1046` 语义两行、`llm-gateway.md:375` 一行）：`POST /learn/annotations/generate`（:1158）
    服务端编排取材→`services/llm/gateway.call_text`→落库，章级覆写章行、条级候选池新增一行多版本并存，
    零可用页 503／上游失败 502／章级 60s 节流／条级永不重复；`POST /learn/kp-details/{detail_id}/like`（:1227）
    只置 `payload.liked`；读时投影章行携 `summary`/`key_points`（:290）。
    定向 `tests/test_learn.py` **43 passed**（其中生成／点赞面 9 例＝章行 `summary` 落位、`meta.chapter_key_points`
    覆写、条级多版本并存、节流与永不重复、零可用页 503、上游 502、参数与目标校验、两表不可达 503、like 只动 payload）。
  - **前端腿**：`components/learning/AnnotationPane.tsx` 右栏三段（本章总结与学习要点／这一条的总结与注解＋点赞／
    批注保留为候选）＋ `AnnotationPane.test.tsx` **17 例**（含章级两腿按 `summary`→`key_points` 顺序各发一次请求的
    累加断言）；`stores/learnWorkbench.ts` ＋ `learnWorkbench.test.ts` **24 例**；`help/sections.ts` course 册与
    center 总册按 v2 口径重写（`helpPages.test.ts` 加 v2 禁词＋必含词守护）；`learnPlaneCopy.test.tsx` 扩三源
    （AnnotationForm/AdvancePane/ChapterNotePane）＋ v1 禁词群＋后台口径词（页窗／投影／镜像）。
  - **实现差登记（四条，不改设计口径）**：
    ① §V2.3 字面「point 行带 `kp_id` 引用列」实际＝读时派生键 `unit_id="kp:{kp_id}"`，零 DDL 零写面（已裁①）；
    ② 章行成品位在 store 边界补齐（`?? ''` / `?? []`）——旧 8900 进程投影无 `summary`/`key_points` 键时
      `ChapterNotePane` 直读 `.length` 真机崩过（ErrorBoundary「Cannot read properties of undefined (reading 'length')」），
      按 TDD 先写红测再于边界硬化，服务端契约仍按 §V2.11 恒给两字段；
    ③ 404／405 兜底话术（已回写 §V2.11「端点缺失兜底」条）；
    ④ 书架教材卡「N 节／目录未就绪」文案本批**不改**——`derived.books.total/done` 由已物化 unit 行聚合，
      直接改字面会把「节」口径写成「知识点」；进度单位统一属数据口径裁决，留后续（非 W9 范围）。
  - **门禁**：`npx tsc -b` 0 错；`npx vitest run --no-file-parallelism` **66 files / 829 tests 全绿**；
    `npm run build` 出 `assets/index-BZGBvDWX.js`；根侧 `pytest tests` **779 passed / 2 failed**、`ruff` All checks passed。
    两枚红本批不代修（归因）：`test_database_design_carries_column_definitions_for_tables_it_owns`＝并行 REQ-122
    存储线在改 `database-design.md`；`test_runtime_artifacts_only_under_logs_and_tmp`＝`scripts/image-model/.keepalive.pid`
    是**活着的** wsl.exe keepalive（PID 211160）留下的运行态产物、`.gitignore:39` 已忽略 `*.pid`，属人工处置项非缺陷。
  - **真机 8903 复验**（`?v=w9c` 穿透并比对 `script[src]`＝`index-BZGBvDWX.js`）：页头三枚（使用手册／刷新／返回）
    ＋标题只写「数学分析」；左栏两级＝9 章可展开且条行缩进 14px；右栏三段渲染零崩溃；批注表单端到端 200，
    候选标题变「这一条的总结与注解（1）」、通知「已保存为您的候选：确界原理」、输入框清空正确；
    整章阅读**滚动自动续取**三跳取证＝`innerText` 11496→26886→33492 字（`scrollHeight` 7040→14450→18031），
    章末第四跳零增长（`loadedThrough` 止住、无多余请求），佐证 `pages/LearnWorkbench.tsx:37` `SCROLL_AHEAD_PX=80` 路径；
    点赞遇旧进程 404 时界面显示「保留位暂时没记上：稍后点右上「刷新」再试。」而非裸 Not Found；
    控制台仅剩该枚预期 404，请求账全指 8900（ADR 0007 保持）。
  - **真机未验证的两腿（待用户处置）**：生成腿与点赞腿的**成功路径**尚未端到端取证——运行中的 8900 是旧进程，
    `openapi.json` 无这两枚端点（404），需经 8900 控制面重启后端方能验证；重启影响并行会话共用的同一环境，
    故本批只呈报不擅自重启。
  - **复验数据残留（需处置）**：`qed_test` 库 `qe_learn_kp_detail` 新增一行候选 `kpd-122bd665e6ad`
    （名称「浏览器复验批注」，parent `kp-143c7992e77a`），可由界面驳回通路清退或由人工 DELETE。

- **2026-10-17 用户现场验收后三项改判（C22~C24）＋「为什么没按 design/ 办事」根因取证**：
  用户令＝「在课程学习的课程子页面中，左上角是返回，返回根页面，课程名称右侧才是返回书架的按钮；
  目录无需展示当前情况的注解，这是后台管理需要了解，而主界面不要展示……目录应该对齐、章节应该对齐，
  然后具体知识点缩进后也是对齐，都应该是左对齐。先处理完这些问题」，另要求查「为什么没有依据 design/
  设计文档操作」并给出防复发措施。
  - **真机取证（内置浏览器 1600 宽档，`evaluate_script` 量 `[data-outline-name]` 行的文本左缘）**：章行按钮
    `btnLeft` 全等于 41、`paddingLeft` 全等于 `7px`，但**文本左缘**＝ `-91.7 / -71.8 / -5.8 / -122.8` 四个不同值，
    且随名称长度变化——这是 flex 居中的特征，不是左对齐。根因＝`pages/LearnWorkbench.tsx:292` 只写了
    `style={{ textAlign: 'left' }}`，而 antd v5 `Button` 的内容容器是 `display:inline-flex; justify-content:center`，
    `textAlign` 对 flex 主轴**无任何作用**。知识点行另靠外层 `div{marginLeft:14}` 缩进，两档左缘没有单一常量来源。
    登记为 `DEFECT-016`（改代码行为的界面缺陷，按 AGENTS.md「缺陷以承载轮壳条目＋回归测试替代独立计划」）。
  - **为什么没按 `design/` 办事——四条根因（逐条可复核）**：
    ① **课程学习面的界面形态正本不在 `design/`**：本轮 v2 详设在 [REQ-117 壳](2026-10-15-learn-course-study-redesign.md)
      「设计本体 v2」节，**W6 晋升未做**，`design/frontend/` 只有 `frontend-overview.md:78` 一行摘要（其自述
      「待晋升，重设计轮详设指针引 REQ-117 壳」）；而该行的「页头三件套＝使用手册／刷新／返回书架」恰好就是本次
      被改判的形态——**码是按壳写的，壳不在审理链上**，用户只能在真机上看到偏差。
    ② **学习面模块没有进 `code-map.md`**：`grep -n "LearnWorkbench\|learnWorkbench\|AnnotationPane" docs/architecture/code-map.md`
      ＝**零命中**。`tests/contract/test_code_document_mapping.py` 的 DesignRef 链因此覆盖不到这些文件，
      「模块 ↔ 设计条目」无绑定，界面形态偏离没有任何机械信号。
    ③ **守护只扫禁词、不扫形态**：`learnPlaneCopy.test.tsx` 与 `helpPages.test.ts` 断言的是**词表**（禁现／必含），
      对齐、按钮落点、状态注记该不该出现都属于**形态规则**，旧守护结构上抓不到；且 §V2.4 的「层级左对齐」
      原文只覆盖中栏正文块，没写目录（本次同批补覆盖）。
    ④ **真机验证的形态盲区**：内置浏览器视口宽为 0／`clientHeight` 恒 0，三栏版面在验证时**退化成侧滑形态**，
      宽屏三栏的对齐与按钮排布从未被肉眼过（已记 [[project-8903-stale-bundle-inapp-browser]] 同族坑）。
  - **防复发落点（本批实施，不新增标准条款）**：① 形态常量化＋可断言＝`outlineRowStyle(level)` 单一常量出口，
    页头返回落点写进 §V2.2 行并有 `LearnWorkbench.test.tsx` 用例锁定；② 词表守护扩到**形态注记**＝
    `BANNED_TOC_STATUS_TOKENS` 扫 `pages/LearnWorkbench.tsx` 源码，四类处理进度句在学面源码级禁现；
    ③ **W6 晋升立刻做**（把 §V2 全量晋 `design/frontend/learning-course-ui.md` 并挂 `CURRENT_DOCUMENTS`），
    让形态有可审理的正本；④ `code-map.md` 补学习面模块行并挂 DesignRef，使 `test_code_document_mapping`
    覆盖到这批文件；⑤ `.qoder/skills/qed-frontend-check` 增一条＝**版式类改动必须 `innerWidth` 三档各测一次**
    （1600／1200／860），并记录文本左缘实测值，禁止只看侧滑形态判绿。
  - **落点④ 实施时改判（code-map 补前端行不可行 → 由 `tests/test_web.py` 承接）**：取证
    `tests/contract/test_code_document_mapping.py:15` `MANAGED_DIRECTORIES = ("backend/qed_engine", "tests")` 只扫 `.py`，
    且 `test_every_non_exempt_module_is_mapped_once` 断言「映射表路径集合 **＝** 受管模块集合」（多一行即红），
    `test_module_headers_match_mapping_status_and_design_reference` 还要求源码含 `设计关联（DesignRef）：` 行（Python
    docstring 形态，`.tsx` 无从满足）。**替代实施**：已受管的 `tests/test_web.py`（DesignRef＝`frontend-architecture.md`）
    新增两枚守护——`test_learn_workbench_source_declares_design_reference`（源码注释必须写
    `设计关联：docs/design/frontend/frontend-overview.md`）＋ `test_learn_plane_form_shape_pinned_to_single_source_constant`
    （`outlineRowStyle`／`OUTLINE_INDENT_PX` 必须**同时**存在于源码与设计正本）。设计正本
    `docs/design/frontend/frontend-overview.md:78` 课程学习行同步点名三处实现单一来源：形态常量（C24）、
    `BANNED_TOC_STATUS_TOKENS`（C23）、`AppHeader` 的 `leading` 槽（C22）。先红后绿：补指针／补常量名前
    分别红于「LearnWorkbench.tsx 头部注释缺「设计关联」指针」与「设计正本 … 应点名形态单一来源：outlineRowStyle」。
  - **落点⑤ 已实施**：`.qoder/skills/qed-frontend-check/SKILL.md`「前置」增第 3／4 条（改码必先 `npm run build` 并比对
    8903 实际返回的 `assets/index-*.js` 哈希与 `dist/index.html` 一致；新端点先查 8900 `openapi.json` 以判是否旧进程），
    「验证步骤」增第 5 条＝版式类改动 `innerWidth` 1600／1200／860 三档各测一次、用 `Range.selectNodeContents` 量**文本左缘像素**
    并记录实测值，禁止只看侧滑形态判绿；第 6 条允许视口不可用时以实测读数替代截图并如实注明。
    （本窗口两条现场归因即由该批前置条款收编：①「前端没编译」实为 SPA 旧标签页未重载；②「点了没反应」实为旧 8900 进程缺端点。）

- **2026-10-17 C22~C24 实施批门禁与真机三档复验**：
  - 门禁：`web-ui/` 内 `npx vitest run --no-file-parallelism` ＝ **67 files / 843 tests 全绿**；`npx tsc -b` exit 0；
    `npm run build` 出 `assets/index-9YovagVj.js`，8903 实际返回同哈希；`D:/software/anaconda3/envs/QED_env/python.exe -m pytest tests -q`
    ＝ **792 passed / 2 failed**，两枚红非本批（`test_database_design_carries_column_definitions_for_tables_it_owns`＝并行 REQ-122
    在改 `database-design.md`；`test_runtime_artifacts_only_under_logs_and_tmp`＝活着的 wsl.exe keepalive 留下的
    `scripts/image-model/.keepalive.pid`，PID 211160 属运行态）；`ruff check backend tests scripts` All checks passed；
    `pytest tests/contract -q` ＝ 83 passed ＋ 上述同两枚红；补落点④后 `pytest tests/test_web.py -q` ＝ 15 passed。
  - 真机三档（`#/learn/c/<cid>?book=<bid>&v=w10`）：1600 档导航按钮名单＝`["返回","使用手册","刷新"]` 三枚白字；
    heading 文本＝`数学分析\n返回书架` 且 heading 内唯一按钮＝返回书架；目录四类处理进度话术全 `false`；
    9 条章行文本左缘同为 **50**（padLeft 8px）、知识点行 **64**（padLeft 22px）；1200 档右栏收侧滑、只剩「打开注解」；
    860 档侧滑内章行 **34**／知识点 **48**；`list_console_messages` 仅生成／点赞那两枚已知 404（旧 8900 进程，见上「待用户处置」）。

- **2026-10-17 C29 改判（返回挪导航右上角）实施与真机复验**：
  - 改判理由与实证基线：用户令「在课程学习页面中，返回按钮放在页面右上角，与其他页面一致」。取证基线＝
    `web-ui/src/pages/LearnShelf.tsx:194`（书架）、`web-ui/src/pages/Knowledge.tsx:119`（知识探索）与练习面的返回均在
    `AppHeader` 的 `actions` 区末位；课程学习面原 C22 把「返回」放导航最左 `leading` 槽，属孤例。
  - 全链路清扫（不留未用参数）：`AppHeader.tsx` 删 `leading` prop、外层 `Space size={16}` 包裹与 JSX 内 `{leading}` 引用；
    `LearnWorkbench.tsx` 头注释与页头改为右上角三枚＝使用手册／刷新／返回（返回末位）、`workbench-heading` 内课程名右侧「返回书架」保留；
    `help/sections.ts:143` 手册文案同步「右上角『返回』回总入口，课程名右侧『返回书架』回书架」；
    设计正本 `docs/design/frontend/frontend-overview.md:78` §5 与壳 §V2.2 页头行、W10 行状态同步改判。
  - 先红证据：改测后 `LearnWorkbench.test.tsx` 页头用例断言 `["使用手册","刷新","返回"]` 于落码前红＝
    实际 `["返回","使用手册","刷新"]`；删 prop 后首次运行因 JSX 残留 `{leading}` 报 `ReferenceError: leading is not defined`，
    连坐 29/31 用例，清理后该文件 4 files / 68 tests 绿。
  - 门禁：`web-ui/` 内 `npx vitest run --no-file-parallelism` ＝ **67 files / 843 tests 全绿**；`npx tsc -b` exit 0；
    `npm run build` 出 `assets/index-DmdMN-go.js`，8903 实际返回同哈希。
  - 真机三档（`?v=c29#/learn/c/math_analysis?book=mathanalysis-b05`）：1600／1200／860 三档导航按钮名单恒
    `["使用手册","刷新","返回"]`；导航最左只剩品牌（`brandSiblings`＝`["A:QED-Engine从公","DIV:使用手册刷新返回"]`、
    `leftmostIsBrand`＝`A/DIV`）；`workbench-heading` 内唯一按钮＝`["返回书架"]`、标题文本＝数学分析；
    `drawerToggles` 1600 `[]`／1200 `["打开注解"]`／860 `["打开目录","打开注解"]`；点击腿 `afterReturn`＝`#/`、
    `afterShelf`＝`#/learn`；`list_console_messages` 零消息；网络 108 条全指 8903 静态＋8900 API，无 4xx/5xx。

- **2026-10-18 W11 达成认定 ＋ 孤儿确认面板删除批（用户令「W11 现形态认定达成，除了 LLM 之外的完成即可；
  孤儿 TocConfirmPanel/tocParse 删除；继续执行」）**：
  - **达成取值口径**：W11 的 ① ~ ⑤ 现形态即验收形态，**LLM 腿不计入前置**——LLM 提问的后端功能腿（本轮有意零请求）
    与生成／点赞两腿成功路径的真机取证（待 8900 重启，同 W9 条遗留）留挂原处、不阻塞本轮收口。
  - **删除范围经消费者取证后收窄（重要改判）**：`TocConfirmPanel.tsx` 全仓无 JSX 消费者（`LearnWorkbench.test.tsx:339`
    反向断言「修改目录」按钮不在），真孤儿＝该组件 ＋ `TocConfirmPanel.test.tsx`（8 例），**已删除**；
    但 **`tocParse.ts` 不是孤儿**——`stores/learnWorkbench.ts:25` 仍消费 `autoLocateToc`／`toOutlinePayload`／
    `BodyPageText` 驱动进场自动定位（`TOC_SCAN_PAGES`＝20 与 `tocPhase` 三态），`api/learn.ts:241-259` 的
    `GET`／`PUT …/outline` 亦在用，故**保留**（连带 `tocParse.test.ts` 29 例）。§V2.7 迁移表该行按此改判回写。
  - 随步清扫：`pages/learnPlaneCopy.test.tsx` 摘除 `tocPanelSource` 的 `?raw` 导入与在册文件条目（学习面在册文件
    只剩书架／工作台／store＋右栏三组件＋推进组件）；`components/practice/ExerciseConfirmPanel.tsx:2` 的
    「判例 TocConfirmPanel」改指 `exerciseParse.ts`，不留指向已删文件的死引用。`docs/history/` 与 `completed.md`
    内的旧名提及属追溯记录，不改。
  - 门禁（`web-ui/` 内串行）：`npx tsc -b` exit 0；`npx vitest run --no-file-parallelism`＝**66 files / 843 tests 全绿**
    （较 C29 批少一枚文件＝删除的用例文件）；`npm run build` 绿（`assets/index-DFi0x6MH.js`，chunk 体积告警为存量）。
  - 根侧 `pytest tests/contract -q`＝**88 passed / 1 failed**，唯一红＝`test_markdown_links` 报
    `docs/plans/2026-10-15-shared-tables-field-freeze.md` 与 `-16-shared-tables-tracker-request.md` 指向
    `../../../QED-Tracker/docs/architecture/database-shared-tables.md` 的死链——属并行 REQ-120/121 共享表轮的在途文件，
    **非本批引入**（本批只动 web-ui 与 shells），归该轮收口批处理。

- **2026-10-18 W6 晋升批（设计稿一次晋升 `design/` ＋ 全仓指针收敛）**：
  - **新档**＝[docs/design/frontend/learning-course-ui.md](../../../design/frontend/learning-course-ui.md)：
    以本壳 §V2.1~§V2.12 为源**重写为设计态正文**（去过程化——裁决编号链、取证事实与迁移表旧行不留，
    沿革只留一条指针回本壳），骨架按 ADR 0017 五段（§1 定位与目标／§2 范围与非目标含逐条事实源指针／
    §3 书架清单／§4 工作台形态／§5 阅读单位与正文规格／§6 学习交流三段／§7 推进三枚／§8 生成与点赞消费语义／
    §9 文案净化与守护／§10 状态与降级矩阵／§11 已知约束与维护规则）；元数据＝设计状态 Accepted／
    实现状态 In Progress（LLM 提问腿与生成点赞两腿取证未完）／确认状态 暂定／关联代码不认领后端端点与表结构
    （事实源＝api-contracts §⑥ 与 database-design）。
  - **指针收敛七处**：`tests/contract/test_design_documents.py` 的 `CURRENT_DOCUMENTS` 加 `frontend/learning-course-ui.md`
    （全集等值守护）；`design/index.md` 待晋升段改写＝三面全晋升、唯一仍在 `plans/` 的学习链路稿＝REQ-116，
    学习中心表加行＋段末沿革句；`frontend-overview.md` §5 课程学习行由「待晋升＋全文复制口径」改为
    **指针 + 只留流程定位与边界**（消除与详设档的双写）、§5 前言与 §7 已决/节奏句同步、`最后更新` 改 2026-10-18；
    `frontend-architecture.md` 信息架构两条 `#/learn*` 行**按工作树实态重写**（承接 W7④：删掉「阅读／链路双模式」
    「`compile/propose`+`compile/start` 链路通路」「引用式注册弹窗」「批注与候选」四处陈旧口径，并登记
    `TocConfirmPanel` 已删、`tocParse.ts` 保留的事实）——旧 `#/learn/c/:courseId` 行整行删除、并入新行；
    `roadmap.md` 前端行的「书架／链路双模式／看板结课已交付」改为 M1→REQ-117 沿革句并指向新档。
  - **`code-map.md` DesignRef 不适用**（本壳 W6 原文列了该项）：受管面只扫 `.py`（`test_code_document_mapping.py:15`），
    前端文件无 code-map 行可挂，判例同 W10 落点④ 改判。
  - **互指守护随晋升改指详设档**：`tests/test_web.py` 的 `LEARN_UI_DESIGN` 由 `frontend-overview.md` 改指
    `docs/design/frontend/learning-course-ui.md`，`LearnWorkbench.tsx:3` 的「设计关联」注释同步；起因＝§5 课程
    学习行压缩为指针后，该档不再点名 `outlineRowStyle`／`OUTLINE_INDENT_PX`，`test_learn_plane_form_shape_pinned_to_single_source_constant`
    打红（本批引入、本批修）。形态单一来源断言仍由详设档承载，总纲只做流程定位，二者不双写。
  - **门禁**：`pytest tests/contract -q`＝**88 passed / 1 failed**，全量 `pytest tests -q`＝**813 passed / 1 failed**，
    唯一红均为存量 `test_markdown_links` 的 QED-Tracker 死链（REQ-120/121 共享表轮在途文件，非本批）；
    `ruff check backend tests` All checks passed；新档与其全部入站链接经该门禁扫描通过，
    `test_design_documents` 两枚守护（全集等值 + 元数据齐备）绿。web-ui 面＝`tsc -b` 零错、
    vitest 串行 **66 files / 843 tests** 全绿、`npm run build` 过（详设晋升后复跑）。

- **2026-10-18 收口批（用户给权「进行台账批和归档」）**：
  - 台账＝todo 摘三行（REQ-117／DEFECT-016／REQ-070-LEARN）→ `completed.md` 三行 Achieved；DEFECT-016 关闭证据
    记其 S3「导航最左返回」由 C29 改判为导航右上角的承接；REQ-070-LEARN 记 W8 三面全晋升（含 10-14 部分改判：
    只晋 C 面 → 10-18 B 面以 v2 补齐）。`project-status.md` 学习中心行同步。
  - 归档＝两壳 `mv` 至 `docs/history/plans/2026-10/`（Retain，无冲突），壳内 `状态：Completed ＋ 关闭结果：Achieved`
    元数据补写；链接重算入站 21 条／出站 24 条，另有 6 枚反引号路径与 1 枚跨仓指针按新深度手工改写（链接门禁
    只扫 `[..](..)` 形态，反引号路径不在其面内）。`plans/index.md` 两条活跃叙述改为「已归档计划（2026-10）」条目。
  - 归档后复跑＝`pytest tests/contract -q` 88 passed / 1 failed、`pytest tests -q` 813 passed / 1 failed
    （唯一红仍＝并行共享表轮的 QED-Tracker 死链，与本批无关）、`ruff check backend tests` 净。
  - 改写脚本留痕＝`tmp/req117_archive_link_rewrite.py`（一次性工具，不入库）。

## 验证与验收

- 设计与门禁矩阵见[开发指南](../../../guides/development.md)；前端改动一律经浏览器实测（`qed-frontend-check`），
  请求账须全指 8900（ADR 0007）。
- W2 产物＝冲突对表逐条有裁决并回写四份文档；W3 到门暂停；W6 晋升后 `tests/contract` 全绿
  （含 `test_design_documents` 递归守护与链接门禁）。

## 回滚

- 文档面：删本壳与 todo REQ-117 行、还原总设计 §5 指针即回立项前状态。
- 实施批次（W5）：按提交点逐 commit 回退，不使用 `git reset --hard`（工作树含并行 WIP）。

## 关闭与归档

**S1~S5 逐条达成状态（2026-10-18 自检，用户同日给权收口）**：

- S1 **达成**＝三方边界对表 C1~C6 逐条有裁决并回写四份文档（总设计 §5 与「链路不出界面」口径一致，
  现由 `frontend-overview.md` §5 课程学习行 ＋ 新档 §2/§11 承载）。
- S2 **达成**＝v2 设计本体含能力迁移表（§V2.7）与讲解呈现规格（§V2.5／§V2.12）。
- S3 **达成（口径按 W11／C15 改判后的现形态）**＝demo 门 2026-10-16 到门真机走通并留请求账（行 S3 原文写
  「选节阅读」，阅读单位经 C15 改判为知识点，取证按改判后形态核）；结课腿取证复用 REQ-105 收口批同日同码路。
- S4 **达成**＝`learnPlaneCopy.test.tsx` 三张词表（后台口径／工作台旧口径／目录处理进度四类说明）扫源码守护，
  工作台与书架全在册文件参与断言。
- S5 **达成**＝2026-10-18 一次晋升 `design/frontend/learning-course-ui.md` 并收敛全仓指针（详见「过程与证据」
  2026-10-18 晋升批条）；前端门禁 `tsc -b`／vitest 串行 66 files 843 tests／`npm run build` 全绿。

**收口执行（用户 2026-10-18 给权「进行台账批和归档」，本批已落地）**：todo REQ-117 行原子移出 →
`completed.md` Achieved 行（逐条证据含 S3 口径按 C15／W11 改判核销的注记）；同批联动关闭
`DEFECT-016`（其 S3「导航最左返回」由 C29 改判为导航右上角，关闭证据已记该承接）与
`REQ-070-LEARN`（W8 三面全晋升后达成）；本壳与 REQ-070-LEARN 壳按 Retain 归档
`docs/history/plans/2026-10/`，入站链接按新深度重算（实测改写 21 条：`frontend-architecture.md`、
`four-service-architecture.md`、`design/index.md` 叙述、本档沿革行所在的新档
[learning-course-ui.md](../../../design/frontend/learning-course-ui.md)、`plans/index.md` 改归档形态条目、
REQ-116 壳、REQ-121 壳、`design-bugfix-log.md`、`trackers/project-status.md`、`design/tech-stack.md` 两枚、
`history/adr/v0.1/0004`、`history/plans/2026-08/2026-08-18-document-chunking-recall.md` 两枚、
`history/plans/2026-10/2026-10-11-learn-ui-course-study.md` 四枚），壳内出站链接同批重算 24 条
（含 6 枚反引号路径与 1 枚 `QED-Tracker` 跨仓指针，链接门禁复跑后仅剩并行共享表轮的 5 枚存量死链）。
`design/tech-stack.md` 两行的「原生前端无构建」陈旧口径**本轮只改链接未改正文**，留该轮治理面处理。
设计正本＝
[learning-course-ui.md](../../../design/frontend/learning-course-ui.md)（2026-10-18 一次晋升，设计态正文以该档为准）；
本壳「设计本体 v2」节作为裁决与实现的**过程追溯**保留（去过程化正文已上移，本节留沿革与取证指针）。

## 设计本体 v2（学习工作台＝章 ＋ 知识点逐步学习·**已晋升 2026-10-18，本节留裁决沿革与实现取证**）

> **正本已迁**：2026-10-18 随 W6 一次晋升为 [design/frontend/learning-course-ui.md](../../../design/frontend/learning-course-ui.md)
> （去过程化重写：设计态正文进该档，本节保留裁决编号链、能力迁移表与取证事实，两处如冲突以该档为准）。
> 本节原是 REQ-117 W4 产物（S2 判据「重设计稿 v2 含能力迁移表与讲解呈现规格」的正文）。v1 正文见归档壳
> [history/plans/2026-10/2026-10-11-learn-ui-course-study.md](2026-10-11-learn-ui-course-study.md)
> 的「设计本体」节，v2 覆盖其中 §3／§5／§6／§9 四节的形态口径，其余节（§7 目录解析、§8 批注闭环）沿用。
> 新增四项裁决 **C14~C17**（用户 2026-10-16 四问裁定）：知识点生产腿归后台／阅读单元＝章＋知识点两级／
> 推进单位复用单元表承载／块切分改进落在排版层、块结构请求并入既有请求线。
> **v2.1 修订**（用户 2026-10-17 四问裁定 **C18~C21**，覆盖 §V2.2 标题行与左栏／右栏、§V2.5 整节、
> §V2.6／§V2.7 增行，并新立 §V2.11）：生成腿由 8900 新端点承载（前端不直调 `/llm/*`）／点赞＝保留为候选不入库／
> 章级总结与学习要点持久化到章行进场直读／工作台页头不显示进度（书架教材卡进度保留）。
> 同批令摘除页头「· 学习工作台」后缀与左栏「修改目录」入口，右栏标题改「注解」。

### V2.1 定位与读者

工作台是学习者**逐条知识点**读完一门课的地方：左栏看「学到哪」，中栏读「这一条的知识」，右栏做「学过与记下」。
本面只消费文档分析处理（REQ-116 职责①②）的成品——已确认目录、已确认知识点、已关联习题（联动只在数据层）。
界面不出现过程性内容与页码运维口径（总设计 §6 铁律）。

### V2.2 页面形态与页头（与全站统一）

| 区域 | 工作树实态（v1） | v2 形态 | 依据 |
| --- | --- | --- | --- |
| 页头按钮 | 三枚都在导航右侧＝使用手册／刷新／返回书架（`web-ui/src/pages/LearnWorkbench.tsx:211`） | **导航右上角三枚**＝使用手册／刷新／**返回**（回根页面 `#/`），与书架／知识探索／练习三面**同位同顺序**（口径基线＝`pages/LearnShelf.tsx:194`、`pages/Knowledge.tsx:119`）；**课程正式名称右侧**「返回书架」＝`#/learn`；三枚同款蓝底白字 `headerButtonStyle`；「刷新」＝重取目录＋知识点序列＋注解池，不触发任何生产 | C22 ＋ **C29 改判**（用户 2026-10-17 令「返回按钮放在页面右上角，与其他页面一致」；C29 裁＝「返回挪右上角，返回书架留在课程名右侧」。**原 C22 的导航最左 `AppHeader.leading` 槽作废并全链路清扫**：该 prop 唯一消费者即本面，随本批改判删除，不留未用参数） |
| 标题行 | `{课程名} · 学习工作台` ＋ `学习进度 N%` | **只写课程正式名称**（取 `course_ref.label`，缺失回落 `ref_id`）＋**右侧紧跟「返回书架」**；**页头不显示任何进度** | 用户 2026-10-17 令「改名为 math_analysis，去掉后缀」「并不需要显示学习进度」；C21／C22 |
| 左栏 | 教材 → 章 → **节** 三级，节是推进单位，栏头带「修改目录」 | **两级＝章 → 知识点**，节层不再显形（其页窗降为取材信息）；**「修改目录」按钮删除**，目录人工修正腿移交 REQ-116 文档分析处理面；**栏内只列名称**（章名／知识点名／自己的「已学」标记），**不显示任何处理进度类说明**（C23 四句全摘，见 §V2.6）；行左对齐按 §V2.4 第 1 条的**两档左缘**实现（C24／DEFECT-016） | C15 ＋ 用户 2026-10-17 令 ＋ C22~C24 |
| 中栏 | 按节页窗逐页排块，标题「正文 · 第 N–M 页」，页尾「继续加载 N 页」按钮 | **一条知识点的连续正文流**（跨页合并后单序列渲染），界面无页码字样、无续取按钮（滚动即续）；标题下先直排该条摘要，再接正文 | C15 ＋ §V2.4 |
| 右栏 | 标题「推进与批注」＝「本节学完／跳过本节／撤销」＋批注表单＋本章候选 | 标题**「学习交流」**（2026-10-17 C25~C28 改判，原「注解」四段作废），**三段**自上而下＝① **本章总结与学习要点**（进场直读、缺失才生成，承 C20）→ ② **详解**（中栏点正文某一块 → 只列**这一块**的总结与注解；点赞在此，承 C19；段内给 **LLM 提问**输入框＋置灰发送按钮，本轮零请求，承 C28）→ ③ **备注**（用户自由书写，落点＝候选池打标，承 C26）；**「推进」段整段下线**，推进动作改放**章／知识点正文末尾**三枚按钮＝上一条／下一条／已掌握并下一条（承 C25）；「保留为候选」批注腿**移出学习面**（知识点确认归 REQ-116 后台管理）；细则见 §V2.12 | C18／C19／C20／C21 承 ＋ **C25~C28 改判**（用户 2026-10-17 令「注释这块改名为学习交流……推进本身没有意义，在章节／知识点末尾有上一条、下一条、已掌握 下一条三个按钮」） |
| 版式 | 断点三模式（`workbenchModeFor`，≥1400 三栏／1000~1400 目录＋正文／<1000 单栏） | 保留不动（B4 已实施），左栏内容换为两级树 | B4 |

### V2.3 推进单位＝知识点（数据口径）

- 单元表 `qe_learn_unit` 的 `level` 闭集由 `section`／`unit` 扩为加 **`point`**，point 行带 `kp_id` 引用
  `qe_knowledge_point.kp_id`；进度表 `qe_learn_unit_progress` 的 `UNIQUE(unit_id)` 与勾选写路径**不动**。
- 镜像规则＝**读时投影、首次落笔才物化**：`GET …/units?level=point` 把该课已确认知识点按章序 → 知识点 `order_hint`
  投影为 point 单元行，`unit_id` 用稳定派生键 `kp:{kp_id}`；只有该行被勾选/跳过时才落物理行。
  理由＝消除 B2 已消灭的进场写放大不在新口径下复活（现网 86 节 → 未来知识点数只会更多）。
- 派生与结课：`derived.percent`、`completed`、`books_progress` 一律按 point 行计数；旧 `section`/`unit` 行不再计入，
  保留只读不产生新行。书架教材卡的 `N/M 节` 随之改 `N/M 知识点`。
- 断点：`current_unit_id` 语义改＝当前知识点行，「回到断点」交互不变。
- 契约影响面（**实现批同批改 `api-contracts.md`**，文档先行阶段不提前登记，免触端点总表双向守护红）：
  `GET …/units`（level 闭集与 point 行字段 `kp_id`）、`POST …/progress`（unit_id 取派生键）、`derived`（计数单位与 `books` 口径）。

### V2.4 中栏排版规格（用户两痛点：层级左对齐、块切分）

1. **层级左对齐**：正文块左偏移＝其所属标题层级——章题 `0`、节题 `16px`、子题 `32px`，正文／公式／图表块与最近上级标题同档，
   并显式 `textAlign:'left'`。根因证据：`components/parsing/typography.ts:141` 的 `roleTypography` 只返回字号与字族、
   `components/parsing/BlockList.tsx:243` 的 `boxStyle` 无任何左偏移项；正文侧照此映射即与目录同形。
   **左栏目录同条覆盖（C24／DEFECT-016）**：目录行的左缘只有两档——章行 `padding-left: 8px`、知识点行 `padding-left: 22px`
   （＝`8 + OUTLINE_INDENT_PX(14)`），同档内必须**逐行相等**；antd `Button` 内容是 flex 居中，`textAlign:'left'` 单独写
   **完全无效**（真机取证＝同一批章行的文本左缘实测 `-91.7 / -71.8 / -5.8 / -122.8` 四个不同值，随名称长度变化＝居中特征），
   故行样式必须同时给 `justifyContent:'flex-start'`。落点＝`outlineRowStyle(level)` 纯函数导出，缩进量单一常量，
   由 `LearnWorkbench.test.tsx` 的「两档左缘相等」用例与源码扫描共同守护。
2. **跨页段落合并**：相邻两块同为正文且前块不以句末标点或冒号收尾 → 合并为一段（消除「一页一块、句子从中间断开」）。
3. **标题归位与去重**：同一标题在页眉重印或跨页重印时只保留首个，并按第 1 条落到其层级档位。
4. **噪声剔除**：页眉页脚与页码块默认不渲染；题注紧随其图块。
5. **无页措辞**：中栏标题＝知识点名本体，不带页码；取材范围降为「本条正文出处」悬浮提示（已裁②）。
6. **续取不显按钮**：滚到已取块末尾自动续取下一批（批次粒度沿用 `PAGE_BATCH`），界面不出现「继续加载 N 页」；
   到本条取材尽头显「这一条读完了：点「下一条」接着学。」
- **块切分本身（解析侧产物粒度）不在本轮范围**：并入既有请求线
  [REQ-099 解析区域驱动重解析与块结构编辑](../../../plans/2026-09-26-req098-parsing-region-edit-typography-axiom-flow-request.md)
  的 R2／R5 口径，本轮只做排版层止血（C17）。

### V2.5 注解呈现规格（S2 判据）与来源依赖

- **章级段（恒在其上）**：选中任一知识点或整章区域时，右栏顶部恒显**所属章**的「章节总结」与「学习要点」
  （3~6 条）。存储＝章行 `qed_knowledge_point.summary`（总结）＋ `meta.chapter_key_points`（要点数组，走扩展槽，
  定档前不作筛选列）；**进场一次直读、缺失才生成、生成即持久**（C20）。
- **条级段**：当前这一条（知识点，或整章阅读时的区域）的总结／注解＝候选池 `qe_learn_kp_detail` 中
  `parent_kp_id`＝该条（整章时＝所属章）且 `gen_status ∈ (candidate, adopted)` 的叙述；
  排序＝点赞（`payload.liked`）在前 → 更新时间倒序；零条时给「生成本条总结」入口（C18）。
  **C25~C28 改判（W11 起此段＝「详解」并按正文块过滤）**：过滤键＝`anchor.page` ＋ `anchor.block_index`
  （缺 `block_index` 的旧行退化为按页匹配并回显出处页，见 §V2.12 C27）；`payload.kind='note'` 的备注行**不入此段**（C26）。
- **中栏摘要**：知识点自身 `summary` 仍在中栏标题下、正文之前一段直排，无页签、无折叠层
  （§V2.4.5 无页措辞不变）；右栏只承载可操作的注解集合，两处同源不同用。
- **点赞语义**：点赞＝`payload.liked` 置位（＝保留，跨会话直读并优先展示），**不入库**；入库腿
  （`confirm` → 主表）仍归文档分析处理面，学习面保持零确认写面（C19 承 C14／B6）。
- **缺位必须给下一步**：章级、条级都不得出现无指引空态（承 B1/B5），话术一律不说「未就绪」「离线」「服务」。
- **来源依赖**：细知识点的产生与确认入库归文档分析处理面（REQ-116 职责①②）；学习面只**发起生成请求**、
  **展示**与**点赞保留**——按需生成这一腿的契约见 §V2.11，与「范围」节的 C18 改判注记同批。

### V2.6 状态与降级矩阵（v2）

| 情形 | 界面 | 判据 |
| --- | --- | --- |
| 章内零已确认知识点（**现网真实：`math_analysis` 仅 1 条、`linear_algebra` 0 条**） | **左栏该章只显示章名，不加任何注记**（C23 摘「这一章的知识点还在整理」）；点该章即整章阅读，推进区给空态＋次级入口（已裁③） | 该课 `node_kind='point'` 行数＝0 |
| 知识点无页范围 | 中栏显「这一条还没有定位到书页」，正文按所属章页窗兜底并标注整章呈现 | point 行 `source_ref` 与 `anchors` 均空 |
| 目录未就绪 | 进面当场生成（既有通路保留）；**目录不显示「正在为您整理」「暂时没整理好」「还没有可读的教材」三句**（C23），栏内空着即空着 | 课程 `unit_count=0` |
| 处理进度归谁看（**C23 新立行**） | 「整理中／整理失败／无可读教材／章内零知识点」四类**当前情况说明一律不出现在学习面目录**——它们是后台管理（REQ-116 文档分析处理面）与解析管理界面要看的事实；学习者只需知道能读什么、点了会怎样 | 用户 2026-10-17 裁决「目录无需展示当前情况的注解，这是后台管理需要了解，而主界面不要展示」；守护＝`learnPlaneCopy.test.tsx` 的 `BANNED_TOC_STATUS_TOKENS` 扫 `pages/LearnWorkbench.tsx` 源码 |
| 教材正文还没准备好 | 「（正文还没准备好）」（B1 已改口径） | 激活版本缺失或页产物缺失 |
| 后端不可达 | 三栏各自降级、页头「刷新」可重试、不白屏 | 既有告警链保留 |
| 章级总结与要点还没有（**现网真实：全部章行 `summary` 为空**） | 右栏章级段出「生成本章总结与学习要点」，生成后持久化到章行，重进即直读 | 章行 `summary=''` 且 `meta.chapter_key_points` 缺 |

### V2.7 能力迁移表（v1 → v2 逐项去向）

| v1 能力／界面物 | v2 处置 | 承接与判据锚 |
| --- | --- | --- |
| 节（`section`/`unit` 行）作推进单位 | 摘除显形，行降为取材信息；进度改按知识点计数 | C15／C16 |
| 「本节学完／跳过本节」 | 改「本条学完／跳过」，并加上一条／下一条步进器 | C15／B5 |
| 「已学 N/M 节」计数（工作台＋书架同源口径） | 书架教材卡改「已学 N/M 知识点」；工作台右栏计数默认不保留 | C16／已裁⑧ |
| 「正文 · 第 N–M 页」「继续加载 N 页」 | 删除；滚动自动续取 | §V2.4 |
| 「新建学习课程」表单／课程删除入口 | 已摘除（W8 完成，书架清单 v2） | C9 |
| 知识点「确认入库／驳回」在学习面 | 保留至 REQ-116 承接批再摘（本批不摘，避免空窗） | B6 |
| 知识点讲解呈现 | 规格见 §V2.5 | C3／S2 |
| 页头两枚按钮 | 补齐为使用手册／刷新／返回三枚＋统一样式 | 本轮 Q「需要几个按钮」 |
| 「修改目录」入口（含 `TocConfirmPanel` 挂载与 `PUT …/outline` 人工通路） | 学习面摘除，人工修正腿移交 REQ-116；`TocConfirmPanel.tsx` 与其用例已删除（用户 2026-10-18 令摘孤儿组件），`tocParse.ts` **保留**——进场自动定位仍被 `stores/learnWorkbench.ts:25`（`autoLocateToc`／`toOutlinePayload`）消费，非孤儿 | 用户 2026-10-17 令 ＋ 2026-10-18 令 |
| 「推进与批注」栏标题 | 改「注解」，内容重排为章级→条级→推进三段 | C20／用户 2026-10-17 令 |
| 「本节讲解」只读段 | 拆两处：中栏＝该条 `summary` 直排；右栏＝章级总结与要点 ＋ 条级注解集合 | C20 |
| 批注「保留为候选」 | 保留人工批注；新增「生成」与「点赞（保留）」，点赞不入库 | C18／C19 |
| 进场整树写入（`PUT …/syllabus` ＋ 逐节 `PATCH`） | 摘除：知识点序列改读时投影、落笔才物化；`chainFromOutline.ts` 随之零消费者 | C16／§V2.3／已裁⑦ |
| 块切分质量 | 排版层止血本轮做；块结构改进走既有 REQ-099 请求线 | C17 |
| 「学习进度 N%」页头徽章（及 v2 草案的 `已学 X/Y 知识点`） | 页头整体摘除；进度只留在左栏「已学」标记与书架教材卡 | C21／已裁⑧ |

> **注（2026-10-17 C25~C28 改判）**：本表「批注『保留为候选』」行的**人工批注腿已被 §V2.12 移出学习面**
> （由「备注」取代，知识点确认归 REQ-116 后台管理）；右栏段题、段序与推进位置一律以 §V2.12 为准，本表旧行不删是为留追溯。

### V2.8 文案净化与守护增补

- 禁词沿用 `web-ui/src/pages/learnPlaneCopy.test.tsx` 的 `BANNED_BACKEND_TOKENS`；v2 追加界面禁词
  「页窗」「取材」「投影」「镜像」「未就绪」→ 统一说「还没准备好」；
  **v2.1 再追加「学习进度」「修改目录」「推进与批注」三词不得在工作台出现**（页头无进度、无人工修正入口、栏名改「注解」）。
- v2.1 必含词（右栏守护断言）＝「注解」「生成」「点赞」「学习要点」；课程册手册同步按两级＋注解口径改写。
  **C25~C28 改判随步（W11）**：右栏必含词改「**学习交流**」「**详解**」「**备注**」「生成」「点赞」「学习要点」，
  「注解」仍允许作段内内容词（「这一块的总结与注解」）但**不得再作栏题**；
  旧推进与批注话术在工作台源码级禁现＝「推进与批注」「本条学完」「跳过本条」「撤销勾选」「回到断点」「保留为候选」
  （落点＝`learnPlaneCopy.test.tsx` 新增词表或扩 `BANNED_TOC_STATUS_TOKENS`，实现批先红后绿）。
- 「节」字：界面不再以「节」作推进单位措辞；书本正文里的章节名（内容文字）不受限。
- 手册随步：`web-ui/src/help/sections.ts` 课程学习册按两级形态改写（删「点任一节」「按教材分组」等节口径步骤），
  `helpPages.test.ts` 加断言＝禁「本节」推进措辞、必含「知识点」与「下一条」。

### V2.9 测试与断言改口径清单（实现批先红后绿）

- 后端 `tests/test_learn.py`：`level` 闭集加 `point`、point 行投影与派生键稳定性、进度可打 point 且旧 unit 行只读、
  `derived`/`books` 按知识点计数。
- 后端 `tests/test_learn_knowledge.py`：`order_hint` 全空时按章序 → 创建序定序的口径用例（现网 point 的 `order_hint` 恒 NULL）。
- 前端 `pages/LearnWorkbench.test.tsx`：页头三枚与统一样式、标题无「· 学习工作台」后缀、左栏两级无节行、
  无「第 N–M 页」标题与「继续加载」按钮、勾选文案「本条学完」；断点与抽屉既有断言保留。（本条原列的「页头进度徽章」与 `已学 X/Y 知识点` 断言随 C21／已裁⑧ 撤销，改由本节 W9 行的「注解」三段断言承接。）
- 前端 `stores/learnWorkbench.test.ts`：节↔单元位置映射断言整体替换为知识点行断言；B2 稳态一次读断言保留。
- 前端 `pages/LearnShelf.test.tsx`：教材卡进度文案改 `N/M 知识点`。
- 前端 `help/helpPages.test.ts` 与 `pages/learnPlaneCopy.test.tsx`：§V2.8 词表断言。
- 后端 `tests/test_learn.py`（W9 新端点）：`generate` 三种 `part` 的落库位置（章行 `summary`／章行 `meta.chapter_key_points`／候选池一行 `candidate`＋`gen_batch`＋`anchors`）、重复生成＝章行覆写而候选并存、正文零可用页＝503、上游失败＝502、60s 节流命中回上次成品；`like` 只动 `payload.liked`，`gen_status`／`confirmed`／主表一律不动。
- 契约 `tests/contract/`：`api-contracts.md` 总表与语义表各加两行后 `test_api_endpoint_inventory` 双向等值绿。
- 前端 W9：`pages/LearnWorkbench.test.tsx` 删页头进度与「修改目录」断言群，改「注解」三段断言（章级在上、条级生成→点赞保留、推进段控件名）；`stores/learnWorkbench.test.ts` 删 `putSyllabus`/`patch` 断言群；`chainFromOutline.test.ts` 随模块删除。

### V2.10 待裁项（2026-10-17 W9 批：①~⑧ 全部落定，无遗留待裁）

- **已裁①**（知识点单元行用派生键零写）＝采纳并已实施：`unit_id = "kp:{kp_id}"` ＋ `source_ref.kp_id`，
  **零 DDL**——实现差＝§V2.3 字面写「point 行带 `kp_id` 引用列」而实际不新增列，见「过程与证据」W5 条。
- **已裁②**（保留「本条正文出处」悬浮提示）＝采纳，改称「本条正文出处」不落页码口径词。
- **已裁③**（章内零知识点时给「整章阅读」次级入口）＝采纳。
- **④~⑧ 落定（2026-10-17 用户令「按默认配置开始实施 W9」）**＝五项全按各行括号内「默认」取值采纳，
  实施证据与实现差登记见本壳「过程与证据」W9 条。
- **已裁④** 章级学习要点的持久槽：`qed_knowledge_point.meta.chapter_key_points`（默认，走扩展槽、零 DDL）
  vs 新增实体列（触 ALTER 红线窗口，宜并入 REQ-120 的表名改名窗口一并处理）。
- **已裁⑤** 点赞位：候选池 `payload.liked`（默认，零 DDL 且不碰 `confirmed` 语义）vs 复用 `confirmed`
  （会造成「置位即待提升」的误读，不建议）。
- **已裁⑥** 生成端点返回形态：同步一次一条（默认，前端 `timeoutMs=180000`）vs 作业表异步
  （对齐 `compile` 口径，多一张轮询面与一处状态机）。
- **已裁⑦** 前端清理：`chainFromOutline.ts` ＋ 其测试删除（本批后零消费者）；`api/learn.ts` 的
  `putSyllabus`/`proposeCompile`/`startCompile`/`getCompileStatus` 封装保留（契约投影层，仪表盘仍读 `compile_*` 字段）。
- **已裁⑧** 右栏不保留「已学 X/Y 知识点」计数（默认；进度只在书架教材卡与左栏「已学」标记；
  「已结课」作为一次性事件提示保留）。
- **另登记（不在本轮范围）**：课后练习面 `pages/Practice.tsx:75` 页头只有使用手册／返回、缺「刷新」，
  与本表 §V2.2 三件套不一致——待用户裁决是否同批改齐（改判属 REQ-106 练习面线，本行不代改）。

### V2.11 按需生成腿端点契约（C18 新立，实施挂 W9）

**`POST /api/v1/learn/annotations/generate`**

- 请求：`{ course_id: <学习课程 id>, target_kind: 'point' | 'chapter', kp_id: <知识点或章 id>,
  part: 'summary' | 'key_points' | 'annotation' }`（章级总结＝`summary`＋`target_kind=chapter`；
  章级要点＝`key_points`；条级总结／注解＝`annotation`）。
- 服务端编排（**前端不拼 prompt、不直调 `/llm/*`**）：按 §V2.3 页窗取该条取材正文（知识点自带 → 来源锚点 →
  所属整章三级回落，经既有 8900 书页读面取块文本）→ 拼 prompt（取材限长与 `max_tokens` 按 `part` 定档）→
  `services/llm/gateway.call_text(...)`（与 M-2 编译、M2 出题同一条网关通道）→ 落库：
  - `target_kind=chapter`：写章行 `summary` 或 `meta.chapter_key_points`（**覆写**，成品位单一）；
    不新建知识点行、不动 `name`／`type`／`parent_kp_id`／`source_ref`。
  - `target_kind=point`：写候选池一行 `gen_status='candidate'`、`intent='summary'`、`gen_batch='learn-annotation'`、
    `model_ref=<网关返回标识>`、`anchors=[{kind:'book',ref_id,page,snippet}]`、`confirmed=0`；
    重复生成＝多版本并存（候选池既有语义，不覆写）。
- 响应：`{ ok: true, target: {...}, detail?: <候选行>, chapter?: { kp_id, summary, key_points } }`。
- 错误口径（话术过 §V2.8 净化）：取材零可用页 → **503**「这一条的正文还没准备好，暂时生成不了」；
  上游失败或超时 → **502**「生成没能完成：<原因>，可以再点一次」；`part`／`target_kind` 非法 → 422；
  知识点两表不可达 → 503。
- 端点缺失兜底（W9 实现补登，原文只列 502/503）：8900 未重启而两枚端点不存在时真机返回 **404**，
  前端 `stores/learnWorkbench.ts:annotationFailure()` 把 404／405 转成带下一步的话术（生成＝「这一手暂时
  生成不了：稍后点右上「刷新」再试。」，点赞＝「保留位暂时没记上：稍后点右上「刷新」再试。」），
  其余状态码原样透过后端 `detail`；理由（裸 Not Found 违反 §V2.8 话术守则）与红测见「过程与证据」W9 条。
- 节流：同一 `(course_id, target_kind, kp_id, part)` 的**章级**请求 60s 内重复 → 直接回上次成品（不重复烧模型）；
  条级不去重。
- **`POST /api/v1/learn/kp-details/{detail_id}/like`**：`{ liked: boolean }` → 只写 `payload.liked`，
  `gen_status`／`confirmed`／主表一律不动（C19）；与既有 `…/confirm`、`…/reject` 同形状。
- 超时分层：网关 `qed_llm_timeout=300s`（`backend/qed_engine/config.py:65`）不动；前端这两个请求显式
  `timeoutMs: 180000`（`web-ui/src/api/client.ts:10` 默认 8000ms 必然超时）；8900 → 8902 取正文沿用既有页读档。
- 文档随步（W9 同批，缺一即契约红）：`api-contracts.md` 端点总表（§:171-203）与语义表（§:1016 起）各加两行；
  `/learn` 域前言「M-1 不含 LLM 生成」（§:989-991）改判为「M-1 静态出块不含 LLM；注解按需生成经网关」；
  `llm-gateway.md` §前端控制台（§:357-380）补一条＝前端生成类请求一律经业务端点，`/llm/text` 不开放给学习面。

### V2.12 右栏改判为「学习交流」（2026-10-17 用户口头裁决，W11 承载·设计先行）

**用户原话**：「注释这块改名为学习交流，我预想的是展示 1、本章总结和学习要点，帮助学习者有一个总体概念，
2、然后是详解，用户点击正文中的一块就出现，包括总结、注解、和 LLM 提问（待做，先展示后台先不提供功能），
用户点赞在这里点赞；3、备注：用户可以写备注。推进本身没有意义，在章节／知识点末尾有上一条、下一条、
已掌握 下一条三个按钮，这样即可；批注部分知识点确认这块归后续后台管理模块负责，本部分不要。」

**已裁（形态定档，实现批照此先红后绿）**：
- **命名**：右栏段题「注解」→ **学习交流**，三段＝① 本章总结与学习要点 → ② 详解 → ③ 备注；
  「推进」段整段从右栏移除（`components/learning/AdvancePane.tsx` 不再挂载）。
- **段 ① 恒在其上**：口径承 §V2.5 章级段（进场一次直读、缺失才生成、生成即持久），存储位与生成腿不动。
- **段 ② 由正文块驱动**：中栏点某一块 → 段 ② 只列**这一块**对应的总结与注解；点赞在此
  （`payload.liked` 语义不变，C19）；LLM 提问入口出现在此段，**本批只展示、不发请求**（后端不提供功能，属待做）。
- **段 ③ 备注**：用户自由书写并可回看，与「知识点确认」通路彻底分离。
- **知识点确认归后台**：学习面**不再往候选池写用户内容**——现「保留为候选」腿走 `POST /kp-details`
  （语义＝待后台确认的提升候选），按本裁决移出学习面；确认／驳回 UI 归 REQ-116 文档分析处理面，
  学习面维持零确认写面（承 C14／C19）。
- **推进动作换位置不换口径**：在章／知识点正文**末尾**放按钮（上一条／下一条／已掌握…，确切语义见待裁 Q1），
  仍走 `POST …/progress` 的 `status ∈ (done, skipped, pending)` 闭集，不新增状态、不动 DDL。

**待裁四点（本轮不动码）**：Q1 末尾按钮语义＋旧动作（跳过／撤销／回到断点）去留；Q2 备注落点；
Q3 块匹配口径与生成粒度；Q4 LLM 提问入口形态。裁决结果随实施批写进「过程与证据」W11 条。

**四点已裁（2026-10-17 AskUserQuestion，编号续 C25~C28）**：
- **C25 末尾按钮**＝**上一条／下一条／已掌握并下一条**。第三枚＝`POST …/progress` 置 `status='done'` 后自动前进；
  同一条上再点一次＝撤销（`status='pending'`）。「跳过本条」「回到断点」「右栏推进段」全部下线
  （`skipped` 态在后端闭集里保留、学习面不再产生它）。
- **C26 备注落点**＝**复用候选池表 `qe_learn_kp_detail` 并打标**：写入 `payload.kind='note'`、
  `gen_batch='learn-note'`、`gen_status='draft'`，`parent_kp_id`＝当前知识点。读取＝段 ③ 只列 `payload.kind='note'` 的行；
  段 ② 的总结／注解**必须排除** note 行。零 DDL，跨会话可回读，后端零改动。
  **口径纠偏（取证后写进设计，不当然）**：`draft` **不等于**「不进确认流」——
  `services/learn/knowledge.py:338` 的 `confirm_detail` 只拒 `rejected`（draft 与 candidate 皆可提升），
  `api-contracts.md:1050` 同口径。因此隔离靠三层：① 学习面零确认写面（`confirmKpDetail` 在 web-ui **无任何 UI 消费者**，
  本轮也绝不加）；② 后台确认队列按 `gen_status=candidate` 过滤（备注是 draft，天然不在此列）；
  ③ REQ-116 文档分析处理面承接稿增一条边界＝「`payload.kind='note'`／`gen_batch='learn-note'` 的学习者备注
  不得作为知识点提升来源」，随实施批写入该稿与 `api-contracts.md` 的 `GET /learn/kp-details` 行。
- **C27 块匹配**＝**锚点补块序号，按页码＋块序精确匹配**：`anchors` 元素增 `block_index`（页内块序，
  即 `SelectedBlock.index`，由 `BlockList.onSelect(index)` 供给）；写入侧 `stores/learnWorkbench.ts:605` 与
  生成腿 `learn.py` 落 `anchors` 同批改；段 ② 过滤口径＝`anchor.page == 选中块.page && anchor.block_index == 选中块.index`，
  **缺 `block_index` 的旧行**（现网候选行）按 `page` 匹配并在界面注明出处页，不做文本模糊猜。
  生成粒度**仍是条级**（`target_kind ∈ (point, chapter)` 闭集不动，后端零端点改动），只改展示过滤。
  契约随步＝`api-contracts.md` 的 `anchors` 元素形态补该可选字段。
  已知代价（写入设计而非隐藏）：解析面重切那一页会挪块序，旧锚可能错位 → 界面按 `page`＋摘录回显出处，用户可重挂。
- **C28 提问入口**＝**输入框＋置灰发送按钮**，段 ② 内给出提问输入框，发送按钮 `disabled` 并注明「暂未开放」；
  **零请求**（不接 `/llm/*`，也不接任何业务端点），话术不说「离线」「未就绪」（承 §V2.8）。

**取证事实（决定改动面大小，逐条可复核）**：
- 候选行 `anchors` 可写可读（`backend/qed_engine/api/learn.py:726` `DetailCreateBody.anchors`；
  `_candidate_out` 回读 `anchors`），但元素形态＝`{kind:'book', ref_id, page, snippet}`，**不含块标识**
  （写入侧 `web-ui/src/stores/learnWorkbench.ts:605`）→ 块级过滤要么补锚点字段、要么靠文本匹配。
- 前端已有块选中态 `SelectedBlock{page, index, snippet}`（`web-ui/src/stores/learnWorkbench.ts:41`）与 `selectBlock`，
  中栏 `BlockList.onSelect(index)` 给出的就是**页内块序**（`web-ui/src/components/parsing/BlockList.tsx:37`）
  → 块级匹配的最省路径不需要解析面改动。
- 生成端点 `POST /annotations/generate` 的 `target_kind` 闭集＝`(point, chapter)`（`learn.py:1158` 前声明），**无块粒度**；
  只改展示层则后端零改动，改块级生成则要扩闭集并动取材窗口。
- `qe_learn_unit_progress` 仅 `unit_id / learn_course_id / status / updated_at` 四列（`backend/qed_engine/services/learn/base.py:62`），
  **无处存备注文本** → 备注落点必须三选一：复用候选池并打标（零 DDL）／新建表（生产 `qed` 库建表属红线，需窗口与批准）／
  仅本机 `localStorage`（不跨设备）。

**W11 实施面清单（四点裁决落地；1~8 已于 2026-10-17 界面批落码，2026-10-18 用户裁决「现形态认定达成」）**：

1. **段题与栏名**：右栏标题「注解」→「学习交流」；`§V2.8` 必含／禁现词表随步改（旧推进与批注六短语进禁现表）。
2. **段 ① 本章总结与学习要点**：现 `components/learning/ChapterNotePane.tsx` 口径不动（进场直读、缺失才生成）。
3. **段 ② 详解（块级）**：`AnnotationPane.tsx` 的列表过滤从「整条全列」改「**选中块的 page＋block_index 命中**」，
   并把「LLM 提问」输入框（置灰发送＋「暂未开放」）放本段末。
   - **生成行的归属（本设计按最小惊喜定档，如不对请改判）**：按需生成腿产出的行是**条级**（无单块归属），
     故本段＝「本块的」在前 ＋「本条通用」（`anchors` 为空或缺 `block_index`）在后并标注；
     未点块时本段只显「本条通用」那批，并提示「点正文中的一块可看这一块的总结与注解」。
4. **段 ③ 备注**：`AnnotationForm.tsx` 改备注形态——去掉「知识点名／四分类」两列（候选池 `name` 列必填，
   由正文首行截断自动填，不再让用户填），写入打标 `payload.kind='note'`＋`gen_batch='learn-note'`＋`gen_status='draft'`；
   「保留为候选」字样与四分类选择器下线。
5. **锚点补块序**：`stores/learnWorkbench.ts:605` 与 `api/learn.ts` 的 `KpAnchor` 类型增可选 `block_index`；
   `BlockList` 的 `onSelect(index)` 已是页内块序，`SelectedBlock.index` 直接带上——**后端零改动**
   （`anchors` 是 JSON 扩展槽，写入白名单已开放 `anchors`）。
6. **推进换位置**：`AdvancePane.tsx` 从右栏摘除；中栏正文流**末尾**渲染三枚按钮（上一条／下一条／已掌握并下一条，
   同条再点「已掌握」＝撤销回 `pending`），沿用 `POST …/progress`；`skipped` 与「回到断点」「跳过本条」界面下线。
7. **契约与文档随步**：`api-contracts.md` 的 `anchors` 元素形态行补 `block_index`（可选字段），
   `POST /learn/kp-details` 行补「学习面备注走 `gen_status=draft`＋`payload.kind=note`，不作提升来源」；
   `design/frontend/frontend-overview.md:78` 课程学习行按三段口径回写（W6 晋升时全量进正本）。
8. **守护与门禁**：`LearnWorkbench.test.tsx` 新增／改口径（段题、块级过滤、末尾三枚、备注打标、提问零请求）；
   `learnPlaneCopy.test.tsx` 必含／禁现词表随步；`tests/test_web.py` 两枚互指守护继续绿；
   前端 `tsc -b` → vitest 串行 → `npm run build`，根侧 `pytest tests` ＋ `ruff`；
   **真机按 `qed-frontend-check` 新第 5 条做 1600／1200／860 三档实测并记文本左缘与按钮名单**。
9. **仍挂在本轮之外的**：W6 晋升（§V2 全量进 `design/frontend/learning-course-ui.md`）；REQ-105／REQ-070-LEARN 联动关闭；
   生成腿与点赞腿成功路径取证（待 8900 重启）；复验残留 `kpd-122bd665e6ad` 处置；
   LLM 提问的**后端功能腿**（本轮只做入口，属后续批）。

> **达成认定（用户 2026-10-18 裁决）**：「W11 现形态认定达成，除了 LLM 之外的完成即可」——上列 1~8 的现形态
> 即验收形态，第 9 条的四项（尤其 **LLM 提问后端功能腿**与**生成／点赞两腿真机取证**）**不作为 W11 达成前置**，
> 各自留挂原行；取证与门禁输出见「过程与证据」2026-10-18 条。


## 遗留与移交（2026-10-18 收口批写实）

> 本壳已按 Achieved 关闭，本节只登记留挂项的**归属去处**，不构成本行判据；
> 台账行 S1~S5 无遗留尾（判据逐条达成见「关闭与归档」节），下列七项均属达成形态之外的后续工作。

| # | 遗留项 | 归属去处 | 依据锚 |
| --- | --- | --- | --- |
| 1 | LLM 提问的**后端功能腿**（本轮有意零请求，右栏段 ② 只放输入框＋置灰发送） | ARCH-027 主链 M-2 生成管线与 M-3 判分掌握门 | 用户 2026-10-18 裁决「W11 现形态认定达成，除了 LLM 之外的完成即可」；§V2.12 实施面清单第 9 条 |
| 2 | 生成腿与点赞腿**成功路径的真机取证**（运行中 8900 为旧进程无此两端点，待重启后复跑），同批复验残留候选行 `kpd-122bd665e6ad` 的处置 | 同上（随 M-2/M-3 线的重启批一起做） | 「过程与证据」W9 条与 2026-10-18 条 |
| 3 | 知识点**生产腿**（候选确认入库）与目录**人工修正腿**（`TocConfirmPanel` 已从学习面摘除，`tocParse.ts` 因进场自动定位仍在消费而保留） | REQ-116 文档分析处理面（其 W2~W4 未完） | C14／B6、用户 2026-10-17 与 2026-10-18 令、§V2.7 迁移行 |
| 4 | 教材卡书级「简介／面向对象」**两列事实源** | REQ-121（待 QED-Tracker 回执；落地后由 `POST /learn/courses/sync` 改读书级列、套级降为兜底） | C10、REQ-121 壳 R1~R5 |
| 5 | `design/tech-stack.md` 两行「原生前端无构建／框架化评估延后」**陈旧正文**（本批只改链接未改正文） | 该文档治理面，走设计类小修通道 | 「关闭与归档」段 2026-10-18 条 |
| 6 | 课后练习面页头缺「刷新」、与三面三件套不一致 | REQ-130（2026-10-18 新立行，其 W7 承接本条） | §V2.10「另登记」条 |
| 7 | 详设正本 `learning-course-ui.md` 确认状态＝**暂定** | 待人工评审转正（不占本行判据） | ADR 0017 确认状态口径、S5 晋升条 |
