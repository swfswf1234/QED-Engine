# 学习中心·课后练习独立面设计稿（learning-practice-ui）

状态：Completed
任务类型：B
最后更新：2026-10-14
关联 ADR：`../../adr/v0.1/0011-pending-design-location.md`（本稿为待晋升设计，评审确认后整篇迁 `design/`）、`../../../adr/0017-design-doc-structure-contract.md`（设计本体骨架与事实源唯一铁律）、`../../../adr/0020-task-closure-cadence-and-thin-registration.md`（达成即收）
关联设计：`../../../design/learning-practice-ui.md`（本壳「设计本体」晋升后的唯一正本，确认状态＝暂定）、`../../../design/parsing-ui.md`（§9.1 版式＝题面渲染复用基线）、`../../../architecture/frontend-architecture.md`、`../../../architecture/api-contracts.md`（练习域 8 端点契约事实源）、`../../../architecture/database-design.md`（练习三表结构事实源）、`../../../standards/doc-governance.md`
关联 Tracker：docs/trackers/todo.md（REQ-106 登记）
归档判定：Retain（评审晋升后本壳归档 history/plans/，设计本体迁 design/）

## 目标与成功标准

**目标**：把练习与复习语义（题源抽取→人工确认入库→作答判分→到期复习→错题本）从三栏
工作台拆出，设计为**独立面 `#/practice`** 的完整界面——首页「课后练习」卡直达，复习入口
（原星图悬停计数与课程知识点页按钮）落位本面，作为 REQ-106 开发轮唯一设计事实源。

**成功标准正本在台账行**（ADR 0023）：逐条对照 todo.md `REQ-106` 行「成功标准」列，本壳
不复制判据。

## 范围与非目标

**范围**：本壳承载设计稿 C 全文（见「设计本体」节）＋开发工作项登记；晋升目标文件
`design/learning-practice-ui.md`（R1 已裁＝learning-* 族，路由 `#/practice`）。
**非目标**：不动代码（实施归 REQ-106）；**不改服务端练习域契约**（8 端点、三表、判分与
调度语义保持冻结，本面纯消费）；不做 v2 两段式生成出题（裁决冻结另立任务行）；不做模型
批改展示（open 题只按关键词判分回显 `judge_note`）；不复制判分阈值与间隔序列进前端。

## 前置条件

1. 用户裁决 ③（课后练习同步设计独立面）与裁决 ④（星图面移除复习跳转——入口落位改由本面
   承载）。
2. 回收稿 `learning-workbench-ui.md`（现 `../2026-10/learning-workbench-ui.md`）
   §8/§8.1/§9 三节＋对应降级行与约束条目迁入本稿；M2 已关闭，抽取纯函数、四组件与三表
   实现在位。
3. B 稿（课程学习）同步移除工作台练习区——两稿互斥对拍，不双写。**2026-10-14 对拍补记**：该
   移出已在当前工作树实施（未提交，属 REQ-105 W2 在飞改动），故本稿 W3 是「在 `#/practice`
   新建挂载」而非「自工作台迁移」。

## 工作项

| 条目 | 内容 | 状态 |
| --- | --- | --- |
| W1 | 新增路由 `#/practice`（App.tsx，R1 已裁）与练习面页壳（课程选择器＋今日面板＋题源工作区），导航只连 8900 | 已完成（2026-10-14） |
| W2 | 首页「课后练习」卡开放：href `#/practice`，移除「建设中，将在后续轮次开放」占位（`Home.tsx`＋`Home.test.tsx` 同步） | 已完成（2026-10-14） |
| W3 | 练习面**新建挂载**：页壳 `pages/Practice.tsx` 挂 `PracticePane`/`ExerciseConfirmPanel`/`QuestionCard`/`ChapterPractice`，`stores/practice.ts` 归属练习面（2026-10-14 对拍：四组件在当前工作树已零挂载，移出属 REQ-105 W2 在飞改动，本项非迁移；组件头注释「右栏本章练习」随之改） | 已完成（2026-10-14） |
| W4 | 复习入口承接侧：本面「今日到期 N」按 R5 用**单请求** `max_tasks=100` 同给计数与队列；移除侧（星图悬停段、课程知识点页按钮）已随 REQ-104 W2/W3/W4 落地，本轮只做承接＋死代码处置——`stores/practice.ts:refreshCourseDueCounts`（原星图跨课程 `max_tasks=1` 聚合）唯一调用方已删 | 已完成（2026-10-14） |
| W5 | 回归：`exerciseParse.test.ts` / `stores/practice.test.ts` / 四组件用例随挂载点与「课级全量」口径改判（先红后绿）；端到端冒烟（b05 页 45–47 抽取→入库 2 题→作答→队列→错题本）；前端门禁 + 浏览器实测 | 已完成（2026-10-14，实测证据见「过程与证据」） |
| W6 | 同步已确认文档 `docs/architecture/frontend-architecture.md` 信息架构节（R6 已裁＝由本行承载）：只新增 `#/practice` 路由行＋删工作台「中栏练习区＋右栏本章练习」描述；**:67/:68 星图与课程知识点页两行属 REQ-104 面、`#/learn*` 两行属 B 稿 W7**，本行不重复改（2026-10-14 与 B 稿 W7 分工对拍，避免双写） | 已完成（2026-10-14） |
| W7 | 规格指针收口：`exerciseParse.ts` 头部 docstring 的「规格正本」现指归档壳 `practice-review.md`，本档晋升后改指本档（或 design/ 新档） | 已完成（2026-10-14，暂指本壳 §7，晋升后随 W8 改指 design/ 新档） |
| W8 | 晋升收口面：新建 `design/learning-practice-ui.md`（确认状态＝暂定）、`design/index.md` 学习中心节加行与「部分置空」叙述改写、契约白名单 `test_design_documents.py` 同步、`frontend-architecture.md`/代码 docstring/台账指针改指 design/ 新档并压缩二次维护 | 已完成（2026-10-14） |

## 过程与证据

- **2026-10-11**：按裁决 ①③④ 起草：回收稿 §8（中栏练习区）、§8.1（`exerciseParse.ts` 抽取
  规格）、§9（作答/复习队列/错题本）整体迁入本稿「设计本体」§4~§6，挂载容器由「工作台
  中栏/右栏」改「`#/practice` 独立面分区」；星图稿的复习入口段（悬停追加行＋课程知识点页
  页头按钮＋聚合失败降级行）迁入本稿 §6 并改为面内计数口径。取证：M2 关闭记录（completed.md
  ARCH-027-M2 行）＝端到端唯一通路 b05 页 45–47、真机 29 草稿→入库 2 题、DEFECT-012/013
  文案与持久行语义为 W3/W5 必守回归基线。
- **2026-10-14（评审对拍轮）**：按用户授权对稿面做事实校正并补 W6/W7。取证（均指当前工作树）：
  `AnswerSource`/`ANSWER_SOURCES` 仍含 `llm`（`exerciseParse.ts:10`、`services/learn/practice.py:37`），
  只有面板过滤（`ExerciseConfirmPanel.tsx:31`）；`max_tasks` 默认 5 而 `total_due` 为截断前全量
  （`api/learn.py:1157-1172`）；`parsed_pages` 服务端回传、前端叠加（`learn.py:1019-1047`、
  `practice.ts:186`）；`PRACTICE_GEN_BATCH`＝`workbench-extract`（`practice.ts:29`）；客户端本章过滤
  双条件（`practice.ts:146-148,297-299`）；`EXTRACT_MAX_PAGES` 落 `practice.ts:26`；`classifyAnswer`
  未导出（`exerciseParse.ts:230`）；四组件零挂载而 HEAD 77ca2f5 仍挂载（`git diff HEAD` 显示
  `LearnWorkbench.tsx` 移出属在飞未提交）；`refreshCourseDueCounts` 死代码（`practice.ts:343`）。
  用户裁决：R2＝课级全量＋`kp_id` 标签、R5＝单请求 `max_tasks=100`、R6＝架构文档漂移由本行承载；
  R1/R3/R4/R7 四项当时仍待定，未答项未按建议值默认采纳。
- **2026-10-14（裁决轮）**：R1/R3/R4/R7 由用户裁定并写回稿面——R1＝learning-* 前缀族＋路由
  `#/practice`（连带：A 稿建议名 `knowledge-point-exploration-ui.md` 不同族，由 REQ-104 壳自行处置，
  本行不改他稿）；R3＝同屏两段（`ChapterPractice.tsx:139/150` 现状形态，不加 Tabs）；R4＝保留
  「最近判分持久行」原语义（todo 行 S4 判据不改判）；R7＝`gen_batch` 保持 `workbench-extract`。
  至此 R1~R7 全部有裁定结果，新增 W8（晋升收口面），W6 按与 B 稿 W7 的分工缩窄为「只动 `#/practice`
  新行与工作台练习描述」。同时纠误：对拍轮与 R2/R5/R6 的裁决日期原误记为 2026-10-11，实为 2026-10-14。
- **2026-10-14（实施轮 W1~W7，代码＋架构文档）**：按用户「开始执行」授权落地。
  - 实现要点：`stores/practice.ts` 课级化（删 `kpId`/`courseDueCounts`/`refreshCourseDueCounts`，
    新增 `totalDue` 与导出的 `REVIEW_QUEUE_MAX_TASKS = 100`，三张面在单 `loadCourse` 内并行取）；页壳
    `pages/Practice.tsx` 以 URL `?course=` 为课程层级唯一事实源（沿用 REQ-110 `#/knowledge` 判例），
    选择器选项值＝`LearnCourse.course_ref.ref_id`（共享课程目录坐标，无该坐标的学习课程不进选项），
    8900 不可达走顶部「练习数据不可达」告警＋`重试`（`key={reloadKey}` 整块重挂，不重复调 effect）。
  - 实现口径三处（与稿面措辞的差异，均为收敛不改语义）：① 稿 §3「今日面板一行计数」与 §6 错题本
    头部计数**合并为一行** `今日到期 N／错题 M 未解决（共 K）`，避免同屏两处重复计数；② 队列尾行
    触发条件写作 `totalDue > dueTasks.length`（比 §3 的 `total_due > 100` 更诚实——服务端上限截断是
    唯一截断来源，按实差显示）；③ W7 原只点名 `exerciseParse.ts`，本轮把同样持有归档壳指针的
    `ExerciseConfirmPanel.tsx:4` 一并改指本壳 §7。
  - 前端门禁：`npx tsc -b` exit 0；`npx vitest run --no-file-parallelism` → **Test Files 63 passed /
    Tests 748 passed**（串行才可信）；`npm run build` 成功并刷新 dist（8903 托管产物）。
  - 浏览器实测（8903，REQ-106 黄金路径全过）：未选课＝两分区「先选一门课」且零请求；
    `#/practice?course=math_analysis` 渲染 `今日到期 3／错题 1 未解决（共 2）`＋到期复习（3，含
    `知识点复习（memory·档 0）`／`错题优先·超期 5 天`／`类型档·超期 4 天`）＋错题本（1，人工位齐）＋
    `本课题（2）` 两行均带 `归属 kp-2c3381aecb74` 标签；题源下拉仅 `数学分析原理（textbook）`
    （`parsed_pages > 0` 前端过滤生效）；页 45–47 抽取＝29 草稿／可入库 1 → `确认入库` POST 载荷实测含
    `"kp_id":null`、`"gen_batch":"workbench-extract"`（R2／R7 证据），回执 `入库 0 题（跳重 1）`＝
    `(course_id, stem_hash)` 幂等；页 48–53 抽取均「可入库 0」（纯证明题转闪卡缺背文，符合 §7 规格）；
    作答提交 → `最近判分：判错·趋势 declined` 持久行（R4）＋错题计数 1→2 写后重取一致；28 条请求
    **全部**指向 `127.0.0.1:8900`、状态全 200，`list_console_messages` 无报错；首页「课后练习」卡点击后
    `location.hash` ＝ `#/practice`。
  - 未尽与限制：① 内嵌浏览器 viewport 0x0（`visibilityState=hidden`）致 `take_screenshot` 不可用，
    视觉证据以 DOM 文本快照＋网络清单留存；② 「新入库题不带归属标签」的渲染分支因跳重未产生新行，
    浏览器侧只证到 POST 载荷 `kp_id: null`，空标签渲染由 `PracticePane.test.tsx` 用例覆盖；
    ③ 本轮未执行任何 git 提交（用户未要求，改动全部留在工作树）。
  - 遗留（不改，属他稿分工）：`frontend-architecture.md:70` 工作台行仍写「右栏 Tab 随模式换面板」，
    该措辞归 B 稿（REQ-105）W7；:67／:68 星图与课程知识点页两行归 REQ-104 面。
- **2026-10-14（晋升轮 W8）**：按用户指令「先晋升课后练习对应的文档到 design/，写明暂定，
  并把相关描述与约定收束到这一个文档」执行，三面同批晋升的 1011 裁决据此**部分改判**（只晋
  练习面，REQ-104/105 两面仍留 plans/ 待晋升）。
  - 晋升前取证（入口唯一性）：`web-ui/src` 全域 grep `/practice` 与「练习｜复习」——写点只有
    `pages/Home.tsx:36`（`href: '/practice'`）与 `App.tsx:37`（路由注册）两处，其余为注释与断言；
    守护面 `Knowledge.tsx:29`／`CourseKnowledge.test.tsx:118`／`LearnWorkbench.test.tsx:396`／
    `StarMapGraph.test.ts:174` 全部断言「无跨面出口、零练习组件」，故入口唯一为**被测事实**非约定。
  - 顺带纠的两处陈旧文案：`help/sections.ts:15`「课后练习（建设中，随后续轮次开放）」→ 独立面
    实际能力；`components/practice/QuestionCard.tsx:2`「M2 Batch B 中栏练习面」→ `#/practice` 最小
    作答单元（三来源共用）。
  - 收束面：新档 `docs/design/learning-practice-ui.md` 承载 §1~§9 全部设计态正文（本壳「设计本体」
    节去过程化改写——剥 R1~R7 与「对拍/现状基座」叙述，判例 DEFECT-012/013、BUGFIX-011 保留为
    指针式引用）；§7 抽取纯函数 8 条规格升为**唯一正本**，`exerciseParse.ts:3`、
    `ExerciseConfirmPanel.tsx:4` 的「规格正本」指针由本壳改指新档，`pages/Practice.tsx` 补设计指针；
    `frontend-architecture.md` `#/practice` 条目从 9 行压缩为 4 行（只留路由与分区一句话，端点与
    计数细节撤出，按 ADR 0017 铁律改指 design/），:70 的练习面指针同批改指。
  - 元数据取值：`设计状态：Accepted`、`实现状态：In Progress`（代码已交付并浏览器实测，人工评审
    与转正待发）、`确认状态：暂定`（用户明令，本档是 design/ 内首份暂定稿）。
  - 治理连锁：W8 达成 → G3「达成即收」强制本壳转终态（`状态：Completed`）→ 归档 `history/plans/2026-10/`
    （壳内出链按三级深度重算）→ `design/index.md` 学习中心节加行＋「部分置空」叙述改写 →
    `test_design_documents.py` 白名单加本档 → todo REQ-106 行按台账契约移入 `completed.md`（原 6 列
    搬迁＋关闭结果 Achieved），`plans/index.md` 补已归档行，`project-status.md` 条目改写为已晋升态。
  - 门禁：契约 / 全量 pytest / ruff / tsc / vitest 串行 / build 复跑，数字见提交前的收尾汇报。

## 验证与验收

- 设计自查：设计本体含 ADR 0017 骨架五类节；无端点表/DDL/阈值复制（消费语义指针化）。
- 互斥对拍：本稿不含三栏/批注/目录解析正文；B 稿不含练习/复习/错题承载节。
- 开发轮验收判据见 REQ-106 行；晋升以用户评审裁定为准。

## 回滚

纯文档：删除本壳与 todo REQ-106 行即可回到回收前状态（回收整体回滚见承载壳「回滚」节）。

## 关闭与归档

**关闭裁决＝2026-10-14 用户指令「晋升课后练习对应的文档到 design/」**：W1~W8 全部达成
（代码面 W1~W7 见上一条实施轮记录，浏览器黄金路径全链通过；文档面 W8 见晋升轮记录），
按 ADR 0020「达成即收」转 `状态：Completed`。

归档动作＝本壳 **Retain** 归档 `history/plans/2026-10/`（经用户批准执行 `mv`，壳内出链按三级
深度重算）；设计本体晋升正本＝`docs/design/learning-practice-ui.md`（暂定），代码侧「规格正本」
与架构文档指针同批改指该档；todo 的 REQ-106 行移除、原 6 列搬入 `docs/trackers/completed.md`
（关闭结果 Achieved），`docs/plans/index.md` 补「已归档计划（2026-10）」行。

**未收口的下游**（不属本壳判据，转入 todo 既有行）：REQ-104／REQ-105 两面设计稿仍待晋升；
新档「暂定 → 已确认」由人工评审处置；v2 两段式生成出题另立任务行。

---

## 设计本体（晋升前原稿快照）

> 2026-10-14 已按用户指令晋升为 `../../../design/learning-practice-ui.md`（确认状态＝暂定），
> 该档是现行唯一正本；本节保留晋升前原稿，历史资料不覆盖当前实现（ADR 0017）。

### 1. 定位与目标

本文档是「学习中心·课后练习」（`#/practice`）的 **UI 设计事实源**：独立练习面的信息分区、
课程选择、题源选择→抽取预览→人工确认入库管线、题卡作答与判分回显、闪卡自评、到期复习
队列、错题本人工位、面内复习计数与降级表现。

它回答的是「学习者如何把一本书里的现成习题抽成题、答完即判、按节律回流复习，并把错题
管在自己的工位里」——这一切发生在**独立面**，不再依附于课程学习工作台（裁决 ③）。

- **服务对象**：学习者本人；首页「课后练习」卡是唯一上游入口。
- **成功标准**：① 首页卡一点即达，选课即可开工，无需先进工作台；② 题只从书里来：抽取
  只出草稿、人工确认才入库、题面响应不含判分依据、无答案题自动转闪卡自评；③ 到期复习
  与错题本随课可见，人工位只改本人工位不改判分事实；④ 判分/阈值/间隔零前端复制（只消费
  服务端结论字段）；⑤ 8900 或练习存储不可达时逐分区降级不白屏；⑥ 星图与知识点页无复习
  出口后，本面「今日到期」计数成为唯一复习入口。

### 2. 范围与非目标

- **本档管**：`#/practice` 分区信息面与交互、题源选择与抽取/确认/入库口径、抽取纯函数
  规格、作答与判分回显、闪卡自评文案、到期队列与错题本呈现、面内复习计数、空态与降级矩阵。
- **本档不管**（事实源改指）：端点形状/错误码→api-contracts.md 练习域节；三表结构→
  database-design.md；**判分阈值与复习间隔序列取值**（choice/short/open 三型阈值、`kp_type`
  五档间隔）→服务端事实源（`services/learn/grading.py`、`services/learn/practice.py`）与契约行，
  UI 只消费 `is_correct/method/score_trend/review`，不在界面复制任何阈值；题面公式渲染基线→
  parsing-ui.md §9.1（同一套 `BlockList`/KaTeX 防御，BUGFIX-011）；课程学习与批注→课程学习
  设计稿；知识点探索→知识点探索设计稿。
- **非目标**：不出题（v1 题源＝书里现成习题；v2 两段式生成另批实施，届时只替换题源侧，
  确认面板与题卡面不变）；不做主观题模型批改展示；不建独立错题表/错题页中台（错题本＝
  读时派生）；不做跨课程合并队列（按课选择）；不改服务端契约。

### 3. 页面信息面与导航

| 分区 | 内容 | 口径 |
| --- | --- | --- |
| 页头 | 大标题「学习中心·课后练习」＋课程选择器（`GET /learn/courses` 同源）＋`返回` | 返回回 `#/`；未选课各分区给「先选一门课」空态 |
| 今日面板 | 一行计数「今日到期 N」＋到期复习队列（§6）| **一次请求** `GET /learn/review/due?course=&max_tasks=100` 同时给两值：`total_due`（服务端截断前的全量到期数）给 N，`tasks` 给队列；`total_due>100` 时队列尾行给「另有 N 条到期未列，做完本批再看」；**N=0 仍渲染面板**（显示「今天没有到期」），这是复习入口移除星图后的唯一落位 |
| 题源工作区 | 题源书＋页范围＋题解配对书 → `抽取题目` → 抽取预览与确认面板（§4） | 归属＝**课级**（R2 已裁）：本面无章/节选择器，入库 `kp_id` 只作可选标注，留空即课级归属 |
| 本课题卡 | **本课题列表（课级全量）** → `QuestionCard` 作答与判分回显（§5） | 列表不传 `kp`、不做客户端过滤；每题 `kp_id` 只作归属标签展示（R2 已裁）；列表响应不含判分依据（投影硬边界） |
| 错题本 | 派生行＋人工位（收藏/标记解决/重做本题）（§6） | 与到期队列**同屏两段**（R3 已裁＝现状形态），不新开路由、不加 Tabs |

- 视觉上沿用 8903 全局浅色主题；页面为读写界面，不做暗色化。
- **面间零跳转**：不放「去学这本书正文」类按钮（与裁决 ④ 对称，防再耦合）；用户自行经
  首页切换三面。

### 4. 题源选择 → 抽取预览 → 人工确认入库

题源＝**书里现成的习题**（教材课后题或已下载习题集），整条链路不引模型：前端纯函数抽取
（§7）→确认面板人工复核→服务端批量入库。渲染基线（公式回原样、`$$$` 双定界符防御）与
课程学习面正文同一套。

- **题源书**：列表来自 `GET /learn/question-books?course=`——服务端按 `roles` 命中与课程归属过滤并
  **回传** `parsed_pages`（＝已解析出产物的页数）；「可选题源」判定由本面再叠加 `parsed_pages>0`，
  属**前端过滤、契约不变**——未解析书逐页必 404，选了也抽不出题，不进选项；选项文案
  ＝`书名（角色）`（如 `数学习题集（exercises）`）；为空 placeholder＝`本课暂无已解析的题源书`。
  **课程归属在服务端定**：书库行 `course_id` 空时回退解析表同列（现网书库行该列全空，
  2026-10-07 真机核验），前端不按书号前缀猜课。`source_kind` 由角色推出（exercises→
  `exercise_book`、textbook→`textbook_chapter`、solutions→`solutions_book`、其余→`manual`），
  不由用户手选。
- **页范围**：`抽取起页`/`抽取止页`，输入过程保留本地（store 只在两值齐备视为合法，显示值取
  本地位）。校验＝整数、起 ≥1、止 ≥起、跨度 ≤`EXTRACT_MAX_PAGES`（40 页）；非法**不发任何
  请求**，提示 `页范围不合法（需选择题源书，起止页齐备、不倒挂且不超过 40 页）`。
- **逐页取块**：按页号顺序逐页 `GET /books/{id}/pages/{n}`（经 8900）。404＝跳过并计入提示
  （`第 N 页无解析产物（跳过）`）；非 404 失败终止整次抽取并 `notice`，草稿与预览清空。
- **题解配对书（可选）**：另一本书＋自己的页范围，选项**排除当前题源书**；配对后按题号建
  答案索引喂抽取，答案来源标 `sibling_book`，入库 `source_ref.answer_book_ref` 记配对书。
  系统不自动猜配对（`qt_knowledge` 的 `textbook_ref/exercise_ref` 不作 UI 默认值），人工手选。
- **抽取只出草稿**：`抽取题目`后进预览卡（`抽取预览（人工确认后入库）`），**无自动入库路径**。
- **确认面板**（`ExerciseConfirmPanel`）逐题一行卡：题面（可改）、选项（只读＋`去掉选项`，
  选项不完整时转简答/闪卡）、`题型`（quiz/flashcard）、`作答形态`（choice/short/open）、
  `答案来源`（`same_page`/`solution_section`/`sibling_book`/`manual`/`none` 五值可选；`llm` 仍在
  类型与服务端闭集里，但**选择面把它滤掉**，界面不出现该值，见 §9）、
  评分依据（判分题，同步切关键词）、背文（闪卡）。头部一行 `草稿 N 题，可入库 M 题（不合格的
  不提交）`，不合格行缺项红字（缺题面/缺评分依据/缺背文/`none` 非闪卡/缺关键词/选项不完整）。
- **入库**：`确认入库` 只提交**零缺项**草稿 → `POST /learn/questions`，整批带 `course_id`、
  `gen_batch=workbench-extract`（沿用 M2 历史批次标识，**不随面改名**，R7 已裁；存量题行不迁移）、
  `kp_id`＝可选归属节点（留空＝课级，R2 已裁）、`book_ref`
  与 `source_kind`＝题源书、`kp_type` 快照。服务端按 `(course_id, stem_hash)` 跳重，回执
  `入库 N 题（跳重 M）`；写后整体重取本课题、队列与错题本（不乐观更新）。全部不合格
  **不发请求**，提示 `没有可入库的题（每题需题面 + 判分依据或闪卡背文，请补齐或删除）`。
- **面板侧校验与服务端同口径**（`draftIssues` 镜像 `_question_invariant_error`）：题面必填、
  quiz 必须有评分依据、flashcard 必须有背文、`answer_source=none` 只能 flashcard、open 必须
  有关键词、choice 必须有完整 `A-D` 选项——一批不因单题拖整批 422。
- **判分依据不在题面里**：题列表与复习队列响应不含 `expected_answer/keywords/explanation`；
  面板上「评分依据」是用户自填草稿值非服务端回读；只有提交作答后的响应才回传判分依据。

### 5. 作答、判分回显与闪卡自评

- **题卡**（`QuestionCard`）＝本课题、到期项与错题重做**同一组件**，三种来源标记
  （`new`/`review`/`manual`）。choice 出单选、short/open 出文本框（题面或答案为空提交禁用）；
  提交 → `POST /learn/attempts` → **就地展开判分结果**（`判对/判错`、`判分方式`、`趋势`、
  `judge_note`、`评分依据`、`解析` 走 Markdown＋KaTeX），不跳页不清空题面。
- **flashcard 面**＝卡片翻转＋自评：`翻开背文` → `记得`/`重来` → 同一端点带 `self_result`
  （`method=self`，无判分），`review_date` 由到期任务带入保证同键唯一（重复提交 409 按状态
  冲突提示）。
- **结果文案按口径分两套（徽章词承载语义，DEFECT-012 裁决）**：判分题结果卡标题＝`判对`/
  `判错`；闪卡自评＝`已记住`/`未记住`，**不套用对错措辞**——自评是记忆态确认非答对答错。
  两套都同行显示 `判分方式`、`趋势`、`judge_note`；自评行不显示 `评分依据`/`解析`。
- **最近判分持久行（DEFECT-013 裁决，R4 已裁＝保留原语义）**：面内汇总行除 `到期 N／错题 M 未解决（共 K）` 外，
  最近一次作答或自评后追加 `最近判分：〈口径〉·趋势 〈trend〉`（口径四值：`自评已记住`/
  `自评未记住`/`判对`/`判错`）。原因＝写后重取使题卡整体卸载、卡内反馈随之消失；该行事实源
  是 store 最近一次作答响应，刷新/切课不清，仅页面卸载消失；只回显结论，不把 `expected_answer`
  写进列表响应（投影硬边界不变）。

### 6. 到期复习队列与错题本

- **到期复习（N）**：`GET /learn/review/due?course=&max_tasks=100`——一次请求同时给 `total_due`
  与队列（R5 已裁；`max_tasks` 服务端上限 100）；原「按本章过滤」（端点无 `kp` 参数，用
  `target_id`/题行 `kp_id` 客户端过滤）按 R2 裁决**整体删除**，本面按课全量＋每题 `kp_id`
  归属标签展示。题粒度项直接给题卡（带 `错题优先/类型档` 标签与 `超期 N 天`）；知识点粒度
  项只给文字卡（`知识点复习（类型·档 x）`），无题可答不硬造。
- **错题本（N）**：`GET /learn/mistakes?course=` 的派生行（端点支持 `kp`，本面按 R2 不传）：
  趋势标签（首答/进步/退步/持平）、`答错 w/a 次`、`今日到期`、上次作答原文；人工位
  `收藏`/`标记解决` 走 `PATCH /learn/attempts/{id}`，
  `重做本题` 就地展开同题卡（`origin=manual`）。头部一行 `到期 N／错题 M 未解决（共 K）`，
  `刷新` 重取三张面。
- **人工位只改本人工位**：`bookmarked`/`resolved` 不进判分事务、不改判分事实；错题本不是
  独立表、不是独立页。
- **复习计数入口唯一化（裁决 ④ 承接）**：星图悬停段与课程知识点页页头按钮移除后，本课
  `total_due` 只在本面「今日面板」呈现；计数不落前端缓存，切课即重取；聚合失败按 0 显示
  「今天没有到期」不弹错。

### 7. 抽取纯函数规格（`exerciseParse.ts`）

与目录解析同级：**规格与纯函数一一对应**，夹具走真实页块文本，改动先改本档。本档晋升后本节即
抽取规格的**唯一正本**（晋升后由 `design/learning-practice-ui.md` §7 承接，代码 docstring 已同批改指）。页范围上限常量 `EXTRACT_MAX_PAGES`（40）落在
调用侧 `stores/practice.ts` 而非纯函数模块；规格不变，常量不搬。

1. **块归一**（`exerciseBlocksOf`）：`formula`→`latex`、`table`→`html`、`list`→`items` 拼行，
   其余取 `text`；按 `(page, index)` 升序。
2. **块类型分流**：`header`/`footer`/`page_number` 不进题面，落未识别清单（`excluded`）；
   `image`/`table` 记**附件**（题面保留引用、置信 −0.15），无当前题可挂落 `no-anchor`；
   `formula` 按 KaTeX 安全形态包裹并入当前题干，无锚点同样 `no-anchor`。
3. **题号锚**：`^\d+(\.\d+)?$` 后紧跟顿号/点/右括号或空格才算新题起始；题号只作分组与答案
   配对键，不进题面正文；锚前行归并当前题（续行、多段）。
4. **章节标题切换答案区**：短行/heading 命中答案节标题（`答案与提示/参考答案/习题答案/
   解答与提示/solutions`）⇒进答案区，之后带题号行按题号累积**书内答案索引**（拆不出题号
   落 `answer-orphan`）；命中习题节标题（`习题/练习/课后题/补充题/problems/exercises`）⇒退出。
5. **答案来源优先级**：同页答案引导（`答案/解答/答/解/提示：`）→书内答案节索引
   （`solution_section`）→题解配对书索引（`sibling_book`）；三处无配⇒`none`。置信度按来源
   降序（manual 1 / same_page 0.95 / solution_section 0.85 / sibling_book 0.6 / none 0.3），
   随 `meta.confidence` 入库。
6. **按答案形态定型**（`classifyAnswer`）：有选项且能定 `A-D` 单字母⇒choice；有选项定不出
   字母⇒回落 flashcard（背文＝答案原文）；无选项且答案 ≤30 字不含句读⇒short；可切 ≥2
   关键词⇒open（关键词 ≤6）；其余⇒flashcard。**`none` 无答案题一律 flashcard**（M2 裁决 ⑨：
   不阻塞入库走自评；人工补答案后 `PATCH` 升级 quiz）。
7. **`kp_type` 默认 `memory`**（调用方可覆盖），入库快照进题行供复习调度取序列；UI 不重算间隔。
8. **未识别行不静默丢弃**：三类原因（`excluded`/`no-anchor`/`answer-orphan`）逐条列面位置与
   页号，面板头部 `未识别 N 行` 汇总。

### 8. 状态与降级矩阵

| 场景 | 用户可见表现 | 口径 |
| --- | --- | --- |
| 数据正常 | 今日面板＋题源工作区＋本课题卡＋错题本齐备 | — |
| 未选课程 | 各分区「先选一门课」空态 | 队列/计数按课聚合，无课不请求 |
| 8900 不可达 | 顶部「练习数据不可达」告警＋`重试`，各分区空态 | 不白屏，不影响其他页 |
| 本课无题源书 | 选择器 placeholder＝`本课暂无已解析的题源书`，`抽取题目` 禁用 | `roles` 空或 `parsed_pages=0` 不可选 |
| 页范围缺失/倒挂/超 40 页 | 提示「页范围不合法…」 | **不发任何请求**，不整书兜底 |
| 抽取区间某页无产物 | 提示「第 N 页无解析产物（跳过）」，其余照常 | 404 不算错误 |
| 抽取中途页失败（非 404） | `notice` 给原因，预览清空 | 不用半截块列表出草稿 |
| 抽取零题 | 预览卡不出现 | 不显示空壳面板，不自动入库 |
| 草稿全部缺项 | 提示「没有可入库的题…」，按钮禁用 | 不发请求，避免整批 422 |
| 入库部分跳重 | 回执 `入库 N 题（跳重 M）` | 跳重是幂等结果不算失败 |
| 练习存储未接入（503） | 分区 `notice` 给原因，其余面照常 | 三表懒挂载不牵连（判例 DEFECT-009） |
| 本课无题 | 空态「还没有题，先从题源书抽取并确认入库」 | 与「无到期项」分开表述 |
| 无到期项 / 无错题 | 「今天没有到期」「还没有错题」两段独立 | 不整体隐藏 |
| 重复提交同一到期作答（409） | 状态冲突提示，题卡保留 | 唯一键在服务端，前端不预检 |
| 到期计数聚合失败 | 今日面板按 0 显示，不弹错 | 复习入口唯一化后失败静默 |
| 题面公式为老代 `$$…$$` 产物 | KaTeX 正常渲染（`unwrapMathDelimiters` 防御） | BUGFIX-011 基线随迁 |

### 9. 已知约束与维护规则

- 8903 只连 8900（ADR 0007）：题源书、页块、作答、队列全经 8900。
- **题面与判分依据分离（前端侧硬边界）**：题列表、复习队列与练习卡响应不含 `expected_answer/
  keywords/explanation`，只在提交作答后的响应展开；不得为显示答案另开读面。判分阈值与间隔
  序列不在前端复制。
- **抽取页数纪律**：单次按页范围逐页取块，跨度上限 40 页；不全书扫描、不缓存整书块文本，
  题解配对书同受上限。
- **写后重取**：入库、作答、人工位三处写后一律重取本课题/队列/错题本，不乐观更新。
- **抽取规格与纯函数同源**：§7 与 `exerciseParse.ts` 一一对应，改动先改本档再改码，
  `exerciseParse.test.ts`（习题页/答案节实测文本）夹具与不变量同步。
- **自评与判分两套文案是硬边界**（DEFECT-012 语义）：`method=self` 永不显示「判对/判错」。
- **`llm` 只从界面消失，不从契约消失**：`AnswerSource` 与服务端 `ANSWER_SOURCES` 闭集保留 `llm`
  （不改契约），确认面板与抽取产物一律不产出该值——v1 绝不由模型作答；v2 生成出题落地时
  先改本档再动码。
- **面间零跳转**：本面不放通往星图/工作台的操作按钮（与裁决 ④ 对称）。
- **批次标识不改值**：`PRACTICE_GEN_BATCH` 恒为 `workbench-extract`（带索引的核销数据键，改值会
  造成同一管线两值并存）；独立面不重命名它。
- **不加 Tabs**：到期队列与错题本同屏两段是 R3 裁定的形态，改版面须先改本档（1011「右栏无 Tabs」
  裁决的精神在本面延续）。
- 改本档触发条件：分区信息面、抽取/入库口径、作答回显、队列与错题本呈现、降级变化→先改档；
  纯样式微调随码走。
- 端点与表结构不在本档复制：形状变化只改 api-contracts / database-design。

### 现状基座（实施对账用）

- 已实现（M2 关闭事实）：`web-ui/src/exerciseParse.ts`（纯函数切题＋`draftIssues`；`classifyAnswer`
  与题号锚、答案节标题白名单是模块私有项，**未 export**）、
  `components/practice/PracticePane.tsx`/`ExerciseConfirmPanel.tsx`/`QuestionCard.tsx`/
  `ChapterPractice.tsx`、`stores/practice.ts`、`api/learn.ts` 练习域调用；
  服务端练习域 8 端点与三表（`qed_learn_question`/`attempt`/`review_task`）冻结于契约；
  端到端唯一通路＝b05 页 45–47（真机 29 草稿→入库 2 题）。
- 对拍基准＝**当前工作树**（并行会话在飞、未提交）：四练习组件在本树已**无任何挂载点**
  （`App.tsx`/`pages/`/`LearnWorkbench.tsx` 零引用），练习能力经 UI 完全不可达；HEAD 77ca2f5 仍
  在工作台挂载，「练习区移出」属 REQ-105 W2 的在飞改动，本行不重复实施。
- 移除侧已落地（REQ-104 W2/W3/W4 标已完成）：星图悬停复习段、课程知识点页页头按钮、
  `practice.ts` 星图侧引用与 `StarMapGraph` 的 `dueCounts` 形参都已删；连带
  `refreshCourseDueCounts`（唯一调用方随移除消失）现为**死代码**，处置落 W4。
- 待改造点（＝W1~W8）：新增 `#/practice` 路由与页壳（新建挂载，非迁移）；`Home.tsx` 课后练习
  卡 href 与占位分支；「本章过滤」按 R2 整体删除；计数与队列按 R5 合为单请求；`gen_batch` 按 R7
  保持 `workbench-extract` 不改值；`frontend-architecture.md` 信息架构节同步（W6）；
  `exerciseParse.ts` 规格指针改指（W7）；晋升批次文档收口（W8）。
- 回收来源：`design/learning-workbench-ui.md` §8/§8.1/§9（2026-10-11 回收，现
  `../2026-10/learning-workbench-ui.md`）＋`design/learning-star-map.md` 复习入口段。

### 评审点与裁决（R1~R7 已全部裁定，晋升待用户「开始执行」指令）

- R1：晋升 design/ 文件名与路由名——**已裁（2026-10-14）＝learning-* 前缀族 + 路由 `#/practice`**
  （本档→`design/learning-practice-ui.md`，B 稿→`design/learning-course-ui.md`）。**连带影响**：A 稿现建议名
  `knowledge-point-exploration-ui.md` 无前缀，与本裁不同族，须由 REQ-104 壳自行改指（本行不改他稿）。晋升
  形态还须按 ADR 0017 把本节 h3 编号节改为「h1 文档标题＋h2 阿拉伯编号节」，并补 `design/index.md` 登记行
  与契约白名单（W8）。
- R2：练习归属粒度——**已裁（2026-10-14）＝课级全量＋题行 `kp_id` 标签**：题列表、到期队列、
  错题本一律不传 `kp`，客户端「按本章过滤」整体删除；入库 `kp_id` 是可选标注，留空＝课级归属。
- R3：到期队列与错题本的版面形态——**已裁（2026-10-14）＝同屏两段**（即 `ChapterPractice.tsx:139/150`
  现状形态，零结构改动、不加 Tabs）。
- R4：闪卡/重做等写后反馈——**已裁（2026-10-14）＝保留「最近判分持久行」原语义**（DEFECT-013 判例：
  写后重取卸载题卡，该行是唯一常驻反馈；todo 行 S4 判据因此不需改判）。
- R5：到期队列条数——**已裁（2026-10-14）＝一次请求 `max_tasks=100`**（服务端上限）：同一响应给
  `total_due` 与队列，不叠第二次请求；`total_due>100` 时队列尾行给「另有 N 条到期未列」。
- R6：`frontend-architecture.md` 信息架构节的拆分前旧口径（星图复习聚合、课程知识点页复习按钮、
  工作台练习区，且无 `#/practice` 路由行）——**已裁（2026-10-14）＝由本行 REQ-106 承载**，落 W6。
- R7：`gen_batch` 取值——**已裁（2026-10-14）＝保持现值 `workbench-extract`**，稿面与 §9 同步写定；
  理由：该列带索引 `idx_question_batch`、DDL 注释「整批可核销」（`services/learn/practice.py:82,92`），
  属数据键而非展示串，改值会留下两值并存并牵动 6 处测试夹具；存量不迁移，无回填数据窗口。
