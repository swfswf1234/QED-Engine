# 学习中心·知识点探索同页化与星图悬停叙述

状态：Completed
关闭结果：Achieved（行 S1~S5 逐条达成并留证；同页下钻深链与面包屑回退真机取证、悬停叙述 2026-10-14 复验，人工验收批 2026-10-15 通过）
任务类型：B
最后更新：2026-10-15
关联 ADR：`../../../history/adr/v0.1/0011-pending-design-location.md`（设计正文留在设计稿 A，本壳只承载实施与取证）、`../../../adr/0023-todo-row-carries-scope-and-criteria.md`（判据正本在行、过程落壳）、`../../../adr/0022-task-chain-clarifications.md`（不扩载：新工作另登行另建壳）
关联设计：`../../../design/knowledge-point-exploration-ui.md`（设计正文正本，2026-10-15 晋升；本轮改判的口径落在其 §3/§8/§9——过程壳＝`2026-10-11-learn-ui-knowledge-point-exploration.md`）、`../../../architecture/api-contracts.md`（星图端点字段事实源）、`../../../architecture/frontend-architecture.md`
关联 Tracker：docs/trackers/todo.md（REQ-110 登记；上游 REQ-104 已交付两页形态）
归档判定：Retain（收口后本壳归档 history/plans/，设计口径留在设计稿 A 并随其晋升）

## 目标与成功标准

**目标**：把「学习中心·知识点探索」的两级视图（领域星图 / 课程知识点层级图）合为**同一页面内的
替换式下钻**，由面包屑承担层级导航；同时让星图课程卡的悬停提示显示**课程名称与课程叙述**
（`qed_course.description`），使「看领域 → 看课程 → 看课程内层级」在一屏里连续完成。

**成功标准正本在台账行**（ADR 0023）：逐条对照 todo.md `REQ-110` 行「成功标准」列，本壳不复制判据。

## 范围与非目标

**范围**：
1. 设计稿 A §3（页面信息面与导航）、§8（星图交互）、§9（课程层级图面）按本壳改判修订——正文唯一
   事实源仍在设计稿 A，本壳只登记工作项与取证。
2. 前端：`#/knowledge` 单页面内两级视图切换 + 面包屑；课程层级视图以可深链的 URL 参数形态承载。
3. 后端：`GET /learn/star-map` 的 course 对象补吐 `description`（`qed_course.description` 透传，
   与 REQ-104 W7 同源同法）；契约行 `api-contracts.md` 星图行随收尾同步。

**非目标**：不改星图布局算法与图元形态（轨迹列框／课程框／先修连线口径不变）；不改层级图布局
纯函数 `kpTreeLayout` 的几何与定序规则；不动知识点写面（零写面硬边界不变）；不新增跨界出口
（REQ-104 裁决 ④ 继续生效）；不设计课程学习面与练习面（REQ-105/106）。

## 前置条件

1. 用户裁决（2026-10-11，REQ-104 人工验收三审）＝① 星图课程卡悬停「有提示框，但显示已确认/待选
   而不是描述」，须改为显示课程名称与叙述；② 两级视图合并形态＝**单页内替换**（非双栏、非保留
   两个独立页）；③ 台账承载＝另开新行（REQ-104 行成功标准写定不改）。
2. REQ-104 二批已交付并可验收：层级图页 `CourseKnowledge.tsx` + `kpTreeLayout` / `KpTreeGraph`
   在位、W7 已让课程知识点端点吐 `description`（真机已验）。
3. 数据可行性已取证：`_catalog()` 的课程行即 `qed_course` 全行 spread，`description` 列在列
   （REQ-104 W7 同源取到值），故星图端点补该字段为**零新增查询**的透传改动。

## 工作项

| 条目 | 内容 | 状态 |
| --- | --- | --- |
| W1 | 设计稿 A 改判落稿：§3 页面信息面改「单页两级视图 + 面包屑（**不含领域名**）」，§8 课程卡悬停改「两行＝课程名称＋课程叙述，计数段删除（四审裁决）」，§9 课程层级视图「同页内」语义与回退由面包屑承载，§10 降级矩阵同步（叙述缺失/层级数据不可达/`?course=` 404 在单页内的表现） | 已完成（2026-10-11） |
| W2 | 后端：`star_map` course 对象补 `description`（`tests/test_learn_knowledge.py` 或星图定向先红后绿） | 已完成（2026-10-11，定向 26 绿） |
| W3 | 前端路由与容器：`#/knowledge` 单页承载两级视图，课程层级视图用可深链参数形态（判据 S1/S2），面包屑两级「知识点探索 / {课程名}」（不含领域名，四审裁决），点「知识点探索」清参数回领域层 | 已完成（2026-10-11，定向 63 绿 + 全量 vitest 737 绿 + `tsc -b` exit=0；浏览器实测随 W5） |
| W4 | 前端悬停：`StarMapGraph` 课程节点提示改两行＝课程名（加粗）＋ `description`（计数段删除，四审裁决；`StarMapGraph.test.ts` 先红后绿；叙述空值时只显课名一行按设计稿 A §8） | 已完成（2026-10-11，`StarMapGraph.test.ts` 绿） |
| W5 | 回归与验收：`Knowledge.test.tsx` / `CourseKnowledge.test.tsx` / `App.test.tsx` 断言随单页口径重写（先红后绿），全量 vitest 串行 + `tsc -b` + `npm run build` + 后端定向 pytest + ruff + 浏览器实测（单页内下钻/面包屑回退/深链/悬停叙述） | 已完成（2026-10-15：叙述悬停 10-14 已复验，同页下钻与面包屑回退 10-11 实测通过，课程卡现场点击随人工验收批判定通过） |

## 过程与证据

- **2026-10-11 立项（REQ-104 人工验收三审改判，用户裁决三项）**：
  ① 悬停叙述缺口的根因取证＝`GET /learn/star-map` course 对象实测字段
  `course_id/name/track/stage/sort_order/kp_confirmed/kp_candidates`（真机 fetch），
  `api-contracts.md:1020` 同列且无 `description`；渲染侧 `StarMapGraph.tsx:90,138` 提示串只有
  「课名 + 已确认 N · 待选 M」，设计稿 A §8 亦从未承诺叙述——**属数据面＋设计口径双缺口，非渲染故障**；
  用户现场确认＝提示框有出、内容不对。
  ② 合并形态裁决＝单页内替换（候选「双栏左星图右层级图」「同容器双 URL」均未采纳）。
  ③ 承载裁决＝开新行；`REQ-109` 已由论文线占用（并行窗口登记，In Progress），本行取 `REQ-110`。
  附带发现（已处置，非本壳工作项）：`api-contracts.md:1022` 的 course 字段行此前未含
  REQ-104 W7 已上线的 `description`＝文档滞后一处，2026-10-11 随三审文档梳理补齐（属 REQ-104
  W7 的契约同步欠项）。本壳待同步的是 `api-contracts.md:1020` 星图行补 `description`，随 W2/S3
  实施时一并改（不在实施前先行，避免文档先于代码）。
- **2026-10-11 R4 四审裁定＋开工发令（用户「悬停第三行计数 删除；面包屑中间级不显领域名：否，
  开始执行」）**：① 星图课程卡提示固定**两行＝课程名称（加粗）／课程叙述**，原
  `已确认 N · 待选 M` 计数段删除（数据面 `kp_confirmed/kp_candidates` 端点与布局侧保留不动，
  只是本面无展示位）；② 面包屑只有两级「知识点探索 / {课程名}」，**不含领域名**，领域身份由
  左上领域下拉单独承载，回退出口只有「知识点探索」一级。设计稿 A §3/§7/§8/§9 已按此改判落稿
  （W1 完成）。③ 用户同时发「开始执行」＝W2~W5 授权动码，本壳状态随之转 In Progress。
- **2026-10-11 W2 实施（后端透传）**：`backend/qed_engine/api/learn.py` `star_map` 的 course
  dict 增 `"description": str(course.get("description") or "")`（零新增查询，`_catalog()` 已
  spread 全行）；`tests/test_learn_knowledge.py` 先红（`KeyError: 'description'`）后绿
  ＝`26 passed`（断言 math_analysis 吐介绍、linear_algebra 无介绍回落空串）；
  `docs/architecture/api-contracts.md:1020` 星图行随实施同步补该字段与口径句。
- **2026-10-11 W4 实施（悬停两行）**：`StarMapGraph.tsx` 课程节点 `detail` 改承载
  `description`，formatter 输出「`<b>课程名</b>` ＋ `max-width:360px;white-space:pre-wrap` 叙述段」，
  叙述空值只返课名一行不加 `<br/>`/`<div>`；`已确认 N · 待选 M` 计数段整体删除（数据面
  `kpConfirmed/kpCandidates` 仍留在布局与端点，REQ-104 S3 不回归）；叙述进 HTML 提示框，
  故新增 `escapeHtml` 转义后再拼。`StarMapGraph.test.ts` 先红（旧断言计数行）后绿；
  类型侧 `api/learn.ts` `StarCourseNode.description` 取**可选**（`description?: string`）——
  并行窗口 REQ-105 持有的 fixture 文件本轮不得触碰，必填会打断其 `tsc`。
- **2026-10-11 W3 实施（单页化）**：
  - `App.tsx` 删 `/knowledge/c/:courseId` 路由与 `CourseKnowledge` import，路由一览注释改口径
    （旧深链不做兼容重定向：站内已无入口，`?course=` 是唯一课程层形态）。
  - `Knowledge.tsx`＝单页容器：`useSearchParams` 取 `course` 参数（层级唯一事实源＝URL，组件内
    不存私有层级态）；`?course=` 有值时主体由 `CourseKnowledge` 视图替换星图（条件挂载），
    点课程卡＝`setSearchParams` 写参数、点面包屑「知识点探索」＝`<Link to="/knowledge">` 清参数；
    面包屑＝antd `Breadcrumb`（`aria-label="面包屑"`）两级「知识点探索 / {课程名}」，**不含领域名**，
    末级不可点；领域下拉在两视图常驻，课程层切领域＝`selectDomain` + 清参数回领域层；
    刷新按钮只重取当前视图数据（课程层不重取 star-map，用例断言 star-map 调用数不变）；
    ResizeObserver effect 随 `courseId` 重建（回领域层重新观测容器尺寸）。
  - `CourseKnowledge.tsx` 由「页」降级为视图：props 收 `courseId`，删 AppHeader／大标题／
    「返回知识点探索」按钮（回退归面包屑），卡内控件用局部 `ConfigProvider` 回浅色算法
    （页面级暗色只罩标题层，图区＝嵌在星空内的浅色卡 `kn-course-card`）。
  - `stores/courseKnowledge.ts` 增 `notFound`（`ApiError.status===404`）与切课即清旧课程，
    §10 单页降级由此分「课程不存在或已下线」与「知识点数据不可达＋重试」两文案；错误态不再
    叠画空态。
  - `knowledge.css` 首行注释改单页口径，新增 `.kn-breadcrumb / .kn-course-body / .kn-course-card`；
    `help/sections.ts` 知识点探索节改「悬停看课程名称与叙述＋点击本页内下钻＋面包屑返回＋
    课程号失效提示」四条口径。
  - 设计稿 A §3 相应更正一处：主体为条件挂载，故「缩放态不重置」改为如实表述（星图数据不重取，
    画布缩放/平移态随视图替换重置）——保留原承诺会要求把 ECharts roam 态提升为受控状态，
    超出本轮范围。
  - 取证：定向 8 文件 `63 passed`（先红＝改断言后 17 failed / 10 passed）→ web-ui 全量 vitest 串行
    `Test Files 62 passed (62)；Tests 737 passed (737)`（并行窗口的 LearnWorkbench/LearnShelf 红
    已由该窗口自行修掉，本轮无需归因留档）→ `npx tsc -b` exit=0。浏览器实测随 W5。
- **2026-10-11 W5 门禁与浏览器实测（真机 8903 dist + 8900；隐藏 viewport 下截图与指针交互不可用，
  全部以 `evaluate_script` 取 DOM/网络证据）**：
  - 领域层 `#/knowledge`：h2＝「 学习中心·知识点探索」，`nav.ant-breadcrumb[aria-label=面包屑]`
    单级＝`知识点探索`，星图 canvas 1 枚，页头按钮恰三枚（使用手册/刷新/返回，**无「返回知识点探索」**），
    `star-map` 请求 1 次、`review/due` 0 次。
  - 深链 `#/knowledge?course=math_analysis` 落课程层：面包屑两级＝`知识点探索 / 数学分析`
    （**不含领域名**，四审裁决），卡内 h4＝《数学分析》＋介绍段（ε-δ 原文，与库值一致），
    层级图 canvas 内在尺寸 640×4956，请求＝`star-map` 1 次 + `knowledge-points` 1 次，
    `kp-details` 0 次（零写面）、`review/due` 0 次，大标题与按钮组不变。
  - 点面包屑「知识点探索」回退：hash 回 `#/knowledge`，卡消失、星图 canvas 回来、面包屑回单级，
    `star-map` 仍 1 次（**同页回退不重取星图**），全程未整页跳转。
  - 失效课程号 `#/knowledge?course=ghost_course`：提示「课程不存在或已下线」＋返回引导文案，
    不误报「该课程暂无已确认知识点」空态、不画骨架、无 canvas，面包屑两级（末级暂显课程号）仍可回退；
    控制台唯一报错＝该 404 资源本身。
  - 门禁：契约 `82 passed` → 根侧全量 `737 passed` → `ruff` All checks passed →
    web-ui 全量 vitest 串行 737 绿 + `tsc -b` exit=0 + `npm run build` 绿。
  - **留一项待复验**：星图课程卡悬停叙述的真机取证需 8900 重启才生效（8900 不热重载；当前运行的
    进程 star-map course 字段实测仍为 `course_id/kp_candidates/kp_confirmed/name/sort_order/stage/track`，
    无 `description`）。代码与契约已到位，`StarMapGraph.test.ts` 覆盖两行形态与空叙述只显课名；
    隐藏 viewport 也无法用指针驱动 tooltip。待用户重启 8900（或授权 `POST /api/v1/control/self-restart`）
    后由人工现场悬停验收。交人工验收。
- **2026-10-14 用户重启 8900 后叙述复验（S3 结案）**：
  - 端点侧：`GET /learn/star-map` 的 course 字段实测＝`course_id/description/kp_candidates/kp_confirmed/
    name/sort_order/stage/track`，math-advanced 域 11 门课全部吐到介绍（长 151～284 字），
    W2 在生产进程生效。
  - 界面侧：隐藏 viewport（innerWidth/innerHeight=0）下指针工具不可用，改以 `evaluate_script` 向
    zrender 根节点派发合成 `mousemove` 网格扫描驱动 tooltip——采到 132 次提示，逐条形如
    `<b>微分几何</b><div style="max-width:360px;white-space:pre-wrap">用微积分研究空间形状的学问。……</div>`
    ＝**两行（课名加粗＋叙述）**；全文 `已确认|待选` 命中 0 次（四审裁决的计数段删除已真机生效），
    叙述未被截字符（长文整段进框、靠 `max-width` 折行）。
  - 未覆盖一项：同页**点课程卡**下钻的鼠标路径——合成 `mousedown/mouseup/click` 未被 zrender 的
    click 判定接受（hash 仍 `#/knowledge`、`knowledge-points` 请求 0 次），而深链与面包屑回退已在
    10-11 实测通过、点击行为由 `Knowledge.test.tsx` 用例覆盖。留给用户在浏览器现场点一次课程卡验收。
- **2026-10-14 五审改判对本壳口径的影响（实施不归本壳，归 REQ-111）**：用户五审裁课程层保持
  星图语汇，本壳 W3 落地的两项口径由此改判——① 「**领域下拉在两视图常驻**，课程层切领域＝
  `selectDomain` + 清参数回领域层」改为**下拉只属领域层**，课程层左上角只显示课程名行；
  ② 课程层图区「嵌在星空内的浅色卡 `kn-course-card`＋浅色画布」改为**画在暗色星空层上的
  关系星图（发光圆点＋名称标签＋关系线，无方框）**。本壳**不改写既有实施记录**（W1~W5 是
  当时的事实），改判口径与设计正文落设计稿 A（§3/§9/§11），实施与取证归
  [2026-10-14-learn-ui-course-star-graph.md](2026-10-14-learn-ui-course-star-graph.md)（REQ-111）。
  REQ-110 行「成功标准」列与 S1~S5 **不扩载、不改判据**；本壳剩余人工验收项（点一次课程卡）
  仍有效，验收后其单页化与悬停叙述部分照常收口。

- **2026-10-15 收口批（四行合一份晋升）**：设计本体已随设计稿 A 整篇晋升 `../../../design/knowledge-point-exploration-ui.md`（§3 单页两视图＋面包屑、§8 课程卡悬停两行＝课名＋叙述、§9 同页课程层级视图）。行判据逐条对照：S1 同页切换与面包屑回退无整页跳转（10-11 实测：点面包屑回领域层 `star-map` 仍 1 次）；S2 课程层深链可达（`#/knowledge?course=math_analysis` 直接落课程层，失效课程号走「课程不存在或已下线」）；S3 星图课程卡悬停含课名与 `description`、`GET /learn/star-map` course 对象带该字段且 `api-contracts.md` 星图行同步（10-14 重启后复验：11 门课全吐介绍、合成 mousemove 采到 132 次两行提示、`已确认|待选` 命中 0 次）；S4 硬边界不回归（无跨界出口、零写面 `kp-details` 0 次、布局确定性由既有用例守护）；S5 门禁＋浏览器实测（web-ui 串行 760 tests、`tsc -b` exit=0、`npm run build` 绿、根侧 pytest 742／ruff／契约全绿）。原「留用户在浏览器现场点一次课程卡」的待验收项（隐藏 viewport 下合成点击不被 zrender 接受）已由用户 2026-10-15 人工验收批判定通过。本壳 Retain 归档 ``。

## 验证与验收

- 单页化验收＝S1/S2（同页切换、面包屑回退、深链落位）以浏览器实测取证；叙述验收＝S3 以真机
  悬停内容 + 端点响应字段双证；硬边界回归＝S4 由既有用例与新增断言覆盖（无跨界出口、零写面、
  布局确定性）。
- 人工验收点：单页内替换后的**视觉连续性**（星图暗色星空层与层级图浅色画布层同页共存时的
  底色切换是否自然）与面包屑文案密度，须用户现场判定。

## 回滚

前端回滚＝恢复 `#/knowledge` 与 `#/knowledge/c/:courseId` 两页路由形态（REQ-104 交付态），
面包屑组件下线；后端回滚＝`star_map` course 对象去掉 `description` 键（无表结构变更，可安全回退）。
设计稿 A 的 §3/§8/§9 改判随之回退至 REQ-104 验收稿文本。

## 关闭与归档

关闭条件：W1~W5 全部达成且 S1~S5 逐条对照留证后，本壳按 `qed-closeout` 收口（Retain 归档
`history/plans/2026-10/`），REQ-110 行移入 completed.md。设计口径的晋升仍随设计稿 A 整篇
（三面同批晋升裁决），本壳不单独晋升。
