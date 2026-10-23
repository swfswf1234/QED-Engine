# 学习中心三界面拆分与设计稿轮（原学习功能现状基座）

状态：Completed
关闭结果：Achieved（行 S1~S5 逐条达成：三份设计稿各落 plans/ 一壳并由 REQ-104/105/106 三行镜像、`design/` 两份学习文档回收与全仓引用清扫、跨界口径写入各稿、契约与 ruff 全绿、三份稿经用户评审后按 ADR 0011 处置——C 面 2026-10-14／A 面 2026-10-15／B 面 2026-10-18 由 REQ-117 以 v2 本体晋升，v1 稿按用户 2026-10-15 裁决留改不晋升随壳归档）
任务类型：A
最后更新：2026-10-18
关联 ADR：`../../history/adr/v0.1/0011-pending-design-location.md`（不确定文档暂居 plans/，设计确定后晋升 design/）、`../../adr/0016-todo-registration-one-task-one-plan.md`（一任务一行一壳）、`../../adr/0017-design-doc-structure-contract.md`（设计稿骨架：定位与目标／范围与非目标／设计本体／状态与降级矩阵／已知约束与维护规则）、`../../adr/0023-todo-row-carries-scope-and-criteria.md`（行承载任务描述与固定成功标准）
关联设计：`../../standards/doc-governance.md`（design/ 三态与晋升/回收规则）、`../../architecture/frontend-architecture.md`（学习中心路由与消费面）
关联 Tracker：docs/trackers/completed.md（REQ-070-LEARN 行，2026-10-18 Achieved 关闭并移出 todo；本轮另登记的 REQ-104／REQ-105／REQ-106 三条开发行已分别于 2026-10-15／2026-10-16／2026-10-14 关闭）
归档判定：Retain（三份设计稿评审晋升后，本承载壳随轮关闭归档 history/plans/）

## 目标与成功标准

**目标**：把当前学习中心三个界面（知识点探索／课程学习／课后练习）按用户四项裁决拆分为
**三份独立、可分别开发、待晋升 `design/` 的设计稿**，落在 `docs/plans/`；同时回收已晋升
但口径越界的两份 design/ 学习文档（star-map、workbench-ui），把跨界耦合（星图面跳转学习
工作台／复习、练习区嵌在三栏工作台内）在设计层拆干净，使「知识探索独立」成为设计事实。

**成功标准正本在台账行**（ADR 0023）：逐条对照[任务台账](../../../trackers/todo.md)
`REQ-070-LEARN` 行的「成功标准」列；本壳不复制判据条目。三份设计稿各自的开发判据冻结在
REQ-104／105／106 三行的成功标准列，正本在各该行。

## 范围与非目标

**范围（本轮只动文档，不动代码）**：
1. 三份设计稿撰写：知识点探索（REQ-104）、课程学习（REQ-105）、课后练习独立面（REQ-106）；
2. design/ 两份学习文档回收至 plans/ 待晋升态，全仓引用清扫（索引／契约白名单／架构文档
   ／台账链接／源码 docstring 指向）；
3. todo 新增三行并各配固定壳镜像（一任务一行一壳，ADR 0016）；
4. 首页三卡目标形态、星图面移除跨界跳转的**设计口径**写入稿内（实施归三条开发行）。

**非目标**：不改 `web-ui/src/` 与 `backend/` 任何行为（入口文案、路由、跳转移除全部留给
开发轮）；不晋升任何设计稿进 design/（晋升须用户评审确认，走 ADR 0011 流程）；不动
ARCH-027 主链壳与 M1~M6 已关闭模块壳的事实记录（仅修链接指向）。

## 前置条件

1. 用户四项裁决已批复（2026-10-11，见「过程与证据」裁决登记 ①~④）。
2. M1（学习面 UI 与渲染基线）、M2（练习与复习）、M5（知识点体系与星图）、M6（目录知识点
   树与三栏学习工作台）四条模块线已关闭，现状设计正文可用（原 design/ 两份文档）。
3. 学习域 32 端点（含练习域 8 端点）契约已冻结于 api-contracts.md §⑥，设计稿只写消费
   语义不复制端点表（事实源唯一铁律）。

## 工作项

| 条目 | 内容 | 状态 |
| --- | --- | --- |
| W1 | 改造本壳与原 REQ-070-LEARN 行：行描述改为本轮承载，成功标准重写为固定判据 | **已完成（2026-10-11）** |
| W2 | 设计稿 A《学习中心·知识点探索界面设计稿》落 `2026-10-11-learn-ui-knowledge-point-exploration.md`（星图＋课程知识点页，移除全部跨界跳转，总标题改名，复习入口移出） | **已完成（2026-10-11）** |
| W3 | 设计稿 B《学习中心·课程学习界面设计稿》落 `2026-10-11-learn-ui-course-study.md`（书架＋三栏工作台阅读/链路，练习区§8/§8.1/§9 移出，首页卡开 → `#/learn`，返回落点改书架为待评审点） | **已完成（2026-10-11）** |
| W4 | 设计稿 C《学习中心·课后练习独立面设计稿》落 `2026-10-11-learn-ui-practice.md`（新增 `#/practice` 独立面，承接练习域全部语义＋复习入口落位＋DEFECT-012/013 口径） | **已完成（2026-10-11）** |
| W5 | todo 新增 REQ-104/105/106 三行（三条开发轮各一行，状态 Accepted，判据冻结） | **已完成（2026-10-11）** |
| W6 | design/ 两份学习文档回收（移入 `docs/history/plans/2026-10/`）＋全仓引用清扫：design/index.md、tests/contract/test_design_documents.py 白名单、frontend-architecture.md、project-status.md、completed.md 链接、plans/index.md、主链壳、history 归档壳入站链接、web-ui 源码 docstring 指向 | **已完成（2026-10-11）** |
| W7 | 契约门禁全绿（tests/contract 全量 + ruff） | **已完成（2026-10-11）** |
| W8 | 三份设计稿提交用户评审、确认后按 ADR 0011 晋升 design/ | **已完成（2026-10-18）**：C＝2026-10-14 按用户指令晋升（`learning-practice-ui.md`）；A＝2026-10-15 实施＋真机验收后整篇晋升（`knowledge-point-exploration-ui.md`）；B＝2026-10-18 由 REQ-117 重设计轮以 v2 本体一次晋升（`frontend/learning-course-ui.md`，v1 稿按用户裁决留改不晋升、随壳归档）——三面详设全部落 `design/frontend/`，本行 S1~S5 至此全达成，收口待用户裁决 |

## 过程与证据

- **2026-10-11**：用户四项裁决批复并本轮开工（此前现状：REQ-070-LEARN 行为 2026-09-10
  设立的学习功能现状基座壳，内容已滞后于 M1/M2/M5/M6 落地事实）。裁决登记：
  ① 承载行＝**改造 REQ-070-LEARN 行**（不新开 ARCH-027-M7 行；原行与本壳由「现状基座」
  改判为本轮设计稿整理承载，现状正文回收进三份稿的「现状基座」节）；
  ② 已晋升 design/ 的两份学习文档（learning-star-map.md、learning-workbench-ui.md）＝
  **回收至 plans/ 待晋升态**，design/ 学习中心位再度置空，全仓引用同步清扫；
  ③ 首页三卡目标形态＝**课后练习同步设计独立面**（新路由 `#/practice`，三卡各指独立面：
  课程学习→`#/learn` 书架、课后练习→`#/practice`、知识探索→`#/knowledge`）；
  ④ 解耦口径＝**星图面全部移除跨界跳转**（「进入学习工作台」「今日复习 N 条」等从
  `#/knowledge` 与 `#/knowledge/c/:courseId` 移除，学习/练习入口回归首页卡与书架）。
- **2026-10-11**：界面耦合取证（写稿依据）——`web-ui/src/pages/Home.tsx` ENTRANCES 三卡中
  仅「知识探索」有 href，课程学习/课后练习点击落 `message.info`「建设中，将在后续轮次
  开放」（演示已开发但入口未开）；`Knowledge.tsx` 悬停复习计数、`CourseKnowledge.tsx`
  「进入学习工作台」按钮、练习区嵌于 `LearnWorkbench` 中栏与右栏 Tabs——三处跨界分别归
  W2（移除）／W4（迁独立面）承接；`docs/design/learning-workbench-ui.md` §8/§8.1/§9 为
  练习域正文，归 W4 拆出。
- **2026-10-11**：W1~W7 执行完毕（本壳改写、三份稿落盘、三行登记、design/ 回收与引用
  清扫、门禁复跑）。清扫明细见 W6 各行指向文件；门禁输出见对话记录，不另存日志。
- **2026-10-15（A 面晋升批）**：设计稿 A《知识点探索界面》按用户裁决整篇去过程化晋升
  `docs/design/knowledge-point-exploration-ui.md`（设计状态 Accepted／实现状态 Implemented／
  确认状态**暂定**待人工评审转正），**四行合一份**＝REQ-104／110／113／114，R1 结案＝落 design/ 根、
  文件名取建议值。同批四行收口（todo 摘行 → completed.md 四行 Achieved）、四壳归档
  `docs/history/plans/2026-10/`（mv 经用户批准）、`design/index.md` 与 `plans/index.md` 双索引登记、
  `frontend-architecture.md` 路由节删已下线的 `#/knowledge/c/:courseId` 条目并改写为同页两视图口径、
  三处源码 docstring 指针改指晋升档。门禁＝契约 82 passed、根侧 pytest 742 passed、ruff 全绿、
  web-ui 串行 63 files／760 tests、`tsc -b` exit=0、`npm run build` 绿；人工验收＝用户 2026-10-15
  「没有问题，人工验收通过，现在可以继续」。运行库侧冒烟数据已按裁决回退清空（详见 REQ-114 归档壳
  「过程与证据」10-15 条）。**本行仍不关闭**：设计稿 B《课程学习》（REQ-105）未晋升，W8 只算部分达成。
- **2026-10-18（B 面晋升批，W8 就此补齐）**：三份设计稿的最后一面——课程学习——由 REQ-117 重设计轮以 **v2 本体**
  一次晋升为 [docs/design/frontend/learning-course-ui.md](../../../design/frontend/learning-course-ui.md)
  （设计状态 Accepted／实现状态 In Progress／确认状态 暂定；v1 稿按用户 2026-10-16 裁决「留改不晋升」已随
  REQ-105 壳归档 `history/plans/2026-10/2026-10-11-learn-ui-course-study.md`）。同批指针收敛＝
  `test_design_documents.CURRENT_DOCUMENTS` 加行、`design/index.md` 待晋升段改为「只剩 REQ-116 文档分析处理」、
  总设计 §5 与 §7 句、`frontend-architecture.md` 两条 `#/learn*` 信息架构行按实态重写、`roadmap.md` 前端行措辞改正。
  **至此 W8 三稿全晋升、本行 S1~S5 全达成**（S5 的「提交用户评审后按 ADR 0011 处置」三面均已处置）；
  本行收口与壳归档 mv 已于 2026-10-18 用户给权后执行（详见 REQ-117 归档壳「过程与证据」收口批条）。门禁＝契约 88 passed（唯一红＝并行共享表轮 REQ-120/121 的 QED-Tracker 死链，
  非本批）、web-ui 串行 66 files／843 tests、`tsc -b` exit=0、`npm run build` 绿。

## 验证与验收

- 契约测试全绿：`tests/contract`（含 test_plan_governance G3/G7、test_tracker_governance
  G1/G2/G5 镜像与锚、test_design_documents 白名单与 design/ 全集等值）。
- 引用对拍：全仓不再存在指回 `docs/design/learning-star-map.md`／
  `docs/learning-workbench-ui.md` 的存活链接（history 归档壳内链接改指回收后的归档路径
  或后继设计稿）。
- 三份稿自查：每份含 ADR 0017 骨架（定位与目标／范围与非目标／设计本体／状态与降级
  矩阵／已知约束）、「现状基座」节记录回收来源、待评审点显式列出且不擅自定谳。

## 回滚

纯文档轮：三份新稿与 todo 三行可直接删除，本壳与 REQ-070-LEARN 行恢复 git 历史版本即可
回到现状基座形态；design/ 两份文档的回收（mv）可按归档路径原样移回。任一环节回滚须整批
做（稿＋行＋引用清扫同步），不留半态。

## 关闭与归档

关闭条件（**2026-10-18 达成并经用户给权收口**）：三份设计稿全部晋升 `design/frontend/`
（练习 2026-10-14／知识探索 2026-10-15／课程学习 2026-10-18 由 REQ-117 以 v2 本体晋升），
本行按 ADR 0020 达成即收；壳判 Retain 归档 `docs/history/plans/2026-10/`（mv 已于 2026-10-18 用户给权后执行，
入站链接按新深度重算，见 REQ-117 归档壳「过程与证据」收口批条）。
三条开发行中 REQ-104／105／106 已各自收口，无留挂。
