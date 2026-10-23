# 学习中心·知识点探索界面设计稿（knowledge-point-exploration-ui）

状态：Completed
关闭结果：Achieved（行 S1~S5 逐条达成并留证；设计本体 2026-10-15 晋升 design/knowledge-point-exploration-ui.md，人工验收批通过）
任务类型：B
最后更新：2026-10-15
关联 ADR：`../../../history/adr/v0.1/0011-pending-design-location.md`（本稿为待晋升设计，评审确认后整篇迁 `design/`）、`../../../adr/0017-design-doc-structure-contract.md`（设计本体骨架与事实源唯一铁律）、`../../../adr/0020-task-closure-cadence-and-thin-registration.md`（达成即收）
关联设计：`../../../architecture/frontend-architecture.md`（8903 信息架构与视觉 token）、`../../../architecture/api-contracts.md`（学习域端点契约事实源）、`../../../architecture/database-design.md`（知识点两表结构事实源）、`../../../standards/doc-governance.md`（design/ 三态与晋升规则）
关联 Tracker：docs/trackers/todo.md（REQ-104 登记，收口后移入 completed.md）；本稿设计本体已于 2026-10-15 晋升 `../../../design/knowledge-point-exploration-ui.md`——REQ-110 单页化、REQ-111 课程层关系星图、REQ-113 大小知识点虚框、REQ-114 outline 摘要通道多轮改判口径的设计事实源由此移交该档，本壳只留过程与对账
归档判定：Retain（评审晋升后本壳归档 history/plans/，设计本体迁 design/）

## 目标与成功标准

**目标**：把「学习中心 · 知识梳理星图」改造为**知识点探索独立面**的完整设计——星图页与
课程知识点页只承载知识点体系的浏览与下钻，移除全部通往学习／练习界面的跨界出口，作为
REQ-104 开发轮的唯一设计事实源。

**成功标准正本在台账行**（ADR 0023）：逐条对照 todo.md `REQ-104` 行「成功标准」列，本壳
不复制判据。

## 范围与非目标

**范围**：本壳承载设计稿 A 全文（见「设计本体」节）＋开发工作项登记；晋升目标文件为
`design/knowledge-point-exploration-ui.md`（晋升文件名以用户评审为准）。
**非目标**：不动任何代码（实施归 REQ-104）；不写星图布局算法变更（版式与图元口径沿用
回收稿既有设计）；不设计知识点候选池挖掘/生成链路（未立项）。

## 前置条件

1. 用户裁决 ④（2026-10-11，见承载壳 `2026-09-10-learning-center-current-state.md`）＝
   星图面全部移除跨界跳转。
2. 回收稿 `learning-star-map.md`（原 design/，现 `learning-star-map.md`）
   正文可整篇承接；M5/M6 已关闭，星图与课程知识点页实现与测试在位。
3. 复习入口落点由设计稿 C 承接（2026-10-14 已晋升 `docs/design/learning-practice-ui.md`），两稿不得双写。

## 工作项

| 条目 | 内容 | 状态 |
| --- | --- | --- |
| W1 | 页面总标题改「学习中心·知识点探索」（页头大标题、使用手册节名、路由文档同步） | 已完成（2026-10-11） |
| W2 | 星图课程框悬停提示移除「今日复习 K 条」段及 `GET /learn/review/due` 聚合调用 | 已完成（2026-10-11） |
| W3 | 课程知识点页移除页头「今日复习 N 条」按钮与「进入学习工作台」按钮（无出口化） | 已完成（2026-10-11） |
| W4 | 降级矩阵删复习聚合行；`stores/practice.ts` 在星图侧的引用随之摘除 | 已完成（2026-10-11） |
| W5 | 回归：`Knowledge.test.tsx` / `CourseKnowledge.test.tsx` / `starMap.test.ts` 断言改口径（先红后绿），前端门禁 + 浏览器实测 | 已完成（2026-10-15，人工验收通过） |
| W6 | 首页联动：Hero 删除「学习中心仍在建设中：功能随数据管线逐步开放，入口已就位。」一行（用户裁决＝知识探索现已开放；其余两卡「建设中」点击提示随 REQ-105/106 消解，本轮不动） | 已完成（2026-10-11） |
| W7 | 8900 端点小改：`GET /learn/courses/{id}/knowledge-points` 的 course 对象补吐课程介绍字段（`qed_course.description` 透传；契约变化随收尾同步 api-contracts.md） | 已完成（2026-10-11，真机复验通过） |
| W8 | 课程知识点页改造＝层级关系图页：大标题统一「学习中心·知识点探索」＋课程名＋介绍；主体＝章(depth1)→节(depth2)→知识点(`parent_kp_id`)布局纯函数图（`include_outline=true` 取全层级，`order_hint` 定序，未归档 point 挂「未归档」组）；移除待选池/手工登记/统计行/轨迹 Tag/同名词候选抽屉；空数据置空态 | 已完成（2026-10-11） |
| W9 | 二批回归：`kpTreeLayout` 纯函数单测 + `CourseKnowledge.test.tsx` / `Home.test.tsx` / 后端定向先红后绿，全门禁 + 浏览器实测 | 已完成（2026-10-15，人工验收通过） |

## 过程与证据

- **2026-10-11**：按裁决 ①②④ 自 `design/learning-star-map.md` 回收改写：§定位改名目、
  §交互与§课程知识点页移除复习入口与工作台跳转（原 §8 悬停追加段、§9 页头按钮段、
  §10 聚合失败行），其余版式／坐标系／图元／背景层口径原样承接；跨界出口去向挂
  REQ-105/106 两稿，不双写。取证：`web-ui/src/pages/Knowledge.tsx:25`（悬停复习计数）、
  `web-ui/src/pages/CourseKnowledge.tsx:81,94-95`（两处跨界按钮）为 W2/W3 改造点。
- **2026-10-11 实施轮开工（用户批复「没有问题可以先进行改造」）**：待评审点处置＝按稿执行
  （R2 取「返回知识点探索」、R3 手册节名同步认可，均已随 W1/W3 落地；R1 晋升文件名留
  评审晋升时定）。W1~W4 代码落地：`Knowledge.tsx` 标题改「学习中心·知识点探索」＋
  practice store 引用与 review/due 聚合移除；`CourseKnowledge.tsx` 页头只留
  「返回知识点探索」；`StarMapGraph.tsx` `dueCounts` 形参与复习段整体删除（store 侧
  `refreshCourseDueCounts` 本体保留归 REQ-106）；`help/sections.ts` 节名与返回句同步；
  注释指针四处（App.tsx 路由一览、knowledge.css、starMap/starMapLayout/learn/HelpModal 头，
  `starMapLayout.ts` 设计指针改指本稿设计本体）。LearnWorkbench「返回星图」与书架
  「知识星图」按边界归 REQ-105 未动。
- **2026-10-11 W5 取证**：TDD 先红（改断言后定向 6 failed）→ 实现后定向 29 绿 →
  web-ui 全量 vitest 串行 58 文件 624 用例全绿 → `tsc -b` exit=0 → `npm run build` 绿 →
  浏览器实测（8903+8900 真机）：`#/knowledge` 标题/三枚页头按钮/无复习文案/
  `review/due` 请求 0 次、`star-map` 1 次；手册弹窗节名「知识点探索」无残留旧名；
  `#/knowledge/c/complex_analysis` 页头仅「返回知识点探索」、跨界按钮 0、`review/due` 0；
  控制台无报错，网络全指 8900/8903 无 4xx/5xx（ADR 0007 无直连）。根侧：契约 82 passed、
  全量 pytest 737 passed、ruff All checks passed。留人工验收。
- **2026-10-11 人工验收二审（用户改判＋范围扩充，承载并入本行）**：① 页面命名改判＝知识
  探索两页大标题统一「学习中心·知识点探索」，用户否决「知识探索·知识点星图／知识点列表」
  前缀方案与列表形态（原 R2/R3 随之已裁：返回文案维持「返回知识点探索」、手册节名维持
  「知识点探索」）；② 首页现状经解释后裁决＝只删 Hero「学习中心仍在建设中…」一行，
  **不在首页增设领域面**（领域多展示已由星图页左上下拉承载，数据源 `GET /learn/star-map`
  一次全域），三卡其余不动；③ 课程下钻页改判为**层级关系图**（非列表）：只留知识点结构，
  待选池/手工登记/统计行/轨迹 Tag/同名词候选抽屉整体移出（写操作归工作台批注闭环）；
  ④ 可行性取证（真机 8900）：`?include_outline=true` 返回 math_analysis 96 行，
  `node_kind/depth/parent_kp_id/order_hint/summary/type` 列齐；`qed_course.description`
  列存在（shared_tables 直读 SELECT 在列），8900 端点 course 对象现仅吐
  `course_id/name/track/domain_id`＝W7 改造点；知识点之间无关系数据（先修 DAG 只在课程
  级），故图只画层级边，网状关系归 GraphRAG（未立项）。
- **2026-10-11 二批实施（W6~W9，用户批复「先同步更新设计稿，再落码」）**：
  - W6＝`Home.tsx` Hero 只删该 `<Paragraph>` 一行（三卡与简介段不动），`Home.test.tsx`
    先红（`queryByText(/学习中心仍在建设中/)` 断言）后绿。
  - W7＝`backend/qed_engine/api/learn.py` `course_knowledge_points` 返回的 course 对象增
    `description`（`str(course.get("description") or "")` 透传）；`tests/test_learn_knowledge.py`
    先红（DEMO_COURSES 补 description＋整 dict 相等断言＋无介绍课程回落空串）后绿（26 passed）。
    **真机生效待 8900 重启**（8900 不热重载；同日重启后复验通过，见本节末尾条目）；重启前的降级表现＝响应无 `description` →
    前端不显介绍段，属 §10「课程介绍缺失」设计内行为。
  - W8＝新增布局纯函数 `web-ui/src/components/kpTreeLayout.ts`（列＝距根深度、行＝DFS 叶槽
    ＋父居中、定序 `order_hint`→名称码点→kp_id、未归档伪节点承接 `parent_kp_id` 空/悬空的
    point、同输入同图）＋渲染层 `KpTreeGraph.tsx`（ECharts graph `layout:'none'`、浅色画布、
    四类节点配色、悬停提示＝名称＋四分类＋摘要＋来源锚数、边只有层级边）；`EChart.tsx`
    增 `width` 入参以固定图元内在尺寸（外层 `.kn-tree-scroll` 滚动）；
    `stores/courseKnowledge.ts` 瘦身＝只读（`include_outline=true` 取全层级，删
    loose/candidateTotal/notice 与 confirm/reject/add 写面；写接口仍留 `api/learn.ts`
    供工作台消费）；`CourseKnowledge.tsx` 整页重写为图页（唯一页头按钮「返回知识点探索」、
    大标题统一、《课程名》＋介绍、空态「该课程暂无已确认知识点」）；`knowledge.css`
    清死规则并加 `.kn-tree-scroll`；`help/sections.ts` 课程页描述改图口径；
    `App.test.tsx` 陈旧断言（旧 `h3 知识点梳理`）改判为大标题口径。
  - W9 门禁取证：`kpTreeLayout.test.ts` 6 绿（含确定性/悬空归属/空输入/tooltip 字段）、
    `KpTreeGraph.test.ts` 3 绿、store 测试重写 3 绿、页面测试重写 6 绿。web-ui 全量 vitest
    串行 `Test Files 1 failed | 60 passed (61)；Tests 5 failed | 657 passed (662)`——失败
    5 例全在并行窗口在途的 `src/components/PaperExploreModal.test.tsx`（非本轮文件，
    不修不提交）；本轮作用域文件全绿。`npx tsc -b` exit=0、`npm run build` 绿（8903 读盘 dist）。
    根侧全量 pytest `3 failed, 734 passed` + 契约门禁 `3 failed, 79 passed`；三红逐条归因并行
    轮次（本轮壳与行均未被标记）：① `test_active_plans_have_complete_metadata_and_sections`
    与 ② `test_active_plans_carry_a_dated_process_log_section` 均指向未跟踪壳
    `2026-10-11-paper-ui-implementation.md`（REQ-108 论文线在途；②＝缺 `## 过程与证据`＝G7，
    ①＝其台账行状态非枚举）；③ `test_todo_plan_rows_exactly_mirror_active_plan_bodies` 的
    越枚举行全属他轮（REQ-091/092/096、OPS-001/002、REQ-031、DEFECT-007/009、
    ARCH-037~041 待验收＝普通任务轮/运行产物轮/1005 控制台轮；REQ-108 行）。本轮
    REQ-104/105/106 三行与三份壳的状态字段均为枚举值；`ruff` All checks passed。
  - 浏览器实测（真机 8903 + 8900，evaluate_script 取证；隐藏 viewport 下截图与指针交互不可用）：
    `#/` Hero 文案全文无「学习中心仍在建设中」，大标题/简介/三卡照常；
    `#/knowledge` 大标题「 学习中心·知识点探索」＋领域下拉在位、资源请求仅
    `/api/v1/learn/star-map` 1 次（`review/due` 0 次）；
    `#/knowledge/c/math_analysis`＝h2 大标题 + h4《数学分析》+ 页头按钮仅
    「返回知识点探索」1 枚 + ECharts canvas 已绘制（内在尺寸 640×4956，采样到章节/知识点
    配色像素），请求仅 `/learn/courses/math_analysis/knowledge-points?include_outline=true`
    1 次（`/kp-details` 0 次＝零写面），真机数据 96 行（outline 95 = 章 9／节 86，point 1）；
    `#/knowledge/c/complex_analysis`＝大标题＋《复变函数》＋空态「该课程暂无已确认知识点」，
    canvas 0、无错误告警；控制台无任何报错。节点悬停 tooltip 因隐藏 viewport 无法指针驱动，
    其形态由 `KpTreeGraph.test.ts` 断言覆盖（留人工验收项）。
  - **2026-10-11 W7 真机复验（用户重启 8900 后）**：`GET /learn/courses/math_analysis/knowledge-points?include_outline=true`
    的 course 对象已含 `description`（数学分析长介绍原文返回，`points` 仍 96 行）；
    `#/knowledge/c/math_analysis` 页面《数学分析》下方介绍段实际渲染（`h4` 后继段落文案
    与库值逐字一致），页头按钮仍仅「返回知识点探索」1 枚，请求仍仅该 1 次
    （`/kp-details` 0 次），canvas 640×4956，控制台无报错。
  - **2026-10-11 交接前终版门禁复跑**：契约 `82 passed`（先前归因并行轮次的三红已由该窗口
    自行修掉）→ 根侧全量 `737 passed`、`ruff` All checks passed；web-ui 全量 vitest 串行
    `Test Files 3 failed | 61 passed (64)；Tests 19 failed | 673 passed (692)`——19 红逐条只落在
    `LearnShelf.test.tsx`（1，断言「知识星图」按钮已删＝REQ-105 面口径）与
    `LearnWorkbench.test.tsx`（10）/`LearnWorkbenchChain.test.tsx`（8，根因
    `ReferenceError: Tabs is not defined` @ `LearnWorkbench.tsx:280`＝REQ-105 实施轮在途半改）。
    三文件本轮未触碰（`git status` 可见其并行动作），本轮作用域文件（Home / Knowledge /
    CourseKnowledge / KpTreeGraph / kpTreeLayout / stores/courseKnowledge / StarMap* / App）
    全绿；`npx tsc -b` 复跑 exit=0、`npm run build` 绿。
    **交人工验收**；收尾与 R1 晋升待验收裁定。
- **2026-10-11 人工验收三审（用户改判：导航与悬停口径，本轮判据不改、实施另立 REQ-110）**：
  用户指出两处与设计意图不符——① 领域星图课程卡悬停只显「已确认 · 待选」，未显课程名称与
  叙述；② 课程下钻是**另一个页面**（`#/knowledge/c/{id}` 整页路由），而两级应是**同一界面**
  只是展示范围不同。取证定因：`StarMapGraph.tsx:90` 提示串只拼计数行、`:138` formatter 无
  叙述位；`GET /learn/star-map` course 对象本就无 `description`（`api/learn.py:528-575`，
  `api-contracts.md:1020` 同口径），且本稿原 §8/§3 从未要求悬停显叙述——属**设计缺口**而非
  渲染故障。三项裁决（AskUserQuestion）：提示改显课程描述；合并形态＝**单页内替换＋面包屑**；
  台账承载＝开新行（用户选项文本为 REQ-109，该 ID 已被论文线占用，实取 **REQ-110**）。
  本壳的处置：§3/§8/§9/§10/§11 与「现状基座」已按裁决改判落稿（设计事实源仍在本稿，晋升
  随 R1 同批）；**代码实施归 REQ-110** 及其唯一壳
  [2026-10-11-learn-ui-knowledge-single-page.md](2026-10-11-learn-ui-knowledge-single-page.md)，
  不动码以遵守「裁决先落文档、待『开始执行』才动码」。REQ-104 行「成功标准」列逐条复核后
  **不改判据**（S1~S5 与本轮改判无冲突；W8 的「层级关系图」形态判据仍成立，变的是承载页面
  形态），新工作按不扩载原则走新行。新增待裁项 R4（悬停第三行计数保留与否、面包屑中间级
  是否显领域名）。附带发现：`api-contracts.md:1022` knowledge-points 的 course 仍写
  `{course_id,name,track,domain_id}`，未随 W7 补 `description`＝本行 W7 的契约同步欠项，
  三审当日随文档梳理已补齐（现列 `…domain_id,description}`），收口不再留尾。
- **2026-10-11 四审（R4 裁定＋开工发令，实施仍归 REQ-110）**：用户裁「悬停第三行计数**删除**」
  「面包屑中间级**不显示领域名**」，并发「开始执行」。本稿随改：§3 面包屑表行与 bullets 改两级
  「知识点探索 / {课程名}」（领域身份只由下拉承载）、§7 计数行改「不进图也不进提示」、
  §8 提示改两行（课名＋叙述，`description` 空时只一行）、§9 回退口径、§10 两行改判、
  §11 新增两条硬约束（悬停必含叙述且必不含计数段；面包屑不显领域名）。「待评审点」R4 结案，
  仅余 R1 晋升文件名。数据面 `kp_confirmed/kp_candidates` 端点与布局侧**不动**（本面无展示位
  而已，REQ-104 S3 的计数消费不回归）。
- **2026-10-14 五审（用户改判：课程层图元形态，本轮判据不改、实施另立 REQ-111）**：用户现场
  指出课程层下钻后仍是「框图」，而期望是**保持星图状态的关系星图**——「当进入课程内知识点时，
  还是要保持星图状态，不需要框图，需要的也是关系星图，将鼠标放上去就是知识点介绍，关系线鼠标
  放上去也是介绍，左上角没有拉框而只是显示该课程名称」。四项裁决（AskUserQuestion）：课程层
  几何＝**分层阶梯（左→右）**（沿用 `kpTreeLayout` 现有行列坐标，只换视觉）；节点图元＝
  **发光圆点＋名称标签**（章＝大点带光环／节＝中点／知识点＝小点，画面不出现方框）；关系线
  悬停＝**一句归属说明**；导航＝**左上只显《课程名》＋保留面包屑**（领域下拉只属领域层）。
  本稿随改：§1 成功标准加 ⑩、§3「面包屑下」与「主体·课程层」两表行改写＋手册口径补节点/
  关系线悬停、§8 增「本表只述领域层」分工句、§9 整节由「层级关系图（浅色画布）」改判为
  「关系星图（暗底同层、圆点＋标签＋层级线）」、§10 三行改判（数据正常双视图、介绍缺失、
  新增节点字段缺失降级行）、§11 三条（暗色层无浅色卡、下拉只属领域层＋新增同一星图语汇硬
  约束、布局分工补 `kpTreeLayout`/`KpTreeGraph`）、「现状基座」新增 REQ-111 改造点清单；
  待评审点新增 **R5**（章／节节点悬停字段拟定），R4 括注补五审改判半句。四审裁定的
  「领域身份归下拉承载」由此收窄为「下拉只属领域层」。REQ-104/110 两行「成功标准」列
  **均不改判据**（新工作按不扩载走新行）；**代码实施归 REQ-111** 及其唯一壳
  [2026-10-14-learn-ui-course-star-graph.md](2026-10-14-learn-ui-course-star-graph.md)，
  本轮只落文档，不动码以遵守「裁决先落文档、待『开始执行』才动码」。

- **2026-10-15 六审（学习面信息面与取景收窄，实施并入 REQ-111 壳 W6~W8）**：用户现场三条＝背景应复用
  星空层（取证确认已成立，无需改）、**树只占页面 1/3 且平移后超出部分不见**（根因 `KpTreeGraph.tsx`
  `kpTreeCanvas()` 把画布钉成 `max(640, layout.width + 300)`，三列≈900px）、**来源锚等编辑侧信息不得给
  学习者**。细化裁决（AskUserQuestion 两轮）＝图元圆点＋连线／宽度跟随容器＋可缩放／悬停名称＋摘要／
  承载在 REQ-111 壳内重写；未归档知识点不进学习面／高度内在＋纵向滚动／**标签只章＋节常驻**／列距按容器
  宽等分铺满。本稿随改 §1 ⑪、§3、§8、§9、§10、§11、现状基座、待评审点（R5 结案）。
- **2026-10-15 七审（课程层版式重读＝大知识点虚框＋框内小知识点条目，实施另立 REQ-113）**：用户原话＝
  「章、节只是范例，不过章可以看作是大知识点……像矩阵这样的大知识点下面有矩阵乘法、矩阵计算等等具体的
  小知识点在大知识点下……可以继续像星图（领域）一样展示，不过是按照学习顺序从上往下而已，而大知识点是
  虚框，鼠标放上去是大知识点信息，小知识点也是同理」，并要求「现在开始探索，我们重新再整理，一步到位」。
  四项裁决（AskUserQuestion）＝**章＝虚框、节＝框内条目**／定序＝**`order_hint` 优先＋来源锚页序兜底**／
  大知识点悬停信息＝**先补后端 summary 通道**（另立 REQ-114）／承载＝**另开新行新壳，REQ-111 按现状收口
  归档**（用户选项文本为 REQ-112，该 ID 已被 `2026-10-14-dev-process-evolution-round.md` 占用，实取
  **REQ-113／REQ-114**）。本稿随改：§9 整节重写（两级知识粒度、框纵向堆叠＋框内行优先网格、
  **层级关系线与「悬停关系线＝一句归属说明」语义作废**、标签常驻两层、悬停三类、`ResizeObserver`
  须覆盖课程层）、§1 ⑩⑪、§3 主体行与手册口径、§8 分工句、§10 三行、§11 四条、现状基座两条、
  待评审点新增 **R6**（是否把顺序号画出来，本轮不实现）。**六审的「三列等分铺满／画面不出现方框／
  只章＋节常驻」随七审版式作废**（同日改判链，不并存；六审裁定原文见上一条）。数据可行性
  （真机 8900）：`math_analysis`＝9 章＋86 节＋1 point，outline 行 `order_hint` 1～95 全有值而 `summary`
  恒空（→ REQ-114），单框最多 21 条（→框内折行网格），`point.order_hint` 恒 NULL（→页序兜底）。

- **2026-10-15 八审（四任务合并与执行令，AskUserQuestion 四项裁决）**：用户令本轮范围＝
  「知识点探索模块的开发和前端展示：REQ-104、REQ-110、REQ-113、REQ-114 四个任务，设计并准备好，
  后续作为一个 design/ 设计文档进行晋升」。四项裁决＝① 摘要录入面＝**暂不做**（新缺口 R7 留痕，
  REQ-114 判据不改、只开后端通道；现网 outline 摘要填充率 0%，学习面按 §10 只显名称降级）；
  ② 执行顺序＝**先 REQ-114 再 REQ-113**（后端通道小且独立，前端悬停一次到位不返工）并明确发令动码；
  ③ 晋升时机＝**实施＋真机验收后整篇晋升**为 design/ 单一文件（四行合一份），本壳「关闭与归档」
  节新增晋升连锁三处；④ R6＝**不画学习顺序号**。附带处置：REQ-111 壳按用户批准已 Retain 归档
  `2026-10-14-learn-ui-course-star-graph.md`（三处回链与本稿指针同步改深度，
  `docs/plans/index.md` 加归档行），契约门禁复跑 **82 passed**；本壳「待评审点」清理掉一处
  上轮脚本落稿引入的 R4/R2-R3 重复段，§11 六审硬约束措辞按七审形态对齐（章／节只显名称 →
  虚框与条目皆名称＋摘要），§3/§11 的「整树」措辞改「任一框与条目」。

- **2026-10-15 收口批（四行合一份晋升＋人工验收批通过）**：用户令本轮范围＝REQ-104／110／113／114 四任务「设计并准备好，后续作为一个 design/ 设计文档进行晋升」，八审四项裁决＝执行顺序先 REQ-114 再 REQ-113、摘要录入面暂不做、晋升时机＝实施＋真机验收后整篇晋升、R6 不画序号。本壳「关闭与归档」节 ①②③ 三处同批落地：① 设计本体 §1~§11 去过程化晋升 [../../../design/knowledge-point-exploration-ui.md](../../../design/frontend/knowledge-point-exploration-ui.md)（R1 结案＝落 design/ 根、文件名取建议值），本壳随之摘除设计正文、只留过程与对账（ADR 0017 事实源唯一铁律）；② `design/index.md` 学习中心位加行＋契约白名单 `CURRENT_DOCUMENTS` 同步，`frontend-architecture.md` 路由行、`learning-practice-ui.md` 事实源指针、三处源码 docstring 的规格正本指针全改指 design/ 新档；③ 四行同批收口归档。
  **S1~S5 逐条对照**：S1 跨界出口清零（W2/W3＝`review/due` 请求 0 次、「进入学习工作台」按钮 0 枚；页面形态后经 REQ-110 改判为单页 `#/knowledge?course=`，独立课程页路由已删，「无跨界出口」判据实质不变）；S2 总标题「学习中心·知识点探索」两视图一致＋首页「知识探索」卡可达（W1/W6，`App.test.tsx`／`Home.test.tsx` 断言）；S3 星图布局／下钻／知识点计数消费无回归（M5/M6 既有用例 `starMapLayout.test.ts`、`StarMapGraph.test.ts`、`stores/starMap.test.ts` 绿，`kp_confirmed`／`kp_candidates` 数据面保留）；S4 请求全指 8900＋前端门禁＋浏览器实测（W5/W9 取证，ADR 0007 无直连）；S5 设计稿评审晋升＝本批达成。W5/W9 的「待人工验收」经用户 2026-10-15 现场判定通过（原话「没有问题，人工验收通过，现在可以继续」，验收对象含 REQ-110 同页化与七审课程层现行形态）。门禁批证：web-ui 全量串行 63 files／760 tests、`tsc -b` exit=0、`npm run build` 绿；根侧 `pytest tests` 742 passed、`ruff check backend tests` 全绿、`pytest tests/contract` 全绿。本壳按 Retain 归档 ``。

## 验证与验收

- 设计自查：设计本体含 ADR 0017 骨架五类节；全文无端点表/DDL 复制（事实源指针化）。
- 互斥对拍：本稿不再出现「今日复习」「进入学习工作台」字样（回收稿历史版本除外）。
- 开发轮验收判据见 REQ-104 行；晋升以用户评审裁定为准。

## 回滚

纯文档：删除本壳与 todo REQ-104 行即可回到回收前状态（回收动作整体回滚见承载壳「回滚」节）。

## 关闭与归档

**四行合一份晋升（八审裁决 2026-10-15＝实施＋真机验收后整篇晋升）**：本稿设计本体是
REQ-104（独立面边界）／REQ-110（同页两视图与课程叙述悬停）／REQ-113（课程层大知识点虚框形态）/
REQ-114（outline 摘要写入通道，只影响 §9/§10 的降级行）四行的共同设计事实源，晋升为
`design/` **单一文件**（文件名＝待评审点 R1，建议 `knowledge-point-exploration-ui.md`），
晋升时三处同批：① 设计本体去过程化迁入 design/（裁决过程与取证留在本壳与已归档壳，
design/ 只留设计态正文）；② `design/index.md` 加行＋契约白名单同步、代码与架构文档的「规格正本」
指针改指 design/ 新档；③ REQ-104 行 S5 随晋升收口、REQ-110/113/114 各行按自身判据收口，
四壳按 `qed-closeout` 判 Retain/Delete 归档。晋升前本稿口径若再改判，仍在本壳落稿不另开设计文件。

关闭条件：REQ-104 开发轮收口且设计稿经用户评审处置（晋升或留改）后，本壳 Retain 归档
`history/plans/2026-10/`（晋升后指针改指 design/ 新档）。

**2026-10-15 已按本条件收口**：晋升达成、四行同批关闭、本壳 Retain 归档。

---

## 设计本体（已晋升）

设计本体 §1~§11 已于 2026-10-15 整篇去过程化晋升 [../../../design/knowledge-point-exploration-ui.md](../../../design/frontend/knowledge-point-exploration-ui.md)（用户裁决＝四行 REQ-104／110／113／114 合一份、落 design/ 根、文件名取 `knowledge-point-exploration-ui.md`）。本壳不再持设计正文（ADR 0017 事实源唯一铁律：同一设计两处正文即漂移）；以下两节是实施对账与裁决过程留痕，只作历史追溯，现行口径以晋升档为准。

## 现状基座（实施对账用·历史留痕）

> 下列「待改造点」清单是各轮立项时的对账依据；REQ-104／110／111／113／114 均已实施完成并收口，本清单不再作待办。

- 已实现（M5/M6 关闭事实）：`web-ui/src/pages/Knowledge.tsx`、`CourseKnowledge.tsx`、
  `components/starMapLayout.ts`（纯函数 16 项 vitest）、`StarMapGraph.tsx`、`EChart.tsx`、
  `HelpModal.tsx`、`stores/starMap.ts`、`api/learn.ts`、`knowledge.css`、`public/starfield.jpg`；
  测试 `starMapLayout.test.ts`、`StarMapGraph.test.ts`、`Knowledge.test.tsx`、
  `CourseKnowledge.test.tsx`、`stores/starMap.test.ts`。
- 待改造点（＝W1~W5，2026-10-11 已落地）：页头标题与手册节名（`Knowledge.tsx:99` 附近）、
  `Knowledge.tsx:25` 复习计数聚合、`CourseKnowledge.tsx:81,94-95` 两处跨界按钮、
  `stores/practice.ts` 星图侧引用。
- 改造点（＝W6~W9，2026-10-11 已落地）：`Home.tsx` Hero「学习中心仍在建设中…」段删除；
  8900 `GET /learn/courses/{id}/knowledge-points` course 对象补 `description`
  （`api/learn.py` `_course_index` 已 spread 全行，只需显式吐出，契约同步 api-contracts）；
  `CourseKnowledge.tsx` 整页重写为层级关系图（新纯函数 `kpTreeLayout.ts`＋ECharts 浅色
  graph＋空态），`stores/courseKnowledge.ts` 瘦身（`include_outline=true` 取全层级、
  移除 loose/confirm/reject/add 写面）、`api/learn.ts` 取数参数与类型同步；
  `help/sections.ts` 知识点探索节课程页描述改图口径。
- 待改造点（＝REQ-110 本轮，三审改判，实施归 `2026-10-11-learn-ui-knowledge-single-page.md`）：
  `App.tsx` 路由去掉 `#/knowledge/c/:courseId` 独立页、`Knowledge.tsx` 内部按 `?course=` 参数
  在星图与 `KpTreeGraph` 之间做主体替换＋面包屑；`CourseKnowledge.tsx` 从「页」降级为「视图」
  （页头与返回按钮随之消失）；`stores/starMap.ts`/`api/learn.ts` 的 star-map 类型补
  `description`；`backend/qed_engine/api/learn.py` `star_map` 的 course 对象补吐 `description`
  （与 W7 同源，零新增查询）；`StarMapGraph.tsx:90,138` 提示串改**两行（课名＋叙述），计数段删除**；`help/sections.ts`
  读图口径补面包屑与悬停叙述。
- 待改造点（＝REQ-111，五审改判 2026-10-14，实施归 `2026-10-14-learn-ui-course-star-graph.md`）：
  `KpTreeGraph.tsx` 图元改发光圆点＋名称标签（章＝大点带光环／节＝中点／知识点＝小点）、画布与
  标签配色改暗底语汇、去方框；`kpTreeLayout.ts` **行列坐标不动**，只补节点半径／色阶与归属文案
  字段（子名＋父名）；关系线悬停（ECharts `edges: {trigger: 'item'}` + tooltip formatter）；
  `Knowledge.tsx` 课程层删领域 `Select` 与浅色卡容器 `.kn-course-card`，改为课程名行＋占满
  内容区的画布；`CourseKnowledge.tsx` 标题行改造（只显一处）；`help/sections.ts` 课程层口径
  改「悬停节点看介绍、悬停线看归属」；测试同步 `KpTreeGraph.test.ts`/`kpTreeLayout.test.ts`/
  `Knowledge.test.tsx`/`CourseKnowledge.test.tsx`。数据面零改动（同一份 `knowledge-points`
  响应、同一套坐标）。
- 待改造点（＝REQ-111 **六审补做** 2026-10-15；其形态项随七审改判作废，宽度与去编辑字段两项由 REQ-113 承接）：
  **内容区实测宽度**（现 `kpTreeCanvas()` 钉成 `max(640, layout.width + 300)`，三列≈900px，正是
  「只占 1/3」根因；`roam` 已开，修在宽度来源不在开关），`aspect` 补偿随实测宽高重算并在容器
  尺寸变化时重放 option；`nodeTooltip()` 删「来源锚 N 个」／四分类／章与节的「层级＝… · 下辖 N 项」，
  知识点只留**名称＋摘要**、章／节只留**名称**；`kpTreeLayout.ts` 的 `anchorCount`／`childCount`
  若无消费方则连同节点字段一并删除（不留死字段）；`help/sections.ts` 课程层两条同步收窄；
  `kpTreeLayout.ts` 删「未归档」伪节点分支与 `KP_UNARCHIVED_ID`、`kind:'unarchived'`，`KpTreeGraph.tsx`
  的 `KIND_LABELS.unarchived`／`KIND_STYLE.unarchived` 同删（学习面唯一消费方即删净）；测试改写＝
  `kpTreeLayout.test.ts`（现断言 `KP_UNARCHIVED_ID→p4`／`→p9`、伪节点末位）与
  `CourseKnowledge.test.tsx`（现 `getByText('未归档')`）改为「无父 point 不进图」的负向断言，
  `KpTreeGraph.test.ts` 加提示字段负向断言（不出现「来源锚」「概念性」「下辖」）＋容器宽度用例。
- 待改造点（＝REQ-113，七审改判 2026-10-15，实施归 `2026-10-15-learn-ui-course-kp-boxmap.md`）：
  `kpTreeLayout.ts` 由「三列阶梯＋归属边」改为「大知识点框纵向堆叠＋框内条目行优先网格」——删边集与
  `ownership`、删 `anchorCount`／`childCount`（六审已裁不进学习面）、删「未归档」伪节点分支与
  `KP_UNARCHIVED_ID`／`kind:'unarchived'`，`KP_COL_W`/`KP_ROW_H` 三列常量换成框几何参数（框宽比例、
  条目格宽×高、折行）；定序改 `order_hint` 优先＋来源锚最小页码兜底（现为 `order_hint`→名称→id）。
  `KpTreeGraph.tsx` 按 §7 轨迹列框画法新增虚框图元（`roundRect`＋dashed＋框内名称带），
  `KIND_STYLE.unarchived` 同删，圆点＋常驻标签只留给框内条目，tooltip 分流由「节点／边」改为
  「大知识点框／条目」；`Knowledge.tsx:55-67` 的 `ResizeObserver` 覆盖课程层（现早退，画布宽钉在
  `max(640, layout.width+300)`＝「只占 1/3」根因）；`help/sections.ts` 课程层两条改「悬停框看大知识点、
  悬停条目看小知识点」；测试同步 `kpTreeLayout.test.ts`／`KpTreeGraph.test.ts`／`CourseKnowledge.test.tsx`
  （去未归档、去归属边的负向断言）。
- 待改造点（＝REQ-114，后端，七审裁决「先补 outline summary 通道」）：`PUT /learn/courses/{ref}/outline`
  现只收 `name/page_start/page_end/children`（`backend/qed_engine/api/learn.py:414-437`），outline 行的
  `summary` 恒 `''`、`type` 恒 NULL（`backend/qed_engine/services/learn/knowledge.py:527`）——须扩
  **可选 `summary`**（上限 1000 字符，超界 422）并落库；`PATCH` 白名单（`knowledge.py:584-586`）补
  `summary`；`GET .../../../knowledge-points?include_outline=true` 把 outline 行的 `summary` 透传（同一响应，
  不新增查询）；`api-contracts.md` 学习域行与 `database-design.md` 字段口径同步；测试
  `tests/test_learn_knowledge.py`。前端消费方＝REQ-113 的悬停摘要。
- 回收来源：`design/learning-star-map.md`（2026-10-11 回收，现
  `learning-star-map.md`）。

## 待评审点（全部结案）

- R1 **已裁（2026-10-15 晋升批）**＝落 `design/` 根、文件名取 `knowledge-point-exploration-ui.md`，四行合一份。
- R6 **已裁（八审 2026-10-15）＝不画序号**：学习顺序只由虚框纵向堆叠与框内网格的行优先次序承载，
  图上不出现顺序号徽章或名称前缀序号。
- （R7 八审 2026-10-15 裁定＝**暂不做摘要录入面**：REQ-114 只开放后端写通道，工作台目录确认面板
  不加摘要输入框；现网 outline 行 `summary` 填充率为 0%，故课程层悬停在通道落地后仍按 §10
  「只显名称」降级，摘要内容的生产（手填／批量生成）另议、不随本轮登行。）
- （R5 曾随 2026-10-15 六审裁定「章／节节点悬停只显名称」；同日七审把 outline 两档重读为
  大知识点／小知识点并裁「先补后端 summary 通道」（REQ-114），悬停口径随之改为**框与条目都带摘要、
  通道未落地前只显名称**；来源锚计数与四分类仍一律不进提示。）
- （R4 已随 2026-10-11 四审裁定：**悬停第三行计数删除**（§7/§8 提示改两行）；**面包屑不显示
  领域名**（§3 改「知识点探索 / {课程名}」两级）。其中「领域身份归下拉切换器承载」半句于
  2026-10-14 五审改判：下拉只属领域层，课程层左上角显示课程名（见 §3/§9）。
- （R2/R3 已随 2026-10-11 二审收口：返回文案与手册节名均维持「知识点探索」；
  「知识探索·知识点星图／知识点列表」前缀方案被二审否决，页名统一
  「学习中心·知识点探索」。）
