# 学习设计轮 M1·学习面 UI 与渲染基线（learning-ui-rendering）

状态：Closed（Achieved，2026-10-09 用户裁决收口并 Retain 归档）
任务类型：B
最后更新：2026-10-09
关联 ADR：无新增（重划登记沿用 [ADR 0016](../../../adr/0016-todo-registration-one-task-one-plan.md) 一任务一行一壳）
关联设计：[parsing-ui.md](../../../design/parsing-ui.md)（对照工作台渲染消费面先例）、
[frontend-architecture.md](../../../architecture/frontend-architecture.md)（8903 服务架构）
关联 Tracker：docs/trackers/todo.md（ARCH-027-M1 任务行已于 2026-10-09 移除，收口行见
completed.md；主链与其余模块见 [学习设计轮主链壳](../../../plans/2026-09-22-learning-design-mainline.md)）
归档判定：Retain（收口时按用户裁决整壳归档 history/plans/2026-10/）

> 本壳是学习设计轮 **M1 模块**（8903 学习面 UI + 渲染基线）的唯一固定滚动记录，承载主链壳
> 原 W1（渲染基线，承接原 PLAN-051 渲染线）与原 W6（课程面 UI）两条工作流。
> 排期范围＝仅根仓库（用户裁决 2026-09-22）。

## 目标与成功标准

**目标**：让主链路编译出的块序列（text/公式/图/quiz/flashcard）与既有解析产物在学习界面
**回原样、可操作、可断点续学**。

**成功标准正本在台账行**（ADR 0023）：验收判据逐条见[任务台账](../../../trackers/todo.md)
`ARCH-027-M1` 行的「成功标准」列，本壳不复制判据条目；判据的验证手段见「验证与验收」节，
执行进展与证据见「过程与证据」节。原 U1~U3 编号由行内 S1~S3 按序承接，本壳其余章节出现的
U 编号即指对应判据。

## 范围与非目标

**范围**：8903 学习中心界面（书架/链路视图/看板/错题本页面壳）、渲染优化项登记与实施、
L9 Little Tutor 选区追问交互评估与承接。

**非目标**：学习域表与状态机（主链）、出题/复习逻辑（M2）、网关开关（M3）、
问答与召回后端（M4）；8903 只连 8900（ADR 0007）不变。

## 前置条件

1. U1 渲染基线无前置，可立即滚动（原 PLAN-051 登记表为空壳，无遗留条目迁入）。
2. U2/U3 前置＝主链 M-1 契约冻结 + M-2 首本编译产物可用；接口未就绪期允许 mock 走查但验收以真数据为准。
3. 渲染优化项逐条在本壳登记表发现即登记，实施经用户确认排期。

## 工作项（滚动登记表）

| 流 | 内容 | 状态 |
| --- | --- | --- |
| UI-1 | 渲染基线滚动线（承接原 PLAN-051/ARCH-026 渲染线）：KaTeX/表格/图片/版面回原样、BUGFIX-011 防御维持与老代产物核销、对照/学习界面消费体验；优化项逐条登记 | 已交付并随本壳收口（2026-10-09 判据 S1 四面核销；后续优化项按 roadmap 另立项） |
| UI-2 | 课程书架（引用式注册表消费）+ 课程详情 | 已交付（真机 2026-10-09；8902 离线降级已修） |
| UI-3 | 链路视图：块序列渲染、断点/过期（drift）标记、续学定位 | 已交付（真机 2026-10-09：生成→两级确认→编译→页窗块序列） |
| UI-4 | 掌握度看板、结课视图、错题本页面（数据端点归主链/M2） | 看板与结课已交付（只读 `GET …/progress`）；错题本归 ARCH-027-M2 |
| UI-5 | Little Tutor 选区追问（L9）交互评估与承接 | 待评估 |

## 过程与证据

- **2026-09-23**：学习设计轮重划建壳（一模块一壳一星），工作项 UI-1~UI-5 在本壳登记；
  原 PLAN-051 / ARCH-026 渲染线承接为 UI-1（承接时登记表为空壳，无遗留条目迁入）。
- **2026-09-30**：台账结构改判（[ADR 0023](../../../adr/0023-todo-row-carries-scope-and-criteria.md)）——
  验收判据正本移入 todo 行「成功标准」列，原行内「未启动／下一条件」叙述迁入本节，本节成为
  本任务进展与证据的唯一落点。
- **2026-09-30**：现状＝未启动。UI-2~UI-4 等待主链 M-1 生产存储接入 + M-2 首本编译产物；
  UI-1 渲染基线无前置、可滚动；UI-5 待评估。
- **2026-10-01**：用户给出学习面板三栏形态（左＝领域→课程→书籍目录顺序选择、中＝该章节按排版展示的解析正文、右＝批注标注「总结/详解」由用户定去留、确认即登记知识点表）并裁决知识点两表层级化重设计；该形态与两表改判由新增模块行 **ARCH-027-M6** 承载（壳 [2026-10-01-toc-knowledge-tree-and-learn-workbench.md](2026-10-01-toc-knowledge-tree-and-learn-workbench.md)），本壳判据与 UI-2~UI-4 编译块序列口径**不改写**；共用面＝本壳 UI-1 渲染基线（KaTeX/表格/图片/版面回原样）即 M6 中栏的渲染判据来源，优化项仍在本壳登记表滚动。
- **2026-10-07 承接与现状取证**：M6（三栏工作台）关闭后，学习设计轮唯一尚未启动界面的支线行回到本壳。真机取证见「数据面现状」节；UI-2~UI-4 的形态与内容口径列成待裁 D1~D4 草案，用户批复后按「实施序」动码。M6 移交项中「学习进度展示与学习者勾选续学」归本壳 UI-3/UI-4，掌握门与判分归主链 M-3。

## 实施与真机取证（2026-10-09，D1~D4 批复后动码）

- **界面交付**（D1=A、D4）：新增书架页 `#/learn`（课程卡列表，状态徽章词本身承载口径：
  `draft`→「待建链路」（无链路）或「草稿」（已有链路未开跑）、`learning`→「在学 N%」、
  `completed`→「已结课」）＋引用式注册弹窗（选共享课程 + 已激活解析版本的书，只写
  `ref_id` + label 快照）；`#/learn/c/:courseId` 三栏工作台加「阅读（章节目录＋批注）／
  链路（块序列＋推进）」双模式（Segmented 受控切换，右栏 Tab 随模式换面板）。
- **数据通路**（D2=是，判据 S1/S2）：`GET …/courses/{id}/outline` 节级页窗 →
  `PUT …/syllabus` 写 `source_ref`（book + 页窗）→ `POST …/compile/propose` +
  `…/compile/start` 只补空位 → 中栏按页窗 8 页/批渲染 8900 透传的解析产物
  （复用 `BlockList renderMode="layout"`，与对照面同一渲染基线）；推进＝学习者勾选
  `POST …/progress`（done/skipped/pending）＋ `PATCH /learn/units/{id}` 的 `covered`（D3）。
- **看板与结课**（判据 S3）：`ChainProgressPane` 与结课面板改为只读消费
  `GET …/courses/{lc}/progress`（不再取列表项 `derived`），服务端读时派生重算非累加；
  错题本归 ARCH-027-M2 本轮不做（D4 批复）。
- **真机走查（8903 新包 `index-CEkV_JPt.js` ＋ 8900 ＋ 8902，2026-10-09）**：
  书架列两门课 → 进 `math_analysis` 工作台 →「从目录生成链路」得 9 章 / 86 块 →
  「全部确认」两级齐备 →「编译链路」出「编译完成：块序列可读」，API 侧核验
  86/86 单元有页窗且 `gen_status=generated`；选中「有序集」中栏渲染第 10–11 页真实产物
  （KaTeX 260 节点、公式块与段落混排）；选中「度量空间」渲染 p.36 表格块为真 `<table>`
  （闭/开/完全/有界 六行）；进度推进 0/86→标记学完→1/2→2/2 后结课面板出「已结课」；
  撤销→1/2 且 `derived.current_unit_id` 指回该块、「回到断点」正确选中该块（S2 断点与续学）。
  网络请求全部指向 8900（无 8901/8902 直连），控制台零报错；页图内联块面见下未齐项。
- **本轮内缺陷修复（独立性铁律）**：书架 `reload()` 原把 `listBooks()` 与课程／星图同批
  `Promise.all`，8902 离线时整个 catch 置错→书架零卡片并报「书架数据不可达」。已改为书目
  独立 try/catch（`bookError` 只降级注册弹窗的素材下拉，文案「书目服务不可达（解析侧离线），
  暂不能选素材」），课程与星图照常列出；回归用例入 `LearnShelf.test.tsx`（该档 8 绿）。
- **门禁（2026-10-09，全绿）**：后端 `tests/contract` 82 passed；`tests` 全量 655 passed；
  `ruff check backend tests scripts` All checks passed；`web-ui/` 内 `tsc -b` 干净、
  `vitest run` 58 档 620 用例全绿、`vite build` 成。提交号待用户提交后补登。
- **判据 S1 未齐项（图片面，如实声明）**：`type=image` 块在学习／阅读中栏目前只出题注文字，
  无内联图——`BlockList.blockBody` 无 image 分支，且 8900/8902 只暴露页图端点
  `GET /books/{id}/pages/{no}/image`，块级图资产 `path: pages/images/<sha>.jpg` 无 HTTP 路由。
  核销两路待用户裁：①纯前端按页图 + `bbox` 内联裁切（不动子项目）；②8902 增块图端点
  ＋8900 代理（走对方红线窗口）。已入 UI-1 滚动登记。
- **观察（非缺陷）**：「全部确认」＝86 次串行 PATCH，期间点「编译链路」会被服务端以
  「状态冲突：两级确认未齐备」拒绝——提示口径正确；busy 期是否禁用编译按钮属 UI-1 体验项。

## S1 图片面补交付与判据核销（2026-10-09，用户裁决 ①＝纯前端页图裁切）

- **实现**：`BlockList` 新增可选入参 `pageImageUrl`，`blockBody` 为 `type=image` 块出
  `ImageCrop`——用已有整页页图端点 `GET /api/v1/books/{id}/pages/{no}/image` 作 src，
  在 `onLoad` 量得页图自然尺寸后按块 `bbox` 换算百分比裁切
  （容器 `aspect-ratio = bw/bh`、`overflow:hidden`，图 `width=pageW/bw`、`height=pageH/bh`、
  `left=-x0/bw`、`top=-y0/bh`，全部相对容器百分比 → 随栏宽自适应）；
  无页图地址或 `bbox` 缺失/非有限值时**回退题注文字**（不出 NaN 样式）。
  两个学习面 caller 传 `entry.data?.image_url`：`ChainPanes`（链路中栏）与
  `LearnWorkbench`（阅读中栏）。对照面不动（左栏本就是整页页图，图片面已在该面承载）。
- **TDD**：`BlockList.test.tsx` 先红（`Unable to find` 裁切图 alt）后绿，新增 3 例
  ＝①裁切换算（bbox 100,200→500,400 + 页图 1000×2000 → 250%/1000%/−25%/−100%、
  `aspect-ratio≈2`、容器 `overflow:hidden`）②无页图地址回退题注 ③`bbox` 缺失回退题注。
  `web-ui` 门禁：`tsc -b` 零错、`vitest run` 58 档 **624 passed**（较收口前 +4）、`vite build` 成
  （新包 `index-D9qO-q1z.js`）。
- **真机复验（8903 新包 ＋ 8900 ＋ 8902，b05 `mathanalysis-b05`）**：链路模式选「有限集、
  可数集和不可数集」（页窗 29–33）→ 出 `[data-testid="block-image-crop"]`，src 指向 8900
  页图端点；页图自然尺寸 **1699×2399**，块 bbox `[496,1746,1002,2068]` 换算得
  `width 335.77% / height 745.03% / left −98.02% / top −542.24%`、容器 `aspect-ratio
  1.57143/1`、渲染盒 396×252（396/252=1.571 自洽）。像素核验（canvas 取样同域图片，无污染）：
  bbox 区域 mean 239 / **sd 57**（确有图墨），同图页边与页顶区域 sd 0（纯白）——证明 bbox
  映射到真实图形区而非空白。隐藏视口（viewport=0x0）下 `loading="lazy"` 不自动触发加载，
  故内联裁切以「端点实测出图 + 换算与像素取样」代替截图取证；真实浏览器滚动即载。
- **判据逐条核销**（台账行 `ARCH-027-M1` 成功标准列）：
  - **S1** ✅：公式＝学习面真机 KaTeX（b05 p.10–11 出 260 节点，老代带 `$$…$$` latex 正常渲染）；
    表格＝p.36 表格块出真 `<table>`（闭/开/完全/有界 六行）；图片＝本轮裁切交付并实测；
    版面＝重排流入纸面、页眉/页码块在位（furniture 开关默认隐藏）。
    `$$$` 双定界符防护维持＝`blocks.test.ts` 的 `unwrapMathDelimiters` 7 例在 624 绿内，
    真机线上产物仍带定界符而渲染无残留；老代产物核销记录＝本台账
    [BUGFIX-011](../../../plans/design-bugfix-log.md)（数据面归对方、随其 PLAN-007 全本复测自愈，根侧防御剥离止血）。
  - **S2** ✅：见上「实施与真机取证」节（书架→链路→块学习三步真数据跑通，含断点标记与续学）。
  - **S3** ✅：看板与结课面板只读消费 `GET …/progress`，不改任务状态（同节取证）。
- **遗留（不建行，随下一次接触同面随手改）**：`confirmAll`＝逐块串行 PATCH 期间「编译链路」
  未随 `busy` 置灰，抢点会被服务端以「状态冲突：两级确认未齐备」正确拒绝——提示口径无误，
  仅缺前端禁用；归 UI-1 滚动体验项。
- **收口**：三条判据全达成 → 关闭结果 **Achieved**；用户裁决 **Retain 归档**
  `history/plans/2026-10/`，todo 移除 `ARCH-027-M1` 行并写入 completed.md；
  UI-1 渲染基线的滚动口径由 `frontend-architecture.md` 与 `parsing-ui.md` §9/§9.1 承载，
  后续优化项按 roadmap 触发再立项，不保留滚动行。

## 数据面现状（真机取证，2026-10-07）

8900 学习域已通：`qed_learn_course` / `qed_learn_unit` / `qed_learn_unit_progress` 与
`qed_knowledge_point` / `qed_learn_kp_detail` 在 `qed_test` 可用，
`GET /api/v1/learn/courses` 返回 200（现有一门课 `lc-b358f633aac1`「高等数学 M6」，
`derived` 为 draft / 0% / `current_unit_id=null`）。链路侧端点齐备（`api/learn.py`）：
`PUT …/syllabus`、`POST …/compile/propose`、`POST …/compile/start`（202）、`GET …/compile`、
`GET …/units?level=`、`PATCH /units/{id}`、`GET/POST …/progress`。

两处缺口决定本壳 UI-2~UI-4 尚未可跑通：

1. **内容侧**＝`start_compile` → `finish_compile` 是 **M-1 骨架编译**，逐 unit 只写占位文本
   「…骨架正文（M-1 占位，M-2 接生成管线）」（`services/learn/base.py:377-418`），
   LLM 生成管线归主链 M-2，未接线。
2. **界面侧**＝8903 现有 `#/learn/c/:courseId` 为 M6 三栏工作台，**只读解析产物**
   （章节目录 + 排版正文 + 批注登记），未消费 `units` / `progress`；
   书架（课程列表）、链路视图、看板/结课视图三个页面均未建（`App.tsx` 路由一览）。

## UI-2~UI-4 实施方案（2026-10-07 草案，待用户批复后动码）

| # | 待裁点 | 选项与推荐 |
| --- | --- | --- |
| D1 | 界面形态 | A＝在现有三栏工作台内加「阅读／链路」双模式（左栏树、中栏块序列、右栏批注与学习事件，单屏最小改动）；B＝新建独立链路视图页 `#/learn/c/{courseId}/chain` 与独立块学习页。**推荐 A** |
| D2 | 块内容口径 | unit 的 `source_ref`（book + 页窗）指向 **8902 真实解析产物**，中栏按版式渲染该页正文，占位段落带「待生成」标记；LLM 生成正文仍归主链 M-2。**推荐：是**（判据 S1「解析产物回原样」由此满足） |
| D3 | 断点与推进 | 「学完」＝学习者勾选：`POST /learn/courses/{id}/progress`（done/skipped）＋ `PATCH /learn/units/{id}` 的 `covered`；续学定位＝`derived.current_unit_id` 直接进入。服务端掌握门**不入本轮**（归主链 M-3） |
| D4 | 看板／错题本落点 | 看板与结课视图＝课程详情面只读渲染 `GET /progress`（判据 S3）；错题本页面消费 M2 端点 `GET /learn/mistakes`，**推荐本轮不做**（归 ARCH-027-M2 行 S3 判据） |

**批复后实施序**（每步 TDD + 前端门禁 + 浏览器实测）：

1. 书架页 `#/learn`：课程列表（含 `derived` 进度徽章）+ 引用式注册（选 `qt_books` 书行 →
   `POST /learn/courses`，`resources` 只存 ref_id + label 快照）。
2. 链路视图：`GET …/units?level=section|unit` 渲染章节树与块序列，带 `confirmed` / `drift` /
   `gen_status` 标记与续学定位（`current_unit_id`）。
3. 块学习与断点：中栏按块序列逐块渲染（text / formula / figure / quiz / flashcard），
   勾选学完写 `POST …/progress` 与 `covered`，刷新后回到断点。
4. 看板与结课视图：`GET …/progress` 只读渲染（total/done/skipped/percent/completed）。
5. 门禁与实测：`tests/contract` + 全量 pytest + ruff（QED_env 解释器）；`web-ui/` 内
   `tsc -b` + `vitest run` + `npm run build`；`qed-frontend-check` 8903 真机黄金路径。

## 验证与验收

- 每流收口：web 门禁（tsc·vitest·build）+ qed-frontend-check 真实浏览器实测（受限项如实声明）。
- 本壳随条目增改更新「最后更新」。

## 回滚

纯记录文档；界面代码改动按各自提交独立回滚。

## 关闭与归档

关闭条件＝S1~S3 验收通过且登记表无在途条目，由用户裁决收口；关闭时本壳 Retain 归档
`history/plans/<year-month>/`，todo 移除 ARCH-027-M1 行。

**2026-10-09 关闭执行**（用户裁决「先补图片面再收口」）：S1/S2/S3 逐条达成（核销证据见
「S1 图片面补交付与判据核销」节），关闭结果 **Achieved**，本壳 Retain 归档
`docs/history/plans/2026-10/`，todo 移除 `ARCH-027-M1` 行并写入 completed.md。
登记表现在态：UI-2/UI-3/UI-4 已交付，UI-1 渲染基线的口径由 [parsing-ui.md §9/§9.1](../../../design/parsing-ui.md)
与 [frontend-architecture.md](../../../architecture/frontend-architecture.md) 承载（滚动行随本壳关闭，
后续优化项触发时按 roadmap 另立项），UI-5（Little Tutor 选区追问，L9 判定表 M1+M4 双承接）
**评估未做、归属待用户裁决**——本壳不留进行中态，也不擅自改判他行。

## 收口同步与门禁复跑（2026-10-09，台账/文档/归档三步）

- **台账**：`docs/trackers/todo.md` 移除 `ARCH-027-M1` 唯一任务行；`docs/trackers/completed.md`
  新增同 ID 行（Achieved + 证据摘要）；`docs/plans/index.md` 登记归档去处并把学习设计轮活跃
  bullet 收窄为 M2~M5；`docs/trackers/roadmap.md` 第五轮行与「QED-Engine 前端」行的**关联任务列**
  摘除 `ARCH-027-M1`（收口注记挪到能力目标列，避免 G6/roadmap 守护把已关闭 ID 判为未登记引用）。
- **归档**：本壳 `mv` 至 `docs/history/plans/2026-10/`，并按新深度重算双向相对链接——壳内出链
  `../x/` → `../../../x/`、同月兄弟壳改裸文件名、主链壳与 `design-bugfix-log.md` 改指
  `../../../plans/…`；入链六档同步改道（`completed.md` 两行、tracker-v1 壳、主链壳、ARCH-025 壳两处、
  `history/plans/2026-09` 渲染壳、以及 `ChainPanes.tsx`／`chainFromOutline.ts` 头注的规格正本路径）。
  脚本自检：本次触及的八档全部相对链接落盘可解析、零死链。
- **设计晋升**：[parsing-ui.md](../../../design/parsing-ui.md) §9 新增「image 块＝整页页图内联裁切」
  契约（容器 `aspect-ratio`+`overflow:hidden`、页/bbox 百分比换算、无地址或无 bbox 回退题注、
  块图资产无 HTTP 路由故裁切为唯一现行通路）；[learning-workbench-ui.md](../../../design/learning-workbench-ui.md)
  新增 §12 学习书架（状态徽章口径、引用式注册、`ref_id` 首门匹配桥与多门并存边界、书目独立取数降级）
  与 §13「阅读／链路」双模式（生成链路口径、勾选式推进、看板/结课只读派生、断点续学、链路降级矩阵），
  其 关联代码/关联测试 行补入 `LearnShelf`／`ChainPanes`／`chainFromOutline`／`learnChain` 及三份用例；
  [frontend-architecture.md](../../../architecture/frontend-architecture.md) 信息架构补 `#/learn`
  书架行并把 `#/learn/c/:courseId` 改写为双模式形态。
- **门禁复跑（2026-10-09 收口后）**：`web-ui/` 内 `tsc -b` 零错 · `vitest run` **58 档 626 passed**
  （并行 M2 会话曾报 `BlockList.test.tsx` 全量顺序红，本次复跑同序全绿，该单档 20 passed）·
  `npm run build` ✓（产物仍为已真机验证的 `index-D9qO-q1z.js`，注释级改动不影响包体）；
  根侧 `pytest tests` **735 passed / 2 failed** · `ruff check backend tests scripts` All checks passed。
  **两红归因不修**＝并行 ARCH-027-M2 收口在飞件（`history/plans/2026-10/2026-09-23-practice-review.md` 状态已是
  `Completed` 且 todo 行已移除，壳尚未归档／未同步镜像），属 `test_plan_governance` 与
  `test_tracker_governance` 对该壳的实况报红，本任务未触该壳；本任务自身面（契约 80 passed、
  roadmap/todo/completed/index/设计五档）全绿。
- **提交**：未获用户明确要求，本会话不执行 `git commit`／`push`；提交号待用户窗口执行后补登。
