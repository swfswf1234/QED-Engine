# 学习中心 · 知识梳理星图 UI 设计（learning-star-map）

设计状态：Accepted
实现状态：Implemented
最后更新：2026-10-07
确认状态：已确认
关联代码：`web-ui/src/pages/Knowledge.tsx`、`web-ui/src/pages/CourseKnowledge.tsx`、
`web-ui/src/components/starMapLayout.ts`、`web-ui/src/components/StarMapGraph.tsx`、
`web-ui/src/components/EChart.tsx`、`web-ui/src/components/HelpModal.tsx`、
`web-ui/src/stores/starMap.ts`、`web-ui/src/stores/practice.ts`、`web-ui/src/api/learn.ts`、
`web-ui/src/knowledge.css`、`web-ui/src/help/sections.ts`、`web-ui/public/starfield.jpg`
关联测试：`web-ui/src/components/starMapLayout.test.ts`、`web-ui/src/components/StarMapGraph.test.ts`、
`web-ui/src/components/EChart.test.tsx`、`web-ui/src/pages/Knowledge.test.tsx`、
`web-ui/src/pages/CourseKnowledge.test.tsx`、`web-ui/src/stores/starMap.test.ts`、
`tests/contract/test_design_documents.py`（本文件入 CURRENT_DOCUMENTS）
关联 ADR：[ADR 0017](../../../adr/0017-design-doc-structure-contract.md（本文档结构契约与事实源唯一铁律）、
[ADR 0007](../../history/adr/v0.1/0007-qed-engine-backend-gateway.md（前端唯一入口 8900）
关联设计：[frontend-architecture.md](../../../architecture/frontend-architecture.md（8903 信息架构与视觉规范）、
[api-contracts.md](../../../architecture/api-contracts.md（学习域端点契约事实源）、
[database-design.md](../../../architecture/database-design.md（知识点两表结构事实源）
关联计划：形态演进（首版扇区环布局 → 森林版式）与实施取证由
[M5 知识点体系与知识梳理星图壳](2026-09-30-knowledge-point-star-map.md承载，关闭后归档
`history/plans/`；本档只写设计态。复习入口（课程节点悬停行的「今日复习 N 条」与课程知识点页
页头按钮）由 [M2 练习与复习壳](2026-09-23-practice-review.md承载。

## 1. 定位与目标

本文档是「学习中心 · 知识梳理星图」（`#/knowledge`）与「课程知识点页」
（`#/knowledge/c/:courseId`）的 **UI 设计事实源**：页面信息面、背景层、布局坐标系契约、
森林版式规则、三类图元（轨迹列框 / 课程框 / 先修连线）的视觉与交互口径、下钻与降级表现。
它回答的是「用户如何在一屏星空里看清一个领域的学习轨迹、层级与先修关系，并下钻到某门课的
知识点掌握情况」。

- **服务对象**：学习者本人（项目最终对外的核心界面），不是运维/管理面。
- **成功标准**：① 同一份数据每次画出同一张图（布局确定性）；② 同层级课程跨轨迹对齐成一排，
  连线一律自上而下表达「先修 → 后修」；③ 连线视觉落点在课程框边上，不穿框、不悬空；
  ④ 界面本体零解释文字，读图口径全在使用手册；⑤ 子项目离线或数据未接入时走空态，不白屏。

## 2. 范围与非目标

- **本档管**：星图页与课程知识点页的信息面、背景层、布局纯函数的几何契约、ECharts graph
  渲染口径、悬停/点击/缩放交互、空态与降级表现。
- **本档不管**（事实源改指）：
  - 学习域端点形状、错误码与响应字段 → [api-contracts.md](../../../architecture/api-contracts.md 学习域节；
  - `qed_knowledge_point` / `qed_learn_kp_detail` 两表结构与共享约定 →
    [database-design.md](../../../architecture/database-design.md、
    [cross-project-contracts.md](../../design/cross-project-contracts.md；
  - 8903 全局信息架构、路由与视觉 token → [frontend-architecture.md](../../../architecture/frontend-architecture.md；
  - 知识点候选池的挖掘/生成链路（GraphRAG 等）→ 未立项，暂不落设计；
  - 管理后台各页 → [admin-console.md](../../design/admin-console.md、[admin-dashboard.md](../../design/admin-dashboard.md。
- **非目标**：不做力导向布局（`force`）与自动美化迭代；不引入新的图表/图形依赖（ECharts 按需
  `GraphChart` 已足）；不在图上承载知识点计数以外的业务操作（一切写操作归课程知识点页）。

## 3. 页面信息面与导航

星图页只保留「能操作的东西」，凡是图上看得出来的信息一律不再用文字重复：

| 位置 | 内容 | 口径 |
| --- | --- | --- |
| 页头左 | 大标题「学习中心 · 知识梳理星图」 | 页面唯一标题，不再出现「领域」字样标签 |
| 标题下 | 领域切换器（下拉） | 默认第一个领域；切换只重算星图，不跳页面、不清缩放态以外的选择 |
| 页头右 | `使用手册` / `刷新` / `返回` 三枚按钮 | 手册打开 `HELP_SECTIONS` 弹窗（星图节为第二节，打开即可见）；刷新重取星图数据；返回回 `#/` |
| 主体 | 星图画布（占满内容区） | 无统计行、无页面内图例句、无轨迹/课程计数 |

- **图例与读图口径归使用手册**：`help/sections.ts`「知识梳理星图」一节是读图说明的唯一落点
  （竖虚线列框＝学习轨迹、框内矩形卡＝课程、同一排＝同一层级、实线＝同轨先修、虚线＝跨轨先修、
  点击课程卡进知识点页、滚轮缩放与拖拽平移）。
- **手册弹窗渲染在星图页局部暗色 `ConfigProvider` 之外**（走全局浅色主题），保证正文黑字对比度；
  弹窗组件与首页共用 `components/HelpModal.tsx`。
- **课程知识点页**右上角固定「返回星图」，直接打开链接（无来路）时同样可用。

## 4. 背景层（星空图像 + CSS 动效）

`.kn-galaxy` 的背景是自上而下的固定层序，任一层缺位只降级不报错：

| 层序 | 层 | 口径 |
| --- | --- | --- |
| 1（最上） | 三团 `radial-gradient` 辉光 | 蓝 / 紫 / 深蓝，给画面色彩层次 |
| 2 | 压暗层 `linear-gradient(rgba(4,8,22,.5))` | 保证课程框、轨迹名与连线的可读对比 |
| 3 | 星空图像 `url('/starfield.jpg') center / cover no-repeat` | 用户提供的位图，放 `web-ui/public/`，随构建拷入 `dist/`；不引 npm 依赖 |
| 4（兜底） | 底色 `#070b1c` | 图片缺位时只剩渐变与底色，页面照常可用 |

其上再叠两档 **CSS 星点动效层**（`::before` 细密小星缓慢漂移、`::after` 亮星呼吸），
`pointer-events: none`，`prefers-reduced-motion` 下关闭动画。星图内容层 `z-index` 高于全部背景层。

## 5. 坐标系与套满系数（布局 ↔ 渲染契约）

布局是**纯函数** `starMapLayout(domain, edges, view) → StarMapLayout`，渲染层不做任何几何决策。

- **view 来自实测容器**：`ResizeObserver` 供给容器宽高，只接受 ≥ 480×360 的实测值，否则退回
  缺省 `STARMAP_VIEW`（1200×700）；不使用固定坐标系，避免等比缩放后图挤一角。
- **套满系数预乘**：ECharts `graph`（`layout:'none'`）会把「成员点包围盒」等比铺满 series 矩形，
  而符号尺寸按 px 原样绘制。因此布局侧先把该系数**预乘**进坐标与框尺寸，并回传与之配对的
  `chartMarginX/Y` 作为 series 四边留白，使渲染侧系数恰为 1；否则点距被放大而框不变，课程卡会
  掉出轨迹列框。
- **封顶与取整**：系数按「列框相对成员点包围盒中心的最远伸出」封顶（保证虚线列框整体不出画布），
  并在 `MIN_SCALE`~`MAX_SCALE` 内**先取整再套用**，使导出的 `scale` 与坐标/框尺寸严格同源
  （行距恰等于 `ROW_H × scale`）。
- **尺寸变化后重放 option**：`EChart` 在窗口/容器尺寸变化时既 `resize()` 又 `setOption(option, true)`
  ——系数在 init 时算定，只 resize 会停在旧取景（容器从 0 长起来时表现为图挤在一角）。
- **确定性**：同输入必得同坐标（无随机、无时间因子），vitest 断言同层级共用一条 y、基础排对齐、
  列框包住本轨全部课程框、列间不压叠、连线必然下行、渲染系数为 1 且整体落在画布内。

## 6. 森林版式：层＝行 × 轨迹＝列

星图是**自上而下的森林**（不是环、不是力导向团）：

- **行＝层级 tier**：`tier = max(stage 档序, 先修拓扑深度)`。stage 档序取领域 `stages` 的值序
  （基础 0 / 主干 1 / 分支 2 / 前沿 3，未知值退回拓扑深度）；拓扑深度由先修边逐层求出，成环不断链。
  随后做**有界松弛**（轮数上限＝课程数，提前收敛即停），保证每条先修边严格下行。
  **同 tier 的课程共用一条 y**，因此「基础」层的数学分析 / 高等代数 / 概率论与数理统计天然对齐成
  一排，跨轨迹也对齐。
- **行号稠密化**：实际出现的 tier 值映射到连续行号，行距恒为 `ROW_H × scale`，不留空行。
- **列＝学习轨迹**：一轨一列。列序按 `kind=main` 优先 → 课程数降序 → 轨迹名字典序；
  **核心列居中（x=0），其余列按主次左右交替环绕**，游标＝已排内容边界 + 列间隙（首个邻列也必须
  留出一个列间隙，否则压叠）。
- **列内排布**：同 tier 多门课并排占位，整行以列中心对称展开；行内顺序按**父辈重心**定序
  （两遍：先按初排求重心，再按重心重排），减少同层内的连线交叉；无重心信息时退回 course_id 字典序。
- **列宽自适应**：列宽＝该轨最宽一行所需宽度 + 内边距，小簇不会被大簇挤没。

## 7. 图元：轨迹列框 / 课程框 / 先修连线

| 图元 | 形态 | 口径 |
| --- | --- | --- |
| 轨迹列框（星云） | 竖长 `roundRect`，透明填充 + 同轨色 **dashed** 描边，核心列描边略粗略实 | 由本轨全部课程框的包围盒 + 内边距推出 `x/y/w/h`；轨迹名写在框内**顶部名称带**（大字、粗体、亮白 + 深色文字描边）；列框上沿比最上排成员多让出一行 |
| 课程框 | `roundRect`，**不透明**深底 + 同轨色描边 + 圆角 | 宽＝按课名估宽（CJK 计满宽、拉丁计窄宽）+ 内边距，高固定；字号随 `scale` 走并夹在可读区间；课名过长走 `truncate`。**宁可框大，不可字糊** |
| 先修连线 | 同轨**实线**、跨轨**虚线**，**无箭头** | 端点语义＝父框底边 → 子框顶边（tier 严格递增，中心连线必然下行）；弯曲度由布局逐边挑选，绕开无关课程框 |

- **课程框必须不透明**：ECharts 的 link 端点锚在节点**中心**，课程框绘制在 link 之上，故可见段
  恰好落在框边；框底一旦半透明，连线会穿框而过、看起来「连错位置」。
- **不再画轨迹之间的软链**，也不画课程圆点——连线只连课程框。
- **知识点计数不进图**：只在悬停提示与课程知识点页出现（`已确认 N · 待选 M`）。
- **绘制层序**：轨迹列框先入 `data` → 画在连线与课程框之下。

## 8. 交互：悬停、点击、缩放

| 对象 | 悬停 | 点击 |
| --- | --- | --- |
| 课程框 | 高亮（底色提亮 + 白色描边加粗 + 标签转白加粗）+ 提示「课程名 / 已确认 N · 待选 M」（有到期项时追加 `· 今日复习 K 条`） | 进入 `#/knowledge/c/:courseId` |
| 轨迹列框 | **无任何效果**（不高亮、不出提示） | 无（`nebula:` 前缀的节点 id 在回调里过滤掉） |
| 画布空白 | 无 | 无；滚轮缩放、按住拖动平移（`roam`，缩放限幅） |

- 高亮态写在 **series 级 `emphasis`**（ECharts graph 符号的状态样式取自 series emphasis 模型，
  逐项写法只是靠模型继承达到同效），`scale:false` 不放大、`focus:'none'` 不做邻接淡出；
  轨迹列框逐项 `emphasis:{disabled:true}` 彻底关掉悬停派发。
- 提示框对非课程节点返回空串，避免出现「空提示」。
- **复习条数只进提示行，不进图元**：按当前领域的课程列表逐个 `GET /learn/review/due?course=&max_tasks=1`
  取 `total_due`（聚合在 store 侧，失败按 0 条），只拼进课程框的悬停提示串；**0 条不写该段**，
  画布内**不新增可点元素**（选中/悬停/下钻三态已占满，再加按钮会挤掉徽标口径）。
  可点的复习入口在课程知识点页页头（§9）。

## 9. 课程知识点页

- 卡片列表：每张卡＝一个已确认知识点，含 `type` 四分类徽章 + 掌握徽章 + 来源锚点数；
  可展开候选明细抽屉查看同一知识点的多条叙述与来源版本。
- **徽章文案自带口径**：一个口径一个词，多口径各给一枚徽章，不依赖脚注小字。
- 该课程无已确认知识点时走空态文案（不显示空壳列表）；候选池数据未接入时抽屉走空态。
- **复习入口＝页头按钮**：本课 `GET /learn/review/due?course=&max_tasks=1` 聚合出的
  `total_due` **大于 0** 时，页头统计段追加 primary 按钮「今日复习 N 条」，点击进
  `#/learn/c/:courseId`（学习工作台，其右栏「本章练习」页签承载到期队列）；**0 条不渲染按钮**，
  聚合失败同样按 0 条处理。这是两页唯一的可点复习入口——星图画布内只写悬停提示行（§8）。

## 10. 状态与降级矩阵

| 场景 | 用户可见表现 | 口径 |
| --- | --- | --- |
| 数据正常 | 森林星图（轨迹列框 + 课程框 + 先修连线） | — |
| 星图加载中 | 画布区加载态，不闪空态 | 首次进入与切换领域均适用 |
| 领域目录不可达（8901 离线等） | 空态「课程目录暂不可达，星图无课程可展示」 | 星图降级为空态，**不白屏**、不报错弹窗 |
| 领域有轨迹但无课程 | 同上空态 | 轨迹列框不单独展示（无成员的列不画） |
| 知识点数据未接入 | 课程框照常显示（计数为 0），下钻页走空态 | 星图不因知识点缺失而隐藏课程 |
| 复习条数聚合失败（8900 练习端点不可达等） | 提示行不写「今日复习」段、课程知识点页无复习按钮 | 按 0 条静默降级，不弹错、不阻塞星图渲染 |
| 子项目离线 | 星图照常渲染已有目录数据 | 8903 只连 8900，离线透传口径见 cross-project-contracts |
| `prefers-reduced-motion` | 星点动效关闭，静态星空 | 不影响布局与交互 |
| 星空图片缺位 | 只剩渐变辉光与底色 | 布局与交互不变 |

## 11. 已知约束与维护规则

- **8903 只连 8900**（ADR 0007）：星图数据一律经 8900 学习域端点，页面不得直连 8901/8902。
- **暗色只在星图页局部生效**：页面级 `ConfigProvider` 暗色，不改全局 token、不影响 admin 浅色页。
- **布局与渲染的分工是硬边界**：几何决策只在 `starMapLayout.ts`（纯函数、可单测），
  `StarMapGraph.tsx` 只做「按布局数据画图 + 用配对留白」；新增视觉规则先改布局纯函数与其测试。
- **改本档的触发条件**：图元形态、版式规则（行/列语义）、交互口径、降级表现变化 → 先改本档再改码；
  纯参数微调（间距、字号、色值）随码走，不必回改本档，但 `starMapLayout.test.ts` 的不变量断言必须同步。
- **端点与表结构不在本档复制**：形状变化只改 api-contracts / database-design，本档最多改消费语义。
