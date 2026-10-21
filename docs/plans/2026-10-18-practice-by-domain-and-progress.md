# 学习中心·课后练习面按领域与实际学习进度重组轮（practice-by-domain-and-progress）

状态：Accepted
任务类型：B
最后更新：2026-10-18
关联 ADR：[ADR 0007](../history/adr/v0.1/0007-qed-engine-backend-gateway.md)（前端唯一入口 8900）、
[ADR 0016](../adr/0016-todo-registration-one-task-one-plan.md)（一任务一行一壳）、
[ADR 0017](../adr/0017-design-doc-structure-contract.md)（设计骨架与事实源唯一铁律）、
[ADR 0020](../adr/0020-task-closure-cadence-and-thin-registration.md)（达成即收与薄登记）、
[ADR 0023](../adr/0023-todo-row-carries-scope-and-criteria.md)（成功标准正本在台账行）、
[ADR 0024](../adr/0024-preschema-rebuild-tiers-and-demo-gate.md)（demo 门与范围锁死）
关联设计：[learning-practice-ui.md](../design/frontend/learning-practice-ui.md)（本面现正本，确认状态＝暂定，
本轮的重写对象）、[learning-course-ui.md](../design/frontend/learning-course-ui.md)（学习进度事实源与
站点整体风格的定档方）、[frontend-overview.md](../design/frontend/frontend-overview.md) §3/§4/§5/§6
（两侧分工、文案语气、页面定位与边界铁律）、[api-contracts.md](../architecture/api-contracts.md) §⑥ 学习域、
[database-design.md](../architecture/database-design.md)「QED-Engine 学习表族」节、
[task-lifecycle](../standards/task-lifecycle.md)（demo 门与计划契约）
关联 Tracker：docs/trackers/todo.md（REQ-130 登记，学习设计轮）
归档判定：Retain（重组轮的调研判定表、轴改裁决与真机取证属不可替代过程证据）

> 本壳是课后练习面重组轮的承载壳。**本轮只立项与定范围**：形态分析（参照项目怎么做课后练习）落在 W2，
> 由用户发令后再做；W1 之前不实施任何代码改动。

## 目标与成功标准

**目标**：把课后练习面（`#/practice`）的组织轴从「选一门课 → 该课全量题卡」改为
**「按领域组织 ＋ 跟随学习者实际学习进度」**：练习的选题范围、题卡列表与到期队列由学习者在
课程学习面真正读过的知识点（`qe_learn_unit` 的 point 行勾选态）与其所属领域算出，而不是把整门课的
题库一次性铺出来；同时把该面**对齐站点整体风格**（REQ-117 定档的页头三件套、无进度徽章、
左栏两档左缘、文案净化与降级话术口径），并按参照项目的实践重审「到期复习队列＋错题本」的形态。

**成功标准正本在台账行**（ADR 0023）：逐条对照[任务台账](../trackers/todo.md) `REQ-130` 行的
「成功标准」列（S1~S5），本壳不复制判据条目；各判据的验收手段见「验证与验收」节，执行进展与取证
追加在「过程与证据」节。

## 现状基座（立项时取证的事实，勿凭记忆改写）

| 面 | 现在的轴 | 证据 |
| --- | --- | --- |
| 页头与选择器 | 大标题＋课程选择器＋使用手册＋返回（**缺「刷新」**），选择器值＝共享课程目录坐标 `course_ref.ref_id`，课程列表与工作台同源 `GET /learn/courses`；无该坐标的学习课程不进选项；未选课各分区给「先选一门课」空态且不发请求 | `web-ui/src/pages/Practice.tsx:4-7,93-96`、`docs/design/frontend/learning-practice-ui.md` §3 页头行 |
| 课程层级来源 | URL `?course=` 唯一事实源（与 `#/knowledge` 同判例），store 不另存课程态 | `Practice.tsx:30,54`、设计正本 §3「课程层级唯一事实源」 |
| 题卡列表 | **课级全量**：`GET /learn/questions?course=` 不传 `kp`、不做客户端过滤，每题 `kp_id` 只作归属标签展示 | 设计正本 §3 本课题卡行、`api-contracts.md` 的 `GET /learn/questions` 行 |
| 到期队列与错题本 | `GET /learn/review/due?course=&max_tasks=`（服务端 1..100），与错题本同屏两段，无 Tabs、不新开路由 | `api-contracts.md` 的 `GET /learn/review/due` 行、设计正本 §3/§6 |
| 题源归属 | 课级：面内无章/节选择器，入库 `kp_id` 可选留空；课程归属由服务端定（现网 `qt_books.course_id` 全空，2026-10-07 真机核验） | 设计正本 §3 题源工作区行、§4「课程归属在服务端定」 |
| 明确的既有非目标 | 「不做跨课程合并队列（按课选择）」与「不改服务端练习域契约（端点、三表、判分与调度语义冻结）」 | 设计正本 §2 非目标段 |
| 练习域三表 | `qe_learn_question` / `qe_learn_attempt` / `qe_learn_review_task`（前缀 2026-10 起为 `qe_learn_*`，端点表 `api-contracts.md` §⑥ 为形状事实源） | `backend/qed_engine/services/learn/`、`database-design.md` 学习表族节 |
| 学习进度事实源 | 课程学习面的 point 行推进＝`POST …/progress` 写 `qe_learn_unit_progress`（`status ∈ done/skipped/pending`），派生进度按 point 行计数；练习面目前**不读**该进度 | `docs/design/frontend/learning-course-ui.md` §V2.3 对应正文（REQ-117 归档壳 §V2.3 为裁决沿革） |
| 领域坐标 | 学习课程行带 `domain_ref`/`course_ref`/`direction` 三引用；知识点主表按「领域 → 课程 → 知识点」三层；知识探索面 `#/knowledge` 已按领域组织 | `docs/plans/2026-09-22-learning-design-mainline.md` 表契约段、`docs/design/frontend/knowledge-point-exploration-ui.md` |

**已探明的参照项目**＝`D:\coding\demo_program\DeepTutor`（第三方开源，只读参照、不引入依赖）。
其在主链判定表已有初判三条（L2 确定性判分、L3 间隔复习＋错题双写题库、L6 出题三向位），
本轮 W2 需要把它的**课后练习面用户可见形态**（怎么组织、什么时候给什么题、错题与复习如何在界面上回流）
单独探明成判定表；判据正文见台账行 S1。

## 范围与非目标

**在范围**：练习面的组织轴（领域 ＋ 实际学习进度）、页头与视觉风格与三面统一、题卡列表与到期队列
的取数口径、错题本工位形态、题源归属粒度（是否仍课级）、`#/practice` 手册册（`help/sections.ts`）随步、
必要的服务端读过滤（只加读参数，不动判分与调度语义）、设计正本 `learning-practice-ui.md` 重写与转正、
`learnPlaneCopy` 类文案与风格守护扩到练习面。

**不在范围**：
- **出题**（v1 题源＝书里现成习题不变；LLM 两段式出题属主链 M-2 生成管线，不因本轮改动）；
- **判分规则与间隔序列取值**（`services/learn/grading.py`、`practice.py` 冻结，UI 只消费结论字段）；
- **知识点生产与确认入库腿**（归 REQ-116 文档分析处理面）；
- 课程学习面与知识探索面的形态（只读它们的进度与领域事实，不改它们）；
- 跨项目请求（本轮只根仓库 8900/8903；若调研结论需要 `qt_*` 侧字段，另出请求稿不混入本行）；
- 独立错题表中台（错题本仍读时派生）。

**范围锁死声明**（ADR 0024 决定 3）：本行不扩 S 判据；调研或实施中发现的新想法登新行或并入
普通任务轮，不追加到本行。

## 前置条件

1. 用户 2026-10-18 裁决：课后练习**按领域与实际学习进度**组织、该面需按整体风格调整、
   参照项目调研后段做——本壳即该裁决的立项承载（W1）。
2. 学习进度事实源可用：`#/learn` 书架与工作台已收口（REQ-117 Achieved 2026-10-18），
   point 行勾选态即「实际学过什么」的唯一来源。
3. 练习域端点与三表形状以 `api-contracts.md` §⑥ 为唯一事实源；本轮若需读过滤参数，
   先改契约再落码（`test_api_endpoint_inventory` 双向等值守护）。
4. 调研由 agent 在只读参照仓库执行，不引入依赖、不拷贝代码；判定表经用户评审后才进入 W3。

## 工作项

| 条目 | 内容 | 状态 |
| --- | --- | --- |
| W1 | 立项：本壳 ＋ todo `REQ-130` 镜像行 ＋ 现状基座取证（页头/题卡/队列/错题本/领域坐标五轴逐条带 `file:line` 锚）＋ 参照项目指针登记 | 已完成（2026-10-18） |
| W2 | 参照项目课后练习面调研：在 `D:\coding\demo_program\DeepTutor` 探明其练习面的组织轴（按什么选、给什么题、何时给）、作答与判分回显形态、错题本与到期复习的界面回流、与学习进度的联动关系，逐条出 **吸收／改造／拒绝** 判定与承接工作项，判定表落「过程与证据」节并交用户评审 | 未开始（等用户发令；本轮按要求只立项不分析） |
| W3 | **demo 门**（ADR 0024 决定 2）：核心场景端到端最小可跑＝真机走通「进 `#/practice` → 选一个领域 → 只列该领域内**已学过的**知识点相关题 → 作答即判分回显 → 到期队列与错题本按同口径回流 → 未学过的知识点不在队列里」，全部请求指 8900、无 4xx/5xx，留请求账；到门暂停待人工验收 | 未开始（前置＝W2 判定表评审通过） |
| W4 | 设计正本重写：`learning-practice-ui.md` 按新轴改写（§1 定位、§3 信息面与导航、§6 队列与错题本、§2 非目标段的「不做跨课程合并队列」按裁决处置），风格行与页头三件套随步，元数据与 ADR 0017 五段骨架齐备后经用户评审转正（确认状态 暂定 → 已确认） | 未开始 |
| W5 | 实施批次（TDD 先红后绿）：轴改造（领域选择器 ＋ 按学习进度取数）、页头与视觉风格对齐、题卡与队列口径、手册册随步、`learnPlaneCopy` 类词表与风格守护扩到练习面在册文件；前端门禁（`tsc -b`／vitest 串行／`npm run build`）＋ 根侧契约与全量不回归 | 未开始（前置＝W3 到门且人工验收通过） |
| W6 | 收口与随步：`frontend-architecture.md` 的 `#/practice` 信息架构行按实态改写、`roadmap.md` 前端行措辞随步、`api-contracts.md` 若读参数变化同步、联动关闭登记在本行的风格缺口条目，本壳按归档判定处置 | 未开始 |
| W7 | 承接既有留挂项：REQ-117 归档壳 §V2.10「另登记」条＝练习面页头缺「刷新」与三面三件套不一致（用户 2026-10-18 裁决随本轮改齐，落 W5） | 未开始（判据归 W5，本行只作来源登记，不扩判据） |

## 过程与证据

- **2026-10-18 立项（W1）**：用户裁决「课后练习也挂一个任务——当前只是暂定，而且没有按照整体风格来
  调整；我们的课后练习是按照领域和实际学习进度来的；先看已探明的优秀项目怎么做课后练习，
  先整理确立一个 todo 和 plans/，后面再分析」。据此登记 `REQ-130` 行 ＋ 本壳，**形态分析留在 W2**、
  本轮不动码。现状基座五轴取证自 `web-ui/src/pages/Practice.tsx`（课程选择器 `:93-96`、URL 单一事实源
  `:30,54`、页头 `:4-7`）、`docs/design/frontend/learning-practice-ui.md` §2/§3/§6 与
  `docs/architecture/api-contracts.md` 的 `GET /learn/questions`／`GET /learn/review/due` 行；
  练习域三表实名 `qe_learn_question`／`qe_learn_attempt`／`qe_learn_review_task` 自
  `backend/qed_engine/services/learn/` 代码取证（旧文档中的 `qed_learn_*` 写法属改名前口径）。
  门禁：本轮纯文档，复跑 `pytest tests/contract -q` 与 `pytest tests -q` 并展示输出。

## 验证与验收

- 各判据的验收手段（判据正文见 todo `REQ-130` 行「成功标准」列）：
  S1＝壳内调研判定表（带证据路径）＋ 用户评审记录；S2＝`test_design_documents` 白名单与元数据守护绿、
  新轴正文无过程性措辞；S3＝真机走查（`qed-frontend-check` 三档 1600/1200/860）＋ `list_network_requests`
  全指 8900 且无 4xx/5xx；S4＝`tsc -b` ＋ vitest 串行 ＋ build ＋ 词表与风格守护用例绿；
  S5＝`test_api_endpoint_inventory` 双向等值 ＋ `pytest tests` ＋ `ruff check backend tests`。
- 每批收口：改前端必做真机浏览器实测（不以单元绿冒充真机通过），改契约必先契约测试后落码。
- 本壳随条目增改更新「最后更新」，不要求单次全壳门禁事件。

## 回滚

纯文档轮（W1/W2/W4）：删本壳与 todo `REQ-130` 行即回立项前状态，设计正本改动可从 git 历史恢复原版本。
实施轮（W5）代码回滚按批次独立提交，契约行与设计行同批回滚不留半态；
若真机走查发现取数口径不可用，回到 demo 门形态并登记缺陷，不在本行内扩判据。

## 关闭与归档

关闭条件＝S1~S5 逐条达成并留证、且经用户裁决收口（ADR 0020 达成即收；W3 demo 门到门后暂停待人工验收，
人工验收通过才进 W5）。关闭时 todo `REQ-130` 行原子移出 → `completed.md`（关闭结果 ＋ 逐条证据），
本壳按 Retain 归档 `docs/history/plans/<year-month>/`，`plans/index.md` 随批登记归档条目。
