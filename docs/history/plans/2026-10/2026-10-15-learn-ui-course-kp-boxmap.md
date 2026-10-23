# 学习中心·知识点探索课程层大小知识点重设计（learn-ui-course-kp-boxmap）

状态：Completed
关闭结果：Achieved（行 S1~S6 逐条达成并留证；六项门禁＋真机 8903 取证绿，真实数据 9 框／87 条目可读性人工验收 2026-10-15 通过）
任务类型：B
最后更新：2026-10-15
关联 ADR：`../../../history/adr/v0.1/0011-pending-design-location.md`（设计正文留在设计稿 A，本壳只承载实施与取证）、`../../../adr/0022-task-chain-clarifications.md`（不扩载：新工作另登行另建壳）、`../../../adr/0023-todo-row-carries-scope-and-criteria.md`（判据正本在行、过程落壳）
关联设计：`../../../design/knowledge-point-exploration-ui.md`（设计正文正本，2026-10-15 晋升——本行形态落在其 §9；七审改判的过程稿＝`2026-10-11-learn-ui-knowledge-point-exploration.md`）、`../../../architecture/frontend-architecture.md`（8903 视觉 token）
关联 Tracker：docs/trackers/todo.md（REQ-113 登记；上游 REQ-111 已 Achieved 收口并把 W7/W8 移交本行；摘要通道＝REQ-114）
归档判定：Retain（收口后本壳归档 history/plans/，设计口径留在设计稿 A 并随其晋升）

## 目标与成功标准

**目标**：把「学习中心·知识点探索」的**课程层视图**按七审语义重做为**两级知识粒度**的星图——
**大知识点＝虚框容器**（现数据里的 outline depth1，如线性代数的《行列式》《矩阵》）、
**小知识点＝框内条目**（outline depth2 与归入的 `point` 行，如《矩阵乘法》《矩阵计算》），
虚框**自上而下按学习顺序堆叠**、框内条目**折行排成行优先网格**，与领域层用同一套星空语汇
（dashed 虚框＋发光圆点＋常驻名称标签）；归属由虚框几何承载，**不再画层级关系线**。同时承接
六审三项遗留：画布宽度取内容区实测值、悬停只给学习者名称＋摘要、学习面去「未归档」概念。

**成功标准正本在台账行**（ADR 0023）：逐条对照 todo.md `REQ-113` 行「成功标准」列，本壳不复制判据。

## 范围与非目标

**范围**：
1. 布局层 `kpTreeLayout.ts`：由「三列阶梯＋归属边」改为「大知识点框纵向堆叠＋框内条目行优先网格」
   ——删边集与 `ownership`、删 `anchorCount`／`childCount`、删「未归档」伪节点分支与
   `KP_UNARCHIVED_ID`／`kind:'unarchived'`，`KP_COL_W`／`KP_ROW_H` 换为框几何参数
   （框宽比例、条目格宽×高、每行格数）；定序改 `order_hint` 升序 → 来源锚最小页码 → 名称码点 → 行 id。
2. 渲染层 `KpTreeGraph.tsx`：新增虚框图元（`roundRect`＋dashed 描边＋透明填充＋框内顶部名称带，
   画法对齐 §7 轨迹列框）；圆点＋常驻标签只留给框内条目；`KIND_STYLE.unarchived` 删；
   tooltip 分流由「节点／边」改为「大知识点框／条目」；`symbolSize` 的 y 分量按**实测**宽高比补偿
   （REQ-111 已落地的正圆补偿保留）。
3. 容器 `Knowledge.tsx`：把 `ResizeObserver` 实测内容区宽度覆盖课程层（现课程层早退，画布宽钉在
   `max(640, layout.width + 300)`＝「只占 1/3」根因）。
4. 信息面：悬停＝名称＋摘要（框与条目都是），摘要字段为空只显名称；来源锚计数、四分类、
   下辖计数不进提示；`parent_kp_id` 空／悬空的 `point` 不进图。
5. 手册 `help/sections.ts`：课程层两条改「悬停虚框看大知识点、悬停框内条目看小知识点」，
   撤销「悬停关系线看归属」句。
6. 测试：`kpTreeLayout.test.ts`／`KpTreeGraph.test.ts`／`CourseKnowledge.test.tsx`／`Knowledge.test.tsx`
   按新形态改写（含「无边图元」「不出现未归档」「画布宽＝内容区宽」负向断言）。

**非目标**：不改后端端点形状（outline `summary` 通道的缺口的由 **REQ-114** 承接，本壳不等它——
通道未落地前框与条目只显名称，属设计稿 A §10 的设计内降级）；不改领域层 `starMapLayout`／
`StarMapGraph` 图元；不引出新页面或跨界出口；不动知识点写面；不画学习顺序号徽章（待评审 R6）。

## 前置条件

1. 用户七审裁决（2026-10-15，AskUserQuestion 四项）：章＝虚框（大知识点）／节＝框内条目（小知识点）；
   定序＝`order_hint` 优先＋来源锚页序兜底；大知识点悬停信息＝先补后端 summary 通道（→ REQ-114）；
   治理＝另开新行新壳、REQ-111 按现状收口归档。
2. 设计稿 A §9 已按七审重写（2026-10-15 落稿，见该稿「过程与证据」七审条目），正文唯一事实源在设计稿 A。
3. REQ-111 移交清单四项（宽度、去编辑侧字段、去「未归档」、正圆补偿）已在本壳范围 1~4 内重排。
4. 数据可行性（真机 8900，`math_analysis` 96 行）：9 章＋86 节＋1 point；outline 行 `order_hint`
   1～95 全有值（非按父连续）故主判据可直接生效；单框最多 21 条（故框内须折行成网格）；
   `point.order_hint` 恒 NULL（故页序兜底为其服务）；outline 行 `summary` 恒空（故降级为只显名称）。
5. 虚框画法可复用性已取证：领域层 `StarMapGraph.tsx` 的列框即 graph `data` 节点
   （`symbol:'roundRect'`＋`borderType:'dashed'`＋`label.position:'inside'` 名称带偏移），
   非 markArea／custom series，可直接移植到课程层。

## 工作项

| 条目 | 内容 | 状态 |
| --- | --- | --- |
| W1 | 设计稿 A 七审改判落稿（§9 整节重写＋§1 ⑩⑪／§3／§8／§10／§11／现状基座／待评审点 R6）与 REQ-111 壳的收口留痕 | 已完成（2026-10-15，本轮只落文档） |
| W2 | 布局层重做：框几何＋框内网格＋两级定序；边集与编辑侧字段、未归档分支删除；`kpTreeLayout.test.ts` 先红后绿 | 已完成（2026-10-15，先红后绿：`kpTreeLayout.test.ts` 9 绿） |
| W3 | 渲染层重做：虚框图元＋条目圆点常驻标签＋tooltip 分流（框／条目）＋正圆补偿随实测宽高；`KpTreeGraph.test.ts` 先红后绿 | 已完成（2026-10-15，先红后绿：`KpTreeGraph.test.ts` 8 绿） |
| W4 | 容器取景：`Knowledge.tsx` 的 `ResizeObserver` 覆盖课程层，画布宽＝内容区实测宽，超高纵向滚动；页面用例断言同步 | 已完成（2026-10-15，含真机滚动条槽缺陷修复，见「过程与证据」） |
| W5 | 信息面与手册：悬停字段收窄至名称＋摘要、`point` 无父不进图；`help/sections.ts` 课程层两条改写 | 已完成（2026-10-15，页面用例同步：`CourseKnowledge.test.tsx` 13 绿／`Knowledge.test.tsx` 10 绿） |
| W6 | 回归与验收：定向 vitest → 全量串行 → `tsc -b` → `npm run build` → 契约门禁 → 浏览器实测（真实数据 96 行的框堆叠、条目折行、两类悬停、宽度与平移可达） | 已完成（2026-10-15：六项门禁与真机取证绿；人工验收通过） |

## 过程与证据

- **2026-10-15 立项（七审改判，用户原话）**：「当前主要是前端优化，我的目的是展示已经探索出来的
  知识点、领域、课程、具体知识点（章、节只是范例，不过章可以看作是大知识点，例如线性代数中的行列式、
  矩阵等等，这里也有个先后顺序，然后像矩阵这样的大知识点下面有矩阵乘法、矩阵计算等等具体的小知识点在
  大知识点下），因此我们可以继续像星图（领域）一样展示，不过是按照学习顺序从上往下而已，而大知识点是
  虚框，鼠标放上去是大知识点信息，小知识点也是同理，是大知识点虚框内的展示，然后也可以有学习顺序。
  现在开始探索，我们重新再整理，一步到位」。四项裁决（AskUserQuestion）＝章＝虚框／节＝框内条目、
  定序＝`order_hint` 优先＋页序兜底、大知识点悬停＝先补后端 summary 通道、治理＝另开新行新壳并把
  REQ-111 按现状收口归档。
- **2026-10-15 ID 取号留痕**：用户裁决选项文本为「另开 REQ-112 行＋壳」，但 REQ-112 已被并行窗口
  `2026-10-14-dev-process-evolution-round.md`（开发流程演进轮）占用，现网最大号为 REQ-112，故实取
  **REQ-113**（本壳，前端重设计）与 **REQ-114**（后端 outline 摘要通道）。
- **2026-10-15 探索取证（真机 8900 ＋ 只读检索）**：① 数据模型——outline 行 `type` 恒 NULL、
  `summary` 恒 `''`，因 `PUT /learn/courses/{ref}/outline` 只收 `name/page_start/page_end/children`
  （`backend/qed_engine/api/learn.py:414-437`，写入侧 `services/learn/knowledge.py:527`），
  `point` 行 `summary` 取候选 `narrative[:1000]`（`knowledge.py:360`）、`order_hint` 在
  `confirm_detail` 写死 NULL（`knowledge.py:359`）只能经 PATCH 赋值 → 「大知识点信息」无数据通道，
  故用户裁「先补后端 summary 通道」单列为 REQ-114。② 真表现网——1 领域／4 轨迹／12 课程
  （全部带 `description`），仅 `math_analysis` 有 96 行层级（9 章＋86 节＋1 point），
  章名单为目录式且带 OCR 残留（如「第4章 连续性 …… 73函数的极限」）、缺第 6／7 章，
  《行列式》在现网是 depth2 的**节**（挂在第9章下）——印证用户「章、节只是范例」的读法：
  本形态按**粒度**而非文档层级命名语义。③ 关系数据——知识点级先修／DAG 全库不存在，
  「先后顺序」只能由 `order_hint`＋来源锚页码派生。④ 渲染可复用性——虚框即 graph 数据节点，
  领域层画法可直接移植；课程层宽度缺口在 `Knowledge.tsx:55-67`（`ResizeObserver` 对课程层早退）。
- **2026-10-15 与 REQ-111 行判据的关系**：REQ-111 行 S1~S6 写定不改且已在其判据下逐条达成并收口
  （Achieved）；七审推翻的是**该形态下的两条口径**（「画面不出现方框」「悬停关系线＝一句归属说明」），
  属新工作而非旧任务未做项，按 ADR 0022 不扩载另登本行。设计稿 A §9 现文只承载七审后口径，
  改判链追溯见两壳的「过程与证据」。
- **2026-10-15 六审遗留项的承继**：宽度跟随容器、悬停去编辑侧字段、学习面去「未归档」三项裁决
  仍成立（用户原话三条与第二轮四项确认里的这三项未被七审推翻），并入本壳 W3~W5 实施；
  同批确认里的「列距等分铺满」与「只章＋节常驻」随三列阶梯形态作废，由七审的
  「框宽取内容区比例」与「常驻两层」替代。原稿曾把标签口径误记为「全部常驻」，
  已在 REQ-111 壳留痕纠正。
- **2026-10-15 授权状态**：本轮**只落文档、未动码**（遵守「裁决先落文档 → 人类明确说『开始执行』
  才可动码」）；W2~W6 待发令。

- **2026-10-15 八审（执行令与两项裁定）**：用户令本轮范围＝REQ-104／110／113／114 四任务设计并
  准备好、**后续作为 design/ 单一文件晋升**（时机＝实施＋真机验收后，连锁三处见设计稿 A「关闭与
  归档」节）；执行顺序＝**先 REQ-114 后端通道、再本行前端形态**并发令动码；**R6＝不画学习顺序号**
  （W3 图元不含序号徽章／名称前缀序号，学习顺序只由堆叠与网格次序承载）；**摘要录入面暂不做**
  （现网 outline `summary` 填充率 0%，故本行悬停按 §10 只显名称起步，REQ-114 落地后同一响应带
  `summary` 时自动补摘要行，本行零代码依赖 REQ-114 的完成）。

- **2026-10-15 发令后实施（W2~W5，设计稿 A §9 七审口径）**：布局层 `kpTreeLayout.ts` 重写为
  「框几何＋框内网格」——outline depth1 → 虚框，depth2 与按 `parent_kp_id` 归入的 `point` → 框内条目
  （父为节时归到该节所在框），无父／悬空行**不进图**（学习面去「未归档」），定序＝`order_hint` →
  来源锚最小页码（outline `source_ref.page_start`／point `anchors[].page`）→ 名称码点 → 行 id；
  删除边集与 `ownership`、`type`／`anchorCount`／`childCount` 等编辑侧与统计字段。坐标改为
  **以内容左上角为原点的数据坐标（像素）**，渲染层 `KpTreeGraph.tsx` 在数据 (0,0) 与 (width,height)
  各放一枚**不可见取景锚**（`symbolSize [0,0]`＋`opacity 0`＋无标签＋`emphasis.disabled`），使 ECharts
  graph 的两轴套满系数恒为 1——否则单列堆叠时数据宽高为 0，ECharts `createView` 的 ±1 兜底会把套满比
  放大到数百倍、圆点与文字一起炸开；`aspect` 的 y 分量补偿保留用于残余偏差。空态判定由「有 point 行」
  改为「有虚框」（纯 outline 课程也出图，真机 `math_analysis` 只有 1 条 point 即属此类）。
  `Knowledge.tsx` 新增第二枚 `ResizeObserver`（课程层，读 `clientWidth` 并 `>= 480` 兜底）把内容区实测宽
  经 `contentWidth` prop 传入视图，虚框宽＝该值，故 `CourseKnowledge` 不再自算宽度。

- **2026-10-15 W4 真机滚动条槽缺陷与修复（可复现）**：首版按 `clientWidth` 取景，真机 8903 实测画布
  CSS 宽 1086px 而内容区 `clientWidth` 1071px，`.kn-tree-scroll` 横向溢出 15px（虚框右侧被裁、需横向
  滚动才看全）。根因＝首帧无竖向滚动条时量到 1086，出图后内容超高出现滚动条使 `clientWidth` 降到 1071，
  而 `ResizeObserver` 此后不再回调。修复＝`.kn-course-body` 加 `scrollbar-gutter: stable`（滚动条槽常驻，
  一次量测即稳定），复验＝画布 CSS 宽 1071 ＝ `clientWidth`、`scrollWidth === clientWidth`（零横向溢出）。

- **2026-10-15 W6 门禁与真机取证**：定向 vitest（`kpTreeLayout` 9／`KpTreeGraph` 8／`CourseKnowledge` 13／
  `Knowledge` 10，含新补的 `roam`＋`scaleLimit` 断言）→ 全量串行 **63 files / 760 tests passed** →
  `tsc -b` 无输出 → `npm run build` 成功（chunk >500kB 与 antd 动态导入告警为存量）→ 契约门禁
  `tests/contract` **82 passed** → 真机 8903（dist 重建＋硬刷新）。浏览器证据以 `evaluate_script` 取
  （首帧截图成功、后续 viewport 转 hidden 故按 `qed-frontend-check` 走结构证据）：① 网络计数＝
  `/api/v1/learn/courses/math_analysis/knowledge-points?include_outline=true` **1 次**（S5，零新增查询）；
  ② 9 虚框自上而下堆叠、每框 5 列条目折行，画布 1071×1530、`scrollHeight 1641 > clientHeight 1230`
  （S1/S3）；③ 悬停两类分流——名称带 (535,37) → 「第1章 实数系和复数系」、(535,260) → 「第2章 基础拓扑」，
  条目圆点 (39,86) → 「导引」、(239,86) → 「有序集」，均只显名称（现网 outline `summary` 填充率 0%，
  符合 §10 起步口径；REQ-114 通道上线后同一响应带 `summary` 即自动补摘要行）；④ 虚框堆叠序与真机
  `order_hint` 一致（1,9,15,30,37,59,66,76,86）（S2）；⑤ 控制台零消息，领域层回归正常（星图 canvas
  1086×700、面包屑「知识点探索」、下拉「数学（高等数学）」、`/learn/star-map` 1 次）。
  真机行数核对＝96 行＝9 框（depth1）＋86 节（depth2）＋1 point，父级零悬空。
  **待**：真实数据（9 框／87 条目）可读性人工验收判定（「验证与验收」末条），判后本行方可收口。

- **2026-10-15 W6 人工验收通过（用户原话「没有问题，人工验收通过，现在可以继续」）**：真实数据
  9 框／87 条目的可读性（框高与条目密度、暗底对比、名称带与条目标签层级区分度）现场判定为可读，
  不需回设计稿 A 调参；本行 S1~S6 逐条达成，待与 REQ-104／110／114 同批晋升 design/ 后收口。
  同批补记：REQ-114 摘要通道上线后，本视图**零改动**即自动补出摘要行（悬停第1章虚框 →
  名称＋48 字摘要），§10 的「有摘要才显摘要」降级口径按设计生效。
  **环境注记（非缺陷）**：应用内浏览器 tab 处于 hidden 时 `ResizeObserver` 的 rAF 投递停摆，
  课程层画布会停在缺省宽（实测 660px 而非 1071px），tab 恢复可见后自动重测重画；
  真机取证在可见态完成，隐藏态只作结构证据。

- **2026-10-15 收口批（四行合一份晋升）**：设计稿 A 的七审／六审口径整篇晋升 `../../../design/knowledge-point-exploration-ui.md`（§9＝大知识点虚框＋框内条目网格、§10 含「课程只有 outline 无 point 也照常出图」与 REQ-114 摘要通道未填时只显名称的降级行）。行判据逐条对照：S1 虚框纵向堆叠＋框内行优先网格＋`option.links` 空（`kpTreeLayout.test.ts` 9 绿／`KpTreeGraph.test.ts` 8 绿）；S2 定序 `order_hint` 升序＋来源锚页码兜底＋同输入同图，真机堆叠序 1,9,15,30,37,59,66,76,86；S3 取景＝内容区实测宽（画布 1071×1530、`scrollHeight 1641 > clientHeight 1230`、`roam`＋`scaleLimit` 可达）；S4 信息面只名称＋摘要（不出现来源锚／四分类／下辖／未归档）；S5 零新增查询与零写面（`knowledge-points?include_outline=true` 1 次）；S6 门禁与浏览器实测全绿。本壳 Retain 归档 ``。

## 验证与验收

- 行判据逐条对照 `REQ-113` 行「成功标准」列；证据落本节与关闭时 completed.md 证据列。
- S1（虚框堆叠＋框内网格＋无边图元）以 `kpTreeLayout.test.ts` 几何断言（框包含其条目、
  框间不重叠、条目按框宽折行）＋ `KpTreeGraph.test.ts` 的「option 内 `links` 为空」负向断言覆盖。
- S2（定序与确定性）以同输入同图断言＋按 `order_hint`／页码兜底的用例覆盖；真机数据须与
  outline `order_hint` 序一致（章框顺序 1,9,15,30,37,59,66,76,86）。
- S3（取景）以浏览器实测取证：画布实测宽＝内容区实测宽、容器变宽后重放、`scrollHeight > clientHeight`、
  缩放平移后可见整树；隐藏 viewport 下按 `qed-frontend-check` 以 `evaluate_script` 结构证据替代截图。
- S4（信息面）以提示文案断言覆盖：不出现「来源锚」「下辖」与四分类词、不出现「未归档」字样。
- S5（零新增查询与零写面）以网络请求计数取证（仅 `knowledge-points?include_outline=true` 1 次）。
- 人工验收点：真实数据（9 框／86＋条目）下的**可读性**——框高与条目密度、暗底对比、名称带与
  条目标签的层级区分度，须用户现场判定；如不可读回设计稿调参而非改判形态。

## 回滚

前端回滚＝恢复 REQ-111 交付态（三列阶梯圆点树图＋层级线与归属提示）；后端与数据面无变更，无需回滚。
设计稿 A §9 随之回退至六审文本，待评审点 R6 一并撤销。

## 关闭与归档

关闭条件：W1~W6 全部达成且 `REQ-113` 行「成功标准」列逐条对照留证后，本壳按 `qed-closeout`
收口（Retain 归档 `history/plans/2026-10/`），该行移入 completed.md。设计口径的晋升仍随
设计稿 A 整篇（R1 晋升文件名待裁），本壳不单独晋升。
